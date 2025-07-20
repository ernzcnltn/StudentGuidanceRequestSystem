const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Admin JWT token doğrulama middleware
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Admin access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('Decoded token:', decoded);
    
    // Token'dan admin_id'yi al
    const adminId = decoded.admin_id;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token: missing admin ID'
      });
    }
    
    // DÜZELTME: Doğru tablo adını kullan (admin_users)
    const [admins] = await pool.execute(
      'SELECT admin_id, username, full_name, email, department, role FROM admin_users WHERE admin_id = ? AND is_active = TRUE',
      [adminId]
    );

    console.log('Found admins:', admins);

    if (admins.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Admin not found or inactive'
      });
    }

    // Admin bilgilerini req.admin'e set et
    req.admin = {
      admin_id: admins[0].admin_id,
      username: admins[0].username,
      full_name: admins[0].full_name,
      email: admins[0].email,
      department: admins[0].department,
      role: admins[0].role
    };

    console.log('Final req.admin:', req.admin);

    next();
  } catch (error) {
    console.error('Middleware error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        error: 'Invalid admin token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        error: 'Admin token expired'
      });
    }
    
    console.error('Admin auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Admin authentication failed'
    });
  }
};

// Departman kontrolü middleware
const requireDepartment = (allowedDepartments) => {
  return (req, res, next) => {
    try {
      const adminDepartment = req.admin.department;
      
      if (!allowedDepartments.includes(adminDepartment)) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required department: ${allowedDepartments.join(' or ')}`
        });
      }
      
      next();
    } catch (error) {
      console.error('Department check error:', error);
      res.status(500).json({
        success: false,
        error: 'Department authorization failed'
      });
    }
  };
};

module.exports = {
  authenticateAdmin,
  requireDepartment
};