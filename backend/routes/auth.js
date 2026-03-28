const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs');
const { verifyCaptchaOptional } = require('../middleware/captchaVerify');

const path = require('path');

// GET /api/auth/profile-photo/:filename - Profil fotoğrafı serve etme
// GET /api/auth/profile-photo/:filename - Profil fotoğrafı serve etme
router.get('/profile-photo/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, '..', 'uploads', 'profiles', filename);
  
  console.log('📸 Profile photo requested:', filename);
  
  if (!fs.existsSync(filepath)) {
    console.log('❌ File not found:', filepath);
    return res.status(404).json({
      success: false,
      error: 'Profile photo not found'
    });
  }
  
  res.sendFile(filepath, (err) => {
    if (err) {
      console.error('❌ Error serving profile photo:', err);
      res.status(500).json({
        success: false,
        error: 'Error serving profile photo'
      });
    } else {
      console.log('✅ Profile photo served successfully');
    }
  });
});





// POST /api/auth/login - Email ile öğrenci giriş (ESKİ VERSİYON)
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

// POST /api/auth/login-email - YENİ: Email ile öğrenci giriş
router.post('/login-email', verifyCaptchaOptional, async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Student login attempt with email:', { email });

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Öğrenciyi email ile bul - FACULTY EKLENDİ
    const [students] = await pool.execute(
      'SELECT student_id, student_number, name, email, program, faculty, profile_photo, password FROM students WHERE email = ?',
      [email]
    );

    if (students.length === 0) {
      console.log('Student not found with email:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const student = students[0];

    // Şifre kontrolü
    const isValidPassword = await bcrypt.compare(password, student.password);
    
    if (!isValidPassword) {
      console.log('Invalid password for student:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // JWT token oluştur
    const token = jwt.sign(
      { 
        student_id: student.student_id,
        student_number: student.student_number,
        email: student.email,
        type: 'student'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Şifreyi response'dan çıkar
    const { password: _, ...studentData } = student;

    console.log('Student login successful:', studentData.student_number);

    res.json({
      success: true,
      message: 'Student login successful',
      data: {
        token,
        user: studentData
      }
    });

  } catch (error) {
    console.error('Student email login error:', error);
    res.status(500).json({
      success: false,
      error: 'Student login failed'
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
    // Database'den kullanıcıyı profile_photo ile birlikte çek
    const [students] = await pool.execute(
      'SELECT student_id, student_number, name, email, program, faculty, profile_photo FROM students WHERE student_id = ?',
      [req.user.student_id]
    );

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    console.log('Student profile data:', students[0]); // Debug için
    console.log('Profile photo path:', students[0].profile_photo); // Debug için

    res.json({
      success: true,
      data: students[0]
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

// ✅ BURAYA EKLE ↓↓↓

// POST /api/auth/check-email-type - Email hangi kullanıcı tipine ait?
router.post('/check-email-type', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log('🔍 Checking email type for:', email);

    // Önce admin'de ara
    const [admins] = await pool.execute(
      'SELECT admin_id FROM admin_users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (admins.length > 0) {
      console.log('✅ Email found in admin_users');
      return res.json({
        success: true,
        userType: 'admin'
      });
    }

    // Sonra student'da ara
    const [students] = await pool.execute(
      'SELECT student_id FROM students WHERE email = ?',
      [email]
    );

    if (students.length > 0) {
      console.log('✅ Email found in students');
      return res.json({
        success: true,
        userType: 'student'
      });
    }

    // Email sistemde yok
    console.log('❌ Email not found in system');
    return res.json({
      success: true,
      userType: null
    });

  } catch (error) {
    console.error('❌ Email type check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check email type'
    });
  }
});



module.exports = router;