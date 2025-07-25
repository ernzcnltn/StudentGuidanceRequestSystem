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
  tr: { name: 'Türkçe', flag: 'TR', code: 'tr' },
  en: { name: 'English', flag: 'EN', code: 'en' },
  fr: { name: 'Français', flag: 'FR', code: 'fr' },
  ar: { name: 'العربية', flag: 'AR', code: 'ar' },
  ru: { name: 'Русский', flag: 'RU', code: 'ru' }
};

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    const saved = localStorage.getItem('selectedLanguage');
    console.log('LanguageProvider - Saved language from localStorage:', saved);
    
    // Geçerli dil kontrolü
    if (saved && languages[saved]) {
      return saved;
    }
    
    // Varsayılan Türkçe
    return 'en';
  });

  useEffect(() => {
    console.log('LanguageProvider - Language changed to:', currentLanguage);
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
    console.log('LanguageProvider - changeLanguage called:', languageCode);
    
    if (!languages[languageCode]) {
      console.error('Invalid language code:', languageCode);
      return;
    }

    if (languageCode !== currentLanguage) {
      console.log('LanguageProvider - Changing from', currentLanguage, 'to', languageCode);
      setCurrentLanguage(languageCode);
    }
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