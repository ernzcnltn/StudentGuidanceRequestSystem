// frontend/src/components/UserManagementPage.js
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { apiService } from '../services/api';
import { useConfirmation } from '../hooks/useConfirmation';
import ConfirmationModal from './ConfirmationModal';

const UserManagementPage = ({ departmentFilter = null }) => {
  const { admin, isSuperAdmin, isDepartmentAdmin, hasPermission } = useAdminAuth();
  const { isDark } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { confirmationState, showConfirmation } = useConfirmation();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState(departmentFilter || '');
  const [filterRole, setFilterRole] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Create user form state
  const [newUser, setNewUser] = useState({
    username: '',
    full_name: '',
    email: '',
    department: departmentFilter || '',
    password: ''
  });

  // Role assignment state
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [roleExpiryDate, setRoleExpiryDate] = useState('');

  useEffect(() => {
    if (hasPermission('users', 'view')) {
      loadData();
    }
  }, [hasPermission]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('Loading user management data...');
      
      const [usersRes, rolesRes] = await Promise.allSettled([
        apiService.rbacGetUsersWithRoles(),
        apiService.rbacGetAllRoles()
      ]);

      // Handle users response
      if (usersRes.status === 'fulfilled' && usersRes.value?.data?.success) {
        let userData = usersRes.value.data.data || [];
        
        // Apply department filter if not super admin
        if (departmentFilter && !isSuperAdmin()) {
          userData = userData.filter(user => user.department === departmentFilter);
        }
        
        setUsers(userData);
        console.log('Users loaded:', userData.length);
      } else {
        console.error('Failed to load users:', usersRes.reason);
        setUsers([]);
        showError('Failed to load users');
      }
      
      // Handle roles response
      if (rolesRes.status === 'fulfilled' && rolesRes.value?.data?.success) {
        setRoles(rolesRes.value.data.data || []);
        console.log('Roles loaded:', rolesRes.value.data.data?.length || 0);
      } else {
        console.error('Failed to load roles:', rolesRes.reason);
        setRoles([]);
        showError('Failed to load roles');
      }

    } catch (error) {
      console.error('Error loading user data:', error);
      showError('Failed to load user data');
      setUsers([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username, fullName) => {
    // Güvenlik kontrolü
    if (userId === admin.admin_id) {
      showError('Cannot delete your own account');
      return;
    }

    // Modern confirmation dialog
    const confirmed = await showConfirmation({
      title: 'Delete User Account',
      message: `Are you sure you want to delete user "${fullName || username}"?\n\nThis action will:\n• Remove all role assignments\n• Deactivate the user account\n• This action cannot be easily undone`,
      type: 'danger',
      confirmText: 'Delete User',
      cancelText: 'Cancel',
      requireTextConfirmation: true,
      confirmationText: 'DELETE'
    });

    if (!confirmed) return;

    try {
      const result = await apiService.deleteAdminUser(userId);
      
      if (result.data.success) {
        showSuccess(`User "${username}" has been deleted successfully`);
        loadData(); // Reload the user list
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      if (error.response?.status === 403) {
        showError('Access denied: You cannot delete this user');
      } else if (error.response?.status === 400) {
        showError(error.response.data.error || 'Cannot delete this user');
      } else {
        showError('Failed to delete user');
      }
    }
  };

  const handleRoleAssignment = async () => {
    if (!selectedUser || selectedRoles.length === 0) {
      showError('Please select user and roles');
      return;
    }

    try {
      console.log('Starting role assignment:', {
        user: selectedUser.admin_id,
        roles: selectedRoles,
        expiryDate: roleExpiryDate
      });

      // Tek tek rol ataması yap (bulk operations yerine)
      const results = [];
      for (const roleId of selectedRoles) {
        try {
          console.log(`Assigning role ${roleId} to user ${selectedUser.admin_id}`);
          
          const result = await apiService.rbacAssignRole(
            selectedUser.admin_id, 
            parseInt(roleId), // roleId'yi integer'a çevir
            roleExpiryDate || null
          );
          
          console.log('Role assignment result:', result.data);
          results.push({ roleId, success: true, result: result.data });
        } catch (error) {
          console.error(`Failed to assign role ${roleId}:`, error);
          results.push({ 
            roleId, 
            success: false, 
            error: error.response?.data?.error || error.message 
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      if (successful > 0) {
        showSuccess(`${successful} roles assigned successfully${failed > 0 ? `, ${failed} failed` : ''}`);
      } else {
        showError(`All role assignments failed`);
      }
      
      // Modal'ı kapat ve data'yı yenile
      setShowRoleModal(false);
      setSelectedUser(null);
      setSelectedRoles([]);
      setRoleExpiryDate('');
      loadData();
      
    } catch (error) {
      console.error('Role assignment error:', error);
      showError('Failed to assign roles: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRoleRemoval = async (userId, roleId) => {
    try {
      const result = await apiService.rbacRemoveRole(userId, roleId);
      
      if (result.data.success) {
        showSuccess('Role removed successfully');
        loadData();
      }
    } catch (error) {
      console.error('Error removing role:', error);
      showError('Failed to remove role');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (!hasPermission('users', 'create')) {
      showError('You do not have permission to create users');
      return;
    }

    try {
      const userData = {
        ...newUser,
        department: departmentFilter || newUser.department
      };

      // This would need to be implemented in the backend
      const result = await apiService.createAdminUser(userData);
      
      if (result.data.success) {
        showSuccess('User created successfully');
        setShowCreateModal(false);
        setNewUser({
          username: '',
          full_name: '',
          email: '',
          department: departmentFilter || '',
          password: ''
        });
        loadData();
      }
    } catch (error) {
      console.error('Error creating user:', error);
      showError('Failed to create user');
    }
  };

  const handleToggleSuperAdmin = async (userId, currentStatus) => {
    if (!isSuperAdmin()) {
      showError('Only super admins can modify super admin status');
      return;
    }

    try {
      const result = await apiService.rbacUpdateSuperAdminStatus(userId, !currentStatus);
      
      if (result.data.success) {
        showSuccess(`Super admin status ${!currentStatus ? 'granted' : 'revoked'}`);
        loadData();
      }
    } catch (error) {
      console.error('Error updating super admin status:', error);
      showError('Failed to update super admin status');
    }
  };

  // Filter users based on search and filters
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = !filterDepartment || user.department === filterDepartment;
    
    const matchesRole = !filterRole || user.roles.includes(filterRole);
    
    return matchesSearch && matchesDepartment && matchesRole;
  });

  // Pagination helpers
  const getPaginatedData = (data, page, itemsPerPage) => {
    const startIndex = (page - 1) * itemsPerPage;
    return data.slice(startIndex, startIndex + itemsPerPage);
  };

  const getTotalPages = (dataLength, itemsPerPage) => {
    return Math.ceil(dataLength / itemsPerPage);
  };

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
                borderColor: isDark ? '#4a5568' : '#e2e8f0',
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
                    : (isDark ? '#4a5568' : '#e2e8f0'),
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
                borderColor: isDark ? '#4a5568' : '#e2e8f0',
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

  const getDepartments = () => {
    const departments = [...new Set(users.map(user => user.department))];
    return departments.filter(Boolean);
  };

  const cardStyle = {
    backgroundColor: isDark ? '#000000' : '#ffffff',
    borderColor: isDark ? '#4a5568' : '#e2e8f0',
    color: isDark ? '#ffffff' : '#000000'
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status"></div>
        <p className={`mt-3 ${isDark ? 'text-light' : 'text-dark'}`}>
          Loading users...
        </p>
      </div>
    );
  }

  const totalPages = getTotalPages(filteredUsers.length, itemsPerPage);
  const paginatedUsers = getPaginatedData(filteredUsers, currentPage, itemsPerPage);

  return (
    <div>
      <ConfirmationModal {...confirmationState} />

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className={isDark ? 'text-light' : 'text-dark'}>
            User Management
            {departmentFilter && (
              <span className="badge bg-info ms-2">{departmentFilter}</span>
            )}
          </h3>
          <p className={isDark ? 'text-light' : 'text-muted'}>
            Manage user accounts and role assignments
          </p>
        </div>
        
        {hasPermission('users', 'create') && (
          <button 
            className="btn btn-danger"
            onClick={() => setShowCreateModal(true)}
          >
            Create User
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="row mb-4">
        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              backgroundColor: isDark ? '#000000' : '#ffffff',
              borderColor: isDark ? '#4a5568' : '#cbd5e0',
              color: isDark ? '#ffffff' : '#000000'
            }}
          />
        </div>

        {isSuperAdmin() && (
          <div className="col-md-4">
            <select
              className="form-select"
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              style={{
                backgroundColor: isDark ? '#000000' : '#ffffff',
                borderColor: isDark ? '#4a5568' : '#cbd5e0',
                color: isDark ? '#ffffff' : '#000000'
              }}
            >
              <option value="">All Departments</option>
              {getDepartments().map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        )}
        
        <div className="col-md-4">
          <select
            className="form-select"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{
              backgroundColor: isDark ? '#000000' : '#ffffff',
              borderColor: isDark ? '#4a5568' : '#cbd5e0',
              color: isDark ? '#ffffff' : '#000000'
            }}
          >
            <option value="">All Roles</option>
            {roles.map(role => (
              <option key={role.role_id} value={role.role_name}>{role.display_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={cardStyle}>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead className={isDark ? 'table-dark' : 'table-light'}>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4">
                      <div className={`text-muted ${isDark ? 'text-light' : ''}`}>
                        <h5>No users found</h5>
                        <p>No users match your current filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.admin_id} className={isDark ? 'text-light' : ''}>
                      <td>
                        <div>
                          <div className="fw-semibold">
                            {user.full_name || user.username}
                          </div>
                          <small className={isDark ? 'text-light' : 'text-muted'}>
                            @{user.username}
                          </small>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        <span className="badge bg-secondary">
                          {user.department}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {user.roles && user.roles.length > 0 ? (
                            user.role_display_names.slice(0, 2).map((roleName, index) => (
                              <span key={index} className="badge bg-primary">
                                {roleName}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted">No roles</span>
                          )}
                          {user.role_display_names && user.role_display_names.length > 2 && (
                            <span className="badge bg-secondary">
                              +{user.role_display_names.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex flex-column gap-1">
                          {user.is_super_admin && (
                            <span className="badge bg-danger">Super Admin</span>
                          )}
                          <span className={`badge ${user.is_active ? 'bg-success' : 'bg-secondary'}`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="btn-group" role="group">
                          {hasPermission('users', 'manage_roles') && (
                            <button 
                              className="btn btn-outline-info btn-sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowRoleModal(true);
                              }}
                            >
                              Manage Roles
                            </button>
                          )}
                          
                          {isSuperAdmin() && user.admin_id !== admin.admin_id && (
                            <button 
                              className="btn btn-outline-warning btn-sm"
                              onClick={() => handleToggleSuperAdmin(user.admin_id, user.is_super_admin)}
                            >
                              {user.is_super_admin ? 'Revoke Super' : 'Make Super'}
                            </button>
                          )}

                          {hasPermission('users', 'delete') && user.admin_id !== admin.admin_id && (
                            <button 
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleDeleteUser(
                                user.admin_id, 
                                user.username, 
                                user.full_name
                              )}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <PaginationComponent 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* Role Assignment Modal */}
      {showRoleModal && selectedUser && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content" style={cardStyle}>
              <div className="modal-header">
                <h5 className="modal-title">
                  Manage Roles - {selectedUser.full_name || selectedUser.username}
                </h5>
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={() => {
                    setShowRoleModal(false);
                    setSelectedUser(null);
                    setSelectedRoles([]);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                {/* Current Roles */}
                <div className="mb-4">
                  <h6 className={isDark ? 'text-light' : 'text-dark'}>Current Roles</h6>
                  {selectedUser.roles && selectedUser.roles.length > 0 ? (
                    <div className="d-flex flex-wrap gap-2">
                      {selectedUser.role_display_names.map((roleName, index) => (
                        <div key={index} className="d-flex align-items-center">
                          <span className="badge bg-primary me-1">{roleName}</span>
                          {hasPermission('users', 'manage_roles') && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => {
                                const roleId = roles.find(r => r.display_name === roleName)?.role_id;
                                if (roleId) {
                                  handleRoleRemoval(selectedUser.admin_id, roleId);
                                }
                              }}
                              title="Remove role"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={isDark ? 'text-light' : 'text-muted'}>No roles assigned</p>
                  )}
                </div>

                {/* Assign New Roles */}
                {hasPermission('users', 'manage_roles') && (
                  <div>
                    <h6 className={isDark ? 'text-light' : 'text-dark'}>Assign New Roles</h6>
                    
                    <div className="mb-3">
                      <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                        Select Roles
                      </label>
                      <select
                        multiple
                        className="form-select"
                        value={selectedRoles}
                        onChange={(e) => setSelectedRoles(Array.from(e.target.selectedOptions, option => option.value))}
                        style={{
                          backgroundColor: isDark ? '#000000' : '#ffffff',
                          borderColor: isDark ? '#4a5568' : '#cbd5e0',
                          color: isDark ? '#ffffff' : '#000000'
                        }}
                      >
                        {roles
                          .filter(role => !selectedUser.roles.includes(role.role_name))
                          .map(role => (
                            <option key={role.role_id} value={role.role_id}>
                              {role.display_name}
                              {role.is_system_role && ' (System)'}
                            </option>
                          ))}
                      </select>
                      <small className={isDark ? 'text-light' : 'text-muted'}>
                        Hold Ctrl/Cmd to select multiple roles
                      </small>
                    </div>

                    <div className="mb-3">
                      <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                        Expiry Date (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={roleExpiryDate}
                        onChange={(e) => setRoleExpiryDate(e.target.value)}
                        style={{
                          backgroundColor: isDark ? '#000000' : '#ffffff',
                          borderColor: isDark ? '#4a5568' : '#cbd5e0',
                          color: isDark ? '#ffffff' : '#000000'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowRoleModal(false);
                    setSelectedUser(null);
                    setSelectedRoles([]);
                  }}
                >
                  Cancel
                </button>
                {hasPermission('users', 'manage_roles') && (
                  <button 
                    type="button" 
                    className="btn btn-danger"
                    onClick={handleRoleAssignment}
                    disabled={selectedRoles.length === 0}
                  >
                    Assign Roles
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && hasPermission('users', 'create') && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content" style={cardStyle}>
              <div className="modal-header">
                <h5 className="modal-title">Create New User</h5>
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={() => setShowCreateModal(false)}
                ></button>
              </div>
              <form onSubmit={handleCreateUser}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                      Username *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={newUser.username}
                      onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                      required
                      style={{
                        backgroundColor: isDark ? '#000000' : '#ffffff',
                        borderColor: isDark ? '#4a5568' : '#cbd5e0',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    />
                  </div>

                  <div className="mb-3">
                    <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={newUser.full_name}
                      onChange={(e) => setNewUser({...newUser, full_name: e.target.value})}
                      required
                      style={{
                        backgroundColor: isDark ? '#000000' : '#ffffff',
                        borderColor: isDark ? '#4a5568' : '#cbd5e0',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    />
                  </div>

                  <div className="mb-3">
                    <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                      Email *
                    </label>
                    <input
                      type="email"
                      className="form-control"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      required
                      style={{
                        backgroundColor: isDark ? '#000000' : '#ffffff',
                        borderColor: isDark ? '#4a5568' : '#cbd5e0',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    />
                  </div>

                  {!departmentFilter && isSuperAdmin() && (
                    <div className="mb-3">
                      <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                        Department *
                      </label>
                      <select
                        className="form-select"
                        value={newUser.department}
                        onChange={(e) => setNewUser({...newUser, department: e.target.value})}
                        required
                        style={{
                          backgroundColor: isDark ? '#000000' : '#ffffff',
                          borderColor: isDark ? '#4a5568' : '#cbd5e0',
                          color: isDark ? '#ffffff' : '#000000'
                        }}
                      >
                        <option value="">Select Department</option>
                        <option value="Accounting">Accounting</option>
                        <option value="Academic">Academic</option>
                        <option value="Student Affairs">Student Affairs</option>
                        <option value="Dormitory">Dormitory</option>
                        <option value="Campus Services">Campus Services</option>
                      </select>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                      Password *
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      required
                      minLength="6"
                      style={{
                        backgroundColor: isDark ? '#000000' : '#ffffff',
                        borderColor: isDark ? '#4a5568' : '#cbd5e0',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    />
                    <small className={isDark ? 'text-light' : 'text-muted'}>
                      Minimum 6 characters
                    </small>
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
                  <button type="submit" className="btn btn-danger">
                    Create User
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

export default UserManagementPage;