import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initBridge } from './generated/api';

// Initialize the bridge connection
initBridge('http://127.0.0.1:8000');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
