const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth'); // 👈 IMPORT EKLE

// GET /api/students - Tüm öğrencileri getir
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT student_id, student_number, name, email, program, created_at FROM students ORDER BY name'
    );
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch students' 
    });
  }
});

// GET /api/students/:id - Belirli bir öğrenciyi getir
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT student_id, student_number, name, email, program, created_at FROM students WHERE student_id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch student' 
    });
  }
});

// 👇 YENİ: Course Search (Autocomplete)
router.get('/courses/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    console.log('🔍 Course search query:', q);

    // Minimum 2 karakter gerekli
    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    // Öğrencinin faculty'sini al
    const [students] = await pool.execute(
      'SELECT faculty FROM students WHERE student_id = ?',
      [req.user.student_id]
    );
    
    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    const studentFaculty = students[0].faculty;
    console.log('👤 Student faculty:', studentFaculty);

    // Courses tablosundan ara
    const searchTerm = `%${q}%`;
    
    let query = `
      SELECT 
        course_id,
        course_code,
        course_name,
        instructor_name,
        department,
        semester,
        credits
      FROM courses
      WHERE is_active = TRUE
        AND (course_code LIKE ? OR course_name LIKE ?)
    `;
    
    const params = [searchTerm, searchTerm];

    // Faculty filtresi
    if (studentFaculty) {
      query += ' AND faculty = ?';
      params.push(studentFaculty);
    }

    query += ' ORDER BY course_code LIMIT 10';

    const [courses] = await pool.execute(query, params);

    console.log(`✅ Found ${courses.length} courses`);

    res.json({
      success: true,
      data: courses
    });

  } catch (error) {
    console.error('❌ Course search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search courses'
    });
  }
});


module.exports = router;