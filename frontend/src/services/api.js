import axios from 'axios';

// Base API URL
const BASE_URL = 'http://localhost:5000/api';

// Ayrı axios instance'ları oluştur
const studentApi = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const adminApi = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Student auth token yönetimi
const setAuthToken = (token) => {
  if (token) {
    studentApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('student_token', token);
  } else {
    delete studentApi.defaults.headers.common['Authorization'];
    localStorage.removeItem('student_token');
  }
};

const removeAuthToken = () => {
  delete studentApi.defaults.headers.common['Authorization'];
  localStorage.removeItem('student_token');
};

// Admin auth token yönetimi
const setAdminAuthToken = (token) => {
  if (token) {
    adminApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('admin_token', token);
  } else {
    delete adminApi.defaults.headers.common['Authorization'];
    localStorage.removeItem('admin_token');
  }
};

const removeAdminAuthToken = () => {
  delete adminApi.defaults.headers.common['Authorization'];
  localStorage.removeItem('admin_token');
};

// Token'ları sayfa yüklendiğinde geri yükle
const initializeTokens = () => {
  const studentToken = localStorage.getItem('student_token');
  const adminToken = localStorage.getItem('admin_token');
  
  if (studentToken) {
    studentApi.defaults.headers.common['Authorization'] = `Bearer ${studentToken}`;
  }
  
  if (adminToken) {
    adminApi.defaults.headers.common['Authorization'] = `Bearer ${adminToken}`;
  }
};

// Sayfa yüklendiğinde token'ları initialize et
initializeTokens();

// API functions
export const apiService = {
  // Student Auth
  login: (student_number, password) => studentApi.post('/auth/login', { student_number, password }),
  register: (userData) => studentApi.post('/auth/register', userData),
  getProfile: () => studentApi.get('/auth/me'),
  logout: () => {
    removeAuthToken();
    return studentApi.post('/auth/logout');
  },
  setAuthToken,
  removeAuthToken,

  // Admin Auth
  adminLogin: (username, password) => adminApi.post('/admin-auth/login', { username, password }),
  getAdminProfile: () => adminApi.get('/admin-auth/me'),
  adminLogout: () => {
    removeAdminAuthToken();
    return adminApi.post('/admin-auth/logout');
  },
  verifyAdminToken: () => adminApi.get('/admin-auth/verify'),
  setAdminAuthToken,
  removeAdminAuthToken,

  // Test connection
  testConnection: () => studentApi.get('/test'),
  
  // Request Types (Student)
  getRequestTypes: () => studentApi.get('/request-types'),
  getRequestType: (id) => studentApi.get(`/request-types/${id}`),
  
  // Students
  getStudents: () => studentApi.get('/students'),
  getStudent: (id) => studentApi.get(`/students/${id}`),
  
  // Requests (Student)
  getAllRequests: () => studentApi.get('/requests'),
  getStudentRequests: (studentId) => studentApi.get(`/requests/student/${studentId}`),
  createRequest: (requestData) => studentApi.post('/requests', requestData),
  updateRequestStatus: (id, statusData) => studentApi.put(`/requests/${id}/status`, statusData),
  
  // File Upload/Download (Student)
  uploadFiles: (id, formData) => {
    return studentApi.post(`/requests/${id}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getRequestAttachments: (id) => studentApi.get(`/requests/${id}/attachments`),
  downloadAttachment: (filename) => {
    return studentApi.get(`/requests/attachments/${filename}`, {
      responseType: 'blob',
    });
  },
  
  // Request Responses (Student tarafı)
  getRequestResponses: (id) => studentApi.get(`/requests/${id}/responses`),
  
  // Admin Routes (Departman bazlı)
  getAdminDashboard: () => adminApi.get('/admin-auth/dashboard'),
  getAdminRequests: (params = {}) => adminApi.get('/admin-auth/requests', { params }),
  updateAdminRequestStatus: (id, statusData) => adminApi.put(`/admin-auth/requests/${id}/status`, statusData),
  updateRequestPriority: (id, priority) => adminApi.put(`/admin-auth/requests/${id}/priority`, { priority }),
  
  // Admin Request Types
  getAdminRequestTypes: () => adminApi.get('/admin-auth/request-types'),
  addRequestType: (typeData) => adminApi.post('/admin-auth/request-types', typeData),
  toggleRequestType: (id) => adminApi.put(`/admin-auth/request-types/${id}/toggle`),
  
  // Admin Request Responses
  getAdminRequestResponses: (id) => adminApi.get(`/admin-auth/requests/${id}/responses`),
  addAdminResponse: (id, responseData) => adminApi.post(`/admin-auth/requests/${id}/responses`, responseData),

  // ✅ NEW API ENDPOINTS

  // Email Services
  testEmailService: () => adminApi.post('/email/test'),
  sendCustomEmail: (emailData) => adminApi.post('/email/send-custom', emailData),
  sendWelcomeEmail: (emailData) => adminApi.post('/email/send-welcome', emailData),
  sendStatusNotification: (notificationData) => adminApi.post('/email/notify-status', notificationData),
  getEmailSettings: () => adminApi.get('/email/settings'),

  // Notifications
  getStudentNotifications: () => studentApi.get('/notifications/student'),
  getAdminNotifications: () => adminApi.get('/notifications/admin'),
  markNotificationAsRead: (id) => studentApi.post(`/notifications/mark-read/${id}`),
  markAllNotificationsAsRead: () => studentApi.post('/notifications/mark-all-read'),
  getUnreadNotificationCount: () => studentApi.get('/notifications/unread-count'),
  getAdminUnreadCount: () => adminApi.get('/notifications/admin/unread-count'),

  // Analytics
  getStudentStats: (studentId) => studentApi.get(`/analytics/student/${studentId}`),
  getAdminAnalytics: (params = {}) => adminApi.get('/analytics/admin/dashboard', { params }),
  getPerformanceMetrics: () => adminApi.get('/analytics/admin/performance'),
  exportAnalytics: (params = {}) => adminApi.get('/analytics/admin/export', { params }),
  getSystemOverview: () => adminApi.get('/analytics/system/overview'),

  // Search Services
  searchStudentRequests: (searchData) => studentApi.post('/search/requests', searchData),
  searchAdminRequests: (searchData) => adminApi.post('/search/admin/requests', searchData),
  getSearchSuggestions: (params) => studentApi.get('/search/suggestions', { params }),
  getAdminSearchSuggestions: (params) => adminApi.get('/search/admin/suggestions', { params }),
  saveSearch: (searchData) => studentApi.post('/search/save', searchData),
  getSavedSearches: () => studentApi.get('/search/saved'),
  saveAdminSearch: (searchData) => adminApi.post('/search/admin/save', searchData),

  // Student Profile (Extended)
  getStudentProfile: () => studentApi.get('/auth/me'),
  updateStudentProfile: (profileData) => studentApi.put('/auth/profile', profileData),
  changeStudentPassword: (passwordData) => studentApi.put('/auth/change-password', passwordData),

  // Health & System
  getSystemHealth: () => studentApi.get('/health'),
  getApiDocumentation: () => studentApi.get('/docs'),

  // Advanced Features
  bulkUpdateRequests: (updateData) => adminApi.post('/admin-auth/requests/bulk-update', updateData),
  getRequestHistory: (id) => studentApi.get(`/requests/${id}/history`),
  addRequestNote: (id, noteData) => adminApi.post(`/admin-auth/requests/${id}/notes`, noteData),
  getRequestNotes: (id) => adminApi.get(`/admin-auth/requests/${id}/notes`),

  // File Management
  getFileMetadata: (filename) => studentApi.get(`/requests/attachments/${filename}/metadata`),
  deleteAttachment: (attachmentId) => studentApi.delete(`/requests/attachments/${attachmentId}`),
  
  // Reporting
  generateReport: (reportData) => adminApi.post('/analytics/admin/reports', reportData),
  getReportTemplates: () => adminApi.get('/analytics/admin/report-templates'),
  scheduleReport: (scheduleData) => adminApi.post('/analytics/admin/schedule-report', scheduleData),

  // Advanced Admin Features
  getAdminActivityLog: () => adminApi.get('/admin-auth/activity-log'),
  getDepartmentSettings: () => adminApi.get('/admin-auth/department/settings'),
  updateDepartmentSettings: (settings) => adminApi.put('/admin-auth/department/settings', settings),
  
  // Backup & Export
  exportDepartmentData: (params = {}) => adminApi.get('/admin-auth/export', { params }),
  importData: (importData) => adminApi.post('/admin-auth/import', importData),

  // System Integration
  syncWithExternalSystems: () => adminApi.post('/admin-auth/sync'),
  getIntegrationStatus: () => adminApi.get('/admin-auth/integrations/status'),

  // Real-time Features (would typically use WebSocket)
  subscribeToUpdates: (callback) => {
    // Implementation for real-time updates
    console.log('Real-time updates subscription - implement with WebSocket');
  },

  // Utility Functions
  validateStudentNumber: (studentNumber) => studentApi.post('/auth/validate-student-number', { studentNumber }),
  checkEmailAvailability: (email) => studentApi.post('/auth/check-email', { email }),
  
  // Advanced Search with Caching
  searchWithCache: (searchData, useCache = true) => {
    if (useCache) {
      const cacheKey = `search_${JSON.stringify(searchData)}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        return Promise.resolve({ data: JSON.parse(cached), fromCache: true });
      }
    }
    return studentApi.post('/search/requests', searchData);
  }
};

// Student API Response interceptor
studentApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Student API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      removeAuthToken();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// Admin API Response interceptor
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Admin API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      removeAdminAuthToken();
      if (window.location.pathname !== '/admin/login') {
        window.location.href = '/admin/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// Request interceptor for logging
studentApi.interceptors.request.use(
  (config) => {
    console.log(`[Student API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

adminApi.interceptors.request.use(
  (config) => {
    console.log(`[Admin API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Token geçerliliğini kontrol et
export const checkTokenValidity = (isAdmin = false) => {
  const token = isAdmin ? localStorage.getItem('admin_token') : localStorage.getItem('student_token');
  
  if (!token) return false;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    
    if (payload.exp < currentTime) {
      // Token süresi dolmuş
      if (isAdmin) {
        removeAdminAuthToken();
      } else {
        removeAuthToken();
      }
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    if (isAdmin) {
      removeAdminAuthToken();
    } else {
      removeAuthToken();
    }
    return false;
  }
};

export default { studentApi, adminApi };