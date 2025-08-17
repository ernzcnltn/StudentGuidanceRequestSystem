
// backend/middleware/validation.js - COMPLETE FUNCTION

const { pool } = require('../config/database');
const { 
  validateWorkingHoursAndCalendar, 
  enhancedWorkingHoursUtils 
} = require('./academicCalendar');

// ⭐ COMPLETE validateCreateRequest function with calendar integration
const validateCreateRequest = async (req, res, next) => {
  try {
    const { student_id, type_id, content, priority = 'Medium' } = req.body;
    
    console.log('🔍 Validating request creation with academic calendar:', {
      student_id,
      type_id,
      contentLength: content?.length,
      priority
    });

    // ===== BASIC FIELD VALIDATION (ÖNCE GELEN KOD) =====
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

    // ===== CALENDAR VALIDATION (YENİ EKLENEN KOD) =====
    // ✅ FIX: Enhanced working hours and calendar check with error handling
    let workingHoursCheck;
    try {
      workingHoursCheck = await enhancedWorkingHoursUtils.isWithinWorkingHoursAndCalendar();
    } catch (calendarError) {
      console.error('❌ Calendar check error in validation:', calendarError);
      
      // Fallback to basic working hours check
      const kktcDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
      const dayOfWeek = kktcDate.getDay();
      const hours = kktcDate.getHours();
      const minutes = kktcDate.getMinutes();
      const currentTimeInMinutes = hours * 60 + minutes;
      
      const workStartMinutes = 8 * 60 + 30; // 08:30
      const workEndMinutes = 17 * 60 + 30;   // 17:30
      
      const isWorkingTime = dayOfWeek !== 0 && dayOfWeek !== 6 && 
                           currentTimeInMinutes >= workStartMinutes && 
                           currentTimeInMinutes < workEndMinutes;
      
      workingHoursCheck = {
        isAllowed: isWorkingTime,
        reason: isWorkingTime ? 'working_hours' : 
                (dayOfWeek === 0 || dayOfWeek === 6) ? 'weekend' : 'outside_hours',
        message: isWorkingTime ? 
          'Request can be created during working hours' : 
          'Requests can only be created during working hours (Monday-Friday 08:30-17:30)',
        currentTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        date: kktcDate.toISOString().split('T')[0],
        calendar_error: true
      };
    }
    
    if (!workingHoursCheck.isAllowed) {
      let nextWorkingTime;
      try {
        nextWorkingTime = await enhancedWorkingHoursUtils.getNextWorkingTime();
      } catch (nextTimeError) {
        console.error('❌ Next working time error:', nextTimeError);
        // Fallback next working time calculation
        const now = new Date();
        let nextDay = new Date(now);
        do {
          nextDay.setDate(nextDay.getDate() + 1);
        } while (nextDay.getDay() === 0 || nextDay.getDay() === 6);
        nextDay.setHours(8, 30, 0, 0);
        
        nextWorkingTime = {
          date: nextDay.toLocaleDateString('tr-TR'),
          time: '08:30',
          fullDateTime: nextDay.toISOString(),
          dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nextDay.getDay()],
          daysAhead: Math.ceil((nextDay - now) / (1000 * 60 * 60 * 24))
        };
      }
      
      // Enhanced error response with calendar information
      let errorMessage = workingHoursCheck.message;
      let errorCode = workingHoursCheck.code || 'ACCESS_RESTRICTED';
      let guidance = {
        message: 'Please submit your request during available times',
        schedule: 'Monday to Friday, 08:30 - 17:30 (Turkey Time)',
        nextOpening: nextWorkingTime ? 
          `Next available: ${nextWorkingTime.date} at ${nextWorkingTime.time}` : 
          'Next working day at 08:30'
      };

      // Specific guidance for academic holidays
      if (workingHoursCheck.reason === 'academic_holiday') {
        errorMessage = `Academic Holiday Restriction: ${workingHoursCheck.message}`;
        errorCode = 'ACADEMIC_HOLIDAY';
        guidance.message = 'Requests cannot be submitted during academic holidays';
        guidance.holiday_info = workingHoursCheck.holiday_details;
        
        if (workingHoursCheck.next_available) {
          guidance.next_available_date = workingHoursCheck.next_available;
        }
      } else if (workingHoursCheck.reason === 'weekend') {
        errorCode = 'WEEKEND_NOT_ALLOWED';
        errorMessage = 'Weekend Restriction: Requests cannot be submitted on weekends';
      } else if (workingHoursCheck.reason === 'outside_hours' || workingHoursCheck.reason === 'too_early' || workingHoursCheck.reason === 'too_late') {
        errorCode = 'OUTSIDE_WORKING_HOURS';
        errorMessage = 'Outside Working Hours: Requests can only be created Monday-Friday 08:30-17:30';
      }
      
      // Add calendar error warning if applicable
      if (workingHoursCheck.calendar_error) {
        guidance.warning = 'Academic calendar could not be verified';
      }
      
      return res.status(423).json({
        success: false,
        error: errorMessage,
        errorCode: errorCode,
        details: {
          reason: workingHoursCheck.reason,
          currentTime: workingHoursCheck.currentTime,
          currentDate: workingHoursCheck.date,
          workingHours: '08:30-17:30',
          workingDays: 'Monday - Friday',
          timezone: 'Turkey Time (GMT+3)',
          nextAvailableTime: nextWorkingTime,
          holiday_details: workingHoursCheck.holiday_details || null,
          academic_calendar_enabled: !workingHoursCheck.calendar_error,
          calendar_error: workingHoursCheck.calendar_error || false
        },
        guidance: guidance
      });
    }

    // ===== 24-HOUR LIMIT CHECK (SONRA GELEN KOD) =====
    // ✅ FIXED: 24 saat limit kontrolü - Academic calendar aware with error handling
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
      
      // ✅ FIXED: Check if next allowed time is during working hours and not a holiday with error handling
      let actualNextAvailable = nextAllowedTime;
      
      try {
        const nextAllowedTimeCheck = await enhancedWorkingHoursUtils.isWithinWorkingHoursAndCalendar(nextAllowedTime);
        
        if (!nextAllowedTimeCheck.isAllowed) {
          // If 24-hour period ends during non-working time, find next working time
          try {
            const nextWorkingTime = await enhancedWorkingHoursUtils.getNextWorkingTime(nextAllowedTime);
            if (nextWorkingTime && nextWorkingTime.fullDateTime) {
              actualNextAvailable = new Date(nextWorkingTime.fullDateTime);
            }
          } catch (nextTimeError) {
            console.error('❌ Next working time calculation error:', nextTimeError);
            // Use fallback calculation
            let nextWorkingDay = new Date(nextAllowedTime);
            while (nextWorkingDay.getDay() === 0 || nextWorkingDay.getDay() === 6) {
              nextWorkingDay.setDate(nextWorkingDay.getDate() + 1);
            }
            nextWorkingDay.setHours(8, 30, 0, 0);
            actualNextAvailable = nextWorkingDay;
          }
        }
      } catch (calendarCheckError) {
        console.error('❌ Calendar check for next available time failed:', calendarCheckError);
        // Use the original 24-hour time if calendar check fails
        actualNextAvailable = nextAllowedTime;
      }
      
      const actualHoursLeft = Math.ceil((actualNextAvailable - new Date()) / (1000 * 60 * 60));
      
      return res.status(429).json({
        success: false,
        error: 'You can only submit 1 request per 24 hours during working hours',
        errorCode: 'DAILY_LIMIT_EXCEEDED',
        details: {
          current_24h_count: recentCount,
          max_daily_allowed: 1,
          last_request_time: lastRequestTime,
          next_allowed_time_24h: nextAllowedTime.toISOString(),
          actual_next_available_time: actualNextAvailable.toISOString(),
          hours_remaining: actualHoursLeft,
          academic_calendar_considered: true
        },
        guidance: {
          message: `You submitted a request ${Math.floor((new Date() - lastRequestDate) / (1000 * 60 * 60))} hours ago`,
          wait_time: `Please wait ${actualHoursLeft} more hours before submitting another request`,
          next_available: `Next request available: ${actualNextAvailable.toLocaleString('tr-TR')}`,
          note: 'Next available time considers working hours and academic calendar'
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
    
    // ===== SUCCESS - ADD VALIDATION INFO (SON KISIM) =====
    // ✅ FIXED: Add enhanced validation success info to request
    req.validationInfo = {
      checkedAt: new Date().toISOString(),
      student: students[0],
      requestType: requestTypes[0],
      workingHours: workingHoursCheck,
      recent24hCount: recentCount,
      pendingRequestCount: pendingRequests[0].pending_count,
      nextAllowedTime: recentCount > 0 ? 
        new Date(new Date(lastRequestTime).getTime() + 24 * 60 * 60 * 1000) : 
        new Date(),
      academicCalendarValidated: !workingHoursCheck.calendar_error,
      currentDate: workingHoursCheck.date,
      isAcademicHoliday: workingHoursCheck.reason === 'academic_holiday',
      calendarError: workingHoursCheck.calendar_error || false
    };
    
    console.log('✅ Request validation passed with academic calendar:', {
      studentId: student_id,
      requestType: requestTypes[0].type_name,
      recent24hCount: recentCount,
      pendingCount: pendingRequests[0].pending_count,
      academicCalendarOk: workingHoursCheck.isAllowed,
      calendarError: workingHoursCheck.calendar_error || false
    });
    
    next(); // ✅ Validation passed, proceed to next middleware
    
  } catch (error) {
    console.error('❌ Enhanced validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Enhanced validation failed',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// ⭐ NEW: Academic calendar specific validation middleware
const validateAcademicCalendarOnly = async (req, res, next) => {
  try {
    console.log(' Validating academic calendar restrictions...');
    
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Check if academic calendar is enabled with error handling
    let calendarSettings;
    try {
      [calendarSettings] = await pool.execute(`
        SELECT setting_value FROM academic_settings 
        WHERE setting_key = 'academic_calendar_enabled'
      `);
    } catch (settingsError) {
      console.error('❌ Calendar settings check failed:', settingsError);
      req.academicCalendarInfo = {
        enabled: false,
        reason: 'settings_error',
        message: 'Academic calendar settings unavailable',
        error: settingsError.message
      };
      return next();
    }
    
    if (calendarSettings.length === 0 || calendarSettings[0].setting_value !== 'true') {
      console.log(' Academic calendar is disabled, skipping validation');
      req.academicCalendarInfo = {
        enabled: false,
        reason: 'disabled',
        message: 'Academic calendar restrictions are disabled'
      };
      return next();
    }

    // Get holiday information for today with error handling
    let holidayResult;
    try {
      [holidayResult] = await pool.execute(`
        SELECT is_academic_holiday_detailed(?) as holiday_info
      `, [currentDate]);
    } catch (holidayCheckError) {
      console.error('❌ Holiday check function failed:', holidayCheckError);
      req.academicCalendarInfo = {
        enabled: true,
        isHoliday: false,
        reason: 'function_error',
        message: 'Holiday check function unavailable',
        error: holidayCheckError.message
      };
      return next();
    }

    if (!holidayResult[0]?.holiday_info) {
      req.academicCalendarInfo = {
        enabled: true,
        isHoliday: false,
        reason: 'no_data',
        message: 'No academic calendar data available'
      };
      return next();
    }

    let holidayInfo;
    try {
      holidayInfo = JSON.parse(holidayResult[0].holiday_info);
    } catch (parseError) {
      console.error('❌ Holiday info parsing failed:', parseError);
      req.academicCalendarInfo = {
        enabled: true,
        isHoliday: false,
        reason: 'parse_error',
        message: 'Holiday information format error',
        error: parseError.message
      };
      return next();
    }
    
    if (holidayInfo.is_holiday) {
      // Get next available date with error handling
      let nextAvailable = null;
      try {
        const [nextAvailableResult] = await pool.execute(`
          SELECT get_next_request_creation_date(?) as next_info
        `, [currentDate]);

        if (nextAvailableResult[0]?.next_info) {
          nextAvailable = JSON.parse(nextAvailableResult[0].next_info);
        }
      } catch (nextDateError) {
        console.error('❌ Next available date check failed:', nextDateError);
        // Continue without next date info
      }

      return res.status(423).json({
        success: false,
        error: `Academic Holiday: ${holidayInfo.names || 'Holiday period'}`,
        errorCode: 'ACADEMIC_HOLIDAY',
        details: {
          reason: 'academic_holiday',
          currentDate: currentDate,
          holidayNames: holidayInfo.names,
          holidayTypes: holidayInfo.types,
          isRecurring: holidayInfo.is_recurring,
          priority: holidayInfo.priority,
          nextAvailable: nextAvailable
        },
        guidance: {
          message: 'Requests cannot be submitted during academic holidays',
          currentHolidays: holidayInfo.names,
          nextAvailableDate: nextAvailable?.success ? nextAvailable.formatted_date : 'Unknown',
          contactInfo: 'For urgent matters, please contact student services directly'
        }
      });
    }

    req.academicCalendarInfo = {
      enabled: true,
      isHoliday: false,
      reason: 'regular_day',
      message: 'Regular working day - no academic restrictions',
      date: currentDate
    };
    
    console.log('✅ Academic calendar validation passed');
    next();
    
  } catch (error) {
    console.error('❌ Academic calendar validation error:', error);
    
    // In case of error, allow the request to proceed but log the issue
    req.academicCalendarInfo = {
      enabled: false,
      reason: 'error',
      message: 'Academic calendar check failed',
      error: error.message
    };
    
    console.warn('⚠️ Academic calendar validation failed, proceeding without restriction');
    next();
  }
};

// Export all functions including enhanced versions
module.exports = {
  validateCreateRequest,
  validateAcademicCalendarOnly,
  
  // Existing validations (unchanged)
  validateStatusUpdate: (req, res, next) => {
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
    
    req.statusUpdateInfo = {
      checkedAt: new Date().toISOString(),
      newStatus: status,
      hasResponse: !!response_content
    };
    
    next();
  },
  
  validateIdParam: (req, res, next) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID parameter'
      });
    }
    
    req.params.id = id;
    next();
  },
  
  // Rate limiting with calendar awareness (enhanced)
  validateRateLimit: async (req, res, next) => {
    try {
      const { student_id } = req.body;
      
      if (!student_id) {
        return next(); // Skip if no student_id
      }
      
      console.log('⏰ Checking hourly rate limit for student:', student_id);
      
      const [hourlyRequests] = await pool.execute(`
        SELECT 
          COUNT(*) as hourly_count,
          MAX(submitted_at) as last_request_time
        FROM guidance_requests 
        WHERE student_id = ? AND submitted_at >= NOW() - INTERVAL 1 HOUR
      `, [student_id]);
      
      const hourlyCount = hourlyRequests[0].hourly_count;
      
      if (hourlyCount >= 1) {
        const lastRequestTime = new Date(hourlyRequests[0].last_request_time);
        const nextAllowedTime = new Date(lastRequestTime.getTime() + 60 * 60 * 1000);
        
        // Check if next allowed time considers academic calendar (with error handling)
        let actualNextAvailable = nextAllowedTime;
        
        try {
          const nextAllowedTimeCheck = await enhancedWorkingHoursUtils.isWithinWorkingHoursAndCalendar(nextAllowedTime);
          if (!nextAllowedTimeCheck.isAllowed) {
            const nextWorkingTime = await enhancedWorkingHoursUtils.getNextWorkingTime(nextAllowedTime);
            if (nextWorkingTime && nextWorkingTime.fullDateTime) {
              actualNextAvailable = new Date(nextWorkingTime.fullDateTime);
            }
          }
        } catch (calendarError) {
          console.warn('⚠️ Calendar check failed for rate limit, using original time:', calendarError);
          // Use original time if calendar check fails
        }
        
        const minutesLeft = Math.ceil((actualNextAvailable - new Date()) / (1000 * 60));
        
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded: Maximum 1 request per hour',
          errorCode: 'HOURLY_RATE_LIMIT_EXCEEDED',
          details: {
            current_hourly_count: hourlyCount,
            max_hourly_allowed: 1,
            last_request_time: lastRequestTime.toISOString(),
            next_allowed_time_1h: nextAllowedTime.toISOString(),
            actual_next_available_time: actualNextAvailable.toISOString(),
            minutes_remaining: minutesLeft,
            academic_calendar_considered: true
          },
          guidance: {
            message: `You submitted a request ${Math.floor((new Date() - lastRequestTime) / (1000 * 60))} minutes ago`,
            wait_time: `Please wait ${minutesLeft} more minutes`,
            retry_after: `${minutesLeft} minutes`,
            note: 'Next available time considers academic calendar restrictions'
          }
        });
      }
      
      req.rateLimitInfo = {
        checkedAt: new Date().toISOString(),
        hourlyCount: hourlyCount,
        maxHourlyAllowed: 1,
        academicCalendarConsidered: true
      };
      
      next();
    } catch (error) {
      console.error('❌ Enhanced rate limit validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Rate limit validation failed'
      });
    }
  }
};

// ⭐ UPDATED: Rate limiting validation with academic calendar awareness
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
      limit: 1
    });
    
    if (hourlyCount >= 1) {
      const lastRequestTime = new Date(hourlyRequests[0].last_request_time);
      const nextAllowedTime = new Date(lastRequestTime.getTime() + 60 * 60 * 1000);
      
      // ⭐ NEW: Check if next allowed time considers academic calendar
      const nextAllowedTimeCheck = await enhancedWorkingHoursUtils.isWithinWorkingHoursAndCalendar(nextAllowedTime);
      let actualNextAvailable = nextAllowedTime;
      
      if (!nextAllowedTimeCheck.isAllowed) {
        const nextWorkingTime = await enhancedWorkingHoursUtils.getNextWorkingTime(nextAllowedTime);
        if (nextWorkingTime && nextWorkingTime.fullDateTime) {
          actualNextAvailable = new Date(nextWorkingTime.fullDateTime);
        }
      }
      
      const minutesLeft = Math.ceil((actualNextAvailable - new Date()) / (1000 * 60));
      
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded: Maximum 1 request per hour',
        errorCode: 'HOURLY_RATE_LIMIT_EXCEEDED',
        details: {
          current_hourly_count: hourlyCount,
          max_hourly_allowed: 1,
          last_request_time: lastRequestTime.toISOString(),
          next_allowed_time_1h: nextAllowedTime.toISOString(),
          actual_next_available_time: actualNextAvailable.toISOString(),
          minutes_remaining: minutesLeft,
          academic_calendar_considered: true
        },
        guidance: {
          message: `You submitted a request ${Math.floor((new Date() - lastRequestTime) / (1000 * 60))} minutes ago`,
          wait_time: `Please wait ${minutesLeft} more minutes`,
          retry_after: `${minutesLeft} minutes`,
          note: 'Next available time considers academic calendar restrictions'
        }
      });
    }
    
    req.rateLimitInfo = {
      checkedAt: new Date().toISOString(),
      hourlyCount: hourlyCount,
      maxHourlyAllowed: 1,
      academicCalendarConsidered: true
    };
    
    next();
  } catch (error) {
    console.error('❌ Enhanced rate limit validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Rate limit validation failed'
    });
  }
};

// ⭐ NEW: Complete validation pipeline with academic calendar
const validateCreateRequestWithCalendar = async (req, res, next) => {
  console.log('🔍 Starting complete request validation with academic calendar...');
  
  try {
    // 1. Academic calendar check (first - most restrictive for holidays)
    await new Promise((resolve, reject) => {
      validateAcademicCalendarOnly(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // 2. Enhanced working hours check (includes calendar)
    const workingHoursCheck = await enhancedWorkingHoursUtils.isWithinWorkingHoursAndCalendar();
    if (!workingHoursCheck.isAllowed) {
      const nextWorkingTime = await enhancedWorkingHoursUtils.getNextWorkingTime();
      
      return res.status(423).json({
        success: false,
        error: workingHoursCheck.message,
        errorCode: workingHoursCheck.code || 'ACCESS_RESTRICTED',
        details: {
          ...workingHoursCheck,
          nextAvailableTime: nextWorkingTime
        }
      });
    }
    
    // 3. Rate limiting check (hourly)
    await new Promise((resolve, reject) => {
      validateRateLimit(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // 4. Main validation (includes 24-hour check with calendar awareness)
    await new Promise((resolve, reject) => {
      validateCreateRequest(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ Complete request validation with calendar passed');
    next();
    
  } catch (error) {
    console.error('❌ Complete request validation with calendar failed:', error);
    // Error already handled by individual validators
  }
};

// ⭐ ENHANCED: Debugging helper for request limits with calendar info
const debugStudentLimitsWithCalendar = async (studentId) => {
  try {
    console.group(` Debug Limits with Calendar for Student ${studentId}`);
    
    // Check current calendar status
    const calendarCheck = await enhancedWorkingHoursUtils.isWithinWorkingHoursAndCalendar();
    console.log(' Current Calendar Status:', calendarCheck);
    
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
    
    console.log(' Last 24 hours:', day24Requests);
    
    // Check next available time with calendar
    const nextAvailable = await enhancedWorkingHoursUtils.getNextWorkingTime();
    console.log(' Next available time:', nextAvailable);
    
    // Check academic calendar status
    const currentDate = new Date().toISOString().split('T')[0];
    const [holidayCheck] = await pool.execute(`
      SELECT is_academic_holiday_detailed(?) as holiday_info
    `, [currentDate]);
    
    if (holidayCheck[0]?.holiday_info) {
      const holidayInfo = JSON.parse(holidayCheck[0].holiday_info);
      console.log(' Holiday Status:', holidayInfo);
    }
    
    console.groupEnd();
    
    return {
      last24h: day24Requests,
      calendarStatus: calendarCheck,
      nextAvailable: nextAvailable,
      currentDate: currentDate
    };
  } catch (error) {
    console.error('❌ Debug limits with calendar error:', error);
    return null;
  }
};

// Export all functions including enhanced versions
module.exports = {
  // ⭐ UPDATED: Main validation functions with calendar integration
  validateCreateRequest, // Enhanced with calendar
  validateCreateRequestWithCalendar, // New complete pipeline
  
  // ⭐ NEW: Calendar-specific validations
  validateAcademicCalendarOnly,
  
  // ⭐ UPDATED: Rate limiting with calendar awareness
  validateRateLimit, // Enhanced with calendar
  
  // Existing validations (unchanged)
  validateStatusUpdate: (req, res, next) => {
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
    
    req.statusUpdateInfo = {
      checkedAt: new Date().toISOString(),
      newStatus: status,
      hasResponse: !!response_content
    };
    
    next();
  },
  
  validateIdParam: (req, res, next) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID parameter'
      });
    }
    
    req.params.id = id;
    next();
  },
  
  // ⭐ UPDATED: Debug functions with calendar support
  debugStudentLimits: debugStudentLimitsWithCalendar,
  
  // ⭐ NEW: Calendar testing utilities
  testCalendarValidation: async () => {
    console.group('🧪 Testing Calendar Validation');
    
    try {
      const currentCheck = await enhancedWorkingHoursUtils.isWithinWorkingHoursAndCalendar();
      console.log('Current time check:', currentCheck);
      
      const nextTime = await enhancedWorkingHoursUtils.getNextWorkingTime();
      console.log('Next working time:', nextTime);
      
      console.log('✅ Calendar validation test completed');
      return true;
    } catch (error) {
      console.error('❌ Calendar validation test failed:', error);
      return false;
    } finally {
      console.groupEnd();
    }
  }
};