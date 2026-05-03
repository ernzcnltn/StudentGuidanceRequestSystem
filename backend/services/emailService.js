// backend/services/emailService.js 
const nodemailer = require('nodemailer');

// Email Service Configuration
const emailService = {
  transporter: null,
  config: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },

  // Initialize email service
  initialize() {
    if (!this.config.user || !this.config.pass) {
      console.warn('⚠️ Email credentials not configured. Email notifications will be disabled.');
      return false;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.pass
        }
      });

      console.log('✅ Email service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Email service initialization failed:', error);
      return false;
    }
  },

  // Check if email service is available
  canSendEmail() {
    return this.transporter !== null;
  },

  // ===== REGULAR REQUEST NOTIFICATIONS =====

  // Send notification to student when admin responds
  sendResponseNotification: async (
    studentEmail,
    studentName,
    requestId,
    responseContent
  ) => {
    if (!emailService.canSendEmail()) {
      console.log('⚠️ Email service not available for response notification');
      return { success: false, reason: 'Email service not configured' };
    }

    const subject = `New Response to Your Request #${requestId}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333333;
            background-color: #f5f5f5;
          }
          .email-wrapper { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
          }
          .header { 
            background-color: #0d6efd;
            color: #ffffff; 
            padding: 40px 30px; 
            text-align: center;
          }
          .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          .header p {
            font-size: 14px;
            opacity: 0.9;
          }
          .content { 
            padding: 40px 30px;
            background-color: #ffffff;
          }
          .content p {
            margin-bottom: 16px;
            color: #4a4a4a;
          }
          .response-box { 
            background-color: #f8f9fa;
            padding: 24px;
            margin: 24px 0;
            border-radius: 8px;
            border-left: 4px solid #0d6efd;
          }
          .response-box h3 {
            color: #0d6efd;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          .response-box p {
            color: #212529;
            line-height: 1.7;
            margin: 0;
          }
          .button-container {
            text-align: center;
            margin: 32px 0;
          }
          .button { 
            display: inline-block;
            padding: 14px 32px;
            background-color: #0d6efd;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            font-size: 15px;
          }
          .info-section {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-top: 24px;
          }
          .info-section p {
            margin-bottom: 8px;
            font-size: 14px;
          }
          .footer { 
            text-align: center;
            padding: 30px;
            background-color: #f8f9fa;
            border-top: 1px solid #dee2e6;
          }
          .footer p {
            color: #6c757d;
            font-size: 13px;
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>New Response Received</h1>
            <p>Student Guidance Request System</p>
          </div>
          
          <div class="content">
            <p>Dear ${studentName},</p>
            
            <p>You have received a new response for your request <strong>#${requestId}</strong>.</p>
            
            <div class="response-box">
              <h3>Response Details:</h3>
              <p>${responseContent}</p>
            </div>
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/requests" class="button">
                View Full Details
              </a>
            </div>
            
            <div class="info-section">
              <p><strong>Need Further Assistance?</strong></p>
              <p>You can reply to your request through the system or contact student services directly for additional support.</p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Student Guidance Request System</strong></p>
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await emailService.transporter.sendMail({
        from: `"Student Guidance System" <${emailService.config.user}>`,
        to: studentEmail,
        subject: subject,
        html: htmlContent
      });

      console.log(`✅ Response notification sent to: ${studentEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send response notification:', error);
      return { success: false, error: error.message };
    }
  },

  // Send notification when request status is updated
  sendStatusUpdateNotification: async (
    studentEmail,
    studentName,
    requestId,
    oldStatus,
    newStatus,
    requestType
  ) => {
    if (!emailService.canSendEmail()) {
      console.log('⚠️ Email service not available for status update');
      return { success: false, reason: 'Email service not configured' };
    }

    const statusColors = {
      'Pending': '#ffc107',
      'Informed': '#0dcaf0',
      'Completed': '#198754',
      'Rejected': '#dc3545'
    };

    const statusColor = statusColors[newStatus] || '#6c757d';
    const subject = `Request Status Updated - #${requestId}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333333;
            background-color: #f5f5f5;
          }
          .email-wrapper { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
          }
          .header { 
            background-color: #0d6efd;
            color: #ffffff; 
            padding: 40px 30px; 
            text-align: center;
          }
          .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          .header p {
            font-size: 14px;
            opacity: 0.9;
          }
          .content { 
            padding: 40px 30px;
            background-color: #ffffff;
          }
          .content p {
            margin-bottom: 16px;
            color: #4a4a4a;
          }
          .status-box { 
            background-color: #f8f9fa;
            padding: 24px;
            margin: 24px 0;
            border-radius: 8px;
            border-left: 4px solid ${statusColor};
          }
          .status-row {
            margin: 12px 0;
            font-size: 15px;
          }
          .status-row strong {
            color: #212529;
          }
          .status-badge { 
            display: inline-block;
            padding: 6px 16px;
            background-color: ${statusColor};
            color: #ffffff;
            border-radius: 4px;
            font-weight: 600;
            font-size: 14px;
          }
          .button-container {
            text-align: center;
            margin: 32px 0;
          }
          .button { 
            display: inline-block;
            padding: 14px 32px;
            background-color: #0d6efd;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            font-size: 15px;
          }
          .footer { 
            text-align: center;
            padding: 30px;
            background-color: #f8f9fa;
            border-top: 1px solid #dee2e6;
          }
          .footer p {
            color: #6c757d;
            font-size: 13px;
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>Request Status Update</h1>
            <p>Student Guidance Request System</p>
          </div>
          
          <div class="content">
            <p>Dear ${studentName},</p>
            
            <p>The status of your request <strong>#${requestId}</strong> (${requestType}) has been updated.</p>
            
            <div class="status-box">
              <div class="status-row">
                <strong>Previous Status:</strong> ${oldStatus}
              </div>
              <div class="status-row">
                <strong>Current Status:</strong> <span class="status-badge">${newStatus}</span>
              </div>
            </div>
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/requests" class="button">
                View Request Details
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Student Guidance Request System</strong></p>
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await emailService.transporter.sendMail({
        from: `"Student Guidance System" <${emailService.config.user}>`,
        to: studentEmail,
        subject: subject,
        html: htmlContent
      });

      console.log(`✅ Status update notification sent to: ${studentEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send status update notification:', error);
      return { success: false, error: error.message };
    }
  },

  // Send notification to admin when new request is created
  sendNewRequestNotification: async (
    adminEmail,
    adminName,
    requestId,
    studentName,
    requestType,
    priority,
    category
  ) => {
    if (!emailService.canSendEmail()) {
      console.log('⚠️ Email service not available for new request notification');
      return { success: false, reason: 'Email service not configured' };
    }

    const priorityColors = {
      'Urgent': '#dc3545',
      'High': '#fd7e14',
      'Medium': '#ffc107',
      'Low': '#198754'
    };

    const priorityColor = priorityColors[priority] || '#6c757d';
    const subject = `New Request Assignment - ${requestType} (${priority} Priority)`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333333;
            background-color: #f5f5f5;
          }
          .email-wrapper { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
          }
          .header { 
            background-color: #0d6efd;
            color: #ffffff; 
            padding: 40px 30px; 
            text-align: center;
          }
          .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          .header p {
            font-size: 14px;
            opacity: 0.9;
          }
          .content { 
            padding: 40px 30px;
            background-color: #ffffff;
          }
          .content p {
            margin-bottom: 16px;
            color: #4a4a4a;
          }
          .request-box { 
            background-color: #f8f9fa;
            padding: 24px;
            margin: 24px 0;
            border-radius: 8px;
            border-left: 4px solid ${priorityColor};
          }
          .request-row {
            margin: 12px 0;
            font-size: 15px;
          }
          .request-row strong {
            color: #212529;
          }
          .priority-badge { 
            display: inline-block;
            padding: 6px 16px;
            background-color: ${priorityColor};
            color: #ffffff;
            border-radius: 4px;
            font-weight: 600;
            font-size: 14px;
          }
          .button-container {
            text-align: center;
            margin: 32px 0;
          }
          .button { 
            display: inline-block;
            padding: 14px 32px;
            background-color: #0d6efd;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            font-size: 15px;
          }
          .info-section {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            border-radius: 6px;
            margin-top: 24px;
          }
          .info-section p {
            margin-bottom: 8px;
            font-size: 14px;
            color: #856404;
          }
          .footer { 
            text-align: center;
            padding: 30px;
            background-color: #f8f9fa;
            border-top: 1px solid #dee2e6;
          }
          .footer p {
            color: #6c757d;
            font-size: 13px;
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>New Request Assignment</h1>
            <p>Student Guidance Request System</p>
          </div>
          
          <div class="content">
            <p>Dear ${adminName},</p>
            
            <p>A new request has been assigned to the ${category} department and requires your attention.</p>
            
            <div class="request-box">
              <div class="request-row">
                <strong>Request ID:</strong> #${requestId}
              </div>
              <div class="request-row">
                <strong>Student:</strong> ${studentName}
              </div>
              <div class="request-row">
                <strong>Type:</strong> ${requestType}
              </div>
              <div class="request-row">
                <strong>Category:</strong> ${category}
              </div>
              <div class="request-row">
                <strong>Priority:</strong> <span class="priority-badge">${priority}</span>
              </div>
            </div>
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/dashboard" class="button">
                View Request Details
              </a>
            </div>
            
            <div class="info-section">
              <p><strong>Expected Response Time:</strong></p>
              <p>Please respond within ${priority === 'Urgent' ? '24 hours' : '3-5 business days'}.</p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Student Guidance Request System</strong></p>
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await emailService.transporter.sendMail({
        from: `"Student Guidance System" <${emailService.config.user}>`,
        to: adminEmail,
        subject: subject,
        html: htmlContent
      });

      console.log(`✅ New request notification sent to admin: ${adminEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send new request notification:', error);
      return { success: false, error: error.message };
    }
  },

  // Send rejection notification
  sendRejectionNotification: async (
    studentEmail,
    studentName,
    requestId,
    requestType,
    rejectionReason
  ) => {
    if (!emailService.canSendEmail()) {
      console.log('⚠️ Email service not available for rejection notification');
      return { success: false, reason: 'Email service not configured' };
    }

    const subject = `Request Status Update - #${requestId}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333333;
            background-color: #f5f5f5;
          }
          .email-wrapper { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
          }
          .header { 
            background-color: #dc3545;
            color: #ffffff; 
            padding: 40px 30px; 
            text-align: center;
          }
          .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          .header p {
            font-size: 14px;
            opacity: 0.9;
          }
          .content { 
            padding: 40px 30px;
            background-color: #ffffff;
          }
          .content p {
            margin-bottom: 16px;
            color: #4a4a4a;
          }
          .rejection-box { 
            background-color: #f8d7da;
            padding: 24px;
            margin: 24px 0;
            border-radius: 8px;
            border-left: 4px solid #dc3545;
          }
          .rejection-box h3 {
            color: #721c24;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          .rejection-box p {
            color: #721c24;
            line-height: 1.7;
            margin: 0;
          }
          .button-container {
            text-align: center;
            margin: 32px 0;
          }
          .button { 
            display: inline-block;
            padding: 14px 32px;
            background-color: #dc3545;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            font-size: 15px;
          }
          .info-section {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-top: 24px;
          }
          .info-section p {
            margin-bottom: 8px;
            font-size: 14px;
          }
          .info-section ul {
            margin-left: 20px;
            margin-top: 12px;
          }
          .info-section li {
            margin-bottom: 8px;
            color: #4a4a4a;
          }
          .footer { 
            text-align: center;
            padding: 30px;
            background-color: #f8f9fa;
            border-top: 1px solid #dee2e6;
          }
          .footer p {
            color: #6c757d;
            font-size: 13px;
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>Request Status Update</h1>
            <p>Student Guidance Request System</p>
          </div>
          
          <div class="content">
            <p>Dear ${studentName},</p>
            
            <p>Your request <strong>#${requestId}</strong> (${requestType}) has been reviewed and unfortunately cannot be approved at this time.</p>
            
            <div class="rejection-box">
              <h3>Reason for Decision:</h3>
              <p>${rejectionReason}</p>
            </div>
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/requests" class="button">
                View Request Details
              </a>
            </div>
            
            <div class="info-section">
              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>Review the reason provided above carefully</li>
                <li>Contact the relevant department for clarification if needed</li>
                <li>Address any issues mentioned and submit a new request if applicable</li>
                <li>Visit student services for additional guidance and support</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Student Guidance Request System</strong></p>
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await emailService.transporter.sendMail({
        from: `"Student Guidance System" <${emailService.config.user}>`,
        to: studentEmail,
        subject: subject,
        html: htmlContent
      });

      console.log(`✅ Rejection notification sent to: ${studentEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send rejection notification:', error);
      return { success: false, error: error.message };
    }
  },

  // ===== EXAM REQUEST NOTIFICATIONS =====

  // 1. Send notification to secretary when new exam request is created
  sendNewExamRequestNotification: async (
    secretaryEmail,
    secretaryName,
    examRequestId,
    studentName,
    examType,
    courseCode,
    courseName,
    faculty
  ) => {
    if (!emailService.canSendEmail()) {
      console.log('⚠️ Email service not available for exam request notification');
      return { success: false, reason: 'Email service not configured' };
    }

    const examTypeText = examType === 'makeup' ? 'Make-up Exam' : 'Resit Exam';
    const subject = `New ${examTypeText} Request - ${courseCode}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333333;
            background-color: #f5f5f5;
          }
          .email-wrapper { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
          }
          .header { 
            background-color: #0d6efd;
            color: #ffffff; 
            padding: 40px 30px; 
            text-align: center;
          }
          .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          .header p {
            font-size: 14px;
            opacity: 0.9;
          }
          .content { 
            padding: 40px 30px;
            background-color: #ffffff;
          }
          .content p {
            margin-bottom: 16px;
            color: #4a4a4a;
          }
          .info-box { 
            background-color: #f8f9fa;
            padding: 24px;
            margin: 24px 0;
            border-radius: 8px;
            border-left: 4px solid #0d6efd;
          }
          .info-row {
            margin: 12px 0;
            font-size: 15px;
          }
          .info-row .label {
            font-weight: 600;
            color: #0d6efd;
            display: inline-block;
            min-width: 120px;
          }
          .button-container {
            text-align: center;
            margin: 32px 0;
          }
          .button { 
            display: inline-block;
            padding: 14px 32px;
            background-color: #0d6efd;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            font-size: 15px;
          }
          .action-section {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            border-radius: 6px;
            margin-top: 24px;
          }
          .action-section p {
            margin-bottom: 8px;
            font-size: 14px;
            color: #856404;
          }
          .footer { 
            text-align: center;
            padding: 30px;
            background-color: #f8f9fa;
            border-top: 1px solid #dee2e6;
          }
          .footer p {
            color: #6c757d;
            font-size: 13px;
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>New Exam Request</h1>
            <p>Student Guidance Request System</p>
          </div>
          
          <div class="content">
            <p>Dear ${secretaryName},</p>
            
            <p>A new <strong>${examTypeText}</strong> request has been submitted and requires your review.</p>
            
            <div class="info-box">
              <div class="info-row">
                <span class="label">Request ID:</span> #${examRequestId}
              </div>
              <div class="info-row">
                <span class="label">Student:</span> ${studentName}
              </div>
              <div class="info-row">
                <span class="label">Course:</span> ${courseCode} - ${courseName}
              </div>
              <div class="info-row">
                <span class="label">Exam Type:</span> ${examTypeText}
              </div>
              <div class="info-row">
                <span class="label">Faculty:</span> ${faculty}
              </div>
            </div>
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/secretary/exam-requests" class="button">
                Review Request
              </a>
            </div>
            
            <div class="action-section">
              <p><strong>Action Required:</strong></p>
              <p>Please review this request and make a decision within 3-5 business days.</p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Student Guidance Request System</strong></p>
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await emailService.transporter.sendMail({
        from: `"Student Guidance System" <${emailService.config.user}>`,
        to: secretaryEmail,
        subject: subject,
        html: htmlContent
      });

      console.log(`✅ Exam request notification sent to secretary: ${secretaryEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send exam request notification:', error);
      return { success: false, error: error.message };
    }
  },

  // 2. Send approval notification to student
  sendExamRequestApprovalNotification: async (
    studentEmail,
    studentName,
    examRequestId,
    courseCode,
    courseName,
    examType,
    secretaryNotes
  ) => {
    if (!emailService.canSendEmail()) {
      console.log('⚠️ Email service not available');
      return { success: false, reason: 'Email service not configured' };
    }

    const examTypeText = examType === 'makeup' ? 'Make-up Exam' : 'Resit Exam';
    const subject = `Exam Request Approved - ${courseCode}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333333;
            background-color: #f5f5f5;
          }
          .email-wrapper { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
          }
          .header { 
            background-color: #198754;
            color: #ffffff; 
            padding: 40px 30px; 
            text-align: center;
          }
          .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          .header p {
            font-size: 14px;
            opacity: 0.9;
          }
          .content { 
            padding: 40px 30px;
            background-color: #ffffff;
          }
          .content p {
            margin-bottom: 16px;
            color: #4a4a4a;
          }
          .success-box { 
            background-color: #d1e7dd;
            padding: 24px;
            margin: 24px 0;
            border-radius: 8px;
            border-left: 4px solid #198754;
          }
          .success-box h3 {
            color: #0a3622;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          .success-box p {
            color: #0a3622;
            line-height: 1.7;
            margin: 0;
          }
          .info-box { 
            background-color: #f8f9fa;
            padding: 20px;
            margin: 20px 0;
            border-radius: 6px;
          }
          .info-box p {
            margin-bottom: 8px;
            font-size: 14px;
          }
          .info-box strong {
            color: #212529;
          }
          .button-container {
            text-align: center;
            margin: 32px 0;
          }
          .button { 
            display: inline-block;
            padding: 14px 32px;
            background-color: #198754;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            font-size: 15px;
          }
          .next-steps {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-top: 24px;
          }
          .next-steps ul {
            margin-left: 20px;
            margin-top: 12px;
          }
          .next-steps li {
            margin-bottom: 8px;
            color: #4a4a4a;
          }
          .footer { 
            text-align: center;
            padding: 30px;
            background-color: #f8f9fa;
            border-top: 1px solid #dee2e6;
          }
          .footer p {
            color: #6c757d;
            font-size: 13px;
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>Request Approved</h1>
            <p>Student Guidance Request System</p>
          </div>
          
          <div class="content">
            <p>Dear ${studentName},</p>
            
            <div class="success-box">
              <h3>Good News!</h3>
              <p>Your <strong>${examTypeText}</strong> request for <strong>${courseCode} - ${courseName}</strong> has been approved by the faculty secretary.</p>
            </div>
            
            <div class="info-box">
              <p><strong>Request ID:</strong> #${examRequestId}</p>
              <p><strong>Course:</strong> ${courseCode} - ${courseName}</p>
              <p><strong>Exam Type:</strong> ${examTypeText}</p>
            </div>
            
            ${secretaryNotes ? `
            <div class="info-box">
              <p><strong>Secretary Notes:</strong></p>
              <p>${secretaryNotes}</p>
            </div>
            ` : ''}
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/exam-requests" class="button">
                View Details
              </a>
            </div>
            
            <div class="next-steps">
              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>Contact your course instructor for the exam date and time</li>
                <li>Prepare well for your examination</li>
                <li>Bring your student ID card on exam day</li>
                <li>Arrive at the exam location at least 15 minutes early</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Student Guidance Request System</strong></p>
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await emailService.transporter.sendMail({
        from: `"Student Guidance System" <${emailService.config.user}>`,
        to: studentEmail,
        subject: subject,
        html: htmlContent
      });

      console.log(`✅ Approval notification sent to student: ${studentEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send approval notification:', error);
      return { success: false, error: error.message };
    }
  },

  // 3. Send rejection notification to student
  sendExamRequestRejectionNotification: async (
    studentEmail,
    studentName,
    examRequestId,
    courseCode,
    courseName,
    examType,
    rejectionReason,
    secretaryNotes
  ) => {
    if (!emailService.canSendEmail()) {
      console.log('⚠️ Email service not available');
      return { success: false, reason: 'Email service not configured' };
    }

    const examTypeText = examType === 'makeup' ? 'Make-up Exam' : 'Resit Exam';
    const subject = `Exam Request Decision - ${courseCode}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333333;
            background-color: #f5f5f5;
          }
          .email-wrapper { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
          }
          .header { 
            background-color: #dc3545;
            color: #ffffff; 
            padding: 40px 30px; 
            text-align: center;
          }
          .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          .header p {
            font-size: 14px;
            opacity: 0.9;
          }
          .content { 
            padding: 40px 30px;
            background-color: #ffffff;
          }
          .content p {
            margin-bottom: 16px;
            color: #4a4a4a;
          }
          .rejection-box { 
            background-color: #f8d7da;
            padding: 24px;
            margin: 24px 0;
            border-radius: 8px;
            border-left: 4px solid #dc3545;
          }
          .rejection-box h3 {
            color: #721c24;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          .rejection-box p {
            color: #721c24;
            line-height: 1.7;
            margin: 0;
          }
          .info-box { 
            background-color: #f8f9fa;
            padding: 20px;
            margin: 20px 0;
            border-radius: 6px;
          }
          .info-box p {
            margin-bottom: 8px;
            font-size: 14px;
          }
          .info-box strong {
            color: #212529;
          }
          .reason-box {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
          }
          .reason-box p {
            color: #856404;
            margin: 0;
          }
          .button-container {
            text-align: center;
            margin: 32px 0;
          }
          .button { 
            display: inline-block;
            padding: 14px 32px;
            background-color: #dc3545;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            font-size: 15px;
          }
          .next-steps {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-top: 24px;
          }
          .next-steps ul {
            margin-left: 20px;
            margin-top: 12px;
          }
          .next-steps li {
            margin-bottom: 8px;
            color: #4a4a4a;
          }
          .footer { 
            text-align: center;
            padding: 30px;
            background-color: #f8f9fa;
            border-top: 1px solid #dee2e6;
          }
          .footer p {
            color: #6c757d;
            font-size: 13px;
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>Request Decision</h1>
            <p>Student Guidance Request System</p>
          </div>
          
          <div class="content">
            <p>Dear ${studentName},</p>
            
            <div class="rejection-box">
              <h3>Request Status</h3>
              <p>Your <strong>${examTypeText}</strong> request for <strong>${courseCode} - ${courseName}</strong> has been reviewed and cannot be approved at this time.</p>
            </div>
            
            <div class="info-box">
              <p><strong>Request ID:</strong> #${examRequestId}</p>
              <p><strong>Course:</strong> ${courseCode} - ${courseName}</p>
              <p><strong>Exam Type:</strong> ${examTypeText}</p>
            </div>
            
            <div class="reason-box">
              <p><strong>Reason:</strong></p>
              <p>${rejectionReason}</p>
            </div>
            
            ${secretaryNotes ? `
            <div class="info-box">
              <p><strong>Additional Notes:</strong></p>
              <p>${secretaryNotes}</p>
            </div>
            ` : ''}
            
            <div class="button-container">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/exam-requests" class="button">
                View Details
              </a>
            </div>
            
            <div class="next-steps">
              <p><strong>What Can You Do?</strong></p>
              <ul>
                <li>Review the reason provided carefully</li>
                <li>Contact your faculty secretary for clarification</li>
                <li>Address the issues mentioned and resubmit if applicable</li>
                <li>Visit student services for guidance and support</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Student Guidance Request System</strong></p>
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await emailService.transporter.sendMail({
        from: `"Student Guidance System" <${emailService.config.user}>`,
        to: studentEmail,
        subject: subject,
        html: htmlContent
      });

      console.log(`✅ Rejection notification sent to student: ${studentEmail}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send rejection notification:', error);
      return { success: false, error: error.message };
    }
  },

// ===== MAGIC LINK AUTHENTICATION =====

  // Send magic link email
  sendMagicLinkEmail: async (email, magicLink, userName = '') => {
    if (!emailService.canSendEmail()) {
      console.log('⚠️ Email service not available for magic link');
      return { success: false, reason: 'Email service not configured' };
    }

    const subject = 'FIU - Your Login Link';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333333;
            background-color: #f5f5f5;
          }
          .email-wrapper { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
          }
          .header { 
            background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
            color: #ffffff; 
            padding: 40px 30px; 
            text-align: center;
          }
          .header h1 {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          .header p {
            font-size: 14px;
            opacity: 0.9;
          }
          .content { 
            padding: 40px 30px;
            background-color: #ffffff;
          }
          .content p {
            margin-bottom: 16px;
            color: #4a4a4a;
            font-size: 15px;
          }
          .greeting {
            font-size: 18px;
            font-weight: 600;
            color: #212529;
            margin-bottom: 20px;
          }
          .button-container {
            text-align: center;
            margin: 35px 0;
          }
          .button { 
            display: inline-block;
            padding: 16px 45px;
            background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 15px rgba(220, 38, 38, 0.3);
            transition: all 0.3s ease;
          }
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(220, 38, 38, 0.4);
          }
          .warning-box {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 25px 0;
            border-radius: 6px;
          }
          .warning-box p {
            margin: 8px 0;
            color: #856404;
            font-size: 14px;
          }
          .warning-box strong {
            display: block;
            margin-bottom: 10px;
            font-size: 15px;
          }
          .link-section {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin: 25px 0;
            text-align: center;
          }
          .link-section p {
            color: #6c757d;
            font-size: 13px;
            margin-bottom: 12px;
          }
          .link-text {
            word-break: break-all;
            color: #dc2626;
            font-size: 12px;
            padding: 10px;
            background-color: #ffffff;
            border: 1px solid #dee2e6;
            border-radius: 4px;
          }
          .footer { 
            text-align: center;
            padding: 30px;
            background-color: #f8f9fa;
            border-top: 1px solid #dee2e6;
          }
          .footer p {
            color: #6c757d;
            font-size: 13px;
            margin: 4px 0;
          }
          .logo {
            font-size: 36px;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <div class="logo">🎓</div>
            <h1>FIU Guidance System</h1>
            <p>Secure Login Link</p>
          </div>
          
          <div class="content">
            <p class="greeting">Hello${userName ? ' ' + userName : ''}! 👋</p>
            
            <p>You requested to sign in to your FIU Guidance System account. Click the button below to securely log in:</p>
            
            <div class="button-container">
              <a href="${magicLink}" class="button">
                🔐 Sign In to FIU
              </a>
            </div>
            
            <div class="warning-box">
              <strong>⚠️ Security Notice:</strong>
              <p>• This link will expire in 15 minutes</p>
              <p>• This link can only be used once</p>
              <p>• If you didn't request this, please ignore this email</p>
            </div>
            
            <div class="link-section">
              <p>If the button doesn't work, copy and paste this link:</p>
              <div class="link-text">${magicLink}</div>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Final International University</strong></p>
            <p>Student Guidance Request System</p>
            <p style="margin-top: 10px;">This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Hello${userName ? ' ' + userName : ''}!

You requested to sign in to your FIU Guidance System account.

Click this link to securely log in:
${magicLink}

⚠️ Security Notice:
- This link will expire in 15 minutes
- This link can only be used once
- If you didn't request this, please ignore this email

© 2025 Final International University
Student Guidance Request System
    `.trim();

    try {
      await emailService.transporter.sendMail({
        from: `"FIU Guidance System" <${emailService.config.user}>`,
        to: email,
        subject: subject,
        html: htmlContent,
        text: textContent
      });

      console.log(`✅ Magic link email sent to: ${email}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send magic link email:', error);
      return { success: false, error: error.message };
    }
  },


  sendWelcomeWithTempPassword: async (email, studentName, studentNumber, tempPassword) => {
    if (!emailService.canSendEmail()) {
      console.log('Warning: Email service not available for welcome email');
      return { success: false, reason: 'Email service not configured' };
    }

    const subject = 'FIU Guidance System — Account Registration Confirmation';
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Registration Confirmation</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #2d3436;
            background-color: #f4f7f6;
          }
          .wrapper {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border: 1px solid #e1e1e1;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          }
          .header {
            background-color: #C8102E;
            padding: 40px 20px;
            text-align: center;
          }
          .header h1 {
            font-size: 24px;
            font-weight: 700;
            color: #ffffff;
            margin: 0;
            letter-spacing: 0.5px;
          }
          .header-sub {
            font-size: 14px;
            color: rgba(255,255,255,0.9);
            margin-top: 8px;
          }
          .content {
            padding: 40px;
          }
          .greeting {
            font-size: 16px;
            font-weight: bold;
            color: #1a1a1a;
            margin-bottom: 20px;
          }
          .intro {
            font-size: 14px;
            color: #4a4a4a;
            margin-bottom: 30px;
          }
          .credentials-container {
            border: 1px solid #eeeeee;
            border-radius: 6px;
            margin-bottom: 30px;
            background-color: #fafafa;
          }
          .credentials-table {
            width: 100%;
            border-collapse: collapse;
          }
          .credentials-table td {
            padding: 15px 20px;
            border-bottom: 1px solid #eeeeee;
            font-size: 14px;
          }
          .credentials-table tr:last-child td {
            border-bottom: none;
          }
          .cred-label {
            color: #7f8c8d;
            font-weight: 600;
            width: 40%;
          }
          .cred-value {
            color: #2d3436;
            font-family: 'Courier New', monospace;
            font-weight: bold;
          }
          .temp-password {
            color: #C8102E; /* Önemli olduğu için kırmızı vurgulandı */
            font-size: 16px;
            letter-spacing: 1px;
          }
          .notice-box {
            border-left: 4px solid #C8102E;
            background-color: #fdf2f2;
            padding: 20px;
            margin-bottom: 30px;
          }
          .notice-title {
            font-size: 14px;
            font-weight: bold;
            color: #C8102E;
            margin-bottom: 5px;
          }
          .notice-box p {
            font-size: 13px;
            color: #444;
          }
          .btn-container {
            text-align: center;
            margin-bottom: 40px;
          }
          .btn {
            display: inline-block;
            padding: 15px 40px;
            background-color: #C8102E;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 4px;
            font-size: 15px;
            font-weight: bold;
          }
          .steps-section {
            border-top: 1px solid #eeeeee;
            padding-top: 30px;
          }
          .steps-title {
            font-size: 15px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #333;
          }
          .step-row {
            margin-bottom: 12px;
            font-size: 13px;
            color: #666;
            display: table;
          }
          .step-num {
            display: table-cell;
            width: 25px;
            font-weight: bold;
            color: #C8102E;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #eeeeee;
          }
          .footer .uni-name {
            font-size: 14px;
            font-weight: bold;
            color: #333;
          }
          .footer .disclaimer {
            font-size: 11px;
            color: #999;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <h1>FIU Guidance System</h1>
            <div class="header-sub">Official Student Registration Notice</div>
          </div>

          <div class="content">
            <p class="greeting">Dear ${studentName},</p>
            <p class="intro">
              Your account for the Final International University Student Guidance Request System has been officially created. 
              Please use the credentials below to access your portal.
            </p>

            <div class="credentials-container">
              <table class="credentials-table">
                <tr>
                  <td class="cred-label">Email Address</td>
                  <td class="cred-value">${email}</td>
                </tr>
                <tr>
                  <td class="cred-label">Student Number</td>
                  <td class="cred-value">${studentNumber}</td>
                </tr>
                <tr>
                  <td class="cred-label">Temporary Password</td>
                  <td class="cred-value temp-password">${tempPassword}</td>
                </tr>
              </table>
            </div>

            <div class="notice-box">
              <div class="notice-title">Security Requirement</div>
              <p>For security purposes, you will be prompted to change this temporary password upon your first login.</p>
            </div>

            <div class="btn-container">
              <a href="${frontendURL}/login" class="btn">Access Student Portal</a>
            </div>

            <div class="steps-section">
              <div class="steps-title">Getting Started</div>
              <div class="step-row">
                <span class="step-num">1.</span>
                <span>Use <strong>Google Sign-In</strong> with your university email for direct access.</span>
              </div>
              <div class="step-row">
                <span class="step-num">2.</span>
                <span>Alternatively, log in using the temporary password provided above.</span>
              </div>
              <div class="step-row">
                <span class="step-num">3.</span>
                <span>Ensure your profile information is correct once logged in.</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <div class="uni-name">Final International University</div>
            <div class="disclaimer">
              This is a system-generated notification. Please do not reply to this email.<br>
              Technical Support: Contact the Registrar's Office or IT Department.
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await emailService.transporter.sendMail({
        from: `"FIU Student Guidance System" <${emailService.config.user}>`,
        to: email,
        subject,
        html: htmlContent
      });
      console.log(`Welcome email sent to: ${email}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }
},
  
};



// Initialize on module load
emailService.initialize();

module.exports = emailService;