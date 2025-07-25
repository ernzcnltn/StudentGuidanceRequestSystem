// frontend/src/components/AdminNotificationCenter.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { apiService } from '../services/api';

const AdminNotificationCenter = ({ onNotificationClick }) => {
  const { admin } = useAdminAuth();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!admin) return;
    
    try {
      setLoading(true);
      const response = await apiService.getAdminNotifications();
      
      if (response?.data?.success) {
        const newNotifications = response.data.data;
        console.log('Notifications:', newNotifications); // BU SATIRI EKLEYİN - DEBUG İÇİN
        setNotifications(newNotifications);
        setUnreadCount(newNotifications.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Failed to fetch admin notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    fetchNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (notificationId) => {
    try {
      await apiService.markNotificationAsRead(notificationId);
      
      // Update local state immediately
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsAsRead();
      
      // Update local state immediately
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read first
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    // Close dropdown
    setIsOpen(false);

     if (onNotificationClick && notification.related_request_id) {
    onNotificationClick(notification.related_request_id, notification.type);
    return;
  }
    
    // Handle navigation based on notification type
    if (notification.related_request_id) {
      // Navigate to specific request
      if (onNotificationClick) {
        onNotificationClick(notification.related_request_id, notification.type);
      } else {
        // Default navigation - scroll to request or switch to requests tab
        window.location.hash = `request-${notification.related_request_id}`;
        
        // If we're on admin dashboard, trigger tab switch
        const event = new CustomEvent('switchToRequestsTab', {
          detail: { requestId: notification.related_request_id }
        });
        window.dispatchEvent(event);
      }
    }
  };

  const deleteNotification = async (notificationId, event) => {
    event.stopPropagation(); // Prevent notification click
    
    try {
      // If you have a delete API endpoint
      // await apiService.deleteNotification(notificationId);
      
      // For now, just mark as read and remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      'new_request': '📝',
      'status_update': '📊',
      'urgent_request': '🚨',
      'system': '⚙️',
      'department': '🏢',
      'student_message': '💬',
      'priority_change': '⚡'
    };
    return icons[type] || '🔔';
  };

  const getNotificationColor = (type, priority) => {
    if (priority === 'urgent' || type === 'urgent_request') return 'text-danger';
    if (type === 'new_request') return 'text-primary';
    if (type === 'status_update') return 'text-success';
    if (type === 'system') return 'text-warning';
    return 'text-info';
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - notificationTime) / 1000);
    
    if (diffInSeconds < 60) return t('justNow', 'Az önce');
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} ${t('minutesAgo', 'dk önce')}`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ${t('hoursAgo', 'sa önce')}`;
    return `${Math.floor(diffInSeconds / 86400)} ${t('daysAgo', 'gün önce')}`;
  };

  if (!admin) return null;

  return (
    <div className="dropdown">
      <button
        className="btn btn-outline-light position-relative"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ border: 'none' }}
      >
        🔔
        {unreadCount > 0 && (
          <span 
            className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
            style={{ fontSize: '0.7rem' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          className="dropdown-menu dropdown-menu-end show"
          style={{ 
            width: '420px', 
            maxHeight: '500px',
            overflowY: 'auto',
            zIndex: 1050,
            position: 'absolute',
            right: 0,
            top: '100%'
          }}
        >
          <div className="dropdown-header d-flex justify-content-between align-items-center">
            <h6 className="mb-0">📢 {t('adminNotifications', 'Admin Bildirimleri')}</h6>
            <div className="d-flex gap-2">
              {unreadCount > 0 && (
                <button 
                  className="btn btn-sm btn-outline-primary"
                  onClick={markAllAsRead}
                  title={t('markAllAsRead', 'Tümünü okundu işaretle')}
                >
                  ✓
                </button>
              )}
              <button 
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setIsOpen(false)}
                title={t('close', 'Kapat')}
              >
                ✕
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="text-center p-3">
              <div className="spinner-border spinner-border-sm" role="status"></div>
              <span className="ms-2">{t('loading', 'Yükleniyor')}...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="dropdown-item-text text-center py-4 text-muted">
              <div style={{ fontSize: '2rem' }}>🔔</div>
              <p className="mb-0">{t('noNotifications', 'Bildirim yok')}</p>
            </div>
          ) : (
            <>
              {notifications.map((notification, index) => (
                <div
                  key={notification.id}
                  className={`dropdown-item ${!notification.is_read ? 'bg-light' : ''}`}
                  style={{ 
                    cursor: 'pointer', 
                    borderBottom: index < notifications.length - 1 ? '1px solid #eee' : 'none',
                    padding: '12px 16px'
                  }}
                  onClick={() => handleNotificationClick(notification)}
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
                        {notification.title}
                      </h6>
                      <p className="mb-1 text-muted" style={{ fontSize: '0.8rem', lineHeight: '1.3' }}>
                        {notification.message}
                      </p>
                      <div className="d-flex justify-content-between align-items-center">
                        <small className="text-muted">
                          {formatTimeAgo(notification.created_at)}
                        </small>
                        <div className="d-flex align-items-center gap-1">
                          {!notification.is_read && (
                            <span className="badge bg-primary" style={{ fontSize: '0.6rem' }}>
                              {t('new', 'Yeni')}
                            </span>
                          )}
                          <button
                            className="btn btn-sm btn-outline-danger"
                            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                            onClick={(e) => deleteNotification(notification.id, e)}
                            title={t('delete', 'Sil')}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
          
          <div className="dropdown-divider"></div>
          <div className="dropdown-item-text text-center">
            <small className="text-muted">
              {notifications.length} {t('totalNotifications', 'toplam bildirim')}
            </small>
          </div>
        </div>
      )}
      
      {isOpen && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100"
          style={{ zIndex: 1040 }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminNotificationCenter;