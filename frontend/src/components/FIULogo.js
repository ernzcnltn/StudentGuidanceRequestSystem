
import React from 'react';

const FIULogo = ({ size = 'md', className = '', style = {} }) => {
  const getSizeStyles = () => {
    const sizes = {
      xs: { width: '24px', height: '24px' },
      sm: { width: '32px', height: '32px' },
      md: { width: '40px', height: '40px' },
      lg: { width: '60px', height: '60px' },
      xl: { width: '80px', height: '80px' }
    };
    return sizes[size] || sizes.md;
  };

  const sizeStyles = getSizeStyles();

  return (
    <div
      className={`d-inline-flex align-items-center justify-content-center ${className}`}
      style={{ ...sizeStyles, ...style }}
    >
      <img
        src="/images/fiu-logo.jpg"
        alt="Final International University Logo"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
      />
    </div>
  );
};

export default FIULogo;
