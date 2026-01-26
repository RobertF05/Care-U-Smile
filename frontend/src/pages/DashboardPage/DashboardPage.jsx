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
  const [recentCompletedProcedures, setRecentCompletedProcedures] = useState([]);
  const [loadingProcedures, setLoadingProcedures] = useState(false);

  useEffect(() => {
    if (user) {
      // Obtener citas de hoy
      const today = new Date().toISOString().split('T')[0];
      fetchAppointments({ startDate: today, endDate: today });
      
      // Obtener procedimientos completados recientes
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
      change: '+5'
    },
    { 
      id: 2, 
      title: 'Citas Hoy', 
      value: stats.todayAppointments || 0, 
      icon: faCalendarCheck, 
      color: '#4DB6AC',
      change: '+3'
    },
    { 
      id: 3, 
      title: 'Ingresos Mes', 
      value: formatCurrency(stats.monthlyIncome || 0), 
      icon: faMoneyBillWave, 
      color: '#9C27B0',
      change: '+12%'
    },
    { 
      id: 4, 
      title: 'Procedimientos Totales', 
      value: stats.totalProcedures || 0, 
      icon: faTooth, 
      color: '#FFA726',
      change: '+15'
    },
    { 
      id: 5, 
      title: 'Pendientes', 
      value: stats.pendingProcedures || 0, 
      icon: faClock, 
      color: '#EF5350',
      change: '-2'
    },
    { 
      id: 6, 
      title: 'Gastos Totales', 
      value: formatCurrency(stats.totalExpenses || 0), 
      icon: faReceipt, 
      color: '#607D8B',
      change: '-8%'
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
      identification: apt.patient_identification || apt.patients?.identification || 'N/A',
      notes: apt.observations || ''
    }));

  // Preparar datos de procedimientos completados para mostrar
  const preparedProcedures = recentCompletedProcedures.map(proc => ({
    id: proc.procedure_ID || proc.id || Math.random(),
    patient: proc.patient_name || proc.patients?.first_name || 'Paciente',
    description: proc.procedure_description || 'Procedimiento dental',
    // Usar total_procedure como prioridad, si no existe usar total_cost
    amount: proc.total_procedure || proc.total_cost || 0,
    formattedAmount: formatCurrency(proc.total_procedure || proc.total_cost || 0),
    date: formatDateTime(proc.procedure_date),
    type: proc.procedure_type || (proc.is_orthodontics ? 'Ortodoncia' : 'General'),
    isOrthodontics: proc.is_orthodontics || false,
    // Para ortodoncia, mostrar desglose
    clinicPortion: proc.clinic_portion || 0,
    doctorPortion: proc.doctor_portion || 0,
    clinicPortionFormatted: formatCurrency(proc.clinic_portion || 0),
    doctorPortionFormatted: formatCurrency(proc.doctor_portion || 0),
    // Información adicional
    paymentMethod: proc.payment_method || 'No especificado',
    patientIdentification: proc.patients?.identification || 'N/A'
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
          <h1>Bienvenido, {user?.name || user?.email || 'Doctor'}</h1>
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
      
      {/* Estadísticas desplegables */}
      <div className={`appointments-stats ${expandedStats ? 'expanded' : ''}`}>
        <div className="stats-header-mobile" onClick={() => setExpandedStats(!expandedStats)}>
          <div className="stats-header-content">
            <h3 className="stats-title">
              <FontAwesomeIcon icon={faChartBar} />
              Estadísticas del Dashboard
            </h3>
            <div className="stats-summary-mobile">
              <span className="stat-summary-item">Pacientes: {stats.totalPatients || 0}</span>
              <span className="stat-summary-item">Citas hoy: {stats.todayAppointments || 0}</span>
              <span className="stat-summary-item">Ingresos: {formatCurrency(stats.monthlyIncome || 0)}</span>
            </div>
          </div>
          <FontAwesomeIcon 
            icon={expandedStats ? faChevronUp : faChevronDown} 
            className="stats-toggle-icon"
          />
        </div>
        
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
      
      {/* Secciones inferiores */}
      <div className="dashboard-sections">
        {/* Próximas Citas de Hoy */}
        <div className="section">
          <div className="section-header">
            <div className="section-header-left">
              <h3>
                <FontAwesomeIcon icon={faCalendarCheck} style={{ marginRight: '10px' }} />
                Próximas Citas de Hoy
              </h3>
              <span className="current-time-display">
                <FontAwesomeIcon icon={faClock} style={{ marginRight: '5px' }} />
                {new Date().toLocaleTimeString('es-NI', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </span>
            </div>
            <span className="section-badge">{upcomingAppointments.length}</span>
          </div>
          <div className="section-content">
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
                        <span className="patient-id">ID: {appointment.identification}</span>
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
        
        {/* Últimos Procedimientos Completados */}
        <div className="section">
          <div className="section-header">
            <h3>
              <FontAwesomeIcon icon={faTooth} style={{ marginRight: '10px' }} />
              Últimos Procedimientos Completados
            </h3>
            <div className="section-header-right">
              <span className="section-badge">{preparedProcedures.length}</span>
              <span className="total-amount-badge">
                Total: {formatCurrency(preparedProcedures.reduce((sum, proc) => sum + proc.amount, 0))}
              </span>
            </div>
          </div>
          <div className="section-content">
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
                          <span className="procedure-id">ID: {procedure.patientIdentification}</span>
                        </div>
                        <div className="procedure-amount-section">
                          <span className="procedure-amount" title={`Total: ${procedure.formattedAmount}`}>
                            {procedure.formattedAmount}
                          </span>
                          {procedure.isOrthodontics && (
                            <div className="ortho-breakdown">
                              <small className="clinic-portion" title="Porción Clínica (40%)">
                                C: {procedure.clinicPortionFormatted}
                              </small>
                              <small className="doctor-portion" title="Porción Doctora (60%)">
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
                          <span className="procedure-payment">
                            <FontAwesomeIcon icon={faMoneyBillWave} style={{ marginRight: '3px' }} />
                            {procedure.paymentMethod}
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