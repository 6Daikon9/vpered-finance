import { useLayoutEffect, useState } from 'react';
import { storage } from './storage';
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return storage.getItem('vpered.theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  const [themeError, setThemeError] = useState(false);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101820' : '#182c40');
  }, [theme]);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    void storage.setItem('vpered.theme', next).then(() => setThemeError(false)).catch(() => setThemeError(true));
  };
  return { theme, toggleTheme, themeError };
}
