// src/components/Header.jsx
import React, { useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faUser } from '@fortawesome/free-solid-svg-icons';
import { AuthContext } from '../../context/AuthContext'; // ✅ Importar AuthContext
import './header.css';

const Header = ({ toggleSidebar, sidebarActive }) => {
  const { user } = useContext(AuthContext); // ✅ Obtener usuario del contexto

  const handleLogoError = (e) => {
    e.target.style.display = 'none';
    const fallback = document.querySelector('.logo-fallback');
    if (fallback) {
      fallback.style.display = 'flex';
    }
  };

  // ✅ Función para formatear el nombre del usuario
  const getFormattedUsername = () => {
    if (!user) return 'Usuario';
    
    // Priorizar username, luego name, luego email
    if (user.username) {
      return user.username;
    }
    if (user.name) {
      return user.name;
    }
    if (user.email) {
      return user.email.split('@')[0]; // Tomar solo la parte antes del @
    }
    
    return 'Usuario';
  };

  // ✅ Función para formatear el tipo de usuario
  const getFormattedUserType = () => {
    if (!user || !user.user_type) return 'Odontólogo';
    
    // Mapear tipos de usuario a nombres más amigables
    const typeMap = {
      'ADMIN': 'Administrador',
      'DOCTOR': 'Odontólogo',
      'ASSISTANT': 'Asistente',
      'USER': 'Usuario',
      'admin': 'Administrador',
      'doctor': 'Odontólogo',
      'assistant': 'Asistente',
      'user': 'Usuario'
    };
    
    return typeMap[user.user_type] || user.user_type;
  };

  // ✅ Función para mostrar título (Dr./Dra.) según el tipo
  const getUserTitle = () => {
    const formattedType = getFormattedUserType().toLowerCase();
    
    if (formattedType.includes('odontólogo') || formattedType.includes('doctor')) {
      // Aquí podrías añadir lógica para determinar género si lo tienes en el usuario
      return 'Dr. ';
    }
    
    return '';
  };

  return (
    <header className="header">
      <div className="header-left">
        <button 
          className="menu-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
          aria-expanded={sidebarActive}
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
        
        <div className="logo-container">
          {/* Logo desde public/ */}
          <img 
            src="/Farmacia Sory Logo.png" 
            alt="Care U Smile - Clínica Odontológica"
            className="logo-image"
            onError={handleLogoError}
          />
          
          {/* Fallback si el logo no carga */}
          <div className="logo-fallback">
            <span className="logo-icon">🦷</span>
            <div className="logo-text">
              <span className="logo-main">Care U Smile</span>
              <span className="logo-sub">Odontología Especializada</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="header-right">
        <div className="user-info">
          <div className="user-avatar">
            <FontAwesomeIcon icon={faUser} />
          </div>
          <div className="user-details">
            <span className="username">
              {getUserTitle()}{getFormattedUsername()}
            </span>
            <span className="user-role">
              {getFormattedUserType()}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;