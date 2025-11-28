const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const { authenticateAdminToken } = require('../middleware/adminAuth');

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/courses';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'courses-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel/CSV files allowed!'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Upload courses (Super Admin only)
router.post('/upload', 
  authenticateAdminToken,

  upload.single('coursesFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'No file uploaded' 
        });
      }

      const { mode } = req.body; // 'add' or 'replace'
      
      // Parse Excel
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          success: false, 
          error: 'File is empty' 
        });
      }

      // Validate columns
      const required = ['course_code', 'course_name', 'instructor_name', 'faculty'];
      const missing = required.filter(col => !(col in data[0]));
      
      if (missing.length > 0) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: `Missing columns: ${missing.join(', ')}`
        });
      }

      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        if (mode === 'replace') {
          await connection.execute('UPDATE courses SET is_active = FALSE');
        }

        let added = 0;
        let updated = 0;
        const errors = [];

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          
          try {
            const [existing] = await connection.execute(
              `SELECT course_id FROM courses 
               WHERE course_code = ? AND faculty = ?`,
              [row.course_code, row.faculty]
            );

            if (existing.length > 0) {
              await connection.execute(
                `UPDATE courses 
                 SET course_name = ?, instructor_name = ?, department = ?, 
                     semester = ?, credits = ?, is_active = TRUE, updated_by = ?
                 WHERE course_id = ?`,
                [
                  row.course_name,
                  row.instructor_name || null,
                  row.department || null,
                  row.semester || null,
                  row.credits || null,
                  req.admin.admin_id,
                  existing[0].course_id
                ]
              );
              updated++;
            } else {
              await connection.execute(
                `INSERT INTO courses 
                 (course_code, course_name, instructor_name, faculty, department, semester, credits, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  row.course_code,
                  row.course_name,
                  row.instructor_name || null,
                  row.faculty,
                  row.department || null,
                  row.semester || null,
                  row.credits || null,
                  req.admin.admin_id
                ]
              );
              added++;
            }
          } catch (err) {
            errors.push({
              row: i + 2,
              course_code: row.course_code,
              error: err.message
            });
          }
        }

        await connection.commit();

        res.json({
          success: true,
          message: 'Courses uploaded',
          stats: { total: data.length, added, updated, errors: errors.length },
          errors: errors.length > 0 ? errors : undefined
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      fs.unlinkSync(req.file.path);

    } catch (error) {
      console.error('Error uploading courses:', error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Export courses
router.get('/export', 
  authenticateAdminToken,
 
  async (req, res) => {
    try {
      const [courses] = await pool.execute(
        `SELECT course_code, course_name, instructor_name, faculty, 
                department, semester, credits, is_active
         FROM courses ORDER BY faculty, course_code`
      );

      const worksheet = xlsx.utils.json_to_sheet(courses);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Courses');

      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=courses-${Date.now()}.xlsx`);
      res.send(buffer);

    } catch (error) {
      console.error('Error exporting:', error);
      res.status(500).json({ success: false, error: 'Export failed' });
    }
  }
);

// Get all courses
router.get('/', authenticateAdminToken, async (req, res) => {
  try {
    const { faculty, is_active } = req.query;
    
    let query = 'SELECT * FROM courses WHERE 1=1';
    const params = [];

    if (faculty) {
      query += ' AND faculty = ?';
      params.push(faculty);
    }

    if (is_active !== undefined) {
      query += ' AND is_active = ?';
      params.push(is_active === 'true');
    }

    query += ' ORDER BY faculty, course_code';

    const [courses] = await pool.execute(query, params);

    res.json({ success: true, data: courses });

  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch' });
  }
});

// Download template
router.get('/template', 
  authenticateAdminToken,
 
  (req, res) => {
    try {
      const template = [
        {
          course_code: 'SOFT411',
          course_name: 'COMPUTER SCIENCE',
          instructor_name: 'EREN ALTIN',
          faculty: 'Engineering',
          department: 'Software Engineering',
          semester: 'Fall 2024',
          credits: 3
        }
      ];
      
      const worksheet = xlsx.utils.json_to_sheet(template);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Template');

      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=courses-template.xlsx');
      res.send(buffer);

    } catch (error) {
      console.error('Error generating template:', error);
      res.status(500).json({ success: false, error: 'Failed' });
    }
  }
);

module.exports = router;