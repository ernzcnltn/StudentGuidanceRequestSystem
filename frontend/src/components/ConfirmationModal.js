// frontend/src/components/ConfirmationModal.js
import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

const ConfirmationModal = ({ 
  show, 
  title, 
  message, 
  confirmText = 'Tamam',
  cancelText = 'İptal',
  onConfirm, 
  onCancel,
  type = 'warning' // warning, danger, info, success
}) => {
  const { t } = useTranslation();

  if (!show) return null;

  const getIconAndColor = () => {
    switch(type) {
      case 'danger':
        return { icon: '⚠️', headerClass: 'bg-danger', textClass: 'text-danger' };
      case 'warning':
        return { icon: '❓', headerClass: 'bg-warning', textClass: 'text-warning' };
      case 'info':
        return { icon: 'ℹ️', headerClass: 'bg-info', textClass: 'text-info' };
      case 'success':
        return { icon: '✅', headerClass: 'bg-success', textClass: 'text-success' };
      default:
        return { icon: '❓', headerClass: 'bg-warning', textClass: 'text-warning' };
    }
  };

  const { icon, headerClass, textClass } = getIconAndColor();

  return (
    <>
      {/* Backdrop */}
      <div 
        className="modal-backdrop fade show" 
        style={{ zIndex: 1040 }}
        onClick={onCancel}
      ></div>

      {/* Modal */}
      <div 
        className="modal fade show d-block" 
        tabIndex="-1"
        style={{ zIndex: 1050 }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
            {/* Header */}
            <div className={`modal-header ${headerClass} text-white`} style={{ borderRadius: '12px 12px 0 0' }}>
              <h5 className="modal-title d-flex align-items-center">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>{icon}</span>
                {title}
              </h5>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={onCancel}
              ></button>
            </div>
            
            {/* Body */}
            <div className="modal-body py-4">
              <div className="text-center">
                <div className={`mb-3 ${textClass}`} style={{ fontSize: '3rem' }}>
                  {icon}
                </div>
                <h6 className="mb-3">{message}</h6>
                <p className="text-muted small mb-0">
                  Bu işlemi onaylamak istediğinizden emin misiniz?
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="modal-footer border-0 justify-content-center">
              <button 
                type="button" 
                className="btn btn-outline-secondary px-4"
                onClick={onCancel}
                style={{ borderRadius: '25px' }}
              >
                {cancelText}
              </button>
              <button 
                type="button" 
                className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'} px-4 ms-3`}
                onClick={onConfirm}
                style={{ borderRadius: '25px' }}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmationModal;