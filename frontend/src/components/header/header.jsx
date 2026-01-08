// En src/components/Header.jsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faUser } from '@fortawesome/free-solid-svg-icons';
import './header.css';

const Header = ({ toggleSidebar, sidebarActive }) => {
  const handleLogoError = (e) => {
    e.target.style.display = 'none';
    const fallback = document.querySelector('.logo-fallback');
    if (fallback) {
      fallback.style.display = 'flex';
    }
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
            <span className="username">Dr. Administrador</span>
            <span className="user-role">Odontólogo</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;