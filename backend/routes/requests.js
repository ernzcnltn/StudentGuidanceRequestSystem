// backend/routes/requests.js - FIXED VERSION with rejection details endpoint
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { 
  validateCreateRequest, 
  validateStatusUpdate, 
  validateIdParam,
  validateAcademicCalendarOnly 
} = require('../middleware/validation');
const { upload, handleUploadError } = require('../middleware/upload');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { handleNewRequestAssignment } = require('./adminAuth'); // Import from adminAuth

const { 
  validateWorkingHoursAndCalendarWithAdminBypass 
} = require('../middleware/academicCalendar');

const { 
  checkDepartmentCooldown, 
  recordDepartmentRequest 
} = require('../middleware/departmentCooldown');


// Student auth middleware
const authenticateStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.student = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

// GET /api/requests - Tüm talepleri getir
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        gr.request_id,
        gr.content,
        gr.priority,
        gr.status,
        gr.submitted_at,
        gr.updated_at,
        gr.resolved_at,
        gr.rejected_at,
        gr.rejection_reason,
        s.name as student_name,
        s.student_number,
        s.email as student_email,
        rt.type_name,
        rt.category,
        rt.is_document_required,
        COUNT(a.attachment_id) as attachment_count
      FROM guidance_requests gr
      JOIN students s ON gr.student_id = s.student_id
      JOIN request_types rt ON gr.type_id = rt.type_id
      LEFT JOIN attachments a ON gr.request_id = a.request_id
      GROUP BY gr.request_id
      ORDER BY 
        CASE gr.priority 
          WHEN 'Urgent' THEN 1
          WHEN 'High' THEN 2
          WHEN 'Medium' THEN 3
          WHEN 'Low' THEN 4
        END,
        gr.submitted_at DESC
    `;
    
    const [rows] = await pool.execute(query);
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch requests' 
    });
  }
});


// ✅ NEW: Check current request creation availability
router.get('/availability/current', async (req, res) => {
  try {
    console.log('🕒 Checking current request creation availability...');
    
    // Import calendar utilities
    const { enhancedWorkingHoursUtils } = require('../middleware/academicCalendar');
    
    let availabilityCheck;
    try {
      availabilityCheck = await enhancedWorkingHoursUtils.isWithinWorkingHoursAndCalendar();
    } catch (calendarError) {
      console.error('❌ Calendar availability check failed:', calendarError);
      
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
      
      availabilityCheck = {
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
    
    let nextWorkingTime = null;
    if (!availabilityCheck.isAllowed) {
      try {
        nextWorkingTime = await enhancedWorkingHoursUtils.getNextWorkingTime();
      } catch (nextTimeError) {
        console.error('❌ Next working time calculation failed:', nextTimeError);
        // Fallback calculation
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
    }
    
    res.json({
      success: true,
      data: {
        can_create_request: availabilityCheck.isAllowed,
        reason: availabilityCheck.reason,
        message: availabilityCheck.message,
        current_time: availabilityCheck.currentTime,
        current_date: availabilityCheck.date,
        next_available: nextWorkingTime,
        academic_calendar: {
          enabled: !availabilityCheck.calendar_error,
          error: availabilityCheck.calendar_error || false,
          holiday_details: availabilityCheck.holiday_details || null
        },
        working_hours: {
          schedule: 'Monday-Friday 08:30-17:30',
          timezone: 'Turkey Time (GMT+3)'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Availability check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check availability',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// GET /api/requests/student/:studentId - Belirli bir öğrencinin taleplerini getir
router.get('/student/:studentId', async (req, res) => {
  try {
    const query = `
      SELECT 
        gr.request_id,
        gr.content,
        gr.priority,
        gr.status,
        gr.submitted_at,
        gr.updated_at,
        gr.resolved_at,
        gr.rejected_at,
        gr.rejection_reason,
        rt.type_name,
        rt.category,
        COUNT(a.attachment_id) as attachment_count
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      LEFT JOIN attachments a ON gr.request_id = a.request_id
      WHERE gr.student_id = ?
      GROUP BY gr.request_id
      ORDER BY 
        CASE gr.priority 
          WHEN 'Urgent' THEN 1
          WHEN 'High' THEN 2
          WHEN 'Medium' THEN 3
          WHEN 'Low' THEN 4
        END,
        gr.submitted_at DESC
    `;
    
    const [rows] = await pool.execute(query, [req.params.studentId]);
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching student requests:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch student requests' 
    });
  }
});

// PUT /api/requests/:id/status - Update status with email notification
router.put('/:id/status', validateIdParam, validateStatusUpdate, async (req, res) => {
  try {
    const { status, response_content } = req.body;
    const requestId = req.params.id;
    
    // Get current request details
    const [requestCheck] = await pool.execute(`
      SELECT 
        gr.request_id, 
        gr.status as current_status,
        s.name as student_name,
        s.email as student_email,
        rt.type_name
      FROM guidance_requests gr
      JOIN students s ON gr.student_id = s.student_id
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE gr.request_id = ?
    `, [requestId]);
    
    if (requestCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    const request = requestCheck[0];
    const oldStatus = request.current_status;
    
    // Update request status
    const [result] = await pool.execute(
      'UPDATE guidance_requests SET status = ?, updated_at = NOW(), resolved_at = CASE WHEN ? = "Completed" THEN NOW() ELSE resolved_at END WHERE request_id = ?',
      [status, status, requestId]
    );
    
    // Add response if provided
    if (response_content) {
      await pool.execute(
        'INSERT INTO admin_responses (request_id, response_content, created_at) VALUES (?, ?, NOW())',
        [requestId, response_content]
      );
    }
    
    res.json({
      success: true,
      message: 'Request status updated successfully',
      data: {
        request_id: requestId,
        previous_status: oldStatus,
        new_status: status,
        response_content: response_content || null,
        updated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update request status' 
    });
  }
});


// GET /api/requests/check-limit/:studentId/:typeId
router.get('/check-limit/:studentId/:typeId', async (req, res) => {
  try {
    const { studentId, typeId } = req.params;
    
    // Type'ın kategorisini bul
    const [typeInfo] = await pool.execute(`
      SELECT category FROM request_types WHERE type_id = ?
    `, [typeId]);
    
    if (typeInfo.length === 0) {
      return res.status(404).json({ success: false, error: 'Request type not found' });
    }
    
    const category = typeInfo[0].category;
    
    // Son 24 saatteki aynı kategorideki request sayısı
    const [recentCount] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id  
      WHERE gr.student_id = ? AND rt.category = ? AND gr.submitted_at >= NOW() - INTERVAL 24 HOUR
    `, [studentId, category]);
    
    res.json({
      success: true,
      data: {
        category: category,
        recentRequests: recentCount[0].count,
        canCreate: recentCount[0].count === 0,
        limit: 1,
        period: '24 hours'
      }
    });
  } catch (error) {
    console.error('Check limit error:', error);
    res.status(500).json({ success: false, error: 'Failed to check limit' });
  }
});

// POST /api/requests - Create new request (Student tarafından)
router.post('/', 
  authenticateStudent,
  checkDepartmentCooldown, // Check 24-hour department cooldown
  validateWorkingHoursAndCalendarWithAdminBypass, // Academic calendar + working hours
  validateCreateRequest, // Enhanced validation with calendar
  async (req, res) => {
    try {
      const { type_id, content, priority = 'Medium' } = req.body;
      const studentId = req.student.student_id;

      console.log(' Creating new request with calendar validation:', {
        studentId,
        type_id,
        priority,
        contentLength: content?.length || 0,
        validationInfo: req.validationInfo ? 'Present' : 'Missing',
        calendarInfo: req.workingHoursInfo ? 'Present' : 'Missing'
      });

      // Additional server-side validation
      if (!type_id || !content) {
        return res.status(400).json({
          success: false,
          error: 'Request type and content are required'
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

      // Get request type info for assignment
      const [requestType] = await pool.execute(
        'SELECT type_id, type_name, category, is_disabled FROM request_types WHERE type_id = ?',
        [type_id]
      );

      if (requestType.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request type'
        });
      }

      if (requestType[0].is_disabled) {
        return res.status(400).json({
          success: false,
          error: 'This request type is currently disabled'
        });
      }

      const category = requestType[0].category;

      // Create the request
      const [result] = await pool.execute(`
        INSERT INTO guidance_requests (
          student_id, 
          type_id, 
          content, 
          priority, 
          status, 
          submitted_at
        ) VALUES (?, ?, ?, ?, 'Pending', NOW())
      `, [studentId, type_id, content.trim(), priority]);

      const requestId = result.insertId;

      console.log(`✅ Request created with ID: ${requestId}`);

      // Record department request for cooldown tracking
      const department = req.departmentInfo?.department || category;
      const studentIdForDept = req.departmentInfo?.studentId || studentId;
      await recordDepartmentRequest(studentIdForDept, department);

      // AUTO-ASSIGNMENT LOGIC with error handling
      console.log(`🤖 Starting auto-assignment for request ${requestId} to ${category} department`);
      
      let assignmentInfo = {
        auto_assignment_attempted: false,
        assignment_successful: false
      };

      try {
        const assignmentResult = await handleNewRequestAssignment(requestId);
        assignmentInfo.auto_assignment_attempted = true;
        
        if (assignmentResult?.success) {
          assignmentInfo.assignment_successful = true;
          assignmentInfo.assigned_to = assignmentResult.assignedTo.full_name;
          assignmentInfo.admin_workload = assignmentResult.workload;
          console.log(`✅ Request ${requestId} auto-assigned to ${assignmentResult.assignedTo.full_name}`);
        } else {
          assignmentInfo.assignment_error = assignmentResult?.reason || assignmentResult?.error;
          console.log(`⚠️ Auto-assignment failed for request ${requestId}: ${assignmentInfo.assignment_error}`);
        }
      } catch (assignmentError) {
        console.error('❌ Auto-assignment error (non-critical):', assignmentError);
        assignmentInfo.auto_assignment_attempted = true;
        assignmentInfo.assignment_error = 'Auto-assignment failed but request was created';
      }

      // Success response with enhanced info
      res.status(201).json({
        success: true,
        message: 'Request submitted successfully',
        data: {
          request_id: requestId,
          type_name: requestType[0].type_name,
          category: category,
          priority: priority,
          status: 'Pending',
          submitted_at: new Date().toISOString(),
          assignment_info: assignmentInfo,
          validation_info: {
            academic_calendar_validated: req.validationInfo?.academicCalendarValidated || false,
            calendar_error: req.validationInfo?.calendarError || false,
            working_hours_validated: !!req.workingHoursInfo,
            current_date: req.validationInfo?.currentDate || new Date().toISOString().split('T')[0],
            is_academic_holiday: req.validationInfo?.isAcademicHoliday || false
          }
        }
      });

    } catch (error) {
      console.error('❌ Request creation error:', error);
      
      // Enhanced error response
      let errorMessage = 'Failed to create request';
      let statusCode = 500;
      
      if (error.code === 'ER_DUP_ENTRY') {
        errorMessage = 'Duplicate request detected';
        statusCode = 409;
      } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        errorMessage = 'Invalid student or request type reference';
        statusCode = 400;
      }
      
      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);


// ✅ ENHANCED: Student's own requests with calendar validation info
router.get('/student/me', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.student.student_id;
    const { status, limit = 50 } = req.query;

    console.log(' Fetching student requests with calendar info:', { studentId, status, limit });

    let statusCondition = '';
    const params = [studentId];

    if (status && status !== 'all') {
      statusCondition = ' AND gr.status = ?';
      params.push(status);
    }

    const [requests] = await pool.execute(`
      SELECT 
        gr.request_id,
        gr.content,
        gr.status,
        gr.priority,
        gr.submitted_at,
        gr.updated_at,
        gr.resolved_at,
        gr.assigned_admin_id,
        gr.assigned_at,
        gr.assignment_method,
        
        rt.type_name,
        rt.category,
        rt.description_en,
        
        au.full_name as assigned_admin_name,
        au.email as assigned_admin_email,
        
        COUNT(a.attachment_id) as attachment_count,
        COUNT(ar.response_id) as response_count,
        
        MAX(ar.created_at) as last_response_at
        
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      LEFT JOIN admin_users au ON gr.assigned_admin_id = au.admin_id
      LEFT JOIN attachments a ON gr.request_id = a.request_id
      LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
      WHERE gr.student_id = ? ${statusCondition}
      GROUP BY gr.request_id
      ORDER BY gr.submitted_at DESC
      LIMIT ?
    `, [...params, parseInt(limit)]);

    // Add enhanced info for each request
    const enhancedRequests = requests.map(request => ({
      ...request,
      has_assignment: !!request.assigned_admin_id,
      assignment_delay_hours: request.assigned_at ? 
        Math.round((new Date(request.assigned_at) - new Date(request.submitted_at)) / (1000 * 60 * 60)) : null,
      is_auto_assigned: request.assignment_method === 'auto',
      time_since_submission: Math.round((new Date() - new Date(request.submitted_at)) / (1000 * 60 * 60)),
      time_since_last_update: request.updated_at ? 
        Math.round((new Date() - new Date(request.updated_at)) / (1000 * 60 * 60)) : null
    }));

    console.log(`✅ Retrieved ${enhancedRequests.length} requests for student ${studentId}`);

    res.json({
      success: true,
      data: enhancedRequests,
      meta: {
        total_requests: enhancedRequests.length,
        student_id: studentId,
        filter_status: status || 'all',
        assignment_stats: {
          assigned: enhancedRequests.filter(r => r.has_assignment).length,
          unassigned: enhancedRequests.filter(r => !r.has_assignment).length,
          auto_assigned: enhancedRequests.filter(r => r.is_auto_assigned).length
        }
      }
    });

  } catch (error) {
    console.error('❌ Get student requests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch requests'
    });
  }
});

// POST /api/requests/:id/upload - Dosya yükle
router.post('/:id/upload', upload.array('files', 3), handleUploadError, async (req, res) => {
  try {
    const requestId = req.params.id;
    const files = req.files;
    
    console.log('Uploaded files:', files);
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }
    
    // Check if request exists
    const [requestCheck] = await pool.execute(
      'SELECT request_id FROM guidance_requests WHERE request_id = ?',
      [requestId]
    );
    
    if (requestCheck.length === 0) {
      // Clean up uploaded files
      files.forEach(file => {
        fs.unlinkSync(file.path);
      });
      
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    // Save file information to database
    const uploadedFiles = [];
    for (const file of files) {
      console.log('Saving file to DB:', {
        original: file.originalname,
        filename: file.filename,
        path: file.path
      });
      
      const [result] = await pool.execute(
        'INSERT INTO attachments (request_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)',
        [requestId, file.originalname, file.filename, file.mimetype, file.size]
      );
      
      uploadedFiles.push({
        attachment_id: result.insertId,
        original_name: file.originalname,
        file_name: file.filename,
        file_type: file.mimetype,
        file_size: file.size
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Files uploaded successfully',
      data: {
        request_id: requestId,
        files: uploadedFiles
      }
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to upload files' 
    });
  }
});

// POST /api/requests - Create new request with auto-assignment
router.post('/requests', authenticateStudent, async (req, res) => {
  try {
    const { type_id, content, priority = 'Medium' } = req.body;
    const studentId = req.student.student_id;

    console.log(' Creating new request with auto-assignment:', {
      studentId,
      type_id,
      priority,
      contentLength: content?.length || 0
    });

    // Validation
    if (!type_id || !content) {
      return res.status(400).json({
        success: false,
        error: 'Request type and content are required'
      });
    }

    if (content.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Content must be at least 10 characters long'
      });
    }

    // Get request type info for assignment
    const [requestType] = await pool.execute(
      'SELECT type_id, type_name, category, is_disabled FROM request_types WHERE type_id = ?',
      [type_id]
    );

    if (requestType.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request type'
      });
    }

    if (requestType[0].is_disabled) {
      return res.status(400).json({
        success: false,
        error: 'This request type is currently disabled'
      });
    }

    const category = requestType[0].category;

    // Check if student has pending requests limit
    const [pendingCount] = await pool.execute(`
      SELECT COUNT(*) as pending_requests 
      FROM guidance_requests 
      WHERE student_id = ? AND status = 'Pending'
    `, [studentId]);

    if (pendingCount[0].pending_requests >= 5) {
      return res.status(400).json({
        success: false,
        error: 'You have reached the maximum limit of 5 pending requests'
      });
    }

    // Create the request
    const [result] = await pool.execute(`
      INSERT INTO guidance_requests (
        student_id, 
        type_id, 
        content, 
        priority, 
        status, 
        submitted_at
      ) VALUES (?, ?, ?, ?, 'Pending', NOW())
    `, [studentId, type_id, content.trim(), priority]);

    const requestId = result.insertId;

    console.log(`✅ Request created with ID: ${requestId}`);

    // AUTO-ASSIGNMENT LOGIC
    console.log(`🤖 Starting auto-assignment for request ${requestId} to ${category} department`);
    
    try {
      const assignmentResult = await handleNewRequestAssignment(requestId);
      
      let assignmentInfo = {
        auto_assignment_attempted: true,
        assignment_successful: assignmentResult?.success || false
      };

      if (assignmentResult?.success) {
        assignmentInfo.assigned_to = assignmentResult.assignedTo.full_name;
        assignmentInfo.admin_workload = assignmentResult.workload;
        console.log(`✅ Request ${requestId} auto-assigned to ${assignmentResult.assignedTo.full_name}`);
      } else {
        assignmentInfo.assignment_error = assignmentResult?.reason || assignmentResult?.error;
        console.log(` Auto-assignment failed for request ${requestId}: ${assignmentInfo.assignment_error}`);
      }

      // Return success response with assignment info
      res.status(201).json({
        success: true,
        message: 'Request submitted successfully',
        data: {
          request_id: requestId,
          type_name: requestType[0].type_name,
          category: category,
          priority: priority,
          status: 'Pending',
          submitted_at: new Date().toISOString(),
          assignment_info: assignmentInfo
        }
      });

    } catch (assignmentError) {
      console.error('❌ Auto-assignment error (non-critical):', assignmentError);
      
      // Request created successfully, assignment failed (non-critical)
      res.status(201).json({
        success: true,
        message: 'Request submitted successfully',
        data: {
          request_id: requestId,
          type_name: requestType[0].type_name,
          category: category,
          priority: priority,
          status: 'Pending',
          submitted_at: new Date().toISOString(),
          assignment_info: {
            auto_assignment_attempted: true,
            assignment_successful: false,
            assignment_error: 'Auto-assignment failed but request was created'
          }
        }
      });
    }

  } catch (error) {
    console.error('❌ Request creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create request'
    });
  }
});

// GET /api/requests/student/me - Student's own requests with assignment info
router.get('/requests/student/me', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.student.student_id;
    const { status, limit = 50 } = req.query;

    console.log(' Fetching student requests with assignment info:', { studentId, status, limit });

    let statusCondition = '';
    const params = [studentId];

    if (status && status !== 'all') {
      statusCondition = ' AND gr.status = ?';
      params.push(status);
    }

    const [requests] = await pool.execute(`
      SELECT 
        gr.request_id,
        gr.content,
        gr.status,
        gr.priority,
        gr.submitted_at,
        gr.updated_at,
        gr.resolved_at,
        gr.assigned_admin_id,
        gr.assigned_at,
        gr.assignment_method,
        
        rt.type_name,
        rt.category,
        rt.description_en,
        
        au.full_name as assigned_admin_name,
        au.email as assigned_admin_email,
        
        COUNT(a.attachment_id) as attachment_count,
        COUNT(ar.response_id) as response_count,
        
        MAX(ar.created_at) as last_response_at
        
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      LEFT JOIN admin_users au ON gr.assigned_admin_id = au.admin_id
      LEFT JOIN attachments a ON gr.request_id = a.request_id
      LEFT JOIN admin_responses ar ON gr.request_id = ar.request_id
      WHERE gr.student_id = ? ${statusCondition}
      GROUP BY gr.request_id
      ORDER BY gr.submitted_at DESC
      LIMIT ?
    `, [...params, parseInt(limit)]);

    // Add assignment status for each request
    const enhancedRequests = requests.map(request => ({
      ...request,
      has_assignment: !!request.assigned_admin_id,
      assignment_delay_hours: request.assigned_at ? 
        Math.round((new Date(request.assigned_at) - new Date(request.submitted_at)) / (1000 * 60 * 60)) : null,
      is_auto_assigned: request.assignment_method === 'auto',
      time_since_submission: Math.round((new Date() - new Date(request.submitted_at)) / (1000 * 60 * 60)),
      time_since_last_update: request.updated_at ? 
        Math.round((new Date() - new Date(request.updated_at)) / (1000 * 60 * 60)) : null
    }));

    console.log(`✅ Retrieved ${enhancedRequests.length} requests for student ${studentId}`);

    res.json({
      success: true,
      data: enhancedRequests,
      meta: {
        total_requests: enhancedRequests.length,
        student_id: studentId,
        filter_status: status || 'all',
        assignment_stats: {
          assigned: enhancedRequests.filter(r => r.has_assignment).length,
          unassigned: enhancedRequests.filter(r => !r.has_assignment).length,
          auto_assigned: enhancedRequests.filter(r => r.is_auto_assigned).length
        }
      }
    });

  } catch (error) {
    console.error('❌ Get student requests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch requests'
    });
  }
});

// POST /api/requests/:requestId/priority - Student can update priority of unassigned requests
router.put('/requests/:requestId/priority', authenticateStudent, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { priority } = req.body;
    const studentId = req.student.student_id;

    const validPriorities = ['Low', 'Medium', 'High', 'Urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid priority. Must be: Low, Medium, High, or Urgent'
      });
    }

    // Check if request belongs to student and is not yet handled
    const [request] = await pool.execute(`
      SELECT 
        gr.request_id, 
        gr.status, 
        gr.assigned_admin_id,
        gr.priority as current_priority
      FROM guidance_requests gr
      WHERE gr.request_id = ? AND gr.student_id = ?
    `, [requestId, studentId]);

    if (request.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    const requestData = request[0];

    // Students can only change priority of pending requests
    if (requestData.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        error: 'Can only change priority of pending requests'
      });
    }

    // If request is assigned and priority is being increased, notify admin
    const priorityValues = { 'Low': 1, 'Medium': 2, 'High': 3, 'Urgent': 4 };
    const isIncreasingPriority = priorityValues[priority] > priorityValues[requestData.current_priority];

    const [result] = await pool.execute(`
      UPDATE guidance_requests 
      SET priority = ?, updated_at = NOW()
      WHERE request_id = ?
    `, [priority, requestId]);

    if (result.affectedRows === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update priority'
      });
    }

    // If assigned and priority increased, could trigger notification to admin
    let notificationSent = false;
    if (requestData.assigned_admin_id && isIncreasingPriority) {
      try {
        // Add notification logic here if needed
        console.log(`📢 Priority increased for assigned request ${requestId} - notify admin ${requestData.assigned_admin_id}`);
        notificationSent = true;
      } catch (notificationError) {
        console.error('Failed to send priority notification:', notificationError);
      }
    }

    res.json({
      success: true,
      message: `Priority updated to ${priority}`,
      data: {
        request_id: requestId,
        old_priority: requestData.current_priority,
        new_priority: priority,
        notification_sent: notificationSent,
        is_assigned: !!requestData.assigned_admin_id
      }
    });

  } catch (error) {
    console.error('❌ Update request priority error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update request priority'
    });
  }
});




// GET /api/requests/:id/attachments - Request'e ait dosyaları listele
router.get('/:id/attachments', async (req, res) => {
  try {
    const requestId = req.params.id;
    
    const [rows] = await pool.execute(
      'SELECT attachment_id, file_name, file_path, file_type, file_size, uploaded_at FROM attachments WHERE request_id = ? ORDER BY uploaded_at DESC',
      [requestId]
    );
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch attachments' 
    });
  }
});

// GET /api/requests/attachments/:filename - Download file
router.get('/attachments/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads', filename);
    
    console.log('Download request for:', filename);
    console.log('File path:', filePath);
    
    // Security check - does file actually exist
    if (!fs.existsSync(filePath)) {
      console.log('File not found at:', filePath);
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Get file info from database (for security)
    const [attachments] = await pool.execute(
      'SELECT * FROM attachments WHERE file_path = ?',
      [filename]
    );
    
    if (attachments.length === 0) {
      console.log('File not found in database:', filename);
      return res.status(404).json({
        success: false,
        error: 'File not found in database'
      });
    }
    
    const attachment = attachments[0];
    console.log('Downloading file:', attachment.file_name);
    
    // Set Content-Type
    res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${attachment.file_name}"`);
    
    // Send file
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        if (!res.headersSent) {
          res.status(500).json({ 
            success: false,
            error: 'Failed to send file' 
          });
        }
      } else {
        console.log('File sent successfully:', attachment.file_name);
      }
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to download file' 
    });
  }
});

// GET /api/requests/attachments/:filename - Dosya indirme
router.get('/attachments/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads', filename);
    
    console.log('Download request for:', filename);
    console.log('File path:', filePath);
    
    // Güvenlik kontrolü - dosya gerçekten var mı
    if (!fs.existsSync(filePath)) {
      console.log('File not found at:', filePath);
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Dosya bilgilerini database'den al (güvenlik için)
    const [attachments] = await pool.execute(
      'SELECT * FROM attachments WHERE file_path = ?',
      [filename]
    );
    
    if (attachments.length === 0) {
      console.log('File not found in database:', filename);
      return res.status(404).json({
        success: false,
        error: 'File not found in database'
      });
    }
    
    const attachment = attachments[0];
    console.log('Downloading file:', attachment.file_name);
    
    // Content-Type'ı ayarla
    res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${attachment.file_name}"`);
    
    // Dosyayı gönder
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        if (!res.headersSent) {
          res.status(500).json({ 
            success: false,
            error: 'Failed to send file' 
          });
        }
      } else {
        console.log('File sent successfully:', attachment.file_name);
      }
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to download file' 
    });
  }
});

// FIXED: GET /api/requests/:id/responses - Student Request Responses
router.get('/:id/responses', async (req, res) => {
  try {
    const requestId = req.params.id;
    
    console.log(' Getting responses for request:', requestId);
    
    // Check if request exists
    const [requestCheck] = await pool.execute(
      'SELECT request_id FROM guidance_requests WHERE request_id = ?',
      [requestId]
    );
    
    if (requestCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    // Get admin responses (from admin_responses table)
    const [responses] = await pool.execute(
      `SELECT 
        ar.response_id,
        ar.response_content,
        ar.created_at,
        ar.is_internal,
        COALESCE(au.full_name, au.name, au.username, 'Admin') as created_by_admin
      FROM admin_responses ar
      LEFT JOIN admin_users au ON ar.admin_id = au.admin_id
      WHERE ar.request_id = ? AND ar.is_internal = FALSE
      ORDER BY ar.created_at ASC`,
      [requestId]
    );
    
    console.log(` Found ${responses.length} responses for request ${requestId}`);
    
    res.json({
      success: true,
      data: responses,
      count: responses.length
    });
  } catch (error) {
    console.error('❌ Get student responses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get responses'
    });
  }
});

// NEW: GET /api/requests/:requestId/rejection-details - Student rejection details
router.get('/:requestId/rejection-details', authenticateStudent, async (req, res) => {
  try {
    const { requestId } = req.params;
    const studentId = req.student.student_id; // JWT'den gelen student ID
    
    console.log(' Getting rejection details for request (STUDENT):', { requestId, studentId });
  
    // Student sadece kendi request'inin detaylarını görebilir
    const [rejectionDetails] = await pool.execute(`
      SELECT 
        gr.rejection_reason as reason,
        '' as additional_info,
        gr.rejected_at,
        gr.rejected_by,
        COALESCE(au.full_name, au.name, au.username, 'Admin') as admin_name
      FROM guidance_requests gr
      LEFT JOIN admin_users au ON gr.rejected_by = au.admin_id
      WHERE gr.request_id = ? AND gr.student_id = ? AND gr.status = 'Rejected'
    `, [requestId, studentId]);
    
    if (rejectionDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rejection details not found or request is not rejected'
      });
    }
    
    console.log('✅ Found rejection details:', rejectionDetails[0]);
    
    res.json({
      success: true,
      data: rejectionDetails[0]
    });
  } catch (error) {
    console.error('❌ Get rejection details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rejection details',
      error: error.message
    });
  }
});



// NEW: GET /api/requests/:requestId/rejection-details - Student rejection details
router.get('/:requestId/rejection-details', authenticateStudent, async (req, res) => {
  try {
    const { requestId } = req.params;
    const studentId = req.student.student_id; // JWT'den gelen student ID
    
    console.log(' Getting rejection details for request (STUDENT):', { requestId, studentId });
    
    // Student can only see their own request details
    const [rejectionDetails] = await pool.execute(`
      SELECT 
        gr.rejection_reason as reason,
        '' as additional_info,
        gr.rejected_at,
        gr.rejected_by,
        COALESCE(au.full_name, au.name, au.username, 'Admin') as admin_name
      FROM guidance_requests gr
      LEFT JOIN admin_users au ON gr.rejected_by = au.admin_id
      WHERE gr.request_id = ? AND gr.student_id = ? AND gr.status = 'Rejected'
    `, [requestId, studentId]);
    
    if (rejectionDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rejection details not found or request is not rejected'
      });
    }
    
    console.log('✅ Found rejection details:', rejectionDetails[0]);
    
    res.json({
      success: true,
      data: rejectionDetails[0]
    });
  } catch (error) {
    console.error('❌ Get rejection details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rejection details',
      error: error.message
    });
  }
});



module.exports = router;