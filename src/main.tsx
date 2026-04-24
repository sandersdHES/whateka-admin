import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './lib/auth';
import './index.css';

const redirect = sessionStorage.getItem('spa-redirect');
if (redirect) {
  sessionStorage.removeItem('spa-redirect');
  if (redirect !== '/' && redirect !== window.location.pathname) {
    window.history.replaceState(null, '', redirect);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
