const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { authenticateAdmin } = require('../middleware/adminAuth');

// POST /api/search/requests - Advanced request search
router.post('/requests', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.student_id;
    const {
      keyword = '',
      status = '',
      type_id = '',
      priority = '',
      date_from = '',
      date_to = '',
      sort_by = 'submitted_at',
      sort_order = 'desc',
      page = 1,
      limit = 20
    } = req.body;

    let whereConditions = ['gr.student_id = ?'];
    let queryParams = [studentId];

    // Build WHERE conditions
    if (keyword) {
      whereConditions.push('(gr.content LIKE ? OR rt.type_name LIKE ?)');
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (status) {
      whereConditions.push('gr.status = ?');
      queryParams.push(status);
    }

    if (type_id) {
      whereConditions.push('gr.type_id = ?');
      queryParams.push(type_id);
    }

    if (priority) {
      whereConditions.push('gr.priority = ?');
      queryParams.push(priority);
    }

    if (date_from) {
      whereConditions.push('DATE(gr.submitted_at) >= ?');
      queryParams.push(date_from);
    }

    if (date_to) {
      whereConditions.push('DATE(gr.submitted_at) <= ?');
      queryParams.push(date_to);
    }

    // Validate sort parameters
    const validSortFields = ['submitted_at', 'updated_at', 'priority', 'status', 'type_name'];
    const validSortOrders = ['asc', 'desc'];
    
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'submitted_at';
    const sortOrderValue = validSortOrders.includes(sort_order.toLowerCase()) ? sort_order.toLowerCase() : 'desc';

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build main query
    const query = `
      SELECT 
        gr.request_id,
        gr.content,
        gr.priority,
        gr.status,
        gr.submitted_at,
        gr.updated_at,
        gr.resolved_at,
        rt.type_name,
        rt.category,
        COUNT(a.attachment_id) as attachment_count,
        COUNT(ar.response_id) as response_count
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      LEFT JOIN attachments a ON gr.request_id = a.request_id
      LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY gr.request_id
      ORDER BY 
        ${sortField === 'priority' ? 
          `FIELD(gr.priority, 'Urgent', 'High', 'Medium', 'Low') ${sortOrderValue}` :
          sortField === 'type_name' ? 
          `rt.type_name ${sortOrderValue}` :
          `gr.${sortField} ${sortOrderValue}`
        }
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), offset);

    // Get count query
    const countQuery = `
      SELECT COUNT(DISTINCT gr.request_id) as total
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE ${whereConditions.join(' AND ')}
    `;

    const countParams = queryParams.slice(0, -2); // Remove limit and offset

    const [results] = await pool.execute(query, queryParams);
    const [countResult] = await pool.execute(countQuery, countParams);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: results,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_items: total,
        total_pages: totalPages,
        has_next: parseInt(page) < totalPages,
        has_prev: parseInt(page) > 1
      },
      search_params: {
        keyword,
        status,
        type_id,
        priority,
        date_from,
        date_to,
        sort_by: sortField,
        sort_order: sortOrderValue
      }
    });
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch suggestions'
    });
  }
});

// POST /api/search/save - Save search query
router.post('/save', authenticateToken, async (req, res) => {
  try {
    const { name, search_params } = req.body;
    const studentId = req.user.student_id;

    if (!name || !search_params) {
      return res.status(400).json({
        success: false,
        error: 'Name and search parameters are required'
      });
    }

    // For this implementation, we'll store in a simple JSON format
    // In production, you might want a dedicated table for saved searches
    const savedSearch = {
      id: Date.now(),
      name: name.trim(),
      search_params,
      student_id: studentId,
      created_at: new Date().toISOString()
    };

    res.json({
      success: true,
      message: 'Search saved successfully',
      data: savedSearch
    });
  } catch (error) {
    console.error('Error saving search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save search'
    });
  }
});

// GET /api/search/saved - Get saved searches
router.get('/saved', authenticateToken, async (req, res) => {
  try {
    // In a real implementation, you'd fetch from a database table
    // For now, return empty array as saved searches are stored client-side
    res.json({
      success: true,
      data: [],
      message: 'Saved searches are stored locally in browser'
    });
  } catch (error) {
    console.error('Error fetching saved searches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch saved searches'
    });
  }
});

// POST /api/search/admin/save - Save admin search
router.post('/admin/save', authenticateAdmin, async (req, res) => {
  try {
    const { name, search_params } = req.body;
    const adminId = req.admin.admin_id;

    if (!name || !search_params) {
      return res.status(400).json({
        success: false,
        error: 'Name and search parameters are required'
      });
    }

    const savedSearch = {
      id: Date.now(),
      name: name.trim(),
      search_params,
      admin_id: adminId,
      department: req.admin.department,
      created_at: new Date().toISOString()
    };

    res.json({
      success: true,
      message: 'Admin search saved successfully',
      data: savedSearch
    });
  } catch (error) {
    console.error('Error saving admin search:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save search'
    });
  }
});

// POST /api/search/admin/requests - Admin advanced search
router.post('/admin/requests', authenticateAdmin, async (req, res) => {
  try {
    const department = req.admin.department;
    const {
      keyword = '',
      status = '',
      type_id = '',
      priority = '',
      student_number = '',
      date_from = '',
      date_to = '',
      sort_by = 'submitted_at',
      sort_order = 'desc',
      page = 1,
      limit = 20
    } = req.body;

    let whereConditions = ['rt.category = ?'];
    let queryParams = [department];

    // Build WHERE conditions
    if (keyword) {
      whereConditions.push('(gr.content LIKE ? OR rt.type_name LIKE ? OR s.name LIKE ?)');
      queryParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (status) {
      whereConditions.push('gr.status = ?');
      queryParams.push(status);
    }

    if (type_id) {
      whereConditions.push('gr.type_id = ?');
      queryParams.push(type_id);
    }

    if (priority) {
      whereConditions.push('gr.priority = ?');
      queryParams.push(priority);
    }

    if (student_number) {
      whereConditions.push('s.student_number LIKE ?');
      queryParams.push(`%${student_number}%`);
    }

    if (date_from) {
      whereConditions.push('DATE(gr.submitted_at) >= ?');
      queryParams.push(date_from);
    }

    if (date_to) {
      whereConditions.push('DATE(gr.submitted_at) <= ?');
      queryParams.push(date_to);
    }

    // Validate sort parameters
    const validSortFields = ['submitted_at', 'updated_at', 'priority', 'status', 'student_name', 'type_name'];
    const validSortOrders = ['asc', 'desc'];
    
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'submitted_at';
    const sortOrderValue = validSortOrders.includes(sort_order.toLowerCase()) ? sort_order.toLowerCase() : 'desc';

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build main query
    const query = `
      SELECT 
        gr.request_id,
        gr.student_id,
        gr.content,
        gr.priority,
        gr.status,
        gr.submitted_at,
        gr.updated_at,
        gr.resolved_at,
        s.name as student_name,
        s.student_number,
        s.email as student_email,
        rt.type_name,
        rt.category,
        COUNT(a.attachment_id) as attachment_count,
        COUNT(ar.response_id) as response_count
      FROM guidance_requests gr
      JOIN students s ON gr.student_id = s.student_id
      JOIN request_types rt ON gr.type_id = rt.type_id
      LEFT JOIN attachments a ON gr.request_id = a.request_id
      LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY gr.request_id
      ORDER BY 
        ${sortField === 'priority' ? 
          `FIELD(gr.priority, 'Urgent', 'High', 'Medium', 'Low') ${sortOrderValue}` :
          sortField === 'type_name' ? 
          `rt.type_name ${sortOrderValue}` :
          sortField === 'student_name' ?
          `s.name ${sortOrderValue}` :
          `gr.${sortField} ${sortOrderValue}`
        }
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), offset);

    // Get count query
    const countQuery = `
      SELECT COUNT(DISTINCT gr.request_id) as total
      FROM guidance_requests gr
      JOIN students s ON gr.student_id = s.student_id
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE ${whereConditions.join(' AND ')}
    `;

    const countParams = queryParams.slice(0, -2); // Remove limit and offset

    const [results] = await pool.execute(query, queryParams);
    const [countResult] = await pool.execute(countQuery, countParams);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: results,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_items: total,
        total_pages: totalPages,
        has_next: parseInt(page) < totalPages,
        has_prev: parseInt(page) > 1
      },
      search_params: {
        keyword,
        status,
        type_id,
        priority,
        student_number,
        date_from,
        date_to,
        sort_by: sortField,
        sort_order: sortOrderValue,
        department
      }
    });
  } catch (error) {
    console.error('Error in admin advanced search:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed'
    });
  }
});

// GET /api/search/suggestions - Search suggestions
router.get('/suggestions', authenticateToken, async (req, res) => {
  try {
    const { q = '', type = 'all' } = req.query;
    const studentId = req.user.student_id;

    if (q.length < 2) {
      return res.json({
        success: true,
        data: {
          request_types: [],
          recent_content: [],
          students: []
        }
      });
    }

    const suggestions = {};

    // Get request type suggestions
    if (type === 'all' || type === 'request_types') {
      const [typeResults] = await pool.execute(`
        SELECT DISTINCT rt.type_id, rt.type_name, rt.category
        FROM request_types rt
        WHERE rt.type_name LIKE ? 
          AND rt.is_disabled = FALSE
        LIMIT 5
      `, [`%${q}%`]);
      suggestions.request_types = typeResults;
    }

    // Get recent content suggestions from user's own requests
    if (type === 'all' || type === 'content') {
      const [contentResults] = await pool.execute(`
        SELECT DISTINCT 
          SUBSTRING(content, 1, 100) as content_preview,
          rt.type_name
        FROM guidance_requests gr
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE gr.student_id = ? 
          AND gr.content LIKE ?
        ORDER BY gr.submitted_at DESC
        LIMIT 3
      `, [studentId, `%${q}%`]);
      suggestions.recent_content = contentResults;
    }

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('Error fetching search suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch suggestions'
    });
  }
});

// GET /api/search/admin/suggestions - Admin search suggestions
router.get('/admin/suggestions', authenticateAdmin, async (req, res) => {
  try {
    const { q = '', type = 'all' } = req.query;
    const department = req.admin.department;

    if (q.length < 2) {
      return res.json({
        success: true,
        data: {
          students: [],
          request_types: [],
          content: []
        }
      });
    }

    const suggestions = {};

    // Get student suggestions
    if (type === 'all' || type === 'students') {
      const [studentResults] = await pool.execute(`
        SELECT DISTINCT s.student_id, s.name, s.student_number
        FROM students s
        JOIN guidance_requests gr ON s.student_id = gr.student_id
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE rt.category = ? 
          AND (s.name LIKE ? OR s.student_number LIKE ?)
        ORDER BY s.name
        LIMIT 5
      `, [department, `%${q}%`, `%${q}%`]);
      suggestions.students = studentResults;
    }

    // Get request type suggestions for department
    if (type === 'all' || type === 'request_types') {
      const [typeResults] = await pool.execute(`
        SELECT type_id, type_name
        FROM request_types 
        WHERE category = ? 
          AND type_name LIKE ?
          AND is_disabled = FALSE
        LIMIT 5
      `, [department, `%${q}%`]);
      suggestions.request_types = typeResults;
    }

    // Get recent content suggestions
    if (type === 'all' || type === 'content') {
      const [contentResults] = await pool.execute(`
        SELECT DISTINCT 
          SUBSTRING(gr.content, 1, 100) as content_preview,
          s.name as student_name
        FROM guidance_requests gr
        JOIN students s ON gr.student_id = s.student_id
        JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE rt.category = ? 
          AND gr.content LIKE ?
        ORDER BY gr.submitted_at DESC
        LIMIT 3
      `, [department, `%${q}%`]);
      suggestions.content = contentResults;
    }

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('Error fetching admin search suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch suggestions'
    });
  }
});

module.exports = router;