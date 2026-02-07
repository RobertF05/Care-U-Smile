// frontend/src/pages/LoginPage/LoginPage.jsx
import React, { useState, useContext, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faTooth, 
  faEnvelope, 
  faLock, 
  faEye, 
  faEyeSlash,
  faUserDoctor,
  faShieldAlt,
  faExclamationTriangle,
  faExclamationCircle,
  faStethoscope,
  faBuildingColumns
} from '@fortawesome/free-solid-svg-icons'
import { AuthContext } from '../../context/AuthContext'
import './LoginPage.css'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  
  const { login, loading } = useContext(AuthContext)

  // Limpiar errores al cambiar campos
  useEffect(() => {
    if (validationErrors.email && email) {
      setValidationErrors(prev => ({ ...prev, email: '' }))
    }
    if (validationErrors.password && password) {
      setValidationErrors(prev => ({ ...prev, password: '' }))
    }
    if (validationErrors.form) {
      setValidationErrors(prev => ({ ...prev, form: '' }))
    }
  }, [email, password])

  const validateForm = () => {
    const errors = {}
    
    // Validar email
    if (!email.trim()) {
      errors.email = 'El correo electrónico es requerido'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Formato de email inválido'
    }
    
    // Validar contraseña
    if (!password) {
      errors.password = 'La contraseña es requerida'
    } else if (password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres'
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validar antes de enviar
    if (!validateForm()) {
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const result = await login(email, password)
      if (!result.success && result.error) {
        // Solo mostrar errores específicos del formulario si no son de conexión
        if (!result.error.includes('conexión') && !result.error.includes('servidor')) {
          setValidationErrors({
            form: result.error.includes('Credenciales incorrectas') 
              ? 'El correo electrónico o la contraseña son incorrectos'
              : result.error
          })
        }
      }
    } catch (err) {
      console.error('Error inesperado en login:', err)
      setValidationErrors({
        form: 'Error inesperado. Por favor, intenta de nuevo.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Efecto para limpiar errores después de 5 segundos
  useEffect(() => {
    if (validationErrors.form) {
      const timer = setTimeout(() => {
        setValidationErrors(prev => ({ ...prev, form: '' }))
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [validationErrors.form])

  return (
    <div className="login-page">
      {/* Fondo con patrón dental */}
      <div className="login-background">
        <div className="dental-pattern"></div>
        <div className="login-gradient"></div>
        
        {/* Elementos decorativos flotantes */}
        <div className="floating-element element-1">🦷</div>
        <div className="floating-element element-2">💎</div>
        <div className="floating-element element-3">⭐</div>
        <div className="floating-element element-4">✨</div>
      </div>
      
      {/* Contenedor principal */}
      <div className="login-container">
        
        {/* Panel izquierdo - Información de la clínica (solo desktop) */}
        <div className="login-info-panel">
          <div className="info-panel-content">
            <div className="clinic-logo-large">
              <FontAwesomeIcon icon={faTooth} />
            </div>
            
            <div className="clinic-info-extended">
              <h1 className="clinic-title">Care U Smile</h1>
              <p className="clinic-tagline">Excelencia en Salud Dental</p>
              
              <div className="clinic-features">
                <div className="feature">
                  <div className="feature-icon">
                    <FontAwesomeIcon icon={faStethoscope} />
                  </div>
                  <div className="feature-text">
                    <h4>Atención Especializada</h4>
                    <p>Profesionales calificados en todas las áreas odontológicas</p>
                  </div>
                </div>
                
                <div className="feature">
                  <div className="feature-icon">
                    <FontAwesomeIcon icon={faBuildingColumns} />
                  </div>
                  <div className="feature-text">
                    <h4>Tecnología de Vanguardia</h4>
                    <p>Equipos modernos para diagnósticos precisos y tratamientos efectivos</p>
                  </div>
                </div>
                
                <div className="feature">
                  <div className="feature-icon">
                    <FontAwesomeIcon icon={faUserDoctor} />
                  </div>
                  <div className="feature-text">
                    <h4>Cuidado Personalizado</h4>
                    <p>Tratamientos diseñados para las necesidades individuales de cada paciente</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="info-panel-footer">
              <div className="security-badge">
                <FontAwesomeIcon icon={faShieldAlt} />
                <span>Sistema 100% seguro</span>
              </div>
              <p className="clinic-motto">"Sonrisas saludables, vidas felices"</p>
            </div>
          </div>
        </div>
        
        {/* Panel derecho - Formulario de login */}
        <div className="login-form-panel">
          <div className="form-panel-content">
            
            {/* Logo pequeño en mobile */}
            <div className="mobile-logo">
              <div className="mobile-logo-icon">
                <FontAwesomeIcon icon={faTooth} />
              </div>
              <h2>Care U Smile</h2>
            </div>
            
            <div className="form-header">
              <h2 className="form-title">Bienvenido de vuelta</h2>
              <p className="form-subtitle">
                Por favor, ingresa tus credenciales para acceder al sistema
              </p>
            </div>
            
            {/* Formulario */}
            <form className="login-form" onSubmit={handleSubmit}>
              {validationErrors.form && (
                <div className="form-error-message">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  <span>{validationErrors.form}</span>
                </div>
              )}

              <div className={`form-group ${validationErrors.email ? 'error' : ''}`}>
                <label htmlFor="email">
                  <FontAwesomeIcon icon={faEnvelope} />
                  <span>Correo Electrónico</span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@careusmile.com"
                  required
                  disabled={isSubmitting || loading}
                  autoComplete="username"
                  className={validationErrors.email ? 'input-error' : ''}
                />
                {validationErrors.email && (
                  <span className="field-error">
                    <FontAwesomeIcon icon={faExclamationCircle} />
                    {validationErrors.email}
                  </span>
                )}
              </div>

              <div className={`form-group ${validationErrors.password ? 'error' : ''}`}>
                <label htmlFor="password">
                  <FontAwesomeIcon icon={faLock} />
                  <span>Contraseña</span>
                </label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={isSubmitting || loading}
                    autoComplete="current-password"
                    className={validationErrors.password ? 'input-error' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting || loading}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                  </button>
                </div>
                {validationErrors.password && (
                  <span className="field-error">
                    <FontAwesomeIcon icon={faExclamationCircle} />
                    {validationErrors.password}
                  </span>
                )}
              </div>

              <div className="form-options">
                <label className="remember-me">
                  <input type="checkbox" />
                  <span>Recordar sesión</span>
                </label>
                {/* <a href="#" className="forgot-password">
                  ¿Olvidaste tu contraseña?
                </a> */}
              </div>

              <button 
                type="submit" 
                className="login-button" 
                disabled={isSubmitting || loading}
              >
                {isSubmitting || loading ? (
                  <>
                    <span className="loading-spinner-small"></span>
                    <span>Iniciando sesión...</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faUserDoctor} />
                    <span>Acceder al Sistema</span>
                  </>
                )}
              </button>
            </form>
            
            {/* Footer del formulario */}
            <div className="form-footer">
              <div className="security-info">
                <p>
                  <FontAwesomeIcon icon={faShieldAlt} />
                  <span>Conexión segura • Encriptación SSL</span>
                </p>
              </div>
              <div className="copyright">
                <p>© {new Date().getFullYear()} Care U Smile Dental Clinic</p>
                <p className="version">Sistema de Gestión v2.0.0</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage