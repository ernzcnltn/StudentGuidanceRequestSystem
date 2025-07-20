// backend/services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    // Email yapılandırması varsa transporter oluştur
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
      this.enabled = true;
    } else {
      console.log('📧 Email service not configured - notifications will be logged only');
      this.enabled = false;
    }
  }

  async sendEmail(to, subject, htmlContent, textContent = '') {
    if (!this.enabled) {
      console.log(`📧 [EMAIL DISABLED] Would send to ${to}: ${subject}`);
      return { success: true, message: 'Email service disabled', disabled: true };
    }

    try {
      const mailOptions = {
        from: `"FIU Guidance System" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text: textContent,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Request status update notification
  async notifyRequestStatusUpdate(studentEmail, studentName, requestId, requestType, oldStatus, newStatus, responseContent = '') {
    const subject = `FIU Guidance - Request #${requestId} Status Update`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: linear-gradient(135deg, #dc2626 0%, #1e40af 100%); color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8f9fa; }
          .status-badge { 
            padding: 8px 16px; 
            border-radius: 20px; 
            font-weight: bold; 
            display: inline-block; 
            margin: 5px;
          }
          .pending { background-color: #ffc107; color: #000; }
          .informed { background-color: #17a2b8; color: #fff; }
          .completed { background-color: #28a745; color: #fff; }
          .footer { background: #343a40; color: white; padding: 15px; text-align: center; }
          .response-box { background: white; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 FIU Guidance System</h1>
            <p>Request Status Update Notification</p>
          </div>
          
          <div class="content">
            <h2>Hello ${studentName},</h2>
            
            <p>Your guidance request has been updated:</p>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <h3>Request Details:</h3>
              <p><strong>Request ID:</strong> #${requestId}</p>
              <p><strong>Type:</strong> ${requestType}</p>
              <p><strong>Status Change:</strong></p>
              <span class="status-badge ${oldStatus.toLowerCase()}">${oldStatus}</span>
              <span>→</span>
              <span class="status-badge ${newStatus.toLowerCase()}">${newStatus}</span>
            </div>
            
            ${responseContent ? `
            <div class="response-box">
              <h4>📝 Admin Response:</h4>
              <p>${responseContent}</p>
            </div>
            ` : ''}
            
            <p>You can view your complete request details by logging into the FIU Guidance System.</p>
            
            <div style="text-align: center; margin: 20px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/requests" 
                 style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View My Requests
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p>Final International University - Student Guidance System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      FIU Guidance System - Request Status Update
      
      Hello ${studentName},
      
      Your guidance request #${requestId} (${requestType}) status has been updated from "${oldStatus}" to "${newStatus}".
      
      ${responseContent ? `Admin Response: ${responseContent}` : ''}
      
      View your requests at: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/requests
      
      Final International University
      Student Guidance System
    `;

    return await this.sendEmail(studentEmail, subject, htmlContent, textContent);
  }

  // New request notification for admins
  async notifyNewRequest(adminEmail, adminName, department, requestId, studentName, requestType, priority, content) {
    const subject = `FIU Guidance - New ${priority} Priority Request #${requestId}`;
    
    const priorityColors = {
      'Low': '#6c757d',
      'Medium': '#17a2b8', 
      'High': '#ffc107',
      'Urgent': '#dc3545'
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: linear-gradient(135deg, #dc2626 0%, #1e40af 100%); color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f8f9fa; }
          .priority-badge { 
            padding: 6px 12px; 
            border-radius: 15px; 
            font-weight: bold; 
            color: white;
            background-color: ${priorityColors[priority] || '#6c757d'};
          }
          .request-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc2626; }
          .footer { background: #343a40; color: white; padding: 15px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 FIU Guidance System</h1>
            <p>New Request Notification</p>
          </div>
          
          <div class="content">
            <h2>Hello ${adminName},</h2>
            
            <p>A new guidance request has been submitted to the <strong>${department}</strong> department:</p>
            
            <div class="request-box">
              <h3>Request Details:</h3>
              <p><strong>Request ID:</strong> #${requestId}</p>
              <p><strong>Student:</strong> ${studentName}</p>
              <p><strong>Type:</strong> ${requestType}</p>
              <p><strong>Priority:</strong> <span class="priority-badge">${priority}</span></p>
              <p><strong>Content:</strong></p>
              <p style="background: #f8f9fa; padding: 10px; border-radius: 4px;">${content}</p>
            </div>
            
            <div style="text-align: center; margin: 20px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/dashboard" 
                 style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View in Admin Panel
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p>Final International University - Student Guidance System</p>
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(adminEmail, subject, htmlContent);
  }

  // Welcome email for new students
  async sendWelcomeEmail(studentEmail, studentName, studentNumber) {
    const subject = 'Welcome to FIU Guidance System';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: linear-gradient(135deg, #dc2626 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f8f9fa; }
          .feature-box { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #dc2626; }
          .footer { background: #343a40; color: white; padding: 15px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 Welcome to FIU Guidance System</h1>
            <p>Your academic support is our priority</p>
          </div>
          
          <div class="content">
            <h2>Welcome ${studentName}!</h2>
            
            <p>Your account has been successfully created in the FIU Student Guidance System.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Your Account Details:</h3>
              <p><strong>Student Number:</strong> ${studentNumber}</p>
              <p><strong>Email:</strong> ${studentEmail}</p>
            </div>
            
            <h3>What you can do:</h3>
            <div class="feature-box">
              <h4>📝 Submit Requests</h4>
              <p>Submit guidance requests for academic, financial, dormitory, and other campus services.</p>
            </div>
            
            <div class="feature-box">
              <h4>📊 Track Progress</h4>
              <p>Monitor the status of your requests in real-time and receive updates.</p>
            </div>
            
            <div class="feature-box">
              <h4>💬 Get Responses</h4>
              <p>Receive detailed responses from department administrators.</p>
            </div>
            
            <div class="feature-box">
              <h4>📎 Upload Documents</h4>
              <p>Attach necessary documents to support your requests.</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
                 style="background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px;">
                Access Your Portal
              </a>
            </div>
            
            <p><em>If you have any questions, please contact our support team or visit the campus guidance office.</em></p>
          </div>
          
          <div class="footer">
            <p>Final International University</p>
            <p>Student Guidance System</p>
            <p>Email: guidance@fiu.edu.tr | Phone: +90 392 671 1111</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(studentEmail, subject, htmlContent);
  }

  // Test email connectivity
  async testConnection() {
    if (!this.enabled) {
      return { success: true, message: 'Email service disabled - no configuration found' };
    }

    try {
      await this.transporter.verify();
      console.log('✅ Email service is ready');
      return { success: true, message: 'Email service connected successfully' };
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();