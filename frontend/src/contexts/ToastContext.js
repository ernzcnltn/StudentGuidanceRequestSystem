import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmation, setConfirmation] = useState(null);

  const showToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };
    
    setToasts(prev => [...prev, toast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showSuccess = useCallback((message, duration = 4000) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message, duration = 6000) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  const showWarning = useCallback((message, duration = 5000) => {
    showToast(message, 'warning', duration);
  }, [showToast]);

  const showInfo = useCallback((message, duration = 4000) => {
    showToast(message, 'info', duration);
  }, [showToast]);

  // Confirmation Dialog
  const showConfirmation = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmation({
        ...options,
        onConfirm: () => {
          setConfirmation(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmation(null);
          resolve(false);
        }
      });
    });
  }, []);

  const value = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirmation
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      
      {/* Toast Container */}
      <div 
        style={{ 
          position: 'fixed', 
          top: '20px', 
          right: '20px', 
          zIndex: 1070,
          minWidth: '300px'
        }}
      >
        {toasts.map((toast) => (
          <ToastNotification
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Confirmation Modal */}
      {confirmation && (
        <ConfirmationModal
          {...confirmation}
        />
      )}
    </ToastContext.Provider>
  );
};

// Toast Notification Component
const ToastNotification = ({ toast, onClose }) => {
  const { message, type } = toast;

  const getToastClasses = () => {
    const baseClasses = 'toast show align-items-center border-0 mb-2';
    const typeClasses = {
      success: 'bg-danger text-white',
      error: 'bg-danger text-white',
      warning: 'bg-danger text-white',
      info: 'bg-danger text-white'
    };
    return `${baseClasses} ${typeClasses[type] || typeClasses.info}`;
  };

  const getIcon = () => {
    const icons = {
      success: '',
      error: '',
      warning: '',
      info: ''
    };
    return icons[type] || icons.info;
  };

  return (
    <div className={getToastClasses()} role="alert" style={{ minWidth: '300px' }}>
      <div className="d-flex">
        <div className="toast-body d-flex align-items-center">
          <span className="me-2" style={{ fontSize: '1.2rem' }}>
            {getIcon()}
          </span>
          <span>{message}</span>
        </div>
        <button 
          type="button" 
          className="btn-close btn-close-white me-2 m-auto" 
          onClick={onClose}
        ></button>
      </div>
    </div>
  );
};

// Confirmation Modal Component
const ConfirmationModal = ({ 
  title = 'Confirm Action', 
  message, 
  confirmText = 'OK', 
  cancelText = 'Cancel', 
  type = 'warning',
  onConfirm, 
  onCancel 
}) => {
  const getModalIcon = () => {
    const icons = {
      danger: '',
      warning: '',
      info: '',
      success: ''
    };
    return icons[type] || icons.warning;
  };

  const getButtonClass = () => {
    const classes = {
      danger: 'btn-danger',
      warning: 'btn-danger',
      info: 'btn-danger',
      success: 'btn-danger'
    };
    return classes[type] || classes.warning;
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="modal-backdrop fade show"
        style={{ zIndex: 1055 }}
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div 
        className="modal fade show d-block"
        style={{ zIndex: 1056 }}
        tabIndex="-1"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header border-0 pb-0">
              <h5 className="modal-title d-flex align-items-center">
                <span className="me-2" style={{ fontSize: '1.5rem' }}>
                  {getModalIcon()}
                </span>
                {title}
              </h5>
            </div>
            
            <div className="modal-body">
              <p className="mb-0">{message}</p>
            </div>
            
            <div className="modal-footer border-0 pt-0">
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