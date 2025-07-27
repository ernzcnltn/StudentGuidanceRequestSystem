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
  const { t, translateRequestType } = useTranslation();
  
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
  errors.push(`${file.name}: ${t('invalidFileType')}`);
  return;
}

      
     if (file.size > maxSize) {
  errors.push(`${file.name}: ${t('fileTooLarge')}`);
  return;
}
      
      validFiles.push(file);
    });
    
   if (errors.length > 0) {
  showError(`${t('fileValidationFailed')}: ${errors.join(', ')}`);
  e.target.value = '';
  return;
}
    
    setFiles(validFiles);
    setError(null);
    
  if (validFiles.length > 0) {
  showSuccess(`${validFiles.length} ${t('fileSelectedSuccessfully')}`);
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
  showWarning(t('requestAlreadyBeingSubmitted'));
  return;
}

    // Required document kontrolü
    if (selectedType?.is_document_required && files.length === 0) {
  showError(t('thisRequestTypeRequires'));
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
      showInfo(t('creatingYourRequest'));
      
      const response = await apiService.createRequest(formData);
      const requestId = response.data.data.request_id;
      
      if (files.length > 0) {
         showInfo(t('uploadingFiles'));
        
        const fileFormData = new FormData();
        files.forEach(file => {
          fileFormData.append('files', file);
        });
        
        try {
          await apiService.uploadFiles(requestId, fileFormData);
          showSuccess(`✅ ${t('requestCreatedSuccessfully')} #${requestId} ${t('requestCreatedWithFiles')} ${files.length} ${t('files')}!`);
        } catch (uploadError) {
           showError(t('filesCouldNotBeUploaded'));
        }
      } else {
        showSuccess(`✅ ${t('requestCreatedSuccessfully')} #${requestId}!`);
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
      const errorMessage = error.response?.data?.error || t('requestFailed');
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


            
              {/* Important Notes */}
              <div className="alert alert-warning">
                <h6>{t('guidelines')}:</h6>
                <ul className="mb-0">
                  <li>{t('guideline1')}</li>
                  <li>{t('guideline2')}</li>
                  <li>{t('guideline4')}</li>
                 
                  
                </ul>
              </div>


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
              <optgroup key={category} label={t(category.toLowerCase().replace(/\s+/g, ''))}>
                {requestTypes[category].map((type) => (
                  <option key={type.type_id} value={type.type_id}>
                    {translateRequestType(type.type_name)} {/* BURADA ÇEVİRİ */}
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
      <strong>{t('typeDetail')}</strong>
    </label>
    <div className="alert alert-info">
      {selectedType.description_en || t('noDescriptionAvailable')}
      {selectedType.is_document_required && (
        <div className="mt-2">
          <strong className="text-warning">
            ⚠️ {t('documentUploadRequired')}
          </strong>
        </div>
      )}
    </div>
  </div>
)}

              {/* Priority Selection */}
             <div className="mb-3">
  <label htmlFor="priority" className="form-label">
    <strong>{t('priorityLevel')}</strong>
  </label>
  <select
    id="priority"
    className="form-select"
    value={formData.priority}
    onChange={handlePriorityChange}
    required
  >
    <option value="Low">🔵 {t('low')} - {t('nonUrgentRequest')}</option>
    <option value="Medium">🟡 {t('medium')} - {t('standardRequest')}</option>
    <option value="High">🟠 {t('high')} - {t('importantRequest')}</option>
    <option value="Urgent">🔴 {t('urgent')} - {t('requiresImmediateAttention')}</option>
  </select>
  <div className="form-text">
    {t('selectPriorityLevel')}
  </div>
</div>

              {/* Content */}
              <div className="mb-3">
                <label htmlFor="content" className="form-label">
  <strong>{t('content')}</strong>
  <br />
  <small>{t('remainingCharacters')}: <span className={remainingChars < 50 ? 'text-warning' : 'text-muted'}>{remainingChars}</span></small>
</label>
<textarea
  id="content"
  className="form-control"
  rows="4"
  value={formData.content}
  onChange={handleContentChange}
  placeholder={t('pleaseDescribe')}
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
                        <strong>{t('allowed')}:</strong> JPEG, JPG, PNG, PDF, DOC, DOCX, CSV<br/>
  <strong>{t('maxFileSize')}</strong> | <strong>{t('maximumFiles')}:</strong> 3
  {selectedType.is_document_required && (
                          <span className="text-warning d-block">
                             <strong>⚠️ {t('documentUploadRequired')}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {files.length > 0 && (
                      <div>
                       <strong>{t('selectedFiles')}:</strong>
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


                 {/* Guidelines */}
       <div className="mt-4">
  <h5>{t('guidelines')}</h5>
  <div className="card">
    <div className="alert alert-warning">
      <h6>{t('beforeSubmitting')}:</h6>
      <ul>
        <li>{t('checkIfResolvable')}</li>
        <li>{t('ensureCorrectType')}</li>
        <li>{t('provideDetail')}</li>
        <li>{t('prepareFiles')}</li>
        <li>{t('useHighPriority')}</li>
      </ul>
    </div>
  </div>
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
      {files.length > 0 ? t('creatingAndUploading') : t('loading') + '...'}
    </>
  ) : (
    <>
      ✉️ {t('submitRequest')}
      {files.length > 0 && ` (${files.length} ${files.length > 1 ? t('files') : t('file')})`}
    </>
  )}
</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateRequestPage;