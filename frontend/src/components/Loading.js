import React from 'react';

const Loading = ({ 
  size = 'md', 
  text = 'Loading...', 
  overlay = false, 
  color = 'primary' 
}) => {
  const getSizeClass = () => {
    const sizes = {
      sm: 'spinner-border-sm',
      md: '',
      lg: 'spinner-border-lg'
    };
    return sizes[size] || sizes.md;
  };

  const getColorClass = () => {
    return `text-${color}`;
  };

  const LoadingSpinner = () => (
    <div className="d-flex flex-column align-items-center justify-content-center">
      <div className={`spinner-border ${getSizeClass()} ${getColorClass()}`} role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      {text && (
        <p className="mt-3 text-muted">{text}</p>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div 
        className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.5)', 
          zIndex: 1050 
        }}
      >
        <div className="bg-white p-4 rounded shadow">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return <LoadingSpinner />;
};

export default Loading;