// AdminNotificationCenter.js - Çeviri desteği eklenmiş

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';
import { apiService } from '../services/api';

const AdminNotificationCenter = ({ onNotificationClick }) => {
  const { admin, isSuperAdmin } = useAdminAuth();
const { t, translateRequestType } = useTranslation();
  const { isDark } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // 👇 YENİ: Admin notification mesajlarını çeviren fonksiyon
  const translateAdminNotification = useCallback((text) => {
    if (!text) return '';
    
    let translated = text;

    // "New Request #123" -> "Yeni Talep #123"
    translated = translated.replace(/New Request #(\d+)/gi, 
      (match, num) => `${t('New Request')} #${num}`
    );

    // "From John Doe - Document Request (Institute)" - parantezli format
translated = translated.replace(/From (.+?) - (.+?) \((.+?)\)/gi,
  (match, name, requestType, category) => {
    const translatedType = translateRequestType(requestType);
    const translatedCategory = t(category.toLowerCase()) || category;
    return `${t('From')} ${name} - ${translatedType} (${translatedCategory})`;
  }
);

// 👇 YENİ: "eren - General Inquiry (Awaiting Review)" formatı
    translated = translated.replace(/^(.+?) - (.+?) \((.+?)\)$/gim,
      (match, name, requestType, status) => {
        const translatedType = translateRequestType(requestType.trim());
        const translatedStatus = t(status) || status;
        return `${name} - ${translatedType} (${translatedStatus})`;
      }
    );

    // 👇 YENİ: "eren - Thesis Submission" formatı (parantezsiz)  
    translated = translated.replace(/^(.+?) - ([^(]+)$/gim,
      (match, name, requestType) => {
        const translatedType = translateRequestType(requestType.trim());
        return `${name} - ${translatedType}`;
      }
    );

// 👇 YENİ EKLE: "From John Doe - Document Request" - parantezsiz format
translated = translated.replace(/From (.+?) - ([^(]+)$/gim,
  (match, name, requestType) => {
    const translatedType = translateRequestType(requestType.trim());
    return `${t('From')} ${name} - ${translatedType}`;
  }
);

    // Exam request patterns
    const examPatterns = [
      { from: /New Make-up Exam Request/gi, to: t('New Make-up Exam Request') },
      { from: /New Resit Exam Request/gi, to: t('New Resit Exam Request') },
      { from: /Approved Make-up Exam Request/gi, to: t('Approved Make-up Exam Request') },
      { from: /Approved Resit Exam Request/gi, to: t('Approved Resit Exam Request') },
      { from: /Rejected Make-up Exam Request/gi, to: t('Rejected Make-up Exam Request') },
      { from: /Rejected Resit Exam Request/gi, to: t('Rejected Resit Exam Request') },
    ];

    examPatterns.forEach(({ from, to }) => {
      translated = translated.replace(from, to);
    });

    // Institute request patterns
    const institutePatterns = [
      { from: /New Institute Request/gi, to: t('New Institute Request') },
      { from: /Informed Institute Request/gi, to: t('Informed Institute Request') },
      { from: /Completed Institute Request/gi, to: t('Completed Institute Request') },
      { from: /Rejected Institute Request/gi, to: t('Rejected Institute Request') },
    ];

    institutePatterns.forEach(({ from, to }) => {
      translated = translated.replace(from, to);
    });

    // "Awaiting Review" -> "İnceleme Bekliyor"
    translated = translated.replace(/Awaiting Review/gi, t('Awaiting Review'));

    // Genel çeviriler
    translated = translated.replace(/From/gi, t('From'));

    return translated;
}, [t, translateRequestType]);

  // Local storage keys
  const getDismissedKey = () => `dismissed_notifications_${admin?.admin_id}`;
  const getReadKey = () => `read_notifications_${admin?.admin_id}`;

  // Get dismissed notifications from localStorage
  const getDismissedNotifications = useCallback(() => {
    if (!admin) return new Set();
    try {
      const dismissed = localStorage.getItem(getDismissedKey());
      return dismissed ? new Set(JSON.parse(dismissed)) : new Set();
    } catch (error) {
      return new Set();
    }
  }, [admin]);

  // Get read notifications from localStorage
  const getReadNotifications = useCallback(() => {
    if (!admin) return new Set();
    try {
      const read = localStorage.getItem(getReadKey());
      return read ? new Set(JSON.parse(read)) : new Set();
    } catch (error) {
      return new Set();
    }
  }, [admin]);

  // Save dismissed notifications to localStorage
  const saveDismissedNotifications = useCallback((dismissedSet) => {
    if (!admin) return;
    try {
      localStorage.setItem(getDismissedKey(), JSON.stringify(Array.from(dismissedSet)));
    } catch (error) {
      console.warn('Failed to save dismissed notifications:', error);
    }
  }, [admin]);

  // Save read notifications to localStorage
  const saveReadNotifications = useCallback((readSet) => {
    if (!admin) return;
    try {
      localStorage.setItem(getReadKey(), JSON.stringify(Array.from(readSet)));
    } catch (error) {
      console.warn('Failed to save read notifications:', error);
    }
  }, [admin]);

  const fetchNotifications = useCallback(async () => {
    if (!admin) return;
    
    try {
      setLoading(true);
      const response = await apiService.getAdminNotifications();
      
      if (response?.data?.success) {
        const serverNotifications = response.data.data;
        
        // Get current dismissed and read notifications
        const dismissedNotifications = getDismissedNotifications();
        const readNotifications = getReadNotifications();
        
        // Filter and process notifications
        const processedNotifications = serverNotifications
          .filter(notification => !dismissedNotifications.has(notification.id))
          .map(notification => ({
            ...notification,
            is_read: readNotifications.has(notification.id)
          }));
        
        setNotifications(processedNotifications);
        
        // Calculate unread count
        const unreadCount = processedNotifications.filter(n => !n.is_read).length;
        setUnreadCount(unreadCount);
        
        console.log('📧 Notifications updated:', {
          total_from_server: serverNotifications.length,
          dismissed: dismissedNotifications.size,
          read: readNotifications.size,
          visible: processedNotifications.length,
          unread: unreadCount
        });
      }
    } catch (error) {
      console.error('Failed to fetch admin notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [admin, getDismissedNotifications, getReadNotifications]);

  useEffect(() => {
    fetchNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const markAsRead = useCallback((notificationId) => {
    console.log('📖 Marking notification as read:', notificationId);
    
    const readNotifications = getReadNotifications();
    const newReadSet = new Set(readNotifications);
    newReadSet.add(notificationId);
    
    saveReadNotifications(newReadSet);
    
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      )
    );
    
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    console.log('✅ Notification marked as read and saved');
  }, [getReadNotifications, saveReadNotifications]);

  const handleNotificationClick = useCallback(async (notification) => {
    console.log('🔔 Notification clicked:', notification);
    
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    setIsOpen(false);

    // 👇 YENİ: EXAM REQUEST NOTIFICATION İÇİN YÖNLENDIRME
    if (notification.type && (
      notification.type === 'exam_request_new' || 
      notification.type === 'exam_request_approved' || 
      notification.type === 'exam_request_rejected'
    )) {
      console.log('📋 Navigating to secretary exam requests...');
       if (onNotificationClick) {
      // exam_request_id'yi gönder
      onNotificationClick(notification.related_request_id, notification.type);
    }
    return;
  
    }

    // 👇 YENİ: INSTITUTE REQUEST NOTIFICATION İÇİN YÖNLENDIRME
    if (notification.type && (
      notification.type === 'institute_request_new' ||
      notification.type === 'institute_request_informed' ||
      notification.type === 'institute_request_completed' ||
      notification.type === 'institute_request_rejected'
    )) {
      console.log('🎓 Navigating to institute requests...');
       if (onNotificationClick) {
      onNotificationClick(notification.related_request_id, notification.type);
    }
    return;
  }

    // Normal request yönlendirmesi
    if (notification.related_request_id && onNotificationClick) {
      onNotificationClick(notification.related_request_id, notification.type);
    }
  }, [markAsRead, onNotificationClick]);

  const deleteNotification = useCallback((notificationId, event) => {
    event.stopPropagation();
    
    console.log('🗑️ Dismissing notification:', notificationId);
    
    const deletedNotification = notifications.find(n => n.id === notificationId);
    const wasUnread = deletedNotification && !deletedNotification.is_read;
    
    const dismissedNotifications = getDismissedNotifications();
    const newDismissedSet = new Set(dismissedNotifications);
    newDismissedSet.add(notificationId);
    
    saveDismissedNotifications(newDismissedSet);
    
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    
    if (wasUnread) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    console.log('✅ Notification dismissed successfully');
  }, [notifications, getDismissedNotifications, saveDismissedNotifications]);

  const deleteAllNotifications = useCallback(() => {
    console.log('🗑️ Dismissing all notifications');
    
    const dismissedNotifications = getDismissedNotifications();
    const newDismissedSet = new Set(dismissedNotifications);
    notifications.forEach(notification => {
      newDismissedSet.add(notification.id);
    });
    
    saveDismissedNotifications(newDismissedSet);
    
    setNotifications([]);
    setUnreadCount(0);
    
    console.log('✅ All notifications dismissed');
  }, [notifications, getDismissedNotifications, saveDismissedNotifications]);

  const getNotificationIcon = (type) => {
    const icons = {
      'new_request': <i className="bi bi-file-earmark-plus text-primary"></i>,
      'status_update': <i className="bi bi-arrow-repeat text-info"></i>,
      'urgent_request': <i className="bi bi-exclamation-triangle text-danger"></i>,
      'exam_request_new': <i className="bi bi-clipboard-check text-warning"></i>,
      'exam_request_approved': <i className="bi bi-check-circle text-success"></i>,
      'exam_request_rejected': <i className="bi bi-x-circle text-danger"></i>,
      'institute_request_new': <i className="bi bi-mortarboard text-primary"></i>,
      'institute_request_informed': <i className="bi bi-info-circle text-info"></i>,
      'institute_request_completed': <i className="bi bi-check-circle text-success"></i>,
      'institute_request_rejected': <i className="bi bi-x-circle text-danger"></i>,
      'system': <i className="bi bi-gear text-warning"></i>,
      'department': <i className="bi bi-building text-secondary"></i>,
      'student_message': <i className="bi bi-chat-dots text-success"></i>,
      'priority_change': <i className="bi bi-arrow-up text-warning"></i>
    };
    return icons[type] || <i className="bi bi-bell text-info"></i>;
  };

  const getNotificationColor = (type, priority) => {
    if (priority === 'Urgent' || type === 'urgent_request') return 'text-danger';
    if (type === 'new_request' || type === 'exam_request_new' || type === 'institute_request_new') return 'text-primary';
    if (type === 'status_update') return 'text-info';
    if (type === 'exam_request_approved' || type === 'institute_request_completed') return 'text-success';
    if (type === 'exam_request_rejected' || type === 'institute_request_rejected') return 'text-danger';
    if (type === 'system') return 'text-warning';
    return isDark ? 'text-light' : 'text-dark';
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - notificationTime) / 1000);
    
    if (diffInSeconds < 60) return t('justNow');
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} ${t('minutesAgo')}`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ${t('hoursAgo')}`;
    return `${Math.floor(diffInSeconds / 86400)} ${t('daysAgo')}`;
  };

  if (!admin) return null;

  const isRTL = document.documentElement.getAttribute('dir') === 'rtl';

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Notification Button */}
      <button
        className="btn btn-outline-light position-relative"
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          border: 'none',
          padding: '0.375rem 0.75rem',
          fontSize: '1rem',
          position: 'relative',
          zIndex: 1040
        }}
      >
        <i className="bi bi-bell" style={{ fontSize: '1.2rem' }}></i>
        
        {unreadCount > 0 && (
          <span 
            className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
            style={{ fontSize: '0.7rem' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9998,
              background: 'rgba(0, 0, 0, 0.2)'
            }}
          />

          {/* Notification Panel */}
          <div
            style={{
              position: 'fixed',
              top: '60px',
              right: isRTL ? 'auto' : '10px',
              left: isRTL ? '10px' : 'auto',
              backgroundColor: isDark ? '#1a202c' : 'white',
              border: `1px solid ${isDark ? '#4a5568' : '#dee2e6'}`,
              borderRadius: '0.375rem',
              boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
              zIndex: 9999,
              width: '420px',
              maxWidth: 'calc(100vw - 20px)',
              maxHeight: '500px',
              display: 'flex',
              flexDirection: 'column',
              animation: 'dropdownSlide 0.2s ease-out'
            }}
          >
            {/* Header */}
            <div 
              className="dropdown-header d-flex justify-content-between align-items-center"
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${isDark ? '#4a5568' : '#dee2e6'}`,
                backgroundColor: isDark ? '#2d3748' : '#f8f9fa',
                color: isDark ? '#e2e8f0' : '#212529'
              }}
            >
              <h6 className="mb-0" style={{ color: isDark ? '#e2e8f0' : '#212529' }}>
                <i className="bi bi-bell me-2"></i>
                {t('adminNotifications')}
              </h6>
              <div className="d-flex gap-2">
                {notifications.length > 0 && (
                  <button 
                    className="btn btn-sm btn-outline-danger"
                    onClick={deleteAllNotifications}
                    title={t('deleteAll')}
                    style={{ fontSize: '0.85rem', padding: '4px 8px' }}
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                )}
                
                <button 
                  className={`btn btn-sm ${isDark ? 'btn-outline-light' : 'btn-outline-secondary'}`}
                  onClick={() => setIsOpen(false)}
                  title={t('close')}
                  style={{ fontSize: '0.85rem', padding: '4px 8px' }}
                >
                  <i className="bi bi-x"></i>
                </button>
              </div>
            </div>
            
            {/* Notifications List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                maxHeight: '400px',
                backgroundColor: isDark ? '#1a202c' : 'white'
              }}
            >
              {loading ? (
                <div className="text-center p-3">
                  <div className={`spinner-border spinner-border-sm ${isDark ? 'text-light' : ''}`} role="status"></div>
                  <span className={`ms-2 ${isDark ? 'text-light' : ''}`}>{t('loading')}...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className={`dropdown-item-text text-center py-4 ${isDark ? 'text-light' : 'text-muted'}`}>
                  <div style={{ fontSize: '2rem' }}>
                    <i className="bi bi-inbox"></i>
                  </div>
                  <p className="mb-0">{t('noNotifications')}</p>
                </div>
              ) : (
                <>
                  {notifications.map((notification, index) => (
                    <div
                      key={notification.id}
                      className="dropdown-item"
                      style={{ 
                        cursor: 'pointer', 
                        borderBottom: index < notifications.length - 1 
                          ? `1px solid ${isDark ? '#4a5568' : '#eee'}`
                          : 'none',
                        padding: '12px 16px',
                        transition: 'background-color 0.2s',
                        backgroundColor: !notification.is_read 
                          ? (isDark ? '#2d3748' : '#f8f9fa')
                          : (isDark ? '#1a202c' : 'white')
                      }}
                      onClick={() => handleNotificationClick(notification)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isDark 
                          ? '#4a5568'
                          : (notification.is_read ? '#f8f9fa' : '#e9ecef');
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = !notification.is_read
                          ? (isDark ? '#2d3748' : '#f8f9fa')
                          : (isDark ? '#1a202c' : 'white');
                      }}
                    >
                      <div className="d-flex align-items-start">
                        <div className="me-2 mt-1">
                          <span style={{ fontSize: '1.2rem' }}>
                            {getNotificationIcon(notification.type)}
                          </span>
                        </div>
                        <div className="flex-grow-1">
                          <h6 
                            className={`mb-1 ${getNotificationColor(notification.type, notification.priority)}`}
                            style={{ fontSize: '0.9rem', fontWeight: '600' }}
                          >
                            {translateAdminNotification(notification.title)} {/* 👈 ÇEVİRİ */}
                          </h6>
                          <p 
                            className={`mb-1 ${isDark ? 'text-gray-300' : 'text-muted'}`}
                            style={{ fontSize: '0.8rem', lineHeight: '1.3' }}
                          >
                            {translateAdminNotification(notification.message)} {/* 👈 ÇEVİRİ */}
                          </p>
                          <div className="d-flex justify-content-between align-items-center">
                            <small className={isDark ? 'text-gray-400' : 'text-muted'}>
                              {formatTimeAgo(notification.created_at)}
                            </small>
                            <div className="d-flex align-items-center gap-1">
                              {!notification.is_read && (
                                <span className="badge bg-primary" style={{ fontSize: '0.6rem' }}>
                                  {t('new')}
                                </span>
                              )}
                              <button
                                className="btn btn-sm btn-outline-danger"
                                style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                onClick={(e) => deleteNotification(notification.id, e)}
                                title={t('delete')}
                              >
                                <i className="bi bi-x"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            
            {/* Footer */}
            <div 
              className="dropdown-divider" 
              style={{ 
                margin: 0, 
                borderTop: `1px solid ${isDark ? '#4a5568' : '#dee2e6'}`
              }}
            ></div>
            <div 
              className="dropdown-item-text text-center"
              style={{ 
                padding: '8px',
                backgroundColor: isDark ? '#2d3748' : 'white',
                color: isDark ? '#a0aec0' : '#6c757d'
              }}
            >
              <small>
                {notifications.length} {t('totalNotifications')}
              </small>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminNotificationCenter;