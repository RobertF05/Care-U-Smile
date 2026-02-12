import React, { useContext, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, 
  faCalendarCheck, 
  faMoneyBillWave, 
  faChartLine,
  faTooth,
  faUserMd,
  faClock,
  faSmile,
  faReceipt,
  faChevronDown,
  faChevronUp,
  faChartBar
} from '@fortawesome/free-solid-svg-icons';
import { AuthContext } from '../../context/AuthContext.jsx';
import { AppContext } from '../../context/AppContext.jsx';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import './DashboardPage.css';

const DashboardPage = () => {
  const { user } = useContext(AuthContext);
  const { 
    stats, 
    appointments, 
    procedures, 
    loading, 
    fetchAppointments,
    fetchProcedures,
    fetchProceduresNormal,
    fetchOrthodontics
  } = useContext(AppContext);

  const [expandedStats, setExpandedStats] = useState(false);
  const [expandedAppointments, setExpandedAppointments] = useState(false); 
  const [expandedProcedures, setExpandedProcedures] = useState(false);
  const [recentCompletedProcedures, setRecentCompletedProcedures] = useState([]);
  const [loadingProcedures, setLoadingProcedures] = useState(false);

  useEffect(() => {
    if (user) {
      // Obtener citas de hoy
      const today = new Date().toISOString().split('T')[0];
      fetchAppointments({ startDate: today, endDate: today });
      
      // Obtener procedimientos completados recientemente
      fetchRecentCompletedProcedures();
    }
  }, [user]);

  // Función para obtener procedimientos completados recientes
  const fetchRecentCompletedProcedures = async () => {
    setLoadingProcedures(true);
    try {
      // Obtener ambos tipos de procedimientos
      const [normalProcedures, orthodonticProcedures] = await Promise.all([
        fetchProceduresNormal({ state: 'COMPLETED', limit: 10 }),
        fetchOrthodontics({ state: 'COMPLETED', limit: 10 })
      ]);

      // Combinar y procesar resultados
      const allProcedures = [];
      
      // Agregar procedimientos normales
      if (normalProcedures.success && normalProcedures.data) {
        normalProcedures.data.forEach(proc => {
          allProcedures.push({
            ...proc,
            procedure_type: 'General',
            total_amount: proc.total_procedure || proc.total_cost || 0
          });
        });
      }
      
      // Agregar procedimientos de ortodoncia
      if (orthodonticProcedures.success && orthodonticProcedures.data) {
        orthodonticProcedures.data.forEach(proc => {
          allProcedures.push({
            ...proc,
            procedure_type: 'Ortodoncia',
            total_amount: proc.total_procedure || proc.total_cost || 0,
            // Calcular porciones para ortodoncia
            clinic_portion: proc.clinic_income || (proc.total_procedure * 0.4),
            doctor_portion: proc.doctor_income || (proc.total_procedure * 0.6)
          });
        });
      }
      
      // Ordenar por fecha más reciente y limitar a 10
      const sortedProcedures = allProcedures
        .sort((a, b) => new Date(b.procedure_date) - new Date(a.procedure_date))
        .slice(0, 10);
      
      setRecentCompletedProcedures(sortedProcedures);
    } catch (error) {
      console.error('Error al obtener procedimientos completados:', error);
    } finally {
      setLoadingProcedures(false);
    }
  };

  // Función para validar si una fecha es válida
  const isValidDate = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  };

  // Función para formatear hora en formato Nicaragua (HH:MM AM/PM)
  const formatNicaraguaTime = (dateString) => {
    if (!isValidDate(dateString)) return '--:--';
    
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-NI', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Función para formatear fecha completa con hora
  const formatDateTime = (dateString) => {
    if (!isValidDate(dateString)) return 'Fecha inválida';
    
    const date = new Date(dateString);
    const datePart = date.toLocaleDateString('es-NI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timePart = formatNicaraguaTime(dateString);
    
    return `${datePart} ${timePart}`;
  };

  // Función para obtener solo la fecha en formato YYYY-MM-DD
  const getDatePart = (dateString) => {
    if (!isValidDate(dateString)) return null;
    
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const dashboardStats = [
    { 
      id: 1, 
      title: 'Pacientes', 
      value: stats.totalPatients || 0, 
      icon: faUsers, 
      color: '#2196F3',
      change: ''
    },
    { 
      id: 5, 
      title: 'Pendientes', 
      value: stats.pendingProcedures || 0, 
      icon: faClock, 
      color: '#EF5350',
      change: ''
    }
  ];

  // Procesar citas de hoy con hora - VERSIÓN SEGURA
  const upcomingAppointments = appointments
    .filter(apt => {
      if (!apt || !apt.appointment_date) return false;
      
      // Validar que la fecha sea válida
      if (!isValidDate(apt.appointment_date)) return false;
      
      const today = new Date().toISOString().split('T')[0];
      const aptDate = getDatePart(apt.appointment_date);
      
      return aptDate === today;
    })
    .sort((a, b) => {
      const dateA = new Date(a.appointment_date);
      const dateB = new Date(b.appointment_date);
      return dateA - dateB;
    })
    .slice(0, 10)
    .map(apt => ({
      id: apt.appointment_ID || apt.id || Math.random(),
      patient: apt.patient_name || apt.patients?.first_name || 'Paciente',
      time: formatNicaraguaTime(apt.appointment_date),
      dateTime: isValidDate(apt.appointment_date) ? new Date(apt.appointment_date) : new Date(),
      dateTimeDisplay: formatDateTime(apt.appointment_date),
      procedure: apt.query_type || 'Consulta',
      status: apt.state || 'scheduled',
      notes: apt.observations || ''
    }));

  // Preparar datos de procedimientos completados para mostrar
  const preparedProcedures = recentCompletedProcedures.map(proc => ({
    id: proc.procedure_ID || proc.id || Math.random(),
    patient: proc.patient_name || proc.patients?.first_name || 'Paciente',
    description: proc.procedure_description || 'Procedimiento dental',
    amount: proc.is_orthodontics 
      ? (proc.clinic_portion || (proc.total_procedure * 0.4) || 0)
      : (proc.total_procedure || proc.total_cost || 0),
    formattedAmount: formatCurrency(
      proc.is_orthodontics 
        ? (proc.clinic_portion || (proc.total_procedure * 0.4) || 0)
        : (proc.total_procedure || proc.total_cost || 0)
    ),
    date: formatDateTime(proc.procedure_date),
    type: proc.procedure_type || (proc.is_orthodontics ? 'Ortodoncia' : 'General'),
    isOrthodontics: proc.is_orthodontics || false,
    clinicPortion: proc.clinic_portion || 0,
    doctorPortion: proc.doctor_portion || 0,
    clinicPortionFormatted: formatCurrency(proc.clinic_portion || 0),
    doctorPortionFormatted: formatCurrency(proc.doctor_portion || 0),
  }));

  if (loading && !stats.totalPatients) {
    return (
      <div className="page-content">
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Bienvenido, {user?.username || user?.name || user?.email || 'Doctor'}</h1>
          <p className="dashboard-subtitle">
            <FontAwesomeIcon icon={faSmile} style={{ marginRight: '8px' }} />
            Hoy es {new Date().toLocaleDateString('es-NI', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>
      
      {/* Estadísticas desplegables - Siempre con header clickeable */}
      <div className="dashboard-section collapsible-section">
        <div className="section-header clickable-header" onClick={() => setExpandedStats(!expandedStats)}>
          <div className="section-header-content">
            <h3 className="section-title">
              <FontAwesomeIcon icon={faChartBar} />
              Estadísticas del Dashboard
            </h3>
          </div>
          <FontAwesomeIcon 
            icon={expandedStats ? faChevronUp : faChevronDown} 
            className="toggle-icon"
          />
        </div>
        
        <div className={`section-content ${expandedStats ? 'expanded' : 'collapsed'}`}>
          <div className="stats-grid-container">
            {dashboardStats.map((stat) => (
              <div key={stat.id} className="dashboard-card">
                <div className="card-header">
                  <div className="card-icon-wrapper" style={{ backgroundColor: `${stat.color}20` }}>
                    <FontAwesomeIcon icon={stat.icon} style={{ color: stat.color }} />
                  </div>
                  <h3 className="card-title">{stat.title}</h3>
                </div>
                <div className="card-body">
                  <div className="card-value">{stat.value}</div>
                  <div className="card-change" style={{ color: stat.change.startsWith('+') ? '#4CAF50' : '#F44336' }}>
                    {stat.change}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Secciones desplegables para Citas y Procedimientos */}
      <div className="dashboard-sections">
        {/* Próximas Citas de Hoy - Desplegable */}
        <div className="dashboard-section collapsible-section">
          <div className="section-header clickable-header" onClick={() => setExpandedAppointments(!expandedAppointments)}>
            <div className="section-header-content">
              <h3 className="section-title">
                <FontAwesomeIcon icon={faCalendarCheck} />
                Próximas Citas de Hoy
              </h3>
              <div className="section-summary">
                <span className="summary-item">
                  <FontAwesomeIcon icon={faClock} />
                  {new Date().toLocaleTimeString('es-NI', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </span>
                <span className="summary-badge">{upcomingAppointments.length}</span>
              </div>
            </div>
            <FontAwesomeIcon 
              icon={expandedAppointments ? faChevronUp : faChevronDown} 
              className="toggle-icon"
            />
          </div>
          
          <div className={`section-content ${expandedAppointments ? 'expanded' : 'collapsed'}`}>
            {upcomingAppointments.length > 0 ? (
              <div className="appointments-list">
                {upcomingAppointments.map((appointment) => (
                  <div key={appointment.id} className="appointment-card">
                    <div className="appointment-time-section">
                      <div className="appointment-time">
                        <FontAwesomeIcon icon={faClock} style={{ marginRight: '5px', fontSize: '0.9em' }} />
                        <strong className="time-display">{appointment.time}</strong>
                      </div>
                      <div className="appointment-date-info">
                        {appointment.dateTimeDisplay.split(' ')[0]}
                      </div>
                    </div>
                    <div className="appointment-info">
                      <div className="patient-name">
                        <strong>{appointment.patient}</strong>
                      </div>
                      <div className="appointment-details">
                        <span className="procedure">
                          <FontAwesomeIcon icon={faTooth} style={{ marginRight: '5px', fontSize: '0.9em' }} />
                          {appointment.procedure}
                        </span>
                        {appointment.notes && (
                          <span className="appointment-notes" title={appointment.notes}>
                            <FontAwesomeIcon icon={faChartLine} style={{ marginRight: '5px', fontSize: '0.9em' }} />
                            Notas
                          </span>
                        )}
                      </div>
                    </div>
                    <div 
                      className="appointment-status" 
                      style={{ 
                        backgroundColor: getStatusColor(appointment.status),
                        color: '#FFFFFF'
                      }}
                    >
                      {getStatusLabel(appointment.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <FontAwesomeIcon icon={faCalendarCheck} size="2x" />
                </div>
                <p>No hay citas programadas para hoy</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Últimos Procedimientos Completados - Desplegable */}
        <div className="dashboard-section collapsible-section">
          <div className="section-header clickable-header" onClick={() => setExpandedProcedures(!expandedProcedures)}>
            <div className="section-header-content">
              <h3 className="section-title">
                <FontAwesomeIcon icon={faTooth} />
                Últimos Procedimientos Completados
              </h3>
              <div className="section-summary">
                <span className="summary-badge">{preparedProcedures.length}</span>
              </div>
            </div>
            <FontAwesomeIcon 
              icon={expandedProcedures ? faChevronUp : faChevronDown} 
              className="toggle-icon"
            />
          </div>
          
          <div className={`section-content ${expandedProcedures ? 'expanded' : 'collapsed'}`}>
            {loadingProcedures ? (
              <div className="loading-procedures">
                <div className="spinner-small"></div>
                <p>Cargando procedimientos...</p>
              </div>
            ) : preparedProcedures.length > 0 ? (
              <div className="procedures-list">
                {preparedProcedures.map((procedure) => (
                  <div key={procedure.id} className="procedure-card">
                    <div className="procedure-icon" style={{ 
                      backgroundColor: procedure.isOrthodontics ? '#9C27B020' : '#2196F320',
                      color: procedure.isOrthodontics ? '#9C27B0' : '#2196F3'
                    }}>
                      <FontAwesomeIcon icon={procedure.isOrthodontics ? faUserMd : faTooth} />
                    </div>
                    <div className="procedure-info">
                      <div className="procedure-header">
                        <div className="procedure-patient">
                          <strong>{procedure.patient}</strong>
                        </div>
                        <div className="procedure-amount-section">
                          <span className="procedure-amount" title={`Ganancia Clínica: ${procedure.formattedAmount}`}>
                            {procedure.formattedAmount}
                          </span>
                          {procedure.isOrthodontics && (
                            <div className="ortho-breakdown">
                              <small className="clinic-portion" title="Porción Clínica">
                                C: {procedure.clinicPortionFormatted}
                              </small>
                              <small className="doctor-portion" title="Porción Doctora">
                                D: {procedure.doctorPortionFormatted}
                              </small>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="procedure-description" title={procedure.description}>
                        {procedure.description.length > 60 
                          ? `${procedure.description.substring(0, 60)}...` 
                          : procedure.description}
                      </p>
                      <div className="procedure-footer">
                        <div className="procedure-meta">
                          <span className={`procedure-type ${procedure.isOrthodontics ? 'orthodontics' : 'general'}`}>
                            <FontAwesomeIcon icon={procedure.isOrthodontics ? faUserMd : faTooth} style={{ marginRight: '3px' }} />
                            {procedure.type}
                          </span>
                          <span className="procedure-date">
                            <FontAwesomeIcon icon={faClock} style={{ marginRight: '3px' }} />
                            {procedure.date}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <FontAwesomeIcon icon={faTooth} size="2x" />
                </div>
                <p>No hay procedimientos completados recientemente</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Funciones auxiliares
const getStatusColor = (status) => {
  const colors = {
    'scheduled': '#FFA726',
    'confirmed': '#42A5F5',
    'completed': '#66BB6A',
    'cancelled': '#EF5350',
    'no_show': '#78909C'
  };
  return colors[status] || '#78909C';
};

const getStatusLabel = (status) => {
  const labels = {
    'scheduled': 'Programada',
    'confirmed': 'Confirmada',
    'completed': 'Completada',
    'cancelled': 'Cancelada',
    'no_show': 'No asistió'
  };
  return labels[status] || status;
};

export default DashboardPage;