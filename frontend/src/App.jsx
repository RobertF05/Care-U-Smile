import React, { useState, useContext } from 'react'
import Sidebar from './components/sidebar/sidebar.jsx'
import Header from './components/header/header.jsx'
import Dashboard from './pages/DashboardPage/DashboardPage.jsx'
import PatientsPage from './pages/PatientsPage/PatientsPage.jsx'
import ProceduresPage from './pages/ProceduresPage/ProceduresPage.jsx';
import OrthodonticsPage from './pages/OrthodonticsPage/OrthodonticsPage.jsx';
import Login from './pages/LoginPage/LoginPage.jsx'
import { AuthContext } from './context/AuthContext' // ✅ Importar el contexto
import './App.css'

function App() {
  const { user, loading } = useContext(AuthContext)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [sidebarActive, setSidebarActive] = useState(false)

  const toggleSidebar = () => {
    setSidebarActive(!sidebarActive)
  }

  // Pantalla de carga
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h3>Cargando Care U Smile...</h3>
          <p>Sistema de Gestión Odontológica</p>
        </div>
      </div>
    )
  }

  // Si no hay usuario, mostrar login
  if (!user) {
    return <Login />
  }

  // Renderizar página según selección
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />
      case 'pacientes':
        return <PatientsPage />
      case 'procedimientos':
        return <ProceduresPage />
      case 'ortodoncia':
        return <OrthodonticsPage />
      case 'citas':
        return (
          <div className="page-content">
            <h1>📅 Citas</h1>
            <p>Agenda de citas - Próximamente</p>
          </div>
        )
      case 'gastos':
        return (
          <div className="page-content">
            <h1>💰 Gastos</h1>
            <p>Control de gastos - Próximamente</p>
          </div>
        )
      case 'informes':
        return (
          <div className="page-content">
            <h1>📊 Informes</h1>
            <p>Reportes y estadísticas - Próximamente</p>
          </div>
        )
      case 'configuracion':
        return (
          <div className="page-content">
            <h1>⚙️ Configuración</h1>
            <p>Ajustes del sistema - Próximamente</p>
          </div>
        )
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="app">
      <Header 
        toggleSidebar={toggleSidebar} 
        sidebarActive={sidebarActive} 
      />
      <Sidebar 
        setPage={setCurrentPage}
        active={sidebarActive}
        setActive={setSidebarActive}
        currentPage={currentPage}
      />
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  )
}

export default App