const axios = require('axios');

/**
 * reCAPTCHA v2 verification middleware
 * Validates captcha token from client
 */
const verifyCaptcha = async (req, res, next) => {
  try {
    const { captchaToken } = req.body;

    // Captcha token yoksa reddet
    if (!captchaToken) {
      return res.status(400).json({
        success: false,
        error: 'Captcha verification required'
      });
    }

    // Secret key yoksa uyarı ver ve geç (development)
    if (!process.env.RECAPTCHA_SECRET_KEY) {
      console.warn('⚠️ RECAPTCHA_SECRET_KEY not configured, skipping verification');
      return next();
    }

    console.log('🔐 Verifying captcha token...');

    // Google reCAPTCHA API'sine request
    const verifyURL = 'https://www.google.com/recaptcha/api/siteverify';
    const response = await axios.post(verifyURL, null, {
      params: {
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: captchaToken,
        remoteip: req.ip
      }
    });

    const { success, score, 'error-codes': errorCodes } = response.data;

    if (!success) {
      console.error('❌ Captcha verification failed:', errorCodes);
      return res.status(400).json({
        success: false,
        error: 'Captcha verification failed. Please try again.',
        errorCodes
      });
    }

    console.log('✅ Captcha verified successfully');
    
    // Score varsa logla (v3 için, v2'de olmayabilir)
    if (score !== undefined) {
      console.log('Captcha score:', score);
      req.captchaScore = score;
    }

    // Verification başarılı, devam et
    next();

  } catch (error) {
    console.error('❌ Captcha verification error:', error.message);
    
    // Network hatası vs - güvenli taraf, reddet
    return res.status(500).json({
      success: false,
      error: 'Captcha verification service unavailable'
    });
  }
};

/**
 * Optional captcha verification
 * Captcha yoksa da geçer, ama varsa verify eder
 */
const verifyCaptchaOptional = async (req, res, next) => {
  const { captchaToken } = req.body;

  // Token yoksa geç
  if (!captchaToken) {
    console.log('ℹ️ No captcha token provided, continuing...');
    return next();
  }

  // Token varsa verify et
  return verifyCaptcha(req, res, next);
};

module.exports = {
  verifyCaptcha,
  verifyCaptchaOptional
};