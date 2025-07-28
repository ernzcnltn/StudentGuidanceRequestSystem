
import React from 'react';

const FIULogo = ({ size = 'xl', className = '', style = {} }) => {
  const getSizeStyles = () => {
    const sizes = {
      xs: { width: '32px', height: '32px' },
      sm: { width: '42px', height: '42px' },
      md: { width: '52px', height: '52px' },
      lg: { width: '72px', height: '72px' },
      xl: { width: '250px', height: '250px' }
    };
    return sizes[size] || sizes.xl;
  };

  const sizeStyles = getSizeStyles();

  return (
    <div
      className={`d-inline-flex align-items-center justify-content-center ${className}`}
      style={{ ...sizeStyles, ...style }}
    >
      <img
        src="/images/fiu-logo.png "
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
