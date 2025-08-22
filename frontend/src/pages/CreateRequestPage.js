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
  
  // ⭐ FIXED: Rename to avoid conflict
  const { 
    status: workingHoursStatus, 
    isWithinWorkingHours, 
    canCreateRequest: canCreateDuringWorkingHours 
  } = useWorkingHours();
  
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
  
  // ⭐ ENHANCED: Academic Calendar + 24-hour limit state
  const [lastRequestInfo, setLastRequestInfo] = useState(null);
  const [canSubmitRequestNow, setCanSubmitRequestNow] = useState(true); // Renamed
  const [timeUntilNextRequest, setTimeUntilNextRequest] = useState(null);
  const [academicCalendarStatus, setAcademicCalendarStatus] = useState(null);

  useEffect(() => {
    const fetchRequestTypes = async () => {
      try {
        const response = await apiService.getRequestTypes();
        setRequestTypes(response.data.data);
      } catch (error) {
        console.error('Error fetching request types:', error);
        showError(t('failedToLoadRequestTypes'));
      }
    };

    fetchRequestTypes();
  }, [showError]);



  // ⭐ UPDATED: Check student's recent requests for 24-hour limit
  useEffect(() => {
    const checkRecentRequests = async () => {
      if (!user?.student_id) return;
      
      try {
        console.log('🔍 Checking recent requests for 24-hour limit...');
        
        const response = await apiService.getStudentRequests(user.student_id);
        
        if (response.data.success) {
          const requests = response.data.data;
          
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
            const lastRequest = recentRequests[0];
            const lastRequestTime = new Date(lastRequest.submitted_at);
            const nextAllowedTime = new Date(lastRequestTime.getTime() + 24 * 60 * 60 * 1000);
            const now = new Date();
            
            if (now < nextAllowedTime) {
              setLastRequestInfo({
                lastRequestTime: lastRequestTime,
                nextAllowedTime: nextAllowedTime,
                hoursRemaining: Math.ceil((nextAllowedTime - now) / (1000 * 60 * 60))
              });
              setCanSubmitRequestNow(false);
              
              const timer = setInterval(() => {
                const currentTime = new Date();
                const hoursLeft = Math.ceil((nextAllowedTime - currentTime) / (1000 * 60 * 60));
                
                if (hoursLeft <= 0) {
                  setCanSubmitRequestNow(true);
                  setLastRequestInfo(null);
                  clearInterval(timer);
                  showSuccess(t('youCanNowSubmitNewRequest'));
                } else {
                  setLastRequestInfo(prev => ({
                    ...prev,
                    hoursRemaining: hoursLeft
                  }));
                }
              }, 60000);
              
              return () => clearInterval(timer);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error checking recent requests:', error);
      }
    };

    checkRecentRequests();
  }, [user?.student_id, showSuccess]);

  // ⭐ ENHANCED: Combined availability check
  const canActuallyCreateRequest = () => {
    // Check all conditions
    const workingHoursOk = canCreateDuringWorkingHours;
    const calendar24HourOk = canSubmitRequestNow;
    const academicCalendarOk = academicCalendarStatus?.canCreateRequest !== false;
    
    console.log(' Combined availability check:', {
      workingHoursOk,
      calendar24HourOk,
      academicCalendarOk,
      finalResult: workingHoursOk && calendar24HourOk && academicCalendarOk
    });
    
    return workingHoursOk && calendar24HourOk && academicCalendarOk;
  };

  // ⭐ NEW: Get restriction reason
  const getRestrictionReason = () => {
    if (!canCreateDuringWorkingHours) {
      return {
        type: 'working_hours',
        message: t('outsideWorkingHours'),
        icon: ''
      };
    }
    
    
    
    if (academicCalendarStatus && !academicCalendarStatus.canCreateRequest) {
      return {
        type: 'academic_calendar',
        message: academicCalendarStatus.message || t('academicCalendarRestriction'),
        icon: ''
      };
    }
    
    return null;
  };

  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return '';
    if (fileType.includes('image')) return '';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('csv') || fileType.includes('excel')) return '📊';
    return '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    // handleFileChange mantığını kullan
    handleFileChange({ target: { files: droppedFiles } });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
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
    
    const totalFiles = files.length + selectedFiles.length;
    
    if (totalFiles > 3) {
      showError(`Maximum 3 files allowed. You have ${files.length} files, trying to add ${selectedFiles.length} more.`);
      e.target.value = '';
      return;
    }
    
    const validFiles = [];
    const errors = [];
    
    selectedFiles.forEach(file => {
      const isDuplicate = files.some(existingFile => existingFile.name === file.name);
      if (isDuplicate) {
        errors.push(`${file.name}: ${t('fileAlreadyAdded')}`)
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
    
    setFiles(prevFiles => [...prevFiles, ...validFiles]);
    setError(null);
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
    
    if (submitting) {
      showWarning(t('requestAlreadyBeingSubmitted'));
      return;
    }

    // ⭐ ENHANCED: Comprehensive availability check
    if (!canActuallyCreateRequest()) {
      const restriction = getRestrictionReason();
      if (restriction) {
        showError(`${restriction.icon} ${restriction.message}`);
        
        if (restriction.type === 'working_hours') {
          setShowWorkingHoursModal(true);
        }
        return;
      }
    }

    if (selectedType?.is_document_required && files.length === 0) {
      showError(t('thisRequestTypeRequires'));
      return;
    }

    const oversizedFiles = files.filter(file => file.size > 2 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
showError(t('filesTooLarge', { files: oversizedFiles.map(f => f.name).join(', ') }));
      return;
    }

    setSubmitting(true);
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      showInfo(t('creatingYourRequest'));
      
      // ⭐ ENHANCED: Use calendar-aware request creation
      const response = await apiService.createRequestWithCalendarValidation(formData);
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
      
      setFormData({
        student_id: user?.student_id || 1,
        type_id: '',
        content: '',
        priority: 'Medium'
      });
      setFiles([]);
      setSelectedType(null);
      
      // ⭐ UPDATED: Update 24-hour limit state
      const now = new Date();
      const nextAllowedTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      setLastRequestInfo({
        lastRequestTime: now,
        nextAllowedTime: nextAllowedTime,
        hoursRemaining: 24
      });
      setCanSubmitRequestNow(false);
      
      showInfo(' Remember: You can submit your next request after 24 hours during working hours.');
      
      setTimeout(() => {
        navigate('/requests');
      }, 2000);
      
    } catch (error) {
      console.error(' Request creation error:', error);
      
      // ⭐ ENHANCED: Better error handling for calendar restrictions
      if (error.response?.status === 423) {
        const errorData = error.response.data;
        
        if (errorData.errorCode === 'ACADEMIC_HOLIDAY') {
showError(t('academicHoliday') + ': ' + errorData.error);
          if (errorData.guidance?.next_available_date) {
showInfo(t('nextAvailable') + ': ' + errorData.guidance.next_available_date);
          }
        } else if (errorData.errorCode === 'OUTSIDE_WORKING_HOURS') {
showError(t('outsideWorkingHoursLong'));
          if (errorData.guidance?.nextOpening) {
            showInfo(` ${errorData.guidance.nextOpening}`);
          }
          setShowWorkingHoursModal(true);
        } else {
          showError(` ${errorData.error}`);
        }
        return;
      }
      
      if (error.response?.status === 429) {
        const errorData = error.response.data;
        
        if (errorData.errorCode === 'DAILY_LIMIT_EXCEEDED') {
showError(t('dailyLimitExceeded') + ': ' + errorData.error);
          if (errorData.details) {
            setLastRequestInfo({
              lastRequestTime: new Date(errorData.details.last_request_time),
              nextAllowedTime: new Date(errorData.details.actual_next_available_time || errorData.details.next_allowed_time),
              hoursRemaining: errorData.details.hours_remaining
            });
            setCanSubmitRequestNow(false);
showInfo(t('nextRequestAvailable') + ': ' + new Date(errorData.details.actual_next_available_time || errorData.details.next_allowed_time).toLocaleString('tr-TR'));
          }
        } else if (errorData.errorCode === 'HOURLY_RATE_LIMIT_EXCEEDED') {
showError(t('rateLimitExceeded') + ': ' + errorData.error);
          if (errorData.details) {
showInfo(t('pleaseWaitMinutes', { minutes: errorData.details.minutes_remaining }));
          }
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
{success} {t('redirectingToRequests')}
          </div>
        )}

        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              {/* ⭐ ENHANCED: Comprehensive restriction notice */}
              {!canActuallyCreateRequest() && (() => {
                const restriction = getRestrictionReason();
                return restriction ? (
                  <div className="alert alert-danger mb-4">
<h6 className="alert-heading">{t('requestCreationRestricted')}</h6>
                    <p className="mb-2">{restriction.message}</p>
                    
                   
                    
                    {restriction.type === '24_hour_limit' && lastRequestInfo && (
                      <p className="mb-0">
<strong>{t('nextRequestAvailable')}:</strong> {lastRequestInfo.nextAllowedTime.toLocaleString('tr-TR')}
                      </p>
                    )}
                    
                    {restriction.type === 'academic_calendar' && academicCalendarStatus?.details && (
                      <div>
                        {academicCalendarStatus.details.holidayNames && (
                          <p className="mb-0">
<strong>{t('currentHoliday')}:</strong> {academicCalendarStatus.details.holidayNames}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Important Notes */}
              <div className="alert alert-danger">
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
                  disabled={!canActuallyCreateRequest()}
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
                           {t('documentUploadRequired')}
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
                  disabled={!canActuallyCreateRequest()}
                >
                  <option value="Low"> {t('low')} - {t('nonUrgentRequest')}</option>
                  <option value="Medium"> {t('medium')} - {t('standardRequest')}</option>
                  <option value="High"> {t('high')} - {t('importantRequest')}</option>
                  <option value="Urgent"> {t('urgent')} - {t('requiresImmediateAttention')}</option>
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
                  disabled={!canActuallyCreateRequest()}
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
                   <input
                     type="file"
                     className="d-none"
                     id="file-upload-input"
                     multiple
                     accept=".jpeg,.jpg,.png,.pdf,.doc,.docx,.csv"
                     onChange={handleFileChange}
                     disabled={loading || submitting || !canActuallyCreateRequest()}
                   />
                   
                   <div className="row">
                     <div className="col-md-4">
                       <div className="text-center">
                         <label 
                           htmlFor="file-upload-input" 
                           className="btn btn-primary d-flex flex-column align-items-center p-4 h-100"
                           style={{ 
                             cursor: (loading || submitting || !canActuallyCreateRequest()) ? 'not-allowed' : 'pointer',
                             opacity: (loading || submitting || !canActuallyCreateRequest()) ? 0.6 : 1,
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
{t('maxFilesLimit')}
                           </small>
                         </label>
                       </div>
                     </div>
                     
                     <div className="col-md-8">
                       <div 
                         className="border border-2 border-dashed rounded p-4 h-100 d-flex flex-column justify-content-center align-items-center"
                         style={{ 
                           borderColor: '#dee2e6',
                           backgroundColor: '#ffffff',
                           transition: 'all 0.3s ease',
                           minHeight: '150px'
                         }}
                         onDrop={handleDrop}
                         onDragOver={handleDragOver}
                         onDragEnter={handleDragEnter}
                         onDragLeave={handleDragLeave}
                       >
                         <div className="text-muted text-center">
                           <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>📎</div>
<h6 className="mb-2">{t('dragFilesHere')}</h6>
                           <p className="mb-0 small">
  {t('orUseButtonToBrowse')}
                           </p>
                         </div>
                       </div>
                     </div>
                   </div>
                   
                   <div className="row mt-3">
                     <div className="col-12">
                       <div className="d-flex justify-content-between align-items-center">
                         <div className="form-text">
<strong>{t('allowed')}:</strong> {t('allowedFileTypes')}
                         </div>
                         <div className="text-end">
                           <span className={`badge ${files.length >= 3 ? 'bg-warning' : 'bg-info'}`}>
{files.length} / 3 {t('files')}
                           </span>
                         </div>
                       </div>
                       
                       {selectedType.is_document_required && (
                         <div className="alert alert-warning mt-2 py-2">
                           <small>
<strong> {t('required')}:</strong> {t('documentUploadRequired')}
                           </small>
                         </div>
                       )}
                     </div>
                   </div>

                   {files.length > 0 && (
                     <div className="mt-4">
                       <div className="d-flex justify-content-between align-items-center mb-3">
                         <h6 className="mb-0">
{t('selectedFiles')} ({files.length})
                         </h6>
                         <button
                           type="button"
                           className="btn btn-outline-danger btn-sm"
                           onClick={() => setFiles([])}
                           disabled={loading || submitting || !canActuallyCreateRequest()}
                         >
 {t('clearAll')}
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
                                           disabled={loading || submitting || !canActuallyCreateRequest()}
                                           title="Remove file"
                                           style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                         >
                                           ✕
                                         </button>
                                       </div>
                                     </div>
                                   </div>
                                 </div>
                                 
                                 <div className="mt-2">
                                   <div className="progress" style={{ height: '3px' }}>
                                     <div 
                                       className="progress-bar bg-success" 
                                       style={{ width: '100%' }}
                                     ></div>
                                   </div>
                                   <small className="text-success">
                                     {t('readyToUpload')}

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
                 <div className="alert alert-danger">
                   <h6>{t('beforeSubmitting')}:</h6>
                   <ul>
                     <li>{t('checkIfResolvable')}</li>
                     <li>{t('ensureCorrectType')}</li>
                     <li>{t('provideDetail')}</li>
                     <li>{t('prepareFiles')}</li>
                     <li>{t('useHighPriority')}</li>
{t('ensureWorkingHoursAndHolidays')}
                    
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
                   !canActuallyCreateRequest() ||
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
                 ) : !canActuallyCreateRequest() ? (
                   (() => {
                     const restriction = getRestrictionReason();
                     if (restriction?.type === '24_hour_limit') {
                       return <> {t('waitHours', { hours: lastRequestInfo?.hoursRemaining || 0 })} </>;
                     } else if (restriction?.type === 'working_hours') {
                       return <> {t('outsideWorkingHours')}</>;
                     } else if (restriction?.type === 'academic_calendar') {
                       return <> {t('academicHoliday')}
</>;
                     } else {
                       return <> {t('requestRestricted')}</>;
                     }
                   })()
                 ) : (
                   <>
                      {t('submitRequest')}
                     {files.length > 0 && ` (${files.length} ${files.length > 1 ? t('files') : t('file')})`}
                   </>
                 )}
               </button>
               
               {/* Additional info under button */}
               {!canActuallyCreateRequest() && (() => {
                 const restriction = getRestrictionReason();
                 if (restriction?.type === '24_hour_limit' && lastRequestInfo) {
                   return (
                     <small className="text-muted text-center">
{t('nextRequestAvailable')}: {lastRequestInfo.nextAllowedTime.toLocaleString('tr-TR')}
                     </small>
                   );
                 } else if (restriction?.type === 'academic_calendar' && academicCalendarStatus?.details?.nextAvailable) {
                   return (
                     <small className="text-muted text-center">
{t('nextAvailable')}: {academicCalendarStatus.details.nextAvailable}                     </small>
                   );
                 }
                 return null;
               })()}
             </div>
           </form>
         </div>
       </div>

     
     </div>
   </div>
 );
};

export default CreateRequestPage;