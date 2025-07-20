import React, { useState } from 'react';
import { apiService } from '../services/api';

const FileUpload = ({ requestId, onUploadComplete }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    if (selectedFiles.length > 3) {
      setError('Maximum 3 files allowed');
      return;
    }
    
    setFiles(selectedFiles);
    setError(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      await apiService.uploadFiles(requestId, formData);
      setSuccess(true);
      setFiles([]);
      
      if (onUploadComplete) {
        setTimeout(() => {
          onUploadComplete();
        }, 1000);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h6 className="mb-0">Upload Required Documents</h6>
      </div>
      <div className="card-body">
        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}
        
        {success && (
          <div className="alert alert-success">
            Files uploaded successfully! Redirecting...
          </div>
        )}
        
        <div className="mb-3">
          <input
            type="file"
            className="form-control"
            multiple
            accept=".jpeg,.jpg,.png,.pdf,.doc,.docx,.csv"
            onChange={handleFileChange}
            disabled={uploading || success}
          />
          <div className="form-text">
            <strong>Allowed:</strong> JPEG, JPG, PNG, PDF, DOC, DOCX, CSV (Max: 3 files, 2MB each)
          </div>
        </div>

        {files.length > 0 && !success && (
          <div className="mb-3">
            <strong>Selected Files:</strong>
            <ul className="list-unstyled mt-2">
              {files.map((file, index) => (
                <li key={index} className="small text-muted">
                  • {file.name} ({Math.round(file.size/1024)} KB)
                </li>
              ))}
            </ul>
          </div>
        )}

        {!success && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
          >
            {uploading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Uploading...
              </>
            ) : (
              'Upload Files'
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default FileUpload;