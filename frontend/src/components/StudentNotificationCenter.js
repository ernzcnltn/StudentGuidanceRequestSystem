// StudentNotificationCenter.js - Çeviri desteği ile güncellenmiş

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';
import { apiService } from '../services/api';
import { useNavigate } from 'react-router-dom';

const StudentNotificationCenter = ({ onNotificationClick }) => {
  const { user } = useAuth();
  const { t ,translateRequestType} = useTranslation(); // currentLanguage eklemeye gerek yok, sadece t kullanıyoruz
  const { isDark } = useTheme();
    const navigate = useNavigate(); // 👈 YENİ EKLEME

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // 👇 YENİ: Notification mesajlarını çeviren fonksiyon
  const translateNotificationText = useCallback((text) => {
    if (!text) return '';
    
    let translated = text;

    // "Make-up Exam Request Submitted" vb.
    const patterns = [
      { from: 'Make-up Exam Request Submitted', to: t('Make-up Exam Request Submitted') },
      { from: 'Make-up Exam Request Approved', to: t('Make-up Exam Request Approved') },
      { from: 'Make-up Exam Request Rejected', to: t('Make-up Exam Request Rejected') },
      { from: 'Resit Exam Request Submitted', to: t('Resit Exam Request Submitted') },
      { from: 'Resit Exam Request Approved', to: t('Resit Exam Request Approved') },
      { from: 'Resit Exam Request Rejected', to: t('Resit Exam Request Rejected') },
    ];

    patterns.forEach(({ from, to }) => {
      translated = translated.replace(new RegExp(from, 'gi'), to);
    });

    // "Request #55 Status Update" -> "Talep #55 Durum Güncellendi"
    translated = translated.replace(
      /Request #(\d+) Status Update/gi,
      (match, num) => `${t('Request')} #${num} ${t('Status Update')}`
    );

// Makeup patterns - [A-Z0-9]+ yerine [A-Z0-9\s]+ yap
translated = translated.replace(
  /Your makeup exam request for ([A-Z0-9\s]+\s*-\s*.+?) is awaiting review/gi,
  (match, course) => `${course} ${t('Your makeup exam request for')} ${t('is awaiting review')}`
);

translated = translated.replace(
  /Your makeup exam request for ([A-Z0-9\s]+\s*-\s*.+?) has been approved/gi,
  (match, course) => `${course} ${t('Your makeup exam request for')} ${t('has been approved')}`
);

translated = translated.replace(
  /Your makeup exam request for ([A-Z0-9\s]+\s*-\s*.+?) was not approved/gi,
  (match, course) => `${course} ${t('Your makeup exam request for')} ${t('was not approved')}`
);

// Resit patterns - aynı şekilde
translated = translated.replace(
  /Your resit exam request for ([A-Z0-9\s]+\s*-\s*.+?) is awaiting review/gi,
  (match, course) => `${course} ${t('Your resit exam request for')} ${t('is awaiting review')}`
);

translated = translated.replace(
  /Your resit exam request for ([A-Z0-9\s]+\s*-\s*.+?) has been approved/gi,
  (match, course) => `${course} ${t('Your resit exam request for')} ${t('has been approved')}`
);

translated = translated.replace(
  /Your resit exam request for ([A-Z0-9\s]+\s*-\s*.+?) was not approved/gi,
  (match, course) => `${course} ${t('Your resit exam request for')} ${t('was not approved')}`
);

    // "Your request "Thesis Submission" status changed to Rejected"
  
translated = translated.replace(
  /Your request "(.+?)" status changed to (Pending|Rejected|Completed|Informed)/gi,
  (match, requestType, status) => {
    const translatedType = translateRequestType(requestType);
    return `${t('Your request')} "${translatedType}" ${t('status changed to')} ${t(status.toLowerCase())}`;
  }
);

    // "New Response for Request #55"
    translated = translated.replace(
      /New Response for Request #(\d+)/gi,
      (match, num) => `${t('New Response for Request')} #${num}`
    );

    // "You received a response for your request"
    translated = translated.replace(
      /You received a response for your request/gi,
      t('You received a response for your request')
    );

    return translated;
  }, [t,translateRequestType]);

  // Local storage keys for student notifications
  const getDismissedKey = () => `dismissed_notifications_student_${user?.student_id}`;
  const getReadKey = () => `read_notifications_student_${user?.student_id}`;

  // Get dismissed notifications from localStorage
  const getDismissedNotifications = useCallback(() => {
    if (!user) return new Set();
    try {
      const dismissed = localStorage.getItem(getDismissedKey());
      return dismissed ? new Set(JSON.parse(dismissed)) : new Set();
    } catch (error) {
      return new Set();
    }
  }, [user]);

  // Get read notifications from localStorage
  const getReadNotifications = useCallback(() => {
    if (!user) return new Set();
    try {
      const read = localStorage.getItem(getReadKey());
      return read ? new Set(JSON.parse(read)) : new Set();
    } catch (error) {
      return new Set();
    }
  }, [user]);

  // Save dismissed notifications to localStorage
  const saveDismissedNotifications = useCallback((dismissedSet) => {
    if (!user) return;
    try {
      localStorage.setItem(getDismissedKey(), JSON.stringify(Array.from(dismissedSet)));
    } catch (error) {
      console.warn('Failed to save dismissed notifications:', error);
    }
  }, [user]);

  // Save read notifications to localStorage
  const saveReadNotifications = useCallback((readSet) => {
    if (!user) return;
    try {
      localStorage.setItem(getReadKey(), JSON.stringify(Array.from(readSet)));
    } catch (error) {
      console.warn('Failed to save read notifications:', error);
    }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const response = await apiService.getStudentNotifications();
      
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
        
        console.log('Student notifications updated:', {
          total_from_server: serverNotifications.length,
          dismissed: dismissedNotifications.size,
          read: readNotifications.size,
          visible: processedNotifications.length,
          unread: unreadCount
        });
      }
    } catch (error) {
      console.error('Failed to fetch student notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user, getDismissedNotifications, getReadNotifications]);

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
    console.log('Marking student notification as read:', notificationId);
    
    // Get current read notifications
    const readNotifications = getReadNotifications();
    
    // Add to read set
    const newReadSet = new Set(readNotifications);
    newReadSet.add(notificationId);
    
    // Save to localStorage
    saveReadNotifications(newReadSet);
    
    // Update local state
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      )
    );
    
    // Update unread count
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    console.log('Student notification marked as read and saved');
  }, [getReadNotifications, saveReadNotifications]);

  const handleNotificationClick = useCallback(async (notification) => {
    console.log('🔔 Student notification clicked:', notification);
    
    // Mark as read if not already read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // Close dropdown
    setIsOpen(false);

    // EXAM REQUEST NOTIFICATION İSE EXAM REQUESTS SAYFASINA GİT
    if (notification.type && notification.type.startsWith('exam_request_')) {
      const examRequestId = notification.related_request_id;
      
      console.log('📋 Navigating to exam requests page...', { examRequestId });
      
      // React Router ile yumuşak geçiş
      navigate(`/exam-request?tab=my-requests#exam-${examRequestId}`);
      
      // Biraz bekle ki sayfa render olsun, sonra scroll yap
      setTimeout(() => {
        const element = document.getElementById(`exam-request-${examRequestId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Highlight efekti
          element.style.backgroundColor = '#fff3cd';
          element.style.border = '2px solid #ffc107';
          element.style.borderRadius = '8px';
          element.style.transition = 'all 0.3s ease';
          
          setTimeout(() => {
            element.style.backgroundColor = '';
            element.style.border = '';
            element.style.borderRadius = '';
          }, 3000);
        }
      }, 500);

      return;
    }

    // NORMAL REQUEST İSE REQUESTS SAYFASINA GİT
    if (notification.related_request_id && onNotificationClick) {
      onNotificationClick(notification.related_request_id, notification.type);
    }
  }, [markAsRead, onNotificationClick, navigate]);

  const deleteNotification = useCallback((notificationId, event) => {
    event.stopPropagation();
    
    console.log('Dismissing student notification:', notificationId);
    
    // Check if notification is unread before dismissing
    const deletedNotification = notifications.find(n => n.id === notificationId);
    const wasUnread = deletedNotification && !deletedNotification.is_read;
    
    // Get current dismissed notifications
    const dismissedNotifications = getDismissedNotifications();
    
    // Add to dismissed set
    const newDismissedSet = new Set(dismissedNotifications);
    newDismissedSet.add(notificationId);
    
    // Save to localStorage
    saveDismissedNotifications(newDismissedSet);
    
    // Remove from local state immediately
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    
    // Update unread count only if the notification was unread
    if (wasUnread) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    console.log('Student notification dismissed successfully');
  }, [notifications, getDismissedNotifications, saveDismissedNotifications]);

  const deleteAllNotifications = useCallback(() => {
    console.log('Dismissing all student notifications');
    
    // Get current dismissed notifications
    const dismissedNotifications = getDismissedNotifications();
    
    // Add all current notification IDs to dismissed set
    const newDismissedSet = new Set(dismissedNotifications);
    notifications.forEach(notification => {
      newDismissedSet.add(notification.id);
    });
    
    // Save to localStorage
    saveDismissedNotifications(newDismissedSet);
    
    // Clear local state
    setNotifications([]);
    setUnreadCount(0);
    
    console.log('All student notifications dismissed');
  }, [notifications, getDismissedNotifications, saveDismissedNotifications]);

  const getNotificationIcon = (type) => {
    const icons = {
      'request_created': <i className="bi bi-file-earmark-plus text-primary"></i>,
      'status_update': <i className="bi bi-arrow-repeat text-info"></i>,
      'response_added': <i className="bi bi-chat-dots text-success"></i>,
      'request_completed': <i className="bi bi-check-circle text-success"></i>,
      'request_rejected': <i className="bi bi-x-circle text-danger"></i>,
      'exam_request_pending': <i className="bi bi-clipboard-check text-warning"></i>,
      'exam_request_approved': <i className="bi bi-check-circle text-success"></i>,
      'exam_request_rejected': <i className="bi bi-x-circle text-danger"></i>,
      'system': <i className="bi bi-gear text-warning"></i>,
      'welcome': <i className="bi bi-hand-thumbs-up text-primary"></i>,
      'reminder': <i className="bi bi-alarm text-warning"></i>
    };
    return icons[type] || <i className="bi bi-bell text-info"></i>;
  };

  const getNotificationColor = (type, priority) => {
    if (priority === 'Urgent') return 'text-danger';
    if (type === 'request_completed' || type === 'exam_request_approved') return 'text-success';
    if (type === 'request_rejected' || type === 'exam_request_rejected') return 'text-danger';
    if (type === 'response_added') return 'text-info';
    if (type === 'status_update' || type === 'exam_request_pending') return 'text-warning';
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

  if (!user) return null;

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
              width: '380px',
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
                {t('notifications')}
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
                      className={`dropdown-item`}
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
                            {translateNotificationText(notification.title)} {/* 👈 ÇEVİRİ */}
                          </h6>
                          <p 
                            className={`mb-1 ${isDark ? 'text-gray-300' : 'text-muted'}`}
                            style={{ fontSize: '0.8rem', lineHeight: '1.3' }}
                          >
                            {translateNotificationText(notification.message)} {/* 👈 ÇEVİRİ */}
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

export default StudentNotificationCenter;