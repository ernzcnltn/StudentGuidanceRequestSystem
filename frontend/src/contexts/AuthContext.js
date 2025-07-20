import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('token');
    apiService.removeAuthToken();
    
    // Student logout sonrası login sayfasına yönlendir
    window.location.href = '/login';
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await apiService.getProfile();
      if (response.data.success) {
        setUser(response.data.data);
      } else {
        logout();
      }
    } catch (error) {
      console.error('Student auth check failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      apiService.setAuthToken(savedToken);
      checkAuthStatus();
    } else {
      setLoading(false);
    }
  }, [checkAuthStatus]);

  const login = async (student_number, password) => {
    try {
      const response = await apiService.login(student_number, password);
      
      if (response.data.success) {
        const { token, user: userData } = response.data.data;
        
        setUser(userData);
        localStorage.setItem('token', token);
        apiService.setAuthToken(token);
        
        return { success: true };
      }
    } catch (error) {
      const message = error.response?.data?.error || 'Student login failed';
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await apiService.register(userData);
      
      if (response.data.success) {
        return { 
          success: true, 
          message: 'Registration successful! Please login with your credentials.' 
        };
      }
    } catch (error) {
      const message = error.response?.data?.error || 'Registration failed';
      return { success: false, error: message };
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};