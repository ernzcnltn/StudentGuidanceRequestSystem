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

const academicCalendarMethods = {
  // ===== ACADEMIC CALENDAR METHODS =====
  
  // Upload academic calendar document
  uploadAcademicCalendar: (formData) => {
    console.log('📤 Uploading academic calendar document...');
    return adminApi.post('/academic-calendar/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000 // 2 minutes timeout for large files
    });
  },

  // Get academic calendar status
  getAcademicCalendarStatus: () => {
    console.log('📊 Getting academic calendar status...');
    return adminApi.get('/academic-calendar/status');
  },

  // Get calendar events with proper error handling
  getAcademicCalendarEvents: (params = {}) => {
    console.log('📅 Getting academic calendar events:', params);
    return adminApi.get('/academic-calendar/events', { params })
      .catch(error => {
        console.error('❌ Calendar events error:', error);
        throw error;
      });
  },

  // ✅ FIXED: Check specific date availability
  checkDateAvailability: (date) => {
    console.log('🗓️ Checking date availability:', date);
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return Promise.reject(new Error('Invalid date format. Use YYYY-MM-DD'));
    }
    
    return adminApi.get(`/academic-calendar/check-date/${date}`)
      .catch(error => {
        console.error('❌ Date availability check error:', error);
        throw error;
      });
  },

  // Update calendar settings
  updateAcademicCalendarSettings: (settings) => {
    console.log('⚙️ Updating academic calendar settings:', settings);
    return adminApi.post('/academic-calendar/settings', settings);
  },

  // ✅ FIXED: Get upload history with proper pagination
getAcademicCalendarUploads: (params = { limit: 20, offset: 0 }) => {
    console.log('📂 API: Getting calendar upload history with params:', params);
    
    // ✅ FIX: Parameter validation
    const cleanParams = {
      limit: Math.min(Math.max(parseInt(params.limit) || 20, 1), 100),
      offset: Math.max(parseInt(params.offset) || 0, 0)
    };
    
    console.log('📂 API: Clean params:', cleanParams);
    
    return adminApi.get('/academic-calendar/uploads', { 
      params: cleanParams,
      timeout: 30000
    })
    .then(response => {
      console.log('📂 API: Upload history response received');
      return response;
    })
    .catch(error => {
      console.error('❌ API: Upload history error:', error);
      
      // ✅ FIX: Better error handling
      if (error.response?.status === 500) {
        console.error('Server error - check database and SQL functions');
        throw new Error('Server configuration error');
      } else if (error.response?.status === 403) {
        throw new Error('Access denied: Super admin required');
      }
      
      throw error;
    });
  },

  // Delete calendar upload
  deleteAcademicCalendarUpload: (uploadId) => {
    console.log('🗑️ Deleting calendar upload:', uploadId);
    return adminApi.delete(`/academic-calendar/upload/${uploadId}`);
  },

  // Get parsing logs for upload
  getCalendarParsingLogs: (uploadId) => {
    console.log('📋 Getting parsing logs for upload:', uploadId);
    return adminApi.get(`/academic-calendar/parsing-logs/${uploadId}`);
  },

  // ✅ NEW: Enhanced working hours with calendar integration
 checkCurrentAvailability: async () => {
    try {
      console.log('🕒 Checking current request availability...');
      
      const today = new Date().toISOString().split('T')[0];
      
      // ✅ FIX: Weekend check
      const dayOfWeek = new Date().getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return {
          success: true,
          canCreateRequest: false,
          reason: 'weekend',
          message: 'Requests cannot be created on weekends'
        };
      }
      
      // ✅ FIX: Working hours check
      const now = new Date();
      const turkeyTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Istanbul"}));
      const hours = turkeyTime.getHours();
      const minutes = turkeyTime.getMinutes();
      const currentTimeInMinutes = hours * 60 + minutes;
      
      const workStart = 8 * 60 + 30; // 08:30
      const workEnd = 17 * 60 + 30;   // 17:30
      
      if (currentTimeInMinutes < workStart || currentTimeInMinutes >= workEnd) {
        return {
          success: true,
          canCreateRequest: false,
          reason: 'outside_working_hours',
          message: 'Requests can only be created during working hours (08:30-17:30)'
        };
      }
      
      // ✅ FIX: Academic calendar check with error handling
      try {
        const response = await apiService.checkDateAvailability(today);
        
        if (response.data.success) {
          const data = response.data.data;
          return {
            success: true,
            canCreateRequest: data.can_create_requests,
            reason: data.can_create_requests ? 'available' : 'academic_holiday',
            message: data.can_create_requests ? 
              'You can create requests now' : 
              `Academic restriction: ${data.holiday_info?.names || 'Holiday period'}`,
            details: data
          };
        }
      } catch (calendarError) {
        console.warn('⚠️ Calendar check failed, using fallback:', calendarError);
        
        // Calendar check başarısız, sadece working hours'a göre karar ver
        return {
          success: true,
          canCreateRequest: true,
          reason: 'calendar_check_failed',
          message: 'Academic calendar check unavailable, but working hours OK',
          warning: 'Academic calendar could not be verified'
        };
      }
      
      return {
        success: false,
        canCreateRequest: false,
        reason: 'unknown',
        message: 'Unable to check availability'
      };
    } catch (error) {
      console.error('❌ Availability check error:', error);
      return {
        success: false,
        canCreateRequest: false,
        reason: 'error',
        message: 'Error checking availability'
      };
    }
  },

  // Get next available request creation time
  getNextAvailableTime: async () => {
    try {
      console.log('⏰ Getting next available request time...');
      
      const response = await apiService.getAcademicCalendarStatus();
      
      if (response.data.success && response.data.data.next_available) {
        const nextInfo = response.data.data.next_available;
        
        if (nextInfo.success) {
          return {
            success: true,
            nextDate: nextInfo.next_date,
            formattedDate: nextInfo.formatted_date,
            dayName: nextInfo.day_name,
            daysAhead: nextInfo.days_ahead,
            message: `Next available: ${nextInfo.formatted_date} (${nextInfo.day_name})`
          };
        }
      }
      
      // Fallback calculation
      const now = new Date();
      let nextWorkingDay = new Date(now);
      
      do {
        nextWorkingDay.setDate(nextWorkingDay.getDate() + 1);
      } while (nextWorkingDay.getDay() === 0 || nextWorkingDay.getDay() === 6);
      
      return {
        success: true,
        nextDate: nextWorkingDay.toISOString().split('T')[0],
        formattedDate: nextWorkingDay.toLocaleDateString('tr-TR'),
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nextWorkingDay.getDay()],
        daysAhead: Math.ceil((nextWorkingDay - now) / (1000 * 60 * 60 * 24)),
        message: `Next available: ${nextWorkingDay.toLocaleDateString('tr-TR')}`
      };
    } catch (error) {
      console.error('❌ Next available time error:', error);
      return {
        success: false,
        message: 'Error checking next available time'
      };
    }
  },

  // ✅ FIXED: Enhanced request creation with calendar validation
  createRequestWithCalendarValidation: async (requestData) => {
    try {
      console.log('📝 Creating request with calendar validation...');
      
      // First check current availability
      const availability = await apiService.checkCurrentAvailability();
      
      if (!availability.canCreateRequest) {
        const error = new Error(`Request creation not available: ${availability.message}`);
        error.response = {
          status: 423,
          data: {
            success: false,
            error: availability.message,
            errorCode: availability.reason === 'academic_holiday' ? 'ACADEMIC_HOLIDAY' : 
                       availability.reason === 'weekend' ? 'WEEKEND_NOT_ALLOWED' :
                       availability.reason === 'outside_working_hours' ? 'OUTSIDE_WORKING_HOURS' : 
                       'ACCESS_RESTRICTED',
            details: availability.details,
            guidance: {
              message: availability.reason === 'academic_holiday' ? 
                'Requests cannot be submitted during academic holidays' : 
                'You can submit requests during working hours only',
              schedule: 'Monday to Friday, 08:30 - 17:30 (Turkey Time)'
            }
          }
        };
        throw error;
      }
      
      // Proceed with normal request creation
      return await apiService.createRequest(requestData);
    } catch (error) {
      console.error('❌ Request creation with calendar validation error:', error);
      throw error;
    }
  },
  // ===== DEBUGGING AND TESTING =====
  
  // Test calendar system
  testCalendarSystem: async () => {
    console.group('🧪 Testing Academic Calendar System');
    
    try {
      const tests = {
        status: false,
        availability: false,
        dateCheck: false,
        events: false
      };
      
      // Test calendar status
      try {
        const statusResponse = await apiService.getAcademicCalendarStatus();
        tests.status = statusResponse.data.success;
        console.log('📊 Status check:', tests.status ? '✅' : '❌');
      } catch (error) {
        console.error('Status check failed:', error);
      }
      
      // Test current availability
      try {
        const availability = await apiService.checkCurrentAvailability();
        tests.availability = availability.success;
        console.log('🕒 Availability check:', tests.availability ? '✅' : '❌');
      } catch (error) {
        console.error('Availability check failed:', error);
      }
      
      // Test specific date check
      try {
        const today = new Date().toISOString().split('T')[0];
        const dateResponse = await apiService.checkDateAvailability(today);
        tests.dateCheck = dateResponse.data.success;
        console.log('📅 Date check:', tests.dateCheck ? '✅' : '❌');
      } catch (error) {
        console.error('Date check failed:', error);
      }
      
      // Test events fetch
      try {
        const eventsResponse = await apiService.getAcademicCalendarEvents();
        tests.events = eventsResponse.data.success;
        console.log('📋 Events check:', tests.events ? '✅' : '❌');
      } catch (error) {
        console.error('Events check failed:', error);
      }
      
      const allPassed = Object.values(tests).every(test => test);
      console.log(`🧪 Calendar system test: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);
      
      return { success: allPassed, tests };
    } catch (error) {
      console.error('❌ Calendar system test failed:', error);
      return { success: false, error: error.message };
    } finally {
      console.groupEnd();
    }
  }
};



// ===== RBAC CACHE MANAGEMENT =====
const rbacCache = {
  permissions: new Map(),
  roles: new Map(),
  users: new Map(),
  
  set: function(type, key, data, expiry = 300000) { // 5 minutes default
    const cache = this[type];
    if (cache) {
      cache.set(key, {
        data,
        expiry: Date.now() + expiry
      });
    }
  },
  
  get: function(type, key) {
    const cache = this[type];
    if (!cache) return null;
    
    const item = cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      cache.delete(key);
      return null;
    }
    
    return item.data;
  },
  
  clear: function(type = null) {
    if (type) {
      this[type]?.clear();
    } else {
      this.permissions.clear();
      this.roles.clear();
      this.users.clear();
    }
  },
  
  clearAll: function() {
    this.clear();
  }
};



// ===== RBAC API METHODS =====
const rbacApiMethods = {



 deleteAdminUser: (userId) => {
    console.log('🗑️ Deleting admin user:', userId);
    return adminApi.delete(`/admin-auth/users/${userId}`);
  },
  
  // Get inactive users (opsiyonel)
  getInactiveUsers: () => {
    console.log('👻 Fetching inactive users...');
    return adminApi.get('/admin-auth/users/inactive');
  },
  
  // User restore (opsiyonel - gelecekte)
  restoreAdminUser: (userId) => {
    console.log('♻️ Restoring admin user:', userId);
    return adminApi.post(`/admin-auth/users/${userId}/restore`);
  },

  // ===== ROLES MANAGEMENT =====
  rbacGetAllRoles: () => adminApi.get('/admin-auth/rbac/roles'),
  rbacGetAllRolesCached: () => {
    const cached = rbacCache.get('roles', 'all');
    if (cached) {
      return Promise.resolve({ data: { success: true, data: cached } });
    }
    return adminApi.get('/admin-auth/rbac/roles').then(response => {
      if (response.data.success) {
        rbacCache.set('roles', 'all', response.data.data);
      }
      return response;
    });
  },
   rbacCreateRole: (roleData) => {
    console.log('🎭 Creating role:', roleData);
    return adminApi.post('/admin-auth/rbac/create-role', roleData);
  },

  rbacUpdateRole: (roleId, roleData) => adminApi.put(`/admin-auth/rbac/role/${roleId}`, roleData),
  rbacDeleteRole: (roleId) => adminApi.delete(`/admin-auth/rbac/role/${roleId}`),
  
  // ===== PERMISSIONS MANAGEMENT =====
  rbacGetAllPermissions: () => {
    console.log('🔐 Fetching all permissions...');
    return adminApi.get('/admin-auth/rbac/permissions');
  },
  rbacGetAllPermissionsCached: () => {
    const cached = rbacCache.get('permissions', 'all');
    if (cached) {
      return Promise.resolve({ data: { success: true, data: cached } });
    }
    return adminApi.get('/admin-auth/rbac/permissions').then(response => {
      if (response.data.success) {
        rbacCache.set('permissions', 'all', response.data.data);
      }
      return response;
    });
  },
 rbacCreatePermission: (permissionData) => {
    console.log('🔐 Creating permission:', permissionData);
    return adminApi.post('/admin-auth/rbac/create-permission', permissionData);
  },
  rbacDeletePermission: (permissionId) => adminApi.delete(`/admin-auth/rbac/permission/${permissionId}`),
  
  // ===== ROLE PERMISSIONS =====
  rbacGetRolePermissions: (roleId) => adminApi.get(`/admin-auth/rbac/role/${roleId}/permissions`),
  rbacUpdateRolePermissions: (roleId, permissionIds) => 
    adminApi.put(`/admin-auth/rbac/role/${roleId}/permissions`, { permission_ids: permissionIds }),
  
  // ===== USER ROLES =====
  rbacGetUsersWithRoles: () => adminApi.get('/admin-auth/rbac/users'),
 rbacGetUserRoles: (userId) => {
    console.log('🎭 Fetching user roles for:', userId);
    return adminApi.get(`/admin-auth/rbac/user/${userId}/roles`);
  },
 rbacGetUserPermissions: (userId) => {
    console.log('🔐 Fetching user permissions for:', userId);
    return adminApi.get(`/admin-auth/rbac/user/${userId}/permissions`);
  },
  rbacGetUserPermissionSummary: (userId) => adminApi.get(`/admin-auth/rbac/user/${userId}/permissions`),
  
  // ===== ROLE ASSIGNMENT =====
 rbacAssignRole: (userId, roleId, expiresAt = null) => {
  console.log('🎭 Assigning role:', { userId, roleId, expiresAt });
  return adminApi.post('/admin-auth/rbac/assign-role', { 
    user_id: userId, 
    role_id: roleId, 
    expires_at: expiresAt 
  });
},


  rbacRemoveRole: (userId, roleId) => {
    console.log('🗑️ Removing role:', { userId, roleId });
    return adminApi.post('/admin-auth/rbac/remove-role', { 
      user_id: userId, 
      role_id: roleId 
    });
  },

  deleteRole: (roleId) => {
    console.log('🗑️ Deleting role:', roleId);
    return adminApi.delete(`/admin-auth/rbac/role/${roleId}`);
  },

  rbacGetAllRoles: () => {
    console.log('🎭 Fetching all roles...');
    return adminApi.get('/admin-auth/rbac/roles');
  },

  // ===== PERMISSION CHECKS =====
  rbacCheckPermission: (userId, resource, action) => 
    adminApi.post('/admin-auth/rbac/check-permission', { user_id: userId, resource, action }),
  rbacCheckMultiplePermissions: (userId, permissions) =>
    adminApi.post('/admin-auth/rbac/check-permissions', { user_id: userId, permissions }),
  
  // ===== BULK OPERATIONS =====
  rbacBulkAssignRoles: (assignments) => 
    adminApi.post('/admin-auth/rbac/bulk-assign-roles', { assignments }),
  rbacBulkRemoveRoles: (removals) =>
    adminApi.post('/admin-auth/rbac/bulk-remove-roles', { removals }),
  
  // ===== SUPER ADMIN MANAGEMENT =====
  rbacUpdateSuperAdminStatus: (userId, isSuperAdmin) =>
    adminApi.put(`/admin-auth/rbac/user/${userId}/super-admin`, { is_super_admin: isSuperAdmin }),
  
  // ===== DEPARTMENT ACCESS =====
  rbacCheckDepartmentAccess: (userId, department) =>
    adminApi.get(`/admin-auth/rbac/department-access/${userId}?department=${department}`),
  
  // ===== STATISTICS =====
  rbacGetStatistics: () => adminApi.get('/admin-auth/rbac/statistics'),
  
  // ===== AUDIT LOG =====
  rbacGetAuditLog: (params = {}) => adminApi.get('/admin-auth/rbac/audit-log', { params }),
  
  // ===== USER MANAGEMENT =====
  createAdminUser: (userData) => adminApi.post('/admin-auth/users', userData),
  updateAdminUser: (userId, userData) => adminApi.put(`/admin-auth/users/${userId}`, userData),
  deleteAdminUser: (userId) => adminApi.delete(`/admin-auth/users/${userId}`),
  resetAdminUserPassword: (userId) => adminApi.post(`/admin-auth/users/${userId}/reset-password`),
};

// ===== RBAC BATCH OPERATIONS HELPER =====
const rbacBatchOperations = {
  bulkAssignRoles: async (assignments) => {
    try {
      const response = await adminApi.post('/admin-auth/rbac/bulk-assign-roles', { assignments });
      
      // Clear cache after bulk operations
      rbacCache.clear('users');
      rbacCache.clear('roles');
      
      return {
        ...response,
        data: {
          ...response.data,
          data: {
            ...response.data.data,
            summary: {
              total: assignments.length,
              successful: response.data.data.filter(r => r.success).length,
              failed: response.data.data.filter(r => !r.success).length
            }
          }
        }
      };
    } catch (error) {
      console.error('Bulk assign roles error:', error);
      throw error;
    }
  },
  
  bulkRemoveRoles: async (removals) => {
    try {
      const response = await adminApi.post('/admin-auth/rbac/bulk-remove-roles', { removals });
      
      // Clear cache after bulk operations
      rbacCache.clear('users');
      rbacCache.clear('roles');
      
      return response;
    } catch (error) {
      console.error('Bulk remove roles error:', error);
      throw error;
    }
  },
  
  bulkUpdatePermissions: async (roleId, permissionIds) => {
    try {
      const response = await adminApi.put(`/admin-auth/rbac/role/${roleId}/permissions`, { 
        permission_ids: permissionIds 
      });
      
      // Clear relevant caches
      rbacCache.clear('roles');
      rbacCache.clear('permissions');
      
      return response;
    } catch (error) {
      console.error('Bulk update permissions error:', error);
      throw error;
    }
  }
};




// ===== RBAC HELPER FUNCTIONS =====
const rbacHelpers = {
  // Validation helpers
  validateRoleData: (roleData) => {
    return roleData.role_name && roleData.display_name;
  },
  
  validatePermissionData: (permissionData) => {
    return permissionData.display_name && permissionData.resource && permissionData.action;
  },
  
  // Formatting helpers
  formatRoleName: (role) => {
    return role.display_name || role.role_name;
  },
  
  formatLastUpdated: (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString();
  },
  
  // Permission grouping
  groupPermissionsByResource: (permissions) => {
    return permissions.reduce((groups, permission) => {
      const resource = permission.resource;
      if (!groups[resource]) {
        groups[resource] = [];
      }
      groups[resource].push(permission);
      return groups;
    }, {});
  },
  
  // Role color mapping
  getRoleColor: (roleName) => {
    const colors = {
      'super_admin': 'danger',
      'department_admin': 'primary',
      'department_staff': 'success',
      'read_only_admin': 'info',
      'trainee_admin': 'warning'
    };
    return colors[roleName] || 'secondary';
  },
  
  // Permission icons
  getPermissionIcon: (resource) => {
    const icons = {
      'requests': '📋',
      'responses': '💬',
      'users': '👥',
      'analytics': '📊',
      'settings': '⚙️',
      'notifications': '🔔',
      'system': '🛠️',
      'files': '📎'
    };
    return icons[resource] || '🔹';
  },
  


   // ⭐ EKSİK OLAN FONKSİYON - createPermissionSummary
  createPermissionSummary: (permissions) => {
    if (!permissions || permissions.length === 0) {
      return 'No permissions selected';
    }

    // Permission'ları resource'a göre grupla
    const grouped = permissions.reduce((acc, permission) => {
      const resource = permission.resource;
      if (!acc[resource]) {
        acc[resource] = [];
      }
      acc[resource].push(permission.action);
      return acc;
    }, {});

    // Her resource için özet oluştur
    const summaryParts = Object.entries(grouped).map(([resource, actions]) => {
      const uniqueActions = [...new Set(actions)].sort();
      return `${resource}: ${uniqueActions.join(', ')}`;
    });

    return summaryParts.join(' | ');
  },

  // ⭐ BONUS: Diğer yararlı helper fonksiyonlar
  getPermissionsByResource: (permissions) => {
    return permissions.reduce((acc, permission) => {
      if (!acc[permission.resource]) {
        acc[permission.resource] = [];
      }
      acc[permission.resource].push(permission);
      return acc;
    }, {});
  },

  formatPermissionList: (permissions) => {
    if (!permissions || permissions.length === 0) {
      return 'No permissions';
    }
    
    return permissions.map(p => `${p.resource}:${p.action}`).join(', ');
  },

  getPermissionCount: (permissions) => {
    if (!permissions) return 0;
    return permissions.length;
  },

  getResourceList: (permissions) => {
    if (!permissions || permissions.length === 0) return [];
    const resources = permissions.map(p => p.resource);
    return [...new Set(resources)].sort();
  },

  getActionList: (permissions, resource = null) => {
    if (!permissions || permissions.length === 0) return [];
    
    let filteredPermissions = permissions;
    if (resource) {
      filteredPermissions = permissions.filter(p => p.resource === resource);
    }
    
    const actions = filteredPermissions.map(p => p.action);
    return [...new Set(actions)].sort();
  },

  // Permission karşılaştırma
  comparePermissions: (permissions1, permissions2) => {
    const set1 = new Set(permissions1.map(p => `${p.resource}.${p.action}`));
    const set2 = new Set(permissions2.map(p => `${p.resource}.${p.action}`));
    
    return {
      added: permissions2.filter(p => !set1.has(`${p.resource}.${p.action}`)),
      removed: permissions1.filter(p => !set2.has(`${p.resource}.${p.action}`)),
      common: permissions1.filter(p => set2.has(`${p.resource}.${p.action}`))
    };
  },

  // Permission validation
  validatePermissionSelection: (selectedPermissions, allPermissions) => {
    const errors = [];
    
    if (!selectedPermissions || selectedPermissions.length === 0) {
      errors.push('No permissions selected');
    }
    
    // Geçersiz permission ID kontrolü
    const allPermissionIds = allPermissions.map(p => p.permission_id);
    const invalidIds = selectedPermissions.filter(id => !allPermissionIds.includes(id));
    
    if (invalidIds.length > 0) {
      errors.push(`Invalid permission IDs: ${invalidIds.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // Role permission özeti
  createRolePermissionSummary: (role, permissions) => {
    const resourceGroups = rbacHelpers.getPermissionsByResource(permissions);
    const resourceCount = Object.keys(resourceGroups).length;
    const totalPermissions = permissions.length;
    
    return {
      role_name: role.role_name,
      display_name: role.display_name,
      total_permissions: totalPermissions,
      resources_count: resourceCount,
      resources: Object.keys(resourceGroups),
      summary_text: `${totalPermissions} permissions across ${resourceCount} resources`,
      detailed_summary: rbacHelpers.createPermissionSummary(permissions)
    };
  },



  // Cache management
  clearRBACCache: () => {
    rbacCache.clearAll();
    console.log('🧹 RBAC cache cleared');
  },
  
  // Permission checking helpers
  hasAnyPermission: (userPermissions, requiredPermissions) => {
    return requiredPermissions.some(required => 
      userPermissions.some(user => 
        user.resource === required.resource && user.action === required.action
      )
    );
  },
  
  hasAllPermissions: (userPermissions, requiredPermissions) => {
    return requiredPermissions.every(required => 
      userPermissions.some(user => 
        user.resource === required.resource && user.action === required.action
      )
    );
  },
  
  // Role hierarchy checking
  isHigherRole: (role1, role2) => {
    const hierarchy = {
      'super_admin': 5,
      'department_admin': 4,
      'department_staff': 3,
      'read_only_admin': 2,
      'trainee_admin': 1
    };
    return (hierarchy[role1] || 0) > (hierarchy[role2] || 0);
  },
  
  // Permission name generation
  generatePermissionName: (resource, action) => {
    return `${resource}.${action}`;
  },
  
  // Role assignment validation
  canAssignRole: (assignerRoles, targetRole) => {
    // Super admins can assign any role
    if (assignerRoles.includes('super_admin')) return true;
    
    // Department admins can't assign super admin roles
    if (targetRole === 'super_admin') return false;
    
    // Department admins can assign lower level roles
    if (assignerRoles.includes('department_admin')) {
      return ['department_staff', 'read_only_admin', 'trainee_admin'].includes(targetRole);
    }
    
    return false;
  },
  
  // Error handling
  handleRBACError: (error) => {
    if (error.response?.status === 403) {
      return 'Insufficient permissions for this operation';
    }
    if (error.response?.status === 404) {
      return 'Resource not found';
    }
    if (error.response?.status === 409) {
      return 'Conflict: Resource already exists';
    }
    return error.response?.data?.message || 'An error occurred';
  },


  // Debugging helpers
  logPermissionStructure: (permissions) => {
    console.group('🔍 Permission Structure Analysis');
    console.log('Total permissions:', permissions.length);
    console.log('Resources:', rbacHelpers.getResourceList(permissions));
    console.log('Grouped by resource:', rbacHelpers.getPermissionsByResource(permissions));
    console.log('Summary:', rbacHelpers.createPermissionSummary(permissions));
    console.groupEnd();
  },


 // Utility for permission modal
  formatPermissionForModal: (permission) => {
    return {
      id: permission.permission_id,
      name: permission.permission_name,
      display: permission.display_name,
      resource: permission.resource,
      action: permission.action,
      description: permission.description || 'No description available',
      is_system: permission.is_system_permission,
      formatted_name: `${permission.resource}:${permission.action}`,
      category: permission.resource.charAt(0).toUpperCase() + permission.resource.slice(1)
    };
  }
};

// ===== ADMIN STATISTICS METHODS =====
const adminStatisticsMethods = {
   // Get admin performance statistics (Assignment-based)
  getAdminStatistics: async (params = {}) => {
    try {
      console.log('📊 Fetching assignment-based admin statistics with params:', params);
      
      // Validate parameters
      const validatedParams = {
        period: params.period && !isNaN(params.period) ? String(params.period) : '30',
        department: params.department || '',
        ...params
      };

      const response = await adminApi.get('/admin-auth/statistics/admins', { 
        params: validatedParams,
        timeout: 30000 // 30 second timeout for large datasets
      });

      if (response.data.success) {
        console.log('✅ Assignment-based statistics loaded successfully:', {
          adminCount: response.data.data.detailed_admins?.length || 0,
          period: validatedParams.period,
          department: validatedParams.department || 'ALL',
          dataSource: response.data.data.meta?.data_source,
          version: response.data.version
        });
      }

      return response;
    } catch (error) {
      console.error('❌ Failed to fetch assignment-based admin statistics:', error);
      
      // Enhanced error handling
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout - dataset too large');
      } else if (error.response?.status === 403) {
        throw new Error('Access denied: Insufficient permissions to view statistics');
      } else if (error.response?.status === 404) {
        throw new Error('Statistics endpoint not found');
      } else if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      
      throw error;
    }
  },


   // Cached statistics with TTL
  getAdminStatisticsWithCache: async (params = {}, useCache = true, ttl = 300000) => {
    const cacheKey = `admin_stats_${JSON.stringify(params)}`;
    
    if (useCache) {
      const cached = adminStatisticsMethods.getCachedStatistics(cacheKey);
      if (cached) {
        console.log('📊 Using cached admin statistics');
        return { 
          data: { 
            success: true, 
            data: cached, 
            fromCache: true,
            cachedAt: new Date().toISOString()
          } 
        };
      }
    }

    try {
      const response = await adminStatisticsMethods.getAdminStatistics(params);
      
      if (response.data.success && useCache) {
        adminStatisticsMethods.cacheStatistics(cacheKey, response.data.data, ttl);
      }
      
      return response;
    } catch (error) {
      console.error('Failed to fetch admin statistics:', error);
      throw error;
    }
  },

  // Statistics validation
  validateStatisticsResponse: (response) => {
    const errors = [];
    
    if (!response || !response.data) {
      errors.push('Invalid response structure');
      return { isValid: false, errors };
    }

    const data = response.data.data;
    if (!data) {
      errors.push('No data in response');
      return { isValid: false, errors };
    }

    // Validate overview
    if (!data.overview) {
      errors.push('Missing overview data');
    } else {
      const requiredOverviewFields = ['total_admins', 'active_admins', 'total_requests_handled', 'avg_response_time'];
      requiredOverviewFields.forEach(field => {
        if (typeof data.overview[field] === 'undefined') {
          errors.push(`Missing overview field: ${field}`);
        }
      });
    }

    // Validate detailed admins
    if (!data.detailed_admins || !Array.isArray(data.detailed_admins)) {
      errors.push('Missing or invalid detailed_admins array');
    } else {
      data.detailed_admins.forEach((admin, index) => {
        const requiredFields = ['admin_id', 'username', 'full_name', 'department'];
        requiredFields.forEach(field => {
          if (!admin[field]) {
            errors.push(`Admin ${index}: missing ${field}`);
          }
        });

        // Validate numeric fields
        const numericFields = ['total_requests', 'completed_requests', 'performance_score'];
        numericFields.forEach(field => {
          if (admin[field] && typeof admin[field] !== 'number') {
            errors.push(`Admin ${index}: ${field} should be numeric`);
          }
        });
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  },

  // Export admin statistics
  exportAdminStatistics: (params = {}) => {
    console.log('📤 Exporting admin statistics:', params);
    return adminApi.get('/admin-auth/statistics/admins/export', { 
      params,
      responseType: params.format === 'csv' ? 'blob' : 'json'
    });
  },

  // Get individual admin statistics
  getIndividualAdminStatistics: (adminId, params = {}) => {
    console.log('📊 Fetching individual admin statistics:', { adminId, params });
    return adminApi.get(`/admin-auth/statistics/admins/${adminId}`, { params });
  },

  // Get admin performance ranking
  getAdminPerformanceRanking: (params = {}) => {
    console.log('🏆 Fetching admin performance ranking:', params);
    return adminApi.get('/admin-auth/statistics/admins/ranking', { params });
  },

  // Get department comparison statistics (Super Admin only)
  getDepartmentComparisonStats: (params = {}) => {
    console.log('📊 Fetching department comparison stats:', params);
    return adminApi.get('/admin-auth/statistics/departments/comparison', { params });
  },

  // Get admin workload analysis
  getAdminWorkloadAnalysis: (params = {}) => {
    console.log('📈 Fetching admin workload analysis:', params);
    return adminApi.get('/admin-auth/statistics/admins/workload', { params });
  },

  // Get admin activity timeline
  getAdminActivityTimeline: (adminId, params = {}) => {
    console.log('📅 Fetching admin activity timeline:', { adminId, params });
    return adminApi.get(`/admin-auth/statistics/admins/${adminId}/timeline`, { params });
  },

  // Helper methods for statistics
  calculatePerformanceScore: (completed, total) => {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  },

  formatWorkTime: (minutes) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  },

  getPerformanceLevel: (score) => {
    if (score >= 90) return { level: 'Excellent', color: 'success', icon: '🏆' };
    if (score >= 70) return { level: 'Good', color: 'warning', icon: '⭐' };
    if (score >= 50) return { level: 'Average', color: 'info', icon: '📈' };
    return { level: 'Needs Improvement', color: 'danger', icon: '📉' };
  },

  // Statistics comparison helpers
  compareAdminPerformance: (admin1, admin2) => {
    const score1 = admin1.performance_score || 0;
    const score2 = admin2.performance_score || 0;
    
    return {
      better_performer: score1 > score2 ? admin1 : admin2,
      performance_difference: Math.abs(score1 - score2),
      comparison: {
        requests: {
          admin1: admin1.total_requests || 0,
          admin2: admin2.total_requests || 0,
          difference: (admin1.total_requests || 0) - (admin2.total_requests || 0)
        },
        response_time: {
          admin1: admin1.avg_response_time || 0,
          admin2: admin2.avg_response_time || 0,
          difference: (admin1.avg_response_time || 0) - (admin2.avg_response_time || 0)
        }
      }
    };
  },


   // Generate performance report
  generatePerformanceReport: (statistics) => {
    const summary = adminStatisticsMethods.generateStatisticsSummary(statistics);
    const insights = adminStatisticsMethods.generatePerformanceInsights(statistics);
    
    return {
      report_meta: {
        generated_at: new Date().toISOString(),
        report_type: 'admin_performance_analysis',
        period: summary.summary.period_info,
        version: '1.0'
      },
      executive_summary: summary,
      insights_and_recommendations: insights,
      detailed_data: {
        admin_count: statistics.detailed_admins?.length || 0,
        department_breakdown: statistics.department_breakdown || [],
        top_performers: statistics.top_performers || {}
      },
      appendix: {
        methodology: 'Performance scores calculated based on completion rate, response time, and request volume',
        data_sources: 'Admin responses, request status updates, and system timestamps',
        limitations: 'Data reflects selected time period only and may not represent long-term trends'
      }
    };
  },



  // Advanced filtering and sorting
  filterAndSortAdmins: (admins, filters = {}, sortConfig = {}) => {
    if (!admins || !Array.isArray(admins)) return [];

    let filteredAdmins = [...admins];

    // Apply filters
    if (filters.department) {
      filteredAdmins = filteredAdmins.filter(admin => 
        admin.department && admin.department.toLowerCase().includes(filters.department.toLowerCase())
      );
    }

    if (filters.minPerformance !== undefined) {
      filteredAdmins = filteredAdmins.filter(admin => 
        (admin.performance_score || 0) >= filters.minPerformance
      );
    }

    if (filters.maxPerformance !== undefined) {
      filteredAdmins = filteredAdmins.filter(admin => 
        (admin.performance_score || 0) <= filters.maxPerformance
      );
    }

    if (filters.minRequests !== undefined) {
      filteredAdmins = filteredAdmins.filter(admin => 
        (admin.total_requests || 0) >= filters.minRequests
      );
    }

    if (filters.hasActivity !== undefined) {
      filteredAdmins = filteredAdmins.filter(admin => 
        filters.hasActivity ? (admin.total_requests || 0) > 0 : (admin.total_requests || 0) === 0
      );
    }

    // Apply sorting
    const { sortBy = 'performance_score', sortOrder = 'desc' } = sortConfig;
    
    filteredAdmins.sort((a, b) => {
      const aValue = a[sortBy] || 0;
      const bValue = b[sortBy] || 0;
      
      if (sortOrder === 'desc') {
        return bValue - aValue;
      }
      return aValue - bValue;
    });

    return filteredAdmins;
  },




    // Statistics summary generator
  generateStatisticsSummary: (statistics) => {
    if (!statistics || !statistics.detailed_admins) {
      return { 
        status: 'error',
        message: 'No data available',
        summary: {}
      };
    }

    const admins = statistics.detailed_admins;
    const overview = statistics.overview;
    
    const summary = {
      period_info: {
        start_date: statistics.meta?.start_date,
        end_date: statistics.meta?.end_date,
        period_days: statistics.meta?.period || 30,
        department: statistics.meta?.department || 'ALL'
      },
      admin_summary: {
        total_admins: admins.length,
        active_admins: overview?.active_admins || 0,
        admins_with_activity: admins.filter(a => (a.total_requests || 0) > 0).length,
        top_performer: admins.reduce((best, current) => 
          (current.performance_score || 0) > (best.performance_score || 0) ? current : best, 
          admins[0] || {}
        )
      },
      performance_metrics: {
        total_requests: admins.reduce((sum, admin) => sum + (admin.total_requests || 0), 0),
        total_completed: admins.reduce((sum, admin) => sum + (admin.completed_requests || 0), 0),
        total_rejected: admins.reduce((sum, admin) => sum + (admin.rejected_requests || 0), 0),
        avg_performance_score: admins.length > 0 ? 
          Math.round(admins.reduce((sum, admin) => sum + (admin.performance_score || 0), 0) / admins.length) : 0,
        avg_response_time: overview?.avg_response_time || 0
      },
      distribution: {
        high_performers: admins.filter(a => (a.performance_score || 0) >= 80).length,
        medium_performers: admins.filter(a => (a.performance_score || 0) >= 60 && (a.performance_score || 0) < 80).length,
        low_performers: admins.filter(a => (a.performance_score || 0) < 60).length
      }
    };

    // Calculate completion rate
    summary.performance_metrics.completion_rate = summary.performance_metrics.total_requests > 0 ?
      Math.round((summary.performance_metrics.total_completed / summary.performance_metrics.total_requests) * 100) : 0;

    return {
      status: 'success',
      message: `Analysis for ${summary.admin_summary.total_admins} admins over ${summary.period_info.period_days} days`,
      summary
    };
  },


  
// Performance insights generator
  generatePerformanceInsights: (statistics) => {
    const insights = [];
    const recommendations = [];
    
    if (!statistics || !statistics.detailed_admins) {
      return { insights: [], recommendations: [] };
    }

    const summary = adminStatisticsMethods.generateStatisticsSummary(statistics);
    const metrics = summary.summary.performance_metrics;
    const distribution = summary.summary.distribution;
    const adminSummary = summary.summary.admin_summary;

    // Performance distribution insights
    const totalAdmins = adminSummary.total_admins;
    const highPerformerPercentage = totalAdmins > 0 ? Math.round((distribution.high_performers / totalAdmins) * 100) : 0;
    const lowPerformerPercentage = totalAdmins > 0 ? Math.round((distribution.low_performers / totalAdmins) * 100) : 0;

    if (highPerformerPercentage >= 70) {
      insights.push({
        type: 'positive',
        icon: '🎉',
        title: 'Excellent Team Performance',
        message: `${highPerformerPercentage}% of admins are high performers (80%+ score)`,
        priority: 'info'
      });
    } else if (lowPerformerPercentage >= 30) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Performance Concerns',
        message: `${lowPerformerPercentage}% of admins need performance improvement`,
        priority: 'high'
      });
      recommendations.push({
        type: 'training',
        priority: 'high',
        action: 'Provide additional training and support for underperforming admins',
        impact: 'Improve overall team efficiency and service quality',
        estimated_effort: 'Medium'
      });
    }

    // Workload insights
    const avgRequestsPerAdmin = totalAdmins > 0 ? Math.round(metrics.total_requests / totalAdmins) : 0;
    if (avgRequestsPerAdmin > 100) {
      insights.push({
        type: 'warning',
        icon: '📈',
        title: 'High Workload Detected',
        message: `Average ${avgRequestsPerAdmin} requests per admin - risk of burnout`,
        priority: 'medium'
      });
      recommendations.push({
        type: 'resource',
        priority: 'medium',
        action: 'Consider workload redistribution or hiring additional staff',
        impact: 'Prevent admin burnout and maintain service quality',
        estimated_effort: 'High'
      });
    } else if (avgRequestsPerAdmin < 10) {
      insights.push({
        type: 'info',
        icon: '📉',
        title: 'Low Activity Period',
        message: `Average ${avgRequestsPerAdmin} requests per admin - consider cross-training`,
        priority: 'low'
      });
    }

    // Response time insights
    if (metrics.avg_response_time > 48) {
      insights.push({
        type: 'negative',
        icon: '🐌',
        title: 'Slow Response Times',
        message: `Average response time is ${Math.round(metrics.avg_response_time)} hours`,
        priority: 'high'
      });
      recommendations.push({
        type: 'process',
        priority: 'high',
        action: 'Implement response time targets and monitoring dashboard',
        impact: 'Improve student satisfaction and service quality',
        estimated_effort: 'Medium'
      });
    } else if (metrics.avg_response_time < 4) {
      insights.push({
        type: 'positive',
        icon: '⚡',
        title: 'Excellent Response Times',
        message: `Average response time is only ${Math.round(metrics.avg_response_time)} hours`,
        priority: 'info'
      });
    }

    // Completion rate insights
    if (metrics.completion_rate >= 90) {
      insights.push({
        type: 'positive',
        icon: '✅',
        title: 'High Success Rate',
        message: `${metrics.completion_rate}% of requests are successfully completed`,
        priority: 'info'
      });
    } else if (metrics.completion_rate < 70) {
      insights.push({
        type: 'warning',
        icon: '📉',
        title: 'Low Completion Rate',
        message: `Only ${metrics.completion_rate}% of requests are completed`,
        priority: 'high'
      });
      recommendations.push({
        type: 'process',
        priority: 'high',
        action: 'Investigate root causes of incomplete requests and improve processes',
        impact: 'Increase service delivery success rate',
        estimated_effort: 'Medium'
      });
    }

    // Team balance insights
    const activeAdminPercentage = adminSummary.total_admins > 0 ? 
      Math.round((adminSummary.admins_with_activity / adminSummary.total_admins) * 100) : 0;
    
    if (activeAdminPercentage < 80) {
      insights.push({
        type: 'info',
        icon: '👥',
        title: 'Uneven Workload Distribution',
        message: `Only ${activeAdminPercentage}% of admins handled requests in this period`,
        priority: 'medium'
      });
      recommendations.push({
        type: 'management',
        priority: 'medium',
        action: 'Review workload distribution and consider rotating responsibilities',
        impact: 'Better utilize team capacity and develop skills',
        estimated_effort: 'Low'
      });
    }

    return { 
      insights: insights.sort((a, b) => {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1, 'info': 0 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }), 
      recommendations: recommendations.sort((a, b) => {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
    };
  },


  // Data transformation helpers
  transformStatisticsForChart: (statistics) => {
    if (!statistics || !statistics.detailed_admins) return [];

    return statistics.detailed_admins.map(admin => ({
      name: admin.full_name,
      department: admin.department,
      requests: admin.total_requests || 0,
      completed: admin.completed_requests || 0,
      performance: admin.performance_score || 0,
      responseTime: admin.avg_response_time || 0
    }));
  },

  // Trend analysis helpers
  analyzeTrends: (trends) => {
    if (!trends || !trends.weekly_data) return null;

    const weeklyData = trends.weekly_data;
    if (weeklyData.length < 2) return null;

    const latest = weeklyData[weeklyData.length - 1];
    const previous = weeklyData[weeklyData.length - 2];

    const requestsTrend = latest.requests - previous.requests;
    const responsesTrend = latest.responses - previous.responses;

    return {
      requests_trend: {
        direction: requestsTrend > 0 ? 'up' : requestsTrend < 0 ? 'down' : 'stable',
        change: requestsTrend,
        percentage: previous.requests > 0 ? Math.round((requestsTrend / previous.requests) * 100) : 0
      },
      responses_trend: {
        direction: responsesTrend > 0 ? 'up' : responsesTrend < 0 ? 'down' : 'stable',
        change: responsesTrend,
        percentage: previous.responses > 0 ? Math.round((responsesTrend / previous.responses) * 100) : 0
      }
    };
  },

  // Filter and sort helpers
  filterAdminsByPerformance: (admins, minScore = 0, maxScore = 100) => {
    return admins.filter(admin => {
      const score = admin.performance_score || 0;
      return score >= minScore && score <= maxScore;
    });
  },

  sortAdminsByMetric: (admins, metric = 'performance_score', order = 'desc') => {
    return [...admins].sort((a, b) => {
      const aValue = a[metric] || 0;
      const bValue = b[metric] || 0;
      
      if (order === 'desc') {
        return bValue - aValue;
      }
      return aValue - bValue;
    });
  },

  // Export helpers
  // Export helpers with better formatting
  exportStatisticsToCSV: (statistics, includeHeaders = true) => {
    if (!statistics || !statistics.detailed_admins) {
      throw new Error('No statistics data available for export');
    }

    const headers = [
      'Admin ID', 'Username', 'Full Name', 'Email', 'Department', 'Is Super Admin',
      'Total Requests', 'Completed Requests', 'Pending Requests', 'Informed Requests',
      'Rejected Requests', 'Total Responses', 'Avg Response Time (hours)',
      'Performance Score (%)', 'Work Time (minutes)', 'Last Activity'
    ];

    const rows = statistics.detailed_admins.map(admin => [
      admin.admin_id || '',
      admin.username || '',
      admin.full_name || '',
      admin.email || '',
      admin.department || '',
      admin.is_super_admin ? 'Yes' : 'No',
      admin.total_requests || 0,
      admin.completed_requests || 0,
      admin.pending_requests || 0,
      admin.informed_requests || 0,
      admin.rejected_requests || 0,
      admin.total_responses || 0,
      admin.avg_response_time || 0,
      admin.performance_score || 0,
      admin.total_work_time || 0,
      admin.last_activity ? new Date(admin.last_activity).toISOString() : 'Never'
    ]);

    const csvContent = [];
    
    if (includeHeaders) {
      csvContent.push(headers);
    }
    
    csvContent.push(...rows);

    return csvContent
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  },
  // Caching helpers for statistics
  cacheStatistics: (key, data, expiry = 300000) => { // 5 minutes default
    try {
      const cacheItem = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + expiry
      };
      sessionStorage.setItem(`admin_stats_${key}`, JSON.stringify(cacheItem));
    } catch (error) {
      console.warn('Failed to cache statistics:', error);
    }
  },

  getCachedStatistics: (key) => {
    try {
      const cached = sessionStorage.getItem(`admin_stats_${key}`);
      if (!cached) return null;

      const item = JSON.parse(cached);
      if (Date.now() > item.expiry) {
        sessionStorage.removeItem(`admin_stats_${key}`);
        return null;
      }

      return item.data;
    } catch (error) {
      console.warn('Failed to get cached statistics:', error);
      return null;
    }
  },

  clearStatisticsCache: () => {
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('admin_stats_')) {
          sessionStorage.removeItem(key);
        }
      });
      console.log('📊 Statistics cache cleared');
    } catch (error) {
      console.warn('Failed to clear statistics cache:', error);
    }
  }
};


// API functions
export const apiService = {
  // ===== EXISTING METHODS (PRESERVED) =====

  
...academicCalendarMethods,


...adminStatisticsMethods,

 // Wrapper method with caching
  getAdminStatisticsWithCache: async (params = {}, useCache = true) => {
    const cacheKey = JSON.stringify(params);
    
    if (useCache) {
      const cached = adminStatisticsMethods.getCachedStatistics(cacheKey);
      if (cached) {
        console.log('📊 Using cached admin statistics');
        return { data: { success: true, data: cached, fromCache: true } };
      }
    }

    try {
      const response = await adminStatisticsMethods.getAdminStatistics(params);
      
      if (response.data.success && useCache) {
        adminStatisticsMethods.cacheStatistics(cacheKey, response.data.data);
      }
      
      return response;
    } catch (error) {
      console.error('Failed to fetch admin statistics:', error);
      throw error;
    }
  },

  // Debug method for statistics
  debugAdminStatistics: async (params = {}) => {
    try {
      console.group('🔍 Admin Statistics Debug');
      
      const response = await adminStatisticsMethods.getAdminStatistics(params);
      
      if (response.data.success) {
        const stats = response.data.data;
        console.log('Overview:', stats.overview);
        console.log('Admin count:', stats.detailed_admins?.length || 0);
        console.log('Department breakdown:', stats.department_breakdown?.length || 0);
        console.log('Top performers:', stats.top_performers);
        console.log('Trends available:', !!stats.trends);
        
        // Performance analysis
        if (stats.detailed_admins && stats.detailed_admins.length > 0) {
          const avgPerformance = stats.detailed_admins.reduce((sum, admin) => 
            sum + (admin.performance_score || 0), 0) / stats.detailed_admins.length;
          console.log('Average performance score:', Math.round(avgPerformance));
          
          const topPerformer = stats.detailed_admins.reduce((best, current) => 
            (current.performance_score || 0) > (best.performance_score || 0) ? current : best);
          console.log('Top performer:', topPerformer.full_name, '-', topPerformer.performance_score + '%');
        }
      } else {
        console.error('Statistics request failed:', response.data);
      }
      
      console.groupEnd();
      return response;
    } catch (error) {
      console.error('❌ Statistics debug failed:', error);
      throw error;
    }
  },

  // Validate statistics data
  validateStatisticsData: (statistics) => {
    const errors = [];
    
    if (!statistics) {
      errors.push('Statistics data is null or undefined');
      return { isValid: false, errors };
    }
    
    if (!statistics.overview) {
      errors.push('Overview data is missing');
    }
    
    if (!statistics.detailed_admins || !Array.isArray(statistics.detailed_admins)) {
      errors.push('Detailed admins data is missing or invalid');
    }
    
    if (statistics.detailed_admins) {
      statistics.detailed_admins.forEach((admin, index) => {
        if (!admin.admin_id) {
          errors.push(`Admin at index ${index} is missing admin_id`);
        }
        if (!admin.full_name) {
          errors.push(`Admin at index ${index} is missing full_name`);
        }
        if (typeof admin.performance_score !== 'number') {
          errors.push(`Admin at index ${index} has invalid performance_score`);
        }
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  },

  // Performance metrics calculator
  calculateAdvancedMetrics: (statistics) => {
    if (!statistics || !statistics.detailed_admins) {
      return null;
    }

    const admins = statistics.detailed_admins;
    const totalAdmins = admins.length;
    
    if (totalAdmins === 0) return null;

    // Calculate various metrics
    const totalRequests = admins.reduce((sum, admin) => sum + (admin.total_requests || 0), 0);
    const totalCompleted = admins.reduce((sum, admin) => sum + (admin.completed_requests || 0), 0);
    const totalResponses = admins.reduce((sum, admin) => sum + (admin.total_responses || 0), 0);
    
    const avgRequestsPerAdmin = totalRequests / totalAdmins;
    const avgCompletionRate = totalRequests > 0 ? (totalCompleted / totalRequests) * 100 : 0;
    const avgResponsesPerAdmin = totalResponses / totalAdmins;
    
    // Performance distribution
    const performanceScores = admins.map(admin => admin.performance_score || 0);
    const highPerformers = performanceScores.filter(score => score >= 80).length;
    const mediumPerformers = performanceScores.filter(score => score >= 60 && score < 80).length;
    const lowPerformers = performanceScores.filter(score => score < 60).length;
    
    // Response time analysis
    const responseTimes = admins
      .map(admin => admin.avg_response_time || 0)
      .filter(time => time > 0);
    
    const avgResponseTime = responseTimes.length > 0 ? 
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;
    
    return {
      overview: {
        total_admins: totalAdmins,
        total_requests: totalRequests,
        total_completed: totalCompleted,
        total_responses: totalResponses,
        avg_requests_per_admin: Math.round(avgRequestsPerAdmin * 100) / 100,
        avg_completion_rate: Math.round(avgCompletionRate * 100) / 100,
        avg_responses_per_admin: Math.round(avgResponsesPerAdmin * 100) / 100,
        avg_response_time_hours: Math.round(avgResponseTime * 100) / 100
      },
      performance_distribution: {
        high_performers: highPerformers,
        medium_performers: mediumPerformers,
        low_performers: lowPerformers,
        high_performer_percentage: Math.round((highPerformers / totalAdmins) * 100),
        medium_performer_percentage: Math.round((mediumPerformers / totalAdmins) * 100),
        low_performer_percentage: Math.round((lowPerformers / totalAdmins) * 100)
      },
      benchmarks: {
        top_10_percent_threshold: this.calculatePercentile(performanceScores, 90),
        median_performance: this.calculatePercentile(performanceScores, 50),
        bottom_10_percent_threshold: this.calculatePercentile(performanceScores, 10)
      }
    };
  },

  // Calculate percentile
  calculatePercentile: (values, percentile) => {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  },

  // Generate insights from statistics
  generateStatisticsInsights: (statistics) => {
    if (!statistics || !statistics.detailed_admins) {
      return { insights: [], recommendations: [] };
    }

    const insights = [];
    const recommendations = [];
    const admins = statistics.detailed_admins;
    const metrics = apiService.calculateAdvancedMetrics(statistics);

    if (!metrics) return { insights, recommendations };

    // Performance insights
    if (metrics.performance_distribution.high_performer_percentage >= 70) {
      insights.push({
        type: 'positive',
        icon: '🎉',
        title: 'Strong Team Performance',
        message: `${metrics.performance_distribution.high_performer_percentage}% of admins are high performers`
      });
    } else if (metrics.performance_distribution.low_performer_percentage >= 30) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Performance Concerns',
        message: `${metrics.performance_distribution.low_performer_percentage}% of admins need performance improvement`
      });
      recommendations.push({
        priority: 'high',
        action: 'Provide additional training for low-performing admins',
        impact: 'Improve overall team efficiency'
      });
    }

    // Workload insights
    if (metrics.overview.avg_requests_per_admin > 50) {
      insights.push({
        type: 'warning',
        icon: '📈',
        title: 'High Workload',
        message: `Average ${Math.round(metrics.overview.avg_requests_per_admin)} requests per admin`
      });
      recommendations.push({
        priority: 'medium',
        action: 'Consider workload distribution or hiring additional staff',
        impact: 'Prevent admin burnout and maintain quality'
      });
    }

    // Response time insights
    if (metrics.overview.avg_response_time_hours > 24) {
      insights.push({
        type: 'negative',
        icon: '🐌',
        title: 'Slow Response Times',
        message: `Average response time is ${Math.round(metrics.overview.avg_response_time_hours)} hours`
      });
      recommendations.push({
        priority: 'high',
        action: 'Implement response time targets and monitoring',
        impact: 'Improve student satisfaction'
      });
    } else if (metrics.overview.avg_response_time_hours < 4) {
      insights.push({
        type: 'positive',
        icon: '⚡',
        title: 'Excellent Response Times',
        message: `Average response time is only ${Math.round(metrics.overview.avg_response_time_hours)} hours`
      });
    }

    // Completion rate insights
    if (metrics.overview.avg_completion_rate >= 90) {
      insights.push({
        type: 'positive',
        icon: '✅',
        title: 'High Completion Rate',
        message: `${Math.round(metrics.overview.avg_completion_rate)}% of requests are successfully completed`
      });
    } else if (metrics.overview.avg_completion_rate < 70) {
      insights.push({
        type: 'warning',
        icon: '📉',
        title: 'Low Completion Rate',
        message: `Only ${Math.round(metrics.overview.avg_completion_rate)}% of requests are completed`
      });
      recommendations.push({
        priority: 'high',
        action: 'Investigate reasons for incomplete requests',
        impact: 'Improve service quality and student satisfaction'
      });
    }

    return { insights, recommendations };
  },

  
  
   // ===== STUDENT AUTH =====
  login: (student_number, password) => studentApi.post('/auth/login', { student_number, password }),
  register: (userData) => studentApi.post('/auth/register', userData),
  getProfile: () => studentApi.get('/auth/me'),
  logout: () => {
    removeAuthToken();
    return studentApi.post('/auth/logout');
  },
  setAuthToken,
  removeAuthToken,

  // ===== ADMIN AUTH =====
  adminLogin: (username, password) => adminApi.post('/admin-auth/login', { username, password }),
  getAdminProfile: () => adminApi.get('/admin-auth/me'),
  adminLogout: () => {
    removeAdminAuthToken();
    return adminApi.post('/admin-auth/logout');
  },
  verifyAdminToken: () => adminApi.get('/admin-auth/verify'),
  setAdminAuthToken,
  removeAdminAuthToken,

  // ===== SYSTEM =====
  testConnection: () => studentApi.get('/test'),
  getSystemHealth: () => studentApi.get('/health'),
  getApiDocumentation: () => studentApi.get('/docs'),
  
  // ===== REQUEST TYPES (Student) =====
  getRequestTypes: () => studentApi.get('/request-types'),
  getRequestType: (id) => studentApi.get(`/request-types/${id}`),
  
  // ===== STUDENTS =====
  getStudents: () => studentApi.get('/students'),
  getStudent: (id) => studentApi.get(`/students/${id}`),
  
  // ===== REQUESTS (Student) =====
  getAllRequests: () => studentApi.get('/requests'),
  getStudentRequests: (studentId) => studentApi.get(`/requests/student/${studentId}`),
  createRequest: (requestData) => studentApi.post('/requests', requestData),
  updateRequestStatus: (id, statusData) => studentApi.put(`/requests/${id}/status`, statusData),
  getRequestHistory: (id) => studentApi.get(`/requests/${id}/history`),
  
  // ===== FILE UPLOAD/DOWNLOAD (Student) =====
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
  getFileMetadata: (filename) => studentApi.get(`/requests/attachments/${filename}/metadata`),
  deleteAttachment: (attachmentId) => studentApi.delete(`/requests/attachments/${attachmentId}`),
  
  // ===== REQUEST RESPONSES (Student tarafı) =====
  getRequestResponses: (id) => studentApi.get(`/requests/${id}/responses`),
  
  // ===== ADMIN ROUTES (Departman bazlı) =====
  getAdminDashboard: () => adminApi.get('/admin-auth/dashboard'),
  getAdminRequests: (params = {}) => adminApi.get('/admin-auth/requests', { params }),
  updateAdminRequestStatus: (id, statusData) => adminApi.put(`/admin-auth/requests/${id}/status`, statusData),
  updateRequestPriority: (id, priority) => adminApi.put(`/admin-auth/requests/${id}/priority`, { priority }),
  
  // ===== ADMIN REQUEST TYPES =====
  getAdminRequestTypes: () => adminApi.get('/admin-auth/request-types'),
  addRequestType: (typeData) => adminApi.post('/admin-auth/request-types', typeData),
  toggleRequestType: (id) => adminApi.put(`/admin-auth/request-types/${id}/toggle`),
  updateRequestType: (id, typeData) => adminApi.put(`/admin-auth/request-types/${id}`, typeData),
  deleteRequestType: (id) => adminApi.delete(`/admin-auth/request-types/${id}`),
  



  
  // ===== ADMIN REQUEST RESPONSES =====
  getAdminRequestResponses: (id) => adminApi.get(`/admin-auth/requests/${id}/responses`),
  addAdminResponse: (id, responseData) => adminApi.post(`/admin-auth/requests/${id}/responses`, responseData),
  updateAdminResponse: (requestId, responseId, responseData) => adminApi.put(`/admin-auth/requests/${requestId}/responses/${responseId}`, responseData),
  deleteAdminResponse: (requestId, responseId) => adminApi.delete(`/admin-auth/requests/${requestId}/responses/${responseId}`),
getRequestResponses: (id) => studentApi.get(`/requests/${id}/responses`),
getAdminRejectionDetails: (requestId) => {
  console.log('📋 Getting rejection details for request (ADMIN):', requestId);
  return adminApi.get(`/admin-auth/requests/${requestId}/rejection-details`);
},





rejectRequest: (requestId, rejectionData) => {
  console.log('🚫 Rejecting request:', { requestId, hasReason: !!rejectionData.rejection_reason });
  
  return adminApi.put(`/admin-auth/requests/${requestId}/reject`, rejectionData)
    .then(response => {
      console.log('✅ Reject response:', response.data);
      return response;
    })
    .catch(error => {
      console.error('❌ Reject error:', error);
      
      // Handle different error types
      if (error.response) {
        // Server responded with error status
        console.error('Server error:', error.response.data);
        throw error;
      } else if (error.request) {
        // Request was made but no response received
        console.error('Network error - no response received');
        throw new Error('Network error: Could not reach server');
      } else {
        // Something else happened
        console.error('Request setup error:', error.message);
        throw error;
      }
    });
},


// Get rejection statistics (for admin analytics)
getRejectionStatistics: () => {
  console.log('📊 Getting rejection statistics...');
  return adminApi.get('/admin-auth/statistics/rejections');
},

unrejectRequest: (requestId, reopenData) => {
  console.log('♻️ Reopening request:', { requestId, hasReason: !!reopenData.reopen_reason });
  return adminApi.post(`/admin-auth/requests/${requestId}/unreject`, reopenData);
},

getRejectionDetails: (requestId) => {
  console.log('📋 Getting rejection details for request:', requestId);
  
  // Admin token varsa admin API kullan, yoksa student API kullan
  const adminToken = localStorage.getItem('admin_token');
  const studentToken = localStorage.getItem('student_token');
  
  if (adminToken) {
    console.log('🔑 Using admin API for rejection details');
    return adminApi.get(`/admin-auth/requests/${requestId}/rejection-details`);
  } else if (studentToken) {
    console.log('🔑 Using student API for rejection details');
    return studentApi.get(`/requests/${requestId}/rejection-details`);
  } else {
    return Promise.reject(new Error('No authentication token found'));
  }
},

// Explicit methods for specific contexts
getStudentRejectionDetails: (requestId) => {
  console.log('📋 Getting rejection details for request (STUDENT):', requestId);
  return studentApi.get(`/requests/${requestId}/rejection-details`);
},

getRejectionStatistics: () => {
  console.log('📊 Getting rejection statistics...');
  return adminApi.get('/admin-auth/statistics/rejections');
},

// Helper methods for frontend
getRequestStatusIcon: (status) => {
  const icons = {
    'Pending': '⏳',
    'Informed': '💬',
    'Completed': '✅',
    'Rejected': '🚫'
  };
  return icons[status] || '📋';
},

getRequestStatusBadge: (status) => {
  const badges = {
    'Pending': 'bg-warning text-dark',
    'Informed': 'bg-info text-white',
    'Completed': 'bg-success text-white',
    'Rejected': 'bg-danger text-white'
  };
  return badges[status] || 'bg-secondary text-white';
},


  // ===== NOTIFICATIONS (Fixed & Simplified) =====
  getStudentNotifications: () => studentApi.get('/notifications/student'),
  getAdminNotifications: () => adminApi.get('/notifications/admin'),

  markNotificationAsRead: (id) => {
    // Dynamic routing: admin token varsa admin API, yoksa student API
    const isAdmin = !!localStorage.getItem('admin_token');
    const api = isAdmin ? adminApi : studentApi;
    
    console.log('📖 Marking notification as read:', { id, isAdmin });
    return api.post(`/notifications/mark-read/${id}`);
  },

  markAllNotificationsAsRead: () => {
    const isAdmin = !!localStorage.getItem('admin_token');
    const api = isAdmin ? adminApi : studentApi;
    
    console.log('📖 Marking all notifications as read:', { isAdmin });
    return api.post('/notifications/mark-all-read');
  },

  // Notification delete methods
  deleteNotification: (notificationId) => {
    // Admin notification ise admin API kullan, student ise student API kullan
    const adminToken = localStorage.getItem('admin_token');
    const studentToken = localStorage.getItem('student_token');
    
    if (adminToken) {
      return adminApi.delete(`/notifications/${notificationId}`);
    } else if (studentToken) {
      return studentApi.delete(`/notifications/${notificationId}`);
    } else {
      return Promise.reject(new Error('No authentication token found'));
    }
  },

  deleteMultipleNotifications: (notificationIds) => {
    const isAdmin = !!localStorage.getItem('admin_token');
    const api = isAdmin ? adminApi : studentApi;
    
    console.log('🗑️ Bulk deleting notifications:', { ids: notificationIds, isAdmin });
    return api.post('/notifications/bulk-delete', { ids: notificationIds });
  },

  getUnreadNotificationCount: () => {
    console.log('📊 Getting student unread count...');
    return studentApi.get('/notifications/unread-count');
  },

  getAdminUnreadCount: () => {
    console.log('📊 Getting admin unread count...');
    return adminApi.get('/notifications/admin/unread-count');
  },



  // Admin Response ile dosya yükleme
  uploadAdminResponseFiles: (responseId, formData) => {
    return adminApi.post(`/admin-auth/responses/${responseId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Admin response dosyalarını getirme
  getAdminResponseFiles: (responseId) => adminApi.get(`/admin-auth/responses/${responseId}/files`),

  // Admin response dosya indirme
  downloadAdminResponseFile: (filename) => {
    return adminApi.get(`/admin-auth/responses/files/${filename}`, {
      responseType: 'blob',
    });
  },

  // Create notification (admin only)
  createNotification: (notificationData) => adminApi.post('/notifications/create', notificationData),

  

  // Manual notification testing
  createTestNotification: async () => {
    try {
      const isAdmin = !!localStorage.getItem('admin_token');
      if (!isAdmin) {
        console.log('⚠️ Test notification creation only available for admins');
        return { success: false, message: 'Admin access required' };
      }
      
      // Create a test notification request
      const testNotification = {
        user_id: 1,
        user_type: 'admin',
        type: 'test',
        title: '🧪 Test Notification',
        message: 'This is a test notification created by the frontend',
        related_request_id: null,
        priority: 'Medium'
      };
      
      const response = await adminApi.post('/notifications/create', testNotification);
      console.log('✅ Test notification created:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to create test notification:', error);
      return { success: false, error: error.message };
    }
  },

  // Debug function to check current user context
  debugNotificationContext: () => {
    const studentToken = localStorage.getItem('student_token');
    const adminToken = localStorage.getItem('admin_token');
    
    const context = {
      hasStudentToken: !!studentToken,
      hasAdminToken: !!adminToken,
      currentUserType: adminToken ? 'admin' : (studentToken ? 'student' : 'none'),
      tokens: {
        student: studentToken ? 'Present' : 'Missing',
        admin: adminToken ? 'Present' : 'Missing'
      }
    };
    
    console.log('🔍 Notification context debug:', context);
    return context;
  },

  // Real-time notification polling - Optimize edilmiş
  startNotificationPolling: (callback, interval = 30000) => {
    let isPolling = false;
    let pollCount = 0;
    
    const pollFunction = async () => {
      if (isPolling) return;
      
      try {
        isPolling = true;
        pollCount++;
        
        const isAdmin = !!localStorage.getItem('admin_token');
        console.log(`📡 Polling notifications #${pollCount} (${isAdmin ? 'Admin' : 'Student'})...`);
        
        const response = isAdmin 
          ? await apiService.getAdminNotifications()
          : await apiService.getStudentNotifications();
        
        if (response?.data?.success && callback) {
          callback(response.data.data);
          console.log(`✅ Notifications updated via polling (${response.data.data.length} notifications)`);
        }
      } catch (error) {
        console.error('❌ Notification polling error:', error);
        // Don't break the polling on single error
      } finally {
        isPolling = false;
      }
    };

    // Initial call
    pollFunction();
    
    // Set up interval
    const intervalId = setInterval(pollFunction, interval);
    
    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      isPolling = false;
      console.log('🔇 Notification polling stopped');
    };
  },

  // Utility functions
  markNotificationAsReadLocal: (notifications, notificationId) => {
    return notifications.map(n => 
      n.id === notificationId ? { ...n, is_read: true } : n
    );
  },

  removeNotificationLocal: (notifications, notificationId) => {
    return notifications.filter(n => n.id !== notificationId);
  },

  markAllNotificationsAsReadLocal: (notifications) => {
    return notifications.map(n => ({ ...n, is_read: true }));
  },

  // ===== ANALYTICS =====
  getStudentStats: (studentId) => studentApi.get(`/analytics/student/${studentId}`),
  getMyStats: () => studentApi.get('/analytics/student/me'),
  getAdminAnalytics: (params = {}) => adminApi.get('/analytics/admin/dashboard', { params }),
  getPerformanceMetrics: () => adminApi.get('/analytics/admin/performance'),
  exportAnalytics: (params = {}) => adminApi.get('/analytics/admin/export', { params }),
  getSystemOverview: () => adminApi.get('/analytics/system/overview'),

  // ===== SEARCH SERVICES =====
  searchStudentRequests: (searchData) => studentApi.post('/search/requests', searchData),
  searchAdminRequests: (searchData) => adminApi.post('/search/admin/requests', searchData),
  getSearchSuggestions: (params) => studentApi.get('/search/suggestions', { params }),
  getAdminSearchSuggestions: (params) => adminApi.get('/search/admin/suggestions', { params }),
  saveSearch: (searchData) => studentApi.post('/search/save', searchData),
  getSavedSearches: () => studentApi.get('/search/saved'),
  saveAdminSearch: (searchData) => adminApi.post('/search/admin/save', searchData),

  // ===== STUDENT PROFILE (Extended) =====
  getStudentProfile: () => studentApi.get('/auth/me'),
  updateStudentProfile: (profileData) => studentApi.put('/auth/profile', profileData),
  changeStudentPassword: (passwordData) => studentApi.put('/auth/change-password', passwordData),

  // ===== ADVANCED FEATURES =====
  bulkUpdateRequests: (updateData) => adminApi.post('/admin-auth/requests/bulk-update', updateData),
  addRequestNote: (id, noteData) => adminApi.post(`/admin-auth/requests/${id}/notes`, noteData),
  getRequestNotes: (id) => adminApi.get(`/admin-auth/requests/${id}/notes`),
  updateRequestNote: (requestId, noteId, noteData) => adminApi.put(`/admin-auth/requests/${requestId}/notes/${noteId}`, noteData),
  deleteRequestNote: (requestId, noteId) => adminApi.delete(`/admin-auth/requests/${requestId}/notes/${noteId}`),

  // ===== REPORTING =====
  generateReport: (reportData) => adminApi.post('/analytics/admin/reports', reportData),
  getReportTemplates: () => adminApi.get('/analytics/admin/report-templates'),
  scheduleReport: (scheduleData) => adminApi.post('/analytics/admin/schedule-report', scheduleData),
  getScheduledReports: () => adminApi.get('/analytics/admin/scheduled-reports'),
  cancelScheduledReport: (reportId) => adminApi.delete(`/analytics/admin/scheduled-reports/${reportId}`),

  // ===== ADMIN FEATURES =====
  getAdminActivityLog: () => adminApi.get('/admin-auth/activity-log'),
  getDepartmentSettings: () => adminApi.get('/admin-auth/department/settings'),
  updateDepartmentSettings: (settings) => adminApi.put('/admin-auth/department/settings', settings),
  getDepartmentStats: () => adminApi.get('/admin-auth/department/stats'),
  
  // ===== BACKUP & EXPORT =====
  exportDepartmentData: (params = {}) => adminApi.get('/admin-auth/export', { params, responseType: 'blob' }),
  importData: (importData) => adminApi.post('/admin-auth/import', importData),
  backupDepartmentData: () => adminApi.post('/admin-auth/backup'),
  getBackupHistory: () => adminApi.get('/admin-auth/backup/history'),

  // ===== SYSTEM INTEGRATION =====
  syncWithExternalSystems: () => adminApi.post('/admin-auth/sync'),
  getIntegrationStatus: () => adminApi.get('/admin-auth/integrations/status'),
  updateIntegrationSettings: (settings) => adminApi.put('/admin-auth/integrations/settings', settings),

  // ===== VALIDATION SERVICES =====
  validateStudentNumber: (studentNumber) => studentApi.post('/auth/validate-student-number', { studentNumber }),
  checkEmailAvailability: (email) => studentApi.post('/auth/check-email', { email }),
  validateRequestData: (requestData) => studentApi.post('/requests/validate', requestData),

  // ===== ADVANCED SEARCH WITH CACHING =====
  searchWithCache: (searchData, useCache = true) => {
    if (useCache) {
      const cacheKey = `search_${JSON.stringify(searchData)}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        return Promise.resolve({ data: JSON.parse(cached), fromCache: true });
      }
    }
    return studentApi.post('/search/requests', searchData);
  },

  // ===== NOTIFICATION PREFERENCES =====
  subscribeToNotificationType: (type) => {
    const api = localStorage.getItem('admin_token') ? adminApi : studentApi;
    return api.post(`/notifications/subscribe/${type}`);
  },
  unsubscribeFromNotificationType: (type) => {
    const api = localStorage.getItem('admin_token') ? adminApi : studentApi;
    return api.post(`/notifications/unsubscribe/${type}`);
  },
  getNotificationPreferences: () => {
    const api = localStorage.getItem('admin_token') ? adminApi : studentApi;
    return api.get('/notifications/preferences');
  },
  updateNotificationPreferences: (preferences) => {
    const api = localStorage.getItem('admin_token') ? adminApi : studentApi;
    return api.put('/notifications/preferences', preferences);
  },

  // ===== REAL-TIME FEATURES =====
  subscribeToUpdates: (callback) => {
    // Implementation for real-time updates
    console.log('Real-time updates subscription - implement with WebSocket');
    // WebSocket implementation would go here
  },

  // ===== SYSTEM CONFIGURATION =====
  getSystemConfig: () => adminApi.get('/admin-auth/system/config'),
  updateSystemConfig: (config) => adminApi.put('/admin-auth/system/config', config),
  getSystemLogs: (params = {}) => adminApi.get('/admin-auth/system/logs', { params }),
  clearSystemLogs: () => adminApi.delete('/admin-auth/system/logs'),

  // ===== CUSTOM FIELDS =====
  getCustomFields: () => adminApi.get('/admin-auth/custom-fields'),
  createCustomField: (fieldData) => adminApi.post('/admin-auth/custom-fields', fieldData),
  updateCustomField: (fieldId, fieldData) => adminApi.put(`/admin-auth/custom-fields/${fieldId}`, fieldData),
  deleteCustomField: (fieldId) => adminApi.delete(`/admin-auth/custom-fields/${fieldId}`),

  // ===== AUDIT LOGS =====
  getAuditLogs: (params = {}) => adminApi.get('/admin-auth/audit-logs', { params }),
  getRequestAuditLog: (requestId) => adminApi.get(`/admin-auth/requests/${requestId}/audit-log`),

  // ===== DEPARTMENT MANAGEMENT =====
  getDepartments: () => adminApi.get('/admin-auth/departments'),
  createDepartment: (deptData) => adminApi.post('/admin-auth/departments', deptData),
  updateDepartment: (deptId, deptData) => adminApi.put(`/admin-auth/departments/${deptId}`, deptData),
  deleteDepartment: (deptId) => adminApi.delete(`/admin-auth/departments/${deptId}`),

  // ===== UTILITIES =====
  ping: () => studentApi.get('/ping'),
  getVersion: () => studentApi.get('/version'),
  getFeatureFlags: () => studentApi.get('/features'),
  reportBug: (bugData) => studentApi.post('/support/bug-report', bugData),
  requestFeature: (featureData) => studentApi.post('/support/feature-request', featureData),

  // ===== EXTERNAL API INTEGRATIONS =====
  syncWithLMS: () => adminApi.post('/integrations/lms/sync'),
  syncWithSIS: () => adminApi.post('/integrations/sis/sync'),
  getIntegrationLogs: () => adminApi.get('/integrations/logs'),

  // ===== RBAC METHODS =====
  ...rbacApiMethods,
  
  // ===== RBAC UTILITIES =====
  rbacCache,
  rbacBatchOperations,
  rbacHelpers,
  
  // ===== RBAC DEBUG AND TESTING =====
  testRBACEndpoints: async () => {
    const results = {
      permissions: false,
      roles: false,
      users: false,
      statistics: false,
      assignment: false
    };
    
    try {
      // Test permissions endpoint
      const permissionsResponse = await apiService.rbacGetAllPermissions();
      results.permissions = permissionsResponse.data.success;
      
      // Test roles endpoint
      const rolesResponse = await apiService.rbacGetAllRoles();
      results.roles = rolesResponse.data.success;
      
      // Test users endpoint
      const usersResponse = await apiService.rbacGetUsersWithRoles();
      results.users = usersResponse.data.success;
      
      // Test statistics endpoint
      const statsResponse = await apiService.rbacGetStatistics();
      results.statistics = statsResponse.data.success;
      
      console.log('🧪 RBAC Endpoints Test Results:', results);
      return results;
    } catch (error) {
      console.error('❌ RBAC endpoints test failed:', error);
      return results;
    }
  },

   // YENİ: Unassigned requests methods (bunları ekle)
  getUnassignedRequests: (params = {}) => {
    console.log('📋 Fetching unassigned requests...');
    return adminApi.get('/admin-auth/requests/unassigned', { params });
  },
  
  autoAssignAllRequests: (params = {}) => {
    console.log('🤖 Auto-assigning all unassigned requests...');
    return adminApi.post('/admin-auth/requests/auto-assign-all', params);
  },
  
  autoAssignSingleRequest: (requestId) => {
    console.log('🤖 Auto-assigning single request:', requestId);
    return adminApi.post(`/admin-auth/requests/${requestId}/auto-assign`);
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
      const currentPath = window.location.pathname;
      
      // Sadece admin dashboard ana sayfasındaysa logout yap
      // Notification click'lerinde logout yapma
      if (currentPath === '/admin/dashboard' && !error.config?.url?.includes('notifications')) {
        removeAdminAuthToken();
        window.location.href = '/login';
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

// Cache management utilities
export const cacheUtils = {
  set: (key, data, expiry = 300000) => { // 5 minutes default
    const item = {
      data,
      expiry: Date.now() + expiry
    };
    sessionStorage.setItem(key, JSON.stringify(item));
  },
  
  get: (key) => {
    const item = sessionStorage.getItem(key);
    if (!item) return null;
    
    const parsed = JSON.parse(item);
    if (Date.now() > parsed.expiry) {
      sessionStorage.removeItem(key);
      return null;
    }
    
    return parsed.data;
  },
  
  remove: (key) => {
    sessionStorage.removeItem(key);
  },
  
  clear: () => {
    sessionStorage.clear();
  }
};

// Rate limiting utility
export const rateLimiter = {
  calls: new Map(),
  
  canMakeCall: function(endpoint, limit = 10, window = 60000) { // 10 calls per minute default
    const now = Date.now();
    const calls = this.calls.get(endpoint) || [];
    
    // Remove old calls outside the window
    const recentCalls = calls.filter(timestamp => now - timestamp < window);
    
    if (recentCalls.length >= limit) {
      return false;
    }
    
    recentCalls.push(now);
    this.calls.set(endpoint, recentCalls);
    return true;
  }
};








export default { studentApi, adminApi };