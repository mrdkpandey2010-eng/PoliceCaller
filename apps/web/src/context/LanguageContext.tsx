import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'hi';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<string, Record<Language, string>> = {
  // Navigation
  'nav.directory': { en: 'Directory', hi: 'निर्देशिका' },
  'nav.chats': { en: 'Chats', hi: 'संदेश' },
  'nav.notices': { en: 'Notices', hi: 'आदेश' },
  'nav.profile': { en: 'Profile', hi: 'प्रोफ़ाइल' },
  'nav.admin': { en: 'Admin', hi: 'प्रशासन' },

  // Directory
  'directory.searchPlaceholder': {
    en: 'Search by Name, PNO, Phone, District, Station...',
    hi: 'नाम, पीएनओ, फोन, जनपद, थाना द्वारा खोजें...',
  },
  'directory.allDistricts': { en: 'All Districts', hi: 'सभी जनपद' },
  'directory.allStations': { en: 'All Stations/Offices', hi: 'सभी थाने/कार्यालय' },
  'directory.allRanks': { en: 'All Ranks', hi: 'सभी पद' },
  'directory.favorites': { en: 'Favorites', hi: 'पसंदीदा' },
  'directory.noResults': { en: 'No matching personnel found.', hi: 'कोई कार्मिक नहीं मिला।' },

  // Auth & Validation
  'auth.loginTitle': { en: 'Uttar Pradesh Police Portal', hi: 'उत्तर प्रदेश पुलिस पोर्टल' },
  'auth.pnoLabel': { en: 'Personnel Number (PNO)', hi: 'कार्मिक नंबर (PNO)' },
  'auth.passwordLabel': { en: 'Password', hi: 'पासवर्ड' },
  'auth.loginBtn': { en: 'Login to Directory', hi: 'लॉग इन करें' },
  'auth.registerLink': { en: 'New Personnel? Self Register Here', hi: 'नए कार्मिक? यहाँ पंजीकरण करें' },
  'auth.englishOnlyNotice': {
    en: 'Note: All personnel details must be entered in English (ASCII) characters only.',
    hi: 'सूचना: सभी कार्मिक विवरण केवल अंग्रेजी अक्षरों में ही दर्ज किए जाने आवश्यक हैं।',
  },

  // Actions
  'action.copyNumber': { en: 'Copy Phone Number', hi: 'फोन नंबर कॉपी करें' },
  'action.copied': { en: 'Copied!', hi: 'कॉपी हुआ!' },
  'action.message': { en: 'Message', hi: 'संदेश भेजें' },
  'action.submit': { en: 'Submit', hi: 'जमा करें' },
  'action.cancel': { en: 'Cancel', hi: 'रद्द करें' },
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  toggleLanguage: () => {},
  setLanguage: () => {},
  t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('police_app_lang') as Language) || 'en';
  });

  const toggleLanguage = () => {
    setLanguageState((prev) => {
      const next = prev === 'en' ? 'hi' : 'en';
      localStorage.setItem('police_app_lang', next);
      return next;
    });
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('police_app_lang', lang);
  };

  const t = (key: string): string => {
    if (translations[key] && translations[key][language]) {
      return translations[key][language];
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
