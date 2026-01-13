import React, { useState, useEffect, useMemo, useContext, useRef } from 'react';
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
  faCreditCard,
  faLock
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

// Estados de citas (sin CONFIRMED)
const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Métodos de pago
const PAYMENT_METHODS = [
  'Efectivo',
  'POS',
  'Transferencia'
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
    fetchPatients,
    convertAppointmentToProcedure
  } = useContext(AppContext);

  // Estados
  const [timeFilter, setTimeFilter] = useState(TIME_FILTERS.TODAY);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [expandedAppointments, setExpandedAppointments] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [filteredPatients, setFilteredPatients] = useState([]);
  
  // Referencia para el buscador de pacientes
  const patientSearchRef = useRef(null);

  // Formulario de nueva cita
  const [newAppointment, setNewAppointment] = useState({
    patient_id: '',
    appointment_date: '',
    query_type: 'Consulta',
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

  // Filtrar pacientes cuando cambia el término de búsqueda
  useEffect(() => {
    if (patients.length > 0 && patientSearchTerm.trim()) {
      const term = patientSearchTerm.toLowerCase();
      const filtered = patients.filter(patient => {
        const fullName = `${patient.first_name || ''} ${patient.first_last_name || ''}`.toLowerCase();
        const identification = (patient.identification || '').toLowerCase();
        const phone = (patient.number_phone?.toString() || '').toLowerCase();
        
        return fullName.includes(term) || 
               identification.includes(term) || 
               phone.includes(term);
      });
      setFilteredPatients(filtered);
    } else {
      setFilteredPatients(patients);
    }
  }, [patients, patientSearchTerm]);

  // Cerrar buscador de pacientes al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (patientSearchRef.current && !patientSearchRef.current.contains(event.target)) {
        setShowPatientSearch(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
    const pending = appointments.filter(apt => apt.state === APPOINTMENT_STATUS.SCHEDULED).length;

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
      weekday: 'short',
      year: 'numeric',
      month: 'short',
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

  const formatDateShort = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
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

  // Verificar si la cita ya tiene un procedimiento asociado
  const hasProcedure = (appointment) => {
    return appointment.procedure_id || appointment.procedure_ID;
  };

  // Verificar si la cita puede ser editada
  const canEditAppointment = (appointment) => {
    return !hasProcedure(appointment) && appointment.state !== 'completed';
  };

  // Función para manejar cambios en el switch de ortodoncia
  const handleOrthodonticsSwitch = (checked) => {
    setNewAppointment({
      ...newAppointment,
      is_orthodontics: checked,
      query_type: checked ? 'Ortodoncia' : 'Consulta'
    });
  };

  // Función para seleccionar paciente desde el buscador
  const handleSelectPatient = (patient) => {
    setNewAppointment({
      ...newAppointment,
      patient_id: patient.Patient_ID.toString()
    });
    setPatientSearchTerm('');
    setShowPatientSearch(false);
  };

  // Crear nueva cita
  const handleAddAppointment = async (e) => {
    e.preventDefault();
    
    try {
      // Asegurar que el nombre del servicio sea "Ortodoncia" si el switch está activado
      const appointmentData = {
        Patient_ID: parseInt(newAppointment.patient_id),
        appointment_date: new Date(newAppointment.appointment_date).toISOString(),
        query_type: newAppointment.is_orthodontics ? 'Ortodoncia' : newAppointment.query_type,
        is_orthodontics: newAppointment.is_orthodontics,
        observations: newAppointment.observations || null
      };

      console.log('📤 Enviando datos de cita:', appointmentData);
      
      await createAppointment(appointmentData);
      
      // Resetear formulario
      setNewAppointment({
        patient_id: '',
        appointment_date: '',
        query_type: 'Consulta',
        is_orthodontics: false,
        observations: ''
      });
      setPatientSearchTerm('');
      
      setShowAddModal(false);
      fetchAppointments();
      
      alert('✅ Cita creada exitosamente');
      
    } catch (error) {
      console.error('Error al crear cita:', error);
      alert(`❌ Error al crear la cita: ${error.message || 'Error desconocido'}`);
    }
  };

  // Actualizar cita (solo estado) - Con validación de procedimiento
  const handleUpdateAppointment = async (appointmentId, newState) => {
    try {
      const appointment = appointments.find(a => a.appointment_ID === appointmentId);
      if (hasProcedure(appointment)) {
        alert('No se puede cambiar el estado de una cita que ya tiene un procedimiento registrado');
        return;
      }
      
      await updateAppointment(appointmentId, { state: newState });
      fetchAppointments();
      
      let message = '';
      switch(newState) {
        case 'completed':
          message = '✅ Cita completada';
          break;
        case 'cancelled':
          message = '❌ Cita cancelada';
          break;
      }
      
      if (message) alert(message);
    } catch (error) {
      console.error('Error al actualizar cita:', error);
      alert('Error al actualizar la cita');
    }
  };

  // Eliminar cita - Con validación de procedimiento
  const handleDeleteAppointment = async (appointmentId) => {
    const appointment = appointments.find(a => a.appointment_ID === appointmentId);
    if (hasProcedure(appointment)) {
      alert('No se puede eliminar una cita que ya tiene un procedimiento registrado');
      return;
    }
    
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

  // Convertir cita en procedimiento - Con validación
  const handleConvertToProcedure = async (e) => {
    e.preventDefault();
    
    if (!selectedAppointment) return;
    
    if (hasProcedure(selectedAppointment)) {
      alert('Esta cita ya tiene un procedimiento registrado');
      setShowConvertModal(false);
      return;
    }
    
    try {
      await convertAppointmentToProcedure(
        selectedAppointment.appointment_ID,
        {
          ...procedureForm,
          total_cost: parseFloat(procedureForm.total_cost)
        }
      );
      
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
      alert('✅ Procedimiento registrado exitosamente');
      
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

  // Abrir modal para convertir cita - Con validación
  const openConvertModal = (appointment) => {
    if (hasProcedure(appointment)) {
      alert('Esta cita ya tiene un procedimiento registrado');
      return;
    }
    
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

  const getStatusColor = (status) => {
    const colors = {
      [APPOINTMENT_STATUS.SCHEDULED]: '#FFA726', // naranja
      [APPOINTMENT_STATUS.COMPLETED]: '#66BB6A', // verde
      [APPOINTMENT_STATUS.CANCELLED]: '#EF5350', // rojo
    };
    return colors[status] || '#78909C';
  };

  const getStatusIcon = (status) => {
    const icons = {
      [APPOINTMENT_STATUS.SCHEDULED]: faClock,
      [APPOINTMENT_STATUS.COMPLETED]: faCheckCircle,
      [APPOINTMENT_STATUS.CANCELLED]: faTimesCircle,
    };
    return icons[status] || faClock;
  };

  const getStatusLabel = (status) => {
    const labels = {
      [APPOINTMENT_STATUS.SCHEDULED]: 'Pendiente',
      [APPOINTMENT_STATUS.COMPLETED]: 'Completada',
      [APPOINTMENT_STATUS.CANCELLED]: 'Cancelada',
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
                  Pendientes
                </button>
                <button 
                  className={`status-filter-btn ${statusFilter === APPOINTMENT_STATUS.COMPLETED ? 'active' : ''}`}
                  onClick={() => setStatusFilter(APPOINTMENT_STATUS.COMPLETED)}
                  style={{ backgroundColor: '#66BB6A20', color: '#66BB6A' }}
                >
                  <FontAwesomeIcon icon={faCheckCircle} />
                  Completadas
                </button>
                <button 
                  className={`status-filter-btn ${statusFilter === APPOINTMENT_STATUS.CANCELLED ? 'active' : ''}`}
                  onClick={() => setStatusFilter(APPOINTMENT_STATUS.CANCELLED)}
                  style={{ backgroundColor: '#EF535020', color: '#EF5350' }}
                >
                  <FontAwesomeIcon icon={faTimesCircle} />
                  Canceladas
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

      {/* Lista de citas - DISEÑO HORIZONTAL PARA PC */}
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
              <div className="appointment-card-content">
                {/* Fila horizontal principal - COMPACTADA */}
                <div className="appointment-main-row compact-view">
                  {/* Columna 1: Fecha y hora - COMPACTADA */}
                  <div className="appointment-column date-column compact">
                    <div className="appointment-date-short compact">{formatDateShort(appointment.appointment_date)}</div>
                    <div className="appointment-time compact">{formatTime(appointment.appointment_date)}</div>
                  </div>

                  {/* Columna 2: Paciente - COMPACTADA */}
                  <div className="appointment-column patient-column compact">
                    <div className="appointment-patient-name compact">
                      <FontAwesomeIcon icon={faUser} />
                      <span className="patient-name-truncate">{appointment.patient_name || 'Paciente no especificado'}</span>
                    </div>
                    <div className="appointment-patient-info compact">
                      <span className="patient-id compact">
                        <FontAwesomeIcon icon={faIdCard} />
                        {appointment.patient_identification?.substring(0, 10) || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Columna 3: Servicio - COMPACTADA */}
                  <div className="appointment-column service-column compact">
                    <div className="appointment-service-info compact">
                      <FontAwesomeIcon icon={faStethoscope} />
                      <span className="service-name-truncate">{appointment.query_type || 'Consulta'}</span>
                    </div>
                    <div className="appointment-type-info">
                      <span 
                        className="appointment-type-badge compact"
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

                  {/* Columna 4: Estado - COMPACTADA */}
                  <div className="appointment-column status-column compact">
                    <div 
                      className="appointment-status-badge compact"
                      style={{ 
                        backgroundColor: getStatusColor(appointment.state) + '20',
                        color: getStatusColor(appointment.state)
                      }}
                    >
                      <FontAwesomeIcon icon={getStatusIcon(appointment.state)} />
                      <span>{getStatusLabel(appointment.state)}</span>
                    </div>
                    {hasProcedure(appointment) && (
                      <div className="procedure-badge locked">
                        <FontAwesomeIcon icon={faLock} />
                        <span>Bloqueado</span>
                      </div>
                    )}
                  </div>

                  {/* Columna 5: Acciones - MODIFICADA */}
                  <div className="appointment-column actions-column compact">
                    <div className="appointment-actions-horizontal">
                      {/* Botón para convertir en procedimiento */}
                      {appointment.state === 'completed' && !hasProcedure(appointment) && (
                        <button 
                          className="action-btn-horizontal convert-btn"
                          onClick={() => openConvertModal(appointment)}
                          title="Registrar como procedimiento"
                        >
                          <FontAwesomeIcon icon={faExchangeAlt} />
                          <span>Registrar</span>
                        </button>
                      )}
                      
                      {/* Botones de estado - con validación */}
                      <div className="status-actions-horizontal">
                        {appointment.state === 'scheduled' && !hasProcedure(appointment) && (
                          <>
                            <button 
                              className="status-action-btn complete-action"
                              onClick={() => handleUpdateAppointment(appointment.appointment_ID, 'completed')}
                            >
                              <FontAwesomeIcon icon={faCheckCircle} />
                              Completar
                            </button>
                            <button 
                              className="status-action-btn cancel-action"
                              onClick={() => handleUpdateAppointment(appointment.appointment_ID, 'cancelled')}
                            >
                              <FontAwesomeIcon icon={faTimesCircle} />
                              Cancelar
                            </button>
                          </>
                        )}
                        {appointment.state === 'completed' && !hasProcedure(appointment) && (
                          <button 
                            className="status-action-btn cancel-action"
                            onClick={() => handleUpdateAppointment(appointment.appointment_ID, 'cancelled')}
                          >
                            <FontAwesomeIcon icon={faTimesCircle} />
                            Cancelar
                          </button>
                        )}
                      </div>
                      
                      {/* Botones de editar/eliminar (solo si no tiene procedimiento) */}
                      {canEditAppointment(appointment) && (
                        <div className="edit-delete-actions">
                          <button 
                            className="action-btn-small edit-btn"
                            onClick={() => {
                              // Aquí podrías implementar la edición completa
                              alert('La edición de citas está disponible');
                            }}
                            title="Editar cita"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button 
                            className="action-btn-small delete-btn"
                            onClick={() => handleDeleteAppointment(appointment.appointment_ID)}
                            title="Eliminar cita"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      )}
                      
                      {/* Mostrar icono de bloqueo si tiene procedimiento */}
                      {hasProcedure(appointment) && (
                        <div className="locked-indicator" title="Cita bloqueada - Ya tiene procedimiento">
                          <FontAwesomeIcon icon={faLock} />
                          <span>Bloqueada</span>
                        </div>
                      )}
                      
                      {/* Icono expandir */}
                      <FontAwesomeIcon 
                        icon={expandedAppointments[appointment.appointment_ID] ? faChevronUp : faChevronDown} 
                        className="expand-icon-horizontal"
                        onClick={() => toggleExpandAppointment(appointment.appointment_ID)}
                      />
                    </div>
                  </div>
                </div>

                {/* Detalles expandidos */}
                {expandedAppointments[appointment.appointment_ID] && (
                  <div className="appointment-details-expanded">
                    <div className="expanded-section">
                      <h4 className="section-title">
                        <FontAwesomeIcon icon={faCalendarAlt} />
                        Detalles Completos
                      </h4>
                      <div className="expanded-details-grid">
                        <div className="expanded-detail">
                          <span className="detail-label">Fecha y hora completa:</span>
                          <span className="detail-value">{formatDateTime(appointment.appointment_date)}</span>
                        </div>
                        <div className="expanded-detail">
                          <span className="detail-label">Estado:</span>
                          <span 
                            className="detail-value status-badge-expanded"
                            style={{ 
                              backgroundColor: getStatusColor(appointment.state) + '20',
                              color: getStatusColor(appointment.state)
                            }}
                          >
                            <FontAwesomeIcon icon={getStatusIcon(appointment.state)} />
                            {getStatusLabel(appointment.state)}
                          </span>
                        </div>
                        <div className="expanded-detail">
                          <span className="detail-label">Tipo de servicio:</span>
                          <span 
                            className="detail-value type-badge-expanded"
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

                    {/* Observaciones */}
                    {appointment.observations && (
                      <div className="expanded-section">
                        <h4 className="section-title">
                          <FontAwesomeIcon icon={faCalendarAlt} />
                          Observaciones
                        </h4>
                        <div className="observations-content-expanded">
                          <p>{appointment.observations}</p>
                        </div>
                      </div>
                    )}

                    {/* Información del procedimiento si existe */}
                    {hasProcedure(appointment) && (
                      <div className="expanded-section">
                        <h4 className="section-title">
                          <FontAwesomeIcon icon={faExchangeAlt} />
                          Procedimiento Registrado
                        </h4>
                        <div className="procedure-info">
                          <p className="procedure-message">
                            ✅ Esta cita ya fue registrada como procedimiento. 
                            {appointment.is_orthodontics 
                              ? ' Puede ver los detalles en la sección de Ortodoncia.' 
                              : ' Puede ver los detalles en la sección de Procedimientos.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal para agregar cita - MODIFICADO CON BUSCADOR */}
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
                onClick={() => {
                  setShowAddModal(false);
                  setPatientSearchTerm('');
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <form onSubmit={handleAddAppointment} className="appointment-form">
              {/* Switch para ortodoncia - MODIFICADO */}
              <div className="form-group">
                <label className="form-label">
                  <div className="switch-container">
                    <span>Tipo de servicio:</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={newAppointment.is_orthodontics}
                        onChange={(e) => handleOrthodonticsSwitch(e.target.checked)}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span className="switch-label">
                      {newAppointment.is_orthodontics ? 'Ortodoncia' : 'Servicio General'}
                    </span>
                  </div>
                </label>
              </div>

              {/* Campo de nombre del servicio - MODIFICADO */}
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
                    "Ortodoncia (automático)" : 
                    "Ej: Limpieza dental, extracción, etc."}
                  disabled={newAppointment.is_orthodontics}
                  readOnly={newAppointment.is_orthodontics}
                />
                {newAppointment.is_orthodontics && (
                  <small className="form-help-text">El servicio se establece automáticamente como "Ortodoncia"</small>
                )}
              </div>

              {/* Paciente CON BUSCADOR MEJORADO */}
              <div className="form-group" ref={patientSearchRef}>
                <label className="form-label">Paciente:</label>
                <div className="patient-search-container">
                  <div className="search-box-patient">
                    <FontAwesomeIcon icon={faSearch} className="search-icon-patient" />
                    <input
                      type="text"
                      required
                      value={patientSearchTerm || (() => {
                        const selectedPatient = patients.find(p => 
                          p.Patient_ID.toString() === newAppointment.patient_id
                        );
                        return selectedPatient ? 
                          `${selectedPatient.first_name} ${selectedPatient.first_last_name} - ${selectedPatient.identification}` : 
                          '';
                      })()}
                      onChange={(e) => {
                        setPatientSearchTerm(e.target.value);
                        if (!showPatientSearch) setShowPatientSearch(true);
                      }}
                      onFocus={() => setShowPatientSearch(true)}
                      className="form-input"
                      placeholder="Buscar paciente por nombre, cédula o teléfono..."
                    />
                    {patientSearchTerm && (
                      <button 
                        type="button"
                        className="clear-search-btn-patient"
                        onClick={() => {
                          setPatientSearchTerm('');
                          setNewAppointment({...newAppointment, patient_id: ''});
                        }}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    )}
                  </div>
                  
                  {showPatientSearch && patients.length > 0 && (
                    <div className="patient-search-results">
                      <div className="search-results-header">
                        <span>Seleccione un paciente ({filteredPatients.length} resultados)</span>
                        {patients.length > 10 && (
                          <small>Usa el buscador para filtrar entre {patients.length} pacientes</small>
                        )}
                      </div>
                      <div className="patient-results-list">
                        {filteredPatients.slice(0, 8).map(patient => (
                          <div 
                            key={patient.Patient_ID}
                            className={`patient-result-item ${newAppointment.patient_id === patient.Patient_ID.toString() ? 'selected' : ''}`}
                            onClick={() => handleSelectPatient(patient)}
                          >
                            <div className="patient-result-name">
                              <strong>{patient.first_name} {patient.first_last_name}</strong>
                            </div>
                            <div className="patient-result-details">
                              <span>Cédula: {patient.identification || 'N/A'}</span>
                              <span>Tel: {patient.number_phone || 'N/A'}</span>
                            </div>
                          </div>
                        ))}
                        {filteredPatients.length === 0 && (
                          <div className="no-patient-results">
                            No se encontraron pacientes con "{patientSearchTerm}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
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
                  onClick={() => {
                    setShowAddModal(false);
                    setPatientSearchTerm('');
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={!newAppointment.patient_id}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Crear Cita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para convertir cita en procedimiento - MODIFICADO */}
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
            
            {/* Información de la cita con advertencia si ya tiene procedimiento */}
            <div className="appointment-info">
              <h4>Información de la cita:</h4>
              <p><strong>Paciente:</strong> {selectedAppointment.patient_name}</p>
              <p><strong>Fecha:</strong> {formatDateTime(selectedAppointment.appointment_date)}</p>
              <p><strong>Tipo:</strong> {selectedAppointment.is_orthodontics ? 'Ortodoncia' : 'Procedimiento Regular'}</p>
              <p><strong>Consulta:</strong> {selectedAppointment.query_type}</p>
              
              {hasProcedure(selectedAppointment) && (
                <div className="warning-alert">
                  <FontAwesomeIcon icon={faLock} />
                  <strong>¡ATENCIÓN!</strong> Esta cita ya tiene un procedimiento registrado y no puede ser modificada.
                </div>
              )}
            </div>
            
            {/* Formulario deshabilitado si ya tiene procedimiento */}
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
                  disabled={hasProcedure(selectedAppointment)}
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
                  disabled={hasProcedure(selectedAppointment)}
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
                  disabled={hasProcedure(selectedAppointment)}
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
                  disabled={hasProcedure(selectedAppointment)}
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
                  {hasProcedure(selectedAppointment) ? 'Cerrar' : 'Cancelar'}
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={hasProcedure(selectedAppointment)}
                >
                  <FontAwesomeIcon icon={faCheckCircle} />
                  {hasProcedure(selectedAppointment) ? 
                    'Ya registrado' : 
                    (selectedAppointment.is_orthodontics ? 
                      'Registrar Ortodoncia' : 
                      'Registrar Procedimiento')}
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