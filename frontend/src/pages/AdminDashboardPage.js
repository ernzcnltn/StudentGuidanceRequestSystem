import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from '../hooks/useTranslation';
import { apiService } from '../services/api';
import AttachmentViewer from '../components/AttachmentViewer';
import AdminResponseModal from '../components/AdminResponseModal';
import AdminNotificationCenter from '../components/AdminNotificationCenter';
import FIULogo from '../components/FIULogo';
import RequestRejectModal from '../components/RequestRejectModal';

import AdminStatisticsPage from '../components/AdminStatisticsPage';

import LanguageDropdown from '../components/LanguageDropdown';
import RoleManagementPage from '../components/RoleManagementPage';
import UserManagementPage from '../components/UserManagementPage';
import PermissionManagementPage from '../components/PermissionManagementPage';
import RBACDashboard from '../components/RBACDashboard';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { useToast } from '../contexts/ToastContext';

import { useConfirmation } from '../hooks/useConfirmation';
import ConfirmationModal from '../components/ConfirmationModal';



import AcademicCalendarManager from '../components/AcademicCalendarManager';


const AdminDashboardPage = () => {
  const [selectedRequestForResponse, setSelectedRequestForResponse] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const { 
    admin, 
    logout, 
    department, 
    hasPermission, 
    hasRole, 
    canAccessDepartment,
    canViewRequests,
    canManageRequests,
    canCreateResponses,
    canManageUsers,
    canViewAnalytics,
    canManageSettings,
    canManageRequestTypes,
    isSuperAdmin,
    isDepartmentAdmin,
    getAccessibleDepartments,
    

  } = useAdminAuth();
  
  const [showRejectModal, setShowRejectModal] = useState(false);
const [selectedRequestForReject, setSelectedRequestForReject] = useState(null);
const [rejectLoading, setRejectLoading] = useState(false);

  const { confirmationState, showConfirmation } = useConfirmation();
  const { isDark, toggleTheme } = useTheme();
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  const { t, translateRequestType } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [requests, setRequests] = useState([]);
  const [requestTypes, setRequestTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: 'Pending',
  });
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { showSuccess, showError, showInfo } = useToast();

const [showRejectionDetailsModal, setShowRejectionDetailsModal] = useState(false);
const [selectedRejectionDetails, setSelectedRejectionDetails] = useState(null);
const [rejectionDetailsLoading, setRejectionDetailsLoading] = useState(false);

  
  // Add Request Type Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTypeData, setNewTypeData] = useState({
    type_name: '',
    description_en: '',
    is_document_required: false
  });

  // RBAC Debug Info
  const [showRBACDebug, setShowRBACDebug] = useState(false);



  const handleLogoutClick = async () => {
    console.log('Logout button clicked!');
    
    const confirmed = await showConfirmation({
      title: ' Logout Confirmation',
      message: 'Are you sure you want to logout from the admin panel?',
      type: 'danger',
      confirmText: 'Logout',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      console.log('Logout confirmed');
      logout();
    }
  };

  // Rejection details fetch fonksiyonu
const fetchRejectionDetails = async (requestId) => {
  try {
    setRejectionDetailsLoading(true);
    const response = await apiService.getAdminRejectionDetails(requestId);
    
    if (response.data.success) {
      setSelectedRejectionDetails({
        requestId,
        ...response.data.data
      });
      setShowRejectionDetailsModal(true);
    }
  } catch (error) {
    console.error('Error fetching rejection details:', error);
    showError('Failed to load rejection details');
  } finally {
    setRejectionDetailsLoading(false);
  }
};

  // Admin Language Dropdown
  const AdminLanguageSelector = () => {
    return <LanguageDropdown variant="admin" />;
  };



  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    logout();
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const fetchDashboardData = useCallback(async () => {
    if (!canViewAnalytics()) {
      showError('You do not have permission to view analytics');
      return;
    }

    try {
       setLoading(true);
    // BU KONTROLÜ EKLE:
    const isPureSuperAdmin = isSuperAdmin() && !department;
    const dashboardParams = isPureSuperAdmin ? {} : { department };
    
    const response = await apiService.getAdminDashboard(dashboardParams);
    
    if (response.data && response.data.success) {
      setDashboardData(response.data.data);
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    if (error.response?.status === 403) {
      showError('Access denied: Insufficient permissions for dashboard');
    }
  } finally {
    setLoading(false);
  }
}, [canViewAnalytics, showError, department, isSuperAdmin]);

  const fetchRequests = useCallback(async () => {
    if (!canViewRequests()) {
      showError('You do not have permission to view requests');
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.getAdminRequests(filters);
      if (response.data && response.data.success) {
        const fetchedRequests = response.data.data || [];
        const sortedRequests = sortRequestsByPriorityAndStatus(fetchedRequests);
        setRequests(sortedRequests);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      if (error.response?.status === 403) {
        showError('Access denied: Insufficient permissions to view requests');
      }
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [filters, canViewRequests, showError]);

  const fetchRequestTypes = useCallback(async () => {
    if (!canManageSettings()) {
      showError('You do not have permission to manage settings');
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.getAdminRequestTypes();
      if (response.data && response.data.success) {
        setRequestTypes(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching request types:', error);
      if (error.response?.status === 403) {
        showError('Access denied: Insufficient permissions to manage request types');
      }
      setRequestTypes([]);
    } finally {
      setLoading(false);
    }
  }, [canManageSettings, showError]);

  const sortRequestsByPriorityAndStatus = (requests) => {
    return requests.sort((a, b) => {
      if (a.status === 'Completed' && b.status !== 'Completed') {
        return 1;
      }
      if (b.status === 'Completed' && a.status !== 'Completed') {
        return -1;
      }
      
      const priorityOrder = {
        'Urgent': 1,
        'High': 2,
        'Medium': 3,
        'Low': 4
      };
      
      const aPriority = priorityOrder[a.priority] || 3;
      const bPriority = priorityOrder[b.priority] || 3;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      const statusOrder = {
        'Pending': 1,
        'Informed': 2,
        'Completed': 3
      };
      
      const aStatus = statusOrder[a.status] || 2;
      const bStatus = statusOrder[b.status] || 2;
      
      if (aStatus !== bStatus) {
        return aStatus - bStatus;
      }
      
      return new Date(b.submitted_at) - new Date(a.submitted_at);
    });
  };

  // ADD THIS FUNCTION TO AdminDashboardPage component
const handleRejectRequest = async (rejectionReason) => {
  if (!selectedRequestForReject) {
    showError('No request selected for rejection');
    return;
  }

  try {
    setRejectLoading(true);
    
    console.log('🚫 Starting reject process:', {
      requestId: selectedRequestForReject.request_id,
      reasonLength: rejectionReason.length
    });
    
    const response = await apiService.rejectRequest(
      selectedRequestForReject.request_id, 
      { rejection_reason: rejectionReason }
    );
    
    console.log('✅ Reject response received:', response.data);
    
    if (response.data && response.data.success) {
      showSuccess(`Request #${selectedRequestForReject.request_id} rejected successfully`);
      setShowRejectModal(false);
      setSelectedRequestForReject(null);
      
      // Refresh the requests list
      if (typeof fetchRequests === 'function') {
        fetchRequests();
      }
    } else {
      throw new Error(response.data?.error || 'Unknown error occurred');
    }
    
  } catch (error) {
    console.error('❌ Error rejecting request:', error);
    
    let errorMessage = 'Failed to reject request. Please try again.';
    
    if (error.response?.status === 403) {
      errorMessage = 'Access denied: Insufficient permissions to reject requests';
    } else if (error.response?.status === 400) {
      errorMessage = error.response.data?.error || 'Invalid rejection request';
    } else if (error.response?.status === 404) {
      errorMessage = 'Request not found';
    } else if (error.message === 'Network error: Could not reach server') {
      errorMessage = 'Cannot connect to server. Please check your connection.';
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    }
    
    showError(errorMessage);
  } finally {
    setRejectLoading(false);
  }
};


  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboardData();
    } else if (activeTab === 'requests') {
      fetchRequests();
    } else if (activeTab === 'settings') {
      fetchRequestTypes();
    }
  }, [activeTab, fetchDashboardData, fetchRequests, fetchRequestTypes]);

  const updateRequestStatus = async (requestId, newStatus) => {
    if (!canManageRequests()) {
      showError('You do not have permission to manage requests');
      return;
    }

    try {
      await apiService.updateAdminRequestStatus(requestId, { 
        status: newStatus
      });
      
      fetchRequests();
      
      if (newStatus === 'Completed') {
        showSuccess(`✅ Request #${requestId} marked as completed`);
      } else {
        showSuccess(`📊 Request #${requestId} status updated to ${newStatus}`);
      }
    } catch (error) {
      console.error('Error updating request status:', error);
      if (error.response?.status === 403) {
        showError('Access denied: Insufficient permissions to update request status');
      } else {
        showError('Failed to update request status');
      }
    }
  };

  const toggleRequestType = async (typeId) => {
    if (!canManageRequestTypes()) {
      showError('You do not have permission to manage request types');
      return;
    }

    try {
      await apiService.toggleRequestType(typeId);
      fetchRequestTypes();
    } catch (error) {
      console.error('Error toggling request type:', error);
      if (error.response?.status === 403) {
        showError('Access denied: Insufficient permissions to toggle request type');
      } else {
        showError('Failed to toggle request type');
      }
    }
  };

  const handleNotificationClick = (requestId, type) => {
    if (!canViewRequests()) {
      showError('You do not have permission to view requests');
      return;
    }

    setActiveTab('requests');
    setFilters({ status: '' });
    
    setTimeout(() => {
      const requestElement = document.getElementById(`request-${requestId}`);
      if (requestElement) {
        requestElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        requestElement.style.backgroundColor = '#fff3cd';
        setTimeout(() => {
          requestElement.style.backgroundColor = '';
        }, 3000);
      }
    }, 300);
  };

  

  const handleAddRequestType = async (e) => {
    e.preventDefault();
    
    if (!canManageRequestTypes()) {
      showError('You do not have permission to add request types');
      return;
    }

    try {
      await apiService.addRequestType({
        ...newTypeData,
        category: department
      });
      
      setNewTypeData({
        type_name: '',
        description_en: '',
        is_document_required: false
      });
      setShowAddForm(false);
      fetchRequestTypes();
      showSuccess('Request type added successfully!');
    } catch (error) {
      console.error('Error adding request type:', error);
      if (error.response?.status === 403) {
        showError('Access denied: Insufficient permissions to add request type');
      } else {
        showError('Failed to add request type');
      }
    }
  };

  const refreshRequests = () => {
    if (!canViewRequests()) {
      showError('You do not have permission to view requests');
      return;
    }
    setFilters({ status: 'Pending' });
    fetchRequests();
  };

  const getStatusBadge = (status) => {
  const statusStyles = {
    'Pending': 'bg-warning text-dark',
    'Informed': 'bg-info text-white',
    'Completed': 'bg-success text-white',
    'Rejected': 'bg-danger text-white'  // ADD THIS LINE
  };
  return statusStyles[status] || 'bg-secondary text-white';
};

  const getPriorityBadge = (priority) => {
    const priorityStyles = {
      'Urgent': 'bg-danger text-white',
      'High': 'bg-warning text-dark', 
      'Medium': 'bg-info text-white',
      'Low': 'bg-secondary text-white'
    };
    return priorityStyles[priority] || 'bg-info text-white';
  };

  const getPriorityIcon = (priority) => {
    const icons = {
      'Urgent': '',
      'High': '',
      'Medium': '', 
      'Low': ''
    };
    return icons[priority] || '';
  };

  const getDepartmentIcon = (dept) => {
    const icons = {
      'Accounting': '',
      'Academic': '',
      'Dormitory': '',
      'Student Affairs': '',
      'Campus Services': ''
    };
    return icons[dept] || '';
  };

  // Tab visibility control based on permissions
  const getVisibleTabs = () => {
    const tabs = [];
    
    if (canViewAnalytics()) {
      tabs.push({ key: 'dashboard', label: ' Dashboard', icon: '' });
    }
    
    if (canViewRequests()) {
      tabs.push({ key: 'requests', label: ' Manage Requests', icon: '' });
    }
    


    if (canManageSettings()) {
      tabs.push({ key: 'settings', label: ' Settings', icon: '' });
    }



    

    // STATISTICS TAB - Department Admin ve Super Admin için
  if ((isDepartmentAdmin() || isSuperAdmin()) && canViewAnalytics()) {
    tabs.push({ 
      key: 'statistics', 
      label: ' Performance Stats', 
      icon: '',
     
    });
  }
    
    // RBAC Management Tabs (Super Admin only)
    if (isSuperAdmin()) {
     
      tabs.push({ key: 'users', label: ' Users', icon: '' });
      tabs.push({ key: 'roles', label: ' Roles', icon: '' });
      tabs.push({ key: 'permissions', label: ' Permissions', icon: '' });
    }
    
    // Department Admin can see user management for their department
    if (isDepartmentAdmin() && !isSuperAdmin()) {
      tabs.push({ key: 'dept-users', label: ' Dept Users', icon: '' });
    }
    
   

  // ⭐ YENİ TAB EKLE
  if (isSuperAdmin()) {
    tabs.push({ 
      key: 'calendar', 
      label: ' Academic Calendar', 
      icon: '' 
    });
  }

 


    return tabs;
  };

  // RBAC Debug Component
  const RBACDebugInfo = () => {
    if (!showRBACDebug) return null;
    
    return (
      <div className="card border-warning mb-4">
        <div className="card-header bg-warning text-dark">
          <h6 className="mb-0">🔍 RBAC Debug Information</h6>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              <h6>User Info:</h6>
              <ul className="list-unstyled">
                <li><strong>Username:</strong> {admin?.username}</li>
                <li><strong>Department:</strong> {admin?.department}</li>
                <li><strong>Super Admin:</strong> {admin?.is_super_admin ? 'Yes' : 'No'}</li>
                <li><strong>Admin ID:</strong> {admin?.admin_id}</li>
              </ul>
            </div>
            <div className="col-md-6">
              <h6>Permissions Check:</h6>
              <ul className="list-unstyled">
                <li>View Requests: {canViewRequests() ? '✅' : '❌'}</li>
                <li>Manage Requests: {canManageRequests() ? '✅' : '❌'}</li>
                <li>Create Responses: {canCreateResponses() ? '✅' : '❌'}</li>
                <li>Manage Users: {canManageUsers() ? '✅' : '❌'}</li>
                <li>View Analytics: {canViewAnalytics() ? '✅' : '❌'}</li>
                <li>Manage Settings: {canManageSettings() ? '✅' : '❌'}</li>
                <li>Manage Request Types: {canManageRequestTypes() ? '✅' : '❌'}</li>
              </ul>
            </div>
          </div>
          <div className="row mt-3">
            <div className="col-md-6">
              <h6>Role Checks:</h6>
              <ul className="list-unstyled">
                <li>Super Admin: {isSuperAdmin() ? '✅' : '❌'}</li>
                <li>Department Admin: {isDepartmentAdmin() ? '✅' : '❌'}</li>
              </ul>
            </div>
            <div className="col-md-6">
              <h6>Accessible Departments:</h6>
              <ul className="list-unstyled">
                {getAccessibleDepartments().map(dept => (
                  <li key={dept}>• {dept}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => (
    <div>
      <div className="row mb-4">
        <div className="col-12">
          <div 
            className="card border-0 shadow-sm" 
            style={{ 
              borderRadius: '12px',
              backgroundColor: isDark ? '#000000' : '#ffffff',
              border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
            }}
          >
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="text-danger mb-1">
                    {department} {t('dashboard')}
                  </h5>
                  <p className={`mb-0 ${isDark ? 'text-light' : 'text-muted'}`}>
                    {t('welcomeBack')}, {admin?.full_name || admin?.username}
                  </p>
                  {isSuperAdmin() && (
                    <small className="badge bg-danger">Super Admin</small>
                  )}
                  {isDepartmentAdmin() && !isSuperAdmin() && (
                    <small className="badge bg-primary">Department Admin</small>
                  )}
                </div>
                <div className="text-end">
                 
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <RBACDebugInfo />

      {loading ? (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status"></div>
        <p className={`mt-3 ${isDark ? 'text-light' : 'text-dark'}`}>
          {t('loading')} dashboard...
        </p>
      </div>
    ) : dashboardData && dashboardData.totals ? (
      <div className="row">
       
        
      </div>
    ) : (
      <div 
        className="card border-0 shadow-sm" 
        style={{ 
          borderRadius: '12px',
          backgroundColor: isDark ? '#000000' : '#ffffff',
          border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
        }}
      >
        <div className="card-body text-center p-5">
          <div className="text-danger mb-3" style={{ fontSize: '3rem' }}>⚠️</div>
          <h5 className={isDark ? 'text-light' : 'text-dark'}>
            {t('failedToLoadDashboard')}
          </h5>
          <p className={isDark ? 'text-light' : 'text-muted'}>
            {t('pleaseCheckConnection')}
          </p>
          <button className="btn btn-danger" onClick={fetchDashboardData}>
            🔄 {t('retry')}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderRequests = () => (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className={isDark ? 'text-light' : 'text-dark'}>
           {t('manageRequests')} - {department}
          {!canManageRequests() && (
            <small className="badge bg-warning ms-2">Read Only</small>
          )}
        </h3>
        
        <div className="d-flex gap-2">
          <select
            className="form-select form-select-sm"
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            style={{
              backgroundColor: isDark ? '#000000' : '#ffffff',
              borderColor: isDark ? '#333333' : '#ced4da',
              color: isDark ? '#ffffff' : '#000000'
            }}
          >
            <option value="">{t('allStatus')}</option>
            <option value="Pending">{t('pending')}</option>
            <option value="Informed">{t('informed')}</option>
            <option value="Completed">{t('completed')}</option>
            <option value="Rejected">{t('rejected', 'Rejected')}</option>
          </select>
          
          <button 
            className="btn btn-outline-primary btn-sm"
            onClick={refreshRequests}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                {t('loading')}...
              </>
            ) : (
              <>
                🔄 
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status"></div>
          <p className={isDark ? 'text-light' : 'text-dark'}>{t('loading')} requests...</p>
        </div>
      ) : (
        <div className="row">
          {!requests || requests.length === 0 ? (
            <div className="col-12 text-center py-5">
              <div 
                className="alert" 
                style={{
                  backgroundColor: isDark ? '#000000' : '#d1ecf1',
                  borderColor: isDark ? '#333333' : '#bee5eb',
                  color: isDark ? '#ffffff' : '#0c5460'
                }}
              >
                <h5 className={isDark ? 'text-light' : 'text-dark'}>{t('noRequests')}</h5>
                <p className={`mb-0 ${isDark ? 'text-light' : 'text-muted'}`}>
                  {filters.status 
                    ? `No ${filters.status.toLowerCase()} requests found for ${department} department.`
                    : `No requests have been submitted to ${department} department yet.`
                  }
                </p>
              </div>
            </div>
          ) : (
            requests.map((request) => (
              <div 
                key={request.request_id} 
                id={`request-${request.request_id}`}
                className="col-12 mb-3"
              >
                <div 
                  className="card"
                  style={{
                    backgroundColor: isDark ? '#000000' : '#ffffff',
                    borderColor: isDark ? '#333333' : '#dee2e6',
                    color: isDark ? '#ffffff' : '#000000'
                  }}
                >
                  <div 
                    className="card-header d-flex justify-content-between align-items-center"
                    style={{
                      backgroundColor: isDark ? '#111111' : '#f8f9fa',
                      borderColor: isDark ? '#333333' : '#dee2e6'
                    }}
                  >
                    <div>
                      <h6 className={`mb-1 ${isDark ? 'text-light' : 'text-dark'}`}>
                        {translateRequestType(request.type_name)}
                      </h6>
                      <small className={isDark ? 'text-light' : 'text-muted'}>
                        {request.student_name} ({request.student_number})
                      </small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge ${getPriorityBadge(request.priority)}`}>
                        {getPriorityIcon(request.priority)} {request.priority || 'Medium'}
                      </span>
                      
                      <span className={`badge ${getStatusBadge(request.status)}`}>
                        {t(request.status.toLowerCase())}
                      </span>
                    </div>
                  </div>
                  
                  <div className="card-body">
                    <p className={`mb-3 ${isDark ? 'text-light' : 'text-dark'}`}>
                      <strong>{t('content')}:</strong> {request.content}
                    </p>
                    
                    <div className="row text-sm mb-3">
                      <div className="col-md-4">
                        <strong className={isDark ? 'text-light' : 'text-dark'}>{t('studentEmail')}:</strong><br/>
                        <a 
                          href={`mailto:${request.student_email}`}
                          className={isDark ? 'text-info' : 'text-primary'}
                        >
                          {request.student_email}
                        </a>
                      </div>
                      <div className="col-md-4">
                        <strong className={isDark ? 'text-light' : 'text-dark'}>{t('submitted')}:</strong><br/>
                        <span className={isDark ? 'text-light' : 'text-muted'}>
                          {new Date(request.submitted_at).toLocaleDateString()} {new Date(request.submitted_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="col-md-4">
                        <strong className={isDark ? 'text-light' : 'text-dark'}>{t('attachments')}:</strong><br/>
                        <span className={request.attachment_count > 0 ? 'text-success' : (isDark ? 'text-light' : 'text-muted')}>
                          {request.attachment_count || 0} {t('files')}
                        </span>
                      </div>
                    </div>
                    
                {/* Rejection Details Button - Sadece rejected request'ler için */}
{request.status === 'Rejected' && (
  <button
    className="btn btn-outline-danger btn-sm"
    onClick={() => fetchRejectionDetails(request.request_id)}
    disabled={rejectionDetailsLoading}
  >
    {rejectionDetailsLoading ? (
      <>
        <span className="spinner-border spinner-border-sm me-1"></span>
        Loading...
      </>
    ) : (
      <>
        🚫 View Rejection Details
      </>
    )}
  </button>
)}
        
        {/* Student info, submitted date etc. - no changes */}
        <div className="row text-sm mb-3">
          {/* existing student info */}
        </div>
        
        {/* ACTION BUTTONS - Improved layout */}
        <div className="d-flex gap-2 flex-wrap align-items-center">
          {/* Response button */}
          {canCreateResponses() && (
            <button
              className="btn btn-outline-info btn-sm"
              onClick={() => {
                setSelectedRequestForResponse({
                  id: request.request_id,
                  title: `#${request.request_id} - ${request.type_name}`,
                  student: request.student_name
                });
                setShowResponseModal(true);
              }}
            >
              💬 {request.status === 'Pending' ? t('addResponse') : t('viewResponse')}
            </button>
          )}

          {/* Status action buttons */}
          {canManageRequests() && request.status === 'Pending' && (
            <>
              <button
                className="btn btn-success btn-sm"
                onClick={() => updateRequestStatus(request.request_id, 'Completed')}
              >
                ✅ {t('markAsCompleted')}
              </button>
              
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  setSelectedRequestForReject(request);
                  setShowRejectModal(true);
                }}
              >
                🚫 {t('reject', 'Reject')}
              </button>
            </>
          )}
          
          {canManageRequests() && request.status === 'Informed' && (
            <>
              <button
                className="btn btn-success btn-sm"
                onClick={() => updateRequestStatus(request.request_id, 'Completed')}
              >
                ✅ {t('markAsCompleted')}
              </button>
              
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  setSelectedRequestForReject(request);
                  setShowRejectModal(true);
                }}
              >
                🚫 {t('reject', 'Reject')}
              </button>
            </>
          )}
          
          {/* File attachments */}
          {request.attachment_count > 0 && (
            <button 
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setSelectedRequestId(request.request_id);
                setShowAttachments(true);
              }}
            >
              📎 {t('viewFiles')} ({request.attachment_count})
            </button>
          )}

          {/* Status indicators - moved to end */}
          {request.status === 'Completed' && (
            <span className="badge bg-success ms-auto">
              ✅ {t('completed')}
            </span>
          )}

          {/* Permission warning */}
          {!canManageRequests() && (
            <small className="text-muted ms-auto">
              <em>⚠️ Read-only access</em>
            </small>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  const renderSettings = () => (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className={isDark ? 'text-light' : 'text-dark'}>
            ⚙️ {t('settings')} - {department} {t('requestType')}
            {!canManageRequestTypes() && (
              <small className="badge bg-warning ms-2">Read Only</small>
            )}
          </h3>
          <p className={isDark ? 'text-light' : 'text-muted'}>
            {canManageRequestTypes() 
              ? t('enableDisableRequestTypes')
              : 'You can view request types but cannot modify them'
            }
          </p>
        </div>
        
        {canManageRequestTypes() && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            ➕ {t('addNewType')}
          </button>
        )}
      </div>

      {showAddForm && canManageRequestTypes() && (
        <div 
          className="card mb-4"
          style={{
            backgroundColor: isDark ? '#000000' : '#ffffff',
            borderColor: isDark ? '#333333' : '#dee2e6'
          }}
        >
          <div 
            className="card-header"
            style={{
              backgroundColor: isDark ? '#111111' : '#f8f9fa',
              borderColor: isDark ? '#333333' : '#dee2e6'
            }}
          >
            <h6 className={isDark ? 'text-light' : 'text-dark'}>
              {t('addNewTypeFor')} {department}
            </h6>
          </div>
          <div className="card-body">
            <form onSubmit={handleAddRequestType}>
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                      {t('typeName')}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={newTypeData.type_name}
                      onChange={(e) => setNewTypeData({...newTypeData, type_name: e.target.value})}
                      placeholder={t('enterTypeName')}
                      required
                      style={{
                        backgroundColor: isDark ? '#000000' : '#ffffff',
                        borderColor: isDark ? '#333333' : '#ced4da',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                      {t('description')}
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={newTypeData.description_en}
                      onChange={(e) => setNewTypeData({...newTypeData, description_en: e.target.value})}
                      placeholder={t('briefDescription')}
                      style={{
                        backgroundColor: isDark ? '#000000' : '#ffffff',
                        borderColor: isDark ? '#333333' : '#ced4da',
                        color: isDark ? '#ffffff' : '#000000'
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="mb-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={newTypeData.is_document_required}
                    onChange={(e) => setNewTypeData({...newTypeData, is_document_required: e.target.checked})}
                  />
                  <label className={`form-check-label ${isDark ? 'text-light' : 'text-dark'}`}>
                    📎 {t('documentUploadRequiredForType')}
                  </label>
                </div>
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-success">
                  ✅ {t('addRequestType')}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowAddForm(false)}
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status"></div>
          <p className={isDark ? 'text-light' : 'text-dark'}>{t('loading')} request types...</p>
        </div>
      ) : (
        <div className="row">
          {requestTypes.length === 0 ? (
            <div className="col-12">
              <div 
                className="alert"
                style={{
                  backgroundColor: isDark ? '#000000' : '#d1ecf1',
                  borderColor: isDark ? '#333333' : '#bee5eb',
                  color: isDark ? '#ffffff' : '#0c5460'
                }}
              >
                <h5 className={isDark ? 'text-light' : 'text-dark'}>{t('noRequestTypes')}</h5>
                <p className={`mb-0 ${isDark ? 'text-light' : 'text-muted'}`}>
                  No request types available for {department} department.
                </p>
              </div>
            </div>
          ) : (
            requestTypes.map((type) => (
              <div key={type.type_id} className="col-md-6 mb-3">
                <div 
                  className="card"
                  style={{
                    backgroundColor: isDark ? '#000000' : '#ffffff',
                    borderColor: isDark ? '#333333' : '#dee2e6'
                  }}
                >
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h6 className={`card-title ${isDark ? 'text-light' : 'text-dark'}`}>
                          {translateRequestType(type.type_name)}
                        </h6>
                        <p className={`card-text ${isDark ? 'text-light' : 'text-muted'}`}>
                          {type.description_en || t('noDescriptionAvailable')}
                        </p>
                        {type.is_document_required && (
                          <small className="text-warning">
                            📎 {t('documentRequired')}
                          </small>
                        )}
                      </div>
                      <div className="text-end">
                        {canManageRequestTypes() ? (
                          <div className="form-check form-switch">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={!type.is_disabled}
                              onChange={() => toggleRequestType(type.type_id)}
                            />
                            <label className={`form-check-label ${isDark ? 'text-light' : 'text-dark'}`}>
                              {type.is_disabled ? t('disabled') : t('active')}
                            </label>
                          </div>
                        ) : (
                          <span className={`badge ${type.is_disabled ? 'bg-danger' : 'bg-success'}`}>
                            {type.is_disabled ? t('disabled') : t('active')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  // 3. Add renderStatistics function
  const renderStatistics = () => {
  if (!canViewAnalytics() || (!isDepartmentAdmin() && !isSuperAdmin())) {
    return (
      <div className="alert alert-warning">
        <h5>🔒 Access Denied</h5>
        <p>Statistics are only available for Department Admins and Super Administrators.</p>
      </div>
    );
  }

  return <AdminStatisticsPage />;
};

  // RBAC Management Tab Content
  const renderRBACManagement = () => {
    if (!isSuperAdmin()) {
      return (
        <div className="alert alert-warning">
          <h5>🔒 Access Denied</h5>
          <p>RBAC Management is only available for Super Administrators.</p>
        </div>
      );
    }

    return <RBACDashboard />;
  };

  const renderUserManagement = () => {
    if (!isSuperAdmin() && !isDepartmentAdmin()) {
      return (
        <div className="alert alert-warning">
          <h5>🔒 Access Denied</h5>
          <p>User Management requires admin privileges.</p>
        </div>
      );
    }

    return <UserManagementPage departmentFilter={isSuperAdmin() ? null : department} />;
  };

  const renderRoleManagement = () => {
    if (!isSuperAdmin()) {
      return (
        <div className="alert alert-warning">
          <h5>🔒 Access Denied</h5>
          <p>Role Management is only available for Super Administrators.</p>
        </div>
      );
    }

    return <RoleManagementPage />;
  };

  const renderPermissionManagement = () => {
    if (!isSuperAdmin()) {
      return (
        <div className="alert alert-warning">
          <h5>🔒 Access Denied</h5>
          <p>Permission Management is only available for Super Administrators.</p>
        </div>
      );
    }

    return <PermissionManagementPage />;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'requests':
        return renderRequests();
      case 'settings':
        return renderSettings();
        case 'statistics':  // ADD THIS CASE
      return renderStatistics();
      case 'rbac':
        return renderRBACManagement();
      case 'users':
      case 'dept-users':
        return renderUserManagement();
      case 'roles':
        return renderRoleManagement();
      case 'permissions':
        return renderPermissionManagement();
        case 'calendar':
      return <AcademicCalendarManager />;
      default:
        return renderDashboard();
    }
  };

 return (
    <div 
      className="min-vh-100" 
      style={{ 
        backgroundColor: isDark ? '#000000' : '#f8f9fa',
        color: isDark ? '#ffffff' : '#000000'
      }}
    >
      {/* Modern Header - Kırmızı Tema (Her zaman kırmızı) */}
      <div 
        className="shadow-sm"
        style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          borderBottom: '3px solid #991b1b'
        }}
      >
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <div className="d-flex justify-content-between align-items-center py-3">
                {/* Sol taraf - Logo ve Başlık */}
                <div className="d-flex align-items-center">
                  <div className="me-3">
                    <FIULogo 
                      size="md" 
                      style={{ 
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                      }} 
                    />
                  </div>
                  <div className="text-white">
                    <h4 className="mb-0 fw-bold">
                      {department} {t('adminPanel')}
                      {isSuperAdmin() && <small className="badge bg-warning text-dark ms-2">Super Admin</small>}
                      {isDepartmentAdmin() && !isSuperAdmin() && <small className="badge bg-info ms-2">Dept Admin</small>}
                    </h4>
                    <small className="opacity-90">
                      {isSuperAdmin() ? 'System Administrator' : t('manageDepartment')}
                    </small>
                  </div>
                </div>

                {/* Sağ taraf - Kullanıcı Bilgileri ve Kontroller */}
                <div className="d-flex align-items-center gap-3">
                  <div className="text-white d-none d-lg-block text-end">
                    <div className="fw-semibold">{admin?.full_name || admin?.username}</div>
                    <small className="opacity-75">
                      {isSuperAdmin() ? 'Super Admin' : `${department} Admin`}
                    </small>
                  </div>
                  
                  {/* Admin Notification Center */}
                  <AdminNotificationCenter onNotificationClick={handleNotificationClick} />
                  
                  {/* Language Dropdown */}
                  <AdminLanguageSelector />
                      
                  
                  
                  {/* Logout Button */}
                  <button 
                    className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" 
                    onClick={handleLogoutClick}
                    style={{ 
                      borderRadius: '25px',
                      padding: '8px 16px',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = 'rgba(255,255,255,0.2)';
                      e.target.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    <span className="d-none d-md-inline">{t('logout')}</span>
                    <span>🚪</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      

      {/* Navigation Tabs - Dark Mode Desteği + RBAC */}
      <div 
        className="shadow-sm" 
        style={{ 
          backgroundColor: isDark ? '#000000' : '#ffffff',
          borderBottom: `1px solid ${isDark ? '#333333' : '#e5e7eb'}`
        }}
      >
        <div className="container-fluid">
          <ul className="nav nav-tabs border-0 pt-3" style={{ 
  borderBottom: `2px solid ${isDark ? '#333333' : '#e5e7eb'}` 
}}>
  {getVisibleTabs().map((tab) => (
    <li key={tab.key} className="nav-item">
      <button
        className={`nav-link border-0 px-4 py-3 fw-semibold position-relative ${
          activeTab === tab.key 
            ? 'text-danger border-bottom border-danger border-3' 
            : isDark ? 'text-light' : 'text-muted'
        }`}
        onClick={() => setActiveTab(tab.key)}
        style={{
          backgroundColor: activeTab === tab.key 
            ? 'rgba(220, 38, 38, 0.1)' 
            : 'transparent',
          borderRadius: '8px 8px 0 0',
          transition: 'all 0.3s ease'
        }}
      >
        {tab.icon} {tab.label}
        {tab.key === 'requests' && requests.length > 0 && (
          <span className="badge bg-danger ms-2">{requests.length}</span>
        )}
        {tab.badge && (
          <span className="badge bg-success ms-2 text-xs">{tab.badge}</span>
        )}
      </button>
    </li>
  ))}
</ul>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container-fluid py-4">
        {/* Tab Content */}
        {renderTabContent()}
      </div>

      {/* Attachment Viewer Modal */}
      {showAttachments && selectedRequestId && (
        <AttachmentViewer 
          requestId={selectedRequestId}
          onClose={() => {
            setShowAttachments(false);
            setSelectedRequestId(null);
          }}
        />
      )}

      {/* Admin Response Modal */}
      {showResponseModal && selectedRequestForResponse && (
        <AdminResponseModal 
          requestId={selectedRequestForResponse.id}
          requestTitle={selectedRequestForResponse.title}
          onClose={() => {
            setShowResponseModal(false);
            setSelectedRequestForResponse(null);
          }}
          onResponseAdded={() => {
            fetchRequests();
          }}
        />
      )}

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        show={showLogoutModal}
        title="FIU Admin Panel"
        message={t('areYouSureLogoutAdmin')}
        confirmText={t('ok')}
        cancelText={t('cancel')}
        type="warning"
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
      />

      

      {/* Request Reject Modal */}
      {showRejectModal && selectedRequestForReject && (
        <RequestRejectModal
          show={showRejectModal}
          onHide={() => {
            setShowRejectModal(false);
            setSelectedRequestForReject(null);
          }}
          request={selectedRequestForReject}
          onRejectConfirm={handleRejectRequest}
          loading={rejectLoading}
        />
      )}




{/* Rejection Details Modal */}
{showRejectionDetailsModal && selectedRejectionDetails && (
  <>
    {/* Modal Backdrop */}
    <div
      className="modal-backdrop fade show"
      style={{ zIndex: 1040 }}
      onClick={() => setShowRejectionDetailsModal(false)}
    ></div>

    {/* Modal */}
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ zIndex: 1050 }}
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content" style={{
          backgroundColor: isDark ? '#000000' : '#ffffff',
          borderColor: isDark ? '#333333' : '#dee2e6',
          color: isDark ? '#ffffff' : '#000000'
        }}>
          <div className="modal-header" style={{
            backgroundColor: isDark ? '#111111' : '#f8f9fa',
            borderColor: isDark ? '#333333' : '#dee2e6'
          }}>
            <h5 className="modal-title text-danger">
              🚫 Rejection Details 
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={() => setShowRejectionDetailsModal(false)}
              style={{
                filter: isDark ? 'invert(1)' : 'none'
              }}
            ></button>
          </div>

          <div className="modal-body">
            <div className="card border-danger mb-3" style={{
              backgroundColor: isDark ? '#2d0a0a' : '#f8d7da',
              borderColor: '#dc3545'
            }}>
              <div className="card-header bg-danger text-white">
                <h6 className="mb-0">
                  <span className="me-2">🚫</span>
                  Rejection Information
                </h6>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label fw-bold">
                    Rejection Reason:
                  </label>
                  <div className="p-3 rounded border" style={{
                    backgroundColor: isDark ? '#000000' : '#ffffff',
                    borderColor: isDark ? '#555555' : '#ced4da'
                  }}>
                    {selectedRejectionDetails.reason || 'No reason provided'}
                  </div>
                </div>

                {selectedRejectionDetails.additional_info && (
                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      Additional Information:
                    </label>
                    <div className="p-3 rounded border" style={{
                      backgroundColor: isDark ? '#000000' : '#ffffff',
                      borderColor: isDark ? '#555555' : '#ced4da'
                    }}>
                      {selectedRejectionDetails.additional_info}
                    </div>
                  </div>
                )}

                <div className="row">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">
                      Rejected Date:
                    </label>
                    <p className={isDark ? 'text-light' : 'text-muted'}>
                      {selectedRejectionDetails.rejected_at 
                        ? new Date(selectedRejectionDetails.rejected_at).toLocaleString()
                        : 'Unknown'
                      }
                    </p>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">
                      Rejected By:
                    </label>
                    <p className={isDark ? 'text-light' : 'text-muted'}>
                      {selectedRejectionDetails.admin_name || 'Unknown Admin'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            
              
            
          </div>

          <div className="modal-footer" style={{
            backgroundColor: isDark ? '#111111' : '#f8f9fa',
            borderColor: isDark ? '#333333' : '#dee2e6'
          }}>
            <div className="text-muted small me-auto">
              
              
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowRejectionDetailsModal(false)}
            >
        {t('close')}
            </button>
            
          </div>
        </div>
      </div>
    </div>
  </>
)}


      {/* Dark Mode Toggle - Modern */}
      <div 
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999
        }}
      >
        <button
          className={`btn ${isDark ? 'btn-light' : 'btn-dark'} shadow-lg`}
          onClick={toggleTheme}
          style={{
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            fontSize: '1.5rem',
            border: 'none',
            transition: 'all 0.3s ease'
          }}
          title={isDark ? t('switchToLightMode') : t('switchToDarkMode')}
          onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
        >
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal {...confirmationState} />
  
    </div>
  );
};

export default AdminDashboardPage;