// frontend/src/components/AcademicCalendarManager.js - TRANSLATED VERSION
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../hooks/useTranslation';
import { apiService } from '../services/api';

const AcademicCalendarManager = () => {
  const { admin, isSuperAdmin } = useAdminAuth();
  const { showSuccess, showError, showInfo, showWarning } = useToast();
  const { t } = useTranslation();
  const [eventsCurrentPage, setEventsCurrentPage] = useState(1);
  const [eventsPerPage] = useState(10);

  const [calendarStatus, setCalendarStatus] = useState(null);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [academicYear, setAcademicYear] = useState('');
  const [settings, setSettings] = useState({
    academic_calendar_enabled: true,
    holiday_buffer_hours: 24,
    current_academic_year: ''
  });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [currentEvents, setCurrentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    show: false,
    uploadId: null,
    fileName: ''
  });

  // Initialize component
  useEffect(() => {
    if (isSuperAdmin()) {
      fetchCalendarStatus();
      fetchUploadHistory();
    }
  }, []);

  // Generate academic year options
  const generateAcademicYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const options = [];
    
    for (let i = -2; i <= 3; i++) {
      const startYear = currentYear + i;
      const endYear = startYear + 1;
      options.push(`${startYear}-${endYear}`);
    }
    
    return options;
  };

  // Fetch calendar status
const fetchCalendarStatus = async () => {
  try {
    setLoading(true);
    const response = await apiService.getAcademicCalendarStatus();
    
    if (response.data.success) {
      const data = response.data.data;
      
      // 🔍 DEBUG: Upcoming events'i konsola yazdır
      console.log('📅 All upcoming events from API:', data.upcoming_events);
      
      // ✅ FILTER: Sadece affects_request_creation = true olanları göster
      const restrictedEvents = data.upcoming_events?.filter(event => 
        event.affects_request_creation === true || 
        event.affects_request_creation === 1 ||
        event.affects_request_creation === '1' ||
        event.affects_request_creation === 'true'
      ) || [];
      
      console.log('🚫 Filtered restricted events:', restrictedEvents);
      
      // ✅ Sadece ilk 3 tanesini al
      const limitedRestrictedEvents = restrictedEvents.slice(0, 3);
      
      console.log('🎯 Final limited restricted events:', limitedRestrictedEvents);
      
      setCalendarStatus({
        ...data,
        upcoming_events: limitedRestrictedEvents // ✅ Filtered events'i kaydet
      });
      
      setSettings({
        academic_calendar_enabled: data.settings.academic_calendar_enabled === 'true',
        holiday_buffer_hours: parseInt(data.settings.holiday_buffer_hours || '24'),
        current_academic_year: data.settings.current_academic_year || ''
      });
      
      if (!academicYear && data.settings.current_academic_year) {
        setAcademicYear(data.settings.current_academic_year);
      }
    }
  } catch (error) {
    console.error('Failed to fetch calendar status:', error);
    showError(t('loadHistoryFailed'));
  } finally {
    setLoading(false);
  }
};

  // Fetch upload history
  const fetchUploadHistory = async () => {
    try {
      console.log('Fetching upload history...');
      
      const response = await apiService.getAcademicCalendarUploads({
        limit: 20,
        offset: 0
      });
      
      console.log('Upload history response:', response);
      
      if (response.data && response.data.success) {
        setUploadHistory(response.data.data.uploads || []);
        console.log('Upload history loaded:', response.data.data.uploads?.length || 0, 'items');
      } else {
        console.error('Upload history response not successful:', response.data);
        setUploadHistory([]);
        showError(t('loadHistoryFailed'));
      }
    } catch (error) {
      console.error('Failed to fetch upload history:', error);
      setUploadHistory([]);
      
      let errorMessage = t('loadHistoryFailed');
      
      if (error.response?.status === 500) {
        errorMessage = t('serverError');
      } else if (error.response?.status === 403) {
        errorMessage = t('accessDeniedError');
      } else if (error.response?.status === 401) {
        errorMessage = t('authRequired');
      } else if (error.code === 'NETWORK_ERROR') {
        errorMessage = t('networkErrorHistory');
      }
      
      showError(errorMessage);
      
      if (process.env.NODE_ENV === 'development') {
        console.error('Detailed error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
      }
    }
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    
    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      showError(t('invalidFileType'));
      event.target.value = '';
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showError(t('fileSizeLimit'));
      event.target.value = '';
      return;
    }

    setSelectedFile(file);
    showInfo(t('selectedFileInfo', '', { 
      fileName: file.name, 
      fileSize: formatFileSize(file.size) 
    }));
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle calendar upload
  const handleUpload = async () => {
    if (!selectedFile) {
      showError(t('selectFileToUpload'));
      return;
    }

    if (!academicYear) {
      showError(t('selectAcademicYearMsg'));
      return;
    }

    try {
      setUploadInProgress(true);
      showInfo(t('startingUpload'));

      const formData = new FormData();
      formData.append('calendar_document', selectedFile);
      formData.append('academic_year', academicYear);

      console.log('Uploading calendar:', {
        fileName: selectedFile.name,
        academicYear: academicYear,
        fileSize: selectedFile.size
      });

      const response = await apiService.uploadAcademicCalendar(formData);
      
      console.log('Upload response:', response);

      if (response && response.data && response.data.success) {
        const data = response.data.data;
        showSuccess(t('uploadSuccess', '', { 
          eventsCount: data.events_processed 
        }));
        
        setSelectedFile(null);
        setShowUploadModal(false);
        
        // Reset file input
        const fileInput = document.getElementById('calendar-file-input');
        if (fileInput) fileInput.value = '';
        
        // Refresh data
        await fetchCalendarStatus();
        await fetchUploadHistory();

        // Show events summary
        if (data.events_summary && data.events_summary.length > 0) {
          showInfo(t('sampleEvents', '', { 
            events: data.events_summary.slice(0, 3).map(e => e.name).join(', ') 
          }));
        }
      } else {
        const errorMsg = response?.data?.error || 'Unknown error occurred';
        const details = response?.data?.details || '';
        const stage = response?.data?.stage || 'unknown';
        
        console.error('Upload failed:', { errorMsg, details, stage });
        showError(t('uploadFailed', '', { error: errorMsg }));
        
        if (details) {
          showWarning(t('details', '', { details }));
        }
      }
    } catch (error) {
      console.error('Calendar upload error:', error);
      
      let errorMessage = t('uploadError');
      let details = '';
      
      if (error.response) {
        const responseData = error.response.data;
        errorMessage = responseData?.error || t('serverError');
        details = responseData?.details || '';
        
        console.error('Server error response:', responseData);
      } else if (error.request) {
        errorMessage = t('networkError');
        details = t('checkConnection');
      } else {
        errorMessage = t('uploadError');
        details = error.message;
      }
      
      showError(errorMessage);
      if (details) {
        showWarning(t('details', '', { details }));
      }
    } finally {
      setUploadInProgress(false);
    }
  };

  // Update calendar settings
  const updateSettings = async () => {
    try {
      showInfo(t('updatingSettings'));
      
      const response = await apiService.updateAcademicCalendarSettings(settings);
      
      if (response.data.success) {
        showSuccess(t('settingsUpdated'));
        await fetchCalendarStatus();
      }
    } catch (error) {
      console.error('Settings update error:', error);
      showError(t('settingsUpdateFailed'));
    }
  };

  // View calendar events
  const viewCalendarEvents = async (academicYearFilter = null) => {
    try {
      const params = {};
      if (academicYearFilter) {
        params.academic_year = academicYearFilter;
      }
      
      const response = await apiService.getAcademicCalendarEvents(params);
      
      if (response.data.success) {
        setCurrentEvents(response.data.data.events);
        setShowEventsModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
      showError(t('loadingEvents'));
    }
  };

  // Delete calendar upload - Custom modal instead of browser confirm
  const deleteUpload = async (uploadId, fileName) => {
    setDeleteConfirmation({
      show: true,
      uploadId,
      fileName
    });
  };

  const confirmDelete = async () => {
    try {
      showInfo(t('deletingUpload'));
      
      const response = await apiService.deleteAcademicCalendarUpload(deleteConfirmation.uploadId);
      
      if (response.data.success) {
        showSuccess(t('deleteSuccess'));
        await fetchCalendarStatus();
        await fetchUploadHistory();
      }
    } catch (error) {
      console.error('Delete upload error:', error);
      showError(t('deleteFailed'));
    } finally {
      setDeleteConfirmation({ show: false, uploadId: null, fileName: '' });
    }
  };

  // Get status badge style
  const getStatusBadge = (status) => {
    const badges = {
      'pending': 'bg-danger text-dark',
      'processing': 'bg-danger text-white',
      'completed': 'bg-danger text-white',
      'failed': 'bg-danger text-white'
    };
    return badges[status] || 'bg-secondary text-white';
  };

  // Get event type translation
  const getEventTypeText = (eventType) => {
    const typeMap = {
      'holiday': 'holidayEventType',
      'break': 'breakEventType',
      'exam_period': 'examPeriodEventType',
      'registration': 'registrationEventType',
      'semester_start': 'semesterStartEventType',
      'semester_end': 'semesterEndEventType',
      'orientation': 'orientationEventType',
      'no_classes': 'noClassesEventType'
    };
    return t(typeMap[eventType] || eventType);
  };

  // Check if user is super admin
  if (!isSuperAdmin()) {
    return (
      <div className="alert alert-warning">
        <h5>{t('accessDenied')}</h5>
        <p>{t('superAdminOnly')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-3">{t('loadingCalendar')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="academic-calendar-manager">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3>{t('academicCalendarTitle')}</h3>
            <p className="text-muted">{t('academicCalendarSubtitle')}</p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => setShowUploadModal(true)}
            disabled={uploadInProgress}
          >
            {t('uploadNewCalendar')}
          </button>
        </div>

        {/* Calendar Status Card */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">{t('currentCalendarStatus')}</h5>
              </div>
              <div className="card-body">
                {calendarStatus ? (
                  <div className="row">
                    <div className="col-md-6">
                      <h6>{t('systemInfo')}</h6>
                      <ul className="list-unstyled">
                        <li>
                          <strong>{t('calendarEnabled')}:</strong> 
                          <span className={`ms-2 ${calendarStatus.system_info.calendar_enabled ? 'text-primary' : 'text-danger'}`}>
                            {calendarStatus.system_info.calendar_enabled ? t('yes') : t('no')}
                          </span>
                        </li>
                        <li><strong>{t('currentAcademicYear')}:</strong> {calendarStatus.system_info.academic_year || t('notSet')}</li>
                        <li><strong>{t('holidayBufferHours')}:</strong> {calendarStatus.system_info.buffer_hours}</li>
                        <li><strong>{t('currentDate')}:</strong> {calendarStatus.system_info.current_date}</li>
                      </ul>
                    </div>
                    <div className="col-md-6">
                      <h6>{t('todaysStatus')}</h6>
                      {calendarStatus.today_status ? (
                        <div>
                          <p className={`mb-2 ${calendarStatus.today_status.is_holiday ? 'text-danger' : 'text-primary'}`}>
                            <strong>
                              {calendarStatus.today_status.is_holiday ? 
                                t('holidayPeriod') : 
                                t('regularWorkingDay')}
                            </strong>
                          </p>
                          {calendarStatus.today_status.is_holiday && (
                            <p className="text-muted">{calendarStatus.today_status.message}</p>
                          )}
                          {calendarStatus.next_available && !calendarStatus.next_available.success && (
                            <p className="text-info">
                              {t('nextAvailable')}: {calendarStatus.next_available.next_date}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted">{t('unableToCheckStatus')}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning">
                    <p className="mb-0">{t('unableToLoadStatus')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Settings Card */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">{t('calendarSettings')}</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-4">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="calendar-enabled"
                        checked={settings.academic_calendar_enabled}
                        onChange={(e) => setSettings({
                          ...settings,
                          academic_calendar_enabled: e.target.checked
                        })}
                      />
                      <label className="form-check-label" htmlFor="calendar-enabled">
                        {t('enableCalendarRestrictions')}
                      </label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">{t('holidayBufferHoursLabel')}</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      max="168"
                      value={settings.holiday_buffer_hours}
                      onChange={(e) => setSettings({
                        ...settings,
                        holiday_buffer_hours: parseInt(e.target.value) || 0
                      })}
                    />
                    <small className="form-text text-muted">
                      {t('holidayBufferHelp')}
                    </small>
                  </div>
                 
                </div>
                <div className="mt-3">
                  <button 
                    className="btn btn-danger"
                    onClick={updateSettings}
                  >
                    {t('saveSettings')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Events */}
{/* ✅ UPDATED: Sadece request'i engelleyen events göster */}
{calendarStatus?.upcoming_events && calendarStatus.upcoming_events.length > 0 ? (
  <div className="row mb-4">
    <div className="col-12">
      <div className="card">
        <div className="card-header">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">{t('upcomingRestrictedEvents')}</h5>
            <span className="badge bg-danger">
              {calendarStatus.upcoming_events.length}
            </span>
          </div>
        </div>
        <div className="card-body">
          {calendarStatus.upcoming_events.map((event, index) => (
            <div key={index} className="d-flex align-items-start mb-3 pb-3 border-bottom">
              <div className="flex-grow-1">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <strong className="text-danger">{event.event_name}</strong>
                    {event.buffer_hours_applied > 0 && (
                      <small className="d-block text-muted">
                        <i className="fas fa-clock me-1"></i>
                        {t('restrictionStartsEarly', '', { 
                          hours: event.buffer_hours_applied,
                          actualDate: event.start_date 
                        })}
                      </small>
                    )}
                  </div>
                  <span className="badge bg-danger">
                    {event.days_until === 0 ? t('today') : 
                     event.days_until === 1 ? t('tomorrow') : 
                     `${event.days_until} ${t('daysLeft')}`}
                  </span>
                </div>
                
                <div className="row">
                  <div className="col-md-8">
                    <small className="text-muted">
                      <strong>{t('eventPeriod')}:</strong> {event.start_date}
                      {event.end_date !== event.start_date && ` - ${event.end_date}`}
                    </small>
                  </div>
                  <div className="col-md-4">
                    <small className="text-muted">
                      <strong>{t('type')}:</strong> {getEventTypeText(event.event_type)}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          
        </div>
      </div>
    </div>
  </div>
) :null}

        {/* Upload History */}
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">{t('uploadHistory')}</h5>
                <button 
                  className="btn btn-outline-secondary btn-sm"
                  onClick={fetchUploadHistory}
                >
                  {t('refresh')}
                </button>
              </div>
              <div className="card-body">
                {uploadHistory.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted">{t('noUploadsFound')}</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>{t('fileName')}</th>
                          <th>{t('academicYear')}</th>
                          <th>{t('status')}</th>
                          <th>{t('events')}</th>
                          <th>{t('uploadedBy')}</th>
                          <th>{t('uploadDate')}</th>
                          <th>{t('actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadHistory.map((upload) => (
                          <tr key={upload.upload_id}>
                            <td>
                              <strong>{upload.file_name}</strong>
                              <br />
                              <small className="text-muted">
                                {formatFileSize(upload.file_size)} | {upload.file_type}
                              </small>
                            </td>
                            <td>{upload.academic_year}</td>
                            <td>
                              <span className={`badge ${getStatusBadge(upload.processing_status)}`}>
                                {t(upload.processing_status)}
                              </span>
                              {upload.is_active && (
                                <span className="badge bg-primary ms-1">{t('active')}</span>
                              )}
                            </td>
                            <td>{upload.events_count || 0}</td>
                            <td>
                              {upload.uploaded_by_name || upload.uploaded_by_username}
                            </td>
                            <td>
                              {new Date(upload.uploaded_at).toLocaleDateString()}
                            </td>
                            <td>
                              <div className="btn-group btn-group-sm">
                                <button 
                                  className="btn btn-outline-primary"
                                  onClick={() => viewCalendarEvents(upload.academic_year)}
                                  disabled={upload.processing_status !== 'completed'}
                                >
                                  {t('viewEvents')}
                                </button>
                                <button 
                                  className="btn btn-outline-danger"
                                  onClick={() => deleteUpload(upload.upload_id, upload.file_name)}
                                >
                                  {t('delete')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}>
          <div className="modal fade show d-block" style={{ zIndex: 1050 }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{t('uploadAcademicCalendar')}</h5>
                  <button 
                    type="button" 
                    className="btn-close"
                    onClick={() => setShowUploadModal(false)}
                    disabled={uploadInProgress}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-info">
                    <h6>{t('uploadInstructions')}</h6>
                    <ul className="mb-0">
                      <li>{t('fileTypeInstruction')}</li>
                      <li>{t('languageInstruction')}</li>
                      <li>{t('blockingInstruction')}</li>
                      <li>{t('fileSizeInstruction')}</li>
                    </ul>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">{t('academicYear')}</label>
                    <select
                      className="form-select"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      disabled={uploadInProgress}
                    >
                      <option value="">{t('selectAcademicYear')}</option>
                      {generateAcademicYearOptions().map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">{t('calendarDocument')}</label>
                    <input
                      type="file"
                      className="form-control"
                      id="calendar-file-input"
                      accept=".doc,.docx,.txt"
                      onChange={handleFileSelect}
                      disabled={uploadInProgress}
                    />
                  </div>

                  {selectedFile && (
                    <div className="alert alert-success">
                      <h6>{t('selectedFile')}</h6>
                      <p className="mb-0">
                        <strong>{selectedFile.name}</strong><br />
                        {t('size')}: {formatFileSize(selectedFile.size)}<br />
                        {t('type')}: {selectedFile.type}
                      </p>
                    </div>
                  )}

                  {uploadInProgress && (
                    <div className="alert alert-info">
                      <div className="d-flex align-items-center">
                        <div className="spinner-border spinner-border-sm me-2"></div>
                        <span>{t('processingDocument')}</span>
                      </div>
                      <div className="progress mt-2">
                        <div className="progress-bar progress-bar-striped progress-bar-animated" style={{width: '100%'}}></div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowUploadModal(false)}
                    disabled={uploadInProgress}
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary"
                    onClick={handleUpload}
                    disabled={
                      !selectedFile || 
                      !academicYear || 
                      uploadInProgress ||
                      !selectedFile?.name ||
                      academicYear === ''
                    }
                  >
                    {uploadInProgress ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        {t('processing')}
                      </>
                    ) : (
                      t('uploadProcess')
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Events Modal */}
      {showEventsModal && (
        <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}>
          <div className="modal fade show d-block" style={{ zIndex: 1050 }}>
            <div className="modal-dialog modal-xl">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{t('calendarEvents')}</h5>
                  <button 
                    type="button" 
                    className="btn-close"
                    onClick={() => {
                      setShowEventsModal(false);
                      setEventsCurrentPage(1);
                    }}
                  ></button>
                </div>
                <div className="modal-body">
                  {currentEvents.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted">{t('noEventsFound')}</p>
                    </div>
                  ) : (
                    <>
                      {/* Events Info */}
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <span className="text-muted">
                          {t('showingEvents', '', {
                            start: Math.min((eventsCurrentPage - 1) * eventsPerPage + 1, currentEvents.length),
                            end: Math.min(eventsCurrentPage * eventsPerPage, currentEvents.length),
                            total: currentEvents.length
                          })}
                        </span>
                      </div>

                      <div className="table-responsive">
                        <table className="table table-hover">
                          <thead>
                            <tr>
                              <th>{t('event')}</th>
                              <th>{t('eventType')}</th>
                              <th>{t('startDate')}</th>
                              <th>{t('endDate')}</th>
                              <th>{t('duration')}</th>
                              <th>{t('affectsRequests')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentEvents
                              .slice((eventsCurrentPage - 1) * eventsPerPage, eventsCurrentPage * eventsPerPage)
                              .map((event, index) => (
                              <tr key={index}>
                                <td>
                                  <div>
                                    <strong>{event.event_name}</strong>
                                    {event.description && (
                                      <>
                                        <br />
                                        <small className="text-muted">{event.description}</small>
                                      </>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <span className="badge bg-secondary">
                                    {getEventTypeText(event.event_type)}
                                  </span>
                                </td>
                                <td>{event.start_date}</td>
                                <td>{event.end_date}</td>
                                <td>
                                  {Math.ceil((new Date(event.end_date) - new Date(event.start_date)) / (1000 * 60 * 60 * 24)) + 1} {t('days')}
                                </td>
                                <td>
                                  <span className={`badge ${event.affects_request_creation ? 'bg-danger' : 'bg-info'}`}>
                                    {event.affects_request_creation ? t('yes') : t('no')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {Math.ceil(currentEvents.length / eventsPerPage) > 1 && (
                        <nav aria-label="Events pagination" className="mt-3">
                          <ul className="pagination justify-content-center">
                            <li className={`page-item ${eventsCurrentPage === 1 ? 'disabled' : ''}`}>
                              <button 
                                className="page-link" 
                                onClick={() => setEventsCurrentPage(eventsCurrentPage - 1)}
                                disabled={eventsCurrentPage === 1}
                              >
                                {t('previous')}
                              </button>
                            </li>
                            
                            {[...Array(Math.ceil(currentEvents.length / eventsPerPage))].map((_, index) => (
                              <li key={index + 1} className={`page-item ${eventsCurrentPage === index + 1 ? 'active' : ''}`}>
                                <button 
                                  className="page-link" 
                                  onClick={() => setEventsCurrentPage(index + 1)}
                                >
                                  {index + 1}
                                </button>
                              </li>
                            ))}
                            
                            <li className={`page-item ${eventsCurrentPage === Math.ceil(currentEvents.length / eventsPerPage) ? 'disabled' : ''}`}>
                              <button 
                                className="page-link" 
                                onClick={() => setEventsCurrentPage(eventsCurrentPage + 1)}
                                disabled={eventsCurrentPage === Math.ceil(currentEvents.length / eventsPerPage)}
                              >
                                {t('next')}
                              </button>
                            </li>
                          </ul>
                        </nav>
                      )}
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowEventsModal(false);
                      setEventsCurrentPage(1);
                    }}
                  >
                    {t('close')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.show && (
        <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}>
          <div className="modal fade show d-block" style={{ zIndex: 1050 }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title text-danger">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    {t('confirmDeleteTitle')}
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close"
                    onClick={() => setDeleteConfirmation({ show: false, uploadId: null, fileName: '' })}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-danger">
                    <h6 className="alert-heading">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      {t('warning')}
                    </h6>
                    <p className="mb-0">
                      <strong>"{deleteConfirmation.fileName}"</strong> {t('deleteWarningMessage')}
                    </p>
                  </div>
                  <p className="mb-0">{t('deleteConfirmationText')}</p>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setDeleteConfirmation({ show: false, uploadId: null, fileName: '' })}
                  >
                    <i className="fas fa-times me-2"></i>
                    {t('cancel')}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-danger"
                    onClick={confirmDelete}
                  >
                    <i className="fas fa-trash me-2"></i>
                    {t('delete')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AcademicCalendarManager;