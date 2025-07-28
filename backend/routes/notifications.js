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
    
    // Get recent notifications for student
    const [dynamicNotifications] = await pool.execute(`
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
      
      ORDER BY created_at DESC
      LIMIT 50
    `, [studentId, studentId]);
    
    res.json({
      success: true,
      data: dynamicNotifications
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
    const department = req.admin.department;
    
    console.log('Fetching admin notifications for department:', department);
    
    // Get recent notifications for admin
    const [dynamicNotifications] = await pool.execute(`
      SELECT 
        'new_request' as type,
        CONCAT('New ', gr.priority, ' Priority Request') as title,
        CONCAT('Request #', gr.request_id, ' from ', s.name, ' - ', rt.type_name) as message,
        gr.submitted_at as created_at,
        CASE WHEN gr.status = 'Pending' THEN FALSE ELSE TRUE END as is_read,
        gr.priority,
        gr.request_id as related_request_id,
        CONCAT('request_', gr.request_id, '_', UNIX_TIMESTAMP(gr.submitted_at)) as id
      FROM guidance_requests gr
      JOIN students s ON gr.student_id = s.student_id
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE rt.category = ? 
        AND gr.submitted_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
      
      UNION ALL
      
      SELECT 
        'urgent_request' as type,
        CONCAT('🚨 URGENT: Request #', gr.request_id) as title,
        CONCAT('Urgent request from ', s.name, ' - ', rt.type_name) as message,
        gr.submitted_at as created_at,
        FALSE as is_read,
        'Urgent' as priority,
        gr.request_id as related_request_id,
        CONCAT('urgent_', gr.request_id, '_', UNIX_TIMESTAMP(gr.submitted_at)) as id
      FROM guidance_requests gr
      JOIN students s ON gr.student_id = s.student_id
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE rt.category = ? 
        AND gr.priority = 'Urgent'
        AND gr.status = 'Pending'
        AND gr.submitted_at > DATE_SUB(NOW(), INTERVAL 3 DAY)
      
      ORDER BY created_at DESC
      LIMIT 50
    `, [department, department]);
    
    console.log('Admin notifications found:', dynamicNotifications.length);
    
    res.json({
      success: true,
      data: dynamicNotifications
    });
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
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
    const isAdmin = req.userType === 'admin';
    
    console.log('Marking notification as read:', { 
      notificationId, 
      userType: req.userType,
      userId: isAdmin ? req.admin?.admin_id : req.user?.student_id
    });
    
    // For dynamic notifications (contain underscores), just return success
    if (notificationId.includes('_')) {
      res.json({
        success: true,
        message: 'Dynamic notification marked as read'
      });
      return;
    }
    
    // For stored notifications, update database
    const userId = isAdmin ? req.admin.admin_id : req.user.student_id;
    const userType = isAdmin ? 'admin' : 'student';
    
    const [result] = await pool.execute(`
      UPDATE notifications 
      SET is_read = TRUE 
      WHERE id = ? AND user_id = ? AND user_type = ?
    `, [notificationId, userId, userType]);
    
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

// POST /api/notifications/mark-all-read - Mark all notifications as read
router.post('/mark-all-read', authenticateUser, async (req, res) => {
  try {
    const isAdmin = req.userType === 'admin';
    const userId = isAdmin ? req.admin.admin_id : req.user.student_id;
    const userType = isAdmin ? 'admin' : 'student';
    
    console.log('Marking all notifications as read:', { userId, userType });
    
    // Update all stored notifications for this user
    const [result] = await pool.execute(`
      UPDATE notifications 
      SET is_read = TRUE 
      WHERE user_id = ? AND user_type = ? AND is_read = FALSE
    `, [userId, userType]);
    
    console.log('Updated notifications count:', result.affectedRows);
    
    res.json({
      success: true,
      message: `All notifications marked as read`
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const isAdmin = req.userType === 'admin';
    
    console.log('Deleting notification:', { 
      notificationId, 
      userType: req.userType 
    });
    
    // For dynamic notifications, just return success
    if (notificationId.includes('_')) {
      res.json({
        success: true,
        message: 'Dynamic notification removed from view'
      });
      return;
    }
    
    // For stored notifications, delete from database
    const userId = isAdmin ? req.admin.admin_id : req.user.student_id;
    const userType = isAdmin ? 'admin' : 'student';
    
    const [result] = await pool.execute(`
      DELETE FROM notifications 
      WHERE id = ? AND user_id = ? AND user_type = ?
    `, [notificationId, userId, userType]);
    
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification'
    });
  }
});

// POST /api/notifications/bulk-delete - Delete multiple notifications
router.post('/bulk-delete', authenticateUser, async (req, res) => {
  try {
    const { ids } = req.body;
    const isAdmin = req.userType === 'admin';
    
    console.log('Bulk deleting notifications:', { 
      ids, 
      userType: req.userType 
    });
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification IDs'
      });
    }
    
    // Filter out dynamic notifications
    const storedIds = ids.filter(id => !id.includes('_'));
    
    if (storedIds.length === 0) {
      res.json({
        success: true,
        message: 'All notifications were dynamic - removed from view'
      });
      return;
    }
    
    const userId = isAdmin ? req.admin.admin_id : req.user.student_id;
    const userType = isAdmin ? 'admin' : 'student';
    
    const placeholders = storedIds.map(() => '?').join(',');
    const [result] = await pool.execute(`
      DELETE FROM notifications 
      WHERE id IN (${placeholders}) AND user_id = ? AND user_type = ?
    `, [...storedIds, userId, userType]);
    
    res.json({
      success: true,
      message: `${result.affectedRows} notifications deleted successfully`
    });
  } catch (error) {
    console.error('Error bulk deleting notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notifications'
    });
  }
});

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.student_id;
    
    // Count dynamic unread notifications
    const [pendingRequests] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM guidance_requests 
      WHERE student_id = ? 
        AND status = 'Pending'
        AND submitted_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
    `, [studentId]);
    
    const [recentResponses] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM admin_responses ar
      JOIN guidance_requests gr ON ar.request_id = gr.request_id
      WHERE gr.student_id = ? 
        AND ar.created_at > DATE_SUB(NOW(), INTERVAL 3 DAY)
        AND ar.is_internal = FALSE
    `, [studentId]);
    
    const unreadCount = pendingRequests[0].count + recentResponses[0].count;
    
    res.json({
      success: true,
      data: {
        unread_count: unreadCount
      }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count'
    });
  }
});


// DELETE /api/notifications/all - Delete all notifications for user
router.delete('/all', authenticateUser, async (req, res) => {
  try {
    const isAdmin = req.userType === 'admin';
    const userId = isAdmin ? req.admin.admin_id : req.user.student_id;
    const userType = isAdmin ? 'admin' : 'student';
    
    console.log('Deleting all notifications for user:', { userId, userType });
    
    // Delete all stored notifications for this user
    const [result] = await pool.execute(`
      DELETE FROM notifications 
      WHERE user_id = ? AND user_type = ?
    `, [userId, userType]);
    
    console.log('Deleted notifications count:', result.affectedRows);
    
    res.json({
      success: true,
      message: `All notifications deleted successfully`,
      deleted_count: result.affectedRows
    });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete all notifications'
    });
  }
});

// GET /api/notifications/admin/unread-count - Get admin unread notification count
router.get('/admin/unread-count', authenticateAdmin, async (req, res) => {
  try {
    const department = req.admin.department;
    
    // Count pending requests for department
    const [pendingRequests] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE rt.category = ? 
        AND gr.status = 'Pending'
        AND gr.submitted_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
    `, [department]);
    
    // Count urgent requests
    const [urgentRequests] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE rt.category = ? 
        AND gr.priority = 'Urgent'
        AND gr.status = 'Pending'
    `, [department]);
    
    const unreadCount = pendingRequests[0].count + urgentRequests[0].count;
    
    res.json({
      success: true,
      data: {
        unread_count: unreadCount
      }
    });
  } catch (error) {
    console.error('Error getting admin unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count'
    });
  }
});

module.exports = router;