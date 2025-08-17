// frontend/src/components/AcademicCalendarManager.js - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../hooks/useTranslation';
import { apiService } from '../services/api';

const AcademicCalendarManager = () => {
  const { admin, isSuperAdmin } = useAdminAuth();
  const { showSuccess, showError, showInfo, showWarning } = useToast();
  const { t } = useTranslation();

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
        setCalendarStatus(data);
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
      showError('Failed to load calendar status');
    } finally {
      setLoading(false);
    }
  };

  // Fetch upload history
  const fetchUploadHistory = async () => {
  try {
    console.log('📂 Fetching upload history...');
    
    // ✅ FIXED: Simplified API call
    const response = await apiService.getAcademicCalendarUploads({
      limit: 20,
      offset: 0
    });
    
    console.log('📂 Upload history response:', response);
    
    if (response.data && response.data.success) {
      setUploadHistory(response.data.data.uploads || []);
      console.log('✅ Upload history loaded:', response.data.data.uploads?.length || 0, 'items');
    } else {
      console.error('❌ Upload history response not successful:', response.data);
      setUploadHistory([]);
      showError('Failed to load upload history: Invalid response format');
    }
  } catch (error) {
    console.error('❌ Failed to fetch upload history:', error);
    setUploadHistory([]);
    
    // Better error messaging
    let errorMessage = 'Failed to load upload history';
    
    if (error.response?.status === 500) {
      errorMessage = 'Server error while loading upload history';
    } else if (error.response?.status === 403) {
      errorMessage = 'Access denied: Super admin required';
    } else if (error.response?.status === 401) {
      errorMessage = 'Authentication required';
    } else if (error.code === 'NETWORK_ERROR') {
      errorMessage = 'Network error: Cannot reach server';
    }
    
    showError(errorMessage);
    
    // Show detailed error in development
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
      showError('Please select a Word document (.doc, .docx) or text file (.txt)');
      event.target.value = '';
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showError('File size must be less than 10MB');
      event.target.value = '';
      return;
    }

    setSelectedFile(file);
    showInfo(`Selected file: ${file.name} (${formatFileSize(file.size)})`);
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
    showError('Please select a file to upload');
    return;
  }

  if (!academicYear) {
    showError('Please select an academic year');
    return;
  }

  try {
    setUploadInProgress(true);
    showInfo('Starting calendar upload and processing...');

    const formData = new FormData();
    formData.append('calendar_document', selectedFile);
    formData.append('academic_year', academicYear);

    console.log('📤 Uploading calendar:', {
      fileName: selectedFile.name,
      academicYear: academicYear,
      fileSize: selectedFile.size
    });

    const response = await apiService.uploadAcademicCalendar(formData);
    
    console.log('📤 Upload response:', response);

    // ✅ FIX: Enhanced response handling
    if (response && response.data && response.data.success) {
      const data = response.data.data;
      showSuccess(`✅ Calendar uploaded successfully! Processed ${data.events_processed} events.`);
      
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
        showInfo(`Sample events: ${data.events_summary.slice(0, 3).map(e => e.name).join(', ')}`);
      }
    } else {
      // Handle response structure issues
      const errorMsg = response?.data?.error || 'Unknown error occurred';
      const details = response?.data?.details || '';
      const stage = response?.data?.stage || 'unknown';
      
      console.error('❌ Upload failed:', { errorMsg, details, stage });
      showError(`Upload failed: ${errorMsg}`);
      
      if (details) {
        showWarning(`Details: ${details}`);
      }
    }
  } catch (error) {
    console.error('❌ Calendar upload error:', error);
    
    // ✅ FIX: Enhanced error handling
    let errorMessage = 'Failed to upload calendar';
    let details = '';
    
    if (error.response) {
      // Server responded with error
      const responseData = error.response.data;
      errorMessage = responseData?.error || 'Server error';
      details = responseData?.details || '';
      
      console.error('Server error response:', responseData);
    } else if (error.request) {
      // Network error
      errorMessage = 'Network error - cannot reach server';
      details = 'Please check your internet connection';
    } else {
      // Other error
      errorMessage = 'Upload error';
      details = error.message;
    }
    
    showError(errorMessage);
    if (details) {
      showWarning(`Details: ${details}`);
    }
  } finally {
    setUploadInProgress(false);
  }
};

  // Update calendar settings
  const updateSettings = async () => {
    try {
      showInfo('Updating calendar settings...');
      
      const response = await apiService.updateAcademicCalendarSettings(settings);
      
      if (response.data.success) {
        showSuccess('Calendar settings updated successfully');
        await fetchCalendarStatus();
      }
    } catch (error) {
      console.error('Settings update error:', error);
      showError('Failed to update settings');
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
      showError('Failed to load calendar events');
    }
  };

  // Delete calendar upload
  const deleteUpload = async (uploadId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      showInfo('Deleting calendar upload...');
      
      const response = await apiService.deleteAcademicCalendarUpload(uploadId);
      
      if (response.data.success) {
        showSuccess('Calendar upload deleted successfully');
        await fetchCalendarStatus();
        await fetchUploadHistory();
      }
    } catch (error) {
      console.error('Delete upload error:', error);
      showError('Failed to delete calendar upload');
    }
  };

  // Get status badge style
  const getStatusBadge = (status) => {
    const badges = {
      'pending': 'bg-warning text-dark',
      'processing': 'bg-info text-white',
      'completed': 'bg-success text-white',
      'failed': 'bg-danger text-white'
    };
    return badges[status] || 'bg-secondary text-white';
  };

  // Get event type icon
  const getEventTypeIcon = (eventType) => {
    const icons = {
      'holiday': '',
      'break': '',
      'exam_period': '',
      'registration': '',
      'semester_start': '',
      'semester_end': '',
      'orientation': '',
      'no_classes': ''
    };
    return icons[eventType] || '';
  };

  // Check if user is super admin
  if (!isSuperAdmin()) {
    return (
      <div className="alert alert-warning">
        <h5> Access Denied</h5>
        <p>Academic Calendar Management is only available for Super Administrators.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-3">Loading calendar management...</p>
      </div>
    );
  }

  return (
    <>
      <div className="academic-calendar-manager">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h3> Academic Calendar Management</h3>
            <p className="text-muted">Upload and manage academic calendar documents to control student request availability</p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => setShowUploadModal(true)}
            disabled={uploadInProgress}
          >
             Upload New Calendar
          </button>
        </div>

        {/* Calendar Status Card */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0"> Current Calendar Status</h5>
              </div>
              <div className="card-body">
                {calendarStatus ? (
                  <div className="row">
                    <div className="col-md-6">
                      <h6></h6>
                      <ul className="list-unstyled">
                        <li>
                          <strong>Calendar Enabled:</strong> 
                          <span className={` ms-2 ${calendarStatus.system_info.calendar_enabled ? 'text-muted' : 'bg-danger'}`}>
                            {calendarStatus.system_info.calendar_enabled ? 'Yes' : 'No'}
                          </span>
                        </li>
                        <li><strong>Current Academic Year:</strong> {calendarStatus.system_info.academic_year || 'Not set'}</li>
                        <li><strong>Holiday Buffer Hours:</strong> {calendarStatus.system_info.buffer_hours}</li>
                        <li><strong>Current Date:</strong> {calendarStatus.system_info.current_date}</li>
                      </ul>
                    </div>
                    <div className="col-md-6">
                      <h6>Today's Status: </h6>
                      {calendarStatus.today_status ? (
                        <div>
                          <p className={`mb-2 ${calendarStatus.today_status.is_holiday ? 'text-danger' : 'text-muted'}`}>
                            <strong>
                              {calendarStatus.today_status.is_holiday ? ' Holiday Period' : ' Regular Working Day'}
                            </strong>
                          </p>
                          {calendarStatus.today_status.is_holiday && (
                            <p className="text-muted">{calendarStatus.today_status.message}</p>
                          )}
                          {calendarStatus.next_available && !calendarStatus.next_available.success && (
                            <p className="text-info">
                              Next available: {calendarStatus.next_available.next_date}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted">Unable to check today's status</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning">
                    <p className="mb-0">Unable to load calendar status</p>
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
                <h5 className="mb-0"> Calendar Settings</h5>
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
                        Enable Academic Calendar Restrictions
                      </label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Holiday Buffer Hours</label>
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
                      Hours before/after holidays to also block requests
                    </small>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Current Academic Year</label>
                    <select
                      className="form-select"
                      value={settings.current_academic_year}
                      onChange={(e) => setSettings({
                        ...settings,
                        current_academic_year: e.target.value
                      })}
                    >
                      <option value="">Select Academic Year</option>
                      {generateAcademicYearOptions().map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <button 
                    className="btn btn-danger"
                    onClick={updateSettings}
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

       
        {/* Upcoming Events */}
        {calendarStatus?.upcoming_events && calendarStatus.upcoming_events.length > 0 && (
          <div className="row mb-2">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0"> Upcoming Events (Next 7 Days)</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    {calendarStatus.upcoming_events.map((event, index) => (
                      <div key={index} className="col-md-12 mb-1">
                        <div className="d-flex align-items-center">
                          <span className="me-2">{getEventTypeIcon(event.event_type)}</span>
                          <div>
                            <strong>{event.event_name}</strong>
                            <br />
                            <small className="text-muted">
                              
                            </small>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload History */}
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Upload History</h5>
                <button 
                  className="btn btn-outline-secondary btn-sm"
                  onClick={fetchUploadHistory}
                >
                  Refresh
                </button>
              </div>
              <div className="card-body">
                {uploadHistory.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted">No calendar uploads found</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th>File Name</th>
                          <th>Academic Year</th>
                          <th>Status</th>
                          <th>Events</th>
                          <th>Uploaded By</th>
                          <th>Upload Date</th>
                          <th>Actions</th>
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
                              
                              {upload.is_active && (
                                <span className="badge bg-primary ms-1">Active</span>
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
                                  View Events
                                </button>
                                <button 
                                  className="btn btn-outline-danger"
                                  onClick={() => deleteUpload(upload.upload_id, upload.file_name)}
                                >
                                   Delete
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
                  <h5 className="modal-title"> Upload Academic Calendar</h5>
                  <button 
                    type="button" 
                    className="btn-close"
                    onClick={() => setShowUploadModal(false)}
                    disabled={uploadInProgress}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-info">
                    <h6> Upload Instructions</h6>
                    <ul className="mb-0">
                      <li>Upload a Word document (.doc, .docx) or text file (.txt) containing the academic calendar</li>
                      <li>The document should include dates and event names in Turkish or English</li>
            
                      <li>Holiday events will automatically restrict student requests</li>
                      <li>Maximum file size: 10MB</li>
                    </ul>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Academic Year</label>
                    <select
                      className="form-select"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      disabled={uploadInProgress}
                    >
                      <option value="">Select Academic Year</option>
                      {generateAcademicYearOptions().map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Calendar Document</label>
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
                      <h6> Selected File</h6>
                      <p className="mb-0">
                        <strong>{selectedFile.name}</strong><br />
                        Size: {formatFileSize(selectedFile.size)}<br />
                        Type: {selectedFile.type}
                      </p>
                    </div>
                  )}

                  {uploadInProgress && (
                    <div className="alert alert-info">
                      <div className="d-flex align-items-center">
                        <div className="spinner-border spinner-border-sm me-2"></div>
                        <span>Processing calendar document...</span>
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
    Cancel
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
        Processing...
      </>
    ) : (
      ' Upload & Process'
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
                  <h5 className="modal-title"> Calendar Events</h5>
                  <button 
                    type="button" 
                    className="btn-close"
                    onClick={() => setShowEventsModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  {currentEvents.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted">No events found</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead>
                          <tr>
                            <th>Event</th>
                            <th>Type</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Duration</th>
                            <th>Affects Requests</th>
                          
                          </tr>
                        </thead>
                        <tbody>
                          {currentEvents.map((event, index) => (
                            <tr key={index}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <span className="me-2">{getEventTypeIcon(event.event_type)}</span>
                                  <div>
                                    <strong>{event.event_name}</strong>
                                    {event.description && (
                                      <>
                                        <br />
                                        <small className="text-muted">{event.description}</small>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="badge bg-secondary">
                                  {event.event_type.replace('_', ' ')}
                                </span>
                                
                                
                              </td>
                              <td>{event.start_date}</td>
                              <td>{event.end_date}</td>
                              <td>
                                {Math.ceil((new Date(event.end_date) - new Date(event.start_date)) / (1000 * 60 * 60 * 24)) + 1} days
                              </td>
                              <td>
                                <span className={`badge ${event.affects_request_creation ? 'bg-danger' : 'bg-success'}`}>
                                  {event.affects_request_creation ? 'Yes' : 'No'}
                                </span>
                              </td>
                              <td>
                                
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowEventsModal(false)}
                  >
                    Close
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