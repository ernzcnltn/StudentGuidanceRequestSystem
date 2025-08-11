// utils/workingHours.js - Mesai saati kontrolü için utility fonksiyonlar

/**
 * Mesai saati kontrolü yapan utility fonksiyonlar
 * Çalışma saatleri: Pazartesi-Cuma 08:30-17:30 (KKTC Saati)
 */

// KKTC saat dilimi için mesai saatlerini kontrol et (GMT+3 - Türkiye ile aynı)
export const isWithinWorkingHours = (date = new Date()) => {
  // KKTC saat diliminde tarih oluştur (GMT+3, Türkiye ile aynı saat dilimi)
  const kktcDate = new Date(date.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
  
  // Haftanın günü (0 = Pazar, 1 = Pazartesi, ..., 6 = Cumartesi)
  const dayOfWeek = kktcDate.getDay();
  
  // Hafta sonu kontrolü (Cumartesi = 6, Pazar = 0)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      isAllowed: false,
      reason: 'weekend',
      message: 'Hafta sonları (Cumartesi-Pazar) request oluşturamazsınız.',
      nextWorkingDay: getNextWorkingDay(kktcDate)
    };
  }
  
  // Saat ve dakika bilgisini al
  const hours = kktcDate.getHours();
  const minutes = kktcDate.getMinutes();
  const currentTimeInMinutes = hours * 60 + minutes;
  
  // Mesai başlangıç ve bitiş saatleri (dakika cinsinden)
  const workStartMinutes = 8 * 60 + 30; // 08:30 = 510 dakika
  const workEndMinutes = 17 * 60 + 30;   // 17:30 = 1050 dakika
  
  // Mesai saatleri içinde mi kontrolü
  if (currentTimeInMinutes < workStartMinutes) {
    return {
      isAllowed: false,
      reason: 'too_early',
      message: 'Henüz mesai saatleri başlamadı. Mesai saatleri: Pazartesi-Cuma 08:30-17:30',
      currentTime: formatTime(hours, minutes),
      workingHours: '08:30-17:30',
      nextAvailableTime: getCurrentOrNextWorkingTime(kktcDate)
    };
  }
  
  if (currentTimeInMinutes >= workEndMinutes) {
    return {
      isAllowed: false,
      reason: 'too_late',
      message: 'Mesai saatleri sona erdi. Mesai saatleri: Pazartesi-Cuma 08:30-17:30',
      currentTime: formatTime(hours, minutes),
      workingHours: '08:30-17:30',
      nextAvailableTime: getCurrentOrNextWorkingTime(kktcDate)
    };
  }
  
  // Mesai saatleri içinde
  return {
    isAllowed: true,
    reason: 'working_hours',
    message: 'Mesai saatleri içindesiniz.',
    currentTime: formatTime(hours, minutes),
    workingHours: '08:30-17:30',
    remainingTimeToday: getRemainingWorkingTime(currentTimeInMinutes, workEndMinutes)
  };
};

// Bir sonraki çalışma gününü bul
export const getNextWorkingDay = (currentDate) => {
  const nextDay = new Date(currentDate);
  
  do {
    nextDay.setDate(nextDay.getDate() + 1);
  } while (nextDay.getDay() === 0 || nextDay.getDay() === 6); // Hafta sonu atla
  
  // Mesai başlangıç saatini ayarla
  nextDay.setHours(8, 30, 0, 0);
  
  return {
    date: nextDay.toLocaleDateString('tr-TR'),
    time: '08:30',
    fullDateTime: nextDay
  };
};

// Mevcut veya bir sonraki uygun çalışma zamanını bul
export const getCurrentOrNextWorkingTime = (currentDate) => {
  const turkeyDate = new Date(currentDate.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
  const dayOfWeek = turkeyDate.getDay();
  const hours = turkeyDate.getHours();
  const minutes = turkeyDate.getMinutes();
  const currentTimeInMinutes = hours * 60 + minutes;
  
  // Hafta sonu ise bir sonraki pazartesi
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return getNextWorkingDay(turkeyDate);
  }
  
  // Mesai başlamadıysa bugün 08:30
  if (currentTimeInMinutes < 8 * 60 + 30) {
    const today = new Date(turkeyDate);
    today.setHours(8, 30, 0, 0);
    return {
      date: today.toLocaleDateString('tr-TR'),
      time: '08:30',
      fullDateTime: today
    };
  }
  
  // Mesai bittiyse yarın 08:30
  if (currentTimeInMinutes >= 17 * 60 + 30) {
    return getNextWorkingDay(turkeyDate);
  }
  
  // Şu anda mesai içindeyse (bu duruma normalde gelmez)
  return {
    date: turkeyDate.toLocaleDateString('tr-TR'),
    time: formatTime(hours, minutes),
    fullDateTime: turkeyDate
  };
};

// Kalan çalışma süresini hesapla
export const getRemainingWorkingTime = (currentMinutes, endMinutes) => {
  const remainingMinutes = endMinutes - currentMinutes;
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  
  return {
    totalMinutes: remainingMinutes,
    hours,
    minutes,
    formatted: `${hours} saat ${minutes} dakika`
  };
};

// Saat formatını düzenle
export const formatTime = (hours, minutes) => {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Mesai saatleri bilgisini al
export const getWorkingHoursInfo = () => {
  return {
    days: 'Pazartesi - Cuma',
    hours: '08:30 - 17:30',
    timezone: 'KKTC Saati (GMT+3)',
    policy: 'Request\'ler sadece mesai saatleri içinde oluşturulabilir.',
    exceptions: []
  };
};

// Debug için mevcut saat bilgilerini al
export const getCurrentTimeInfo = () => {
  const now = new Date();
  const kktcTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
  
  return {
    localTime: now.toLocaleString('tr-TR'),
    kktcTime: kktcTime.toLocaleString('tr-TR'),
    dayOfWeek: kktcTime.getDay(),
    dayName: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][kktcTime.getDay()],
    isWeekend: kktcTime.getDay() === 0 || kktcTime.getDay() === 6,
    timeInMinutes: kktcTime.getHours() * 60 + kktcTime.getMinutes(),
    formatted: formatTime(kktcTime.getHours(), kktcTime.getMinutes())
  };
};

// Test fonksiyonu - development için
export const testWorkingHours = () => {
  console.group('🕒 Working Hours Test');
  
  const testCases = [
    { name: 'Pazartesi 09:00', date: new Date('2024-01-15 09:00:00') }, // Pazartesi
    { name: 'Cuma 16:00', date: new Date('2024-01-19 16:00:00') },      // Cuma
    { name: 'Cumartesi 10:00', date: new Date('2024-01-20 10:00:00') }, // Cumartesi
    { name: 'Pazar 14:00', date: new Date('2024-01-21 14:00:00') },     // Pazar
    { name: 'Pazartesi 07:00', date: new Date('2024-01-15 07:00:00') }, // Erken
    { name: 'Pazartesi 18:00', date: new Date('2024-01-15 18:00:00') }  // Geç
  ];
  
  testCases.forEach(testCase => {
    const result = isWithinWorkingHours(testCase.date);
    console.log(`${testCase.name}: ${result.isAllowed ? '✅' : '❌'} - ${result.message}`);
  });
  
  console.log('Current time info:', getCurrentTimeInfo());
  console.groupEnd();
};

// Export all functions
export default {
  isWithinWorkingHours,
  getNextWorkingDay,
  getCurrentOrNextWorkingTime,
  getRemainingWorkingTime,
  formatTime,
  getWorkingHoursInfo,
  getCurrentTimeInfo,
  testWorkingHours
};