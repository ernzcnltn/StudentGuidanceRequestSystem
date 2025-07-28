// 1. frontend/src/components/LanguageDropdown.js - YENİ COMPONENT
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageDropdown = ({ variant = 'navbar' }) => {
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  
  const currentLang = languages[currentLanguage];
  
  if (variant === 'navbar') {
    return (
      <div className="dropdown">
        <button 
          className="btn btn-outline-light btn-sm dropdown-toggle d-flex align-items-center gap-2" 
          type="button" 
          data-bs-toggle="dropdown" 
          aria-expanded="false"
          style={{ minWidth: '80px' }}
        >
          <span style={{ fontSize: '16px' }}>{currentLang.flag}</span>
          <span className="d-none d-md-inline">{currentLang.code.toUpperCase()}</span>
        </button>
        <ul className="dropdown-menu dropdown-menu-end">
          {Object.entries(languages).map(([code, lang]) => (
            <li key={code}>
              <button
                className={`dropdown-item d-flex align-items-center gap-2 ${
                  currentLanguage === code ? 'active' : ''
                }`}
                onClick={() => changeLanguage(code)}
              >
                <span style={{ fontSize: '16px' }}>{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Admin variant
  if (variant === 'admin') {
    return (
      <div className="dropdown">
        <button 
          className="btn btn-outline-secondary btn-sm dropdown-toggle d-flex align-items-center gap-2" 
          type="button" 
          data-bs-toggle="dropdown" 
          aria-expanded="false"
          style={{ minWidth: '75px' }}
        >
          <span style={{ fontSize: '14px' }}>{currentLang.flag}</span>
          <span className="d-none d-lg-inline">{currentLang.code.toUpperCase()}</span>
        </button>
        <ul className="dropdown-menu dropdown-menu-end">
          {Object.entries(languages).map(([code, lang]) => (
            <li key={code}>
              <button
                className={`dropdown-item d-flex align-items-center gap-2 ${
                  currentLanguage === code ? 'active' : ''
                }`}
                onClick={() => changeLanguage(code)}
              >
                <span style={{ fontSize: '14px' }}>{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
};

export default LanguageDropdown;


