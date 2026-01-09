import React, { useState, useEffect, useMemo, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarAlt,
  faCalendarDay,
  faCalendarWeek,
  faCalendar,
  faFilter,
  faTimes,
  faSearch,
  faPlus,
  faTooth,
  faUserMd,
  faCheckCircle,
  faTimesCircle,
  faClock,
  faUser,
  faPhone,
  faIdCard,
  faStethoscope,
  faChevronDown,
  faChevronUp,
  faEdit,
  faTrash,
  faCalendarCheck,
  faExchangeAlt,
  faMoneyBillWave,
  faCreditCard
} from '@fortawesome/free-solid-svg-icons';
import { AppContext } from '../../context/AppContext';
import { AuthContext } from '../../context/AuthContext';
import './AppointmentPage.css';

// Filtros de tiempo
const TIME_FILTERS = {
  TODAY: 'today',
  THIS_WEEK: 'thisWeek',
  THIS_MONTH: 'thisMonth',
  ALL: 'all'
};

// Estados de citas
const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
};

// Métodos de pago
const PAYMENT_METHODS = [
  'Efectivo',
  'Tarjeta',
  'Transferencia',
  'Cheque',
  'Crédito'
];

const AppointmentPage = () => {
  const { user } = useContext(AuthContext);
  const { 
    appointments, 
    patients, 
    loading, 
    fetchAppointments, 
    createAppointment,
    updateAppointment,
    deleteAppointment,
    fetchPatients
  } = useContext(AppContext);

  // Estados
  const [timeFilter, setTimeFilter] = useState(TIME_FILTERS.TODAY);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [expandedAppointments, setExpandedAppointments] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  
  // Formulario de nueva cita
  const [newAppointment, setNewAppointment] = useState({
    patient_id: '',
    appointment_date: '',
    query_type: '',
    is_orthodontics: false,
    observations: ''
  });

  // Formulario para convertir a procedimiento
  const [procedureForm, setProcedureForm] = useState({
    procedure_description: '',
    total_cost: '',
    payment_method: 'Efectivo',
    observations: ''
  });

  // Cargar datos iniciales
  useEffect(() => {
    if (user) {
      fetchAppointments();
      fetchPatients();
    }
  }, [user]);

  // Filtrar citas
  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments];

    // Filtrar por tiempo
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (timeFilter) {
      case TIME_FILTERS.TODAY:
        filtered = filtered.filter(apt => {
          const aptDate = new Date(apt.appointment_date);
          return aptDate >= today && aptDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
        });
        break;
      case TIME_FILTERS.THIS_WEEK:
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        filtered = filtered.filter(apt => {
          const aptDate = new Date(apt.appointment_date);
          return aptDate >= lastWeek;
        });
        break;
      case TIME_FILTERS.THIS_MONTH:
        const lastMonth = new Date(today);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        filtered = filtered.filter(apt => {
          const aptDate = new Date(apt.appointment_date);
          return aptDate >= lastMonth;
        });
        break;
      default:
        break;
    }

    // Filtrar por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.state === statusFilter);
    }

    // Filtrar por tipo (ortodoncia/convencional)
    if (typeFilter !== 'all') {
      const isOrtho = typeFilter === 'orthodontics';
      filtered = filtered.filter(apt => apt.is_orthodontics === isOrtho);
    }

    // Filtrar por búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(apt => {
        const patientName = (apt.patient_name || '').toLowerCase();
        const queryType = (apt.query_type || '').toLowerCase();
        const appointmentDate = formatDateTime(apt.appointment_date).toLowerCase();
        
        return patientName.includes(term) || 
               queryType.includes(term) || 
               appointmentDate.includes(term);
      });
    }

    // Ordenar por fecha (más próxima primero)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.appointment_date);
      const dateB = new Date(b.appointment_date);
      return dateA - dateB;
    });
  }, [appointments, timeFilter, statusFilter, typeFilter, searchTerm]);

  // Estadísticas
  const stats = useMemo(() => {
    const total = appointments.length;
    const today = appointments.filter(apt => {
      const aptDate = new Date(apt.appointment_date);
      const today = new Date();
      return aptDate.getDate() === today.getDate() &&
             aptDate.getMonth() === today.getMonth() &&
             aptDate.getFullYear() === today.getFullYear();
    }).length;

    const completed = appointments.filter(apt => apt.state === APPOINTMENT_STATUS.COMPLETED).length;
    const cancelled = appointments.filter(apt => apt.state === APPOINTMENT_STATUS.CANCELLED).length;
    const pending = appointments.filter(apt => 
      apt.state === APPOINTMENT_STATUS.SCHEDULED || 
      apt.state === APPOINTMENT_STATUS.CONFIRMED
    ).length;

    const orthodontics = appointments.filter(apt => apt.is_orthodontics).length;
    const general = total - orthodontics;

    return {
      total,
      today,
      completed,
      cancelled,
      pending,
      orthodontics,
      general
    };
  }, [appointments]);

  // Formateadores
  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency: 'CRC'
    }).format(amount || 0);
  };

  // Funciones para citas
  const toggleExpandAppointment = (appointmentId) => {
    setExpandedAppointments(prev => ({
      ...prev,
      [appointmentId]: !prev[appointmentId]
    }));
  };

  // Crear nueva cita
  const handleAddAppointment = async (e) => {
    e.preventDefault();
    
    try {
      // Preparar datos
      const appointmentData = {
        Patient_ID: parseInt(newAppointment.patient_id),
        appointment_date: new Date(newAppointment.appointment_date).toISOString(),
        query_type: newAppointment.query_type,
        is_orthodontics: newAppointment.is_orthodontics,
        observations: newAppointment.observations || null
      };

      console.log('📤 Enviando datos de cita:', appointmentData);
      
      await createAppointment(appointmentData);
      
      // Resetear formulario
      setNewAppointment({
        patient_id: '',
        appointment_date: '',
        query_type: '',
        is_orthodontics: false,
        observations: ''
      });
      
      setShowAddModal(false);
      fetchAppointments();
      
      alert('✅ Cita creada exitosamente');
      
    } catch (error) {
      console.error('Error al crear cita:', error);
      alert(`❌ Error al crear la cita: ${error.message || 'Error desconocido'}`);
    }
  };

  // Actualizar cita (solo estado)
  const handleUpdateAppointment = async (appointmentId, newState) => {
    try {
      await updateAppointment(appointmentId, { state: newState });
      fetchAppointments();
      
      let message = '';
      switch(newState) {
        case 'confirmed':
          message = '✅ Cita confirmada';
          break;
        case 'completed':
          message = '✅ Cita completada';
          break;
        case 'cancelled':
          message = '❌ Cita cancelada';
          break;
        case 'no_show':
          message = '⚠️ Marcada como no asistió';
          break;
      }
      
      if (message) alert(message);
    } catch (error) {
      console.error('Error al actualizar cita:', error);
      alert('Error al actualizar la cita');
    }
  };

  // Eliminar cita
  const handleDeleteAppointment = async (appointmentId) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta cita?')) {
      try {
        await deleteAppointment(appointmentId);
        fetchAppointments();
        alert('✅ Cita eliminada');
      } catch (error) {
        console.error('Error al eliminar cita:', error);
        alert('Error al eliminar la cita');
      }
    }
  };

  // Convertir cita en procedimiento
  const handleConvertToProcedure = async (e) => {
    e.preventDefault();
    
    if (!selectedAppointment) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/appointments/${selectedAppointment.appointment_ID}/convert-to-procedure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...procedureForm,
          total_cost: parseFloat(procedureForm.total_cost)
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Error al registrar procedimiento');
      }
      
      // Cerrar modal y resetear formulario
      setShowConvertModal(false);
      setProcedureForm({
        procedure_description: '',
        total_cost: '',
        payment_method: 'Efectivo',
        observations: ''
      });
      
      // Recargar citas
      fetchAppointments();
      
      // Mostrar mensaje de éxito
      alert(result.message || '✅ Procedimiento registrado exitosamente');
      
      // Redirigir a la página correspondiente
      if (selectedAppointment.is_orthodontics) {
        window.location.href = '/orthodontics';
      } else {
        window.location.href = '/procedures';
      }
      
    } catch (error) {
      console.error('Error al registrar procedimiento:', error);
      alert(`❌ Error: ${error.message}`);
    }
  };

  // Abrir modal para convertir cita
  const openConvertModal = (appointment) => {
    if (appointment.state !== 'completed') {
      alert('Solo se pueden registrar procedimientos de citas completadas');
      return;
    }
    
    setSelectedAppointment(appointment);
    setProcedureForm({
      procedure_description: appointment.query_type || '',
      total_cost: '',
      payment_method: 'Efectivo',
      observations: appointment.observations || ''
    });
    setShowConvertModal(true);
  };

  // Abrir modal para editar cita
  const openEditModal = (appointment) => {
    setSelectedAppointment(appointment);
    setShowEditModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      [APPOINTMENT_STATUS.SCHEDULED]: '#FFA726', // naranja
      [APPOINTMENT_STATUS.CONFIRMED]: '#42A5F5', // azul
      [APPOINTMENT_STATUS.COMPLETED]: '#66BB6A', // verde
      [APPOINTMENT_STATUS.CANCELLED]: '#EF5350', // rojo
      [APPOINTMENT_STATUS.NO_SHOW]: '#78909C'    // gris
    };
    return colors[status] || '#78909C';
  };

  const getStatusIcon = (status) => {
    const icons = {
      [APPOINTMENT_STATUS.SCHEDULED]: faClock,
      [APPOINTMENT_STATUS.CONFIRMED]: faCalendarCheck,
      [APPOINTMENT_STATUS.COMPLETED]: faCheckCircle,
      [APPOINTMENT_STATUS.CANCELLED]: faTimesCircle,
      [APPOINTMENT_STATUS.NO_SHOW]: faTimesCircle
    };
    return icons[status] || faClock;
  };

  const getStatusLabel = (status) => {
    const labels = {
      [APPOINTMENT_STATUS.SCHEDULED]: 'Programada',
      [APPOINTMENT_STATUS.CONFIRMED]: 'Confirmada',
      [APPOINTMENT_STATUS.COMPLETED]: 'Completada',
      [APPOINTMENT_STATUS.CANCELLED]: 'Cancelada',
      [APPOINTMENT_STATUS.NO_SHOW]: 'No asistió'
    };
    return labels[status] || status;
  };

  const getTypeIcon = (isOrthodontics) => {
    return isOrthodontics ? faUserMd : faTooth;
  };

  const getTypeLabel = (isOrthodontics) => {
    return isOrthodontics ? 'Ortodoncia' : 'General';
  };

  const getTypeColor = (isOrthodontics) => {
    return isOrthodontics ? '#4DB6AC' : '#42A5F5';
  };

  if (loading && appointments.length === 0) {
    return (
      <div className="appointments-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando citas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="appointments-container">
      {/* Header */}
      <div className="appointments-header">
        <div className="header-left">
          <h2>
            <FontAwesomeIcon icon={faCalendarAlt} className="header-icon" />
            Gestión de Citas
          </h2>
          <p className="subtitle">Programación y seguimiento de citas odontológicas</p>
        </div>
        <div className="header-right">
          <div className="appointments-count">
            <span className="count-number">{stats.total}</span>
            <span className="count-label">citas totales</span>
          </div>
          <button 
            className="add-appointment-btn"
            onClick={() => setShowAddModal(true)}
          >
            <FontAwesomeIcon icon={faPlus} />
            Nueva Cita
          </button>
          <button 
            className="filter-toggle-btn"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FontAwesomeIcon icon={faFilter} />
            {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
          </button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="filter-section">
          <div className="filter-header">
            <h3>
              <FontAwesomeIcon icon={faFilter} />
              Filtrar citas
            </h3>
            <button 
              className="close-filter-btn"
              onClick={() => setShowFilters(false)}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          
          <div className="filter-controls">
            {/* Filtro de tiempo */}
            <div className="filter-group">
              <label className="filter-label">Periodo:</label>
              <div className="time-filter-buttons">
                <button 
                  className={`time-filter-btn ${timeFilter === TIME_FILTERS.TODAY ? 'active' : ''}`}
                  onClick={() => setTimeFilter(TIME_FILTERS.TODAY)}
                >
                  <FontAwesomeIcon icon={faCalendarDay} />
                  Hoy
                </button>
                <button 
                  className={`time-filter-btn ${timeFilter === TIME_FILTERS.THIS_WEEK ? 'active' : ''}`}
                  onClick={() => setTimeFilter(TIME_FILTERS.THIS_WEEK)}
                >
                  <FontAwesomeIcon icon={faCalendarWeek} />
                  Esta semana
                </button>
                <button 
                  className={`time-filter-btn ${timeFilter === TIME_FILTERS.THIS_MONTH ? 'active' : ''}`}
                  onClick={() => setTimeFilter(TIME_FILTERS.THIS_MONTH)}
                >
                  <FontAwesomeIcon icon={faCalendar} />
                  Este mes
                </button>
                <button 
                  className={`time-filter-btn ${timeFilter === TIME_FILTERS.ALL ? 'active' : ''}`}
                  onClick={() => setTimeFilter(TIME_FILTERS.ALL)}
                >
                  Todas
                </button>
              </div>
            </div>

            {/* Filtro de estado */}
            <div className="filter-group">
              <label className="filter-label">Estado:</label>
              <div className="status-filter-buttons">
                <button 
                  className={`status-filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  Todos
                </button>
                <button 
                  className={`status-filter-btn ${statusFilter === APPOINTMENT_STATUS.SCHEDULED ? 'active' : ''}`}
                  onClick={() => setStatusFilter(APPOINTMENT_STATUS.SCHEDULED)}
                  style={{ backgroundColor: '#FFA72620', color: '#FFA726' }}
                >
                  <FontAwesomeIcon icon={faClock} />
                  Programadas
                </button>
                <button 
                  className={`status-filter-btn ${statusFilter === APPOINTMENT_STATUS.CONFIRMED ? 'active' : ''}`}
                  onClick={() => setStatusFilter(APPOINTMENT_STATUS.CONFIRMED)}
                  style={{ backgroundColor: '#42A5F520', color: '#42A5F5' }}
                >
                  <FontAwesomeIcon icon={faCalendarCheck} />
                  Confirmadas
                </button>
                <button 
                  className={`status-filter-btn ${statusFilter === APPOINTMENT_STATUS.COMPLETED ? 'active' : ''}`}
                  onClick={() => setStatusFilter(APPOINTMENT_STATUS.COMPLETED)}
                  style={{ backgroundColor: '#66BB6A20', color: '#66BB6A' }}
                >
                  <FontAwesomeIcon icon={faCheckCircle} />
                  Completadas
                </button>
              </div>
            </div>

            {/* Filtro de tipo */}
            <div className="filter-group">
              <label className="filter-label">Tipo:</label>
              <div className="type-filter-buttons">
                <button 
                  className={`type-filter-btn ${typeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setTypeFilter('all')}
                >
                  Todos
                </button>
                <button 
                  className={`type-filter-btn ${typeFilter === 'orthodontics' ? 'active' : ''}`}
                  onClick={() => setTypeFilter('orthodontics')}
                  style={{ backgroundColor: '#4DB6AC20', color: '#4DB6AC' }}
                >
                  <FontAwesomeIcon icon={faUserMd} />
                  Ortodoncia
                </button>
                <button 
                  className={`type-filter-btn ${typeFilter === 'general' ? 'active' : ''}`}
                  onClick={() => setTypeFilter('general')}
                  style={{ backgroundColor: '#42A5F520', color: '#42A5F5' }}
                >
                  <FontAwesomeIcon icon={faTooth} />
                  General
                </button>
              </div>
            </div>

            {/* Búsqueda */}
            <div className="filter-group">
              <label className="filter-label">Buscar:</label>
              <div className="search-box">
                <FontAwesomeIcon icon={faSearch} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar por paciente, servicio o fecha..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                {searchTerm && (
                  <button 
                    className="clear-search-btn"
                    onClick={() => setSearchTerm('')}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estadísticas */}
      <div className="appointments-stats">
        <div className="stat-card total">
          <div className="stat-icon">
            <FontAwesomeIcon icon={faCalendarAlt} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Citas Totales</div>
          </div>
        </div>
        
        <div className="stat-card today">
          <div className="stat-icon">
            <FontAwesomeIcon icon={faCalendarDay} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.today}</div>
            <div className="stat-label">Hoy</div>
          </div>
        </div>
        
        <div className="stat-card pending">
          <div className="stat-icon">
            <FontAwesomeIcon icon={faClock} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pendientes</div>
          </div>
        </div>
        
        <div className="stat-card completed">
          <div className="stat-icon">
            <FontAwesomeIcon icon={faCheckCircle} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.completed}</div>
            <div className="stat-label">Completadas</div>
          </div>
        </div>
        
        <div className="stat-card orthodontics">
          <div className="stat-icon">
            <FontAwesomeIcon icon={faUserMd} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.orthodontics}</div>
            <div className="stat-label">Ortodoncia</div>
          </div>
        </div>
        
        <div className="stat-card general">
          <div className="stat-icon">
            <FontAwesomeIcon icon={faTooth} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.general}</div>
            <div className="stat-label">General</div>
          </div>
        </div>
      </div>

      {/* Lista de citas */}
      {filteredAppointments.length === 0 ? (
        <div className="no-appointments">
          <div className="no-appointments-icon">
            <FontAwesomeIcon icon={faCalendarAlt} />
          </div>
          <h3>No hay citas encontradas</h3>
          <p>
            {searchTerm 
              ? `No se encontraron citas para "${searchTerm}"`
              : 'No hay citas programadas con los filtros seleccionados'}
          </p>
          <button 
            className="add-appointment-btn"
            onClick={() => setShowAddModal(true)}
          >
            <FontAwesomeIcon icon={faPlus} />
            Crear primera cita
          </button>
        </div>
      ) : (
        <div className="appointments-list">
          {filteredAppointments.map(appointment => (
            <div 
              key={appointment.appointment_ID} 
              className="appointment-card"
              style={{ borderLeftColor: getStatusColor(appointment.state) }}
            >
              <div 
                className="appointment-card-header"
                onClick={() => toggleExpandAppointment(appointment.appointment_ID)}
              >
                <div className="appointment-header-info">
                  {/* Tipo y fecha */}
                  <div className="appointment-type-date">
                    <div className="appointment-type" style={{ color: getTypeColor(appointment.is_orthodontics) }}>
                      <FontAwesomeIcon icon={getTypeIcon(appointment.is_orthodontics)} />
                      <span>{getTypeLabel(appointment.is_orthodontics)}</span>
                    </div>
                    <div className="appointment-date-time">
                      <h3 className="appointment-main-date">{formatDateTime(appointment.appointment_date)}</h3>
                      <span className="appointment-time">{formatTime(appointment.appointment_date)}</span>
                    </div>
                  </div>

                  {/* Estado y paciente */}
                  <div className="appointment-status-patient">
                    <div 
                      className="appointment-status" 
                      style={{ 
                        backgroundColor: getStatusColor(appointment.state) + '20',
                        color: getStatusColor(appointment.state)
                      }}
                    >
                      <FontAwesomeIcon icon={getStatusIcon(appointment.state)} />
                      <span>{getStatusLabel(appointment.state)}</span>
                    </div>
                    <div className="appointment-patient">
                      <FontAwesomeIcon icon={faUser} />
                      <span>{appointment.patient_name || 'Paciente no especificado'}</span>
                    </div>
                  </div>

                  {/* Acciones y expandir */}
                  <div className="appointment-actions">
                    <div className="appointment-service">
                      <FontAwesomeIcon icon={faStethoscope} />
                      <span>{appointment.query_type || 'Consulta'}</span>
                    </div>
                    <div className="appointment-actions-buttons">
                      {appointment.state === 'completed' && (
                        <button 
                          className="action-btn convert-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            openConvertModal(appointment);
                          }}
                          title="Registrar como procedimiento"
                        >
                          <FontAwesomeIcon icon={faExchangeAlt} />
                        </button>
                      )}
                      <button 
                        className="action-btn edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(appointment);
                        }}
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button 
                        className="action-btn delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAppointment(appointment.appointment_ID);
                        }}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                      <FontAwesomeIcon 
                        icon={expandedAppointments[appointment.appointment_ID] ? faChevronUp : faChevronDown} 
                        className="expand-icon"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Detalles expandidos */}
              {expandedAppointments[appointment.appointment_ID] && (
                <div className="appointment-card-details">
                  {/* Información del paciente */}
                  <div className="patient-info-section">
                    <h4 className="section-title">
                      <FontAwesomeIcon icon={faUser} />
                      Información del Paciente
                    </h4>
                    <div className="patient-details">
                      <div className="patient-detail">
                        <span className="detail-label">Nombre:</span>
                        <span className="detail-value">{appointment.patient_name || 'No disponible'}</span>
                      </div>
                      <div className="patient-detail">
                        <span className="detail-label">
                          <FontAwesomeIcon icon={faIdCard} />
                          Identificación:
                        </span>
                        <span className="detail-value">{appointment.patient_identification || 'No disponible'}</span>
                      </div>
                      <div className="patient-detail">
                        <span className="detail-label">
                          <FontAwesomeIcon icon={faPhone} />
                          Teléfono:
                        </span>
                        <span className="detail-value">{appointment.patient_phone || 'No disponible'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Detalles de la cita */}
                  <div className="appointment-details-section">
                    <h4 className="section-title">
                      <FontAwesomeIcon icon={faCalendarAlt} />
                      Detalles de la Cita
                    </h4>
                    <div className="appointment-details">
                      <div className="appointment-detail">
                        <span className="detail-label">Servicio:</span>
                        <span className="detail-value">{appointment.query_type || 'No especificado'}</span>
                      </div>
                      <div className="appointment-detail">
                        <span className="detail-label">Fecha y hora:</span>
                        <span className="detail-value">{formatDateTime(appointment.appointment_date)}</span>
                      </div>
                      <div className="appointment-detail">
                        <span className="detail-label">Estado:</span>
                        <span 
                          className="detail-value status-badge"
                          style={{ 
                            backgroundColor: getStatusColor(appointment.state) + '20',
                            color: getStatusColor(appointment.state)
                          }}
                        >
                          <FontAwesomeIcon icon={getStatusIcon(appointment.state)} />
                          {getStatusLabel(appointment.state)}
                        </span>
                      </div>
                      <div className="appointment-detail">
                        <span className="detail-label">Tipo:</span>
                        <span 
                          className="detail-value type-badge"
                          style={{ 
                            backgroundColor: getTypeColor(appointment.is_orthodontics) + '20',
                            color: getTypeColor(appointment.is_orthodontics)
                          }}
                        >
                          <FontAwesomeIcon icon={getTypeIcon(appointment.is_orthodontics)} />
                          {getTypeLabel(appointment.is_orthodontics)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="appointment-action-buttons">
                    {appointment.state === 'scheduled' && (
                      <button 
                        className="action-btn confirm-btn"
                        onClick={() => handleUpdateAppointment(appointment.appointment_ID, 'confirmed')}
                      >
                        <FontAwesomeIcon icon={faCheckCircle} />
                        Confirmar Cita
                      </button>
                    )}
                    {appointment.state === 'confirmed' && (
                      <button 
                        className="action-btn complete-btn"
                        onClick={() => handleUpdateAppointment(appointment.appointment_ID, 'completed')}
                      >
                        <FontAwesomeIcon icon={faCheckCircle} />
                        Marcar como Completada
                      </button>
                    )}
                    {(appointment.state === 'scheduled' || appointment.state === 'confirmed') && (
                      <button 
                        className="action-btn cancel-btn"
                        onClick={() => handleUpdateAppointment(appointment.appointment_ID, 'cancelled')}
                      >
                        <FontAwesomeIcon icon={faTimesCircle} />
                        Cancelar Cita
                      </button>
                    )}
                    {appointment.state === 'completed' && (
                      <button 
                        className="action-btn convert-full-btn"
                        onClick={() => openConvertModal(appointment)}
                      >
                        <FontAwesomeIcon icon={faExchangeAlt} />
                        Registrar como Procedimiento
                      </button>
                    )}
                  </div>

                  {/* Observaciones */}
                  {appointment.observations && (
                    <div className="observations-section">
                      <h4 className="section-title">
                        <FontAwesomeIcon icon={faCalendarAlt} />
                        Observaciones
                      </h4>
                      <div className="observations-content">
                        <p>{appointment.observations}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal para agregar cita */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faPlus} />
                Nueva Cita
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowAddModal(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <form onSubmit={handleAddAppointment} className="appointment-form">
              {/* Switch para ortodoncia */}
              <div className="form-group">
                <label className="form-label">
                  <div className="switch-container">
                    <span>Tipo de servicio:</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={newAppointment.is_orthodontics}
                        onChange={(e) => setNewAppointment({
                          ...newAppointment,
                          is_orthodontics: e.target.checked
                        })}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span className="switch-label">
                      {newAppointment.is_orthodontics ? 'Ortodoncia' : 'Servicio General'}
                    </span>
                  </div>
                </label>
              </div>

              {/* Campo de nombre del servicio */}
              <div className="form-group">
                <label className="form-label">Nombre del servicio:</label>
                <input
                  type="text"
                  required
                  value={newAppointment.query_type}
                  onChange={(e) => setNewAppointment({
                    ...newAppointment,
                    query_type: e.target.value
                  })}
                  className="form-input"
                  placeholder={newAppointment.is_orthodontics ? 
                    "Ej: Consulta inicial, ajuste de brackets, etc." : 
                    "Ej: Limpieza dental, extracción, etc."}
                />
              </div>

              {/* Paciente */}
              <div className="form-group">
                <label className="form-label">Paciente:</label>
                <select
                  required
                  value={newAppointment.patient_id}
                  onChange={(e) => setNewAppointment({
                    ...newAppointment,
                    patient_id: e.target.value
                  })}
                  className="form-select"
                >
                  <option value="">Seleccionar paciente...</option>
                  {patients.map(patient => (
                    <option key={patient.Patient_ID} value={patient.Patient_ID}>
                      {patient.first_name} {patient.first_last_name} - {patient.identification}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha y hora */}
              <div className="form-group">
                <label className="form-label">Fecha y hora:</label>
                <input
                  type="datetime-local"
                  required
                  value={newAppointment.appointment_date}
                  onChange={(e) => setNewAppointment({
                    ...newAppointment,
                    appointment_date: e.target.value
                  })}
                  className="form-input"
                />
              </div>

              {/* Observaciones */}
              <div className="form-group">
                <label className="form-label">Observaciones:</label>
                <textarea
                  value={newAppointment.observations}
                  onChange={(e) => setNewAppointment({
                    ...newAppointment,
                    observations: e.target.value
                  })}
                  className="form-textarea"
                  placeholder="Notas adicionales sobre la cita..."
                  rows="3"
                />
              </div>

              {/* Botones del formulario */}
              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn-cancel"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  <FontAwesomeIcon icon={faPlus} />
                  Crear Cita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para convertir cita en procedimiento */}
      {showConvertModal && selectedAppointment && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faExchangeAlt} />
                Registrar Procedimiento
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => {
                  setShowConvertModal(false);
                  setProcedureForm({
                    procedure_description: '',
                    total_cost: '',
                    payment_method: 'Efectivo',
                    observations: ''
                  });
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="appointment-info">
              <h4>Información de la cita:</h4>
              <p><strong>Paciente:</strong> {selectedAppointment.patient_name}</p>
              <p><strong>Fecha:</strong> {formatDateTime(selectedAppointment.appointment_date)}</p>
              <p><strong>Tipo:</strong> {selectedAppointment.is_orthodontics ? 'Ortodoncia' : 'Procedimiento Regular'}</p>
              <p><strong>Consulta:</strong> {selectedAppointment.query_type}</p>
            </div>
            
            <form onSubmit={handleConvertToProcedure} className="procedure-form">
              <div className="form-group">
                <label className="form-label">Descripción del procedimiento:</label>
                <input
                  type="text"
                  required
                  value={procedureForm.procedure_description}
                  onChange={(e) => setProcedureForm({
                    ...procedureForm,
                    procedure_description: e.target.value
                  })}
                  className="form-input"
                  placeholder="Ej: Limpieza dental, ajuste de brackets, etc."
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FontAwesomeIcon icon={faMoneyBillWave} /> Costo total (CRC):
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={procedureForm.total_cost}
                  onChange={(e) => setProcedureForm({
                    ...procedureForm,
                    total_cost: e.target.value
                  })}
                  className="form-input"
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FontAwesomeIcon icon={faCreditCard} /> Forma de pago:
                </label>
                <select
                  required
                  value={procedureForm.payment_method}
                  onChange={(e) => setProcedureForm({
                    ...procedureForm,
                    payment_method: e.target.value
                  })}
                  className="form-select"
                >
                  {PAYMENT_METHODS.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Observaciones adicionales:</label>
                <textarea
                  value={procedureForm.observations}
                  onChange={(e) => setProcedureForm({
                    ...procedureForm,
                    observations: e.target.value
                  })}
                  className="form-textarea"
                  placeholder="Notas sobre el procedimiento..."
                  rows="3"
                />
              </div>

              {selectedAppointment.is_orthodontics && (
                <div className="ortho-info-alert">
                  <FontAwesomeIcon icon={faUserMd} />
                  <span>Este procedimiento se registrará como tratamiento de ortodoncia (40% clínica, 60% doctora)</span>
                </div>
              )}

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn-cancel"
                  onClick={() => {
                    setShowConvertModal(false);
                    setProcedureForm({
                      procedure_description: '',
                      total_cost: '',
                      payment_method: 'Efectivo',
                      observations: ''
                    });
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  <FontAwesomeIcon icon={faCheckCircle} />
                  {selectedAppointment.is_orthodontics ? 
                    'Registrar Ortodoncia' : 
                    'Registrar Procedimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentPage;