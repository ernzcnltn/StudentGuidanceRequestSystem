const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticateAdmin } = require('../middleware/adminAuth');

// POST /api/admin-auth/login - Admin giriş
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

    // Şifreyi response'dan çıkar
    const { password_hash: _, ...adminData } = admin;

    res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        token,
        admin: adminData
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Admin login failed'
    });
  }
});

// GET /api/admin-auth/me - Admin profili
router.get('/me', authenticateAdmin, async (req, res) => {
  try {
    const adminId = req.admin.admin_id;
    
    // Admin bilgilerini al
    const [admins] = await pool.execute(
      'SELECT admin_id, username, email, full_name, role, department, is_active FROM admin_users WHERE admin_id = ? AND is_active = TRUE',
      [adminId]
    );
    
    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
    }
    
    res.json({
      success: true,
      data: admins[0]
    });
  } catch (error) {
    console.error('Admin profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get admin profile'
    });
  }
});

// Add email test endpoint
router.get('/test-email', authenticateAdmin, async (req, res) => {
  try {
    const testResult = await emailService.testConnection();
    res.json({
      success: true,
      message: 'Email service test completed',
      data: testResult
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Email test failed',
      details: error.message
    });
  }
});

// GET /api/admin-auth/verify - Admin token verification
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

// POST /api/admin-auth/logout - Admin çıkış
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Admin logout successful'
  });
});

// GET /api/admin-auth/dashboard - Admin Dashboard Data
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const department = req.admin.department;
    console.log('Dashboard request for department:', department);

    // Get total counts for the department
    const [totals] = await pool.execute(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN gr.status = 'Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN gr.status = 'Informed' THEN 1 ELSE 0 END) as informed,
        SUM(CASE WHEN gr.status = 'Completed' THEN 1 ELSE 0 END) as completed
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE rt.category = ?
    `, [department]);

    // Get request type statistics for the department
    const [typeStats] = await pool.execute(`
      SELECT 
        rt.type_name,
        COUNT(gr.request_id) as count
      FROM request_types rt
      LEFT JOIN guidance_requests gr ON rt.type_id = gr.type_id
      WHERE rt.category = ?
      GROUP BY rt.type_id, rt.type_name
      ORDER BY count DESC
    `, [department]);

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
        type_stats: typeStats || []
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
});

// GET /api/admin-auth/requests - Admin Requests
router.get('/requests', authenticateAdmin, async (req, res) => {
  try {
    const department = req.admin.department;
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
      WHERE rt.category = ?
    `;

    const params = [department];

    if (status) {
      query += ' AND gr.status = ?';
      params.push(status);
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
      data: requests
    });

  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests',
      error: error.message
    });
  }
});

// GET /api/admin-auth/request-types - Admin Request Types
router.get('/request-types', authenticateAdmin, async (req, res) => {
  try {
    const department = req.admin.department;

    const [requestTypes] = await pool.execute(`
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
    `, [department]);

    res.json({
      success: true,
      data: requestTypes
    });

  } catch (error) {
    console.error('Get request types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch request types'
    });
  }
});

// PUT /api/admin-auth/requests/:requestId/status - Update request status
router.put('/requests/:requestId/status', authenticateAdmin, async (req, res) => {
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
      message: 'Request status updated successfully'
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update request status'
    });
  }
});

// PUT /api/admin-auth/requests/:requestId/priority - Update priority
router.put('/requests/:requestId/priority', authenticateAdmin, async (req, res) => {
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
      message: `Priority updated to ${priority} successfully`
    });

  } catch (error) {
    console.error('Update priority error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update request priority'
    });
  }
});

// PUT /api/admin-auth/request-types/:typeId/toggle - Toggle request type
router.put('/request-types/:typeId/toggle', authenticateAdmin, async (req, res) => {
  try {
    const { typeId } = req.params;

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
});

// GET /api/admin-auth/requests/:requestId/responses - Get responses
router.get('/requests/:requestId/responses', authenticateAdmin, async (req, res) => {
  try {
    const { requestId } = req.params;

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
});

// POST /api/admin-auth/requests/:requestId/responses - Add response with email
router.post('/requests/:requestId/responses', authenticateAdmin, async (req, res) => {
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

    // Get request and student details
    const [requestDetails] = await pool.execute(`
      SELECT 
        gr.request_id,
        gr.status,
        s.name as student_name,
        s.email as student_email,
        rt.type_name
      FROM guidance_requests gr
      JOIN students s ON gr.student_id = s.student_id
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE gr.request_id = ?
    `, [requestId]);

    if (requestDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
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

      // Send email notification
      if (request.student_email) {
        try {
          await emailService.notifyRequestStatusUpdate(
            request.student_email,
            request.student_name,
            requestId,
            request.type_name,
            oldStatus,
            'Informed',
            response_content.trim()
          );
        } catch (emailError) {
          console.error('Failed to send response email:', emailError);
        }
      }
    }

    res.json({
      success: true,
      message: 'Response added successfully',
      data: {
        response_id: result.insertId
      }
    });

  } catch (error) {
    console.error('Add response error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add response'
    });
  }
});


// POST /api/admin-auth/request-types - Add new request type
router.post('/request-types', authenticateAdmin, async (req, res) => {
  try {
    const { type_name, description_en, is_document_required, category } = req.body;
    const department = req.admin.department;

    if (!type_name || !type_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Type name is required'
      });
    }

    // Add new request type
    const [result] = await pool.execute(`
      INSERT INTO request_types (category, type_name, description_en, is_document_required, is_disabled)
      VALUES (?, ?, ?, ?, FALSE)
    `, [department, type_name.trim(), description_en || '', is_document_required || false]);

    res.json({
      success: true,
      message: 'Request type added successfully',
      data: {
        type_id: result.insertId
      }
    });

  } catch (error) {
    console.error('Add request type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add request type'
    });
  }
});

module.exports = router;