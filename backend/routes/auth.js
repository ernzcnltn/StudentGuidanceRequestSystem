const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const emailService = require('../services/emailService');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs');
const { verifyCaptchaOptional } = require('../middleware/captchaVerify');

const path = require('path');

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Google Strategy Setup
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email    = profile.emails[0].value;
    const googleId = profile.id;
    const name     = profile.displayName;

    console.log('🔍 Google OAuth - email:', email);

    // Domain kontrolü
    if (!email.endsWith('@final.edu.tr')) {
      console.log('❌ Domain rejected:', email);
      return done(null, false, { message: 'only_school_email' });
    }

    // Öğrenci var mı kontrol et
    const [students] = await pool.execute(
      'SELECT * FROM students WHERE email = ? OR google_id = ?',
      [email, googleId]
    );

    console.log('🔍 Students found:', students.length);

    if (students.length > 0) {
      const student = students[0];
      console.log('✅ Existing student:', student.email, 'is_active:', student.is_active);

      if (student.is_active === false || student.is_active === 0) {
        return done(null, false, { message: 'account_inactive' });
      }

      // google_id yoksa güncelle
      if (!student.google_id) {
        await pool.execute(
          'UPDATE students SET google_id = ?, auth_provider = "both" WHERE student_id = ?',
          [googleId, student.student_id]
        );
      }

      return done(null, { ...student, isNewUser: false });
    }

    // Yeni öğrenci → kayıt sayfasına
    console.log('🆕 New user, redirecting to register');
    return done(null, { isNewUser: true, email, googleId, name });

  } catch (error) {
    console.error('❌ Google OAuth error:', error);
    return done(error, null);
  }
}));

passport.serializeUser((user, done)   => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ─────────────────────────────────────────────────────────────
// GET /api/auth/profile-photo/:filename
// ─────────────────────────────────────────────────────────────
router.get('/profile-photo/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, '..', 'uploads', 'profiles', filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ success: false, error: 'Profile photo not found' });
  }

  res.sendFile(filepath, (err) => {
    if (err) res.status(500).json({ success: false, error: 'Error serving profile photo' });
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/login  (student_number + password)
// ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { student_number, password } = req.body;

    if (!student_number || !password) {
      return res.status(400).json({ success: false, error: 'Student number and password are required' });
    }

    const [students] = await pool.execute(
      'SELECT * FROM students WHERE student_number = ?',
      [student_number]
    );

    if (students.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid student number or password' });
    }

    const student = students[0];
    const isValid = await bcrypt.compare(password, student.password);

    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid student number or password' });
    }

    const token = jwt.sign(
      { student_id: student.student_id, student_number: student.student_number, email: student.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { password: _, ...studentData } = student;
    res.json({ success: true, message: 'Login successful', data: { token, user: studentData } });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/login-email  (email + password)
// ─────────────────────────────────────────────────────────────
router.post('/login-email', verifyCaptchaOptional, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const [students] = await pool.execute(
      'SELECT student_id, student_number, name, email, program, faculty, profile_photo, password FROM students WHERE email = ?',
      [email]
    );

    if (students.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const student  = students[0];
    const isValid  = await bcrypt.compare(password, student.password);

    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { student_id: student.student_id, student_number: student.student_number, email: student.email, type: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { password: _, ...studentData } = student;
    res.json({ success: true, message: 'Student login successful', data: { token, user: studentData } });

  } catch (error) {
    console.error('Student email login error:', error);
    res.status(500).json({ success: false, error: 'Student login failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/register  (email/password kayıt)
// ─────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { student_number, name, email, password, program, faculty } = req.body;

    if (!student_number || !name || !email || !password) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    const [existing] = await pool.execute(
      'SELECT student_id FROM students WHERE student_number = ? OR email = ?',
      [student_number, email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'Student number or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      'INSERT INTO students (student_number, name, email, password, program, faculty, is_active, auth_provider) VALUES (?, ?, ?, ?, ?, ?, TRUE, "local")',
      [student_number, name, email, hashedPassword, program || null, faculty || null]
    );

    res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      data: { student_id: result.insertId, student_number, name, email, program, faculty }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [students] = await pool.execute(
      'SELECT student_id, student_number, name, email, program, faculty, profile_photo, must_change_password FROM students WHERE student_id = ?',
      [req.user.student_id]
    );

    if (students.length === 0) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    res.json({ success: true, data: students[0] });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logout successful' });
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/check-email-type
// ─────────────────────────────────────────────────────────────
router.post('/check-email-type', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const [admins] = await pool.execute(
      'SELECT admin_id FROM admin_users WHERE email = ? AND is_active = TRUE',
      [email]
    );
    if (admins.length > 0) return res.json({ success: true, userType: 'admin' });

    const [students] = await pool.execute(
      'SELECT student_id FROM students WHERE email = ?',
      [email]
    );
    if (students.length > 0) return res.json({ success: true, userType: 'student' });

    return res.json({ success: true, userType: null });

  } catch (error) {
    console.error('Email type check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check email type' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/auth/google  — OAuth başlat
// ─────────────────────────────────────────────────────────────
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

// ─────────────────────────────────────────────────────────────
// GET /api/auth/google/callback
// ─────────────────────────────────────────────────────────────
router.get('/google/callback',
  (req, res, next) => {
    passport.authenticate('google', {
      session: false,
      failWithError: false,
    }, (err, user, info) => {
      const frontendURL = process.env.NODE_ENV === 'production'
        ? 'https://srs.fnlsrv.website'
        : 'http://localhost:3000';

      if (err) {
        console.error('❌ Passport error:', err);
        return res.redirect(`${frontendURL}/login?error=oauth_failed`);
      }

      if (!user) {
        const msg = info?.message || 'oauth_failed';
        console.log('❌ Auth failed, message:', msg);
        return res.redirect(`${frontendURL}/login?error=${msg}`);
      }

      req.user = user;
      next();
    })(req, res, next);
  },
  async (req, res) => {
    try {
      const user = req.user;
      const frontendURL = process.env.NODE_ENV === 'production'
        ? 'https://srs.fnlsrv.website'
        : 'http://localhost:3000';

      console.log('✅ Callback user:', user?.email, 'isNewUser:', user?.isNewUser);

      // Yeni kullanıcı → kayıt sayfasına yönlendir
      if (user.isNewUser) {
        const params = new URLSearchParams({
          email:    user.email,
          googleId: user.googleId,
          name:     user.name,
        });
        return res.redirect(`${frontendURL}/google/register?${params}`);
      }

      // Mevcut kullanıcı → JWT ver
      const token = jwt.sign(
        {
          student_id:     user.student_id,
          student_number: user.student_number,
          email:          user.email,
          type:           'student'
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.redirect(`${frontendURL}/auth/callback?token=${token}`);

    } catch (error) {
      console.error('❌ Google callback error:', error);
      const frontendURL = process.env.NODE_ENV === 'production'
        ? 'https://srs.fnlsrv.website'
        : 'http://localhost:3000';
      res.redirect(`${frontendURL}/login?error=oauth_failed`);
    }
  }
);

// ─────────────────────────────────────────────────────────────
// POST /api/auth/register-google
// ─────────────────────────────────────────────────────────────
router.post('/register-google', async (req, res) => {
  try {
    const { email, googleId, name, student_number, faculty, program } = req.body;

    if (!email || !googleId || !name || !student_number) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }
    if (!faculty || !program) {
      return res.status(400).json({ success: false, error: 'Faculty and program are required' });
    }

    // Domain kontrolü
    if (!email.endsWith('@final.edu.tr')) {
      return res.status(403).json({ success: false, error: 'Only school email addresses are allowed' });
    }

    // Whitelist kontrolü
    const [whitelist] = await pool.execute(
      'SELECT * FROM student_whitelist WHERE student_number = ?',
      [student_number]
    );

    if (whitelist.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Student number not found in active student list. Contact your department.'
      });
    }

    if (whitelist[0].is_used) {
      return res.status(409).json({ success: false, error: 'This student number is already registered' });
    }

    // Zaten kayıtlı mı?
    const [existing] = await pool.execute(
      'SELECT student_id FROM students WHERE email = ? OR student_number = ?',
      [email, student_number]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'Email or student number already registered' });
    }

    // Geçici şifre oluştur (8 karakter: harf + rakam)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let tempPassword = '';
    for (let i = 0; i < 8; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Öğrenciyi kaydet — form'dan gelen faculty/program kullan
    const [result] = await pool.execute(
      `INSERT INTO students
        (student_number, name, email, google_id, password, program, faculty, is_active, auth_provider, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, 'google', TRUE)`,
      [student_number, name, email, googleId, hashedPassword, program, faculty]
    );

    // Whitelist'i işaretle
    await pool.execute(
      'UPDATE student_whitelist SET is_used = TRUE WHERE student_number = ?',
      [student_number]
    );

    // Hoşgeldin maili gönder (async — kaydı engellemesin)
    emailService.sendWelcomeWithTempPassword(email, name, student_number, tempPassword)
      .catch(err => console.error('Welcome email error:', err));

    // JWT ver
    const token = jwt.sign(
      { student_id: result.insertId, student_number, email, type: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token,
        user: {
          student_id: result.insertId,
          student_number,
          name,
          email,
          program,
          faculty,
          must_change_password: true
        }
      }
    });

  } catch (error) {
    console.error('Google registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

module.exports = router;

// ─────────────────────────────────────────────────────────────
// POST /api/auth/change-password
// ─────────────────────────────────────────────────────────────
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Both passwords are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
    }

    const [students] = await pool.execute(
      'SELECT student_id, password FROM students WHERE student_id = ?',
      [req.user.student_id]
    );

    if (students.length === 0) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const isValid = await bcrypt.compare(currentPassword, students[0].password);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    const hashedNew = await bcrypt.hash(newPassword, 10);

    await pool.execute(
      'UPDATE students SET password = ?, must_change_password = FALSE WHERE student_id = ?',
      [hashedNew, req.user.student_id]
    );

    res.json({ success: true, message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});