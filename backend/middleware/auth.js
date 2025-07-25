const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// JWT token doğrulama middleware (Öğrenci için)
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kullanıcının hala var olup olmadığını kontrol et
    const [users] = await pool.execute(
      'SELECT student_id, student_number, name, email FROM students WHERE student_id = ?',
      [decoded.student_id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    req.user = users[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        error: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        error: 'Token expired'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Admin token doğrulama middleware (departman adminleri ve superadmin için)
const authenticateAdminToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Admin kullanıcının hala var olup olmadığını kontrol et
    const [admins] = await pool.execute(
      'SELECT admin_id, username, email, department, role, is_active FROM admin_users WHERE admin_id = ? AND is_active = TRUE',
      [decoded.admin_id]
    );

    if (admins.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Admin user not found'
      });
    }

    req.admin = admins[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        error: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        error: 'Token expired'
      });
    }

    console.error('Admin auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Admin authentication failed'
    });
  }
};

// Departman admini kontrolü middleware
const requireDepartmentAdmin = (req, res, next) => {
  if (req.admin && req.admin.role === 'admin' && req.admin.is_active) {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: 'Department admin access required'
    });
  }
};

// Superadmin kontrolü middleware
const requireSuperAdmin = (req, res, next) => {
  if (req.admin && req.admin.role === 'superadmin' && req.admin.is_active) {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: 'Superadmin access required'
    });
  }
};

// Eski: E-posta üzerinden admin kontrolü (artık kullanılmamalı)
// const requireAdmin = async (req, res, next) => { ... }

// Optional auth - token varsa user bilgisini set et, yoksa devam et
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const [users] = await pool.execute(
        'SELECT student_id, student_number, name, email FROM students WHERE student_id = ?',
        [decoded.student_id]
      );

      if (users.length > 0) {
        req.user = users[0];
      }
    }

    next();
  } catch (error) {
    // Token hatalı olsa bile devam et
    next();
  }
};

module.exports = {
  authenticateToken,         // Öğrenci token doğrulama
  authenticateAdminToken,    // Admin token doğrulama
  requireDepartmentAdmin,    // Departman admini yetkisi
  requireSuperAdmin,         // Superadmin yetkisi
  optionalAuth
};