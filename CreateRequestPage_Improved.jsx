import React, { useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../hooks/useTranslation';
import WorkingHoursNotice, { useWorkingHours, WorkingHoursModal } from '../components/WorkingHoursNotice';

// ===== CONSTANTS =====
const MAX_FILES = 3;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_CONTENT_LENGTH = 300;
const RATE_LIMIT_HOURS = 24;

const VALID_FILE_TYPES = [
  'image/jpeg', 
  'image/jpg', 
  'image/png', 
  'application/pdf', 
  'application/msword', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
  'text/csv'
];

const PRIORITY_LEVELS = [
  { value: 'Low', label: 'low', description: 'nonUrgentRequest' },
  { value: 'Medium', label: 'medium', description: 'standardRequest' },
  { value: 'High', label: 'high', description: 'importantRequest' },
  { value: 'Urgent', label: 'urgent', description: 'requiresImmediateAttention' }
];

// ===== REDUCER FOR FORM STATE =====
const formReducer = (state, action) => {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_MULTIPLE_FIELDS':
      return { ...state, ...action.fields };
    case 'RESET_FORM':
      return action.initialState;
    default:
      return state;
  }
};

// ===== REDUCER FOR APP STATE =====
const appStateReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_SUBMITTING':
      return { ...state, submitting: action.submitting };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_SUCCESS':
      return { ...state, success: action.success };
    case 'SET_REQUEST_TYPES':
      return { ...state, requestTypes: action.requestTypes };
    case 'SET_SELECTED_TYPE':
      return { ...state, selectedType: action.selectedType };
    case 'SET_FILES':
      return { ...state, files: action.files };
    case 'ADD_FILES':
      return { ...state, files: [...state.files, ...action.files] };
    case 'REMOVE_FILE':
      return { ...state, files: state.files.filter((_, index) => index !== action.index) };
    case 'CLEAR_FILES':
      return { ...state, files: [] };
    case 'SET_RESTRICTIONS':
      return { 
        ...state, 
        lastRequestInfo: action.lastRequestInfo,
        canSubmitRequestNow: action.canSubmitRequestNow,
        academicCalendarStatus: action.academicCalendarStatus
      };
    default:
      return state;
  }
};

// ===== CUSTOM HOOKS =====
const useRequestRestrictions = (user, showSuccess) => {
  const [restrictions, setRestrictions] = useState({
    lastRequestInfo: null,
    canSubmitRequestNow: true,
    academicCalendarStatus: null
  });

  const checkRecentRequests = useCallback(async () => {
    if (!user?.student_id) return;
    
    try {
      console.log('🔍 Checking recent requests for 24-hour limit...');
      
      const response = await apiService.getStudentRequests(user.student_id);
      
      if (response.data.success) {
        const requests = response.data.data;
        const last24Hours = new Date(Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000);
        const recentRequests = requests.filter(req => 
          new Date(req.submitted_at) > last24Hours
        );
        
        if (recentRequests.length > 0) {
          const lastRequest = recentRequests[0];
          const lastRequestTime = new Date(lastRequest.submitted_at);
          const nextAllowedTime = new Date(lastRequestTime.getTime() + RATE_LIMIT_HOURS * 60 * 60 * 1000);
          const now = new Date();
          
          if (now < nextAllowedTime) {
            const hoursRemaining = Math.ceil((nextAllowedTime - now) / (1000 * 60 * 60));
            
            setRestrictions(prev => ({
              ...prev,
              lastRequestInfo: {
                lastRequestTime,
                nextAllowedTime,
                hoursRemaining
              },
              canSubmitRequestNow: false
            }));
            
            // Set up timer for automatic state update
            const timer = setInterval(() => {
              const currentTime = new Date();
              const hoursLeft = Math.ceil((nextAllowedTime - currentTime) / (1000 * 60 * 60));
              
              if (hoursLeft <= 0) {
                setRestrictions(prev => ({
                  ...prev,
                  canSubmitRequestNow: true,
                  lastRequestInfo: null
                }));
                clearInterval(timer);
                showSuccess('You can now submit a new request!');
              } else {
                setRestrictions(prev => ({
                  ...prev,
                  lastRequestInfo: {
                    ...prev.lastRequestInfo,
                    hoursRemaining: hoursLeft
                  }
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
  }, [user?.student_id, showSuccess]);

  useEffect(() => {
    checkRecentRequests();
  }, [checkRecentRequests]);

  return restrictions;
};

const useFileValidation = (showError, t) => {
  const validateFiles = useCallback((selectedFiles, existingFiles) => {
    const totalFiles = existingFiles.length + selectedFiles.length;
    
    if (totalFiles > MAX_FILES) {
      showError(`Maximum ${MAX_FILES} files allowed. You have ${existingFiles.length} files, trying to add ${selectedFiles.length} more.`);
      return { validFiles: [], errors: ['FILE_LIMIT_EXCEEDED'] };
    }
    
    const validFiles = [];
    const errors = [];
    
    selectedFiles.forEach(file => {
      // Check for duplicates
      const isDuplicate = existingFiles.some(existingFile => existingFile.name === file.name);
      if (isDuplicate) {
        errors.push(`${file.name}: ${t('fileAlreadyAdded')}`);
        return;
      }
      
      // Check file type
      if (!VALID_FILE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: ${t('invalidFileType')}`);
        return;
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: ${t('fileTooLarge')}`);
        return;
      }
      
      validFiles.push(file);
    });
    
    return { validFiles, errors };
  }, [showError, t]);

  return { validateFiles };
};

// ===== UTILITY FUNCTIONS =====
const getFileIcon = (fileType) => {
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('image')) return '🖼️';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('csv') || fileType.includes('excel')) return '📊';
  return '📄';
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ===== MAIN COMPONENT =====
const CreateRequestPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { t, translateRequestType } = useTranslation();
  
  const { 
    status: workingHoursStatus, 
    isWithinWorkingHours, 
    canCreateRequest: canCreateDuringWorkingHours 
  } = useWorkingHours();

  // ===== STATE MANAGEMENT =====
  const initialFormState = useMemo(() => ({
    student_id: user?.student_id || 1,
    type_id: '',
    content: '',
    priority: 'Medium'
  }), [user?.student_id]);

  const initialAppState = {
    requestTypes: {},
    selectedType: null,
    loading: false,
    submitting: false,
    error: null,
    success: null,
    files: []
  };

  const [formData, dispatchForm] = useReducer(formReducer, initialFormState);
  const [appState, dispatchApp] = useReducer(appStateReducer, initialAppState);
  const [showWorkingHoursModal, setShowWorkingHoursModal] = useState(false);
  const [workingHoursChecked, setWorkingHoursChecked] = useState(false);

  // Custom hooks
  const restrictions = useRequestRestrictions(user, showSuccess);
  const { validateFiles } = useFileValidation(showError, t);

  // ===== COMPUTED VALUES =====
  const remainingChars = useMemo(() => 
    MAX_CONTENT_LENGTH - formData.content.length, 
    [formData.content.length]
  );

  const canActuallyCreateRequest = useMemo(() => {
    const workingHoursOk = canCreateDuringWorkingHours;
    const calendar24HourOk = restrictions.canSubmitRequestNow;
    const academicCalendarOk = restrictions.academicCalendarStatus?.canCreateRequest !== false;
    
    return workingHoursOk && calendar24HourOk && academicCalendarOk;
  }, [canCreateDuringWorkingHours, restrictions.canSubmitRequestNow, restrictions.academicCalendarStatus]);

  const getRestrictionReason = useMemo(() => {
    if (!canCreateDuringWorkingHours) {
      return {
        type: 'working_hours',
        message: t('outsideWorkingHours'),
        icon: '🕐'
      };
    }
    
    if (!restrictions.canSubmitRequestNow) {
      return {
        type: '24_hour_limit',
        message: `⏰ ${t('mustWait24Hours')}`,
        icon: '⏰'
      };
    }
    
    if (restrictions.academicCalendarStatus && !restrictions.academicCalendarStatus.canCreateRequest) {
      return {
        type: 'academic_calendar',
        message: restrictions.academicCalendarStatus.message || t('academicCalendarRestriction'),
        icon: '📅'
      };
    }
    
    return null;
  }, [canCreateDuringWorkingHours, restrictions, t]);

  const isFormValid = useMemo(() => {
    return (
      formData.type_id && 
      formData.content.trim() &&
      (!appState.selectedType?.is_document_required || appState.files.length > 0)
    );
  }, [formData.type_id, formData.content, appState.selectedType, appState.files.length]);

  // ===== EFFECT HOOKS =====
  useEffect(() => {
    const fetchRequestTypes = async () => {
      try {
        const response = await apiService.getRequestTypes();
        dispatchApp({ type: 'SET_REQUEST_TYPES', requestTypes: response.data.data });
      } catch (error) {
        console.error('Error fetching request types:', error);
        showError(t('failedToLoadRequestTypes'));
      }
    };

    fetchRequestTypes();
  }, [showError, t]);

  useEffect(() => {
    if (workingHoursStatus && !workingHoursStatus.isAllowed && !workingHoursChecked) {
      setShowWorkingHoursModal(true);
      setWorkingHoursChecked(true);
    }
  }, [workingHoursStatus, workingHoursChecked]);

  useEffect(() => {
    if (user) {
      dispatchForm({ 
        type: 'SET_FIELD', 
        field: 'student_id', 
        value: user.student_id 
      });
    }
  }, [user]);

  // ===== EVENT HANDLERS =====
  const handleTypeChange = useCallback(async (typeId) => {
    dispatchForm({ type: 'SET_FIELD', field: 'type_id', value: typeId });
    
    if (typeId) {
      try {
        const response = await apiService.getRequestType(typeId);
        dispatchApp({ type: 'SET_SELECTED_TYPE', selectedType: response.data.data });
      } catch (error) {
        console.error('Error fetching request type details:', error);
        dispatchApp({ type: 'SET_SELECTED_TYPE', selectedType: null });
      }
    } else {
      dispatchApp({ type: 'SET_SELECTED_TYPE', selectedType: null });
    }
  }, []);

  const handleContentChange = useCallback((e) => {
    const content = e.target.value;
    if (content.length <= MAX_CONTENT_LENGTH) {
      dispatchForm({ type: 'SET_FIELD', field: 'content', value: content });
    }
  }, []);

  const handlePriorityChange = useCallback((e) => {
    dispatchForm({ type: 'SET_FIELD', field: 'priority', value: e.target.value });
  }, []);

  const handleFileChange = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files);
    const { validFiles, errors } = validateFiles(selectedFiles, appState.files);
    
    if (errors.length > 0 && !errors.includes('FILE_LIMIT_EXCEEDED')) {
      showError(`${t('fileValidationFailed')}: ${errors.join(', ')}`);
    }
    
    if (validFiles.length > 0) {
      dispatchApp({ type: 'ADD_FILES', files: validFiles });
      dispatchApp({ type: 'SET_ERROR', error: null });
      showSuccess(`${validFiles.length} ${t('fileSelectedSuccessfully')}. Total: ${appState.files.length + validFiles.length} files.`);
    }
    
    e.target.value = '';
  }, [validateFiles, appState.files, showError, showSuccess, t]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileChange({ target: { files: droppedFiles } });
  }, [handleFileChange]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const removeFile = useCallback((index) => {
    dispatchApp({ type: 'REMOVE_FILE', index });
  }, []);

  const clearAllFiles = useCallback(() => {
    dispatchApp({ type: 'CLEAR_FILES' });
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (appState.submitting) {
      showWarning(t('requestAlreadyBeingSubmitted'));
      return;
    }

    if (!canActuallyCreateRequest) {
      const restriction = getRestrictionReason;
      if (restriction) {
        showError(`${restriction.icon} ${restriction.message}`);
        
        if (restriction.type === 'working_hours') {
          setShowWorkingHoursModal(true);
        }
        return;
      }
    }

    if (appState.selectedType?.is_document_required && appState.files.length === 0) {
      showError(t('thisRequestTypeRequires'));
      return;
    }

    const oversizedFiles = appState.files.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      showError(t('filesTooLarge', { files: oversizedFiles.map(f => f.name).join(', ') }));
      return;
    }

    dispatchApp({ type: 'SET_SUBMITTING', submitting: true });
    dispatchApp({ type: 'SET_LOADING', loading: true });
    dispatchApp({ type: 'SET_ERROR', error: null });
    dispatchApp({ type: 'SET_SUCCESS', success: null });

    try {
      showInfo(t('creatingYourRequest'));
      
      const response = await apiService.createRequestWithCalendarValidation(formData);
      const requestId = response.data.data.request_id;
      
      if (appState.files.length > 0) {
        showInfo(t('uploadingFiles'));
        
        const fileFormData = new FormData();
        appState.files.forEach(file => {
          fileFormData.append('files', file);
        });
        
        try {
          await apiService.uploadFiles(requestId, fileFormData);
          showSuccess(`✅ ${t('requestCreatedSuccessfully')} #${requestId} ${t('requestCreatedWithFiles')} ${appState.files.length} ${t('files')}!`);
        } catch (uploadError) {
          showError(t('filesCouldNotBeUploaded'));
        }
      } else {
        showSuccess(`✅ ${t('requestCreatedSuccessfully')} #${requestId}!`);
      }
      
      // Reset form
      dispatchForm({ type: 'RESET_FORM', initialState: initialFormState });
      dispatchApp({ type: 'CLEAR_FILES' });
      dispatchApp({ type: 'SET_SELECTED_TYPE', selectedType: null });
      
      // Update rate limit state
      const now = new Date();
      const nextAllowedTime = new Date(now.getTime() + RATE_LIMIT_HOURS * 60 * 60 * 1000);
      dispatchApp({ 
        type: 'SET_RESTRICTIONS',
        lastRequestInfo: {
          lastRequestTime: now,
          nextAllowedTime: nextAllowedTime,
          hoursRemaining: RATE_LIMIT_HOURS
        },
        canSubmitRequestNow: false
      });
      
      showInfo('⏰ Remember: You can submit your next request after 24 hours during working hours.');
      
      setTimeout(() => {
        navigate('/requests');
      }, 2000);
      
    } catch (error) {
      console.error('🚨 Request creation error:', error);
      
      // Enhanced error handling
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
            showInfo(`🕐 ${errorData.guidance.nextOpening}`);
          }
          setShowWorkingHoursModal(true);
        } else {
          showError(`📅 ${errorData.error}`);
        }
        return;
      }
      
      if (error.response?.status === 429) {
        const errorData = error.response.data;
        
        if (errorData.errorCode === 'DAILY_LIMIT_EXCEEDED') {
          showError(t('dailyLimitExceeded') + ': ' + errorData.error);
          if (errorData.details) {
            dispatchApp({
              type: 'SET_RESTRICTIONS',
              lastRequestInfo: {
                lastRequestTime: new Date(errorData.details.last_request_time),
                nextAllowedTime: new Date(errorData.details.actual_next_available_time || errorData.details.next_allowed_time),
                hoursRemaining: errorData.details.hours_remaining
              },
              canSubmitRequestNow: false
            });
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
      dispatchApp({ type: 'SET_ERROR', error: errorMessage });
    } finally {
      dispatchApp({ type: 'SET_LOADING', loading: false });
      dispatchApp({ type: 'SET_SUBMITTING', submitting: false });
    }
  }, [
    appState.submitting, 
    canActuallyCreateRequest, 
    getRestrictionReason, 
    appState.selectedType, 
    appState.files, 
    formData, 
    showWarning, 
    showError, 
    showInfo, 
    showSuccess, 
    t, 
    initialFormState, 
    navigate
  ]);

  // ===== RENDER HELPER COMPONENTS =====
  const RestrictionNotice = () => {
    if (canActuallyCreateRequest) return null;

    const restriction = getRestrictionReason;
    if (!restriction) return null;

    return (
      <div className="alert alert-danger mb-4" role="alert" aria-live="polite">
        <h6 className="alert-heading">
          <span aria-label={`Restriction type: ${restriction.type}`}>
            {restriction.icon}
          </span>
          {t('requestCreationRestricted')}
        </h6>
        <p className="mb-2">{restriction.message}</p>
        
        {restriction.type === '24_hour_limit' && restrictions.lastRequestInfo && (
          <p className="mb-0">
            <strong>{t('nextRequestAvailable')}:</strong> 
            <time dateTime={restrictions.lastRequestInfo.nextAllowedTime.toISOString()}>
              {restrictions.lastRequestInfo.nextAllowedTime.toLocaleString('tr-TR')}
            </time>
          </p>
        )}
        
        {restriction.type === 'academic_calendar' && restrictions.academicCalendarStatus?.details && (
          <div>
            {restrictions.academicCalendarStatus.details.holidayNames && (
              <p className="mb-0">
                <strong>{t('currentHoliday')}:</strong> {restrictions.academicCalendarStatus.details.holidayNames}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const FileUploadSection = () => {
    if (!appState.selectedType) return null;

    return (
      <div className="mb-3">
        <label className="form-label">
          <strong>{t('attachment')}</strong>
          {appState.selectedType.is_document_required && (
            <span className="text-danger" aria-label="Required field"> ({t('required')})</span>
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
            disabled={appState.loading || appState.submitting || !canActuallyCreateRequest}
            aria-describedby="file-upload-help"
          />
          
          <div className="row">
            <div className="col-md-4">
              <label 
                htmlFor="file-upload-input" 
                className="btn btn-primary d-flex flex-column align-items-center p-4 h-100"
                style={{ 
                  cursor: (appState.loading || appState.submitting || !canActuallyCreateRequest) ? 'not-allowed' : 'pointer',
                  opacity: (appState.loading || appState.submitting || !canActuallyCreateRequest) ? 0.6 : 1,
                  borderRadius: '12px',
                  border: 'none',
                  minHeight: '150px',
                  justifyContent: 'center'
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    document.getElementById('file-upload-input').click();
                  }
                }}
                aria-describedby="file-upload-help"
              >
                <div style={{ fontSize: '3rem', marginBottom: '10px' }} aria-hidden="true">
                  📁
                </div>
                <div className="fw-bold mb-2">
                  {appState.files.length > 0 ? 'Add More Files' : t('chooseFiles')}
                </div>
                <small className="text-white-50">
                  {t('maxFilesLimit')}
                </small>
              </label>
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
                role="region"
                aria-label="File drop zone"
              >
                <div className="text-muted text-center">
                  <div style={{ fontSize: '2.5rem', marginBottom: '15px' }} aria-hidden="true">📎</div>
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
                <div className="form-text" id="file-upload-help">
                  <strong>{t('allowed')}:</strong> {t('allowedFileTypes')}
                </div>
                <div className="text-end">
                  <span 
                    className={`badge ${appState.files.length >= MAX_FILES ? 'bg-warning' : 'bg-info'}`}
                    aria-label={`${appState.files.length} of ${MAX_FILES} files selected`}
                  >
                    {appState.files.length} / {MAX_FILES} {t('files')}
                  </span>
                </div>
              </div>
              
              {appState.selectedType.is_document_required && (
                <div className="alert alert-warning mt-2 py-2" role="alert">
                  <small>
                    <strong>📎 {t('required')}:</strong> {t('documentUploadRequired')}
                  </small>
                </div>
              )}
            </div>
          </div>

          {appState.files.length > 0 && (
            <div className="mt-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">
                  {t('selectedFiles')} ({appState.files.length})
                </h6>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={clearAllFiles}
                  disabled={appState.loading || appState.submitting || !canActuallyCreateRequest}
                  aria-label="Clear all selected files"
                >
                  🗑️ {t('clearAll')}
                </button>
              </div>
              
              <div className="row">
                {appState.files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="col-lg-6 mb-2">
                    <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #0d6efd' }}>
                      <div className="card-body p-3">
                        <div className="d-flex align-items-center">
                          <div className="me-3">
                            <div 
                              className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                              style={{ width: '45px', height: '45px', fontSize: '1.2rem' }}
                              aria-hidden="true"
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
                                  disabled={appState.loading || appState.submitting || !canActuallyCreateRequest}
                                  title={`Remove ${file.name}`}
                                  aria-label={`Remove file ${file.name}`}
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
                              role="progressbar"
                              aria-valuenow="100"
                              aria-valuemin="0" 
                              aria-valuemax="100"
                              aria-label="File ready for upload"
                            ></div>
                          </div>
                          <small className="text-success">
                            ✅ {t('readyToUpload')}
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
    );
  };

  const SubmitButton = () => {
    const restriction = getRestrictionReason;
    
    const getButtonText = () => {
      if (appState.submitting) {
        return (
          <>
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            {appState.files.length > 0 ? t('creatingAndUploading') : t('loading') + '...'}
          </>
        );
      }
      
      if (!canActuallyCreateRequest) {
        if (restriction?.type === '24_hour_limit') {
          return <>⏰ {t('waitHours', { hours: restrictions.lastRequestInfo?.hoursRemaining || 0 })}</>;
        } else if (restriction?.type === 'working_hours') {
          return <>🕐 {t('outsideWorkingHours')}</>;
        } else if (restriction?.type === 'academic_calendar') {
          return <>📅 {t('academicHoliday')}</>;
        } else {
          return <>🚫 {t('requestRestricted')}</>;
        }
      }
      
      return (
        <>
          📝 {t('submitRequest')}
          {appState.files.length > 0 && ` (${appState.files.length} ${appState.files.length > 1 ? t('files') : t('file')})`}
        </>
      );
    };

    return (
      <div className="d-grid gap-2">
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={
            appState.loading || 
            appState.submitting ||
            !canActuallyCreateRequest ||
            !isFormValid
          }
          aria-describedby="submit-button-help"
        >
          {getButtonText()}
        </button>
        
        {!canActuallyCreateRequest && (() => {
          if (restriction?.type === '24_hour_limit' && restrictions.lastRequestInfo) {
            return (
              <small className="text-muted text-center" id="submit-button-help">
                {t('nextRequestAvailable')}: 
                <time dateTime={restrictions.lastRequestInfo.nextAllowedTime.toISOString()}>
                  {restrictions.lastRequestInfo.nextAllowedTime.toLocaleString('tr-TR')}
                </time>
              </small>
            );
          } else if (restriction?.type === 'academic_calendar' && restrictions.academicCalendarStatus?.details?.nextAvailable) {
            return (
              <small className="text-muted text-center" id="submit-button-help">
                {t('nextAvailable')}: {restrictions.academicCalendarStatus.details.nextAvailable}
              </small>
            );
          }
          return null;
        })()}
      </div>
    );
  };

  // ===== MAIN RENDER =====
  return (
    <div className="row justify-content-center">
      <div className="col-md-8">
        <header>
          <h2 className="mb-4">{t('createRequest')}</h2>
        </header>

        {appState.error && (
          <div className="alert alert-danger" role="alert" aria-live="polite">
            {appState.error}
          </div>
        )}

        {appState.success && (
          <div className="alert alert-success" role="alert" aria-live="polite">
            {appState.success} {t('redirectingToRequests')}
          </div>
        )}

        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit} noValidate>
              <RestrictionNotice />

              {/* Important Guidelines */}
              <div className="alert alert-danger" role="region" aria-labelledby="guidelines-heading">
                <h6 id="guidelines-heading">{t('guidelines')}:</h6>
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
                  <span className="text-danger" aria-label="Required field"> *</span>
                </label>
                <select
                  id="requestType"
                  className="form-select"
                  value={formData.type_id}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  required
                  disabled={!canActuallyCreateRequest}
                  aria-describedby="requestType-help"
                >
                  <option value="">{t('pleaseSelect')}</option>
                  {Object.keys(appState.requestTypes).map((category) => (
                    <optgroup key={category} label={t(category.toLowerCase().replace(/\s+/g, ''))}>
                      {appState.requestTypes[category].map((type) => (
                        <option key={type.type_id} value={type.type_id}>
                          {translateRequestType(type.type_name)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div id="requestType-help" className="form-text">
                  {t('selectRequestTypeHelp')}
                </div>
              </div>

              {/* Type Detail */}
              {appState.selectedType && (
                <div className="mb-3">
                  <label className="form-label">
                    <strong>{t('typeDetail')}</strong>
                  </label>
                  <div className="alert alert-info" role="region" aria-live="polite">
                    {appState.selectedType.description_en || t('noDescriptionAvailable')}
                    {appState.selectedType.is_document_required && (
                      <div className="mt-2">
                        <strong className="text-danger">
                          📎 {t('documentUploadRequired')}
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
                  <span className="text-danger" aria-label="Required field"> *</span>
                </label>
                <select
                  id="priority"
                  className="form-select"
                  value={formData.priority}
                  onChange={handlePriorityChange}
                  required
                  disabled={!canActuallyCreateRequest}
                  aria-describedby="priority-help"
                >
                  {PRIORITY_LEVELS.map(({ value, label, description }) => (
                    <option key={value} value={value}>
                      🔺 {t(label)} - {t(description)}
                    </option>
                  ))}
                </select>
                <div id="priority-help" className="form-text">
                  {t('selectPriorityLevel')}
                </div>
              </div>

              {/* Content */}
              <div className="mb-3">
                <label htmlFor="content" className="form-label">
                  <strong>{t('content')}</strong>
                  <span className="text-danger" aria-label="Required field"> *</span>
                  <br />
                  <small>
                    {t('remainingCharacters')}: 
                    <span 
                      className={remainingChars < 50 ? 'text-warning' : 'text-muted'}
                      aria-live="polite"
                    >
                      {remainingChars}
                    </span>
                  </small>
                </label>
                <textarea
                  id="content"
                  className="form-control"
                  rows="4"
                  value={formData.content}
                  onChange={handleContentChange}
                  placeholder={t('pleaseDescribe')}
                  required
                  disabled={!canActuallyCreateRequest}
                  aria-describedby="content-help"
                  maxLength={MAX_CONTENT_LENGTH}
                />
                <div id="content-help" className="form-text">
                  {t('contentHelp')}
                </div>
              </div>

              <FileUploadSection />

              {/* Guidelines */}
              <div className="mt-4">
                <h5>{t('guidelines')}</h5>
                <div className="card">
                  <div className="alert alert-danger" role="region" aria-labelledby="submission-guidelines">
                    <h6 id="submission-guidelines">{t('beforeSubmitting')}:</h6>
                    <ul>
                      <li>{t('checkIfResolvable')}</li>
                      <li>{t('ensureCorrectType')}</li>
                      <li>{t('provideDetail')}</li>
                      <li>{t('prepareFiles')}</li>
                      <li>{t('useHighPriority')}</li>
                      <li>{t('ensureWorkingHoursAndHolidays')}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <SubmitButton />
            </form>
          </div>
        </div>

        {/* Working Hours Modal */}
        {showWorkingHoursModal && (
          <WorkingHoursModal 
            show={showWorkingHoursModal}
            onClose={() => setShowWorkingHoursModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default CreateRequestPage;