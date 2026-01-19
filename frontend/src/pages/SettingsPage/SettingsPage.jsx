// frontend/src/pages/SettingsPage/SettingsPage.jsx
import React, { useState, useEffect, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCog,
  faSave,
  faHistory,
  faPercentage,
  faMoneyBillWave,
  faExchangeAlt,
  faUndo,
  faCheckCircle,
  faTimesCircle,
  faInfoCircle,
  faCalculator,
  faUserMd
} from '@fortawesome/free-solid-svg-icons';
import { AppContext } from '../../context/AppContext';
import { AuthContext } from '../../context/AuthContext';
import './SettingsPage.css';

const SettingsPage = () => {
  const { user } = useContext(AuthContext);
  const { apiFetch, loading } = useContext(AppContext);

  // Estados
  const [settings, setSettings] = useState({
    clinic_payment: 40,
    doctor_payment: 60,
    exchange_rate: 36.5
  });
  
  const [originalSettings, setOriginalSettings] = useState({});
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showHistory, setShowHistory] = useState(false);

  // Cargar configuración actual
  useEffect(() => {
    if (user) {
      loadCurrentSettings();
      loadHistory();
    }
  }, [user]);

  const loadCurrentSettings = async () => {
    try {
      const response = await apiFetch('/settings/current');
      
      if (response.success && response.data) {
        setSettings({
          clinic_payment: response.data.clinic_payment || 40,
          doctor_payment: response.data.doctor_payment || 60,
          exchange_rate: response.data.exchange_rate || 36.5
        });
        setOriginalSettings({
          clinic_payment: response.data.clinic_payment || 40,
          doctor_payment: response.data.doctor_payment || 60,
          exchange_rate: response.data.exchange_rate || 36.5
        });
      }
    } catch (error) {
      console.error('Error cargando configuraciones:', error);
      setMessage({
        type: 'error',
        text: 'Error al cargar configuraciones'
      });
    }
  };

  const loadHistory = async () => {
    try {
      const response = await apiFetch('/settings/history?limit=5');
      
      if (response.success) {
        setHistory(response.data || []);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
    }
  };

  // Manejar cambios en porcentajes
  const handlePercentageChange = (field, value) => {
    const numValue = parseFloat(value) || 0;
    
    if (numValue < 0 || numValue > 100) return;
    
    if (field === 'clinic_payment') {
      setSettings({
        ...settings,
        clinic_payment: numValue,
        doctor_payment: 100 - numValue
      });
    } else if (field === 'doctor_payment') {
      setSettings({
        ...settings,
        doctor_payment: numValue,
        clinic_payment: 100 - numValue
      });
    }
  };

  // Manejar cambio en tipo de cambio
  const handleExchangeRateChange = (value) => {
    const numValue = parseFloat(value) || 0;
    
    if (numValue <= 0) return;
    
    setSettings({
      ...settings,
      exchange_rate: numValue
    });
  };

  // Validar configuración
  const validateSettings = () => {
    const total = settings.clinic_payment + settings.doctor_payment;
    
    if (Math.abs(total - 100) > 0.01) {
      setMessage({
        type: 'error',
        text: `Los porcentajes deben sumar 100%. Actual: ${total.toFixed(2)}%`
      });
      return false;
    }
    
    if (settings.exchange_rate <= 0) {
      setMessage({
        type: 'error',
        text: 'El tipo de cambio debe ser mayor a 0'
      });
      return false;
    }
    
    return true;
  };

  // Guardar configuración
  const handleSaveSettings = async () => {
    if (!validateSettings()) return;
    
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      // Verificar si ya existe una configuración
      const currentResponse = await apiFetch('/settings/current');
      
      let response;
      
      if (currentResponse.success && currentResponse.data && currentResponse.data.setting_ID) {
        // Actualizar configuración existente
        response = await apiFetch(`/settings/${currentResponse.data.setting_ID}`, {
          method: 'PUT',
          body: JSON.stringify(settings)
        });
      } else {
        // Crear nueva configuración
        response = await apiFetch('/settings', {
          method: 'POST',
          body: JSON.stringify(settings)
        });
      }
      
      if (response.success) {
        setMessage({
          type: 'success',
          text: '✅ Configuración guardada exitosamente'
        });
        
        // Actualizar configuración original
        setOriginalSettings({...settings});
        
        // Recargar historial
        loadHistory();
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => {
          setMessage({ type: '', text: '' });
        }, 3000);
      }
    } catch (error) {
      console.error('Error guardando configuración:', error);
      setMessage({
        type: 'error',
        text: `❌ Error: ${error.message}`
      });
    } finally {
      setSaving(false);
    }
  };

  // Restaurar valores originales
  const handleReset = () => {
    setSettings({...originalSettings});
    setMessage({
      type: 'info',
      text: 'Valores restaurados a la configuración original'
    });
    
    setTimeout(() => {
      setMessage({ type: '', text: '' });
    }, 2000);
  };

  // Verificar si hay cambios
  const hasChanges = () => {
    return (
      Math.abs(settings.clinic_payment - originalSettings.clinic_payment) > 0.01 ||
      Math.abs(settings.doctor_payment - originalSettings.doctor_payment) > 0.01 ||
      Math.abs(settings.exchange_rate - originalSettings.exchange_rate) > 0.01
    );
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-NI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && !settings.clinic_payment) {
    return (
      <div className="settings-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando configuraciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      {/* Header */}
      <div className="settings-header">
        <div className="header-left">
          <h2>
            <FontAwesomeIcon icon={faCog} className="header-icon" />
            Configuración del Sistema
          </h2>
          <p className="subtitle">Gestión de parámetros y porcentajes de la clínica</p>
        </div>
        <div className="header-right">
          <button 
            className={`secondary-btn ${showHistory ? 'active' : ''}`}
            onClick={() => setShowHistory(!showHistory)}
          >
            <FontAwesomeIcon icon={faHistory} />
            {showHistory ? 'Ocultar Historial' : 'Ver Historial'}
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {message.text && (
        <div className={`message-alert ${message.type}`}>
          <FontAwesomeIcon icon={message.type === 'success' ? faCheckCircle : faTimesCircle} />
          <span>{message.text}</span>
        </div>
      )}

      <div className="settings-content">
        {/* Panel principal de configuración */}
        <div className="settings-main">
          {/* Distribución Ortodoncia */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>
                <FontAwesomeIcon icon={faPercentage} />
                Distribución de Ortodoncia
              </h3>
              <div className="total-percentage">
                <span className="total-label">Total:</span>
                <span className={`total-value ${Math.abs((settings.clinic_payment + settings.doctor_payment) - 100) > 0.01 ? 'error' : 'success'}`}>
                  {(settings.clinic_payment + settings.doctor_payment).toFixed(2)}%
                </span>
              </div>
            </div>
            
            <div className="percentage-controls">
              {/* Clínica */}
              <div className="percentage-group clinic">
                <div className="percentage-header">
                  <span className="percentage-label">Clínica</span>
                  <div className="percentage-input-container">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.clinic_payment}
                      onChange={(e) => handlePercentageChange('clinic_payment', e.target.value)}
                      className="percentage-input"
                    />
                    <span className="percentage-symbol">%</span>
                  </div>
                </div>
                <div className="percentage-bar">
                  <div 
                    className="percentage-fill"
                    style={{ width: `${settings.clinic_payment}%` }}
                  >
                    <span className="percentage-text">{settings.clinic_payment.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="percentage-info">
                  <FontAwesomeIcon icon={faMoneyBillWave} />
                  <span>Porcentaje que recibe la clínica por procedimientos de ortodoncia</span>
                </div>
              </div>

              {/* Doctora */}
              <div className="percentage-group doctor">
                <div className="percentage-header">
                  <span className="percentage-label">Doctora Ortodoncia</span>
                  <div className="percentage-input-container">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.doctor_payment}
                      onChange={(e) => handlePercentageChange('doctor_payment', e.target.value)}
                      className="percentage-input"
                    />
                    <span className="percentage-symbol">%</span>
                  </div>
                </div>
                <div className="percentage-bar">
                  <div 
                    className="percentage-fill"
                    style={{ width: `${settings.doctor_payment}%` }}
                  >
                    <span className="percentage-text">{settings.doctor_payment.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="percentage-info">
                  <FontAwesomeIcon icon={faUserMd} />
                  <span>Porcentaje que recibe la doctora por procedimientos de ortodoncia</span>
                </div>
              </div>
            </div>

            <div className="percentage-validation">
              {Math.abs((settings.clinic_payment + settings.doctor_payment) - 100) > 0.01 ? (
                <div className="validation-error">
                  <FontAwesomeIcon icon={faTimesCircle} />
                  <span>¡Atención! La suma debe ser exactamente 100%</span>
                </div>
              ) : (
                <div className="validation-success">
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span>Porcentajes válidos: Suma 100% correctamente</span>
                </div>
              )}
            </div>
          </div>

          {/* Tipo de Cambio */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>
                <FontAwesomeIcon icon={faExchangeAlt} />
                Tipo de Cambio USD
              </h3>
            </div>
            
            <div className="exchange-rate-control">
              <div className="exchange-rate-info">
                <div className="currency-display">
                  <span className="currency-symbol">US$</span>
                  <span className="currency-equals">1 =</span>
                  <div className="exchange-rate-input-container">
                    <span className="currency-symbol-local">C$</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.0001"
                      value={settings.exchange_rate}
                      onChange={(e) => handleExchangeRateChange(e.target.value)}
                      className="exchange-rate-input"
                    />
                  </div>
                </div>
                
                <div className="exchange-rate-examples">
                  <div className="example-item">
                    <span>US$ 100 = C$ {(100 * settings.exchange_rate).toFixed(2)}</span>
                  </div>
                  <div className="example-item">
                    <span>US$ 500 = C$ {(500 * settings.exchange_rate).toFixed(2)}</span>
                  </div>
                  <div className="example-item">
                    <span>US$ 1000 = C$ {(1000 * settings.exchange_rate).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div className="exchange-rate-note">
                <FontAwesomeIcon icon={faInfoCircle} />
                <span>
                  Este tipo de cambio se utilizará para convertir pagos en dólares a córdobas 
                  en todos los cálculos del sistema.
                </span>
              </div>
            </div>
          </div>

          {/* Resumen de Impacto */}
          <div className="settings-card impact">
            <div className="settings-card-header">
              <h3>
                <FontAwesomeIcon icon={faCalculator} />
                Resumen de Impacto
              </h3>
            </div>
            
            <div className="impact-summary">
              <div className="impact-item">
                <span className="impact-label">Procedimiento de Ortodoncia de C$ 10,000:</span>
                <div className="impact-values">
                  <div className="impact-value clinic">
                    <span>Clínica: C$ {(10000 * settings.clinic_payment / 100).toFixed(2)}</span>
                  </div>
                  <div className="impact-value doctor">
                    <span>Doctora: C$ {(10000 * settings.doctor_payment / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div className="impact-note">
                <small>
                  * Estos cálculos son estimados basados en la configuración actual.
                  Afectarán todos los nuevos procedimientos y cierres mensuales.
                </small>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="settings-actions">
            <button 
              className="secondary-btn"
              onClick={handleReset}
              disabled={!hasChanges() || saving}
            >
              <FontAwesomeIcon icon={faUndo} />
              Restaurar
            </button>
            
            <button 
              className="primary-btn"
              onClick={handleSaveSettings}
              disabled={!hasChanges() || saving || Math.abs((settings.clinic_payment + settings.doctor_payment) - 100) > 0.01}
            >
              {saving ? (
                <>
                  <div className="spinner-small"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faSave} />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </div>

        {/* Panel de historial */}
        {showHistory && (
          <div className="settings-history">
            <div className="history-header">
              <h3>
                <FontAwesomeIcon icon={faHistory} />
                Historial de Cambios
              </h3>
              <small>Últimas 5 configuraciones</small>
            </div>
            
            {history.length === 0 ? (
              <div className="no-history">
                <p>No hay historial de configuraciones</p>
              </div>
            ) : (
              <div className="history-list">
                {history.map((item, index) => (
                  <div key={item.setting_ID} className="history-item">
                    <div className="history-item-header">
                      <span className="history-index">#{history.length - index}</span>
                      <span className="history-date">{formatDate(item.created_at)}</span>
                    </div>
                    
                    <div className="history-details">
                      <div className="history-percentages">
                        <div className="history-percentage clinic">
                          <span>Clínica: {item.clinic_payment}%</span>
                        </div>
                        <div className="history-percentage doctor">
                          <span>Doctora: {item.doctor_payment}%</span>
                        </div>
                      </div>
                      
                      <div className="history-exchange">
                        <span>Tipo Cambio: C$ {item.exchange_rate}</span>
                      </div>
                    </div>
                    
                    {index === 0 && (
                      <div className="history-current-badge">
                        <FontAwesomeIcon icon={faCheckCircle} />
                        <span>Configuración Actual</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;