import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Dil kodları ve bayrakları
export const languages = {
  tr: { name: 'Türkçe', flag: '🇹🇷', code: 'tr' },
  en: { name: 'English', flag: '🇬🇧', code: 'en' },
  fr: { name: 'Français', flag: '🇫🇷', code: 'fr' },
  ar: { name: 'العربية', flag: '🇸🇦', code: 'ar' },
  ru: { name: 'Русский', flag: '🇷🇺', code: 'ru' }
};

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    const saved = localStorage.getItem('selectedLanguage');
    return saved || 'tr'; // Varsayılan Türkçe
  });

  useEffect(() => {
    localStorage.setItem('selectedLanguage', currentLanguage);
    
    // HTML lang attribute'unu güncelle
    document.documentElement.lang = currentLanguage;
    
    // RTL desteği (Arapça için)
    if (currentLanguage === 'ar') {
      document.documentElement.dir = 'rtl';
      document.body.style.textAlign = 'right';
    } else {
      document.documentElement.dir = 'ltr';
      document.body.style.textAlign = 'left';
    }
  }, [currentLanguage]);

  const changeLanguage = (languageCode) => {
    setCurrentLanguage(languageCode);
  };

  const value = {
    currentLanguage,
    changeLanguage,
    languages,
    isRTL: currentLanguage === 'ar'
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};