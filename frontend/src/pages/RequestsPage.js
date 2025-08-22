// frontend/src/pages/RequestsPage.js - UPDATED WITH TABLE AND MODAL
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../contexts/ThemeContext';
import AttachmentViewer from '../components/AttachmentViewer';

const RequestsPage = () => {
  const { user } = useAuth();
  const { t, translateRequestType } = useTranslation();
  const { isDark } = useTheme();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [showAttachments, setShowAttachments] = useState(false);
  const [selectedRequestForResponses, setSelectedRequestForResponses] = useState(null);
  const [showResponsesModal, setShowResponsesModal] = useState(false);
  const [selectedRequestDetails, setSelectedRequestDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

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
        const sortedRequests = response.data.data.sort((a, b) => 
          new Date(b.submitted_at) - new Date(a.submitted_at)
        );
        setRequests(sortedRequests);
      } catch (error) {
        console.error('Error fetching requests:', error);
setError(t('failed_to_load_requests'));
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [studentId]);

  const fetchRejectionDetails = async (requestId) => {
    if (rejectionDetails[requestId]) {
      return rejectionDetails[requestId];
    }

    try {
      setLoadingRejectionDetails(true);
      console.log('Fetching rejection details for request:', requestId);
      
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
setError(t('failed_to_load_requests'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      'Pending': 'bg-warning text-white',
      'Informed': 'bg-info text-white',
      'Completed': 'bg-success text-white',
      'Rejected': 'bg-danger text-white'
    };
    return statusStyles[status] || 'bg-secondary text-white';
  };

  const getPriorityBadge = (priority) => {
    const priorityStyles = {
      'Urgent': 'bg-danger text-white',
      'High': 'bg-high text-white',
      'Medium': 'bg-medium text-white',
      'Low': 'bg-secondary text-white'
    };
    return priorityStyles[priority] || 'bg-secondary text-white';
  };

  const filteredRequests = requests
    .filter(request => {
      if (filter === 'all') return true;
      return request.status === filter;
    })
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

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
                backgroundColor: isDark ? '#2d3748' : '#ffffff',
                borderColor: isDark ? '#718096' : '#dee2e6',
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
                    : (isDark ? '#2d3748' : '#ffffff'),
                  borderColor: currentPage === index + 1 
                    ? '#dc2626' 
                    : (isDark ? '#718096' : '#dee2e6'),
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
                backgroundColor: isDark ? '#2d3748' : '#ffffff',
                borderColor: isDark ? '#718096' : '#dee2e6',
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

  // Request Details Modal Component
  const RequestDetailsModal = ({ request, onClose }) => {
    if (!request) return null;

    const submittedDate = formatDate(request.submitted_at);
    const updatedDate = formatDate(request.updated_at);

    return (
      <>
        <div
          className="modal-backdrop fade show"
          style={{ zIndex: 1040 }}
          onClick={onClose}
        ></div>

        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ zIndex: 1050 }}
        >
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div 
              className="modal-content"
              style={{
                backgroundColor: isDark ? '#2d3748' : '#ffffff',
                borderColor: isDark ? '#718096' : '#e2e8f0',
                color: isDark ? '#ffffff' : '#000000'
              }}
            >
              <div 
                className="modal-header"
                style={{
                  backgroundColor: isDark ? '#4a5568' : '#f7fafc',
                  borderColor: isDark ? '#718096' : '#e2e8f0'
                }}
              >
                <h5 className="modal-title">
                 {t('request_details')}
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={onClose}
                  style={{
                    filter: isDark ? 'invert(1)' : 'none'
                  }}
                ></button>
              </div>

              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6">
                    <div className="mb-3">
<label className="form-label fw-bold">{t('requestType')}:</label>
                      <div 
                        className="p-2 rounded border"
                        style={{
                          backgroundColor: isDark ? '#4a5568' : '#f8f9fa',
                          borderColor: isDark ? '#718096' : '#e2e8f0'
                        }}
                      >
                        {translateRequestType(request.type_name)}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
<label className="form-label fw-bold">{t('priority')}:</label>
                      <div>
                        <span className={`badge ${getPriorityBadge(request.priority)}`}>
                          {t(request.priority.toLowerCase())}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
<label className="form-label fw-bold">{t('status')}:</label>
                  <div>
                    <span className={`badge ${getStatusBadge(request.status)}`}>
                      {t(request.status.toLowerCase())}
                    </span>
                  </div>
                </div>

                <div className="mb-3">
<label className="form-label fw-bold">{t('content')}:</label>
                  <div 
                    className="p-3 rounded border"
                    style={{
                      backgroundColor: isDark ? '#4a5568' : '#f8f9fa',
                      borderColor: isDark ? '#718096' : '#e2e8f0',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.6'
                    }}
                  >
                    {request.content}
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-6">
                    <div className="mb-3">
<label className="form-label fw-bold">{t('submitted')}:</label>
                      <div className={isDark ? 'text-light' : 'text-muted'}>
                        <div>{submittedDate.date}</div>
                        <small>{submittedDate.time}</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
<label className="form-label fw-bold">{t('last_updated')}:</label>
                      <div className={isDark ? 'text-light' : 'text-muted'}>
                        <div>{updatedDate.date}</div>
                        <small>{updatedDate.time}</small>
                      </div>
                    </div>
                  </div>
                </div>

                {request.attachment_count > 0 && (
                  <div className="mb-3">
<label className="form-label fw-bold">{t('attachments')}:</label>                    <div>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => {
                          setSelectedRequestId(request.request_id);
                          setShowAttachments(true);
                          onClose();
                        }}
                      >
                       {t('viewFiles')} ({request.attachment_count})
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div 
                className="modal-footer"
                style={{
                  backgroundColor: isDark ? '#4a5568' : '#f7fafc',
                  borderColor: isDark ? '#718096' : '#e2e8f0'
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                   {t('close')}
                </button>
                
                {(request.status === 'Informed' || request.status === 'Completed') && (
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      setSelectedRequestForResponses({
                        id: request.request_id,
                        title: `#${request.request_id} - ${request.type_name}`
                      });
                      setShowResponsesModal(true);
                      onClose();
                    }}
                  >
                   {t('view_responses')}
                  </button>
                )}

                {request.status === 'Rejected' && (
                  <button
                    className="btn btn-danger"
                    onClick={async () => {
                      const details = await fetchRejectionDetails(request.request_id);
                      if (details) {
                        setSelectedRequestForRejectionDetails({
                          requestId: request.request_id,
                          reason: details.reason,
                          additional_info: details.additional_info || '',
                          rejected_at: details.rejected_at,
                          admin_name: details.admin_name || 'Unknown Admin'
                        });
                        setShowRejectionDetailsModal(true);
                        onClose();
                      }
                    }}
                    disabled={loadingRejectionDetails}
                  >
  {loadingRejectionDetails ? t('loading') + '...' : t('view_rejection_reason')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  // Student Response Viewer Component
  const StudentResponseViewer = ({ requestId, requestTitle, onClose }) => {
    const [responses, setResponses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchResponses = useCallback(async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching student responses for request:', requestId);
        
        const response = await apiService.getRequestResponses(requestId);
        
        console.log('Student responses response:', response.data);
        
        if (response.data.success) {
          setResponses(response.data.data || []);
          console.log(`Loaded ${response.data.data.length} responses`);
        } else {
          setError('Failed to load responses');
          console.error('Failed to load responses:', response.data);
        }
      } catch (error) {
        console.error('Error fetching student responses:', error);
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
        <div
          className="modal-backdrop fade show"
          style={{ zIndex: 1040 }}
          onClick={handleBackdropClick}
        ></div>

        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ zIndex: 1050 }}
        >
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div 
              className="modal-content"
              style={{
                backgroundColor: isDark ? '#2d3748' : '#ffffff',
                borderColor: isDark ? '#718096' : '#e2e8f0',
                color: isDark ? '#ffffff' : '#000000'
              }}
            >
              <div 
                className="modal-header"
                style={{
                  backgroundColor: isDark ? '#4a5568' : '#f7fafc',
                  borderColor: isDark ? '#718096' : '#e2e8f0'
                }}
              >
                <h5 className="modal-title">
                  {t('responses_for')} 
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={onClose}
                  style={{
                    filter: isDark ? 'invert(1)' : 'none'
                  }}
                ></button>
              </div>

              <div className="modal-body">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-danger" role="status"></div>
<p className="mt-3">{t('loading_responses')}...</p>
                  </div>
                ) : error ? (
                  <div className="alert alert-danger">
<h6>{t('error_loading_responses')}</h6>
                    <p className="mb-2">{error}</p>
                    <button className="btn btn-outline-danger btn-sm" onClick={fetchResponses}>
  {t('tryAgain')}
                    </button>
                  </div>
                ) : responses.length === 0 ? (
                  <div className="text-center py-5">
                    <div className={isDark ? 'text-light' : 'text-muted'}>
                      <div style={{ fontSize: '4rem' }}>💬</div>
                      <h5 className="mt-3">{t('noResponsesYet')}</h5>
                      <p>{t('adminHasntResponded')}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="mb-0">
                       {t('adminResponses')} ({responses.length})
                      </h6>
                      
                    </div>
                    
                    {responses.map((response, index) => (
                      <div 
                        key={response.response_id || index} 
                        className="card mb-3 shadow-sm"
                        style={{
                          backgroundColor: isDark ? '#4a5568' : '#ffffff',
                          borderColor: isDark ? '#718096' : '#e2e8f0'
                        }}
                      >
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start mb-3">
                            <div className="d-flex align-items-center">
                              <span className="badge bg-danger me-2">#{index + 1}</span>
                              <div>
                                <strong className="text-danger d-block">
                                  {response.created_by_admin || 'Admin'}
                                </strong>
                                <small className={isDark ? 'text-light' : 'text-muted'}>
                                  {new Date(response.created_at).toLocaleDateString()}
                                  {' '}{new Date(response.created_at).toLocaleTimeString()}
                                </small>
                              </div>
                            </div>
                          </div>
                          
                          <div 
                            className="p-3 rounded border-start border-danger border-4"
                            style={{
                              backgroundColor: isDark ? '#2d3748' : '#f8f9fa'
                            }}
                          >
                            <p className="mb-0" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                              {response.response_content}
                            </p>
                          </div>
                          
                          {response.attachments && response.attachments.length > 0 && (
                            <div 
                              className="mt-3 p-2 rounded"
                              style={{
                                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)'
                              }}
                            >
                              <small className="text-info fw-bold">
                              {t('attachments')} ({response.attachments.length}):
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

              <div 
                className="modal-footer"
                style={{
                  backgroundColor: isDark ? '#4a5568' : '#f7fafc',
                  borderColor: isDark ? '#718096' : '#e2e8f0'
                }}
              >
                <div className={`small me-auto ${isDark ? 'text-light' : 'text-muted'}`}>
                 
                </div>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  {t('Close')}
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
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">{t('loading')}</span>
        </div>
        <p className="mt-3 text-muted">{t('loading_your_requests')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <h4 className="alert-heading">{t('error')}</h4>
        <p>{error}</p>
        <hr />
        <button className="btn btn-outline-danger" onClick={fetchRequests}>
                 {t('tryAgain')}
        </button>
      </div>
    );
  }

  // Pagination calculations
  const totalPages = getTotalPages(filteredRequests.length, itemsPerPage);
  const paginatedRequests = getPaginatedData(filteredRequests, currentPage, itemsPerPage);

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">{t('myRequests')}</h2>
          <p className={`mb-0 ${isDark ? 'text-light' : 'text-muted'}`}>{t('track_and_manage_requests')}</p>
        </div>
        <Link to="/create-request" className="btn btn-danger">
          
         {t('createRequest')}
        </Link>
      </div>

     

      {/* Filters */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn ${filter === 'all' ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={() => {
              setFilter('all');
              setCurrentPage(1);
            }}
          >
           {t('view_all')} ({requests.length})
          </button>
          <button
            type="button"
            className={`btn ${filter === 'Pending' ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={() => {
              setFilter('Pending');
              setCurrentPage(1);
            }}
          >
           {t('pending')} ({requests.filter(r => r.status === 'Pending').length})
          </button>
          <button
            type="button"
            className={`btn ${filter === 'Informed' ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={() => {
              setFilter('Informed');
              setCurrentPage(1);
            }}
          >
           {t('informed')}  ({requests.filter(r => r.status === 'Informed').length})
          </button>
          <button
            type="button"
            className={`btn ${filter === 'Completed' ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={() => {
              setFilter('Completed');
              setCurrentPage(1);
            }}
          >
           {t('completed')} ({requests.filter(r => r.status === 'Completed').length})
          </button>
          <button
            type="button"
            className={`btn ${filter === 'Rejected' ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={() => {
              setFilter('Rejected');
              setCurrentPage(1);
            }}
          >
            {t('rejected')} ({requests.filter(r => r.status === 'Rejected').length})
          </button>
        </div>

        <div className={`text-sm ${isDark ? 'text-light' : 'text-muted'}`}>
        </div>
      </div>

      {/* Requests Table */}
      <div 
        className="card"
        style={{
          backgroundColor: isDark ? '#2d3748' : '#ffffff',
          borderColor: isDark ? '#718096' : '#e2e8f0'
        }}
      >
        <div className="card-body">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-5">
              <div className="mb-4">
                <i className="bi bi-inbox display-1 text-muted"></i>
              </div>
              <h4 className={isDark ? 'text-light' : 'text-muted'}>
                {filter === 'all' ? 'No Requests' : `No Requests Found (${filter})`}
              </h4>
              <p className={`mb-4 ${isDark ? 'text-light' : 'text-muted'}`}>
                {filter === 'all' ? 'You haven\'t submitted any requests yet.' : `No ${filter.toLowerCase()} requests found.`}
              </p>
              {filter === 'all' && (
                <Link to="/create-request" className="btn btn-danger">
                {t('create_your_first_request')}
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead className={isDark ? 'table-dark' : 'table-light'}>
                    <tr>
                      
                      <th>{t('type')}</th>
                      <th>{t('content')}</th>
                      <th>{t('priority')}</th>
                      <th>{t('status')}</th>
                      <th>{t('submitted')}</th>
                      
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRequests.map((request) => {
                      const submittedDate = formatDate(request.submitted_at);

                      return (
                        <tr 
                          key={request.request_id}
                          className={isDark ? 'text-light' : ''}
                          style={{
                            backgroundColor: isDark ? 'transparent' : '#ffffff',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setSelectedRequestDetails(request);
                            setShowDetailsModal(true);
                          }}
                        >
                         
                          <td>
                            <div className="fw-semibold">
                              {translateRequestType(request.type_name)}
                            </div>
                          </td>
                          <td>
                            <div 
                              className="text-truncate" 
                              style={{ maxWidth: '200px' }}
                              title={request.content}
                            >
                              {request.content}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${getPriorityBadge(request.priority)}`}>
                              {t(request.priority.toLowerCase())}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${getStatusBadge(request.status)}`}>
                              {t(request.status.toLowerCase())}
                            </span>
                          </td>
                          <td>
                            <div>
                              <div className="fw-semibold">{submittedDate.date}</div>
                              <small className={isDark ? 'text-light' : 'text-muted'}>
                                {submittedDate.time}
                              </small>
                            </div>
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm" role="group">
                             

                              

                              
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <PaginationComponent 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </div>

     

      {/* Request Details Modal */}
      {showDetailsModal && selectedRequestDetails && (
        <RequestDetailsModal
          request={selectedRequestDetails}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedRequestDetails(null);
          }}
        />
      )}

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

      {/* Rejection Details Modal */}
      {showRejectionDetailsModal && selectedRequestForRejectionDetails && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 1040 }}
            onClick={() => setShowRejectionDetailsModal(false)}
          ></div>

          <div
            className="modal fade show d-block"
            tabIndex="-1"
            style={{ zIndex: 1050 }}
          >
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div 
                className="modal-content"
                style={{
                  backgroundColor: isDark ? '#2d3748' : '#ffffff',
                  borderColor: isDark ? '#718096' : '#e2e8f0',
                  color: isDark ? '#ffffff' : '#000000'
                }}
              >
                <div 
                  className="modal-header"
                  style={{
                    backgroundColor: isDark ? '#4a5568' : '#f7fafc',
                    borderColor: isDark ? '#718096' : '#e2e8f0'
                  }}
                >
                  <h5 className="modal-title text-danger">
                   {t('rejection_details')}
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
                  {loadingRejectionDetails ? (
                    <div className="text-center py-4">
                      <div className="spinner-border text-danger" role="status"></div>
                      <p className="mt-3">{t('loading')}</p>
                    </div>
                  ) : (
                    <div 
                      className="card border-danger"
                      style={{
                        backgroundColor: isDark ? '#4a5568' : '#ffffff',
                        borderColor: '#dc3545'
                      }}
                    >
                      <div className="card-header bg-danger text-white">
                        <h6 className="mb-0">
                          {t('why_was_this_request_rejected')}
                        </h6>
                      </div>
                      <div className="card-body">
                        <div className="mb-3">
                          <label className="form-label fw-bold">{t('rejection_reason')}</label>
                          <div 
                            className="p-3 rounded border"
                            style={{
                              backgroundColor: isDark ? '#2d3748' : '#f8f9fa',
                              borderColor: isDark ? '#718096' : '#e2e8f0'
                            }}
                          >
                            {selectedRequestForRejectionDetails.reason || t('no_reason_provided')}
                          </div>
                        </div>

                        {selectedRequestForRejectionDetails.additional_info && (
                          <div className="mb-3">
                            <label className="form-label fw-bold">{t('additional_information')}</label>
                            <div 
                              className="p-3 rounded border"
                              style={{
                                backgroundColor: isDark ? '#2d3748' : '#f8f9fa',
                                borderColor: isDark ? '#718096' : '#e2e8f0'
                              }}
                            >
                              {selectedRequestForRejectionDetails.additional_info}
                            </div>
                          </div>
                        )}

                        <div className="row">
                          <div className="col-md-6">
                            <label className="form-label fw-bold">{t('rejected_date')}</label>
                            <p className={isDark ? 'text-light' : 'text-muted'}>
                              {selectedRequestForRejectionDetails.rejected_at 
                                ? new Date(selectedRequestForRejectionDetails.rejected_at).toLocaleString()
                                : t('unknown')
                              }
                            </p>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label fw-bold">{t('rejected_by')}</label>
                            <p className={isDark ? 'text-light' : 'text-muted'}>
                              {selectedRequestForRejectionDetails.admin_name || 'Unknown Admin'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div 
                    className="alert alert-info mt-3"
                    style={{
                      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                      borderColor: '#3b82f6',
                      color: isDark ? '#ffffff' : '#000000'
                    }}
                  >
                    <h6 className="alert-heading">
                      {t('what_can_you_do_next')}
                    </h6>
                    <ul className="mb-0">
                     <li>{t('review_rejection_reason')}</li>
                   
                      <li>{t('submit_new_request_corrections')}</li>
                      <li>{t('contact_student_support')}</li>
                    </ul>
                  </div>
                </div>
                
                <div 
                  className="modal-footer"
                  style={{
                    backgroundColor: isDark ? '#4a5568' : '#f7fafc',
                    borderColor: isDark ? '#718096' : '#e2e8f0'
                  }}
                >
                  <div className={`small me-auto ${isDark ? 'text-light' : 'text-muted'}`}>
                   {t('request')} #{selectedRequestForRejectionDetails.requestId}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowRejectionDetailsModal(false)}
                  >
                      {t('close')}
                  </button>
                  <Link 
                    to="/create-request" 
                    className="btn btn-danger"
                    onClick={() => setShowRejectionDetailsModal(false)}
                  >
                   {t('submit_new_request')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Custom CSS for better table styling */}
      <style jsx>{`
        .table-hover tbody tr:hover {
          background-color: ${isDark ? 'rgba(113, 128, 150, 0.1)' : 'rgba(0, 0, 0, 0.05)'} !important;
        }
        
        .text-truncate {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .btn-group .btn {
          border-radius: 0.25rem !important;
          margin-right: 2px;
        }
        
        .btn-group .btn:last-child {
          margin-right: 0;
        }
        
        @media (max-width: 768px) {
          .btn-group {
            flex-direction: column;
            width: 100%;
          }
          
          .btn-group .btn {
            width: 100%;
            margin-bottom: 2px;
            margin-right: 0;
          }
          
          .table-responsive {
            font-size: 0.875rem;
          }
        }
      `}</style>
    </div>
  );
};

export default RequestsPage;