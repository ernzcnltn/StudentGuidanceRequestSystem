const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateAdmin } = require('../middleware/adminAuth');
const emailService = require('../services/emailService');

// Middleware: Sadece institute_admin'ler erişebilir
const requireInstituteAdmin = (req, res, next) => {
  if (req.admin.role !== 'institute_admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Institute administrator role required.'
    });
  }
  next();
};


// FIFO helper functions ekleyelim
async function assignResponseOrder(requestId, category) {
  try {
    console.log('🔢 Assigning response order for institute request:', requestId);
    
    const [existing] = await pool.execute(
      'SELECT response_order FROM guidance_requests WHERE request_id = ?',
      [requestId]
    );
    
    if (existing[0]?.response_order) {
      console.log('✅ Request already has response_order:', existing[0].response_order);
      return existing[0].response_order;
    }
    
    const [maxOrder] = await pool.execute(`
      SELECT COALESCE(MAX(gr.response_order), 0) as max_order
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE rt.category = ? AND gr.status = 'Pending'
    `, [category]);
    
    const nextOrder = (maxOrder[0].max_order || 0) + 1;
    
    await pool.execute(
      'UPDATE guidance_requests SET response_order = ? WHERE request_id = ?',
      [nextOrder, requestId]
    );
    
    console.log('✅ Assigned response_order:', nextOrder);
    return nextOrder;
  } catch (error) {
    console.error('❌ Error assigning response order:', error);
    throw error;
  }
}

async function canProcessInstituteRequest(requestId, category) {
  try {
    console.log('🔍 Checking FIFO eligibility for institute request:', requestId);
    
    const [request] = await pool.execute(`
      SELECT 
        gr.request_id,
        gr.status,
        gr.response_order,
        rt.category
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      WHERE gr.request_id = ?
    `, [requestId]);
    
    if (request.length === 0) {
      return { canProcess: false, reason: 'Request not found' };
    }
    
    const req = request[0];
    
    if (req.category !== 'Institute') {
      return { canProcess: false, reason: 'Not an institute request' };
    }
    
    if (req.status !== 'Pending') {
      return { canProcess: true, reason: 'Not in Pending status' };
    }
    
    if (!req.response_order) {
      req.response_order = await assignResponseOrder(requestId, req.category);
    }
    
    const [earlierRequests] = await pool.execute(`
      SELECT 
        gr.request_id,
        gr.response_order,
        gr.submitted_at,
        s.name as student_name,
        rt.type_name
      FROM guidance_requests gr
      JOIN request_types rt ON gr.type_id = rt.type_id
      JOIN students s ON gr.student_id = s.student_id
      WHERE rt.category = ?
        AND gr.status = 'Pending'
        AND gr.response_order < ?
        AND gr.request_id != ?
      ORDER BY gr.response_order ASC
      LIMIT 1
    `, [req.category, req.response_order, requestId]);
    
    if (earlierRequests.length > 0) {
      const earlierReq = earlierRequests[0];
      console.log('⚠️ FIFO VIOLATION:', {
        current_request: requestId,
        current_order: req.response_order,
        blocking_request: earlierReq.request_id,
        blocking_order: earlierReq.response_order
      });
      
      return {
        canProcess: false,
        reason: 'FIFO_VIOLATION',
        blocking_request: {
          request_id: earlierReq.request_id,
          order: earlierReq.response_order,
          submitted_at: earlierReq.submitted_at,
          student_name: earlierReq.student_name,
          type_name: earlierReq.type_name
        },
        current_order: req.response_order
      };
    }
    
    console.log('✅ FIFO CHECK PASSED:', {
      request_id: requestId,
      order: req.response_order
    });
    
    return { 
      canProcess: true, 
      reason: 'First in queue',
      current_order: req.response_order
    };
    
  } catch (error) {
    console.error('❌ Error checking FIFO eligibility:', error);
    return { canProcess: false, reason: 'Error checking eligibility' };
  }
}

async function clearResponseOrder(requestId) {
  try {
    await pool.execute(
      'UPDATE guidance_requests SET response_order = NULL WHERE request_id = ?',
      [requestId]
    );
    console.log('🧹 Cleared response_order for request:', requestId);
  } catch (error) {
    console.error('❌ Error clearing response order:', error);
  }
}


// GET /api/institute/requests - Tüm institute requestleri getir
router.get('/requests', 
  authenticateAdmin, 
  requireInstituteAdmin,
  async (req, res) => {
    try {
      console.log('📋 Fetching institute requests for admin:', {
        admin_id: req.admin.admin_id
      });

      const [requests] = await pool.execute(
        `SELECT 
          gr.request_id,
          gr.student_id,
          gr.type_id,
          gr.content,
          gr.status,
          gr.priority,
          gr.submitted_at,
          gr.updated_at,
            gr.response_order, 
          s.student_number,
          s.name AS student_name,
          s.email AS student_email,
          s.program,
          s.faculty,
          rt.type_name,
          rt.description_en,
          rt.is_document_required,
          (SELECT COUNT(*) FROM attachments WHERE request_id = gr.request_id) AS attachment_count,
          gr.rejection_reason,
          gr.rejected_at
        FROM guidance_requests gr
        INNER JOIN students s ON gr.student_id = s.student_id
        INNER JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE rt.category = 'Institute'
        ORDER BY 
          CASE gr.status 
            WHEN 'Pending' THEN 1 
            WHEN 'Informed' THEN 2 
            WHEN 'Completed' THEN 3 
            WHEN 'Rejected' THEN 4
          END,
          COALESCE(gr.response_order, 999999),  -- 🆕 FIFO sıralaması

          gr.submitted_at DESC`
      );

      console.log('✅ Found ' + requests.length + ' institute requests');

      res.json({
        success: true,
        data: requests
      });
    } catch (error) {
      console.error('❌ Error fetching institute requests:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch institute requests'
      });
    }
  }
);


// 🆕 FIFO status check endpoint
router.get('/requests/:requestId/fifo-status',
  authenticateAdmin,
  requireInstituteAdmin,
  async (req, res) => {
    try {
      const { requestId } = req.params;
      
      const fifoCheck = await canProcessInstituteRequest(requestId, 'Institute');
      
      res.json({
        success: true,
        data: fifoCheck
      });
    } catch (error) {
      console.error('FIFO status check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check FIFO status'
      });
    }
  }
);

// GET /api/institute/requests/:requestId - Tek bir institute request detayı
router.get('/requests/:requestId',
  authenticateAdmin,
  requireInstituteAdmin,
  async (req, res) => {
    try {
      const { requestId } = req.params;

      console.log('📄 Fetching institute request detail:', {
        requestId,
        admin_id: req.admin.admin_id
      });

      const [requests] = await pool.execute(
        `SELECT 
          gr.request_id,
          gr.student_id,
          gr.type_id,
          gr.content,
          gr.status,
          gr.priority,
          gr.submitted_at,
          gr.updated_at,
          s.student_number,
          s.name AS student_name,
          s.email AS student_email,
          s.program,
          s.faculty,
          rt.type_name,
          rt.description_en,
          rt.is_document_required,
          (SELECT COUNT(*) FROM attachments WHERE request_id = gr.request_id) AS attachment_count,
          gr.rejection_reason,
          gr.rejected_at
        FROM guidance_requests gr
        INNER JOIN students s ON gr.student_id = s.student_id
        INNER JOIN request_types rt ON gr.type_id = rt.type_id
        WHERE gr.request_id = ? AND rt.category = 'Institute'`,
        [requestId]
      );

      if (requests.length === 0) {
        console.log('❌ Institute request not found');
        return res.status(404).json({
          success: false,
          error: 'Institute request not found or access denied'
        });
      }

      console.log('✅ Institute request detail fetched successfully');

      res.json({
        success: true,
        data: requests[0]
      });
    } catch (error) {
      console.error('❌ Error fetching institute request detail:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch institute request detail'
      });
    }
  }
);

// PUT /api/institute/requests/:requestId/approve - Institute request'i onayla
router.put('/requests/:requestId/approve',
  authenticateAdmin,
  requireInstituteAdmin,
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { admin_notes } = req.body;
      const adminId = req.admin.admin_id;

      console.log('✅ Approving institute request:', {
        requestId,
        adminId,
        admin_notes
      });

      // 🆕 FIFO CHECK
      const fifoCheck = await canProcessInstituteRequest(requestId, 'Institute');
      
      if (!fifoCheck.canProcess && fifoCheck.reason === 'FIFO_VIOLATION') {
        return res.status(423).json({
          success: false,
          error: 'Cannot approve yet: Earlier requests must be processed first',
          errorCode: 'FIFO_VIOLATION',
          blocking_request: fifoCheck.blocking_request,
          current_order: fifoCheck.current_order
        });
      }


      const [checkRequest] = await pool.execute(
        `SELECT gr.status, rt.category 
         FROM guidance_requests gr
         INNER JOIN request_types rt ON gr.type_id = rt.type_id
         WHERE gr.request_id = ?`,
        [requestId]
      );

      if (checkRequest.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Institute request not found'
        });
      }

      if (checkRequest[0].category !== 'Institute') {
        return res.status(403).json({
          success: false,
          error: 'This is not an institute request'
        });
      }

      if (checkRequest[0].status !== 'Pending') {
        return res.status(400).json({
          success: false,
          error: 'Cannot approve request. Current status: ' + checkRequest[0].status
        });
      }

      await pool.execute(
        `UPDATE guidance_requests 
         SET status = 'Completed',
             updated_at = NOW()
         WHERE request_id = ?`,
        [requestId]
      );


            await clearResponseOrder(requestId);


      if (admin_notes && admin_notes.trim()) {
        await pool.execute(
          `INSERT INTO admin_responses (request_id, admin_id, response_text, created_at)
           VALUES (?, ?, ?, NOW())`,
          [requestId, adminId, admin_notes.trim()]
        );
      }

      console.log('✅ Institute request approved successfully');

      // 👇 YENİ: EMAIL NOTIFICATION TO STUDENT
      try {
        // Get student and request details for email
        const [requestDetails] = await pool.execute(
          `SELECT 
            s.email as student_email,
            s.name as student_name,
            rt.type_name as request_type
          FROM guidance_requests gr
          JOIN students s ON gr.student_id = s.student_id
          JOIN request_types rt ON gr.type_id = rt.type_id
          WHERE gr.request_id = ?`,
          [requestId]
        );

        if (requestDetails.length > 0) {
          const details = requestDetails[0];
          
          // Send status update notification (Pending -> Completed)
          await emailService.sendStatusUpdateNotification(
            details.student_email,
            details.student_name,
            requestId,
            'Pending',
            'Completed',
            details.request_type
          );

          console.log(`📧 Approval notification sent to student: ${details.student_email}`);

          // If admin provided notes, also send response notification
          if (admin_notes && admin_notes.trim()) {
            await emailService.sendResponseNotification(
              details.student_email,
              details.student_name,
              requestId,
              admin_notes.trim()
            );

            console.log(`📧 Response notification sent to student: ${details.student_email}`);
          }
        }
      } catch (emailError) {
        console.error('⚠️ Email notification failed (non-critical):', emailError.message);
      }

      res.json({
        success: true,
        message: 'Institute request approved successfully'
      });
    } catch (error) {
      console.error('❌ Error approving institute request:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to approve institute request'
      });
    }
  }
);

// PUT /api/institute/requests/:requestId/reject - Institute request'i reddet
router.put('/requests/:requestId/reject',
  authenticateAdmin,
  requireInstituteAdmin,
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const { rejection_reason, admin_notes } = req.body;
      const adminId = req.admin.admin_id; // 👈 EKLENDI

      console.log('❌ Rejecting institute request:', {
        requestId,
        rejection_reason,
        adminId // 👈 EKLENDI
      });

      if (!rejection_reason || rejection_reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required'
        });
      }


  // 🆕 FIFO CHECK
      const fifoCheck = await canProcessInstituteRequest(requestId, 'Institute');
      
      if (!fifoCheck.canProcess && fifoCheck.reason === 'FIFO_VIOLATION') {
        return res.status(423).json({
          success: false,
          error: 'Cannot reject yet: Earlier requests must be processed first',
          errorCode: 'FIFO_VIOLATION',
          blocking_request: fifoCheck.blocking_request,
          current_order: fifoCheck.current_order
        });
      }


      const [checkRequest] = await pool.execute(
        `SELECT gr.status, rt.category 
         FROM guidance_requests gr
         INNER JOIN request_types rt ON gr.type_id = rt.type_id
         WHERE gr.request_id = ?`,
        [requestId]
      );

      if (checkRequest.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Institute request not found'
        });
      }

      if (checkRequest[0].category !== 'Institute') {
        return res.status(403).json({
          success: false,
          error: 'This is not an institute request'
        });
      }

      if (checkRequest[0].status !== 'Pending') {
        return res.status(400).json({
          success: false,
          error: 'Cannot reject request. Current status: ' + checkRequest[0].status
        });
      }

      // 👇 DÜZELTİLDİ: adminId artık tanımlı
      await pool.execute(
        `UPDATE guidance_requests 
         SET status = 'Rejected',
             rejection_reason = ?,
             rejected_at = NOW(),
             rejected_by = ?,
             updated_at = NOW()
         WHERE request_id = ?`,
        [rejection_reason.trim(), adminId, requestId]
      );

      // 🆕 Clear response order
      await clearResponseOrder(requestId);

      console.log('✅ Institute request rejected successfully');

      // 👇 YENİ: EMAIL NOTIFICATION TO STUDENT
      try {
        // Get student and request details for email
        const [requestDetails] = await pool.execute(
          `SELECT 
            s.email as student_email,
            s.name as student_name,
            rt.type_name as request_type
          FROM guidance_requests gr
          JOIN students s ON gr.student_id = s.student_id
          JOIN request_types rt ON gr.type_id = rt.type_id
          WHERE gr.request_id = ?`,
          [requestId]
        );

        if (requestDetails.length > 0) {
          const details = requestDetails[0];
          
          // Send rejection notification
          await emailService.sendRejectionNotification(
            details.student_email,
            details.student_name,
            requestId,
            details.request_type,
            rejection_reason.trim()
          );

          console.log(`📧 Rejection notification sent to student: ${details.student_email}`);
        }
      } catch (emailError) {
        console.error('⚠️ Email notification failed (non-critical):', emailError.message);
      }

      res.json({
        success: true,
        message: 'Institute request rejected successfully'
      });
    } catch (error) {
      console.error('❌ Error rejecting institute request:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reject institute request'
      });
    }
  }
);

// GET /api/institute/requests/:requestId/attachments
router.get('/requests/:requestId/attachments',
  authenticateAdmin,
  requireInstituteAdmin,
  async (req, res) => {
    try {
      const { requestId } = req.params;

      console.log('📎 Fetching attachments for institute request:', requestId);

      const [checkRequest] = await pool.execute(
        `SELECT gr.request_id, rt.category
         FROM guidance_requests gr
         INNER JOIN request_types rt ON gr.type_id = rt.type_id
         WHERE gr.request_id = ?`,
        [requestId]
      );

      if (checkRequest.length === 0 || checkRequest[0].category !== 'Institute') {
        return res.status(403).json({
          success: false,
          error: 'Can only view attachments of institute requests'
        });
      }

      const [attachments] = await pool.execute(
        `SELECT 
          attachment_id,
          request_id,
          filename,
          filepath,
          uploaded_at
        FROM attachments
        WHERE request_id = ?
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

// GET /api/institute/requests/:requestId/responses
router.get('/requests/:requestId/responses',
  authenticateAdmin,
  requireInstituteAdmin,
  
  async (req, res) => {
    try {
      const { requestId } = req.params;

      console.log('💬 Fetching responses for institute request:', requestId);

      const [checkRequest] = await pool.execute(
        `SELECT gr.request_id, rt.category
         FROM guidance_requests gr
         INNER JOIN request_types rt ON gr.type_id = rt.type_id
         WHERE gr.request_id = ?`,
        [requestId]
      );

      if (checkRequest.length === 0 || checkRequest[0].category !== 'Institute') {
        return res.status(403).json({
          success: false,
          error: 'Can only view responses of institute requests'
        });
      }

      const [responses] = await pool.execute(
        `SELECT 
          ar.*,
          a.full_name AS admin_name,
          a.department AS admin_department
        FROM admin_responses ar
        LEFT JOIN admins a ON ar.admin_id = a.admin_id
        WHERE ar.request_id = ?
        ORDER BY ar.created_at DESC`,
        [requestId]
      );

      console.log('✅ Found ' + responses.length + ' responses');

      res.json({
        success: true,
        data: responses
      });
    } catch (error) {
      console.error('❌ Error fetching responses:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch responses'
      });
    }
  }
);

module.exports = router;