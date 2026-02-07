import React, { useState, useContext } from 'react'
import Sidebar from './components/sidebar/sidebar.jsx'
import Header from './components/header/header.jsx'
import Dashboard from './pages/DashboardPage/DashboardPage.jsx'
import PatientsPage from './pages/PatientsPage/PatientsPage.jsx'
import ProceduresPage from './pages/ProceduresPage/ProceduresPage.jsx';
import OrthodonticsPage from './pages/OrthodonticsPage/OrthodonticsPage.jsx';
import AppointmentPage from './pages/AppointmentPage/AppointmentPage.jsx';
import MonthlyClosingsPage from './pages/MonthlyClosingsPage/MonthlyClosingsPage.jsx';
import BillsPage from './pages/BillsPage/BillsPage.jsx';
import SettingsPage from './pages/SettingsPage/SettingsPage.jsx';
import Login from './pages/LoginPage/LoginPage.jsx';
import { AuthContext } from './context/AuthContext.jsx'
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

  // ✅ MODIFICADO: Forzar login siempre si no hay usuario
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
        return <AppointmentPage />
      case 'gastos':
        return <BillsPage />
      case 'informes':
        return <MonthlyClosingsPage />
      case 'configuracion':
        return <SettingsPage />
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