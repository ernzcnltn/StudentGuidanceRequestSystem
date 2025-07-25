// DarkModeToggle.js içinde:

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation'; // BUNU EKLEYİN

const DarkModeToggle = () => {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation(); // BUNU EKLEYİN

  return (
    <button
      className={`btn theme-toggle ${isDark ? 'btn-light' : 'btn-dark'}`}
      onClick={toggleTheme}
      title={isDark ? t('switchToLightMode') : t('switchToDarkMode')}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1030,
        borderRadius: '50%',
        width: '60px',
        height: '60px',
        fontSize: '1.5rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.3s ease'
      }}
      onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
};

export default DarkModeToggle;