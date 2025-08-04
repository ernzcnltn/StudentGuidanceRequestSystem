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


app.use('/api/auth', authRoutes);


// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin-auth', require('./routes/adminAuth'));
app.use('/api/request-types', require('./routes/requestTypes'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/students', require('./routes/students'));
app.use('/api/docs', require('./routes/docs'));

// ✅ NEW ROUTES - Yeni eklenen route'lar

app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/search', require('./routes/search'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: true,
      email: !!process.env.EMAIL_USER
    }
  });
});

// Enhanced test endpoint
app.get('/api/test', async (req, res) => {
  const services = {
    api: true,
    database: false,
    email: false
  };

  try {
    // Test database
    await testConnection();
    services.database = true;
  } catch (error) {
    console.error('Database test failed:', error);
  }

  

  res.json({ 
    message: 'FIU Guidance System API is working!',
    timestamp: new Date().toISOString(),
    services,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    features: {
      email_notifications: services.email,
      file_uploads: true,
      advanced_search: true,
      analytics: true,
      multi_language: true,
      dark_mode: true
    }
  });
});

// API documentation redirect
app.get('/api', (req, res) => {
  res.redirect('/api/docs');
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    requestedPath: req.originalUrl,
    availableEndpoints: [
      '/api/test',
      '/api/health', 
      '/api/docs',
      '/api/auth/*',
      '/api/admin-auth/*',
      '/api/requests/*',
      '/api/request-types/*',
      '/api/students/*',
      '/api/email/*',
      '/api/notifications/*',
      '/api/analytics/*',
      '/api/search/*'
    ]
  });
});

// Global error handler
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

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      console.error('❌ Error during server shutdown:', err);
      process.exit(1);
    }
    
    console.log('✅ Server closed successfully');
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

// Start server
const server = app.listen(PORT, () => {
  console.log('\n🚀 FIU Student Guidance System Backend');
  console.log('==========================================');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 API URL: http://localhost:${PORT}/api`);
  console.log(`📚 Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test Endpoint: http://localhost:${PORT}/api/test`);
  console.log('==========================================');
  console.log('✨ Available Features:');
  
  console.log('   🔔 Real-time Notifications');
  console.log('   📊 Advanced Analytics');
  console.log('   🔍 Advanced Search');
  console.log('   🌍 Multi-language Support');
  console.log('   🌙 Dark Mode');
  console.log('   📁 File Uploads');
  console.log('   🔐 Role-based Access');
  console.log('==========================================');
  
  
  console.log('✅ Server ready to accept connections\n');
});

module.exports = app;