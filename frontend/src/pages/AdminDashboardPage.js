import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { apiService } from '../services/api';
import AttachmentViewer from '../components/AttachmentViewer';
import AdminResponseModal from '../components/AdminResponseModal';
import LanguageSelector from '../components/LanguageSelector';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

const AdminDashboardPage = () => {
  const [selectedRequestForResponse, setSelectedRequestForResponse] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const { admin, logout, department } = useAdminAuth();
  const { isDark, toggleTheme } = useTheme();
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

  // Add Request Type Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTypeData, setNewTypeData] = useState({
    type_name: '',
    description_en: '',
    is_document_required: false
  });

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

  const PriorityDropdown = ({ currentPriority, requestId, disabled = false }) => {
    const [selectedPriority, setSelectedPriority] = useState(currentPriority || 'Medium');
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
      setSelectedPriority(currentPriority || 'Medium');
    }, [currentPriority]);

    const handlePriorityChange = async (newPriority) => {
      if (newPriority === selectedPriority) return;
      
      setUpdating(true);
      try {
        await updateRequestPriority(requestId, newPriority);
        setSelectedPriority(newPriority);
      } catch (error) {
        setSelectedPriority(currentPriority);
      } finally {
        setUpdating(false);
      }
    };

    return (
      <div className="dropdown">
        <button
          className={`btn btn-sm dropdown-toggle btn-outline-primary`}
          type="button"
          data-bs-toggle="dropdown"
          disabled={disabled || updating}
          style={{ minWidth: '120px' }}
        >
          {updating ? (
            <>
              <span className="spinner-border spinner-border-sm me-1" role="status"></span>
              Updating...
            </>
          ) : (
            <>
              {getPriorityIcon(selectedPriority)} {selectedPriority}
            </>
          )}
        </button>
        <ul className="dropdown-menu">
          {['Low', 'Medium', 'High', 'Urgent'].map((priority) => (
            <li key={priority}>
              <button
                className="dropdown-item d-flex align-items-center"
                onClick={() => handlePriorityChange(priority)}
                disabled={priority === selectedPriority}
              >
                <span className={`badge ${getPriorityBadge(priority)} me-2`}>
                  {getPriorityIcon(priority)}
                </span>
                {priority}
                {priority === selectedPriority && (
                  <i className="bi bi-check-lg ms-auto text-success"></i>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderDashboard = () => (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3>{getDepartmentIcon(department)} {department} Dashboard</h3>
          <p className="text-muted">Welcome back, {admin?.name}</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button 
            className="btn btn-outline-danger btn-sm" 
            onClick={() => {
              if (window.confirm('Are you sure you want to logout?')) {
                logout();
              }
            }}
          >
            Logout
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status"></div>
          <p>Loading dashboard...</p>
        </div>
      ) : dashboardData && dashboardData.totals ? (
        <div>
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card bg-primary text-white">
                <div className="card-body text-center">
                  <h5>Total Requests</h5>
                  <h2>{dashboardData.totals.total_requests || 0}</h2>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-warning text-dark">
                <div className="card-body text-center">
                  <h5>Pending</h5>
                  <h2>{dashboardData.totals.pending || 0}</h2>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-info text-white">
                <div className="card-body text-center">
                  <h5>Informed</h5>
                  <h2>{dashboardData.totals.informed || 0}</h2>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-success text-white">
                <div className="card-body text-center">
                  <h5>Completed</h5>
                  <h2>{dashboardData.totals.completed || 0}</h2>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h5>Request Types Statistics</h5>
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
                  <h5>Quick Actions</h5>
                </div>
                <div className="card-body">
                  <button 
                    className="btn btn-outline-primary me-2 mb-2"
                    onClick={() => setActiveTab('requests')}
                  >
                    📋 View All Requests
                  </button>
                  <button 
                    className="btn btn-outline-warning me-2 mb-2"
                    onClick={() => {
                      setFilters({...filters, status: 'Pending'});
                      setActiveTab('requests');
                    }}
                  >
                    ⏳ View Pending ({dashboardData.totals.pending || 0})
                  </button>
                  <button 
                    className="btn btn-outline-info me-2 mb-2"
                    onClick={() => {
                      setFilters({...filters, status: 'Informed'});
                      setActiveTab('requests');
                    }}
                  >
                    💬 View Informed ({dashboardData.totals.informed || 0})
                  </button>
                  <button 
                    className="btn btn-outline-secondary me-2 mb-2"
                    onClick={() => setActiveTab('settings')}
                  >
                    ⚙️ Manage Request Types
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
        <h3>📋 Manage {department} Requests</h3>
        
        <div className="d-flex gap-2">
          <select
            className="form-select form-select-sm"
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
          >
            <option value="">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Informed">Informed</option>
            <option value="Completed">Completed</option>
          </select>
          
          <button 
            className="btn btn-outline-primary btn-sm"
            onClick={refreshRequests}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                Refreshing...
              </>
            ) : (
              <>
                🔄 Refresh
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status"></div>
          <p>Loading requests...</p>
        </div>
      ) : (
        <div className="row">
          {!requests || requests.length === 0 ? (
            <div className="col-12 text-center py-5">
              <div className="alert alert-info">
                <h5>No requests found</h5>
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
                      <PriorityDropdown 
                        currentPriority={request.priority}
                        requestId={request.request_id}
                        disabled={request.status === 'Completed'}
                      />
                      
                      <span className={`badge ${getStatusBadge(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="card-body">
                    <p className="mb-3">
                      <strong>Content:</strong> {request.content}
                    </p>
                    
                    {/* ✅ PRIORITY DISPLAY */}
                    <div className="mb-3">
                      <strong>Priority:</strong>
                      <span className={`badge ${getPriorityBadge(request.priority)} ms-2`}>
                        {getPriorityIcon(request.priority)} {request.priority || 'Medium'}
                      </span>
                    </div>
                    
                    <div className="row text-sm mb-3">
                      <div className="col-md-4">
                        <strong>Student Email:</strong><br/>
                        <a href={`mailto:${request.student_email}`}>
                          {request.student_email}
                        </a>
                      </div>
                      <div className="col-md-4">
                        <strong>Submitted:</strong><br/>
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
                        💬 {request.status === 'Pending' ? 'Add Response' : 'View/Add Response'}
                      </button>

                      {request.status === 'Pending' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => updateRequestStatus(request.request_id, 'Completed')}
                        >
                          ✅ Mark as Completed
                        </button>
                      )}
                      
                      {request.status === 'Informed' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => updateRequestStatus(request.request_id, 'Completed')}
                        >
                          ✅ Mark as Completed
                        </button>
                      )}
                      
                      {request.status === 'Completed' && (
                        <span className="text-success fw-bold me-2">
                          ✅ Request Completed
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
                          📎 View Files ({request.attachment_count})
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
          <h3>⚙️ Manage {department} Request Types</h3>
          <p className="text-muted">Enable or disable request types for students</p>
        </div>
        
        {/* ✅ ADD NEW REQUEST TYPE BUTTON */}
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          ➕ Add New Type
        </button>
      </div>

      {/* ✅ ADD NEW REQUEST TYPE FORM */}
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
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status"></div>
          <p>Loading request types...</p>
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
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2>{getDepartmentIcon(department)} {department} Admin Panel</h2>
              <p className="text-muted">Manage department requests and settings</p>
            </div>
            <div className="d-flex align-items-center gap-3">
              <span className="text-muted">Welcome, <strong>{admin?.name}</strong></span>
              
              {/* Language Selector */}
              <LanguageSelector variant="dropdown" />
              
              <button 
                className="btn btn-outline-danger btn-sm" 
                onClick={() => {
                  if (window.confirm('Are you sure you want to logout?')) {
                    logout();
                  }
                }}
              >
                Logout
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
            📊 Dashboard
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            📋 Manage Requests
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Settings
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

      {/* ✅ DARK MODE TOGGLE - FINAL VERSION */}
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