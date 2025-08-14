// backend/middleware/academicCalendar.js - Academic Calendar Validation Middleware
const { pool } = require('../config/database');

/**
 * Academic Calendar Middleware
 * Validates against academic holidays and calendar restrictions
 */

// Enhanced working hours utils with academic calendar integration
const enhancedWorkingHoursUtils = {
  
  // Check if within working hours AND not academic holiday
  async isWithinWorkingHoursAndCalendar(date = new Date()) {
    try {
      // KKTC saat diliminde tarih oluştur
      const kktcDate = new Date(date.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
      const dateString = kktcDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // First check regular working hours
      const dayOfWeek = kktcDate.getDay();
      
      // Weekend check
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return {
          isAllowed: false,
          reason: 'weekend',
          message: 'Requests cannot be created on weekends',
          code: 'WEEKEND_NOT_ALLOWED',
          date: dateString,
          currentTime: this.formatTime(kktcDate)
        };
      }
      
      // Working hours check
      const hours = kktcDate.getHours();
      const minutes = kktcDate.getMinutes();
      const currentTimeInMinutes = hours * 60 + minutes;
      
      const workStartMinutes = 8 * 60 + 30; // 08:30
      const workEndMinutes = 17 * 60 + 30;   // 17:30
      
      if (currentTimeInMinutes < workStartMinutes) {
        return {
          isAllowed: false,
          reason: 'too_early',
          message: 'Requests can only be created during working hours (08:30-17:30)',
          code: 'OUTSIDE_WORKING_HOURS',
          currentTime: this.formatTime(kktcDate),
          workingHours: '08:30-17:30',
          date: dateString
        };
      }
      
      if (currentTimeInMinutes >= workEndMinutes) {
        return {
          isAllowed: false,
          reason: 'too_late',
          message: 'Requests can only be created during working hours (08:30-17:30)',
          code: 'OUTSIDE_WORKING_HOURS',
          currentTime: this.formatTime(kktcDate),
          workingHours: '08:30-17:30',
          date: dateString
        };
      }
      
      // Academic calendar check
      const academicCheck = await this.checkAcademicCalendar(dateString);
      if (!academicCheck.isAllowed) {
        return academicCheck;
      }
      
      // All checks passed
      return {
        isAllowed: true,
        reason: 'working_hours_and_calendar',
        message: 'Request can be created during working hours',
        currentTime: this.formatTime(kktcDate),
        date: dateString,
        academic_status: academicCheck
      };
      
    } catch (error) {
      console.error('Working hours and calendar check error:', error);
      return {
        isAllowed: false,
        reason: 'error',
        message: 'Unable to verify working hours and calendar',
        code: 'WORKING_HOURS_CHECK_ERROR'
      };
    }
  },

    // ✅ YENİ: SQL fonksiyonu yoksa manuel kontrol
  async fallbackHolidayCheck(dateString) {
    try {
      console.log('🔄 Using fallback holiday check for:', dateString);
      
      // Manuel olarak events tablosundan kontrol et
      const [events] = await pool.execute(`
        SELECT 
          event_name,
          event_type,
          start_date,
          end_date,
          affects_request_creation
        FROM academic_calendar_events ace
        JOIN academic_calendar_uploads acu ON ace.upload_id = acu.upload_id
        WHERE ? BETWEEN ace.start_date AND ace.end_date
          AND acu.is_active = TRUE 
          AND acu.processing_status = 'completed'
          AND ace.affects_request_creation = TRUE
        ORDER BY ace.start_date ASC
      `, [dateString]);

      if (events.length > 0) {
        const eventNames = events.map(e => e.event_name).join(', ');
        
        return {
          isAllowed: false,
          reason: 'academic_holiday',
          message: `Academic holiday: ${eventNames}`,
          code: 'ACADEMIC_HOLIDAY',
          date: dateString,
          holiday_details: {
            names: eventNames,
            events: events,
            is_recurring: false,
            priority: 'high'
          }
        };
      }

      return {
        isAllowed: true,
        reason: 'regular_day',
        message: 'Regular working day - no academic restrictions',
        date: dateString
      };

    } catch (fallbackError) {
      console.error('❌ Fallback holiday check failed:', fallbackError);
      
      // Son çare: calendar kontrolünü devre dışı bırak
      return {
        isAllowed: true,
        reason: 'fallback_error',
        message: 'Holiday check failed, allowing request',
        error: true
      };
    }
  },


  // Check academic calendar for holidays
  async checkAcademicCalendar(dateString) {
    try {
      console.log('🗓️ Checking academic calendar for date:', dateString);
      
      // Önce academic calendar'ın aktif olup olmadığını kontrol et
      const [calendarSettings] = await pool.execute(`
        SELECT setting_value FROM academic_settings 
        WHERE setting_key = 'academic_calendar_enabled'
      `);
      
      if (calendarSettings.length === 0 || calendarSettings[0].setting_value !== 'true') {
        console.log('📅 Academic calendar is disabled');
        return {
          isAllowed: true,
          reason: 'calendar_disabled',
          message: 'Academic calendar restrictions are disabled'
        };
      }

      // ✅ FIX: SQL fonksiyonunun varlığını kontrol et
      const [functionExists] = await pool.execute(`
        SELECT COUNT(*) as count 
        FROM information_schema.ROUTINES 
        WHERE ROUTINE_SCHEMA = DATABASE() 
        AND ROUTINE_NAME = 'is_academic_holiday_detailed'
      `);

      if (functionExists[0].count === 0) {
        console.warn('⚠️ Academic holiday function not found, creating fallback...');
        return await this.fallbackHolidayCheck(dateString);
      }

      // Ana fonksiyon çağrısı
      const [holidayResult] = await pool.execute(`
        SELECT is_academic_holiday_detailed(?) as holiday_info
      `, [dateString]);

      if (!holidayResult[0]?.holiday_info) {
        return {
          isAllowed: true,
          reason: 'no_calendar_data',
          message: 'No academic calendar data available'
        };
      }

      // ✅ FIX: JSON parse hata kontrolü
      let holidayInfo;
      try {
        const rawData = holidayResult[0].holiday_info;
        
        // String ise parse et, object ise direkt kullan
        if (typeof rawData === 'string') {
          holidayInfo = JSON.parse(rawData);
        } else if (typeof rawData === 'object') {
          holidayInfo = rawData;
        } else {
          throw new Error('Invalid holiday data format');
        }
      } catch (parseError) {
        console.error('❌ Holiday info parsing failed:', parseError);
        return await this.fallbackHolidayCheck(dateString);
      }
      
      if (holidayInfo.is_holiday) {
        // Holiday var, request'i engelle
        return {
          isAllowed: false,
          reason: 'academic_holiday',
          message: `Academic holiday: ${holidayInfo.names || 'Holiday period'}`,
          code: 'ACADEMIC_HOLIDAY',
          date: dateString,
          holiday_details: {
            names: holidayInfo.names,
            types: holidayInfo.types,
            is_recurring: holidayInfo.is_recurring,
            priority: holidayInfo.priority
          }
        };
      }

      return {
        isAllowed: true,
        reason: 'regular_day',
        message: 'Regular working day - no academic restrictions',
        date: dateString
      };

    } catch (error) {
      console.error('❌ Academic calendar check error:', error);
      // Hata durumunda fallback kullan
      return await this.fallbackHolidayCheck(dateString);
    }
  },

  // Get next available working day considering calendar
  async getNextWorkingTime(currentDate = new Date()) {
    try {
      console.log('⏰ Getting next working time from date:', currentDate);
      
      // ✅ FIX: Check if SQL function exists first
      const [functionExists] = await pool.execute(`
        SELECT COUNT(*) as count 
        FROM information_schema.ROUTINES 
        WHERE ROUTINE_SCHEMA = DATABASE() 
        AND ROUTINE_NAME = 'get_next_request_creation_date'
      `);

      if (functionExists[0].count === 0) {
        console.warn('⚠️ get_next_request_creation_date function not found, using fallback');
        return await this.fallbackNextWorkingTime(currentDate);
      }

      // ✅ FIX: Safe SQL function call with proper date format
      const inputDate = currentDate instanceof Date ? 
        currentDate.toISOString().split('T')[0] : 
        currentDate;

      console.log('📅 Calling SQL function with date:', inputDate);

      const [nextResult] = await pool.execute(`
        SELECT get_next_request_creation_date(?) as next_info
      `, [inputDate]);

      console.log('📋 Raw SQL function result:', nextResult[0]);

      if (!nextResult[0] || !nextResult[0].next_info) {
        console.warn('⚠️ SQL function returned null, using fallback');
        return await this.fallbackNextWorkingTime(currentDate);
      }

      // ✅ FIX: Enhanced JSON parsing with error handling
      let nextInfo;
      const rawNextInfo = nextResult[0].next_info;
      
      console.log('🔍 Raw next_info type:', typeof rawNextInfo);
      console.log('🔍 Raw next_info value:', rawNextInfo);

      try {
        if (typeof rawNextInfo === 'string') {
          // String ise JSON parse et
          nextInfo = JSON.parse(rawNextInfo);
        } else if (typeof rawNextInfo === 'object' && rawNextInfo !== null) {
          // Zaten object ise direkt kullan
          nextInfo = rawNextInfo;
        } else {
          throw new Error(`Invalid next_info type: ${typeof rawNextInfo}`);
        }
      } catch (parseError) {
        console.error('❌ JSON parse error for next_info:', parseError);
        console.error('❌ Raw data causing error:', rawNextInfo);
        return await this.fallbackNextWorkingTime(currentDate);
      }
      
      console.log('✅ Parsed next_info:', nextInfo);

      if (nextInfo && nextInfo.success) {
        return {
          date: nextInfo.formatted_date,
          time: '08:30',
          fullDateTime: `${nextInfo.next_date}T08:30:00.000Z`,
          dayName: nextInfo.day_name,
          daysAhead: nextInfo.days_ahead,
          source: 'sql_function'
        };
      } else {
        console.warn('⚠️ SQL function returned unsuccessful result:', nextInfo);
        return await this.fallbackNextWorkingTime(currentDate);
      }

    } catch (error) {
      console.error('❌ SQL function error:', error);
      return await this.fallbackNextWorkingTime(currentDate);
    }
  },

 // ✅ NEW: Fallback calculation when SQL function fails
  async fallbackNextWorkingTime(currentDate = new Date()) {
    try {
      console.log('🔄 Using fallback next working time calculation');
      
      const startDate = currentDate instanceof Date ? currentDate : new Date(currentDate);
      let checkDate = new Date(startDate);
      let daysChecked = 0;
      const maxDays = 365;
      
      while (daysChecked < maxDays) {
        checkDate = new Date(startDate.getTime() + (daysChecked * 24 * 60 * 60 * 1000));
        const dayOfWeek = checkDate.getDay();
        
        // Check if it's a weekday (1=Monday, 5=Friday)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          // Check if it's not a holiday using manual database query
          const dateString = checkDate.toISOString().split('T')[0];
          
          try {
            const [holidayCheck] = await pool.execute(`
              SELECT COUNT(*) as holiday_count
              FROM academic_calendar_events ace
              JOIN academic_calendar_uploads acu ON ace.upload_id = acu.upload_id
              WHERE ? BETWEEN ace.start_date AND ace.end_date
                AND acu.is_active = TRUE 
                AND acu.processing_status = 'completed'
                AND ace.affects_request_creation = TRUE
            `, [dateString]);
            
            if (holidayCheck[0].holiday_count === 0) {
              // This is a working day!
              return {
                date: checkDate.toLocaleDateString('tr-TR'),
                time: '08:30',
                fullDateTime: new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), 8, 30).toISOString(),
                dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
                daysAhead: daysChecked,
                source: 'fallback_calculation'
              };
            }
          } catch (holidayError) {
            console.warn('⚠️ Holiday check failed, assuming working day:', holidayError);
            // If holiday check fails, assume it's a working day
            return {
              date: checkDate.toLocaleDateString('tr-TR'),
              time: '08:30',
              fullDateTime: new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), 8, 30).toISOString(),
              dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
              daysAhead: daysChecked,
              source: 'fallback_no_holiday_check'
            };
          }
        }
        
        daysChecked++;
      }
      
      // If no working day found within maxDays, return next Monday
      const nextMonday = new Date(startDate);
      while (nextMonday.getDay() !== 1) {
        nextMonday.setDate(nextMonday.getDate() + 1);
      }
      nextMonday.setHours(8, 30, 0, 0);
      
      return {
        date: nextMonday.toLocaleDateString('tr-TR'),
        time: '08:30',
        fullDateTime: nextMonday.toISOString(),
        dayName: 'Monday',
        daysAhead: Math.ceil((nextMonday - startDate) / (1000 * 60 * 60 * 24)),
        source: 'fallback_next_monday'
      };
      
    } catch (error) {
      console.error('❌ Fallback calculation failed:', error);
      
      // Ultimate fallback - just return next Monday
      const today = new Date();
      const nextMonday = new Date(today);
      nextMonday.setDate(today.getDate() + (7 - today.getDay() + 1) % 7 || 7);
      nextMonday.setHours(8, 30, 0, 0);
      
      return {
        date: nextMonday.toLocaleDateString('tr-TR'),
        time: '08:30',
        fullDateTime: nextMonday.toISOString(),
        dayName: 'Monday',
        daysAhead: Math.ceil((nextMonday - today) / (1000 * 60 * 60 * 24)),
        source: 'ultimate_fallback'
      };
    }
  },


  // Format time helper
  formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // Get current time info with academic calendar
 async getCurrentTimeInfo() {
    try {
      const now = new Date();
      const kktcTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
      
      let check;
      try {
        check = await this.isWithinWorkingHoursAndCalendar();
      } catch (checkError) {
        console.error('❌ Working hours check failed:', checkError);
        check = {
          isAllowed: false,
          reason: 'check_error',
          message: 'Unable to verify working hours',
          error: checkError.message
        };
      }
      
      let nextWorkingTime = null;
      if (!check.isAllowed) {
        try {
          nextWorkingTime = await this.getNextWorkingTime();
        } catch (nextTimeError) {
          console.error('❌ Next working time failed:', nextTimeError);
          nextWorkingTime = {
            error: 'Unable to calculate next working time',
            source: 'error'
          };
        }
      }
      
      return {
        localTime: now.toISOString(),
        kktcTime: kktcTime.toISOString(),
        kktcTimeFormatted: kktcTime.toLocaleString('tr-TR'),
        dayOfWeek: kktcTime.getDay(),
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][kktcTime.getDay()],
        isWorkingHours: check.isAllowed,
        checkResult: check,
        nextWorkingTime: nextWorkingTime
      };
    } catch (error) {
      console.error('❌ getCurrentTimeInfo failed:', error);
      return {
        error: 'Unable to get current time info',
        message: error.message
      };
    }
  },
};

// Enhanced middleware that includes academic calendar validation
const validateWorkingHoursAndCalendar = async (req, res, next) => {
  try {
    console.log('🕒📅 Checking working hours and academic calendar...');
    
    const check = await enhancedWorkingHoursUtils.isWithinWorkingHoursAndCalendar();
    const kktcTime = new Date().toLocaleString("en-US", {timeZone: "Europe/Istanbul"});
    
    console.log('Working hours and calendar check result:', {
      isAllowed: check.isAllowed,
      reason: check.reason,
      currentTime: check.currentTime,
      date: check.date
    });
    
    if (!check.isAllowed) {
      const nextWorkingTime = await enhancedWorkingHoursUtils.getNextWorkingTime();
      
      // Different response messages based on reason
      let errorMessage = check.message;
      let errorCode = check.code || 'ACCESS_RESTRICTED';
      
      if (check.reason === 'academic_holiday') {
        errorMessage = `Academic Calendar Restriction: ${check.message}`;
        errorCode = 'ACADEMIC_HOLIDAY';
      } else if (check.reason === 'weekend') {
        errorMessage = 'Weekend Restriction: Requests cannot be submitted on weekends';
        errorCode = 'WEEKEND_NOT_ALLOWED';
      } else if (check.reason === 'too_early' || check.reason === 'too_late') {
        errorMessage = 'Outside Working Hours: Requests can only be created Monday-Friday 08:30-17:30';
        errorCode = 'OUTSIDE_WORKING_HOURS';
      }
      
      return res.status(423).json({
        success: false,
        error: errorMessage,
        errorCode: errorCode,
        details: {
          reason: check.reason,
          currentTime: check.currentTime,
          currentDate: check.date,
          workingHours: '08:30-17:30',
          workingDays: 'Monday - Friday',
          timezone: 'KKTC Time (GMT+3)',
          nextAvailableTime: nextWorkingTime,
          holiday_details: check.holiday_details || null,
          academic_status: check.academic_status || null
        },
        guidance: {
          message: check.reason === 'academic_holiday' 
            ? 'Requests cannot be submitted during academic holidays' 
            : 'You can submit requests during working hours only',
          schedule: 'Monday to Friday, 08:30 - 17:30 (KKTC Time)',
          nextOpening: nextWorkingTime ? 
            `Next available: ${nextWorkingTime.date} at ${nextWorkingTime.time}` : 
            'Next working day at 08:30',
          holiday_info: check.holiday_details ? {
            current_holidays: check.holiday_details.names,
            holiday_types: check.holiday_details.types,
            next_available_date: check.next_available
          } : null
        }
      });
    }
    
    // All checks passed - add calendar info to request
    req.workingHoursInfo = {
      checkedAt: new Date().toISOString(),
      kktcTime: new Date(kktcTime).toISOString(),
      isWorkingHours: true,
      isAcademicHoliday: false,
      currentTime: check.currentTime,
      currentDate: check.date,
      academicCalendarEnabled: true
    };
    
    console.log('✅ Working hours and academic calendar validation passed');
    next();
    
  } catch (error) {
    console.error('❌ Working hours and calendar middleware error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Unable to verify working hours and academic calendar. Please try again.',
      errorCode: 'CALENDAR_CHECK_ERROR',
      details: {
        message: 'System error during working hours and calendar validation',
        contact: 'Please contact IT support if this persists'
      }
    });
  }
};

// Middleware for admin bypass
const validateWorkingHoursAndCalendarWithAdminBypass = async (req, res, next) => {
  // Admin bypass
  if (req.admin) {
    console.log('🔑 Admin bypass for working hours and calendar check');
    req.workingHoursInfo = {
      checkedAt: new Date().toISOString(),
      bypassReason: 'admin_access',
      isWorkingHours: true,
      isAcademicHoliday: false
    };
    return next();
  }
  
  // Normal student validation
  return validateWorkingHoursAndCalendar(req, res, next);
};

// Quick date check function (for API endpoints)
const checkDateAvailability = async (dateString) => {
  try {
    const dateObj = new Date(dateString + 'T12:00:00.000Z'); // Noon to avoid timezone issues
    const result = await enhancedWorkingHoursUtils.isWithinWorkingHoursAndCalendar(dateObj);
    
    return {
      date: dateString,
      isAvailable: result.isAllowed,
      reason: result.reason,
      message: result.message,
      details: result.holiday_details || null,
      nextAvailable: result.next_available || null
    };
  } catch (error) {
    console.error('Date availability check error:', error);
    return {
      date: dateString,
      isAvailable: false,
      reason: 'error',
      message: 'Unable to check date availability',
      error: error.message
    };
  }
};

// Bulk date range check
const checkDateRangeAvailability = async (startDate, endDate, maxDays = 365) => {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > maxDays) {
      throw new Error(`Date range too large. Maximum ${maxDays} days allowed.`);
    }
    
    const results = [];
    const current = new Date(start);
    
    while (current <= end) {
      const dateString = current.toISOString().split('T')[0];
      const availability = await checkDateAvailability(dateString);
      results.push(availability);
      
      current.setDate(current.getDate() + 1);
    }
    
    return {
      startDate,
      endDate,
      totalDays: results.length,
      availableDays: results.filter(r => r.isAvailable).length,
      unavailableDays: results.filter(r => !r.isAvailable).length,
      details: results,
      summary: {
        hasAvailableDays: results.some(r => r.isAvailable),
        hasUnavailableDays: results.some(r => !r.isAvailable),
        holidayDays: results.filter(r => r.reason === 'academic_holiday').length,
        weekendDays: results.filter(r => r.reason === 'weekend').length
      }
    };
  } catch (error) {
    console.error('Date range check error:', error);
    throw error;
  }
};

// Academic year validation
const validateAcademicYear = async (academicYear) => {
  try {
    // Check format
    const yearPattern = /^\d{4}-\d{4}$/;
    if (!yearPattern.test(academicYear)) {
      return {
        isValid: false,
        error: 'Invalid academic year format. Use format: "2025-2026"'
      };
    }
    
    const [startYear, endYear] = academicYear.split('-').map(y => parseInt(y));
    
    // Check logical sequence
    if (endYear !== startYear + 1) {
      return {
        isValid: false,
        error: 'Academic year end must be one year after start year'
      };
    }
    
    // Check if academic year exists in database
    const [existingCalendar] = await pool.execute(`
      SELECT COUNT(*) as count FROM academic_calendar_uploads 
      WHERE academic_year = ? AND processing_status = 'completed'
    `, [academicYear]);
    
    const hasCalendarData = existingCalendar[0].count > 0;
    
    return {
      isValid: true,
      academicYear,
      startYear,
      endYear,
      hasCalendarData,
      message: hasCalendarData ? 
        'Academic year has calendar data' : 
        'Academic year is valid but no calendar data found'
    };
  } catch (error) {
    console.error('Academic year validation error:', error);
    return {
      isValid: false,
      error: 'Unable to validate academic year'
    };
  }
};

// Calendar status check
const getCalendarStatus = async () => {
  try {
    const [settings] = await pool.execute(`
      SELECT setting_key, setting_value 
      FROM academic_settings 
      WHERE setting_key IN ('current_academic_year', 'academic_calendar_enabled')
    `);
    
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.setting_key] = setting.setting_value;
    });
    
    const [activeCalendar] = await pool.execute(`
      SELECT 
        acu.*,
        COUNT(ace.event_id) as total_events
      FROM academic_calendar_uploads acu
      LEFT JOIN academic_calendar_events ace ON acu.upload_id = ace.upload_id
      WHERE acu.is_active = TRUE AND acu.processing_status = 'completed'
      GROUP BY acu.upload_id
      LIMIT 1
    `);
    
    const currentTimeInfo = await enhancedWorkingHoursUtils.getCurrentTimeInfo();
    
    return {
      isEnabled: settingsMap.academic_calendar_enabled === 'true',
      currentAcademicYear: settingsMap.current_academic_year,
      hasActiveCalendar: activeCalendar.length > 0,
      activeCalendar: activeCalendar[0] || null,
      currentStatus: currentTimeInfo.checkResult,
      nextWorkingTime: currentTimeInfo.nextWorkingTime
    };
  } catch (error) {
    console.error('Calendar status check error:', error);
    return {
      isEnabled: false,
      error: 'Unable to check calendar status'
    };
  }
};

// Export all functions and middleware
module.exports = {
  // Main middleware
  validateWorkingHoursAndCalendar,
  validateWorkingHoursAndCalendarWithAdminBypass,
  
  // Utility functions
  enhancedWorkingHoursUtils,
  checkDateAvailability,
  checkDateRangeAvailability,
  validateAcademicYear,
  getCalendarStatus,
  
  // Helper functions for backward compatibility
  isWithinWorkingHours: enhancedWorkingHoursUtils.isWithinWorkingHoursAndCalendar,
  getNextWorkingTime: enhancedWorkingHoursUtils.getNextWorkingTime,
  getCurrentTimeInfo: enhancedWorkingHoursUtils.getCurrentTimeInfo,
  
  // Testing and debug functions
  testCalendarIntegration: async () => {
    console.group('🧪 Testing Academic Calendar Integration');
    
    try {
      const status = await getCalendarStatus();
      console.log('Calendar Status:', status);
      
      const currentCheck = await enhancedWorkingHoursUtils.isWithinWorkingHoursAndCalendar();
      console.log('Current Time Check:', currentCheck);
      
      const nextWorking = await enhancedWorkingHoursUtils.getNextWorkingTime();
      console.log('Next Working Time:', nextWorking);
      
      // Test some specific dates
      const testDates = [
        '2025-12-25', // Christmas
        '2025-10-29', // Republic Day
        '2025-01-01', // New Year
        '2025-03-20'  // Sample date
      ];
      
      for (const date of testDates) {
        const availability = await checkDateAvailability(date);
        console.log(`Date ${date}:`, availability.isAvailable ? '✅ Available' : '❌ Not Available', '-', availability.reason);
      }
      
      console.log('✅ Calendar integration test completed');
      return true;
    } catch (error) {
      console.error('❌ Calendar integration test failed:', error);
      return false;
    } finally {
      console.groupEnd();
    }
  }
};