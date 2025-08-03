const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');


// POST /api/auth/login - Öğrenci giriş
router.post('/login', async (req, res) => {
  try {
    const { student_number, password } = req.body;

    if (!student_number || !password) {
      return res.status(400).json({
        success: false,
        error: 'Student number and password are required'
      });
    }

    // Öğrenciyi bul
    const [students] = await pool.execute(
      'SELECT * FROM students WHERE student_number = ?',
      [student_number]
    );

    if (students.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid student number or password'
      });
    }

    const student = students[0];

    // Şifre kontrolü
    const isValidPassword = await bcrypt.compare(password, student.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid student number or password'
      });
    }

    // JWT token oluştur
    const token = jwt.sign(
      { 
        student_id: student.student_id,
        student_number: student.student_number,
        email: student.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Şifreyi response'dan çıkar
    const { password: _, ...studentData } = student;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: studentData
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// POST /api/auth/register - Registration with welcome email
router.post('/register', async (req, res) => {
  try {
    const { student_number, name, email, password, program } = req.body;

    if (!student_number || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Check if student already exists
    const [existingStudents] = await pool.execute(
      'SELECT student_id FROM students WHERE student_number = ? OR email = ?',
      [student_number, email]
    );

    if (existingStudents.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Student number or email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create student
    const [result] = await pool.execute(
      'INSERT INTO students (student_number, name, email, password, program) VALUES (?, ?, ?, ?, ?)',
      [student_number, name, email, hashedPassword, program]
    );

    

    res.status(201).json({
      success: true,
      message: 'Student registered successfully. Welcome email sent!',
      data: {
        student_id: result.insertId,
        student_number,
        name,
        email,
        program
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

// GET /api/auth/me - Kullanıcı profili
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
});

// POST /api/auth/logout - Çıkış (client-side token silme)
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});


module.exports = router;