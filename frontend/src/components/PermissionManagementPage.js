// frontend/src/components/PermissionManagementPage.js
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { apiService } from '../services/api';
import { useConfirmation } from '../hooks/useConfirmation';
import ConfirmationModal from './ConfirmationModal';

const PermissionManagementPage = () => {
  const { admin, isSuperAdmin } = useAdminAuth();
  const { isDark } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { confirmationState, showConfirmation } = useConfirmation();
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({});
  const [roles, setRoles] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [filterSystemOnly, setFilterSystemOnly] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
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
    const confirmed = await showConfirmation({
      title: 'Delete Permission',
      message: `Are you sure you want to delete the permission "${permissionName}"?`,
      type: 'warning',
      confirmText: 'Delete Permission',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

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

  // Pagination helper functions
  const getPaginatedData = (data, page, itemsPerPage) => {
    const startIndex = (page - 1) * itemsPerPage;
    return data.slice(startIndex, startIndex + itemsPerPage);
  };

  const getTotalPages = (dataLength, itemsPerPage) => {
    return Math.ceil(dataLength / itemsPerPage);
  };

  const paginatedPermissions = getPaginatedData(filteredPermissions, currentPage, itemsPerPage);
  const totalPages = getTotalPages(filteredPermissions.length, itemsPerPage);

  // Get unique resources
  const getResources = () => {
    return [...new Set(allPermissions.map(p => p.resource))].sort();
  };

  // Get common actions
  const getCommonActions = () => {
    return ['view', 'create', 'update', 'delete', 'manage', 'export', 'import'];
  };

  // Pagination Component
  const PaginationComponent = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    return (
      <nav aria-label="Page navigation" className="mt-4">
        <ul className="pagination justify-content-center">
          <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
            <button 
              className="page-link" 
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                backgroundColor: isDark ? '#000000' : '#ffffff',
                borderColor: isDark ? '#6c757d' : '#dee2e6',
                color: isDark ? '#ffffff' : '#000000'
              }}
            >
              Previous
            </button>
          </li>
          
          {[...Array(totalPages)].map((_, index) => (
            <li key={index + 1} className={`page-item ${currentPage === index + 1 ? 'active' : ''}`}>
              <button 
                className="page-link" 
                onClick={() => onPageChange(index + 1)}
                style={{
                  backgroundColor: currentPage === index + 1 
                    ? '#dc2626' 
                    : (isDark ? '#000000' : '#ffffff'),
                  borderColor: currentPage === index + 1 
                    ? '#dc2626' 
                    : (isDark ? '#6c757d' : '#dee2e6'),
                  color: currentPage === index + 1 
                    ? '#ffffff' 
                    : (isDark ? '#ffffff' : '#000000')
                }}
              >
                {index + 1}
              </button>
            </li>
          ))}
          
          <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
            <button 
              className="page-link" 
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{
                backgroundColor: isDark ? '#000000' : '#ffffff',
                borderColor: isDark ? '#6c757d' : '#dee2e6',
                color: isDark ? '#ffffff' : '#000000'
              }}
            >
              Next
            </button>
          </li>
        </ul>
      </nav>
    );
  };

  const cardStyle = {
    backgroundColor: isDark ? '#000000' : '#ffffff',
    borderColor: isDark ? '#333333' : '#dee2e6',
    color: isDark ? '#ffffff' : '#000000'
  };

  if (!isSuperAdmin()) {
    return (
      <div className="alert alert-warning">
        <h5>Access Denied</h5>
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
            Permission Management
          </h3>
          <p className={isDark ? 'text-light' : 'text-muted'}>
            Create and manage system permissions for role-based access control
          </p>
        </div>
        
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          Create Permission
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
            Refresh
          </button>
        </div>
      </div>

      

      {/* Permissions Table */}
      <div className="card" style={cardStyle}>
        <div className="card-body">
          {filteredPermissions.length === 0 ? (
            <div className="text-center py-4">
              <div className={`text-muted ${isDark ? 'text-light' : ''}`}>
                <h5>No permissions found</h5>
                <p>No permissions match your current filters.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead className={isDark ? 'table-dark' : 'table-light'}>
                    <tr>
                      <th>Display Name</th>
                      <th>Permission Name</th>
                      <th>Resource</th>
                      
                      <th>Type</th>
                      <th>Description</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPermissions.map((permission) => (
                      <tr 
                        key={permission.permission_id}
                        className={isDark ? 'text-light' : ''}
                      >
                        <td>
                          <div className="fw-semibold">
                            {permission.display_name}
                          </div>
                        </td>
                        <td>
                          <code className={isDark ? 'text-warning' : 'text-primary'}>
                            {permission.permission_name}
                          </code>
                        </td>
                        <td>
                          <span className="badge bg-info">
                            {permission.resource}
                          </span>
                        </td>

                        <td>
                          {permission.is_system_permission ? (
                            <span className="badge bg-danger text-dark">
                              System
                            </span>
                          ) : (
                            <span className="badge bg-danger">
                              Custom
                            </span>
                          )}
                        </td>
                        <td>
                          <small className={isDark ? 'text-light' : 'text-muted'}>
                            {permission.description ? 
                              (permission.description.length > 50 ? 
                                permission.description.substring(0, 50) + '...' : 
                                permission.description
                              ) : 
                              'No description'
                            }
                          </small>
                        </td>
                        <td>
                          <div className="btn-group" role="group">
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleViewDetails(permission)}
                              title="View Details"
                            >
                              View
                            </button>
                            
                            {!permission.is_system_permission && (
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => handleDeletePermission(permission.permission_id, permission.display_name)}
                                title="Delete Permission"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <PaginationComponent 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
              
              {/* Results Info */}
              <div className="mt-3 text-center">
                <small className={isDark ? 'text-light' : 'text-muted'}>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredPermissions.length)} of {filteredPermissions.length} permissions
                </small>
              </div>
            </>
          )}
        </div>
      </div>

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
                  style={{
                    filter: isDark ? 'invert(1)' : 'none'
                  }}
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
          <div className="modal-dialog modal-lg">
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
                  style={{
                    filter: isDark ? 'invert(1)' : 'none'
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6">
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
                          <td>
                            <span className="badge bg-info">
                              {selectedPermission.resource}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          
                          
                          
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="col-md-6">
                    <table className="table table-borderless">
                      <tbody>
                        <tr>
                          <td><strong>System Permission:</strong></td>
                          <td>
                            {selectedPermission.is_system_permission ? (
                              <span className="badge bg-danger text-dark">Yes</span>
                            ) : (
                              <span className="badge bg-danger">No</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Permission ID:</strong></td>
                          <td><code>{selectedPermission.permission_id}</code></td>
                        </tr>
                        <tr>
                          <td><strong>Created:</strong></td>
                          <td>
                            <small className={isDark ? 'text-light' : 'text-muted'}>
                              {selectedPermission.created_at ? 
                                new Date(selectedPermission.created_at).toLocaleString() : 
                                'Unknown'
                              }
                            </small>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="mt-3">
                  <strong>Description:</strong>
                  <p className={`mt-2 ${isDark ? 'text-light' : 'text-muted'}`}>
                    {selectedPermission.description || 'No description provided'}
                  </p>
                </div>

                
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-danger"
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

      {/* Confirmation Modal */}
      <ConfirmationModal {...confirmationState} />
    </div>
  );
};

export default PermissionManagementPage;