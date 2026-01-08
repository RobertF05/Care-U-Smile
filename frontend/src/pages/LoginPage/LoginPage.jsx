import React, { useState, useContext } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTooth, faEnvelope, faLock } from '@fortawesome/free-solid-svg-icons'
import { AuthContext } from '../../context/AuthContext' // ✅ Importar desde el contexto real

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const { login } = useContext(AuthContext)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await login(email, password)
      if (!result.success) {
        setError(result.error || 'Credenciales incorrectas')
      }
    } catch (err) {
      setError('Error al conectar con el servidor')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <FontAwesomeIcon icon={faTooth} />
          </div>
          <h2 className="login-title">Care U Smile</h2>
          <p className="login-subtitle">Sistema de Gestión Odontológica</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">
              <FontAwesomeIcon icon={faEnvelope} style={{ marginRight: '8px' }} />
              Correo Electrónico
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@clinica.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <FontAwesomeIcon icon={faLock} style={{ marginRight: '8px' }} />
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="login-button" 
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner-small"></span>
                Iniciando sesión...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p style={{ 
            textAlign: 'center', 
            marginTop: '1rem', 
            fontSize: '0.9rem', 
            color: 'var(--text-light)' 
          }}>
            Sistema exclusivo para personal autorizado
          </p>
          <p style={{ 
            textAlign: 'center', 
            fontSize: '0.8rem', 
            color: 'var(--primary-blue)',
            marginTop: '0.5rem'
          }}>
            Usuario demo: admin@clinica.com / Contraseña: 123456
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage