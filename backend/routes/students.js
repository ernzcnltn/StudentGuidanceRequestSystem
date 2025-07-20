const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

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

module.exports = router;