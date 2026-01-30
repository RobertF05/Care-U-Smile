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

// FUNCIONES FORMATADORAS
const formatDateTime = (dateString) => {
  if (!dateString) return '';
  
  try {
    if (typeof dateString === 'string' && dateString.includes(', ') && 
        (dateString.includes('p. m.') || dateString.includes('a. m.'))) {
      return dateString;
    }
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      const parts = dateString.split(' ');
      if (parts.length >= 6) {
        return dateString;
      }
      return 'Fecha inválida';
    }
    
    return date.toLocaleString('es-NI', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Managua'
    });
  } catch (error) {
    console.error('Error formateando fecha:', error);
    return dateString || 'Fecha inválida';
  }
};

const formatTime = (dateString) => {
  if (!dateString) return '';
  
  try {
    const normalizedString = dateString.replace(/\xa0/g, ' ');
    
    if (typeof normalizedString === 'string') {
      const timeMatch = normalizedString.match(/(\d{1,2}):(\d{2}):(\d{2})\s+([ap])\.\s*m\./i);
      
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2];
        const ampm = timeMatch[4].toLowerCase() === 'p' ? 'p. m.' : 'a. m.';
        const hour12 = hour % 12 || 12;
        
        return `${hour12}:${minute} ${ampm}`;
      }
      
      const alternativeMatch = normalizedString.match(/(\d{1,2}):(\d{2}):(\d{2})/);
      if (alternativeMatch) {
        const hour = parseInt(alternativeMatch[1]);
        const minute = alternativeMatch[2];
        const isPM = normalizedString.toLowerCase().includes('p.');
        const ampm = isPM ? 'p. m.' : 'a. m.';
        const hour12 = hour % 12 || 12;
        
        return `${hour12}:${minute} ${ampm}`;
      }
    }
    
    if (dateString.includes('T') && dateString.includes(':')) {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return '--:--';
      }
      
      const utcHours = date.getUTCHours();
      const utcMinutes = date.getUTCMinutes();
      
      let nicaraguaHours = utcHours - 6;
      if (nicaraguaHours < 0) nicaraguaHours += 24;
      
      const ampm = nicaraguaHours >= 12 ? 'p. m.' : 'a. m.';
      const hour12 = nicaraguaHours % 12 || 12;
      
      return `${hour12}:${utcMinutes.toString().padStart(2, '0')} ${ampm}`;
    }
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      const manualMatch = dateString.match(/(\d{1,2}):(\d{2})/);
      if (manualMatch) {
        const hour = parseInt(manualMatch[1]);
        const minute = manualMatch[2];
        const isPM = dateString.toLowerCase().includes('p.');
        const ampm = isPM ? 'p. m.' : 'a. m.';
        const hour12 = hour % 12 || 12;
        
        return `${hour12}:${minute} ${ampm}`;
      }
      
      return '--:--';
    }
    
    return date.toLocaleTimeString('es-NI', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Managua'
    });
    
  } catch (error) {
    console.error('Error formateando hora:', error);
    return '--:--';
  }
};

const formatDateShort = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      const dateMatch = dateString.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (dateMatch) {
        return dateMatch[1];
      }
      return 'Fecha inválida';
    }
    
    return date.toLocaleDateString('es-NI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Managua'
    });
  } catch (error) {
    console.error('Error formateando fecha corta:', error);
    return 'Fecha inválida';
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

// Función para obtener fecha/hora actual para input
const getCurrentDateTimeForInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const prepareForDateTimeInput = (dateString) => {
  if (!dateString) return getCurrentDateTimeForInput();
  
  try {
    if (dateString.includes(', ') && (dateString.includes('p. m.') || dateString.includes('a. m.'))) {
      const parts = dateString.split(', ');
      if (parts.length === 2) {
        const [datePart, timePart] = parts;
        const [day, month, year] = datePart.split('/');
        
        const timeMatch = timePart.match(/(\d{1,2}):(\d{2}):(\d{2}) ([ap])\. m\./i);
        if (timeMatch) {
          const hour = parseInt(timeMatch[1]);
          const minute = timeMatch[2];
          const ampm = timeMatch[4].toLowerCase();
          
          let hour24 = hour;
          if (ampm === 'p') {
            if (hour24 < 12) {
              hour24 += 12;
            }
          } else {
            if (hour24 === 12) {
              hour24 = 0;
            }
          }
          
          return `${year}-${month}-${day}T${String(hour24).padStart(2, '0')}:${minute}`;
        }
      }
    }
    
    if (dateString.includes('T')) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      }
    }
    
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    return getCurrentDateTimeForInput();
    
  } catch (error) {
    console.error('Error preparando fecha para input:', error, dateString);
    return getCurrentDateTimeForInput();
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
  const [timeFilter, setTimeFilter] = useState(TIME_FILTERS.ALL);
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
  
  // Estados para desplegables móviles
  const [expandedStats, setExpandedStats] = useState(false);
  const [expandedFilterSection, setExpandedFilterSection] = useState(false);
  
  // Formulario de nueva cita
  const [newAppointment, setNewAppointment] = useState({
    patient_id: '',
    appointment_date: getCurrentDateTimeForInput(),
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

  // Formulario de procedimiento CON CAMPOS DE DEDUCCIÓN Y DÓLARES
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

  // Variables para cálculos
  const [externalDoctorPaymentCordobas, setExternalDoctorPaymentCordobas] = useState(0);
  const [externalDoctorPaymentDollars, setExternalDoctorPaymentDollars] = useState(0);

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

  // FUNCIONES DE CÁLCULO DE DEDUCCIÓN POS (5.5%)
  const calculatePOSDeduction = (amount) => {
    return amount * 0.055; // 5.5%
  };

  const calculateNetAfterPOS = (amount) => {
    return amount - calculatePOSDeduction(amount);
  };

  // Calcular totales incluyendo deducciones Y CONVERSIONES A DÓLARES
  const calculateTotalsWithDeductions = () => {
    const cordobas = parseFloat(procedureForm.amount_cordobas) || 0;
    const dollars = parseFloat(procedureForm.amount_dollars) || 0;
    const exchangeRate = parseFloat(procedureForm.exchange_rate) || 1;
    
    // Determinar qué pagos son con POS
    const isCordobasPOS = procedureForm.payment_method_cordobas === 'POS';
    const isDollarsPOS = procedureForm.payment_method_dollars === 'POS';
    
    // Calcular bruto
    const grossCordobas = cordobas;
    const grossDollars = dollars;
    
    // Calcular deducciones
    const posDeductionCordobas = isCordobasPOS ? calculatePOSDeduction(cordobas) : 0;
    const posDeductionDollars = isDollarsPOS ? calculatePOSDeduction(dollars) : 0;
    
    // Calcular neto
    const netCordobas = grossCordobas - posDeductionCordobas;
    const netDollars = grossDollars - posDeductionDollars;
    
    // Convertir todo a córdobas para totales
    const grossTotalCordobas = grossCordobas + (grossDollars * exchangeRate);
    const totalDeductions = posDeductionCordobas + (posDeductionDollars * exchangeRate);
    const netTotalCordobas = grossTotalCordobas - totalDeductions;
    
    // Calcular totales en dólares
    const grossTotalDollars = grossDollars + (grossCordobas / exchangeRate);
    const netTotalDollars = grossTotalDollars - (totalDeductions / exchangeRate);
    
    return {
      // Bruto
      grossCordobas,
      grossDollars,
      grossTotalCordobas,
      grossTotalDollars,
      
      // Deducciones
      posDeductionCordobas,
      posDeductionDollars,
      totalDeductions,
      
      // Neto
      netCordobas,
      netDollars,
      netTotalCordobas,
      netTotalDollars,
      
      // Información de método de pago
      isCordobasPOS,
      isDollarsPOS,
      exchangeRate
    };
  };

  // Calcular total en córdobas (bruto)
  const calculateTotalCordobas = () => {
    const totals = calculateTotalsWithDeductions();
    return totals.grossTotalCordobas;
  };

  // Calcular total en dólares (bruto)
  const calculateTotalDollars = () => {
    const totals = calculateTotalsWithDeductions();
    return totals.grossTotalDollars;
  };

  // Calcular total del procedimiento (neto después de deducciones) en córdobas
  const calculateTotalProcedure = () => {
    const totals = calculateTotalsWithDeductions();
    return totals.netTotalCordobas;
  };

  // Calcular total del procedimiento (neto después de deducciones) en dólares
  const calculateTotalProcedureUSD = () => {
    const totals = calculateTotalsWithDeductions();
    return totals.netTotalDollars;
  };

  // Calcular pagos para ortodoncia en ambas monedas
  const calculateOrthoPayments = () => {
    const totals = calculateTotalsWithDeductions();
    const clinicPercentage = parseFloat(procedureForm.clinic_payment_percentage) || 40;
    const doctorPercentage = parseFloat(procedureForm.doctor_payment_percentage) || 60;
    
    // Calcular montos en córdobas
    const clinicPaymentCordobas = (totals.netTotalCordobas * clinicPercentage / 100);
    const doctorPaymentCordobas = (totals.netTotalCordobas * doctorPercentage / 100);
    
    // Calcular montos en dólares (usando el mismo porcentaje)
    const clinicPaymentDollars = (totals.netTotalDollars * clinicPercentage / 100);
    const doctorPaymentDollars = (totals.netTotalDollars * doctorPercentage / 100);
    
    return {
      clinicPaymentCordobas,
      doctorPaymentCordobas,
      clinicPaymentDollars,
      doctorPaymentDollars,
      clinicPercentage,
      doctorPercentage
    };
  };

  // Manejar cambios en los pagos
  const handlePaymentChange = (field, value) => {
    const updatedForm = { ...procedureForm };
    updatedForm[field] = value;
    
    // Si cambia el tipo de cambio, recalcular
    if (field === 'exchange_rate') {
      const newRate = parseFloat(value) || 1;
      updatedForm.exchange_rate = newRate;
    }
    
    setProcedureForm(updatedForm);
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
      const totals = calculateTotalsWithDeductions();
      const totalCost = totals.netTotalCordobas;
      const paymentValue = parseFloat(value) || 0;
      
      if (updatedForm.external_doctor_payment_type === 'percentage') {
        if (paymentValue > 100) {
          alert('El porcentaje no puede ser mayor a 100%');
          updatedForm.external_doctor_payment_value = '100';
        }
      } else {
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
    
    // Calcular montos de doctor externo
    if (updatedForm.external_doctor && updatedForm.external_doctor_payment_value) {
      const totals = calculateTotalsWithDeductions();
      
      if (updatedForm.external_doctor_payment_type === 'percentage') {
        const percentage = parseFloat(updatedForm.external_doctor_payment_value) / 100;
        const externalCordobas = totals.netTotalCordobas * percentage;
        const externalDollars = totals.netTotalDollars * percentage;
        
        setExternalDoctorPaymentCordobas(externalCordobas);
        setExternalDoctorPaymentDollars(externalDollars);
      } else {
        const paymentValue = parseFloat(updatedForm.external_doctor_payment_value);
        if (updatedForm.external_doctor_payment_currency === 'US$') {
          setExternalDoctorPaymentDollars(paymentValue);
          setExternalDoctorPaymentCordobas(paymentValue * updatedForm.exchange_rate);
        } else {
          setExternalDoctorPaymentCordobas(paymentValue);
          setExternalDoctorPaymentDollars(paymentValue / updatedForm.exchange_rate);
        }
      }
    } else {
      setExternalDoctorPaymentCordobas(0);
      setExternalDoctorPaymentDollars(0);
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
    const hasProcedure = appointment.is_registered || appointment.procedure_id || appointment.procedure_ID;
    const isCompleted = appointment.state === 'completed';
    const isCancelled = appointment.state === 'cancelled';
    
    return !hasProcedure && !isCompleted && !isCancelled;
  };

  // Filtrar citas
  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments];

    const now = new Date();
    
    switch (timeFilter) {
      case TIME_FILTERS.TODAY:
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        filtered = filtered.filter(apt => {
          try {
            const aptDateStr = apt.appointment_date?.split(', ')[0];
            if (!aptDateStr) return false;
            
            const [day, month, year] = aptDateStr.split('/');
            const aptDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            
            return aptDate >= today && aptDate < tomorrow;
          } catch (error) {
            console.error('Error filtrando por hoy:', error, apt);
            return false;
          }
        });
        break;
      case TIME_FILTERS.THIS_WEEK:
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        
        filtered = filtered.filter(apt => {
          try {
            const aptDateStr = apt.appointment_date?.split(', ')[0];
            if (!aptDateStr) return false;
            
            const [day, month, year] = aptDateStr.split('/');
            const aptDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            
            return aptDate >= startOfWeek && aptDate < endOfWeek;
          } catch (error) {
            console.error('Error filtrando por semana:', error, apt);
            return false;
          }
        });
        break;
      case TIME_FILTERS.THIS_MONTH:
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        
        filtered = filtered.filter(apt => {
          try {
            const aptDateStr = apt.appointment_date?.split(', ')[0];
            if (!aptDateStr) return false;
            
            const [day, month, year] = aptDateStr.split('/');
            const aptDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            
            return aptDate >= startOfMonth && aptDate < endOfMonth;
          } catch (error) {
            console.error('Error filtrando por mes:', error, apt);
            return false;
          }
        });
        break;
      case TIME_FILTERS.ALL:
      default:
        break;
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.state === statusFilter);
    }

    if (typeFilter !== 'all') {
      const isOrtho = typeFilter === 'orthodontics';
      filtered = filtered.filter(apt => apt.is_orthodontics === isOrtho);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(apt => {
        const patientName = (apt.patient_name || '').toLowerCase();
        const queryType = (apt.query_type || '').toLowerCase();
        const appointmentDate = (apt.appointment_date || '').toLowerCase();
        
        return patientName.includes(term) || 
               queryType.includes(term) || 
               appointmentDate.includes(term);
      });
    }

    return filtered.sort((a, b) => {
      try {
        const dateAStr = a.appointment_date?.split(', ')[0];
        const dateBStr = b.appointment_date?.split(', ')[0];
        
        if (!dateAStr || !dateBStr) return 0;
        
        const [dayA, monthA, yearA] = dateAStr.split('/');
        const [dayB, monthB, yearB] = dateBStr.split('/');
        
        const dateA = new Date(parseInt(yearA), parseInt(monthA) - 1, parseInt(dayA));
        const dateB = new Date(parseInt(yearB), parseInt(monthB) - 1, parseInt(dayB));
        
        return dateA - dateB;
      } catch (error) {
        console.error('Error ordenando citas:', error);
        return 0;
      }
    });
  }, [appointments, timeFilter, statusFilter, typeFilter, searchTerm]);

  // Estadísticas
  const stats = useMemo(() => {
    const total = appointments.length;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayCount = appointments.filter(apt => {
      try {
        const aptDateStr = apt.appointment_date?.split(', ')[0];
        if (!aptDateStr) return false;
        
        const [day, month, year] = aptDateStr.split('/');
        const aptDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        return aptDate >= today && aptDate < tomorrow;
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
      today: todayCount,
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

  // Crear nueva cita
  const handleAddAppointment = async (e) => {
    e.preventDefault();
    
    try {
      console.log('📝 Datos de la cita original:', newAppointment);
      
      let dateTimeString = newAppointment.appointment_date;
      
      if (dateTimeString.length === 16) {
        dateTimeString += ':00';
      }
      
      const appointmentData = {
        Patient_ID: parseInt(newAppointment.patient_id),
        appointment_date: dateTimeString,
        query_type: newAppointment.is_orthodontics ? 'Ortodoncia' : newAppointment.query_type,
        is_orthodontics: newAppointment.is_orthodontics,
        observations: newAppointment.observations || null
      };

      console.log('📤 Enviando al backend:', appointmentData);
      
      await createAppointment(appointmentData);
      
      // Resetear formulario
      setNewAppointment({
        patient_id: '',
        appointment_date: getCurrentDateTimeForInput(),
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

  // Función para actualizar el estado de la cita
  const handleUpdateAppointmentWithAutoConvert = async (appointmentId, newState) => {
    try {
      const appointment = appointments.find(a => a.appointment_ID === appointmentId);
      
      if (hasProcedure(appointment)) {
        alert('No se puede cambiar el estado de una cita que ya tiene un procedimiento registrado');
        return;
      }
      
      await updateAppointment(appointmentId, { state: newState });
      
      await fetchAppointments();
      
      let message = '';
      switch(newState) {
        case 'completed':
          message = '✅ Cita completada';
          
          const updatedAppointments = await fetchAppointments();
          const updatedAppointment = updatedAppointments.data?.find(a => a.appointment_ID === appointmentId) || appointment;
          
          setJustCompletedAppointment({
            ...updatedAppointment,
            state: 'completed'
          });
          setShowAutoConvertModal(true);
          
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

  // Función para abrir modal de edición
  const handleOpenEditModal = (appointment) => {
    if (!canEditAppointment(appointment)) {
      alert('No se puede editar esta cita. Solo se pueden editar citas pendientes sin procedimientos.');
      return;
    }
    
    setEditingAppointment(appointment);
    
    const appointmentDateForInput = prepareForDateTimeInput(appointment.appointment_date);
    
    setEditFormData({
      appointment_date: appointmentDateForInput,
      query_type: appointment.query_type || '',
      observations: appointment.observations || '',
      is_orthodontics: appointment.is_orthodontics || false
    });
    setShowEditModal(true);
  };

  // Función para guardar cambios en la cita
  const handleSaveEditAppointment = async (e) => {
    e.preventDefault();
    
    if (!editingAppointment) return;
    
    try {
      let dateTimeString = editFormData.appointment_date;
      
      if (dateTimeString.length === 16) {
        dateTimeString += ':00';
      }
      
      const localDate = new Date(dateTimeString);
      const isoString = localDate.toISOString().replace('Z', '');
      
      const updateData = {
        appointment_date: isoString,
        query_type: editFormData.query_type,
        is_orthodontics: editFormData.is_orthodontics,
        observations: editFormData.observations || null
      };
      
      console.log('📝 Actualizando cita con datos:', updateData);
      
      await updateAppointment(editingAppointment.appointment_ID, updateData);
      
      setShowEditModal(false);
      setEditingAppointment(null);
      fetchAppointments();
      
      alert('✅ Cita actualizada exitosamente');
    } catch (error) {
      console.error('Error al actualizar cita:', error);
      alert('Error al actualizar la cita: ' + error.message);
    }
  };

  // Convertir cita en procedimiento CON DEDUCCIONES POS Y MANEJO COMPLETO DE DÓLARES
  const handleConvertToProcedure = async (e) => {
    e.preventDefault();
    
    if (!selectedAppointment) return;
    
    // Verificar si ya está registrada
    if (selectedAppointment.is_registered || hasProcedure(selectedAppointment)) {
      alert('Esta cita ya ha sido registrada como procedimiento');
      setShowConvertModal(false);
      return;
    }
    
    try {
      // Calcular valores con deducciones POS
      const totals = calculateTotalsWithDeductions();
      
      // Calcular total_procedure_USD (neto en dólares después de deducciones)
      const total_procedure_USD = totals.netTotalDollars;
      
      // Calcular pagos de ortodoncia si es necesario
      let orthoPayments = {};
      if (selectedAppointment.is_orthodontics) {
        orthoPayments = calculateOrthoPayments();
      }
      
      // Calcular pago de doctor externo
      let externalDoctorPaymentCordobas = null;
      let externalDoctorPaymentDollars = null;
      
      if (procedureForm.external_doctor && procedureForm.external_doctor_payment_value) {
        if (procedureForm.external_doctor_payment_type === 'percentage') {
          const percentage = parseFloat(procedureForm.external_doctor_payment_value) / 100;
          externalDoctorPaymentCordobas = totals.netTotalCordobas * percentage;
          externalDoctorPaymentDollars = totals.netTotalDollars * percentage;
        } else {
          const paymentValue = parseFloat(procedureForm.external_doctor_payment_value);
          if (procedureForm.external_doctor_payment_currency === 'US$') {
            externalDoctorPaymentDollars = paymentValue;
            externalDoctorPaymentCordobas = paymentValue * procedureForm.exchange_rate;
          } else {
            externalDoctorPaymentCordobas = paymentValue;
            externalDoctorPaymentDollars = paymentValue / procedureForm.exchange_rate;
          }
        }
      }
      
      // Preparar datos para enviar
      const procedureData = {
        procedure_description: procedureForm.procedure_description,
        
        // Campos en córdobas
        total_cost: totals.grossTotalCordobas,
        total_procedure: totals.netTotalCordobas,
        
        // Campos en dólares - ¡NOMBRES CORRECTOS!
        total_cost_USD: totals.grossTotalDollars, // ¡Con guión bajo y mayúsculas!
        total_procedure_USD: total_procedure_USD, // ¡Con guión bajo y mayúsculas!
        
        payment_method: 'Mixto',
        
        // Campos de pagos múltiples
        amount_cordobas: totals.grossCordobas,
        amount_dollars: totals.grossDollars,
        payment_method_cordobas: procedureForm.payment_method_cordobas,
        payment_method_dollars: procedureForm.payment_method_dollars,
        
        // Campos para deducciones POS
        pos_deduction_cordobas: totals.posDeductionCordobas,
        pos_deduction_dollars: totals.posDeductionDollars,
        total_pos_deduction: totals.totalDeductions,
        net_amount_cordobas: totals.netCordobas,
        net_amount_dollars: totals.netDollars,
        gross_amount_cordobas: totals.grossCordobas,
        gross_amount_dollars: totals.grossDollars,
        
        // Resto de campos
        observations: procedureForm.observations,
        exchange_rate: procedureForm.exchange_rate,
        
        // Campos de doctor externo
        external_doctor: procedureForm.external_doctor_name,
        external_doctor_payment: externalDoctorPaymentCordobas,
        external_doctor_payment_usd: externalDoctorPaymentDollars,
        theres_external_doctor: procedureForm.external_doctor,
        external_doctor_name: procedureForm.external_doctor_name,
        external_doctor_specialty: procedureForm.external_doctor_specialty,
        external_doctor_payment_type: procedureForm.external_doctor_payment_type,
        external_doctor_payment_value: procedureForm.external_doctor_payment_value,
        external_doctor_payment_currency: procedureForm.external_doctor_payment_currency,
    };
      
      // Añadir porcentajes y montos específicos si es ortodoncia
      if (selectedAppointment.is_orthodontics) {
        procedureData.clinic_payment_percentage = procedureForm.clinic_payment_percentage;
        procedureData.doctor_payment_percentage = procedureForm.doctor_payment_percentage;
        
        // Montos específicos para clínica y doctora
        procedureData.clinic_payment_cordobas = orthoPayments.clinicPaymentCordobas;
        procedureData.clinic_payment_dollars = orthoPayments.clinicPaymentDollars;
        procedureData.doctor_payment_cordobas = orthoPayments.doctorPaymentCordobas;
        procedureData.doctor_payment_dollars = orthoPayments.doctorPaymentDollars;
        
        // Restar pago de doctor externo si existe
        if (externalDoctorPaymentCordobas) {
          procedureData.clinic_payment_cordobas -= externalDoctorPaymentCordobas;
          procedureData.clinic_payment_dollars -= externalDoctorPaymentDollars;
        }
      } else {
        procedureData.clinic_payment_percentage = 100;
        procedureData.doctor_payment_percentage = 0;
        procedureData.clinic_payment_cordobas = totals.netTotalCordobas;
        procedureData.clinic_payment_dollars = total_procedure_USD;
        procedureData.doctor_payment_cordobas = 0;
        procedureData.doctor_payment_dollars = 0;
      }
      
      console.log('Datos completos del procedimiento:', procedureData);
      
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
    const isRecentlyCompleted = appointment === justCompletedAppointment;
    
    if (!isRecentlyCompleted) {
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
    setExternalDoctorPaymentCordobas(0);
    setExternalDoctorPaymentDollars(0);
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

      {/* Estadísticas */}
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
                      {formatDateShort(appointment.appointment_date)}
                    </div>
                    <div className="appointment-time compact">
                      {(() => {
                        const result = formatTime(appointment.appointment_date);
                        return result;
                      })()}
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
                            {formatDateTime(appointment.appointment_date)}
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
                <small className="form-help-text">Seleccione la fecha y hora</small>
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
                <label className="form-label">Fecha y hora:</label>
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
                <small className="form-help-text">Seleccione la fecha y hora</small>
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

      {/* Modal de Conversión Automática */}
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

      {/* Modal para convertir cita en procedimiento CON DEDUCCIONES POS Y MANEJO COMPLETO DE DÓLARES */}
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
                  setExternalDoctorPaymentCordobas(0);
                  setExternalDoctorPaymentDollars(0);
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
                
                {/* Sección de pagos mixtos CON DEDUCCIONES POS Y MANEJO DE DÓLARES */}
                <div className="mixed-payment-section">
                  <h5>Pagos Mixtos (Córdobas y Dólares)</h5>
                  <p className="section-note">
                    <small>Para pagos con POS (Tarjeta) se aplica deducción automática del 5.5% (4% comisión bancaria + 1.5% impuesto DGI)</small>
                  </p>
                  
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
                          <option value="Efectivo">Efectivo</option>
                          <option value="POS">POS (Tarjeta) -5.5%</option>
                          <option value="Transferencia">Transferencia</option>
                        </select>
                        {procedureForm.payment_method_cordobas === 'POS' && (
                          <small className="form-help-text warning-text">
                            ⚠️ Se aplicará deducción del 5.5% (4% comisión bancaria + 1.5% impuesto)
                          </small>
                        )}
                      </div>
                      
                      {/* Mostrar deducción si es POS */}
                      {procedureForm.payment_method_cordobas === 'POS' && procedureForm.amount_cordobas > 0 && (
                        <div className="deduction-info">
                          <small>
                            Bruto: {formatCurrency(parseFloat(procedureForm.amount_cordobas))}<br />
                            Deducción POS (5.5%): -{formatCurrency(calculatePOSDeduction(parseFloat(procedureForm.amount_cordobas)))}<br />
                            <strong>Neto: {formatCurrency(calculateNetAfterPOS(parseFloat(procedureForm.amount_cordobas)))}</strong>
                          </small>
                        </div>
                      )}
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
                          <option value="Efectivo">Efectivo</option>
                          <option value="POS">POS (Tarjeta) -5.5%</option>
                          <option value="Transferencia">Transferencia</option>
                        </select>
                        {procedureForm.payment_method_dollars === 'POS' && (
                          <small className="form-help-text warning-text">
                            ⚠️ Se aplicará deducción del 5.5% (4% comisión bancaria + 1.5% impuesto)
                          </small>
                        )}
                      </div>
                      
                      {/* Mostrar deducción si es POS */}
                      {procedureForm.payment_method_dollars === 'POS' && procedureForm.amount_dollars > 0 && (
                        <div className="deduction-info">
                          <small>
                            Bruto: {formatCurrencyUSD(parseFloat(procedureForm.amount_dollars))}<br />
                            Deducción POS (5.5%): -{formatCurrencyUSD(calculatePOSDeduction(parseFloat(procedureForm.amount_dollars)))}<br />
                            <strong>Neto: {formatCurrencyUSD(calculateNetAfterPOS(parseFloat(procedureForm.amount_dollars)))}</strong>
                          </small>
                        </div>
                      )}
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
                  
                  {/* Totales calculados CON DEDUCCIONES Y CONVERSIONES A DÓLARES */}
                  <div className="totals-section">
                    <div className="total-row">
                      <span className="total-label">Bruto en Córdobas (C$):</span>
                      <span className="total-value">
                        {formatCurrency(calculateTotalsWithDeductions().grossCordobas)}
                      </span>
                    </div>
                    
                    {procedureForm.payment_method_cordobas === 'POS' && procedureForm.amount_cordobas > 0 && (
                      <div className="total-row deduction-row">
                        <span className="total-label">Deducción POS Córdobas:</span>
                        <span className="total-value deduction">
                          -{formatCurrency(calculateTotalsWithDeductions().posDeductionCordobas)}
                        </span>
                      </div>
                    )}
                    
                    <div className="total-row">
                      <span className="total-label">Bruto en Dólares (US$):</span>
                      <span className="total-value">
                        {formatCurrencyUSD(calculateTotalsWithDeductions().grossDollars)}
                      </span>
                    </div>
                    
                    {procedureForm.payment_method_dollars === 'POS' && procedureForm.amount_dollars > 0 && (
                      <div className="total-row deduction-row">
                        <span className="total-label">Deducción POS Dólares:</span>
                        <span className="total-value deduction">
                          -{formatCurrencyUSD(calculateTotalsWithDeductions().posDeductionDollars)}
                        </span>
                      </div>
                    )}
                    
                    <div className="total-row total-gross">
                      <span className="total-label">Total Bruto (C$):</span>
                      <span className="total-value">
                        {formatCurrency(calculateTotalsWithDeductions().grossTotalCordobas)}
                      </span>
                    </div>
                    
                    <div className="total-row total-gross-usd">
                      <span className="total-label">Total Bruto (US$):</span>
                      <span className="total-value">
                        {formatCurrencyUSD(calculateTotalsWithDeductions().grossTotalDollars)}
                      </span>
                    </div>
                    
                    {(procedureForm.payment_method_cordobas === 'POS' || procedureForm.payment_method_dollars === 'POS') && (
                      <div className="total-row total-deduction">
                        <span className="total-label">Total Deducciones POS (C$):</span>
                        <span className="total-value deduction">
                          -{formatCurrency(calculateTotalsWithDeductions().totalDeductions)}
                        </span>
                      </div>
                    )}
                    
                    <div className="total-row total-procedure">
                      <span className="total-label">
                        <strong>Total Neto del Procedimiento (C$):</strong>
                      </span>
                      <span className="total-value">
                        <strong>{formatCurrency(calculateTotalProcedure())}</strong>
                      </span>
                    </div>
                    
                    {/* NUEVO: Mostrar total en dólares */}
                    <div className="total-row total-procedure-usd">
                      <span className="total-label">
                        <strong>Total Neto del Procedimiento (US$):</strong>
                      </span>
                      <span className="total-value">
                        <strong>{formatCurrencyUSD(calculateTotalProcedureUSD())}</strong>
                      </span>
                    </div>
                    
                    <div className="total-breakdown">
                      <small>
                        * C$ {procedureForm.amount_cordobas || '0.00'} ({procedureForm.payment_method_cordobas || 'Sin método'})<br />
                        * US$ {procedureForm.amount_dollars || '0.00'} ({procedureForm.payment_method_dollars || 'Sin método'})<br />
                        * Tipo de cambio: C$ {procedureForm.exchange_rate} por US$ 1<br />
                        {procedureForm.payment_method_cordobas === 'POS' || procedureForm.payment_method_dollars === 'POS' ? (
                          <>
                            * Deducción POS aplicada: 5.5% (4% comisión bancaria + 1.5% impuesto DGI)
                          </>
                        ) : null}
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
                      onChange={(e) => handleExternalDoctorPaymentChange('external_doctor', e.target.checked)}
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
                        onChange={(e) => handleExternalDoctorPaymentChange('external_doctor_name', e.target.value)}
                        className="form-input"
                        placeholder="Dr. Nombre Apellido"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Especialidad:</label>
                      <input
                        type="text"
                        value={procedureForm.external_doctor_specialty}
                        onChange={(e) => handleExternalDoctorPaymentChange('external_doctor_specialty', e.target.value)}
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
                          onClick={() => handleExternalDoctorPaymentChange('payment_type', 'percentage')}
                        >
                          Porcentaje del total
                        </button>
                        <button
                          type="button"
                          className={`payment-type-btn ${procedureForm.external_doctor_payment_type === 'fixed' ? 'active' : ''}`}
                          onClick={() => handleExternalDoctorPaymentChange('payment_type', 'fixed')}
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
                          ? `Equivalente: ${formatCurrency(externalDoctorPaymentCordobas)} (${formatCurrencyUSD(externalDoctorPaymentDollars)})`
                          : procedureForm.external_doctor_payment_currency === 'US$'
                            ? `Equivalente: ${formatCurrency(externalDoctorPaymentCordobas)}`
                            : `Equivalente: ${formatCurrencyUSD(externalDoctorPaymentDollars)}`}
                      </small>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Para ortodoncia, mostrar porcentajes de distribución CON AMBOS MONTOS */}
              {selectedAppointment.is_orthodontics && (
                <div className="form-section">
                  <h4>
                    <FontAwesomeIcon icon={faPercentage} />
                    Distribución de Ortodoncia
                  </h4>
                  <div className="ortho-distribution-info">
                    <div className="distribution-item clinic">
                      <span className="distribution-label">Clínica ({procedureForm.clinic_payment_percentage}%):</span>
                      <div className="distribution-amounts">
                        <span className="amount-cordobas">
                          {formatCurrency(calculateOrthoPayments().clinicPaymentCordobas)}
                        </span>
                        <span className="amount-dollars">
                          {formatCurrencyUSD(calculateOrthoPayments().clinicPaymentDollars)}
                        </span>
                      </div>
                    </div>
                    <div className="distribution-item doctor">
                      <span className="distribution-label">Doctora ({procedureForm.doctor_payment_percentage}%):</span>
                      <div className="distribution-amounts">
                        <span className="amount-cordobas">
                          {formatCurrency(calculateOrthoPayments().doctorPaymentCordobas)}
                        </span>
                        <span className="amount-dollars">
                          {formatCurrencyUSD(calculateOrthoPayments().doctorPaymentDollars)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {procedureForm.external_doctor && (
                    <div className="external-doctor-deduction">
                      <small>
                        * Después de pago a doctor externo, la clínica recibirá:<br />
                        &nbsp;&nbsp;C$ {formatCurrency(calculateOrthoPayments().clinicPaymentCordobas - externalDoctorPaymentCordobas)}<br />
                        &nbsp;&nbsp;US$ {formatCurrencyUSD(calculateOrthoPayments().clinicPaymentDollars - externalDoctorPaymentDollars)}
                      </small>
                    </div>
                  )}
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
                    setExternalDoctorPaymentCordobas(0);
                    setExternalDoctorPaymentDollars(0);
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