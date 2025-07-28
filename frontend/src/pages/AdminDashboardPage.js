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
import ConfirmationModal from '../components/ConfirmationModal';
import LanguageDropdown from '../components/LanguageDropdown';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { useToast } from '../contexts/ToastContext';

const AdminDashboardPage = () => {
  const [selectedRequestForResponse, setSelectedRequestForResponse] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const { admin, logout, department } = useAdminAuth();
  const { isDark, toggleTheme } = useTheme();
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  const { t, translateRequestType } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [requests, setRequests] = useState([]);
  const [requestTypes, setRequestTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: ''
  });
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { showSuccess, showError } = useToast();

  // Add Request Type Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTypeData, setNewTypeData] = useState({
    type_name: '',
    description_en: '',
    is_document_required: false
  });

  // Admin Language Dropdown
  const AdminLanguageSelector = () => {
    return <LanguageDropdown variant="admin" />;
  };

  // Logout İşlemleri
  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    logout();
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getAdminDashboard();
      
      if (response.data && response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
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
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchRequestTypes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getAdminRequestTypes();
      if (response.data && response.data.success) {
        setRequestTypes(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching request types:', error);
      setRequestTypes([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
      showError('Failed to update request status');
    }
  };

  const toggleRequestType = async (typeId) => {
    try {
      await apiService.toggleRequestType(typeId);
      fetchRequestTypes();
    } catch (error) {
      console.error('Error toggling request type:', error);
      alert('Failed to toggle request type');
    }
  };

  const handleNotificationClick = (requestId, type) => {
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
      alert('Request type added successfully!');
    } catch (error) {
      console.error('Error adding request type:', error);
      alert('Failed to add request type');
    }
  };

  const refreshRequests = () => {
    setFilters({ status: '' });
    fetchRequests();
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      'Pending': 'bg-warning text-dark',
      'Informed': 'bg-info text-white',
      'Completed': 'bg-success text-white'
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
      'Urgent': '🔴',
      'High': '🟠',
      'Medium': '🟡', 
      'Low': '🔵'
    };
    return icons[priority] || '🟡';
  };

  const getDepartmentIcon = (dept) => {
    const icons = {
      'Accounting': '💰',
      'Academic': '📚',
      'Dormitory': '🏠',
      'Student Affairs': '👥',
      'Campus Services': '🏢'
    };
    return icons[dept] || '🏢';
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
                    {t('welcomeBack')}, {admin?.name}
                  </p>
                </div>
                <div className="text-end">
                  <div className="h4 text-danger mb-0">
                  
                  </div>
                  <small className={isDark ? 'text-light' : 'text-muted'}>
                   
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status"></div>
          <p className={`mt-3 ${isDark ? 'text-light' : 'text-dark'}`}>
            {t('loading')} dashboard...
          </p>
        </div>
      ) : dashboardData && dashboardData.totals ? (
        <div className="row">
          {/* Quick Stats Cards */}
          <div className="col-lg-8">
            <div className="row mb-4">
              <div className="col-md-4 mb-3">
                <div 
                  className="card border-0 shadow-sm h-100" 
                  style={{ 
                    borderRadius: '12px',
                    backgroundColor: isDark ? '#000000' : '#ffffff',
                    border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
                  }}
                >
                  <div className="card-body text-center p-4">
                    <div className="text-warning mb-3" style={{ fontSize: '2.5rem' }}>⏳</div>
                    <h3 className="text-warning mb-1">{dashboardData.totals.pending || 0}</h3>
                    <p className={`mb-0 ${isDark ? 'text-light' : 'text-muted'}`}>
                      {t('pending')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="col-md-4 mb-3">
                <div 
                  className="card border-0 shadow-sm h-100" 
                  style={{ 
                    borderRadius: '12px',
                    backgroundColor: isDark ? '#000000' : '#ffffff',
                    border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
                  }}
                >
                  <div className="card-body text-center p-4">
                    <div className="text-info mb-3" style={{ fontSize: '2.5rem' }}>💬</div>
                    <h3 className="text-info mb-1">{dashboardData.totals.informed || 0}</h3>
                    <p className={`mb-0 ${isDark ? 'text-light' : 'text-muted'}`}>
                      {t('informed')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="col-md-4 mb-3">
                <div 
                  className="card border-0 shadow-sm h-100" 
                  style={{ 
                    borderRadius: '12px',
                    backgroundColor: isDark ? '#000000' : '#ffffff',
                    border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
                  }}
                >
                  <div className="card-body text-center p-4">
                    <div className="text-success mb-3" style={{ fontSize: '2.5rem' }}>✅</div>
                    <h3 className="text-success mb-1">{dashboardData.totals.completed || 0}</h3>
                    <p className={`mb-0 ${isDark ? 'text-light' : 'text-muted'}`}>
                      {t('completed')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Request Type Statistics */}
            <div 
              className="card border-0 shadow-sm" 
              style={{ 
                borderRadius: '12px',
                backgroundColor: isDark ? '#000000' : '#ffffff',
                border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
              }}
            >
              <div className="card-header bg-transparent border-0 p-4">
                <h5 className="text-danger mb-0">📊 {t('requesttype')} Statistics</h5>
              </div>
              <div className="card-body p-4">
                {dashboardData.type_stats && dashboardData.type_stats.length > 0 ? (
                  <div className="row">
                    {dashboardData.type_stats.map((stat, index) => (
                      <div key={stat.type_name} className="col-md-6 mb-3">
                        <div 
                          className="d-flex justify-content-between align-items-center p-3 rounded-3"
                          style={{ 
                            borderLeft: `4px solid ${['#dc2626', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'][index % 5]}`,
                            backgroundColor: isDark ? '#111111' : '#f8f9fa',
                            border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
                          }}
                        >
                          <span className={`fw-semibold ${isDark ? 'text-light' : 'text-dark'}`}>
                            {translateRequestType(stat.type_name)}
                          </span>
                          <span 
                            className="badge"
                            style={{ 
                              backgroundColor: ['#dc2626', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'][index % 5],
                              color: 'white'
                            }}
                          >
                            {stat.count || 0}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={isDark ? 'text-light' : 'text-muted'}>
                    {t('noRequestTypeData')}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="col-lg-4">
            <div 
              className="card border-0 shadow-sm" 
              style={{ 
                borderRadius: '12px',
                backgroundColor: isDark ? '#000000' : '#ffffff',
                border: isDark ? '1px solid #333333' : '1px solid #e5e7eb'
              }}
            >
              <div className="card-header bg-transparent border-0 p-4">
                <h5 className="text-danger mb-0">⚡ {t('quickActions')}</h5>
              </div>
              <div className="card-body p-4">
                <div className="d-grid gap-2">
                  <button 
                    className="btn btn-outline-danger"
                    onClick={() => setActiveTab('requests')}
                    style={{ borderRadius: '8px' }}
                  >
                    📋 {t('viewAll')} {t('requests')}
                  </button>
                  <button 
                    className="btn btn-outline-warning"
                    onClick={() => {
                      setFilters({...filters, status: 'Pending'});
                      setActiveTab('requests');
                    }}
                    style={{ borderRadius: '8px' }}
                  >
                    ⏳ {t('pending')} ({dashboardData.totals.pending || 0})
                  </button>
                  <button 
                    className="btn btn-outline-info"
                    onClick={() => {
                      setFilters({...filters, status: 'Informed'});
                      setActiveTab('requests');
                    }}
                    style={{ borderRadius: '8px' }}
                  >
                    💬 {t('informed')} ({dashboardData.totals.informed || 0})
                  </button>
                  <button 
                    className="btn btn-outline-secondary"
                    onClick={() => setActiveTab('settings')}
                    style={{ borderRadius: '8px' }}
                  >
                    ⚙️ {t('settings')}
                  </button>
                </div>
              </div>
            </div>
          </div>
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
          📋 {t('manageRequests')} - {department}
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
                    
                    <div className="d-flex gap-2 flex-wrap">
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

                      {request.status === 'Pending' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => updateRequestStatus(request.request_id, 'Completed')}
                        >
                          ✅ {t('markAsCompleted')}
                        </button>
                      )}
                      
                      {request.status === 'Informed' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => updateRequestStatus(request.request_id, 'Completed')}
                        >
                          ✅ {t('markAsCompleted')}
                        </button>
                      )}
                      
                      {request.status === 'Completed' && (
                        <span className="text-success fw-bold me-2">
                          ✅ Request {t('completed')}
                        </span>
                      )}
                      
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
          </h3>
          <p className={isDark ? 'text-light' : 'text-muted'}>
            {t('enableDisableRequestTypes')}
          </p>
        </div>
        
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          ➕ {t('addNewType')}
        </button>
      </div>

      {showAddForm && (
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
                    </h4>
                    <small className="opacity-90">
                      {t('manageDepartment')}
                    </small>
                  </div>
                </div>

                {/* Sağ taraf - Kullanıcı Bilgileri ve Kontroller */}
                <div className="d-flex align-items-center gap-3">
                  <div className="text-white d-none d-lg-block text-end">
                    <div className="fw-semibold">{admin?.name}</div>
                    <small className="opacity-75">{department} Admin</small>
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

      {/* Navigation Tabs - Dark Mode Desteği */}
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
            <li className="nav-item">
              <button
                className={`nav-link border-0 px-4 py-3 fw-semibold ${
                  activeTab === 'dashboard' 
                    ? 'text-danger border-bottom border-danger border-3' 
                    : isDark ? 'text-light' : 'text-muted'
                }`}
                onClick={() => setActiveTab('dashboard')}
                style={{
                  backgroundColor: activeTab === 'dashboard' 
                    ? 'rgba(220, 38, 38, 0.1)' 
                    : 'transparent',
                  borderRadius: '8px 8px 0 0',
                  transition: 'all 0.3s ease'
                }}
              >
                📊 {t('dashboard')}
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link border-0 px-4 py-3 fw-semibold ${
                  activeTab === 'requests' 
                    ? 'text-danger border-bottom border-danger border-3' 
                    : isDark ? 'text-light' : 'text-muted'
                }`}
                onClick={() => setActiveTab('requests')}
                style={{
                  backgroundColor: activeTab === 'requests' 
                    ? 'rgba(220, 38, 38, 0.1)' 
                    : 'transparent',
                  borderRadius: '8px 8px 0 0',
                  transition: 'all 0.3s ease'
                }}
              >
                📋 {t('manageRequests')}
                {requests.length > 0 && (
                  <span className="badge bg-danger ms-2">{requests.length}</span>
                )}
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link border-0 px-4 py-3 fw-semibold ${
                  activeTab === 'settings' 
                    ? 'text-danger border-bottom border-danger border-3' 
                    : isDark ? 'text-light' : 'text-muted'
                }`}
                onClick={() => setActiveTab('settings')}
                style={{
                  backgroundColor: activeTab === 'settings' 
                    ? 'rgba(220, 38, 38, 0.1)' 
                    : 'transparent',
                  borderRadius: '8px 8px 0 0',
                  transition: 'all 0.3s ease'
                }}
              >
                ⚙️ {t('settings')}
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container-fluid py-4">
        {/* Tab Content */}
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'requests' && renderRequests()}
        {activeTab === 'settings' && renderSettings()}
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
    </div>
  );
};

export default AdminDashboardPage;
                  