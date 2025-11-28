const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Rate limiting for general API requests
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: 'Too many login attempts from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for file uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: {
    success: false,
    error: 'Too many file uploads from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Request creation rate limiting
const requestCreationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // limit each IP to 5 request creations per day
  message: {
    success: false,
    error: 'Daily request limit reached. You can create maximum 5 requests per day.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potentially dangerous characters
        obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        obj[key] = obj[key].replace(/javascript:/gi, '');
        obj[key] = obj[key].replace(/on\w+=/gi, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);
  
  next();
};

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'"],
imgSrc: ["'self'", "data:", "https:", "http://localhost:5000"],    
  connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.googleapis.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Request size limiting
const requestSizeLimit = (req, res, next) => {
  const contentLength = parseInt(req.get('content-length'));
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength && contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      error: 'Request entity too large'
    });
  }

  next();
};

// IP validation and blocking
const ipValidation = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Block known malicious IPs (this would typically come from a database or service)
  const blockedIPs = process.env.BLOCKED_IPS ? process.env.BLOCKED_IPS.split(',') : [];
  
  if (blockedIPs.includes(clientIP)) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  next();
};

// Request logging for security monitoring
const securityLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const method = req.method;
  const url = req.url;
  
  // Log suspicious activities
  const suspiciousPatterns = [
    /select.*from/i,
    /union.*select/i,
    /insert.*into/i,
    /delete.*from/i,
    /script.*src/i,
    /javascript:/i,
    /eval\(/i,
    /alert\(/i
  ];

  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params
  });

  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(requestData) || pattern.test(url)
  );

  if (isSuspicious) {
    console.warn(`🚨 SUSPICIOUS REQUEST: ${timestamp} - ${ip} - ${method} ${url} - ${userAgent}`);
    console.warn(`Request data: ${requestData}`);
  }

  next();
};

// Password strength validation
const validatePasswordStrength = (password) => {
  const minLength = 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  
  // For production, uncomment these for stronger passwords
  // if (!hasUpperCase) errors.push('Password must contain at least one uppercase letter');
  // if (!hasLowerCase) errors.push('Password must contain at least one lowercase letter');
  // if (!hasNumbers) errors.push('Password must contain at least one number');
  // if (!hasSpecialChar) errors.push('Password must contain at least one special character');

  return {
    isValid: errors.length === 0,
    errors
  };
};

// File type validation
const validateFileType = (file) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/vnd.oasis.opendocument.text'
  ];

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.csv', '.odt'];
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  return {
    isValidMimeType: allowedMimeTypes.includes(file.mimetype),
    isValidExtension: allowedExtensions.includes(fileExtension),
    isValid: allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)
  };
};

// Enhanced input validation
const validateEmailFormat = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateStudentNumber = (studentNumber) => {
  // FIU student number format: YYYYNNNN (year + 4 digits)
  const studentNumberRegex = /^(19|20)\d{6}$/;
  return studentNumberRegex.test(studentNumber);
};

// Content filtering
const contentFilter = (content) => {
  const forbiddenWords = [
    'hack', 'exploit', 'vulnerability', 'injection', 'malware',
    // Add more as needed based on your policy
  ];

  const lowercaseContent = content.toLowerCase();
  const containsForbiddenWords = forbiddenWords.some(word => 
    lowercaseContent.includes(word)
  );

  return {
    isClean: !containsForbiddenWords,
    flaggedWords: forbiddenWords.filter(word => lowercaseContent.includes(word))
  };
};

// Session security
const sessionSecurity = (req, res, next) => {
  // Add security headers for sessions
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};

module.exports = {
  generalLimiter,
  authLimiter,
  uploadLimiter,
  requestCreationLimiter,
  sanitizeInput,
  securityHeaders,
  requestSizeLimit,
  ipValidation,
  securityLogger,
  validatePasswordStrength,
  validateFileType,
  validateEmailFormat,
  validateStudentNumber,
  contentFilter,
  sessionSecurity
};