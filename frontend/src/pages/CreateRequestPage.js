import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../hooks/useTranslation';
import WorkingHoursNotice, { useWorkingHours, WorkingHoursModal } from '../components/WorkingHoursNotice';

const CreateRequestPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { t, translateRequestType } = useTranslation();
  
  const { status: workingHoursStatus, isWithinWorkingHours, canCreateRequest } = useWorkingHours();
  
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

  const [showWorkingHoursModal, setShowWorkingHoursModal] = useState(false);
  const [workingHoursChecked, setWorkingHoursChecked] = useState(false);
  
  // ⭐ NEW: 24-hour limit state
  const [lastRequestInfo, setLastRequestInfo] = useState(null);
  const [canSubmitRequest, setCanSubmitRequest] = useState(true);
  const [timeUntilNextRequest, setTimeUntilNextRequest] = useState(null);

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

  // ⭐ NEW: Check student's recent requests for 24-hour limit
  useEffect(() => {
    const checkRecentRequests = async () => {
      if (!user?.student_id) return;
      
      try {
        console.log('🔍 Checking recent requests for 24-hour limit...');
        
        // Get student's recent requests
        const response = await apiService.getStudentRequests(user.student_id);
        
        if (response.data.success) {
          const requests = response.data.data;
          
          // Find the most recent request within 24 hours
          const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recentRequests = requests.filter(req => 
            new Date(req.submitted_at) > last24Hours
          );
          
          console.log('📊 Recent requests check:', {
            totalRequests: requests.length,
            recentRequests: recentRequests.length,
            last24Hours: last24Hours.toISOString()
          });
          
          if (recentRequests.length > 0) {
            const lastRequest = recentRequests[0]; // Most recent
            const lastRequestTime = new Date(lastRequest.submitted_at);
            const nextAllowedTime = new Date(lastRequestTime.getTime() + 24 * 60 * 60 * 1000);
            const now = new Date();
            
            if (now < nextAllowedTime) {
              setLastRequestInfo({
                lastRequestTime: lastRequestTime,
                nextAllowedTime: nextAllowedTime,
                hoursRemaining: Math.ceil((nextAllowedTime - now) / (1000 * 60 * 60))
              });
              setCanSubmitRequest(false);
              
              // Set up timer to update remaining time
              const timer = setInterval(() => {
                const currentTime = new Date();
                const hoursLeft = Math.ceil((nextAllowedTime - currentTime) / (1000 * 60 * 60));
                
                if (hoursLeft <= 0) {
                  setCanSubmitRequest(true);
                  setLastRequestInfo(null);
                  clearInterval(timer);
                  showSuccess('✅ You can now submit a new request!');
                } else {
                  setLastRequestInfo(prev => ({
                    ...prev,
                    hoursRemaining: hoursLeft
                  }));
                }
              }, 60000); // Update every minute
              
              return () => clearInterval(timer);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error checking recent requests:', error);
        // Don't show error to user as this is background check
      }
    };

    checkRecentRequests();
  }, [user?.student_id, showSuccess]);

  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('csv') || fileType.includes('excel')) return '📊';
    return '📎';
  };

  useEffect(() => {
    if (workingHoursStatus && !workingHoursStatus.isAllowed && !workingHoursChecked) {
      setShowWorkingHoursModal(true);
      setWorkingHoursChecked(true);
    }
  }, [workingHoursStatus, workingHoursChecked]);

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

    // ⭐ NEW: 24-hour limit check
    if (!canSubmitRequest) {
      showError(`⏰ You can only submit 1 request per 24 hours. Please wait ${lastRequestInfo?.hoursRemaining || 0} more hours.`);
      return;
    }

    // ⭐ Mesai saatleri son kontrol
    if (!canCreateRequest) {
      showError('Requests can only be created during working hours (Monday-Friday 08:30-17:30)');
      setShowWorkingHoursModal(true);
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
      
      // ⭐ NEW: Update 24-hour limit state
      const now = new Date();
      const nextAllowedTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      setLastRequestInfo({
        lastRequestTime: now,
        nextAllowedTime: nextAllowedTime,
        hoursRemaining: 24
      });
      setCanSubmitRequest(false);
      
      showInfo('ℹ️ Remember: You can submit your next request after 24 hours.');
      
      setTimeout(() => {
        navigate('/requests');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Request creation error:', error);
      
      // ⭐ Enhanced error handling for different limit types
      if (error.response?.status === 423 && error.response?.data?.errorCode === 'OUTSIDE_WORKING_HOURS') {
        const errorData = error.response.data;
        showError('❌ Outside working hours: Requests can only be created Monday-Friday 08:30-17:30 (TRNC Time)');
        
        if (errorData.guidance?.nextOpening) {
          showInfo(`📅 ${errorData.guidance.nextOpening}`);
        }
        
        setShowWorkingHoursModal(true);
        return;
      }
      
      // ⭐ NEW: Handle 24-hour limit error
      if (error.response?.status === 429 && error.response?.data?.errorCode === 'DAILY_LIMIT_EXCEEDED') {
        const errorData = error.response.data;
        showError(`⏰ Daily limit exceeded: ${errorData.error}`);
        
        if (errorData.details) {
          setLastRequestInfo({
            lastRequestTime: new Date(errorData.details.last_request_time),
            nextAllowedTime: new Date(errorData.details.next_allowed_time),
            hoursRemaining: errorData.details.hours_remaining
          });
          setCanSubmitRequest(false);
          
          showInfo(`📅 Next request available: ${new Date(errorData.details.next_allowed_time).toLocaleString('tr-TR')}`);
        }
        return;
      }
      
      // ⭐ NEW: Handle hourly rate limit error
      if (error.response?.status === 429 && error.response?.data?.errorCode === 'HOURLY_RATE_LIMIT_EXCEEDED') {
        const errorData = error.response.data;
        showError(`⏰ Rate limit exceeded: ${errorData.error}`);
        
        if (errorData.details) {
          showInfo(`⏱️ Please wait ${errorData.details.minutes_remaining} more minutes`);
        }
        return;
      }

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
              {/* ⭐ Working hours status in form */}
              {!canCreateRequest && (
                <div className="alert alert-warning mb-4">
                  <h6 className="alert-heading">🕒 Outside Working Hours</h6>
                  <p className="mb-2">
                    Requests can only be created during working hours for proper support.
                  </p>
                  <p className="mb-0">
                    <strong>Working hours:</strong> Monday-Friday, 08:30-17:30 (TRNC Time)
                  </p>
                </div>
              )}

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
                  disabled={!canSubmitRequest || !canCreateRequest}
                >
                  <option value="">{t('pleaseSelect')}</option>
                  {Object.keys(requestTypes).map((category) => (
                    <optgroup key={category} label={t(category.toLowerCase().replace(/\s+/g, ''))}>
                      {requestTypes[category].map((type) => (
                        <option key={type.type_id} value={type.type_id}>
                          {translateRequestType(type.type_name)}
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
                  disabled={!canSubmitRequest || !canCreateRequest}
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
                  disabled={!canSubmitRequest || !canCreateRequest}
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
                  
                  <div className="border rounded p-3" style={{ backgroundColor: '#f8f9fa' }}>
                    {/* Hidden File Input */}
                    <input
                      type="file"
                      className="d-none"
                      id="file-upload-input"
                      multiple
                      accept=".jpeg,.jpg,.png,.pdf,.doc,.docx,.csv"
                      onChange={handleFileChange}
                      disabled={loading || submitting || !canSubmitRequest || !canCreateRequest}
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
                              cursor: (loading || submitting || !canSubmitRequest || !canCreateRequest) ? 'not-allowed' : 'pointer',
                              opacity: (loading || submitting || !canSubmitRequest || !canCreateRequest) ? 0.6 : 1,
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
                            disabled={loading || submitting || !canSubmitRequest}
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
                                            disabled={loading || submitting || !canSubmitRequest}
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
                    !canSubmitRequest ||
                    !canCreateRequest ||
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
                  ) : !canSubmitRequest ? (
                    <>
                      ⏰ Wait {lastRequestInfo?.hoursRemaining || 0} hours
                    </>
                  ) : !canCreateRequest ? (
                    <>
                      🕒 Outside Working Hours
                    </>
                  ) : (
                    <>
                      ✉️ {t('submitRequest')}
                      {files.length > 0 && ` (${files.length} ${files.length > 1 ? t('files') : t('file')})`}
                    </>
                  )}
                </button>
                
                {/* Additional info under button */}
                {!canSubmitRequest && lastRequestInfo && (
                  <small className="text-muted text-center">
                    Next request available: {lastRequestInfo.nextAllowedTime.toLocaleString('tr-TR')}
                  </small>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateRequestPage;