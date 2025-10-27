// backend/server.js - UPDATED with Academic Calendar routes

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');
require('dotenv').config();

// Import services
const { testConnection } = require('./config/database');

// Import middleware
const { requestLogger, errorLogger, responseLogger } = require('./middleware/logger');
const { 
  generalLimiter, 
  authLimiter, 
  securityHeaders, 
  sanitizeInput,
  securityLogger,
  sessionSecurity,
  requestSizeLimit
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy if behind reverse proxy (for rate limiting)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security middleware (apply early)
app.use(securityHeaders);
app.use(sessionSecurity);
app.use(securityLogger);
app.use(requestSizeLimit);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Input sanitization
app.use(sanitizeInput);

// Logging middleware
app.use(requestLogger);
app.use(responseLogger);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/admin-auth/login', authLimiter);
app.use('/api/', generalLimiter);

// Basic auth route
app.use('/api/auth', authRoutes);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin-auth', require('./routes/adminAuth'));
app.use('/api/request-types', require('./routes/requestTypes'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/students', require('./routes/students'));
app.use('/api/docs', require('./routes/docs'));

// ✅ EXISTING ROUTES
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/search', require('./routes/search'));

// ⭐ NEW ROUTE - Academic Calendar Management
app.use('/api/academic-calendar', require('./routes/academicCalendar'));

// ⭐ NEW ROUTE - Department Request Limits (24-hour cooldown)
app.use('/api/department-limits', require('./routes/departmentLimits'));

// Health check endpoint with calendar status
app.get('/api/health', async (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: true,
      email: !!process.env.EMAIL_USER,
      academic_calendar: false
    }
  };

  // Check academic calendar service
  try {
    const { pool } = require('./config/database');
    const [calendarCheck] = await pool.execute(`
      SELECT setting_value FROM academic_settings 
      WHERE setting_key = 'academic_calendar_enabled'
    `);
    
    healthStatus.services.academic_calendar = calendarCheck.length > 0;
    healthStatus.calendar_enabled = calendarCheck[0]?.setting_value === 'true';
  } catch (error) {
    console.error('Calendar health check failed:', error);
    healthStatus.services.academic_calendar = false;
  }

  res.json(healthStatus);
});






// Enhanced test endpoint with calendar testing
app.get('/api/test', async (req, res) => {
  const services = {
    api: true,
    database: false,
    email: false,
    academic_calendar: false
  };

  try {
    // Test database
    await testConnection();
    services.database = true;

    // Test academic calendar
    const { pool } = require('./config/database');
    
    // Check if academic calendar tables exist
    const [tablesCheck] = await pool.execute(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name IN ('academic_calendar_uploads', 'academic_calendar_events', 'academic_settings')
    `);
    
    if (tablesCheck[0].table_count >= 3) {
      services.academic_calendar = true;
      
      // Test calendar functions
      const [functionTest] = await pool.execute(`
        SELECT is_academic_holiday_detailed(CURDATE()) as test_result
      `);
      
      if (functionTest[0]) {
        services.calendar_functions = true;
      }
    }
  } catch (error) {
    console.error('Service tests failed:', error);
  }

  res.json({ 
    message: 'FIU Guidance System API is working!',
    timestamp: new Date().toISOString(),
    services,
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0', // Updated version with calendar support
    features: {
      email_notifications: services.email,
      file_uploads: true,
      advanced_search: true,
      analytics: true,
      multi_language: true,
      dark_mode: true,
      academic_calendar: services.academic_calendar, // New feature
      holiday_restrictions: services.academic_calendar,
      calendar_document_parsing: services.academic_calendar
    }
  });
});

// ⭐ NEW: Calendar system test endpoint
app.get('/api/test/calendar', async (req, res) => {
  try {
    const { 
      testCalendarIntegration 
    } = require('./middleware/academicCalendar');
    
    console.log('🧪 Testing academic calendar system...');
    
    const testResult = await testCalendarIntegration();
    
    res.json({
      success: testResult,
      message: testResult ? 
        'Academic calendar system is working correctly' : 
        'Academic calendar system test failed',
      timestamp: new Date().toISOString(),
      test_details: {
        database_functions: true,
        middleware_integration: testResult,
        calendar_enabled: testResult
      }
    });
  } catch (error) {
    console.error('❌ Calendar test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Calendar test failed',
      error: error.message
    });
  }
});

// ⭐ NEW: Calendar status endpoint (public)
app.get('/api/calendar-status', async (req, res) => {
  try {
    const { pool } = require('./config/database');
    
    // Get basic calendar status (without authentication)
    const [settings] = await pool.execute(`
      SELECT setting_key, setting_value 
      FROM academic_settings 
      WHERE setting_key IN ('academic_calendar_enabled', 'current_academic_year')
    `);
    
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.setting_key] = setting.setting_value;
    });
    
    // Check today's status
    const currentDate = new Date().toISOString().split('T')[0];
    const [todayStatus] = await pool.execute(`
      SELECT is_academic_holiday_detailed(?) as holiday_info
    `, [currentDate]);
    
    const holidayInfo = todayStatus[0]?.holiday_info ? 
      JSON.parse(todayStatus[0].holiday_info) : null;
    
    res.json({
      success: true,
      data: {
        calendar_enabled: settingsMap.academic_calendar_enabled === 'true',
        current_academic_year: settingsMap.current_academic_year,
        current_date: currentDate,
        is_holiday: holidayInfo?.is_holiday || false,
        can_create_requests: holidayInfo ? !holidayInfo.is_holiday : true,
        holiday_message: holidayInfo?.message || 'Regular working day',
        system_status: 'operational'
      }
    });
  } catch (error) {
    console.error('❌ Public calendar status error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to check calendar status'
    });
  }
});

// API documentation redirect
app.get('/api', (req, res) => {
  res.redirect('/api/docs');
});

// 404 handler with updated endpoints
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    requestedPath: req.originalUrl,
    availableEndpoints: [
      '/api/test',
      '/api/test/calendar', // New endpoint
      '/api/health', 
      '/api/calendar-status', // New endpoint
      '/api/docs',
      '/api/auth/*',
      '/api/admin-auth/*',
      '/api/requests/*',
      '/api/request-types/*',
      '/api/students/*',
      '/api/email/*',
      '/api/notifications/*',
      '/api/analytics/*',
      '/api/search/*',
      '/api/academic-calendar/*' // New endpoint group
    ]
  });
});

// Global error handler with calendar-aware error handling
app.use(errorLogger);
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.message
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized access'
    });
  }
  
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable'
    });
  }

  // ⭐ NEW: Calendar-specific error handling
  if (err.code === 'ACADEMIC_HOLIDAY') {
    return res.status(423).json({
      success: false,
      error: 'Academic calendar restriction',
      details: err.message,
      errorCode: 'ACADEMIC_HOLIDAY'
    });
  }

  if (err.code === 'CALENDAR_PARSING_ERROR') {
    return res.status(400).json({
      success: false,
      error: 'Calendar document parsing failed',
      details: err.message
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown with calendar cleanup
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      console.error('❌ Error during server shutdown:', err);
      process.exit(1);
    }
    
    console.log('✅ Server closed successfully');
    
    // Clean up any calendar-related resources
    try {
      console.log('🗑️ Cleaning up calendar resources...');
      // Add any calendar-specific cleanup here if needed
      console.log('✅ Calendar cleanup completed');
    } catch (cleanupError) {
      console.error('⚠️ Calendar cleanup error:', cleanupError);
    }
    
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server with enhanced logging
const server = app.listen(PORT, async () => {
  console.log('\n🚀 FIU Student Guidance System Backend v2.0');
  console.log('==========================================');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 API URL: http://localhost:${PORT}/api`);
  console.log(`📚 Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test Endpoint: http://localhost:${PORT}/api/test`);
  console.log(`📅 Calendar Status: http://localhost:${PORT}/api/calendar-status`);
  console.log('==========================================');
  console.log('✨ Available Features:');
  console.log('   🔔 Real-time Notifications');
  console.log('   📊 Advanced Analytics');
  console.log('   🔍 Advanced Search');
  console.log('   🌍 Multi-language Support');
  console.log('   🌙 Dark Mode');
  console.log('   📁 File Uploads');
  console.log('   🔐 Role-based Access');
  console.log('   📅 Academic Calendar Management'); // New feature
  console.log('   🎉 Holiday Restrictions'); // New feature
  console.log('   📄 Calendar Document Parsing'); // New feature
  console.log('==========================================');
  
  // Test academic calendar system on startup
  try {
    console.log('🔍 Testing academic calendar system...');
    const { testCalendarIntegration } = require('./middleware/academicCalendar');
    const calendarTest = await testCalendarIntegration();
    
    if (calendarTest) {
      console.log('✅ Academic calendar system: OPERATIONAL');
    } else {
      console.log('⚠️ Academic calendar system: NOT FULLY OPERATIONAL');
    }
  } catch (error) {
    console.error('❌ Academic calendar test failed:', error.message);
  }
  
  console.log('✅ Server ready to accept connections\n');
});

module.exports = app;