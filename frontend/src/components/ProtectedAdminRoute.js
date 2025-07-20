import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { apiService } from '../services/api';
import AttachmentViewer from '../components/AttachmentViewer';

const AdminDashboardPage = () => {
  const { admin, logout, department } = useAdminAuth();
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

  const updateRequestStatus = async (requestId, newStatus, responseContent = '') => {
    try {
      await apiService.updateAdminRequestStatus(requestId, { 
        status: newStatus,
        response_content: responseContent || `Status updated to ${newStatus} by ${department} admin`
      });
      
      fetchRequests();
      alert(`Request #${requestId} status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating request status:', error);
      alert('Failed to update request status');
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

  const getStatusBadge = (status) => {
    const statusStyles = {
      'Pending': 'bg-warning text-dark',
      'Informed': 'bg-info text-white',
      'Completed': 'bg-success text-white'
    };
    return statusStyles[status] || 'bg-secondary text-white';
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
          <h3>{getDepartmentIcon(department)} {department} Dashboard</h3>
          <p className="text-muted">Welcome back, {admin?.name}</p>
        </div>
        <button className="btn btn-outline-danger" onClick={logout}>
          Logout
        </button>
      </div>
      
      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status"></div>
          <p>Loading dashboard...</p>
        </div>
      ) : dashboardData && dashboardData.totals ? (
        <div>
          {/* Statistics Cards */}
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

          {/* Request Types Stats */}
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
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setFilters({status: ''})}
          >
            🔄 
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
                    <span className={`badge ${getStatusBadge(request.status)}`}>
                      {request.status}
                    </span>
                  </div>
                  
                  <div className="card-body">
                    <p className="mb-3">
                      <strong>Content:</strong> {request.content}
                    </p>
                    
                    <div className="row text-sm mb-3">
                      <div className="col-md-3">
                        <strong>Student Email:</strong><br/>
                        <a href={`mailto:${request.student_email}`}>
                          {request.student_email}
                        </a>
                      </div>
                      <div className="col-md-3">
                        <strong>Submitted:</strong><br/>
                        {new Date(request.submitted_at).toLocaleDateString()} {new Date(request.submitted_at).toLocaleTimeString()}
                      </div>
                      <div className="col-md-3">
                        <strong>Last Updated:</strong><br/>
                        {new Date(request.updated_at).toLocaleDateString()} {new Date(request.updated_at).toLocaleTimeString()}
                      </div>
                      <div className="col-md-3">
                        <strong>Attachments:</strong><br/>
                        <span className={request.attachment_count > 0 ? 'text-success' : 'text-muted'}>
                          {request.attachment_count || 0} file(s)
                          {request.attachment_count > 0 && <i className="ms-1 bi bi-paperclip"></i>}
                        </span>
                      </div>
                    </div>
                    
                    <div className="d-flex gap-2 flex-wrap">
                      {request.status === 'Pending' && (
                        <>
                          <button
                            className="btn btn-info btn-sm"
                            onClick={() => updateRequestStatus(request.request_id, 'Informed')}
                          >
                            💬 Mark as Informed
                          </button>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => updateRequestStatus(request.request_id, 'Completed')}
                          >
                            ✅ Mark as Completed
                          </button>
                        </>
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
                        <span className="text-success fw-bold">
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
      <div className="mb-4">
        <h3>⚙️ Manage {department} Request Types</h3>
        <p className="text-muted">Enable or disable request types for students</p>
      </div>

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
              <button className="btn btn-outline-danger btn-sm" onClick={logout}>
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
    </div>
  );
};

export default AdminDashboardPage;