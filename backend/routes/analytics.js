const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { authenticateAdmin } = require('../middleware/adminAuth');

// GET /api/analytics/student/:studentId - Student analytics
router.get('/student/:studentId', authenticateToken, async (req, res) => {
  try {
    const studentId = req.params.studentId;
    
    // Verify student can only access their own data
    if (req.user.student_id !== parseInt(studentId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Get student request statistics
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_requests,
        SUM(CASE WHEN status = 'Informed' THEN 1 ELSE 0 END) as informed_requests,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_requests,
        AVG(CASE 
          WHEN resolved_at IS NOT NULL 
          THEN TIMESTAMPDIFF(DAY, submitted_at, resolved_at) 
          ELSE NULL 
        END) as avg_resolution_days
      FROM guidance_requests 
      WHERE student_id = ?
    `, [studentId]);
    
    // Get requests by category
    const [categoryStats] = await pool.execute(`
      SELECT 
        rt.category,
        COUNT(gr.request_id) as count
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE gr.student_id = ?
      GROUP BY rt.category
      ORDER BY count DESC
    `, [studentId]);
    
    // Get monthly request trend (last 12 months)
    const [monthlyTrend] = await pool.execute(`
      SELECT 
        DATE_FORMAT(submitted_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM guidance_requests
      WHERE student_id = ? 
        AND submitted_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(submitted_at, '%Y-%m')
      ORDER BY month
    `, [studentId]);
    
    // Get favorite category
    const favoriteCategory = categoryStats.length > 0 ? categoryStats[0].category : null;
    
    res.json({
      success: true,
      data: {
        ...stats[0],
        favorite_category: favoriteCategory,
        category_breakdown: categoryStats,
        monthly_trend: monthlyTrend
      }
    });
  } catch (error) {
    console.error('Error fetching student analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

// GET /api/analytics/admin/dashboard - Admin dashboard analytics
router.get('/admin/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const department = req.admin.department;
    const { period = '30' } = req.query; // days
    
    // Get department statistics
    const [departmentStats] = await pool.execute(`
      SELECT 
        COUNT(gr.request_id) as total_requests,
        SUM(CASE WHEN gr.status = 'Pending' THEN 1 ELSE 0 END) as pending_requests,
        SUM(CASE WHEN gr.status = 'Informed' THEN 1 ELSE 0 END) as informed_requests,
        SUM(CASE WHEN gr.status = 'Completed' THEN 1 ELSE 0 END) as completed_requests,
        AVG(CASE 
          WHEN gr.resolved_at IS NOT NULL 
          THEN TIMESTAMPDIFF(HOUR, gr.submitted_at, gr.resolved_at) 
          ELSE NULL 
        END) as avg_resolution_hours
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE rt.category = ?
        AND gr.submitted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [department, period]);
    
    // Get request type breakdown
    const [typeBreakdown] = await pool.execute(`
      SELECT 
        rt.type_name,
        COUNT(gr.request_id) as count,
        AVG(CASE 
          WHEN gr.resolved_at IS NOT NULL 
          THEN TIMESTAMPDIFF(HOUR, gr.submitted_at, gr.resolved_at) 
          ELSE NULL 
        END) as avg_resolution_hours
      FROM request_types rt
      LEFT JOIN guidance_requests gr ON rt.type_id = gr.type_id 
        AND gr.submitted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      WHERE rt.category = ?
      GROUP BY rt.type_id, rt.type_name
      ORDER BY count DESC
    `, [period, department]);
    
    // Get priority distribution
    const [priorityStats] = await pool.execute(`
      SELECT 
        gr.priority,
        COUNT(*) as count,
        AVG(CASE 
          WHEN gr.resolved_at IS NOT NULL 
          THEN TIMESTAMPDIFF(HOUR, gr.submitted_at, gr.resolved_at) 
          ELSE NULL 
        END) as avg_resolution_hours
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE rt.category = ?
        AND gr.submitted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY gr.priority
      ORDER BY FIELD(gr.priority, 'Urgent', 'High', 'Medium', 'Low')
    `, [department, period]);
    
    // Get daily request trend
    const [dailyTrend] = await pool.execute(`
      SELECT 
        DATE(gr.submitted_at) as date,
        COUNT(*) as count
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE rt.category = ?
        AND gr.submitted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(gr.submitted_at)
      ORDER BY date
    `, [department, period]);
    
    // Get top students by request count
    const [topStudents] = await pool.execute(`
      SELECT 
        s.name,
        s.student_number,
        COUNT(gr.request_id) as request_count
      FROM guidance_requests gr
      JOIN students s ON gr.student_id = s.student_id
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE rt.category = ?
        AND gr.submitted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY s.student_id, s.name, s.student_number
      ORDER BY request_count DESC
      LIMIT 10
    `, [department, period]);
    
    res.json({
      success: true,
      data: {
        overview: departmentStats[0],
        type_breakdown: typeBreakdown,
        priority_distribution: priorityStats,
        daily_trend: dailyTrend,
        top_students: topStudents,
        period_days: parseInt(period)
      }
    });
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

// GET /api/analytics/admin/performance - Performance metrics
router.get('/admin/performance', authenticateAdmin, async (req, res) => {
  try {
    const department = req.admin.department;
    
    // Get response time metrics
    const [responseMetrics] = await pool.execute(`
      SELECT 
        AVG(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)) as avg_first_response_hours,
        MIN(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)) as min_response_hours,
        MAX(TIMESTAMPDIFF(HOUR, gr.submitted_at, ar.created_at)) as max_response_hours
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      JOIN admin_responses ar ON gr.request_id = ar.request_id
      WHERE rt.category = ?
        AND ar.created_at = (
          SELECT MIN(ar2.created_at) 
          FROM admin_responses ar2 
          WHERE ar2.request_id = gr.request_id
        )
        AND gr.submitted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, [department]);
    
    // Get resolution rate by priority
    const [resolutionByPriority] = await pool.execute(`
      SELECT 
        gr.priority,
        COUNT(*) as total_requests,
        SUM(CASE WHEN gr.status = 'Completed' THEN 1 ELSE 0 END) as completed_requests,
        ROUND((SUM(CASE WHEN gr.status = 'Completed' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as completion_rate
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE rt.category = ?
        AND gr.submitted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY gr.priority
      ORDER BY FIELD(gr.priority, 'Urgent', 'High', 'Medium', 'Low')
    `, [department]);
    
    // Get admin workload
    const [adminWorkload] = await pool.execute(`
      SELECT 
        COALESCE(au.name, 'Unknown Admin') as admin_name,
        COUNT(ar.response_id) as response_count,
        COUNT(DISTINCT ar.request_id) as unique_requests_handled
      FROM admin_responses ar
      LEFT JOIN admin_users au ON ar.admin_id = au.admin_id
      JOIN guidance_requests gr ON ar.request_id = gr.request_id
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE rt.category = ?
        AND ar.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY ar.admin_id, au.name
      ORDER BY response_count DESC
    `, [department]);
    
    res.json({
      success: true,
      data: {
        response_metrics: responseMetrics[0] || {
          avg_first_response_hours: null,
          min_response_hours: null,
          max_response_hours: null
        },
        resolution_by_priority: resolutionByPriority,
        admin_workload: adminWorkload
      }
    });
  } catch (error) {
    console.error('Error fetching performance analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance analytics'
    });
  }
});

// GET /api/analytics/admin/export - Export analytics data
router.get('/admin/export', authenticateAdmin, async (req, res) => {
  try {
    const department = req.admin.department;
    const { format = 'json', period = '30' } = req.query;
    
    // Get comprehensive data for export
    const [exportData] = await pool.execute(`
      SELECT 
        gr.request_id,
        s.student_number,
        s.name as student_name,
        s.email as student_email,
        rt.type_name,
        gr.content,
        gr.priority,
        gr.status,
        gr.submitted_at,
        gr.updated_at,
        gr.resolved_at,
        TIMESTAMPDIFF(HOUR, gr.submitted_at, gr.resolved_at) as resolution_hours,
        COUNT(ar.response_id) as response_count,
        COUNT(a.attachment_id) as attachment_count
      FROM guidance_requests gr
      JOIN students s ON gr.student_id = s.student_id
      JOIN request_types rt ON gr.type_id = rt.type_id
      LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
      LEFT JOIN attachments a ON gr.request_id = a.request_id
      WHERE rt.category = ?
        AND gr.submitted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY gr.request_id
      ORDER BY gr.submitted_at DESC
    `, [department, period]);
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = Object.keys(exportData[0] || {}).join(',');
      const csvRows = exportData.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
        ).join(',')
      );
      const csvContent = [csvHeader, ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${department}_analytics_${period}days.csv"`);
      res.send(csvContent);
    } else {
      res.json({
        success: true,
        data: exportData,
        metadata: {
          department,
          period_days: parseInt(period),
          export_date: new Date().toISOString(),
          total_records: exportData.length
        }
      });
    }
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export analytics'
    });
  }
});

// GET /api/analytics/system/overview - System-wide analytics (Super admin only)
router.get('/system/overview', authenticateAdmin, async (req, res) => {
  try {
    // This would typically require super admin role check
    // For now, we'll allow any admin to see system overview
    
    const [systemStats] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT s.student_id) as total_students,
        COUNT(DISTINCT au.admin_id) as total_admins,
        COUNT(gr.request_id) as total_requests,
        COUNT(DISTINCT rt.type_id) as total_request_types
      FROM students s
      CROSS JOIN admin_users au
      CROSS JOIN guidance_requests gr
      CROSS JOIN request_types rt
      WHERE au.is_active = TRUE
    `);
    
    const [departmentStats] = await pool.execute(`
      SELECT 
        rt.category as department,
        COUNT(gr.request_id) as request_count,
        AVG(CASE 
          WHEN gr.resolved_at IS NOT NULL 
          THEN TIMESTAMPDIFF(HOUR, gr.submitted_at, gr.resolved_at) 
          ELSE NULL 
        END) as avg_resolution_hours
      FROM request_types rt
      LEFT JOIN guidance_requests gr ON rt.type_id = gr.type_id
      GROUP BY rt.category
      ORDER BY request_count DESC
    `);
    
    res.json({
      success: true,
      data: {
        system_overview: systemStats[0],
        department_performance: departmentStats
      }
    });
  } catch (error) {
    console.error('Error fetching system analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system analytics'
    });
  }
});

module.exports = router;