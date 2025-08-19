import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../hooks/useTranslation';

const AttachmentViewer = ({ requestId, onClose }) => {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();

  const fetchAttachments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getRequestAttachments(requestId);
      if (response.data.success) {
        setAttachments(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
      setError('Failed to load attachments');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const downloadFile = async (filename, originalName) => {
    try {
      setDownloading(filename);
      const response = await apiService.downloadAttachment(filename);
      
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = originalName || filename;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showSuccess(`File "${originalName}" downloaded successfully!`);
      
    } catch (error) {
      console.error('Error downloading file:', error);
      showError(`Failed to download file: ${error.response?.data?.error || error.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const previewFileHandler = async (filename, fileType, originalName) => {
    try {
      setPreviewLoading(true);
      console.log('Starting preview for:', filename, fileType);
      
      const response = await apiService.downloadAttachment(filename);
      console.log('API response received:', response);
      
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: fileType });
      const url = window.URL.createObjectURL(blob);
      
      console.log('Preview URL created:', url);
      
      setPreviewFile({
        url,
        type: fileType,
        name: originalName,
        filename
      });
      
    } catch (error) {
      console.error('Error previewing file:', error);
      showError(`Failed to preview file: ${error.response?.data?.error || error.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = useCallback(() => {
    console.log('Closing preview');
    if (previewFile) {
      window.URL.revokeObjectURL(previewFile.url);
      setPreviewFile(null);
    }
  }, [previewFile]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('csv') || fileType.includes('excel')) return '📊';
    return '📎';
  };

  const canPreview = (fileType) => {
    return fileType.includes('image') || fileType.includes('pdf') || fileType.includes('text');
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handlePreviewBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      closePreview();
    }
  };

  // Prevent body scroll when preview is open
  useEffect(() => {
    if (previewFile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [previewFile]);

  const renderPreview = () => {
    if (!previewFile) return null;

    const { url, type, name } = previewFile;
    console.log('Rendering preview for:', name, type);

    return (
      <div 
        className="modal-backdrop fade show" 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.9)',
          zIndex: 99999, // Much higher than main modal
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
           opacity: 1, 
            filter: 'none',
           backdropFilter: 'none' 
          

        }}
        onClick={handlePreviewBackdropClick}
      >
        <div 
          className="bg-white rounded shadow-lg"
          style={{ 
            maxWidth: '95vw',
            maxHeight: '95vh',
            overflow: 'auto',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
            <h5 className="mb-0 d-flex align-items-center">
              <span className="me-2">📁</span>
              <span title={name}>{name}</span>
            </h5>
            <div className="d-flex gap-2">
              <button 
                className="btn btn-sm btn-outline-primary" 
                onClick={() => downloadFile(previewFile.filename, name)}
                title="Download"
              >
                📥 Download
              </button>
              <button 
                className="btn btn-sm btn-outline-secondary" 
                onClick={closePreview}
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-3" style={{ textAlign: 'center' }}>
            {type.includes('image') && (
              <img 
                src={url} 
                alt={name}
                style={{ 
                  maxWidth: '100%',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                  borderRadius: '4px',
                  backgroundColor: '#fff'
                }}
                onLoad={() => console.log('Image loaded successfully')}
                onError={(e) => {
                  console.error('Image failed to load:', e);
                  showError('Failed to load image preview');
                }}
              />
            )}
            
            {type.includes('pdf') && (
              <embed
                src={url}
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
            
            {type.includes('text') && (
              <div style={{ 
                maxHeight: '80vh', 
                overflow: 'auto',
                textAlign: 'left',
                backgroundColor: '#f8f9fa',
                padding: '20px',
                borderRadius: '4px',
                fontFamily: 'monospace'
              }}>
                <iframe
                  src={url}
                  width="100%"
                  height="600px"
                  style={{ border: 'none' }}
                  title={`Preview of ${name}`}
                />
              </div>
            )}
            
            {!canPreview(type) && (
              <div className="alert alert-info">
                <h6>Preview Not Available</h6>
                <p>This file type cannot be previewed in the browser.</p>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => downloadFile(previewFile.filename, name)}
                >
                  📥 Download File
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Main Modal Backdrop */}
      {!previewFile && (
        <div 
          className="modal-backdrop fade show" 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1040
          }}
          onClick={handleBackdropClick}
        />
      )}

      {/* Main Modal */}
      <div 
        className="modal fade show d-block" 
        tabIndex="-1"
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: previewFile ? 9999 : 1050, // Lower z-index when preview is open
          overflow: 'auto'
        }}
        onClick={handleBackdropClick}
      >
        <div 
          className="modal-dialog modal-lg modal-dialog-scrollable"
          style={{
            margin: '3rem auto',
            maxWidth: '800px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                📎 {t('attachments')}
              </h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={onClose}
                aria-label={t('close')}
              />
            </div>
            
            <div className="modal-body">
              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">{t('loading')}</span>
                  </div>
                  <p className="mt-3">{t('loadingAttachments')}</p>
                </div>
              ) : error ? (
                <div className="alert alert-danger">
                  <h6>{t('failedToLoadAttachments')}</h6>
                  <p className="mb-0">{error}</p>
                </div>
              ) : attachments.length === 0 ? (
                <div className="text-center py-5">
                  <div className="text-muted">
                    <div style={{ fontSize: '4rem' }}>📂</div>
                    <h5 className="mt-3">{t('noAttachments')}</h5>
                    <p>{t('thisRequestHasNoFiles')}</p>
                  </div>
                </div>
              ) : (
                <div className="row">
                  {attachments.map((attachment) => (
                    <div key={attachment.attachment_id} className="col-md-6 mb-3">
                      <div className="card h-100 shadow-sm">
                        <div className="card-body">
                          <div className="d-flex align-items-start">
                            <div className="me-3">
                              <span style={{fontSize: '2.5rem'}}>
                                {getFileIcon(attachment.file_type)}
                              </span>
                            </div>
                            <div className="flex-grow-1">
                              <h6 className="card-title mb-2" title={attachment.file_name}>
                                {attachment.file_name.length > 25 
                                  ? attachment.file_name.substring(0, 25) + '...' 
                                  : attachment.file_name
                                }
                              </h6>
                              <div className="small text-muted mb-3">
                                <div><strong>{t('size')}:</strong> {formatFileSize(attachment.file_size)}</div>
                                <div><strong>{t('type')}:</strong> {attachment.file_type}</div>
                                <div><strong>{t('uploaded')}:</strong> {new Date(attachment.uploaded_at).toLocaleDateString()}</div>
                              </div>
                              
                              <div className="d-flex gap-2 flex-wrap">
                                {canPreview(attachment.file_type) && (
                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log('Preview button clicked for:', attachment.file_name);
                                      previewFileHandler(attachment.file_path, attachment.file_type, attachment.file_name);
                                    }}
                                    disabled={previewLoading}
                                  >
                                    {previewLoading ? (
                                      <>
                                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                        {t('loading')}...
                                      </>
                                    ) : (
                                      <>
                                         {t('preview')}
                                      </>
                                    )}
                                  </button>
                                )}

                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => downloadFile(attachment.file_path, attachment.file_name)}
                                  disabled={downloading === attachment.file_path}
                                >
                                  {downloading === attachment.file_path ? (
                                    <>
                                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                      {t('downloading')}...
                                    </>
                                  ) : (
                                    <>
                                       {t('download')}
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <div className="text-muted small me-auto">
                {attachments.length} {t('attachmentsFound')}
              </div>
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

      {/* File Preview Modal - Render AFTER main modal with highest z-index */}
      {previewFile && renderPreview()}
    </>
  );
};

export default AttachmentViewer;