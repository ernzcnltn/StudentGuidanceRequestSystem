const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// JWT token doğrulama middleware (sadece öğrenciler için)
const authenticateToken = async (req, res, next) => {
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
    
    // Student token kontrolü
    if (decoded.student_id) {
      const [users] = await pool.execute(
        'SELECT student_id, student_number, name, email FROM students WHERE student_id = ?',
        [decoded.student_id]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Student not found'
        });
      }

      req.user = users[0];
      req.userType = 'student';
      next();
    } else {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type'
      });
    }
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

// Admin kontrolü middleware (artık kullanılmayacak)
const requireAdmin = async (req, res, next) => {
  try {
    return res.status(403).json({
      success: false,
      error: 'Please use admin-auth endpoints for admin access'
    });
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      success: false,
      error: 'Authorization failed'
    });
  }
};

// Optional auth - token varsa user bilgisini set et
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.student_id) {
        const [users] = await pool.execute(
          'SELECT student_id, student_number, name, email FROM students WHERE student_id = ?',
          [decoded.student_id]
        );
        
        if (users.length > 0) {
          req.user = users[0];
          req.userType = 'student';
        }
      }
    }
    
    next();
  } catch (error) {
    // Token hatalı olsa bile devam et
    next();
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth
};