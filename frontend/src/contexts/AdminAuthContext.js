// frontend/src/contexts/AdminAuthContext.js - RBAC Enhanced
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
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissionMap, setPermissionMap] = useState({});

  const logout = useCallback(() => {
    setAdmin(null);
    setPermissions([]);
    setRoles([]);
    setPermissionMap({});
    localStorage.removeItem('admin_token');
    apiService.removeAdminAuthToken();
    window.location.href = '/login';
  }, []);

  // İzin kontrolü helper fonksiyonu
  const hasPermission = useCallback((resource, action) => {
  console.log('🔍 Checking permission:', { resource, action, is_super_admin: admin?.is_super_admin });
  
  // Super admin her şeyi yapabilir
  if (admin?.is_super_admin) {
    console.log('✅ Permission granted: Super admin');
    return true;
  }
  
  // Permission map'ten kontrol et
  const key = `${resource}.${action}`;
  const hasPermission = permissionMap[key] === true;
  
  console.log('🔍 Permission check result:', { 
    key, 
    hasPermission, 
    availablePermissions: Object.keys(permissionMap) 
  });
  
  return hasPermission;
}, [admin?.is_super_admin, permissionMap]);

  // Rol kontrolü helper fonksiyonu
  const hasRole = useCallback((roleName) => {
    if (admin?.is_super_admin) return true;
    return roles.some(role => role.role_name === roleName);
  }, [admin?.is_super_admin, roles]);

  // Departman erişim kontrolü
  const canAccessDepartment = useCallback((department) => {
    if (admin?.is_super_admin) return true;
    return admin?.department === department;
  }, [admin?.is_super_admin, admin?.department]);

  // RBAC verilerini yükle
 const loadRBACData = useCallback(async (adminId) => {
  try {
    console.log('Loading RBAC data for admin:', adminId);
    
    // Use Promise.allSettled instead of Promise.all to handle errors better
    const [rolesResult, permissionsResult] = await Promise.allSettled([
      apiService.rbacGetUserRoles?.(adminId),
      apiService.rbacGetUserPermissions?.(adminId)
    ]);

    // Handle roles
    let userRoles = [];
    if (rolesResult.status === 'fulfilled' && rolesResult.value?.data?.success) {
      userRoles = Array.isArray(rolesResult.value.data.data) ? rolesResult.value.data.data : [];
    }

    // Handle permissions
    let userPermissions = [];
    if (permissionsResult.status === 'fulfilled' && permissionsResult.value?.data?.success) {
      userPermissions = Array.isArray(permissionsResult.value.data.data) ? permissionsResult.value.data.data : [];
    }

    setRoles(userRoles);
    setPermissions(userPermissions);

    // Create permission map
    const pMap = userPermissions.reduce((acc, perm) => {
      if (perm && perm.resource && perm.action) {
        const key = `${perm.resource}.${perm.action}`;
        acc[key] = true;
      }
      return acc;
    }, {});
    setPermissionMap(pMap);

    console.log('RBAC Data loaded successfully:', {
      roles: userRoles.length,
      permissions: userPermissions.length,
      permissionMapKeys: Object.keys(pMap).length
    });

  } catch (error) {
    console.error('Failed to load RBAC data:', error);
    // Set empty defaults on error
    setRoles([]);
    setPermissions([]);
    setPermissionMap({});
  }
}, []);

  const checkAdminAuthStatus = useCallback(async () => {
    try {
      if (!checkTokenValidity(true)) {
        logout();
        return;
      }

      const response = await apiService.getAdminProfile();
      if (response.data.success) {
        const adminData = response.data.data;
        setAdmin(adminData);

        // RBAC verilerini yükle
        if (adminData.admin_id) {
          await loadRBACData(adminData.admin_id);
        }
      } else {
        logout();
      }
    } catch (error) {
      console.error('Admin auth check failed:', error);
      
      if (error.response?.status === 401) {
        logout();
      } else {
        setLoading(false);
      }
    } finally {
      setLoading(false);
    }
  }, [logout, loadRBACData]);

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    
    if (savedToken) {
      apiService.setAdminAuthToken(savedToken);
      
      if (checkTokenValidity(true)) {
        checkAdminAuthStatus();
      } else {
        logout();
      }
    } else {
      setLoading(false);
    }
  }, [checkAdminAuthStatus, logout]);

  const login = async (username, password) => {
    try {
      console.log('Admin login attempt:', { username });
      
      const response = await apiService.adminLogin(username, password);
      
      console.log('Admin login response:', response.data);
      
      if (response.data.success) {
        const { token, admin: adminData } = response.data.data;
        
        // Admin bilgilerini state'e set et
        setAdmin(adminData);
        
        // Token'ı localStorage'a kaydet
        localStorage.setItem('admin_token', token);
        
        // Token'ı API service'e set et
        apiService.setAdminAuthToken(token);

        // RBAC verilerini yükle (eğer login response'unda yoksa)
        if (adminData.admin_id && (!adminData.roles || !adminData.permissions)) {
          await loadRBACData(adminData.admin_id);
        } else {
          // Login response'unda RBAC verileri varsa direkt kullan
          if (adminData.roles) setRoles(adminData.roles);
          if (adminData.permissions) {
            setPermissions(adminData.permissions);
            const pMap = adminData.permissions.reduce((acc, perm) => {
              const key = `${perm.resource}.${perm.action}`;
              acc[key] = true;
              return acc;
            }, {});
            setPermissionMap(pMap);
          }
        }
        
        console.log('Admin login successful, admin data:', adminData);
        
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

  // RBAC verilerini yenile
  const refreshRBACData = useCallback(async () => {
    if (admin?.admin_id) {
      await loadRBACData(admin.admin_id);
    }
  }, [admin?.admin_id, loadRBACData]);

  // Token'ı yenile fonksiyonu
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

  // RBAC helper fonksiyonları
  const rbacHelpers = {
    // Quick permission checks
    canViewRequests: () => hasPermission('requests', 'view_department') || hasPermission('requests', 'view_all'),
    canManageRequests: () => hasPermission('requests', 'update_status') || hasPermission('requests', 'assign'),
    canCreateResponses: () => hasPermission('responses', 'create'),
    canManageUsers: () => hasPermission('users', 'manage_roles'),
    canViewAnalytics: () => hasPermission('analytics', 'view_department') || hasPermission('analytics', 'view_system'),
    canManageSettings: () => hasPermission('settings', 'update'),
    canManageRequestTypes: () => hasPermission('settings', 'manage_request_types'),
    
    // Role checks
    isSuperAdmin: () => admin?.is_super_admin || hasRole('super_admin'),
    isDepartmentAdmin: () => hasRole('department_admin'),
    isDepartmentStaff: () => hasRole('department_staff'),
    isReadOnly: () => hasRole('read_only_admin'),
    isTrainee: () => hasRole('trainee_admin'),
    
    // Department checks
    canAccessAllDepartments: () => admin?.is_super_admin,
    getAccessibleDepartments: () => {
      if (admin?.is_super_admin) {
        return ['Accounting', 'Academic', 'Student Affairs', 'Dormitory', 'Campus Services'];
      }
      return admin?.department ? [admin.department] : [];
    },
    
    // Advanced permission checks
    canPerformAction: (resource, action) => hasPermission(resource, action),
    hasAnyPermission: (permissionList) => {
      return permissionList.some(({ resource, action }) => hasPermission(resource, action));
    },
    hasAllPermissions: (permissionList) => {
      return permissionList.every(({ resource, action }) => hasPermission(resource, action));
    }
  };

  const value = {
    admin,
    loading,
    login,
    logout,
    refreshAuth,
    refreshRBACData,
    isAuthenticated: !!admin,
    department: admin?.department || null,
    adminId: admin?.admin_id || null,
    
    // RBAC Data
    permissions,
    roles,
    permissionMap,
    
    // RBAC Functions
    hasPermission,
    hasRole,
    canAccessDepartment,
    
    // RBAC Helpers
    ...rbacHelpers,
    
    // Raw RBAC data for debugging
    rbacDebug: {
      permissions,
      roles,
      permissionMap,
      admin: admin ? {
        id: admin.admin_id,
        username: admin.username,
        department: admin.department,
        is_super_admin: admin.is_super_admin
      } : null
    }
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};