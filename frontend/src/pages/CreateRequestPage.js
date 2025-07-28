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


  const getFileIcon = (fileType) => {
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('image')) return '🖼️';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('csv') || fileType.includes('excel')) return '📊';
  return '📎';
};

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
  
  // Mevcut dosya sayısını kontrol et
  const totalFiles = files.length + selectedFiles.length;
  
  if (totalFiles > 3) {
    showError(`Maximum 3 files allowed. You have ${files.length} files, trying to add ${selectedFiles.length} more.`);
    e.target.value = '';
    return;
  }
  
  // File validation
  const validFiles = [];
  const errors = [];
  
  selectedFiles.forEach(file => {
    // Aynı isimde dosya var mı kontrol et
    const isDuplicate = files.some(existingFile => existingFile.name === file.name);
    if (isDuplicate) {
      errors.push(`${file.name}: File already added`);
      return;
    }
    
    const validTypes = [
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
      'text/csv'
    ];
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
  
  // Mevcut dosyalara yeni dosyaları ekle
  setFiles(prevFiles => [...prevFiles, ...validFiles]);
  setError(null);
  
  // Input'u temizle ki aynı dosya tekrar seçilebilsin
  e.target.value = '';
  
  if (validFiles.length > 0) {
    showSuccess(`${validFiles.length} ${t('fileSelectedSuccessfully')}. Total: ${files.length + validFiles.length} files.`);
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
              {/* File Upload Section - Bu kısım mevcut kodunuzu tamamen değiştirecek */}
{selectedType && (
  <div className="mb-3">
    <label className="form-label">
      <strong>{t('attachment')}</strong>
      {selectedType.is_document_required && (
        <span className="text-danger"> ({t('required')})</span>
      )}
    </label>
    
    <div className="border rounded p-3" style={{ backgroundColor: '#f8f9fa' }}>
      {/* Hidden File Input */}
      <input
        type="file"
        className="d-none"
        id="file-upload-input"
        multiple
        accept=".jpeg,.jpg,.png,.pdf,.doc,.docx,.csv"
        onChange={handleFileChange}
        disabled={loading || submitting}
      />
      
      {/* File Upload Area */}
      <div className="row">
        {/* Upload Button Section */}
        <div className="col-md-4">
          <div className="text-center">
            <label 
              htmlFor="file-upload-input" 
              className="btn btn-primary d-flex flex-column align-items-center p-4 h-100"
              style={{ 
                cursor: loading || submitting ? 'not-allowed' : 'pointer',
                opacity: loading || submitting ? 0.6 : 1,
                borderRadius: '12px',
                border: 'none',
                minHeight: '150px',
                justifyContent: 'center'
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '10px' }}>
                📁
              </div>
              <div className="fw-bold mb-2">
                {files.length > 0 ? 'Add More Files' : t('chooseFiles')}
              </div>
              <small className="text-white-50">
                Max 3 files • 2MB each
              </small>
            </label>
          </div>
        </div>
        
        {/* Drag & Drop Area */}
        <div className="col-md-8">
          <div 
            className="border border-2 border-dashed rounded p-4 h-100 d-flex flex-column justify-content-center align-items-center"
            style={{ 
              borderColor: '#dee2e6',
              backgroundColor: '#ffffff',
              transition: 'all 0.3s ease',
              minHeight: '150px'
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '#0d6efd';
              e.currentTarget.style.backgroundColor = '#e7f3ff';
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '#dee2e6';
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '#dee2e6';
              e.currentTarget.style.backgroundColor = '#ffffff';
              
              const droppedFiles = Array.from(e.dataTransfer.files);
              if (droppedFiles.length > 0) {
                const fakeEvent = {
                  target: {
                    files: droppedFiles,
                    value: ''
                  }
                };
                handleFileChange(fakeEvent);
              }
            }}
          >
            <div className="text-muted text-center">
              <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>📎</div>
              <h6 className="mb-2">Drag files here</h6>
              <p className="mb-0 small">
                or use the button to browse
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* File Info */}
      <div className="row mt-3">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div className="form-text">
              <strong>Allowed:</strong> PDF, Images, DOC, CSV
            </div>
            <div className="text-end">
              <span className={`badge ${files.length >= 3 ? 'bg-warning' : 'bg-info'}`}>
                {files.length} / 3 files
              </span>
            </div>
          </div>
          
          {selectedType.is_document_required && (
            <div className="alert alert-warning mt-2 py-2">
              <small>
                <strong>⚠️ Required:</strong> {t('documentUploadRequired')}
              </small>
            </div>
          )}
        </div>
      </div>

      {/* Selected Files Display */}
      {files.length > 0 && (
        <div className="mt-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0">
              📋 Selected Files ({files.length})
            </h6>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={() => setFiles([])}
              disabled={loading || submitting}
            >
              🗑️ Clear All
            </button>
          </div>
          
          <div className="row">
            {files.map((file, index) => (
              <div key={index} className="col-lg-6 mb-2">
                <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #0d6efd' }}>
                  <div className="card-body p-3">
                    <div className="d-flex align-items-center">
                      <div className="me-3">
                        <div 
                          className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                          style={{ width: '45px', height: '45px', fontSize: '1.2rem' }}
                        >
                          {getFileIcon(file.type)}
                        </div>
                      </div>
                      <div className="flex-grow-1">
                        <h6 className="card-title mb-1" style={{ fontSize: '0.9rem' }}>
                          {file.name.length > 25 
                            ? file.name.substring(0, 25) + '...' 
                            : file.name
                          }
                        </h6>
                        <div className="d-flex justify-content-between align-items-center">
                          <small className="text-muted">
                            {formatFileSize(file.size)}
                          </small>
                          <div className="d-flex gap-1">
                            <span className="badge bg-light text-dark">
                              #{index + 1}
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeFile(index)}
                              disabled={loading || submitting}
                              title="Remove file"
                              style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* File type indicator */}
                    <div className="mt-2">
                      <div className="progress" style={{ height: '3px' }}>
                        <div 
                          className="progress-bar bg-success" 
                          style={{ width: '100%' }}
                        ></div>
                      </div>
                      <small className="text-success">
                        ✓ Ready to upload
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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