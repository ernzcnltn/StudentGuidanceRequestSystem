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
import AcademicCalendarManager from '../components/AcademicCalendarManager';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { useToast } from '../contexts/ToastContext';
import { useConfirmation } from '../hooks/useConfirmation';
import ConfirmationModal from '../components/ConfirmationModal';

// Request Detail Modal Component
const RequestDetailModal = ({ 
  show, 
  onHide, 
  request, 
  onUpdateStatus, 
  onRejectRequest, 
  onSendResponse,
  onViewAttachments,
  canManageRequests,
  canCreateResponses 
}) => {
  const { isDark } = useTheme();
  const { t, translateRequestType } = useTranslation();

  if (!show || !request) return null;

  const getStatusBadge = (status) => {
    const statusStyles = {
      'Pending': 'bg-danger text-white',
      'Informed': 'bg-danger text-white',
      'Completed': 'bg-danger text-white',
      'Rejected': 'bg-danger text-white'
    };
    return statusStyles[status] || 'bg-secondary text-white';
  };

  const getPriorityBadge = (priority) => {
    const priorityStyles = {
      'Urgent': 'bg-danger text-white',
      'High': 'bg-danger text-white', 
      'Medium': 'bg-danger text-white',
      'Low': 'bg-danger text-white'
    };
    return priorityStyles[priority] || 'bg-info text-white';
  };

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1040 }}
        onClick={onHide}
      ></div>

      {/* Modal */}
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        style={{ zIndex: 1050 }}
      >
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content" style={{
            backgroundColor: isDark ? '#000000' : '#ffffff',
            borderColor: isDark ? '#4a5568' : '#e2e8f0',
            color: isDark ? '#ffffff' : '#000000'
          }}>
            {/* Modal Header */}
            <div className="modal-header" style={{
              backgroundColor: isDark ? '#1a202c' : '#f7fafc',
              borderColor: isDark ? '#4a5568' : '#e2e8f0'
            }}>
              <h5 className="modal-title">
                <i className="fas fa-file-alt me-2 text-danger"></i>
                Request Details  
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={onHide}
                style={{
                  filter: isDark ? 'invert(1)' : 'none'
                }}
              ></button>
            </div>

            {/* Modal Body */}
            <div className="modal-body">
              <div className="row">
                {/* Left Column - Basic Info */}
                <div className="col-lg-4">
                  <div className="card mb-3" style={{
                    backgroundColor: isDark ? '#1a202c' : '#f8f9fa',
                    borderColor: isDark ? '#4a5568' : '#e2e8f0'
                  }}>
                    <div className="card-header" style={{
                      backgroundColor: isDark ? '#2d3748' : '#e9ecef',
                      borderColor: isDark ? '#4a5568' : '#e2e8f0'
                    }}>
                      <h6 className="mb-0">
                        <i className="fas fa-info-circle me-2"></i>
                        Basic Information
                      </h6>
                    </div>
                    <div className="card-body">
                      <div className="mb-3">
                        <label className="form-label fw-bold">Request Type:</label>
                        <div className="p-2 rounded" style={{
                          backgroundColor: isDark ? '#000000' : '#ffffff',
                          border: `1px solid ${isDark ? '#4a5568' : '#e2e8f0'}`
                        }}>
                          {translateRequestType(request.type_name)}
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label fw-bold">Student:</label>
                        <div className="p-2 rounded" style={{
                          backgroundColor: isDark ? '#000000' : '#ffffff',
                          border: `1px solid ${isDark ? '#4a5568' : '#e2e8f0'}`
                        }}>
                          <div className="fw-semibold">{request.student_name}</div>
                          <small className={isDark ? 'text-light' : 'text-muted'}>
                            {request.student_number}
                          </small>
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label fw-bold">Status:</label>
                        <div>
                          <span className={`badge ${getStatusBadge(request.status)}`}>
                            {t(request.status.toLowerCase())}
                          </span>
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label fw-bold">Priority:</label>
                        <div>
                          <span className={`badge ${getPriorityBadge(request.priority)}`}>
                            {request.priority || 'Medium'}
                          </span>
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label fw-bold">Submitted:</label>
                        <div className={isDark ? 'text-light' : 'text-muted'}>
                          <div>{new Date(request.submitted_at).toLocaleDateString()}</div>
                          <small>{new Date(request.submitted_at).toLocaleTimeString()}</small>
                        </div>
                      </div>

                      {request.attachment_count > 0 && (
                        <div className="mb-3">
                          <label className="form-label fw-bold">Attachments:</label>
                          <div>
                            <button 
                              className="btn btn-outline-secondary btn-sm w-100"
                              onClick={() => onViewAttachments(request.request_id)}
                            >
                              <i className="fas fa-paperclip me-2"></i>
                              View Files ({request.attachment_count})
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Content */}
                <div className="col-lg-8">
                  <div className="card mb-3" style={{
                    backgroundColor: isDark ? '#1a202c' : '#f8f9fa',
                    borderColor: isDark ? '#4a5568' : '#e2e8f0'
                  }}>
                    <div className="card-header" style={{
                      backgroundColor: isDark ? '#2d3748' : '#e9ecef',
                      borderColor: isDark ? '#4a5568' : '#e2e8f0'
                    }}>
                      <h6 className="mb-0">
                        <i className="fas fa-file-text me-2"></i>
                        Request Content
                      </h6>
                    </div>
                    <div className="card-body">
                      <div className="p-3 rounded" style={{
                        backgroundColor: isDark ? '#000000' : '#ffffff',
                        border: `1px solid ${isDark ? '#4a5568' : '#e2e8f0'}`,
                        minHeight: '200px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        lineHeight: '1.6'
                      }}>
                        {request.content || 'No content provided'}
                      </div>
                    </div>
                  </div>

                  {/* Additional Information */}
                  {(request.student_email || request.student_phone) && (
                    <div className="card" style={{
                      backgroundColor: isDark ? '#1a202c' : '#f8f9fa',
                      borderColor: isDark ? '#4a5568' : '#e2e8f0'
                    }}>
                      <div className="card-header" style={{
                        backgroundColor: isDark ? '#2d3748' : '#e9ecef',
                        borderColor: isDark ? '#4a5568' : '#e2e8f0'
                      }}>
                        <h6 className="mb-0">
                          <i className="fas fa-address-card me-2"></i>
                          Contact Information
                        </h6>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          {request.student_email && (
                            <div className="col-md-6">
                              <label className="form-label fw-bold">Email:</label>
                              <div className="p-2 rounded" style={{
                                backgroundColor: isDark ? '#000000' : '#ffffff',
                                border: `1px solid ${isDark ? '#4a5568' : '#e2e8f0'}`
                              }}>
                                <a 
                                  href={`mailto:${request.student_email}`}
                                  className="text-decoration-none"
                                  style={{ color: '#dc2626' }}
                                >
                                  {request.student_email}
                                </a>
                              </div>
                            </div>
                          )}
                          {request.student_phone && (
                            <div className="col-md-6">
                              <label className="form-label fw-bold">Phone:</label>
                              <div className="p-2 rounded" style={{
                                backgroundColor: isDark ? '#000000' : '#ffffff',
                                border: `1px solid ${isDark ? '#4a5568' : '#e2e8f0'}`
                              }}>
                                <a 
                                  href={`tel:${request.student_phone}`}
                                  className="text-decoration-none"
                                  style={{ color: '#dc2626' }}
                                >
                                  {request.student_phone}
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer - Actions */}
            <div className="modal-footer" style={{
              backgroundColor: isDark ? '#1a202c' : '#f7fafc',
              borderColor: isDark ? '#4a5568' : '#e2e8f0'
            }}>
              <div className="d-flex gap-2 w-100">
                {canCreateResponses && (
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => onSendResponse(request)}
                  >
                    <i className="fas fa-reply me-2"></i>
                    Send Response
                  </button>
                )}

                {canManageRequests && request.status !== 'Completed' && (
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => onUpdateStatus(request.request_id, 'Completed')}
                  >
                    <i className="fas fa-check me-2"></i>
                    Mark Complete
                  </button>
                )}

                {canManageRequests && request.status === 'Pending' && (
                  <button
                    className="btn btn-outline-danger"
                    onClick={() => onRejectRequest(request)}
                  >
                    <i className="fas fa-times me-2"></i>
                    Reject
                  </button>
                )}

                <button
                  className="btn btn-secondary ms-auto"
                  onClick={onHide}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const AdminDashboardPage = () => {
  const [selectedRequestForResponse, setSelectedRequestForResponse] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
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

  // Request Detail Modal States
  const [showRequestDetailModal, setShowRequestDetailModal] = useState(false);
  const [selectedRequestForDetail, setSelectedRequestForDetail] = useState(null);

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

  const handleLogoutClick = async () => {
    console.log('Logout button clicked!');
    
    const confirmed = await showConfirmation({
      title: 'Logout Confirmation',
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

  // Request Detail Modal Handlers
  const handleViewRequestDetail = (request) => {
    setSelectedRequestForDetail(request);
    setShowRequestDetailModal(true);
  };

  const handleCloseRequestDetail = () => {
    setShowRequestDetailModal(false);
    setSelectedRequestForDetail(null);
  };

  const handleSendResponseFromDetail = (request) => {
    setSelectedRequestForResponse({
      id: request.request_id,
      title: `#${request.request_id} - ${request.type_name}`,
      student: request.student_name
    });
    setShowResponseModal(true);
    setShowRequestDetailModal(false);
  };

  const handleRejectFromDetail = (request) => {
    setSelectedRequestForReject(request);
    setShowRejectModal(true);
    setShowRequestDetailModal(false);
  };

  const handleViewAttachmentsFromDetail = (requestId) => {
    setSelectedRequestId(requestId);
    setShowAttachments(true);
    setShowRequestDetailModal(false);
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

  const handleRejectRequest = async (rejectionReason) => {
    if (!selectedRequestForReject) {
      showError('No request selected for rejection');
      return;
    }

    try {
      setRejectLoading(true);
      
      console.log('Starting reject process:', {
        requestId: selectedRequestForReject.request_id,
        reasonLength: rejectionReason.length
      });
      
      const response = await apiService.rejectRequest(
        selectedRequestForReject.request_id, 
        { rejection_reason: rejectionReason }
      );
      
      console.log('Reject response received:', response.data);
      
      if (response.data && response.data.success) {
        showSuccess(`Request #${selectedRequestForReject.request_id} rejected successfully`);
        setShowRejectModal(false);
        setSelectedRequestForReject(null);
        
        if (typeof fetchRequests === 'function') {
          fetchRequests();
        }
      } else {
        throw new Error(response.data?.error || 'Unknown error occurred');
      }
      
    } catch (error) {
      console.error('Error rejecting request:', error);
      
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
        showSuccess(`Request #${requestId} marked as completed`);
      } else {
        showSuccess(`Request #${requestId} status updated to ${newStatus}`);
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
      'Pending': 'bg-danger text-white',
      'Informed': 'bg-danger text-white',
      'Completed': 'bg-danger text-white',
      'Rejected': 'bg-danger text-white'
    };
    return statusStyles[status] || 'bg-secondary text-white';
  };

  const getPriorityBadge = (priority) => {
    const priorityStyles = {
      'Urgent': 'bg-danger text-white',
      'High': 'bg-danger text-white', 
      'Medium': 'bg-danger text-white',
      'Low': 'bg-danger text-white'
    };
    return priorityStyles[priority] || 'bg-info text-white';
  };

  // Tab visibility control based on permissions
  const getVisibleTabs = () => {
    const tabs = [];
    
    if (canViewAnalytics()) {
      tabs.push({ key: 'dashboard', label: 'Dashboard', icon: 'fas fa-chart-line' });
    }
    
    if (canViewRequests()) {
      tabs.push({ key: 'requests', label: 'Manage Requests', icon: 'fas fa-tasks' });
    }

    if (canManageSettings()) {
      tabs.push({ key: 'settings', label: 'Settings', icon: 'fas fa-cog' });
    }
    
    // RBAC Management Tabs (Super Admin only)
    if (isSuperAdmin()) {
      tabs.push({ key: 'users', label: 'Users', icon: 'fas fa-users' });
      tabs.push({ key: 'roles', label: 'Roles', icon: 'fas fa-user-tag' });
      tabs.push({ key: 'permissions', label: 'Permissions', icon: 'fas fa-shield-alt' });
    }
    
    // Department Admin can see user management for their department
    if (isDepartmentAdmin() && !isSuperAdmin()) {
      tabs.push({ key: 'dept-users', label: 'Dept Users', icon: 'fas fa-user-friends' });
    }

    if (isSuperAdmin()) {
      tabs.push({ 
        key: 'calendar', 
        label: 'Academic Calendar', 
        icon: 'fas fa-calendar-alt' 
      });
    }

    return tabs;
  };

  // Pagination helper functions
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

  const renderDashboard = () => (
    <div>
      <div className="row mb-4">
        <div className="col-12">
          <div 
            className="card border-0 shadow-sm" 
            style={{ 
              borderRadius: '12px',
              backgroundColor: isDark ? '#000000' : '#ffffff',
              border: isDark ? '1px solid #4a5568' : '1px solid #e2e8f0'
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Dashboard Integration */}
      <AdminStatisticsPage />
    </div>
  );

  const renderRequests = () => {
    const totalPages = getTotalPages(requests.length, itemsPerPage);
    const paginatedRequests = getPaginatedData(requests, currentPage, itemsPerPage);
    
    return (
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
                borderColor: isDark ? '#4a5568' : '#cbd5e0',
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
              className="btn btn-outline-danger btn-sm"
              onClick={refreshRequests}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  {t('loading')}...
                </>
              ) : (
                'Refresh'
              )}
            </button>
          </div>
        </div>

        {/* Requests Table */}
        <div className="card" style={{
          backgroundColor: isDark ? '#000000' : '#ffffff',
          borderColor: isDark ? '#4a5568' : '#e2e8f0'
        }}>
          <div className="card-body">
            {loading ? (
              <div className="text-center">
                <div className="spinner-border text-danger" role="status"></div>
                <p className={isDark ? 'text-light' : 'text-dark'}>{t('loading')} requests...</p>
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead className={isDark ? 'table-dark' : 'table-light'}>
                      <tr>
                        
                        <th>Type</th>
                        <th>Student</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRequests.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-4">
                            <div className={`text-muted ${isDark ? 'text-light' : ''}`}>
                              <h5>{t('noRequests')}</h5>
                              <p>No requests found for the current filters.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedRequests.map((request) => (
                          <tr 
                            key={request.request_id} 
                            id={`request-${request.request_id}`}
                            className={isDark ? 'text-light' : ''}
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleViewRequestDetail(request)}
                          >
                            
                            <td>
                              <div className="fw-semibold">
                                {translateRequestType(request.type_name)}
                              </div>
                              <small className={isDark ? 'text-light' : 'text-muted'}>
                                {request.content.substring(0, 50)}...
                              </small>
                            </td>
                            <td>
                              <div className="fw-semibold">{request.student_name}</div>
                              <small className={isDark ? 'text-light' : 'text-muted'}>
                                {request.student_number}
                              </small>
                            </td>
                            <td>
                              <span className={`badge ${getPriorityBadge(request.priority)}`}>
                                {request.priority || 'Medium'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${getStatusBadge(request.status)}`}>
                                {t(request.status.toLowerCase())}
                              </span>
                            </td>
                            <td>
                              <small>
                                {new Date(request.submitted_at).toLocaleDateString()}
                                <br />
                                {new Date(request.submitted_at).toLocaleTimeString()}
                              </small>
                            </td>
                            <td>
                              <div className="btn-group" role="group" onClick={(e) => e.stopPropagation()}>
                               

                                {request.attachment_count > 0 && (
                                  <button 
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => {
                                      setSelectedRequestId(request.request_id);
                                      setShowAttachments(true);
                                    }}
                                  >
                                    Files ({request.attachment_count})
                                  </button>
                                )}

                                {request.status === 'Rejected' && (
                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => fetchRejectionDetails(request.request_id)}
                                    disabled={rejectionDetailsLoading}
                                  >
                                    View Rejection
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
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    const totalPages = getTotalPages(requestTypes.length, itemsPerPage);
    const paginatedTypes = getPaginatedData(requestTypes, currentPage, itemsPerPage);
    
    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3 className={isDark ? 'text-light' : 'text-dark'}>
              {t('settings')} - {department} {t('requestType')}
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
              className="btn btn-danger"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {t('addNewType')}
            </button>
          )}
        </div>

        {showAddForm && canManageRequestTypes() && (
          <div 
            className="card mb-4"
            style={{
              backgroundColor: isDark ? '#000000' : '#ffffff',
              borderColor: isDark ? '#4a5568' : '#e2e8f0'
            }}
          >
            <div 
              className="card-header"
              style={{
                backgroundColor: isDark ? '#1a202c' : '#f7fafc',
                borderColor: isDark ? '#4a5568' : '#e2e8f0'
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
                          borderColor: isDark ? '#4a5568' : '#cbd5e0',
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
                          borderColor: isDark ? '#4a5568' : '#cbd5e0',
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
                      {t('documentUploadRequiredForType')}
                    </label>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-danger">
                    {t('addRequestType')}
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

        {/* Request Types Table */}
        <div className="card" style={{
          backgroundColor: isDark ? '#000000' : '#ffffff',
          borderColor: isDark ? '#4a5568' : '#e2e8f0'
        }}>
          <div className="card-body">
            {loading ? (
              <div className="text-center">
                <div className="spinner-border text-danger" role="status"></div>
                <p className={isDark ? 'text-light' : 'text-dark'}>{t('loading')} request types...</p>
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead className={isDark ? 'table-dark' : 'table-light'}>
                      <tr>
                        <th>Type Name</th>
                        <th>Description</th>
                        <th>Document Required</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTypes.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-4">
                            <div className={`text-muted ${isDark ? 'text-light' : ''}`}>
                              <h5>{t('noRequestTypes')}</h5>
                              <p>No request types available for {department} department.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedTypes.map((type) => (
                          <tr key={type.type_id} className={isDark ? 'text-light' : ''}>
                            <td>
                              <div className="fw-semibold">
                                {translateRequestType(type.type_name)}
                              </div>
                            </td>
                            <td>
                              <span className={isDark ? 'text-light' : 'text-muted'}>
                                {type.description_en || t('noDescriptionAvailable')}
                              </span>
                            </td>
                            <td>
                              {type.is_document_required ? (
                                <span className="badge bg-danger text-dark">Required</span>
                              ) : (
                                <span className="badge bg-danger">Optional</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${type.is_disabled ? 'bg-danger' : 'bg-info'}`}>
                                {type.is_disabled ? t('disabled') : t('active')}
                              </span>
                            </td>
                            <td>
                              {canManageRequestTypes() ? (
                                <div className="form-check form-switch">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={!type.is_disabled}
                                    onChange={() => toggleRequestType(type.type_id)}
                                  />
                                  <label className={`form-check-label ${isDark ? 'text-light' : 'text-dark'}`}>
                                    {type.is_disabled ? 'Enable' : 'Disable'}
                                  </label>
                                </div>
                              ) : (
                                <span className="text-muted">Read Only</span>
                              )}
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
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderUserManagement = () => {
    if (!isSuperAdmin() && !isDepartmentAdmin()) {
      return (
        <div className="alert alert-warning">
          <h5>Access Denied</h5>
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
          <h5>Access Denied</h5>
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
          <h5>Access Denied</h5>
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
        background: isDark 
          ? 'linear-gradient(135deg, #1a202c 0%, #2d3748 50%, #4a5568 100%)' 
          : '#f8f9fa',
        color: isDark ? '#f7fafc' : '#000000',
        minHeight: '100vh'
      }}
    >
      {/* Sidebar */}
      <div 
        className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          left: sidebarOpen ? 0 : '-280px',
          width: '280px',
          height: '100vh',
          background: isDark 
            ? 'linear-gradient(135deg, #1a202c 0%, #2d3748 50%, #4a5568 100%)' 
            : '#ffffff',
          borderRight: isDark ? '1px solid #4a5568' : '1px solid #e2e8f0',
          transition: 'left 0.3s ease',
          zIndex: 1050,
          overflowY: 'auto',
          boxShadow: isDark 
            ? '4px 0 20px rgba(0, 0, 0, 0.3)' 
            : '4px 0 20px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div className="p-3 border-bottom" style={{
          borderColor: isDark ? '#4a5568' : '#e2e8f0',
          background: isDark 
            ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' 
            : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
        }}>
          <h5 className="mb-0 text-white">
            Admin Panel
          </h5>
          <small className="text-white opacity-90">
            {department} Department
          </small>
        </div>
        
        <nav className="mt-3">
          {getVisibleTabs().map((tab) => (
            <button
              key={tab.key}
              className={`nav-link border-0 w-100 text-start px-3 py-3 ${
                activeTab === tab.key 
                  ? 'bg-danger text-white' 
                  : isDark ? 'text-light hover-bg-gray-800' : 'text-dark hover-bg-gray-50'
              }`}
              onClick={() => {
                setActiveTab(tab.key);
                setSidebarOpen(false);
                setCurrentPage(1); // Reset pagination when changing tabs
              }}
              style={{
                backgroundColor: activeTab === tab.key 
                  ? '#dc2626' 
                  : 'transparent',
                transition: 'all 0.3s ease'
              }}
            >
              <i className={`${tab.icon} me-3`}></i>
              {tab.label}
              {tab.key === 'requests' && requests.length > 0 && (
                <span className="badge bg-light text-dark ms-2">{requests.length}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1040
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Header */}
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
                {/* Sol taraf - Hamburger, Logo ve Başlık */}
                <div className="d-flex align-items-center">
                  {/* Hamburger Menu */}
                  <button
                    className="btn text-white me-3 p-2"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    style={{
                      border: 'none',
                      fontSize: '1.25rem',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ☰
                  </button>
                  
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
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        className="main-content"
        style={{
          marginLeft: sidebarOpen ? '280px' : '0',
          transition: 'margin-left 0.3s ease',
          padding: '2rem'
        }}
      >
        {/* Tab Content */}
        {renderTabContent()}
      </div>

      {/* Request Detail Modal */}
      <RequestDetailModal
        show={showRequestDetailModal}
        onHide={handleCloseRequestDetail}
        request={selectedRequestForDetail}
        onUpdateStatus={updateRequestStatus}
        onRejectRequest={handleRejectFromDetail}
        onSendResponse={handleSendResponseFromDetail}
        onViewAttachments={handleViewAttachmentsFromDetail}
        canManageRequests={canManageRequests()}
        canCreateResponses={canCreateResponses()}
      />

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
                borderColor: isDark ? '#4a5568' : '#e2e8f0',
                color: isDark ? '#ffffff' : '#000000'
              }}>
                <div className="modal-header" style={{
                  backgroundColor: isDark ? '#1a202c' : '#f7fafc',
                  borderColor: isDark ? '#4a5568' : '#e2e8f0'
                }}>
                  <h5 className="modal-title text-danger">
                    Rejection Details 
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
                          borderColor: isDark ? '#4a5568' : '#cbd5e0'
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
                            borderColor: isDark ? '#4a5568' : '#cbd5e0'
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
                  backgroundColor: isDark ? '#1a202c' : '#f7fafc',
                  borderColor: isDark ? '#4a5568' : '#e2e8f0'
                }}>
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

      {/* Dark Mode Toggle */}
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

      {/* Custom CSS */}
      <style jsx>{`
        .sidebar-open {
          left: 0 !important;
        }
        
        .nav-link:hover {
          background-color: ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'} !important;
        }
        
        .hover-bg-gray-800:hover {
          background-color: rgba(255, 255, 255, 0.1) !important;
        }
        
        .hover-bg-gray-50:hover {
          background-color: rgba(0, 0, 0, 0.05) !important;
        }
        
        @media (max-width: 768px) {
          .main-content {
            margin-left: 0 !important;
            padding: 1rem !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboardPage;