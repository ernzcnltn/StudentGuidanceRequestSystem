const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const emailService = require('../services/emailService');

const redisClient = require('../config/redis');

const { 
  magicLinkRequestLimiter, 
  magicLinkVerifyLimiter 
} = require('../middleware/magicLinkRateLimit'); 

// Magic link token'larını saklamak için (production'da Redis kullan)
const magicLinkTokens = new Map();


// Storage helper - Redis veya Memory
const tokenStorage = {
  async set(key, value, ttl) {
    if (redisClient) {
      // Redis kullan
      await redisClient.setex(key, ttl, JSON.stringify(value));
    } else {
      // Memory kullan (dev)
      magicLinkTokens.set(key, {
        ...value,
        expiryTime: Date.now() + (ttl * 1000)
      });
    }
  },
  
  async get(key) {
    if (redisClient) {
      // Redis'ten al
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } else {
      // Memory'den al (dev)
      const data = magicLinkTokens.get(key);
      if (data && Date.now() > data.expiryTime) {
        magicLinkTokens.delete(key);
        return null;
      }
      return data;
    }
  },
  
  async delete(key) {
    if (redisClient) {
      await redisClient.del(key);
    } else {
      magicLinkTokens.delete(key);
    }
  }
};

// POST /api/magic-link/request - Magic link iste
router.post('/request', magicLinkRequestLimiter, async (req, res) => {
  // ✅ Rate limiter eklendi ↑
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // ✅ EKLE: Aynı email için son 5 dakikada request var mı kontrol et
    const recentTokens = Array.from(magicLinkTokens.values()).filter(
      token => token.email === email && 
               (Date.now() - (token.expiryTime - 15 * 60 * 1000)) < 5 * 60 * 1000
    );

    if (recentTokens.length > 0) {
      console.log('⚠️ Recent magic link already sent to:', email);
      return res.status(429).json({
        success: false,
        error: 'A magic link was recently sent to this email. Please check your inbox or wait 5 minutes.'
      });
    }

    console.log('🔍 Magic link requested for:', email);

    console.log('🔍 Magic link requested for:', email);

    // Email'in sistemde olup olmadığını kontrol et
    let userData = null;
    let userType = null;

    // Önce admin'de ara
    const [admins] = await pool.execute(
      'SELECT admin_id, username, full_name, email, department, role, is_super_admin FROM admin_users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (admins.length > 0) {
      userData = admins[0];
      userType = 'admin';
    } else {
      // Sonra student'da ara
      const [students] = await pool.execute(
        'SELECT student_id, student_number, name, email, program, faculty FROM students WHERE email = ?',
        [email]
      );

      if (students.length > 0) {
        userData = students[0];
        userType = 'student';
      }
    }

    // Email sistemde yoksa hata dön
if (!userData) {
  console.log('⚠️ Email not found in system');
  return res.status(404).json({
    success: false,
    error: 'No account found with this email address. Please check your email or contact support.'
  });
}

    // Magic link token oluştur
    const magicToken = uuidv4();
    const expiryTime = Date.now() + (15 * 60 * 1000); // 15 dakika

    // Token'ı kaydet
   await tokenStorage.set(`magic-link:${magicToken}`, {
  email,
  userType,
  userId: userType === 'admin' ? userData.admin_id : userData.student_id,
  used: false
}, 15 * 60); // 15 dakika TTL

    // Magic link oluştur
    const magicLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/magic-login?token=${magicToken}`;

    // Email gönder
    const userName = userData.full_name || userData.name || '';
    await emailService.sendMagicLinkEmail(email, magicLink, userName);

    console.log('✅ Magic link sent to:', email);

    res.json({
      success: true,
      message: 'If this email exists in our system, you will receive a login link shortly.'
    });

  } catch (error) {
    console.error('Magic link request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send magic link'
    });
  }
});

// GET /api/magic-link/verify/:token - Magic link'i doğrula ve login yap
router.get('/verify/:token', magicLinkVerifyLimiter, async (req, res) => {
  // ✅ Rate limiter eklendi ↑
  try {
    const { token } = req.params;

    console.log('🔐 Verifying magic link token');

   // Token'ı kontrol et
const tokenData = await tokenStorage.get(`magic-link:${token}`);

if (!tokenData) {
  console.log('❌ Token not found:', token);
  console.log('📋 Available tokens:', Array.from(magicLinkTokens.keys()));
  return res.status(400).json({
    success: false,
    error: 'Invalid or expired magic link'
  });
}

console.log('🔍 Token data:', {
  email: tokenData.email,
  userType: tokenData.userType,
  expiryTime: new Date(tokenData.expiryTime).toISOString(),
  now: new Date().toISOString(),
  timeLeft: Math.floor((tokenData.expiryTime - Date.now()) / 1000) + ' seconds'
});

// Token kullanılmış mı?
if (tokenData.used) {
  console.log('⚠️ Token already used, but allowing re-verification within grace period');
  
  // Grace period: Token kullanıldıysa ama henüz expire olmadıysa tekrar dön
  if (Date.now() < tokenData.expiryTime) {
    console.log('✅ Re-sending token within grace period');
    
    // Aynı JWT token'ı döndür (yeniden login olmasın)
    return res.json({
      success: true,
      message: 'Login successful (already verified)',
      user_type: tokenData.userType,
      data: tokenData.jwtResponse // Cache'lenmiş response
    });
  }
  
  return res.status(400).json({
    success: false,
    error: 'This magic link has already been used and expired'
  });
}

    // Token süresi dolmuş mu?
    if (Date.now() > tokenData.expiryTime) {
await tokenStorage.delete(`magic-link:${token}`);
      return res.status(400).json({
        success: false,
        error: 'This magic link has expired. Please request a new one.'
      });
    }

    // Token'ı kullanıldı olarak işaretle
    tokenData.used = true;
    magicLinkTokens.set(token, tokenData);

    // Kullanıcı verisini getir
    let userData = null;

    if (tokenData.userType === 'admin') {
      const [admins] = await pool.execute(
        'SELECT admin_id, username, full_name, email, department, role, is_super_admin FROM admin_users WHERE admin_id = ? AND is_active = TRUE',
        [tokenData.userId]
      );
      userData = admins[0];
    } else {
      const [students] = await pool.execute(
        'SELECT student_id, student_number, name, email, program, faculty FROM students WHERE student_id = ?',
        [tokenData.userId]
      );
      userData = students[0];
    }

    if (!userData) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // JWT token oluştur
    const jwtToken = jwt.sign(
      tokenData.userType === 'admin' 
        ? { 
            admin_id: userData.admin_id,
            username: userData.username,
            email: userData.email,
            department: userData.department,
            type: 'admin'
          }
        : { 
            student_id: userData.student_id,
            student_number: userData.student_number,
            email: userData.email,
            type: 'student'
          },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('✅ Magic link verified successfully for:', userData.email);

// Response'u oluştur
const responseData = {
  success: true,
  message: 'Login successful',
  user_type: tokenData.userType,
  data: {
    token: jwtToken,
    [tokenData.userType === 'admin' ? 'admin' : 'user']: userData
  }
};

// Token'ı kullanıldı olarak işaretle VE response'u cache'le
tokenData.used = true;
tokenData.jwtResponse = responseData.data; // ✅ Cache ekle
magicLinkTokens.set(token, tokenData);

console.log('✅ Magic link verified successfully for:', userData.email);



  // Token'ı sil (artık kullanıldı) - 5 dakika sonra
setTimeout(() => {
  console.log('🗑️ Deleting used token for:', userData.email);
  magicLinkTokens.delete(token);
}, 5 * 60 * 1000); // 5 dakika

    res.json(responseData); // ✅ Cache'lenmiş response dön


  } catch (error) {
    console.error('Magic link verify error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify magic link'
    });
  }
});

// Cleanup expired tokens her 30 dakikada bir
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [token, data] of magicLinkTokens.entries()) {
    if (now > data.expiryTime) {
      console.log(`🧹 Cleaning expired token for: ${data.email}`);
      magicLinkTokens.delete(token);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Total cleaned: ${cleanedCount} expired magic link token(s)`);
  }
}, 30 * 60 * 1000); // 30 dakika

module.exports = router;