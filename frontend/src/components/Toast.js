import React, { useState, useEffect } from 'react';

const Toast = ({ message, type = 'info', duration = 5000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Animation time
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getToastStyle = () => {
    const baseStyles = {
      info: 'bg-primary text-white',
      success: 'bg-success text-white',
      warning: 'bg-warning text-dark',
      error: 'bg-danger text-white'
    };
    return baseStyles[type] || baseStyles.info;
  };

  const getIcon = () => {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    return icons[type] || icons.info;
  };

  return (
    <div 
      className={`toast align-items-center border-0 ${getToastStyle()} ${isVisible ? 'show' : 'hide'}`}
      role="alert"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1060,
        minWidth: '300px',
        transition: 'all 0.3s ease',
        transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: isVisible ? 1 : 0
      }}
    >
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
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
        ></button>
      </div>
    </div>
  );
};

export default Toast;