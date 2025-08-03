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

                {/* Warning */}
                <div 
                  className="alert alert-danger mb-4"
                  style={{
                    backgroundColor: isDark ? '#2d0a0a' : '#f8d7da',
                    borderColor: isDark ? '#5d1a1a' : '#f1aeb5',
                    color: isDark ? '#ffffff' : '#721c24'
                  }}
                >
                  <h6 className="alert-heading d-flex align-items-center">
                    <span className="me-2">⚠️</span>
                    {t('important', 'Important')}
                  </h6>
                  <p className="mb-2">
                    {t('rejectWarning', 'This action will reject the student\'s request and notify them via email. Please provide a clear and constructive reason for rejection.')}
                  </p>
                  <ul className="mb-0 small">
                    <li>{t('studentNotified', 'Student will be notified immediately via email')}</li>
                    <li>{t('actionPermanent', 'This action can only be undone by Super Administrators')}</li>
                    <li>{t('beConstructive', 'Be specific and constructive in your feedback')}</li>
                  </ul>
                </div>

                {/* Common Reasons */}
                <div className="mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <label className={`form-label mb-0 ${isDark ? 'text-light' : 'text-dark'}`}>
                      <span className="me-2">💡</span>
                      {t('commonReasons', 'Common Rejection Reasons')}
                    </label>
                    <button
                      type="button"
                      className={`btn btn-sm ${showPreviewReasons ? 'btn-secondary' : 'btn-outline-secondary'}`}
                      onClick={() => setShowPreviewReasons(!showPreviewReasons)}
                      disabled={loading}
                    >
                      {showPreviewReasons ? (
                        <>
                          <span className="me-1">▲</span>
                          {t('hideTemplates', 'Hide Templates')}
                        </>
                      ) : (
                        <>
                          <span className="me-1">▼</span>
                          {t('showTemplates', 'Show Templates')}
                        </>
                      )}
                    </button>
                  </div>
                  
                  <small className={isDark ? 'text-light' : 'text-muted'}>
                    {t('clickToUse', 'Click on a reason below to use as template, then customize as needed')}
                  </small>
                  
                  {showPreviewReasons && (
                    <div 
                      className="border rounded p-3 mt-3"
                      style={{ 
                        backgroundColor: isDark ? '#111111' : '#f8f9fa',
                        borderColor: isDark ? '#333333' : '#e5e7eb',
                        maxHeight: '250px',
                        overflowY: 'auto'
                      }}
                    >
                      <div className="row">
                        {commonReasons.map((reason) => (
                          <div key={reason.id} className="col-12 mb-2">
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm w-100 text-start"
                              onClick={() => handleCommonReasonSelect(reason)}
                              disabled={loading}
                              style={{ 
                                padding: '8px 12px',
                                fontSize: '0.85rem',
                                lineHeight: '1.2'
                              }}
                            >
                              <div className="d-flex justify-content-between align-items-start">
                                <span className="flex-grow-1">{reason.text}</span>
                                <span className="ms-2 text-muted">→</span>
                              </div>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

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

                {/* Preview */}
                {rejectionReason.length >= 20 && (
                  <div 
                    className="alert alert-info"
                    style={{
                      backgroundColor: isDark ? '#0a2a2a' : '#d1ecf1',
                      borderColor: isDark ? '#1a4d4d' : '#bee5eb',
                      color: isDark ? '#ffffff' : '#0c5460'
                    }}
                  >
                    <h6 className="alert-heading d-flex align-items-center">
                      <span className="me-2">📧</span>
                      {t('emailPreview', 'Email Preview')}
                    </h6>
                    <p className="mb-2 small">
                      {t('studentWillReceive', 'The student will receive this message in their rejection notification email:')}
                    </p>
                    <div 
                      className="p-3 border rounded"
                      style={{ 
                        backgroundColor: isDark ? '#000000' : '#ffffff',
                        borderColor: isDark ? '#333333' : '#dee2e6',
                        fontStyle: 'italic',
                        fontSize: '0.9rem',
                        lineHeight: '1.5'
                      }}
                    >
                      "{rejectionReason}"
                    </div>
                    <small className="text-muted mt-2 d-block">
                      {t('emailContext', 'This will be included in a formatted email with additional context and next steps.')}
                    </small>
                  </div>
                )}

                {/* Guidelines */}
                <div 
                  className="alert mb-0"
                  style={{
                    backgroundColor: isDark ? '#1a1a2e' : '#e7f3ff',
                    borderColor: isDark ? '#2d2d5f' : '#b3d7ff',
                    color: isDark ? '#ffffff' : '#004085'
                  }}
                >
                  <h6 className="alert-heading d-flex align-items-center">
                    <span className="me-2">📚</span>
                    {t('guidelines', 'Rejection Guidelines')}
                  </h6>
                  <ul className="mb-0 small">
                    <li>{t('explainSpecific', 'Explain specifically what is wrong or missing')}</li>
                    <li>{t('provideSolution', 'Provide guidance on how to correct the issue')}</li>
                    <li>{t('useProfessional', 'Use professional and respectful language')}</li>
                    <li>{t('includeDeadlines', 'Include relevant deadlines or requirements if applicable')}</li>
                    <li>{t('suggestNextSteps', 'Suggest clear next steps for the student')}</li>
                  </ul>
                </div>
              </div>

              <div className="modal-footer border-top">
                <div className="d-flex justify-content-between align-items-center w-100">
                  <div className="text-muted small">
                    {request && (
                      <>
                        <span className="me-3">
                          <strong>{t('request', 'Request')}:</strong> #{request.request_id}
                        </span>
                        <span className="me-3">
                          <strong>{t('student', 'Student')}:</strong> {request.student_name}
                        </span>
                        <span>
                          <strong>{t('type', 'Type')}:</strong> {request.type_name}
                        </span>
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
                        <span className="me-1">❌</span>
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
                          <span className="me-1">🚫</span>
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