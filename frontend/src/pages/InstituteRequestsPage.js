import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTranslation } from '../hooks/useTranslation'; // YENİ
import AttachmentViewer from '../components/AttachmentViewer';

const InstituteRequestsPage = () => {
  const { admin } = useAdminAuth();
  const { showSuccess, showError } = useToast();
  const { isDark } = useTheme();
  const { t, translateRequestType , translateDescription } = useTranslation(); 

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [actionData, setActionData] = useState({
    admin_notes: '',
    rejection_reason: ''
  });
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [showAttachments, setShowAttachments] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);



  // 🆕 FIFO States
  const [fifoStatus, setFifoStatus] = useState(null);
  const [checkingFifo, setCheckingFifo] = useState(false);


  useEffect(() => {
    loadRequests();
  }, []);



  // 🆕 FIFO CHECK Effect
  useEffect(() => {
    if (showActionModal && selectedRequest && selectedRequest.status === 'Pending') {
      checkFifoEligibility(selectedRequest.request_id);
    } else {
      setFifoStatus(null);
    }
  }, [showActionModal, selectedRequest?.request_id]);

  // 🆕 FIFO Check Function
  const checkFifoEligibility = async (requestId) => {
    try {
      setCheckingFifo(true);
      const response = await apiService.getInstituteFifoStatus(requestId);
      
      if (response.data.success) {
        setFifoStatus(response.data.data);
      }
    } catch (error) {
      console.error('Failed to check FIFO status:', error);
    } finally {
      setCheckingFifo(false);
    }
  };



  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await apiService.getInstituteRequests();
      if (response.data.success) {
        setRequests(response.data.data);
      }
    } catch (error) {
      console.error('Error loading institute requests:', error);
      showError(t('failedToLoadInstituteRequests'));
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (request) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  const handleApproveClick = (request) => {
    setSelectedRequest(request);
    setActionType('approve');
    setActionData({ admin_notes: '', rejection_reason: '' });
    setShowActionModal(true);
  };

  const handleRejectClick = (request) => {
    setSelectedRequest(request);
    setActionType('reject');
    setActionData({ admin_notes: '', rejection_reason: '' });
    setShowActionModal(true);
  };

  const handleActionSubmit = async () => {
    if (!selectedRequest) return;

    if (actionType === 'reject' && !actionData.rejection_reason.trim()) {
      showError(t('pleaseProvideRejectionReason'));
      return;
    }


     // 🆕 FIFO Validation
    if (fifoStatus && !fifoStatus.canProcess && fifoStatus.reason === 'FIFO_VIOLATION') {
      showError(t('mustProcessEarlierRequestsFirst'));
      return;
    }


    try {
      setProcessing(true);
      
      if (actionType === 'approve') {
        await apiService.approveInstituteRequest(selectedRequest.request_id, {
          admin_notes: actionData.admin_notes || null
        });
        showSuccess(t('instituteRequestApprovedSuccess'));
      } else {
        await apiService.rejectInstituteRequest(selectedRequest.request_id, {
          rejection_reason: actionData.rejection_reason,
          admin_notes: actionData.admin_notes || null
        });
        showSuccess(t('instituteRequestRejectedSuccess'));
      }

      setShowActionModal(false);
      setShowDetailModal(false);
  
      setFifoStatus(null); // 🆕 Reset FIFO status

      await loadRequests();
    } catch (error) {
      console.error('Error processing request:', error);
      
      // 🆕 FIFO Error Handling
      if (error.response?.data?.errorCode === 'FIFO_VIOLATION') {
        showError(t('cannotProcessYetEarlierRequestsPending'));
      } else {
        showError(error.response?.data?.error || t('failedToProcessRequest'));
      }
    } finally {
      setProcessing(false);
    }
  };

  

  const getStatusBadge = (status) => {
    const badges = {
      'Pending': 'bg-warning text-dark',
      'Informed': 'bg-info text-white',
      'Completed': 'bg-success text-white',
      'Rejected': 'bg-danger text-white'
    };
    return badges[status] || 'bg-secondary text-white';
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('notAvailable');
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredRequests = requests.filter(request => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return request.status === 'Pending';
    if (activeTab === 'informed') return request.status === 'Informed';
    if (activeTab === 'completed') return request.status === 'Completed';
    if (activeTab === 'rejected') return request.status === 'Rejected';
    return true;
  });


    const isBlocked = fifoStatus && !fifoStatus.canProcess && fifoStatus.reason === 'FIFO_VIOLATION';


  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">{t('loading')}</span>
        </div>
        <p className="mt-3">{t('loadingInstituteRequests')}</p>
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
                <i className="bi bi-mortarboard me-2"></i>
                {t('instituteRequestsManagement')}
              </h2>
              <p className={isDark ? 'text-light' : 'text-muted'}>
                {t('graduateInstituteThesisServices')} 
              </p>
            </div>
            <button 
              className="btn btn-outline-primary"
              onClick={() => loadRequests()}
            >
              <i className="bi bi-arrow-clockwise me-2"></i>
              {t('refresh')}
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
              backgroundColor: activeTab === 'all' ? (isDark ? '#2d3748' : '#dc2626') : 'transparent',
              borderColor: activeTab === 'all' ? '#dc2626 #dc2626 transparent' : 'transparent'
            }}
          >
            {t('allRequests')} ({requests.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
            style={{
              color: activeTab === 'pending' ? '#dc2626' : (isDark ? '#f7f0f0ff' : '#495057'),
              backgroundColor: activeTab === 'pending' ? (isDark ? '#2d3748' : '#dc2626') : 'transparent',
              borderColor: activeTab === 'pending' ? '#dc2626 #dc2626 transparent' : 'transparent'
            }}
          >
            {t('pending')} ({requests.filter(r => r.status === 'Pending').length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'informed' ? 'active' : ''}`}
            onClick={() => setActiveTab('informed')}
            style={{
              color: activeTab === 'informed' ? '#dc2626' : (isDark ? '#e2e8f0' : '#495057'),
              backgroundColor: activeTab === 'informed' ? (isDark ? '#2d3748' : '#dc2626') : 'transparent',
              borderColor: activeTab === 'informed' ? '#dc2626 #dc2626 transparent' : 'transparent'
            }}
          >
            {t('informed')} ({requests.filter(r => r.status === 'Informed').length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
            style={{
              color: activeTab === 'completed' ? '#dc2626' : (isDark ? '#e2e8f0' : '#495057'),
              backgroundColor: activeTab === 'completed' ? (isDark ? '#2d3748' : '#dc2626') : 'transparent',
              borderColor: activeTab === 'completed' ? '#dc2626 #dc2626 transparent' : 'transparent'
            }}
          >
            {t('completed')} ({requests.filter(r => r.status === 'Completed').length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'rejected' ? 'active' : ''}`}
            onClick={() => setActiveTab('rejected')}
            style={{
              color: activeTab === 'rejected' ? '#dc2626' : (isDark ? '#e2e8f0' : '#495057'),
              backgroundColor: activeTab === 'rejected' ? (isDark ? '#2d3748' : '#dc2626') : 'transparent',
              borderColor: activeTab === 'rejected' ? '#dc2626 #dc2626 transparent' : 'transparent'
            }}
          >
            {t('rejected')} ({requests.filter(r => r.status === 'Rejected').length})
          </button>
        </li>
      </ul>

      {filteredRequests.length === 0 ? (
        <div className="card" style={{ backgroundColor: isDark ? '#2d3748' : '#ffffff' }}>
          <div className="card-body text-center py-5">
            <i className="bi bi-inbox" style={{ fontSize: '4rem', color: '#6c757d' }}></i>
            <h4 className="mt-3">{t('noInstituteRequests')}</h4>
            <p className="text-muted">
              {activeTab === 'all' 
                ? t('noInstituteRequestsFound') 
                : t('noRequestsFoundForStatus', { status: t(activeTab) })}
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
                    <th>{t('requestId')}</th>
                    <th>{t('student')}</th>
                    <th>{t('requestType')}</th>
                    <th>{t('program')}</th>
                    <th>{t('submitted')}</th>
                    <th>{t('status')}</th>
                    <th>{t('attachments')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.request_id} id={`request-${request.request_id}`}>
                      <td>#{request.request_id}

                        {/* 🆕 Queue Position Badge */}
                        {request.response_order && request.status === 'Pending' && (
                          <span className="badge bg-info ms-2" title={t('queuePosition')}>
                            #{request.response_order}
                          </span>
                        )}

                      </td>
                      <td>
                        <div>
                          <strong>{request.student_name}</strong>
                          <br />
                          <small className="text-muted">{request.student_number}</small>
                        </div>
                      </td>
                      <td>
                        <div>
    <strong>{translateRequestType(request.type_name)}</strong> {/* 👈 ÇEVİRİ */}
                          <br />
    <small className="text-muted">{translateDescription(request.description_en)}</small> {/* 👈 ÇEVİRİ */}
                        </div>
                      </td>
                      <td>{request.program || t('notAvailable')}</td>
                      <td>{formatDate(request.submitted_at)}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(request.status)}`}>
                          {t(request.status.toLowerCase())}
                        </span>
                      </td>
                      <td className="text-center">
                        {request.attachment_count > 0 && (
                          <span className="badge bg-info">
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
                            title={t('viewDetails')}
                          >
                            <i className="bi bi-eye"></i>
                          </button>
                          {request.status === 'Pending' && (
                            <>
                              <button
                                className="btn btn-sm btn-outline-success"
                                onClick={() => handleApproveClick(request)}
                                title={t('approve')}
                              >
                                <i className="bi bi-check-lg"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleRejectClick(request)}
                                title={t('reject')}
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

      {/* Detail Modal */}
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
                    {t('instituteRequestDetails')} - #{selectedRequest.request_id}
                     {/* 🆕 Queue Position */}
                    {selectedRequest.response_order && selectedRequest.status === 'Pending' && (
                      <span className="badge bg-info ms-2">
                        {t('queuePosition')}: #{selectedRequest.response_order}
                      </span>
                    )}
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
                    <span className="badge bg-info me-2">
    {translateRequestType(selectedRequest.type_name)} {/* 👈 ÇEVİRİ */}
                    </span>
                    <span className={`badge ${getStatusBadge(selectedRequest.status)}`}>
                      {t(selectedRequest.status.toLowerCase())}
                    </span>
                  </div>

                  <div className="card mb-3" style={{ backgroundColor: isDark ? '#4a5568' : '#f8f9fa' }}>
                    <div className="card-body">
                      <h6 className="card-title">
                        <i className="bi bi-person me-2"></i>
                        {t('studentInformation')}
                      </h6>
                      <div className="row">
                        <div className="col-md-6">
                          <strong>{t('name')}:</strong> {selectedRequest.student_name}
                        </div>
                        <div className="col-md-6">
                          <strong>{t('studentNumber')}:</strong> {selectedRequest.student_number}
                        </div>
                        <div className="col-md-6 mt-2">
                          <strong>{t('email')}:</strong> {selectedRequest.student_email}
                        </div>
                        <div className="col-md-6 mt-2">
                          <strong>{t('program')}:</strong> {selectedRequest.program || t('notAvailable')}
                        </div>
                        {selectedRequest.student_phone && (
                          <div className="col-md-6 mt-2">
                            <strong>{t('phone')}:</strong> {selectedRequest.student_phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <h6>
                      <i className="bi bi-chat-left-text me-2"></i>
                      {t('requestContent')}
                    </h6>
                    <div 
                      className="p-3 rounded border"
                      style={{
                        backgroundColor: isDark ? '#4a5568' : '#f8f9fa',
                        borderColor: isDark ? '#718096' : '#e2e8f0',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {selectedRequest.content}
                    </div>
                  </div>

                  {selectedRequest.attachment_count > 0 && (
                    <div className="mb-3">
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => {
                          setSelectedRequestId(selectedRequest.request_id);
                          setShowAttachments(true);
                          setShowDetailModal(false);
                        }}
                      >
                        <i className="bi bi-paperclip me-2"></i>
                        {t('viewAttachments')} ({selectedRequest.attachment_count})
                      </button>
                    </div>
                  )}

                  {selectedRequest.admin_notes && (
                    <div className="alert alert-info">
                      <h6><i className="bi bi-chat-right-text me-2"></i>{t('adminNotes')}</h6>
                      <p className="mb-0">{selectedRequest.admin_notes}</p>
                    </div>
                  )}

                  {selectedRequest.rejection_reason && (
                    <div className="alert alert-danger">
                      <h6><i className="bi bi-x-circle me-2"></i>{t('rejectionReason')}</h6>
                      <p className="mb-0">{selectedRequest.rejection_reason}</p>
                    </div>
                  )}

                  {selectedRequest.assigned_admin_name && (
                    <div className="text-muted small">
                      <i className="bi bi-info-circle me-1"></i>
                      {t('assignedTo')} {selectedRequest.assigned_admin_name}
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
                        {t('approve')}
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
                        {t('reject')}
                      </button>
                    </>
                  )}
                  
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Action Modal (Approve/Reject) */}
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
                        {t('approveInstituteRequest')}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-x-circle text-danger me-2"></i>
                        {t('rejectInstituteRequest')}
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
                  {/* 🆕 FIFO Warning */}
                  {isBlocked && (
                    <div className="alert alert-warning border-warning mb-3" role="alert">
                      <div className="d-flex align-items-start">
                        <i className="bi bi-exclamation-triangle-fill me-3" style={{ fontSize: '2rem' }}></i>
                        <div className="flex-grow-1">
                          <h6 className="alert-heading mb-2">
                            <i className="bi bi-clock-history me-2"></i>
                            {t('fifoBlocked')}
                          </h6>
                          <p className="mb-2">{t('earlierRequestsPending')}</p>
                          
                          {fifoStatus.blocking_request && (
                            <div className="card bg-light border-warning mt-2">
                              <div className="card-body p-2">
                                <strong className="text-warning">
                                  <i className="bi bi-arrow-right-circle me-1"></i>
                                  {t('blockingRequest')}:
                                </strong>
                                <div className="small mt-1">
                                  <div>
                                    <strong>{t('requestId')}:</strong> #{fifoStatus.blocking_request.request_id}
                                  </div>
                                  <div>
                                    <strong>{t('student')}:</strong> {fifoStatus.blocking_request.student_name}
                                  </div>
                                  <div>
                                    <strong>{t('queuePosition')}:</strong> #{fifoStatus.blocking_request.order}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="alert alert-info">
                    <strong>{t('request')} #{selectedRequest.request_id}</strong>
                    <br />
  {selectedRequest.student_name} - {translateRequestType(selectedRequest.type_name)} {/* 👈 ÇEVİRİ */}
                  </div>

                  {actionType === 'reject' && (
                    <div className="mb-3">
                      <label className="form-label fw-bold">
                        {t('rejectionReason')} *
                      </label>
                      <textarea
                        className="form-control"
                        rows="4"
                        value={actionData.rejection_reason}
                        onChange={(e) => setActionData({ ...actionData, rejection_reason: e.target.value })}
                        placeholder={t('pleaseProvideRejectionReasonPlaceholder')}
                        required
                        maxLength={500}
                        disabled={isBlocked} // 🆕 Disable if blocked

                      />
                      <div className="form-text">
  {500 - actionData.rejection_reason.length} {t('charactersRemaining')}
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      {t('adminNotesOptional')}
                    </label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={actionData.admin_notes}
                      onChange={(e) => setActionData({ ...actionData, admin_notes: e.target.value })}
                      placeholder={t('addAdditionalNotesPlaceholder')}
                      maxLength={500}
                       disabled={isBlocked} 
                    />
                    <div className="form-text">
                      {t('charactersRemaining', { count: 500 - actionData.admin_notes.length })}
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
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    className={`btn ${actionType === 'approve' ? 'btn-success' : 'btn-danger'}`}
                    onClick={handleActionSubmit}
disabled={
                      processing || 
                      isBlocked || // 🆕 Disable if FIFO blocked
                      (actionType === 'reject' && !actionData.rejection_reason.trim())
                    }
                     >
                    {processing ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        {t('processing')}
                      </>
                    ) : (
                      <>
                        <i className={`bi ${actionType === 'approve' ? 'bi-check-lg' : 'bi-x-lg'} me-2`}></i>
                        {actionType === 'approve' ? t('confirmApproval') : t('confirmRejection')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Attachment Viewer */}
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

export default InstituteRequestsPage;