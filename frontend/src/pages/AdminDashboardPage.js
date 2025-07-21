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
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

const AdminDashboardPage = () => {
  const [selectedRequestForResponse, setSelectedRequestForResponse] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const { admin, logout, department } = useAdminAuth();
  const { isDark, toggleTheme } = useTheme();
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  const { t } = useTranslation();
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

  // Add Request Type Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTypeData, setNewTypeData] = useState({
    type_name: '',
    description_en: '',
    is_document_required: false
  });

  // Admin Language Selector - Logo ile birlikte
  const AdminLanguageSelector = () => {
    return (
      <div className="d-flex gap-1 me-2">
        {Object.entries(languages).map(([code, lang]) => (
          <button
            key={code}
            className={`btn btn-sm ${
              currentLanguage === code ? 'btn-primary' : 'btn-outline-secondary'
            }`}
            onClick={() => changeLanguage(code)}
            title={lang.name}
            style={{ fontSize: '14px', padding: '4px 8px' }}
          >
            {lang.flag}
          </button>
        ))}
      </div>
    );
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
        setRequests(response.data.data || []);
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
      alert(`Request #${requestId} status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating request status:', error);
      alert('Failed to update request status');
    }
  };

  const updateRequestPriority = async (requestId, newPriority) => {
    try {
      await apiService.updateRequestPriority(requestId, newPriority);
      fetchRequests();
      alert(`Request #${requestId} priority updated to ${newPriority}`);
    } catch (error) {
      console.error('Error updating priority:', error);
      alert('Failed to update request priority');
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
    return icons[dept] || '📋';
  };

  const renderDashboard = () => (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3>{getDepartmentIcon(department)} {department} {t('dashboard')}</h3>
          <p className="text-muted">{t('welcomeBack')}, {admin?.name}</p>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status"></div>
          <p>{t('loading')} dashboard...</p>
        </div>
      ) : dashboardData && dashboardData.totals ? (
        <div>
          <div className="row mb-4">
            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h5>{t('requesttype')} Statistics</h5>
                </div>
                <div className="card-body">
                  {dashboardData.type_stats && dashboardData.type_stats.length > 0 ? (
                    dashboardData.type_stats.map((stat) => (
                      <div key={stat.type_name} className="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                        <span><strong>{stat.type_name}</strong></span>
                        <span className="badge bg-primary">{stat.count || 0}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted">No request type data available</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h5>{t('quickActions')}</h5>
                </div>
                <div className="card-body">
                  <button 
                    className="btn btn-outline-primary me-2 mb-2"
                    onClick={() => setActiveTab('requests')}
                  >
                    📋 {t('viewAll')} {t('requests')}
                  </button>
                  <button 
                    className="btn btn-outline-warning me-2 mb-2"
                    onClick={() => {
                      setFilters({...filters, status: 'Pending'});
                      setActiveTab('requests');
                    }}
                  >
                    ⏳ {t('pending')} ({dashboardData.totals.pending || 0})
                  </button>
                  <button 
                    className="btn btn-outline-info me-2 mb-2"
                    onClick={() => {
                      setFilters({...filters, status: 'Informed'});
                      setActiveTab('requests');
                    }}
                  >
                    💬 {t('informed')} ({dashboardData.totals.informed || 0})
                  </button>
                  <button 
                    className="btn btn-outline-secondary me-2 mb-2"
                    onClick={() => setActiveTab('settings')}
                  >
                    ⚙️ {t('settings')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="alert alert-danger">
          <h5>Failed to load dashboard data</h5>
          <p>Please check your connection and try again.</p>
          <button className="btn btn-outline-danger" onClick={fetchDashboardData}>
            Retry
          </button>
        </div>
      )}
    </div>
  );

  const renderRequests = () => (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>📋 {t('manageRequests')} - {department}</h3>
        
        <div className="d-flex gap-2">
          <select
            className="form-select form-select-sm"
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
          >
            <option value="">All Status</option>
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
                🔄 {t('refresh')}
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status"></div>
          <p>{t('loading')} requests...</p>
        </div>
      ) : (
        <div className="row">
          {!requests || requests.length === 0 ? (
            <div className="col-12 text-center py-5">
              <div className="alert alert-info">
                <h5>{t('noRequests')}</h5>
                <p className="mb-0">
                  {filters.status 
                    ? `No ${filters.status.toLowerCase()} requests found for ${department} department.` 
                    : `No requests have been submitted to ${department} department yet.`
                  }
                </p>
              </div>
            </div>
          ) : (
            requests.map((request) => (
              <div key={request.request_id} className="col-12 mb-3">
                <div className="card">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="mb-1">
                        Request #{request.request_id} - {request.type_name}
                      </h6>
                      <small className="text-muted">
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
                    <p className="mb-3">
                      <strong>{t('content')}:</strong> {request.content}
                    </p>
                    
                    <div className="row text-sm mb-3">
                      <div className="col-md-4">
                        <strong>Student Email:</strong><br/>
                        <a href={`mailto:${request.student_email}`}>
                          {request.student_email}
                        </a>
                      </div>
                      <div className="col-md-4">
                        <strong>{t('submitted')}:</strong><br/>
                        {new Date(request.submitted_at).toLocaleDateString()} {new Date(request.submitted_at).toLocaleTimeString()}
                      </div>
                      <div className="col-md-4">
                        <strong>Attachments:</strong><br/>
                        <span className={request.attachment_count > 0 ? 'text-success' : 'text-muted'}>
                          {request.attachment_count || 0} file(s)
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
          <h3>⚙️ {t('settings')} - {department} {t('requesttype')}</h3>
          <p className="text-muted">Enable or disable request types for students</p>
        </div>
        
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          ➕ Add New Type
        </button>
      </div>

      {showAddForm && (
        <div className="card mb-4">
          <div className="card-header">
            <h6>Add New Request Type for {department}</h6>
          </div>
          <div className="card-body">
            <form onSubmit={handleAddRequestType}>
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Type Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newTypeData.type_name}
                      onChange={(e) => setNewTypeData({...newTypeData, type_name: e.target.value})}
                      placeholder="e.g. Grade Appeal Process"
                      required
                    />
                  </div>
                </div>
                
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newTypeData.description_en}
                      onChange={(e) => setNewTypeData({...newTypeData, description_en: e.target.value})}
                      placeholder="Brief description of this request type"
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
                  <label className="form-check-label">
                    📎 Document upload required for this request type
                  </label>
                </div>
              </div>
              
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-success">
                  ✅ Add Request Type
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
          <p>{t('loading')} request types...</p>
        </div>
      ) : (
        <div className="row">
          {requestTypes.length === 0 ? (
            <div className="col-12">
              <div className="alert alert-info">
                <h5>No request types found</h5>
                <p className="mb-0">No request types available for {department} department.</p>
              </div>
            </div>
          ) : (
            requestTypes.map((type) => (
              <div key={type.type_id} className="col-md-6 mb-3">
                <div className="card">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h6 className="card-title">{type.type_name}</h6>
                        <p className="card-text text-muted">
                          {type.description_en || 'No description available'}
                        </p>
                        {type.is_document_required && (
                          <small className="text-warning">
                            📎 Document required
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
                          <label className="form-check-label">
                            {type.is_disabled ? 'Disabled' : 'Active'}
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
    <div className="container-fluid mt-4">
      {/* Header with FIU Logo */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center">
              <FIULogo size="lg" className="me-3" />
              <div>
                <h2>{getDepartmentIcon(department)} {department} {t('adminPanel')}</h2>
                <p className="text-muted mb-0">{t('manageDepartment')}</p>
              </div>
            </div>
            <div className="d-flex align-items-center gap-3">
              <span className="text-muted">{t('welcome')}, <strong>{admin?.name}</strong></span>
              
              {/* Admin Notification Center */}
              <AdminNotificationCenter />
              
              {/* Admin Language Selector */}
              <AdminLanguageSelector />
              
              <button 
                className="btn btn-outline-danger btn-sm" 
                onClick={handleLogoutClick}
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 {t('dashboard')}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            📋 {t('manageRequests')}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ {t('settings')}
          </button>
        </li>
      </ul>

      {/* Tab Content */}
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'requests' && renderRequests()}
      {activeTab === 'settings' && renderSettings()}

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

      {/* Site İçi Admin Logout Onay Modalı */}
      <ConfirmationModal
        show={showLogoutModal}
        title="FIU Admin Panel"
        message="Admin oturumunu kapatmak istediğinizden emin misiniz?"
        confirmText="Tamam"
        cancelText="İptal"
        type="warning"
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
      />

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
          className={`btn ${isDark ? 'btn-light' : 'btn-dark'}`}
          onClick={toggleTheme}
          style={{
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            fontSize: '1.5rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s ease'
          }}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
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