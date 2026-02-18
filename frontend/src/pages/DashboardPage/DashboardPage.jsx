import React, { useContext, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, 
  faCalendarCheck, 
  faTooth,
  faUserMd,
  faClock,
  faSmile,
  faChevronDown,
  faChevronUp,
  faChartBar,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { AuthContext } from '../../context/AuthContext.jsx';
import { AppContext } from '../../context/AppContext.jsx';
import { formatCurrency } from '../../utils/formatters.js';
import './DashboardPage.css';

const DashboardPage = () => {
  const { user } = useContext(AuthContext);
  const { 
    fetchPatients,
    getUpcomingAppointments,
    fetchProceduresNormal,
    fetchOrthodontics,
    apiFetch
  } = useContext(AppContext);

  // Estados
  const [expandedStats, setExpandedStats] = useState(true);
  const [expandedAppointments, setExpandedAppointments] = useState(true); 
  const [expandedProcedures, setExpandedProcedures] = useState(true);
  
  const [pendingCount, setPendingCount] = useState(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [recentCompletedProcedures, setRecentCompletedProcedures] = useState([]);
  
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [loadingProcedures, setLoadingProcedures] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);
  
  const [totalPatients, setTotalPatients] = useState(0);

  // Cargar datos al montar el componente
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Función principal para cargar todos los datos del dashboard
  const loadDashboardData = async () => {
    try {
      await Promise.all([
        loadPatientsCount(),
        loadPendingAppointmentsCount(),
        loadUpcomingAppointments(),
        loadRecentCompletedProcedures()
      ]);
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
    }
  };

  // Cargar conteo de pacientes
  const loadPatientsCount = async () => {
    setLoadingPatients(true);
    try {
      const result = await fetchPatients(1, '');
      if (result && result.total) {
        setTotalPatients(result.total);
      }
    } catch (error) {
      console.error('Error cargando pacientes:', error);
    } finally {
      setLoadingPatients(false);
    }
  };

  // Cargar citas pendientes - VERSIÓN CORREGIDA
  const loadPendingAppointmentsCount = async () => {
    setLoadingPending(true);
    try {
      // Usar el mismo fetchAppointments pero con filtro de estado
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      
      // Obtener todas las citas programadas (sin límite de fecha)
      const response = await apiFetch('/appointments?state=scheduled&limit=1000');
      
      if (response && response.data) {
        // Contar todas las citas con estado 'scheduled'
        const pending = response.data.filter(apt => apt.state === 'scheduled');
        setPendingCount(pending.length);
      } else {
        setPendingCount(0);
      }
    } catch (error) {
      console.error('Error cargando citas pendientes:', error);
      setPendingCount(0);
    } finally {
      setLoadingPending(false);
    }
  };

  // Cargar próximas citas (7 días) - VERSIÓN CORREGIDA (fechas)
  const loadUpcomingAppointments = async () => {
    setLoadingAppointments(true);
    try {
      const appointments = await getUpcomingAppointments();
      
      // Procesar y ordenar citas - con validación mejorada de fechas
      const processedAppointments = appointments
        .filter(apt => apt && apt.appointment_date)
        .map(apt => {
          // Crear fecha de manera segura
          let dateTime = null;
          let timeStr = '--:--';
          let dateStr = 'Fecha inválida';
          let isTodayFlag = false;
          
          try {
            // Intentar parsear la fecha
            const rawDate = apt.appointment_date;
            // Si viene en formato "DD/MM/YYYY HH:MM:SS AM/PM" del backend
            if (typeof rawDate === 'string' && rawDate.includes('/')) {
              const [datePart, timePart] = rawDate.split(' ');
              const [day, month, year] = datePart.split('/');
              dateTime = new Date(`${year}-${month}-${day}T${convertTimeToISO(timePart)}`);
            } else {
              dateTime = new Date(rawDate);
            }
            
            if (!isNaN(dateTime.getTime())) {
              timeStr = formatNicaraguaTime(dateTime);
              dateStr = formatNicaraguaDate(dateTime);
              isTodayFlag = isToday(dateTime);
            }
          } catch (e) {
            console.warn('Error parseando fecha:', apt.appointment_date, e);
          }
          
          return {
            id: apt.appointment_ID || apt.id || Math.random(),
            patient: apt.patient_name || apt.patients?.first_name || 'Paciente',
            dateTime: dateTime,
            time: timeStr,
            date: dateStr,
            procedure: apt.query_type || 'Consulta',
            status: apt.state || 'scheduled',
            notes: apt.observations || '',
            isToday: isTodayFlag,
            rawDate: apt.appointment_date // Para debugging
          };
        })
        .filter(apt => apt.dateTime !== null) // Solo mantener fechas válidas
        .sort((a, b) => a.dateTime - b.dateTime); // Ordenar por fecha más cercana
      
      setUpcomingAppointments(processedAppointments);
    } catch (error) {
      console.error('Error cargando próximas citas:', error);
    } finally {
      setLoadingAppointments(false);
    }
  };

  // Función auxiliar para convertir tiempo AM/PM a formato ISO
  const convertTimeToISO = (timeStr) => {
    if (!timeStr) return '00:00:00';
    
    const match = timeStr.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return timeStr;
    
    let [_, hours, minutes, seconds, meridian] = match;
    hours = parseInt(hours);
    
    if (meridian.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (meridian.toUpperCase() === 'AM' && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`;
  };

  // Cargar últimos 10 procedimientos completados - VERSIÓN CORREGIDA (fechas)
  const loadRecentCompletedProcedures = async () => {
    setLoadingProcedures(true);
    try {
      // Obtener procedimientos normales completados
      const normalResult = await fetchProceduresNormal({ 
        state: 'completed', 
        limit: 15
      });
      
      // Obtener ortodoncias completadas
      const orthoResult = await fetchOrthodontics({ 
        state: 'completed', 
        limit: 15 
      });

      // Procesar y combinar procedimientos
      const allProcedures = [];
      
      // Agregar procedimientos normales
      if (normalResult.success && normalResult.data) {
        normalResult.data.forEach(proc => {
          allProcedures.push({
            ...proc,
            procedure_type: 'General',
            total_amount: proc.total_procedure || proc.total_cost || 0,
            clinic_amount: proc.clinic_payment_cordobas || proc.total_procedure || 0,
            isOrthodontics: false
          });
        });
      }
      
      // Agregar ortodoncias
      if (orthoResult.success && orthoResult.data) {
        orthoResult.data.forEach(proc => {
          const totalAmount = proc.total_procedure || proc.total_cost || 0;
          const clinicAmount = proc.clinic_payment_cordobas || (totalAmount * 0.4) || 0;
          const doctorAmount = proc.doctor_payment_cordobas || (totalAmount * 0.6) || 0;
          
          allProcedures.push({
            ...proc,
            procedure_type: 'Ortodoncia',
            total_amount: totalAmount,
            clinic_amount: clinicAmount,
            doctor_amount: doctorAmount,
            isOrthodontics: true
          });
        });
      }
      
      // Filtrar solo los que tienen fecha válida y formatear
      const validProcedures = allProcedures
        .filter(proc => {
          if (!proc.procedure_date) return false;
          try {
            const date = new Date(proc.procedure_date);
            return !isNaN(date.getTime());
          } catch {
            return false;
          }
        })
        .map(proc => {
          let formattedDate = 'Fecha inválida';
          try {
            const date = new Date(proc.procedure_date);
            if (!isNaN(date.getTime())) {
              formattedDate = formatFullDateTime(date);
            }
          } catch (e) {
            console.warn('Error formateando fecha de procedimiento:', proc.procedure_date);
          }
          
          return {
            ...proc,
            formattedDate
          };
        })
        .sort((a, b) => new Date(b.procedure_date) - new Date(a.procedure_date))
        .slice(0, 10);
      
      setRecentCompletedProcedures(validProcedures);
    } catch (error) {
      console.error('Error al obtener procedimientos completados:', error);
    } finally {
      setLoadingProcedures(false);
    }
  };

  // Funciones auxiliares para fechas (versiones que aceptan Date object)
  const formatNicaraguaTime = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '--:--';
    
    return date.toLocaleTimeString('es-NI', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toLowerCase().replace('a. m.', 'AM').replace('p. m.', 'PM');
  };

  const formatNicaraguaDate = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'Fecha inválida';
    
    return date.toLocaleDateString('es-NI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatFullDateTime = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'Fecha inválida';
    
    return `${formatNicaraguaDate(date)} ${formatNicaraguaTime(date)}`;
  };

  const isToday = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
    
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const getDayName = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (isToday(date)) return 'Hoy';
    if (date.getDate() === tomorrow.getDate() && 
        date.getMonth() === tomorrow.getMonth() && 
        date.getFullYear() === tomorrow.getFullYear()) {
      return 'Mañana';
    }
    
    return date.toLocaleDateString('es-NI', { weekday: 'long' });
  };

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

  // Stats para mostrar
  const dashboardStats = [
    { 
      id: 1, 
      title: 'Total Pacientes', 
      value: totalPatients, 
      icon: faUsers, 
      color: '#2196F3',
      loading: loadingPatients
    },
    { 
      id: 2, 
      title: 'Citas Pendientes', 
      value: pendingCount, 
      icon: faClock, 
      color: '#FF9800',
      loading: loadingPending
    }
  ];

  return (
    <div className="page-content">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Bienvenido, {user?.username || user?.name || user?.email || 'Doctor'}</h1>
          <p className="dashboard-subtitle">
            <FontAwesomeIcon icon={faSmile} style={{ marginRight: '8px' }} />
            {new Date().toLocaleDateString('es-NI', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>
      
      {/* SECCIÓN 1: ESTADÍSTICAS */}
      <div className="dashboard-section collapsible-section">
        <div className="section-header clickable-header" onClick={() => setExpandedStats(!expandedStats)}>
          <div className="section-header-content">
            <h3 className="section-title">
              <FontAwesomeIcon icon={faChartBar} />
              Estadísticas Generales
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
                  {stat.loading ? (
                    <div className="card-loading">
                      <FontAwesomeIcon icon={faSpinner} spin />
                    </div>
                  ) : (
                    <div className="card-value">{stat.value}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* SECCIÓN 2: DOS COLUMNAS */}
      <div className="dashboard-sections">
        {/* PRÓXIMAS CITAS (7 DÍAS) */}
        <div className="dashboard-section collapsible-section">
          <div className="section-header clickable-header" onClick={() => setExpandedAppointments(!expandedAppointments)}>
            <div className="section-header-content">
              <h3 className="section-title">
                <FontAwesomeIcon icon={faCalendarCheck} />
                Próximas Citas (7 días)
              </h3>
              <div className="section-summary">
                <span className="summary-badge">{upcomingAppointments.length}</span>
              </div>
            </div>
            <FontAwesomeIcon 
              icon={expandedAppointments ? faChevronUp : faChevronDown} 
              className="toggle-icon"
            />
          </div>
          
          <div className={`section-content ${expandedAppointments ? 'expanded' : 'collapsed'}`}>
            {loadingAppointments ? (
              <div className="loading-procedures">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                <p>Cargando citas...</p>
              </div>
            ) : upcomingAppointments.length > 0 ? (
              <div className="appointments-list">
                {upcomingAppointments.map((appointment) => (
                  <div key={appointment.id} className="appointment-card">
                    <div className="appointment-time-section">
                      <div className={`appointment-day-badge ${appointment.isToday ? 'today' : ''}`}>
                        {getDayName(appointment.dateTime)}
                      </div>
                      <div className="appointment-time">
                        <FontAwesomeIcon icon={faClock} />
                        <strong>{appointment.time}</strong>
                      </div>
                      <div className="appointment-date">
                        {appointment.date}
                      </div>
                    </div>
                    
                    <div className="appointment-info">
                      <div className="patient-name">
                        <strong>{appointment.patient}</strong>
                      </div>
                      <div className="appointment-details">
                        <span className="procedure">
                          <FontAwesomeIcon icon={faTooth} />
                          {appointment.procedure}
                        </span>
                      </div>
                    </div>
                    
                    <div 
                      className="appointment-status" 
                      style={{ backgroundColor: getStatusColor(appointment.status) }}
                    >
                      {getStatusLabel(appointment.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <FontAwesomeIcon icon={faCalendarCheck} size="3x" />
                </div>
                <p>No hay citas programadas para los próximos 7 días</p>
              </div>
            )}
          </div>
        </div>
        
        {/* ÚLTIMOS 10 PROCEDIMIENTOS COMPLETADOS */}
        <div className="dashboard-section collapsible-section">
          <div className="section-header clickable-header" onClick={() => setExpandedProcedures(!expandedProcedures)}>
            <div className="section-header-content">
              <h3 className="section-title">
                <FontAwesomeIcon icon={faTooth} />
                Últimos 10 Procedimientos Completados
              </h3>
              <div className="section-summary">
                <span className="summary-badge">{recentCompletedProcedures.length}</span>
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
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                <p>Cargando procedimientos...</p>
              </div>
            ) : recentCompletedProcedures.length > 0 ? (
              <div className="procedures-list">
                {recentCompletedProcedures.map((procedure) => (
                  <div key={procedure.procedure_ID || procedure.id} className="procedure-card">
                    <div className="procedure-icon" style={{ 
                      backgroundColor: procedure.isOrthodontics ? '#9C27B020' : '#2196F320',
                      color: procedure.isOrthodontics ? '#9C27B0' : '#2196F3'
                    }}>
                      <FontAwesomeIcon icon={procedure.isOrthodontics ? faUserMd : faTooth} />
                    </div>
                    
                    <div className="procedure-info">
                      <div className="procedure-header">
                        <div className="procedure-patient">
                          <strong>
                            {procedure.patient_name || 
                             procedure.patients?.first_name || 
                             'Paciente'}
                          </strong>
                          <span className={`procedure-type-badge ${procedure.isOrthodontics ? 'orthodontics' : 'general'}`}>
                            {procedure.procedure_type}
                          </span>
                        </div>
                        
                        <div className="procedure-amount-section">
                          <span className="procedure-amount" title="Total del procedimiento">
                            {formatCurrency(procedure.total_amount)}
                          </span>
                          
                          {procedure.isOrthodontics && (
                            <div className="ortho-breakdown">
                              <small className="clinic-portion" title="Porción Clínica (40%)">
                                Clínica: {formatCurrency(procedure.clinic_amount || 0)}
                              </small>
                              <small className="doctor-portion" title="Porción Doctora (60%)">
                                Doctora: {formatCurrency(procedure.doctor_amount || 0)}
                              </small>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <p className="procedure-description" title={procedure.procedure_description}>
                        {procedure.procedure_description?.length > 60 
                          ? `${procedure.procedure_description.substring(0, 60)}...` 
                          : procedure.procedure_description || 'Procedimiento dental'}
                      </p>
                      
                      <div className="procedure-footer">
                        <div className="procedure-date">
                          <FontAwesomeIcon icon={faClock} />
                          {procedure.formattedDate || 'Fecha inválida'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <FontAwesomeIcon icon={faTooth} size="3x" />
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

export default DashboardPage;