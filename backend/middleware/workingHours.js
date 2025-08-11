// backend/middleware/workingHours.js - Mesai saatleri kontrol middleware'i

/**
 * Mesai saatleri kontrol middleware'i
 * Öğrencilerin sadece mesai saatlerinde request oluşturmasını sağlar
 * Çalışma saatleri: Pazartesi-Cuma 08:30-17:30 (KKTC saati)
 */

// KKTC saat diliminde mesai saati kontrolü (GMT+3, Türkiye ile aynı saat dilimi)
const isWithinWorkingHours = (date = new Date()) => {
  try {
    // KKTC saat diliminde tarih oluştur
    const kktcDate = new Date(date.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    
    // Haftanın günü (0 = Pazar, 1 = Pazartesi, ..., 6 = Cumartesi)
    const dayOfWeek = kktcDate.getDay();
    
    // Hafta sonu kontrolü
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        isAllowed: false,
        reason: 'weekend',
        message: 'Requests can only be created during working hours (Monday-Friday 08:30-17:30 KKTC Time)',
        code: 'WEEKEND_NOT_ALLOWED'
      };
    }
    
    // Saat bilgisini al
    const hours = kktcDate.getHours();
    const minutes = kktcDate.getMinutes();
    const currentTimeInMinutes = hours * 60 + minutes;
    
    // Mesai saatleri (dakika cinsinden)
    const workStartMinutes = 8 * 60 + 30; // 08:30
    const workEndMinutes = 17 * 60 + 30;   // 17:30
    
    // Saat kontrolü
    if (currentTimeInMinutes < workStartMinutes) {
      return {
        isAllowed: false,
        reason: 'too_early',
        message: 'Requests can only be created during working hours (Monday-Friday 08:30-17:30 KKTC Time)',
        code: 'OUTSIDE_WORKING_HOURS',
        currentTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        workingHours: '08:30-17:30'
      };
    }
    
    if (currentTimeInMinutes >= workEndMinutes) {
      return {
        isAllowed: false,
        reason: 'too_late',
        message: 'Requests can only be created during working hours (Monday-Friday 08:30-17:30 KKTC Time)',
        code: 'OUTSIDE_WORKING_HOURS',
        currentTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        workingHours: '08:30-17:30'
      };
    }
    
    // Mesai saatleri içinde
    return {
      isAllowed: true,
      reason: 'working_hours',
      message: 'Request created during working hours',
      currentTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    };
    
  } catch (error) {
    console.error('Working hours check error:', error);
    // Hata durumunda güvenli tarafta dur (request'e izin verme)
    return {
      isAllowed: false,
      reason: 'error',
      message: 'Unable to verify working hours',
      code: 'WORKING_HOURS_CHECK_ERROR'
    };
  }
};

// Bir sonraki çalışma günü ve saatini hesapla
const getNextWorkingTime = (currentDate = new Date()) => {
  try {
    const kktcDate = new Date(currentDate.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    let nextWorkingDay = new Date(kktcDate);
    
    // Bir sonraki çalışma gününü bul
    do {
      nextWorkingDay.setDate(nextWorkingDay.getDate() + 1);
    } while (nextWorkingDay.getDay() === 0 || nextWorkingDay.getDay() === 6);
    
    // Mesai başlangıç saatini ayarla
    nextWorkingDay.setHours(8, 30, 0, 0);
    
    return {
      date: nextWorkingDay.toLocaleDateString('tr-TR'),
      time: '08:30',
      fullDateTime: nextWorkingDay.toISOString()
    };
  } catch (error) {
    console.error('Next working time calculation error:', error);
    return null;
  }
};

// Ana middleware fonksiyonu
const validateWorkingHours = (req, res, next) => {
  try {
    console.log('🕒 Checking working hours for request creation...');
    
    const check = isWithinWorkingHours();
    const kktcTime = new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"});
    
    console.log('Working hours check result:', {
      isAllowed: check.isAllowed,
      reason: check.reason,
      currentTime: check.currentTime,
      kktcTime: new Date(kktcTime).toLocaleString('tr-TR')
    });
    
    if (!check.isAllowed) {
      const nextWorkingTime = getNextWorkingTime();
      
      return res.status(423).json({ // 423 Locked - zaman bazlı kısıtlama için uygun
        success: false,
        error: check.message,
        errorCode: check.code || 'OUTSIDE_WORKING_HOURS',
        details: {
          reason: check.reason,
          currentTime: check.currentTime,
          workingHours: check.workingHours || '08:30-17:30',
          workingDays: 'Monday - Friday',
          timezone: 'KKTC Time (GMT+3)',
          nextAvailableTime: nextWorkingTime
        },
        guidance: {
          message: 'You can submit requests during working hours only',
          workingSchedule: 'Monday to Friday, 08:30 - 17:30 (KKTC Time)',
          nextOpening: nextWorkingTime ? 
            `Next available time: ${nextWorkingTime.date} at ${nextWorkingTime.time}` : 
            'Next working day at 08:30'
        }
      });
    }
    
    // Mesai saatleri içindeyse devam et
    console.log('✅ Working hours validation passed');
    
    // Request'e mesai saati bilgisini ekle (audit için)
    req.workingHoursInfo = {
      checkedAt: new Date().toISOString(),
      kktcTime: new Date(kktcTime).toISOString(),
      isWorkingHours: true,
      currentTime: check.currentTime
    };
    
    next();
    
  } catch (error) {
    console.error('❌ Working hours middleware error:', error);
    
    // Hata durumunda güvenli tarafta dur
    return res.status(500).json({
      success: false,
      error: 'Unable to verify working hours. Please try again.',
      errorCode: 'WORKING_HOURS_CHECK_ERROR',
      details: {
        message: 'System error during working hours validation',
        contact: 'Please contact IT support if this persists'
      }
    });
  }
};

// Admin bypass middleware (acil durumlar için)
const validateWorkingHoursWithAdminBypass = (req, res, next) => {
  // Admin istekleri için bypass
  if (req.admin) {
    console.log('🔑 Admin bypass for working hours check');
    req.workingHoursInfo = {
      checkedAt: new Date().toISOString(),
      bypassReason: 'admin_access',
      isWorkingHours: true
    };
    return next();
  }
  
  // Normal öğrenci kontrolü
  return validateWorkingHours(req, res, next);
};

// Test endpoint'i için özel middleware
const validateWorkingHoursForTesting = (req, res, next) => {
  // Development ortamında test bypass
  if (process.env.NODE_ENV === 'development' && req.query.bypass_working_hours === 'true') {
    console.log('⚠️ Working hours check bypassed for testing');
    req.workingHoursInfo = {
      checkedAt: new Date().toISOString(),
      bypassReason: 'development_testing',
      isWorkingHours: true
    };
    return next();
  }
  
  return validateWorkingHours(req, res, next);
};

// Utility functions export
const workingHoursUtils = {
  isWithinWorkingHours,
  getNextWorkingTime,
  
  // Working hours bilgilerini döndür
  getWorkingHoursInfo: () => ({
    schedule: 'Monday - Friday, 08:30 - 17:30',
    timezone: 'KKTC Time (GMT+3)',
    restrictions: 'Student requests are only accepted during working hours',
    exceptions: 'Admin users can create requests anytime'
  }),
  
  // Mevcut zamanla ilgili detaylı bilgi
  getCurrentTimeInfo: () => {
    const now = new Date();
    const kktcTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    const check = isWithinWorkingHours();
    
    return {
      localTime: now.toISOString(),
      kktcTime: kktcTime.toISOString(),
      kktcTimeFormatted: kktcTime.toLocaleString('tr-TR'),
      dayOfWeek: kktcTime.getDay(),
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][kktcTime.getDay()],
      isWorkingHours: check.isAllowed,
      checkResult: check,
      nextWorkingTime: check.isAllowed ? null : getNextWorkingTime()
    };
  },
  
  // Debug test fonksiyonu
  testWorkingHours: () => {
    console.group('🕒 Working Hours Test');
    
    const testDates = [
      '2024-01-15 09:00:00', // Pazartesi 09:00
      '2024-01-19 16:00:00', // Cuma 16:00  
      '2024-01-20 10:00:00', // Cumartesi 10:00
      '2024-01-21 14:00:00', // Pazar 14:00
      '2024-01-15 07:00:00', // Pazartesi 07:00 (erken)
      '2024-01-15 18:00:00'  // Pazartesi 18:00 (geç)
    ];
    
    testDates.forEach(dateStr => {
      const testDate = new Date(dateStr);
      const result = isWithinWorkingHours(testDate);
      console.log(`${dateStr}: ${result.isAllowed ? '✅' : '❌'} - ${result.reason}`);
    });
    
    console.log('Current time info:', workingHoursUtils.getCurrentTimeInfo());
    console.groupEnd();
  }
};

module.exports = {
  validateWorkingHours,
  validateWorkingHoursWithAdminBypass,
  validateWorkingHoursForTesting,
  workingHoursUtils
};