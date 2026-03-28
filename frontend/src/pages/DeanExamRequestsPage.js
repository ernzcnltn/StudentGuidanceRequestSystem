import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useTranslation } from '../hooks/useTranslation'; // YENİ

const DeanExamRequestsPage = () => {
  const { admin } = useAdminAuth();
  const { showSuccess, showError } = useToast();
  const { isDark } = useTheme();
  const { t } = useTranslation(); // YENİ

  const [examRequests, setExamRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    loadExamRequests();
  }, []);

  const loadExamRequests = async () => {
    try {
      setLoading(true);
      const response = await apiService.getDeanExamRequests();
      if (response.data.success) {
        setExamRequests(response.data.data);
      }
    } catch (error) {
      console.error('Error loading approved exam requests:', error);
      showError(t('failedToLoadApprovedExamRequests'));
    } finally {
      setLoading(false);
    }
  };

  const loadAttachments = async (requestId) => {
    try {
      setLoadingAttachments(true);
      const response = await apiService.getDeanExamRequestAttachments(requestId);
      if (response.data.success) {
        setAttachments(response.data.data);
      }
    } catch (error) {
      console.error('Error loading attachments:', error);
      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleViewDetails = async (request) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
    if (request.attachment_count > 0) {
      await loadAttachments(request.exam_request_id);
    }
  };

  const getExamTypeBadge = (examType) => {
    const badges = {
      'makeup': '',
      'resit': ''
    };
    return badges[examType] || 'info';
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('notAvailable');
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (fileName) => {
    if (!fileName) return 'bi-file-earmark-fill text-secondary';
    
    const ext = fileName.split('.').pop().toLowerCase();
    
    if (ext === 'pdf') return 'bi-file-pdf-fill text-danger';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'bi-file-image-fill text-primary';
    if (['doc', 'docx'].includes(ext)) return 'bi-file-word-fill text-primary';
    return 'bi-file-earmark-fill text-secondary';
  };

  const handleDownloadAttachment = (attachment) => {
    const link = document.createElement('a');
    link.href = `http://localhost:5000/uploads/${attachment.file_path}`;
    link.download = attachment.file_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreviewAttachment = async (attachment) => {
    try {
      console.log('Starting preview for:', attachment.file_name);
      
      if (!attachment.file_path) {
        showError(t('filePathNotFound'));
        return;
      }
      
      const response = await fetch(`http://localhost:5000/uploads/${attachment.file_path}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      setPreviewFile({
        url,
        type: blob.type || attachment.file_type || 'application/octet-stream',
        name: attachment.file_name || t('unknownFile'),
        attachment
      });
    } catch (error) {
      console.error('Error previewing file:', error);
      showError(t('failedToPreviewFile'));
    }
  };

  const closePreview = () => {
    if (previewFile) {
      window.URL.revokeObjectURL(previewFile.url);
      setPreviewFile(null);
    }
  };

  const canPreview = (fileType, fileName) => {
    if (fileType && typeof fileType === 'string') {
      if (fileType.includes('image') || fileType.includes('pdf')) {
        return true;
      }
    }
    
    if (fileName && typeof fileName === 'string') {
      const ext = fileName.split('.').pop().toLowerCase();
      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'].includes(ext);
    }
    
    return false;
  };

  // Faculty filtering
  const filteredRequests = examRequests.filter(request => {
    if (activeTab === 'all') return true;
    // Faculty bazlı filtreleme için tab'lar eklenebilir
    return true;
  });

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">{t('loading')}</span>
        </div>
        <p className="mt-3">{t('loadingApprovedExamRequests')}</p>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      <div className="row mb-4">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2>
                <i className="bi bi-check-circle me-2 text-success"></i>
                {t('approvedExamRequests')}
              </h2>
              <p className={isDark ? 'text-light' : 'text-muted'}>
                {t('deanViewAllFaculties')} 
              </p>
            </div>
            <button 
              className="btn btn-outline-primary"
              onClick={() => loadExamRequests()}
            >
              <i className="bi bi-arrow-clockwise me-2"></i>
              {t('refresh')}
            </button>
          </div>
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="card" style={{ backgroundColor: isDark ? '#2d3748' : '#ffffff' }}>
          <div className="card-body text-center py-5">
            <i className="bi bi-inbox" style={{ fontSize: '4rem', color: '#6c757d' }}></i>
            <h4 className="mt-3">{t('noApprovedExamRequests')}</h4>
            <p className="text-muted">
              {t('noApprovedExamRequestsAtThisTime')}
            </p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ backgroundColor: isDark ? '#2d3748' : '#ffffff' }}>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead style={{ backgroundColor: isDark ? '#4a5568' : '#f8f9fa' }}>
                  <tr>
                    <th>{t('requestId')}</th>
                    <th>{t('student')}</th>
                    <th>{t('faculty')}</th>
                    <th>{t('type')}</th>
                    <th>{t('course')}</th>
                    <th>{t('instructor')}</th>
                    <th>{t('submitted')}</th>
                    <th>{t('approvedBy')}</th>
                    <th>{t('approvedAt')}</th>
                    <th>{t('attachments')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.exam_request_id}>
                      <td>#{request.exam_request_id}</td>
                      <td>
                        <div>
                          <strong>{request.student_name}</strong>
                          <br />
                          <small className="text-muted">{request.student_number}</small>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-info">
                          {request.faculty_name_tr || request.faculty_name}
                        </span>
                      </td>
                      <td>
                        <span className={`${getExamTypeBadge(request.exam_type)}`}>
                          {request.exam_type === 'makeup' ? t('makeUpExam') : t('resitExam')}
                        </span>
                      </td>
                      <td>
                        <div>
                          <strong>{request.course_code}</strong>
                          <br />
                          <small>{request.course_name}</small>
                        </div>
                      </td>
                      <td>{request.instructor_name || t('notAvailable')}</td>
                      <td>{formatDate(request.submitted_at)}</td>
                      <td>
                        <small>{request.processed_by_name || t('notAvailable')}</small>
                      </td>
                      <td>{formatDate(request.processed_at)}</td>
                      <td className="text-center">
                        {request.attachment_count > 0 && (
                          <span className="badge bg-info">
                            <i className="bi bi-paperclip me-1"></i>
                            {request.attachment_count}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleViewDetails(request)}
                          title={t('viewDetails')}
                        >
                          <i className="bi bi-eye"></i> {t('view')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
        <>
          <div className="modal-backdrop fade show" onClick={() => setShowDetailModal(false)}></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div 
                className="modal-content"
                style={{
                  backgroundColor: isDark ? '#2d3748' : '#ffffff',
                  color: isDark ? '#ffffff' : '#000000'
                }}
              >
                <div 
                  className="modal-header"
                  style={{
                    backgroundColor: isDark ? '#4a5568' : '#f7fafc',
                    borderColor: isDark ? '#718096' : '#e2e8f0'
                  }}
                >
                  <h5 className="modal-title">
                    <i className="bi bi-file-earmark-text me-2"></i>
                    {t('examRequestDetails')} - #{selectedRequest.exam_request_id}
                  </h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setShowDetailModal(false)}
                    style={{ filter: isDark ? 'invert(1)' : 'none' }}
                  ></button>
                </div>

                <div className="modal-body">
                  <div className="mb-4">
                    <span className={`${getExamTypeBadge(selectedRequest.exam_type)} me-2`}>
                      {selectedRequest.exam_type === 'makeup' ? t('makeUpExam') : t('resitExam')}
                    </span>
                    <span className="badge bg-success">
                      {t('approved')}
                    </span>
                  </div>

                  <div className="card mb-3" style={{ backgroundColor: isDark ? '#4a5568' : '#f8f9fa' }}>
                    <div className="card-body">
                      <h6 className="card-title">
                        <i className="bi bi-person me-2"></i>
                        {t('studentInformation')}
                      </h6>
                      <div className="row">
                        <div className="col-md-6">
                          <strong>{t('name')}:</strong> {selectedRequest.student_name}
                        </div>
                        <div className="col-md-6">
                          <strong>{t('studentNumber')}:</strong> {selectedRequest.student_number}
                        </div>
                        <div className="col-md-6 mt-2">
                          <strong>{t('email')}:</strong> {selectedRequest.student_email}
                        </div>
                        <div className="col-md-6 mt-2">
                          <strong>{t('program')}:</strong> {selectedRequest.program}
                        </div>
                        <div className="col-md-6 mt-2">
                          <strong>{t('faculty')}:</strong> {selectedRequest.faculty_name_tr || selectedRequest.faculty_name}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card mb-3" style={{ backgroundColor: isDark ? '#4a5568' : '#f8f9fa' }}>
                    <div className="card-body">
                      <h6 className="card-title">
                        <i className="bi bi-book me-2"></i>
                        {t('courseInformation')}
                      </h6>
                      <div className="row">
                        <div className="col-md-6">
                          <strong>{t('courseCode')}:</strong> {selectedRequest.course_code}
                        </div>
                        <div className="col-md-6">
                          <strong>{t('courseName')}:</strong> {selectedRequest.course_name}
                        </div>
                        <div className="col-md-6 mt-2">
                          <strong>{t('instructor')}:</strong> {selectedRequest.instructor_name || t('notSpecified')}
                        </div>
                        {selectedRequest.exam_date && (
                          <div className="col-md-6 mt-2">
                            <strong>{t('examDate')}:</strong> {formatDate(selectedRequest.exam_date)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <h6>
                      <i className="bi bi-chat-left-text me-2"></i>
                      {t('reasonForRequest')}
                    </h6>
                    <div 
                      className="p-3 rounded border"
                      style={{
                        backgroundColor: isDark ? '#4a5568' : '#f8f9fa',
                        borderColor: isDark ? '#718096' : '#e2e8f0',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {selectedRequest.reason}
                    </div>
                  </div>

                  {selectedRequest.attachment_count > 0 && (
                    <div className="mb-3">
                      <h6>
                        <i className="bi bi-paperclip me-2"></i>
                        {t('attachments')} ({selectedRequest.attachment_count})
                      </h6>
                      {loadingAttachments ? (
                        <div className="text-center py-3">
                          <div className="spinner-border spinner-border-sm" role="status"></div>
                          <p className="mt-2 small">{t('loadingAttachments')}</p>
                        </div>
                      ) : attachments.length > 0 ? (
                        <div className="list-group">
                          {attachments.map((attachment) => (
                            <div 
                              key={attachment.attachment_id}
                              className="list-group-item d-flex justify-content-between align-items-center"
                              style={{
                                backgroundColor: isDark ? '#4a5568' : '#ffffff',
                                borderColor: isDark ? '#718096' : '#e2e8f0'
                              }}
                            >
                              <div className="d-flex align-items-center">
                                <i className={`${getFileIcon(attachment.file_name)} me-3`} style={{ fontSize: '1.5rem' }}></i>
                                <div>
                                  <div className="fw-bold">{attachment.file_name}</div>
                                  <small className="text-muted">
                                    {formatDate(attachment.uploaded_at)}
                                  </small>
                                </div>
                              </div>
                              <div className="btn-group">
                                {canPreview(attachment.file_type, attachment.file_name) && (
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => handlePreviewAttachment(attachment)}
                                    title={t('preview')}
                                  >
                                    <i className="bi bi-eye"></i>
                                  </button>
                                )}
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => handleDownloadAttachment(attachment)}
                                  title={t('download')}
                                >
                                  <i className="bi bi-download"></i>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted">{t('noAttachmentsFound')}</p>
                      )}
                    </div>
                  )}

                  {selectedRequest.secretary_notes && (
                    <div className="alert alert-info">
                      <h6><i className="bi bi-chat-right-text me-2"></i>{t('secretaryNotes')}</h6>
                      <p className="mb-0">{selectedRequest.secretary_notes}</p>
                    </div>
                  )}



{selectedRequest.processed_by && (
  <div className="text-muted small">
    <i className="bi bi-info-circle me-1"></i>
    <strong>{t('approvedBy')}:</strong> {selectedRequest.processed_by_name || t('notAvailable')}
    {' | '}
    <strong>{t('approvedAt')}:</strong> {formatDate(selectedRequest.processed_at)}
  </div>
)}

 </div>

                <div 
                  className="modal-footer"
                  style={{
                    backgroundColor: isDark ? '#4a5568' : '#f7fafc',
                    borderColor: isDark ? '#718096' : '#e2e8f0'
                  }}
                >
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>
                    {t('close')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

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
              <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                <h5 className="mb-0">
                  <i className="bi bi-eye me-2"></i>
                  {previewFile.name}
                </h5>
                <div className="d-flex gap-2">
                  <button 
                    className="btn btn-sm btn-outline-primary" 
                    onClick={() => handleDownloadAttachment(previewFile.attachment)}
                  >
                    <i className="bi bi-download me-1"></i>
                    {t('download')}
                  </button>
                  <button 
                    className="btn btn-sm btn-outline-secondary" 
                    onClick={closePreview}
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
              </div>
              
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
    </div>
  );
};

export default DeanExamRequestsPage;