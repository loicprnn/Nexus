import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import './index.css'

// NOTE: React.StrictMode is intentionally NOT used. react-grid-layout (via
// react-draggable's findDOMNode) breaks under StrictMode's double-mount in
// React 18 dev mode — drag and resize silently stop working. Removing StrictMode
// restores the dashboard's drag/drop. Production behaviour is unaffected either way.
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>,
)
