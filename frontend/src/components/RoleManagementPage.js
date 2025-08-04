// frontend/src/components/RoleManagementPage.js
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { apiService } from '../services/api';
import { useConfirmation } from '../hooks/useConfirmation';
import ConfirmationModal from './ConfirmationModal';


const RoleManagementPage = () => {
  const { admin, isSuperAdmin } = useAdminAuth();
  const { isDark } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { confirmationState, showConfirmation } = useConfirmation();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [selectedRole, setSelectedRole] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create role form state
  const [newRole, setNewRole] = useState({
    role_name: '',
    display_name: '',
    description: '',
    is_system_role: false
  });


  // DÜZELTİLMİŞ VERSİYON:
const getSelectedPermissionsSummary = () => {
  const selectedPerms = allPermissions.filter(p => selectedPermissions.includes(p.permission_id));
  return apiService.rbacHelpers.createPermissionSummary(selectedPerms);
};

  // Permission assignment state
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permissionFilter, setPermissionFilter] = useState('');

  useEffect(() => {
    if (isSuperAdmin()) {
      loadData();
    }
  }, [isSuperAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [rolesRes, permissionsRes] = await Promise.all([
        apiService.rbacGetAllRoles(),
        apiService.rbacGetAllPermissions()
      ]);

      if (rolesRes.data.success) {
        setRoles(rolesRes.data.data);
      }
      
      if (permissionsRes.data.success) {
        setPermissions(permissionsRes.data.data);
      }

    } catch (error) {
      console.error('Error loading role data:', error);
      showError('Failed to load role data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    
    if (!apiService.rbacHelpers.validateRoleData(newRole)) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      const result = await apiService.rbacCreateRole(newRole);
      
      if (result.data.success) {
        showSuccess('Role created successfully');
        setShowCreateModal(false);
        setNewRole({
          role_name: '',
          display_name: '',
          description: '',
          is_system_role: false
        });
        loadData();
      }
    } catch (error) {
      console.error('Error creating role:', error);
      if (error.response?.status === 409) {
        showError('Role with this name already exists');
      } else {
        showError('Failed to create role');
      }
    }
  };

  const handlePermissionUpdate = async () => {
    if (!selectedRole) {
      showError('No role selected');
      return;
    }

    try {
      const result = await apiService.rbacUpdateRolePermissions(
        selectedRole.role_id, 
        selectedPermissions
      );
      
      if (result.data.success) {
        showSuccess('Role permissions updated successfully');
        setShowPermissionModal(false);
        setSelectedRole(null);
        setSelectedPermissions([]);
        loadData();
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      showError('Failed to update role permissions');
    }
  };

  const handleViewPermissions = async (role) => {
    try {
      const result = await apiService.rbacGetRolePermissions(role.role_id);
      
      if (result.data.success) {
        const currentPermissionIds = result.data.data.map(p => p.permission_id);
        setSelectedPermissions(currentPermissionIds);
        setSelectedRole(role);
        setShowPermissionModal(true);
      }
    } catch (error) {
      console.error('Error loading role permissions:', error);
      showError('Failed to load role permissions');
    }
  };

  const handleDeleteRole = async (roleId, roleName) => {
  const confirmed = await showConfirmation({
    title: '🗑️ Delete Role',
    message: `Are you sure you want to delete the role "${roleName}"?\n\nThis action cannot be undone.`,
    type: 'danger',
    confirmText: 'Delete Role',
    cancelText: 'Cancel',
    requireTextConfirmation: true,
    confirmationText: 'DELETE'
  });

  if (!confirmed) return;

  try {
    await apiService.deleteRole(roleId);
    showSuccess('Role deleted successfully');
    loadData();
  } catch (error) {
    console.error('Error deleting role:', error);
    showError('Failed to delete role');
  }
};

  // Filter roles based on search
  const filteredRoles = roles.filter(role => 
    role.role_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get all permissions as flat array for modal
  const allPermissions = Object.values(permissions).flat();

  // Filter permissions for modal
  const filteredPermissions = allPermissions.filter(permission =>
    permission.permission_name.toLowerCase().includes(permissionFilter.toLowerCase()) ||
    permission.display_name.toLowerCase().includes(permissionFilter.toLowerCase()) ||
    permission.resource.toLowerCase().includes(permissionFilter.toLowerCase())
  );

  const cardStyle = {
    backgroundColor: isDark ? '#000000' : '#ffffff',
    borderColor: isDark ? '#333333' : '#dee2e6',
    color: isDark ? '#ffffff' : '#000000'
  };

  if (!isSuperAdmin()) {
    return (
      <div className="alert alert-warning">
        <h5>🔒 Access Denied</h5>
        <p>Role Management is only available for Super Administrators.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status"></div>
        <p className={`mt-3 ${isDark ? 'text-light' : 'text-dark'}`}>
          Loading roles...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className={isDark ? 'text-light' : 'text-dark'}>
            🎭 Role Management
          </h3>
          <p className={isDark ? 'text-light' : 'text-muted'}>
            Create and manage system roles and their permissions
          </p>
        </div>
        
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          ➕ Create Role
        </button>
      </div>

      {/* Search */}
      <div className="row mb-4">
        <div className="col-md-6">
          <input
            type="text"
            className="form-control"
            placeholder="Search roles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              backgroundColor: isDark ? '#000000' : '#ffffff',
              borderColor: isDark ? '#333333' : '#ced4da',
              color: isDark ? '#ffffff' : '#000000'
            }}
          />
        </div>
        <div className="col-md-6">
          <div className="d-flex gap-2">
            <button 
              className="btn btn-outline-secondary"
              onClick={loadData}
            >
              🔄 Refresh
            </button>
            <button 
              className="btn btn-outline-info"
              onClick={() => showInfo('Export roles feature')}
            >
              📊 Export
            </button>
          </div>
        </div>
      </div>

      {/* Roles List */}
      <div className="row">
        {filteredRoles.length === 0 ? (
          <div className="col-12">
            <div className="alert alert-info">
              <h5>No roles found</h5>
              <p>No roles match your search criteria.</p>
            </div>
          </div>
        ) : (
          filteredRoles.map((role) => (
            <div key={role.role_id} className="col-lg-6 mb-3">
              <div className="card" style={cardStyle}>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <h6 className={`card-title ${isDark ? 'text-light' : 'text-dark'}`}>
                        {role.display_name}
                        {role.is_system_role && (
                          <span className="badge bg-warning text-dark ms-2">System</span>
                        )}
                      </h6>
                      
                      <p className={`card-text ${isDark ? 'text-light' : 'text-muted'}`}>
                        <strong>Role Name:</strong> {role.role_name}<br />
                        <strong>Description:</strong> {role.description || 'No description'}
                      </p>
                      
                      <div className="d-flex gap-2 mb-2">
                        <span className="badge bg-info">
                          {role.permission_count} permissions
                        </span>
                        <span className="badge bg-success">
                          {role.user_count} users
                        </span>
                        {role.is_system_role && (
                          <span className="badge bg-warning text-dark">
                            Protected
                          </span>
                        )}
                      </div>
                      
                      <small className={isDark ? 'text-light' : 'text-muted'}>
                        Role ID: {role.role_id}
                      </small>
                    </div>
                    
                    <div className="dropdown">
                      <button 
                        className="btn btn-outline-secondary btn-sm dropdown-toggle"
                        type="button"
                        data-bs-toggle="dropdown"
                      >
                        Actions
                      </button>
                      <ul className="dropdown-menu">
                        <li>
                          <button 
                            className="dropdown-item"
                            onClick={() => handleViewPermissions(role)}
                          >
                            🔍 View Permissions
                          </button>
                        </li>
                        <li>
                          <button 
                            className="dropdown-item"
                            onClick={() => handleViewPermissions(role)}
                          >
                            ✏️ Edit Permissions
                          </button>
                        </li>
                        <li>
                          <button 
                            className="dropdown-item"
                            onClick={() => showInfo('View users with this role')}
                          >
                            👥 View Users
                          </button>
                        </li>
                        {!role.is_system_role && (
                          <>
                            <li><hr className="dropdown-divider" /></li>
                            <li>
                              <button 
                                className="dropdown-item text-danger"
                                onClick={() => handleDeleteRole(role.role_id, role.display_name)}
                              >
                                🗑️ Delete Role
                              </button>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content" style={cardStyle}>
              <div className="modal-header">
                <h5 className="modal-title">Create New Role</h5>
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={() => setShowCreateModal(false)}
                ></button>
              </div>
              <form onSubmit={handleCreateRole}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                      Role Name * (Technical name)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={newRole.role_name}
                      onChange={(e) => setNewRole({...newRole, role_name: e.target.value})}
                      placeholder="e.g., department_manager"
                      pattern="[a-z_]+"
                      required
                      style={{
                        backgroundColor: isDark ? '#000000' : '#ffffff',
                        borderColor: isDark ? '#333333' : '#ced4da',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    />
                    <small className={isDark ? 'text-light' : 'text-muted'}>
                      Only lowercase letters and underscores
                    </small>
                  </div>

                  <div className="mb-3">
                    <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                      Display Name * (Human-readable)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={newRole.display_name}
                      onChange={(e) => setNewRole({...newRole, display_name: e.target.value})}
                      placeholder="e.g., Department Manager"
                      required
                      style={{
                        backgroundColor: isDark ? '#000000' : '#ffffff',
                        borderColor: isDark ? '#333333' : '#ced4da',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    />
                  </div>

                  <div className="mb-3">
                    <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                      Description
                    </label>
                    <textarea
                      className="form-control"
                      value={newRole.description}
                      onChange={(e) => setNewRole({...newRole, description: e.target.value})}
                      placeholder="Describe the role's purpose and responsibilities"
                      rows="3"
                      style={{
                        backgroundColor: isDark ? '#000000' : '#ffffff',
                        borderColor: isDark ? '#333333' : '#ced4da',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    />
                  </div>

                  <div className="mb-3">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={newRole.is_system_role}
                        onChange={(e) => setNewRole({...newRole, is_system_role: e.target.checked})}
                      />
                      <label className={`form-check-label ${isDark ? 'text-light' : 'text-dark'}`}>
                        System Role (Protected from deletion)
                      </label>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowCreateModal(false)}
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

      {/* Permission Management Modal */}
      {showPermissionModal && selectedRole && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content" style={cardStyle}>
              <div className="modal-header">
                <h5 className="modal-title">
                  Manage Permissions - {selectedRole.display_name}
                </h5>
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={() => {
                    setShowPermissionModal(false);
                    setSelectedRole(null);
                    setSelectedPermissions([]);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                {/* Permission Filter */}
                <div className="mb-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Filter permissions..."
                    value={permissionFilter}
                    onChange={(e) => setPermissionFilter(e.target.value)}
                    style={{
                      backgroundColor: isDark ? '#000000' : '#ffffff',
                      borderColor: isDark ? '#333333' : '#ced4da',
                      color: isDark ? '#ffffff' : '#000000'
                    }}
                  />
                </div>

                {/* Permissions by Resource */}
                {Object.keys(permissions).map((resource) => (
                  <div key={resource} className="mb-4">
                    <h6 className={`border-bottom pb-2 ${isDark ? 'text-light' : 'text-dark'}`}>
                      {apiService.rbacHelpers.getPermissionIcon(resource)} {resource.toUpperCase()}
                    </h6>
                    <div className="row">
                      {permissions[resource]
                        .filter(permission => 
                          !permissionFilter || 
                          permission.permission_name.toLowerCase().includes(permissionFilter.toLowerCase()) ||
                          permission.display_name.toLowerCase().includes(permissionFilter.toLowerCase())
                        )
                        .map((permission) => (
                          <div key={permission.permission_id} className="col-md-6 mb-2">
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={selectedPermissions.includes(permission.permission_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPermissions([...selectedPermissions, permission.permission_id]);
                                  } else {
                                    setSelectedPermissions(selectedPermissions.filter(id => id !== permission.permission_id));
                                  }
                                }}
                              />
                              <label className={`form-check-label ${isDark ? 'text-light' : 'text-dark'}`}>
                                <strong>{permission.display_name}</strong>
                                <br />
                                <small className={isDark ? 'text-light' : 'text-muted'}>
                                  {permission.resource}:{permission.action}
                                  {permission.is_system_permission && ' (System)'}
                                </small>
                              </label>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}




                {/* Permission Summary */}
                <div className="mt-4 p-3 rounded" style={{ 
                  backgroundColor: isDark ? '#111111' : '#f8f9fa',
                  border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
                }}>
                  <strong className={isDark ? 'text-light' : 'text-dark'}>
                    Selected: {selectedPermissions.length} permissions
                  </strong>
                  <br />
                  <small className={isDark ? 'text-light' : 'text-muted'}>
  {getSelectedPermissionsSummary()}
</small>

                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowPermissionModal(false);
                    setSelectedRole(null);
                    setSelectedPermissions([]);
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-warning me-2"
                  onClick={() => setSelectedPermissions([])}
                >
                  Clear All
                </button>
                <button 
                  type="button" 
                  className="btn btn-info me-2"
                  onClick={() => setSelectedPermissions(allPermissions.map(p => p.permission_id))}
                >
                  Select All
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handlePermissionUpdate}
                >
                  Update Permissions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card" style={cardStyle}>
            <div className="card-body">
              <div className="row text-center">
                <div className="col-md-2">
                  <div className="h4 text-primary">{filteredRoles.length}</div>
                  <div className={isDark ? 'text-light' : 'text-muted'}>Total Roles</div>
                </div>
                <div className="col-md-2">
                  <div className="h4 text-warning">
                    {filteredRoles.filter(r => r.is_system_role).length}
                  </div>
                  <div className={isDark ? 'text-light' : 'text-muted'}>System Roles</div>
                </div>
                <div className="col-md-2">
                  <div className="h4 text-success">
                    {filteredRoles.filter(r => !r.is_system_role).length}
                  </div>
                  <div className={isDark ? 'text-light' : 'text-muted'}>Custom Roles</div>
                </div>
                <div className="col-md-2">
                  <div className="h4 text-info">
                    {filteredRoles.reduce((sum, role) => sum + role.permission_count, 0)}
                  </div>
                  <div className={isDark ? 'text-light' : 'text-muted'}>Total Permissions</div>
                </div>
                <div className="col-md-2">
                  <div className="h4 text-secondary">
                    {filteredRoles.reduce((sum, role) => sum + role.user_count, 0)}
                  </div>
                  <div className={isDark ? 'text-light' : 'text-muted'}>Total Assignments</div>
                </div>
                <div className="col-md-2">
                  <div className="h4 text-danger">
                    {Math.round(filteredRoles.reduce((sum, role) => sum + role.permission_count, 0) / filteredRoles.length || 0)}
                  </div>
                  <div className={isDark ? 'text-light' : 'text-muted'}>Avg Permissions</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

     
    </div>
  );
};

export default RoleManagementPage;