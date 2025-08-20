import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../hooks/useTranslation';

const AdminResponseModal = ({ requestId, requestTitle, onClose, onResponseAdded }) => {
  const [responses, setResponses] = useState([]);
  const [newResponse, setNewResponse] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showSuccess, showError } = useToast();
  const { t, translateRequestType } = useTranslation();

  useEffect(() => {
    fetchResponses();
  }, [requestId]);

  const fetchResponses = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAdminRequestResponses(requestId);
      if (response.data.success) {
        setResponses(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching responses:', error);
      showError('Failed to load responses');
    } finally {
      setLoading(false);
    }
  };

  // İyileştirilmiş dosya ekleme fonksiyonu
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    // Mevcut dosya sayısını kontrol et
    const totalFiles = files.length + selectedFiles.length;
    
    if (totalFiles > 5) {
      showError(`Maximum 5 files allowed for admin response. You have ${files.length} files, trying to add ${selectedFiles.length} more.`);
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
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      const maxSize = 5 * 1024 * 1024; // 5MB for admin files
      
      if (!validTypes.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type`);
        return;
      }
      
      if (file.size > maxSize) {
        errors.push(`${file.name}: File too large (max 5MB)`);
        return;
      }
      
      validFiles.push(file);
    });
    
    if (errors.length > 0) {
      showError(`File validation failed: ${errors.join(', ')}`);
      e.target.value = '';
      return;
    }
    
    // Mevcut dosyalara yeni dosyaları ekle
    setFiles(prevFiles => [...prevFiles, ...validFiles]);
    
    // Input'u temizle ki aynı dosya tekrar seçilebilsin
    e.target.value = '';
    
    if (validFiles.length > 0) {
      showSuccess(`${validFiles.length} file(s) added successfully. Total: ${files.length + validFiles.length} files.`);
    }
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    showSuccess('File removed successfully');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return '';
    if (fileType.includes('image')) return '';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('csv') || fileType.includes('excel') || fileType.includes('sheet')) return '📊';
    return '';
  };

  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    
    if (!newResponse.trim()) {
      showError('Please enter a response');
      return;
    }
    
    try {
      setSubmitting(true);
      
      // First, create the response
      const responseData = await apiService.addAdminResponse(requestId, {
        response_content: newResponse.trim()
      });
      
      if (responseData.data.success && files.length > 0) {
        // If files are selected, upload them
        const responseId = responseData.data.data.response_id;
        
        try {
          const fileFormData = new FormData();
          files.forEach(file => {
            fileFormData.append('files', file);
          });
          
          // Upload files attached to the response
          await apiService.uploadAdminResponseFiles(responseId, fileFormData);
          showSuccess(`Response with ${files.length} file(s) added successfully`);
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          showSuccess('Response added successfully, but files could not be uploaded');
        }
      } else {
        showSuccess('Response added successfully');
      }
      
      setNewResponse('');
      setFiles([]);
      fetchResponses();
      
      if (onResponseAdded) {
        onResponseAdded();
      }
    } catch (error) {
      console.error('Error adding response:', error);
      showError('Failed to add response');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      {/* Modal Backdrop */}
      <div 
        className="modal-backdrop fade show" 
        style={{ zIndex: 1040 }}
        onClick={handleBackdropClick}
      ></div>

      {/* Modal */}
      <div 
        className="modal fade show d-block" 
        tabIndex="-1"
        style={{ zIndex: 1050 }}
      >
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">
                💬 {t('responseTo')}: {requestTitle}
              </h5>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={onClose}
              ></button>
            </div>
            
            <div className="modal-body">
              {/* Previous Responses */}
              <div className="mb-4">
                <h6> {t('previousResponses')} ({responses.length})</h6>
                {loading ? (
                  <div className="text-center py-3">
                    <div className="spinner-border spinner-border-sm" role="status"></div>
                    <span className="ms-2">{t('loadingResponses')}</span>
                  </div>
                ) : responses.length === 0 ? (
                  <div className="alert alert-info">
                    <small>ℹ️ {t('noPreviousResponses')}</small>
                  </div>
                ) : (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {responses.map((response) => (
                      <div key={response.response_id} className="card mb-2 shadow-sm">
                        <div className="card-body p-3">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <strong className="text-primary">
                               {response.created_by_admin}
                            </strong>
                            <small className="text-muted">
                               {new Date(response.created_at).toLocaleString()}
                            </small>
                          </div>
                          <p className="mb-2">{response.response_content}</p>
                          
                          {/* Response Files (if any) */}
                          {response.attachments && response.attachments.length > 0 && (
                            <div className="mt-2 p-2 bg-light rounded">
                              <small className="text-muted">📎 <strong>Attachments:</strong></small>
                              <div className="d-flex flex-wrap gap-1 mt-1">
                                {response.attachments.map((file, index) => (
                                  <span key={index} className="badge bg-secondary">
                                    {getFileIcon(file.file_type)} {file.file_name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <hr />

              {/* New Response Form */}
              <div>
                <h6> {t('addNewResponse')}</h6>
                <form onSubmit={handleSubmitResponse}>
                  <div className="mb-3">
                    <textarea
                      className="form-control"
                      rows="4"
                      value={newResponse}
                      onChange={(e) => setNewResponse(e.target.value)}
                      placeholder={t('enterResponsePlaceholder', 'Enter your response to the student...')}
                      disabled={submitting}
                      required
                    />
                    <div className="form-text">
                       {t('responseVisibilityNote', 'This response will be visible to the student and will mark the request as "Informed".')}
                    </div>
                  </div>
                  
                  {/* File Upload Section for Admin Response */}
                  <div className="mb-4">
                    <label className="form-label">
                      <strong>{t('attachFilesOptional')} </strong>
                    </label>
                    
                    <div className="border rounded p-3" style={{ backgroundColor: '#f8f9fa' }}>
                      {/* Hidden File Input */}
                      <input
                        type="file"
                        className="d-none"
                        id="admin-file-upload"
                        multiple
                        accept=".jpeg,.jpg,.png,.pdf,.doc,.docx,.csv,.xls,.xlsx"
                        onChange={handleFileChange}
                        disabled={submitting}
                      />
                      
                      {/* File Upload Area */}
                      <div className="row">
                        {/* Upload Button Section */}
                        <div className="col-md-4">
                          <div className="text-center">
                            <label 
                              htmlFor="admin-file-upload" 
                              className="btn btn-success d-flex flex-column align-items-center p-4 h-100"
                              style={{ 
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                opacity: submitting ? 0.6 : 1,
                                borderRadius: '12px',
                                border: 'none',
                                minHeight: '120px',
                                justifyContent: 'center'
                              }}
                            >
                              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
                                📁
                              </div>
                              <div className="fw-bold mb-1">
                                {t(files.length > 0 ? 'addMoreFiles' : 'chooseFiles')}
                              </div>
                              <small className="text-white-50">
                                {t('maxFileSizeAdmin', 'Max 5MB per file, up to 5 files')}
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
                              minHeight: '120px'
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.currentTarget.style.borderColor = '#198754';
                              e.currentTarget.style.backgroundColor = '#e8f5e8';
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
                              <div style={{ fontSize: '2rem', marginBottom: '10px' }}> </div>
                              <h6 className="mb-1">  {t('dragAndDropFiles', 'Drag and drop files here or click the button above to select files')} </h6>
                              <p className="mb-0 small">
                                {t('orClickToSelect', 'or click to select files')}
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
                              <strong>{t('allowed')} </strong> PDF, Images, DOC, CSV, Excel
                            </div>
                            <div className="text-end">
                              <span className={`badge ${files.length >= 5 ? 'bg-warning' : 'bg-success'}`}>
                                {files.length} / 5 {t('files')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Selected Files Display */}
                      {files.length > 0 && (
                        <div className="mt-4">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="mb-0">
                              {t('SelectedFiles')} ({files.length})
                            </h6>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => setFiles([])}
                              disabled={submitting}
                            >
                              🗑️ {t('clearAll')}
                            </button>
                          </div>
                          
                          <div className="row">
                            {files.map((file, index) => (
                              <div key={index} className="col-lg-6 mb-2">
                                <div className="card shadow-sm border-0" style={{ borderLeft: '4px solid #198754' }}>
                                  <div className="card-body p-3">
                                    <div className="d-flex align-items-center">
                                      <div className="me-3">
                                        <div 
                                          className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center"
                                          style={{ width: '40px', height: '40px', fontSize: '1.1rem' }}
                                        >
                                          {getFileIcon(file.type)}
                                        </div>
                                      </div>
                                      <div className="flex-grow-1">
                                        <h6 className="card-title mb-1" style={{ fontSize: '0.9rem' }}>
                                          {file.name.length > 20 
                                            ? file.name.substring(0, 20) + '...' 
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
                                              disabled={submitting}
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
                                        ✓ {t('readyToUpload')}
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
                  
                  <div className="d-flex gap-2">
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg"
                      disabled={submitting || !newResponse.trim()}
                    >
                      {submitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          {t('sending')}...
                        </>
                      ) : (
                        <>
                          📤 {t('sendResponse')}
                          {files.length > 0 && ` (${files.length} files)`}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        setNewResponse('');
                        setFiles([]);
                      }}
                      disabled={submitting}
                    >
                      🔄 {t('Clear Form')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            
            <div className="modal-footer bg-light">
              <div className="d-flex justify-content-between align-items-center w-100">
                <small className="text-muted">

                </small>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={onClose}
                >
                  {t('close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminResponseModal;