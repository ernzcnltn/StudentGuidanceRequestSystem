// frontend/src/components/RequestRejectModal.js
import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';

const RequestRejectModal = ({ 
  show, 
  onHide, 
  request, 
  onRejectConfirm,
  loading = false 
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [rejectionReason, setRejectionReason] = useState('');
  const [showPreviewReasons, setShowPreviewReasons] = useState(false);

  // Common rejection reasons for quick selection
  const commonReasons = [
    {
      id: 'incomplete_docs',
      text: 'Incomplete or missing required documents',
      tr: 'Eksik veya gerekli belgeler eksik'
    },
    {
      id: 'incorrect_info',
      text: 'Incorrect or invalid information provided',
      tr: 'Yanlış veya geçersiz bilgi verildi'
    },
    {
      id: 'duplicate_request',
      text: 'Duplicate request - already processed',
      tr: 'Mükerrer talep - zaten işlendi'
    },
    {
      id: 'not_eligible',
      text: 'Student not eligible for this service',
      tr: 'Öğrenci bu hizmet için uygun değil'
    },
    {
      id: 'deadline_passed',
      text: 'Application deadline has passed',
      tr: 'Başvuru süresi geçmiş'
    },
    {
      id: 'requires_meeting',
      text: 'In-person meeting required before processing',
      tr: 'İşlemden önce yüz yüze görüşme gerekli'
    },
    {
      id: 'insufficient_payment',
      text: 'Required payment not completed',
      tr: 'Gerekli ödeme tamamlanmamış'
    },
    {
      id: 'prerequisites_missing',
      text: 'Prerequisites not fulfilled',
      tr: 'Ön koşullar yerine getirilmemiş'
    }
  ];

    const handleSubmit = (e) => {
    e.preventDefault();
    if (rejectionReason.length < 20) {
        alert(t('reasonTooShort', 'Please provide a more detailed reason (minimum 20 characters required)'));
        return;
    }
    onRejectConfirm(rejectionReason);
    setRejectionReason('');
    setShowPreviewReasons(false);
    };
    

  const handleCommonReasonSelect = (reason) => {
    setRejectionReason(reason.text);
    setShowPreviewReasons(false);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onHide();
    }
  };

  const handleModalClose = () => {
    if (!loading) {
      setRejectionReason('');
      setShowPreviewReasons(false);
      onHide();
    }
  };

  if (!show) return null;

  const modalStyle = {
    backgroundColor: isDark ? '#000000' : '#ffffff',
    borderColor: isDark ? '#333333' : '#dee2e6',
    color: isDark ? '#ffffff' : '#000000'
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
        <div className="modal-dialog modal-lg">
          <div className="modal-content" style={modalStyle}>
            <div className="modal-header border-bottom">
              <h5 className="modal-title text-danger d-flex align-items-center">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>🚫</span>
                {t('rejectRequest', 'Reject Request')}
              </h5>
              {!loading && (
                <button 
                  type="button" 
                  className="btn-close"
                  onClick={handleModalClose}
                  aria-label="Close"
                ></button>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Request Info */}
                {request && (
                  <div 
                    className="alert alert-warning mb-4"
                    style={{
                      backgroundColor: isDark ? '#332701' : '#fff3cd',
                      borderColor: isDark ? '#664d03' : '#ffecb5',
                      color: isDark ? '#ffffff' : '#664d03'
                    }}
                  >
                    <h6 className="alert-heading d-flex align-items-center">
                      <span className="me-2">📋</span>
                      {t('requestDetails', 'Request Details')}
                    </h6>
                    <div className="row">
                      <div className="col-md-6">
                        <strong>{t('requestId', 'Request ID')}:</strong> #{request.request_id}<br/>
                        <strong>{t('student', 'Student')}:</strong> {request.student_name}<br/>
                        <strong>{t('studentNumber', 'Student Number')}:</strong> {request.student_number}
                      </div>
                      <div className="col-md-6">
                        <strong>{t('requestType', 'Type')}:</strong> {request.type_name}<br/>
                        <strong>{t('currentStatus', 'Current Status')}:</strong> 
                        <span className={`badge ms-1 ${
                          request.status === 'Pending' ? 'bg-warning text-dark' : 'bg-info'
                        }`}>
                          {request.status}
                        </span><br/>
                        <strong>{t('submittedAt', 'Submitted')}:</strong> {new Date(request.submitted_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {/* Request Content Preview */}
                    {request.content && (
                      <div className="mt-3">
                        <strong>{t('requestContent', 'Request Content')}:</strong>
                        <div 
                          className="mt-1 p-2 rounded border"
                          style={{ 
                            backgroundColor: isDark ? '#000000' : '#ffffff',
                            maxHeight: '100px',
                            overflowY: 'auto',
                            fontSize: '0.9rem'
                          }}
                        >
                          {request.content.length > 200 
                            ? `${request.content.substring(0, 200)}...` 
                            : request.content
                          }
                        </div>
                      </div>
                    )}
                  </div>
                )}

                

           

                {/* Rejection Reason */}
                <div className="mb-4">
                  <label className={`form-label ${isDark ? 'text-light' : 'text-dark'}`}>
                    <span className="me-2">📝</span>
                    {t('rejectionReason', 'Rejection Reason')} 
                    <span className="text-danger ms-1">*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows="5"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder={t('rejectionReasonPlaceholder', 
                      'Please provide a detailed and constructive reason for rejecting this request. Explain what needs to be corrected or what requirements are missing. This message will be sent to the student via email.'
                    )}
                    required
                    disabled={loading}
                    style={{
                      backgroundColor: isDark ? '#000000' : '#ffffff',
                      borderColor: rejectionReason.length >= 20 
                        ? (isDark ? '#28a745' : '#28a745') 
                        : (isDark ? '#333333' : '#ced4da'),
                      color: isDark ? '#ffffff' : '#000000',
                      resize: 'vertical',
                      minHeight: '120px'
                    }}
                  />
                  <div className="d-flex justify-content-between mt-2">
                    <small className={isDark ? 'text-light' : 'text-muted'}>
                      {t('beSpecific', 'Be specific and constructive. Help the student understand how to correct their request.')}
                    </small>
                    <small className={`${
                      rejectionReason.length < 20 
                        ? 'text-warning' 
                        : rejectionReason.length > 500 
                        ? 'text-info'
                        : 'text-success'
                    }`}>
                      {rejectionReason.length} / 1000 {t('characters', 'characters')}
                    </small>
                  </div>
                </div>

                {/* Character Count Warning */}
                {rejectionReason.length > 0 && rejectionReason.length < 20 && (
                  <div className="alert alert-warning">
                    <div className="d-flex align-items-center">
                      <span className="me-2">⚠️</span>
                      <small>
                        {t('reasonTooShort', 'Please provide a more detailed reason (minimum 20 characters required)')}
                      </small>
                    </div>
                  </div>
                )}

               

              
              </div>

              <div className="modal-footer border-top">
                <div className="d-flex justify-content-between align-items-center w-100">
                  <div className="text-muted small">
                    {request && (
                      <>
                        
                       
                      </>
                    )}
                  </div>
                  <div className="d-flex gap-2">
                    {!loading && (
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={handleModalClose}
                      >
                        <span className="me-1"></span>
                        {t('cancel', 'Cancel')}
                      </button>
                    )}
                    <button 
                      type="submit" 
                      className="btn btn-danger"
                      disabled={loading || rejectionReason.length < 20}
                      style={{ minWidth: '140px' }}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          {t('rejecting', 'Rejecting')}...
                        </>
                      ) : (
                        <>
                          <span className="me-1"></span>
                          {t('rejectRequest', 'Reject Request')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default RequestRejectModal;