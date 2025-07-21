import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../locales/translations';

export const useTranslation = () => {
  const { currentLanguage } = useLanguage();
  
  const t = (key, defaultValue = key) => {
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
    
    return typeof value === 'string' ? value : defaultValue;
  };
  
  return { 
    t,
    currentLanguage
  };
};