import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './i18n';
import { initializeStorage } from './storage';
import './styles.css';
import './theme.css';
initializeStorage().then(() => {
  createRoot(document.getElementById('root')!).render(<React.StrictMode><LanguageProvider><App /></LanguageProvider></React.StrictMode>);
}).catch(() => {
  const root = document.getElementById('root')!;
  root.textContent = 'Не удалось открыть локальные данные. Перезапустите приложение. / Could not open local data. Restart the app.';
});
