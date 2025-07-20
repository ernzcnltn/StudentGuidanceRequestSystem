import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiService, checkTokenValidity } from '../services/api';

const AdminAuthContext = createContext();

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setAdmin(null);
    localStorage.removeItem('admin_token');
    apiService.removeAdminAuthToken();
    
    // DÜZELTME: Admin logout sonrası admin login sayfasına yönlendir
    window.location.href = '/admin/login';
  }, []);

  const checkAdminAuthStatus = useCallback(async () => {
    try {
      // Önce token geçerliliğini kontrol et
      if (!checkTokenValidity(true)) {
        logout();
        return;
      }

      // Token geçerliyse admin profilini al
      const response = await apiService.getAdminProfile();
      if (response.data.success) {
        setAdmin(response.data.data);
      } else {
        logout();
      }
    } catch (error) {
      console.error('Admin auth check failed:', error);
      
      // 401 Unauthorized hatası ise token geçersiz
      if (error.response?.status === 401) {
        logout();
      } else {
        // Başka bir hata ise sadece loading'i kapat
        setLoading(false);
      }
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    
    if (savedToken) {
      // Token'ı API service'e set et
      apiService.setAdminAuthToken(savedToken);
      
      // Token geçerliliğini kontrol et
      if (checkTokenValidity(true)) {
        checkAdminAuthStatus();
      } else {
        // Token süresi dolmuş
        logout();
      }
    } else {
      setLoading(false);
    }
  }, [checkAdminAuthStatus, logout]);

  const login = async (username, password) => {
    try {
      console.log('Admin login attempt:', { username }); // Debug log
      
      const response = await apiService.adminLogin(username, password);
      
      console.log('Admin login response:', response.data); // Debug log
      
      if (response.data.success) {
        const { token, admin: adminData } = response.data.data;
        
        // Admin bilgilerini state'e set et
        setAdmin(adminData);
        
        // Token'ı localStorage'a kaydet
        localStorage.setItem('admin_token', token);
        
        // Token'ı API service'e set et
        apiService.setAdminAuthToken(token);
        
        console.log('Admin login successful, admin data:', adminData); // Debug log
        
        return { success: true };
      } else {
        return { success: false, error: 'Login failed' };
      }
    } catch (error) {
      console.error('Admin login error:', error);
      
      const message = error.response?.data?.error || 'Admin login failed';
      return { success: false, error: message };
    }
  };

  // Token'ı yenile fonksiyonu (opsiyonel)
  const refreshAuth = useCallback(async () => {
    if (checkTokenValidity(true)) {
      try {
        await checkAdminAuthStatus();
      } catch (error) {
        console.error('Auth refresh failed:', error);
        logout();
      }
    } else {
      logout();
    }
  }, [checkAdminAuthStatus, logout]);

  // Sayfa focus'una geldiğinde token'ı kontrol et
  useEffect(() => {
    const handleFocus = () => {
      if (admin && !checkTokenValidity(true)) {
        logout();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [admin, logout]);

  const value = {
    admin,
    loading,
    login,
    logout,
    refreshAuth,
    isAuthenticated: !!admin,
    department: admin?.department || null,
    adminId: admin?.admin_id || null
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};