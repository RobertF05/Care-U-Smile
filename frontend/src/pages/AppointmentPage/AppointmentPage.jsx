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
  faExchangeAlt,
  faMoneyBillWave,
  faCreditCard,
  faLock,
  faPercentage,
  faDollarSign,
  faUserDoctor,
  faFileMedical,
  faSave,
  faChartBar
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
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Métodos de pago
const PAYMENT_METHODS = [
  'Efectivo',
  'Tarjeta',
  'Transferencia',
  'Mixto'
];

// FUNCIONES FORMATADORAS - ACTUALIZADAS para manejar zona horaria Nicaragua (UTC-6)
const formatDateTime = (dateString) => {
  if (!dateString) return '';
  
  try {
    // Asumir que dateString viene en UTC y formatear a Nicaragua (UTC-6)
    const date = new Date(dateString);
    const nicaraguaDate = new Date(date.getTime() - (6 * 60 * 60 * 1000)); // Convertir UTC a Nicaragua
    
    return nicaraguaDate.toLocaleDateString('es-ES', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formateando fecha:', error);
    return dateString;
  }
};

const formatTime = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const nicaraguaDate = new Date(date.getTime() - (6 * 60 * 60 * 1000)); // Convertir UTC a Nicaragua
    
    return nicaraguaDate.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formateando hora:', error);
    return dateString;
  }
};

const formatDateShort = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const nicaraguaDate = new Date(date.getTime() - (6 * 60 * 60 * 1000)); // Convertir UTC a Nicaragua
    
    return nicaraguaDate.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formateando fecha corta:', error);
    return dateString;
  }
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO'
  }).format(amount || 0);
};

const formatCurrencyUSD = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount || 0);
};

// Función para convertir fecha UTC a formato de input datetime-local (Nicaragua)
const utcToDateTimeInput = (utcDateString) => {
  if (!utcDateString) return '';
  
  try {
    const date = new Date(utcDateString);
    const nicaraguaDate = new Date(date.getTime() - (6 * 60 * 60 * 1000)); // UTC a Nicaragua
    
    const year = nicaraguaDate.getFullYear();
    const month = String(nicaraguaDate.getMonth() + 1).padStart(2, '0');
    const day = String(nicaraguaDate.getDate()).padStart(2, '0');
    const hours = String(nicaraguaDate.getHours()).padStart(2, '0');
    const minutes = String(nicaraguaDate.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.error('Error convirtiendo UTC a input:', error);
    return '';
  }
};

// Función para convertir input datetime-local (Nicaragua) a UTC
const dateTimeInputToUTC = (inputValue) => {
  if (!inputValue) return null;
  
  try {
    // El input está en hora Nicaragua, convertir a UTC
    const localDate = new Date(inputValue);
    const utcDate = new Date(localDate.getTime() + (6 * 60 * 60 * 1000)); // Nicaragua a UTC
    
    return utcDate.toISOString();
  } catch (error) {
    console.error('Error convirtiendo input a UTC:', error);
    return null;
  }
};

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
    convertAppointmentToProcedure,
    apiFetch
  } = useContext(AppContext);

  // Estados
  const [timeFilter, setTimeFilter] = useState(TIME_FILTERS.THIS_MONTH);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [expandedAppointments, setExpandedAppointments] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showAutoConvertModal, setShowAutoConvertModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [justCompletedAppointment, setJustCompletedAppointment] = useState(null);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [currentSettings, setCurrentSettings] = useState({
    exchange_rate: 36.5,
    clinic_payment: 40,
    doctor_payment: 60
  });
  
  // Nuevos estados para desplegables móviles
  const [expandedStats, setExpandedStats] = useState(false);
  const [expandedFilterSection, setExpandedFilterSection] = useState(false);
  
  // Formulario de nueva cita
  const [newAppointment, setNewAppointment] = useState({
    patient_id: '',
    appointment_date: '',
    query_type: 'Consulta',
    is_orthodontics: false,
    observations: ''
  });

  // Formulario de edición de cita
  const [editFormData, setEditFormData] = useState({
    appointment_date: '',
    query_type: '',
    observations: '',
    is_orthodontics: false
  });

  // Formulario de procedimiento
  const [procedureForm, setProcedureForm] = useState({
    procedure_description: '',
    amount_cordobas: '',
    amount_dollars: '',
    payment_method_cordobas: 'Efectivo',
    payment_method_dollars: 'Efectivo',
    exchange_rate: 36.5,
    external_doctor: false,
    external_doctor_name: '',
    external_doctor_specialty: '',
    external_doctor_payment_type: 'percentage',
    external_doctor_payment_value: '',
    external_doctor_payment_currency: 'C$',
    clinic_payment_percentage: 40,
    doctor_payment_percentage: 60,
    observations: ''
  });

  const patientSearchRef = useRef(null);

  // Cargar datos iniciales
  useEffect(() => {
    if (user) {
      fetchAppointments();
      fetchPatients();
      loadCurrentSettings();
    }
  }, [user]);

  // Cargar configuración actual
  const loadCurrentSettings = async () => {
    try {
      const response = await apiFetch('/settings/current');
      if (response.success && response.data) {
        setCurrentSettings({
          exchange_rate: response.data.exchange_rate || 36.5,
          clinic_payment: response.data.clinic_payment || 40,
          doctor_payment: response.data.doctor_payment || 60
        });
        
        setProcedureForm(prev => ({
          ...prev,
          exchange_rate: response.data.exchange_rate || 36.5,
          clinic_payment_percentage: response.data.clinic_payment || 40,
          doctor_payment_percentage: response.data.doctor_payment || 60
        }));
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    }
  };

  // Calcular total en córdobas
  const calculateTotalCordobas = () => {
    const cordobas = parseFloat(procedureForm.amount_cordobas) || 0;
    const dollars = parseFloat(procedureForm.amount_dollars) || 0;
    const exchangeRate = parseFloat(procedureForm.exchange_rate) || 1;
    
    return cordobas + (dollars * exchangeRate);
  };

  // Calcular total en dólares
  const calculateTotalDollars = () => {
    const cordobas = parseFloat(procedureForm.amount_cordobas) || 0;
    const dollars = parseFloat(procedureForm.amount_dollars) || 0;
    const exchangeRate = parseFloat(procedureForm.exchange_rate) || 1;
    
    return dollars + (cordobas / exchangeRate);
  };

  // Calcular total del procedimiento (suma de ambos)
  const calculateTotalProcedure = () => {
    const cordobas = parseFloat(procedureForm.amount_cordobas) || 0;
    const dollars = parseFloat(procedureForm.amount_dollars) || 0;
    const exchangeRate = parseFloat(procedureForm.exchange_rate) || 1;
    
    return cordobas + (dollars * exchangeRate);
  };

  // Manejar cambios en los pagos
  const handlePaymentChange = (field, value) => {
    const updatedForm = { ...procedureForm };
    updatedForm[field] = value;
    
    // Si cambia el tipo de cambio, recalcular dólares
    if (field === 'exchange_rate') {
      const newRate = parseFloat(value) || 1;
      updatedForm.exchange_rate = newRate;
    }
    
    setProcedureForm(updatedForm);
  };

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

  // Cargar configuración cuando se abre modal de conversión
  useEffect(() => {
    if (showConvertModal) {
      loadCurrentSettings();
    }
  }, [showConvertModal]);

  // Verificar si la cita ya tiene un procedimiento asociado
  const hasProcedure = (appointment) => {
    return appointment.is_registered || appointment.procedure_id || appointment.procedure_ID;
  };

  // Verificar si la cita puede ser editada
  const canEditAppointment = (appointment) => {
    // No se puede editar si:
    // 1. Ya tiene un procedimiento asociado
    // 2. Está en estado "completed"
    // 3. Está en estado "cancelled"
    const hasProcedure = appointment.is_registered || appointment.procedure_id || appointment.procedure_ID;
    const isCompleted = appointment.state === 'completed';
    const isCancelled = appointment.state === 'cancelled';
    
    return !hasProcedure && !isCompleted && !isCancelled;
  };

  // Filtrar citas
  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments];

    // Filtrar por tiempo - CORREGIDO para usar fechas en UTC
    const now = new Date();
    const todayUTC = new Date(now.getTime() + (6 * 60 * 60 * 1000)); // Nicaragua a UTC
    
    switch (timeFilter) {
      case TIME_FILTERS.TODAY:
        filtered = filtered.filter(apt => {
          try {
            const aptDate = new Date(apt.appointment_date_utc || apt.appointment_date);
            return aptDate.getUTCDate() === todayUTC.getUTCDate() &&
                   aptDate.getUTCMonth() === todayUTC.getUTCMonth() &&
                   aptDate.getUTCFullYear() === todayUTC.getUTCFullYear();
          } catch (error) {
            console.error('Error filtrando por hoy:', error, apt);
            return false;
          }
        });
        break;
      case TIME_FILTERS.THIS_WEEK:
        const lastWeek = new Date(todayUTC);
        lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
        filtered = filtered.filter(apt => {
          try {
            const aptDate = new Date(apt.appointment_date_utc || apt.appointment_date);
            return aptDate >= lastWeek;
          } catch (error) {
            console.error('Error filtrando por semana:', error, apt);
            return false;
          }
        });
        break;
      case TIME_FILTERS.THIS_MONTH:
        const lastMonth = new Date(todayUTC);
        lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
        filtered = filtered.filter(apt => {
          try {
            const aptDate = new Date(apt.appointment_date_utc || apt.appointment_date);
            return aptDate >= lastMonth;
          } catch (error) {
            console.error('Error filtrando por mes:', error, apt);
            return false;
          }
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
        const appointmentDate = formatDateTime(apt.appointment_date_utc || apt.appointment_date).toLowerCase();
        
        return patientName.includes(term) || 
               queryType.includes(term) || 
               appointmentDate.includes(term);
      });
    }

    // Ordenar por fecha (más próxima primero) usando UTC
    return filtered.sort((a, b) => {
      try {
        const dateA = new Date(a.appointment_date_utc || a.appointment_date);
        const dateB = new Date(b.appointment_date_utc || b.appointment_date);
        return dateA - dateB;
      } catch (error) {
        console.error('Error ordenando citas:', error);
        return 0;
      }
    });
  }, [appointments, timeFilter, statusFilter, typeFilter, searchTerm]);

  // Estadísticas - CORREGIDAS para usar UTC
  const stats = useMemo(() => {
    const total = appointments.length;
    
    // Calcular citas de hoy en Nicaragua
    const now = new Date();
    const todayNicaragua = new Date(now.getTime() - (6 * 60 * 60 * 1000)); // UTC a Nicaragua para comparar
    const today = appointments.filter(apt => {
      try {
        const aptDateUTC = new Date(apt.appointment_date_utc || apt.appointment_date);
        const aptDateNicaragua = new Date(aptDateUTC.getTime() - (6 * 60 * 60 * 1000));
        
        return aptDateNicaragua.getDate() === todayNicaragua.getDate() &&
               aptDateNicaragua.getMonth() === todayNicaragua.getMonth() &&
               aptDateNicaragua.getFullYear() === todayNicaragua.getFullYear();
      } catch (error) {
        console.error('Error calculando citas de hoy:', error);
        return false;
      }
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

  // Funciones para citas
  const toggleExpandAppointment = (appointmentId) => {
    setExpandedAppointments(prev => ({
      ...prev,
      [appointmentId]: !prev[appointmentId]
    }));
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

  // Manejar cambios en pago de doctor externo
  const handleExternalDoctorPaymentChange = (field, value) => {
    let updatedForm = { ...procedureForm };
    
    if (field === 'payment_type') {
      updatedForm.external_doctor_payment_type = value;
      updatedForm.external_doctor_payment_value = '';
    } else {
      updatedForm[field] = value;
    }
    
    // Validar que el pago no exceda el costo total
    if (field === 'external_doctor_payment_value' && value) {
      const totalCost = parseFloat(updatedForm.total_cost) || 0;
      const paymentValue = parseFloat(value) || 0;
      
      if (updatedForm.external_doctor_payment_type === 'percentage') {
        if (paymentValue > 100) {
          alert('El porcentaje no puede ser mayor a 100%');
          updatedForm.external_doctor_payment_value = '100';
        }
      } else {
        // Para cantidad fija, convertir a córdobas si es en dólares
        let paymentInCordobas = paymentValue;
        if (updatedForm.external_doctor_payment_currency === 'US$') {
          paymentInCordobas = paymentValue * updatedForm.exchange_rate;
        }
        
        if (paymentInCordobas > totalCost) {
          alert('El pago al doctor externo no puede ser mayor al costo total del procedimiento');
          updatedForm.external_doctor_payment_value = '';
        }
      }
    }
    
    setProcedureForm(updatedForm);
  };

  // Crear nueva cita - CORREGIDA
  const handleAddAppointment = async (e) => {
    e.preventDefault();
    
    try {
      console.log('📝 Datos de la cita original:', newAppointment);
      
      // El backend ya maneja la conversión de zona horaria
      const appointmentData = {
        Patient_ID: parseInt(newAppointment.patient_id),
        appointment_date: newAppointment.appointment_date, // En hora Nicaragua
        query_type: newAppointment.is_orthodontics ? 'Ortodoncia' : newAppointment.query_type,
        is_orthodontics: newAppointment.is_orthodontics,
        observations: newAppointment.observations || null
      };

      console.log('📤 Enviando al backend (hora Nicaragua):', appointmentData);
      
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

  // Función para actualizar el estado de la cita (con conversión automática)
  const handleUpdateAppointmentWithAutoConvert = async (appointmentId, newState) => {
    try {
      const appointment = appointments.find(a => a.appointment_ID === appointmentId);
      
      if (hasProcedure(appointment)) {
        alert('No se puede cambiar el estado de una cita que ya tiene un procedimiento registrado');
        return;
      }
      
      // Actualizar el estado de la cita inmediatamente
      await updateAppointment(appointmentId, { state: newState });
      
      // Recargar citas para obtener los datos actualizados
      await fetchAppointments();
      
      let message = '';
      switch(newState) {
        case 'completed':
          message = '✅ Cita completada';
          
          // Obtener la cita actualizada después del refresh
          const updatedAppointments = await fetchAppointments();
          const updatedAppointment = updatedAppointments.data?.find(a => a.appointment_ID === appointmentId) || appointment;
          
          // Guardar la cita completada para abrir automáticamente el modal de procedimiento
          setJustCompletedAppointment({
            ...updatedAppointment,
            state: 'completed' // Asegurar que el estado esté como completado
          });
          setShowAutoConvertModal(true);
          
          // Pre-cargar datos en el formulario de procedimiento
          setProcedureForm({
            procedure_description: updatedAppointment.query_type || '',
            amount_cordobas: '',
            amount_dollars: '',
            payment_method_cordobas: 'Efectivo',
            payment_method_dollars: 'Efectivo',
            exchange_rate: currentSettings.exchange_rate,
            external_doctor: false,
            external_doctor_name: '',
            external_doctor_specialty: '',
            external_doctor_payment_type: 'percentage',
            external_doctor_payment_value: '',
            external_doctor_payment_currency: 'C$',
            clinic_payment_percentage: updatedAppointment.is_orthodontics ? currentSettings.clinic_payment : 100,
            doctor_payment_percentage: updatedAppointment.is_orthodontics ? currentSettings.doctor_payment : 0,
            observations: updatedAppointment.observations || ''
          });
          
          break;
        case 'cancelled':
          message = '❌ Cita cancelada';
          break;
      }
      
      if (message) alert(message);
    } catch (error) {
      console.error('Error al actualizar cita:', error);
      alert('Error al actualizar la cita: ' + error.message);
    }
  };

  // Función para manejar el cierre del modal automático
  const handleCloseAutoConvertModal = () => {
    setShowAutoConvertModal(false);
    setJustCompletedAppointment(null);
  };

  // Eliminar cita
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

  // Función para abrir modal de edición - CORREGIDA
  const handleOpenEditModal = (appointment) => {
    if (!canEditAppointment(appointment)) {
      alert('No se puede editar esta cita. Solo se pueden editar citas pendientes sin procedimientos.');
      return;
    }
    
    setEditingAppointment(appointment);
    
    // Convertir UTC a hora Nicaragua para el input
    const appointmentDateUTC = appointment.appointment_date_utc || appointment.appointment_date;
    const appointmentDateNicaragua = utcToDateTimeInput(appointmentDateUTC);
    
    setEditFormData({
      appointment_date: appointmentDateNicaragua,
      query_type: appointment.query_type || '',
      observations: appointment.observations || '',
      is_orthodontics: appointment.is_orthodontics || false
    });
    setShowEditModal(true);
  };

  // Función para guardar cambios en la cita - CORREGIDA
  const handleSaveEditAppointment = async (e) => {
    e.preventDefault();
    
    if (!editingAppointment) return;
    
    try {
      const updateData = {
        appointment_date: editFormData.appointment_date, // En hora Nicaragua
        query_type: editFormData.query_type,
        is_orthodontics: editFormData.is_orthodontics,
        observations: editFormData.observations || null
      };
      
      console.log('📝 Actualizando cita con datos (hora Nicaragua):', updateData);
      
      await updateAppointment(editingAppointment.appointment_ID, updateData);
      
      // Cerrar modal y recargar citas
      setShowEditModal(false);
      setEditingAppointment(null);
      fetchAppointments();
      
      alert('✅ Cita actualizada exitosamente');
    } catch (error) {
      console.error('Error al actualizar cita:', error);
      alert('Error al actualizar la cita: ' + error.message);
    }
  };

  // Convertir cita en procedimiento
  const handleConvertToProcedure = async (e) => {
    e.preventDefault();
    
    if (!selectedAppointment) return;
    
    // Verificar si ya está registrada (doble verificación)
    if (selectedAppointment.is_registered || hasProcedure(selectedAppointment)) {
      alert('Esta cita ya ha sido registrada como procedimiento');
      setShowConvertModal(false);
      return;
    }
    
    try {
      // Calcular valores
      const totalCordobas = parseFloat(procedureForm.amount_cordobas) || 0;
      const totalDollars = parseFloat(procedureForm.amount_dollars) || 0;
      const exchangeRate = parseFloat(procedureForm.exchange_rate) || 1;
      const totalProcedure = totalCordobas + (totalDollars * exchangeRate);
      
      // Calcular pago de doctor externo
      let externalDoctorPayment = null;
      if (procedureForm.external_doctor && procedureForm.external_doctor_payment_value) {
        if (procedureForm.external_doctor_payment_type === 'percentage') {
          externalDoctorPayment = (totalProcedure * parseFloat(procedureForm.external_doctor_payment_value) / 100);
        } else {
          if (procedureForm.external_doctor_payment_currency === 'US$') {
            externalDoctorPayment = parseFloat(procedureForm.external_doctor_payment_value) * exchangeRate;
          } else {
            externalDoctorPayment = parseFloat(procedureForm.external_doctor_payment_value);
          }
        }
      }
      
      // Preparar datos para enviar
      const procedureData = {
        procedure_description: procedureForm.procedure_description,
        total_cost: totalCordobas, // cantidad en córdobas
        total_cost_USD: totalDollars, // cantidad en dólares
        total_procedure: totalProcedure, // sumatoria de ambos convertidos a córdobas
        payment_method: procedureForm.payment_method_cordobas || procedureForm.payment_method_dollars, // método principal
        amount_cordobas: totalCordobas,
        amount_dollars: totalDollars,
        payment_method_cordobas: procedureForm.payment_method_cordobas,
        payment_method_dollars: procedureForm.payment_method_dollars,
        observations: procedureForm.observations,
        external_doctor: procedureForm.external_doctor_name,
        external_doctor_payment: externalDoctorPayment,
        theres_external_doctor: procedureForm.external_doctor,
        external_doctor_name: procedureForm.external_doctor_name,
        external_doctor_specialty: procedureForm.external_doctor_specialty,
        external_doctor_payment_type: procedureForm.external_doctor_payment_type,
        external_doctor_payment_value: procedureForm.external_doctor_payment_value,
        external_doctor_payment_currency: procedureForm.external_doctor_payment_currency
      };
      
      // Solo añadir porcentajes si es ortodoncia
      if (selectedAppointment.is_orthodontics) {
        procedureData.clinic_payment_percentage = procedureForm.clinic_payment_percentage;
        procedureData.doctor_payment_percentage = procedureForm.doctor_payment_percentage;
      } else {
        procedureData.clinic_payment_percentage = 100;
        procedureData.doctor_payment_percentage = 0;
      }
      
      console.log('Datos del procedimiento:', procedureData);
      
      await convertAppointmentToProcedure(
        selectedAppointment.appointment_ID,
        procedureData
      );
      
      // Resetear formulario
      setShowConvertModal(false);
      setProcedureForm({
        procedure_description: '',
        amount_cordobas: '',
        amount_dollars: '',
        payment_method_cordobas: 'Efectivo',
        payment_method_dollars: 'Efectivo',
        exchange_rate: currentSettings.exchange_rate,
        external_doctor: false,
        external_doctor_name: '',
        external_doctor_specialty: '',
        external_doctor_payment_type: 'percentage',
        external_doctor_payment_value: '',
        external_doctor_payment_currency: 'C$',
        clinic_payment_percentage: currentSettings.clinic_payment,
        doctor_payment_percentage: currentSettings.doctor_payment,
        observations: ''
      });
      
      // Recargar citas
      fetchAppointments();
      
      alert('✅ Procedimiento registrado exitosamente');
      
      // Redirigir
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
    // Verificar si la cita está completada (permitir citas recién completadas del modal automático)
    const isRecentlyCompleted = appointment === justCompletedAppointment;
    
    if (!isRecentlyCompleted) {
      // Verificar si la cita ya ha sido registrada como procedimiento
      if (appointment.is_registered || hasProcedure(appointment)) {
        alert('Esta cita ya ha sido registrada como procedimiento');
        return;
      }
      
      if (appointment.state !== 'completed') {
        alert('Solo se pueden registrar procedimientos de citas completadas');
        return;
      }
    }
    
    setSelectedAppointment(appointment);
    setProcedureForm({
      procedure_description: appointment.query_type || '',
      amount_cordobas: '',
      amount_dollars: '',
      payment_method_cordobas: 'Efectivo',
      payment_method_dollars: 'Efectivo',
      exchange_rate: currentSettings.exchange_rate,
      external_doctor: false,
      external_doctor_name: '',
      external_doctor_specialty: '',
      external_doctor_payment_type: 'percentage',
      external_doctor_payment_value: '',
      external_doctor_payment_currency: 'C$',
      clinic_payment_percentage: appointment.is_orthodontics ? currentSettings.clinic_payment : 100,
      doctor_payment_percentage: appointment.is_orthodontics ? currentSettings.doctor_payment : 0,
      observations: appointment.observations || ''
    });
    setShowConvertModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      [APPOINTMENT_STATUS.SCHEDULED]: '#FFA726',
      [APPOINTMENT_STATUS.COMPLETED]: '#66BB6A',
      [APPOINTMENT_STATUS.CANCELLED]: '#EF5350',
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
        <div className={`filter-section ${expandedFilterSection ? 'expanded' : ''}`}>
          <div className="filter-header-mobile" onClick={() => setExpandedFilterSection(!expandedFilterSection)}>
            <div className="filter-header-content">
              <h3>
                <FontAwesomeIcon icon={faFilter} />
                Filtros
              </h3>
              <span className="filter-summary">
                {timeFilter === TIME_FILTERS.TODAY ? 'Hoy' : 
                 timeFilter === TIME_FILTERS.THIS_WEEK ? 'Esta semana' :
                 timeFilter === TIME_FILTERS.THIS_MONTH ? 'Este mes' : 'Todas'} • 
                {statusFilter === 'all' ? ' Todos estados' : getStatusLabel(statusFilter)} • 
                {typeFilter === 'all' ? ' Todos tipos' : typeFilter === 'orthodontics' ? ' Ortodoncia' : 'General'}
              </span>
            </div>
            <FontAwesomeIcon 
              icon={expandedFilterSection ? faChevronUp : faChevronDown} 
              className="filter-toggle-icon"
            />
          </div>
          
          <div className="filter-content-container">
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
            </div>
          </div>
        </div>
      )}

      {/* Estadísticas - Desplegables en móvil */}
      <div className={`appointments-stats ${expandedStats ? 'expanded' : ''}`}>
        <div className="stats-header-mobile" onClick={() => setExpandedStats(!expandedStats)}>
          <div className="stats-header-content">
            <h3 className="stats-title">
              <FontAwesomeIcon icon={faChartBar} />
              Estadísticas
            </h3>
            <div className="stats-summary-mobile">
              <span className="stat-summary-item">Total: {stats.total}</span>
              <span className="stat-summary-item">Hoy: {stats.today}</span>
              <span className="stat-summary-item">Pendientes: {stats.pending}</span>
            </div>
          </div>
          <FontAwesomeIcon 
            icon={expandedStats ? faChevronUp : faChevronDown} 
            className="stats-toggle-icon"
          />
        </div>
        
        <div className="stats-grid-container">
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
      </div>

      {/* BUSCADOR PRINCIPAL */}
      <div className="search-box-main-container">
        <div className="filter-group">
          <label className="filter-label">Buscar citas:</label>
          <div className="search-box-main">
            <input
              type="text"
              placeholder="Buscar por paciente, servicio o fecha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input-main"
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
          <small className="search-help-text">
            Busca por nombre del paciente, tipo de servicio o fecha (ej: "Juan Pérez", "Limpieza", "15/01/2025")
          </small>
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
              <div className="appointment-card-content">
                <div className="appointment-main-row compact-view">
                  {/* Fecha y hora */}
                  <div className="appointment-column date-column compact">
                    <div className="appointment-date-short compact">
                      {formatDateShort(appointment.appointment_date_utc || appointment.appointment_date)}
                    </div>
                    <div className="appointment-time compact">
                      {formatTime(appointment.appointment_date_utc || appointment.appointment_date)}
                    </div>
                  </div>

                  {/* Paciente */}
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

                  {/* Servicio */}
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

                  {/* Estado */}
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
                    {appointment.is_registered && (
                      <div className="procedure-badge registered">
                        <FontAwesomeIcon icon={faCheckCircle} />
                        <span>Registrado</span>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="appointment-column actions-column compact">
                    <div className="appointment-actions-horizontal">
                      {/* Botón para convertir en procedimiento */}
                      {appointment.state === 'completed' && !appointment.is_registered && !hasProcedure(appointment) && (
                        <button 
                          className="action-btn-horizontal convert-btn"
                          onClick={() => openConvertModal(appointment)}
                          title="Registrar como procedimiento"
                          disabled={appointment.is_registered}
                        >
                          <FontAwesomeIcon icon={faExchangeAlt} />
                          <span>Registrar</span>
                        </button>
                      )}
                      
                      {/* Botones de estado */}
                      <div className="status-actions-horizontal">
                        {appointment.state === 'scheduled' && !hasProcedure(appointment) && (
                          <>
                            <button 
                              className="status-action-btn complete-action"
                              onClick={() => handleUpdateAppointmentWithAutoConvert(appointment.appointment_ID, 'completed')}
                            >
                              <FontAwesomeIcon icon={faCheckCircle} />
                              Completar
                            </button>
                            <button 
                              className="status-action-btn cancel-action"
                              onClick={() => handleUpdateAppointmentWithAutoConvert(appointment.appointment_ID, 'cancelled')}
                            >
                              <FontAwesomeIcon icon={faTimesCircle} />
                              Cancelar
                            </button>
                          </>
                        )}
                        {appointment.state === 'completed' && !hasProcedure(appointment) && (
                          <button 
                            className="status-action-btn cancel-action"
                            onClick={() => handleUpdateAppointmentWithAutoConvert(appointment.appointment_ID, 'cancelled')}
                          >
                            <FontAwesomeIcon icon={faTimesCircle} />
                            Cancelar
                          </button>
                        )}
                      </div>
                      
                      {/* Botones de editar/eliminar */}
                      <div className="edit-delete-actions">
                        <button 
                          className="action-btn-small edit-btn"
                          onClick={() => handleOpenEditModal(appointment)}
                          title="Editar cita"
                          disabled={!canEditAppointment(appointment)}
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button 
                          className="action-btn-small delete-btn"
                          onClick={() => handleDeleteAppointment(appointment.appointment_ID)}
                          title="Eliminar cita"
                          disabled={hasProcedure(appointment)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                      
                      {/* Mostrar icono de bloqueo si tiene procedimiento */}
                      {appointment.is_registered && (
                        <div className="locked-indicator" title="Cita registrada - Ya tiene procedimiento">
                          <FontAwesomeIcon icon={faCheckCircle} />
                          <span>Registrada</span>
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
                          <span className="detail-value">
                            {formatDateTime(appointment.appointment_date_utc || appointment.appointment_date)}
                          </span>
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
                    {appointment.is_registered && (
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
                          <p className="procedure-note">
                            <small>El botón de registro está inhabilitado para evitar duplicidad de datos.</small>
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
                onClick={() => {
                  setShowAddModal(false);
                  setPatientSearchTerm('');
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <form onSubmit={handleAddAppointment} className="appointment-form">
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

              {/* Paciente */}
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

              {/* Fecha y hora - NOTA: El input datetime-local devuelve hora local (Nicaragua) */}
              <div className="form-group">
                <label className="form-label">Fecha y hora (hora Nicaragua):</label>
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
                <small className="form-help-text">Seleccione la fecha y hora en hora de Nicaragua</small>
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

      {/* Modal para Editar Cita */}
      {showEditModal && editingAppointment && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faEdit} />
                Editar Cita
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingAppointment(null);
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEditAppointment} className="appointment-form">
              <div className="form-group">
                <label className="form-label">Paciente:</label>
                <input
                  type="text"
                  value={editingAppointment.patient_name || ''}
                  className="form-input"
                  disabled
                  readOnly
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Fecha y hora (hora Nicaragua):</label>
                <input
                  type="datetime-local"
                  required
                  value={editFormData.appointment_date}
                  onChange={(e) => setEditFormData({
                    ...editFormData,
                    appointment_date: e.target.value
                  })}
                  className="form-input"
                />
                <small className="form-help-text">Seleccione la fecha y hora en hora de Nicaragua</small>
              </div>
              
              <div className="form-group">
                <label className="form-label">Tipo de consulta:</label>
                <input
                  type="text"
                  required
                  value={editFormData.query_type}
                  onChange={(e) => setEditFormData({
                    ...editFormData,
                    query_type: e.target.value
                  })}
                  className="form-input"
                  placeholder="Ej: Limpieza dental, revisión de ortodoncia, etc."
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">
                  <div className="switch-container">
                    <span>Tipo de servicio:</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={editFormData.is_orthodontics}
                        onChange={(e) => setEditFormData({
                          ...editFormData,
                          is_orthodontics: e.target.checked,
                          query_type: e.target.checked ? 'Ortodoncia' : editFormData.query_type
                        })}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span className="switch-label">
                      {editFormData.is_orthodontics ? 'Ortodoncia' : 'Servicio General'}
                    </span>
                  </div>
                </label>
              </div>
              
              <div className="form-group">
                <label className="form-label">Observaciones:</label>
                <textarea
                  value={editFormData.observations}
                  onChange={(e) => setEditFormData({
                    ...editFormData,
                    observations: e.target.value
                  })}
                  className="form-textarea"
                  placeholder="Notas adicionales sobre la cita..."
                  rows="3"
                />
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn-cancel"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingAppointment(null);
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                >
                  <FontAwesomeIcon icon={faSave} />
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Conversión Automática después de completar cita */}
      {showAutoConvertModal && justCompletedAppointment && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faCheckCircle} />
                ¡Cita Completada!
              </h3>
              <button 
                className="close-modal-btn"
                onClick={handleCloseAutoConvertModal}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="auto-convert-message">
              <div className="success-icon">
                <FontAwesomeIcon icon={faCheckCircle} />
              </div>
              <h4>¿Desea registrar esta cita como procedimiento?</h4>
              <p>
                La cita de <strong>{justCompletedAppointment.patient_name}</strong> 
                ({justCompletedAppointment.is_orthodontics ? 'Ortodoncia' : 'General'}) 
                ha sido marcada como completada.
              </p>
              <p className="info-text">
                Es recomendable registrar el procedimiento para llevar un control de ingresos y tratamientos.
              </p>
              
              <div className="auto-convert-actions">
                <button 
                  className="btn-cancel"
                  onClick={handleCloseAutoConvertModal}
                >
                  Registrar más tarde
                </button>
                <button 
                  className="btn-submit"
                  onClick={() => {
                    handleCloseAutoConvertModal();
                    // Forzar el estado a completado para la cita recién completada
                    openConvertModal({
                      ...justCompletedAppointment,
                      state: 'completed'
                    });
                  }}
                >
                  <FontAwesomeIcon icon={faExchangeAlt} />
                  Registrar Procedimiento Ahora
                </button>
              </div>
              
              <div className="skip-option">
                <button 
                  className="btn-skip"
                  onClick={handleCloseAutoConvertModal}
                >
                  No registrar procedimiento (solo marcar como completada)
                </button>
                <small>Puede registrar el procedimiento más tarde desde la lista de citas</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para convertir cita en procedimiento */}
      {showConvertModal && selectedAppointment && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
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
                    amount_cordobas: '',
                    amount_dollars: '',
                    payment_method_cordobas: 'Efectivo',
                    payment_method_dollars: 'Efectivo',
                    exchange_rate: currentSettings.exchange_rate,
                    external_doctor: false,
                    external_doctor_name: '',
                    external_doctor_specialty: '',
                    external_doctor_payment_type: 'percentage',
                    external_doctor_payment_value: '',
                    external_doctor_payment_currency: 'C$',
                    clinic_payment_percentage: currentSettings.clinic_payment,
                    doctor_payment_percentage: currentSettings.doctor_payment,
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
              <p><strong>Fecha:</strong> {formatDateTime(selectedAppointment.appointment_date_utc || selectedAppointment.appointment_date)}</p>
              <p><strong>Tipo:</strong> {selectedAppointment.is_orthodontics ? 'Ortodoncia' : 'Procedimiento Regular'}</p>
              <p><strong>Consulta:</strong> {selectedAppointment.query_type}</p>
            </div>
            
            <form onSubmit={handleConvertToProcedure} className="procedure-form">
              <div className="form-section">
                <h4>Detalles del Procedimiento</h4>
                
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
                
                {/* Sección de pagos mixtos */}
                <div className="mixed-payment-section">
                  <h5>Pagos Mixtos (Córdobas y Dólares)</h5>
                  
                  <div className="payment-row">
                    <div className="payment-column">
                      <div className="form-group">
                        <label className="form-label">
                          <FontAwesomeIcon icon={faMoneyBillWave} /> Cantidad en Córdobas (C$):
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={procedureForm.amount_cordobas}
                          onChange={(e) => handlePaymentChange('amount_cordobas', e.target.value)}
                          className="form-input"
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Método de Pago (C$):</label>
                        <select
                          value={procedureForm.payment_method_cordobas}
                          onChange={(e) => setProcedureForm({
                            ...procedureForm,
                            payment_method_cordobas: e.target.value
                          })}
                          className="form-select"
                        >
                          <option value="">Seleccionar...</option>
                          <option value="Efectivo">Efectivo</option>
                          <option value="POS">POS (Tarjeta)</option>
                          <option value="Transferencia">Transferencia</option>
                          <option value="Cheque">Cheque</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="payment-column">
                      <div className="form-group">
                        <label className="form-label">
                          <FontAwesomeIcon icon={faDollarSign} /> Cantidad en Dólares (US$):
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={procedureForm.amount_dollars}
                          onChange={(e) => handlePaymentChange('amount_dollars', e.target.value)}
                          className="form-input"
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Método de Pago (USD):</label>
                        <select
                          value={procedureForm.payment_method_dollars}
                          onChange={(e) => setProcedureForm({
                            ...procedureForm,
                            payment_method_dollars: e.target.value
                          })}
                          className="form-select"
                        >
                          <option value="">Seleccionar...</option>
                          <option value="Efectivo">Efectivo</option>
                          <option value="POS">POS (Tarjeta)</option>
                          <option value="Transferencia">Transferencia</option>
                          <option value="Cheque">Cheque</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  {/* Tipo de cambio */}
                  <div className="form-group">
                    <label className="form-label">
                      <FontAwesomeIcon icon={faExchangeAlt} /> Tipo de Cambio (C$ por US$):
                    </label>
                    <input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={procedureForm.exchange_rate}
                      onChange={(e) => handlePaymentChange('exchange_rate', e.target.value)}
                      className="form-input"
                      placeholder="36.5000"
                    />
                  </div>
                  
                  {/* Totales calculados */}
                  <div className="totals-section">
                    <div className="total-row">
                      <span className="total-label">Total en Córdobas (C$):</span>
                      <span className="total-value">
                        {formatCurrency(calculateTotalCordobas())}
                      </span>
                    </div>
                    
                    <div className="total-row">
                      <span className="total-label">Total en Dólares (US$):</span>
                      <span className="total-value">
                        {formatCurrencyUSD(calculateTotalDollars())}
                      </span>
                    </div>
                    
                    <div className="total-row total-procedure">
                      <span className="total-label">Total del Procedimiento (C$):</span>
                      <span className="total-value">
                        {formatCurrency(calculateTotalProcedure())}
                      </span>
                    </div>
                    
                    <div className="total-breakdown">
                      <small>
                        * C$ {procedureForm.amount_cordobas || '0.00'} ({procedureForm.payment_method_cordobas || 'Sin método'})<br />
                        * US$ {procedureForm.amount_dollars || '0.00'} ({procedureForm.payment_method_dollars || 'Sin método'})<br />
                        * Tipo de cambio: C$ {procedureForm.exchange_rate} por US$ 1
                      </small>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Sección de Doctor Externo */}
              <div className="form-section">
                <div className="toggle-section">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={procedureForm.external_doctor}
                      onChange={(e) => setProcedureForm({
                        ...procedureForm,
                        external_doctor: e.target.checked,
                        external_doctor_name: e.target.checked ? procedureForm.external_doctor_name : '',
                        external_doctor_specialty: e.target.checked ? procedureForm.external_doctor_specialty : ''
                      })}
                    />
                    <span>¿Hubo participación de doctor externo?</span>
                  </label>
                </div>
                
                {procedureForm.external_doctor && (
                  <div className="external-doctor-section">
                    <div className="form-group">
                      <label className="form-label">Nombre del Doctor Externo:</label>
                      <input
                        type="text"
                        value={procedureForm.external_doctor_name}
                        onChange={(e) => setProcedureForm({
                          ...procedureForm,
                          external_doctor_name: e.target.value
                        })}
                        className="form-input"
                        placeholder="Dr. Nombre Apellido"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Especialidad:</label>
                      <input
                        type="text"
                        value={procedureForm.external_doctor_specialty}
                        onChange={(e) => setProcedureForm({
                          ...procedureForm,
                          external_doctor_specialty: e.target.value
                        })}
                        className="form-input"
                        placeholder="Ej: Cirujano maxilofacial, Endodoncista, etc."
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Tipo de Pago al Doctor:</label>
                      <div className="payment-type-buttons">
                        <button
                          type="button"
                          className={`payment-type-btn ${procedureForm.external_doctor_payment_type === 'percentage' ? 'active' : ''}`}
                          onClick={() => handleExternalDoctorPaymentChange('external_doctor_payment_type', 'percentage')}
                        >
                          Porcentaje del total
                        </button>
                        <button
                          type="button"
                          className={`payment-type-btn ${procedureForm.external_doctor_payment_type === 'fixed' ? 'active' : ''}`}
                          onClick={() => handleExternalDoctorPaymentChange('external_doctor_payment_type', 'fixed')}
                        >
                          Cantidad fija
                        </button>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">
                        {procedureForm.external_doctor_payment_type === 'percentage' ? 'Porcentaje:' : 'Cantidad:'}
                      </label>
                      <div className="payment-input-container">
                        {procedureForm.external_doctor_payment_type === 'fixed' && (
                          <select
                            value={procedureForm.external_doctor_payment_currency}
                            onChange={(e) => handleExternalDoctorPaymentChange('external_doctor_payment_currency', e.target.value)}
                            className="currency-select"
                          >
                            <option value="C$">C$</option>
                            <option value="US$">US$</option>
                          </select>
                        )}
                        <input
                          type="number"
                          min="0"
                          step={procedureForm.external_doctor_payment_type === 'percentage' ? "0.1" : "0.01"}
                          max={procedureForm.external_doctor_payment_type === 'percentage' ? "100" : ""}
                          value={procedureForm.external_doctor_payment_value}
                          onChange={(e) => handleExternalDoctorPaymentChange('external_doctor_payment_value', e.target.value)}
                          className="form-input"
                          placeholder={procedureForm.external_doctor_payment_type === 'percentage' ? '0.0%' : '0.00'}
                        />
                        {procedureForm.external_doctor_payment_type === 'percentage' && <span className="input-suffix">%</span>}
                      </div>
                      <small className="form-help-text">
                        {procedureForm.external_doctor_payment_type === 'percentage' 
                          ? `Equivalente: ${(calculateTotalProcedure() * parseFloat(procedureForm.external_doctor_payment_value || 0) / 100).toFixed(2)} C$`
                          : procedureForm.external_doctor_payment_currency === 'US$'
                            ? `Equivalente: ${(parseFloat(procedureForm.external_doctor_payment_value || 0) * procedureForm.exchange_rate).toFixed(2)} C$`
                            : ''}
                      </small>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Para ortodoncia, mostrar porcentajes de distribución */}
              {selectedAppointment.is_orthodontics && (
                <div className="form-section">
                  <h4>
                    <FontAwesomeIcon icon={faPercentage} />
                    Distribución de Ortodoncia
                  </h4>
                  <div className="ortho-distribution-info">
                    <div className="distribution-item clinic">
                      <span className="distribution-label">Clínica:</span>
                      <span className="distribution-value">{procedureForm.clinic_payment_percentage}%</span>
                      <small>Basado en configuración actual</small>
                    </div>
                    <div className="distribution-item doctor">
                      <span className="distribution-label">Doctora Ortodoncia:</span>
                      <span className="distribution-value">{procedureForm.doctor_payment_percentage}%</span>
                      <small>Basado en configuración actual</small>
                    </div>
                  </div>
                  <div className="ortho-calculations">
                    <small>
                      * Total del procedimiento: {formatCurrency(calculateTotalProcedure())} <br />
                      * Clínica recibirá: {formatCurrency((calculateTotalProcedure() * procedureForm.clinic_payment_percentage / 100) - (procedureForm.external_doctor ? parseFloat(procedureForm.external_doctor_payment_value || 0) : 0))} <br />
                      * Doctora ortodoncia recibirá: {formatCurrency(calculateTotalProcedure() * procedureForm.doctor_payment_percentage / 100)}
                    </small>
                  </div>
                </div>
              )}
              
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
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn-cancel"
                  onClick={() => {
                    setShowConvertModal(false);
                    setProcedureForm({
                      procedure_description: '',
                      amount_cordobas: '',
                      amount_dollars: '',
                      payment_method_cordobas: 'Efectivo',
                      payment_method_dollars: 'Efectivo',
                      exchange_rate: currentSettings.exchange_rate,
                      external_doctor: false,
                      external_doctor_name: '',
                      external_doctor_specialty: '',
                      external_doctor_payment_type: 'percentage',
                      external_doctor_payment_value: '',
                      external_doctor_payment_currency: 'C$',
                      clinic_payment_percentage: currentSettings.clinic_payment,
                      doctor_payment_percentage: currentSettings.doctor_payment,
                      observations: ''
                    });
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={!procedureForm.procedure_description || 
                            (!procedureForm.amount_cordobas && !procedureForm.amount_dollars)}
                >
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