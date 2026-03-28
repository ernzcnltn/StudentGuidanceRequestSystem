import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';

const CoursesManagementPage = () => {
  const { showSuccess, showError, showInfo } = useToast();
  const { isDark } = useTheme();
  const { t  } = useTranslation();

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
      showError(t('failedToLoadCourses'));
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
        showError(t('pleaseSelectValidExcelOrCSV'));
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showError(t('pleaseSelectFile'));
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
          `${t('coursesUploaded')} ${t('added')}: ${response.data.stats.added}, ${t('updated')}: ${response.data.stats.updated}`
        );
        setSelectedFile(null);
        document.getElementById('fileInput').value = '';
        loadCourses();
      }
    } catch (error) {
      console.error('Error uploading courses:', error);
      showError(error.response?.data?.error || t('failedToUploadCourses'));
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
      
      showSuccess(t('coursesExportedSuccessfully'));
    } catch (error) {
      console.error('Error exporting courses:', error);
      showError(t('failedToExportCourses'));
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
      
      showInfo(t('templateDownloaded'));
    } catch (error) {
      console.error('Error downloading template:', error);
      showError(t('failedToDownloadTemplate'));
    }
  };

  return (
    <div className="container-fluid mt-4">
      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <h2>
            <i className="bi bi-book me-2"></i>
            {t('coursesManagement')}
          </h2>
          <p className="text-muted">
            {t('uploadAndManageAllCourses')}
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
            {t('uploadCourses')}
          </h5>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label fw-bold">{t('uploadMode')}</label>
                <select 
                  className="form-select"
                  value={uploadMode}
                  onChange={(e) => setUploadMode(e.target.value)}
                  style={{
                    backgroundColor: isDark ? '#1a202c' : '#ffffff',
                    color: isDark ? '#ffffff' : '#000000'
                  }}
                >
                  <option value="add">{t('addNewUpdateExisting')}</option>
                  <option value="replace">{t('replaceAllCourses')}</option>
                </select>
                <small className="text-muted">
                  {uploadMode === 'add' 
                    ? t('addsNewCoursesUpdatesExisting')
                    : t('warningDeactivatesAllExistingCourses')}
                </small>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">{t('selectExcelCSVFile')}</label>
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
                      {t('uploading')}...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-upload me-2"></i>
                      {t('uploadCourses')}
                    </>
                  )}
                </button>

                <button
                  className="btn btn-outline-secondary"
                  onClick={downloadTemplate}
                >
                  <i className="bi bi-download me-2"></i>
                  {t('downloadTemplate')}
                </button>
              </div>
            </div>

            <div className="col-md-6">
              <div className="alert alert-info">
                <h6><i className="bi bi-info-circle me-2"></i>{t('excelFormat')}</h6>
                <p className="mb-2">{t('excelFileMustHaveColumns')}:</p>
                <ul className="mb-0">
                  <li><strong>course_code</strong> ({t('required')})</li>
                  <li><strong>course_name</strong> ({t('required')})</li>
                  <li><strong>instructor_name</strong> ({t('required')})</li>
                  <li><strong>faculty</strong> ({t('required')})</li>
                  <li><strong>department</strong> ({t('optional')})</li>
                  <li><strong>semester</strong> ({t('optional')})</li>
                  <li><strong>credits</strong> ({t('optional')})</li>
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
          <h5 className="mb-0">{t('allCourses')} ({courses.length})</h5>
          <button
            className="btn btn-outline-success btn-sm"
            onClick={handleExport}
          >
            <i className="bi bi-download me-2"></i>
            {t('exportToExcel')}
          </button>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-danger"></div>
              <p className="mt-2">{t('loadingCourses')}...</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead style={{ backgroundColor: isDark ? '#4a5568' : '#f8f9fa' }}>
                  <tr>
                    <th>{t('code')}</th>
                    <th>{t('name')}</th>
                    <th>{t('instructor')}</th>
                    <th>{t('faculty')}</th>
                    <th>{t('department')}</th>
                    <th>{t('semester')}</th>
                    <th>{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.course_id} className={isDark ? 'text-light' : ''}>
                      <td><strong>{course.course_code}</strong></td>
                      <td>{course.course_name}</td>
                      <td>{course.instructor_name}</td>
                      <td>{t(course.faculty)}</td>
                      <td>{t(course.department || '-')}</td>
                      <td>{course.semester || '-'}</td>
                      <td>
                        <span className={`badge ${course.is_active ? 'bg-success' : 'bg-secondary'}`}>
                          {course.is_active ? t('active') : t('inactive')}
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