// backend/middleware/adminAuth.js - Updated with RBAC support
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const rbacService = require('../services/rbacService');

// Admin JWT token doğrulama middleware - RBAC destekli
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Admin access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('Decoded token:', decoded);
    
    // Token'dan admin_id'yi al
    const adminId = decoded.admin_id;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token: missing admin ID'
      });
    }
    
    // Admin bilgilerini al ve RBAC bilgilerini dahil et
    const [admins] = await pool.execute(`
      SELECT 
        au.admin_id, 
        au.username, 
        au.full_name, 
        au.email, 
        au.department, 
        au.role,
        au.is_super_admin,
        au.is_active,
        au.last_role_update
      FROM admin_users au 
      WHERE au.admin_id = ? AND au.is_active = TRUE
    `, [adminId]);

    console.log('Found admins:', admins);

    if (admins.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Admin not found or inactive'
      });
    }

    const admin = admins[0];

    // Kullanıcının rollerini ve izinlerini al
    try {
      const [userRoles, userPermissions] = await Promise.all([
        rbacService.getUserRoles(adminId),
        rbacService.getUserPermissions(adminId)
      ]);

      // Admin bilgilerini req.admin'e set et - RBAC bilgileri dahil
      req.admin = {
        admin_id: admin.admin_id,
        username: admin.username,
        full_name: admin.full_name,
        email: admin.email,
        department: admin.department,
        role: admin.role,
        is_super_admin: admin.is_super_admin,
        last_role_update: admin.last_role_update,
        roles: userRoles,
        permissions: userPermissions,
        // Hızlı erişim için izinleri grupla
        permission_map: userPermissions.reduce((acc, perm) => {
          const key = `${perm.resource}.${perm.action}`;
          acc[key] = true;
          return acc;
        }, {}),
        // Kolay kullanım için yardımcı fonksiyon
        hasPermission: (resource, action) => {
          if (admin.is_super_admin) return true;
          const key = `${resource}.${action}`;
          return req.admin.permission_map[key] === true;
        }
      };
    } catch (rbacError) {
      console.error('RBAC data fetch error:', rbacError);
      // RBAC hatası durumunda temel admin bilgilerini kullan
      req.admin = {
        admin_id: admin.admin_id,
        username: admin.username,
        full_name: admin.full_name,
        email: admin.email,
        department: admin.department,
        role: admin.role,
        is_super_admin: admin.is_super_admin,
        roles: [],
        permissions: [],
        permission_map: {},
        hasPermission: () => admin.is_super_admin // Fallback: super admin can do everything
      };
    }

    console.log('Final req.admin with RBAC:', {
      admin_id: req.admin.admin_id,
      username: req.admin.username,
      department: req.admin.department,
      is_super_admin: req.admin.is_super_admin,
      roles_count: req.admin.roles.length,
      permissions_count: req.admin.permissions.length
    });

    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        error: 'Invalid admin token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        error: 'Admin token expired'
      });
    }
    
    console.error('Admin auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Admin authentication failed'
    });
  }
};

// Departman kontrolü middleware - RBAC ile geliştirilmiş
const requireDepartment = (allowedDepartments) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      
      if (!admin) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Super admin tüm departmanlara erişebilir
      if (admin.is_super_admin) {
        console.log('Super admin access granted to all departments');
        next();
        return;
      }

      const adminDepartment = admin.department;
      
      // String veya array kontrolü
      const departmentsToCheck = Array.isArray(allowedDepartments) 
        ? allowedDepartments 
        : [allowedDepartments];
      
      if (!departmentsToCheck.includes(adminDepartment)) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required department: ${departmentsToCheck.join(' or ')}. Your department: ${adminDepartment}`,
          required_departments: departmentsToCheck,
          user_department: adminDepartment
        });
      }
      
      next();
    } catch (error) {
      console.error('Department check error:', error);
      res.status(500).json({
        success: false,
        error: 'Department authorization failed'
      });
    }
  };
};

// RBAC tabanlı yetkilendirme middleware'i
const requirePermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      
      if (!admin) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Super admin her şeyi yapabilir
      if (admin.is_super_admin) {
        console.log(`Super admin permission granted: ${resource}:${action}`);
        next();
        return;
      }

      // İzin kontrolü
      const hasPermission = admin.hasPermission(resource, action);
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required permission: ${resource}:${action}`,
          required_permission: {
            resource,
            action
          },
          user_permissions: admin.permissions.map(p => `${p.resource}:${p.action}`)
        });
      }

      // Log permission usage
      console.log(`Permission granted: ${admin.username} used ${resource}:${action}`);
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Permission check failed'
      });
    }
  };
};

// Çoklu izin kontrolü middleware'i
const requireAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      
      if (!admin) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Super admin her şeyi yapabilir
      if (admin.is_super_admin) {
        console.log('Super admin access granted for multiple permissions check');
        next();
        return;
      }

      // Herhangi bir izni var mı kontrol et
      let hasAnyPermission = false;
      let grantedPermission = null;

      for (const perm of permissions) {
        if (admin.hasPermission(perm.resource, perm.action)) {
          hasAnyPermission = true;
          grantedPermission = perm;
          break;
        }
      }

      if (!hasAnyPermission) {
        const requiredPerms = permissions.map(p => `${p.resource}:${p.action}`);
        return res.status(403).json({
          success: false,
          error: `Access denied. Need any of: ${requiredPerms.join(' OR ')}`,
          required_permissions: requiredPerms,
          user_permissions: admin.permissions.map(p => `${p.resource}:${p.action}`)
        });
      }

      console.log(`Permission granted: ${admin.username} used ${grantedPermission.resource}:${grantedPermission.action}`);
      
      next();
    } catch (error) {
      console.error('Multiple permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Permission check failed'
      });
    }
  };
};

// Rol tabanlı kontrolü middleware'i
const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      
      if (!admin) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Super admin her zaman geçer
      if (admin.is_super_admin) {
        console.log('Super admin role access granted');
        next();
        return;
      }

      const userRoleNames = admin.roles.map(role => role.role_name);
      const rolesToCheck = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      
      const hasRequiredRole = rolesToCheck.some(role => userRoleNames.includes(role));
      
      if (!hasRequiredRole) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required roles: ${rolesToCheck.join(' OR ')}`,
          required_roles: rolesToCheck,
          user_roles: userRoleNames
        });
      }

      console.log(`Role access granted: ${admin.username} with roles: ${userRoleNames.join(', ')}`);
      
      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({
        success: false,
        error: 'Role check failed'
      });
    }
  };
};

// Departman + İzin kombinasyonu
const requireDepartmentPermission = (departments, resource, action) => {
  return async (req, res, next) => {
    try {
      // Önce departman kontrolü
      await requireDepartment(departments)(req, res, () => {
        // Sonra izin kontrolü
        requirePermission(resource, action)(req, res, next);
      });
    } catch (error) {
      console.error('Department + Permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Department and permission check failed'
      });
    }
  };
};

// Hızlı erişim için yaygın izin kombinasyonları
const commonPermissions = {
  // Request management
  viewRequests: () => requireAnyPermission([
    { resource: 'requests', action: 'view_department' },
    { resource: 'requests', action: 'view_all' }
  ]),
  
  manageRequests: () => requireAnyPermission([
    { resource: 'requests', action: 'update_status' },
    { resource: 'requests', action: 'assign' },
    { resource: 'requests', action: 'update_priority' }
  ]),
  
  createRequests: () => requirePermission('requests', 'create'),
  
  deleteRequests: () => requirePermission('requests', 'delete'),
  
  // Response management
  manageResponses: () => requireAnyPermission([
    { resource: 'responses', action: 'create' },
    { resource: 'responses', action: 'update' }
  ]),
  
  // User management
  manageUsers: () => requirePermission('users', 'manage_roles'),
  
  createUsers: () => requirePermission('users', 'create'),
  
  // Analytics
  viewAnalytics: () => requireAnyPermission([
    { resource: 'analytics', action: 'view_department' },
    { resource: 'analytics', action: 'view_system' }
  ]),
  
  // Settings
  manageSettings: () => requirePermission('settings', 'update'),
  
  manageRequestTypes: () => requirePermission('settings', 'manage_request_types'),
  
  // Files
  handleFiles: () => requireAnyPermission([
    { resource: 'files', action: 'upload' },
    { resource: 'files', action: 'download' }
  ]),
  
  deleteFiles: () => requirePermission('files', 'delete'),
  
  // System operations
  systemOperations: () => requireAnyPermission([
    { resource: 'system', action: 'backup' },
    { resource: 'system', action: 'maintenance' }
  ])
};

module.exports = {
  authenticateAdmin,
    authenticateAdminToken: authenticateAdmin, // 👈 ALIAS EKLE

  requireDepartment,
  requirePermission,
  requireAnyPermission,
  requireRole,
  requireDepartmentPermission,
  commonPermissions
};