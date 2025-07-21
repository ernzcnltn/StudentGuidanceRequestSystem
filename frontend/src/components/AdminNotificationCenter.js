// frontend/src/components/AdminNotificationCenter.js
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { apiService } from '../services/api';

const AdminNotificationCenter = () => {
  const { admin } = useAdminAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (admin) {
      fetchNotifications();
      
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [admin]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAdminNotifications();
      
      if (response?.data?.success) {
        const newNotifications = response.data.data;
        setNotifications(newNotifications);
        setUnreadCount(newNotifications.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Failed to fetch admin notifications:', error);
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
      'new_request': '📝',
      'status_update': '📊',
      'urgent_request': '🚨',
      'system': '⚙️',
      'department': '🏢',
      'student_message': '💬'
    };
    return icons[type] || '🔔';
  };

  const getNotificationColor = (type, priority) => {
    if (priority === 'urgent') return 'text-danger';
    if (type === 'new_request') return 'text-primary';
    if (type === 'urgent_request') return 'text-danger';
    if (type === 'system') return 'text-warning';
    return 'text-info';
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - notificationTime) / 1000);
    
    if (diffInSeconds < 60) return 'Az önce';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} dk önce`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} sa önce`;
    return `${Math.floor(diffInSeconds / 86400)} gün önce`;
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
            width: '400px', 
            maxHeight: '500px',
            overflowY: 'auto',
            zIndex: 1050,
            position: 'absolute',
            right: 0,
            top: '100%'
          }}
        >
          <div className="dropdown-header d-flex justify-content-between align-items-center">
            <h6 className="mb-0">📢 Admin Bildirimleri</h6>
            {unreadCount > 0 && (
              <button 
                className="btn btn-sm btn-outline-primary"
                onClick={markAllAsRead}
              >
                Tümünü okundu işaretle
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="text-center p-3">
              <div className="spinner-border spinner-border-sm" role="status"></div>
              <span className="ms-2">Yükleniyor...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="dropdown-item-text text-center py-4 text-muted">
              <div style={{ fontSize: '2rem' }}>🔔</div>
              <p className="mb-0">Bildirim yok</p>
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
                          Yeni
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
              Kapat
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

export default AdminNotificationCenter;