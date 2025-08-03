// backend/services/rbacService.js - Updated with missing methods
const { pool } = require('../config/database');

class RBACService {
  /**
   * Get all permissions for a user
   * @param {number} userId - Admin user ID
   * @returns {Array} Array of permissions with resource and action
   */
  async getUserPermissions(userId) {
    try {
      const [permissions] = await pool.execute(`
        SELECT DISTINCT 
          p.permission_id,
          p.permission_name,
          p.display_name,
          p.resource,
          p.action,
          p.description,
          r.role_name,
          r.display_name as role_display_name
        FROM permissions p
        INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
        INNER JOIN roles r ON rp.role_id = r.role_id
        INNER JOIN user_roles ur ON r.role_id = ur.role_id
        WHERE ur.user_id = ? 
          AND ur.is_active = TRUE
          AND r.is_active = TRUE
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        ORDER BY p.resource, p.action
      `, [userId]);

      // ENSURE it returns an array, not an object
      return Array.isArray(permissions) ? permissions : [];
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return []; // Always return an array
    }
  }

  /**
   * Check if user has specific permission
   * @param {number} userId - Admin user ID
   * @param {string} resource - Resource name
   * @param {string} action - Action name
   * @returns {boolean} True if user has permission
   */
  async hasPermission(userId, resource, action) {
    try {
      // Check if user is super admin first
      const [superAdminCheck] = await pool.execute(`
        SELECT is_super_admin FROM admin_users WHERE admin_id = ? AND is_active = TRUE
      `, [userId]);

      if (superAdminCheck.length > 0 && superAdminCheck[0].is_super_admin) {
        return true;
      }

      // Check specific permission
      const [result] = await pool.execute(`
        SELECT COUNT(*) as has_permission
        FROM permissions p
        INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
        INNER JOIN roles r ON rp.role_id = r.role_id
        INNER JOIN user_roles ur ON r.role_id = ur.role_id
        WHERE ur.user_id = ? 
          AND p.resource = ? 
          AND p.action = ?
          AND ur.is_active = TRUE
          AND r.is_active = TRUE
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      `, [userId, resource, action]);

      return result[0].has_permission > 0;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Get user roles
   * @param {number} userId - Admin user ID
   * @returns {Array} Array of user roles
   */
  async getUserRoles(userId) {
    try {
      const [roles] = await pool.execute(`
        SELECT 
          r.role_id,
          r.role_name,
          r.display_name,
          r.description,
          ur.assigned_at,
          ur.expires_at,
          ur.is_active,
          assigner.username as assigned_by_username
        FROM roles r
        INNER JOIN user_roles ur ON r.role_id = ur.role_id
        LEFT JOIN admin_users assigner ON ur.assigned_by = assigner.admin_id
        WHERE ur.user_id = ? AND ur.is_active = TRUE
        ORDER BY ur.assigned_at DESC
      `, [userId]);

      return roles;
    } catch (error) {
      console.error('Error fetching user roles:', error);
      throw new Error('Failed to fetch user roles');
    }
  }

  /**
   * Assign role to user
   * @param {number} userId - Target user ID
   * @param {number} roleId - Role ID to assign
   * @param {number} assignerId - ID of user making the assignment
   * @returns {Object} Result of assignment
   */
  async assignRoleToUser(userId, roleId, assignerId, expiresAt = null) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      console.log('🎭 Starting role assignment transaction:', { userId, roleId, assignerId, expiresAt });

      // Check if assigner has permission to assign roles
      const canAssign = await this.hasPermission(assignerId, 'users', 'manage_roles');
      if (!canAssign) {
        throw new Error('Insufficient permissions to assign roles');
      }

      // Check if role assignment already exists and is active
      const [existing] = await connection.execute(`
        SELECT user_id, is_active FROM user_roles 
        WHERE user_id = ? AND role_id = ?
      `, [userId, roleId]);

      if (existing.length > 0) {
        if (existing[0].is_active) {
          throw new Error('User already has this role (active)');
        } else {
          // Reactivate existing role
          await connection.execute(`
            UPDATE user_roles 
            SET is_active = TRUE, assigned_by = ?, expires_at = ?, assigned_at = NOW()
            WHERE user_id = ? AND role_id = ?
          `, [assignerId, expiresAt, userId, roleId]);
          
          console.log('✅ Reactivated existing role assignment');
        }
      } else {
        // Insert new role assignment
        await connection.execute(`
          INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at, is_active)
          VALUES (?, ?, ?, ?, TRUE)
        `, [userId, roleId, assignerId, expiresAt]);
        
        console.log('✅ Created new role assignment');
      }

      // Update user's role timestamp
      await connection.execute(`
        UPDATE admin_users 
        SET last_role_update = NOW(), role_updated_by = ?
        WHERE admin_id = ?
      `, [assignerId, userId]);

      await connection.commit();

      console.log('✅ Role assignment transaction completed successfully');

      return {
        success: true,
        message: 'Role assigned successfully',
        data: {
          user_id: userId,
          role_id: roleId,
          assigned_by: assignerId,
          expires_at: expiresAt
        }
      };
    } catch (error) {
      await connection.rollback();
      console.error('❌ Role assignment transaction failed:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Remove role from user
   * @param {number} userId - Target user ID
   * @param {number} roleId - Role ID to remove
   * @param {number} removerId - ID of user making the removal
   * @returns {Object} Result of removal
   */
  async removeRoleFromUser(userId, roleId, removerId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Check if remover has permission
      const canRemove = await this.hasPermission(removerId, 'users', 'manage_roles');
      if (!canRemove) {
        throw new Error('Insufficient permissions to remove roles');
      }

      // Deactivate role assignment
      const [result] = await connection.execute(`
        UPDATE user_roles 
        SET is_active = FALSE 
        WHERE user_id = ? AND role_id = ? AND is_active = TRUE
      `, [userId, roleId]);

      if (result.affectedRows === 0) {
        throw new Error('Role assignment not found or already inactive');
      }

      // Update user's role timestamp
      await connection.execute(`
        UPDATE admin_users 
        SET last_role_update = NOW(), role_updated_by = ?
        WHERE admin_id = ?
      `, [removerId, userId]);

      await connection.commit();

      return {
        success: true,
        message: 'Role removed successfully'
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error removing role:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get all available roles
   * @returns {Array} Array of all roles
   */
  async getAllRoles() {
    try {
      const [roles] = await pool.execute(`
        SELECT 
          r.role_id,
          r.role_name,
          r.display_name,
          r.description,
          r.is_system_role,
          r.is_active,
          COUNT(rp.permission_id) as permission_count,
          COUNT(ur.user_id) as user_count
        FROM roles r
        LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
        LEFT JOIN user_roles ur ON r.role_id = ur.role_id AND ur.is_active = TRUE
        WHERE r.is_active = TRUE
        GROUP BY r.role_id
        ORDER BY r.is_system_role DESC, r.role_name
      `);

      return roles;
    } catch (error) {
      console.error('Error fetching roles:', error);
      throw new Error('Failed to fetch roles');
    }
  }

  /**
   * Get all available permissions
   * @returns {Array} Array of all permissions grouped by resource
   */
  async getAllPermissions() {
    try {
      const [permissions] = await pool.execute(`
        SELECT 
          permission_id,
          permission_name,
          display_name,
          description,
          resource,
          action,
          is_system_permission
        FROM permissions
        ORDER BY resource, action
      `);

      // Group by resource
      const grouped = permissions.reduce((acc, permission) => {
        if (!acc[permission.resource]) {
          acc[permission.resource] = [];
        }
        acc[permission.resource].push(permission);
        return acc;
      }, {});

      return grouped;
    } catch (error) {
      console.error('Error fetching permissions:', error);
      throw new Error('Failed to fetch permissions');
    }
  }

  /**
   * Get role permissions
   * @param {number} roleId - Role ID
   * @returns {Array} Array of permissions for the role
   */
  async getRolePermissions(roleId) {
    try {
      const [permissions] = await pool.execute(`
        SELECT 
          p.permission_id,
          p.permission_name,
          p.display_name,
          p.resource,
          p.action,
          p.description
        FROM permissions p
        INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
        WHERE rp.role_id = ?
        ORDER BY p.resource, p.action
      `, [roleId]);

      return permissions;
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      throw new Error('Failed to fetch role permissions');
    }
  }

  /**
   * Update role permissions
   * @param {number} roleId - Role ID
   * @param {Array} permissionIds - Array of permission IDs
   * @param {number} updaterId - ID of user making the update
   * @returns {Object} Result of update
   */
  async updateRolePermissions(roleId, permissionIds, updaterId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Check if updater has permission
      const canUpdate = await this.hasPermission(updaterId, 'users', 'manage_roles');
      if (!canUpdate) {
        throw new Error('Insufficient permissions to update role permissions');
      }

      // Remove existing permissions
      await connection.execute(`
        DELETE FROM role_permissions WHERE role_id = ?
      `, [roleId]);

      // Add new permissions
      if (permissionIds.length > 0) {
        const values = permissionIds.map(permId => [roleId, permId, updaterId]);
        const placeholders = values.map(() => '(?, ?, ?)').join(', ');
        
        await connection.execute(`
          INSERT INTO role_permissions (role_id, permission_id, granted_by)
          VALUES ${placeholders}
        `, values.flat());
      }

      await connection.commit();

      return {
        success: true,
        message: 'Role permissions updated successfully'
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error updating role permissions:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Create new role
   * @param {Object} roleData - Role data
   * @param {number} creatorId - ID of user creating the role
   * @returns {Object} Result with new role ID
   */
  async createRole(roleData, creatorId) {
    try {
      // Check if creator has permission
      const canCreate = await this.hasPermission(creatorId, 'users', 'manage_roles');
      if (!canCreate) {
        throw new Error('Insufficient permissions to create roles');
      }

      const [result] = await pool.execute(`
        INSERT INTO roles (role_name, display_name, description, is_system_role)
        VALUES (?, ?, ?, ?)
      `, [
        roleData.role_name,
        roleData.display_name,
        roleData.description || null,
        roleData.is_system_role || false
      ]);

      return {
        success: true,
        roleId: result.insertId,
        message: 'Role created successfully'
      };
    } catch (error) {
      console.error('Error creating role:', error);
      throw error;
    }
  }

  /**
   * ⭐ NEW: Delete role
   * @param {number} roleId - Role ID to delete
   * @param {number} deleterId - ID of user deleting the role
   * @returns {Object} Result of deletion
   */
  async deleteRole(roleId, deleterId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Check if deleter has permission
      const canDelete = await this.hasPermission(deleterId, 'users', 'manage_roles');
      if (!canDelete) {
        throw new Error('Insufficient permissions to delete roles');
      }

      // Check if role exists and is not a system role
      const [roleCheck] = await connection.execute(`
        SELECT role_id, role_name, is_system_role FROM roles WHERE role_id = ?
      `, [roleId]);

      if (roleCheck.length === 0) {
        throw new Error('Role not found');
      }

      if (roleCheck[0].is_system_role) {
        throw new Error('Cannot delete system roles');
      }

      // Check if role is assigned to any users
      const [userCheck] = await connection.execute(`
        SELECT COUNT(*) as user_count FROM user_roles 
        WHERE role_id = ? AND is_active = TRUE
      `, [roleId]);

      if (userCheck[0].user_count > 0) {
        throw new Error('Cannot delete role that is assigned to users');
      }

      // Delete role permissions first (due to foreign key)
      await connection.execute(`
        DELETE FROM role_permissions WHERE role_id = ?
      `, [roleId]);

      // Delete inactive user role assignments
      await connection.execute(`
        DELETE FROM user_roles WHERE role_id = ?
      `, [roleId]);

      // Delete the role
      const [deleteResult] = await connection.execute(`
        DELETE FROM roles WHERE role_id = ?
      `, [roleId]);

      if (deleteResult.affectedRows === 0) {
        throw new Error('Failed to delete role');
      }

      await connection.commit();

      return {
        success: true,
        message: 'Role deleted successfully',
        deletedRole: roleCheck[0].role_name
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error deleting role:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * ⭐ NEW: Delete permission
   * @param {number} permissionId - Permission ID to delete
   * @param {number} deleterId - ID of user deleting the permission
   * @returns {Object} Result of deletion
   */
  async deletePermission(permissionId, deleterId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Check if deleter has permission (only super admins can delete permissions)
      const [superAdminCheck] = await connection.execute(`
        SELECT is_super_admin FROM admin_users WHERE admin_id = ? AND is_active = TRUE
      `, [deleterId]);

      if (superAdminCheck.length === 0 || !superAdminCheck[0].is_super_admin) {
        throw new Error('Only super administrators can delete permissions');
      }

      // Check if permission exists and is not a system permission
      const [permissionCheck] = await connection.execute(`
        SELECT permission_id, permission_name, is_system_permission FROM permissions WHERE permission_id = ?
      `, [permissionId]);

      if (permissionCheck.length === 0) {
        throw new Error('Permission not found');
      }

      if (permissionCheck[0].is_system_permission) {
        throw new Error('Cannot delete system permissions');
      }

      // Delete role permissions first (due to foreign key)
      await connection.execute(`
        DELETE FROM role_permissions WHERE permission_id = ?
      `, [permissionId]);

      // Delete the permission
      const [deleteResult] = await connection.execute(`
        DELETE FROM permissions WHERE permission_id = ?
      `, [permissionId]);

      if (deleteResult.affectedRows === 0) {
        throw new Error('Failed to delete permission');
      }

      await connection.commit();

      return {
        success: true,
        message: 'Permission deleted successfully',
        deletedPermission: permissionCheck[0].permission_name
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error deleting permission:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * ⭐ NEW: Create permission
   * @param {Object} permissionData - Permission data
   * @param {number} creatorId - ID of user creating the permission
   * @returns {Object} Result with new permission ID
   */
  async createPermission(permissionData, creatorId) {
    try {
      // Check if creator has permission (only super admins can create permissions)
      const [superAdminCheck] = await pool.execute(`
        SELECT is_super_admin FROM admin_users WHERE admin_id = ? AND is_active = TRUE
      `, [creatorId]);

      if (superAdminCheck.length === 0 || !superAdminCheck[0].is_super_admin) {
        throw new Error('Only super administrators can create permissions');
      }

      // Generate permission_name if not provided
      const permissionName = permissionData.permission_name || 
        `${permissionData.resource}.${permissionData.action}`;

      const [result] = await pool.execute(`
        INSERT INTO permissions (
          permission_name, 
          display_name, 
          description, 
          resource, 
          action,
          is_system_permission
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        permissionName,
        permissionData.display_name,
        permissionData.description || null,
        permissionData.resource,
        permissionData.action,
        permissionData.is_system_permission || false
      ]);

      return {
        success: true,
        permissionId: result.insertId,
        message: 'Permission created successfully',
        data: {
          permission_id: result.insertId,
          permission_name: permissionName,
          display_name: permissionData.display_name,
          resource: permissionData.resource,
          action: permissionData.action
        }
      };
    } catch (error) {
      console.error('Error creating permission:', error);
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('Permission with this name already exists');
      }
      throw error;
    }
  }

  /**
   * Get users with their roles (for admin user management)
   * @param {string} department - Department filter (optional)
   * @returns {Array} Array of users with roles
   */
  async getUsersWithRoles(department = null) {
    try {
      let query = `
        SELECT 
          au.admin_id,
          au.username,
          au.full_name,
          au.email,
          au.department,
          au.is_active,
          au.is_super_admin,
          au.last_role_update,
          GROUP_CONCAT(r.role_name ORDER BY r.role_name) as roles,
          GROUP_CONCAT(r.display_name ORDER BY r.role_name) as role_display_names
        FROM admin_users au
        LEFT JOIN user_roles ur ON au.admin_id = ur.user_id AND ur.is_active = TRUE
        LEFT JOIN roles r ON ur.role_id = r.role_id AND r.is_active = TRUE
        WHERE au.is_active = TRUE
      `;
      
      const params = [];
      if (department) {
        query += ' AND au.department = ?';
        params.push(department);
      }
      
      query += `
        GROUP BY au.admin_id
        ORDER BY au.full_name
      `;

      const [users] = await pool.execute(query, params);
      
      return users.map(user => ({
        ...user,
        roles: user.roles ? user.roles.split(',') : [],
        role_display_names: user.role_display_names ? user.role_display_names.split(',') : []
      }));
    } catch (error) {
      console.error('Error fetching users with roles:', error);
      throw new Error('Failed to fetch users with roles');
    }
  }

  /**
   * Check if user can access department
   * @param {number} userId - User ID
   * @param {string} department - Department name
   * @returns {boolean} True if user can access department
   */
  async canAccessDepartment(userId, department) {
    try {
      // Super admin can access all departments
      const [superAdminCheck] = await pool.execute(`
        SELECT is_super_admin FROM admin_users WHERE admin_id = ? AND is_active = TRUE
      `, [userId]);

      if (superAdminCheck.length > 0 && superAdminCheck[0].is_super_admin) {
        return true;
      }

      // Check if user belongs to the department
      const [departmentCheck] = await pool.execute(`
        SELECT department FROM admin_users 
        WHERE admin_id = ? AND department = ? AND is_active = TRUE
      `, [userId, department]);

      return departmentCheck.length > 0;
    } catch (error) {
      console.error('Error checking department access:', error);
      return false;
    }
  }

  /**
   * Get permission groups for easier management
   * @returns {Array} Array of permission groups with permissions
   */
  async getPermissionGroups() {
    try {
      const [groups] = await pool.execute(`
        SELECT 
          pg.group_id,
          pg.group_name,
          pg.display_name,
          pg.description,
          COUNT(pgm.permission_id) as permission_count
        FROM permission_groups pg
        LEFT JOIN permission_group_mappings pgm ON pg.group_id = pgm.group_id
        GROUP BY pg.group_id
        ORDER BY pg.display_name
      `);

      // Get permissions for each group
      for (let group of groups) {
        const [permissions] = await pool.execute(`
          SELECT 
            p.permission_id,
            p.permission_name,
            p.display_name,
            p.resource,
            p.action
          FROM permissions p
          INNER JOIN permission_group_mappings pgm ON p.permission_id = pgm.permission_id
          WHERE pgm.group_id = ?
          ORDER BY p.resource, p.action
        `, [group.group_id]);
        
        group.permissions = permissions;
      }

      return groups;
    } catch (error) {
      console.error('Error fetching permission groups:', error);
      throw new Error('Failed to fetch permission groups');
    }
  }

  /**
   * Check multiple permissions at once
   * @param {number} userId - User ID
   * @param {Array} permissionChecks - Array of {resource, action} objects
   * @returns {Object} Object with permission results
   */
  async checkMultiplePermissions(userId, permissionChecks) {
    try {
      const results = {};
      
      for (const check of permissionChecks) {
        const key = `${check.resource}.${check.action}`;
        results[key] = await this.hasPermission(userId, check.resource, check.action);
      }
      
      return results;
    } catch (error) {
      console.error('Error checking multiple permissions:', error);
      throw new Error('Failed to check permissions');
    }
  }

  /**
   * Get user permission summary for frontend
   * @param {number} userId - User ID
   * @returns {Object} Formatted permission summary
   */
  async getUserPermissionSummary(userId) {
    try {
      const [user] = await pool.execute(`
        SELECT admin_id, username, full_name, department, is_super_admin
        FROM admin_users WHERE admin_id = ? AND is_active = TRUE
      `, [userId]);

      if (user.length === 0) {
        throw new Error('User not found');
      }

      const userData = user[0];
      const permissions = await this.getUserPermissions(userId);
      const roles = await this.getUserRoles(userId);

      // Group permissions by resource
      const permissionsByResource = permissions.reduce((acc, perm) => {
        if (!acc[perm.resource]) {
          acc[perm.resource] = [];
        }
        acc[perm.resource].push(perm.action);
        return acc;
      }, {});

      return {
        user: userData,
        roles: roles,
        permissions: permissionsByResource,
        raw_permissions: permissions,
        can_manage_users: await this.hasPermission(userId, 'users', 'manage_roles'),
        can_view_analytics: await this.hasPermission(userId, 'analytics', 'view_department'),
        can_manage_settings: await this.hasPermission(userId, 'settings', 'update')
      };
    } catch (error) {
      console.error('Error getting user permission summary:', error);
      throw error;
    }
  }
}

module.exports = new RBACService();