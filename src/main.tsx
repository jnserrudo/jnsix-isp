import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'maplibre-gl/dist/maplibre-gl.css';

// Override global fetch to prefix API requests in production if VITE_API_URL is configured
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  if (typeof input === 'string' && input.startsWith('/api')) {
    const apiUrl = (import.meta as any).env.VITE_API_URL || '';
    return originalFetch(apiUrl + input, init);
  }
  return originalFetch(input, init);
};


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
