// frontend/src/pages/RequestsPage.js - FIXED VERSION
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import AttachmentViewer from '../components/AttachmentViewer';

const RequestsPage = () => {
  const { user } = useAuth();
  const { t, translateRequestType } = useTranslation();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [expandedRequests, setExpandedRequests] = useState(new Set());
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [selectedRequestForResponses, setSelectedRequestForResponses] = useState(null);
  const [showResponsesModal, setShowResponsesModal] = useState(false);

  // Rejection details state
  const [rejectionDetails, setRejectionDetails] = useState({});
  const [loadingRejectionDetails, setLoadingRejectionDetails] = useState(false);
  const [selectedRequestForRejectionDetails, setSelectedRequestForRejectionDetails] = useState(null);
  const [showRejectionDetailsModal, setShowRejectionDetailsModal] = useState(false);

  const studentId = user?.student_id || 1;

  useEffect(() => {
    const loadRequests = async () => {
      try {
        setLoading(true);
        const response = await apiService.getStudentRequests(studentId);
        // Sort requests by submission date (newest first)
        const sortedRequests = response.data.data.sort((a, b) => 
          new Date(b.submitted_at) - new Date(a.submitted_at)
        );
        setRequests(sortedRequests);
      } catch (error) {
        console.error('Error fetching requests:', error);
        setError('Failed to load requests');
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [studentId]);

  // FIXED: Fetch rejection details for students
  const fetchRejectionDetails = async (requestId) => {
    if (rejectionDetails[requestId]) {
      return rejectionDetails[requestId];
    }

    try {
      setLoadingRejectionDetails(true);
      console.log('📋 Fetching rejection details for request:', requestId);
      
      // Use the student API endpoint for rejection details
      const response = await apiService.getStudentRejectionDetails(requestId);

      if (response.data.success) {
        const details = response.data.data;
        setRejectionDetails(prev => ({
          ...prev,
          [requestId]: details
        }));
        return details;
      } else {
        console.error('Failed to fetch rejection details:', response.data);
        return null;
      }
    } catch (error) {
      console.error('Error fetching rejection details:', error);
      return null;
    } finally {
      setLoadingRejectionDetails(false);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await apiService.getStudentRequests(studentId);
      const sortedRequests = response.data.data.sort((a, b) => 
        new Date(b.submitted_at) - new Date(a.submitted_at)
      );
      setRequests(sortedRequests);
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
      'Completed': 'bg-success text-white',
      'Rejected': 'bg-danger text-white'
    };
    return statusStyles[status] || 'bg-secondary text-white';
  };

  const getStatusIcon = (status) => {
    const statusIcons = {
      'Pending': '⏳',
      'Informed': '💬',
      'Completed': '✅',
      'Rejected': '🚫'
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

  const filteredRequests = requests
    .filter(request => {
      if (filter === 'all') return true;
      return request.status === filter;
    })
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

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

  // FIXED: Student Response Viewer Component
  const StudentResponseViewer = ({ requestId, requestTitle, onClose }) => {
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchResponses = useCallback(async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('📋 Fetching student responses for request:', requestId);
        
        // Use the correct student API endpoint
        const response = await apiService.getRequestResponses(requestId);
        
        console.log('📋 Student responses response:', response.data);
        
        if (response.data.success) {
          setResponses(response.data.data || []);
          console.log(`✅ Loaded ${response.data.data.length} responses`);
        } else {
          setError('Failed to load responses');
          console.error('❌ Failed to load responses:', response.data);
        }
      } catch (error) {
        console.error('❌ Error fetching student responses:', error);
        setError('Failed to load responses: ' + error.message);
      } finally {
        setLoading(false);
      }
    }, [requestId]);

    useEffect(() => {
      fetchResponses();
    }, [fetchResponses]);

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
                  💬 {t('responsesFor', 'Responses for')}: {requestTitle}
                </h5>
                <button type="button" className="btn-close" onClick={onClose}></button>
              </div>

              <div className="modal-body">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status"></div>
                    <p className="mt-3">{t('loadingResponses', 'Loading responses...')}</p>
                  </div>
                ) : error ? (
                  <div className="alert alert-danger">
                    <h6>❌ Error Loading Responses</h6>
                    <p className="mb-2">{error}</p>
                    <button className="btn btn-outline-danger btn-sm" onClick={fetchResponses}>
                      🔄 Try Again
                    </button>
                  </div>
                ) : responses.length === 0 ? (
                  <div className="text-center py-5">
                    <div className="text-muted">
                      <div style={{ fontSize: '4rem' }}>💬</div>
                      <h5 className="mt-3">{t('noResponsesYet', 'No responses yet')}</h5>
                      <p>{t('adminHasntResponded', 'The admin hasn\'t responded to this request yet.')}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="mb-0">
                        📋 {t('adminResponses', 'Admin Responses')} ({responses.length})
                      </h6>
                      <button className="btn btn-outline-primary btn-sm" onClick={fetchResponses}>
                        🔄 Refresh
                      </button>
                    </div>
                    
                    {responses.map((response, index) => (
                      <div key={response.response_id || index} className="card mb-3 shadow-sm">
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="d-flex align-items-center">
                              <span className="badge bg-primary me-2">#{index + 1}</span>
                              <div>
                                <strong className="text-primary d-block">
                                  👨‍💼 {response.created_by_admin || 'Admin'}
                                </strong>
                                <small className="text-muted">
                                  📅 {new Date(response.created_at).toLocaleDateString()}
                                  {' '}🕐 {new Date(response.created_at).toLocaleTimeString()}
                                </small>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-light p-3 rounded border-start border-primary border-4">
                            <p className="mb-0" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                              {response.response_content}
                            </p>
                          </div>
                          
                          {/* Show response attachments if any */}
                          {response.attachments && response.attachments.length > 0 && (
                            <div className="mt-3 p-2 bg-info bg-opacity-10 rounded">
                              <small className="text-info fw-bold">
                                📎 Attachments ({response.attachments.length}):
                              </small>
                              <div className="d-flex flex-wrap gap-1 mt-1">
                                {response.attachments.map((file, fileIndex) => (
                                  <span key={fileIndex} className="badge bg-info">
                                    {file.file_name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <div className="text-muted small me-auto">
                  {error ? 'Error loading responses' : `${responses.length} ${t('responsesFound', 'responses found')}`}
                </div>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  {t('close', 'Close')}
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
          <p className="text-muted mb-0">{t('trackAndManage')}</p>
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
        <div className="col-md-2">
          <div className="card text-center">
            <div className="card-body">
              <h3 className="text-warning mb-1">{requests.filter(r => r.status === 'Pending').length}</h3>
              <small className="text-muted">{t('pending')}</small>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card text-center">
            <div className="card-body">
              <h3 className="text-info mb-1">{requests.filter(r => r.status === 'Informed').length}</h3>
              <small className="text-muted">{t('informed')}</small>
            </div>
          </div>
        </div>
        <div className="col-md-2">
          <div className="card text-center">
            <div className="card-body">
              <h3 className="text-success mb-1">{requests.filter(r => r.status === 'Completed').length}</h3>
              <small className="text-muted">{t('completed')}</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card text-center">
            <div className="card-body">
              <h3 className="text-danger mb-1">{requests.filter(r => r.status === 'Rejected').length}</h3>
              <small className="text-muted">{t('rejected', 'Rejected')}</small>
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
            {t('viewAll')} ({requests.length})
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
          <button
            type="button"
            className={`btn ${filter === 'Rejected' ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={() => setFilter('Rejected')}
          >
             {t('rejected', 'Rejected')} ({requests.filter(r => r.status === 'Rejected').length})
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
            {filter === 'all' ? t('noRequests') : `${t('noRequestsFound')} (${t(filter.toLowerCase())})`}
          </h4>
          <p className="text-muted mb-4"></p>
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
                        {translateRequestType(request.type_name)}
                      </h6>
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
                        {isExpanded ? t('less', 'Less') : t('more', 'More')}
                      </button>
                    </div>
                  </div>

                  <div className="card-body">
                    {/* Content */}
                    <div className="mb-3">
                      <p className="card-text">
                        {isExpanded
                          ? request.content
                          : request.content.length > 100
                          ? request.content.substring(0, 100) + '...'
                          : request.content}
                      </p>
                    </div>

                    {/* Basic Info */}
                    <div className="row text-sm">
                      <div className="col-md-4">
                        <strong className="text-muted">{t('submitted')}:</strong>
                        <br />
                        <span>{submittedDate.date}</span>
                        <br />
                        <small className="text-muted">{submittedDate.time}</small>
                      </div>
                      <div className="col-md-4">
                        <strong className="text-muted">{t('updated')}:</strong>
                        <br />
                        <span>{updatedDate.date}</span>
                        <br />
                        <small className="text-muted">{updatedDate.time}</small>
                      </div>
                      <div className="col-md-4">
                        <strong className="text-muted">{t('attachments')}:</strong>
                        <br />
                        <span className={request.attachment_count > 0 ? 'text-success' : 'text-muted'}>
                          {request.attachment_count} file(s)
                          {request.attachment_count > 0 && <i className="ms-1 bi bi-paperclip"></i>}
                        </span>
                      </div>
                    </div>

                    {/* Expanded Information */}
                    {isExpanded && (
                      <div className="mt-4 pt-3 border-top">
                        <div className="row">
                          <div className="col-md-6">
                            <h6>{t('timeline')}</h6>
                            <div className="timeline">
                              <div className="timeline-item">
                                <span className="badge bg-primary">{t('created')}</span>
                                <span className="ms-2">
                                  {submittedDate.date} at {submittedDate.time}
                                </span>
                              </div>
                              {request.updated_at !== request.submitted_at && (
                                <div className="timeline-item mt-2">
                                  <span className="badge bg-info">{t('updated')}</span>
                                  <span className="ms-2">
                                    {updatedDate.date} at {updatedDate.time}
                                  </span>
                                </div>
                              )}
                              {request.status === 'Rejected' && request.rejected_at && (
                                <div className="timeline-item mt-2 d-flex align-items-center gap-2">
                                  <span className="badge bg-danger">{t('rejected', 'Rejected')}</span>
                                  <span className="ms-2">
                                    {formatDate(request.rejected_at).date} at {formatDate(request.rejected_at).time}
                                  </span>

                                  {/* FIXED: Rejection reason button */}
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={async () => {
                                      console.log('📋 Loading rejection details for request:', request.request_id);
                                      const details = await fetchRejectionDetails(request.request_id);
                                      if (details) {
                                        console.log('✅ Rejection details loaded:', details);
                                        setSelectedRequestForRejectionDetails({
                                          requestId: request.request_id,
                                          reason: details.reason,
                                          additional_info: details.additional_info || '',
                                          rejected_at: details.rejected_at,
                                          admin_name: details.admin_name || 'Unknown Admin'
                                        });
                                        setShowRejectionDetailsModal(true);
                                      } else {
                                        console.error('❌ Failed to load rejection details');
                                        alert('Failed to load rejection details. Please try again.');
                                      }
                                    }}
                                    disabled={loadingRejectionDetails}
                                  >
                                    {loadingRejectionDetails ? (
                                      <>
                                        <span className="spinner-border spinner-border-sm me-1"></span>
                                        Loading...
                                      </>
                                    ) : (
                                      <>
                                        🚫 {t('viewRejectionReason', 'View Rejection Reason')}
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                              {request.resolved_at && (
                                <div className="timeline-item mt-2">
                                  <span className="badge bg-success">{t('resolved')}</span>
                                  <span className="ms-2">
                                    {formatDate(request.resolved_at).date} at {formatDate(request.resolved_at).time}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="col-md-6">
                            <h6>{t('actions')}</h6>
                            <div className="d-flex gap-2 flex-wrap">
                              {/* File Attachments */}
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

                              {/* FIXED: View Responses - Updated conditions */}
                              {(request.status === 'Informed' || request.status === 'Completed') && (
                                <button
                                  className="btn btn-sm btn-outline-info"
                                  onClick={() => {
                                    console.log('💬 Opening responses modal for request:', request.request_id);
                                    setSelectedRequestForResponses({
                                      id: request.request_id,
                                      title: `#${request.request_id} - ${request.type_name}`
                                    });
                                    setShowResponsesModal(true);
                                  }}
                                >
                                  💬 {t('viewResponse', 'View Responses')}
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
            <h5>{t('needHelp')}</h5>
            <p className="text-muted">{t('needHelpDesc')}</p>
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

      {/* FIXED: Student Response Viewer Modal */}
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

      {/* FIXED: Rejection Details Modal */}
      {showRejectionDetailsModal && selectedRequestForRejectionDetails && (
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
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title text-danger">
                    🚫 {t('rejectionDetails', 'Rejection Details')} 
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowRejectionDetailsModal(false)}
                  ></button>
                </div>
                
                <div className="modal-body">
                  {loadingRejectionDetails ? (
                    <div className="text-center py-4">
                      <div className="spinner-border text-danger" role="status"></div>
                      <p className="mt-3">{t('loading', 'Loading...')}</p>
                    </div>
                  ) : (
                    <div className="card border-danger">
                      <div className="card-header bg-danger text-white">
                        <h6 className="mb-0">
                          <span className="me-2"></span>
                          Why was this request rejected?
                        </h6>
                      </div>
                      <div className="card-body">
                        <div className="mb-3">
                          <label className="form-label fw-bold">Rejection Reason:</label>
                          <div className="p-3 bg-light rounded border">
                            {selectedRequestForRejectionDetails.reason || 'No reason provided'}
                          </div>
                        </div>

                        {selectedRequestForRejectionDetails.additional_info && (
                          <div className="mb-3">
                            <label className="form-label fw-bold">Additional Information:</label>
                            <div className="p-3 bg-light rounded border">
                              {selectedRequestForRejectionDetails.additional_info}
                            </div>
                          </div>
                        )}

                        <div className="row">
                          <div className="col-md-6">
                            <label className="form-label fw-bold">Rejected Date:</label>
                            <p className="text-muted">
                              {selectedRequestForRejectionDetails.rejected_at 
                                ? new Date(selectedRequestForRejectionDetails.rejected_at).toLocaleString()
                                : 'Unknown'
                              }
                            </p>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label fw-bold">Rejected By:</label>
                            <p className="text-muted">
                              {selectedRequestForRejectionDetails.admin_name || 'Unknown Admin'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="alert alert-info mt-3">
                    <h6 className="alert-heading">
                      <span className="me-2">ℹ️</span>
                      What can you do next?
                    </h6>
                    <ul className="mb-0">
                      <li>Review the rejection reason carefully</li>
                      <li>If you think this was a mistake, contact the {selectedRequestForRejectionDetails.admin_name || 'admin'} directly</li>
                      <li>You can submit a new request with the required corrections</li>
                      <li>Contact student support if you need additional help</li>
                    </ul>
                  </div>
                </div>
                
                <div className="modal-footer">
                  <div className="text-muted small me-auto">
                    
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowRejectionDetailsModal(false)}
                  >
                    {t('close', 'Close')}
                  </button>
                  <Link 
                    to="/create-request" 
                    className="btn btn-primary"
                    onClick={() => setShowRejectionDetailsModal(false)}
                  >
                     Submit New Request
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RequestsPage;