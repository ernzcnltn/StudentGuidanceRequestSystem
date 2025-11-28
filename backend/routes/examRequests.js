// backend/routes/examRequests.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken: auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// ===== GET ALL FACULTIES =====
router.get('/faculties', auth, async (req, res) => {
  try {
    console.log('📚 Fetching faculties...');
    
    const [faculties] = await pool.execute(
      `SELECT 
        faculty_id,
        faculty_name,
        faculty_name_tr,
        secretary_email,
        secretary_phone,
        is_active
      FROM faculties 
      WHERE is_active = 1
      ORDER BY faculty_name`
    );

    console.log(`✅ Found ${faculties.length} faculties`);

    res.json({
      success: true,
      data: faculties,
      message: 'Faculties retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error fetching faculties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch faculties',
      message: error.message
    });
  }
});

// ===== GET SINGLE FACULTY =====
router.get('/faculties/:facultyId', auth, async (req, res) => {
  try {
    const { facultyId } = req.params;
    
    console.log('📚 Fetching faculty:', facultyId);
    
    const [faculty] = await pool.execute(
      `SELECT 
        faculty_id,
        faculty_name,
        faculty_name_tr,
        secretary_email,
        secretary_phone,
        is_active
      FROM faculties 
      WHERE faculty_id = ? AND is_active = 1`,
      [facultyId]
    );

    if (faculty.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Faculty not found'
      });
    }

    console.log('✅ Faculty found:', faculty[0].faculty_name);

    res.json({
      success: true,
      data: faculty[0],
      message: 'Faculty retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error fetching faculty:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch faculty',
      message: error.message
    });
  }
});


// ===== GET MY EXAM REQUESTS =====
router.get('/exam-requests/my', auth, async (req, res) => {
  try {
    const studentId = req.user.student_id;
    
    console.log('📋 Fetching exam requests for student:', studentId);

    const [examRequests] = await pool.execute(
      `SELECT 
        er.*,
        f.faculty_name,
        f.faculty_name_tr,
        f.secretary_email,
        (SELECT COUNT(*) FROM exam_request_attachments WHERE exam_request_id = er.exam_request_id) AS attachment_count
      FROM exam_requests er
      INNER JOIN faculties f ON er.faculty_id = f.faculty_id
      WHERE er.student_id = ?
      ORDER BY er.submitted_at DESC`,
      [studentId]
    );

    console.log(`✅ Found ${examRequests.length} exam requests`);

    res.json({
      success: true,
      data: examRequests,
      message: 'Exam requests retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error fetching exam requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch exam requests',
      message: error.message
    });
  }
});



// ===== CREATE EXAM REQUEST =====
router.post('/exam-requests', auth, async (req, res) => {
  try {
    const studentId = req.user.student_id;
    const {
      faculty_id,
      exam_type,
      course_code,
      course_name,
      instructor_name,
      exam_date,
      reason
    } = req.body;

    console.log(' Creating exam request for student:', studentId);

    // Validation
    if (!faculty_id || !exam_type || !course_code || !course_name || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: faculty_id, exam_type, course_code, course_name, reason'
      });
    }

    // Validate exam_type
    if (!['makeup', 'resit'].includes(exam_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid exam_type. Must be "makeup" or "resit"'
      });
    }

    // Check if faculty exists
    const [faculty] = await pool.execute(
      'SELECT faculty_id FROM faculties WHERE faculty_id = ? AND is_active = 1',
      [faculty_id]
    );

    if (faculty.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Faculty not found or inactive'
      });
    }

    // Insert exam request
    const [result] = await pool.execute(
      `INSERT INTO exam_requests 
        (student_id, faculty_id, exam_type, course_code, course_name, instructor_name, exam_date, reason, status, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())`,
      [
        studentId,
        faculty_id,
        exam_type,
        course_code,
        course_name,
        instructor_name || null,
        exam_date || null,
        reason
      ]
    );

    const examRequestId = result.insertId;

    console.log(` Exam request created: #${examRequestId}`);

    // Get the created request details
    const [examRequest] = await pool.execute(
      `SELECT * FROM exam_requests WHERE exam_request_id = ?`,
      [examRequestId]
    );

    res.status(201).json({
      success: true,
      data: {
        exam_request_id: examRequestId,
        ...examRequest[0]
      },
      message: 'Exam request created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating exam request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create exam request',
      message: error.message
    });
  }
});



// ===== GET SINGLE EXAM REQUEST =====
router.get('/exam-requests/:examRequestId', auth, async (req, res) => {
  try {
    const { examRequestId } = req.params;
    const studentId = req.user.student_id;

    console.log('📋 Fetching exam request:', examRequestId);

    const [examRequest] = await pool.execute(
      `SELECT 
        er.*,
        f.faculty_name,
        f.faculty_name_tr,
        f.secretary_email,
        f.secretary_phone,
        s.student_number,
        s.name AS student_name,
        s.email AS student_email,
        s.program AS student_program,
        (SELECT COUNT(*) FROM exam_request_attachments WHERE exam_request_id = er.exam_request_id) AS attachment_count
      FROM exam_requests er
      INNER JOIN faculties f ON er.faculty_id = f.faculty_id
      INNER JOIN students s ON er.student_id = s.student_id
      WHERE er.exam_request_id = ? AND er.student_id = ?`,
      [examRequestId, studentId]
    );

    if (examRequest.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Exam request not found or access denied'
      });
    }

    console.log('✅ Exam request found');

    res.json({
      success: true,
      data: examRequest[0],
      message: 'Exam request retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error fetching exam request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch exam request',
      message: error.message
    });
  }
});

// ===== UPLOAD FILES FOR EXAM REQUEST =====
router.post('/exam-requests/:examRequestId/upload', auth, upload.array('files', 3), async (req, res) => {
  try {
    const { examRequestId } = req.params;
    const studentId = req.user.student_id;
    const files = req.files;

    console.log(`📎 Uploading ${files?.length || 0} files for exam request:`, examRequestId);

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    // Verify exam request belongs to student
    const [examRequest] = await pool.execute(
      'SELECT exam_request_id FROM exam_requests WHERE exam_request_id = ? AND student_id = ?',
      [examRequestId, studentId]
    );

    if (examRequest.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Exam request not found or access denied'
      });
    }

    // Check total file count (max 3)
    const [existingFiles] = await pool.execute(
      'SELECT COUNT(*) as count FROM exam_request_attachments WHERE exam_request_id = ?',
      [examRequestId]
    );

    if (existingFiles[0].count + files.length > 3) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 3 files allowed per exam request'
      });
    }

    // Insert file records
    const uploadedFiles = [];
    for (const file of files) {
      const [result] = await pool.execute(
        `INSERT INTO exam_request_attachments 
          (exam_request_id, file_name, file_path, file_type, file_size)
        VALUES (?, ?, ?, ?, ?)`,
        [
          examRequestId,
          file.originalname,
          file.filename,
          file.mimetype,
          file.size
        ]
      );

      uploadedFiles.push({
        attachment_id: result.insertId,
        file_name: file.originalname,
        file_size: file.size,
        file_type: file.mimetype
      });
    }

    console.log(`✅ Uploaded ${uploadedFiles.length} files successfully`);

    res.json({
      success: true,
      data: uploadedFiles,
      message: `${uploadedFiles.length} file(s) uploaded successfully`
    });
  } catch (error) {
    console.error('❌ Error uploading files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload files',
      message: error.message
    });
  }
});

// ===== GET EXAM REQUEST ATTACHMENTS =====
router.get('/exam-requests/:examRequestId/attachments', auth, async (req, res) => {
  try {
    const { examRequestId } = req.params;
    const studentId = req.user.student_id;

    console.log('📎 Fetching attachments for exam request:', examRequestId);

    // Verify exam request belongs to student
    const [examRequest] = await pool.execute(
      'SELECT exam_request_id FROM exam_requests WHERE exam_request_id = ? AND student_id = ?',
      [examRequestId, studentId]
    );

    if (examRequest.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Exam request not found or access denied'
      });
    }

    const [attachments] = await pool.execute(
      `SELECT 
        attachment_id,
        exam_request_id,
        file_name,
        file_path,
        file_type,
        file_size,
        uploaded_at
      FROM exam_request_attachments
      WHERE exam_request_id = ?
      ORDER BY uploaded_at DESC`,
      [examRequestId]
    );

    console.log(`✅ Found ${attachments.length} attachments`);

    res.json({
      success: true,
      data: attachments,
      message: 'Attachments retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Error fetching attachments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attachments',
      message: error.message
    });
  }
});

// GET /api/exam-requests/:requestId/attachments - Get attachments for an exam request
router.get('/:requestId/attachments', async (req, res) => {
  try {
    const { requestId } = req.params;

    console.log('📎 Fetching attachments for exam request:', requestId);

    // Get attachments from database
    const [attachments] = await pool.execute(
      `SELECT 
        attachment_id,
        exam_request_id,
        file_name,
        file_path,
        file_size,
        mime_type,
        uploaded_at
      FROM exam_request_attachments
      WHERE exam_request_id = ?
      ORDER BY uploaded_at DESC`,
      [requestId]
    );

    console.log(`✅ Found ${attachments.length} attachments`);

    res.json({
      success: true,
      data: attachments
    });
  } catch (error) {
    console.error('❌ Error fetching attachments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attachments'
    });
  }
});



module.exports = router;