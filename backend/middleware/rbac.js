// backend/middleware/rbac.js
const rbacService = require('../services/rbacService');

/**
 * Shorthand middleware for permission checking (single permission string)
 * @param {string} permissionString - Permission in format "resource.action" or "permission_name"
 * @returns {Function} Middleware function
 */
const hasPermission = (permissionString) => {
  return async (req, res, next) => {
    try {
      const userId = req.admin?.admin_id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Check if user is super admin (bypass permission check)
      if (req.admin?.is_super_admin) {
        return next();
      }

      // Split permission string into resource and action
      const parts = permissionString.split('.');
      if (parts.length !== 2) {
        return res.status(400).json({
          success: false,
          error: `Invalid permission format: ${permissionString}. Expected format: resource.action`
        });
      }

      const [resource, action] = parts;
      const hasAccess = await rbacService.hasPermission(userId, resource, action);
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required permission: ${permissionString}`,
          required_permission: { resource, action }
        });
      }

      req.permission_used = {
        resource,
        action,
        user_id: userId,
        timestamp: new Date().toISOString()
      };

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


/**
 * Check if user has specific permission
 * @param {string} resource - Resource name (e.g., 'requests', 'users')
 * @param {string} action - Action name (e.g., 'view', 'create', 'update')
 * @returns {Function} Middleware function
 */
const checkPermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      const userId = req.admin?.admin_id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const hasPermission = await rbacService.hasPermission(userId, resource, action);
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required permission: ${resource}:${action}`,
          required_permission: {
            resource,
            action
          }
        });
      }

      // Add permission info to request object for logging
      req.permission_used = {
        resource,
        action,
        user_id: userId,
        timestamp: new Date().toISOString()
      };

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

/**
 * Check multiple permissions (user must have ALL)
 * @param {Array} permissions - Array of {resource, action} objects
 * @returns {Function} Middleware function
 */
const checkMultiplePermissions = (permissions) => {
  return async (req, res, next) => {
    try {
      const userId = req.admin?.admin_id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const results = await rbacService.checkMultiplePermissions(userId, permissions);
      const failedPermissions = [];

      for (const perm of permissions) {
        const key = `${perm.resource}.${perm.action}`;
        if (!results[key]) {
          failedPermissions.push(`${perm.resource}:${perm.action}`);
        }
      }

      if (failedPermissions.length > 0) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Missing permissions: ${failedPermissions.join(', ')}`,
          missing_permissions: failedPermissions
        });
      }

      req.permissions_used = permissions.map(p => ({
        resource: p.resource,
        action: p.action,
        user_id: userId,
        timestamp: new Date().toISOString()
      }));

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

/**
 * Check if user has ANY of the specified permissions
 * @param {Array} permissions - Array of {resource, action} objects
 * @returns {Function} Middleware function
 */
const checkAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      const userId = req.admin?.admin_id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const results = await rbacService.checkMultiplePermissions(userId, permissions);
      let hasAnyPermission = false;
      let grantedPermission = null;

      for (const perm of permissions) {
        const key = `${perm.resource}.${perm.action}`;
        if (results[key]) {
          hasAnyPermission = true;
          grantedPermission = perm;
          break;
        }
      }

      if (!hasAnyPermission) {
        const requiredPermissions = permissions.map(p => `${p.resource}:${p.action}`);
        return res.status(403).json({
          success: false,
          error: `Access denied. Need any of: ${requiredPermissions.join(' OR ')}`,
          required_permissions: requiredPermissions
        });
      }

      req.permission_used = {
        resource: grantedPermission.resource,
        action: grantedPermission.action,
        user_id: userId,
        timestamp: new Date().toISOString()
      };

      next();
    } catch (error) {
      console.error('Any permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Permission check failed'
      });
    }
  };
};

/**
 * Check if user can access specific department
 * @param {string|Function} department - Department name or function that returns department
 * @returns {Function} Middleware function
 */
const checkDepartmentAccess = (department) => {
  return async (req, res, next) => {
    try {
      const userId = req.admin?.admin_id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Resolve department name
      let targetDepartment;
      if (typeof department === 'function') {
        targetDepartment = department(req);
      } else {
        targetDepartment = department;
      }

      const canAccess = await rbacService.canAccessDepartment(userId, targetDepartment);
      
      if (!canAccess) {
        return res.status(403).json({
          success: false,
          error: `Access denied to department: ${targetDepartment}`,
          required_department: targetDepartment
        });
      }

      req.department_accessed = {
        department: targetDepartment,
        user_id: userId,
        timestamp: new Date().toISOString()
      };

      next();
    } catch (error) {
      console.error('Department access check error:', error);
      res.status(500).json({
        success: false,
        error: 'Department access check failed'
      });
    }
  };
};

/**
 * Check if user owns the resource (for self-access scenarios)
 * @param {string} resourceIdParam - Parameter name containing resource ID
 * @param {string} resourceTable - Database table to check ownership
 * @param {string} ownerColumn - Column name that contains owner ID
 * @returns {Function} Middleware function
 */
const checkResourceOwnership = (resourceIdParam, resourceTable, ownerColumn = 'user_id') => {
  return async (req, res, next) => {
    try {
      const userId = req.admin?.admin_id;
      const resourceId = req.params[resourceIdParam];
      
      if (!userId || !resourceId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters'
        });
      }

      // Check if user is super admin (can access everything)
      const [superAdminCheck] = await pool.execute(`
        SELECT is_super_admin FROM admin_users WHERE admin_id = ? AND is_active = TRUE
      `, [userId]);

      if (superAdminCheck.length > 0 && superAdminCheck[0].is_super_admin) {
        next();
        return;
      }

      // Check ownership
      const [ownershipCheck] = await pool.execute(`
        SELECT ${ownerColumn} FROM ${resourceTable} WHERE id = ?
      `, [resourceId]);

      if (ownershipCheck.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found'
        });
      }

      if (ownershipCheck[0][ownerColumn] !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only access your own resources.'
        });
      }

      req.resource_ownership = {
        resource_id: resourceId,
        resource_table: resourceTable,
        owner_id: userId,
        timestamp: new Date().toISOString()
      };

      next();
    } catch (error) {
      console.error('Resource ownership check error:', error);
      res.status(500).json({
        success: false,
        error: 'Ownership check failed'
      });
    }
  };
};

/**
 * Log permission usage for audit purposes
 * @returns {Function} Middleware function
 */
const logPermissionUsage = () => {
  return (req, res, next) => {
    // Store original end function
    const originalEnd = res.end;
    
    // Override end function to log after response
    res.end = function(...args) {
      // Log permission usage
      if (req.permission_used || req.permissions_used) {
        const logData = {
          timestamp: new Date().toISOString(),
          user_id: req.admin?.admin_id,
          username: req.admin?.username,
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          user_agent: req.get('User-Agent'),
          permission_used: req.permission_used,
          permissions_used: req.permissions_used,
          department_accessed: req.department_accessed,
          resource_ownership: req.resource_ownership,
          status_code: res.statusCode,
          success: res.statusCode < 400
        };

        // In a production environment, you might want to:
        // 1. Store this in a dedicated audit log table
        // 2. Send to an external logging service
        // 3. Store in a file-based log system
        console.log('RBAC Audit Log:', JSON.stringify(logData));

        // Optional: Store in database
        // await storeAuditLog(logData);
      }
      
      // Call original end function
      originalEnd.apply(this, args);
    };
    
    next();
  };
};

/**
 * Inject user permissions into request for frontend use
 * @returns {Function} Middleware function
 */
const injectUserPermissions = () => {
  return async (req, res, next) => {
    try {
      const userId = req.admin?.admin_id;
      
      if (userId) {
        const permissionSummary = await rbacService.getUserPermissionSummary(userId);
        req.user_permissions = permissionSummary;
      }
      
      next();
    } catch (error) {
      console.error('Error injecting user permissions:', error);
      // Don't fail the request, just continue without permissions
      next();
    }
  };
};

/**
 * Role-based access control middleware
 * @param {Array} allowedRoles - Array of role names that can access
 * @returns {Function} Middleware function
 */
const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.admin?.admin_id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const userRoles = await rbacService.getUserRoles(userId);
      const userRoleNames = userRoles.map(role => role.role_name);
      
      const hasRequiredRole = allowedRoles.some(role => userRoleNames.includes(role));
      
      if (!hasRequiredRole) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required roles: ${allowedRoles.join(' OR ')}`,
          user_roles: userRoleNames,
          required_roles: allowedRoles
        });
      }

      req.user_roles = userRoles;
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

/**
 * Super admin only middleware
 * @returns {Function} Middleware function
 */
const requireSuperAdmin = () => {
  return async (req, res, next) => {
    try {
      const userId = req.admin?.admin_id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const [result] = await pool.execute(`
        SELECT is_super_admin FROM admin_users 
        WHERE admin_id = ? AND is_active = TRUE
      `, [userId]);

      if (result.length === 0 || !result[0].is_super_admin) {
        return res.status(403).json({
          success: false,
          error: 'Super admin access required'
        });
      }

      next();
    } catch (error) {
      console.error('Super admin check error:', error);
      res.status(500).json({
        success: false,
        error: 'Super admin check failed'
      });
    }
  };
};

/**
 * Conditional permission check based on request data
 * @param {Function} conditionFn - Function that returns {resource, action} based on req
 * @returns {Function} Middleware function
 */
const conditionalPermissionCheck = (conditionFn) => {
  return async (req, res, next) => {
    try {
      const userId = req.admin?.admin_id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const condition = conditionFn(req);
      
      if (!condition) {
        // No permission check needed
        next();
        return;
      }

      const hasPermission = await rbacService.hasPermission(
        userId, 
        condition.resource, 
        condition.action
      );
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required permission: ${condition.resource}:${condition.action}`,
          required_permission: condition
        });
      }

      req.conditional_permission = {
        ...condition,
        user_id: userId,
        timestamp: new Date().toISOString()
      };

      next();
    } catch (error) {
      console.error('Conditional permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Permission check failed'
      });
    }
  };
};

/**
 * Permission check with fallback to ownership
 * Checks permission first, if fails, checks if user owns the resource
 * @param {string} resource 
 * @param {string} action 
 * @param {string} resourceIdParam 
 * @param {string} resourceTable 
 * @param {string} ownerColumn 
 * @returns {Function} Middleware function
 */
const checkPermissionOrOwnership = (resource, action, resourceIdParam, resourceTable, ownerColumn = 'user_id') => {
  return async (req, res, next) => {
    try {
      const userId = req.admin?.admin_id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // First check permission
      const hasPermission = await rbacService.hasPermission(userId, resource, action);
      
      if (hasPermission) {
        req.permission_used = {
          resource,
          action,
          user_id: userId,
          access_type: 'permission',
          timestamp: new Date().toISOString()
        };
        next();
        return;
      }

      // If no permission, check ownership
      const resourceId = req.params[resourceIdParam];
      
      if (!resourceId) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required permission: ${resource}:${action}`
        });
      }

      const { pool } = require('../config/database');
      const [ownershipCheck] = await pool.execute(`
        SELECT ${ownerColumn} FROM ${resourceTable} WHERE id = ?
      `, [resourceId]);

      if (ownershipCheck.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found'
        });
      }

      if (ownershipCheck[0][ownerColumn] !== userId) {
        return res.status(403).json({
          success: false,
          error: `Access denied. Required permission: ${resource}:${action} or resource ownership`
        });
      }

      req.permission_used = {
        resource,
        action,
        user_id: userId,
        access_type: 'ownership',
        resource_id: resourceId,
        timestamp: new Date().toISOString()
      };

      next();
    } catch (error) {
      console.error('Permission or ownership check error:', error);
      res.status(500).json({
        success: false,
        error: 'Access check failed'
      });
    }
  };
};

/**
 * Rate limiting for sensitive operations
 * @param {number} maxAttempts - Maximum attempts per time window
 * @param {number} windowMs - Time window in milliseconds
 * @param {string} operation - Operation name for logging
 * @returns {Function} Middleware function
 */
const rateLimitSensitiveOperation = (maxAttempts = 5, windowMs = 15 * 60 * 1000, operation = 'sensitive_operation') => {
  const attempts = new Map();
  
  return (req, res, next) => {
    const userId = req.admin?.admin_id;
    const key = `${userId}_${operation}`;
    const now = Date.now();
    
    if (!attempts.has(key)) {
      attempts.set(key, []);
    }
    
    const userAttempts = attempts.get(key);
    
    // Remove old attempts
    const recentAttempts = userAttempts.filter(timestamp => now - timestamp < windowMs);
    attempts.set(key, recentAttempts);
    
    if (recentAttempts.length >= maxAttempts) {
      return res.status(429).json({
        success: false,
        error: `Too many ${operation} attempts. Please try again later.`,
        retry_after: Math.ceil(windowMs / 1000 / 60) + ' minutes'
      });
    }
    
    // Add current attempt
    recentAttempts.push(now);
    attempts.set(key, recentAttempts);
    
    next();
  };
};

/**
 * Helper function to create common permission combinations
 */
const createPermissionCombinations = {
  // View own department OR view all permissions
  viewRequests: () => checkAnyPermission([
    { resource: 'requests', action: 'view_department' },
    { resource: 'requests', action: 'view_all' }
  ]),
  
  // Manage requests (update status OR assign)
  manageRequests: () => checkAnyPermission([
    { resource: 'requests', action: 'update_status' },
    { resource: 'requests', action: 'assign' }
  ]),
  
  // User management permissions
  manageUsers: () => checkPermission('users', 'manage_roles'),
  
  // Analytics access
  viewAnalytics: () => checkAnyPermission([
    { resource: 'analytics', action: 'view_department' },
    { resource: 'analytics', action: 'view_system' }
  ]),
  
  // Settings management
  manageSettings: () => checkPermission('settings', 'update'),
  
  // File operations
  handleFiles: () => checkAnyPermission([
    { resource: 'files', action: 'upload' },
    { resource: 'files', action: 'download' },
    { resource: 'files', action: 'delete' }
  ])
};

module.exports = {
  hasPermission,  
  checkPermission,
  checkMultiplePermissions,
  checkAnyPermission,
  checkDepartmentAccess,
  checkResourceOwnership,
  checkPermissionOrOwnership,
  requireRole,
  requireSuperAdmin,
  conditionalPermissionCheck,
  rateLimitSensitiveOperation,
  logPermissionUsage,
  injectUserPermissions,
  createPermissionCombinations
};