import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { apiService } from '../services/api';

export const useNotifications = () => {
  const { user } = useAuth();
  const { admin } = useAdminAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user && !admin) return;
    
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
  }, [user, admin]);

  const markAsRead = useCallback(async (notificationId) => {
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
  }, []);

  const addNotification = useCallback((notification) => {
    setNotifications(prev => [notification, ...prev]);
    if (!notification.is_read) {
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    addNotification
  };
};
