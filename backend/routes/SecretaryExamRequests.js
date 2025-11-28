const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateAdmin } = require('../middleware/adminAuth');

// Middleware: Sadece secretary'ler erişebilir
const requireSecretary = (req, res, next) => {
  if (req.admin.role !== 'secretary') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Secretary role required.'
    });
  }
  next();
};

// GET /api/secretary/exam-requests - Get all exam requests for secretary's faculty
router.get('/exam-requests', 
  authenticateAdmin, 
  requireSecretary,
  async (req, res) => {
    try {
      const secretaryDepartment = req.admin.department;
      
      console.log('📋 Fetching exam requests for secretary:', {
        admin_id: req.admin.admin_id,
        department: secretaryDepartment
      });

      // Faculty ID'yi department isminden bul
      const likePattern = '%' + secretaryDepartment + '%';
      const [faculties] = await pool.execute(
        'SELECT faculty_id, faculty_name, faculty_name_tr FROM faculties WHERE faculty_name LIKE ? OR faculty_name_tr LIKE ? OR faculty_name = ? OR faculty_name_tr = ? LIMIT 1',
        [likePattern, likePattern, secretaryDepartment, secretaryDepartment]
      );

      if (faculties.length === 0) {
        console.log('❌ Faculty not found for department:', secretaryDepartment);
        return res.status(404).json({
          success: false,
          error: 'Faculty not found for your department'
        });
      }

      const facultyId = faculties[0].faculty_id;

      // Get exam requests for this faculty
      const [requests] = await pool.execute(
        `SELECT 
          er.*,
          s.student_number,
          s.name AS student_name,
          s.email AS student_email,
          s.program,
          f.faculty_name,
          f.faculty_name_tr,
          (SELECT COUNT(*) FROM exam_request_attachments 
           WHERE exam_request_id = er.exam_request_id) AS attachment_count,
          CASE 
            WHEN er.processed_by IS NOT NULL THEN 
              (SELECT full_name FROM admin_users WHERE admin_id = er.processed_by)
            ELSE NULL
          END AS processed_by_name
        FROM exam_requests er
        INNER JOIN students s ON er.student_id = s.student_id
        INNER JOIN faculties f ON er.faculty_id = f.faculty_id
        WHERE er.faculty_id = ?
        ORDER BY 
          CASE er.status 
            WHEN 'Pending' THEN 1 
            WHEN 'Approved' THEN 2 
            WHEN 'Rejected' THEN 3 
          END,
          er.submitted_at DESC`,
        [facultyId]
      );

      console.log('✅ Found ' + requests.length + ' exam requests for faculty ID ' + facultyId);

      res.json({
        success: true,
        data: requests
      });
    } catch (error) {
      console.error('❌ Error fetching exam requests:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch exam requests'
      });
    }
  }
);

// GET /api/secretary/exam-requests/:requestId - Get single exam request detail
router.get('/exam-requests/:requestId',
  authenticateAdmin,
  requireSecretary,
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const secretaryDepartment = req.admin.department;

      console.log('📄 Fetching exam request detail:', {
        requestId,
        secretary_department: secretaryDepartment
      });

      // Faculty ID'yi bul
      const likePattern = '%' + secretaryDepartment + '%';
      const [faculties] = await pool.execute(
        'SELECT faculty_id FROM faculties WHERE faculty_name LIKE ? OR faculty_name_tr LIKE ? OR faculty_name = ? OR faculty_name_tr = ? LIMIT 1',
        [likePattern, likePattern, secretaryDepartment, secretaryDepartment]
      );

      if (faculties.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Faculty not found'
        });
      }

      const facultyId = faculties[0].faculty_id;

      // Get exam request (sadece kendi faculty'sine ait olanı)
      const [requests] = await pool.execute(
        `SELECT 
          er.*,
          s.student_number,
          s.name AS student_name,
          s.email AS student_email,
          s.program,
          s.faculty AS student_faculty,
          f.faculty_name,
          f.faculty_name_tr,
          f.secretary_email,
          (SELECT COUNT(*) FROM exam_request_attachments 
           WHERE exam_request_id = er.exam_request_id) AS attachment_count,
          CASE 
            WHEN er.processed_by IS NOT NULL THEN 
              (SELECT full_name FROM admin_users WHERE admin_id = er.processed_by)
            ELSE NULL
          END AS processed_by_name
        FROM exam_requests er
        INNER JOIN students s ON er.student_id = s.student_id
        INNER JOIN faculties f ON er.faculty_id = f.faculty_id
        WHERE er.exam_request_id = ? AND er.faculty_id = ?`,
        [requestId, facultyId]
      );

      if (requests.length === 0) {
        console.log('❌ Exam request not found or access denied');
        return res.status(404).json({
          success: false,
          error: 'Exam request not found or you do not have access to it'
        });
      }

      console.log('✅ Exam request detail fetched successfully');

      res.json({
        success: true,
        data: requests[0]
      });
    } catch (error) {
      console.error('❌ Error fetching exam request detail:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch exam request detail'
      });
    }
  }
);

// PUT /api/secretary/exam-requests/:requestId/approve - Approve exam request
router.put('/exam-requests/:requestId/approve',
  authenticateAdmin,
  requireSecretary,
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { secretary_notes } = req.body;
      const secretaryId = req.admin.admin_id;
      const secretaryDepartment = req.admin.department;

      console.log('✅ Approving exam request:', {
        requestId,
        secretaryId,
        secretary_notes
      });

      // Faculty ID'yi bul
      const likePattern = '%' + secretaryDepartment + '%';
      const [faculties] = await pool.execute(
        'SELECT faculty_id FROM faculties WHERE faculty_name LIKE ? OR faculty_name_tr LIKE ? OR faculty_name = ? OR faculty_name_tr = ? LIMIT 1',
        [likePattern, likePattern, secretaryDepartment, secretaryDepartment]
      );

      if (faculties.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Faculty not found'
        });
      }

      const facultyId = faculties[0].faculty_id;

      // Check if request belongs to secretary's faculty and is pending
      const [checkRequest] = await pool.execute(
        'SELECT status FROM exam_requests WHERE exam_request_id = ? AND faculty_id = ?',
        [requestId, facultyId]
      );

      if (checkRequest.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Exam request not found or access denied'
        });
      }

      if (checkRequest[0].status !== 'Pending') {
        return res.status(400).json({
          success: false,
          error: 'Cannot approve request. Current status: ' + checkRequest[0].status
        });
      }

      // Update request status to Approved (use admin_id directly)
      await pool.execute(
        `UPDATE exam_requests 
         SET status = 'Approved', 
             secretary_notes = ?, 
             processed_by = ?,
             processed_at = NOW()
         WHERE exam_request_id = ?`,
        [secretary_notes || null, secretaryId, requestId]
      );

      console.log('✅ Exam request approved successfully');

      res.json({
        success: true,
        message: 'Exam request approved successfully'
      });
    } catch (error) {
      console.error('❌ Error approving exam request:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to approve exam request'
      });
    }
  }
);

// PUT /api/secretary/exam-requests/:requestId/reject - Reject exam request
router.put('/exam-requests/:requestId/reject',
  authenticateAdmin,
  requireSecretary,
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { rejection_reason, secretary_notes } = req.body;
      const secretaryId = req.admin.admin_id;
      const secretaryDepartment = req.admin.department;

      console.log('❌ Rejecting exam request:', {
        requestId,
        secretaryId,
        rejection_reason
      });

      // Validation
      if (!rejection_reason || rejection_reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required'
        });
      }

      // Faculty ID'yi bul
      const likePattern = '%' + secretaryDepartment + '%';
      const [faculties] = await pool.execute(
        'SELECT faculty_id FROM faculties WHERE faculty_name LIKE ? OR faculty_name_tr LIKE ? OR faculty_name = ? OR faculty_name_tr = ? LIMIT 1',
        [likePattern, likePattern, secretaryDepartment, secretaryDepartment]
      );

      if (faculties.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Faculty not found'
        });
      }

      const facultyId = faculties[0].faculty_id;

      // Check if request belongs to secretary's faculty and is pending
      const [checkRequest] = await pool.execute(
        'SELECT status FROM exam_requests WHERE exam_request_id = ? AND faculty_id = ?',
        [requestId, facultyId]
      );

      if (checkRequest.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Exam request not found or access denied'
        });
      }

      if (checkRequest[0].status !== 'Pending') {
        return res.status(400).json({
          success: false,
          error: 'Cannot reject request. Current status: ' + checkRequest[0].status
        });
      }

      // Update request status to Rejected (use admin_id directly)
      await pool.execute(
        `UPDATE exam_requests 
         SET status = 'Rejected', 
             rejection_reason = ?,
             secretary_notes = ?, 
             processed_by = ?,
             processed_at = NOW()
         WHERE exam_request_id = ?`,
        [rejection_reason, secretary_notes || null, secretaryId, requestId]
      );

      console.log('✅ Exam request rejected successfully');

      res.json({
        success: true,
        message: 'Exam request rejected successfully'
      });
    } catch (error) {
      console.error('❌ Error rejecting exam request:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reject exam request'
      });
    }
  }
);

// GET /api/secretary/exam-requests/:requestId/attachments - Get attachments
router.get('/exam-requests/:requestId/attachments',
  authenticateAdmin,
  requireSecretary,
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const secretaryDepartment = req.admin.department;

      console.log('📎 Fetching attachments for exam request:', requestId);

      // Verify request belongs to secretary's faculty
      const likePattern = '%' + secretaryDepartment + '%';
      const [faculties] = await pool.execute(
        'SELECT faculty_id FROM faculties WHERE faculty_name LIKE ? OR faculty_name_tr LIKE ? OR faculty_name = ? OR faculty_name_tr = ? LIMIT 1',
        [likePattern, likePattern, secretaryDepartment, secretaryDepartment]
      );

      if (faculties.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Faculty not found'
        });
      }

      const facultyId = faculties[0].faculty_id;

      // Check if request belongs to faculty
      const [checkRequest] = await pool.execute(
        'SELECT exam_request_id FROM exam_requests WHERE exam_request_id = ? AND faculty_id = ?',
        [requestId, facultyId]
      );

      if (checkRequest.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this exam request'
        });
      }

      // Get attachments
      const [attachments] = await pool.execute(
        `SELECT 
          attachment_id,
          exam_request_id,
          file_name,
          file_path,
          uploaded_at
        FROM exam_request_attachments
        WHERE exam_request_id = ?
        ORDER BY uploaded_at DESC`,
        [requestId]
      );

      console.log('✅ Found ' + attachments.length + ' attachments');

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
  }
);

module.exports = router;