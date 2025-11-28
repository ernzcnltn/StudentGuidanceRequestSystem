import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const SecretaryExamRequestsPage = () => {
  const { admin } = useAdminAuth();
  const { showSuccess, showError } = useToast();
  const { isDark } = useTheme();

  const [examRequests, setExamRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [actionData, setActionData] = useState({
    secretary_notes: '',
    rejection_reason: ''
  });
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [previewFile, setPreviewFile] = useState(null); // 👈 YENİ

  useEffect(() => {
    loadExamRequests();
  }, []);

  const loadExamRequests = async () => {
    try {
      setLoading(true);
      const response = await apiService.getSecretaryExamRequests();
      if (response.data.success) {
        setExamRequests(response.data.data);
      }
    } catch (error) {
      console.error('Error loading exam requests:', error);
      showError('Failed to load exam requests');
    } finally {
      setLoading(false);
    }
  };

  const loadAttachments = async (requestId) => {
    try {
      setLoadingAttachments(true);
      const response = await apiService.getSecretaryExamRequestAttachments(requestId);
      if (response.data.success) {
        setAttachments(response.data.data);
      }
    } catch (error) {
      console.error('Error loading attachments:', error);
      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleViewDetails = async (request) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
    if (request.attachment_count > 0) {
      await loadAttachments(request.exam_request_id);
    }
  };

  const handleApproveClick = (request) => {
    setSelectedRequest(request);
    setActionType('approve');
    setActionData({ secretary_notes: '', rejection_reason: '' });
    setShowActionModal(true);
  };

  const handleRejectClick = (request) => {
    setSelectedRequest(request);
    setActionType('reject');
    setActionData({ secretary_notes: '', rejection_reason: '' });
    setShowActionModal(true);
  };

  const handleActionSubmit = async () => {
    if (!selectedRequest) return;

    if (actionType === 'reject' && !actionData.rejection_reason.trim()) {
      showError('Please provide a rejection reason');
      return;
    }

    try {
      setProcessing(true);
      
      if (actionType === 'approve') {
        await apiService.approveExamRequest(selectedRequest.exam_request_id, {
          secretary_notes: actionData.secretary_notes || null
        });
        showSuccess('Exam request approved successfully!');
      } else {
        await apiService.rejectExamRequest(selectedRequest.exam_request_id, {
          rejection_reason: actionData.rejection_reason,
          secretary_notes: actionData.secretary_notes || null
        });
        showSuccess('Exam request rejected successfully!');
      }

      setShowActionModal(false);
      setShowDetailModal(false);
      await loadExamRequests();
    } catch (error) {
      console.error('Error processing request:', error);
      showError(error.response?.data?.error || 'Failed to process request');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Pending': 'bg-warning text-dark',
      'Approved': 'bg-success text-white',
      'Rejected': 'bg-danger text-white'
    };
    return badges[status] || 'bg-secondary text-white';
  };

  const getExamTypeBadge = (examType) => {
    const badges = {
      'makeup': '',
      'resit': ''
    };
    return badges[examType] || 'info';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (fileName) => {
    if (!fileName) return 'bi-file-earmark-fill text-secondary';
    
    const ext = fileName.split('.').pop().toLowerCase();
    
    if (ext === 'pdf') return 'bi-file-pdf-fill text-danger';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'bi-file-image-fill text-primary';
    if (['doc', 'docx'].includes(ext)) return 'bi-file-word-fill text-primary';
    return 'bi-file-earmark-fill text-secondary';
  };

  const handleDownloadAttachment = (attachment) => {
    const link = document.createElement('a');
    link.href = `http://localhost:5000/uploads/${attachment.file_path}`;
    link.download = attachment.file_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 👇 YENİ PREVIEW FONKSİYONLARI
 const handlePreviewAttachment = async (attachment) => {
  try {
    console.log('Starting preview for:', attachment.file_name);
    
    // file_path kontrolü
    if (!attachment.file_path) {
      showError('File path not found');
      return;
    }
    
    const response = await fetch(`http://localhost:5000/uploads/${attachment.file_path}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    setPreviewFile({
      url,
    type: blob.type || attachment.file_type || 'application/octet-stream',
      name: attachment.file_name || 'Unknown file',
      attachment
    });
  } catch (error) {
    console.error('Error previewing file:', error);
    showError('Failed to preview file');
  }
};

  const closePreview = () => {
    if (previewFile) {
      window.URL.revokeObjectURL(previewFile.url);
      setPreviewFile(null);
    }
  };

 const canPreview = (fileType, fileName) => {
  // Önce file type'a bak
  if (fileType && typeof fileType === 'string') {
    if (fileType.includes('image') || fileType.includes('pdf')) {
      return true;
    }
  }
  
  // File type yoksa, dosya adından kontrol et
  if (fileName && typeof fileName === 'string') {
    const ext = fileName.split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'].includes(ext);
  }
  
  return false;
};

  const filteredRequests = examRequests.filter(request => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return request.status === 'Pending';
    if (activeTab === 'approved') return request.status === 'Approved';
    if (activeTab === 'rejected') return request.status === 'Rejected';
    return true;
  });

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Loading exam requests...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2>
                <i className="bi bi-clipboard2-check me-2"></i>
                Exam Requests Management
              </h2>
              <p className={isDark ? 'text-light' : 'text-muted'}>
                {admin?.department} Faculty - {admin?.full_name}
              </p>
            </div>
            <button 
              className="btn btn-outline-primary"
              onClick={() => loadExamRequests()}
            >
              <i className="bi bi-arrow-clockwise me-2"></i>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
            style={{
              color: activeTab === 'all' ? '#dc2626' : (isDark ? '#e2e8f0' : '#495057'),
              backgroundColor: activeTab === 'all' ? (isDark ? '#2d3748' : '#970707ff') : 'transparent',
              borderColor: activeTab === 'all' ? '#dc2626 #dc2626 transparent' : 'transparent'
            }}
          >
            All ({examRequests.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
            style={{
              color: activeTab === 'pending' ? '#dc2626' : (isDark ? '#f7f0f0ff' : '#495057'),
              backgroundColor: activeTab === 'pending' ? (isDark ? '#2d3748' : '#970707ff') : 'transparent',
              borderColor: activeTab === 'pending' ? '#dc2626 #dc2626 transparent' : 'transparent'
            }}
          >
            Pending ({examRequests.filter(r => r.status === 'Pending').length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => setActiveTab('approved')}
            style={{
              color: activeTab === 'approved' ? '#dc2626' : (isDark ? '#e2e8f0' : '#495057'),
              backgroundColor: activeTab === 'approved' ? (isDark ? '#2d3748' : '#970707ff') : 'transparent',
              borderColor: activeTab === 'approved' ? '#dc2626 #dc2626 transparent' : 'transparent'
            }}
          >
            Approved ({examRequests.filter(r => r.status === 'Approved').length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'rejected' ? 'active' : ''}`}
            onClick={() => setActiveTab('rejected')}
            style={{
              color: activeTab === 'rejected' ? '#dc2626' : (isDark ? '#e2e8f0' : '#495057'),
              backgroundColor: activeTab === 'rejected' ? (isDark ? '#2d3748' : '#970707ff') : 'transparent',
              borderColor: activeTab === 'rejected' ? '#dc2626 #dc2626 transparent' : 'transparent'
            }}
          >
            Rejected ({examRequests.filter(r => r.status === 'Rejected').length})
          </button>
        </li>
      </ul>
      {filteredRequests.length === 0 ? (
        <div className="card" style={{ backgroundColor: isDark ? '#2d3748' : '#ffffff' }}>
          <div className="card-body text-center py-5">
            <i className="bi bi-inbox" style={{ fontSize: '4rem', color: '#6c757d' }}></i>
            <h4 className="mt-3">No Exam Requests</h4>
            <p className="text-muted">
              {activeTab === 'all' 
                ? 'No exam requests found for your faculty.' 
                : `No ${activeTab} requests found.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ backgroundColor: isDark ? '#2d3748' : '#ffffff' }}>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{ backgroundColor: isDark ? '#4a5568' : '#f8f9fa' }}>
                  <tr>
                    <th>ID</th>
                    <th>Student</th>
                    <th>Type</th>
                    <th>Course</th>
                    <th>Instructor</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Attachments</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.exam_request_id}>
                      <td>#{request.exam_request_id}</td>
                      <td>
                        <div>
                          <strong>{request.student_name}</strong>
                          <br />
                          <small className="text-muted">{request.student_number}</small>
                        </div>
                      </td>
                      <td>
                        <span className={`${getExamTypeBadge(request.exam_type)}`}>
                          {request.exam_type === 'makeup' ? 'Make-up' : 'Resit'}
                        </span>
                      </td>
                      <td>
                        <div>
                          <strong>{request.course_code}</strong>
                          <br />
                          <small>{request.course_name}</small>
                        </div>
                      </td>
                      <td>{request.instructor_name || 'N/A'}</td>
                      <td>{formatDate(request.submitted_at)}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(request.status)}`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="text-center">
                        {request.attachment_count > 0 && (
                          <span className=" info">
                            <i className="bi bi-paperclip me-1"></i>
                            {request.attachment_count}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleViewDetails(request)}
                            title="View Details"
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          {request.status === 'Pending' && (
                            <>
                              <button
                                className="btn btn-sm btn-outline-success"
                                onClick={() => handleApproveClick(request)}
                                title="Approve"
                              >
                                <i className="bi bi-check-lg"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleRejectClick(request)}
                                title="Reject"
                              >
                                <i className="bi bi-x-lg"></i>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedRequest && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowDetailModal(false)}></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div 
                className="modal-content"
                style={{
                  backgroundColor: isDark ? '#2d3748' : '#ffffff',
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
                    <i className="bi bi-file-earmark-text me-2"></i>
                    Exam Request Details - #{selectedRequest.exam_request_id}
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setShowDetailModal(false)}
                    style={{ filter: isDark ? 'invert(1)' : 'none' }}
                  ></button>
                </div>

                <div className="modal-body">
                  <div className="mb-4">
                    <span className={`${getExamTypeBadge(selectedRequest.exam_type)} me-2`}>
                      {selectedRequest.exam_type === 'makeup' ? 'Make-up Exam' : 'Resit Exam'}
                    </span>
                    <span className={`badge ${getStatusBadge(selectedRequest.status)}`}>
                      {selectedRequest.status}
                    </span>
                  </div>

                  <div className="card mb-3" style={{ backgroundColor: isDark ? '#4a5568' : '#f8f9fa' }}>
                    <div className="card-body">
                      <h6 className="card-title">
                        <i className="bi bi-person me-2"></i>
                        Student Information
                      </h6>
                      <div className="row">
                        <div className="col-md-6">
                          <strong>Name:</strong> {selectedRequest.student_name}
                        </div>
                        <div className="col-md-6">
                          <strong>Student Number:</strong> {selectedRequest.student_number}
                        </div>
                        <div className="col-md-6 mt-2">
                          <strong>Email:</strong> {selectedRequest.student_email}
                        </div>
                        <div className="col-md-6 mt-2">
                          <strong>Program:</strong> {selectedRequest.program}
                        </div>
                        {selectedRequest.student_phone && (
                          <div className="col-md-6 mt-2">
                            <strong>Phone:</strong> {selectedRequest.student_phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="card mb-3" style={{ backgroundColor: isDark ? '#4a5568' : '#f8f9fa' }}>
                    <div className="card-body">
                      <h6 className="card-title">
                        <i className="bi bi-book me-2"></i>
                        Course Information
                      </h6>
                      <div className="row">
                        <div className="col-md-6">
                          <strong>Course Code:</strong> {selectedRequest.course_code}
                        </div>
                        <div className="col-md-6">
                          <strong>Course Name:</strong> {selectedRequest.course_name}
                        </div>
                        <div className="col-md-6 mt-2">
                          <strong>Instructor:</strong> {selectedRequest.instructor_name || 'Not specified'}
                        </div>
                        {selectedRequest.exam_date && (
                          <div className="col-md-6 mt-2">
                            <strong>Exam Date:</strong> {formatDate(selectedRequest.exam_date)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <h6>
                      <i className="bi bi-chat-left-text me-2"></i>
                      Reason for Request
                    </h6>
                    <div 
                      className="p-3 rounded border"
                      style={{
                        backgroundColor: isDark ? '#4a5568' : '#f8f9fa',
                        borderColor: isDark ? '#718096' : '#e2e8f0',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {selectedRequest.reason}
                    </div>
                  </div>

                  {selectedRequest.attachment_count > 0 && (
                    <div className="mb-3">
                      <h6>
                        <i className="bi bi-paperclip me-2"></i>
                        Attachments ({selectedRequest.attachment_count})
                      </h6>
                      {loadingAttachments ? (
                        <div className="text-center py-3">
                          <div className="spinner-border spinner-border-sm" role="status"></div>
                          <p className="mt-2 small">Loading attachments...</p>
                        </div>
                      ) : attachments.length > 0 ? (
                        <div className="list-group">
                          {attachments.map((attachment) => (
                            <div 
                              key={attachment.attachment_id}
                              className="list-group-item d-flex justify-content-between align-items-center"
                              style={{
                                backgroundColor: isDark ? '#4a5568' : '#ffffff',
                                borderColor: isDark ? '#718096' : '#e2e8f0'
                              }}
                            >
                                <div className="d-flex align-items-center">
                                <i className={`${getFileIcon(attachment.file_name)} me-3`} style={{ fontSize: '1.5rem' }}></i>
                                <div>
                                  <div className="fw-bold">{attachment.file_name}</div>
                                  <small className="text-muted">
                                    {formatDate(attachment.uploaded_at)}
                                  </small>
                                </div>
                              </div>
                              <div className="btn-group">
{canPreview(attachment.file_type, attachment.file_name) && (
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => handlePreviewAttachment(attachment)}
                                    title="Preview"
                                  >
                                    <i className="bi bi-eye"></i>
                                  </button>
                                )}
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => handleDownloadAttachment(attachment)}
                                  title="Download"
                                >
                                  <i className="bi bi-download"></i>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted">No attachments found</p>
                      )}
                    </div>
                  )}

                  {selectedRequest.secretary_notes && (
                    <div className="alert alert-info">
                      <h6><i className="bi bi-chat-right-text me-2"></i>Secretary Notes</h6>
                      <p className="mb-0">{selectedRequest.secretary_notes}</p>
                    </div>
                  )}

                  {selectedRequest.rejection_reason && (
                    <div className="alert alert-danger">
                      <h6><i className="bi bi-x-circle me-2"></i>Rejection Reason</h6>
                      <p className="mb-0">{selectedRequest.rejection_reason}</p>
                    </div>
                  )}

                  {selectedRequest.processed_by && (
                    <div className="text-muted small">
                      <i className="bi bi-info-circle me-1"></i>
                      Processed by {selectedRequest.processed_by_name} on {formatDate(selectedRequest.processed_at)}
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
                  {selectedRequest.status === 'Pending' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-success"
                        onClick={() => {
                          setShowDetailModal(false);
                          handleApproveClick(selectedRequest);
                        }}
                      >
                        <i className="bi bi-check-lg me-2"></i>
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => {
                          setShowDetailModal(false);
                          handleRejectClick(selectedRequest);
                        }}
                      >
                        <i className="bi bi-x-lg me-2"></i>
                        Reject
                      </button>
                    </>
                  )}
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {showActionModal && selectedRequest && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowActionModal(false)}></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog">
              <div 
                className="modal-content"
                style={{
                  backgroundColor: isDark ? '#2d3748' : '#ffffff',
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
                    {actionType === 'approve' ? (
                      <>
                        <i className="bi bi-check-circle text-success me-2"></i>
                        Approve Exam Request
                      </>
                    ) : (
                      <>
                        <i className="bi bi-x-circle text-danger me-2"></i>
                        Reject Exam Request
                      </>
                    )}
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setShowActionModal(false)}
                    style={{ filter: isDark ? 'invert(1)' : 'none' }}
                  ></button>
                </div>

                <div className="modal-body">
                  <div className="alert alert-info">
                    <strong>Request #{selectedRequest.exam_request_id}</strong>
                    <br />
                    {selectedRequest.student_name} - {selectedRequest.course_code}
                  </div>

                  {actionType === 'reject' && (
                    <div className="mb-3">
                      <label className="form-label fw-bold">
                        Rejection Reason *
                      </label>
                      <textarea
                        className="form-control"
                        rows="4"
                        value={actionData.rejection_reason}
                        onChange={(e) => setActionData({ ...actionData, rejection_reason: e.target.value })}
                        placeholder="Please provide a clear reason for rejection..."
                        required
                        maxLength={500}
                      />
                      <div className="form-text">
                        {500 - actionData.rejection_reason.length} characters remaining
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      Secretary Notes (Optional)
                    </label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={actionData.secretary_notes}
                      onChange={(e) => setActionData({ ...actionData, secretary_notes: e.target.value })}
                      placeholder="Add any additional notes..."
                      maxLength={500}
                    />
                    <div className="form-text">
                      {500 - actionData.secretary_notes.length} characters remaining
                    </div>
                  </div>
                </div>

                <div 
                  className="modal-footer"
                  style={{
                    backgroundColor: isDark ? '#4a5568' : '#f7fafc',
                    borderColor: isDark ? '#718096' : '#e2e8f0'
                  }}
                >
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowActionModal(false)}
                    disabled={processing}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`btn ${actionType === 'approve' ? 'btn-success' : 'btn-danger'}`}
                    onClick={handleActionSubmit}
                    disabled={processing || (actionType === 'reject' && !actionData.rejection_reason.trim())}
                  >
                    {processing ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Processing...
                      </>
                    ) : (
                      <>
                        <i className={`bi ${actionType === 'approve' ? 'bi-check-lg' : 'bi-x-lg'} me-2`}></i>
                        {actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 👇 YENİ PREVIEW MODAL */}
      {previewFile && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ 
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0,0,0,0.9)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
            onClick={closePreview}
          >
            <div 
              className="bg-white rounded shadow-lg"
              style={{ 
                maxWidth: '98vw',
                width: '100%',
                maxHeight: '95vh',
                overflow: 'auto',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                <h5 className="mb-0">
                  <i className="bi bi-eye me-2"></i>
                  {previewFile.name}
                </h5>
                <div className="d-flex gap-2">
                  <button 
                    className="btn btn-sm btn-outline-primary" 
                    onClick={() => handleDownloadAttachment(previewFile.attachment)}
                  >
                    <i className="bi bi-download me-1"></i>
                    Download
                  </button>
                  <button 
                    className="btn btn-sm btn-outline-secondary" 
                    onClick={closePreview}
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              </div>
              
             <div className="p-3" style={{ textAlign: 'center' }}>
  {previewFile.type.includes('image') && (
    <img 
      src={previewFile.url} 
      alt={previewFile.name}
      style={{ 
        maxWidth: '100%',
        maxHeight: '80vh',
        objectFit: 'contain',
        borderRadius: '4px'
      }}
      onLoad={() => console.log('✅ Image loaded successfully')}
      onError={(e) => {
        console.error('❌ Image failed to load:', e);
        console.log('Image URL:', previewFile.url);
      }}
    />
  )}
  
  {previewFile.type.includes('pdf') && (
    <embed
      src={previewFile.url}
      type="application/pdf"
      width="100%"
      height="80vh"
      style={{ 
        border: 'none',
        borderRadius: '4px',
        minHeight: '600px'
      }}
    />
  )}


  
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SecretaryExamRequestsPage;