const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { authenticateAdmin } = require('../middleware/adminAuth');

// GET /api/notifications/student - Get student notifications
router.get('/student', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.student_id;
    
    // Get recent notifications for student
    const [notifications] = await pool.execute(`
      SELECT 
        'request_update' as type,
        CONCAT('Request #', gr.request_id, ' Status Update') as title,
        CONCAT('Your request "', rt.type_name, '" status changed to ', gr.status) as message,
        gr.updated_at as created_at,
        CASE WHEN gr.status = 'Completed' THEN TRUE ELSE FALSE END as is_read,
        gr.priority,
        gr.request_id as related_id
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
        ar.request_id as related_id
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
      data: notifications.map((notif, index) => ({
        id: `${notif.type}_${notif.related_id}_${index}`,
        ...notif
      }))
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
    
    // Get recent notifications for admin
    const [notifications] = await pool.execute(`
      SELECT 
        'new_request' as type,
        CONCAT('New ', gr.priority, ' Priority Request') as title,
        CONCAT('Request #', gr.request_id, ' from ', s.name, ' - ', rt.type_name) as message,
        gr.submitted_at as created_at,
        CASE WHEN gr.status = 'Pending' THEN FALSE ELSE TRUE END as is_read,
        gr.priority,
        gr.request_id as related_id
      FROM guidance_requests gr
      JOIN students s ON gr.student_id = s.student_id
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE rt.category = ? 
        AND gr.submitted_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
      
      ORDER BY created_at DESC
      LIMIT 50
    `, [department]);
    
    res.json({
      success: true,
      data: notifications.map((notif, index) => ({
        id: `${notif.type}_${notif.related_id}_${index}`,
        ...notif
      }))
    });
  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

// POST /api/notifications/mark-read - Mark notification as read
router.post('/mark-read/:id', authenticateToken, async (req, res) => {
  try {
    // For this simple implementation, we'll just return success
    // In a real app, you'd store notification read status in database
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
router.post('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    // For this simple implementation, we'll just return success
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
});

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.student_id;
    
    // Count unread notifications (simplified logic)
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

// Admin notification endpoints
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
    
    res.json({
      success: true,
      data: {
        unread_count: pendingRequests[0].count
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