const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateAdmin } = require('../middleware/adminAuth');

// Middleware: Sadece dean'ler erişebilir
const requireDean = (req, res, next) => {
  if (req.admin.role !== 'dean') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Dean role required.'
    });
  }
  next();
};

// GET /api/dean/exam-requests - Tüm approved exam requestleri getir
router.get('/exam-requests', 
  authenticateAdmin, 
  requireDean,
  async (req, res) => {
    try {
      console.log('📋 Fetching approved exam requests for dean:', {
        admin_id: req.admin.admin_id
      });

      // Sadece Approved status'ündeki exam requestleri getir
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
        WHERE er.status = 'Approved'
        ORDER BY er.processed_at DESC, er.submitted_at DESC`
      );

      

      console.log('✅ Found ' + requests.length + ' approved exam requests');

      res.json({
        success: true,
        data: requests
      });
    } catch (error) {
      console.error('❌ Error fetching approved exam requests:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch approved exam requests'
      });
    }
  }
);

// GET /api/dean/exam-requests/:requestId - Tek bir approved exam request detayı
router.get('/exam-requests/:requestId',
  authenticateAdmin,
  requireDean,
  async (req, res) => {
    try {
      const { requestId } = req.params;

      console.log('📄 Fetching approved exam request detail:', {
        requestId,
        dean_id: req.admin.admin_id
      });

      // Sadece Approved olanları getir
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
        WHERE er.exam_request_id = ? AND er.status = 'Approved'`,
        [requestId]
      );

      if (requests.length === 0) {
        console.log('❌ Approved exam request not found');
        return res.status(404).json({
          success: false,
          error: 'Approved exam request not found'
        });
      }

      console.log('✅ Approved exam request detail fetched successfully');

      res.json({
        success: true,
        data: requests[0]
      });
    } catch (error) {
      console.error('❌ Error fetching approved exam request detail:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch approved exam request detail'
      });
    }
  }
);

// GET /api/dean/exam-requests/:requestId/attachments - Attachment'ları getir
router.get('/exam-requests/:requestId/attachments',
  authenticateAdmin,
  requireDean,
  async (req, res) => {
    try {
      const { requestId } = req.params;

      console.log('📎 Fetching attachments for approved exam request:', requestId);

      // Önce request'in approved olduğunu kontrol et
      const [checkRequest] = await pool.execute(
        'SELECT exam_request_id FROM exam_requests WHERE exam_request_id = ? AND status = "Approved"',
        [requestId]
      );

      if (checkRequest.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Can only view attachments of approved requests'
        });
      }

      // Attachments'ları getir
      const [attachments] = await pool.execute(
        `SELECT 
          attachment_id,
          exam_request_id,
          file_name,
          file_path,
          file_type,
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