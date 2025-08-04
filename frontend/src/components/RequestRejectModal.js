// frontend/src/components/RequestRejectModal.js
import React, { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';

const RequestRejectModal = ({ show, onHide, request, onRejectConfirm, loading }) => {
  const { t, translateRequestType } = useTranslation();
  const [rejectionReason, setRejectionReason] = useState('');
  const [errors, setErrors] = useState({});

  const predefinedReasons = [
    'Incomplete information provided',
    'Missing required documents',
    'Request does not meet department criteria',
    'Duplicate request already submitted',
    'Request submitted to wrong department',
    'Information provided is unclear or insufficient',
    'Required supporting evidence not provided',
    'Request exceeds department policy limits'
  ];

  const handleReasonSelect = (reason) => {
    setRejectionReason(reason);
    setErrors({});
  };

  const handleCustomReasonChange = (e) => {
    setRejectionReason(e.target.value);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      newErrors.reason = 'Rejection reason is required';
    } else if (rejectionReason.trim().length < 10) {
      newErrors.reason = 'Rejection reason must be at least 10 characters long';
    } else if (rejectionReason.trim().length > 500) {
      newErrors.reason = 'Rejection reason cannot exceed 500 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    console.log('🚫 Submitting rejection with reason:', rejectionReason.trim());
    onRejectConfirm(rejectionReason.trim());
  };

  const handleCancel = () => {
    setRejectionReason('');
    setErrors({});
    onHide();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  if (!show || !request) return null;

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
            <div className="modal-header bg-danger text-white">
              <h5 className="modal-title">
                🚫 {t('rejectRequest', 'Reject Request')} #{request.request_id}
              </h5>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={handleCancel}
                disabled={loading}
              ></button>
            </div>
            
            <div className="modal-body">
              {/* Request Information */}
              <div className="card border-danger mb-4">
                <div className="card-header bg-danger text-dark">
                  <h6 className="mb-0">
                    <span className="me-2">📋</span>
                    Request Information
                  </h6>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <strong>Student:</strong> {request.student_name}<br/>
                      <strong>Type:</strong> {translateRequestType(request.type_name)}<br/>
                      <strong>Priority:</strong> {request.priority || 'Medium'}
                    </div>
                    <div className="col-md-6">
                      <strong>Submitted:</strong> {new Date(request.submitted_at).toLocaleString()}<br/>
                      <strong>Current Status:</strong> <span className="badge bg-warning text-dark">{request.status}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <strong>Content:</strong>
                    <div className="p-2 bg-light rounded border mt-1">
                      {request.content.length > 200 
                        ? request.content.substring(0, 200) + '...' 
                        : request.content
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Rejection Form */}
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="form-label fw-bold text-danger">
                    <span className="me-2">🚫</span>
                    Reason for Rejection *
                  </label>
                  
                  {/* Predefined Reasons */}
                  <div className="mb-3">
                    <small className="text-muted d-block mb-2">
                      Select a common reason or write a custom one below:
                    </small>
                    <div className="row">
                      {predefinedReasons.map((reason, index) => (
                        <div key={index} className="col-md-6 mb-2">
                          <button
                            type="button"
                            className={`btn btn-outline-secondary btn-sm w-100 text-start ${
                              rejectionReason === reason ? 'active' : ''
                            }`}
                            onClick={() => handleReasonSelect(reason)}
                            disabled={loading}
                            style={{ 
                              minHeight: '40px',
                              fontSize: '0.85rem',
                              whiteSpace: 'normal'
                            }}
                          >
                            {reason}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom Reason Textarea */}
                  <div className="mb-3">
                    <label className="form-label">
                      Custom Rejection Reason:
                    </label>
                    <textarea
                      className={`form-control ${errors.reason ? 'is-invalid' : ''}`}
                      rows="4"
                      value={rejectionReason}
                      onChange={handleCustomReasonChange}
                      placeholder="Enter a detailed reason for rejecting this request..."
                      disabled={loading}
                      maxLength={500}
                    />
                    {errors.reason && (
                      <div className="invalid-feedback">
                        {errors.reason}
                      </div>
                    )}
                    <div className="form-text">
                      {rejectionReason.length}/500 characters
                      {rejectionReason.length < 10 && (
                        <span className="text-danger ms-2">
                          (Minimum 10 characters required)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                

                {/* Form Actions */}
                <div className="d-flex gap-2 justify-content-end">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    {t('cancel', 'Cancel')}
                  </button>
                  
                  <button
                    type="submit"
                    className="btn btn-danger"
                    disabled={loading || !rejectionReason.trim() || rejectionReason.trim().length < 10}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        {t('rejecting', 'Rejecting...')}
                      </>
                    ) : (
                      <>
                        🚫 {t('confirmReject', 'Confirm Rejection')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RequestRejectModal;