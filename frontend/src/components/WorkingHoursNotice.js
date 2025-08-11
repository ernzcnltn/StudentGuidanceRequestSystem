// frontend/src/components/WorkingHoursNotice.js - Mesai saati bildirimi komponenti
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

// Working hours utility (frontend copy)
const isWithinWorkingHours = (date = new Date()) => {
  try {
    // KKTC saat dilimi için tarih oluştur (GMT+3, Türkiye ile aynı saat dilimi)
    const kktcDate = new Date(date.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
    
    const dayOfWeek = kktcDate.getDay();
    
    // Hafta sonu kontrolü
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return {
        isAllowed: false,
        reason: 'weekend',
        message: 'Hafta sonları request oluşturamazsınız.'
      };
    }
    
    const hours = kktcDate.getHours();
    const minutes = kktcDate.getMinutes();
    const currentTimeInMinutes = hours * 60 + minutes;
    
    const workStartMinutes = 8 * 60 + 30; // 08:30
    const workEndMinutes = 17 * 60 + 30;   // 17:30
    
    if (currentTimeInMinutes < workStartMinutes) {
      return {
        isAllowed: false,
        reason: 'too_early',
        message: 'Henüz mesai saatleri başlamadı.',
        currentTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        nextTime: '08:30'
      };
    }
    
    if (currentTimeInMinutes >= workEndMinutes) {
      return {
        isAllowed: false,
        reason: 'too_late',
        message: 'Mesai saatleri sona erdi.',
        currentTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        nextTime: 'Yarın 08:30'
      };
    }
    
    return {
      isAllowed: true,
      reason: 'working_hours',
      message: 'Mesai saatleri içindesiniz.',
      currentTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    };
    
  } catch (error) {
    console.error('Working hours check error:', error);
    return {
      isAllowed: false,
      reason: 'error',
      message: 'Mesai saati kontrolü yapılamadı.'
    };
  }
};

const getNextWorkingDay = (currentDate = new Date()) => {
  const nextDay = new Date(currentDate.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
  
  do {
    nextDay.setDate(nextDay.getDate() + 1);
  } while (nextDay.getDay() === 0 || nextDay.getDay() === 6);
  
  return {
    date: nextDay.toLocaleDateString('tr-TR'),
    time: '08:30',
    dayName: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][nextDay.getDay()]
  };
};

const WorkingHoursNotice = ({ showAlways = false, className = '' }) => {
  const { t } = useTranslation();
  const [workingHoursStatus, setWorkingHoursStatus] = useState(null);
  const [currentTime, setCurrentTime] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const updateWorkingHoursStatus = () => {
      const status = isWithinWorkingHours();
      const now = new Date();
      const kktcTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
      
      setWorkingHoursStatus(status);
      setCurrentTime(kktcTime.toLocaleTimeString('tr-TR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }));
      
      // Sadece mesai dışındaysa ya da showAlways true ise göster
      setIsVisible(!status.isAllowed || showAlways);
    };

    // İlk güncelleme
    updateWorkingHoursStatus();
    
    // Her dakika güncelle
    const interval = setInterval(updateWorkingHoursStatus, 60000);
    
    return () => clearInterval(interval);
  }, [showAlways]);

  if (!workingHoursStatus || (!isVisible && !showAlways)) {
    return null;
  }

  const getAlertClass = () => {
    if (workingHoursStatus.isAllowed) {
      return 'alert-success';
    }
    switch (workingHoursStatus.reason) {
      case 'weekend':
        return 'alert-warning';
      case 'too_early':
      case 'too_late':
        return 'alert-info';
      default:
        return 'alert-secondary';
    }
  };

  const getIcon = () => {
    if (workingHoursStatus.isAllowed) return '✅';
    switch (workingHoursStatus.reason) {
      case 'weekend': return '📅';
      case 'too_early': return '🌅';
      case 'too_late': return '🌙';
      default: return '🕒';
    }
  };

  const getDetailedMessage = () => {
    if (workingHoursStatus.isAllowed) {
      return (
        <div>
          <strong>Mesai saatleri içindesiniz!</strong>
          <br />
          <small>Request oluşturabilirsiniz. Mesai bitiş: 17:30</small>
        </div>
      );
    }

    switch (workingHoursStatus.reason) {
      case 'weekend':
        const nextWorking = getNextWorkingDay();
        return (
          <div>
            <strong>Hafta sonu - Request oluşturamazsınız</strong>
            <br />
            <small>
              Bir sonraki çalışma günü: <strong>{nextWorking.dayName}, {nextWorking.date} saat {nextWorking.time}</strong>
            </small>
          </div>
        );
      
      case 'too_early':
        return (
          <div>
            <strong>Henüz mesai saatleri başlamadı</strong>
            <br />
            <small>
              Mesai başlangıcı: <strong>08:30</strong> - Request oluşturmak için bekleyin
            </small>
          </div>
        );
      
      case 'too_late':
        const nextDay = getNextWorkingDay();
        return (
          <div>
            <strong>Mesai saatleri sona erdi</strong>
            <br />
            <small>
              Bir sonraki mesai: <strong>{nextDay.dayName}, {nextDay.date} saat {nextDay.time}</strong>
            </small>
          </div>
        );
      
      default:
        return (
          <div>
            <strong>Mesai saati kontrolü yapılamadı</strong>
            <br />
            <small>Request oluşturmadan önce tekrar deneyin</small>
          </div>
        );
    }
  };

  return (
    <div className={`alert ${getAlertClass()} ${className}`} role="alert">
      <div className="d-flex align-items-start">
        <div className="me-3" style={{ fontSize: '1.5rem' }}>
          {getIcon()}
        </div>
        <div className="flex-grow-1">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <h6 className="alert-heading mb-0">
              🕒 Mesai Saatleri Durumu
            </h6>
            <small className="text-muted">
              Türkiye Saati: {currentTime}
            </small>
          </div>
          
          {getDetailedMessage()}
          
          <hr className="my-3" />
          
          <div className="row">
            <div className="col-md-6">
              <h6 className="mb-2">📋 Mesai Saatleri</h6>
              <ul className="mb-0 small">
                <li><strong>Pazartesi - Cuma:</strong> 08:30 - 17:30</li>
                <li><strong>Cumartesi - Pazar:</strong> Kapalı</li>
                <li><strong>Saat Dilimi:</strong> KKTC Saati (GMT+3)</li>
              </ul>
            </div>
            <div className="col-md-6">
              <h6 className="mb-2">ℹ️ Önemli Bilgiler</h6>
              <ul className="mb-0 small">
                <li>Request'ler sadece mesai saatlerinde oluşturulabilir</li>
                <li>Acil durumlar için öğrenci işleri ile iletişime geçin</li>
                <li>Mevcut request'lerinizi her zaman görüntüleyebilirsiniz</li>
              </ul>
            </div>
          </div>
          
          {!workingHoursStatus.isAllowed && (
            <div className="mt-3">
              <div className="d-flex gap-2">
                <button 
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => window.location.reload()}
                >
                  🔄 Saati Yenile
                </button>
                <a 
                  href="/requests" 
                  className="btn btn-sm btn-outline-secondary"
                >
                  📋 Mevcut Request'lerim
                </a>
              </div>
            </div>
          )}
        </div>
        
        {!showAlways && (
          <button
            type="button"
            className="btn-close"
            onClick={() => setIsVisible(false)}
            aria-label="Close"
          ></button>
        )}
      </div>
    </div>
  );
};

// Compact version for small spaces
export const WorkingHoursStatus = ({ className = '' }) => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const updateStatus = () => {
      setStatus(isWithinWorkingHours());
    };

    updateStatus();
    const interval = setInterval(updateStatus, 60000);
    
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  return (
    <div className={`d-flex align-items-center ${className}`}>
      <span className="me-2">{status.isAllowed ? '✅' : '❌'}</span>
      <small className={status.isAllowed ? 'text-success' : 'text-warning'}>
        {status.isAllowed ? 'Mesai Saatleri İçinde' : 'Mesai Dışı'}
      </small>
      {status.currentTime && (
        <small className="text-muted ms-2">({status.currentTime})</small>
      )}
    </div>
  );
};

// Modal version for create request page
export const WorkingHoursModal = ({ show, onClose, allowProceed = false }) => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (show) {
      setStatus(isWithinWorkingHours());
    }
  }, [show]);

  if (!show || !status) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
      <div className="modal fade show d-block" style={{ zIndex: 1050 }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                🕒 Mesai Saatleri Bildirimi
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            
            <div className="modal-body">
              <div className="text-center mb-4">
                <div style={{ fontSize: '4rem' }}>
                  {status.isAllowed ? '✅' : '⚠️'}
                </div>
                <h4 className={status.isAllowed ? 'text-success' : 'text-warning'}>
                  {status.message}
                </h4>
              </div>
              
              <div className="alert alert-info">
                <h6>📋 Mesai Saatleri</h6>
                <ul className="mb-0">
                  <li><strong>Çalışma Günleri:</strong> Pazartesi - Cuma</li>
                  <li><strong>Çalışma Saatleri:</strong> 08:30 - 17:30</li>
                  <li><strong>Saat Dilimi:</strong> KKTC Saati</li>
                </ul>
              </div>
              
              {!status.isAllowed && (
                <div className="alert alert-warning">
                  <h6> Neden Şimdi Request Oluşturamıyorum?</h6>
                  <p className="mb-0">
                    Request'ler sadece mesai saatleri içinde oluşturulabilir. 
                    Bu sayede admin ekibimiz talepinizi en kısa sürede değerlendirebilir.
                  </p>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {status.isAllowed ? 'Anladım' : 'Tamam'}
              </button>
              {status.isAllowed && allowProceed && (
                <button type="button" className="btn btn-primary" onClick={onClose}>
                  Request Oluşturmaya Devam Et
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Hook for using working hours status
export const useWorkingHours = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateStatus = () => {
      try {
        const newStatus = isWithinWorkingHours();
        setStatus(newStatus);
        setLoading(false);
      } catch (error) {
        console.error('Working hours check error:', error);
        setStatus({
          isAllowed: false,
          reason: 'error',
          message: 'Mesai saati kontrolü yapılamadı'
        });
        setLoading(false);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  return {
    status,
    loading,
    isWithinWorkingHours: status?.isAllowed || false,
    canCreateRequest: status?.isAllowed || false,
    reason: status?.reason,
    message: status?.message,
    currentTime: status?.currentTime,
    nextTime: status?.nextTime
  };
};

export default WorkingHoursNotice;