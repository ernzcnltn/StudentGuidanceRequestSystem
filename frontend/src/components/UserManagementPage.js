// frontend/src/components/UserManagementPage.js
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { apiService } from '../services/api';
import { useConfirmation } from '../hooks/useConfirmation';
import ConfirmationModal from './ConfirmationModal';
import { useTranslation } from '../hooks/useTranslation';


const UserManagementPage = ({ departmentFilter = null }) => {
  const { admin, isSuperAdmin, isDepartmentAdmin, hasPermission } = useAdminAuth();
  const { isDark } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { confirmationState, showConfirmation } = useConfirmation();
const { t, translateDbText } = useTranslation();

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
    password: '',
    roles: []
  });

  // Role assignment state
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [roleExpiryDate, setRoleExpiryDate] = useState('');

  // Department translation helper
  const translateDepartment = (department) => {
    const departmentTranslations = {
      'Accounting': t('accounting'),
      'Academic': t('academic'),
      'Student Affairs': t('studentaffairs'),
      'Dormitory': t('dormitory'),
      'Campus Services': t('campusservices')
    };
    return departmentTranslations[department] || department;
  };

  // Role translation helper
  const translateRole = (roleName) => {
    return translateDbText(roleName, 'roles');
  };

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
showError(t('failedToLoadUsers'));
      }
      
      // Handle roles response
      if (rolesRes.status === 'fulfilled' && rolesRes.value?.data?.success) {
        setRoles(rolesRes.value.data.data || []);
        console.log('Roles loaded:', rolesRes.value.data.data?.length || 0);
      } else {
        console.error('Failed to load roles:', rolesRes.reason);
        setRoles([]);
showError(t('failedToLoadRoles'));
      }

    } catch (error) {
      console.error('Error loading user data:', error);
showError(t('failedToLoadUserData'));
      setUsers([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username, fullName) => {
    // Güvenlik kontrolü
    if (userId === admin.admin_id) {
showError(t('cannotDeleteOwnAccount'));
      return;
    }

    // Modern confirmation dialog
    const confirmed = await showConfirmation({
      title: t('deleteUserAccount'),
      message: t('deleteUserConfirmation', { user: fullName || username }),
      type: 'danger',
      confirmText: t('deleteUser'),
      cancelText: t('cancel'),
      requireTextConfirmation: true,
      confirmationText: 'DELETE'
    });

    if (!confirmed) return;

    try {
      const result = await apiService.deleteAdminUser(userId);
      
      if (result.data.success) {
showSuccess(t('userDeletedSuccessfully', { username }));
        loadData(); // Reload the user list
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      if (error.response?.status === 403) {
showError(t('accessDeniedCannotDeleteUser'));
      } else if (error.response?.status === 400) {
showError(error.response.data.error || t('cannotDeleteThisUser'));
      } else {
showError(t('failedToDeleteUser'));
      }
    }
  };

  const handleRoleAssignment = async () => {
    if (!selectedUser || selectedRoles.length === 0) {
showError(t('pleaseSelectUserAndRoles'));
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
showSuccess(t('rolesAssignedSuccessfully', { successful, failed: failed > 0 ? `, ${failed} failed` : '' }));
      } else {
showError(t('allRoleAssignmentsFailed'));
      }
      
      // Modal'ı kapat ve data'yı yenile
      setShowRoleModal(false);
      setSelectedUser(null);
      setSelectedRoles([]);
      setRoleExpiryDate('');
      loadData();
      
    } catch (error) {
      console.error('Role assignment error:', error);
showError(t('failedToAssignRoles') + ': ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRoleRemoval = async (userId, roleId) => {
    try {
      const result = await apiService.rbacRemoveRole(userId, roleId);
      
      if (result.data.success) {
showSuccess(t('roleRemovedSuccessfully'));
        loadData();
      }
    } catch (error) {
      console.error('Error removing role:', error);
showError(t('failedToRemoveRole'));
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (!hasPermission('users', 'create')) {
showError(t('noPermissionCreateUsers'));
      return;
    }

    try {
      const userData = {
        ...newUser,
        department: departmentFilter || newUser.department
      };

      // Create user first
      const result = await apiService.createAdminUser(userData);
      
      if (result.data.success) {
        const newUserId = result.data.admin_id;
        
        // Assign roles if any selected
        if (newUser.roles && newUser.roles.length > 0) {
          for (const roleId of newUser.roles) {
            try {
              await apiService.rbacAssignRole(newUserId, parseInt(roleId), null);
            } catch (roleError) {
              console.error('Error assigning role during user creation:', roleError);
            }
          }
        }
        
        showSuccess(t('userCreatedSuccessfully'));
        setShowCreateModal(false);
        setNewUser({
          username: '',
          full_name: '',
          email: '',
          department: departmentFilter || '',
          password: '',
          roles: []
        });
        loadData();
      }
    } catch (error) {
      console.error('Error creating user:', error);
showError(t('failedToCreateUser'));
    }
  };

  const handleToggleSuperAdmin = async (userId, currentStatus) => {
    if (!isSuperAdmin()) {
showError(t('onlySuperAdminsCanModify'));
      return;
    }

    try {
      const result = await apiService.rbacUpdateSuperAdminStatus(userId, !currentStatus);
      
      if (result.data.success) {
showSuccess(t('superAdminStatusUpdated', { status: !currentStatus ? t('granted') : t('revoked') }));
        loadData();
      }
    } catch (error) {
      console.error('Error updating super admin status:', error);
showError(t('failedToUpdateSuperAdminStatus'));
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
              {t('previous')}

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
          {t('next')}
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
{t('loadingUsers')}
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
{t('userManagement')}
            {departmentFilter && (
              <span className="badge bg-info ms-2">{translateDepartment(departmentFilter)}</span>
            )}
          </h3>
          <p className={isDark ? 'text-light' : 'text-muted'}>
{t('manageUserAccountsAndRoles')}
          </p>
        </div>
        
        {hasPermission('users', 'create') && (
          <button 
            className="btn btn-danger"
            onClick={() => setShowCreateModal(true)}
          >
{t('createUser')}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="row mb-4">
        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder={t('search')}
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
              <option value="">{t('allDepartments')}</option>
              {getDepartments().map(dept => (
                <option key={dept} value={dept}>{translateDepartment(dept)}</option>
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
            <option value="">{t('allRoles')}</option>
            {roles.map(role => (
<option key={role.role_id} value={role.role_name}>{translateDbText(role.display_name, 'roleDisplayNames')}</option>
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
                  <th>{t('user')}</th>
                  <th>{t('email')}</th>
                  <th>{t('department')}</th>
                  <th>{t('roles')}</th>
                  
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4">
                      <div className={`text-muted ${isDark ? 'text-light' : ''}`}>
                        <h5>{t('noUsersFound')}</h5>
                        <p>{t('noUsersMatchFilters')}</p>
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
                        <span className="text">
                          {translateDepartment(user.department)}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {user.roles && user.roles.length > 0 ? (
                            user.role_display_names.slice(0, 2).map((roleName, index) => (
                              <span key={index} className="text">
    {translateDbText(roleName, 'roleDisplayNames')}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted">{t('noRoles')}</span>
                          )}
                          {user.role_display_names && user.role_display_names.length > 2 && (
                            <span className="badge bg-secondary">
                              +{user.role_display_names.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      
                      <td>
                        <div className="btn-group" role="group">
                          {hasPermission('users', 'manage_roles') && (
                            <button 
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowRoleModal(true);
                              }}
                            >
                              {t('manageRoles')}
                            </button>
                          )}
                          
                          {isSuperAdmin() && user.admin_id !== admin.admin_id && (
                            <button 
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleToggleSuperAdmin(user.admin_id, user.is_super_admin)}
                            >
                              {user.is_super_admin ? t('revokeSuper') : t('makeSuper')}
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
                              {t('delete')}

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
{t('manageRoles')} - {selectedUser.full_name || selectedUser.username}
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
                  <h6 className={isDark ? 'text-light' : 'text-dark'}>{t('currentRoles')}</h6>
                  {selectedUser.roles && selectedUser.roles.length > 0 ? (
                    <div className="d-flex flex-wrap gap-2">
                      {selectedUser.role_display_names.map((roleName, index) => (
                        <div key={index} className="d-flex align-items-center">
<span className="badge bg-primary me-1">{translateDbText(roleName, 'roleDisplayNames')}</span>
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
                    <p className={isDark ? 'text-light' : 'text-muted'}>{t('noRolesAssigned')}</p>
                  )}
                </div>

                {/* Assign New Roles */}
                {hasPermission('users', 'manage_roles') && (
                  <div>
                    <h6 className={isDark ? 'text-light' : 'text-dark'}>{t('assignNewRoles')}</h6>
                    
                    <div className="mb-3">
                      <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                       {t('selectRoles')}
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
  {translateDbText(role.display_name, 'roleDisplayNames')}
                              {role.is_system_role && ' (System)'}
                            </option>
                          ))}
                      </select>
                      <small className={isDark ? 'text-light' : 'text-muted'}>
                        {t('holdCtrlToSelectMultiple')}

                      </small>
                    </div>

                    <div className="mb-3">
                      <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                        {t('expiryDateOptional')}

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
                  {t('cancel')}

                </button>
                {hasPermission('users', 'manage_roles') && (
                  <button 
                    type="button" 
                    className="btn btn-danger"
                    onClick={handleRoleAssignment}
                    disabled={selectedRoles.length === 0}
                  >
                   {t('assignRoles')}

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
                <h5 className="modal-title">{t('createNewUser')}</h5>
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
                     {t('username')} *

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
                      {t('fullName')} *
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
                     {t('email')} *
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
                        {t('department')} *
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
                        <option value="">{t('selectDepartment')}</option>
                        <option value="Accounting">{t('accounting')}</option>
                        <option value="Academic">{t('academic')}</option>
                        <option value="Student Affairs">{t('studentaffairs')}</option>
                        <option value="Dormitory">{t('dormitory')}</option>
                        <option value="Campus Services">{t('campusservices')}</option>
                      </select>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                     {t('password')} *
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
                     {t('minimumSixCharacters')}
                    </small>
                  </div>

                  <div className="mb-3">
                    <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                      {t('roles')} ({t('optional')})
                    </label>
                    <select
                      multiple
                      className="form-select"
                      value={newUser.roles}
                      onChange={(e) => setNewUser({...newUser, roles: Array.from(e.target.selectedOptions, option => option.value)})}
                      style={{
                        backgroundColor: isDark ? '#000000' : '#ffffff',
                        borderColor: isDark ? '#4a5568' : '#cbd5e0',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    >
                      {roles.map(role => (
                        <option key={role.role_id} value={role.role_id}>
  {translateDbText(role.display_name, 'roleDisplayNames')}
                          {role.is_system_role && ' (System)'}
                        </option>
                      ))}
                    </select>
                    <small className={isDark ? 'text-light' : 'text-muted'}>
                      {t('holdCtrlToSelectMultiple')}
                    </small>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    {t('cancel')}
                  </button>
                  <button type="submit" className="btn btn-danger">
                    {t('createUser')}
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