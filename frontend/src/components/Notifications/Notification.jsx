// frontend/src/components/Notifications/Notification.jsx
import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheckCircle, faExclamationTriangle, faInfoCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import './Notification.css';

const Notification = ({ 
  message, 
  type = 'info', 
  duration = 5000,
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return faCheckCircle;
      case 'error': return faExclamationCircle;
      case 'warning': return faExclamationTriangle;
      default: return faInfoCircle;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'error': return '#F44336';
      case 'warning': return '#FF9800';
      default: return '#2196F3';
    }
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`notification ${type} ${isExiting ? 'exiting' : ''}`}
      style={{ 
        borderLeft: `4px solid ${getColor()}`,
        backgroundColor: `${getColor()}15` // 15 = ~10% opacity
      }}
    >
      <div className="notification-content">
        <div className="notification-icon">
          <FontAwesomeIcon 
            icon={getIcon()} 
            style={{ color: getColor() }} 
          />
        </div>
        <div className="notification-message">
          <strong style={{ color: getColor() }}>
            {type === 'success' ? 'Éxito' : 
             type === 'error' ? 'Error' : 
             type === 'warning' ? 'Advertencia' : 'Información'}
          </strong>
          <p>{message}</p>
        </div>
        <button 
          className="notification-close"
          onClick={handleClose}
          aria-label="Cerrar notificación"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
    </div>
  );
};

export default Notification;