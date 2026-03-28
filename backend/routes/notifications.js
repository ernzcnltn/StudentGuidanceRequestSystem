const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { authenticateAdmin } = require('../middleware/adminAuth');

// Combined authentication middleware
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    // Try admin authentication first
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Check if it's an admin token
      if (decoded.admin_id) {
        const [adminRows] = await pool.execute(
          'SELECT admin_id, username, department FROM admins WHERE admin_id = ?',
          [decoded.admin_id]
        );
        
        if (adminRows.length > 0) {
          req.admin = adminRows[0];
          req.userType = 'admin';
          return next();
        }
      }
      
      // Check if it's a student token
      if (decoded.student_id) {
        const [studentRows] = await pool.execute(
          'SELECT student_id, student_number, name, email FROM students WHERE student_id = ?',
          [decoded.student_id]
        );
        
        if (studentRows.length > 0) {
          req.user = studentRows[0];
          req.userType = 'student';
          return next();
        }
      }
      
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
      
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// GET /api/notifications/student - Get student notifications
router.get('/student', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.student_id;
    
  // 👇 YENİ: EXAM REQUEST NOTIFICATIONS EKLE
    const [allNotifications] = await pool.execute(`
      -- Regular request updates
      SELECT 
        'request_update' as type,
        CONCAT('Request #', gr.request_id, ' Status Update') as title,
        CONCAT('Your request "', rt.type_name, '" status changed to ', gr.status) as message,
        gr.updated_at as created_at,
        CASE WHEN gr.status = 'Completed' THEN TRUE ELSE FALSE END as is_read,
        gr.priority,
        gr.request_id as related_request_id,
        CONCAT('request_', gr.request_id, '_', UNIX_TIMESTAMP(gr.updated_at)) as id
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE gr.student_id = ? 
        AND gr.updated_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      
      UNION ALL
      
      -- Admin responses
      SELECT 
        'response_added' as type,
        CONCAT('New Response for Request #', ar.request_id) as title,
        CONCAT('You received a response for your request') as message,
        ar.created_at,
        FALSE as is_read,
        'Medium' as priority,
        ar.request_id as related_request_id,
        CONCAT('response_', ar.response_id, '_', UNIX_TIMESTAMP(ar.created_at)) as id
      FROM admin_responses ar
      JOIN guidance_requests gr ON ar.request_id = gr.request_id
      WHERE gr.student_id = ? 
        AND ar.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        AND ar.is_internal = FALSE
      
      UNION ALL
      
      -- 👇 YENİ: EXAM REQUEST NOTIFICATIONS
      SELECT 
        CASE 
          WHEN er.status = 'Pending' THEN 'exam_request_pending'
          WHEN er.status = 'Approved' THEN 'exam_request_approved'
          WHEN er.status = 'Rejected' THEN 'exam_request_rejected'
        END as type,
        CONCAT(
          CASE er.exam_type 
            WHEN 'makeup' THEN 'Make-up' 
            WHEN 'resit' THEN 'Resit' 
          END,
          ' Exam Request ',
          CASE er.status
            WHEN 'Pending' THEN 'Submitted'
            WHEN 'Approved' THEN 'Approved'
            WHEN 'Rejected' THEN 'Rejected'
          END
        ) as title,
        CONCAT(
          'Your ', er.exam_type, ' exam request for ', er.course_code, ' - ', er.course_name,
          CASE 
            WHEN er.status = 'Pending' THEN ' is awaiting review'
            WHEN er.status = 'Approved' THEN ' has been approved'
            WHEN er.status = 'Rejected' THEN ' was not approved'
          END
        ) as message,
        COALESCE(er.processed_at, er.submitted_at) as created_at,
        CASE WHEN er.status = 'Pending' THEN FALSE ELSE TRUE END as is_read,
        CASE 
          WHEN er.status = 'Rejected' THEN 'Urgent'
          WHEN er.status = 'Approved' THEN 'High'
          ELSE 'Medium'
        END as priority,
        er.exam_request_id as related_request_id,
        CONCAT('exam_request_', er.exam_request_id, '_', UNIX_TIMESTAMP(COALESCE(er.processed_at, er.submitted_at))) as id
      FROM exam_requests er
      WHERE er.student_id = ?
        AND COALESCE(er.processed_at, er.submitted_at) > DATE_SUB(NOW(), INTERVAL 30 DAY)
      
      ORDER BY created_at DESC
      LIMIT 100
    `, [studentId, studentId, studentId]); // 👈 3 kere studentId
    
    res.json({
      success: true,
      data: allNotifications
    });
  } catch (error) {
    console.error('Error fetching student notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

// GET /api/notifications/admin - Get admin notifications
router.get('/admin', authenticateAdmin, async (req, res) => {
  try {
    const adminDepartment = req.admin.department;
    const adminId = req.admin.admin_id;
    const adminRole = req.admin.role; // 👈 Role bilgisi
    
    console.log('🔔 Admin notifications request:', {
      admin_id: adminId,
      department: adminDepartment,
      role: adminRole
    });
    
    // Check if super admin
    let isSuperAdmin = false;
    try {
      const [adminRoles] = await pool.execute(`
        SELECT r.role_name 
        FROM roles r
        JOIN user_roles ur ON r.role_id = ur.role_id
        WHERE ur.user_id = ? AND ur.is_active = 1
      `, [adminId]);
      
      isSuperAdmin = adminRoles.some(role => role.role_name === 'super_admin');
    } catch (roleError) {
      console.warn('⚠️ Role check failed:', roleError.message);
      isSuperAdmin = false;
    }
    
    // Get notification states for this admin
    const [notificationStates] = await pool.execute(`
      SELECT notification_id, state 
      FROM notification_states 
      WHERE admin_id = ?
    `, [adminId]);
    
    const dismissedIds = notificationStates
      .filter(ns => ns.state === 'dismissed')
      .map(ns => ns.notification_id);
    
    const readIds = notificationStates
      .filter(ns => ns.state === 'read')
      .map(ns => ns.notification_id);
    
    console.log('📊 Notification states from DB:', {
      dismissed_count: dismissedIds.length,
      read_count: readIds.length
    });
    
    let notifications = [];
    
    // 👇 YENİ: INSTITUTE ADMIN için INSTITUTE REQUEST NOTIFICATIONS
    if (adminRole === 'institute_admin') {
      console.log('🎓 Fetching institute request notifications for institute admin...');
      
      const [instituteNotifications] = await pool.execute(`
        SELECT 
          CASE 
            WHEN gr.status = 'Pending' THEN 'institute_request_new'
            WHEN gr.status = 'Informed' THEN 'institute_request_informed'
            WHEN gr.status = 'Completed' THEN 'institute_request_completed'
            WHEN gr.status = 'Rejected' THEN 'institute_request_rejected'
          END as type,
          CONCAT(
            CASE gr.status
              WHEN 'Pending' THEN 'New '
              WHEN 'Informed' THEN 'Informed '
              WHEN 'Completed' THEN 'Completed '
              WHEN 'Rejected' THEN 'Rejected '
            END,
            'Institute Request'
          ) as title,
          CONCAT(
            s.name, ' - ', rt.type_name,
            CASE 
              WHEN gr.status = 'Pending' THEN ' (Awaiting Review)'
              ELSE ''
            END
          ) as message,
          gr.submitted_at as created_at,
          gr.request_id as related_request_id,
          CASE 
            WHEN gr.status = 'Pending' THEN 'High'
            WHEN gr.status = 'Rejected' THEN 'Medium'
            ELSE 'Low'
          END as priority,
          CONCAT('institute_', gr.request_id, '_', UNIX_TIMESTAMP(gr.submitted_at)) as id,
          FALSE as is_read
        FROM guidance_requests gr
        JOIN students s ON gr.student_id = s.student_id
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE rt.category = 'Institute'
          AND gr.submitted_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY 
          CASE gr.status 
            WHEN 'Pending' THEN 1
            WHEN 'Informed' THEN 2
            WHEN 'Completed' THEN 3
            WHEN 'Rejected' THEN 4
          END,
          gr.submitted_at DESC
        LIMIT 50
      `);
      
      notifications = instituteNotifications;
      
      console.log(`✅ Generated ${notifications.length} dynamic institute request notifications`);
    }
    // 👇 SECRETARY için EXAM REQUEST NOTIFICATIONS (Dinamik)
    else if (adminRole === 'secretary') {
      console.log('🎓 Fetching exam request notifications for secretary...');
      
      // Get faculty ID for this secretary
      const departmentKeyword = adminDepartment.replace('Faculty of ', '').trim();
      
      const [secretaryFaculty] = await pool.execute(`
        SELECT faculty_id, faculty_name, faculty_name_tr
        FROM faculties 
        WHERE faculty_name LIKE CONCAT('%', ?, '%')
           OR faculty_name_tr LIKE CONCAT('%', ?, '%')
        LIMIT 1
      `, [departmentKeyword, departmentKeyword]);
      
      if (secretaryFaculty.length > 0) {
        const facultyId = secretaryFaculty[0].faculty_id;
        
        console.log('📚 Secretary faculty:', { 
          faculty_id: facultyId, 
          department: adminDepartment 
        });
        
        // 👇 DYNAMIC EXAM REQUEST NOTIFICATIONS
        const [examNotifications] = await pool.execute(`
          SELECT 
            CASE 
              WHEN er.status = 'Pending' THEN 'exam_request_new'
              WHEN er.status = 'Approved' THEN 'exam_request_approved'
              WHEN er.status = 'Rejected' THEN 'exam_request_rejected'
            END as type,
            CONCAT(
              CASE er.status
                WHEN 'Pending' THEN 'New '
                WHEN 'Approved' THEN 'Approved '
                WHEN 'Rejected' THEN 'Rejected '
              END,
              CASE er.exam_type 
                WHEN 'makeup' THEN 'Make-up' 
                WHEN 'resit' THEN 'Resit' 
              END, 
              ' Exam Request'
            ) as title,
            CONCAT(
              s.name, ' - ', er.course_code, ' - ', er.course_name,
              CASE 
                WHEN er.status = 'Pending' THEN ' (Awaiting Review)'
                ELSE ''
              END
            ) as message,
            er.submitted_at as created_at,
            er.exam_request_id as related_request_id,
            CASE 
              WHEN er.status = 'Pending' THEN 'High'
              ELSE 'Medium'
            END as priority,
            CONCAT('exam_', er.exam_request_id, '_', UNIX_TIMESTAMP(er.submitted_at)) as id,
            FALSE as is_read
          FROM exam_requests er
          JOIN students s ON er.student_id = s.student_id
          WHERE er.faculty_id = ?
            AND er.submitted_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
          ORDER BY 
            CASE er.status 
              WHEN 'Pending' THEN 1
              WHEN 'Approved' THEN 2
              WHEN 'Rejected' THEN 3
            END,
            er.submitted_at DESC
          LIMIT 50
        `, [facultyId]);
        
        notifications = examNotifications;
        
        console.log(`✅ Generated ${notifications.length} dynamic exam request notifications`);
      } else {
        console.log('⚠️ No faculty found for secretary department:', adminDepartment);
        notifications = [];
      }
    }
    // 👇 SUPER ADMIN için normal notifications
    else if (isSuperAdmin) {
      const [results] = await pool.execute(`
        SELECT 
          'new_request' as type,
          CONCAT('New Request #', gr.request_id) as title,
          CONCAT('From ', s.name, ' - ', rt.type_name, ' (', rt.category, ')') as message,
          gr.submitted_at as created_at,
          gr.request_id as related_request_id,
          COALESCE(gr.priority, 'Medium') as priority,
          CONCAT('request_', gr.request_id, '_', UNIX_TIMESTAMP(gr.submitted_at)) as id,
          FALSE as is_read
        FROM guidance_requests gr
        JOIN students s ON gr.student_id = s.student_id
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE gr.submitted_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND gr.status = 'Pending'
        ORDER BY gr.submitted_at DESC
        LIMIT 20
      `);
      notifications = results;
    } 
    // 👇 DEPARTMENT ADMIN için normal notifications
    else {
      const [results] = await pool.execute(`
        SELECT 
          'new_request' as type,
          CONCAT('New Request #', gr.request_id) as title,
          CONCAT('From ', s.name, ' - ', rt.type_name) as message,
          gr.submitted_at as created_at,
          gr.request_id as related_request_id,
          COALESCE(gr.priority, 'Medium') as priority,
          CONCAT('request_', gr.request_id, '_', UNIX_TIMESTAMP(gr.submitted_at)) as id,
          FALSE as is_read
        FROM guidance_requests gr
        JOIN students s ON gr.student_id = s.student_id
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE rt.category = ?
          AND gr.submitted_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND gr.status = 'Pending'
        ORDER BY gr.submitted_at DESC
        LIMIT 20
      `, [adminDepartment]);
      notifications = results;
    }
    
    // Filter out dismissed notifications and mark read ones
    const filteredNotifications = notifications
      .filter(notification => !dismissedIds.includes(notification.id))
      .map(notification => ({
        ...notification,
        is_read: readIds.includes(notification.id)
      }));
    
    console.log('✅ Notifications processed:', {
      total_generated: notifications.length,
      filtered_count: filteredNotifications.length,
      unread_count: filteredNotifications.filter(n => !n.is_read).length
    });
    
    res.json({
      success: true,
      data: filteredNotifications
    });
    
  } catch (error) {
    console.error('❌ Admin notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

// POST /api/notifications/mark-read/:id - Mark notification as read
router.post('/mark-read/:id', authenticateUser, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    console.log('Notification mark-read request:', { notificationId });
    
    // Frontend localStorage'da halledecek, backend sadece success döner
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const isAdmin = req.userType === 'admin';
    
    console.log('🗑️ Dismissing notification:', { 
      notificationId, 
      userType: req.userType 
    });
    
    if (isAdmin && notificationId.includes('_')) {
      const adminId = req.admin.admin_id;
      
      // Mark as dismissed in database
      await pool.execute(`
        INSERT INTO notification_states (admin_id, notification_id, state)
        VALUES (?, ?, 'dismissed')
        ON DUPLICATE KEY UPDATE state = 'dismissed', created_at = NOW()
      `, [adminId, notificationId]);
      
      console.log('✅ Notification dismissed in database');
    }
    
    res.json({
      success: true,
      message: 'Notification dismissed successfully'
    });
  } catch (error) {
    console.error('Error dismissing notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to dismiss notification'
    });
  }
});

// DELETE /api/notifications/all - Delete all notifications for user
router.delete('/all', authenticateUser, async (req, res) => {
  try {
    const isAdmin = req.userType === 'admin';
    
    if (isAdmin) {
      const adminId = req.admin.admin_id;
      const adminRole = req.admin.role;
      
      console.log('🗑️ Dismissing all notifications for admin:', adminId);
      
      // Get all current notification IDs for this admin
      const adminDepartment = req.admin.department;
      
      // Check if super admin
      let isSuperAdmin = false;
      try {
        const [adminRoles] = await pool.execute(`
          SELECT r.role_name 
          FROM roles r
          JOIN user_roles ur ON r.role_id = ur.role_id
          WHERE ur.user_id = ? AND ur.is_active = 1
        `, [adminId]);
        
        isSuperAdmin = adminRoles.some(role => role.role_name === 'super_admin');
      } catch (roleError) {
        isSuperAdmin = false;
      }
      
      // Get current notification IDs based on role
      let currentNotifications = [];
      
      if (adminRole === 'institute_admin') {
        // Get institute request notifications
        const [results] = await pool.execute(`
          SELECT CONCAT('institute_', request_id, '_', UNIX_TIMESTAMP(submitted_at)) as id
          FROM guidance_requests gr
          JOIN request_types rt ON gr.type_id = rt.type_id
          WHERE rt.category = 'Institute'
            AND gr.submitted_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);
        currentNotifications = results;
      } else if (adminRole === 'secretary') {
        // Get exam request notifications for secretary
        const departmentKeyword = adminDepartment.replace('Faculty of ', '').trim();
        
        const [secretaryFaculty] = await pool.execute(`
          SELECT faculty_id FROM faculties 
          WHERE faculty_name LIKE CONCAT('%', ?, '%')
             OR faculty_name_tr LIKE CONCAT('%', ?, '%')
          LIMIT 1
        `, [departmentKeyword, departmentKeyword]);
        
        if (secretaryFaculty.length > 0) {
          const [results] = await pool.execute(`
            SELECT CONCAT('exam_', exam_request_id, '_', UNIX_TIMESTAMP(submitted_at)) as id
            FROM exam_requests
            WHERE faculty_id = ?
              AND submitted_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
          `, [secretaryFaculty[0].faculty_id]);
          currentNotifications = results;
        }
      } else if (isSuperAdmin) {
        const [results] = await pool.execute(`
          SELECT CONCAT('request_', gr.request_id, '_', UNIX_TIMESTAMP(gr.submitted_at)) as id
          FROM guidance_requests gr
          WHERE gr.submitted_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
            AND gr.status = 'Pending'
        `);
        currentNotifications = results;
      } else {
        const [results] = await pool.execute(`
          SELECT CONCAT('request_', gr.request_id, '_', UNIX_TIMESTAMP(gr.submitted_at)) as id
          FROM guidance_requests gr
          JOIN request_types rt ON gr.type_id = rt.type_id
          WHERE rt.category = ?
            AND gr.submitted_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
            AND gr.status = 'Pending'
        `, [adminDepartment]);
        currentNotifications = results;
      }
      
      // Mark all current notifications as dismissed
      for (const notification of currentNotifications) {
        await pool.execute(`
          INSERT INTO notification_states (admin_id, notification_id, state)
          VALUES (?, ?, 'dismissed')
          ON DUPLICATE KEY UPDATE state = 'dismissed', created_at = NOW()
        `, [adminId, notification.id]);
      }
      
      console.log('✅ All notifications dismissed:', currentNotifications.length);
    }
    
    res.json({
      success: true,
      message: 'All notifications dismissed successfully'
    });
  } catch (error) {
    console.error('Error dismissing all notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to dismiss all notifications'
    });
  }
});

// GET /api/notifications/admin/unread-count - Get admin unread notification count
router.get('/admin/unread-count', authenticateAdmin, async (req, res) => {
  try {
    const adminDepartment = req.admin.department;
    const adminId = req.admin.admin_id;
    const adminRole = req.admin.role;
    
    // Check if super admin
    let isSuperAdmin = false;
    try {
      const [adminRoles] = await pool.execute(`
        SELECT r.role_name 
        FROM roles r
        JOIN user_roles ur ON r.role_id = ur.role_id
        WHERE ur.user_id = ? AND ur.is_active = 1
      `, [adminId]);
      
      isSuperAdmin = adminRoles.some(role => role.role_name === 'super_admin');
    } catch (roleError) {
      isSuperAdmin = false;
    }
    
    // Get dismissed and read notification IDs from database
    const [notificationStates] = await pool.execute(`
      SELECT notification_id 
      FROM notification_states 
      WHERE admin_id = ? AND state IN ('dismissed', 'read')
    `, [adminId]);
    
    const excludedIds = notificationStates.map(ns => ns.notification_id);
    
    let unreadCount = 0;
    
    // Institute Admin - institute requests
    if (adminRole === 'institute_admin') {
      let query = `
        SELECT COUNT(*) as count
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE rt.category = 'Institute'
          AND gr.submitted_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      `;
      
      let queryParams = [];
      
      if (excludedIds.length > 0) {
        const excludedConditions = excludedIds.map(id => {
          return `CONCAT('institute_', gr.request_id, '_', UNIX_TIMESTAMP(gr.submitted_at)) != ?`;
        }).join(' AND ');
        
        if (excludedConditions) {
          query += ` AND ${excludedConditions}`;
          queryParams = excludedIds;
        }
      }
      
      const [result] = await pool.execute(query, queryParams);
      unreadCount = result[0].count;
    }
    // Secretary - exam requests
    else if (adminRole === 'secretary') {
      const departmentKeyword = adminDepartment.replace('Faculty of ', '').trim();
      
      const [secretaryFaculty] = await pool.execute(`
        SELECT faculty_id FROM faculties 
        WHERE faculty_name LIKE CONCAT('%', ?, '%')
           OR faculty_name_tr LIKE CONCAT('%', ?, '%')
        LIMIT 1
      `, [departmentKeyword, departmentKeyword]);
      
      if (secretaryFaculty.length > 0) {
        let query = `
          SELECT COUNT(*) as count
          FROM exam_requests er
          WHERE er.faculty_id = ?
            AND er.submitted_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        `;
        
        let queryParams = [secretaryFaculty[0].faculty_id];
        
        if (excludedIds.length > 0) {
          const excludedConditions = excludedIds.map(id => {
            return `CONCAT('exam_', er.exam_request_id, '_', UNIX_TIMESTAMP(er.submitted_at)) != ?`;
          }).join(' AND ');
          
          if (excludedConditions) {
            query += ` AND ${excludedConditions}`;
            queryParams = [secretaryFaculty[0].faculty_id, ...excludedIds];
          }
        }
        
        const [result] = await pool.execute(query, queryParams);
        unreadCount = result[0].count;
      }
    }
    // Super Admin - regular requests
    else if (isSuperAdmin) {
      let query = `
        SELECT COUNT(*) as count
        FROM guidance_requests gr
        WHERE gr.status = 'Pending'
          AND gr.submitted_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
      `;
      
      let queryParams = [];
      
      if (excludedIds.length > 0) {
        const excludedConditions = excludedIds.map(id => {
          return `CONCAT('request_', gr.request_id, '_', UNIX_TIMESTAMP(gr.submitted_at)) != ?`;
        }).join(' AND ');
        
        if (excludedConditions) {
          query += ` AND ${excludedConditions}`;
          queryParams = excludedIds;
        }
      }
      
      const [result] = await pool.execute(query, queryParams);
      unreadCount = result[0].count;
      
    } 
    // Department Admin - regular requests
    else {
      let query = `
        SELECT COUNT(*) as count
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE rt.category = ?
          AND gr.status = 'Pending'
          AND gr.submitted_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
      `;
      
      let queryParams = [adminDepartment];
      
      if (excludedIds.length > 0) {
        const excludedConditions = excludedIds.map(id => {
          return `CONCAT('request_', gr.request_id, '_', UNIX_TIMESTAMP(gr.submitted_at)) != ?`;
        }).join(' AND ');
        
        if (excludedConditions) {
          query += ` AND ${excludedConditions}`;
          queryParams = [adminDepartment, ...excludedIds];
        }
      }
      
      const [result] = await pool.execute(query, queryParams);
      unreadCount = result[0].count;
    }
    
    res.json({
      success: true,
      data: {
        unread_count: unreadCount
      }
    });
    
  } catch (error) {
    console.error('❌ Admin unread count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count'
    });
  }
});

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.student_id;
    
    // Get dismissed notification IDs from query parameter (optional for future use)
    const dismissedIds = req.query.dismissed ? req.query.dismissed.split(',').filter(id => id) : [];
    
    console.log('📊 Student unread count request:', {
      student_id: studentId,
      dismissed_count: dismissedIds.length
    });
    
    // Count pending requests
    let pendingQuery = `
      SELECT COUNT(*) as count
      FROM guidance_requests 
      WHERE student_id = ? 
        AND status = 'Pending'
        AND submitted_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
    `;
    
    let pendingParams = [studentId];
    
    // If dismissed notifications exist, exclude related requests
    if (dismissedIds.length > 0) {
      const dismissedRequestIds = dismissedIds
        .filter(id => id.includes('_'))
        .map(id => {
          const parts = id.split('_');
          return parts[1]; // Extract request ID
        })
        .filter(id => id && !isNaN(id));
      
      if (dismissedRequestIds.length > 0) {
        pendingQuery += ` AND request_id NOT IN (${dismissedRequestIds.map(() => '?').join(',')})`;
        pendingParams = [studentId, ...dismissedRequestIds];
      }
    }
    
    const [pendingRequests] = await pool.execute(pendingQuery, pendingParams);
    
    // Count recent responses
    let responsesQuery = `
      SELECT COUNT(*) as count
      FROM admin_responses ar
      JOIN guidance_requests gr ON ar.request_id = gr.request_id
      WHERE gr.student_id = ? 
        AND ar.created_at > DATE_SUB(NOW(), INTERVAL 3 DAY)
        AND ar.is_internal = FALSE
    `;
    
    let responsesParams = [studentId];
    
    // If dismissed notifications exist, exclude related responses
    if (dismissedIds.length > 0) {
      const dismissedRequestIds = dismissedIds
        .filter(id => id.includes('response_'))
        .map(id => {
          const parts = id.split('_');
          return parts[1]; // Extract request ID
        })
        .filter(id => id && !isNaN(id));
      
      if (dismissedRequestIds.length > 0) {
        responsesQuery += ` AND gr.request_id NOT IN (${dismissedRequestIds.map(() => '?').join(',')})`;
        responsesParams = [studentId, ...dismissedRequestIds];
      }
    }
    
    const [recentResponses] = await pool.execute(responsesQuery, responsesParams);
    
    const unreadCount = pendingRequests[0].count + recentResponses[0].count;
    
    console.log('✅ Student unread count calculated:', {
      pending_requests: pendingRequests[0].count,
      recent_responses: recentResponses[0].count,
      total_unread: unreadCount,
      dismissed_count: dismissedIds.length
    });
    
    res.json({
      success: true,
      data: {
        unread_count: unreadCount
      }
    });
  } catch (error) {
    console.error('Error getting student unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count'
    });
  }
});

module.exports = router;