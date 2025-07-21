import React, { useContext } from 'react';
import { LanguageContext } from '../contexts/LanguageContext';

const LANGUAGES = [
  { code: 'tr', flag: '🇹🇷' },
  { code: 'en', flag: '🇬🇧' },
  { code: 'ar', flag: '🇸🇦' },
  { code: 'ru', flag: '🇷🇺' },
  { code: 'fr', flag: '🇫🇷' },
];

const LanguageSelector = () => {
  const { language, setLanguage } = useContext(LanguageContext);

  const handleChange = (lang) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      {LANGUAGES.map(({ code, flag }) => (
        <button
          key={code}
          onClick={() => handleChange(code)}
          style={{
            fontSize: '1.5rem',
            border: language === code ? '2px solid #333' : '1px solid lightgray',
            borderRadius: '5px',
            background: 'transparent',
            cursor: 'pointer'
          }}
        >
          {flag}
        </button>
      ))}
    </div>
  );
};

export default LanguageSelector;
