const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateAdmin } = require('../middleware/adminAuth');
const { requireRole } = require('../middleware/adminAuth');

// GET /api/student-management — Tüm kayıtlı öğrenciler
router.get('/', authenticateAdmin, requireRole(['super_admin']), async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const search = req.query.search ? req.query.search.trim() : '';
    const filter = req.query.filter || 'all'; // all | active | inactive | google | local
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];

    if (search) {
      where.push('(s.student_number LIKE ? OR s.name LIKE ? OR s.email LIKE ? OR s.program LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    if (filter === 'active')   where.push('s.is_active = TRUE');
    if (filter === 'inactive') where.push('s.is_active = FALSE');
    if (filter === 'google')   where.push("s.auth_provider = 'google'");
    if (filter === 'local')    where.push("s.auth_provider = 'local'");

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const countQuery = `SELECT COUNT(*) as total FROM students s ${whereClause}`;
    const dataQuery  = `
      SELECT 
        s.student_id, s.student_number, s.name, s.email,
        s.program, s.faculty, s.is_active, s.auth_provider,
        s.must_change_password, s.created_at,
        s.profile_photo
      FROM students s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [countResult] = await pool.query(countQuery, params);
    const [students]    = await pool.query(dataQuery, params);

    res.json({
      success: true,
      data: students,
      pagination: {
        total:      countResult[0].total,
        page,
        limit,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Student management fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch students' });
  }
});

// GET /api/student-management/stats
router.get('/stats', authenticateAdmin, requireRole(['super_admin']), async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_active = TRUE  THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN auth_provider = 'google' THEN 1 ELSE 0 END) as google_auth,
        SUM(CASE WHEN auth_provider = 'local'  THEN 1 ELSE 0 END) as local_auth,
        SUM(CASE WHEN must_change_password = TRUE THEN 1 ELSE 0 END) as must_change_password
      FROM students
    `);
    res.json({ success: true, data: stats[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// PATCH /api/student-management/:id/toggle-active — Aktif/Pasif yap
router.patch('/:id/toggle-active', authenticateAdmin, requireRole(['super_admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const [student] = await pool.execute(
      'SELECT student_id, is_active, name FROM students WHERE student_id = ?',
      [id]
    );

    if (student.length === 0) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const newStatus = !student[0].is_active;
    await pool.execute(
      'UPDATE students SET is_active = ? WHERE student_id = ?',
      [newStatus, id]
    );

    res.json({
      success: true,
      message: `Student ${newStatus ? 'activated' : 'deactivated'} successfully`,
      data: { is_active: newStatus }
    });
  } catch (error) {
    console.error('Toggle active error:', error);
    res.status(500).json({ success: false, error: 'Failed to update student status' });
  }
});

// DELETE /api/student-management/:id — Öğrenci sil
router.delete('/:id', authenticateAdmin, requireRole(['super_admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const [student] = await pool.execute(
      'SELECT student_id, student_number, email, name FROM students WHERE student_id = ?',
      [id]
    );

    if (student.length === 0) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const { student_number, email, name } = student[0];

    // Öğrenciyi sil
    await pool.execute('DELETE FROM students WHERE student_id = ?', [id]);

    // Whitelist'i sıfırla (varsa)
    await pool.execute(
      'UPDATE student_whitelist SET is_used = FALSE WHERE student_number = ?',
      [student_number]
    );

    console.log(`Student deleted: ${name} (${email}) by admin`);

    res.json({
      success: true,
      message: `Student ${name} deleted successfully. Whitelist entry reset.`
    });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete student' });
  }
});

module.exports = router;