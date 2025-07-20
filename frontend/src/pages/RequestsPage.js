import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation'; // YENİ EKLENEN
import AttachmentViewer from '../components/AttachmentViewer';

const RequestsPage = () => {
  const { user } = useAuth();
  const { t } = useTranslation(); // YENİ EKLENEN
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [expandedRequests, setExpandedRequests] = useState(new Set());
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [selectedRequestForResponses, setSelectedRequestForResponses] = useState(null);
  const [showResponsesModal, setShowResponsesModal] = useState(false);

  const studentId = user?.student_id || 1;

  useEffect(() => {
    const loadRequests = async () => {
      try {
        setLoading(true);
        const response = await apiService.getStudentRequests(studentId);
        setRequests(response.data.data);
      } catch (error) {
        console.error('Error fetching requests:', error);
        setError('Failed to load requests');
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [studentId]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await apiService.getStudentRequests(studentId);
      setRequests(response.data.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
      setError('Failed to load requests');
    } finally {
      setLoading(false);
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

  const getStatusIcon = (status) => {
    const statusIcons = {
      'Pending': '⏳',
      'Informed': '💬',
      'Completed': '✅'
    };
    return statusIcons[status] || '📋';
  };

  const getPriorityBadge = (priority) => {
    const priorityStyles = {
      'Urgent': 'bg-danger text-white',
      'High': 'bg-warning text-dark', 
      'Medium': 'bg-info text-white',
      'Low': 'bg-secondary text-white'
    };
    return priorityStyles[priority] || 'bg-secondary text-white';
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

  const filteredRequests = requests.filter(request => {
    if (filter === 'all') return true;
    return request.status === filter;
  });

  const toggleExpanded = (requestId) => {
    const newExpanded = new Set(expandedRequests);
    if (newExpanded.has(requestId)) {
      newExpanded.delete(requestId);
    } else {
      newExpanded.add(requestId);
    }
    setExpandedRequests(newExpanded);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  };

  // StudentResponseViewer Component
  const StudentResponseViewer = ({ requestId, requestTitle, onClose }) => {
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      fetchResponses();
    }, [requestId]);

    const fetchResponses = async () => {
      try {
        setLoading(true);
        const response = await apiService.getRequestResponses(requestId);
        if (response.data.success) {
          setResponses(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching responses:', error);
      } finally {
        setLoading(false);
      }
    };

    const handleBackdropClick = (e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    };

    return (
      <>
        {/* Modal Backdrop */}
        <div 
          className="modal-backdrop fade show" 
          style={{ zIndex: 1040 }}
          onClick={handleBackdropClick}
        ></div>

        {/* Modal */}
        <div 
          className="modal fade show d-block" 
          tabIndex="-1"
          style={{ zIndex: 1050 }}
        >
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  💬 Responses for: {requestTitle}
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={onClose}
                ></button>
              </div>
              
              <div className="modal-body">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status"></div>
                    <p className="mt-3">{t('loading')}...</p>
                  </div>
                ) : responses.length === 0 ? (
                  <div className="text-center py-5">
                    <div className="text-muted">
                      <div style={{ fontSize: '4rem' }}>💬</div>
                      <h5 className="mt-3">No Responses Yet</h5>
                      <p>The admin hasn't responded to this request yet.</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h6 className="mb-3">Admin Responses ({responses.length})</h6>
                    {responses.map((response, index) => (
                      <div key={response.response_id} className="card mb-3">
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="d-flex align-items-center">
                              <span className="badge bg-primary me-2">#{index + 1}</span>
                              <strong className="text-primary">
                                👨‍💼 {response.created_by_admin}
                              </strong>
                            </div>
                            <small className="text-muted">
                              📅 {new Date(response.created_at).toLocaleDateString()} 
                              🕐 {new Date(response.created_at).toLocaleTimeString()}
                            </small>
                          </div>
                          <div className="bg-light p-3 rounded">
                            <p className="mb-0">{response.response_content}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="modal-footer">
                <div className="text-muted small me-auto">
                  {responses.length} response(s) found
                </div>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">{t('loading')}</span>
        </div>
        <p className="mt-3 text-muted">{t('loading')} your requests...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <h4 className="alert-heading">{t('error')}!</h4>
        <p>{error}</p>
        <hr />
        <button className="btn btn-outline-danger" onClick={fetchRequests}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">{t('myRequests')}</h2>
          <p className="text-muted mb-0">Track and manage your guidance requests</p>
        </div>
        <Link to="/create-request" className="btn btn-primary">
          <i className="bi bi-plus-circle me-2"></i>
          {t('createRequest')}
        </Link>
      </div>

      {/* Stats */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <h3 className="text-primary mb-1">{requests.length}</h3>
              <small className="text-muted">{t('totalRequests')}</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <h3 className="text-warning mb-1">{requests.filter(r => r.status === 'Pending').length}</h3>
              <small className="text-muted">{t('pending')}</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <h3 className="text-info mb-1">{requests.filter(r => r.status === 'Informed').length}</h3>
              <small className="text-muted">{t('informed')}</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <h3 className="text-success mb-1">{requests.filter(r => r.status === 'Completed').length}</h3>
              <small className="text-muted">{t('completed')}</small>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setFilter('all')}
          >
            All ({requests.length})
          </button>
          <button
            type="button"
            className={`btn ${filter === 'Pending' ? 'btn-warning' : 'btn-outline-warning'}`}
            onClick={() => setFilter('Pending')}
          >
            {t('pending')} ({requests.filter(r => r.status === 'Pending').length})
          </button>
          <button
            type="button"
            className={`btn ${filter === 'Informed' ? 'btn-info' : 'btn-outline-info'}`}
            onClick={() => setFilter('Informed')}
          >
            {t('informed')} ({requests.filter(r => r.status === 'Informed').length})
          </button>
          <button
            type="button"
            className={`btn ${filter === 'Completed' ? 'btn-success' : 'btn-outline-success'}`}
            onClick={() => setFilter('Completed')}
          >
            {t('completed')} ({requests.filter(r => r.status === 'Completed').length})
          </button>
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-5">
          <div className="mb-4">
            <i className="bi bi-inbox display-1 text-muted"></i>
          </div>
          <h4 className="text-muted">
            {filter === 'all' ? t('noRequests') : `No ${filter.toLowerCase()} requests found`}
          </h4>
          <p className="text-muted mb-4">
            {filter === 'all' 
              ? "You haven't submitted any requests yet." 
              : `You don't have any ${filter.toLowerCase()} requests.`
            }
          </p>
          <Link to="/create-request" className="btn btn-primary">
            Create Your First Request
          </Link>
        </div>
      ) : (
        <div className="row">
          {filteredRequests.map((request) => {
            const isExpanded = expandedRequests.has(request.request_id);
            const submittedDate = formatDate(request.submitted_at);
            const updatedDate = formatDate(request.updated_at);
            
            return (
              <div key={request.request_id} className="col-12 mb-3">
                <div className="card shadow-sm">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="mb-1">
                        <span className="me-2">{getStatusIcon(request.status)}</span>
                        {request.type_name}
                      </h6>
                      <small className="text-muted">
                        Request #{request.request_id} • {request.category}
                      </small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      {request.priority && (
                        <span className={`badge ${getPriorityBadge(request.priority)}`}>
                          {getPriorityIcon(request.priority)} {t(request.priority.toLowerCase())}
                        </span>
                      )}
                      <span className={`badge ${getStatusBadge(request.status)}`}>
                        {t(request.status.toLowerCase())}
                      </span>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => toggleExpanded(request.request_id)}
                      >
                        {isExpanded ? 'Less' : 'More'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="card-body">
                    {/* Content */}
                    <div className="mb-3">
                      <p className="card-text">
                        {isExpanded ? request.content : 
                          (request.content.length > 100 ? 
                            request.content.substring(0, 100) + '...' : 
                            request.content
                          )
                        }
                      </p>
                    </div>

                    {/* Basic Info */}
                    <div className="row text-sm">
                      <div className="col-md-4">
                        <strong className="text-muted">{t('submitted')}:</strong><br/>
                        <span>{submittedDate.date}</span><br/>
                        <small className="text-muted">{submittedDate.time}</small>
                      </div>
                      <div className="col-md-4">
                        <strong className="text-muted">{t('updated')}:</strong><br/>
                        <span>{updatedDate.date}</span><br/>
                        <small className="text-muted">{updatedDate.time}</small>
                      </div>
                      <div className="col-md-4">
                        <strong className="text-muted">{t('attachments')}:</strong><br/>
                        <span className={request.attachment_count > 0 ? 'text-success' : 'text-muted'}>
                          {request.attachment_count} file(s)
                          {request.attachment_count > 0 && (
                            <i className="ms-1 bi bi-paperclip"></i>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Expanded Information */}
                    {isExpanded && (
                      <div className="mt-4 pt-3 border-top">
                        <div className="row">
                          <div className="col-md-6">
                            <h6>Timeline</h6>
                            <div className="timeline">
                              <div className="timeline-item">
                                <span className="badge bg-primary">Created</span>
                                <span className="ms-2">{submittedDate.date} at {submittedDate.time}</span>
                              </div>
                              {request.updated_at !== request.submitted_at && (
                                <div className="timeline-item mt-2">
                                  <span className="badge bg-info">{t('updated')}</span>
                                  <span className="ms-2">{updatedDate.date} at {updatedDate.time}</span>
                                </div>
                              )}
                              {request.resolved_at && (
                                <div className="timeline-item mt-2">
                                  <span className="badge bg-success">{t('resolved')}</span>
                                  <span className="ms-2">{formatDate(request.resolved_at).date} at {formatDate(request.resolved_at).time}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="col-md-6">
                            <h6>Actions</h6>
                            <div className="d-flex gap-2 flex-wrap">
                              {request.attachment_count > 0 && (
                                <button 
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => {
                                    setSelectedRequestId(request.request_id);
                                    setShowAttachments(true);
                                  }}
                                >
                                  📎 {t('viewFiles')} ({request.attachment_count})
                                </button>
                              )}
                              
                              {(request.status === 'Informed' || request.status === 'Completed') && (
                                <button 
                                  className="btn btn-sm btn-outline-info"
                                  onClick={() => {
                                    setSelectedRequestForResponses({
                                      id: request.request_id,
                                      title: `#${request.request_id} - ${request.type_name}`
                                    });
                                    setShowResponsesModal(true);
                                  }}
                                >
                                  💬 {t('viewResponse')}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Help Section */}
      <div className="mt-5 pt-4 border-top">
        <div className="row">
          <div className="col-md-6">
            <h5>Need Help?</h5>
            <p className="text-muted">
              If you have questions about your requests or need assistance, please contact the guidance office.
            </p>
          </div>
          <div className="col-md-6">
            <h5>Request Status Guide</h5>
            <ul className="list-unstyled">
              <li><span className="badge bg-warning text-dark me-2">{t('pending')}</span> Your request is being reviewed</li>
              <li><span className="badge bg-info me-2">{t('informed')}</span> Response provided, may need follow-up</li>
              <li><span className="badge bg-success me-2">{t('completed')}</span> Request fully resolved</li>
            </ul>
            
            <h5 className="mt-3">Priority Guide</h5>
            <ul className="list-unstyled">
              <li><span className="badge bg-secondary me-2">🔵 {t('low')}</span> Non-urgent requests</li>
              <li><span className="badge bg-info me-2">🟡 {t('medium')}</span> Standard requests</li>
              <li><span className="badge bg-warning text-dark me-2">🟠 {t('high')}</span> Important requests</li>
              <li><span className="badge bg-danger me-2">🔴 {t('urgent')}</span> Immediate attention required</li>
            </ul>
          </div>
        </div>
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

      {/* Student Response Viewer Modal */}
      {showResponsesModal && selectedRequestForResponses && (
        <StudentResponseViewer 
          requestId={selectedRequestForResponses.id}
          requestTitle={selectedRequestForResponses.title}
          onClose={() => {
            setShowResponsesModal(false);
            setSelectedRequestForResponses(null);
          }}
        />
      )}
    </div>
  );
};

export default RequestsPage;