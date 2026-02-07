// frontend/src/index.js o main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx' // ✅ Nuevo

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NotificationProvider> {/* ✅ Envolver todo */}
      <AuthProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </AuthProvider>
    </NotificationProvider>
  </React.StrictMode>
)