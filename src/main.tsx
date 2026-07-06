import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'maplibre-gl/dist/maplibre-gl.css';

// Override global fetch to prefix API requests in production and handle token expiration/invalid errors globally.
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof Request) {
    url = input.url;
  } else if (input && typeof input === 'object' && 'toString' in input) {
    url = input.toString();
  }

  let targetInput = input;
  if (typeof input === 'string' && input.startsWith('/api')) {
    const apiUrl = (import.meta as any).env.VITE_API_URL || '';
    targetInput = apiUrl + input;
  }

  try {
    const response = await originalFetch(targetInput, init);

    // Auto-logout if unauthorized (401) or forbidden (403) due to invalid/expired token.
    // Exclude login endpoints to prevent interrupting normal login flow/error displays.
    if ((response.status === 401 || response.status === 403) &&
        !url.includes('/api/auth/login') &&
        !url.includes('/api/portal/login')) {
      
      let shouldLogout = false;

      if (response.status === 401) {
        shouldLogout = true;
      } else if (response.status === 403) {
        try {
          const clonedRes = response.clone();
          const data = await clonedRes.json();
          if (data && data.error && (
            data.error.toLowerCase().includes('token') ||
            data.error.toLowerCase().includes('expirado') ||
            data.error.toLowerCase().includes('inválido')
          )) {
            shouldLogout = true;
          }
        } catch (e) {
          // If we can't parse JSON, don't automatically log out on 403 to avoid breaking role pages.
        }
      }

      if (shouldLogout) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('portal_token');

        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return response;
  } catch (error) {
    throw error;
  }
};


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
