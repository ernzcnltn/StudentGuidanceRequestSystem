// backend/middleware/validation.js - UPDATED with Working Hours Integration
const { pool } = require('../config/database');
const { workingHoursUtils } = require('./workingHours');

// Request oluşturma validasyonu - MESAİ SAATİ KONTROLÜ EKLENDİ
const validateCreateRequest = async (req, res, next) => {
  try {
    const { student_id, type_id, content, priority = 'Medium' } = req.body;
    
    console.log('🔍 Validating request creation:', {
      student_id,
      type_id,
      contentLength: content?.length,
      priority
    });

    // Required fields check
    if (!student_id || !type_id || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['student_id', 'type_id', 'content']
      });
    }
    
    // ⭐ YENİ: Mesai saati kontrolü - validateCreateRequest içinde de kontrol
    const workingHoursCheck = workingHoursUtils.isWithinWorkingHours();
    if (!workingHoursCheck.isAllowed) {
      const nextWorkingTime = workingHoursUtils.getNextWorkingTime();
      
      return res.status(423).json({
        success: false,
        error: 'Requests can only be created during working hours',
        errorCode: 'OUTSIDE_WORKING_HOURS',
        details: {
          reason: workingHoursCheck.reason,
          currentTime: workingHoursCheck.currentTime,
          workingHours: '08:30-17:30',
          workingDays: 'Monday - Friday',
          timezone: 'Turkey Time (GMT+3)',
          nextAvailableTime: nextWorkingTime
        },
        guidance: {
          message: 'Please submit your request during working hours',
          schedule: 'Monday to Friday, 08:30 - 17:30 (Turkey Time)',
          nextOpening: nextWorkingTime ? 
            `Next available: ${nextWorkingTime.date} at ${nextWorkingTime.time}` : 
            'Next working day at 08:30'
        }
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

    // Content validation
    if (typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Content must be a non-empty string'
      });
    }
    
    if (content.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Content must be at least 10 characters long'
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
      'SELECT student_id, name, email FROM students WHERE student_id = ? AND is_active = TRUE',
      [student_id]
    );
    
    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Student not found or inactive'
      });
    }
    
    // Request type exists and enabled check
    const [requestTypes] = await pool.execute(
      'SELECT type_id, type_name, category, is_disabled, is_document_required FROM request_types WHERE type_id = ?',
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
    
    // Check pending requests limit (prevent spam)
    const [pendingRequests] = await pool.execute(
      'SELECT COUNT(*) as pending_count FROM guidance_requests WHERE student_id = ? AND status = "Pending"',
      [student_id]
    );
    
    if (pendingRequests[0].pending_count >= 5) {
      return res.status(429).json({
        success: false,
        error: 'You have reached the maximum limit of 5 pending requests',
        current_pending: pendingRequests[0].pending_count,
        max_allowed: 5
      });
    }
    
    // ⭐ YENİ: 24 saat limit kontrolü - Mesai saatleri içinde günde en fazla 3 request
    const [recentRequests] = await pool.execute(`
      SELECT COUNT(*) as recent_count 
      FROM guidance_requests 
      WHERE student_id = ? AND submitted_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `, [student_id]);
    
    if (recentRequests[0].recent_count >= 3) {
      return res.status(429).json({
        success: false,
        error: 'You can only submit 3 requests per day during working hours',
        current_daily_count: recentRequests[0].recent_count,
        max_daily_allowed: 3,
        reset_time: 'Tomorrow at 08:30'
      });
    }
    
    // Add validation success info to request
    req.validationInfo = {
      checkedAt: new Date().toISOString(),
      student: students[0],
      requestType: requestTypes[0],
      workingHours: workingHoursCheck,
      dailyRequestCount: recentRequests[0].recent_count,
      pendingRequestCount: pendingRequests[0].pending_count
    };
    
    console.log('✅ Request validation passed:', {
      studentId: student_id,
      requestType: requestTypes[0].type_name,
      dailyCount: recentRequests[0].recent_count,
      pendingCount: pendingRequests[0].pending_count
    });
    
    next();
  } catch (error) {
    console.error('❌ Validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation failed',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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
  
  const validStatuses = ['Pending', 'Informed', 'Completed', 'Rejected'];
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
  
  // Add status update info
  req.statusUpdateInfo = {
    checkedAt: new Date().toISOString(),
    newStatus: status,
    hasResponse: !!response_content
  };
  
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

// ⭐ YENİ: Request type validation
const validateRequestType = async (req, res, next) => {
  try {
    const { type_id } = req.body;
    
    if (!type_id) {
      return res.status(400).json({
        success: false,
        error: 'Request type ID is required'
      });
    }
    
    const [requestType] = await pool.execute(
      'SELECT type_id, type_name, category, is_disabled, is_document_required FROM request_types WHERE type_id = ?',
      [type_id]
    );
    
    if (requestType.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Request type not found'
      });
    }
    
    if (requestType[0].is_disabled) {
      return res.status(400).json({
        success: false,
        error: 'This request type is currently disabled'
      });
    }
    
    req.requestType = requestType[0];
    next();
  } catch (error) {
    console.error('Request type validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Request type validation failed'
    });
  }
};

// ⭐ YENİ: File validation for request creation
const validateRequestFiles = (req, res, next) => {
  const files = req.files;
  const requestType = req.requestType;
  
  // Document required kontrolü
  if (requestType && requestType.is_document_required && (!files || files.length === 0)) {
    return res.status(400).json({
      success: false,
      error: 'Document upload is required for this request type',
      requestType: requestType.type_name
    });
  }
  
  // File count limit
  if (files && files.length > 3) {
    return res.status(400).json({
      success: false,
      error: 'Maximum 3 files allowed per request',
      provided: files.length,
      maximum: 3
    });
  }
  
  // File size and type validation
  if (files && files.length > 0) {
    const maxSize = 2 * 1024 * 1024; // 2MB
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv'
    ];
    
    for (const file of files) {
      if (file.size > maxSize) {
        return res.status(400).json({
          success: false,
          error: `File "${file.originalname}" exceeds 2MB limit`,
          fileSize: file.size,
          maxSize: maxSize
        });
      }
      
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          error: `File type "${file.mimetype}" is not allowed`,
          fileName: file.originalname,
          allowedTypes: allowedTypes
        });
      }
    }
  }
  
  req.fileValidationInfo = {
    checkedAt: new Date().toISOString(),
    fileCount: files ? files.length : 0,
    documentRequired: requestType ? requestType.is_document_required : false,
    allFilesValid: true
  };
  
  next();
};

// ⭐ YENİ: Working hours validation wrapper (for explicit use)
const validateWorkingHoursOnly = (req, res, next) => {
  const { validateWorkingHours } = require('./workingHours');
  return validateWorkingHours(req, res, next);
};

// ⭐ YENİ: Rate limiting validation
const validateRateLimit = async (req, res, next) => {
  try {
    const { student_id } = req.body;
    
    if (!student_id) {
      return next(); // Skip if no student_id (will be caught by other validation)
    }
    
    // Check requests in last hour
    const [hourlyRequests] = await pool.execute(`
      SELECT COUNT(*) as hourly_count 
      FROM guidance_requests 
      WHERE student_id = ? AND submitted_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `, [student_id]);
    
    if (hourlyRequests[0].hourly_count >= 2) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded: Maximum 2 requests per hour',
        errorCode: 'RATE_LIMIT_EXCEEDED',
        current_hourly_count: hourlyRequests[0].hourly_count,
        max_hourly_allowed: 2,
        retry_after: '1 hour'
      });
    }
    
    req.rateLimitInfo = {
      checkedAt: new Date().toISOString(),
      hourlyCount: hourlyRequests[0].hourly_count,
      maxHourlyAllowed: 2
    };
    
    next();
  } catch (error) {
    console.error('Rate limit validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Rate limit validation failed'
    });
  }
};

// ⭐ YENİ: Combined validation for request creation
const validateCreateRequestComplete = async (req, res, next) => {
  console.log('🔍 Starting complete request validation...');
  
  // Chain multiple validations
  try {
    // 1. Working hours check
    await new Promise((resolve, reject) => {
      validateWorkingHoursOnly(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // 2. Rate limiting check
    await new Promise((resolve, reject) => {
      validateRateLimit(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // 3. Basic validation
    await new Promise((resolve, reject) => {
      validateCreateRequest(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ Complete request validation passed');
    next();
    
  } catch (error) {
    console.error('❌ Complete request validation failed:', error);
    // Error already handled by individual validators
  }
};

module.exports = {
  validateCreateRequest,
  validateStatusUpdate,
  validateIdParam,
  validateRequestType,
  validateRequestFiles,
  validateWorkingHoursOnly,
  validateRateLimit,
  validateCreateRequestComplete
};