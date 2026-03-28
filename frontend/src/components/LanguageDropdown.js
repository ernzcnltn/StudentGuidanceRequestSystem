// frontend/src/components/LanguageDropdown.js
import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext'; // 👈 EKLENDI

const LanguageDropdown = ({ variant = 'navbar' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  const { isDark } = useTheme(); // 👈 EKLENDI
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  
  const currentLang = languages[currentLanguage];

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLanguageChange = (code) => {
    changeLanguage(code);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const isRTL = document.documentElement.getAttribute('dir') === 'rtl';

  if (variant === 'navbar') {
    return (
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        {/* Button */}
        <button 
          ref={buttonRef}
          className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" 
          onClick={toggleDropdown}
          style={{ 
            minWidth: '70px',
            padding: '0.375rem 0.75rem',
            fontSize: '0.875rem',
            position: 'relative',
            zIndex: 1040
          }}
        >
          {currentLang.code.toUpperCase()}
          <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: '0.7rem' }}></i>
        </button>
        
        {/* Dropdown Menu */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 9998,
                background: 'rgba(0, 0, 0, 0.2)'
              }}
            />
            
            {/* Menu - DARK MODE DESTEĞI */}
            <div
              style={{
                position: 'fixed',
                top: '60px',
                right: isRTL ? 'auto' : '10px',
                left: isRTL ? '10px' : 'auto',
                backgroundColor: isDark ? '#1a202c' : 'white', // 👈 DARK MODE
                border: `1px solid ${isDark ? '#4a5568' : '#dee2e6'}`, // 👈 DARK MODE
                borderRadius: '0.375rem',
                boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
                zIndex: 9999,
                minWidth: '180px',
                maxWidth: '250px',
                maxHeight: '400px',
                overflowY: 'auto',
                animation: 'dropdownSlide 0.2s ease-out'
              }}
            >
              {Object.entries(languages).map(([code, lang]) => (
                <button
                  key={code}
                  onClick={() => handleLanguageChange(code)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: 'none',
                    background: currentLanguage === code ? '#dc2626' : 'transparent',
                    color: currentLanguage === code 
                      ? 'white' 
                      : (isDark ? '#e2e8f0' : '#212529'), // 👈 DARK MODE
                    textAlign: isRTL ? 'right' : 'left',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (currentLanguage !== code) {
                      e.currentTarget.style.backgroundColor = isDark ? '#4a5568' : '#f8f9fa'; // 👈 DARK MODE
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentLanguage !== code) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span>{lang.name}</span>
                  {currentLanguage === code && (
                    <i className="bi bi-check-lg" style={{ marginLeft: '0.5rem' }}></i>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Admin variant - DARK MODE DESTEĞI
  if (variant === 'admin') {
    return (
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        {/* Button */}
        <button 
          ref={buttonRef}
          className={`btn btn-sm d-flex align-items-center gap-2 ${
            isDark ? 'btn-outline-light' : 'btn-outline-secondary'
          }`} // 👈 DARK MODE
          onClick={toggleDropdown}
          style={{ 
            minWidth: '70px',
            padding: '0.375rem 0.75rem',
            fontSize: '0.875rem',
            position: 'relative',
            zIndex: 1040
          }}
        >
          {currentLang.code.toUpperCase()}
          <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: '0.7rem' }}></i>
        </button>
        
        {/* Dropdown Menu */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 9998,
                background: 'rgba(0, 0, 0, 0.2)'
              }}
            />
            
            {/* Menu - DARK MODE DESTEĞI */}
            <div
              style={{
                position: 'fixed',
                top: '60px',
                right: isRTL ? 'auto' : '10px',
                left: isRTL ? '10px' : 'auto',
                backgroundColor: isDark ? '#1a202c' : 'white', // 👈 DARK MODE
                border: `1px solid ${isDark ? '#4a5568' : '#dee2e6'}`, // 👈 DARK MODE
                borderRadius: '0.375rem',
                boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
                zIndex: 9999,
                minWidth: '180px',
                maxWidth: '250px',
                maxHeight: '400px',
                overflowY: 'auto',
                animation: 'dropdownSlide 0.2s ease-out'
              }}
            >
              {Object.entries(languages).map(([code, lang]) => (
                <button
                  key={code}
                  onClick={() => handleLanguageChange(code)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: 'none',
                    background: currentLanguage === code ? '#dc2626' : 'transparent',
                    color: currentLanguage === code 
                      ? 'white' 
                      : (isDark ? '#e2e8f0' : '#212529'), // 👈 DARK MODE
                    textAlign: isRTL ? 'right' : 'left',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (currentLanguage !== code) {
                      e.currentTarget.style.backgroundColor = isDark ? '#4a5568' : '#f8f9fa'; // 👈 DARK MODE
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentLanguage !== code) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span>{lang.name}</span>
                  {currentLanguage === code && (
                    <i className="bi bi-check-lg" style={{ marginLeft: '0.5rem' }}></i>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
};

export default LanguageDropdown;