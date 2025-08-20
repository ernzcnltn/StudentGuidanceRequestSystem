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
router.post('/login-email', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('=== ADMIN LOGIN (EMAIL) ===');
    console.log('🔍 Received data:', { 
      email, 
      password: password?.substring(0, 10) + '...',
      passwordLength: password?.length
    });

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Admin'i email ile bul
    const [admins] = await pool.execute(
      'SELECT admin_id, username, password_hash, full_name, email, department, role, is_super_admin FROM admin_users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    console.log('🔍 Database query result:', {
      foundUsers: admins.length,
      userData: admins.length > 0 ? {
        username: admins[0].username,
        email: admins[0].email,
        department: admins[0].department,
        is_super_admin: admins[0].is_super_admin,
        hasPasswordHash: !!admins[0].password_hash
      } : 'No user found'
    });

    if (admins.length === 0) {
      console.log('❌ Admin not found with email:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const admin = admins[0];

    // Şifre kontrolü
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    console.log('🔍 Password validation result:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password for admin:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // JWT token oluştur
    const token = jwt.sign(
      { 
        admin_id: admin.admin_id,
        username: admin.username,
        email: admin.email,
        department: admin.department,
        type: 'admin'
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

      console.log('✅ Admin email login successful:', {
        username: adminData.username,
        email: adminData.email,
        department: adminData.department
      });

      res.json({
        success: true,
        message: 'Admin email login successful',
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
      console.error('RBAC fetch error during email login:', rbacError);
      const { password_hash: _, ...adminData } = admin;
      res.json({
        success: true,
        message: 'Admin email login successful (limited RBAC data)',
        data: {
          token,
          admin: adminData
        }
      });
    }

  } catch (error) {
    console.error('❌ Admin email login error:', error);
    res.status(500).json({
      success: false,
      error: 'Admin email login failed'
    });
  }
});

 // GET /api/admin-auth/dashboard - Dashboard data (DÜZELT!)
router.get('/dashboard', 
  authenticateAdmin, 
  commonPermissions.viewAnalytics(),
  async (req, res) => {
    try {
      console.log('📊 FIXED Dashboard request from:', {
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

      // FIXED: Direct query without views - Request counts by status
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
      
      console.log('📊 Executing FIXED status query:', statusQuery);
      console.log('📊 Query params:', params);

      const [statusCounts] = await pool.execute(statusQuery, params);
      console.log('📊 Status counts result:', statusCounts);
      
      // FIXED: Assignment statistics (without admin_performance_view)
      let assignmentQuery = `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(gr.assigned_admin_id) as assigned_requests,
          COUNT(*) - COUNT(gr.assigned_admin_id) as unassigned_requests,
          COUNT(DISTINCT gr.assigned_admin_id) as admins_with_assignments,
          ROUND((COUNT(gr.assigned_admin_id) * 100.0 / COUNT(*)), 1) as assignment_rate
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
      `;
      
      const assignmentParams = [];
      if (!isPureSuperAdmin && department) {
        assignmentQuery += ' WHERE rt.category = ?';
        assignmentParams.push(department);
      }
      
      const [assignmentStats] = await pool.execute(assignmentQuery, assignmentParams);
      console.log('📊 Assignment stats result:', assignmentStats);

      // FIXED: Admin performance summary (direct query)
      let performanceQuery = `
        SELECT 
          COUNT(DISTINCT au.admin_id) as total_active_admins,
          ROUND(AVG(
            CASE 
              WHEN assigned_count.total > 0 THEN 
                (assigned_count.completed * 100.0 / assigned_count.total)
              ELSE 0
            END
          ), 1) as avg_completion_rate,
          ROUND(AVG(response_time.avg_hours), 2) as avg_response_time
        FROM admin_users au
        LEFT JOIN (
          SELECT 
            gr.assigned_admin_id,
            COUNT(*) as total,
            COUNT(CASE WHEN gr.status = 'Completed' THEN 1 END) as completed
          FROM guidance_requests gr
          ${!isPureSuperAdmin && department ? 
            'JOIN request_types rt ON gr.type_id = rt.type_id WHERE rt.category = ?' : ''}
          GROUP BY gr.assigned_admin_id
        ) assigned_count ON au.admin_id = assigned_count.assigned_admin_id
        LEFT JOIN (
          SELECT 
            ar.admin_id,
            AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)) as avg_hours
          FROM admin_responses ar
          JOIN guidance_requests gr ON ar.request_id = gr.request_id
          ${!isPureSuperAdmin && department ? 
            'JOIN request_types rt ON gr.type_id = rt.type_id WHERE rt.category = ?' : ''}
          GROUP BY ar.admin_id
        ) response_time ON au.admin_id = response_time.admin_id
        WHERE au.is_active = TRUE
        ${!isPureSuperAdmin && department ? 'AND au.department = ?' : ''}
      `;
      
      const performanceParams = [];
      if (!isPureSuperAdmin && department) {
        performanceParams.push(department); // for guidance_requests join
        performanceParams.push(department); // for admin_responses join  
        performanceParams.push(department); // for admin_users filter
      }
      
      const [performanceStats] = await pool.execute(performanceQuery, performanceParams);
      console.log(' Performance stats result:', performanceStats);
      
      // Format response with CORRECT data
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
      
      console.log('✅ FIXED Dashboard totals calculated:', totals);
      
      // ENHANCED: Response data with assignment metrics
      const responseData = {
        totals,
        assignment_metrics: assignmentStats[0] || {
          total_requests: 0,
          assigned_requests: 0,
          unassigned_requests: 0,
          admins_with_assignments: 0,
          assignment_rate: 0
        },
        performance_metrics: performanceStats[0] || {
          total_active_admins: 0,
          avg_completion_rate: 0,
          avg_response_time: 0
        },
        department: isPureSuperAdmin ? 'ALL' : department,
        is_pure_super_admin: isPureSuperAdmin,
        admin_info: {
          username: req.admin.username,
          department: req.admin.department,
          is_super_admin: req.admin.is_super_admin
        },
        data_source: 'direct_queries_no_views', // Indicate this uses direct queries
        version: '3.0_no_views'
      };
      
      console.log('✅ FIXED Dashboard response prepared:', {
        totals: responseData.totals,
        assignment_rate: responseData.assignment_metrics.assignment_rate,
        avg_completion_rate: responseData.performance_metrics.avg_completion_rate,
        department: responseData.department
      });
      
      res.json({
        success: true,
        data: responseData,
        message: 'Dashboard data loaded successfully (Direct Queries)',
        version: '3.0_no_views'
      });
      
    } catch (error) {
      console.error('❌ FIXED Dashboard data error:', {
        message: error.message,
        stack: error.stack,
        sql: error.sql,
        sqlMessage: error.sqlMessage,
        admin: req.admin?.username
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard data',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        debug: process.env.NODE_ENV === 'development' ? {
          sqlError: error.sqlMessage,
          admin: req.admin?.username,
          department: req.admin?.department
        } : undefined
      });
    }
  }
);

// GET /api/admin-auth/rbac/roles - Get all roles 
router.get('/rbac/roles', 
  authenticateAdmin, 
  requirePermission('users', 'view'),
  async (req, res) => {
    try {
      console.log(' Fetching all roles...');
      
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

      console.log(' Permission creation request:', {
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
      const { status, include_unassigned } = req.query;
      
      console.log(' FIXED: Fetching admin requests:', {
        adminId: req.admin.admin_id,
        username: req.admin.username,
        department: isPureSuperAdmin ? 'ALL' : department,
        isPureSuperAdmin,
        requestedStatus: status
      });
     
      // FIXED: Ensure all necessary columns are selected
      let query = `
        SELECT 
          gr.request_id,
          gr.student_id,
          gr.assigned_admin_id,  -- ⭐ THIS IS CRITICAL
          gr.assigned_at,        -- ⭐ THIS IS CRITICAL
          gr.assignment_method,  -- ⭐ THIS IS CRITICAL
          gr.content,
          gr.status,
          COALESCE(gr.priority, 'Medium') as priority,
          gr.submitted_at,
          gr.updated_at,
          gr.resolved_at,
          gr.rejected_at,
          gr.rejection_reason,
          rt.type_name,
          rt.category,
          s.name as student_name,
          s.student_number,
          s.email as student_email,
          COUNT(a.attachment_id) as attachment_count,
          
          -- ⭐ ASSIGNED ADMIN INFO
          assigned_admin.full_name as assigned_admin_name,
          assigned_admin.username as assigned_admin_username
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        JOIN students s ON gr.student_id = s.student_id
        LEFT JOIN attachments a ON gr.request_id = a.request_id
        LEFT JOIN admin_users assigned_admin ON gr.assigned_admin_id = assigned_admin.admin_id
      `;

      const params = [];
      const conditions = [];

      // FIXED: Department filtering for non-super admins
      if (!isPureSuperAdmin && department) {
        conditions.push('rt.category = ?');
        params.push(department);
      }

      // FIXED: Status filtering
      if (status && status !== 'all') {
        conditions.push('gr.status = ?');
        params.push(status);
      }

      // FIXED: Include unassigned filter if requested
      if (include_unassigned === 'true') {
        // Don't add any assignment filters - show all including unassigned
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

      console.log(' FIXED: Executing query:', query.substring(0, 200) + '...');
      console.log(' FIXED: Query params:', params);

      const [requests] = await pool.execute(query, params);
      
      console.log(' FIXED: Query results:', {
        totalFound: requests.length,
        sampleRequest: requests[0] ? {
          id: requests[0].request_id,
          status: requests[0].status,
          hasAssignedAdmin: !!requests[0].assigned_admin_id,
          assignedTo: requests[0].assigned_admin_name
        } : 'No requests found'
      });
      
      // FIXED: Enhanced response with debugging info
      res.json({
        success: true,
        data: requests,
        meta: {
          total: requests.length,
          department: isPureSuperAdmin ? 'ALL' : department,
          filter: status || 'all',
          is_pure_super_admin: isPureSuperAdmin,
          admin_info: {
            admin_id: req.admin.admin_id,
            username: req.admin.username,
            department: req.admin.department,
            is_super_admin: req.admin.is_super_admin
          },
          query_debug: {
            had_conditions: conditions.length > 0,
            conditions: conditions,
            params: params
          }
        }
      });

    } catch (error) {
      console.error('❌ FIXED: Get requests error:', {
        message: error.message,
        stack: error.stack,
        sql: error.sql,
        sqlMessage: error.sqlMessage,
        admin: req.admin?.username
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch requests',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        debug: process.env.NODE_ENV === 'development' ? {
          admin: req.admin?.username,
          department: req.admin?.department,
          error_type: error.name
        } : undefined
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
// backend/routes/adminAuth.js - Enhanced Statistics Endpoints

// GET /api/admin-auth/statistics/admins - Comprehensive admin statistics
// backend/routes/adminAuth.js - Fixed statistics endpoint

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
      
      console.log('📊 Assignment-based statistics request:', { 
        period, 
        targetDepartment, 
        isPureSuperAdmin,
        adminId: req.admin.admin_id
      });

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      // 1. Overview Statistics (Assignment-based)
      const overview = await getAssignmentBasedOverview(targetDepartment, startDate, endDate);
      
      // 2. Detailed Admin Performance (Assignment-focused)
      const detailedAdmins = await getAssignmentBasedAdminStats(targetDepartment, startDate, endDate);
      
      // 3. Department Breakdown (Super Admin only)
      let departmentBreakdown = [];
      if (isPureSuperAdmin) {
        departmentBreakdown = await getAssignmentBasedDepartmentStats(startDate, endDate);
      }
      
      // 4. Assignment Analytics
      const assignmentAnalytics = await getAssignmentAnalytics(targetDepartment, startDate, endDate);
      
      // 5. Workload Distribution
      const workloadDistribution = await getCurrentWorkloadDistribution(targetDepartment);

      const response = {
        success: true,
        data: {
          overview,
          detailed_admins: detailedAdmins,
          department_breakdown: departmentBreakdown,
          assignment_analytics: assignmentAnalytics,
          workload_distribution: workloadDistribution,
          meta: {
            period: parseInt(period),
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            department: targetDepartment || 'ALL',
            is_super_admin: isPureSuperAdmin,
            generated_at: new Date().toISOString(),
            data_source: 'assignment_based_tracking',
            version: '2.0_assignment_based',
            total_admins: detailedAdmins.length,
            active_admins: detailedAdmins.filter(a => a.has_assignments).length
          }
        },
        message: 'Assignment-based statistics loaded successfully',
        version: '2.0_assignment_based'
      };

      console.log('✅ Assignment-based statistics generated:', {
        overview: response.data.overview,
        admin_count: response.data.detailed_admins.length,
        assignment_rate: response.data.overview.assignment_rate
      });

      res.json(response);

    } catch (error) {
      console.error('❌ Assignment-based statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch assignment-based admin statistics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        version: '2.0_assignment_based'
      });
    }
  }
);


// HELPER FUNCTIONS FOR STATISTICS

async function getAssignmentBasedOverview(targetDepartment, startDate, endDate) {
  console.log('📊 Generating assignment-based overview statistics...');
  
  let departmentCondition = '';
  let params = [startDate, endDate];
  
  if (targetDepartment) {
    departmentCondition = ' AND rt.category = ?';
    params.push(targetDepartment);
  }

  // 1. Admin Statistics
  const [adminStats] = await pool.execute(`
    SELECT 
      COUNT(DISTINCT au.admin_id) as total_admins,
      COUNT(DISTINCT CASE WHEN au.is_active = TRUE THEN au.admin_id END) as active_admins
    FROM admin_users au
    WHERE au.is_active = TRUE 
    ${targetDepartment ? 'AND au.department = ?' : ''}
  `, targetDepartment ? [targetDepartment] : []);

  // 2. Assignment-Based Request Statistics
  const [requestStats] = await pool.execute(`
    SELECT 
      COUNT(DISTINCT gr.request_id) as total_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as total_completed,
      COUNT(DISTINCT CASE WHEN gr.status = 'Pending' THEN gr.request_id END) as total_pending,
      COUNT(DISTINCT CASE WHEN gr.status = 'Informed' THEN gr.request_id END) as total_informed,
      COUNT(DISTINCT CASE WHEN gr.status = 'Rejected' THEN gr.request_id END) as total_rejected,
      COUNT(DISTINCT gr.assigned_admin_id) as admins_with_assignments,
      COUNT(DISTINCT CASE WHEN gr.assigned_admin_id IS NULL THEN gr.request_id END) as unassigned_requests
    FROM guidance_requests gr
    JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE gr.submitted_at BETWEEN ? AND ? ${departmentCondition}
  `, params);

  // 3. Response Statistics (Supplementary)
  const [responseStats] = await pool.execute(`
    SELECT 
      COUNT(DISTINCT ar.response_id) as total_responses,
      COUNT(DISTINCT ar.admin_id) as responding_admins,
      ROUND(AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)), 2) as avg_response_time_hours
    FROM admin_responses ar
    JOIN guidance_requests gr ON ar.request_id = gr.request_id
    JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE ar.created_at BETWEEN ? AND ? ${departmentCondition}
  `, params);

  // Combine statistics
  const overview = {
    ...adminStats[0],
    ...requestStats[0],
    total_responses: responseStats[0].total_responses || 0,
    responding_admins: responseStats[0].responding_admins || 0,
    avg_response_time_hours: responseStats[0].avg_response_time_hours || 0
  };
  
  // Calculate derived metrics
  overview.completion_rate = overview.total_requests > 0 ? 
    Math.round((overview.total_completed / overview.total_requests) * 100) : 0;
  
  overview.assignment_rate = overview.total_requests > 0 ? 
    Math.round(((overview.total_requests - overview.unassigned_requests) / overview.total_requests) * 100) : 0;
  
  overview.utilization_rate = overview.total_admins > 0 ? 
    Math.round((overview.admins_with_assignments / overview.total_admins) * 100) : 0;
  
  overview.avg_requests_per_admin = overview.admins_with_assignments > 0 ? 
    Math.round((overview.total_requests / overview.admins_with_assignments) * 10) / 10 : 0;
  
  overview.response_coverage = overview.total_requests > 0 ? 
    Math.round((overview.total_responses / overview.total_requests) * 100) : 0;

  console.log('✅ Assignment-based overview generated:', overview);
  return overview;
}
async function getCurrentWorkloadDistribution(targetDepartment) {
  console.log('📊 Generating current workload distribution...');
  
  let query = `
    SELECT 
      au.admin_id,
      au.full_name,
      au.department,
      COUNT(CASE WHEN gr.status IN ('Pending', 'Informed') THEN 1 END) as current_workload,
      COUNT(gr.request_id) as total_assigned,
      COUNT(CASE WHEN gr.status = 'Completed' THEN 1 END) as completed_count,
      MAX(gr.assigned_at) as last_assignment,
      CASE 
        WHEN COUNT(gr.request_id) >= 50 THEN 'High'
        WHEN COUNT(gr.request_id) >= 20 THEN 'Medium'
        WHEN COUNT(gr.request_id) > 0 THEN 'Low'
        ELSE 'Inactive'
      END as workload_category
    FROM admin_users au
    LEFT JOIN guidance_requests gr ON au.admin_id = gr.assigned_admin_id
    WHERE au.is_active = TRUE
  `;
  
  const params = [];
  if (targetDepartment) {
    query += ' AND au.department = ?';
    params.push(targetDepartment);
  }
  
  query += `
    GROUP BY au.admin_id, au.full_name, au.department
    ORDER BY current_workload DESC, total_assigned DESC, au.full_name
  `;
  
  const [workload] = await pool.execute(query, params);
  return workload;
}


async function getAssignmentAnalytics(targetDepartment, startDate, endDate) {
  console.log('📊 Generating assignment analytics...');
  
  let departmentCondition = '';
  let params = [startDate, endDate];
  
  if (targetDepartment) {
    departmentCondition = ' AND rt.category = ?';
    params.push(targetDepartment);
  }

  const [analytics] = await pool.execute(`
    SELECT 
      COUNT(*) as total_requests,
      COUNT(assigned_admin_id) as assigned_requests,
      COUNT(*) - COUNT(assigned_admin_id) as unassigned_requests,
      COUNT(DISTINCT assigned_admin_id) as admins_receiving_assignments,
      COUNT(CASE WHEN assignment_method = 'auto' THEN 1 END) as auto_assignments,
      COUNT(CASE WHEN assignment_method = 'manual' THEN 1 END) as manual_assignments,
      ROUND(AVG(TIMESTAMPDIFF(HOUR, submitted_at, assigned_at)), 2) as avg_assignment_delay_hours,
      MIN(assigned_at) as first_assignment_date,
      MAX(assigned_at) as last_assignment_date
    FROM guidance_requests gr
    JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE gr.submitted_at BETWEEN ? AND ? ${departmentCondition}
  `, params);

  const result = analytics[0];
  result.assignment_rate = result.total_requests > 0 ? 
    Math.round((result.assigned_requests / result.total_requests) * 100) : 0;
  
  result.auto_assignment_rate = result.assigned_requests > 0 ? 
    Math.round((result.auto_assignments / result.assigned_requests) * 100) : 0;

  return result;
}

async function getAssignmentBasedDepartmentStats(startDate, endDate) {
  console.log('📊 Generating assignment-based department breakdown...');
  
  const [departments] = await pool.execute(`
    SELECT 
      rt.category as department,
      COUNT(DISTINCT au.admin_id) as admin_count,
      COUNT(DISTINCT gr.request_id) as total_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as completed_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Pending' THEN gr.request_id END) as pending_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Informed' THEN gr.request_id END) as informed_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Rejected' THEN gr.request_id END) as rejected_requests,
      COUNT(DISTINCT ar.response_id) as total_responses,
      COUNT(DISTINCT gr.assigned_admin_id) as admins_with_assignments,
      COUNT(DISTINCT CASE WHEN gr.assigned_admin_id IS NULL THEN gr.request_id END) as unassigned_requests,
      
      ROUND(AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)), 2) as avg_response_time,
      
      ROUND(CASE 
        WHEN COUNT(DISTINCT gr.request_id) > 0 THEN
          (COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) * 100.0 / 
           COUNT(DISTINCT gr.request_id))
        ELSE 0
      END, 1) as completion_rate,
      
      ROUND(COUNT(DISTINCT gr.request_id) * 1.0 / NULLIF(COUNT(DISTINCT au.admin_id), 0), 1) as avg_requests_per_admin
      
    FROM request_types rt
    LEFT JOIN guidance_requests gr ON rt.type_id = gr.type_id 
      AND gr.submitted_at BETWEEN ? AND ?
    LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
    LEFT JOIN admin_users au ON rt.category = au.department AND au.is_active = TRUE
    GROUP BY rt.category
    HAVING total_requests > 0 OR admin_count > 0
    ORDER BY completion_rate DESC, total_requests DESC
  `, [startDate, endDate]);

  const enhancedDepartments = departments.map(dept => {
    let performanceScore = 0;
    
    if (dept.total_requests > 0) {
      performanceScore = (dept.completion_rate * 0.6) + 
                        (Math.max(0, 100 - ((dept.avg_response_time || 0) * 2)) * 0.4);
    }
    
    const assignmentRate = dept.total_requests > 0 ? 
      Math.round(((dept.total_requests - dept.unassigned_requests) / dept.total_requests) * 100) : 100;
    
    return {
      ...dept,
      performance_score: Math.round(performanceScore),
      assignment_rate: assignmentRate,
      utilization_rate: dept.admin_count > 0 ? 
        Math.round((dept.admins_with_assignments / dept.admin_count) * 100) : 0
    };
  });

  console.log(`✅ Assignment-based department breakdown for ${enhancedDepartments.length} departments`);
  return enhancedDepartments;
}

async function getAssignmentBasedAdminStats(targetDepartment, startDate, endDate) {
  console.log('📊 Generating assignment-based admin statistics...');
  
  let query = `
    SELECT 
      au.admin_id,
      au.username,
      au.full_name,
      au.name,
      au.email,
      au.department,
      au.is_super_admin,
      au.is_active,
      au.created_at as admin_since,
      
      -- ASSIGNMENT-BASED STATISTICS (PRIMARY DATA SOURCE)
      COUNT(DISTINCT gr.request_id) as total_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as completed_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Pending' THEN gr.request_id END) as pending_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Informed' THEN gr.request_id END) as informed_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Rejected' THEN gr.request_id END) as rejected_requests,
      
      -- ASSIGNMENT TRACKING
      MIN(gr.assigned_at) as first_assignment,
      MAX(gr.assigned_at) as last_assignment,
      COUNT(DISTINCT CASE WHEN gr.assignment_method = 'auto' THEN gr.request_id END) as auto_assigned,
      COUNT(DISTINCT CASE WHEN gr.assignment_method = 'manual' THEN gr.request_id END) as manual_assigned,
      
      -- RESPONSE STATISTICS (SUPPLEMENTARY)
      COUNT(DISTINCT ar.response_id) as total_responses,
      COUNT(DISTINCT CASE WHEN ar.created_at BETWEEN ? AND ? THEN ar.response_id END) as period_responses,
      
      -- PERFORMANCE METRICS
      ROUND(
        CASE 
          WHEN COUNT(DISTINCT gr.request_id) > 0 THEN
            (COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) * 100.0 / 
             COUNT(DISTINCT gr.request_id))
          ELSE 0
        END, 1
      ) as completion_rate,
      
      ROUND(AVG(CASE 
        WHEN TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at) IS NOT NULL 
        THEN TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)
        ELSE NULL
      END), 2) as avg_response_time_hours,
      
      -- ACTIVITY METRICS
      MIN(ar.created_at) as first_activity,
      MAX(ar.created_at) as last_activity
      
    FROM admin_users au
    LEFT JOIN guidance_requests gr ON au.admin_id = gr.assigned_admin_id 
      AND gr.submitted_at BETWEEN ? AND ?
    LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id AND ar.admin_id = au.admin_id
    WHERE au.is_active = TRUE
  `;

  const params = [
    startDate, // For period_responses CASE statement
    endDate,   // For period_responses CASE statement
    startDate, // For gr.submitted_at filter
    endDate    // For gr.submitted_at filter
  ];

  if (targetDepartment) {
    query += ' AND au.department = ?';
    params.push(targetDepartment);
  }

  query += `
    GROUP BY 
      au.admin_id, 
      au.username, 
      au.full_name, 
      au.name, 
      au.email, 
      au.department, 
      au.is_super_admin, 
      au.is_active, 
      au.created_at
    ORDER BY total_requests DESC, au.full_name
  `;

  console.log('📊 Executing assignment-based query...');
  const [adminStats] = await pool.execute(query, params);

  // Enhanced performance score calculation
  const enhancedAdmins = adminStats.map(admin => {
    const completionRate = admin.completion_rate || 0;
    const totalRequests = admin.total_requests || 0;
    const totalResponses = admin.total_responses || 0;
    const avgResponseTime = admin.avg_response_time_hours || 0;

    // PERFORMANCE SCORE CALCULATION
    let performanceScore = 0;
    
    if (totalRequests > 0) {
      // Completion rate: 40% weight
      performanceScore += (completionRate * 0.4);
      
      // Response time: 30% weight (inverted - faster is better)
      if (avgResponseTime > 0) {
        const responseTimeScore = Math.max(0, 100 - (avgResponseTime * 2));
        performanceScore += (responseTimeScore * 0.3);
      } else {
        performanceScore += 30; // Default good score if no response time data
      }
      
      // Activity level: 20% weight
      const activityScore = Math.min(100, totalRequests * 2); // Cap at 100
      performanceScore += (activityScore * 0.2);
      
      // Response ratio: 10% weight
      if (totalResponses > 0) {
        const responseRatio = Math.min(100, (totalResponses / totalRequests) * 100);
        performanceScore += (responseRatio * 0.1);
      }
    }

    return {
      ...admin,
      performance_score: Math.round(performanceScore),
      
      // ADDITIONAL METRICS
      efficiency_score: totalRequests > 0 && totalResponses > 0 ? 
        Math.round((totalResponses / totalRequests) * 100) : 0,
      
      workload_category: 
        totalRequests >= 50 ? 'High' :
        totalRequests >= 20 ? 'Medium' :
        totalRequests > 0 ? 'Low' : 'Inactive',
      
      has_assignments: totalRequests > 0,
      has_recent_activity: (admin.period_responses || 0) > 0,
      
      requests_per_day: totalRequests > 0 ? 
        Math.round((totalRequests / 30) * 10) / 10 : 0,
      
      assignment_period: admin.first_assignment && admin.last_assignment ? 
        Math.ceil((new Date(admin.last_assignment) - new Date(admin.first_assignment)) / (1000 * 60 * 60 * 24)) : 0
    };
  });

  console.log(`✅ Assignment-based statistics for ${enhancedAdmins.length} admins generated`);
  return enhancedAdmins;
}


async function getFixedAdminStatistics(targetDepartment, startDate, endDate) {
  console.log('📊 FIXED: Generating assignment-based admin statistics...');
  
  try {
    // Build the query with proper parameter handling
    let query = `
      SELECT 
        au.admin_id,
        au.username,
        au.full_name,
        au.name,
        au.email,
        au.department,
        au.is_super_admin,
        au.is_active,
        au.created_at as admin_since,
        
        -- ASSIGNMENT-BASED STATISTICS (FIXED)
        COUNT(DISTINCT gr.request_id) as total_requests,
        COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as completed_requests,
        COUNT(DISTINCT CASE WHEN gr.status = 'Pending' THEN gr.request_id END) as pending_requests,
        COUNT(DISTINCT CASE WHEN gr.status = 'Informed' THEN gr.request_id END) as informed_requests,
        COUNT(DISTINCT CASE WHEN gr.status = 'Rejected' THEN gr.request_id END) as rejected_requests,
        
        -- ASSIGNMENT TRACKING
        MIN(gr.assigned_at) as first_assignment,
        MAX(gr.assigned_at) as last_assignment,
        COUNT(DISTINCT CASE WHEN gr.assignment_method = 'auto' THEN gr.request_id END) as auto_assigned,
        COUNT(DISTINCT CASE WHEN gr.assignment_method = 'manual' THEN gr.request_id END) as manual_assigned,
        
        -- RESPONSE STATISTICS  
        COUNT(DISTINCT ar.response_id) as total_responses,
        COUNT(DISTINCT CASE WHEN ar.created_at BETWEEN ? AND ? THEN ar.response_id END) as period_responses,
        
        -- PERFORMANCE METRICS (FIXED)
        ROUND(
          CASE 
            WHEN COUNT(DISTINCT gr.request_id) > 0 THEN
              (COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) * 100.0 / 
               COUNT(DISTINCT gr.request_id))
            ELSE 0
          END, 1
        ) as completion_rate,
        
        ROUND(AVG(CASE 
          WHEN TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at) IS NOT NULL 
          THEN TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)
          ELSE NULL
        END), 2) as avg_response_time_hours,
        
        -- WORKLOAD METRICS
        aws.current_pending,
        aws.current_informed,
        aws.workload_score,
        
        -- ACTIVITY METRICS
        MIN(ar.created_at) as first_activity,
        MAX(ar.created_at) as last_activity
        
      FROM admin_users au
      LEFT JOIN guidance_requests gr ON au.admin_id = gr.assigned_admin_id 
        AND gr.submitted_at BETWEEN ? AND ?
      LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id AND ar.admin_id = au.admin_id
      LEFT JOIN admin_workload_stats aws ON au.admin_id = aws.admin_id
      WHERE au.is_active = TRUE
    `;

    // Build parameters array correctly
    const params = [
      startDate, // For period_responses CASE statement
      endDate,   // For period_responses CASE statement
      startDate, // For gr.submitted_at filter
      endDate    // For gr.submitted_at filter
    ];

    // Add department condition if specified
    if (targetDepartment) {
      query += ' AND au.department = ?';
      params.push(targetDepartment);
    }

    // Add GROUP BY and ORDER BY
    query += `
      GROUP BY 
        au.admin_id, 
        au.username, 
        au.full_name, 
        au.name, 
        au.email, 
        au.department, 
        au.is_super_admin, 
        au.is_active, 
        au.created_at, 
        aws.current_pending, 
        aws.current_informed, 
        aws.workload_score
      ORDER BY total_requests DESC, au.full_name
    `;

    console.log('📊 Executing query with params:', {
      paramCount: params.length,
      startDate: startDate,
      endDate: endDate,
      department: targetDepartment || 'ALL'
    });

    // Execute the query
    const [adminStats] = await pool.execute(query, params);

    console.log(`✅ FIXED: Retrieved ${adminStats.length} admin records`);

    // ENHANCED: Performance score calculation
    const enhancedAdmins = adminStats.map(admin => {
      const completionRate = admin.completion_rate || 0;
      const totalRequests = admin.total_requests || 0;
      const totalResponses = admin.total_responses || 0;
      const avgResponseTime = admin.avg_response_time_hours || 0;

      // IMPROVED PERFORMANCE SCORE CALCULATION
      let performanceScore = 0;
      
      if (totalRequests > 0) {
        // Completion rate: 40% weight
        performanceScore += (completionRate * 0.4);
        
        // Response time: 30% weight (inverted - faster is better)
        if (avgResponseTime > 0) {
          const responseTimeScore = Math.max(0, 100 - (avgResponseTime * 2));
          performanceScore += (responseTimeScore * 0.3);
        } else {
          performanceScore += 30; // Default good score if no response time data
        }
        
        // Activity level: 20% weight
        const activityScore = Math.min(100, totalRequests * 2); // Cap at 100
        performanceScore += (activityScore * 0.2);
        
        // Response ratio: 10% weight
        if (totalResponses > 0) {
          const responseRatio = Math.min(100, (totalResponses / totalRequests) * 100);
          performanceScore += (responseRatio * 0.1);
        }
      }

      return {
        ...admin,
        performance_score: Math.round(performanceScore),
        
        // ADDITIONAL METRICS
        efficiency_score: totalRequests > 0 && totalResponses > 0 ? 
          Math.round((totalResponses / totalRequests) * 100) : 0,
        
        workload_category: 
          totalRequests >= 50 ? 'High' :
          totalRequests >= 20 ? 'Medium' :
          totalRequests > 0 ? 'Low' : 'Inactive',
        
        has_assignments: totalRequests > 0,
        has_recent_activity: (admin.period_responses || 0) > 0,
        
        requests_per_day: totalRequests > 0 ? 
          Math.round((totalRequests / 30) * 10) / 10 : 0,
        
        assignment_period: admin.first_assignment && admin.last_assignment ? 
          Math.ceil((new Date(admin.last_assignment) - new Date(admin.first_assignment)) / (1000 * 60 * 60 * 24)) : 0
      };
    });

    console.log(`✅ FIXED: Assignment-based statistics for ${enhancedAdmins.length} admins generated`);
    console.log('📊 FIXED Request distribution:', 
      enhancedAdmins.slice(0, 5).map(admin => ({ 
        name: admin.full_name, 
        assigned_requests: admin.total_requests,
        completion_rate: admin.completion_rate,
        performance_score: admin.performance_score
      }))
    );
    
    return enhancedAdmins;

  } catch (error) {
    console.error('❌ FIXED Statistics error:', {
      message: error.message,
      sql: error.sql,
      sqlMessage: error.sqlMessage,
      code: error.code
    });
    
    // Return empty array on error to prevent crash
    return [];
  }
}

async function getFixedDepartmentBreakdownStatistics(startDate, endDate) {
  console.log('📊 FIXED: Generating department breakdown with assignments...');
  
  const [departments] = await pool.execute(`
    SELECT 
      rt.category as department,
      COUNT(DISTINCT au.admin_id) as admin_count,
      COUNT(DISTINCT gr.request_id) as total_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as completed_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Pending' THEN gr.request_id END) as pending_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Informed' THEN gr.request_id END) as informed_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Rejected' THEN gr.request_id END) as rejected_requests,
      COUNT(DISTINCT ar.response_id) as total_responses,
      COUNT(DISTINCT gr.assigned_admin_id) as admins_with_assignments,
      COUNT(DISTINCT CASE WHEN gr.assigned_admin_id IS NULL THEN gr.request_id END) as unassigned_requests,
      
      ROUND(AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)), 2) as avg_response_time,
      
      ROUND(CASE 
        WHEN COUNT(DISTINCT gr.request_id) > 0 THEN
          (COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) * 100.0 / 
           COUNT(DISTINCT gr.request_id))
        ELSE 0
      END, 1) as completion_rate,
      
      ROUND(COUNT(DISTINCT gr.request_id) * 1.0 / NULLIF(COUNT(DISTINCT au.admin_id), 0), 1) as avg_requests_per_admin
      
    FROM request_types rt
    LEFT JOIN guidance_requests gr ON rt.type_id = gr.type_id 
      AND gr.submitted_at BETWEEN ? AND ?
    LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
    LEFT JOIN admin_users au ON rt.category = au.department AND au.is_active = TRUE
    GROUP BY rt.category
    HAVING total_requests > 0 OR admin_count > 0
    ORDER BY completion_rate DESC, total_requests DESC
  `, [startDate, endDate]);

  const enhancedDepartments = departments.map(dept => {
    let performanceScore = 0;
    
    if (dept.total_requests > 0) {
      performanceScore = (dept.completion_rate * 0.6) + 
                        (Math.max(0, 100 - ((dept.avg_response_time || 0) * 2)) * 0.4);
    }
    
    const assignmentRate = dept.total_requests > 0 ? 
      Math.round(((dept.total_requests - dept.unassigned_requests) / dept.total_requests) * 100) : 100;
    
    return {
      ...dept,
      performance_score: Math.round(performanceScore),
      assignment_rate: assignmentRate,
      utilization_rate: dept.admin_count > 0 ? 
        Math.round((dept.admins_with_assignments / dept.admin_count) * 100) : 0,
      workload_balance: dept.admin_count > 0 && dept.total_requests > 0 ? 
        Math.round((dept.avg_requests_per_admin / (dept.total_requests / dept.admin_count)) * 100) : 100
    };
  });

  console.log(`✅ FIXED Department breakdown for ${enhancedDepartments.length} departments`);
  return enhancedDepartments;
}

function generateUnassignedRecommendations(departmentBreakdown, overallStats) {
  const recommendations = [];

  // High unassignment rate
  if (overallStats.assignment_rate < 70) {
    recommendations.push({
      type: 'critical',
      title: 'Low Assignment Rate',
      message: `Only ${overallStats.assignment_rate}% of requests are assigned`,
      action: 'Run bulk fix for unassigned requests'
    });
  }

  // Departments without admins
  const deptsWithoutAdmins = departmentBreakdown.filter(dept => dept.available_admins === 0);
  if (deptsWithoutAdmins.length > 0) {
    recommendations.push({
      type: 'critical',
      title: 'Departments Without Admins',
      message: `${deptsWithoutAdmins.length} departments have no active admins`,
      action: 'Assign admins to these departments: ' + deptsWithoutAdmins.map(d => d.department).join(', ')
    });
  }

  // High unassigned count in specific departments
  const problematicDepts = departmentBreakdown.filter(dept => dept.unassigned_requests > 10);
  if (problematicDepts.length > 0) {
    recommendations.push({
      type: 'warning',
      title: 'High Unassigned Requests',
      message: `${problematicDepts.length} departments have >10 unassigned requests`,
      action: 'Review workload distribution in: ' + problematicDepts.map(d => d.department).join(', ')
    });
  }

  return recommendations;
}

async function getTopPerformersStatistics(detailedAdmins) {
  console.log('📊 Calculating top performers...');
  
  const topPerformers = {
    by_performance: detailedAdmins
      .filter(admin => admin.performance_score > 0)
      .sort((a, b) => b.performance_score - a.performance_score)
      .slice(0, 10)
      .map(admin => ({
        admin_id: admin.admin_id,
        full_name: admin.full_name,
        department: admin.department,
        performance_score: admin.performance_score,
        total_requests: admin.total_requests,
        completion_rate: admin.completion_rate
      })),
      
    by_volume: detailedAdmins
      .filter(admin => admin.total_requests > 0)
      .sort((a, b) => b.total_requests - a.total_requests)
      .slice(0, 10)
      .map(admin => ({
        admin_id: admin.admin_id,
        full_name: admin.full_name,
        department: admin.department,
        total_requests: admin.total_requests,
        completion_rate: admin.completion_rate,
        avg_response_time: admin.avg_response_time_hours
      })),
      
    by_response_time: detailedAdmins
      .filter(admin => admin.avg_response_time_hours > 0)
      .sort((a, b) => a.avg_response_time_hours - b.avg_response_time_hours)
      .slice(0, 10)
      .map(admin => ({
        admin_id: admin.admin_id,
        full_name: admin.full_name,
        department: admin.department,
        avg_response_time: admin.avg_response_time_hours,
        total_responses: admin.total_responses,
        total_requests: admin.total_requests
      })),
      
    by_efficiency: detailedAdmins
      .filter(admin => admin.efficiency_score > 0)
      .sort((a, b) => b.efficiency_score - a.efficiency_score)
      .slice(0, 10)
      .map(admin => ({
        admin_id: admin.admin_id,
        full_name: admin.full_name,
        department: admin.department,
        efficiency_score: admin.efficiency_score,
        total_requests: admin.total_requests,
        total_responses: admin.total_responses
      }))
  };

  console.log('✅ Top performers calculated');
  return topPerformers;
}

async function generatePerformanceInsights(detailedAdmins, targetDepartment) {
  console.log('📊 Generating performance insights...');
  
  const insights = [];
  const recommendations = [];
  
  if (detailedAdmins.length === 0) {
    return { insights, recommendations };
  }

  // Calculate team metrics
  const totalAdmins = detailedAdmins.length;
  const activeAdmins = detailedAdmins.filter(admin => admin.has_recent_activity).length;
  const highPerformers = detailedAdmins.filter(admin => admin.performance_score >= 80).length;
  const lowPerformers = detailedAdmins.filter(admin => admin.performance_score < 50).length;
  
  const avgPerformance = totalAdmins > 0 ? 
    Math.round(detailedAdmins.reduce((sum, admin) => sum + admin.performance_score, 0) / totalAdmins) : 0;
  
  const totalRequests = detailedAdmins.reduce((sum, admin) => sum + admin.total_requests, 0);
  const totalCompleted = detailedAdmins.reduce((sum, admin) => sum + admin.completed_requests, 0);
  const avgResponseTime = detailedAdmins.length > 0 ?
    detailedAdmins.reduce((sum, admin) => sum + (admin.avg_response_time_hours || 0), 0) / detailedAdmins.length : 0;

  // Generate insights based on metrics
  
  // 1. Team Performance Insights
  const highPerformerPercentage = Math.round((highPerformers / totalAdmins) * 100);
  const lowPerformerPercentage = Math.round((lowPerformers / totalAdmins) * 100);
  const utilizationRate = Math.round((activeAdmins / totalAdmins) * 100);

  if (highPerformerPercentage >= 70) {
    insights.push({
      type: 'success',
      category: 'team_performance',
      title: 'Excellent Team Performance',
      message: `${highPerformerPercentage}% of your team are high performers (80%+ score)`,
      impact: 'positive',
      priority: 'info',
      metric_value: highPerformerPercentage,
      icon: '🎉'
    });
  } else if (lowPerformerPercentage >= 30) {
    insights.push({
      type: 'warning',
      category: 'team_performance',
      title: 'Performance Improvement Needed',
      message: `${lowPerformerPercentage}% of team members need performance support`,
      impact: 'negative',
      priority: 'high',
      metric_value: lowPerformerPercentage,
      icon: '⚠️'
    });
    
    recommendations.push({
      category: 'training',
      priority: 'high',
      title: 'Performance Improvement Program',
      description: 'Implement targeted training for underperforming team members',
      action_items: [
        'Schedule one-on-one performance reviews',
        'Provide additional training resources',
        'Set up mentoring with high performers',
        'Create performance improvement plans'
      ],
      estimated_impact: 'High',
      estimated_effort: 'Medium',
      timeline: '2-4 weeks'
    });
  }

  // 2. Workload Analysis
  const avgRequestsPerAdmin = totalAdmins > 0 ? Math.round(totalRequests / totalAdmins) : 0;
  
  if (avgRequestsPerAdmin > 100) {
    insights.push({
      type: 'warning',
      category: 'workload',
      title: 'High Workload Detected',
      message: `Average ${avgRequestsPerAdmin} requests per admin - risk of burnout`,
      impact: 'negative',
      priority: 'medium',
      metric_value: avgRequestsPerAdmin,
      icon: '📈'
    });
    
    recommendations.push({
      category: 'resource_management',
      priority: 'medium',
      title: 'Workload Redistribution',
      description: 'Consider workload balancing and additional staffing',
      action_items: [
        'Analyze workload distribution across team',
        'Consider hiring additional staff',
        'Implement workload balancing strategies',
        'Monitor admin stress levels'
      ],
      estimated_impact: 'High',
      estimated_effort: 'High',
      timeline: '4-8 weeks'
    });
  } else if (avgRequestsPerAdmin < 10) {
    insights.push({
      type: 'info',
      category: 'workload',
      title: 'Low Activity Period',
      message: `Average ${avgRequestsPerAdmin} requests per admin - consider cross-training`,
      impact: 'neutral',
      priority: 'low',
      metric_value: avgRequestsPerAdmin,
      icon: '📉'
    });
  }

  // 3. Response Time Analysis
  if (avgResponseTime > 48) {
    insights.push({
      type: 'error',
      category: 'response_time',
      title: 'Slow Response Times',
      message: `Average response time is ${Math.round(avgResponseTime)} hours`,
      impact: 'negative',
      priority: 'high',
      metric_value: Math.round(avgResponseTime),
      icon: '🐌'
    });
    
    recommendations.push({
      category: 'process_improvement',
      priority: 'high',
      title: 'Response Time Optimization',
      description: 'Implement response time targets and monitoring',
      action_items: [
        'Set response time SLA targets',
        'Implement real-time monitoring dashboard',
        'Create escalation procedures',
        'Optimize workflow processes'
      ],
      estimated_impact: 'High',
      estimated_effort: 'Medium',
      timeline: '2-3 weeks'
    });
  } else if (avgResponseTime < 4) {
    insights.push({
      type: 'success',
      category: 'response_time',
      title: 'Excellent Response Times',
      message: `Average response time is only ${Math.round(avgResponseTime)} hours`,
      impact: 'positive',
      priority: 'info',
      metric_value: Math.round(avgResponseTime),
      icon: '⚡'
    });
  }

  // 4. Team Utilization
  if (utilizationRate < 60) {
    insights.push({
      type: 'info',
      category: 'utilization',
      title: 'Low Team Utilization',
      message: `Only ${utilizationRate}% of team is actively handling requests`,
      impact: 'neutral',
      priority: 'medium',
      metric_value: utilizationRate,
      icon: '👥'
    });
    
    recommendations.push({
      category: 'team_management',
      priority: 'medium',
      title: 'Improve Team Engagement',
      description: 'Increase team utilization and engagement',
      action_items: [
        'Review workload distribution',
        'Implement rotation schedules',
        'Provide additional responsibilities',
        'Cross-train team members'
      ],
      estimated_impact: 'Medium',
      estimated_effort: 'Low',
      timeline: '1-2 weeks'
    });
  }

  // 5. Completion Rate Analysis
  const completionRate = totalRequests > 0 ? Math.round((totalCompleted / totalRequests) * 100) : 0;
  
  if (completionRate >= 90) {
    insights.push({
      type: 'success',
      category: 'completion',
      title: 'High Success Rate',
      message: `${completionRate}% of requests are successfully completed`,
      impact: 'positive',
      priority: 'info',
      metric_value: completionRate,
      icon: '✅'
    });
  } else if (completionRate < 70) {
    insights.push({
      type: 'warning',
      category: 'completion',
      title: 'Low Completion Rate',
      message: `Only ${completionRate}% of requests are completed`,
      impact: 'negative',
      priority: 'high',
      metric_value: completionRate,
      icon: '📉'
    });
    
    recommendations.push({
      category: 'quality_improvement',
      priority: 'high',
      title: 'Completion Rate Enhancement',
      description: 'Investigate and improve request completion processes',
      action_items: [
        'Analyze incomplete request patterns',
        'Identify common blocking issues',
        'Improve documentation and processes',
        'Provide additional training on completion procedures'
      ],
      estimated_impact: 'High',
      estimated_effort: 'Medium',
      timeline: '3-4 weeks'
    });
  }

  console.log(`✅ Generated ${insights.length} insights and ${recommendations.length} recommendations`);
  return { insights, recommendations };
}

async function getWorkloadAnalysis(detailedAdmins, targetDepartment) {
  console.log('📊 Generating workload analysis...');
  
  const analysis = {
    overall_metrics: {
      total_admins: detailedAdmins.length,
      active_admins: detailedAdmins.filter(admin => admin.has_recent_activity).length,
      total_requests: detailedAdmins.reduce((sum, admin) => sum + admin.total_requests, 0),
      avg_requests_per_admin: 0,
      workload_distribution: {
        high: 0,    // 50+ requests
        medium: 0,  // 20-49 requests  
        low: 0,     // 1-19 requests
        inactive: 0 // 0 requests
      }
    },
    performance_correlation: {
      high_workload_performance: 0,
      medium_workload_performance: 0,
      low_workload_performance: 0
    },
    recommendations: []
  };

  if (detailedAdmins.length === 0) {
    return analysis;
  }

  // Calculate overall metrics
  analysis.overall_metrics.avg_requests_per_admin = 
    Math.round(analysis.overall_metrics.total_requests / detailedAdmins.length);

  // Categorize workloads
  detailedAdmins.forEach(admin => {
    const category = admin.workload_category.toLowerCase();
    if (analysis.overall_metrics.workload_distribution[category] !== undefined) {
      analysis.overall_metrics.workload_distribution[category]++;
    }
  });

  // Performance correlation analysis
  const highWorkloadAdmins = detailedAdmins.filter(admin => admin.workload_category === 'High');
  const mediumWorkloadAdmins = detailedAdmins.filter(admin => admin.workload_category === 'Medium');
  const lowWorkloadAdmins = detailedAdmins.filter(admin => admin.workload_category === 'Low');

  analysis.performance_correlation.high_workload_performance = highWorkloadAdmins.length > 0 ?
    Math.round(highWorkloadAdmins.reduce((sum, admin) => sum + admin.performance_score, 0) / highWorkloadAdmins.length) : 0;
    
  analysis.performance_correlation.medium_workload_performance = mediumWorkloadAdmins.length > 0 ?
    Math.round(mediumWorkloadAdmins.reduce((sum, admin) => sum + admin.performance_score, 0) / mediumWorkloadAdmins.length) : 0;
    
  analysis.performance_correlation.low_workload_performance = lowWorkloadAdmins.length > 0 ?
    Math.round(lowWorkloadAdmins.reduce((sum, admin) => sum + admin.performance_score, 0) / lowWorkloadAdmins.length) : 0;

  // Generate workload recommendations
  const highWorkloadPercentage = Math.round((analysis.overall_metrics.workload_distribution.high / detailedAdmins.length) * 100);
  const inactivePercentage = Math.round((analysis.overall_metrics.workload_distribution.inactive / detailedAdmins.length) * 100);

  if (highWorkloadPercentage > 30) {
    analysis.recommendations.push({
      type: 'workload_balancing',
      priority: 'high',
      message: `${highWorkloadPercentage}% of admins have high workload - consider redistribution`,
      action: 'Implement workload balancing strategies'
    });
  }

  if (inactivePercentage > 25) {
    analysis.recommendations.push({
      type: 'utilization_improvement',
      priority: 'medium',
      message: `${inactivePercentage}% of admins are inactive - improve task distribution`,
      action: 'Review role assignments and provide additional responsibilities'
    });
  }

  console.log('✅ Workload analysis completed');
  return analysis;
}

async function getTrendAnalysis(targetDepartment, startDate, endDate) {
  console.log('📊 Generating trend analysis...');
  
  let departmentCondition = '';
  let params = [startDate, endDate];
  
  if (targetDepartment) {
    departmentCondition = ' AND rt.category = ?';
    params.push(targetDepartment);
  }

  // Weekly trend data
  const [weeklyData] = await pool.execute(`
    SELECT 
      WEEK(gr.submitted_at) as week_number,
      DATE(DATE_SUB(gr.submitted_at, INTERVAL WEEKDAY(gr.submitted_at) DAY)) as week_start,
      COUNT(DISTINCT gr.request_id) as requests,
      COUNT(DISTINCT ar.response_id) as responses,
      COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as completed,
      ROUND(AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)), 2) as avg_response_time,
      COUNT(DISTINCT ar.admin_id) as active_admins
    FROM guidance_requests gr
    LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
    LEFT JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE gr.submitted_at BETWEEN ? AND ? ${departmentCondition}
    GROUP BY WEEK(gr.submitted_at), week_start
    ORDER BY week_start
  `, params);

  // Daily activity patterns (hour of day)
  const [hourlyPatterns] = await pool.execute(`
    SELECT 
      HOUR(ar.created_at) as hour,
      COUNT(DISTINCT ar.response_id) as responses,
      COUNT(DISTINCT ar.admin_id) as active_admins,
      ROUND(AVG(TIMESTAMPDIFF(MINUTE, gr.submitted_at, ar.created_at)), 0) as avg_response_minutes
    FROM admin_responses ar
    JOIN guidance_requests gr ON ar.request_id = gr.request_id
    JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE ar.created_at BETWEEN ? AND ? ${departmentCondition}
    GROUP BY HOUR(ar.created_at)
    ORDER BY hour
  `, params);

  // Request type trends
  const [requestTypeData] = await pool.execute(`
    SELECT 
      rt.type_name,
      rt.category,
      COUNT(DISTINCT gr.request_id) as count,
      ROUND(COUNT(DISTINCT gr.request_id) * 100.0 / 
        (SELECT COUNT(*) FROM guidance_requests gr2 
         JOIN request_types rt2 ON gr2.type_id = rt2.type_id 
         WHERE gr2.submitted_at BETWEEN ? AND ? ${departmentCondition.replace('rt.', 'rt2.')}), 1) as percentage,
      COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as completed,
      ROUND(AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, 
        COALESCE(gr.resolved_at, gr.updated_at))), 2) as avg_completion_time
    FROM request_types rt
    LEFT JOIN guidance_requests gr ON rt.type_id = gr.type_id 
      AND gr.submitted_at BETWEEN ? AND ?
    WHERE 1=1 ${departmentCondition}
    GROUP BY rt.type_id, rt.type_name, rt.category
    HAVING count > 0
    ORDER BY count DESC
    LIMIT 15
  `, [...params, ...params, ...params.slice(2)]);

  // Performance trends over time
  const [performanceTrends] = await pool.execute(`
    SELECT 
      DATE(ar.created_at) as date,
      COUNT(DISTINCT ar.response_id) as daily_responses,
      COUNT(DISTINCT ar.admin_id) as daily_active_admins,
      COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as daily_completed,
      ROUND(AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)), 2) as daily_avg_response_time
    FROM admin_responses ar
    JOIN guidance_requests gr ON ar.request_id = gr.request_id
    JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE ar.created_at BETWEEN ? AND ? ${departmentCondition}
    GROUP BY DATE(ar.created_at)
    ORDER BY date
  `, params);

  const trends = {
    weekly_data: weeklyData.map(week => ({
      ...week,
      completion_rate: week.requests > 0 ? Math.round((week.completed / week.requests) * 100) : 0,
      response_efficiency: week.responses > 0 ? Math.round((week.requests / week.responses) * 100) : 0
    })),
    peak_hours: hourlyPatterns.map(hour => ({
      ...hour,
      efficiency_score: hour.avg_response_minutes < 60 ? 'high' : 
                       hour.avg_response_minutes < 240 ? 'medium' : 'low'
    })),
    request_types: requestTypeData,
    daily_performance: performanceTrends,
    summary: {
      total_weeks: weeklyData.length,
      peak_hour: hourlyPatterns.length > 0 ? 
        hourlyPatterns.reduce((max, hour) => hour.responses > max.responses ? hour : max, hourlyPatterns[0]).hour : null,
      most_common_request_type: requestTypeData.length > 0 ? requestTypeData[0].type_name : null,
      trend_direction: calculateTrendDirection(weeklyData)
    }
  };

  console.log('✅ Trend analysis completed');
  return trends;
}

async function assignRequestToAdmin(requestId, adminId, assignedBy = null, reason = 'Manual assignment') {
  console.log('📌 Assigning request to admin:', { requestId, adminId, assignedBy, reason });
  
  try {
    const [result] = await pool.execute(`
      UPDATE guidance_requests 
      SET 
        assigned_admin_id = ?,
        assigned_at = NOW(),
        handled_by = ?,
        assignment_method = 'manual'
      WHERE request_id = ?
    `, [adminId, assignedBy || adminId, requestId]);
    
    if (result.affectedRows === 0) {
      throw new Error('Request not found or could not be assigned');
    }
    
    console.log('✅ Request assigned successfully');
    return { success: true, message: 'Request assigned successfully' };
  } catch (error) {
    console.error('❌ Request assignment failed:', error);
    return { success: false, error: error.message };
  }
}

// NEW: Assignment analytics
async function getAssignmentAnalytics(targetDepartment, startDate, endDate) {
  console.log('📊 Generating assignment analytics...');
  
  let departmentCondition = '';
  let params = [startDate, endDate];
  
  if (targetDepartment) {
    departmentCondition = ' AND rt.category = ?';
    params.push(targetDepartment);
  }

  const [analytics] = await pool.execute(`
    SELECT 
      COUNT(*) as total_requests,
      COUNT(assigned_admin_id) as assigned_requests,
      COUNT(*) - COUNT(assigned_admin_id) as unassigned_requests,
      COUNT(DISTINCT assigned_admin_id) as admins_receiving_assignments,
      COUNT(CASE WHEN assignment_method = 'auto' THEN 1 END) as auto_assignments,
      COUNT(CASE WHEN assignment_method = 'manual' THEN 1 END) as manual_assignments,
      ROUND(AVG(TIMESTAMPDIFF(HOUR, submitted_at, assigned_at)), 2) as avg_assignment_delay_hours,
      MIN(assigned_at) as first_assignment_date,
      MAX(assigned_at) as last_assignment_date
    FROM guidance_requests gr
    JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE gr.submitted_at BETWEEN ? AND ? ${departmentCondition}
  `, params);

  const result = analytics[0];
  result.assignment_rate = result.total_requests > 0 ? 
    Math.round((result.assigned_requests / result.total_requests) * 100) : 0;
  
  result.auto_assignment_rate = result.assigned_requests > 0 ? 
    Math.round((result.auto_assignments / result.assigned_requests) * 100) : 0;

  return result;
}

// NEW: Workload distribution
async function getWorkloadDistribution(targetDepartment) {
  console.log('📊 Generating workload distribution...');
  
  let departmentCondition = '';
  const params = [];
  
  if (targetDepartment) {
    departmentCondition = ' WHERE au.department = ?';
    params.push(targetDepartment);
  }

  const [workload] = await pool.execute(`
    SELECT 
      au.admin_id,
      au.full_name,
      au.department,
      aws.current_pending,
      aws.current_informed,
      aws.total_assigned,
      aws.workload_score,
      aws.last_assignment,
      CASE 
        WHEN aws.total_assigned >= 50 THEN 'High'
        WHEN aws.total_assigned >= 20 THEN 'Medium'
        WHEN aws.total_assigned > 0 THEN 'Low'
        ELSE 'Inactive'
      END as workload_category
    FROM admin_users au
    LEFT JOIN admin_workload_stats aws ON au.admin_id = aws.admin_id
    ${departmentCondition}
    AND au.is_active = TRUE
    ORDER BY aws.total_assigned DESC, au.full_name
  `, params);

  return workload;
}

async function getAssignmentStatistics(department = null) {
  console.log('📊 Getting assignment statistics for:', department || 'ALL');
  
  let departmentCondition = '';
  const params = [];
  
  if (department) {
    departmentCondition = ' AND rt.category = ?';
    params.push(department);
  }
  
  const [stats] = await pool.execute(`
    SELECT 
      COUNT(DISTINCT gr.request_id) as total_requests,
      COUNT(DISTINCT CASE WHEN gr.assigned_admin_id IS NOT NULL THEN gr.request_id END) as assigned_requests,
      COUNT(DISTINCT CASE WHEN gr.assigned_admin_id IS NULL THEN gr.request_id END) as unassigned_requests,
      COUNT(DISTINCT gr.assigned_admin_id) as admins_with_assignments,
      COUNT(DISTINCT CASE WHEN gr.assignment_method = 'auto' THEN gr.request_id END) as auto_assigned,
      COUNT(DISTINCT CASE WHEN gr.assignment_method = 'manual' THEN gr.request_id END) as manual_assigned,
      ROUND(AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, gr.assigned_at)), 2) as avg_assignment_delay_hours
    FROM guidance_requests gr
    JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE 1=1 ${departmentCondition}
  `, params);
  
  const result = stats[0];
  result.assignment_rate = result.total_requests > 0 ? 
    Math.round((result.assigned_requests / result.total_requests) * 100) : 0;
  
  return result;
}

async function autoAssignNewRequest(requestId, departmentCategory) {
  console.log('🤖 Auto-assigning new request:', { requestId, departmentCategory });
  
  try {
    // En az yükü olan admin'i bul
    const [availableAdmins] = await pool.execute(`
      SELECT 
        au.admin_id,
        au.full_name,
        COUNT(gr.request_id) as current_workload
      FROM admin_users au
      LEFT JOIN guidance_requests gr ON au.admin_id = gr.assigned_admin_id 
        AND gr.status IN ('Pending', 'Informed')
      WHERE au.department = ? AND au.is_active = TRUE
      GROUP BY au.admin_id, au.full_name
      ORDER BY current_workload ASC, RAND()
      LIMIT 1
    `, [departmentCategory]);
    
    if (availableAdmins.length > 0) {
      const selectedAdmin = availableAdmins[0];
      
      const [result] = await pool.execute(`
        UPDATE guidance_requests 
        SET 
          assigned_admin_id = ?,
          assigned_at = NOW(),
          assignment_method = 'auto'
        WHERE request_id = ?
      `, [selectedAdmin.admin_id, requestId]);
      
      console.log(`✅ Request auto-assigned to ${selectedAdmin.full_name}`);
      return { 
        success: true, 
        assignedTo: selectedAdmin,
        workload: selectedAdmin.current_workload + 1
      };
    } else {
      console.log('⚠️ No available admins found for assignment');
      return { success: false, reason: 'No available admins' };
    }
  } catch (error) {
    console.error('❌ Auto-assignment failed:', error);
    return { success: false, error: error.message };
  }
}

function calculateTrendDirection(weeklyData) {
  if (weeklyData.length < 2) return 'insufficient_data';
  
  const firstHalf = weeklyData.slice(0, Math.floor(weeklyData.length / 2));
  const secondHalf = weeklyData.slice(Math.floor(weeklyData.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, week) => sum + week.requests, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, week) => sum + week.requests, 0) / secondHalf.length;
  
  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  if (changePercent > 10) return 'increasing';
  if (changePercent < -10) return 'decreasing';
  return 'stable';
}

// GET /api/admin-auth/statistics/trends - Detailed trend analysis endpoint
router.get('/statistics/trends', 
  authenticateAdmin, 
  requireAnyPermission([
    { resource: 'analytics', action: 'view_department' },
    { resource: 'analytics', action: 'view_trends' }
  ]),
  async (req, res) => {
    try {
      const { period = '90', department: filterDepartment, granularity = 'weekly' } = req.query;
      const isPureSuperAdmin = req.admin.is_super_admin && !req.admin.department;
      const targetDepartment = isPureSuperAdmin ? filterDepartment : req.admin.department;
      
      console.log('📈 Detailed trend analysis request:', { 
        period, 
        targetDepartment, 
        granularity,
        adminId: req.admin.admin_id 
      });

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      const trends = await getTrendAnalysis(targetDepartment, startDate, endDate);
      
      // Add advanced analytics
      const advancedAnalytics = await getAdvancedTrendAnalytics(targetDepartment, startDate, endDate, granularity);
      
      res.json({
        success: true,
        data: {
          ...trends,
          advanced_analytics: advancedAnalytics,
          meta: {
            period: parseInt(period),
            granularity,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            department: targetDepartment || 'ALL',
            generated_at: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error('❌ Trend analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trend analysis',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

async function getAdvancedTrendAnalytics(targetDepartment, startDate, endDate, granularity) {
  console.log('📊 Generating advanced trend analytics...');
  
  // Predictive analytics based on historical patterns
  const predictions = await generatePredictions(targetDepartment, startDate, endDate);
  
  // Seasonal analysis
  const seasonalPatterns = await analyzeSeasonalPatterns(targetDepartment, startDate, endDate);
  
  // Performance correlations
  const correlations = await analyzePerformanceCorrelations(targetDepartment, startDate, endDate);
  
  return {
    predictions,
    seasonal_patterns: seasonalPatterns,
    correlations,
    anomalies: await detectAnomalies(targetDepartment, startDate, endDate),
    forecasting: await generateForecasts(targetDepartment, startDate, endDate)
  };
}

async function generatePredictions(targetDepartment, startDate, endDate) {
  // Simple linear regression for next period prediction
  let departmentCondition = '';
  let params = [startDate, endDate];
  
  if (targetDepartment) {
    departmentCondition = ' AND rt.category = ?';
    params.push(targetDepartment);
  }

  const [historicalData] = await pool.execute(`
    SELECT 
      DATE(gr.submitted_at) as date,
      COUNT(DISTINCT gr.request_id) as daily_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as daily_completed
    FROM guidance_requests gr
    JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE gr.submitted_at BETWEEN ? AND ? ${departmentCondition}
    GROUP BY DATE(gr.submitted_at)
    ORDER BY date
  `, params);

  if (historicalData.length < 7) {
    return {
      status: 'insufficient_data',
      message: 'Need at least 7 days of data for predictions'
    };
  }

  // Calculate trend
  const avgRequestsPerDay = historicalData.reduce((sum, day) => sum + day.daily_requests, 0) / historicalData.length;
  const recentAvg = historicalData.slice(-7).reduce((sum, day) => sum + day.daily_requests, 0) / 7;
  
  const trendDirection = recentAvg > avgRequestsPerDay ? 'increasing' : 
                        recentAvg < avgRequestsPerDay ? 'decreasing' : 'stable';
  
  const changeRate = ((recentAvg - avgRequestsPerDay) / avgRequestsPerDay) * 100;

  return {
    status: 'success',
    next_week_prediction: Math.round(recentAvg * 7),
    trend_direction: trendDirection,
    change_rate: Math.round(changeRate * 10) / 10,
    confidence: historicalData.length > 30 ? 'high' : 
               historicalData.length > 14 ? 'medium' : 'low',
    avg_daily_requests: Math.round(avgRequestsPerDay),
    recent_avg_daily: Math.round(recentAvg)
  };
}

async function analyzeSeasonalPatterns(targetDepartment, startDate, endDate) {
  let departmentCondition = '';
  let params = [startDate, endDate];
  
  if (targetDepartment) {
    departmentCondition = ' AND rt.category = ?';
    params.push(targetDepartment);
  }

  const [dayOfWeekData] = await pool.execute(`
    SELECT 
      DAYOFWEEK(gr.submitted_at) as day_of_week,
      DAYNAME(gr.submitted_at) as day_name,
      COUNT(DISTINCT gr.request_id) as requests,
      COUNT(DISTINCT ar.response_id) as responses,
      ROUND(AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)), 2) as avg_response_time
    FROM guidance_requests gr
    LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
    JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE gr.submitted_at BETWEEN ? AND ? ${departmentCondition}
    GROUP BY DAYOFWEEK(gr.submitted_at), DAYNAME(gr.submitted_at)
    ORDER BY day_of_week
  `, params);

  const [monthlyData] = await pool.execute(`
    SELECT 
      MONTH(gr.submitted_at) as month,
      MONTHNAME(gr.submitted_at) as month_name,
      COUNT(DISTINCT gr.request_id) as requests,
      COUNT(DISTINCT ar.response_id) as responses
    FROM guidance_requests gr
    LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
    JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE gr.submitted_at BETWEEN ? AND ? ${departmentCondition}
    GROUP BY MONTH(gr.submitted_at), MONTHNAME(gr.submitted_at)
    ORDER BY month
  `, params);

  // Find peak days and times
  const peakDay = dayOfWeekData.length > 0 ? 
    dayOfWeekData.reduce((max, day) => day.requests > max.requests ? day : max, dayOfWeekData[0]) : null;
  
  const peakMonth = monthlyData.length > 0 ? 
    monthlyData.reduce((max, month) => month.requests > max.requests ? month : max, monthlyData[0]) : null;

  return {
    day_of_week_patterns: dayOfWeekData,
    monthly_patterns: monthlyData,
    peak_day: peakDay ? peakDay.day_name : null,
    peak_month: peakMonth ? peakMonth.month_name : null,
    weekday_vs_weekend: calculateWeekdayWeekendComparison(dayOfWeekData)
  };
}

function calculateWeekdayWeekendComparison(dayOfWeekData) {
  if (dayOfWeekData.length === 0) return null;
  
  const weekdays = dayOfWeekData.filter(day => day.day_of_week >= 2 && day.day_of_week <= 6); // Mon-Fri
  const weekends = dayOfWeekData.filter(day => day.day_of_week === 1 || day.day_of_week === 7); // Sun, Sat
  
  const weekdayAvg = weekdays.length > 0 ? 
    weekdays.reduce((sum, day) => sum + day.requests, 0) / weekdays.length : 0;
  const weekendAvg = weekends.length > 0 ? 
    weekends.reduce((sum, day) => sum + day.requests, 0) / weekends.length : 0;
  
  return {
    weekday_average: Math.round(weekdayAvg),
    weekend_average: Math.round(weekendAvg),
    ratio: weekendAvg > 0 ? Math.round((weekdayAvg / weekendAvg) * 10) / 10 : null
  };
}

async function analyzePerformanceCorrelations(targetDepartment, startDate, endDate) {
  // Analyze correlations between different metrics
  let departmentCondition = '';
  let params = [startDate, endDate];
  
  if (targetDepartment) {
    departmentCondition = ' AND au.department = ?';
    params.push(targetDepartment);
  }

  const [correlationData] = await pool.execute(`
    SELECT 
      au.admin_id,
      COUNT(DISTINCT gr.request_id) as total_requests,
      COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as completed_requests,
      COUNT(DISTINCT ar.response_id) as total_responses,
      ROUND(AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)), 2) as avg_response_time,
      DATEDIFF(MAX(ar.created_at), MIN(ar.created_at)) + 1 as active_days
    FROM admin_users au
    LEFT JOIN admin_responses ar ON au.admin_id = ar.admin_id 
      AND ar.created_at BETWEEN ? AND ?
    LEFT JOIN guidance_requests gr ON ar.request_id = gr.request_id
    WHERE au.is_active = TRUE ${departmentCondition}
    GROUP BY au.admin_id
    HAVING total_requests > 0
  `, params);

  // Calculate correlation coefficients
  const correlations = {};
  
  if (correlationData.length > 3) {
    correlations.volume_vs_response_time = calculateCorrelation(
      correlationData.map(d => d.total_requests),
      correlationData.map(d => d.avg_response_time || 0)
    );
    
    correlations.volume_vs_completion_rate = calculateCorrelation(
      correlationData.map(d => d.total_requests),
      correlationData.map(d => d.total_requests > 0 ? (d.completed_requests / d.total_requests) * 100 : 0)
    );
    
    correlations.activity_vs_efficiency = calculateCorrelation(
      correlationData.map(d => d.active_days),
      correlationData.map(d => d.total_responses > 0 ? d.total_requests / d.total_responses : 0)
    );
  }

  return {
    correlations,
    insights: generateCorrelationInsights(correlations),
    sample_size: correlationData.length
  };
}

function calculateCorrelation(x, y) {
  if (x.length !== y.length || x.length < 2) return null;
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 1000;
}

function generateCorrelationInsights(correlations) {
  const insights = [];
  
  if (correlations.volume_vs_response_time !== null) {
    if (correlations.volume_vs_response_time > 0.5) {
      insights.push({
        type: 'negative',
        message: 'High request volume correlates with slower response times',
        recommendation: 'Consider workload balancing or additional resources'
      });
    } else if (correlations.volume_vs_response_time < -0.3) {
      insights.push({
        type: 'positive',
        message: 'Experienced admins handle more requests while maintaining speed',
        recommendation: 'Leverage experienced team members for training'
      });
    }
  }
  
  if (correlations.volume_vs_completion_rate !== null) {
    if (correlations.volume_vs_completion_rate < -0.4) {
      insights.push({
        type: 'warning',
        message: 'Higher volume correlates with lower completion rates',
        recommendation: 'Monitor quality as workload increases'
      });
    }
  }
  
  return insights;
}

async function detectAnomalies(targetDepartment, startDate, endDate) {
  // Detect unusual patterns or outliers
  let departmentCondition = '';
  let params = [startDate, endDate];
  
  if (targetDepartment) {
    departmentCondition = ' AND rt.category = ?';
    params.push(targetDepartment);
  }

  const [dailyData] = await pool.execute(`
    SELECT 
      DATE(gr.submitted_at) as date,
      COUNT(DISTINCT gr.request_id) as daily_requests,
      COUNT(DISTINCT ar.response_id) as daily_responses,
      COUNT(DISTINCT ar.admin_id) as daily_active_admins
    FROM guidance_requests gr
    LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
    JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE gr.submitted_at BETWEEN ? AND ? ${departmentCondition}
    GROUP BY DATE(gr.submitted_at)
    ORDER BY date
  `, params);

  if (dailyData.length < 7) {
    return { anomalies: [], message: 'Insufficient data for anomaly detection' };
  }

  const requests = dailyData.map(d => d.daily_requests);
  const mean = requests.reduce((a, b) => a + b, 0) / requests.length;
  const stdDev = Math.sqrt(requests.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / requests.length);
  
  const anomalies = dailyData.filter(day => {
    const zScore = Math.abs((day.daily_requests - mean) / stdDev);
    return zScore > 2; // More than 2 standard deviations
  }).map(day => ({
    ...day,
    type: day.daily_requests > mean ? 'spike' : 'drop',
    severity: Math.abs((day.daily_requests - mean) / stdDev) > 3 ? 'high' : 'medium'
  }));

  return {
    anomalies,
    statistics: {
      mean: Math.round(mean),
      standard_deviation: Math.round(stdDev * 10) / 10,
      anomaly_threshold: Math.round((mean + 2 * stdDev) * 10) / 10
    }
  };
}

async function generateForecasts(targetDepartment, startDate, endDate) {
  // Simple forecasting based on historical trends
  const predictions = await generatePredictions(targetDepartment, startDate, endDate);
  
  if (predictions.status !== 'success') {
    return { status: 'insufficient_data' };
  }

  const nextWeek = predictions.next_week_prediction;
  const nextMonth = Math.round(nextWeek * 4.33); // Average weeks per month
  
  return {
    status: 'success',
    forecasts: {
      next_week: {
        requests: nextWeek,
        confidence: predictions.confidence,
        range: {
          min: Math.round(nextWeek * 0.8),
          max: Math.round(nextWeek * 1.2)
        }
      },
      next_month: {
        requests: nextMonth,
        confidence: predictions.confidence === 'high' ? 'medium' : 'low',
        range: {
          min: Math.round(nextMonth * 0.7),
          max: Math.round(nextMonth * 1.3)
        }
      }
    },
    assumptions: [
      'Based on historical trend analysis',
      'Assumes no significant external changes',
      'Confidence decreases for longer periods'
    ]
  };
}

// GET /api/admin-auth/statistics/real-time - Real-time statistics
router.get('/statistics/real-time', 
  authenticateAdmin, 
  requireAnyPermission([
    { resource: 'analytics', action: 'view_department' },
    { resource: 'analytics', action: 'view_realtime' }
  ]),
  async (req, res) => {
    try {
      const isPureSuperAdmin = req.admin.is_super_admin && !req.admin.department;
      const targetDepartment = isPureSuperAdmin ? req.query.department : req.admin.department;
      
      console.log('⚡ Real-time statistics request:', { 
        targetDepartment, 
        isPureSuperAdmin,
        adminId: req.admin.admin_id 
      });

      // Get current day statistics
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const realTimeData = await getRealTimeStatistics(targetDepartment, startOfDay, today);
      
      res.json({
        success: true,
        data: realTimeData,
        meta: {
          timestamp: new Date().toISOString(),
          department: targetDepartment || 'ALL',
          refresh_interval: 30 // seconds
        }
      });

    } catch (error) {
      console.error('❌ Real-time statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch real-time statistics'
      });
    }
  }
);

async function getRealTimeStatistics(targetDepartment, startOfDay, now) {
  let departmentCondition = '';
  let params = [startOfDay, now];
  
  if (targetDepartment) {
    departmentCondition = ' AND rt.category = ?';
    params.push(targetDepartment);
  }

  // Current day statistics
  const [todayStats] = await pool.execute(`
    SELECT 
      COUNT(DISTINCT gr.request_id) as requests_today,
      COUNT(DISTINCT CASE WHEN gr.status = 'Completed' THEN gr.request_id END) as completed_today,
      COUNT(DISTINCT CASE WHEN gr.status = 'Pending' THEN gr.request_id END) as pending_today,
      COUNT(DISTINCT ar.response_id) as responses_today,
      COUNT(DISTINCT ar.admin_id) as active_admins_today,
      ROUND(AVG(TIMESTAMPDIFF(MINUTE, gr.submitted_at, ar.created_at)), 0) as avg_response_minutes_today
    FROM guidance_requests gr
    LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
    JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE gr.submitted_at BETWEEN ? AND ? ${departmentCondition}
  `, params);

  // Last hour activity
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
  const [lastHourStats] = await pool.execute(`
    SELECT 
      COUNT(DISTINCT gr.request_id) as requests_last_hour,
      COUNT(DISTINCT ar.response_id) as responses_last_hour,
      COUNT(DISTINCT ar.admin_id) as active_admins_last_hour
    FROM guidance_requests gr
    LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
    JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE gr.submitted_at BETWEEN ? AND ? ${departmentCondition}
  `, [lastHour, now, ...params.slice(2)]);

  // Active admins right now (responded in last 15 minutes)
  const last15Minutes = new Date(now.getTime() - 15 * 60 * 1000);
  const [currentlyActive] = await pool.execute(`
    SELECT 
      COUNT(DISTINCT ar.admin_id) as currently_active_admins,
      GROUP_CONCAT(DISTINCT au.full_name SEPARATOR ', ') as active_admin_names
    FROM admin_responses ar
    JOIN admin_users au ON ar.admin_id = au.admin_id
    JOIN guidance_requests gr ON ar.request_id = gr.request_id
    JOIN request_types rt ON gr.type_id = rt.type_id
    WHERE ar.created_at BETWEEN ? AND ? ${departmentCondition}
  `, [last15Minutes, now, ...params.slice(2)]);

  return {
    current_activity: {
      timestamp: now.toISOString(),
      currently_active_admins: currentlyActive[0].currently_active_admins || 0,
      active_admin_names: currentlyActive[0].active_admin_names ? 
        currentlyActive[0].active_admin_names.split(', ') : []
    },
    today_summary: {
      requests: todayStats[0].requests_today || 0,
      completed: todayStats[0].completed_today || 0,
      pending: todayStats[0].pending_today || 0,
      responses: todayStats[0].responses_today || 0,
      active_admins: todayStats[0].active_admins_today || 0,
      avg_response_minutes: todayStats[0].avg_response_minutes_today || 0,
      completion_rate: todayStats[0].requests_today > 0 ? 
        Math.round((todayStats[0].completed_today / todayStats[0].requests_today) * 100) : 0
    },
    last_hour: {
      requests: lastHourStats[0].requests_last_hour || 0,
      responses: lastHourStats[0].responses_last_hour || 0,
      active_admins: lastHourStats[0].active_admins_last_hour || 0
    },
    system_health: {
      status: 'operational',
      response_time_status: todayStats[0].avg_response_minutes_today < 240 ? 'good' : 
                           todayStats[0].avg_response_minutes_today < 480 ? 'warning' : 'poor',
      activity_level: currentlyActive[0].currently_active_admins >= 3 ? 'high' : 
                     currentlyActive[0].currently_active_admins >= 1 ? 'medium' : 'low'
    }
  };
}

// GET /api/admin-auth/statistics/admins/export - Export admin statistics
router.get('/statistics/export', 
  authenticateAdmin, 
  requireAnyPermission([
    { resource: 'analytics', action: 'view_department' },
    { resource: 'analytics', action: 'export' }
  ]),
  async (req, res) => {
    try {
      const { 
        period = '30', 
        department: filterDepartment, 
        format = 'json',
        include_insights = 'true',
        include_trends = 'false' 
      } = req.query;
      
      const isPureSuperAdmin = req.admin.is_super_admin && !req.admin.department;
      const targetDepartment = isPureSuperAdmin ? filterDepartment : req.admin.department;
      
      console.log('📤 Statistics export request:', { 
        period, 
        targetDepartment, 
        format, 
        include_insights, 
        include_trends 
      });

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      // Get comprehensive data
      const exportData = {
        meta: {
          exported_at: new Date().toISOString(),
          exported_by: req.admin.username,
          period: parseInt(period),
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          department: targetDepartment || 'ALL',
          format,
          version: '2.0'
        },
        overview: await getOverviewStatistics(targetDepartment, startDate, endDate),
        detailed_admins: await getDetailedAdminStatistics(targetDepartment, startDate, endDate)
      };

      // Add optional data
      if (isPureSuperAdmin) {
        exportData.department_breakdown = await getDepartmentBreakdownStatistics(startDate, endDate);
      }

      if (include_insights === 'true') {
        exportData.insights = await generatePerformanceInsights(exportData.detailed_admins, targetDepartment);
        exportData.workload_analysis = await getWorkloadAnalysis(exportData.detailed_admins, targetDepartment);
      }

      if (include_trends === 'true') {
        exportData.trends = await getTrendAnalysis(targetDepartment, startDate, endDate);
      }

      // Handle different export formats
      if (format === 'csv') {
        const csvContent = generateCSVExport(exportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 
          `attachment; filename="admin_statistics_${period}days_${Date.now()}.csv"`);
        res.send(csvContent);
      } else if (format === 'excel') {
        const excelBuffer = await generateExcelExport(exportData);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 
          `attachment; filename="admin_statistics_${period}days_${Date.now()}.xlsx"`);
        res.send(excelBuffer);
      } else {
        // JSON format
        res.json({
          success: true,
          data: exportData
        });
      }

    } catch (error) {
      console.error('❌ Export statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export statistics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

function generateCSVExport(exportData) {
  console.log('📄 Generating CSV export...');
  
  const csvRows = [];
  
  // Headers
  const headers = [
    'Admin ID', 'Username', 'Full Name', 'Email', 'Department', 'Is Super Admin',
    'Total Requests', 'Completed Requests', 'Pending Requests', 'Informed Requests',
    'Rejected Requests', 'Total Responses', 'Performance Score', 'Completion Rate',
    'Avg Response Time (hours)', 'Workload Category', 'Last Activity', 'Has Recent Activity'
  ];
  
  csvRows.push(headers.join(','));
  
  // Data rows
  exportData.detailed_admins.forEach(admin => {
    const row = [
      admin.admin_id || '',
      `"${admin.username || ''}"`,
      `"${admin.full_name || ''}"`,
      `"${admin.email || ''}"`,
      `"${admin.department || ''}"`,
      admin.is_super_admin ? 'Yes' : 'No',
      admin.total_requests || 0,
      admin.completed_requests || 0,
      admin.pending_requests || 0,
      admin.informed_requests || 0,
      admin.rejected_requests || 0,
      admin.total_responses || 0,
      admin.performance_score || 0,
      admin.completion_rate || 0,
      admin.avg_response_time_hours || 0,
      `"${admin.workload_category || 'Unknown'}"`,
      admin.last_activity ? `"${new Date(admin.last_activity).toISOString()}"` : 'Never',
      admin.has_recent_activity ? 'Yes' : 'No'
    ];
    csvRows.push(row.join(','));
  });
  
  // Add summary section
  csvRows.push('');
  csvRows.push('SUMMARY STATISTICS');
  csvRows.push(`Total Admins,${exportData.overview.total_admins || 0}`);
  csvRows.push(`Active Admins,${exportData.overview.active_admins || 0}`);
  csvRows.push(`Total Requests,${exportData.overview.total_requests_handled || 0}`);
  csvRows.push(`Completion Rate,${exportData.overview.completion_rate || 0}%`);
  csvRows.push(`Average Response Time,${exportData.overview.avg_response_time_hours || 0} hours`);
  
  console.log('✅ CSV export generated');
  return csvRows.join('\n');
}

async function generateExcelExport(exportData) {
  console.log('📊 Generating Excel export...');
  
  // This would require a library like 'exceljs' or 'xlsx'
  // For now, return CSV content with Excel MIME type
  const csvContent = generateCSVExport(exportData);
  
  console.log('✅ Excel export generated (CSV format)');
  return Buffer.from(csvContent, 'utf8');
}

// GET /api/admin-auth/statistics/health - System health check
router.get('/statistics/health', 
  authenticateAdmin, 
  requireAnyPermission([
    { resource: 'analytics', action: 'view_department' },
    { resource: 'system', action: 'view_health' }
  ]),
  async (req, res) => {
    try {
      console.log('🏥 System health check request from:', req.admin.username);
      
      const healthData = await getSystemHealthMetrics();
      
      res.json({
        success: true,
        data: healthData,
        meta: {
          checked_at: new Date().toISOString(),
          checked_by: req.admin.username
        }
      });

    } catch (error) {
      console.error('❌ Health check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform health check'
      });
    }
  }
);

async function getSystemHealthMetrics() {
  console.log('🏥 Performing system health check...');
  
  const health = {
    overall_status: 'healthy',
    components: {},
    metrics: {},
    warnings: [],
    recommendations: []
  };

  try {
    // Database connectivity
    const [dbTest] = await pool.execute('SELECT 1 as test');
    health.components.database = {
      status: 'healthy',
      response_time: 'fast',
      last_check: new Date().toISOString()
    };
  } catch (error) {
    health.components.database = {
      status: 'unhealthy',
      error: error.message,
      last_check: new Date().toISOString()
    };
    health.overall_status = 'degraded';
  }

  try {
    // Check for orphaned data
    const [orphanedRequests] = await pool.execute(`
      SELECT COUNT(*) as count FROM guidance_requests gr 
      LEFT JOIN request_types rt ON gr.type_id = rt.type_id 
      WHERE rt.type_id IS NULL
    `);
    
    const [orphanedResponses] = await pool.execute(`
      SELECT COUNT(*) as count FROM admin_responses ar 
      LEFT JOIN guidance_requests gr ON ar.request_id = gr.request_id 
      WHERE gr.request_id IS NULL
    `);

    health.components.data_integrity = {
      status: (orphanedRequests[0].count > 0 || orphanedResponses[0].count > 0) ? 'warning' : 'healthy',
      orphaned_requests: orphanedRequests[0].count,
      orphaned_responses: orphanedResponses[0].count,
      last_check: new Date().toISOString()
    };

    if (orphanedRequests[0].count > 0) {
      health.warnings.push(`${orphanedRequests[0].count} orphaned requests found`);
    }
    if (orphanedResponses[0].count > 0) {
      health.warnings.push(`${orphanedResponses[0].count} orphaned responses found`);
    }
  } catch (error) {
    health.components.data_integrity = {
      status: 'error',
      error: error.message
    };
  }

  try {
    // Performance metrics
    const [avgResponseTime] = await pool.execute(`
      SELECT AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)) as avg_hours
      FROM admin_responses ar
      JOIN guidance_requests gr ON ar.request_id = gr.request_id
      WHERE ar.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    const avgHours = avgResponseTime[0].avg_hours || 0;
    health.metrics.avg_response_time = {
      value: Math.round(avgHours * 10) / 10,
      unit: 'hours',
      status: avgHours < 4 ? 'excellent' : avgHours < 24 ? 'good' : avgHours < 48 ? 'warning' : 'poor',
      benchmark: 'Target: < 4 hours'
    };

    if (avgHours > 24) {
      health.warnings.push('Average response time exceeds 24 hours');
      health.recommendations.push({
        category: 'performance',
        message: 'Implement response time monitoring and alerts',
        priority: 'high'
      });
    }
  } catch (error) {
    health.metrics.avg_response_time = {
      status: 'error',
      error: error.message
    };
  }

  try {
    // Activity levels
    const [activityCheck] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT ar.admin_id) as active_today,
        COUNT(DISTINCT au.admin_id) as total_active_admins
      FROM admin_users au
      LEFT JOIN admin_responses ar ON au.admin_id = ar.admin_id 
        AND DATE(ar.created_at) = CURDATE()
      WHERE au.is_active = TRUE
    `);

    const activityRate = activityCheck[0].total_active_admins > 0 ? 
      (activityCheck[0].active_today / activityCheck[0].total_active_admins) * 100 : 0;

    health.metrics.daily_activity = {
      active_today: activityCheck[0].active_today,
      total_admins: activityCheck[0].total_active_admins,
      activity_rate: Math.round(activityRate),
      status: activityRate > 60 ? 'good' : activityRate > 30 ? 'warning' : 'poor'
    };

    if (activityRate < 30) {
      health.warnings.push('Low daily admin activity detected');
    }
  } catch (error) {
    health.metrics.daily_activity = {
      status: 'error',
      error: error.message
    };
  }

  // Overall status determination
  const componentStatuses = Object.values(health.components).map(c => c.status);
  const hasUnhealthy = componentStatuses.includes('unhealthy');
  const hasWarnings = componentStatuses.includes('warning') || health.warnings.length > 0;

  if (hasUnhealthy) {
    health.overall_status = 'unhealthy';
  } else if (hasWarnings) {
    health.overall_status = 'warning';
  } else {
    health.overall_status = 'healthy';
  }

  console.log(`✅ Health check completed - Status: ${health.overall_status}`);
  return health;
}

router.post('/admin-auth/requests/:requestId/assign', 
  authenticateAdmin,
  requireAnyPermission([
    { resource: 'requests', action: 'assign' },
    { resource: 'requests', action: 'manage' }
  ]),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { admin_id, reason = 'Manual assignment' } = req.body;
      const assignerId = req.admin.admin_id;
      
      console.log('👤 Manual request assignment:', { requestId, admin_id, assignerId });
      
      // Validate request exists and get department
      const [request] = await pool.execute(`
        SELECT gr.request_id, gr.assigned_admin_id, rt.category, gr.status
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE gr.request_id = ?
      `, [requestId]);
      
      if (request.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Request not found'
        });
      }
      
      const requestData = request[0];
      
      // Validate target admin
      const [admin] = await pool.execute(`
        SELECT admin_id, full_name, department 
        FROM admin_users 
        WHERE admin_id = ? AND is_active = TRUE
      `, [admin_id]);
      
      if (admin.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Admin not found or inactive'
        });
      }
      
      // Check department permissions
      if (!req.admin.is_super_admin) {
        if (requestData.category !== req.admin.department) {
          return res.status(403).json({
            success: false,
            error: 'Cannot assign requests from other departments'
          });
        }
        
        if (admin[0].department !== req.admin.department) {
          return res.status(403).json({
            success: false,
            error: 'Cannot assign to admins from other departments'
          });
        }
      }
      
      // Check if request is already assigned
      if (requestData.assigned_admin_id && requestData.assigned_admin_id !== admin_id) {
        // Get current assignee info
        const [currentAssignee] = await pool.execute(`
          SELECT full_name FROM admin_users WHERE admin_id = ?
        `, [requestData.assigned_admin_id]);
        
        return res.status(400).json({
          success: false,
          error: `Request is already assigned to ${currentAssignee[0]?.full_name || 'another admin'}`,
          current_assignee: currentAssignee[0]?.full_name
        });
      }
      
      // Perform assignment
      const result = await assignRequestToAdmin(requestId, admin_id, assignerId, reason);
      
      if (result.success) {
        res.json({
          success: true,
          message: `Request assigned to ${admin[0].full_name}`,
          data: {
            request_id: requestId,
            assigned_admin: admin[0],
            assigned_by: req.admin.full_name,
            assigned_at: new Date().toISOString(),
            reason: reason
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
      
    } catch (error) {
      console.error('❌ Manual assignment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to assign request'
      });
    }
  }
);

// GET assignment history
router.get('/admin-auth/requests/:requestId/assignments', 
  authenticateAdmin,
  requireAnyPermission([
    { resource: 'requests', action: 'view' },
    { resource: 'analytics', action: 'view_department' }
  ]),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      
      // Get current assignment
      const [currentAssignment] = await pool.execute(`
        SELECT 
          gr.assigned_admin_id,
          gr.assigned_at,
          gr.assignment_method,
          au.full_name as assigned_admin_name,
          handler.full_name as handled_by_name
        FROM guidance_requests gr
        LEFT JOIN admin_users au ON gr.assigned_admin_id = au.admin_id
        LEFT JOIN admin_users handler ON gr.handled_by = handler.admin_id
        WHERE gr.request_id = ?
      `, [requestId]);
      
      // Get assignment history from log table (if exists)
      let assignmentHistory = [];
      try {
        const [history] = await pool.execute(`
          SELECT 
            ra.assignment_id,
            ra.admin_id,
            ra.assigned_by,
            ra.assigned_at,
            ra.assignment_reason,
            ra.is_active,
            au.full_name as admin_name,
            assigner.full_name as assigned_by_name
          FROM request_assignments ra
          LEFT JOIN admin_users au ON ra.admin_id = au.admin_id
          LEFT JOIN admin_users assigner ON ra.assigned_by = assigner.admin_id
          WHERE ra.request_id = ?
          ORDER BY ra.assigned_at DESC
        `, [requestId]);
        
        assignmentHistory = history;
      } catch (error) {
        console.log('Assignment history table not available');
      }
      
      res.json({
        success: true,
        data: {
          current_assignment: currentAssignment[0] || null,
          assignment_history: assignmentHistory
        }
      });
      
    } catch (error) {
      console.error('❌ Get assignment history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get assignment history'
      });
    }
  }
);

// GET admin workload
router.get('/admin-auth/workload', 
  authenticateAdmin,
  requireAnyPermission([
    { resource: 'analytics', action: 'view_department' },
    { resource: 'requests', action: 'view' }
  ]),
  async (req, res) => {
    try {
      const isPureSuperAdmin = req.admin.is_super_admin && !req.admin.department;
      const targetDepartment = isPureSuperAdmin ? req.query.department : req.admin.department;
      
      let query = `
        SELECT 
          au.admin_id,
          au.username,
          au.full_name,
          au.department,
          COUNT(gr.request_id) as total_assigned,
          COUNT(CASE WHEN gr.status = 'Pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN gr.status = 'Informed' THEN 1 END) as informed_count,
          COUNT(CASE WHEN gr.status = 'Completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN gr.status = 'Rejected' THEN 1 END) as rejected_count,
          ROUND(
            COUNT(CASE WHEN gr.status = 'Completed' THEN 1 END) * 100.0 / 
            NULLIF(COUNT(gr.request_id), 0), 1
          ) as completion_rate,
          MAX(gr.assigned_at) as last_assignment,
          COUNT(gr.request_id) as current_workload
        FROM admin_users au
        LEFT JOIN guidance_requests gr ON au.admin_id = gr.assigned_admin_id
        WHERE au.is_active = TRUE
      `;
      
      const params = [];
      if (targetDepartment) {
        query += ' AND au.department = ?';
        params.push(targetDepartment);
      }
      
      query += `
        GROUP BY au.admin_id, au.username, au.full_name, au.department
        ORDER BY current_workload DESC, au.full_name
      `;
      
      const [workloadData] = await pool.execute(query, params);
      
      res.json({
        success: true,
        data: workloadData,
        meta: {
          department: targetDepartment || 'ALL',
          total_admins: workloadData.length,
          total_workload: workloadData.reduce((sum, admin) => sum + admin.current_workload, 0)
        }
      });
      
    } catch (error) {
      console.error('❌ Get workload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get admin workload'
      });
    }
  }
);

router.post('/admin-auth/requests/auto-assign', 
  authenticateAdmin,
  requireAnyPermission([
    { resource: 'requests', action: 'assign' },
    { resource: 'requests', action: 'manage' }
  ]),
  async (req, res) => {
    try {
      const { department_filter, force_reassign = false } = req.body;
      const assignerId = req.admin.admin_id;
      
      console.log('🤖 Bulk auto-assignment started:', { department_filter, force_reassign });
      
      // Get unassigned requests
      let unassignedQuery = `
        SELECT gr.request_id, rt.category
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE gr.assigned_admin_id IS NULL
        AND gr.status IN ('Pending', 'Informed')
      `;
      
      const params = [];
      if (department_filter) {
        unassignedQuery += ' AND rt.category = ?';
        params.push(department_filter);
      } else if (!req.admin.is_super_admin) {
        unassignedQuery += ' AND rt.category = ?';
        params.push(req.admin.department);
      }
      
      const [unassignedRequests] = await pool.execute(unassignedQuery, params);
      
      console.log(` Found ${unassignedRequests.length} unassigned requests`);
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      
      // Process each unassigned request
      for (const request of unassignedRequests) {
        try {
          const assignmentResult = await autoAssignNewRequest(request.request_id, request.category);
          
          if (assignmentResult.success) {
            results.push({
              request_id: request.request_id,
              status: 'success',
              assigned_to: assignmentResult.assignedTo.full_name,
              workload: assignmentResult.workload
            });
            successCount++;
          } else {
            results.push({
              request_id: request.request_id,
              status: 'failed',
              reason: assignmentResult.reason || assignmentResult.error
            });
            errorCount++;
          }
        } catch (error) {
          results.push({
            request_id: request.request_id,
            status: 'error',
            error: error.message
          });
          errorCount++;
        }
      }
      
      console.log(`✅ Auto-assignment completed: ${successCount} success, ${errorCount} failed`);
      
      res.json({
        success: true,
        message: `Auto-assignment completed: ${successCount} assigned, ${errorCount} failed`,
        data: {
          total_processed: unassignedRequests.length,
          successful_assignments: successCount,
          failed_assignments: errorCount,
          results: results
        }
      });
      
    } catch (error) {
      console.error('❌ Bulk auto-assignment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform bulk auto-assignment'
      });
    }
  }
);

// NEW: Trigger for auto-assignment on new requests
// Bu function'ı createRequest endpoint'inde çağır
async function handleNewRequestAssignment(requestId) {
  try {
    console.log('🆕 Handling new request assignment:', requestId);
    
    // Get request category
    const [requestInfo] = await pool.execute(`
      SELECT rt.category 
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE gr.request_id = ?
    `, [requestId]);
    
    if (requestInfo.length === 0) {
      console.error('❌ Request not found for auto-assignment:', requestId);
      return;
    }
    
    const category = requestInfo[0].category;
    const result = await autoAssignNewRequest(requestId, category);
    
    if (result.success) {
      console.log(`✅ New request ${requestId} auto-assigned to ${result.assignedTo.full_name}`);
    } else {
      console.log(`⚠️ Could not auto-assign request ${requestId}: ${result.reason}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ New request assignment failed:', error);
    return { success: false, error: error.message };
  }
}


// POST /api/admin-auth/statistics/benchmark - Create performance benchmarks
router.post('/statistics/benchmark', 
  authenticateAdmin, 
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      const { 
        benchmark_name, 
        target_response_time, 
        target_completion_rate, 
        target_utilization_rate,
        department 
      } = req.body;
      
      console.log('🎯 Creating performance benchmark:', {
        benchmark_name,
        target_response_time,
        target_completion_rate,
        target_utilization_rate,
        department
      });

      // Validate inputs
      if (!benchmark_name || !target_response_time || !target_completion_rate) {
        return res.status(400).json({
          success: false,
          error: 'Benchmark name, target response time, and completion rate are required'
        });
      }

      // Create benchmark record
      const [result] = await pool.execute(`
        INSERT INTO performance_benchmarks 
        (benchmark_name, target_response_time_hours, target_completion_rate, 
         target_utilization_rate, department, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, [
        benchmark_name,
        target_response_time,
        target_completion_rate,
        target_utilization_rate || 80,
        department || null,
        req.admin.admin_id
      ]);

      res.json({
        success: true,
        message: 'Performance benchmark created successfully',
        data: {
          benchmark_id: result.insertId,
          benchmark_name,
          targets: {
            response_time_hours: target_response_time,
            completion_rate: target_completion_rate,
            utilization_rate: target_utilization_rate || 80
          }
        }
      });

    } catch (error) {
      console.error('❌ Create benchmark error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create performance benchmark'
      });
    }
  }
);

// GET /api/admin-auth/statistics/benchmarks - Get performance benchmarks
router.get('/statistics/benchmarks', 
  authenticateAdmin, 
  requireAnyPermission([
    { resource: 'analytics', action: 'view_department' },
    { resource: 'analytics', action: 'view_benchmarks' }
  ]),
  async (req, res) => {
    try {
      const isPureSuperAdmin = req.admin.is_super_admin && !req.admin.department;
      const targetDepartment = isPureSuperAdmin ? req.query.department : req.admin.department;
      
      console.log('🎯 Fetching benchmarks for:', targetDepartment || 'ALL');

      let query = `
        SELECT 
          pb.*,
          au.username as created_by_username,
          au.full_name as created_by_name
        FROM performance_benchmarks pb
        LEFT JOIN admin_users au ON pb.created_by = au.admin_id
        WHERE 1=1
      `;

      const params = [];
      if (targetDepartment) {
        query += ' AND (pb.department = ? OR pb.department IS NULL)';
        params.push(targetDepartment);
      } else if (!isPureSuperAdmin) {
        query += ' AND pb.department IS NULL'; // Only global benchmarks for non-super admins
      }

      query += ' ORDER BY pb.created_at DESC';

      const [benchmarks] = await pool.execute(query, params);

      res.json({
        success: true,
        data: benchmarks,
        meta: {
          total_benchmarks: benchmarks.length,
          department: targetDepartment || 'ALL'
        }
      });

    } catch (error) {
      console.error('❌ Get benchmarks error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance benchmarks'
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

      console.log(' Role assignment request:', { user_id, role_id, assignerId, expires_at });

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
    console.log(' Admin getting rejection details for request:', requestId);
    
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


// NEW: Manual assignment endpoint
router.post('/requests/:requestId/assign', 
  authenticateAdmin,
  requireAnyPermission([
    { resource: 'requests', action: 'assign' },
    { resource: 'requests', action: 'manage' }
  ]),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { admin_id, reason = 'Manual assignment' } = req.body;
      const assignerId = req.admin.admin_id;
      
      console.log('👤 Manual request assignment:', { requestId, admin_id, assignerId });
      
      // Validate request exists and get department
      const [request] = await pool.execute(`
        SELECT gr.request_id, gr.assigned_admin_id, rt.category, gr.status
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE gr.request_id = ?
      `, [requestId]);
      
      if (request.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Request not found'
        });
      }
      
      const requestData = request[0];
      
      // Validate target admin
      const [admin] = await pool.execute(`
        SELECT admin_id, full_name, department 
        FROM admin_users 
        WHERE admin_id = ? AND is_active = TRUE
      `, [admin_id]);
      
      if (admin.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Admin not found or inactive'
        });
      }
      
      // Check department permissions
      if (!req.admin.is_super_admin) {
        if (requestData.category !== req.admin.department) {
          return res.status(403).json({
            success: false,
            error: 'Cannot assign requests from other departments'
          });
        }
        
        if (admin[0].department !== req.admin.department) {
          return res.status(403).json({
            success: false,
            error: 'Cannot assign to admins from other departments'
          });
        }
      }
      
      // Perform assignment
      const [result] = await pool.execute(`
        UPDATE guidance_requests 
        SET 
          assigned_admin_id = ?,
          assigned_at = NOW(),
          assignment_method = 'manual',
          handled_by = ?
        WHERE request_id = ?
      `, [admin_id, assignerId, requestId]);
      
      if (result.affectedRows === 0) {
        return res.status(500).json({
          success: false,
          error: 'Failed to assign request'
        });
      }

      res.json({
        success: true,
        message: `Request assigned to ${admin[0].full_name}`,
        data: {
          request_id: requestId,
          assigned_admin: admin[0],
          assigned_by: req.admin.full_name,
          assigned_at: new Date().toISOString(),
          reason: reason
        }
      });
      
    } catch (error) {
      console.error('❌ Manual assignment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to assign request'
      });
    }
  }
);


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
      console.log(' Fetching all permissions...');
      
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

// GET /api/admin-auth/requests/unassigned - Get unassigned requests
router.get('/requests/unassigned', 
  authenticateAdmin, 
  commonPermissions.viewRequests(),
  async (req, res) => {
    try {
      const department = req.admin.department;
      const isPureSuperAdmin = req.admin.is_super_admin && !req.admin.department;

      let query = `
        SELECT 
          gr.request_id,
          gr.content,
          gr.status,
          gr.priority,
          gr.submitted_at,
          rt.type_name,
          rt.category,
          s.name as student_name,
          s.student_number
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        JOIN students s ON gr.student_id = s.student_id
        WHERE gr.assigned_admin_id IS NULL
      `;

      const params = [];
      if (!isPureSuperAdmin && department) {
        query += ' AND rt.category = ?';
        params.push(department);
      }

      query += ' ORDER BY gr.submitted_at DESC';

      const [unassignedRequests] = await pool.execute(query, params);
      
      res.json({
        success: true,
        data: unassignedRequests,
        meta: {
          total: unassignedRequests.length,
          department: isPureSuperAdmin ? 'ALL' : department
        }
      });

    } catch (error) {
      console.error('Get unassigned requests error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch unassigned requests'
      });
    }
  }
);

// POST /api/admin-auth/requests/auto-assign-all
router.post('/requests/auto-assign-all', 
  authenticateAdmin,
  requireAnyPermission([
    { resource: 'requests', action: 'assign' },
    { resource: 'requests', action: 'manage' }
  ]),
  async (req, res) => {
    try {
      const { department_filter } = req.body;
      const assignerId = req.admin.admin_id;
      
      console.log('🤖 Auto-assignment started by:', req.admin.username);
      
      // Get unassigned requests
      let query = `
        SELECT gr.request_id, rt.category
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE gr.assigned_admin_id IS NULL
        AND gr.status IN ('Pending', 'Informed')
      `;
      
      const params = [];
      if (department_filter) {
        query += ' AND rt.category = ?';
        params.push(department_filter);
      } else if (!req.admin.is_super_admin) {
        query += ' AND rt.category = ?';
        params.push(req.admin.department);
      }
      
      const [unassignedRequests] = await pool.execute(query, params);
      console.log(`Found ${unassignedRequests.length} unassigned requests`);
      
      let successCount = 0;
      const results = [];
      
      // Process each request
      for (const request of unassignedRequests) {
        try {
          // Find least loaded admin in this department
          const [availableAdmins] = await pool.execute(`
            SELECT 
              au.admin_id,
              au.full_name,
              COUNT(gr.request_id) as current_workload
            FROM admin_users au
            LEFT JOIN guidance_requests gr ON au.admin_id = gr.assigned_admin_id 
              AND gr.status IN ('Pending', 'Informed')
            WHERE au.department = ? AND au.is_active = TRUE
            GROUP BY au.admin_id, au.full_name
            ORDER BY current_workload ASC, RAND()
            LIMIT 1
          `, [request.category]);
          
          if (availableAdmins.length > 0) {
            const selectedAdmin = availableAdmins[0];
            
            // Assign the request
            await pool.execute(`
              UPDATE guidance_requests 
              SET 
                assigned_admin_id = ?,
                assigned_at = NOW(),
                assignment_method = 'auto',
                handled_by = ?
              WHERE request_id = ?
            `, [selectedAdmin.admin_id, assignerId, request.request_id]);
            
            results.push({
              request_id: request.request_id,
              status: 'success',
              assigned_to: selectedAdmin.full_name,
              department: request.category
            });
            successCount++;
            
            console.log(`✅ Request ${request.request_id} assigned to ${selectedAdmin.full_name}`);
          } else {
            results.push({
              request_id: request.request_id,
              status: 'failed',
              reason: `No available admins in ${request.category} department`
            });
            console.log(`❌ No admins available for request ${request.request_id} in ${request.category}`);
          }
        } catch (assignError) {
          console.error(`Error assigning request ${request.request_id}:`, assignError);
          results.push({
            request_id: request.request_id,
            status: 'error',
            error: assignError.message
          });
        }
      }
      
      console.log(`🎯 Auto-assignment completed: ${successCount}/${unassignedRequests.length} successful`);
      
      res.json({
        success: true,
        message: `Auto-assignment completed: ${successCount} assigned, ${unassignedRequests.length - successCount} failed`,
        data: {
          total_processed: unassignedRequests.length,
          successful_assignments: successCount,
          failed_assignments: unassignedRequests.length - successCount,
          results: results
        }
      });
      
    } catch (error) {
      console.error('❌ Auto-assignment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to auto-assign requests',
        details: error.message
      });
    }
  }
);

// POST /api/admin-auth/requests/:requestId/auto-assign-single
router.post('/requests/:requestId/auto-assign-single',
  authenticateAdmin,
  requireAnyPermission([
    { resource: 'requests', action: 'assign' },
    { resource: 'requests', action: 'manage' }
  ]),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const assignerId = req.admin.admin_id;
      
      // Get request details
      const [requestDetails] = await pool.execute(`
        SELECT gr.request_id, rt.category, gr.assigned_admin_id
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE gr.request_id = ?
      `, [requestId]);
      
      if (requestDetails.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Request not found'
        });
      }
      
      const request = requestDetails[0];
      
      if (request.assigned_admin_id) {
        return res.status(400).json({
          success: false,
          error: 'Request is already assigned'
        });
      }
      
      // Find best admin for this request
      const [availableAdmins] = await pool.execute(`
        SELECT 
          au.admin_id,
          au.full_name,
          COUNT(gr.request_id) as current_workload
        FROM admin_users au
        LEFT JOIN guidance_requests gr ON au.admin_id = gr.assigned_admin_id 
          AND gr.status IN ('Pending', 'Informed')
        WHERE au.department = ? AND au.is_active = TRUE
        GROUP BY au.admin_id, au.full_name
        ORDER BY current_workload ASC, RAND()
        LIMIT 1
      `, [request.category]);
      
      if (availableAdmins.length === 0) {
        return res.status(400).json({
          success: false,
          error: `No available admins in ${request.category} department`
        });
      }
      
      const selectedAdmin = availableAdmins[0];
      
      // Assign the request
      await pool.execute(`
        UPDATE guidance_requests 
        SET 
          assigned_admin_id = ?,
          assigned_at = NOW(),
          assignment_method = 'auto',
          handled_by = ?
        WHERE request_id = ?
      `, [selectedAdmin.admin_id, assignerId, requestId]);
      
      res.json({
        success: true,
        message: `Request assigned to ${selectedAdmin.full_name}`,
        data: {
          request_id: requestId,
          assigned_to: selectedAdmin.full_name,
          assigned_admin_id: selectedAdmin.admin_id,
          department: request.category
        }
      });
      
    } catch (error) {
      console.error('Single auto-assignment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to auto-assign request'
      });
    }
  }
);



// GET /api/admin-auth/unassigned-requests-analysis - Analyze unassigned requests
router.get('/unassigned-requests-analysis', 
  authenticateAdmin, 
  requireAnyPermission([
    { resource: 'requests', action: 'view' },
    { resource: 'analytics', action: 'view_system' }
  ]),
  async (req, res) => {
    try {
      console.log('🔍 Analyzing unassigned requests...');

      // 1. Overall statistics
      const [overallStats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(assigned_admin_id) as assigned_requests,
          COUNT(*) - COUNT(assigned_admin_id) as unassigned_requests,
          ROUND((COUNT(assigned_admin_id) * 100.0 / COUNT(*)), 2) as assignment_rate
        FROM guidance_requests
        WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);

      // 2. Department breakdown
      const [departmentBreakdown] = await pool.execute(`
        SELECT 
          rt.category as department,
          COUNT(gr.request_id) as total_requests,
          COUNT(gr.assigned_admin_id) as assigned_requests,
          COUNT(gr.request_id) - COUNT(gr.assigned_admin_id) as unassigned_requests,
          COUNT(DISTINCT au.admin_id) as available_admins
        FROM request_types rt
        LEFT JOIN guidance_requests gr ON rt.type_id = gr.type_id 
          AND gr.submitted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        LEFT JOIN admin_users au ON rt.category = au.department AND au.is_active = TRUE
        GROUP BY rt.category
        HAVING total_requests > 0
        ORDER BY unassigned_requests DESC
      `);

      // 3. Recent unassigned requests
      const [recentUnassigned] = await pool.execute(`
        SELECT 
          gr.request_id,
          rt.category,
          gr.status,
          gr.submitted_at,
          CASE WHEN ar.admin_id IS NOT NULL THEN 'Has Response' ELSE 'No Response' END as response_status,
          ar.admin_id as response_admin_id
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
        WHERE gr.assigned_admin_id IS NULL
          AND gr.submitted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY gr.submitted_at DESC
        LIMIT 50
      `);

      // 4. Assignment method analysis
      const [assignmentMethods] = await pool.execute(`
        SELECT 
          assignment_method,
          COUNT(*) as count,
          ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()), 2) as percentage
        FROM guidance_requests
        WHERE assigned_admin_id IS NOT NULL 
          AND submitted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY assignment_method
      `);

      res.json({
        success: true,
        data: {
          overall_statistics: overallStats[0],
          department_breakdown: departmentBreakdown,
          recent_unassigned: recentUnassigned,
          assignment_methods: assignmentMethods,
          analysis: {
            critical_departments: departmentBreakdown.filter(dept => dept.unassigned_requests > 5),
            departments_without_admins: departmentBreakdown.filter(dept => dept.available_admins === 0),
            recommendations: generateUnassignedRecommendations(departmentBreakdown, overallStats[0])
          }
        }
      });

    } catch (error) {
      console.error('❌ Unassigned analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze unassigned requests'
      });
    }
  }
);

// POST /api/admin-auth/fix-unassigned-requests - Bulk fix unassigned requests
router.post('/fix-unassigned-requests', 
  authenticateAdmin, 
  requireRole(['super_admin']),
  async (req, res) => {
    try {
      console.log('🔧 Starting bulk fix for unassigned requests...');
      
      // 1. Get all unassigned requests
      const [unassignedRequests] = await pool.execute(`
        SELECT 
          gr.request_id,
          rt.category,
          gr.status,
          gr.submitted_at,
          CASE WHEN ar.admin_id IS NOT NULL THEN ar.admin_id ELSE NULL END as response_admin
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
        WHERE gr.assigned_admin_id IS NULL
        ORDER BY gr.submitted_at DESC
      `);

      console.log(`Found ${unassignedRequests.length} unassigned requests`);

      let fixed = 0;
      let errors = 0;
      const results = [];

      for (const request of unassignedRequests) {
        try {
          let assignedAdminId = null;
          let assignmentMethod = 'auto';

          // Strategy 1: If there's a response, assign to that admin
          if (request.response_admin) {
            assignedAdminId = request.response_admin;
            assignmentMethod = 'manual';
            console.log(`📝 Assigning request ${request.request_id} to response admin ${assignedAdminId}`);
          } else {
            // Strategy 2: Auto-assign to least loaded admin in department
            const [availableAdmins] = await pool.execute(`
              SELECT 
                au.admin_id,
                au.full_name,
                COUNT(gr.request_id) as current_workload
              FROM admin_users au
              LEFT JOIN guidance_requests gr ON au.admin_id = gr.assigned_admin_id 
                AND gr.status IN ('Pending', 'Informed')
              WHERE au.department = ? AND au.is_active = TRUE
              GROUP BY au.admin_id, au.full_name
              ORDER BY current_workload ASC, RAND()
              LIMIT 1
            `, [request.category]);

            if (availableAdmins.length > 0) {
              assignedAdminId = availableAdmins[0].admin_id;
              console.log(`🤖 Auto-assigning request ${request.request_id} to ${availableAdmins[0].full_name}`);
            }
          }

          if (assignedAdminId) {
            // Update the request
            const [updateResult] = await pool.execute(`
              UPDATE guidance_requests 
              SET 
                assigned_admin_id = ?,
                assigned_at = NOW(),
                assignment_method = ?
              WHERE request_id = ?
            `, [assignedAdminId, assignmentMethod, request.request_id]);

            if (updateResult.affectedRows > 0) {
              fixed++;
              results.push({
                request_id: request.request_id,
                status: 'success',
                assigned_to: assignedAdminId,
                method: assignmentMethod
              });
            }
          } else {
            errors++;
            results.push({
              request_id: request.request_id,
              status: 'failed',
              reason: `No available admin in ${request.category} department`
            });
          }
        } catch (error) {
          console.error(`Error fixing request ${request.request_id}:`, error);
          errors++;
          results.push({
            request_id: request.request_id,
            status: 'error',
            error: error.message
          });
        }
      }

      console.log(`✅ Bulk fix completed: ${fixed} fixed, ${errors} failed`);

      res.json({
        success: true,
        message: `Bulk fix completed: ${fixed} requests fixed, ${errors} failed`,
        data: {
          total_processed: unassignedRequests.length,
          successfully_fixed: fixed,
          failed: errors,
          results: results
        }
      });

    } catch (error) {
      console.error('❌ Bulk fix error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fix unassigned requests',
        details: error.message
      });
    }
  }
);



// POST /api/admin-auth/auto-assign-by-department - Auto-assign by department
router.post('/auto-assign-by-department', 
  authenticateAdmin, 
  requireAnyPermission([
    { resource: 'requests', action: 'assign' },
    { resource: 'requests', action: 'manage' }
  ]),
  async (req, res) => {
    try {
      const { department } = req.body;
      const assignerId = req.admin.admin_id;

      if (!department) {
        return res.status(400).json({
          success: false,
          error: 'Department is required'
        });
      }

      // Get unassigned requests for this department
      const [unassignedRequests] = await pool.execute(`
        SELECT gr.request_id, rt.category
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE gr.assigned_admin_id IS NULL
          AND rt.category = ?
          AND gr.status IN ('Pending', 'Informed')
        ORDER BY gr.submitted_at ASC
      `, [department]);

      let successCount = 0;
      const results = [];

      for (const request of unassignedRequests) {
        try {
          // Find least loaded admin in department
          const [availableAdmins] = await pool.execute(`
            SELECT 
              au.admin_id,
              au.full_name,
              COUNT(gr.request_id) as current_workload
            FROM admin_users au
            LEFT JOIN guidance_requests gr ON au.admin_id = gr.assigned_admin_id 
              AND gr.status IN ('Pending', 'Informed')
            WHERE au.department = ? AND au.is_active = TRUE
            GROUP BY au.admin_id, au.full_name
            ORDER BY current_workload ASC, RAND()
            LIMIT 1
          `, [department]);

          if (availableAdmins.length > 0) {
            const selectedAdmin = availableAdmins[0];

            await pool.execute(`
              UPDATE guidance_requests 
              SET 
                assigned_admin_id = ?,
                assigned_at = NOW(),
                assignment_method = 'auto',
                handled_by = ?
              WHERE request_id = ?
            `, [selectedAdmin.admin_id, assignerId, request.request_id]);

            successCount++;
            results.push({
              request_id: request.request_id,
              status: 'success',
              assigned_to: selectedAdmin.full_name
            });
          } else {
            results.push({
              request_id: request.request_id,
              status: 'failed',
              reason: 'No available admins'
            });
          }
        } catch (error) {
          results.push({
            request_id: request.request_id,
            status: 'error',
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: `${successCount} requests auto-assigned in ${department} department`,
        data: {
          department,
          total_processed: unassignedRequests.length,
          successful_assignments: successCount,
          results
        }
      });

    } catch (error) {
      console.error('❌ Department auto-assign error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to auto-assign requests by department'
      });
    }
  }
);

module.exports = router;