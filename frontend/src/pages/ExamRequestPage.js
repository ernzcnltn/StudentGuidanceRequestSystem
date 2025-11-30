import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';

const ExamRequestPage = () => {
  const navigate = useNavigate();
const { user, loading: userLoading } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'myRequests'
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [myExamRequests, setMyExamRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  
  // Modal state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    exam_type: 'makeup',
    course_code: '',
    course_name: '',
    instructor_name: '',
    exam_date: '',
    reason: ''
  });

  const [files, setFiles] = useState([]);

  // Helper function to get file icon based on type
  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return 'bi-file-pdf';
    if (fileType.includes('image')) return 'bi-file-image';
    return 'bi-file-earmark';
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Drag and drop handlers
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!studentFaculty || submitting || files.length >= 3) {
      return;
    }

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileChange({ target: { files: droppedFiles } });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Load faculties on mount
  useEffect(() => {
    const loadFaculties = async () => {
      try {
        setLoading(true);
        const response = await apiService.getFaculties();
        if (response.data.success) {
          setFaculties(response.data.data);
        }
      } catch (error) {
        console.error('Error loading faculties:', error);
        showError('Failed to load faculties');
      } finally {
        setLoading(false);
      }
    };

    loadFaculties();
  }, [showError]);

  // Load exam requests when tab changes to "My Requests"
  useEffect(() => {
    if (activeTab === 'myRequests') {
      loadExamRequests();
    }
  }, [activeTab]);

  const loadExamRequests = async () => {
    try {
      setLoadingRequests(true);
      const response = await apiService.getMyExamRequests();
      if (response.data.success) {
        setMyExamRequests(response.data.data);
      }
    } catch (error) {
      console.error('Error loading exam requests:', error);
      showError('Failed to load exam requests');
    } finally {
      setLoadingRequests(false);
    }
  };




  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    if (files.length + selectedFiles.length > 3) {
      showError('Maximum 3 files allowed');
      return;
    }

    const validFiles = [];
    selectedFiles.forEach(file => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!validTypes.includes(file.type)) {
        showError(`${file.name}: Invalid file type. Only JPG, PNG, PDF allowed.`);
        return;
      }

      if (file.size > maxSize) {
        showError(`${file.name}: File too large. Max 5MB.`);
        return;
      }

      validFiles.push(file);
    });

    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!studentFaculty) {
      showError('Your faculty information is missing. Please contact student services.');
      return;
    }

    if (!formData.course_code.trim() || !formData.course_name.trim()) {
      showError('Please fill in course code and course name');
      return;
    }

    if (!formData.reason.trim()) {
      showError('Please provide a reason for your exam request');
      return;
    }

    try {
      setSubmitting(true);

      const requestData = {
        faculty_id: studentFaculty.faculty_id,
        exam_type: formData.exam_type,
        course_code: formData.course_code.trim(),
        course_name: formData.course_name.trim(),
        instructor_name: formData.instructor_name.trim() || null,
        exam_date: formData.exam_date || null,
        reason: formData.reason.trim()
      };

      const response = await apiService.createExamRequest(requestData);

      if (response.data.success) {
        const examRequestId = response.data.data.exam_request_id;

        // Upload files if any
        if (files.length > 0) {
          const fileFormData = new FormData();
          files.forEach(file => {
            fileFormData.append('files', file);
          });

          try {
            await apiService.uploadExamRequestFile(examRequestId, fileFormData);
            showSuccess(`Exam request #${examRequestId} submitted successfully with ${files.length} file(s)!`);
          } catch (uploadError) {
            showWarning(`Request submitted but file upload failed. Request ID: #${examRequestId}`);
          }
        } else {
          showSuccess(`Exam request #${examRequestId} submitted successfully!`);
        }

        // Reset form
        setFormData({
          exam_type: 'makeup',
          course_code: '',
          course_name: '',
          instructor_name: '',
          exam_date: '',
          reason: ''
        });
        setFiles([]);

        // Switch to My Requests tab
        setTimeout(() => {
          setActiveTab('myRequests');
          loadExamRequests();
        }, 1500);
      }
    } catch (error) {
      console.error('Error submitting exam request:', error);
      showError(error.response?.data?.error || 'Failed to submit exam request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Pending': 'bg-warning text-dark',
      'Approved': 'bg-success text-white',
      'Rejected': 'bg-danger text-white'
    };
    return badges[status] || 'bg-secondary text-white';
  };

  const getExamTypeBadge = (examType) => {
    const badges = {
      'makeup': '',
      'resit': ''
    };
    return badges[examType] || 'bg-secondary';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

    // User loading kontrolü - EN ÖNCELİKLİ
  if (userLoading) {
    return (
      <div className="container mt-4">
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // User yok mu kontrolü
  if (!user) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning">
          <h5><i className="bi bi-exclamation-triangle me-2"></i>Profile Not Found</h5>
          <p>Unable to load your profile. Please try logging out and logging in again.</p>
        </div>
      </div>
    );
  }


   if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Loading...</p>
      </div>
    );
  }

  // 👇 BURAYA TAŞI (loading'den SONRA, faculties yüklendikten sonra)
  const studentFaculty = faculties.find(f => {
    if (!user?.faculty) {
      console.log('❌ User faculty YOK!');
      return false;
    }
    
    const userFac = user.faculty.toLowerCase();
    const dbName = (f.faculty_name || '').toLowerCase();
    const dbNameTr = (f.faculty_name_tr || '').toLowerCase();
    
    console.log('🔍 Testing:', {
      userFac,
      dbName,
      dbNameTr,
      match: userFac.includes(dbName) || userFac.includes(dbNameTr)
    });
    
    return userFac.includes(dbName) || userFac.includes(dbNameTr);
  });
  
  console.log('✅ Final result:', studentFaculty);

  // 👇 Faculty kontrolü
  if (!user?.faculty || !studentFaculty) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger">
          <h5><i className="bi bi-exclamation-triangle me-2"></i>Faculty Information Missing</h5>
          <p className="mb-3">
            Your student profile doesn't have faculty information. 
            Please contact student services to update your profile.
          </p>
          <div className="small">
            <strong>Your current data:</strong><br/>
            Student: {user?.name}<br/>
            Email: {user?.email}<br/>
            Faculty: {user?.faculty || 'NOT SET'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-10">
          {/* Page Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2><i className="bi bi-clipboard2-check me-2"></i>Exam Requests</h2>
              <p className={isDark ? 'text-light' : 'text-muted'}>
                Submit and manage Make-up or Resit exam requests
              </p>
            </div>
          </div>

          {/* Faculty Info Card */}
          {studentFaculty && (
            <div className="alert alert-danger mb-4">
              <h6 className="alert-heading">
                <i className="bi bi-building me-2"></i>
                Your Faculty Information
              </h6>
              <div className="row">
                <div className="col-md-6">
                  <strong>Faculty:</strong> {studentFaculty.faculty_name_tr || studentFaculty.faculty_name}
                </div>
                <div className="col-md-6">
                  <strong>Secretary:</strong> {studentFaculty.secretary_email}
                </div>
              </div>
            </div>
          )}

          {!studentFaculty && (
            <div className="alert alert-danger mb-4">
              <h6 className="alert-heading"><i className="bi bi-exclamation-triangle me-2"></i>Faculty Information Missing</h6>
              <p className="mb-0">
                Your student profile doesn't have faculty information. 
                Please contact student services to update your profile.
              </p>
            </div>
          )}

          {/* Tabs */}
          <ul className="nav nav-tabs mb-4" role="tablist">
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link ${activeTab === 'create' ? 'active' : ''}`}
                onClick={() => setActiveTab('create')}
                type="button"
                role="tab"
                style={{
                  color: activeTab === 'create' ? '#dc2626' : (isDark ? '#e2e8f0' : '#495057'),
                  backgroundColor: activeTab === 'create' ? (isDark ? '#2d3748' : '#7e0909ff') : 'transparent',
                  borderColor: activeTab === 'create' ? '#dc2626 #dc2626 transparent' : 'transparent',
                  fontWeight: activeTab === 'create' ? '600' : '400'
                }}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Create Request
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link ${activeTab === 'myRequests' ? 'active' : ''}`}
                onClick={() => setActiveTab('myRequests')}
                type="button"
                role="tab"
                style={{
                  color: activeTab === 'myRequests' ? '#dc2626' : (isDark ? '#e2e8f0' : '#495057'),
                  backgroundColor: activeTab === 'myRequests' ? (isDark ? '#2d3748' : '#7e0909ff') : 'transparent',
                  borderColor: activeTab === 'myRequests' ? '#dc2626 #dc2626 transparent' : 'transparent',
                  fontWeight: activeTab === 'myRequests' ? '600' : '400'
                }}
              >
                <i className="bi bi-list-check me-2"></i>
                My Requests
                {myExamRequests.length > 0 && (
                  <span className="badge bg-danger ms-2">{myExamRequests.length}</span>
                )}
              </button>
            </li>
          </ul>

          {/* Tab Content */}
          {activeTab === 'create' ? (
            <CreateRequestTab
              formData={formData}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              files={files}
              handleFileChange={handleFileChange}
              removeFile={removeFile}
              handleDrop={handleDrop}
              handleDragOver={handleDragOver}
              handleDragEnter={handleDragEnter}
              handleDragLeave={handleDragLeave}
              getFileIcon={getFileIcon}
              formatFileSize={formatFileSize}
              studentFaculty={studentFaculty}
              submitting={submitting}
              isDark={isDark}
              setFiles={setFiles}
            />
          ) : (
            <MyRequestsTab
              myExamRequests={myExamRequests}
              loadingRequests={loadingRequests}
              getStatusBadge={getStatusBadge}
              getExamTypeBadge={getExamTypeBadge}
              formatDate={formatDate}
              isDark={isDark}
              loadExamRequests={loadExamRequests}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              itemsPerPage={itemsPerPage}
              setSelectedRequest={setSelectedRequest}
              setShowModal={setShowModal}
            />
          )}
        </div>
      </div>

      {/* Request Detail Modal */}
      {showModal && selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={() => {
            setShowModal(false);
            setSelectedRequest(null);
          }}
          getStatusBadge={getStatusBadge}
          getExamTypeBadge={getExamTypeBadge}
          formatDate={formatDate}
          isDark={isDark}
        />
      )}
    </div>
  );
};

// Create Request Tab Component
const CreateRequestTab = ({
  formData,
  handleInputChange,
  handleSubmit,
  files,
  handleFileChange,
  removeFile,
  handleDrop,
  handleDragOver,
  handleDragEnter,
  handleDragLeave,
  getFileIcon,
  formatFileSize,
  studentFaculty,
  submitting,
  isDark,
  setFiles
}) => {
  const remainingChars = 500 - (formData.reason?.length || 0);
 const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [courseSearchResults, setCourseSearchResults] = useState([]);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [searchingCourses, setSearchingCourses] = useState(false);

  // Course search handler
  const handleCourseSearch = async (query) => {
    setCourseSearchQuery(query);
    
    if (query.length < 2) {
      setCourseSearchResults([]);
      setShowCourseDropdown(false);
      return;
    }
    
    try {
      setSearchingCourses(true);
      const response = await apiService.searchCourses(query);
      
      if (response.data.success) {
        setCourseSearchResults(response.data.data);
        setShowCourseDropdown(response.data.data.length > 0);
      }
    } catch (error) {
      console.error('Error searching courses:', error);
      setCourseSearchResults([]);
    } finally {
      setSearchingCourses(false);
    }
  };

  // Course selection handler
  const handleCourseSelect = (course) => {
    // Otomatik doldur
    handleInputChange({ target: { name: 'course_code', value: course.course_code } });
    handleInputChange({ target: { name: 'course_name', value: course.course_name } });
    handleInputChange({ target: { name: 'instructor_name', value: course.instructor_name || '' } });
    
    // Dropdown'u kapat
    setShowCourseDropdown(false);
    setCourseSearchQuery('');
    setCourseSearchResults([]);
  };

  return (
    <div 
      className="card"
      style={{
        backgroundColor: isDark ? '#2d3748' : '#ffffff',
        borderColor: isDark ? '#4a5568' : '#e2e8f0'
      }}
    >
      <div 
        className="card-header"
        style={{
          backgroundColor: isDark ? '#4a5568' : '#f8f9fa',
          borderColor: isDark ? '#718096' : '#e2e8f0'
        }}
      >
        <h5 className="mb-0">Exam Request Details</h5>
      </div>

      <div className="card-body">
        <form onSubmit={handleSubmit}>
{/* Exam Type */}
<div className="mb-4">
  <label className="form-label fw-bold">
    <i className="bi bi-clipboard-check me-2"></i>
    Exam Type *
  </label>
  <div className="row">
    <div className="col-md-6 mb-2">
      <div 
        className="card p-3" 
        style={{ cursor: 'pointer' }}
        onClick={() => !studentFaculty ? null : handleInputChange({ target: { name: 'exam_type', value: 'makeup' } })}
      >
        <div className="d-flex align-items-start">
          <input
            className="form-check-input me-3 flex-shrink-0"
            type="radio"
            name="exam_type"
            id="makeup"
            value="makeup"
            checked={formData.exam_type === 'makeup'}
            onChange={handleInputChange}
            disabled={!studentFaculty}
            style={{ cursor: 'pointer', marginTop: '2px' }}
          />
          <label className="w-100" htmlFor="makeup" style={{ cursor: 'pointer' }}>
            <strong>Make-up Exam</strong>
            <p className="mb-0 small text-muted">
              For students who missed the regular exam due to valid reasons
            </p>
          </label>
        </div>
      </div>
    </div>
    <div className="col-md-6 mb-2">
      <div 
        className="card p-3" 
        style={{ cursor: 'pointer' }}
        onClick={() => !studentFaculty ? null : handleInputChange({ target: { name: 'exam_type', value: 'resit' } })}
      >
        <div className="d-flex align-items-start">
          <input
            className="form-check-input me-3 flex-shrink-0"
            type="radio"
            name="exam_type"
            id="resit"
            value="resit"
            checked={formData.exam_type === 'resit'}
            onChange={handleInputChange}
            disabled={!studentFaculty}
            style={{ cursor: 'pointer', marginTop: '2px' }}
          />
          <label className="w-100" htmlFor="resit" style={{ cursor: 'pointer' }}>
            <strong>Resit Exam</strong>
            <p className="mb-0 small text-muted">
              For students who failed the course and need to retake the exam
            </p>
          </label>
        </div>
      </div>
    </div>
  </div>
</div>
          {/* Course Information */}
        <div className="row">
  <div className="col-md-6 mb-3">
    <label htmlFor="course_code" className="form-label fw-bold">
      <i className="bi bi-search me-2"></i>
      Search Course Code *
    </label>
    <div className="position-relative">
      <input
        type="text"
        className="form-control"
        id="course_search"
        value={courseSearchQuery || formData.course_code}
        onChange={(e) => handleCourseSearch(e.target.value)}
        onFocus={() => {
          if (courseSearchResults.length > 0) {
            setShowCourseDropdown(true);
          }
        }}
        placeholder="Type to search... (e.g., SOFT)"
        disabled={!studentFaculty || submitting}
        autoComplete="off"
      />
      {searchingCourses && (
        <div 
          className="position-absolute" 
          style={{ right: '10px', top: '50%', transform: 'translateY(-50%)' }}
        >
          <div className="spinner-border spinner-border-sm text-primary" role="status">
            <span className="visually-hidden">Searching...</span>
          </div>
        </div>
      )}
      
      {/* Dropdown Results */}
      {showCourseDropdown && courseSearchResults.length > 0 && (
        <div 
          className="position-absolute w-100 mt-1 shadow-lg rounded"
          style={{
            backgroundColor: isDark ? '#2d3748' : '#ffffff',
            border: `1px solid ${isDark ? '#4a5568' : '#e2e8f0'}`,
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1000
          }}
        >
          {courseSearchResults.map((course) => (
            <div
              key={course.course_id}
              className="p-3 border-bottom"
              style={{
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onClick={() => handleCourseSelect(course)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark ? '#4a5568' : '#f7fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div className="flex-grow-1">
                  <div className="fw-bold text-primary">
                    {course.course_code}
                  </div>
                  <div className="small">{course.course_name}</div>
                  <div className="small text-muted">
                    <i className="bi bi-person me-1"></i>
                    {course.instructor_name || 'No instructor'}
                  </div>
                </div>
                {course.credits && (
                  <span className="badge bg-secondary">
                    {course.credits} credits
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    <small className="text-muted">
      Start typing to search from course database
    </small>
  </div>

 {/* 👇 YENİ: Course Name Input */}
  <div className="col-md-6 mb-3">
    <label htmlFor="course_name" className="form-label fw-bold">
      Course Name *
    </label>
    <input
      type="text"
      className="form-control"
      id="course_name"
      name="course_name"
      value={formData.course_name}
      onChange={handleInputChange}
      placeholder="Auto-filled from search or enter manually"
      required
      disabled={!studentFaculty || submitting}
      style={{
        backgroundColor: formData.course_name && !courseSearchQuery ? '#f8f9fa' : undefined
      }}
    />
  </div>
          </div>

     <div className="row">
  <div className="col-md-6 mb-3">
    <label htmlFor="instructor_name" className="form-label fw-bold">
      Instructor Name
    </label>
    <input
      type="text"
      className="form-control"
      id="instructor_name"
      name="instructor_name"
      value={formData.instructor_name}
      onChange={handleInputChange}
      placeholder="Auto-filled from search or enter manually"
      disabled={!studentFaculty || submitting}
      style={{
        backgroundColor: formData.instructor_name && !courseSearchQuery ? '#f8f9fa' : undefined
      }}
    />
  </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="exam_date" className="form-label fw-bold">
                Original Exam Date (Optional)
              </label>
              <input
                type="date"
                className="form-control"
                id="exam_date"
                name="exam_date"
                value={formData.exam_date}
                onChange={handleInputChange}
                disabled={!studentFaculty || submitting}
              />
            </div>
          </div>

          {/* Reason */}
          <div className="mb-4">
            <label htmlFor="reason" className="form-label fw-bold">
              Reason for Request *
              <span className={`ms-2 ${remainingChars < 50 ? 'text-warning' : 'text-muted'}`}>
                ({remainingChars} characters remaining)
              </span>
            </label>
            <textarea
              className="form-control"
              id="reason"
              name="reason"
              rows="5"
              value={formData.reason}
              onChange={handleInputChange}
              placeholder="Please explain why you need this exam request (e.g., medical reasons, family emergency, etc.)"
              required
              disabled={!studentFaculty || submitting}
              maxLength={500}
            />
            <div className="form-text">
              Provide a detailed explanation. This helps the secretary process your request.
            </div>
          </div>

          {/* File Upload with Drag & Drop */}
          <div className="mb-4">
            <label className="form-label fw-bold">
              <i className="bi bi-paperclip me-2"></i>
              Supporting Documents (Optional)
            </label>
            
            <div 
              className="border rounded p-4"
              style={{ 
                backgroundColor: isDark ? '#4a5568' : '#f8f9fa',
                borderStyle: 'dashed',
                borderWidth: '2px',
                borderColor: isDark ? '#718096' : '#dee2e6'
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
            >
              {/* Hidden file input */}
              <input
                type="file"
                id="file-upload-input"
                className="d-none"
                onChange={handleFileChange}
                multiple
                accept=".jpg,.jpeg,.png,.pdf"
                disabled={!studentFaculty || submitting || files.length >= 3}
              />

              {/* Upload Area */}
              <div className="text-center">
                <div className="mb-3">
                  <i className="bi bi-cloud-upload" style={{ fontSize: '3rem', color: isDark ? '#cbd5e0' : '#6c757d' }}></i>
                </div>
                
                <h5 className={isDark ? 'text-light' : 'text-dark'}>
                  Drag & Drop files here
                </h5>
                
                <p className={isDark ? 'text-gray-400' : 'text-muted'} style={{ marginBottom: '1rem' }}>
                  or
                </p>
                
                <label 
                  htmlFor="file-upload-input" 
                  className="btn btn-primary"
                  style={{ 
                    cursor: (!studentFaculty || submitting || files.length >= 3) ? 'not-allowed' : 'pointer',
                    opacity: (!studentFaculty || submitting || files.length >= 3) ? 0.6 : 1
                  }}
                >
                  <i className="bi bi-folder2-open me-2"></i>
                  Browse Files
                </label>
                
                <div className="mt-3">
                  <small className={isDark ? 'text-gray-400' : 'text-muted'}>
                    <i className="bi bi-info-circle me-1"></i>
                    Max 3 files, 5MB each. Allowed: JPG, PNG, PDF
                  </small>
                </div>
                
                {files.length >= 3 && (
                  <div className="alert alert-warning mt-3 py-2 mb-0">
                    <small>
                      <i className="bi bi-exclamation-triangle me-1"></i>
                      Maximum file limit reached (3/3)
                    </small>
                  </div>
                )}
              </div>

              {/* Selected Files List */}
              {files.length > 0 && (
                <div className="mt-4 pt-3 border-top" style={{ borderColor: isDark ? '#718096' : '#dee2e6' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <strong className={isDark ? 'text-light' : 'text-dark'}>
                      <i className="bi bi-files me-2"></i>
                      Selected Files ({files.length}/3)
                    </strong>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setFiles([])}
                      disabled={submitting}
                    >
                      <i className="bi bi-trash me-1"></i>
                      Clear All
                    </button>
                  </div>
                  
                  <div className="row g-2">
                    {files.map((file, index) => (
                      <div key={index} className="col-12">
                        <div 
                          className="card shadow-sm"
                          style={{ 
                            backgroundColor: isDark ? '#2d3748' : '#ffffff',
                            borderLeft: '4px solid #0d6efd'
                          }}
                        >
                          <div className="card-body p-3">
                            <div className="d-flex align-items-center">
                              <div className="me-3">
                                <div 
                                  className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                                  style={{ width: '45px', height: '45px', fontSize: '1.2rem' }}
                                >
                                  <i className={getFileIcon(file.type)}></i>
                                </div>
                              </div>
                              <div className="flex-grow-1">
                                <h6 className="card-title mb-1" style={{ fontSize: '0.9rem' }}>
                                  {file.name.length > 35 
                                    ? file.name.substring(0, 35) + '...' 
                                    : file.name
                                  }
                                </h6>
                                <div className="d-flex justify-content-between align-items-center">
                                  <small className={isDark ? 'text-gray-400' : 'text-muted'}>
                                    <i className="bi bi-hdd me-1"></i>
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
                                      disabled={submitting}
                                      title="Remove file"
                                      style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                                    >
                                      <i className="bi bi-x-lg"></i>
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
                                <i className="bi bi-check-circle me-1"></i>
                                Ready to upload
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

          {/* Important Notice */}
          <div className="alert alert-danger mb-4">
            <h6 className="alert-heading">
              <i className="bi bi-exclamation-triangle me-2"></i>
              Important Notice
            </h6>
            <ul className="mb-0">
              <li>Your request will be reviewed by your faculty secretary</li>
              <li>You will be notified via email about the decision</li>
              <li>Processing time may take 3-5 business days</li>
              <li>Make sure all information is accurate before submitting</li>
            </ul>
          </div>

          {/* Submit Button */}
          <div className="d-grid gap-2">
            <button
              type="submit"
              className="btn btn-danger btn-lg"
              disabled={!studentFaculty || submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Submitting...
                </>
              ) : (
                <>
                  <i className="bi bi-send me-2"></i>
                  Submit Exam Request
                  {files.length > 0 && ` (${files.length} ${files.length > 1 ? 'files' : 'file'})`}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// My Requests Tab Component
const MyRequestsTab = ({
  myExamRequests,
  loadingRequests,
  getStatusBadge,
  getExamTypeBadge,
  formatDate,
  isDark,
  loadExamRequests,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  setSelectedRequest,
  setShowModal
}) => {
  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRequests = myExamRequests.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(myExamRequests.length / itemsPerPage);
const [viewMode, setViewMode] = useState('card'); 

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRequestClick = (request) => {
    setSelectedRequest(request);
    setShowModal(true);
  };
  if (loadingRequests) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Loading your exam requests...</p>
      </div>
    );
  }

  if (myExamRequests.length === 0) {
    return (
      <div 
        className="card"
        style={{
          backgroundColor: isDark ? '#2d3748' : '#ffffff',
          borderColor: isDark ? '#4a5568' : '#e2e8f0'
        }}
      >
        <div className="card-body text-center py-5">
          <div className="mb-4">
            <i className="bi bi-inbox" style={{ fontSize: '4rem', color: '#6c757d' }}></i>
          </div>
          <h4 className={isDark ? 'text-light' : 'text-muted'}>No Exam Requests Yet</h4>
          <p className={isDark ? 'text-gray-400' : 'text-muted'}>
            You haven't submitted any exam requests. Click "Create Request" tab to submit one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
     <div className="d-flex justify-content-between align-items-center mb-3">
  <h5 className={isDark ? 'text-light' : 'text-dark'}>
    <i className="bi bi-list-ul me-2"></i>
    Your Exam Requests ({myExamRequests.length})
  </h5>
  
  <div className="d-flex gap-2">
    {/* 👇 YENİ: View Toggle */}
    <div className="btn-group" role="group">
      <button
        type="button"
        className={`btn btn-sm ${viewMode === 'card' ? 'btn-danger' : 'btn-outline-danger'}`}
        onClick={() => setViewMode('card')}
        title="Card View"
      >
        <i className="bi bi-grid-3x2"></i>
      </button>
      <button
        type="button"
        className={`btn btn-sm ${viewMode === 'table' ? 'btn-danger' : 'btn-outline-danger'}`}
        onClick={() => setViewMode('table')}
        title="Table View"
      >
        <i className="bi bi-table"></i>
      </button>
    </div>
    
    <button 
      className="btn btn-sm btn-outline-primary"
      onClick={loadExamRequests}
    >
      <i className="bi bi-arrow-clockwise me-1"></i>
      Refresh
    </button>
  </div>
</div>

{viewMode === 'card' ? (

      <div className="row">
        {currentRequests.map((request) => (
          <div key={request.exam_request_id} className="col-md-12 mb-3">
            <div 
              className="card shadow-sm"
              style={{
                backgroundColor: isDark ? '#2d3748' : '#ffffff',
                borderColor: isDark ? '#4a5568' : '#e2e8f0',
                borderLeft: `4px solid ${
                  request.status === 'Approved' ? '#28a745' :
                  request.status === 'Rejected' ? '#dc3545' :
                  '#ffc107'
                }`,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => handleRequestClick(request)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '';
              }}
            >
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h5 className="card-title mb-2">
                      <span className={`badge ${getExamTypeBadge(request.exam_type)} me-2`}>
                        {request.exam_type === 'makeup' ? 'Make-up' : 'Resit'}
                      </span>
                      {request.course_code} - {request.course_name}
                    </h5>
                    <p className="card-text text-muted mb-1">
                      <i className="bi bi-person me-1"></i>
                      {request.instructor_name || 'Instructor not specified'}
                    </p>
                  </div>
                  <span className={`badge ${getStatusBadge(request.status)}`}>
                    {request.status}
                  </span>
                </div>

                <div className="row text-sm">
                  <div className="col-md-4 mb-2">
                    <strong><i className="bi bi-calendar-event me-1"></i>Submitted:</strong>
                    <br />
                    <span className={isDark ? 'text-light' : 'text-dark'}>
                      {formatDate(request.submitted_at)}
                    </span>
                  </div>
                  <div className="col-md-4 mb-2">
                    <strong><i className="bi bi-building me-1"></i>Faculty:</strong>
                    <br />
                    <span className={isDark ? 'text-light' : 'text-dark'}>
                      {request.faculty_name_tr || request.faculty_name}
                    </span>
                  </div>
                  <div className="col-md-4 mb-2">
                    <strong><i className="bi bi-hash me-1"></i>Request ID:</strong>
                    <br />
                    <span className={isDark ? 'text-light' : 'text-dark'}>
                      #{request.exam_request_id}
                    </span>
                  </div>
                </div>

                {request.attachment_count > 0 && (
                  <div className="mt-2">
                    <span className=" secondary">
                      <i className="bi bi-paperclip me-1"></i>
                      {request.attachment_count} attachment{request.attachment_count > 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                <div className="mt-3 text-end">
                  <small className="text-muted">
                    <i className="bi bi-cursor-fill me-1"></i>
                    Click to view details
                  </small>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      ) : (
  // Table View
  <div className="card" style={{
    backgroundColor: isDark ? '#2d3748' : '#ffffff',
    borderColor: isDark ? '#4a5568' : '#e2e8f0'
  }}>
    <div className="table-responsive">
      <table className="table table-hover mb-0">
        <thead style={{ backgroundColor: isDark ? '#4a5568' : '#f8f9fa' }}>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Course</th>
            <th>Instructor</th>
            <th>Submitted</th>
            <th>Status</th>
            <th>Attachments</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {currentRequests.map((request) => (
            <tr 
              key={request.exam_request_id}
              style={{ cursor: 'pointer' }}
              onClick={() => handleRequestClick(request)}
              className={isDark ? 'text-light' : ''}
            >
              <td>#{request.exam_request_id}</td>
              <td>
                <span className={`badge ${getExamTypeBadge(request.exam_type)}`}>
                  {request.exam_type === 'makeup' ? 'Make-up' : 'Resit'}
                </span>
              </td>
              <td>
                <div>
                  <strong>{request.course_code}</strong>
                  <br />
                  <small className="text-muted">{request.course_name}</small>
                </div>
              </td>
              <td>{request.instructor_name || '-'}</td>
              <td>
                <small>{formatDate(request.submitted_at)}</small>
              </td>
              <td>
                <span className={`badge ${getStatusBadge(request.status)}`}>
                  {request.status}
                </span>
              </td>
              <td className="text-center">
                {request.attachment_count > 0 && (
                  <span className="info">
                    <i className="bi bi-paperclip me-1"></i>
                    {request.attachment_count}
                  </span>
                )}
              </td>
              <td>
                <button 
                  className="btn btn-sm btn-outline-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRequestClick(request);
                  }}
                >
                  <i className="bi bi-eye"></i>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav aria-label="Exam requests pagination" className="mt-4">
          <ul className="pagination justify-content-center">
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button 
                className="page-link" 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  backgroundColor: isDark ? '#2d3748' : '#ffffff',
                  borderColor: isDark ? '#718096' : '#dee2e6',
                  color: isDark ? '#ffffff' : '#000000'
                }}
              >
                Previous
              </button>
            </li>
            
            {[...Array(totalPages)].map((_, index) => (
              <li key={index + 1} className={`page-item ${currentPage === index + 1 ? 'active' : ''}`}>
                <button 
                  className="page-link" 
                  onClick={() => handlePageChange(index + 1)}
                  style={{
                    backgroundColor: currentPage === index + 1 
                      ? '#dc2626' 
                      : (isDark ? '#2d3748' : '#ffffff'),
                    borderColor: currentPage === index + 1 
                      ? '#dc2626' 
                      : (isDark ? '#718096' : '#dee2e6'),
                    color: currentPage === index + 1 
                      ? '#ffffff' 
                      : (isDark ? '#ffffff' : '#000000')
                  }}
                >
                  {index + 1}
                </button>
              </li>
            ))}
            
            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button 
                className="page-link" 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  backgroundColor: isDark ? '#2d3748' : '#ffffff',
                  borderColor: isDark ? '#718096' : '#dee2e6',
                  color: isDark ? '#ffffff' : '#000000'
                }}
              >
                Next
              </button>
            </li>
          </ul>
          
          <div className="text-center mt-2">
            <small className={isDark ? 'text-gray-400' : 'text-muted'}>
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, myExamRequests.length)} of {myExamRequests.length} requests
            </small>
          </div>
        </nav>
      )}
    </div>
  );
};

// Request Detail Modal Component
const RequestDetailModal = ({
  request,
  onClose,
  getStatusBadge,
  getExamTypeBadge,
  formatDate,
  isDark
}) => {
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // Load attachments when modal opens
  useEffect(() => {
    if (request.attachment_count > 0) {
      loadAttachments();
    }
  }, [request.exam_request_id]);

  const loadAttachments = async () => {
    try {
      setLoadingAttachments(true);
      const response = await apiService.getExamRequestAttachments(request.exam_request_id);
      if (response.data.success) {
        setAttachments(response.data.data);
      }
    } catch (error) {
      console.error('Error loading attachments:', error);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return 'bi-file-pdf-fill text-danger';
    if (fileType.includes('image')) return 'bi-file-image-fill text-primary';
    return 'bi-file-earmark-fill text-secondary';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const canPreview = (fileType) => {
    return fileType.includes('image') || fileType.includes('pdf');
  };

const previewFileHandler = async (attachment) => {
  try {
    console.log('Starting preview for:', attachment.file_name);
    
    // Fetch dosyayı blob olarak al
    const response = await fetch(`http://localhost:5000/uploads/${attachment.file_path}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    setPreviewFile({
      url,
      type: attachment.file_type,
      name: attachment.file_name,
      attachment
    });
  } catch (error) {
    console.error('Error previewing file:', error);
  }
};

  const closePreview = () => {
    setPreviewFile(null);
  };

  const handleDownload = async (attachment) => {
    try {
      // Create download link
      const link = document.createElement('a');
      link.href = `http://localhost:5000/uploads/${attachment.file_path}`;
      link.download = attachment.file_name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };
  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1040 }}
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        style={{ zIndex: 1050 }}
      >
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div 
            className="modal-content"
            style={{
              backgroundColor: isDark ? '#2d3748' : '#ffffff',
              borderColor: isDark ? '#718096' : '#e2e8f0',
              color: isDark ? '#ffffff' : '#000000'
            }}
          >
            {/* Header */}
            <div 
              className="modal-header"
              style={{
                backgroundColor: isDark ? '#4a5568' : '#f7fafc',
                borderColor: isDark ? '#718096' : '#e2e8f0'
              }}
            >
              <h5 className="modal-title">
                <i className="bi bi-file-earmark-text me-2"></i>
                Exam Request Details
              </h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={onClose}
                style={{
                  filter: isDark ? 'invert(1)' : 'none'
                }}
              ></button>
            </div>

            {/* Body */}
            <div className="modal-body">
              {/* Status & ID */}
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h6 className="mb-1">Request ID: #{request.exam_request_id}</h6>
                  <span className={`badge ${getExamTypeBadge(request.exam_type)} me-2`}>
                    {request.exam_type === 'makeup' ? 'Make-up Exam' : 'Resit Exam'}
                  </span>
                  <span className={`badge ${getStatusBadge(request.status)}`}>
                    {request.status}
                  </span>
                </div>
              </div>

              {/* Course Information */}
              <div className="card mb-3" style={{ backgroundColor: isDark ? '#4a5568' : '#f8f9fa' }}>
                <div className="card-body">
                  <h6 className="card-title mb-3">
                    <i className="bi bi-book me-2"></i>
                    Course Information
                  </h6>
                  <div className="row">
                    <div className="col-md-6 mb-2">
                      <strong>Course Code:</strong>
                      <br />
                      <span className={isDark ? 'text-light' : 'text-dark'}>
                        {request.course_code}
                      </span>
                    </div>
                    <div className="col-md-6 mb-2">
                      <strong>Course Name:</strong>
                      <br />
                      <span className={isDark ? 'text-light' : 'text-dark'}>
                        {request.course_name}
                      </span>
                    </div>
                    <div className="col-md-6 mb-2">
                      <strong>Instructor:</strong>
                      <br />
                      <span className={isDark ? 'text-light' : 'text-dark'}>
                        {request.instructor_name || 'Not specified'}
                      </span>
                    </div>
                    <div className="col-md-6 mb-2">
                      <strong>Original Exam Date:</strong>
                      <br />
                      <span className={isDark ? 'text-light' : 'text-dark'}>
                        {request.exam_date ? formatDate(request.exam_date) : 'Not specified'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div className="mb-3">
                <h6>
                  <i className="bi bi-chat-left-text me-2"></i>
                  Reason for Request
                </h6>
                <div 
                  className="p-3 rounded border"
                  style={{
                    backgroundColor: isDark ? '#4a5568' : '#f8f9fa',
                    borderColor: isDark ? '#718096' : '#e2e8f0',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.6'
                  }}
                >
                  {request.reason}
                </div>
              </div>

              {/* Faculty Info */}
              <div className="mb-3">
                <h6>
                  <i className="bi bi-building me-2"></i>
                  Faculty Information
                </h6>
                <div 
                  className="p-3 rounded border"
                  style={{
                    backgroundColor: isDark ? '#4a5568' : '#f8f9fa',
                    borderColor: isDark ? '#718096' : '#e2e8f0'
                  }}
                >
                  <div className="row">
                    <div className="col-md-6">
                      <strong>Faculty:</strong> {request.faculty_name_tr || request.faculty_name}
                    </div>
                    <div className="col-md-6">
                      <strong>Secretary:</strong> {request.secretary_email}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="mb-3">
                <h6>
                  <i className="bi bi-calendar-event me-2"></i>
                  Timeline
                </h6>
                <div 
                  className="p-3 rounded border"
                  style={{
                    backgroundColor: isDark ? '#4a5568' : '#f8f9fa',
                    borderColor: isDark ? '#718096' : '#e2e8f0'
                  }}
                >
                  <div className="row">
                    <div className="col-md-6 mb-2">
                      <strong>Submitted:</strong>
                      <br />
                      {formatDate(request.submitted_at)}
                    </div>
                    {request.processed_at && (
                      <div className="col-md-6 mb-2">
                        <strong>Processed:</strong>
                        <br />
                        {formatDate(request.processed_at)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Attachments */}
              {request.attachment_count > 0 && (
                <div className="mb-3">
                  <h6>
                    <i className="bi bi-paperclip me-2"></i>
                    Attachments ({request.attachment_count})
                  </h6>
                  
                  {loadingAttachments ? (
                    <div className="text-center py-3">
                      <div className="spinner-border spinner-border-sm text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="mt-2 small text-muted">Loading attachments...</p>
                    </div>
                  ) : attachments.length > 0 ? (
                    <div className="row">
                      {attachments.map((attachment) => (
                        <div key={attachment.attachment_id} className="col-md-6 mb-3">
                          <div 
                            className="card shadow-sm"
                            style={{
                              backgroundColor: isDark ? '#4a5568' : '#ffffff',
                              borderColor: isDark ? '#718096' : '#e2e8f0'
                            }}
                          >
                            <div className="card-body">
                              <div className="d-flex align-items-start">
                                <div className="me-3">
                                  <i 
                                    className={`${getFileIcon(attachment.file_type)}`}
                                    style={{ fontSize: '2.5rem' }}
                                  ></i>
                                </div>
                                <div className="flex-grow-1">
                                  <h6 
                                    className="card-title mb-2" 
                                    title={attachment.file_name}
                                    style={{ fontSize: '0.9rem' }}
                                  >
                                    {attachment.file_name.length > 25 
                                      ? attachment.file_name.substring(0, 25) + '...' 
                                      : attachment.file_name
                                    }
                                  </h6>
                                  <div className="small text-muted mb-3">
                                    <div>
                                      <i className="bi bi-hdd me-1"></i>
                                      <strong>Size:</strong> {formatFileSize(attachment.file_size)}
                                    </div>
                                    <div>
                                      <i className="bi bi-calendar me-1"></i>
                                      <strong>Uploaded:</strong> {new Date(attachment.uploaded_at).toLocaleDateString()}
                                    </div>
                                  </div>
                                  
                                  <div className="d-flex gap-2 flex-wrap">
                                    {canPreview(attachment.file_type) && (
                                      <button
                                        className="btn btn-outline-primary btn-sm"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          previewFileHandler(attachment);
                                        }}
                                      >
                                        <i className="bi bi-eye me-1"></i>
                                        Preview
                                      </button>
                                    )}

                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleDownload(attachment)}
                                    >
                                      <i className="bi bi-download me-1"></i>
                                      Download
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="alert alert-info py-2 mb-0">
                      <i className="bi bi-info-circle me-2"></i>
                      No attachments available
                    </div>
                  )}
                </div>
              )}

              {/* Secretary Notes */}
              {request.secretary_notes && (
                <div className="mb-3">
                  <h6>
                    <i className="bi bi-chat-right-text me-2"></i>
                    Secretary Notes
                  </h6>
                  <div 
                    className="p-3 rounded border"
                    style={{
                      backgroundColor: isDark ? '#4a5568' : '#e3f2fd',
                      borderColor: '#2196f3',
                      borderLeft: '4px solid #2196f3'
                    }}
                  >
                    {request.secretary_notes}
                  </div>
                </div>
              )}

              {/* Rejection Reason */}
              {request.rejection_reason && (
                <div className="mb-3">
                  <h6 className="text-danger">
                    <i className="bi bi-x-circle me-2"></i>
                    Rejection Reason
                  </h6>
                  <div 
                    className="alert alert-danger"
                    style={{
                      borderLeft: '4px solid #dc3545'
                    }}
                  >
                    {request.rejection_reason}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div 
              className="modal-footer"
              style={{
                backgroundColor: isDark ? '#4a5568' : '#f7fafc',
                borderColor: isDark ? '#718096' : '#e2e8f0'
              }}
            >
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ 
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0,0,0,0.9)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
            onClick={closePreview}
          >
            <div 
              className="bg-white rounded shadow-lg"
              style={{ 
                maxWidth: '98vw',
                width: '100%',
                maxHeight: '95vh',
                overflow: 'auto',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Preview Header */}
              <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                <h5 className="mb-0">
                  <i className="bi bi-eye me-2"></i>
                  {previewFile.name}
                </h5>
                <div className="d-flex gap-2">
                  <button 
                    className="btn btn-sm btn-outline-primary" 
                    onClick={() => handleDownload(previewFile.attachment)}
                  >
                    <i className="bi bi-download me-1"></i>
                    Download
                  </button>
                  <button 
                    className="btn btn-sm btn-outline-secondary" 
                    onClick={closePreview}
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              </div>
              
              {/* Preview Content */}
              <div className="p-3" style={{ textAlign: 'center' }}>
                {previewFile.type.includes('image') && (
                  <img 
                    src={previewFile.url} 
                    alt={previewFile.name}
                    style={{ 
                      maxWidth: '100%',
                      maxHeight: '80vh',
                      objectFit: 'contain',
                      borderRadius: '4px'
                    }}
                  />
                )}
                
                {previewFile.type.includes('pdf') && (
                  <embed
                    src={previewFile.url}
                    type="application/pdf"
                    width="100%"
                    height="80vh"
                    style={{ 
                      border: 'none',
                      borderRadius: '4px',
                      minHeight: '600px'
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default ExamRequestPage;