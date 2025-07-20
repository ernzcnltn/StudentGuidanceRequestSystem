import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../hooks/useTranslation'; // YENİ EKLENEN

const CreateRequestPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { t } = useTranslation(); // YENİ EKLENEN
  
  const [requestTypes, setRequestTypes] = useState({});
  const [formData, setFormData] = useState({
    student_id: user?.student_id || 1,
    type_id: '',
    content: '',
    priority: 'Medium'
  });
  const [selectedType, setSelectedType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const fetchRequestTypes = async () => {
      try {
        const response = await apiService.getRequestTypes();
        setRequestTypes(response.data.data);
      } catch (error) {
        console.error('Error fetching request types:', error);
        showError('Failed to load request types');
      }
    };

    fetchRequestTypes();
  }, [showError]);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        student_id: user.student_id
      }));
    }
  }, [user]);

  const handleTypeChange = async (typeId) => {
    setFormData({ ...formData, type_id: typeId });
    
    if (typeId) {
      try {
        const response = await apiService.getRequestType(typeId);
        setSelectedType(response.data.data);
      } catch (error) {
        console.error('Error fetching request type details:', error);
      }
    } else {
      setSelectedType(null);
    }
  };

  const handleContentChange = (e) => {
    const content = e.target.value;
    if (content.length <= 300) {
      setFormData({ ...formData, content });
    }
  };

  const handlePriorityChange = (e) => {
    setFormData({ ...formData, priority: e.target.value });
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    if (selectedFiles.length > 3) {
      showError('Maximum 3 files allowed');
      e.target.value = '';
      return;
    }
    
    // File validation
    const validFiles = [];
    const errors = [];
    
    selectedFiles.forEach(file => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/csv'];
      const maxSize = 2 * 1024 * 1024; // 2MB
      
      if (!validTypes.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type`);
        return;
      }
      
      if (file.size > maxSize) {
        errors.push(`${file.name}: File too large (max 2MB)`);
        return;
      }
      
      validFiles.push(file);
    });
    
    if (errors.length > 0) {
      showError(`File validation failed: ${errors.join(', ')}`);
      e.target.value = '';
      return;
    }
    
    setFiles(validFiles);
    setError(null);
    
    if (validFiles.length > 0) {
      showSuccess(`${validFiles.length} file(s) selected successfully`);
    }
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Double submit engelle
    if (submitting) {
      showWarning('Request is already being submitted. Please wait...');
      return;
    }

    // Required document kontrolü
    if (selectedType?.is_document_required && files.length === 0) {
      showError('This request type requires document upload. Please select files.');
      return;
    }

    // File size kontrolü
    const oversizedFiles = files.filter(file => file.size > 2 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      showError(`Files too large: ${oversizedFiles.map(f => f.name).join(', ')}. Maximum size is 2MB per file.`);
      return;
    }

    setSubmitting(true);
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      showInfo('Creating your request...');
      
      const response = await apiService.createRequest(formData);
      const requestId = response.data.data.request_id;
      
      if (files.length > 0) {
        showInfo('Uploading files...');
        
        const fileFormData = new FormData();
        files.forEach(file => {
          fileFormData.append('files', file);
        });
        
        try {
          await apiService.uploadFiles(requestId, fileFormData);
          showSuccess(`✅ Request #${requestId} created successfully with ${files.length} file(s)!`);
        } catch (uploadError) {
          showError('Files could not be uploaded. Request created without attachments.');
        }
      } else {
        showSuccess(`✅ Request #${requestId} created successfully!`);
      }
      
      // Form'u temizle
      setFormData({
        student_id: user?.student_id || 1,
        type_id: '',
        content: '',
        priority: 'Medium'
      });
      setFiles([]);
      setSelectedType(null);
      
      setTimeout(() => {
        navigate('/requests');
      }, 2000);
      
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to create request';
      showError(`❌ ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const remainingChars = 300 - formData.content.length;

  return (
    <div className="row justify-content-center">
      <div className="col-md-8">
        <h2 className="mb-4">{t('createRequest')}</h2>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success" role="alert">
            {success} Redirecting to your requests...
          </div>
        )}

        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              {/* Request Type Selection */}
              <div className="mb-3">
                <label htmlFor="requestType" className="form-label">
                  <strong>{t('requestType')}</strong>
                </label>
                <select
                  id="requestType"
                  className="form-select"
                  value={formData.type_id}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  required
                >
                  <option value="">{t('pleaseSelect')}</option>
                  {Object.keys(requestTypes).map((category) => (
                    <optgroup key={category} label={category}>
                      {requestTypes[category].map((type) => (
                        <option key={type.type_id} value={type.type_id}>
                          {type.type_name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Type Detail */}
              {selectedType && (
                <div className="mb-3">
                  <label className="form-label">
                    <strong>Type Detail</strong>
                  </label>
                  <div className="alert alert-info">
                    {selectedType.description_en || 'No description available'}
                    {selectedType.is_document_required && (
                      <div className="mt-2">
                        <strong className="text-warning">
                          ⚠️ Document upload is required for this request type.
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Priority Selection */}
              <div className="mb-3">
                <label htmlFor="priority" className="form-label">
                  <strong>Priority Level</strong>
                </label>
                <select
                  id="priority"
                  className="form-select"
                  value={formData.priority}
                  onChange={handlePriorityChange}
                  required
                >
                  <option value="Low">🔵 {t('low')} - Non-urgent request</option>
                  <option value="Medium">🟡 {t('medium')} - Standard request</option>
                  <option value="High">🟠 {t('high')} - Important request</option>
                  <option value="Urgent">🔴 {t('urgent')} - Requires immediate attention</option>
                </select>
                <div className="form-text">
                  Select the priority level for your request. Higher priority requests will be processed first.
                </div>
              </div>

              {/* Content */}
              <div className="mb-3">
                <label htmlFor="content" className="form-label">
                  <strong>{t('content')}</strong>
                  <br />
                  <small>Remaining characters: <span className={remainingChars < 50 ? 'text-warning' : 'text-muted'}>{remainingChars}</span></small>
                </label>
                <textarea
                  id="content"
                  className="form-control"
                  rows="4"
                  value={formData.content}
                  onChange={handleContentChange}
                  placeholder="Please describe your request in detail..."
                  required
                />
              </div>

              {/* File Upload Section */}
              {selectedType && (
                <div className="mb-3">
                  <label className="form-label">
                    <strong>{t('attachment')}</strong>
                    {selectedType.is_document_required && (
                      <span className="text-danger"> ({t('required')})</span>
                    )}
                  </label>
                  
                  <div className="border rounded p-3 bg-light">
                    <div className="mb-3">
                      <input
                        type="file"
                        className="form-control"
                        multiple
                        accept=".jpeg,.jpg,.png,.pdf,.doc,.docx,.csv"
                        onChange={handleFileChange}
                        disabled={loading || submitting}
                      />
                      <div className="form-text">
                        <strong>Allowed:</strong> JPEG, JPG, PNG, PDF, DOC, DOCX, CSV<br/>
                        <strong>{t('maxFileSize')}</strong> | <strong>Maximum files:</strong> 3
                        {selectedType.is_document_required && (
                          <span className="text-warning d-block">
                            <strong>⚠️ Document upload is required for this request type.</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {files.length > 0 && (
                      <div>
                        <strong>Selected Files:</strong>
                        {files.map((file, index) => (
                          <div key={index} className="d-flex justify-content-between align-items-center border rounded p-2 mb-2 bg-white">
                            <div>
                              <strong>{file.name}</strong><br/>
                              <small className="text-muted">{formatFileSize(file.size)}</small>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeFile(index)}
                              disabled={loading || submitting}
                            >
                              {t('delete')}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Important Notes */}
              <div className="alert alert-warning">
                <h6>{t('guidelines')}:</h6>
                <ul className="mb-0">
                  <li>{t('guideline1')}</li>
                  <li>{t('guideline2')}</li>
                  <li>{t('guideline4')}</li>
                  <li>Maximum content length is 300 characters.</li>
                  <li>Higher priority requests will be processed first by administrators.</li>
                </ul>
              </div>

              {/* Submit Button */}
              <div className="d-grid gap-2">
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={
                    loading || 
                    submitting ||
                    !formData.type_id || 
                    !formData.content.trim() ||
                    (selectedType?.is_document_required && files.length === 0)
                  }
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      {files.length > 0 ? 'Creating & Uploading...' : t('loading') + '...'}
                    </>
                  ) : (
                    <>
                      ✉️ {t('submitRequest')}
                      {files.length > 0 && ` (${files.length} file${files.length > 1 ? 's' : ''})`}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Guidelines */}
        <div className="mt-4">
          <h5>{t('guidelines')}</h5>
          <div className="card">
            <div className="card-body">
              <h6>Before submitting your request:</h6>
              <ul>
                <li>Check if your issue can be resolved by contacting your supervisor directly</li>
                <li>Make sure you have selected the correct request type and priority level</li>
                <li>Provide clear and detailed information about your request</li>
                <li>If document upload is required, prepare your files (max 3 files, 2MB each)</li>
                <li>Higher priority requests (High/Urgent) should only be used for truly important matters</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateRequestPage;