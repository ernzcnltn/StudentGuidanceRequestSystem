import React from 'react';

const ConfirmDialog = ({ 
  show, 
  title = 'Confirm Action', 
  message = 'Are you sure?', 
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm, 
  onCancel,
  type = 'danger'
}) => {
  if (!show) return null;

  const getButtonClass = () => {
    const classes = {
      danger: 'btn-danger',
      warning: 'btn-warning',
      success: 'btn-success',
      primary: 'btn-primary'
    };
    return classes[type] || classes.danger;
  };

  const getIcon = () => {
    const icons = {
      danger: '⚠️',
      warning: '⚠️',
      success: '✅',
      primary: 'ℹ️'
    };
    return icons[type] || icons.danger;
  };

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
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title d-flex align-items-center">
                <span className="me-2">{getIcon()}</span>
                {title}
              </h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={onCancel}
              ></button>
            </div>
            
            <div className="modal-body">
              <p className="mb-0">{message}</p>
            </div>
            
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onCancel}
              >
                {cancelText}
              </button>
              <button 
                type="button" 
                className={`btn ${getButtonClass()}`}
                onClick={onConfirm}
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

export default ConfirmDialog;