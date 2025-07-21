// frontend/src/components/FIULogo.js
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
      style={{ 
        ...sizeStyles, 
        ...style 
      }}
    >
      {/* Final International University Logo - Gerçek Tasarım */}
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 120 120" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Ana Daire */}
        <circle 
          cx="60" 
          cy="60" 
          r="55" 
          fill="#dc2626" 
          stroke="#b91c1c" 
          strokeWidth="2"
        />
        
        {/* İç Beyaz Daire */}
        <circle 
          cx="60" 
          cy="60" 
          r="45" 
          fill="white"
        />
        
        {/* FIU Harfleri - Büyük ve Bold */}
        <g fill="#dc2626" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900">
          {/* F Harfi */}
          <text 
            x="35" 
            y="55" 
            fontSize="24" 
            textAnchor="middle"
            dominantBaseline="middle"
          >
            F
          </text>
          
          {/* I Harfi */}
          <text 
            x="60" 
            y="55" 
            fontSize="24" 
            textAnchor="middle"
            dominantBaseline="middle"
          >
            I
          </text>
          
          {/* U Harfi */}
          <text 
            x="85" 
            y="55" 
            fontSize="24" 
            textAnchor="middle"
            dominantBaseline="middle"
          >
            U
          </text>
        </g>
        
        {/* Alt Çizgi */}
        <line 
          x1="25" 
          y1="70" 
          x2="95" 
          y2="70" 
          stroke="#dc2626" 
          strokeWidth="3"
        />
        
        {/* UNIVERSITY Yazısı */}
        <text 
          x="60" 
          y="85" 
          fontSize="9" 
          textAnchor="middle" 
          fill="#dc2626"
          fontFamily="Arial, sans-serif"
          fontWeight="bold"
          letterSpacing="1px"
        >
          UNIVERSITY
        </text>
        
        {/* Dekoratif Yıldızlar */}
        <g fill="#dc2626">
          {/* Sol Yıldız */}
          <polygon 
            points="20,30 22,36 28,36 23,40 25,46 20,42 15,46 17,40 12,36 18,36" 
            transform="scale(0.6)"
          />
          
          {/* Sağ Yıldız */}
          <polygon 
            points="100,30 102,36 108,36 103,40 105,46 100,42 95,46 97,40 92,36 98,36" 
            transform="scale(0.6)"
          />
        </g>
      </svg>
    </div>
  );
};

export default FIULogo;