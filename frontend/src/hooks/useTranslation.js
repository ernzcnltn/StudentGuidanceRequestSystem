// frontend/src/hooks/useTranslation.js
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../locales/translations';

export const useTranslation = () => {
  const { currentLanguage } = useLanguage();
  



  const t = (key, defaultValue = key, interpolations = {}) => {
    // Boş key kontrolü
    if (!key || typeof key !== 'string') {
      return defaultValue;
    }

    // Translations varlık kontrolü
    if (!translations || !translations[currentLanguage]) {
      return defaultValue;
    }

    const keys = key.split('.');
    let value = translations[currentLanguage];
    
    // Nested key'leri çözümle
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if key not found
        value = translations.en;
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return defaultValue;
          }
        }
        break;
      }
    }
    
    let result = typeof value === 'string' ? value : defaultValue;
    
    // String interpolation - {variable} değerlerini değiştir
    if (typeof result === 'string' && Object.keys(interpolations).length > 0) {
      Object.entries(interpolations).forEach(([placeholder, replacement]) => {
        const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
        result = result.replace(regex, replacement);
      });
    }
    
    return result;
  };


  const translateDbText = (text, mappingKey) => {
  if (!text) return '';
  
  const mappings = translations[currentLanguage]?.[mappingKey];
  return mappings?.[text] || text;
};

  // Talep türü çevirisi için özel fonksiyon
  const translateRequestType = (requestTypeName) => {
    if (!requestTypeName) return '';
    
    // requestTypes çevirisini al
    const requestTypesTranslations = translations[currentLanguage]?.requestTypes;
    
    if (requestTypesTranslations && requestTypesTranslations[requestTypeName]) {
      return requestTypesTranslations[requestTypeName];
    }
    
    // Fallback to English
    const englishTranslations = translations.en?.requestTypes;
    if (englishTranslations && englishTranslations[requestTypeName]) {
      return englishTranslations[requestTypeName];
    }
    
    // Son çare olarak orijinal adı döndür
    return requestTypeName;
  };
  

const translateDescription = (description) => {
  if (!description) return '';
  
  const descriptions = translations[currentLanguage]?.requestTypeDescriptions;
  
  if (descriptions && descriptions[description]) {
    return descriptions[description];
  }
  
  // Fallback to English
  const englishDescriptions = translations.en?.requestTypeDescriptions;
  if (englishDescriptions && englishDescriptions[description]) {
    return englishDescriptions[description];
  }
  
  return description;
};

  
  return { 
    t,
    translateRequestType,
    translateDescription, // YENİ FONKSIYON
     translateDbText, // YENİ FONKSIYON
    currentLanguage
  };
};