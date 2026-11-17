import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { LanguageProvider } from './lib/i18n';
import '@fontsource-variable/inter';
import '@fontsource-variable/noto-sans-thai';
import './styles.css';
import './clinical-theme.css';
const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: false } },
});
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
