// backend/middleware/validation.js - FIXED 24-hour limit implementation
const { pool } = require('../config/database');
const { workingHoursUtils } = require('./workingHours');

// Request oluşturma validasyonu - 24 SAATLİK LİMİT DÜZELTİLDİ
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
    
    // ⭐ YENİ: Mesai saati kontrolü - önce bu kontrol yapılıyor
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
      'SELECT student_id, name, email FROM students WHERE student_id = ?',
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
    
    // ⭐ FIXED: 24 saat limit kontrolü - Mesai saatleri dahilinde günde en fazla 1 request
    console.log('🕐 Checking 24-hour limit for student:', student_id);
    
    const [recentRequests] = await pool.execute(`
      SELECT 
        COUNT(*) as recent_count,
        MAX(submitted_at) as last_request_time
      FROM guidance_requests 
      WHERE student_id = ? AND submitted_at >= NOW() - INTERVAL 24 HOUR
    `, [student_id]);
    
    const recentCount = recentRequests[0].recent_count;
    const lastRequestTime = recentRequests[0].last_request_time;
    
    console.log('📊 24-hour check result:', {
      studentId: student_id,
      recentCount: recentCount,
      lastRequestTime: lastRequestTime,
      limit: 1
    });
    
    if (recentCount >= 1) {
      const lastRequestDate = new Date(lastRequestTime);
      const nextAllowedTime = new Date(lastRequestDate.getTime() + 24 * 60 * 60 * 1000);
      const hoursLeft = Math.ceil((nextAllowedTime - new Date()) / (1000 * 60 * 60));
      
      return res.status(429).json({
        success: false,
        error: 'You can only submit 1 request per 24 hours during working hours',
        errorCode: 'DAILY_LIMIT_EXCEEDED',
        details: {
          current_24h_count: recentCount,
          max_daily_allowed: 1,
          last_request_time: lastRequestTime,
          next_allowed_time: nextAllowedTime.toISOString(),
          hours_remaining: hoursLeft
        },
        guidance: {
          message: `You submitted a request ${hoursLeft} hours ago`,
          wait_time: `Please wait ${hoursLeft} more hours before submitting another request`,
          next_available: `Next request available: ${nextAllowedTime.toLocaleString('tr-TR')}`
        }
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
    
    // Add validation success info to request
    req.validationInfo = {
      checkedAt: new Date().toISOString(),
      student: students[0],
      requestType: requestTypes[0],
      workingHours: workingHoursCheck,
      recent24hCount: recentCount,
      pendingRequestCount: pendingRequests[0].pending_count,
      nextAllowedTime: recentCount > 0 ? 
        new Date(new Date(lastRequestTime).getTime() + 24 * 60 * 60 * 1000) : 
        new Date()
    };
    
    console.log('✅ Request validation passed:', {
      studentId: student_id,
      requestType: requestTypes[0].type_name,
      recent24hCount: recentCount,
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

// ⭐ YENİ: Rate limiting validation - saatlik kontrol
const validateRateLimit = async (req, res, next) => {
  try {
    const { student_id } = req.body;
    
    if (!student_id) {
      return next(); // Skip if no student_id (will be caught by other validation)
    }
    
    console.log('⏰ Checking hourly rate limit for student:', student_id);
    
    // Check requests in last hour
    const [hourlyRequests] = await pool.execute(`
      SELECT 
        COUNT(*) as hourly_count,
        MAX(submitted_at) as last_request_time
      FROM guidance_requests 
      WHERE student_id = ? AND submitted_at >= NOW() - INTERVAL 1 HOUR
    `, [student_id]);
    
    const hourlyCount = hourlyRequests[0].hourly_count;
    
    console.log('📊 Hourly rate limit check:', {
      studentId: student_id,
      hourlyCount: hourlyCount,
      limit: 1 // Changed from 2 to 1 for stricter control
    });
    
    if (hourlyCount >= 1) { // Saatte 1 request limiti
      const lastRequestTime = new Date(hourlyRequests[0].last_request_time);
      const nextAllowedTime = new Date(lastRequestTime.getTime() + 60 * 60 * 1000);
      const minutesLeft = Math.ceil((nextAllowedTime - new Date()) / (1000 * 60));
      
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded: Maximum 1 request per hour',
        errorCode: 'HOURLY_RATE_LIMIT_EXCEEDED',
        details: {
          current_hourly_count: hourlyCount,
          max_hourly_allowed: 1,
          last_request_time: lastRequestTime.toISOString(),
          next_allowed_time: nextAllowedTime.toISOString(),
          minutes_remaining: minutesLeft
        },
        guidance: {
          message: `You submitted a request ${Math.floor((new Date() - lastRequestTime) / (1000 * 60))} minutes ago`,
          wait_time: `Please wait ${minutesLeft} more minutes`,
          retry_after: `${minutesLeft} minutes`
        }
      });
    }
    
    req.rateLimitInfo = {
      checkedAt: new Date().toISOString(),
      hourlyCount: hourlyCount,
      maxHourlyAllowed: 1
    };
    
    next();
  } catch (error) {
    console.error('❌ Rate limit validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Rate limit validation failed'
    });
  }
};

// ⭐ IMPROVED: Debugging helper for request limits
const debugStudentLimits = async (studentId) => {
  try {
    console.group(`🔍 Debug Limits for Student ${studentId}`);
    
    // Check 24-hour requests
    const [day24Requests] = await pool.execute(`
      SELECT 
        request_id, 
        submitted_at, 
        status,
        TIMESTAMPDIFF(HOUR, submitted_at, NOW()) as hours_ago
      FROM guidance_requests 
      WHERE student_id = ? AND submitted_at >= NOW() - INTERVAL 24 HOUR
      ORDER BY submitted_at DESC
    `, [studentId]);
    
    console.log('📅 Last 24 hours:', day24Requests);
    
    // Check hourly requests
    const [hourlyRequests] = await pool.execute(`
      SELECT 
        request_id, 
        submitted_at, 
        status,
        TIMESTAMPDIFF(MINUTE, submitted_at, NOW()) as minutes_ago
      FROM guidance_requests 
      WHERE student_id = ? AND submitted_at >= NOW() - INTERVAL 1 HOUR
      ORDER BY submitted_at DESC
    `, [studentId]);
    
    console.log('⏰ Last hour:', hourlyRequests);
    
    // Check pending requests
    const [pendingRequests] = await pool.execute(`
      SELECT COUNT(*) as pending_count 
      FROM guidance_requests 
      WHERE student_id = ? AND status = 'Pending'
    `, [studentId]);
    
    console.log('⏳ Pending requests:', pendingRequests[0]);
    
    console.groupEnd();
    
    return {
      last24h: day24Requests,
      lastHour: hourlyRequests,
      pending: pendingRequests[0]
    };
  } catch (error) {
    console.error('❌ Debug limits error:', error);
    return null;
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

// Request type validation
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

// File validation for request creation
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

// Working hours validation wrapper (for explicit use)
const validateWorkingHoursOnly = (req, res, next) => {
  const { validateWorkingHours } = require('./workingHours');
  return validateWorkingHours(req, res, next);
};

// ⭐ UPDATED: Complete validation with proper order
const validateCreateRequestComplete = async (req, res, next) => {
  console.log('🔍 Starting complete request validation...');
  
  try {
    // 1. Working hours check (first - most restrictive)
    const workingHoursCheck = workingHoursUtils.isWithinWorkingHours();
    if (!workingHoursCheck.isAllowed) {
      return res.status(423).json({
        success: false,
        error: 'Requests can only be created during working hours',
        errorCode: 'OUTSIDE_WORKING_HOURS',
        details: workingHoursCheck
      });
    }
    
    // 2. Rate limiting check (hourly)
    await new Promise((resolve, reject) => {
      validateRateLimit(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // 3. Main validation (includes 24-hour check)
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
  validateCreateRequestComplete,
  debugStudentLimits // Export debug function
};