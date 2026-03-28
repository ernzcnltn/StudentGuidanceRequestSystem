const rateLimit = require('express-rate-limit');

// Magic Link request rate limiter
const magicLinkRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 3, // 15 dakikada maksimum 3 istek
  message: {
    success: false,
    error: 'Too many magic link requests. Please try again after 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Email bazlı rate limiting için custom key generator
  keyGenerator: (req) => {
    // IP + Email kombinasyonu
    return `${req.ip}-${req.body.email || 'no-email'}`;
  },
  handler: (req, res) => {
    console.log('🚫 Magic link rate limit exceeded:', {
      ip: req.ip,
      email: req.body.email,
      timestamp: new Date().toISOString()
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many magic link requests from this IP address or email. Please try again after 15 minutes.',
      retryAfter: '15 minutes'
    });
  }
});

// Magic Link verification rate limiter (daha gevşek)
const magicLinkVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 dakika
  max: 10, // 5 dakikada maksimum 10 deneme
  message: {
    success: false,
    error: 'Too many verification attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Başarılı istekleri sayma
});

module.exports = {
  magicLinkRequestLimiter,
  magicLinkVerifyLimiter
};