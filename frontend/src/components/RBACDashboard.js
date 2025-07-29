// frontend/src/components/RBACDashboard.js
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { apiService } from '../services/api';

const RBACDashboard = () => {
  const { admin, isSuperAdmin } = useAdminAuth();
  const { isDark } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [users, setUsers] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    if (isSuperAdmin()) {
      loadRBACData();
    }
  }, [isSuperAdmin]);

  const loadRBACData = async () => {
    try {
      setLoading(true);
      
      const [statsRes, rolesRes, permissionsRes, usersRes, auditRes] = await Promise.all([
        apiService.rbacGetStatistics(),
        apiService.rbacGetAllRoles(),
        apiService.rbacGetAllPermissions(),
        apiService.rbacGetUsersWithRoles(),
        apiService.rbacGetAuditLog({ limit: 10 })
      ]);

      if (statsRes.data.success) setStatistics(statsRes.data.data);
      if (rolesRes.data.success) setRoles(rolesRes.data.data);
      if (permissionsRes.data.success) setPermissions(permissionsRes.data.data);
      if (usersRes.data.success) setUsers(usersRes.data.data);
      if (auditRes.data.success) setAuditLog(auditRes.data.data);

    } catch (error) {
      console.error('Error loading RBAC data:', error);
      showError('Failed to load RBAC data');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (action, params) => {
    try {
      switch (action) {
        case 'create_test_notification':
          const result = await apiService.createTestNotification();
          if (result.success) {
            showSuccess('Test notification created successfully');
          }
          break;
        case 'refresh_rbac_cache':
          apiService.rbacCache.clearAll();
          await loadRBACData();
          showSuccess('RBAC cache refreshed');
          break;
        case 'bulk_assign_roles':
          showInfo('Bulk role assignment feature - redirect to User Management');
          break;
        default:
          showInfo(`Action ${action} not implemented yet`);
      }
    } catch (error) {
      console.error('Quick action error:', error);
      showError(`Failed to execute ${action}`);
    }
  };

  if (!isSuperAdmin()) {
    return (
      <div className="alert alert-warning">
        <h5>🔒 Access Denied</h5>
        <p>RBAC Dashboard is only available for Super Administrators.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status"></div>
        <p className={`mt-3 ${isDark ? 'text-light' : 'text-dark'}`}>
          Loading RBAC Dashboard...
        </p>
      </div>
    );
  }

  const cardStyle = {
    backgroundColor: isDark ? '#000000' : '#ffffff',
    borderColor: isDark ? '#333333' : '#dee2e6',
    color: isDark ? '#ffffff' : '#000000'
  };

  return (
    <div>
      {/* RBAC Dashboard Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className={isDark ? 'text-light' : 'text-dark'}>
            🛡️ RBAC Management Dashboard
          </h3>
          <p className={isDark ? 'text-light' : 'text-muted'}>
            Role-Based Access Control system overview and management
          </p>
        </div>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleQuickAction('refresh_rbac_cache')}
          >
            🔄 Refresh Cache
          </button>
          <button 
            className="btn btn-outline-info btn-sm"
            onClick={() => handleQuickAction('create_test_notification')}
          >
            🧪 Test Notification
          </button>
        </div>
      </div>

      {/* Section Navigation */}
      <ul className="nav nav-pills mb-4">
        <li className="nav-item">
          <button 
            className={`nav-link ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveSection('overview')}
          >
            📊 Overview
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeSection === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveSection('roles')}
          >
            🎭 Roles
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeSection === 'permissions' ? 'active' : ''}`}
            onClick={() => setActiveSection('permissions')}
          >
            🔐 Permissions
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeSection === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveSection('audit')}
          >
            📋 Audit Log
          </button>
        </li>
      </ul>

      {/* Content Sections */}
      {activeSection === 'overview' && (
        <div>
          {/* Statistics Overview */}
          {statistics && (
            <div className="row mb-4">
              <div className="col-md-3 mb-3">
                <div className="card" style={cardStyle}>
                  <div className="card-body text-center">
                    <div className="h2 text-primary mb-1">{statistics.general.total_users}</div>
                    <div className={isDark ? 'text-light' : 'text-muted'}>Total Users</div>
                  </div>
                </div>
              </div>
              <div className="col-md-3 mb-3">
                <div className="card" style={cardStyle}>
                  <div className="card-body text-center">
                    <div className="h2 text-success mb-1">{statistics.general.total_roles}</div>
                    <div className={isDark ? 'text-light' : 'text-muted'}>Total Roles</div>
                  </div>
                </div>
              </div>
              <div className="col-md-3 mb-3">
                <div className="card" style={cardStyle}>
                  <div className="card-body text-center">
                    <div className="h2 text-info mb-1">{statistics.general.total_permissions}</div>
                    <div className={isDark ? 'text-light' : 'text-muted'}>Total Permissions</div>
                  </div>
                </div>
              </div>
              <div className="col-md-3 mb-3">
                <div className="card" style={cardStyle}>
                  <div className="card-body text-center">
                    <div className="h2 text-warning mb-1">{statistics.general.super_admin_count}</div>
                    <div className={isDark ? 'text-light' : 'text-muted'}>Super Admins</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Role Distribution */}
          <div className="row">
            <div className="col-md-6 mb-4">
              <div className="card" style={cardStyle}>
                <div className="card-header">
                  <h5 className="mb-0">🎭 Role Distribution</h5>
                </div>
                <div className="card-body">
                  {statistics?.role_statistics?.map((role) => (
                    <div key={role.role_name} className="d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <span className={`fw-bold ${isDark ? 'text-light' : 'text-dark'}`}>
                          {role.display_name}
                        </span>
                        <br />
                        <small className={isDark ? 'text-light' : 'text-muted'}>
                          {role.permission_count} permissions
                        </small>
                      </div>
                      <span className={`badge ${apiService.rbacHelpers.getRoleColor(role.role_name) === 'danger' ? 'bg-danger' : 'bg-primary'}`}>
                        {role.user_count} users
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-md-6 mb-4">
              <div className="card" style={cardStyle}>
                <div className="card-header">
                  <h5 className="mb-0">📊 Department Statistics</h5>
                </div>
                <div className="card-body">
                  {statistics?.department_statistics?.map((dept) => (
                    <div key={dept.department} className="d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <span className={`fw-bold ${isDark ? 'text-light' : 'text-dark'}`}>
                          {dept.department}
                        </span>
                        <br />
                        <small className={isDark ? 'text-light' : 'text-muted'}>
                          {dept.unique_roles} unique roles
                        </small>
                      </div>
                      <span className="badge bg-info">
                        {dept.admin_count} admins
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Permission Resources */}
          <div className="row">
            <div className="col-12">
              <div className="card" style={cardStyle}>
                <div className="card-header">
                  <h5 className="mb-0">🔐 Permission Resources</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    {statistics?.permission_statistics?.map((resource) => (
                      <div key={resource.resource} className="col-md-4 mb-3">
                        <div 
                          className="p-3 rounded-3"
                          style={{ 
                            backgroundColor: isDark ? '#111111' : '#f8f9fa',
                            border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
                          }}
                        >
                          <div className="d-flex align-items-center">
                            <span className="me-2" style={{ fontSize: '1.5rem' }}>
                              {apiService.rbacHelpers.getPermissionIcon(resource.resource)}
                            </span>
                            <div>
                              <div className={`fw-bold ${isDark ? 'text-light' : 'text-dark'}`}>
                                {resource.resource}
                              </div>
                              <small className={isDark ? 'text-light' : 'text-muted'}>
                                {resource.permission_count} permissions
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'roles' && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className={isDark ? 'text-light' : 'text-dark'}>System Roles</h4>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => showInfo('Create Role feature - redirect to Role Management')}
            >
              ➕ Create Role
            </button>
          </div>
          
          <div className="row">
            {roles.map((role) => (
              <div key={role.role_id} className="col-md-6 mb-3">
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
                          {role.description || 'No description available'}
                        </p>
                        <div className="d-flex gap-2">
                          <small className="badge bg-info">
                            {role.permission_count} permissions
                          </small>
                          <small className="badge bg-success">
                            {role.user_count} users
                          </small>
                        </div>
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
                            <button className="dropdown-item" onClick={() => showInfo('View permissions')}>
                              👀 View Permissions
                            </button>
                          </li>
                          <li>
                            <button className="dropdown-item" onClick={() => showInfo('Edit role')}>
                              ✏️ Edit Role
                            </button>
                          </li>
                          {!role.is_system_role && (
                            <li>
                              <button className="dropdown-item text-danger" onClick={() => showInfo('Delete role')}>
                                🗑️ Delete Role
                              </button>
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'permissions' && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className={isDark ? 'text-light' : 'text-dark'}>System Permissions</h4>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => showInfo('Create Permission feature - redirect to Permission Management')}
            >
              ➕ Create Permission
            </button>
          </div>

          {Object.keys(permissions).map((resource) => (
            <div key={resource} className="card mb-3" style={cardStyle}>
              <div className="card-header">
                <h5 className="mb-0">
                  {apiService.rbacHelpers.getPermissionIcon(resource)} {resource.toUpperCase()}
                  <span className="badge bg-secondary ms-2">
                    {permissions[resource].length} permissions
                  </span>
                </h5>
              </div>
              <div className="card-body">
                <div className="row">
                  {permissions[resource].map((permission) => (
                    <div key={permission.permission_id} className="col-md-6 mb-2">
                      <div 
                        className="p-2 rounded"
                        style={{ 
                          backgroundColor: isDark ? '#111111' : '#f8f9fa',
                          border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <strong className={isDark ? 'text-light' : 'text-dark'}>
                              {permission.display_name}
                            </strong>
                            <br />
                            <small className={isDark ? 'text-light' : 'text-muted'}>
                              {permission.resource}:{permission.action}
                            </small>
                          </div>
                          {permission.is_system_permission && (
                            <span className="badge bg-warning text-dark">System</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSection === 'audit' && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className={isDark ? 'text-light' : 'text-dark'}>Recent RBAC Activity</h4>
            <button 
              className="btn btn-outline-secondary btn-sm"
              onClick={loadRBACData}
            >
              🔄 Refresh
            </button>
          </div>

          <div className="card" style={cardStyle}>
            <div className="card-body">
              {auditLog.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>User</th>
                        <th>Role</th>
                        <th>Action</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLog.map((log, index) => (
                        <tr key={index}>
                          <td>
                            <small>
                              {new Date(log.assigned_at).toLocaleDateString()}<br />
                              {new Date(log.assigned_at).toLocaleTimeString()}
                            </small>
                          </td>
                          <td>
                            <strong>{log.target_username}</strong>
                          </td>
                          <td>
                            <span className="badge bg-info">
                              {log.role_name}
                            </span>
                          </td>
                          <td>
                            Role Assignment
                          </td>
                          <td>
                            <span className={`badge ${log.is_active ? 'bg-success' : 'bg-danger'}`}>
                              {log.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className={isDark ? 'text-light' : 'text-muted'}>
                    No recent RBAC activity found
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions Section */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card" style={cardStyle}>
            <div className="card-header">
              <h5 className="mb-0">⚡ Quick Actions</h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-3 mb-2">
                  <button 
                    className="btn btn-outline-primary w-100"
                    onClick={() => handleQuickAction('bulk_assign_roles')}
                  >
                    👥 Bulk Assign Roles
                  </button>
                </div>
                <div className="col-md-3 mb-2">
                  <button 
                    className="btn btn-outline-info w-100"
                    onClick={() => handleQuickAction('export_rbac_data')}
                  >
                    📊 Export RBAC Data
                  </button>
                </div>
                <div className="col-md-3 mb-2">
                  <button 
                    className="btn btn-outline-warning w-100"
                    onClick={() => handleQuickAction('validate_permissions')}
                  >
                    🔍 Validate Permissions
                  </button>
                </div>
                <div className="col-md-3 mb-2">
                  <button 
                    className="btn btn-outline-success w-100"
                    onClick={() => handleQuickAction('create_test_notification')}
                  >
                    🧪 Test Notification
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RBACDashboard;