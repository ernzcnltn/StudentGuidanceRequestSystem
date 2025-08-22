// AdminNotificationCenter.js - En basit ve çalışan çözüm

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { apiService } from '../services/api';

const AdminNotificationCenter = ({ onNotificationClick }) => {
  const { admin, isSuperAdmin } = useAdminAuth();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const markAsRead = useCallback((notificationId) => {
    console.log('📖 Marking notification as read:', notificationId);
    
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
    
    console.log('✅ Notification marked as read and saved');
  }, [getReadNotifications, saveReadNotifications]);

  const handleNotificationClick = useCallback(async (notification) => {
    console.log('🔔 Notification clicked:', notification);
    
    // Mark as read if not already read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // Close dropdown
    setIsOpen(false);

    // Navigate to the request if it has a related_request_id
    if (notification.related_request_id && onNotificationClick) {
      onNotificationClick(notification.related_request_id, notification.type);
    }
  }, [markAsRead, onNotificationClick]);

  const deleteNotification = useCallback((notificationId, event) => {
    event.stopPropagation();
    
    console.log('🗑️ Dismissing notification:', notificationId);
    
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
    
    console.log('✅ Notification dismissed successfully');
  }, [notifications, getDismissedNotifications, saveDismissedNotifications]);

  const deleteAllNotifications = useCallback(() => {
    console.log('🗑️ Dismissing all notifications');
    
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
    
    console.log('✅ All notifications dismissed');
  }, [notifications, getDismissedNotifications, saveDismissedNotifications]);

  const getNotificationIcon = (type) => {
    const icons = {
      'new_request': <i className="bi bi-file-earmark-plus text-primary"></i>,
      'status_update': <i className="bi bi-arrow-repeat text-info"></i>,
      'urgent_request': <i className="bi bi-exclamation-triangle text-danger"></i>,
      'system': <i className="bi bi-gear text-warning"></i>,
      'department': <i className="bi bi-building text-secondary"></i>,
      'student_message': <i className="bi bi-chat-dots text-success"></i>,
      'priority_change': <i className="bi bi-arrow-up text-warning"></i>
    };
    return icons[type] || <i className="bi bi-bell text-info"></i>;
  };

  const getNotificationColor = (type, priority) => {
    if (priority === 'Urgent' || type === 'urgent_request') return 'text-danger';
    if (type === 'new_request') return 'text-primary';
    if (type === 'status_update') return 'text-info';
    if (type === 'system') return 'text-warning';
    return 'text-dark';
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - notificationTime) / 1000);
    
    if (diffInSeconds < 60) return t('justNow', 'Just now');
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} ${t('minutesAgo', 'min ago')}`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ${t('hoursAgo', 'h ago')}`;
    return `${Math.floor(diffInSeconds / 86400)} ${t('daysAgo', 'd ago')}`;
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
            <h6 className="mb-0">
              <i className="bi bi-bell me-2"></i>
              {t('adminNotifications', 'Admin Notifications')}
            </h6>
            <div className="d-flex gap-2">
              {notifications.length > 0 && (
                <button 
                  className="btn btn-sm btn-outline-danger"
                  onClick={deleteAllNotifications}
                  title={t('deleteAll', 'Delete All')}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
              
              <button 
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setIsOpen(false)}
                title={t('close', 'Close')}
              >
                <i className="bi bi-x"></i>
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="text-center p-3">
              <div className="spinner-border spinner-border-sm" role="status"></div>
              <span className="ms-2">{t('loading', 'Loading')}...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="dropdown-item-text text-center py-4 text-muted">
              <div style={{ fontSize: '2rem' }}>
                <i className="bi bi-inbox"></i>
              </div>
              <p className="mb-0">{t('noNotifications', 'No notifications')}</p>
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
                              {t('new', 'New')}
                            </span>
                          )}
                          <button
                            className="btn btn-sm btn-outline-danger"
                            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                            onClick={(e) => deleteNotification(notification.id, e)}
                            title={t('delete', 'Delete')}
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
          
          <div className="dropdown-divider"></div>
          <div className="dropdown-item-text text-center">
            <small className="text-muted">
              {notifications.length} {t('totalNotifications', 'total notifications')}
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