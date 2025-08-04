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


// API functions
export const apiService = {
  // ===== EXISTING METHODS (PRESERVED) =====
  
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