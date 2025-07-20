const { pool } = require('../config/database');

// Request oluşturma validasyonu
const validateCreateRequest = async (req, res, next) => {
  try {
    const { student_id, type_id, content, priority = 'Medium' } = req.body;
    
    // Required fields check
    if (!student_id || !type_id || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['student_id', 'type_id', 'content']
      });
    }
    
    
    // Priority validation
    const validPriorities = ['Low', 'Medium', 'High', 'Urgent'];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid priority level',
        valid_priorities: validPriorities
      });
    }



    // Content length check
    if (typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Content must be a non-empty string'
      });
    }
    
    if (content.length > 300) {
      return res.status(400).json({
        success: false,
        error: `Content exceeds 300 characters limit. Current: ${content.length} characters`
      });
    }
    
    // Student exists check
    const [students] = await pool.execute(
      'SELECT student_id FROM students WHERE student_id = ?',
      [student_id]
    );
    
    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }
    
    // Request type exists check
    const [requestTypes] = await pool.execute(
      'SELECT type_id, is_disabled FROM request_types WHERE type_id = ?',
      [type_id]
    );
    
    if (requestTypes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Request type not found'
      });
    }
    
    if (requestTypes[0].is_disabled) {
      return res.status(400).json({
        success: false,
        error: 'This request type is currently disabled'
      });
    }
    
    
    // 24 hour limit check - GEÇICI OLARAK KALDIR
    // const [recentRequests] = await pool.execute(
    //   'SELECT request_id, submitted_at FROM guidance_requests WHERE student_id = ? AND submitted_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)',
    //   [student_id]
    // );
    
    // if (recentRequests.length > 0) {
    //   const lastRequestTime = new Date(recentRequests[0].submitted_at);
    //   const nextAllowedTime = new Date(lastRequestTime.getTime() + 24 * 60 * 60 * 1000);
      
    //   return res.status(429).json({
    //     success: false,
    //     error: 'You can only submit one request every 24 hours',
    //     next_allowed_time: nextAllowedTime.toISOString()
    //   });
    // }
    
    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation failed'
    });
  }
};

// Status update validasyonu
const validateStatusUpdate = (req, res, next) => {
  const { status, response_content } = req.body;
  
  if (!status) {
    return res.status(400).json({
      success: false,
      error: 'Status is required'
    });
  }
  
  const validStatuses = ['Pending', 'Informed', 'Completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }
  
  if (response_content && typeof response_content !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Response content must be a string'
    });
  }
  
  next();
};

// ID parameter validasyonu
const validateIdParam = (req, res, next) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID parameter'
    });
  }
  
  req.params.id = id;
  next();
};

module.exports = {
  validateCreateRequest,
  validateStatusUpdate,
  validateIdParam
};