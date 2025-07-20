import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSelector = ({ variant = 'dropdown' }) => {
  const { currentLanguage, changeLanguage, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = (languageCode) => {
    changeLanguage(languageCode);
    setIsOpen(false);
  };

  // Dropdown variant (for navbar)
  if (variant === 'dropdown') {
    return (
      <div className="dropdown">
        <button
          className="btn btn-outline-secondary btn-sm dropdown-toggle d-flex align-items-center"
          type="button"
          data-bs-toggle="dropdown"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          style={{ minWidth: '90px' }}
        >
          <span className="me-2">{languages[currentLanguage].flag}</span>
          <span className="d-none d-md-inline">{languages[currentLanguage].name}</span>
        </button>
        <ul className="dropdown-menu">
          {Object.entries(languages).map(([code, lang]) => (
            <li key={code}>
              <button
                className={`dropdown-item d-flex align-items-center ${
                  currentLanguage === code ? 'active' : ''
                }`}
                onClick={() => handleLanguageChange(code)}
              >
                <span className="me-2">{lang.flag}</span>
                <span>{lang.name}</span>
                {currentLanguage === code && (
                  <i className="bi bi-check-lg ms-auto text-success"></i>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Button group variant (for settings page)
  if (variant === 'buttons') {
    return (
      <div className="btn-group" role="group" aria-label="Language selection">
        {Object.entries(languages).map(([code, lang]) => (
          <button
            key={code}
            type="button"
            className={`btn ${
              currentLanguage === code ? 'btn-primary' : 'btn-outline-primary'
            }`}
            onClick={() => handleLanguageChange(code)}
          >
            <span className="me-1">{lang.flag}</span>
            {lang.name}
          </button>
        ))}
      </div>
    );
  }

  // Floating variant (for floating button)
  if (variant === 'floating') {
    return (
      <div className="position-fixed" style={{ bottom: '90px', right: '20px', zIndex: 1000 }}>
        <div className="dropdown dropup">
          <button
            className="btn btn-info rounded-circle"
            style={{
              width: '50px',
              height: '50px',
              fontSize: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded={isOpen}
            onClick={() => setIsOpen(!isOpen)}
            title="Change Language"
          >
            {languages[currentLanguage].flag}
          </button>
          <ul className="dropdown-menu">
            {Object.entries(languages).map(([code, lang]) => (
              <li key={code}>
                <button
                  className={`dropdown-item d-flex align-items-center ${
                    currentLanguage === code ? 'active' : ''
                  }`}
                  onClick={() => handleLanguageChange(code)}
                >
                  <span className="me-2">{lang.flag}</span>
                  <span>{lang.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Simple flag buttons variant
  return (
    <div className="d-flex gap-1">
      {Object.entries(languages).map(([code, lang]) => (
        <button
          key={code}
          className={`btn btn-sm ${
            currentLanguage === code ? 'btn-primary' : 'btn-outline-secondary'
          }`}
          onClick={() => handleLanguageChange(code)}
          title={lang.name}
          style={{ fontSize: '16px', padding: '4px 8px' }}
        >
          {lang.flag}
        </button>
      ))}
    </div>
  );
};

export default LanguageSelector;