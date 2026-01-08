// frontend/src/pages/DashboardPage.jsx
import React, { useContext, useEffect } from 'react';
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
  faReceipt
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
    fetchProcedures 
  } = useContext(AppContext);

  useEffect(() => {
    if (user) {
      // Obtener citas de hoy
      const today = new Date().toISOString().split('T')[0];
      fetchAppointments({ startDate: today, endDate: today });
      
      // Obtener procedimientos recientes
      fetchProcedures({ page: 1, limit: 5 });
    }
  }, [user]);

  const dashboardStats = [
    { 
      id: 1, 
      title: 'Pacientes Activos', 
      value: stats.totalPatients, 
      icon: faUsers, 
      color: '#42A5F5',
      change: '+12.5%'
    },
    { 
      id: 2, 
      title: 'Citas Hoy', 
      value: stats.todayAppointments, 
      icon: faCalendarCheck, 
      color: '#4DB6AC',
      change: '+3'
    },
    { 
      id: 3, 
      title: 'Ingresos Mes', 
      value: formatCurrency(stats.monthlyIncome), 
      icon: faMoneyBillWave, 
      color: '#66BB6A',
      change: '+8.2%'
    },
    { 
      id: 4, 
      title: 'Procedimientos', 
      value: stats.totalProcedures, 
      icon: faTooth, 
      color: '#FFA726',
      change: '+15'
    },
    { 
      id: 5, 
      title: 'Pendientes', 
      value: stats.pendingProcedures, 
      icon: faClock, 
      color: '#EF5350',
      change: '-2'
    },
    { 
      id: 6, 
      title: 'Gastos Mes', 
      value: formatCurrency(stats.totalExpenses), 
      icon: faReceipt, 
      color: '#AB47BC',
      change: '-4.3%'
    }
  ];

  const upcomingAppointments = appointments.slice(0, 5).map(apt => ({
    id: apt.appointment_ID,
    patient: apt.patient_name || 'Paciente',
    time: new Date(apt.appointment_date).toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    procedure: apt.query_type || 'Consulta',
    status: apt.state || 'scheduled',
    identification: apt.patient_identification
  }));

  const recentProcedures = procedures.slice(0, 5).map(proc => ({
    id: proc.procedure_ID,
    patient: proc.patient_name || 'Paciente',
    description: proc.procedure_description,
    amount: formatCurrency(proc.total_cost),
    date: formatDate(proc.procedure_date),
    type: proc.is_orthodontics ? 'Ortodoncia' : 'General'
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
            Hoy es {formatDate(new Date())}
          </p>
        </div>
      </div>
      
      {/* Estadísticas */}
      <div className="dashboard-grid">
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
              <p className="card-change" style={{ color: stat.change.startsWith('+') ? '#66BB6A' : '#EF5350' }}>
                {stat.change} este mes
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Secciones inferiores */}
      <div className="dashboard-sections">
        {/* Próximas Citas */}
        <div className="section">
          <div className="section-header">
            <h3>
              <FontAwesomeIcon icon={faCalendarCheck} style={{ marginRight: '10px' }} />
              Próximas Citas de Hoy
            </h3>
            <span className="section-badge">{upcomingAppointments.length}</span>
          </div>
          <div className="section-content">
            {upcomingAppointments.length > 0 ? (
              upcomingAppointments.map((appointment) => (
                <div key={appointment.id} className="appointment-card">
                  <div className="appointment-time">
                    <strong>{appointment.time}</strong>
                  </div>
                  <div className="appointment-info">
                    <div className="patient-name">{appointment.patient}</div>
                    <div className="appointment-details">
                      <span className="procedure">{appointment.procedure}</span>
                      <span className="identification">ID: {appointment.identification}</span>
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
              ))
            ) : (
              <div className="empty-state">
                <p>No hay citas programadas para hoy</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Procedimientos Recientes */}
        <div className="section">
          <div className="section-header">
            <h3>
              <FontAwesomeIcon icon={faTooth} style={{ marginRight: '10px' }} />
              Procedimientos Recientes
            </h3>
            <span className="section-badge">{recentProcedures.length}</span>
          </div>
          <div className="section-content">
            {recentProcedures.length > 0 ? (
              recentProcedures.map((procedure) => (
                <div key={procedure.id} className="procedure-card">
                  <div className="procedure-icon">
                    <FontAwesomeIcon icon={procedure.type === 'Ortodoncia' ? faUserMd : faTooth} />
                  </div>
                  <div className="procedure-info">
                    <div className="procedure-header">
                      <strong>{procedure.patient}</strong>
                      <span className="procedure-amount">{procedure.amount}</span>
                    </div>
                    <p className="procedure-description">{procedure.description}</p>
                    <div className="procedure-footer">
                      <span className="procedure-type">{procedure.type}</span>
                      <span className="procedure-date">{procedure.date}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>No hay procedimientos recientes</p>
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