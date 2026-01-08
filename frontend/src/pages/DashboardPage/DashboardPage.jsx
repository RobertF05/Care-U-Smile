import React, { useContext } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faUsers, 
  faCalendarCheck, 
  faMoneyBillWave, 
  faChartLine,
  faTooth,
  faUserMd,
  faClock,
  faSmile
} from '@fortawesome/free-solid-svg-icons'
import { AuthContext } from '../../context/AuthContext'

const DashboardPage = () => {
  const { user } = useContext(AuthContext)
  
  const stats = [
    { id: 1, title: 'Pacientes Activos', value: '156', icon: faUsers, color: 'var(--primary-blue)' },
    { id: 2, title: 'Citas Hoy', value: '24', icon: faCalendarCheck, color: 'var(--accent-teal)' },
    { id: 3, title: 'Ingresos Mes', value: '$45,820', icon: faMoneyBillWave, color: 'var(--success-green)' },
    { id: 4, title: 'Procedimientos', value: '89', icon: faTooth, color: 'var(--primary-blue-dark)' },
    { id: 5, title: 'Tratamientos Activos', value: '67', icon: faUserMd, color: 'var(--accent-teal-dark)' },
    { id: 6, title: 'Tasa de Crecimiento', value: '+12.5%', icon: faChartLine, color: 'var(--warning-orange)' }
  ]

  const upcomingAppointments = [
    { id: 1, patient: 'Juan Pérez', time: '09:00 AM', procedure: 'Limpieza dental', status: 'confirmada' },
    { id: 2, patient: 'María García', time: '10:30 AM', procedure: 'Ortodoncia', status: 'confirmada' },
    { id: 3, patient: 'Carlos López', time: '02:00 PM', procedure: 'Extracción', status: 'pendiente' }
  ]

  return (
    <div className="page-content">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Bienvenido, {user?.name || 'Doctor'}</h1>
          <p className="dashboard-subtitle">
            <FontAwesomeIcon icon={faSmile} style={{ marginRight: '8px' }} />
            Hoy es {new Date().toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>
      
      <div className="dashboard-grid">
        {stats.map((stat) => (
          <div key={stat.id} className="dashboard-card">
            <div className="card-header">
              <div className="card-icon-wrapper" style={{ backgroundColor: `${stat.color}20` }}>
                <FontAwesomeIcon icon={stat.icon} style={{ color: stat.color }} />
              </div>
              <h3 className="card-title">{stat.title}</h3>
            </div>
            <div className="card-body">
              <div className="card-value">{stat.value}</div>
              <p className="card-description">
                <FontAwesomeIcon icon={faClock} style={{ marginRight: '5px' }} />
                Actualizado hoy
              </p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="dashboard-sections">
        <div className="section">
          <h3>📅 Próximas Citas</h3>
          <div className="section-content">
            {upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="appointment-card">
                <div className="appointment-time">
                  <strong>{appointment.time}</strong>
                </div>
                <div className="appointment-info">
                  <div className="patient-name">{appointment.patient}</div>
                  <div className="procedure">{appointment.procedure}</div>
                </div>
                <div className={`appointment-status status-${appointment.status}`}>
                  {appointment.status}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="section">
          <h3>📋 Recordatorios Importantes</h3>
          <div className="section-content">
            <div className="reminder-card">
              <div className="reminder-icon">!</div>
              <div className="reminder-content">
                <strong>Inventario bajo de anestesia local</strong>
                <p>Quedan solo 5 unidades. Realizar pedido.</p>
              </div>
            </div>
            <div className="reminder-card">
              <div className="reminder-icon">📋</div>
              <div className="reminder-content">
                <strong>Revisión de equipos mensual</strong>
                <p>Programar mantenimiento para la próxima semana.</p>
              </div>
            </div>
            <div className="reminder-card">
              <div className="reminder-icon">👥</div>
              <div className="reminder-content">
                <strong>Pacientes sin cita en 6 meses</strong>
                <p>12 pacientes requieren seguimiento.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage