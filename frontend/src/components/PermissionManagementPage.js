// frontend/src/components/PermissionManagementPage.js
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { apiService } from '../services/api';

const PermissionManagementPage = () => {
  const { admin, isSuperAdmin } = useAdminAuth();
  const { isDark } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({});
  const [roles, setRoles] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [filterSystemOnly, setFilterSystemOnly] = useState(false);
  
  // Create permission form state
  const [newPermission, setNewPermission] = useState({
    permission_name: '',
    display_name: '',
    description: '',
    resource: '',
    action: '',
    is_system_permission: false
  });

  useEffect(() => {
    if (isSuperAdmin()) {
      loadData();
    }
  }, [isSuperAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [permissionsRes, rolesRes] = await Promise.all([
        apiService.rbacGetAllPermissions(),
        apiService.rbacGetAllRoles()
      ]);

      if (permissionsRes.data.success) {
        setPermissions(permissionsRes.data.data);
      }
      
      if (rolesRes.data.success) {
        setRoles(rolesRes.data.data);
      }

    } catch (error) {
      console.error('Error loading permission data:', error);
      showError('Failed to load permission data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePermission = async (e) => {
    e.preventDefault();
    
    if (!apiService.rbacHelpers.validatePermissionData(newPermission)) {
      showError('Please fill in all required fields');
      return;
    }

    // Generate permission_name if not provided
    if (!newPermission.permission_name) {
      const generatedName = `${newPermission.resource}.${newPermission.action}`;
      setNewPermission(prev => ({ ...prev, permission_name: generatedName }));
    }

    try {
      const result = await apiService.rbacCreatePermission(newPermission);
      
      if (result.data.success) {
        showSuccess('Permission created successfully');
        setShowCreateModal(false);
        setNewPermission({
          permission_name: '',
          display_name: '',
          description: '',
          resource: '',
          action: '',
          is_system_permission: false
        });
        loadData();
      }
    } catch (error) {
      console.error('Error creating permission:', error);
      if (error.response?.status === 409) {
        showError('Permission with this name already exists');
      } else {
        showError('Failed to create permission');
      }
    }
  };

  const handleDeletePermission = async (permissionId, permissionName) => {
    if (!window.confirm(`Are you sure you want to delete the permission "${permissionName}"?`)) {
      return;
    }

    try {
      const result = await apiService.rbacDeletePermission(permissionId);
      
      if (result.data.success) {
        showSuccess('Permission deleted successfully');
        loadData();
      }
    } catch (error) {
      console.error('Error deleting permission:', error);
      if (error.response?.status === 400) {
        showError('Cannot delete system permissions');
      } else {
        showError('Failed to delete permission');
      }
    }
  };

  const handleViewDetails = async (permission) => {
    setSelectedPermission(permission);
    setShowDetailsModal(true);
  };

  // Get all permissions as flat array for filtering
  const allPermissions = Object.values(permissions).flat();

  // Filter permissions
  const filteredPermissions = allPermissions.filter(permission => {
    const matchesSearch = 
      permission.permission_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      permission.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesResource = !filterResource || permission.resource === filterResource;
    
    const matchesSystemFilter = !filterSystemOnly || permission.is_system_permission;
    
    return matchesSearch && matchesResource && matchesSystemFilter;
  });

  // Get unique resources
  const getResources = () => {
    return [...new Set(allPermissions.map(p => p.resource))].sort();
  };

  // Get common actions
  const getCommonActions = () => {
    return ['view', 'create', 'update', 'delete', 'manage', 'export', 'import'];
  };

  // Group filtered permissions by resource
  const groupedPermissions = filteredPermissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = [];
    }
    acc[permission.resource].push(permission);
    return acc;
  }, {});

  const cardStyle = {
    backgroundColor: isDark ? '#000000' : '#ffffff',
    borderColor: isDark ? '#333333' : '#dee2e6',
    color: isDark ? '#ffffff' : '#000000'
  };

  if (!isSuperAdmin()) {
    return (
      <div className="alert alert-warning">
        <h5>🔒 Access Denied</h5>
        <p>Permission Management is only available for Super Administrators.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status"></div>
        <p className={`mt-3 ${isDark ? 'text-light' : 'text-dark'}`}>
          Loading permissions...
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
            🔐 Permission Management
          </h3>
          <p className={isDark ? 'text-light' : 'text-muted'}>
            Create and manage system permissions for role-based access control
          </p>
        </div>
        
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          ➕ Create Permission
        </button>
      </div>

      {/* Filters */}
      <div className="row mb-4">
        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="Search permissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              backgroundColor: isDark ? '#000000' : '#ffffff',
              borderColor: isDark ? '#333333' : '#ced4da',
              color: isDark ? '#ffffff' : '#000000'
            }}
          />
        </div>
        
        <div className="col-md-3">
          <select
            className="form-select"
            value={filterResource}
            onChange={(e) => setFilterResource(e.target.value)}
            style={{
              backgroundColor: isDark ? '#000000' : '#ffffff',
              borderColor: isDark ? '#333333' : '#ced4da',
              color: isDark ? '#ffffff' : '#000000'
            }}
          >
            <option value="">All Resources</option>
            {getResources().map(resource => (
              <option key={resource} value={resource}>{resource}</option>
            ))}
          </select>
        </div>
        
        <div className="col-md-3">
          <div className="form-check form-switch mt-2">
            <input
              className="form-check-input"
              type="checkbox"
              checked={filterSystemOnly}
              onChange={(e) => setFilterSystemOnly(e.target.checked)}
            />
            <label className={`form-check-label ${isDark ? 'text-light' : 'text-dark'}`}>
              System permissions only
            </label>
          </div>
        </div>
        
        <div className="col-md-2">
          <button 
            className="btn btn-outline-secondary w-100"
            onClick={loadData}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Permissions by Resource */}
      {Object.keys(groupedPermissions).length === 0 ? (
        <div className="alert alert-info">
          <h5>No permissions found</h5>
          <p>No permissions match your current filters.</p>
        </div>
      ) : (
        Object.keys(groupedPermissions).sort().map((resource) => (
          <div key={resource} className="mb-4">
            <div className="card" style={cardStyle}>
              <div className="card-header">
                <h5 className="mb-0">
                  {apiService.rbacHelpers.getPermissionIcon(resource)} {resource.toUpperCase()}
                  <span className="badge bg-secondary ms-2">
                    {groupedPermissions[resource].length} permissions
                  </span>
                </h5>
              </div>
              <div className="card-body">
                <div className="row">
                  {groupedPermissions[resource].map((permission) => (
                    <div key={permission.permission_id} className="col-lg-6 mb-3">
                      <div 
                        className="p-3 rounded border"
                        style={{ 
                          backgroundColor: isDark ? '#111111' : '#f8f9fa',
                          borderColor: isDark ? '#333333' : '#e5e7eb'
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <h6 className={`mb-1 ${isDark ? 'text-light' : 'text-dark'}`}>
                              {permission.display_name}
                              {permission.is_system_permission && (
                                <span className="badge bg-warning text-dark ms-2">System</span>
                              )}
                            </h6>
                            <p className={`mb-1 ${isDark ? 'text-light' : 'text-muted'}`}>
                              <code>{permission.resource}:{permission.action}</code>
                            </p>
                            {permission.description && (
                              <p className={`mb-2 ${isDark ? 'text-light' : 'text-muted'}`}>
                                {permission.description}
                              </p>
                            )}
                            <small className={isDark ? 'text-light' : 'text-muted'}>
                              ID: {permission.permission_id}
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
                                  onClick={() => handleViewDetails(permission)}
                                >
                                  🔍 View Details
                                </button>
                              </li>
                              <li>
                                <button 
                                  className="dropdown-item"
                                  onClick={() => showInfo('View roles with this permission')}
                                >
                                  🎭 View Roles
                                </button>
                              </li>
                              {!permission.is_system_permission && (
                                <>
                                  <li><hr className="dropdown-divider" /></li>
                                  <li>
                                    <button 
                                      className="dropdown-item text-danger"
                                      onClick={() => handleDeletePermission(permission.permission_id, permission.display_name)}
                                    >
                                      🗑️ Delete Permission
                                    </button>
                                  </li>
                                </>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Create Permission Modal */}
      {showCreateModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content" style={cardStyle}>
              <div className="modal-header">
                <h5 className="modal-title">Create New Permission</h5>
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={() => setShowCreateModal(false)}
                ></button>
              </div>
              <form onSubmit={handleCreatePermission}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                      Display Name *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={newPermission.display_name}
                      onChange={(e) => setNewPermission({...newPermission, display_name: e.target.value})}
                      placeholder="e.g., View Department Requests"
                      required
                      style={{
                        backgroundColor: isDark ? '#000000' : '#ffffff',
                        borderColor: isDark ? '#333333' : '#ced4da',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    />
                  </div>

                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                          Resource *
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={newPermission.resource}
                          onChange={(e) => setNewPermission({...newPermission, resource: e.target.value})}
                          placeholder="e.g., requests"
                          list="resources-list"
                          required
                          style={{
                            backgroundColor: isDark ? '#000000' : '#ffffff',
                            borderColor: isDark ? '#333333' : '#ced4da',
                            color: isDark ? '#ffffff' : '#000000'
                          }}
                        />
                        <datalist id="resources-list">
                          {getResources().map(resource => (
                            <option key={resource} value={resource} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                          Action *
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={newPermission.action}
                          onChange={(e) => setNewPermission({...newPermission, action: e.target.value})}
                          placeholder="e.g., view_department"
                          list="actions-list"
                          required
                          style={{
                            backgroundColor: isDark ? '#000000' : '#ffffff',
                            borderColor: isDark ? '#333333' : '#ced4da',
                            color: isDark ? '#ffffff' : '#000000'
                          }}
                        />
                        <datalist id="actions-list">
                          {getCommonActions().map(action => (
                            <option key={action} value={action} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                      Permission Name (Auto-generated)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={newPermission.permission_name || `${newPermission.resource}.${newPermission.action}`}
                      onChange={(e) => setNewPermission({...newPermission, permission_name: e.target.value})}
                      placeholder="Auto-generated from resource:action"
                      style={{
                        backgroundColor: isDark ? '#000000' : '#ffffff',
                        borderColor: isDark ? '#333333' : '#ced4da',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    />
                    <small className={isDark ? 'text-light' : 'text-muted'}>
                      Leave blank to auto-generate from resource and action
                    </small>
                  </div>

                  <div className="mb-3">
                    <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                      Description
                    </label>
                    <textarea
                      className="form-control"
                      value={newPermission.description}
                      onChange={(e) => setNewPermission({...newPermission, description: e.target.value})}
                      placeholder="Describe what this permission allows"
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
                        checked={newPermission.is_system_permission}
                        onChange={(e) => setNewPermission({...newPermission, is_system_permission: e.target.checked})}
                      />
                      <label className={`form-check-label ${isDark ? 'text-light' : 'text-dark'}`}>
                        System Permission (Protected from deletion)
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
                    Create Permission
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Permission Details Modal */}
      {showDetailsModal && selectedPermission && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content" style={cardStyle}>
              <div className="modal-header">
                <h5 className="modal-title">Permission Details</h5>
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedPermission(null);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <table className="table table-borderless">
                  <tbody>
                    <tr>
                      <td><strong>Display Name:</strong></td>
                      <td>{selectedPermission.display_name}</td>
                    </tr>
                    <tr>
                      <td><strong>Permission Name:</strong></td>
                      <td><code>{selectedPermission.permission_name}</code></td>
                    </tr>
                    <tr>
                      <td><strong>Resource:</strong></td>
                      <td>{selectedPermission.resource}</td>
                    </tr>
                    <tr>
                      <td><strong>Action:</strong></td>
                      <td>{selectedPermission.action}</td>
                    </tr>
                    <tr>
                      <td><strong>Description:</strong></td>
                      <td>{selectedPermission.description || 'No description'}</td>
                    </tr>
                    <tr>
                      <td><strong>System Permission:</strong></td>
                      <td>
                        {selectedPermission.is_system_permission ? (
                          <span className="badge bg-warning text-dark">Yes</span>
                        ) : (
                          <span className="badge bg-success">No</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Permission ID:</strong></td>
                      <td>{selectedPermission.permission_id}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Roles using this permission */}
                <div className="mt-4">
                  <h6 className={isDark ? 'text-light' : 'text-dark'}>
                    Roles with this permission:
                  </h6>
                  <div className="d-flex flex-wrap gap-2">
                    {/* This would need to be fetched from API */}
                    <span className="badge bg-info">Loading...</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedPermission(null);
                  }}
                >
                  Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);
};

export default PermissionManagementPage;
