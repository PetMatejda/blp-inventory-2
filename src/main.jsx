import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { resetLocalCacheIfRequested, removeLegacyLocalData } from './services/cacheMaintenance';

// Emergency reset (…/?reset-cache=1) must run BEFORE Firebase starts, so the
// app (which initialises Firestore on import) is loaded only afterwards.
(async () => {
  await resetLocalCacheIfRequested();
  removeLegacyLocalData();
  const { default: App } = await import('./App');
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
})();
