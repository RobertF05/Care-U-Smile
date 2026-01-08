import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHome,
  faUsers,
  faTeeth,
  faTooth,
  faCalendarAlt,
  faMoneyBillWave,
  faChartBar,
  faCog,
  faSignOutAlt
} from '@fortawesome/free-solid-svg-icons';
import './sidebar.css';

const Sidebar = ({ setPage, active, setActive, currentPage }) => {
  const menuItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: faHome
    },
    { 
      id: 'pacientes', 
      label: 'Pacientes', 
      icon: faUsers
    },
    { 
      id: 'procedimientos', 
      label: 'Procedimientos', 
      icon: faTeeth
    },
    { 
      id: 'ortodoncia', 
      label: 'Ortodoncia', 
      icon: faTooth
    },
    { 
      id: 'citas', 
      label: 'Citas', 
      icon: faCalendarAlt
    },
    { 
      id: 'gastos', 
      label: 'Gastos', 
      icon: faMoneyBillWave
    },
    { 
      id: 'informes', 
      label: 'Informes', 
      icon: faChartBar
    },
    { 
      id: 'configuracion', 
      label: 'Configuración', 
      icon: faCog
    }
  ];

  const handleNavigation = (pageId) => {
    setPage(pageId);
    if (window.innerWidth <= 768) {
      setActive(false);
    }
  };

  const handleLogout = () => {
    console.log('Cerrando sesión...');
    // Aquí agregarás la lógica de logout
  };

  return (
    <>
      {active && window.innerWidth <= 768 && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setActive(false)}
        />
      )}
      
      <aside className={`sidebar ${active ? 'active' : ''}`}>
        <nav className="sidebar-nav">
          <div className="sidebar-header">
            <button 
              className="sidebar-close-btn"
              onClick={() => setActive(false)}
              aria-label="Cerrar menú"
            >
              ✕
            </button>
            <div className="sidebar-logo">
              <h2>🦷 Care U Smile</h2>
              <p className="sidebar-subtitle">Gestión Odontológica</p>
            </div>
          </div>
          
          <ul className="sidebar-menu">
            {menuItems.map((item) => (
              <li key={item.id} className="sidebar-menu-item">
                <button
                  className={`sidebar-item ${currentPage === item.id ? 'active' : ''}`}
                  onClick={() => handleNavigation(item.id)}
                >
                  <FontAwesomeIcon icon={item.icon} className="sidebar-icon" />
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
          
          <div className="sidebar-footer">
            <button className="logout-button" onClick={handleLogout}>
              <FontAwesomeIcon icon={faSignOutAlt} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;