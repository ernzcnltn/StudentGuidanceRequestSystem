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

// POST /api/admin-auth/login - Admin giriş (değişiklik yok)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Admin'i bul
    const [admins] = await pool.execute(
      'SELECT * FROM admin_users WHERE username = ? AND is_active = TRUE',
      [username]
    );

    if (admins.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    const admin = admins[0];

    // Şifre kontrolü
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    
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
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Admin login failed'
    });
  }
});

// ... (existing routes remain the same - dashboard, requests, etc.)

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
      const department = req.admin.is_super_admin ? null : req.admin.department;
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

      // Check if role is system role
      const [roleCheck] = await pool.execute(
        'SELECT is_system_role, role_name FROM roles WHERE role_id = ?',
        [roleId]
      );

      if (roleCheck.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Role not found'
        });
      }

      if (roleCheck[0].is_system_role) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete system roles'
        });
      }

      // Delete role (cascade will handle role_permissions and user_roles)
      const [result] = await pool.execute(
        'DELETE FROM roles WHERE role_id = ?',
        [roleId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Role not found'
        });
      }

      res.json({
        success: true,
        message: 'Role deleted successfully'
      });

    } catch (error) {
      console.error('Delete role error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete role'
      });
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

      if (!permission_name || !display_name || !resource || !action) {
        return res.status(400).json({
          success: false,
          error: 'Permission name, display name, resource, and action are required'
        });
      }

      const [result] = await pool.execute(`
        INSERT INTO permissions (
          permission_name, 
          display_name, 
          description, 
          resource, 
          action,
          is_system_permission
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        permission_name, 
        display_name, 
        description || null, 
        resource, 
        action,
        is_system_permission || false
      ]);

      res.json({
        success: true,
        message: 'Permission created successfully',
        data: {
          permission_id: result.insertId,
          permission_name,
          display_name,
          resource,
          action
        }
      });
    } catch (error) {
      console.error('Create permission error:', error);
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(400).json({
          success: false,
          error: 'Permission already exists'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create permission'
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

      // Check if permission is system permission
      const [permissionCheck] = await pool.execute(
        'SELECT is_system_permission FROM permissions WHERE permission_id = ?',
        [permissionId]
      );

      if (permissionCheck.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Permission not found'
        });
      }

      if (permissionCheck[0].is_system_permission) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete system permissions'
        });
      }

      const [result] = await pool.execute(
        'DELETE FROM permissions WHERE permission_id = ?',
        [permissionId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Permission not found'
        });
      }

      res.json({
        success: true,
        message: 'Permission deleted successfully'
      });
    } catch (error) {
      console.error('Delete permission error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete permission'
      });
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
router.get('/dashboard', 
  authenticateAdmin, 
  commonPermissions.viewAnalytics(),
  async (req, res) => {
    try {
      const department = req.admin.department;
      const isSuper = req.admin.is_super_admin;
      
      let query, params;
      
      if (isSuper) {
        query = `
          SELECT 
            COUNT(*) as total_requests,
            SUM(CASE WHEN gr.status = 'Pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN gr.status = 'Informed' THEN 1 ELSE 0 END) as informed,
            SUM(CASE WHEN gr.status = 'Completed' THEN 1 ELSE 0 END) as completed
          FROM guidance_requests gr
          JOIN request_types rt ON gr.type_id = rt.type_id
        `;
        params = [];
      } else {
        query = `
          SELECT 
            COUNT(*) as total_requests,
            SUM(CASE WHEN gr.status = 'Pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN gr.status = 'Informed' THEN 1 ELSE 0 END) as informed,
            SUM(CASE WHEN gr.status = 'Completed' THEN 1 ELSE 0 END) as completed
          FROM guidance_requests gr
          JOIN request_types rt ON gr.type_id = rt.type_id
          WHERE rt.category = ?
        `;
        params = [department];
      }

      const [totals] = await pool.execute(query, params);

      let typeStatsQuery, typeStatsParams;
      
      if (isSuper) {
        typeStatsQuery = `
          SELECT 
            rt.type_name,
            rt.category,
            COUNT(gr.request_id) as count
          FROM request_types rt
          LEFT JOIN guidance_requests gr ON rt.type_id = gr.type_id
          GROUP BY rt.type_id, rt.type_name, rt.category
          ORDER BY count DESC
        `;
        typeStatsParams = [];
      } else {
        typeStatsQuery = `
          SELECT 
            rt.type_name,
            COUNT(gr.request_id) as count
          FROM request_types rt
          LEFT JOIN guidance_requests gr ON rt.type_id = gr.type_id
          WHERE rt.category = ?
          GROUP BY rt.type_id, rt.type_name
          ORDER BY count DESC
        `;
        typeStatsParams = [department];
      }

      const [typeStats] = await pool.execute(typeStatsQuery, typeStatsParams);

      res.json({
        success: true,
        data: {
          totals: totals[0] || {
            total_requests: 0,
            pending: 0,
            informed: 0,
            completed: 0
          },
          type_stats: typeStats || [],
          department: isSuper ? 'ALL' : department,
          is_super_admin: isSuper
        }
      });

    } catch (error) {
      console.error('Dashboard data error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard data',
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
      const isSuper = req.admin.is_super_admin;
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

      if (!isSuper) {
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
          department: isSuper ? 'ALL' : department,
          filter: status || 'all',
          is_super_admin: isSuper
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
      const isSuper = req.admin.is_super_admin;

      let query, params;

      if (isSuper) {
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
          department: isSuper ? 'ALL' : department,
          is_super_admin: isSuper
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

// GET /api/admin-auth/rbac/permissions - Tüm izinleri getir (RBAC korumalı)
router.get('/rbac/permissions', 
  authenticateAdmin, 
  requirePermission('users', 'manage_roles'),
  async (req, res) => {
    try {
      const permissions = await rbacService.getAllPermissions();
      res.json({
        success: true,
        data: permissions
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

// POST /api/admin-auth/rbac/assign-role - Rol atama (RBAC korumalı)
router.post('/rbac/assign-role', 
  authenticateAdmin, 
  requirePermission('users', 'manage_roles'),
  async (req, res) => {
    try {
      const { user_id, role_id, expires_at } = req.body;
      const assignerId = req.admin.admin_id;

      console.log('🎭 Role assignment request:', { user_id, role_id, expires_at, assignerId });

      if (!user_id || !role_id) {
        return res.status(400).json({
          success: false,
          error: 'User ID and Role ID are required'
        });
      }

      // rbacService.assignRoleToUser kullan
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

// POST /api/admin-auth/rbac/check-permission - İzin kontrolü
router.post('/rbac/check-permission', 
  authenticateAdmin,
  async (req, res) => {
    try {
      const { user_id, resource, action } = req.body;
      const targetUserId = user_id || req.admin.admin_id;

      if (!resource || !action) {
        return res.status(400).json({
          success: false,
          message: 'Resource and action are required'
        });
      }

      const hasPermission = await rbacService.hasPermission(targetUserId, resource, action);
      
      res.json({
        success: true,
        data: {
          user_id: targetUserId,
          resource,
          action,
          has_permission: hasPermission
        }
      });
    } catch (error) {
      console.error('Check permission error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check permission'
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