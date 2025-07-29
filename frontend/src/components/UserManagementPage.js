// frontend/src/components/UserManagementPage.js
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { apiService } from '../services/api';

const UserManagementPage = ({ departmentFilter = null }) => {
  const { admin, isSuperAdmin, isDepartmentAdmin, hasPermission } = useAdminAuth();
  const { isDark } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState(departmentFilter || '');
  const [filterRole, setFilterRole] = useState('');
  
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
      
      const [usersRes, rolesRes] = await Promise.all([
        apiService.rbacGetUsersWithRoles(),
        apiService.rbacGetAllRoles()
      ]);

      if (usersRes.data.success) {
        let userData = usersRes.data.data;
        
        // Apply department filter if not super admin
        if (departmentFilter && !isSuperAdmin()) {
          userData = userData.filter(user => user.department === departmentFilter);
        }
        
        setUsers(userData);
      }
      
      if (rolesRes.data.success) {
        setRoles(rolesRes.data.data);
      }

    } catch (error) {
      console.error('Error loading user data:', error);
      showError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleAssignment = async () => {
    if (!selectedUser || selectedRoles.length === 0) {
      showError('Please select user and roles');
      return;
    }

    try {
      const assignments = selectedRoles.map(roleId => ({
        userId: selectedUser.admin_id,
        roleId: parseInt(roleId),
        expiresAt: roleExpiryDate || null
      }));

      const result = await apiService.rbacBatchOperations.bulkAssignRoles(assignments);
      
      if (result.data.success) {
        const { successful, failed } = result.data.data.summary;
        showSuccess(`${successful} roles assigned successfully. ${failed} failed.`);
        setShowRoleModal(false);
        setSelectedUser(null);
        setSelectedRoles([]);
        setRoleExpiryDate('');
        loadData();
      }
    } catch (error) {
      console.error('Error assigning roles:', error);
      showError('Failed to assign roles');
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

  const getDepartments = () => {
    const departments = [...new Set(users.map(user => user.department))];
    return departments.filter(Boolean);
  };

  const cardStyle = {
    backgroundColor: isDark ? '#000000' : '#ffffff',
    borderColor: isDark ? '#333333' : '#dee2e6',
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

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className={isDark ? 'text-light' : 'text-dark'}>
            👥 User Management
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
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            ➕ Create User
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
              borderColor: isDark ? '#333333' : '#ced4da',
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
                borderColor: isDark ? '#333333' : '#ced4da',
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
              borderColor: isDark ? '#333333' : '#ced4da',
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

      {/* Users List */}
      <div className="row">
        {filteredUsers.length === 0 ? (
          <div className="col-12">
            <div className="alert alert-info">
              <h5>No users found</h5>
              <p>No users match your current filters.</p>
            </div>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.admin_id} className="col-lg-6 mb-3">
              <div className="card" style={cardStyle}>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <h6 className={`card-title ${isDark ? 'text-light' : 'text-dark'}`}>
                        {user.full_name || user.username}
                        {user.is_super_admin && (
                          <span className="badge bg-danger ms-2">Super Admin</span>
                        )}
                        {!user.is_active && (
                          <span className="badge bg-secondary ms-2">Inactive</span>
                        )}
                      </h6>
                      
                      <p className={`card-text ${isDark ? 'text-light' : 'text-muted'}`}>
                        <strong>Username:</strong> {user.username}<br />
                        <strong>Email:</strong> {user.email}<br />
                        <strong>Department:</strong> {user.department}
                      </p>
                      
                      <div className="mb-2">
                        <strong className={isDark ? 'text-light' : 'text-dark'}>Roles:</strong>
                        <div className="mt-1">
                          {user.roles && user.roles.length > 0 ? (
                            user.role_display_names.map((roleName, index) => (
                              <span key={index} className="badge bg-primary me-1">
                                {roleName}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted">No roles assigned</span>
                          )}
                        </div>
                      </div>
                      
                      {user.last_role_update && (
                        <small className={isDark ? 'text-light' : 'text-muted'}>
                          Last updated: {apiService.rbacHelpers.formatLastUpdated(user.last_role_update)}
                        </small>
                      )}
                    </div>
                    
                    <div className="dropdown">
                      <button 
                        className="btn btn-outline-secondary btn-sm dropdown-toggle"
                        type="button"
                        data-bs-toggle="dropdown"
                        disabled={!hasPermission('users', 'manage_roles')}
                      >
                        Actions
                      </button>
                      <ul className="dropdown-menu">
                        {hasPermission('users', 'manage_roles') && (
                          <li>
                            <button 
                              className="dropdown-item"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowRoleModal(true);
                              }}
                            >
                              🎭 Manage Roles
                            </button>
                          </li>
                        )}
                        
                        {isSuperAdmin() && user.admin_id !== admin.admin_id && (
                          <li>
                            <button 
                              className="dropdown-item"
                              onClick={() => handleToggleSuperAdmin(user.admin_id, user.is_super_admin)}
                            >
                              {user.is_super_admin ? '⬇️ Revoke Super Admin' : '⬆️ Make Super Admin'}
                            </button>
                          </li>
                        )}
                        
                        <li>
                          <button 
                            className="dropdown-item"
                            onClick={() => showInfo('View user permissions')}
                          >
                            🔍 View Permissions
                          </button>
                        </li>
                        
                        {hasPermission('users', 'reset_password') && (
                          <li>
                            <button 
                              className="dropdown-item"
                              onClick={() => showInfo('Reset password feature')}
                            >
                              🔑 Reset Password
                            </button>
                          </li>
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
                          borderColor: isDark ? '#333333' : '#ced4da',
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
                          borderColor: isDark ? '#333333' : '#ced4da',
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
                    className="btn btn-primary"
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
                        borderColor: isDark ? '#333333' : '#ced4da',
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
                        borderColor: isDark ? '#333333' : '#ced4da',
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
                        borderColor: isDark ? '#333333' : '#ced4da',
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
                          borderColor: isDark ? '#333333' : '#ced4da',
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
                        borderColor: isDark ? '#333333' : '#ced4da',
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
                  <button type="submit" className="btn btn-primary">
                    Create User
                  </button>
                </div>
              </form>
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
                <div className="col-md-3">
                  <div className="h4 text-primary">{filteredUsers.length}</div>
                  <div className={isDark ? 'text-light' : 'text-muted'}>Total Users</div>
                </div>
                <div className="col-md-3">
                  <div className="h4 text-success">
                    {filteredUsers.filter(u => u.is_active).length}
                  </div>
                  <div className={isDark ? 'text-light' : 'text-muted'}>Active Users</div>
                </div>
                <div className="col-md-3">
                  <div className="h4 text-warning">
                    {filteredUsers.filter(u => u.is_super_admin).length}
                  </div>
                  <div className={isDark ? 'text-light' : 'text-muted'}>Super Admins</div>
                </div>
                <div className="col-md-3">
                  <div className="h4 text-info">
                    {filteredUsers.filter(u => u.roles && u.roles.length > 0).length}
                  </div>
                  <div className={isDark ? 'text-light' : 'text-muted'}>Users with Roles</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagementPage;