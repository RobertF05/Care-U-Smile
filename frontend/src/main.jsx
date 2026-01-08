import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'

// Contexto temporal para Auth (puedes reemplazarlo después)
const TemporaryAuthProvider = ({ children }) => {
  const [user, setUser] = React.useState(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    // Simular carga inicial
    const timer = setTimeout(() => {
      // Aquí iría la lógica para verificar sesión activa
      // Por ahora, no hay usuario por defecto
      setLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  const login = async (email, password) => {
    // Lógica de login que conectarás con tu backend
    console.log('Login attempt:', email)
    // Simulación exitosa
    setUser({ email, name: 'Dr. Admin', role: 'odontologo' })
    return { success: true }
  }

  const logout = () => {
    setUser(null)
    console.log('Logged out')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

const AuthContext = React.createContext()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)