const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const { authenticateToken } = require('../middleware/auth');
const { authenticateAdmin } = require('../middleware/adminAuth');

// POST /api/email/test - Test email service
router.post('/test', authenticateAdmin, async (req, res) => {
  try {
    const testResult = await emailService.testConnection();
    res.json({
      success: true,
      message: 'Email service test completed',
      data: testResult
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Email test failed',
      details: error.message
    });
  }
});

// POST /api/email/send-custom - Send custom email (Admin only)
router.post('/send-custom', authenticateAdmin, async (req, res) => {
  try {
    const { to, subject, message, isHtml = false } = req.body;
    
    if (!to || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, message'
      });
    }
    
    const result = await emailService.sendEmail(
      to, 
      subject, 
      isHtml ? message : '', 
      isHtml ? '' : message
    );
    
    res.json({
      success: result.success,
      message: 'Email sent successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send email',
      details: error.message
    });
  }
});

// POST /api/email/send-welcome - Resend welcome email
router.post('/send-welcome', authenticateAdmin, async (req, res) => {
  try {
    const { studentEmail, studentName, studentNumber } = req.body;
    
    if (!studentEmail || !studentName || !studentNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: studentEmail, studentName, studentNumber'
      });
    }
    
    const result = await emailService.sendWelcomeEmail(studentEmail, studentName, studentNumber);
    
    res.json({
      success: result.success,
      message: 'Welcome email sent successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send welcome email',
      details: error.message
    });
  }
});

// POST /api/email/notify-status - Manual status notification
router.post('/notify-status', authenticateAdmin, async (req, res) => {
  try {
    const { 
      studentEmail, 
      studentName, 
      requestId, 
      requestType, 
      oldStatus, 
      newStatus, 
      responseContent 
    } = req.body;
    
    if (!studentEmail || !studentName || !requestId || !requestType || !oldStatus || !newStatus) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    const result = await emailService.notifyRequestStatusUpdate(
      studentEmail,
      studentName,
      requestId,
      requestType,
      oldStatus,
      newStatus,
      responseContent
    );
    
    res.json({
      success: result.success,
      message: 'Status notification sent successfully',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send status notification',
      details: error.message
    });
  }
});

// GET /api/email/settings - Get email service status
router.get('/settings', authenticateAdmin, async (req, res) => {
  try {
    const isEnabled = emailService.enabled;
    const testResult = isEnabled ? await emailService.testConnection() : { success: false, message: 'Email service disabled' };
    
    res.json({
      success: true,
      data: {
        enabled: isEnabled,
        configured: !!process.env.EMAIL_USER,
        test_result: testResult
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get email settings',
      details: error.message
    });
  }
});

module.exports = router;