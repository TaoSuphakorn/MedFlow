import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Languages } from 'lucide-react';
import { thai } from './translations';

export type Language = 'th' | 'en';
export function readLanguage(): Language {
  try {
    return localStorage.getItem('medflow.language') === 'en' ? 'en' : 'th';
  } catch {
    return 'th';
  }
}
type Translate = (text: string | undefined, values?: Record<string, string | number>) => string;
const LanguageContext = createContext<{
  language: Language;
  locale: string;
  setLanguage: (next: Language) => void;
  t: Translate;
} | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(readLanguage);
  const setLanguage = useCallback((next: Language) => {
    try {
      localStorage.setItem('medflow.language', next);
    } catch {
      /* Preference remains available for this session. */
    }
    updateLanguage(next);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const t: Translate = useCallback(
    (text, values) => {
      const key = text || '';
      const result = language === 'th' ? thai[key] || key : key;
      return values
        ? result.replace(/\{(\w+)\}/g, (match, name) => String(values[name] ?? match))
        : result;
    },
    [language],
  );
  return (
    <LanguageContext.Provider
      value={{ language, locale: language === 'th' ? 'th-TH' : 'en-GB', setLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('LanguageProvider is required.');
  return context;
}
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className="language-switcher" role="group" aria-label={t('Interface language')}>
      <Languages size={16} aria-hidden="true" />
      <button
        type="button"
        lang="th"
        aria-label="ภาษาไทย"
        aria-pressed={language === 'th'}
        onClick={() => setLanguage('th')}
      >
        ไทย
      </button>
      <button
        type="button"
        lang="en"
        aria-label="English"
        aria-pressed={language === 'en'}
        onClick={() => setLanguage('en')}
      >
        EN
      </button>
    </div>
  );
}
