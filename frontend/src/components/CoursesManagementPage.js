import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';

const CoursesManagementPage = () => {
  const { showSuccess, showError, showInfo } = useToast();
  const { isDark } = useTheme();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState('add');
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAdminCourses();
      if (response.data.success) {
        setCourses(response.data.data);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
      showError('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
      ];
      if (!validTypes.includes(file.type)) {
        showError('Please select a valid Excel or CSV file');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showError('Please select a file');
      return;
    }

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('coursesFile', selectedFile);
      formData.append('mode', uploadMode);

      const response = await apiService.uploadCourses(formData);
      
      if (response.data.success) {
        showSuccess(
          `Courses uploaded! Added: ${response.data.stats.added}, Updated: ${response.data.stats.updated}`
        );
        setSelectedFile(null);
        document.getElementById('fileInput').value = '';
        loadCourses();
      }
    } catch (error) {
      console.error('Error uploading courses:', error);
      showError(error.response?.data?.error || 'Failed to upload courses');
    } finally {
      setUploading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await apiService.exportCourses();
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `courses-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      showSuccess('Courses exported successfully');
    } catch (error) {
      console.error('Error exporting courses:', error);
      showError('Failed to export courses');
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await apiService.downloadCoursesTemplate();
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'courses-template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      showInfo('Template downloaded');
    } catch (error) {
      console.error('Error downloading template:', error);
      showError('Failed to download template');
    }
  };

  return (
    <div className="container-fluid mt-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <h2>
            <i className="bi bi-book me-2"></i>
            Courses Management
          </h2>
          <p className="text-muted">
            Upload and manage all courses across departments
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="card mb-4" style={{
        backgroundColor: isDark ? '#2d3748' : '#ffffff'
      }}>
        <div className="card-header">
          <h5 className="mb-0">
            <i className="bi bi-upload me-2"></i>
            Upload Courses
          </h5>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label fw-bold">Upload Mode</label>
                <select 
                  className="form-select"
                  value={uploadMode}
                  onChange={(e) => setUploadMode(e.target.value)}
                  style={{
                    backgroundColor: isDark ? '#1a202c' : '#ffffff',
                    color: isDark ? '#ffffff' : '#000000'
                  }}
                >
                  <option value="add">Add New / Update Existing</option>
                  <option value="replace">Replace All Courses</option>
                </select>
                <small className="text-muted">
                  {uploadMode === 'add' 
                    ? 'Adds new courses and updates existing ones' 
                    : '⚠️ WARNING: This will deactivate all existing courses'}
                </small>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">Select Excel/CSV File</label>
                <input
                  type="file"
                  id="fileInput"
                  className="form-control"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  style={{
                    backgroundColor: isDark ? '#1a202c' : '#ffffff',
                    color: isDark ? '#ffffff' : '#000000'
                  }}
                />
                {selectedFile && (
                  <div className="mt-2">
                    <i className="bi bi-file-earmark-excel text-success me-2"></i>
                    {selectedFile.name}
                  </div>
                )}
              </div>

              <div className="d-flex gap-2">
                <button
                  className="btn btn-danger"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-upload me-2"></i>
                      Upload Courses
                    </>
                  )}
                </button>

                <button
                  className="btn btn-outline-secondary"
                  onClick={downloadTemplate}
                >
                  <i className="bi bi-download me-2"></i>
                  Download Template
                </button>
              </div>
            </div>

            <div className="col-md-6">
              <div className="alert alert-info">
                <h6><i className="bi bi-info-circle me-2"></i>Excel Format</h6>
                <p className="mb-2">Your Excel file must have these columns:</p>
                <ul className="mb-0">
                  <li><strong>course_code</strong> (required)</li>
                  <li><strong>course_name</strong> (required)</li>
                  <li><strong>instructor_name</strong> (required)</li>
                  <li><strong>faculty</strong> (required)</li>
                  <li><strong>department</strong> (optional)</li>
                  <li><strong>semester</strong> (optional)</li>
                  <li><strong>credits</strong> (optional)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Courses Table */}
      <div className="card" style={{
        backgroundColor: isDark ? '#2d3748' : '#ffffff'
      }}>
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">All Courses ({courses.length})</h5>
          <button
            className="btn btn-outline-success btn-sm"
            onClick={handleExport}
          >
            <i className="bi bi-download me-2"></i>
            Export to Excel
          </button>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-danger"></div>
              <p className="mt-2">Loading courses...</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead style={{ backgroundColor: isDark ? '#4a5568' : '#f8f9fa' }}>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Instructor</th>
                    <th>Faculty</th>
                    <th>Department</th>
                    <th>Semester</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.course_id} className={isDark ? 'text-light' : ''}>
                      <td><strong>{course.course_code}</strong></td>
                      <td>{course.course_name}</td>
                      <td>{course.instructor_name}</td>
                      <td>{course.faculty}</td>
                      <td>{course.department || '-'}</td>
                      <td>{course.semester || '-'}</td>
                      <td>
                        <span className={`badge ${course.is_active ? 'bg-success' : 'bg-secondary'}`}>
                          {course.is_active ? 'Active' : 'Inactive'}
                        </span>
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
  );
};

export default CoursesManagementPage;