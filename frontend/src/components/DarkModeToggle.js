// DarkModeToggle.js - Bootstrap Icons versiyonu:

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';

const DarkModeToggle = () => {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();

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
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none'
      }}
      onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
      onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
    >
      {/* EMOJİ YERİNE BOOTSTRAP ICONS */}
      <i 
        className={`bi ${isDark ? 'bi-brightness-high-fill rotate-sun' : 'bi-moon-stars-fill fade-moon'}`}
        style={{ fontSize: '1.4rem', transition: 'transform 0.3s ease' }}
      ></i>
    </button>
  );
};

export default DarkModeToggle;

// ALTERNATIF GÜZEL VERSİYONLAR:

// Versiyon 1 - Basit ve şık:
// {isDark ? (
//   <i className="bi bi-sun-fill" style={{ fontSize: '1.4rem' }}></i>
// ) : (
//   <i className="bi bi-moon-fill" style={{ fontSize: '1.4rem' }}></i>
// )}

// Versiyon 2 - Animasyonlu (CSS ile):
// <i 
//   className={`bi ${isDark ? 'bi-brightness-high-fill rotate-sun' : 'bi-moon-stars-fill fade-moon'}`}
//   style={{ fontSize: '1.4rem', transition: 'transform 0.3s ease' }}
// ></i>

// Versiyon 3 - Renkli:
// <i 
//   className={`bi ${isDark ? 'bi-brightness-high-fill' : 'bi-moon-stars-fill'}`}
//   style={{ 
//     fontSize: '1.4rem',
//     color: isDark ? '#fbbf24' : '#6366f1'
//   }}
// ></i>