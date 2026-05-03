const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { pool } = require('../config/database');
const { authenticateAdmin } = require('../middleware/adminAuth');
const { requireRole } = require('../middleware/adminAuth');

// Multer — memory storage (dosyayı diske kaydetme)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'));
    }
  }
});

// GET /api/whitelist/stats — İstatistikler (önce tanımlanmalı, /:id'den önce)
router.get('/stats', authenticateAdmin, requireRole(['super_admin']), async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_used = TRUE THEN 1 ELSE 0 END) as used,
        SUM(CASE WHEN is_used = FALSE THEN 1 ELSE 0 END) as available
      FROM student_whitelist
    `);
    res.json({ success: true, data: stats[0] });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// GET /api/whitelist/template — Excel template indir (önce tanımlanmalı)
router.get('/template', authenticateAdmin, requireRole(['super_admin']), (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['student_number', 'name', 'program', 'faculty'],
    ['20200001', 'John Doe', 'Computer Engineering', 'Engineering'],
    ['20200002', 'Jane Smith', 'Business Administration', 'Business']
  ]);
  
  ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Whitelist');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="whitelist_template.xlsx"');
  res.send(buffer);
});

// GET /api/whitelist — Tüm whitelist
router.get('/', authenticateAdmin, requireRole(['super_admin']), async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const search = req.query.search ? req.query.search.trim() : '';
    const offset = (page - 1) * limit;

    let query      = 'SELECT * FROM student_whitelist';
    let countQuery = 'SELECT COUNT(*) as total FROM student_whitelist';
    const params      = [];
    const countParams = [];

    if (search) {
      const like = `%${search}%`;
      query      += ' WHERE student_number LIKE ? OR name LIKE ? OR program LIKE ?';
      countQuery += ' WHERE student_number LIKE ? OR name LIKE ? OR program LIKE ?';
      params.push(like, like, like);
      countParams.push(like, like, like);
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    // pool.query kullan (execute LIMIT/OFFSET parametrelerini bazı versiyonlarda hatalı işler)
    const [rows]        = await pool.query(query, params);
    const [countResult] = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total:      countResult[0].total,
        page,
        limit,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Whitelist fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch whitelist' });
  }
});

// POST /api/whitelist/upload — Excel yükle
router.post('/upload', authenticateAdmin, requireRole(['super_admin']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const workbook  = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet     = workbook.Sheets[sheetName];
    const rows      = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length < 2) {
      return res.status(400).json({ success: false, error: 'File is empty or has no data rows' });
    }

    const headers         = rows[0].map(h => String(h).toLowerCase().trim());
    const studentNumberCol = headers.findIndex(h =>
      h.includes('student_number') || h.includes('student number') ||
      h.includes('öğrenci no')     || h.includes('no')
    );

    if (studentNumberCol === -1) {
      return res.status(400).json({
        success: false,
        error: 'Could not find student_number column. Expected header: student_number, student number, or öğrenci no'
      });
    }

    const nameCol    = headers.findIndex(h => h.includes('name')    || h.includes('ad'));
    const programCol = headers.findIndex(h => h.includes('program') || h.includes('bölüm'));
    const facultyCol = headers.findIndex(h => h.includes('faculty') || h.includes('fakülte'));

    const dataRows = rows.slice(1).filter(row => row[studentNumberCol]);

    let inserted = 0;
    let skipped  = 0;
    let errors   = 0;

    const { mode = 'append' } = req.body;

    if (mode === 'replace') {
      await pool.execute('DELETE FROM student_whitelist WHERE is_used = FALSE');
    }

    for (const row of dataRows) {
      const studentNumber = String(row[studentNumberCol]).trim();
      if (!studentNumber) continue;

      try {
        await pool.execute(
          `INSERT INTO student_whitelist (student_number, name, program, faculty, is_used) 
           VALUES (?, ?, ?, ?, FALSE)
           ON DUPLICATE KEY UPDATE 
             name    = IF(is_used = FALSE, VALUES(name),    name),
             program = IF(is_used = FALSE, VALUES(program), program),
             faculty = IF(is_used = FALSE, VALUES(faculty), faculty)`,
          [
            studentNumber,
            nameCol    !== -1 ? String(row[nameCol]    || '').trim() : null,
            programCol !== -1 ? String(row[programCol] || '').trim() : null,
            facultyCol !== -1 ? String(row[facultyCol] || '').trim() : null
          ]
        );
        inserted++;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          skipped++;
        } else {
          errors++;
          console.error('Row insert error:', err.message);
        }
      }
    }

    res.json({
      success: true,
      message: 'Import completed',
      data: { inserted, skipped, errors, total: dataRows.length }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: error.message || 'Upload failed' });
  }
});

// POST /api/whitelist — Tekil ekle
router.post('/', authenticateAdmin, requireRole(['super_admin']), async (req, res) => {
  try {
    const { student_number, name, program, faculty } = req.body;

    if (!student_number) {
      return res.status(400).json({ success: false, error: 'Student number is required' });
    }

    await pool.execute(
      'INSERT INTO student_whitelist (student_number, name, program, faculty, is_used) VALUES (?, ?, ?, ?, FALSE)',
      [student_number.trim(), name || null, program || null, faculty || null]
    );

    res.json({ success: true, message: 'Student added to whitelist' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Student number already exists in whitelist' });
    }
    res.status(500).json({ success: false, error: 'Failed to add student' });
  }
});

// DELETE /api/whitelist/bulk/unused — Kullanılmamış tümünü sil (/:id'den önce olmalı)
router.delete('/bulk/unused', authenticateAdmin, requireRole(['super_admin']), async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM student_whitelist WHERE is_used = FALSE');
    res.json({ success: true, message: `${result.affectedRows} unused entries deleted` });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete entries' });
  }
});

// DELETE /api/whitelist/:id — Tekil sil
router.delete('/:id', authenticateAdmin, requireRole(['super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [entry] = await pool.execute('SELECT * FROM student_whitelist WHERE id = ?', [id]);
    
    if (entry.length === 0) {
      return res.status(404).json({ success: false, error: 'Entry not found' });
    }

    if (entry[0].is_used) {
      return res.status(400).json({ success: false, error: 'Cannot delete a used entry (student already registered)' });
    }

    await pool.execute('DELETE FROM student_whitelist WHERE id = ?', [id]);
    res.json({ success: true, message: 'Entry deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete entry' });
  }
});

module.exports = router;