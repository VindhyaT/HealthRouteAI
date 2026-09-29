import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import './styles.css';
import './theme.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><AuthProvider><App /></AuthProvider></ErrorBoundary></React.StrictMode>);