import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../hooks/useTranslation';

const AdminResponseModal = ({ requestId, requestTitle, onClose, onResponseAdded }) => {
  const [responses, setResponses] = useState([]);
  const [newResponse, setNewResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showSuccess, showError } = useToast();
const { t, translateRequestType } = useTranslation(); // BUNU EKLEYİN


  useEffect(() => {
    fetchResponses();
  }, [requestId]);

  const fetchResponses = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAdminRequestResponses(requestId);
      if (response.data.success) {
        setResponses(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching responses:', error);
      showError('Failed to load responses');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    
    if (!newResponse.trim()) {
      showError('Please enter a response');
      return;
    }
    
    try {
      setSubmitting(true);
      await apiService.addAdminResponse(requestId, {
        response_content: newResponse.trim()
      });
      
      showSuccess('Response added successfully');
      setNewResponse('');
      fetchResponses();
      
      if (onResponseAdded) {
        onResponseAdded();
      }
    } catch (error) {
      console.error('Error adding response:', error);
      showError('Failed to add response');
    } finally {
      setSubmitting(false);
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
    💬 {t('responseTo')}: {requestTitle}
  </h5>
  <button 
    type="button" 
    className="btn-close" 
    onClick={onClose}
  ></button>
</div>
            
            <div className="modal-body">
              {/* Previous Responses */}
         <div className="mb-4">
  <h6>{t('previousResponses')} ({responses.length})</h6>
  {loading ? (
    <div className="text-center py-3">
      <div className="spinner-border spinner-border-sm" role="status"></div>
      <span className="ms-2">{t('loadingResponses')}</span>
    </div>
  ) : responses.length === 0 ? (
    <div className="alert alert-info">
      <small>{t('noPreviousResponses')}</small>
    </div>
  ) : (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {responses.map((response) => (
                      <div key={response.response_id} className="card mb-2">
                        <div className="card-body p-3">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <strong className="text-primary">
                              👨‍💼 {response.created_by_admin}
                            </strong>
                            <small className="text-muted">
                              {new Date(response.created_at).toLocaleString()}
                            </small>
                          </div>
                          <p className="mb-0">{response.response_content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* New Response Form */}
              <div>
  <h6>{t('addNewResponse')}</h6>
  <form onSubmit={handleSubmitResponse}>
    <div className="mb-3">
      <textarea
        className="form-control"
        rows="4"
        value={newResponse}
        onChange={(e) => setNewResponse(e.target.value)}
        placeholder={t('enterResponsePlaceholder', 'Enter your response to the student...')}
        disabled={submitting}
        required
      />
      <div className="form-text">
        {t('responseVisibilityNote', 'This response will be visible to the student and will mark the request as "Informed".')}
      </div>
    </div>
    
    <div className="d-flex gap-2">
      <button
        type="submit"
        className="btn btn-primary"
        disabled={submitting || !newResponse.trim()}
      >
        {submitting ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
            {t('sending')}...
          </>
        ) : (
          '📤 ' + t('sendResponse')
        )}
      </button>
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={() => setNewResponse('')}
        disabled={submitting}
      >
        {t('refresh')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onClose}
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminResponseModal;