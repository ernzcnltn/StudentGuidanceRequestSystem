// frontend/src/components/RBACManagement.js
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../hooks/useTranslation';
import { apiService } from '../services/api';

const RBACManagement = () => {
  const { admin, hasPermission, hasRole } = useAdminAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const { t } = useTranslation();

  // State management
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(false);
  
  // Data state
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [statistics, setStatistics] = useState(null);

  // Modal states
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);

  // Form states
  const [roleForm, setRoleForm] = useState({
    role_name: '',
    display_name: '',
    description: '',
    is_system_role: false
  });

  const [permissionForm, setPermissionForm] = useState({
    permission_name: '',
    display_name: '',
    description: '',
    resource: '',
    action: '',
    is_system_permission: false
  });

  // Check permissions
  const canManageRoles = hasPermission('users', 'manage_roles');
  const canViewUsers = hasPermission('users', 'view');
  const isSuperAdmin = hasRole('super_admin') || admin?.is_super_admin;

  // Load initial data
  useEffect(() => {
    if (canViewUsers) {
      loadUsers();
    }
    if (canManageRoles) {
      loadRoles();
      loadPermissions();
    }
    if (isSuperAdmin) {
      loadStatistics();
    }
  }, [canViewUsers, canManageRoles, isSuperAdmin]);

  // Data loading functions
  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await apiService.rbacGetUsersWithRoles();
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      showError('Failed to load users');
      console.error('Load users error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await apiService.rbacGetAllRolesCached();
      if (response.data.success) {
        setRoles(response.data.data);
      }
    } catch (error) {
      showError('Failed to load roles');
      console.error('Load roles error:', error);
    }
  };

  const loadPermissions = async () => {
    try {
      const response = await apiService.rbacGetAllPermissionsCached();
      if (response.data.success) {
        setPermissions(response.data.data);
      }
    } catch (error) {
      showError('Failed to load permissions');
      console.error('Load permissions error:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await apiService.rbacGetStatistics();
      if (response.data.success) {
        setStatistics(response.data.data);
      }
    } catch (error) {
      console.error('Load statistics error:', error);
    }
  };

  // User management functions
  const handleAssignRole = async (userId, roleId) => {
    try {
      await apiService.rbacAssignRole(userId, roleId);
      showSuccess('Role assigned successfully');
      loadUsers();
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to assign role');
    }
  };

  const handleRemoveRole = async (userId, roleId) => {
    try {
      await apiService.rbacRemoveRole(userId, roleId);
      showSuccess('Role removed successfully');
      loadUsers();
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to remove role');
    }
  };

  const handleToggleSuperAdmin = async (userId, currentStatus) => {
    if (userId === admin.admin_id && currentStatus) {
      showWarning('Cannot remove super admin status from yourself');
      return;
    }

    try {
      await apiService.rbacUpdateSuperAdminStatus(userId, !currentStatus);
      showSuccess(`Super admin status ${!currentStatus ? 'granted' : 'revoked'}`);
      loadUsers();
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to update super admin status');
    }
  };

  // Role management functions
  const handleCreateRole = async (e) => {
    e.preventDefault();
    
    if (!apiService.rbacHelpers.validateRoleData(roleForm)) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      await apiService.rbacCreateRole(roleForm);
      showSuccess('Role created successfully');
      setShowRoleModal(false);
      setRoleForm({
        role_name: '',
        display_name: '',
        description: '',
        is_system_role: false
      });
      loadRoles();
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to create role');
    }
  };

  const handleUpdateRolePermissions = async (roleId, permissionIds) => {
    try {
      await apiService.rbacUpdateRolePermissions(roleId, permissionIds);
      showSuccess('Role permissions updated successfully');
      loadRoles();
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to update role permissions');
    }
  };

  // Permission management functions
  const handleCreatePermission = async (e) => {
    e.preventDefault();
    
    if (!apiService.rbacHelpers.validatePermissionData(permissionForm)) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      await apiService.rbacCreatePermission(permissionForm);
      showSuccess('Permission created successfully');
      setShowPermissionModal(false);
      setPermissionForm({
        permission_name: '',
        display_name: '',
        description: '',
        resource: '',
        action: '',
        is_system_permission: false
      });
      loadPermissions();
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to create permission');
    }
  };

  // Access control check
  if (!canViewUsers && !canManageRoles) {
    return (
      <div className="alert alert-warning">
        <h5>Access Denied</h5>
        <p>You don't have permission to access RBAC management.</p>
        <p>Required permissions: users:view or users:manage_roles</p>
      </div>
    );
  }

  // Render components
  const renderUserManagement = () => (
    <div className="tab-pane fade show active">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5>👥 User Management</h5>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-primary btn-sm"
            onClick={loadUsers}
            disabled={loading}
          >
            🔄 Refresh
          </button>
          {isSuperAdmin && (
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setShowUserModal(true)}
            >
              ➕ Add User
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border" role="status"></div>
          <p className="mt-2">Loading users...</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>User</th>
                <th>Department</th>
                <th>Roles</th>
                <th>Super Admin</th>
                <th>Last Updated</th>
                {canManageRoles && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.admin_id}>
                  <td>
                    <div>
                      <strong>{user.full_name || user.username}</strong>
                      <br />
                      <small className="text-muted">{user.email}</small>
                    </div>
                  </td>
                  <td>
                    <span className="badge bg-secondary">{user.department}</span>
                  </td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      {user.role_display_names?.map((roleName, index) => (
                        <span 
                          key={index}
                          className={`badge bg-${apiService.rbacHelpers.getRoleColor(user.roles?.[index])}`}
                        >
                          {roleName}
                        </span>
                      )) || <span className="text-muted">No roles</span>}
                    </div>
                  </td>
                  <td>
                    {isSuperAdmin && user.admin_id !== admin.admin_id ? (
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={user.is_super_admin}
                          onChange={() => handleToggleSuperAdmin(user.admin_id, user.is_super_admin)}
                        />
                      </div>
                    ) : (
                      <span className={`badge ${user.is_super_admin ? 'bg-danger' : 'bg-secondary'}`}>
                        {user.is_super_admin ? 'Yes' : 'No'}
                      </span>
                    )}
                  </td>
                  <td>
                    <small className="text-muted">
                      {apiService.rbacHelpers.formatLastUpdated(user.last_role_update)}
                    </small>
                  </td>
                  {canManageRoles && (
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-primary"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserModal(true);
                          }}
                        >
                          
                        </button>
                        <button
                          className="btn btn-outline-info"
                          onClick={() => {
                            // Show user details modal
                          }}
                        >
                          
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderRoleManagement = () => (
    <div className="tab-pane fade">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5> Role Management</h5>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-primary btn-sm"
            onClick={loadRoles}
          >
            🔄 Refresh
          </button>
          {isSuperAdmin && (
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setShowRoleModal(true)}
            >
              ➕ Create Role
            </button>
          )}
        </div>
      </div>

      <div className="row">
        {roles.map(role => (
          <div key={role.role_id} className="col-md-6 col-lg-4 mb-3">
            <div className="card h-100">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h6 className="mb-0">
                  <span className={`badge bg-${apiService.rbacHelpers.getRoleColor(role.role_name)} me-2`}>
                    {apiService.rbacHelpers.formatRoleName(role)}
                  </span>
                </h6>
                {role.is_system_role && (
                  <span className="badge bg-warning">System</span>
                )}
              </div>
              <div className="card-body">
                <p className="card-text small text-muted">
                  {role.description || 'No description'}
                </p>
                <div className="mt-3">
                  <small className="text-muted">
                    Users: <strong>{role.user_count || 0}</strong> | 
                    Permissions: <strong>{role.permission_count || 0}</strong>
                  </small>
                </div>
              </div>
              {canManageRoles && (
                <div className="card-footer">
                  <div className="btn-group btn-group-sm w-100">
                    <button 
                      className="btn btn-outline-primary"
                      onClick={() => {
                        setSelectedRole(role);
                        // Show role permissions modal
                      }}
                    >
                      🔑 Permissions
                    </button>
                    {!role.is_system_role && isSuperAdmin && (
                      <button 
                        className="btn btn-outline-danger"
                        onClick={() => {
                          // Handle role deletion
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPermissionManagement = () => {
    const groupedPermissions = apiService.rbacHelpers.groupPermissionsByResource(permissions);
    
    return (
      <div className="tab-pane fade">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h5>🔑 Permission Management</h5>
          <div className="d-flex gap-2">
            <button 
              className="btn btn-outline-primary btn-sm"
              onClick={loadPermissions}
            >
              🔄 Refresh
            </button>
            {isSuperAdmin && (
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setShowPermissionModal(true)}
              >
                ➕ Create Permission
              </button>
            )}
          </div>
        </div>

        <div className="accordion" id="permissionAccordion">
          {Object.entries(groupedPermissions).map(([resource, resourcePermissions], index) => (
            <div key={resource} className="accordion-item">
              <h2 className="accordion-header">
                <button
                  className="accordion-button collapsed"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target={`#collapse${index}`}
                >
                  <span className="me-2">
                    {apiService.rbacHelpers.getPermissionIcon(resource)}
                  </span>
                  <strong>{resource}</strong>
                  <span className="badge bg-secondary ms-2">
                    {resourcePermissions.length} permissions
                  </span>
                </button>
              </h2>
              <div
                id={`collapse${index}`}
                className="accordion-collapse collapse"
                data-bs-parent="#permissionAccordion"
              >
                <div className="accordion-body">
                  <div className="table-responsive">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Permission</th>
                          <th>Action</th>
                          <th>Description</th>
                          <th>System</th>
                          {isSuperAdmin && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {resourcePermissions.map(permission => (
                          <tr key={permission.permission_id}>
                            <td>
                              <strong>{permission.display_name}</strong>
                              <br />
                              <small className="text-muted">{permission.permission_name}</small>
                            </td>
                            <td>
                              <span className="badge bg-info">{permission.action}</span>
                            </td>
                            <td>
                              <small>{permission.description || 'No description'}</small>
                            </td>
                            <td>
                              {permission.is_system_permission && (
                                <span className="badge bg-warning">System</span>
                              )}
                            </td>
                            {isSuperAdmin && (
                              <td>
                                {!permission.is_system_permission && (
                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => {
                                      // Handle permission deletion
                                    }}
                                  >
                                    🗑️
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStatistics = () => (
    <div className="tab-pane fade">
      <h5>📊 RBAC Statistics</h5>
      
      {statistics ? (
        <div className="row">
          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h6>General Statistics</h6>
              </div>
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-6">
                    <div className="h4 text-primary">{statistics.general.total_users}</div>
                    <small className="text-muted">Total Users</small>
                  </div>
                  <div className="col-6">
                    <div className="h4 text-success">{statistics.general.total_roles}</div>
                    <small className="text-muted">Total Roles</small>
                  </div>
                  <div className="col-6 mt-3">
                    <div className="h4 text-info">{statistics.general.total_permissions}</div>
                    <small className="text-muted">Total Permissions</small>
                  </div>
                  <div className="col-6 mt-3">
                    <div className="h4 text-warning">{statistics.general.total_role_assignments}</div>
                    <small className="text-muted">Role Assignments</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h6>Role Distribution</h6>
              </div>
              <div className="card-body">
                {statistics.role_statistics.map(role => (
                  <div key={role.role_name} className="d-flex justify-content-between align-items-center mb-2">
                    <span className={`badge bg-${apiService.rbacHelpers.getRoleColor(role.role_name)}`}>
                      {role.display_name}
                    </span>
                    <div>
                      <span className="badge bg-secondary">{role.user_count} users</span>
                      <span className="badge bg-info ms-1">{role.permission_count} permissions</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-12 mt-3">
            <div className="card">
              <div className="card-header">
                <h6>Department Statistics</h6>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Admin Count</th>
                        <th>Role Assignments</th>
                        <th>Unique Roles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statistics.department_statistics.map(dept => (
                        <tr key={dept.department}>
                          <td><strong>{dept.department}</strong></td>
                          <td>{dept.admin_count}</td>
                          <td>{dept.total_role_assignments}</td>
                          <td>{dept.unique_roles}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="spinner-border" role="status"></div>
          <p className="mt-2">Loading statistics...</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3> RBAC Management</h3>
        <div className="badge bg-info">
          Department: {admin?.department} | Role: {admin?.is_super_admin ? 'Super Admin' : 'Admin'}
        </div>
      </div>

      {/* Navigation Tabs */}
      <ul className="nav nav-tabs mb-4">
        {canViewUsers && (
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              👥 Users
            </button>
          </li>
        )}
        {canManageRoles && (
          <>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'roles' ? 'active' : ''}`}
                onClick={() => setActiveTab('roles')}
              >
                 Roles
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'permissions' ? 'active' : ''}`}
                onClick={() => setActiveTab('permissions')}
              >
                 Permissions
              </button>
            </li>
          </>
        )}
        {isSuperAdmin && (
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'statistics' ? 'active' : ''}`}
              onClick={() => setActiveTab('statistics')}
            >
              📊 Statistics
            </button>
          </li>
        )}
      </ul>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'users' && renderUserManagement()}
        {activeTab === 'roles' && renderRoleManagement()}
        {activeTab === 'permissions' && renderPermissionManagement()}
        {activeTab === 'statistics' && renderStatistics()}
      </div>

      {/* Create Role Modal */}
      {showRoleModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"> Create New Role</h5>
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={() => setShowRoleModal(false)}
                ></button>
              </div>
              <form onSubmit={handleCreateRole}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Role Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={roleForm.role_name}
                      onChange={(e) => setRoleForm({...roleForm, role_name: e.target.value})}
                      placeholder="e.g. custom_admin"
                      required
                    />
                    <small className="text-muted">Unique identifier (lowercase, underscores)</small>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Display Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={roleForm.display_name}
                      onChange={(e) => setRoleForm({...roleForm, display_name: e.target.value})}
                      placeholder="e.g. Custom Administrator"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={roleForm.description}
                      onChange={(e) => setRoleForm({...roleForm, description: e.target.value})}
                      placeholder="Role description..."
                    ></textarea>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={roleForm.is_system_role}
                      onChange={(e) => setRoleForm({...roleForm, is_system_role: e.target.checked})}
                    />
                    <label className="form-check-label">
                      System Role (protected from deletion)
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowRoleModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Role
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Permission Modal */}
      {showPermissionModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">🔑 Create New Permission</h5>
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={() => setShowPermissionModal(false)}
                ></button>
              </div>
              <form onSubmit={handleCreatePermission}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Resource *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={permissionForm.resource}
                          onChange={(e) => setPermissionForm({...permissionForm, resource: e.target.value})}
                          placeholder="e.g. requests"
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Action *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={permissionForm.action}
                          onChange={(e) => setPermissionForm({...permissionForm, action: e.target.value})}
                          placeholder="e.g. view"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Permission Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={permissionForm.permission_name}
                      onChange={(e) => setPermissionForm({...permissionForm, permission_name: e.target.value})}
                      placeholder="e.g. requests.view"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Display Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={permissionForm.display_name}
                      onChange={(e) => setPermissionForm({...permissionForm, display_name: e.target.value})}
                      placeholder="e.g. View Requests"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={permissionForm.description}
                      onChange={(e) => setPermissionForm({...permissionForm, description: e.target.value})}
                      placeholder="Permission description..."
                    ></textarea>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={permissionForm.is_system_permission}
                      onChange={(e) => setPermissionForm({...permissionForm, is_system_permission: e.target.checked})}
                    />
                    <label className="form-check-label">
                      System Permission (protected from deletion)
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowPermissionModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Permission
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RBACManagement;