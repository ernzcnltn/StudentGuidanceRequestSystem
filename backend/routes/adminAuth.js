// backend/routes/adminAuth.js - Updated with RBAC
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticateAdmin, requirePermission, requireAnyPermission, commonPermissions } = require('../middleware/adminAuth');
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

    // Admin'i bul - admin_users tablosu kullan
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

    // Şifre kontrolü - password_hash kullan
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

      // Şifreyi response'dan çıkar ve RBAC bilgilerini ekle
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
      // Fallback: login without RBAC data
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

// GET /api/admin-auth/me - Admin profili (RBAC bilgileri dahil)
router.get('/me', authenticateAdmin, async (req, res) => {
  try {
    const adminId = req.admin.admin_id;
    
    // Admin bilgilerini al
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
    
    // RBAC bilgilerini ekle
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

// GET /api/admin-auth/verify - Admin token verification (değişiklik yok)
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

// GET /api/admin-auth/dashboard - Dashboard (izin kontrolü eklendi)
router.get('/dashboard', 
  authenticateAdmin, 
  commonPermissions.viewAnalytics(),
  async (req, res) => {
    try {
      const department = req.admin.department;
      const isSuper = req.admin.is_super_admin;
      
      console.log('Dashboard request for department:', department);

      let query, params;
      
      if (isSuper) {
        // Super admin tüm departmanları görebilir
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
        // Normal admin sadece kendi departmanını görebilir
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

      // Request type statistics
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

      console.log('Dashboard data:', { totals: totals[0], typeStats });

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

// GET /api/admin-auth/requests - Admin Requests (gelişmiş izin kontrolü)
router.get('/requests', 
  authenticateAdmin, 
  commonPermissions.viewRequests(),
  async (req, res) => {
    try {
      const department = req.admin.department;
      const isSuper = req.admin.is_super_admin;
      const { status } = req.query;

      console.log('Fetching requests for department:', department);

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

      // Super admin tüm departmanları görebilir, normal admin sadece kendi departmanını
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
      
      console.log('Found requests:', requests.length);

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

// GET /api/admin-auth/request-types - Request Types (izin kontrolü eklendi)
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
        // Super admin tüm request type'ları görebilir
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
        // Normal admin sadece kendi departmanını görebilir
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

// PUT /api/admin-auth/requests/:requestId/status - Update status (izin kontrolü eklendi)
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

      // Request'in bu admin'in departmanına ait olup olmadığını kontrol et
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

      // Update request status
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

// PUT /api/admin-auth/requests/:requestId/priority - Update priority (izin kontrolü eklendi)
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

      // Department access check for non-super admins
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

      // Update priority
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

// PUT /api/admin-auth/request-types/:typeId/toggle - Toggle request type (izin kontrolü eklendi)
router.put('/request-types/:typeId/toggle', 
  authenticateAdmin, 
  requirePermission('settings', 'manage_request_types'),
  async (req, res) => {
    try {
      const { typeId } = req.params;

      // Department access check for non-super admins
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

// POST /api/admin-auth/request-types - Add new request type (izin kontrolü eklendi)
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

      // Super admin can specify category, normal admin uses their department
      const category = isSuper && req.body.category ? req.body.category : department;

      // Add new request type
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

// GET /api/admin-auth/requests/:requestId/responses - Get responses (izin kontrolü eklendi)
router.get('/requests/:requestId/responses', 
  authenticateAdmin, 
  commonPermissions.viewRequests(),
  async (req, res) => {
    try {
      const { requestId } = req.params;

      // Department access check for non-super admins
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

// POST /api/admin-auth/requests/:requestId/responses - Add response (izin kontrolü eklendi)
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

      // Department access check and get request details
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

      // Add response
      const [result] = await pool.execute(`
        INSERT INTO admin_responses (request_id, admin_id, response_content, created_at)
        VALUES (?, ?, ?, NOW())
      `, [requestId, adminId, response_content.trim()]);

      // Update request status to 'Informed' if it was 'Pending'
      if (oldStatus === 'Pending') {
        await pool.execute(`
          UPDATE guidance_requests 
          SET 
            status = 'Informed',
            updated_at = NOW()
          WHERE request_id = ?
        `, [requestId]);

        // TODO: Send email notification
        // await emailService.notifyRequestStatusUpdate(...)
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

// ===== RBAC MANAGEMENT ROUTES =====

// GET /api/admin-auth/rbac/permissions - Get all permissions
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
        message: 'Failed to fetch permissions'
      });
    }
  }
);

// GET /api/admin-auth/rbac/roles - Get all roles
router.get('/rbac/roles', 
  authenticateAdmin, 
  requirePermission('users', 'manage_roles'),
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
        message: 'Failed to fetch roles'
      });
    }
  }
);

// GET /api/admin-auth/rbac/users - Get users with roles
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
        message: 'Failed to fetch users'
      });
    }
  }
);

// POST /api/admin-auth/rbac/assign-role - Assign role to user
router.post('/rbac/assign-role', 
  authenticateAdmin, 
  requirePermission('users', 'manage_roles'),
  async (req, res) => {
    try {
      const { user_id, role_id, expires_at } = req.body;
      const assignerId = req.admin.admin_id;

      if (!user_id || !role_id) {
        return res.status(400).json({
          success: false,
          message: 'User ID and Role ID are required'
        });
      }

      const result = await rbacService.assignRoleToUser(user_id, role_id, assignerId, expires_at);
      res.json(result);
    } catch (error) {
      console.error('Assign role error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to assign role'
      });
    }
  }
);

// POST /api/admin-auth/rbac/remove-role - Remove role from user
router.post('/rbac/remove-role', 
  authenticateAdmin, 
  requirePermission('users', 'manage_roles'),
  async (req, res) => {
    try {
      const { user_id, role_id } = req.body;
      const removerId = req.admin.admin_id;

      if (!user_id || !role_id) {
        return res.status(400).json({
          success: false,
          message: 'User ID and Role ID are required'
        });
      }

      const result = await rbacService.removeRoleFromUser(user_id, role_id, removerId);
      res.json(result);
    } catch (error) {
      console.error('Remove role error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to remove role'
      });
    }
  }
);

module.exports = router;