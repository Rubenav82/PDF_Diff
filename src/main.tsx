import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './assets/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("No se pudo encontrar el elemento a cargar.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);