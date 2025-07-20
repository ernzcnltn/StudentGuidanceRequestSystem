// frontend/src/components/NotificationCenter.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { apiService } from '../services/api';

const NotificationCenter = () => {
  const { user } = useAuth();
  const { admin } = useAdminAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user || admin) {
      fetchNotifications();
      
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user, admin]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      let response;
      
      if (user) {
        response = await apiService.getStudentNotifications();
      } else if (admin) {
        response = await apiService.getAdminNotifications();
      }
      
      if (response?.data?.success) {
        const newNotifications = response.data.data;
        setNotifications(newNotifications);
        setUnreadCount(newNotifications.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiService.markNotificationAsRead(notificationId);
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
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      'request_created': '📝',
      'status_update': '📊',
      'response_added': '💬',
      'request_urgent': '🚨',
      'system': '⚙️',
      'welcome': '👋'
    };
    return icons[type] || '🔔';
  };

  const getNotificationColor = (type, priority) => {
    if (priority === 'urgent') return 'text-danger';
    if (type === 'status_update') return 'text-success';
    if (type === 'response_added') return 'text-info';
    return 'text-primary';
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - notificationTime) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  if (!user && !admin) return null;

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
            width: '350px', 
            maxHeight: '500px',
            overflowY: 'auto',
            zIndex: 1050
          }}
        >
          <div className="dropdown-header d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Notifications</h6>
            {unreadCount > 0 && (
              <button 
                className="btn btn-sm btn-outline-primary"
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="text-center p-3">
              <div className="spinner-border spinner-border-sm" role="status"></div>
              <span className="ms-2">Loading...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="dropdown-item-text text-center py-4 text-muted">
              <div style={{ fontSize: '2rem' }}>🔔</div>
              <p className="mb-0">No notifications</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`dropdown-item ${!notification.is_read ? 'bg-light' : ''}`}
                style={{ cursor: 'pointer', borderBottom: '1px solid #eee' }}
                onClick={() => markAsRead(notification.id)}
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
                      style={{ fontSize: '0.9rem' }}
                    >
                      {notification.title}
                    </h6>
                    <p className="mb-1 text-muted" style={{ fontSize: '0.8rem' }}>
                      {notification.message}
                    </p>
                    <div className="d-flex justify-content-between align-items-center">
                      <small className="text-muted">
                        {formatTimeAgo(notification.created_at)}
                      </small>
                      {!notification.is_read && (
                        <span className="badge bg-primary" style={{ fontSize: '0.6rem' }}>
                          New
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          
          <div className="dropdown-divider"></div>
          <div className="dropdown-item-text text-center">
            <button 
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
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

export default NotificationCenter;