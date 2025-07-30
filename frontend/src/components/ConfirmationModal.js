import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ConfirmationModal = ({ 
  show, 
  title, 
  message, 
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger', // danger, warning, info, success
  onConfirm, 
  onCancel,
  requireTextConfirmation = false,
  confirmationText = 'DELETE',
  children 
}) => {
  const { isDark } = useTheme();
  const [inputValue, setInputValue] = useState('');
  const [isConfirmDisabled, setIsConfirmDisabled] = useState(requireTextConfirmation);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    setIsConfirmDisabled(requireTextConfirmation && value !== confirmationText);
  };

  const handleConfirm = () => {
    if (requireTextConfirmation && inputValue !== confirmationText) {
      return;
    }
    onConfirm();
  };

  const getTypeStyles = () => {
    const styles = {
      danger: {
        headerBg: 'bg-danger',
        confirmBtn: 'btn-danger',
        icon: '⚠️'
      },
      warning: {
        headerBg: 'bg-warning',
        confirmBtn: 'btn-warning',
        icon: '⚠️'
      },
      info: {
        headerBg: 'bg-info',
        confirmBtn: 'btn-info',
        icon: 'ℹ️'
      },
      success: {
        headerBg: 'bg-success',
        confirmBtn: 'btn-success',
        icon: '✅'
      }
    };
    return styles[type] || styles.danger;
  };

  const typeStyles = getTypeStyles();

  if (!show) return null;

  return (
    <div 
      className="modal show d-block" 
      style={{ 
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 9999 
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div 
          className="modal-content border-0 shadow-lg"
          style={{
            backgroundColor: isDark ? '#000000' : '#ffffff',
            color: isDark ? '#ffffff' : '#000000',
            borderRadius: '12px'
          }}
        >
          {/* Header */}
          <div 
            className={`modal-header ${typeStyles.headerBg} text-white border-0`}
            style={{ borderRadius: '12px 12px 0 0' }}
          >
            <h5 className="modal-title d-flex align-items-center">
              <span className="me-2" style={{ fontSize: '1.2rem' }}>
                {typeStyles.icon}
              </span>
              {title}
            </h5>
            <button 
              type="button" 
              className="btn-close btn-close-white"
              onClick={onCancel}
            ></button>
          </div>

          {/* Body */}
          <div className="modal-body p-4">
            {typeof message === 'string' ? (
              <div 
                className={`mb-3 ${isDark ? 'text-light' : 'text-dark'}`}
                style={{ fontSize: '1.1rem', lineHeight: '1.6' }}
              >
                {message.split('\n').map((line, index) => (
                  <div key={index}>
                    {line}
                    {index < message.split('\n').length - 1 && <br />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-3">{message}</div>
            )}

            {children && (
              <div className="mb-3">{children}</div>
            )}

            {requireTextConfirmation && (
              <div className="mt-4">
                <label 
                  className={`form-label fw-bold ${isDark ? 'text-light' : 'text-dark'}`}
                >
                  Type "{confirmationText}" to confirm:
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder={`Type ${confirmationText} here`}
                  autoComplete="off"
                  style={{
                    backgroundColor: isDark ? '#111111' : '#ffffff',
                    borderColor: isDark ? '#333333' : '#ced4da',
                    color: isDark ? '#ffffff' : '#000000'
                  }}
                />
                {inputValue && inputValue !== confirmationText && (
                  <small className="text-danger mt-1 d-block">
                    Text does not match. Please type exactly: {confirmationText}
                  </small>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div 
            className="modal-footer border-0 p-4"
            style={{
              backgroundColor: isDark ? '#111111' : '#f8f9fa',
              borderRadius: '0 0 12px 12px'
            }}
          >
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={onCancel}
              style={{ borderRadius: '8px' }}
            >
              {cancelText}
            </button>
            <button 
              type="button" 
              className={`btn ${typeStyles.confirmBtn}`}
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              style={{ borderRadius: '8px' }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;