// backend/routes/adminAuth.js - RBAC Enhanced Version with ALL endpoints
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const { 
  authenticateAdmin, 
  requirePermission, 
  requireAnyPermission, 
  requireRole,
  commonPermissions 
} = require('../middleware/adminAuth');
const rbacService = require('../services/rbacService');

// POST /api/admin-auth/login - Admin giriş (DEBUG VERSION)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('=== LOGIN DEBUG START ===');
    console.log('🔍 Received data:', { 
      username, 
      password: password?.substring(0, 10) + '...', 
      passwordLength: password?.length,
      fullPassword: password // GEÇİCİ - güvenlik için sonra kaldır
    });

    if (!username || !password) {
      console.log('❌ Missing username or password');
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Admin'i bul
    const [admins] = await pool.execute(
      'SELECT admin_id, username, password_hash, full_name, email, department, role, is_super_admin FROM admin_users WHERE username = ? AND is_active = TRUE',
      [username]
    );

    console.log('🔍 Database query result:', {
      foundUsers: admins.length,
      userData: admins.length > 0 ? {
        username: admins[0].username,
        department: admins[0].department,
        is_super_admin: admins[0].is_super_admin,
        hasPasswordHash: !!admins[0].password_hash,
        passwordHashStart: admins[0].password_hash?.substring(0, 15),
        passwordHashLength: admins[0].password_hash?.length
      } : 'No user found'
    });

    if (admins.length === 0) {
      console.log('❌ User not found in database');
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    const admin = admins[0];

    // Manuel bcrypt test
    console.log('🔍 Manual bcrypt test:');
    console.log('Input password:', password);
    console.log('Stored hash:', admin.password_hash);
    
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    console.log('🔍 bcrypt.compare result:', isValidPassword);
    
    // Manuel hash test
    const testHash = await bcrypt.hash(password, 10);
    console.log('🔍 Fresh hash of input password:', testHash);
    
    console.log('=== LOGIN DEBUG END ===');
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    // JWT token oluştur
    const token = jwt.sign(
      { 
        admin_id: admin.admin_id,
        username: admin.username,
        department: admin.department
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // RBAC bilgilerini al
    try {
      const [roles, permissions] = await Promise.all([
        rbacService.getUserRoles(admin.admin_id),
        rbacService.getUserPermissions(admin.admin_id)
      ]);

      const { password_hash: _, ...adminData } = admin;

      res.json({
        success: true,
        message: 'Admin login successful',
        data: {
          token,
          admin: {
            ...adminData,
            roles,
            permissions,
            permission_summary: permissions.reduce((acc, perm) => {
              if (!acc[perm.resource]) acc[perm.resource] = [];
              acc[perm.resource].push(perm.action);
              return acc;
            }, {})
          }
        }
      });
    } catch (rbacError) {
      console.error('RBAC fetch error during login:', rbacError);
      const { password_hash: _, ...adminData } = admin;
      res.json({
        success: true,
        message: 'Admin login successful (limited RBAC data)',
        data: {
          token,
          admin: adminData
        }
      });
    }

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Admin login failed'
    });
  }
});

 // GET /api/admin-auth/dashboard - Dashboard data (DÜZELT!)
router.get('/dashboard', 
  authenticateAdmin, 
  commonPermissions.viewAnalytics(),
  async (req, res) => {
    try {
      console.log('📊 Dashboard request from:', {
        username: req.admin.username,
        department: req.admin.department,
        is_super_admin: req.admin.is_super_admin,
        admin_id: req.admin.admin_id
      });
      
      const isPureSuperAdmin = req.admin.is_super_admin && !req.admin.department;
      const department = isPureSuperAdmin ? null : req.admin.department;
      
      console.log('🔍 Dashboard access check:', {
        isPureSuperAdmin,
        targetDepartment: department
      });

      // IMPROVED: Get request counts by status with better error handling
      let statusQuery = `
        SELECT 
          COALESCE(gr.status, 'unknown') as status,
          COUNT(*) as count
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
      `;
      
      const params = [];
      if (!isPureSuperAdmin && department) {
        statusQuery += ' WHERE rt.category = ?';
        params.push(department);
      }
      
      statusQuery += ' GROUP BY gr.status';
      
      console.log('📊 Executing status query:', statusQuery);
      console.log('📊 Query params:', params);

      const [statusCounts] = await pool.execute(statusQuery, params);
      console.log('📊 Status counts result:', statusCounts);
      
      // IMPROVED: Get request type statistics with error handling
      let typeQuery = `
        SELECT 
          rt.type_name,
          rt.category,
          COUNT(gr.request_id) as count
        FROM request_types rt
        LEFT JOIN guidance_requests gr ON rt.type_id = gr.type_id
      `;
      
      const typeParams = [];
      if (!isPureSuperAdmin && department) {
        typeQuery += ' WHERE rt.category = ?';
        typeParams.push(department);
      }
      
      typeQuery += ' GROUP BY rt.type_id, rt.type_name, rt.category ORDER BY count DESC';
      
      console.log('📊 Executing type query:', typeQuery);
      console.log('📊 Type params:', typeParams);

      const [typeStats] = await pool.execute(typeQuery, typeParams);
      console.log('📊 Type stats result:', typeStats);
      
      // FIXED: Format response with default values
      const totals = {
        pending: 0,
        informed: 0,
        completed: 0,
        rejected: 0
      };
      
      // Process status counts safely
      if (statusCounts && statusCounts.length > 0) {
        statusCounts.forEach(row => {
          if (row && row.status) {
            const status = row.status.toLowerCase();
            if (totals.hasOwnProperty(status)) {
              totals[status] = parseInt(row.count) || 0;
            }
          }
        });
      }
      
      console.log('✅ Dashboard totals calculated:', totals);
      
      // SAFE: Prepare response data
      const responseData = {
        totals,
        type_stats: typeStats || [],
        department: isPureSuperAdmin ? 'ALL' : department,
        is_pure_super_admin: isPureSuperAdmin,
        admin_info: {
          username: req.admin.username,
          department: req.admin.department,
          is_super_admin: req.admin.is_super_admin
        }
      };
      
      console.log('✅ Dashboard response prepared:', {
        totals: responseData.totals,
        type_stats_count: responseData.type_stats.length,
        department: responseData.department
      });
      
      res.json({
        success: true,
        data: responseData,
        message: 'Dashboard data loaded successfully'
      });
      
    } catch (error) {
      console.error('❌ Dashboard data error:', {
        message: error.message,
        stack: error.stack,
        sql: error.sql,
        sqlMessage: error.sqlMessage,
        admin: req.admin?.username
      });
      
      // IMPROVED: Better error response
      const errorResponse = {
        success: false,
        error: 'Failed to fetch dashboard data',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        debug: process.env.NODE_ENV === 'development' ? {
          admin_id: req.admin?.admin_id,
          department: req.admin?.department,
          is_super_admin: req.admin?.is_super_admin,
          error_type: error.constructor.name
        } : undefined
      };
      
      res.status(500).json(errorResponse);
    }
  }
);

// GET /api/admin-auth/rbac/roles - Get all roles 
router.get('/rbac/roles', 
  authenticateAdmin, 
  requirePermission('users', 'view'),
  async (req, res) => {
    try {
      console.log('🎭 Fetching all roles...');
      
      const [roles] = await pool.execute(`
        SELECT 
          r.role_id,
          r.role_name,
          r.display_name,
          r.description,
          r.is_system_role,
          r.is_active,
          COUNT(rp.permission_id) as permission_count,
          COUNT(ur.user_id) as user_count
        FROM roles r
        LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
        LEFT JOIN user_roles ur ON r.role_id = ur.role_id AND ur.is_active = TRUE
        WHERE r.is_active = TRUE
        GROUP BY r.role_id
        ORDER BY r.is_system_role DESC, r.role_name
      `);

      console.log(`✅ Found ${roles.length} active roles`);

      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      console.error('Get roles error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch roles'
      });
    }
  }
);

// ===== NEW USER MANAGEMENT ENDPOINTS =====

// POST /api/admin-auth/users - Create new admin user
router.post('/users', 
  authenticateAdmin, 
  requirePermission('users', 'create'),
  async (req, res) => {
    try {
      const { username, full_name, email, department, password, role = 'admin' } = req.body;

      // Validation
      if (!username || !full_name || !email || !department || !password) {
        return res.status(400).json({
          success: false,
          error: 'All fields are required'
        });
      }

      // Check if username/email already exists
      const [existing] = await pool.execute(
        'SELECT admin_id FROM admin_users WHERE username = ? OR email = ?',
        [username, email]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Username or email already exists'
        });
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 10);

      // Create user
      const [result] = await pool.execute(`
        INSERT INTO admin_users (username, password_hash, full_name, name, email, department, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
      `, [username, password_hash, full_name, full_name, email, department, role]);

      res.json({
        success: true,
        message: 'Admin user created successfully',
        data: {
          admin_id: result.insertId,
          username,
          full_name,
          email,
          department
        }
      });

    } catch (error) {
      console.error('Create admin user error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create admin user'
      });
    }
  }
);

// GET /api/admin-auth/users - Get admin users
router.get('/users', 
  authenticateAdmin, 
  requirePermission('users', 'view'),
  async (req, res) => {
    try {
      const [users] = await pool.execute(`
        SELECT 
          admin_id, username, full_name, email, department, 
          role, is_active, is_super_admin, created_at, last_role_update
        FROM admin_users 
        WHERE is_active = TRUE
        ORDER BY full_name
      `);

      res.json({
        success: true,
        data: users
      });

    } catch (error) {
      console.error('Get admin users error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch admin users'
      });
    }
  }
);

// PUT /api/admin-auth/users/:userId - Update admin user
router.put('/users/:userId', 
  authenticateAdmin, 
  requirePermission('users', 'update'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { full_name, email, department, is_active } = req.body;

      const [result] = await pool.execute(`
        UPDATE admin_users 
        SET full_name = ?, email = ?, department = ?, is_active = ?
        WHERE admin_id = ?
      `, [full_name, email, department, is_active, userId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User updated successfully'
      });

    } catch (error) {
      console.error('Update admin user error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update admin user'
      });
    }
  }
);

// POST /api/admin-auth/users/:userId/reset-password - Reset user password
router.post('/users/:userId/reset-password', 
  authenticateAdmin, 
  requirePermission('users', 'reset_password'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { new_password } = req.body;

      if (!new_password) {
        return res.status(400).json({
          success: false,
          error: 'New password is required'
        });
      }

      const password_hash = await bcrypt.hash(new_password, 10);

      const [result] = await pool.execute(
        'UPDATE admin_users SET password_hash = ? WHERE admin_id = ?',
        [password_hash, userId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'Password reset successfully'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset password'
      });
    }
  }
);

// ===== NEW RBAC ENDPOINTS =====

// GET /api/admin-auth/rbac/users - Get users with their roles
router.get('/rbac/users', 
  authenticateAdmin, 
  requirePermission('users', 'view'),
  async (req, res) => {
    try {
      const isPureSuperAdmin = req.admin.is_super_admin && !req.admin.department;
      const department = isPureSuperAdmin ? null : req.admin.department;
      
      const users = await rbacService.getUsersWithRoles(department);
      
      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Get users with roles error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch users with roles'
      });
    }
  }
);

// POST /api/admin-auth/rbac/create-role - Create new role
router.post('/rbac/create-role', 
  authenticateAdmin, 
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      const { role_name, display_name, description, is_system_role } = req.body;
      const creatorId = req.admin.admin_id;

      if (!role_name || !display_name) {
        return res.status(400).json({
          success: false,
          error: 'Role name and display name are required'
        });
      }

      const result = await rbacService.createRole({
        role_name,
        display_name,
        description,
        is_system_role: is_system_role || false
      }, creatorId);

      res.json(result);
    } catch (error) {
      console.error('Create role error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create role'
      });
    }
  }
);

// DELETE /api/admin-auth/rbac/role/:roleId - Delete role
router.delete('/rbac/role/:roleId', 
  authenticateAdmin, 
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      const { roleId } = req.params;
      const deleterId = req.admin.admin_id;

      console.log('🗑️ Role deletion request:', { roleId, deleterId });

      const result = await rbacService.deleteRole(roleId, deleterId);
      
      if (result.success) {
        showSuccess(`Role "${result.deletedRole}" deleted successfully`);
        res.json(result);
      } else {
        res.status(400).json({
          success: false,
          error: result.message || 'Failed to delete role'
        });
      }
    } catch (error) {
      console.error('❌ Delete role error:', error);
      
      if (error.message.includes('system roles')) {
        res.status(400).json({
          success: false,
          error: 'Cannot delete system roles'
        });
      } else if (error.message.includes('assigned to users')) {
        res.status(400).json({
          success: false,
          error: 'Cannot delete role that is assigned to users. Remove role from all users first.'
        });
      } else if (error.message.includes('Insufficient permissions')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions to delete roles'
        });
      } else {
        res.status(500).json({
          success: false,
          error: error.message || 'Failed to delete role'
        });
      }
    }
  }
);

// POST /api/admin-auth/rbac/create-permission - Create new permission
router.post('/rbac/create-permission', 
  authenticateAdmin, 
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      const { 
        permission_name, 
        display_name, 
        description, 
        resource, 
        action,
        is_system_permission 
      } = req.body;
      const creatorId = req.admin.admin_id;

      console.log('🔐 Permission creation request:', {
        permission_name, display_name, resource, action, creatorId
      });

      if (!display_name || !resource || !action) {
        return res.status(400).json({
          success: false,
          error: 'Display name, resource, and action are required'
        });
      }

      const permissionData = {
        permission_name,
        display_name,
        description,
        resource,
        action,
        is_system_permission: is_system_permission || false
      };

      const result = await rbacService.createPermission(permissionData, creatorId);
      
      res.json(result);
    } catch (error) {
      console.error('❌ Create permission error:', error);
      
      if (error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: 'Permission with this name already exists'
        });
      } else if (error.message.includes('super administrators')) {
        res.status(403).json({
          success: false,
          error: 'Only super administrators can create permissions'
        });
      } else {
        res.status(500).json({
          success: false,
          error: error.message || 'Failed to create permission'
        });
      }
    }
  }
);

// DELETE /api/admin-auth/rbac/permission/:permissionId - Delete permission
router.delete('/rbac/permission/:permissionId', 
  authenticateAdmin, 
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      const { permissionId } = req.params;
      const deleterId = req.admin.admin_id;

      console.log('🗑️ Permission deletion request:', { permissionId, deleterId });

      const result = await rbacService.deletePermission(permissionId, deleterId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json({
          success: false,
          error: result.message || 'Failed to delete permission'
        });
      }
    } catch (error) {
      console.error('❌ Delete permission error:', error);
      
      if (error.message.includes('system permissions')) {
        res.status(400).json({
          success: false,
          error: 'Cannot delete system permissions'
        });
      } else if (error.message.includes('super administrators')) {
        res.status(403).json({
          success: false,
          error: 'Only super administrators can delete permissions'
        });
      } else {
        res.status(500).json({
          success: false,
          error: error.message || 'Failed to delete permission'
        });
      }
    }
  }
);


// POST /api/admin-auth/rbac/bulk-assign-roles - Bulk role assignment
router.post('/rbac/bulk-assign-roles', 
  authenticateAdmin, 
  requirePermission('users', 'manage_roles'),
  async (req, res) => {
    try {
      const { assignments } = req.body; // [{ user_id, role_id, expires_at }]
      const assignerId = req.admin.admin_id;

      if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Assignments array is required'
        });
      }

      const results = [];
      for (const assignment of assignments) {
        try {
          const result = await rbacService.assignRoleToUser(
            assignment.user_id, 
            assignment.role_id, 
            assignerId, 
            assignment.expires_at
          );
          results.push({ ...assignment, success: true, result });
        } catch (error) {
          results.push({ ...assignment, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      
      res.json({
        success: true,
        message: `${successCount}/${assignments.length} role assignments completed`,
        data: results
      });
    } catch (error) {
      console.error('Bulk assign roles error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk assign roles'
      });
    }
  }
);

// POST /api/admin-auth/rbac/bulk-remove-roles - Bulk role removal
router.post('/rbac/bulk-remove-roles', 
  authenticateAdmin, 
  requirePermission('users', 'manage_roles'),
  async (req, res) => {
    try {
      const { removals } = req.body; // [{ user_id, role_id }]
      const removerId = req.admin.admin_id;

      if (!Array.isArray(removals) || removals.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Removals array is required'
        });
      }

      const results = [];
      for (const removal of removals) {
        try {
          const result = await rbacService.removeRoleFromUser(
            removal.user_id, 
            removal.role_id, 
            removerId
          );
          results.push({ ...removal, success: true, result });
        } catch (error) {
          results.push({ ...removal, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      
      res.json({
        success: true,
        message: `${successCount}/${removals.length} role removals completed`,
        data: results
      });
    } catch (error) {
      console.error('Bulk remove roles error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk remove roles'
      });
    }
  }
);

// GET /api/admin-auth/rbac/user/:userId/roles - Get user roles
router.get('/rbac/user/:userId/roles', 
  authenticateAdmin, 
  requirePermission('users', 'view'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const roles = await rbacService.getUserRoles(userId);
      
      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      console.error('Get user roles error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user roles'
      });
    }
  }
);

// GET /api/admin-auth/rbac/user/:userId/permissions - Get user permissions
router.get('/rbac/user/:userId/permissions', 
  authenticateAdmin, 
  requirePermission('users', 'view'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const permissionSummary = await rbacService.getUserPermissionSummary(userId);
      
      res.json({
        success: true,
        data: permissionSummary
      });
    } catch (error) {
      console.error('Get user permissions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user permissions'
      });
    }
  }
);

// GET /api/admin-auth/me - Admin profili (RBAC bilgileri dahil)
router.get('/me', authenticateAdmin, async (req, res) => {
  try {
    const adminId = req.admin.admin_id;
    
    const [admins] = await pool.execute(
      'SELECT admin_id, username, email, full_name, role, department, is_active, is_super_admin FROM admin_users WHERE admin_id = ? AND is_active = TRUE',
      [adminId]
    );
    
    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
    }
    
    const permissionSummary = await rbacService.getUserPermissionSummary(adminId);
    
    res.json({
      success: true,
      data: {
        ...admins[0],
        rbac: permissionSummary
      }
    });
  } catch (error) {
    console.error('Admin profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get admin profile'
    });
  }
});

// GET /api/admin-auth/verify - Token verification
router.get('/verify', authenticateAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      admin: req.admin
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Token verification failed'
    });
  }
});

// GET /api/admin-auth/dashboard - Dashboard (RBAC korumalı)
router.get('/rbac/dashboard', 
  authenticateAdmin, 
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      // Get complete RBAC dashboard data
      const dashboardData = {};

      // 1. General Statistics
      const [generalStats] = await pool.execute(`
        SELECT 
          (SELECT COUNT(*) FROM admin_users WHERE is_active = TRUE) as total_users,
          (SELECT COUNT(*) FROM roles WHERE is_active = TRUE) as total_roles,
          (SELECT COUNT(*) FROM permissions) as total_permissions,
          (SELECT COUNT(*) FROM user_roles WHERE is_active = TRUE) as total_role_assignments,
          (SELECT COUNT(*) FROM admin_users WHERE is_super_admin = TRUE AND is_active = TRUE) as super_admin_count,
          (SELECT COUNT(DISTINCT au.department) FROM admin_users au WHERE au.is_active = TRUE) as total_departments
      `);
      dashboardData.general = generalStats[0];

      // 2. Role Distribution
      const [roleStats] = await pool.execute(`
        SELECT 
          r.role_id,
          r.role_name,
          r.display_name,
          r.description,
          r.is_system_role,
          COUNT(DISTINCT ur.user_id) as user_count,
          COUNT(DISTINCT rp.permission_id) as permission_count
        FROM roles r
        LEFT JOIN user_roles ur ON r.role_id = ur.role_id AND ur.is_active = TRUE
        LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
        WHERE r.is_active = TRUE
        GROUP BY r.role_id, r.role_name, r.display_name, r.description, r.is_system_role
        ORDER BY user_count DESC, r.role_name
      `);
      dashboardData.role_statistics = roleStats;

      // 3. Department Statistics
      const [deptStats] = await pool.execute(`
        SELECT 
          au.department,
          COUNT(DISTINCT au.admin_id) as admin_count,
          COUNT(DISTINCT ur.role_id) as unique_roles,
          COUNT(ur.role_id) as total_role_assignments,
          COUNT(CASE WHEN au.is_super_admin = TRUE THEN 1 END) as super_admin_count
        FROM admin_users au
        LEFT JOIN user_roles ur ON au.admin_id = ur.user_id AND ur.is_active = TRUE
        WHERE au.is_active = TRUE
        GROUP BY au.department
        ORDER BY admin_count DESC
      `);
      dashboardData.department_statistics = deptStats;

      // 4. Permission Resource Statistics
      const [permissionStats] = await pool.execute(`
        SELECT 
          p.resource,
          COUNT(p.permission_id) as permission_count,
          COUNT(DISTINCT rp.role_id) as roles_using_resource,
          COUNT(CASE WHEN p.is_system_permission = TRUE THEN 1 END) as system_permissions,
          COUNT(CASE WHEN p.is_system_permission = FALSE THEN 1 END) as custom_permissions
        FROM permissions p
        LEFT JOIN role_permissions rp ON p.permission_id = rp.permission_id
        GROUP BY p.resource
        ORDER BY permission_count DESC
      `);
      dashboardData.permission_statistics = permissionStats;

      // 5. Recent RBAC Activity (Audit Log)
      const [recentActivity] = await pool.execute(`
        SELECT 
          ur.assigned_at as activity_date,
          ur.is_active,
          u.username as target_user,
          u.department as target_department,
          r.role_name,
          r.display_name as role_display_name,
          assigner.username as assigned_by_username,
          CASE 
            WHEN ur.is_active = TRUE THEN 'role_assigned'
            ELSE 'role_removed'
          END as activity_type
        FROM user_roles ur
        LEFT JOIN admin_users u ON ur.user_id = u.admin_id
        LEFT JOIN roles r ON ur.role_id = r.role_id
        LEFT JOIN admin_users assigner ON ur.assigned_by = assigner.admin_id
        ORDER BY ur.assigned_at DESC
        LIMIT 20
      `);
      dashboardData.recent_activity = recentActivity;

      // 6. System Health Checks
      const [systemHealth] = await pool.execute(`
        SELECT 
          (SELECT COUNT(*) FROM admin_users WHERE is_active = FALSE) as inactive_users,
          (SELECT COUNT(*) FROM user_roles WHERE expires_at IS NOT NULL AND expires_at < NOW()) as expired_roles,
          (SELECT COUNT(*) FROM user_roles ur 
           LEFT JOIN roles r ON ur.role_id = r.role_id 
           WHERE ur.is_active = TRUE AND r.is_active = FALSE) as orphaned_role_assignments,
          (SELECT COUNT(*) FROM roles WHERE is_active = TRUE AND role_id NOT IN (
            SELECT DISTINCT role_id FROM user_roles WHERE is_active = TRUE
          )) as unused_roles
      `);
      dashboardData.system_health = systemHealth[0];

      // 7. Quick Actions Data
      const [quickActions] = await pool.execute(`
        SELECT 
          (SELECT COUNT(*) FROM admin_users WHERE is_active = TRUE AND admin_id NOT IN (
            SELECT DISTINCT user_id FROM user_roles WHERE is_active = TRUE
          )) as users_without_roles,
          (SELECT COUNT(*) FROM user_roles WHERE expires_at IS NOT NULL AND expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)) as roles_expiring_soon
      `);
      dashboardData.quick_actions = quickActions[0];

      // 8. Warnings
      const warnings = [];
      
      if (dashboardData.general.super_admin_count === 0) {
        warnings.push({
          type: 'critical',
          message: 'No super administrators found in the system',
          action: 'Assign super admin role to at least one user'
        });
      } else if (dashboardData.general.super_admin_count === 1) {
        warnings.push({
          type: 'warning',
          message: 'Only one super administrator in the system',
          action: 'Consider adding a backup super administrator'
        });
      }

      if (dashboardData.system_health.unused_roles > 0) {
        warnings.push({
          type: 'info',
          message: `${dashboardData.system_health.unused_roles} roles are not assigned to any users`,
          action: 'Review and clean up unused roles'
        });
      }

      if (dashboardData.system_health.expired_roles > 0) {
        warnings.push({
          type: 'warning',
          message: `${dashboardData.system_health.expired_roles} role assignments have expired`,
          action: 'Review and update expired role assignments'
        });
      }

      dashboardData.warnings = warnings;

      res.json({
        success: true,
        data: dashboardData,
        meta: {
          generated_at: new Date().toISOString(),
          data_points: Object.keys(dashboardData).length,
          cache_duration: '5 minutes'
        }
      });

    } catch (error) {
      console.error('RBAC Dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load RBAC dashboard data',
        error: error.message
      });
    }
  }
);

// GET /api/admin-auth/requests - Request listesi (RBAC korumalı)
router.get('/requests', 
  authenticateAdmin, 
  commonPermissions.viewRequests(),
  async (req, res) => {
    try {
      const department = req.admin.department;
      const isPureSuperAdmin = req.admin.is_super_admin && !req.admin.department;
      const { status } = req.query;

      let query = `
        SELECT 
          gr.request_id,
          gr.student_id,
          gr.content,
          gr.status,
          COALESCE(gr.priority, 'Medium') as priority,
          gr.submitted_at,
          gr.updated_at,
          gr.resolved_at,
          rt.type_name,
          rt.category,
          s.name as student_name,
          s.student_number,
          s.email as student_email,
          COUNT(a.attachment_id) as attachment_count
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        JOIN students s ON gr.student_id = s.student_id
        LEFT JOIN attachments a ON gr.request_id = a.request_id
      `;

      const params = [];
      const conditions = [];

      if (!isPureSuperAdmin && department) {
        conditions.push('rt.category = ?');
        params.push(department);
      }

      if (status) {
        conditions.push('gr.status = ?');
        params.push(status);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += `
        GROUP BY gr.request_id
        ORDER BY 
          CASE 
            WHEN COALESCE(gr.priority, 'Medium') = 'Urgent' THEN 1
            WHEN COALESCE(gr.priority, 'Medium') = 'High' THEN 2
            WHEN COALESCE(gr.priority, 'Medium') = 'Medium' THEN 3
            WHEN COALESCE(gr.priority, 'Medium') = 'Low' THEN 4
            ELSE 5
          END,
          gr.submitted_at DESC
      `;

      const [requests] = await pool.execute(query, params);
      
      res.json({
        success: true,
        data: requests,
        meta: {
          total: requests.length,
          department: isPureSuperAdmin ? 'ALL' : department,
          filter: status || 'all',
          is_pure_super_admin: isPureSuperAdmin
        }
      });

    } catch (error) {
      console.error('Get requests error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch requests',
        error: error.message
      });
    }
  }
);

// GET /api/admin-auth/request-types - Request Types (RBAC korumalı)
router.get('/request-types', 
  authenticateAdmin, 
  requireAnyPermission([
    { resource: 'settings', action: 'view' },
    { resource: 'settings', action: 'manage_request_types' }
  ]),
  async (req, res) => {
    try {
      const department = req.admin.department;
      const isPureSuperAdmin = req.admin.is_super_admin && !req.admin.department;

      let query, params;

      if (isPureSuperAdmin) {
        query = `
          SELECT 
            type_id,
            category,
            type_name,
            description_en,
            is_document_required,
            is_disabled
          FROM request_types
          ORDER BY category, type_name
        `;
        params = [];
      } else {
        query = `
          SELECT 
            type_id,
            category,
            type_name,
            description_en,
            is_document_required,
            is_disabled
          FROM request_types
          WHERE category = ?
          ORDER BY type_name
        `;
        params = [department];
      }

      const [requestTypes] = await pool.execute(query, params);

      res.json({
        success: true,
        data: requestTypes,
        meta: {
          department: isPureSuperAdmin ? 'ALL' : department,
          is_pure_super_admin: isPureSuperAdmin
        }
      });

    } catch (error) {
      console.error('Get request types error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch request types'
      });
    }
  }
);



// GET /api/admin-auth/statistics/admins - Admin performance statistics
router.get('/statistics/admins', 
  authenticateAdmin, 
  requireAnyPermission([
    { resource: 'analytics', action: 'view_department' },
    { resource: 'analytics', action: 'view_system' }
  ]),
  async (req, res) => {
    try {
      const { period = '30', department: filterDepartment } = req.query;
      const isPureSuperAdmin = req.admin.is_super_admin && !req.admin.department;
      const targetDepartment = isPureSuperAdmin ? filterDepartment : req.admin.department;
      
      console.log('📊 Fetching admin statistics:', { 
        period, 
        targetDepartment, 
        isPureSuperAdmin,
        adminId: req.admin.admin_id 
      });

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      // Department filtering
      let departmentCondition = '';
      let departmentParams = [];
      
      if (targetDepartment) {
        departmentCondition = ' AND rt.category = ?';
        departmentParams.push(targetDepartment);
      }

      // 1. Overview Statistics - Fixed
      const overviewQuery = `
        SELECT 
          COUNT(DISTINCT au.admin_id) as total_admins,
          COUNT(DISTINCT CASE WHEN au.is_active = TRUE THEN au.admin_id END) as active_admins,
          COUNT(DISTINCT gr.request_id) as total_requests_handled,
          ROUND(AVG(CASE 
            WHEN gr.resolved_at IS NOT NULL AND gr.submitted_at IS NOT NULL 
            THEN TIMESTAMPDIFF(HOUR, gr.submitted_at, gr.resolved_at) 
            ELSE NULL 
          END), 1) as avg_response_time
        FROM admin_users au
        CROSS JOIN guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE au.is_active = TRUE ${departmentCondition}
      `;

      const [overviewStats] = await pool.execute(overviewQuery, departmentParams);

      // 2. Simple Admin Statistics - Fixed approach
      const adminStatsQuery = `
        SELECT 
          au.admin_id,
          au.username,
          au.full_name,
          au.email,
          au.department,
          au.is_super_admin,
          au.is_active,
          0 as total_requests,
          0 as completed_requests,
          0 as pending_requests,
          0 as informed_requests,
          0 as rejected_requests,
          0 as total_responses,
          0 as period_responses,
          0 as avg_response_time,
          0 as performance_score,
          0 as period_work_time,
          NULL as last_activity
        FROM admin_users au
        WHERE au.is_active = TRUE
        ${targetDepartment ? 'AND au.department = ?' : ''}
        ORDER BY au.full_name
      `;

      const adminStatsParams = targetDepartment ? [targetDepartment] : [];
      const [rawAdmins] = await pool.execute(adminStatsQuery, adminStatsParams);

      // 3. Get actual statistics for each admin
      const detailedAdmins = [];
      
      for (const admin of rawAdmins) {
        try {
          // Get department requests count
          const deptRequestsQuery = `
            SELECT COUNT(*) as total_requests
            FROM guidance_requests gr
            JOIN request_types rt ON gr.type_id = rt.type_id
            WHERE rt.category = ?
          `;
          
          const [deptRequests] = await pool.execute(deptRequestsQuery, [admin.department]);
          
          // Get department requests by status
          const deptStatusQuery = `
            SELECT 
              gr.status,
              COUNT(*) as count
            FROM guidance_requests gr
            JOIN request_types rt ON gr.type_id = rt.type_id
            WHERE rt.category = ?
            GROUP BY gr.status
          `;
          
          const [deptStatus] = await pool.execute(deptStatusQuery, [admin.department]);
          
          // Get admin responses
          const adminResponsesQuery = `
            SELECT 
              COUNT(*) as total_responses,
              COUNT(CASE WHEN ar.created_at BETWEEN ? AND ? THEN 1 END) as period_responses,
              MAX(ar.created_at) as last_activity
            FROM admin_responses ar
            WHERE ar.admin_id = ?
          `;
          
          const [adminResponses] = await pool.execute(adminResponsesQuery, [startDate, endDate, admin.admin_id]);
          
          // Calculate status counts
          const statusCounts = {
            pending: 0,
            informed: 0, 
            completed: 0,
            rejected: 0
          };
          
          deptStatus.forEach(row => {
            const status = row.status.toLowerCase();
            if (statusCounts.hasOwnProperty(status)) {
              statusCounts[status] = row.count;
            }
          });
          
          // Calculate performance score
          const totalDeptRequests = deptRequests[0].total_requests || 0;
          const completedRequests = statusCounts.completed;
          const performanceScore = totalDeptRequests > 0 
            ? Math.round((completedRequests / totalDeptRequests) * 100) 
            : 0;
          
          // Build admin data
          const adminData = {
            admin_id: admin.admin_id,
            username: admin.username,
            full_name: admin.full_name,
            email: admin.email,
            department: admin.department,
            is_super_admin: admin.is_super_admin,
            is_active: admin.is_active,
            total_requests: totalDeptRequests,
            completed_requests: statusCounts.completed,
            pending_requests: statusCounts.pending,
            informed_requests: statusCounts.informed,
            rejected_requests: statusCounts.rejected,
            total_responses: adminResponses[0].total_responses || 0,
            period_responses: adminResponses[0].period_responses || 0,
            avg_response_time: 0,
            performance_score: performanceScore,
            period_work_time: (adminResponses[0].period_responses || 0) * 15,
            last_activity: adminResponses[0].last_activity
          };
          
          detailedAdmins.push(adminData);
          
        } catch (adminError) {
          console.error('Error processing admin:', admin.admin_id, adminError);
          // Add admin with zero stats if query fails
          detailedAdmins.push({
            ...admin,
            total_requests: 0,
            completed_requests: 0,
            pending_requests: 0,
            informed_requests: 0,
            rejected_requests: 0,
            total_responses: 0,
            period_responses: 0,
            avg_response_time: 0,
            performance_score: 0,
            period_work_time: 0,
            last_activity: null
          });
        }
      }

      // 4. Top Performers - Simple approach
      const topPerformersRequests = detailedAdmins
        .filter(admin => admin.total_requests > 0)
        .sort((a, b) => b.total_requests - a.total_requests)
        .slice(0, 10)
        .map(admin => ({
          admin_id: admin.admin_id,
          full_name: admin.full_name,
          department: admin.department,
          total_requests: admin.total_requests
        }));

      const topPerformersResponseTime = detailedAdmins
        .filter(admin => admin.total_responses > 0)
        .sort((a, b) => a.avg_response_time - b.avg_response_time)
        .slice(0, 10)
        .map(admin => ({
          admin_id: admin.admin_id,
          full_name: admin.full_name,
          department: admin.department,
          avg_response_time: admin.avg_response_time
        }));

      // 5. Department Breakdown (Super Admin Only)
      let departmentBreakdown = [];
      if (isPureSuperAdmin) {
        const deptBreakdownQuery = `
          SELECT 
            rt.category as department,
            COUNT(DISTINCT gr.request_id) as total_requests,
            COUNT(CASE WHEN gr.status = 'Completed' THEN 1 END) as completed_requests,
            COUNT(CASE WHEN gr.status = 'Rejected' THEN 1 END) as rejected_requests,
            ROUND(
              CASE 
                WHEN COUNT(DISTINCT gr.request_id) > 0 THEN
                  (COUNT(CASE WHEN gr.status = 'Completed' THEN 1 END) * 100.0 / 
                   COUNT(DISTINCT gr.request_id))
                ELSE 0
              END, 1
            ) as performance_score,
            COUNT(DISTINCT au.admin_id) as admin_count
          FROM request_types rt
          LEFT JOIN guidance_requests gr ON rt.type_id = gr.type_id
          LEFT JOIN admin_users au ON rt.category = au.department AND au.is_active = TRUE
          GROUP BY rt.category
          HAVING total_requests > 0
          ORDER BY performance_score DESC
        `;
        
        const [deptStats] = await pool.execute(deptBreakdownQuery);
        departmentBreakdown = deptStats;
      }

      // Build final response
      const statisticsData = {
        overview: {
          total_admins: overviewStats[0].total_admins || 0,
          active_admins: overviewStats[0].active_admins || 0,
          total_requests_handled: overviewStats[0].total_requests_handled || 0,
          avg_response_time: overviewStats[0].avg_response_time || 0
        },
        detailed_admins: detailedAdmins,
        department_breakdown: departmentBreakdown,
        top_performers: {
          requests: topPerformersRequests,
          response_time: topPerformersResponseTime
        },
        meta: {
          period: parseInt(period),
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          department: targetDepartment || 'ALL',
          is_super_admin: isPureSuperAdmin,
          admin_requesting: req.admin.username,
          data_explanation: 'Shows department request totals assigned to each admin'
        }
      };

      console.log('✅ Admin statistics compiled successfully:', {
        overview: statisticsData.overview,
        admin_count: statisticsData.detailed_admins.length,
        total_requests: statisticsData.detailed_admins.reduce((sum, admin) => sum + admin.total_requests, 0),
        department_breakdown_count: statisticsData.department_breakdown.length
      });

      res.json({
        success: true,
        data: statisticsData
      });

    } catch (error) {
      console.error('❌ Admin statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch admin statistics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// GET /api/admin-auth/statistics/admins/export - Export admin statistics
router.get('/statistics/admins/export', 
  authenticateAdmin, 
  requireAnyPermission([
    { resource: 'analytics', action: 'view_department' },
    { resource: 'analytics', action: 'export' }
  ]),
  async (req, res) => {
    try {
      const { period = '30', department: filterDepartment, format = 'json' } = req.query;
      const isPureSuperAdmin = req.admin.is_super_admin && !req.admin.department;
      const targetDepartment = isPureSuperAdmin ? filterDepartment : req.admin.department;

      console.log('📊 Exporting admin statistics:', { period, targetDepartment, format });

      // Reuse the same logic as the main statistics endpoint
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      let departmentCondition = '';
      let departmentParams = [];
      
      if (targetDepartment) {
        departmentCondition = ' AND au.department = ?';
        departmentParams = [targetDepartment];
      }

      const [detailedAdmins] = await pool.execute(`
        SELECT 
          au.admin_id,
          au.username,
          au.full_name,
          au.email,
          au.department,
          au.is_super_admin,
          COUNT(DISTINCT gr.request_id) as total_requests,
          COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as completed_requests,
          COUNT(DISTINCT CASE WHEN gr.status = 'Pending' THEN gr.request_id END) as pending_requests,
          COUNT(DISTINCT CASE WHEN gr.status = 'Informed' THEN gr.request_id END) as informed_requests,
          COUNT(DISTINCT CASE WHEN gr.status = 'Rejected' THEN gr.request_id END) as rejected_requests,
          COUNT(DISTINCT ar.response_id) as total_responses,
          ROUND(AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)), 1) as avg_response_time,
          ROUND(
            (COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) * 100.0 / 
             NULLIF(COUNT(DISTINCT gr.request_id), 0)), 1
          ) as performance_score,
          MAX(ar.created_at) as last_activity
        FROM admin_users au
        LEFT JOIN admin_responses ar ON au.admin_id = ar.admin_id AND ar.created_at BETWEEN ? AND ?
        LEFT JOIN guidance_requests gr ON ar.request_id = gr.request_id
        WHERE au.is_active = TRUE ${departmentCondition}
        GROUP BY au.admin_id, au.username, au.full_name, au.email, au.department, au.is_super_admin
        ORDER BY performance_score DESC, total_requests DESC
      `, [startDate, endDate, ...departmentParams]);

      if (format === 'csv') {
        // Generate CSV
        const csvHeaders = [
          'Admin ID', 'Username', 'Full Name', 'Email', 'Department', 'Is Super Admin',
          'Total Requests', 'Completed Requests', 'Pending Requests', 'Informed Requests', 
          'Rejected Requests', 'Total Responses', 'Avg Response Time (hours)', 
          'Performance Score (%)', 'Last Activity'
        ];

        const csvRows = detailedAdmins.map(admin => [
          admin.admin_id,
          admin.username,
          admin.full_name,
          admin.email,
          admin.department,
          admin.is_super_admin ? 'Yes' : 'No',
          admin.total_requests,
          admin.completed_requests,
          admin.pending_requests,
          admin.informed_requests,
          admin.rejected_requests,
          admin.total_responses,
          admin.avg_response_time || 0,
          admin.performance_score || 0,
          admin.last_activity ? new Date(admin.last_activity).toISOString() : 'Never'
        ]);

        const csvContent = [csvHeaders, ...csvRows]
          .map(row => row.map(field => `"${field}"`).join(','))
          .join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="admin_statistics_${period}days.csv"`);
        res.send(csvContent);
      } else {
        // Return JSON
        res.json({
          success: true,
          data: {
            export_info: {
              period: parseInt(period),
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
              department: targetDepartment || 'ALL',
              generated_at: new Date().toISOString(),
              generated_by: req.admin.username
            },
            admins: detailedAdmins
          }
        });
      }

    } catch (error) {
      console.error('Export admin statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export admin statistics'
      });
    }
  }
);

// GET /api/admin-auth/statistics/admins/:adminId - Individual admin statistics
router.get('/statistics/admins/:adminId', 
  authenticateAdmin, 
  requireAnyPermission([
    { resource: 'analytics', action: 'view_department' },
    { resource: 'users', action: 'view' }
  ]),
  async (req, res) => {
    try {
      const { adminId } = req.params;
      const { period = '30' } = req.query;

      console.log('📊 Fetching individual admin statistics:', { adminId, period });

      // Check if user can view this admin's stats
      const [targetAdmin] = await pool.execute(`
        SELECT admin_id, username, full_name, department, is_super_admin
        FROM admin_users 
        WHERE admin_id = ? AND is_active = TRUE
      `, [adminId]);

      if (targetAdmin.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Admin not found'
        });
      }

      const admin = targetAdmin[0];

      // Department access control
      if (!req.admin.is_super_admin && admin.department !== req.admin.department) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Cannot view statistics for other departments'
        });
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      // Detailed statistics for this admin
      const [adminStats] = await pool.execute(`
        SELECT 
          COUNT(DISTINCT gr.request_id) as total_requests,
          COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as completed_requests,
          COUNT(DISTINCT CASE WHEN gr.status = 'Pending' THEN gr.request_id END) as pending_requests,
          COUNT(DISTINCT CASE WHEN gr.status = 'Informed' THEN gr.request_id END) as informed_requests,
          COUNT(DISTINCT CASE WHEN gr.status = 'Rejected' THEN gr.request_id END) as rejected_requests,
          COUNT(DISTINCT ar.response_id) as total_responses,
          ROUND(AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)), 1) as avg_response_time,
          MIN(ar.created_at) as first_activity,
          MAX(ar.created_at) as last_activity
        FROM admin_responses ar
        INNER JOIN guidance_requests gr ON ar.request_id = gr.request_id
        WHERE ar.admin_id = ? AND ar.created_at BETWEEN ? AND ?
      `, [adminId, startDate, endDate]);

      // Daily activity breakdown
      const [dailyActivity] = await pool.execute(`
        SELECT 
          DATE(ar.created_at) as activity_date,
          COUNT(DISTINCT ar.response_id) as responses,
          COUNT(DISTINCT gr.request_id) as requests_handled
        FROM admin_responses ar
        INNER JOIN guidance_requests gr ON ar.request_id = gr.request_id
        WHERE ar.admin_id = ? AND ar.created_at BETWEEN ? AND ?
        GROUP BY DATE(ar.created_at)
        ORDER BY activity_date DESC
      `, [adminId, startDate, endDate]);

      // Request type breakdown
      const [requestTypeBreakdown] = await pool.execute(`
        SELECT 
          rt.type_name,
          COUNT(DISTINCT gr.request_id) as count
        FROM admin_responses ar
        INNER JOIN guidance_requests gr ON ar.request_id = gr.request_id
        INNER JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE ar.admin_id = ? AND ar.created_at BETWEEN ? AND ?
        GROUP BY rt.type_id, rt.type_name
        ORDER BY count DESC
      `, [adminId, startDate, endDate]);

      res.json({
        success: true,
        data: {
          admin: admin,
          statistics: adminStats[0] || {
            total_requests: 0,
            completed_requests: 0,
            pending_requests: 0,
            informed_requests: 0,
            rejected_requests: 0,
            total_responses: 0,
            avg_response_time: 0,
            first_activity: null,
            last_activity: null
          },
          daily_activity: dailyActivity,
          request_type_breakdown: requestTypeBreakdown,
          meta: {
            period: parseInt(period),
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString()
          }
        }
      });

    } catch (error) {
      console.error('Individual admin statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch admin statistics'
      });
    }
  }
);



// PUT /api/admin-auth/requests/:requestId/status - Status güncelleme (RBAC korumalı)
router.put('/requests/:requestId/status', 
  authenticateAdmin, 
  commonPermissions.manageRequests(),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { status } = req.body;
      const adminId = req.admin.admin_id;

      if (!['Pending', 'Informed', 'Completed'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }

      // Departman erişim kontrolü
      if (!req.admin.is_super_admin) {
        const [requestCheck] = await pool.execute(`
          SELECT gr.request_id, rt.category 
          FROM guidance_requests gr
          JOIN request_types rt ON gr.type_id = rt.type_id
          WHERE gr.request_id = ?
        `, [requestId]);

        if (requestCheck.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Request not found'
          });
        }

        if (requestCheck[0].category !== req.admin.department) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. This request belongs to a different department.'
          });
        }
      }

      const [result] = await pool.execute(`
        UPDATE guidance_requests 
        SET 
          status = ?,
          updated_at = NOW(),
          resolved_at = CASE WHEN ? = 'Completed' THEN NOW() ELSE resolved_at END
        WHERE request_id = ?
      `, [status, status, requestId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }

      res.json({
        success: true,
        message: 'Request status updated successfully',
        data: {
          request_id: requestId,
          new_status: status,
          updated_by: adminId
        }
      });

    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update request status'
      });
    }
  }
);

// PUT /api/admin-auth/requests/:requestId/priority - Priority güncelleme (RBAC korumalı)
router.put('/requests/:requestId/priority', 
  authenticateAdmin, 
  requirePermission('requests', 'update_priority'),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { priority } = req.body;
      const adminId = req.admin.admin_id;

      const validPriorities = ['Low', 'Medium', 'High', 'Urgent'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid priority. Must be: Low, Medium, High, or Urgent'
        });
      }

      // Departman erişim kontrolü
      if (!req.admin.is_super_admin) {
        const [requestCheck] = await pool.execute(`
          SELECT gr.request_id, rt.category 
          FROM guidance_requests gr
          JOIN request_types rt ON gr.type_id = rt.type_id
          WHERE gr.request_id = ?
        `, [requestId]);

        if (requestCheck.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Request not found'
          });
        }

        if (requestCheck[0].category !== req.admin.department) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. This request belongs to a different department.'
          });
        }
      }

      const [result] = await pool.execute(`
        UPDATE guidance_requests 
        SET 
          priority = ?,
          updated_at = NOW()
        WHERE request_id = ?
      `, [priority, requestId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Failed to update priority'
        });
      }

      res.json({
        success: true,
        message: `Priority updated to ${priority} successfully`,
        data: {
          request_id: requestId,
          new_priority: priority,
          updated_by: adminId
        }
      });

    } catch (error) {
      console.error('Update priority error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update request priority'
      });
    }
  }
);

// PUT /api/admin-auth/request-types/:typeId/toggle - Request type toggle (RBAC korumalı)
router.put('/request-types/:typeId/toggle', 
  authenticateAdmin, 
  requirePermission('settings', 'manage_request_types'),
  async (req, res) => {
    try {
      const { typeId } = req.params;

      // Departman erişim kontrolü
      if (!req.admin.is_super_admin) {
        const [typeCheck] = await pool.execute(`
          SELECT category FROM request_types WHERE type_id = ?
        `, [typeId]);

        if (typeCheck.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Request type not found'
          });
        }

        if (typeCheck[0].category !== req.admin.department) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only manage request types for your department.'
          });
        }
      }

      const [result] = await pool.execute(`
        UPDATE request_types 
        SET is_disabled = NOT is_disabled
        WHERE type_id = ?
      `, [typeId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Request type not found'
        });
      }

      res.json({
        success: true,
        message: 'Request type status updated successfully'
      });

    } catch (error) {
      console.error('Toggle request type error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle request type'
      });
    }
  }
);

// POST /api/admin-auth/request-types - Request type ekleme (RBAC korumalı)
router.post('/request-types', 
  authenticateAdmin, 
  requirePermission('settings', 'manage_request_types'),
  async (req, res) => {
    try {
      const { type_name, description_en, is_document_required } = req.body;
      const department = req.admin.department;
      const isSuper = req.admin.is_super_admin;

      if (!type_name || !type_name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Type name is required'
        });
      }

      const category = isSuper && req.body.category ? req.body.category : department;

      const [result] = await pool.execute(`
        INSERT INTO request_types (category, type_name, description_en, is_document_required, is_disabled)
        VALUES (?, ?, ?, ?, FALSE)
      `, [category, type_name.trim(), description_en || '', is_document_required || false]);

      res.json({
        success: true,
        message: 'Request type added successfully',
        data: {
          type_id: result.insertId,
          category,
          type_name: type_name.trim()
        }
      });

    } catch (error) {
      console.error('Add request type error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add request type'
      });
    }
  }
);

// GET /api/admin-auth/requests/:requestId/responses - Response listesi (RBAC korumalı)
router.get('/requests/:requestId/responses', 
  authenticateAdmin, 
  commonPermissions.viewRequests(),
  async (req, res) => {
    try {
      const { requestId } = req.params;

      // Departman erişim kontrolü
      if (!req.admin.is_super_admin) {
        const [requestCheck] = await pool.execute(`
          SELECT gr.request_id, rt.category 
          FROM guidance_requests gr
          JOIN request_types rt ON gr.type_id = rt.type_id
          WHERE gr.request_id = ?
        `, [requestId]);

        if (requestCheck.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Request not found'
          });
        }

        if (requestCheck[0].category !== req.admin.department) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. This request belongs to a different department.'
          });
        }
      }

      const [responses] = await pool.execute(`
        SELECT 
          ar.response_id,
          ar.response_content,
          ar.created_at,
          COALESCE(au.name, au.username, 'Admin') as created_by_admin
        FROM admin_responses ar
        LEFT JOIN admin_users au ON ar.admin_id = au.admin_id
        WHERE ar.request_id = ?
        ORDER BY ar.created_at ASC
      `, [requestId]);

      res.json({
        success: true,
        data: responses
      });

    } catch (error) {
      console.error('Get responses error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch responses'
      });
    }
  }
);

// POST /api/admin-auth/requests/:requestId/responses - Response ekleme (RBAC korumalı)
router.post('/requests/:requestId/responses', 
  authenticateAdmin, 
  requirePermission('responses', 'create'),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { response_content } = req.body;
      const adminId = req.admin.admin_id;

      if (!response_content || !response_content.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Response content is required'
        });
      }

      // Departman erişim kontrolü ve request detayları
      let requestDetailsQuery = `
        SELECT 
          gr.request_id,
          gr.status,
          s.name as student_name,
          s.email as student_email,
          rt.type_name,
          rt.category
        FROM guidance_requests gr
        JOIN students s ON gr.student_id = s.student_id
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE gr.request_id = ?
      `;

      if (!req.admin.is_super_admin) {
        requestDetailsQuery += ' AND rt.category = ?';
      }

      const params = req.admin.is_super_admin ? [requestId] : [requestId, req.admin.department];
      const [requestDetails] = await pool.execute(requestDetailsQuery, params);

      if (requestDetails.length === 0) {
        return res.status(404).json({
          success: false,
          message: req.admin.is_super_admin ? 'Request not found' : 'Request not found in your department'
        });
      }

      const request = requestDetails[0];
      const oldStatus = request.status;

      // Response ekle
      const [result] = await pool.execute(`
        INSERT INTO admin_responses (request_id, admin_id, response_content, created_at)
        VALUES (?, ?, ?, NOW())
      `, [requestId, adminId, response_content.trim()]);

      // Status'u 'Informed' yap
      if (oldStatus === 'Pending') {
        await pool.execute(`
          UPDATE guidance_requests 
          SET 
            status = 'Informed',
            updated_at = NOW()
          WHERE request_id = ?
        `, [requestId]);
      }

      res.json({
        success: true,
        message: 'Response added successfully',
        data: {
          response_id: result.insertId,
          request_id: requestId,
          status_changed: oldStatus === 'Pending'
        }
      });

    } catch (error) {
      console.error('Add response error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add response'
      });
    }
  }
);

// ===== EXISTING RBAC ROUTES (MISSING FROM PREVIOUS) =====


// GET /api/admin-auth/rbac/permission-groups - Get permission groups
router.get('/rbac/permission-groups', 
  authenticateAdmin, 
  requirePermission('users', 'manage_roles'),
  async (req, res) => {
    try {
      const groups = await rbacService.getPermissionGroups();
      
      res.json({
        success: true,
        data: groups
      });
    } catch (error) {
      console.error('Get permission groups error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch permission groups'
      });
    }
  }
);



// GET /api/admin-auth/rbac/roles - Tüm rolleri getir (RBAC korumalı)
router.get('/rbac/roles', 
  authenticateAdmin, 
  requirePermission('users', 'view'),
  async (req, res) => {
    try {
      const roles = await rbacService.getAllRoles();
      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      console.error('Get roles error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch roles'
      });
    }
  }
);

// POST /api/admin-auth/rbac/assign-role - Role atama (EKSİK OLAN BU!)
router.post('/rbac/assign-role', 
  authenticateAdmin, 
  requirePermission('users', 'manage_roles'),
  async (req, res) => {
    try {
      const { user_id, role_id, expires_at } = req.body;
      const assignerId = req.admin.admin_id;

      console.log('🎭 Role assignment request:', { user_id, role_id, assignerId, expires_at });

      if (!user_id || !role_id) {
        return res.status(400).json({
          success: false,
          error: 'User ID and Role ID are required'
        });
      }

      // Validation first
      const [roleCheck] = await pool.execute(`
        SELECT role_id, role_name FROM roles WHERE role_id = ? AND is_active = TRUE
      `, [role_id]);

      if (roleCheck.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Role not found'
        });
      }

      const [userCheck] = await pool.execute(`
        SELECT admin_id, username FROM admin_users WHERE admin_id = ? AND is_active = TRUE
      `, [user_id]);

      if (userCheck.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Check if already assigned
      const [existing] = await pool.execute(`
        SELECT user_id, is_active FROM user_roles 
        WHERE user_id = ? AND role_id = ? AND is_active = TRUE
      `, [user_id, role_id]);

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'User already has this role assigned'
        });
      }

      // Assign role using RBAC service
      const result = await rbacService.assignRoleToUser(user_id, role_id, assignerId, expires_at);
      
      console.log('✅ Role assignment successful:', result);
      res.json(result);
      
    } catch (error) {
      console.error('❌ Role assignment error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to assign role'
      });
    }
  }
);

// POST /api/admin-auth/rbac/validate-role-assignment - Validate role assignment
router.post('/rbac/validate-role-assignment', 
  authenticateAdmin, 
  requirePermission('users', 'manage_roles'),
  async (req, res) => {
    try {
      const { user_id, role_id } = req.body;
      const validatorId = req.admin.admin_id;

      if (!user_id || !role_id) {
        return res.status(400).json({
          success: false,
          error: 'User ID and Role ID are required'
        });
      }

      // Check if role exists
      const [roleCheck] = await pool.execute(`
        SELECT role_id, role_name, display_name, is_system_role FROM roles 
        WHERE role_id = ? AND is_active = TRUE
      `, [role_id]);

      if (roleCheck.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Role not found'
        });
      }

      // Check if user exists
      const [userCheck] = await pool.execute(`
        SELECT admin_id, username, full_name, department FROM admin_users 
        WHERE admin_id = ? AND is_active = TRUE
      `, [user_id]);

      if (userCheck.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Check if assignment already exists
      const [existingCheck] = await pool.execute(`
        SELECT user_id, is_active FROM user_roles 
        WHERE user_id = ? AND role_id = ?
      `, [user_id, role_id]);

      const validation = {
        can_assign: true,
        warnings: [],
        errors: []
      };

      if (existingCheck.length > 0 && existingCheck[0].is_active) {
        validation.can_assign = false;
        validation.errors.push('User already has this role assigned');
      }

      // Check if validator has permission to assign this role
      const canAssign = await rbacService.hasPermission(validatorId, 'users', 'manage_roles');
      if (!canAssign) {
        validation.can_assign = false;
        validation.errors.push('Insufficient permissions to assign roles');
      }

      res.json({
        success: true,
        data: {
          validation,
          role: roleCheck[0],
          user: userCheck[0],
          existing_assignment: existingCheck.length > 0 ? existingCheck[0] : null
        }
      });

    } catch (error) {
      console.error('Validate role assignment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate role assignment'
      });
    }
  }
);



// POST /api/admin-auth/rbac/remove-role - Rol kaldırma (RBAC korumalı)
router.post('/rbac/remove-role', 
  authenticateAdmin, 
  requirePermission('users', 'manage_roles'),
  async (req, res) => {
    try {
      const { user_id, role_id } = req.body;
      const removerId = req.admin.admin_id;

      console.log('🗑️ Role removal request:', { user_id, role_id, removerId });

      if (!user_id || !role_id) {
        return res.status(400).json({
          success: false,
          error: 'User ID and Role ID are required'
        });
      }

      const result = await rbacService.removeRoleFromUser(user_id, role_id, removerId);
      
      console.log('✅ Role removal successful:', result);
      res.json(result);
    } catch (error) {
      console.error('❌ Role removal error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to remove role'
      });
    }
  }
);

// GET /api/admin-auth/rbac/role/:roleId/permissions - Rol izinlerini getir
router.get('/rbac/role/:roleId/permissions', 
  authenticateAdmin, 
  requirePermission('users', 'manage_roles'),
  async (req, res) => {
    try {
      const { roleId } = req.params;
      const permissions = await rbacService.getRolePermissions(roleId);
      res.json({
        success: true,
        data: permissions
      });
    } catch (error) {
      console.error('Get role permissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch role permissions'
      });
    }
  }
);

// PUT /api/admin-auth/rbac/role/:roleId/permissions - Rol izinlerini güncelle
router.put('/rbac/role/:roleId/permissions', 
  authenticateAdmin, 
  requirePermission('users', 'manage_roles'),
  async (req, res) => {
    try {
      const { roleId } = req.params;
      const { permission_ids } = req.body;
      const updaterId = req.admin.admin_id;

      if (!Array.isArray(permission_ids)) {
        return res.status(400).json({
          success: false,
          message: 'Permission IDs must be an array'
        });
      }

      const result = await rbacService.updateRolePermissions(roleId, permission_ids, updaterId);
      res.json(result);
    } catch (error) {
      console.error('Update role permissions error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update role permissions'
      });
    }
  }
);

// POST /api/admin-auth/rbac/check-multiple-permissions - Check multiple permissions
router.post('/rbac/check-multiple-permissions', 
  authenticateAdmin,
  async (req, res) => {
    try {
      const { user_id, permissions } = req.body;
      const targetUserId = user_id || req.admin.admin_id;

      if (!permissions || !Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          error: 'Permissions array is required'
        });
      }

      const results = await rbacService.checkMultiplePermissions(targetUserId, permissions);
      
      res.json({
        success: true,
        data: {
          user_id: targetUserId,
          permissions: results
        }
      });
    } catch (error) {
      console.error('Check multiple permissions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check permissions'
      });
    }
  }
);

// PUT /api/admin-auth/rbac/user/:userId/super-admin - Super admin durumunu değiştir (Super Admin Only)
router.put('/rbac/user/:userId/super-admin', 
  authenticateAdmin, 
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { is_super_admin } = req.body;
      const updaterId = req.admin.admin_id;

      // Kendi kendini super admin yapamasın
      if (parseInt(userId) === updaterId && !is_super_admin) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove super admin status from yourself'
        });
      }

      const [result] = await pool.execute(`
        UPDATE admin_users 
        SET 
          is_super_admin = ?,
          last_role_update = NOW(),
          role_updated_by = ?
        WHERE admin_id = ? AND is_active = TRUE
      `, [is_super_admin, updaterId, userId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: `Super admin status ${is_super_admin ? 'granted' : 'revoked'} successfully`
      });
    } catch (error) {
      console.error('Update super admin status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update super admin status'
      });
    }
  }
);

// GET /api/admin-auth/rbac/statistics - RBAC istatistikleri (Super Admin Only)
router.get('/rbac/statistics', 
  authenticateAdmin, 
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      // Rol istatistikleri
      const [roleStats] = await pool.execute(`
        SELECT 
          r.role_name,
          r.display_name,
          COUNT(ur.user_id) as user_count,
          COUNT(rp.permission_id) as permission_count
        FROM roles r
        LEFT JOIN user_roles ur ON r.role_id = ur.role_id AND ur.is_active = TRUE
        LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
        WHERE r.is_active = TRUE
        GROUP BY r.role_id, r.role_name, r.display_name
        ORDER BY user_count DESC
      `);

      // Departman istatistikleri
      const [deptStats] = await pool.execute(`
        SELECT 
          au.department,
          COUNT(au.admin_id) as admin_count,
          COUNT(ur.role_id) as total_role_assignments,
          COUNT(DISTINCT ur.role_id) as unique_roles
        FROM admin_users au
        LEFT JOIN user_roles ur ON au.admin_id = ur.user_id AND ur.is_active = TRUE
        WHERE au.is_active = TRUE
        GROUP BY au.department
        ORDER BY admin_count DESC
      `);

      // İzin kullanım istatistikleri
      const [permissionStats] = await pool.execute(`
        SELECT 
          p.resource,
          COUNT(p.permission_id) as permission_count,
          COUNT(rp.role_id) as assigned_to_roles
        FROM permissions p
        LEFT JOIN role_permissions rp ON p.permission_id = rp.permission_id
        GROUP BY p.resource
        ORDER BY permission_count DESC
      `);

      // Genel istatistikler
      const [generalStats] = await pool.execute(`
        SELECT 
          (SELECT COUNT(*) FROM admin_users WHERE is_active = TRUE) as total_users,
          (SELECT COUNT(*) FROM roles WHERE is_active = TRUE) as total_roles,
          (SELECT COUNT(*) FROM permissions) as total_permissions,
          (SELECT COUNT(*) FROM user_roles WHERE is_active = TRUE) as total_role_assignments,
          (SELECT COUNT(*) FROM admin_users WHERE is_super_admin = TRUE AND is_active = TRUE) as super_admin_count
      `);

      res.json({
        success: true,
        data: {
          general: generalStats[0],
          role_statistics: roleStats,
          department_statistics: deptStats,
          permission_statistics: permissionStats
        }
      });
    } catch (error) {
      console.error('Get RBAC statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch RBAC statistics'
      });
    }
  }
);

// GET /api/admin-auth/rbac/audit-log - RBAC audit log (Super Admin Only)
router.get('/rbac/audit-log', 
  authenticateAdmin, 
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      const { limit = 100, offset = 0, user_id, action_type } = req.query;

      let query = `
        SELECT 
          ur.user_id,
          ur.role_id,
          ur.assigned_by,
          ur.assigned_at,
          ur.expires_at,
          ur.is_active,
          u.username as target_username,
          r.role_name,
          assigner.username as assigned_by_username
        FROM user_roles ur
        LEFT JOIN admin_users u ON ur.user_id = u.admin_id
        LEFT JOIN roles r ON ur.role_id = r.role_id
        LEFT JOIN admin_users assigner ON ur.assigned_by = assigner.admin_id
      `;

      const params = [];
      const conditions = [];

      if (user_id) {
        conditions.push('ur.user_id = ?');
        params.push(user_id);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY ur.assigned_at DESC`;

      // FIX: parseInt parametreleri ve LIMIT/OFFSET'i string olarak ekle
      const limitValue = parseInt(limit) || 100;
      const offsetValue = parseInt(offset) || 0;
      
      query += ` LIMIT ${limitValue} OFFSET ${offsetValue}`;

      console.log('Audit log query:', query);
      console.log('Audit log params:', params);

      const [auditLog] = await pool.execute(query, params);

      res.json({
        success: true,
        data: auditLog,
        meta: {
          limit: limitValue,
          offset: offsetValue,
          total: auditLog.length
        }
      });
    } catch (error) {
      console.error('Get audit log error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch audit log',
        error: error.message
      });
    }
  }
);


// GET /api/admin-auth/rbac/system-health - Get RBAC system health
router.get('/rbac/system-health', 
  authenticateAdmin, 
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      const healthChecks = {};

      // 1. Orphaned role assignments check
      const [orphanedRoles] = await pool.execute(`
        SELECT COUNT(*) as count FROM user_roles ur 
        LEFT JOIN roles r ON ur.role_id = r.role_id 
        WHERE ur.is_active = TRUE AND (r.is_active = FALSE OR r.role_id IS NULL)
      `);
      healthChecks.orphaned_role_assignments = orphanedRoles[0].count;

      // 2. Users without roles check
      const [usersWithoutRoles] = await pool.execute(`
        SELECT COUNT(*) as count FROM admin_users au
        WHERE au.is_active = TRUE AND au.admin_id NOT IN (
          SELECT DISTINCT user_id FROM user_roles WHERE is_active = TRUE
        )
      `);
      healthChecks.users_without_roles = usersWithoutRoles[0].count;

      // 3. Expired role assignments check
      const [expiredRoles] = await pool.execute(`
        SELECT COUNT(*) as count FROM user_roles 
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
      `);
      healthChecks.expired_role_assignments = expiredRoles[0].count;

      // 4. Unused roles check
      const [unusedRoles] = await pool.execute(`
        SELECT COUNT(*) as count FROM roles r
        WHERE r.is_active = TRUE AND r.role_id NOT IN (
          SELECT DISTINCT role_id FROM user_roles WHERE is_active = TRUE
        )
      `);
      healthChecks.unused_roles = unusedRoles[0].count;

      // 5. Duplicate role assignments check
      const [duplicateAssignments] = await pool.execute(`
        SELECT user_id, role_id, COUNT(*) as count 
        FROM user_roles 
        WHERE is_active = TRUE 
        GROUP BY user_id, role_id 
        HAVING count > 1
      `);
      healthChecks.duplicate_assignments = duplicateAssignments.length;

      // 6. System role integrity check
      const [systemRoleCheck] = await pool.execute(`
        SELECT COUNT(*) as count FROM roles 
        WHERE is_system_role = TRUE AND is_active = FALSE
      `);
      healthChecks.inactive_system_roles = systemRoleCheck[0].count;

      // Calculate overall health score
      let healthScore = 100;
      if (healthChecks.orphaned_role_assignments > 0) healthScore -= 20;
      if (healthChecks.users_without_roles > 0) healthScore -= 10;
      if (healthChecks.expired_role_assignments > 0) healthScore -= 15;
      if (healthChecks.duplicate_assignments > 0) healthScore -= 25;
      if (healthChecks.inactive_system_roles > 0) healthScore -= 30;

      healthScore = Math.max(0, healthScore);

      res.json({
        success: true,
        data: {
          health_score: healthScore,
          status: healthScore >= 90 ? 'excellent' : 
                 healthScore >= 70 ? 'good' : 
                 healthScore >= 50 ? 'fair' : 'poor',
          checks: healthChecks,
          recommendations: generateHealthRecommendations(healthChecks)
        }
      });

    } catch (error) {
      console.error('RBAC system health error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check system health'
      });
    }
  }
);

// GET /api/admin-auth/rbac/system-health - Get RBAC system health
router.get('/rbac/system-health', 
  authenticateAdmin, 
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      const healthChecks = {};

      // 1. Orphaned role assignments check
      const [orphanedRoles] = await pool.execute(`
        SELECT COUNT(*) as count FROM user_roles ur 
        LEFT JOIN roles r ON ur.role_id = r.role_id 
        WHERE ur.is_active = TRUE AND (r.is_active = FALSE OR r.role_id IS NULL)
      `);
      healthChecks.orphaned_role_assignments = orphanedRoles[0].count;

      // 2. Users without roles check
      const [usersWithoutRoles] = await pool.execute(`
        SELECT COUNT(*) as count FROM admin_users au
        WHERE au.is_active = TRUE AND au.admin_id NOT IN (
          SELECT DISTINCT user_id FROM user_roles WHERE is_active = TRUE
        )
      `);
      healthChecks.users_without_roles = usersWithoutRoles[0].count;

      // 3. Expired role assignments check
      const [expiredRoles] = await pool.execute(`
        SELECT COUNT(*) as count FROM user_roles 
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
      `);
      healthChecks.expired_role_assignments = expiredRoles[0].count;

      // 4. Unused roles check
      const [unusedRoles] = await pool.execute(`
        SELECT COUNT(*) as count FROM roles r
        WHERE r.is_active = TRUE AND r.role_id NOT IN (
          SELECT DISTINCT role_id FROM user_roles WHERE is_active = TRUE
        )
      `);
      healthChecks.unused_roles = unusedRoles[0].count;

      // 5. Duplicate role assignments check
      const [duplicateAssignments] = await pool.execute(`
        SELECT user_id, role_id, COUNT(*) as count 
        FROM user_roles 
        WHERE is_active = TRUE 
        GROUP BY user_id, role_id 
        HAVING count > 1
      `);
      healthChecks.duplicate_assignments = duplicateAssignments.length;

      // 6. System role integrity check
      const [systemRoleCheck] = await pool.execute(`
        SELECT COUNT(*) as count FROM roles 
        WHERE is_system_role = TRUE AND is_active = FALSE
      `);
      healthChecks.inactive_system_roles = systemRoleCheck[0].count;

      // Calculate overall health score
      let healthScore = 100;
      if (healthChecks.orphaned_role_assignments > 0) healthScore -= 20;
      if (healthChecks.users_without_roles > 0) healthScore -= 10;
      if (healthChecks.expired_role_assignments > 0) healthScore -= 15;
      if (healthChecks.duplicate_assignments > 0) healthScore -= 25;
      if (healthChecks.inactive_system_roles > 0) healthScore -= 30;

      healthScore = Math.max(0, healthScore);

      res.json({
        success: true,
        data: {
          health_score: healthScore,
          status: healthScore >= 90 ? 'excellent' : 
                 healthScore >= 70 ? 'good' : 
                 healthScore >= 50 ? 'fair' : 'poor',
          checks: healthChecks,
          recommendations: generateHealthRecommendations(healthChecks)
        }
      });

    } catch (error) {
      console.error('RBAC system health error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check system health'
      });
    }
  }
);

// Helper function for health recommendations
function generateHealthRecommendations(checks) {
  const recommendations = [];
  
  if (checks.orphaned_role_assignments > 0) {
    recommendations.push({
      priority: 'high',
      issue: 'Orphaned role assignments detected',
      action: 'Clean up role assignments that reference inactive or deleted roles'
    });
  }
  
  if (checks.users_without_roles > 0) {
    recommendations.push({
      priority: 'medium',
      issue: `${checks.users_without_roles} users without roles`,
      action: 'Assign appropriate roles to users or deactivate unused accounts'
    });
  }
  
  if (checks.expired_role_assignments > 0) {
    recommendations.push({
      priority: 'medium',
      issue: 'Expired role assignments found',
      action: 'Review and update or remove expired role assignments'
    });
  }
  
  if (checks.duplicate_assignments > 0) {
    recommendations.push({
      priority: 'high',
      issue: 'Duplicate role assignments detected',
      action: 'Remove duplicate role assignments to prevent conflicts'
    });
  }
  
  if (checks.inactive_system_roles > 0) {
    recommendations.push({
      priority: 'critical',
      issue: 'System roles are inactive',
      action: 'Reactivate essential system roles immediately'
    });
  }
  
  return recommendations;
}


// ===== 1. BACKEND FIX - adminAuth.js =====
// backend/routes/adminAuth.js - Request reject endpoint'ini düzelt

// PUT /api/admin-auth/requests/:requestId/reject - Reject request (FIXED)
router.put('/requests/:requestId/reject', 
  authenticateAdmin, 
  commonPermissions.manageRequests(),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { rejection_reason } = req.body;
      const adminId = req.admin.admin_id;

      console.log('🚫 Request rejection attempt:', { 
        requestId, 
        adminId, 
        hasReason: !!rejection_reason 
      });

      if (!rejection_reason || rejection_reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required'
        });
      }

      // Get current request details and verify department access
      let requestCheckQuery = `
        SELECT 
          gr.request_id,
          gr.status as current_status,
          s.name as student_name,
          s.email as student_email,
          rt.type_name,
          rt.category
        FROM guidance_requests gr
        JOIN students s ON gr.student_id = s.student_id
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE gr.request_id = ?
      `;

      const params = [requestId];

      // Department access control for non-super admins
      if (!req.admin.is_super_admin) {
        requestCheckQuery += ' AND rt.category = ?';
        params.push(req.admin.department);
      }

      const [requestCheck] = await pool.execute(requestCheckQuery, params);

      if (requestCheck.length === 0) {
        return res.status(404).json({
          success: false,
          error: req.admin.is_super_admin 
            ? 'Request not found' 
            : 'Request not found in your department'
        });
      }

      const request = requestCheck[0];

      // Check if request can be rejected
      if (request.current_status === 'Rejected') {
        return res.status(400).json({
          success: false,
          error: 'Request is already rejected'
        });
      }

      if (request.current_status === 'Completed') {
        return res.status(400).json({
          success: false,
          error: 'Cannot reject a completed request'
        });
      }

      // Update request status to rejected (WITHOUT EMAIL SENDING)
      const [result] = await pool.execute(`
        UPDATE guidance_requests 
        SET 
          status = 'Rejected',
          rejection_reason = ?,
          rejected_by = ?,
          rejected_at = NOW(),
          updated_at = NOW()
        WHERE request_id = ?
      `, [rejection_reason.trim(), adminId, requestId]);

      if (result.affectedRows === 0) {
        return res.status(500).json({
          success: false,
          error: 'Failed to reject request'
        });
      }

      // Add an admin response for the rejection (simplified)
      await pool.execute(`
        INSERT INTO admin_responses (request_id, admin_id, response_content, is_internal, created_at)
        VALUES (?, ?, ?, FALSE, NOW())
      `, [
        requestId, 
        adminId, 
        `Request has been rejected.\n\nReason: ${rejection_reason.trim()}`
      ]);

      // NO EMAIL SENDING - Removed email service call

      // Log the rejection action
      console.log(`🚫 Request #${requestId} rejected by ${req.admin.username} (${req.admin.department})`);

      // FIXED: Ensure proper JSON response
      res.json({
        success: true,
        message: 'Request rejected successfully',
        data: {
          request_id: parseInt(requestId),
          previous_status: request.current_status,
          new_status: 'Rejected',
          rejection_reason: rejection_reason.trim(),
          rejected_by: adminId,
          rejected_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Error rejecting request:', error);
      
      // FIXED: Ensure error responses are also proper JSON
      res.status(500).json({
        success: false,
        error: 'Failed to reject request',
        details: error.message
      });
    }
  }
);


// GET /api/admin-auth/requests/:requestId/rejection-details - Admin rejection details endpoint
router.get('/requests/:requestId/rejection-details', authenticateAdmin, async (req, res) => {
  try {
    const { requestId } = req.params;
    console.log('📋 Admin getting rejection details for request:', requestId);
    
    // Departman erişim kontrolü
    let query = `
      SELECT 
        gr.rejection_reason as reason,
        '' as additional_info,
        gr.rejected_at,
        gr.rejected_by,
        COALESCE(au.full_name, au.name, au.username, 'Admin') as admin_name,
        rt.category
      FROM guidance_requests gr
      LEFT JOIN admin_users au ON gr.rejected_by = au.admin_id
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE gr.request_id = ? AND gr.status = 'Rejected'
    `;
    
    const params = [requestId];
    
    // Super admin değilse departman kontrolü yap
    if (!req.admin.is_super_admin) {
      query += ' AND rt.category = ?';
      params.push(req.admin.department);
    }
    
    const [rows] = await pool.execute(query, params);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rejection details not found for this request in your department'
      });
    }
    
    console.log('✅ Found admin rejection details:', rows[0]);
    
    res.json({
      success: true,
      data: rows[0]
    });
    
  } catch (error) {
    console.error('❌ Admin rejection details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rejection details',
      error: error.message
    });
  }
});

// POST /api/admin-auth/requests/:requestId/unreject - Unreject/Reopen request (Super Admin only)
router.post('/requests/:requestId/unreject', 
  authenticateAdmin, 
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { reopen_reason } = req.body;
      const adminId = req.admin.admin_id;

      if (!reopen_reason || reopen_reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Reopen reason is required'
        });
      }

      // Check if request is rejected
      const [requestCheck] = await pool.execute(`
        SELECT 
          gr.request_id,
          gr.status,
          s.name as student_name,
          s.email as student_email,
          rt.type_name
        FROM guidance_requests gr
        JOIN students s ON gr.student_id = s.student_id
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE gr.request_id = ? AND gr.status = 'Rejected'
      `, [requestId]);

      if (requestCheck.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Rejected request not found'
        });
      }

      // Reopen the request
      const [result] = await pool.execute(`
        UPDATE guidance_requests 
        SET 
          status = 'Pending',
          rejection_reason = NULL,
          rejected_by = NULL,
          rejected_at = NULL,
          updated_at = NOW()
        WHERE request_id = ?
      `, [requestId]);

      if (result.affectedRows === 0) {
        return res.status(500).json({
          success: false,
          error: 'Failed to reopen request'
        });
      }

      // Add admin response for reopening
      await pool.execute(`
        INSERT INTO admin_responses (request_id, admin_id, response_content, is_internal, created_at)
        VALUES (?, ?, ?, FALSE, NOW())
      `, [
        requestId, 
        adminId, 
        `Request has been reopened by Super Administrator.\n\nReason: ${reopen_reason.trim()}`
      ]);

      console.log(`♻️ Request #${requestId} reopened by ${req.admin.username}`);

      res.json({
        success: true,
        message: 'Request reopened successfully',
        data: {
          request_id: requestId,
          new_status: 'Pending',
          reopened_by: adminId,
          reopen_reason: reopen_reason.trim()
        }
      });

    } catch (error) {
      console.error('Error reopening request:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reopen request'
      });
    }
  }
);

// GET /api/admin-auth/statistics/rejections - Get rejection statistics (for analytics)
router.get('/statistics/rejections', 
  authenticateAdmin, 
  commonPermissions.viewAnalytics(),
  async (req, res) => {
    try {
      const department = req.admin.is_super_admin ? null : req.admin.department;
      
      let statsQuery = `
        SELECT 
          COUNT(*) as total_rejections,
          COUNT(CASE WHEN rejected_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as rejections_last_30_days,
          COUNT(CASE WHEN rejected_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as rejections_last_7_days,
          AVG(DATEDIFF(rejected_at, submitted_at)) as avg_days_to_rejection
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE gr.status = 'Rejected'
      `;

      const params = [];
      if (department) {
        statsQuery += ' AND rt.category = ?';
        params.push(department);
      }

      const [stats] = await pool.execute(statsQuery, params);

      // Get rejection reasons breakdown
      let reasonsQuery = `
        SELECT 
          LEFT(rejection_reason, 50) as reason_preview,
          COUNT(*) as count
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE gr.status = 'Rejected' AND gr.rejection_reason IS NOT NULL
      `;

      if (department) {
        reasonsQuery += ' AND rt.category = ?';
      }

      reasonsQuery += `
        GROUP BY LEFT(rejection_reason, 50)
        ORDER BY count DESC
        LIMIT 10
      `;

      const [reasons] = await pool.execute(reasonsQuery, department ? [department] : []);

      res.json({
        success: true,
        data: {
          statistics: stats[0],
          common_reasons: reasons,
          department: department || 'ALL'
        }
      });

    } catch (error) {
      console.error('Error fetching rejection statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch rejection statistics'
      });
    }
  }
);

// GET /api/admin-auth/rbac/dashboard - RBAC Dashboard verilerini getir (Super Admin Only)
router.get('/rbac/dashboard', 
  authenticateAdmin, 
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      // RBAC Dashboard için tüm gerekli verileri topla
      const dashboardData = {};

      // 1. Genel İstatistikler
      const [generalStats] = await pool.execute(`
        SELECT 
          (SELECT COUNT(*) FROM admin_users WHERE is_active = TRUE) as total_users,
          (SELECT COUNT(*) FROM roles WHERE is_active = TRUE) as total_roles,
          (SELECT COUNT(*) FROM permissions) as total_permissions,
          (SELECT COUNT(*) FROM user_roles WHERE is_active = TRUE) as total_role_assignments,
          (SELECT COUNT(*) FROM admin_users WHERE is_super_admin = TRUE AND is_active = TRUE) as super_admin_count,
          (SELECT COUNT(DISTINCT au.department) FROM admin_users au WHERE au.is_active = TRUE) as total_departments
      `);
      dashboardData.general = generalStats[0];

      // 2. Rol Dağılımı
      const [roleStats] = await pool.execute(`
        SELECT 
          r.role_id,
          r.role_name,
          r.display_name,
          r.description,
          r.is_system_role,
          COUNT(DISTINCT ur.user_id) as user_count,
          COUNT(DISTINCT rp.permission_id) as permission_count
        FROM roles r
        LEFT JOIN user_roles ur ON r.role_id = ur.role_id AND ur.is_active = TRUE
        LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
        WHERE r.is_active = TRUE
        GROUP BY r.role_id, r.role_name, r.display_name, r.description, r.is_system_role
        ORDER BY user_count DESC, r.role_name
      `);
      dashboardData.role_statistics = roleStats;

      // 3. Departman İstatistikleri
      const [deptStats] = await pool.execute(`
        SELECT 
          au.department,
          COUNT(DISTINCT au.admin_id) as admin_count,
          COUNT(DISTINCT ur.role_id) as unique_roles,
          COUNT(ur.role_id) as total_role_assignments,
          COUNT(CASE WHEN au.is_super_admin = TRUE THEN 1 END) as super_admin_count
        FROM admin_users au
        LEFT JOIN user_roles ur ON au.admin_id = ur.user_id AND ur.is_active = TRUE
        WHERE au.is_active = TRUE
        GROUP BY au.department
        ORDER BY admin_count DESC
      `);
      dashboardData.department_statistics = deptStats;

      // 4. İzin Kaynak İstatistikleri
      const [permissionStats] = await pool.execute(`
        SELECT 
          p.resource,
          COUNT(p.permission_id) as permission_count,
          COUNT(DISTINCT rp.role_id) as roles_using_resource,
          COUNT(CASE WHEN p.is_system_permission = TRUE THEN 1 END) as system_permissions,
          COUNT(CASE WHEN p.is_system_permission = FALSE THEN 1 END) as custom_permissions
        FROM permissions p
        LEFT JOIN role_permissions rp ON p.permission_id = rp.permission_id
        GROUP BY p.resource
        ORDER BY permission_count DESC
      `);
      dashboardData.permission_statistics = permissionStats;

      // 5. Son RBAC Aktiviteleri (Audit Log)
      const [recentActivity] = await pool.execute(`
        SELECT 
          ur.assigned_at as activity_date,
          ur.is_active,
          u.username as target_user,
          u.department as target_department,
          r.role_name,
          r.display_name as role_display_name,
          assigner.username as assigned_by_username,
          CASE 
            WHEN ur.is_active = TRUE THEN 'role_assigned'
            ELSE 'role_removed'
          END as activity_type
        FROM user_roles ur
        LEFT JOIN admin_users u ON ur.user_id = u.admin_id
        LEFT JOIN roles r ON ur.role_id = r.role_id
        LEFT JOIN admin_users assigner ON ur.assigned_by = assigner.admin_id
        ORDER BY ur.assigned_at DESC
        LIMIT 20
      `);
      dashboardData.recent_activity = recentActivity;

      // 6. Sistem Sağlığı Kontrolleri
      const [systemHealth] = await pool.execute(`
        SELECT 
          (SELECT COUNT(*) FROM admin_users WHERE is_active = FALSE) as inactive_users,
          (SELECT COUNT(*) FROM user_roles WHERE expires_at IS NOT NULL AND expires_at < NOW()) as expired_roles,
          (SELECT COUNT(*) FROM user_roles ur 
           LEFT JOIN roles r ON ur.role_id = r.role_id 
           WHERE ur.is_active = TRUE AND r.is_active = FALSE) as orphaned_role_assignments,
          (SELECT COUNT(*) FROM roles WHERE is_active = TRUE AND role_id NOT IN (
            SELECT DISTINCT role_id FROM user_roles WHERE is_active = TRUE
          )) as unused_roles
      `);
      dashboardData.system_health = systemHealth[0];

      // 7. Trend Verileri (Son 30 gün)
      const [trendData] = await pool.execute(`
        SELECT 
          DATE(ur.assigned_at) as assignment_date,
          COUNT(*) as daily_assignments,
          COUNT(DISTINCT ur.user_id) as users_affected
        FROM user_roles ur
        WHERE ur.assigned_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(ur.assigned_at)
        ORDER BY assignment_date DESC
        LIMIT 30
      `);
      dashboardData.trend_data = trendData;

      // 8. Kritik Uyarılar
      const warnings = [];
      
      // Super admin sayısı kontrolü
      if (dashboardData.general.super_admin_count === 0) {
        warnings.push({
          type: 'critical',
          message: 'No super administrators found in the system',
          action: 'Assign super admin role to at least one user'
        });
      } else if (dashboardData.general.super_admin_count === 1) {
        warnings.push({
          type: 'warning',
          message: 'Only one super administrator in the system',
          action: 'Consider adding a backup super administrator'
        });
      }

      // Kullanılmayan roller kontrolü
      if (dashboardData.system_health.unused_roles > 0) {
        warnings.push({
          type: 'info',
          message: `${dashboardData.system_health.unused_roles} roles are not assigned to any users`,
          action: 'Review and clean up unused roles'
        });
      }

      // Süresi dolmuş roller kontrolü
      if (dashboardData.system_health.expired_roles > 0) {
        warnings.push({
          type: 'warning',
          message: `${dashboardData.system_health.expired_roles} role assignments have expired`,
          action: 'Review and update expired role assignments'
        });
      }

      dashboardData.warnings = warnings;

      // 9. Hızlı Aksiyonlar için Veriler
      const [quickActions] = await pool.execute(`
        SELECT 
          (SELECT COUNT(*) FROM admin_users WHERE is_active = TRUE AND admin_id NOT IN (
            SELECT DISTINCT user_id FROM user_roles WHERE is_active = TRUE
          )) as users_without_roles,
          (SELECT COUNT(*) FROM user_roles WHERE expires_at IS NOT NULL AND expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)) as roles_expiring_soon
      `);
      dashboardData.quick_actions = quickActions[0];

      res.json({
        success: true,
        data: dashboardData,
        meta: {
          generated_at: new Date().toISOString(),
          data_points: Object.keys(dashboardData).length,
          cache_duration: '5 minutes'
        }
      });

    } catch (error) {
      console.error('RBAC Dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load RBAC dashboard data',
        error: error.message
      });
    }
  }
);

// GET /api/admin-auth/rbac/user/:userId/permissions - Get user permissions (FIX)
router.get('/rbac/user/:userId/permissions', 
  authenticateAdmin, 
  requirePermission('users', 'view'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      
      // rbacService.getUserPermissions array döndürmelidir
      const permissions = await rbacService.getUserPermissions(userId);
      
      res.json({
        success: true,
        data: permissions // Array olmalı
      });
    } catch (error) {
      console.error('Get user permissions error:', error);
      res.status(500).json({
        success: false,
        data: [], // Array döndür
        error: 'Failed to fetch user permissions'
      });
    }
  }
);

// GET /api/admin-auth/rbac/permissions - Get all permissions (EKSİK!)
router.get('/rbac/permissions', 
  authenticateAdmin, 
  requirePermission('users', 'view'),
  async (req, res) => {
    try {
      console.log('🔐 Fetching all permissions...');
      
      const [permissions] = await pool.execute(`
        SELECT 
          permission_id,
          permission_name,
          display_name,
          description,
          resource,
          action,
          is_system_permission
        FROM permissions
        ORDER BY resource, action
      `);

      // Group by resource for frontend
      const grouped = permissions.reduce((acc, permission) => {
        if (!acc[permission.resource]) {
          acc[permission.resource] = [];
        }
        acc[permission.resource].push(permission);
        return acc;
      }, {});

      console.log(`✅ Found ${permissions.length} permissions in ${Object.keys(grouped).length} resources`);

      res.json({
        success: true,
        data: grouped
      });
    } catch (error) {
      console.error('Get permissions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch permissions'
      });
    }
  }
);

// GET /api/admin-auth/rbac/user/:userId/roles - Get user roles (FIX)
router.get('/rbac/user/:userId/roles', 
  authenticateAdmin, 
  requirePermission('users', 'view'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      
      const roles = await rbacService.getUserRoles(userId);
      
      res.json({
        success: true,
        data: roles // Array olmalı
      });
    } catch (error) {
      console.error('Get user roles error:', error);
      res.status(500).json({
        success: false,
        data: [], // Array döndür
        error: 'Failed to fetch user roles'
      });
    }
  }
);


// DELETE /api/admin-auth/users/:userId - Delete admin user
router.delete('/users/:userId', 
  authenticateAdmin, 
  requirePermission('users', 'delete'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const requesterId = req.admin.admin_id;

      // Güvenlik kontrolleri
      if (!userId || userId === '0') {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID'
        });
      }

      // Kendi kendini silmeyi engelle
      if (parseInt(userId) === requesterId) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete your own account'
        });
      }

      // Silinecek kullanıcının bilgilerini al
      const [targetUser] = await pool.execute(
        'SELECT admin_id, username, full_name, email, department, is_super_admin, is_active FROM admin_users WHERE admin_id = ?',
        [userId]
      );

      if (targetUser.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const userToDelete = targetUser[0];

      // Super admin silinmesini engelle (son super admin kontrolü)
      if (userToDelete.is_super_admin) {
        const [superAdminCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM admin_users WHERE is_super_admin = TRUE AND is_active = TRUE'
        );

        if (superAdminCount[0].count <= 1) {
          return res.status(400).json({
            success: false,
            error: 'Cannot delete the last super administrator'
          });
        }
      }

      // Departman kontrolü (Super admin değilse)
      if (!req.admin.is_super_admin) {
        if (userToDelete.department !== req.admin.department) {
          return res.status(403).json({
            success: false,
            error: 'Cannot delete users from other departments'
          });
        }
      }

      // Transaction ile silme işlemi
      const connection = await pool.getConnection();
      
      try {
        await connection.beginTransaction();

        // 1. User roles'ları sil
        await connection.execute(
          'DELETE FROM user_roles WHERE user_id = ?',
          [userId]
        );

        // 2. Admin responses'lardaki foreign key'i null yap
        await connection.execute(
          'UPDATE admin_responses SET admin_id = NULL WHERE admin_id = ?',
          [userId]
        );

        // 3. Admin users tablosundaki role_updated_by foreign key'ini null yap
        await connection.execute(
          'UPDATE admin_users SET role_updated_by = NULL WHERE role_updated_by = ?',
          [userId]
        );

        // 4. Kullanıcıyı inactive yap (hard delete yerine soft delete)
        const [deleteResult] = await connection.execute(
          'UPDATE admin_users SET is_active = FALSE, updated_at = NOW() WHERE admin_id = ?',
          [userId]
        );

        if (deleteResult.affectedRows === 0) {
          throw new Error('Failed to delete user');
        }

        await connection.commit();

        // Audit log için
        console.log(`User deleted: ${userToDelete.username} (ID: ${userId}) by ${req.admin.username} (ID: ${requesterId})`);

        res.json({
          success: true,
          message: 'User deleted successfully',
          data: {
            deleted_user: {
              id: userId,
              username: userToDelete.username,
              full_name: userToDelete.full_name
            },
            deleted_by: {
              id: requesterId,
              username: req.admin.username
            }
          }
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      console.error('Delete admin user error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete admin user'
      });
    }
  }
);

// 2. backend/routes/adminAuth.js - Inactive users'ları gösterme endpoint'i (opsiyonel)
router.get('/users/inactive', 
  authenticateAdmin, 
  requirePermission('users', 'view'),
  async (req, res) => {
    try {
      const [users] = await pool.execute(`
        SELECT 
          admin_id, username, full_name, email, department, 
          role, is_super_admin, created_at, updated_at
        FROM admin_users 
        WHERE is_active = FALSE
        ORDER BY updated_at DESC
      `);

      res.json({
        success: true,
        data: users
      });

    } catch (error) {
      console.error('Get inactive users error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch inactive users'
      });
    }
  }
);

module.exports = router;