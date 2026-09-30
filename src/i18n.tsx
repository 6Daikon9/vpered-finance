import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { translate, type Language } from './messages';
import { money as formatMoney, monthName as formatMonth } from './model';
import { storage } from './storage';
const LANGUAGE_KEY = 'vpered.language';
const LanguageContext = createContext({ language: 'ru' as Language, setLanguage: (_: Language) => {} });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => { try { return storage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'ru'; } catch { return 'ru'; } });
  useEffect(() => { document.documentElement.lang = language; document.title = language === 'en' ? 'Vpered — Budget calculator' : 'Вперёд — калькулятор бюджета'; void storage.setItem(LANGUAGE_KEY, language).catch(() => {}); }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}
export function useI18n() {
  const { language, setLanguage } = useContext(LanguageContext);
  return { language, setLanguage, t: (key: string, ...values: (string | number)[]) => translate(language, key, ...values), money: (cents: number) => formatMoney(cents, language), monthName: (month: string, short = false) => formatMonth(month, short, language) };
}
