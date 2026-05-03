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

  // ✅ localStorage'a student data kaydet
  const saveUserToStorage = useCallback((userData) => {
    try {
sessionStorage.setItem('student_data', JSON.stringify(userData));
      console.log('✅ Student data saved to localStorage');
    } catch (error) {
      console.error('❌ Failed to save student data:', error);
    }
  }, []);

  // ✅ localStorage'dan student data yükle
  const loadUserFromStorage = useCallback(() => {
    try {
const savedUser = sessionStorage.getItem('student_data');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        console.log('✅ Loading student data from localStorage');
        setUser(userData);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to load student data:', error);
      sessionStorage.removeItem('student_data');
      return false;
    }
  }, []);

  // ✅ sessionStorage'ı temizle
  const clearUserStorage = useCallback(() => {
    sessionStorage.removeItem('student_data');
    console.log('🧹 Student data cleared from sessionStorage');
  }, []);

  const logout = useCallback(() => {
    setUser(null);
sessionStorage.removeItem('token');
    sessionStorage.removeItem('student_token'); // ✅ EKLE
    clearUserStorage(); // ✅ EKLE
    apiService.removeAuthToken();
    
    // Student logout sonrası login sayfasına yönlendir
    window.location.href = '/login';
  }, [clearUserStorage]);

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await apiService.getProfile();
      if (response.data.success) {
        console.log('Profile data from API:', response.data.data);
        const userData = response.data.data;
        setUser(userData);
        saveUserToStorage(userData); // ✅ EKLE
      } else {
        logout();
      }
    } catch (error) {
      console.error('Student auth check failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout, saveUserToStorage]);

  // ✅ useEffect'i güncelle
  useEffect(() => {
    const initializeAuth = async () => {
      // Hem 'token' hem 'student_token' kontrol et (Magic Link için)
const savedToken = sessionStorage.getItem('student_token') || sessionStorage.getItem('token');
      
      console.log('🔍 AuthContext: Checking token...', !!savedToken);
      
      if (savedToken) {
        console.log('✅ AuthContext: Token found, setting up...');
        apiService.setAuthToken(savedToken);
        
        // Önce localStorage'dan yükle
        const loadedFromStorage = loadUserFromStorage();
        
      if (loadedFromStorage) {
  console.log('✅ AuthContext: Using cached student data');
  setLoading(false);
  // Arka planda API'den de doğrula
  checkAuthStatus().catch(() => {});
} else {
  console.log('🔄 AuthContext: Fetching student from API...');
  await checkAuthStatus();
}
      } else {
        console.log('❌ AuthContext: No token found');
        setLoading(false);
      }
    };

    initializeAuth();
  }, []); // ✅ Dependency array boş

  // Email ile giriş - güncellenmiş fonksiyon
 const login = async (email, password, captchaToken = null) => {
  try {
    const response = await apiService.loginWithEmail(email, password, captchaToken);
      
      if (response.data.success) {
        const { token, user: userData } = response.data.data;
        
        setUser(userData);
sessionStorage.setItem('token', token);
        sessionStorage.setItem('student_token', token); // ✅ EKLE (Magic Link uyumluluğu için)
        saveUserToStorage(userData); // ✅ EKLE
        apiService.setAuthToken(token);
        
        return { success: true };
      }
    } catch (error) {
      console.error('Student login error:', error);
      const message = error.response?.data?.error || 'Student login failed';
      return { success: false, error: message };
    }
  };

  // Google OAuth callback'ten token ile giriş
const loginWithToken = async (token) => {
  sessionStorage.setItem('token', token);
  sessionStorage.setItem('student_token', token);
  apiService.setAuthToken(token);
  try {
    const response = await apiService.getProfile();
    if (response.data.success) {
      const userData = response.data.data;
      setUser(userData);
      saveUserToStorage(userData);
      setLoading(false);
      return { success: true };
    }
  } catch (error) {
    console.error('loginWithToken error:', error);
  }
  return { success: false };
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

  const updateUser = (updatedData) => {
  setUser(prev => {
    const newUser = { ...prev, ...updatedData };
    saveUserToStorage(newUser);
    return newUser;
  });
};


  const value = {
    user,
    loading,
    login,
    loginWithToken,
    register,
    logout,
    checkAuthStatus,  
    updateUser,
    isAuthenticated: !!user
  };


  

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};