import React, { createContext, useState, useContext, useEffect } from 'react';
import { AuthContext } from './AuthContext';
import {
  nicaraguaToUTC,
  utcToNicaragua,
  formatNicaraguaDateTime,
  formatNicaraguaDate,
  createDateTimeInputFromUTC,
  parseDateTimeInputToUTC,
  getCurrentNicaraguaDateString,
  getCurrentNicaraguaDateTime,
  adjustDateForQuery
} from '../utils/dateUtils';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  
  // Estados globales
  const [patients, setPatients] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [orthodonticProcedures, setOrthodonticProcedures] = useState([]); // NUEVO: estado separado para ortodoncias
  const [appointments, setAppointments] = useState([]);
  const [bills, setBills] = useState([]);
  const [monthlyClosings, setMonthlyClosings] = useState([]);
  const [dailyClosings, setDailyClosings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [systemSettings, setSystemSettings] = useState({
    exchange_rate: 36.5,
    clinic_payment: 40,
    doctor_payment: 60
  });
  
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    monthlyIncome: 0,
    pendingProcedures: 0,
    totalProcedures: 0,
    totalExpenses: 0
  });

  const apiFetch = async (endpoint, options = {}) => {
  setLoading(true);
  setError(null);

  try {
    const API_URL = import.meta.env.VITE_API_URL || '';

    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(`🌐 Enviando request a: ${API_URL}/api${endpoint}`);
    
    const response = await fetch(`${API_URL}/api${endpoint}`, {
      headers,
      ...options,
    });

    // Verificar si la respuesta es JSON
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('❌ La respuesta no es JSON:', text);
      throw new Error(`Respuesta inesperada del servidor (${response.status})`);
    }

    console.log(`📥 Respuesta del backend (${response.status}):`, data);

    // Si el backend indica error, lanzar excepción
    if (!data.success) {
      throw new Error(data.error || `Error (${response.status})`);
    }

    return data;

  } catch (error) {
    console.error('❌ Error en apiFetch:', {
      endpoint,
      error: error.message,
      stack: error.stack
    });
    
    // No establecer error global aquí, dejarlo que cada función lo maneje
    throw error;
  } finally {
    setLoading(false);
  }
};


  // Obtener configuración del sistema
  const getSystemSettings = async () => {
    try {
      const data = await apiFetch('/settings/current');
      return data.data || {
        exchange_rate: 36.5,
        clinic_payment: 40,
        doctor_payment: 60
      };
    } catch (error) {
      console.error('Error obteniendo configuración:', error);
      return {
        exchange_rate: 36.5,
        clinic_payment: 40,
        doctor_payment: 60
      };
    }
  };

  // ========== PACIENTES ==========
  const fetchPatients = async (page = 1, search = '') => {
    try {
      const queryParams = new URLSearchParams({ page, search }).toString();
      const endpoint = queryParams ? `/patients?${queryParams}` : '/patients';
      const data = await apiFetch(endpoint);
      
      setPatients(data.data);
      setStats(prev => ({ ...prev, totalPatients: data.total }));
      
      return data;
    } catch (error) {
      console.error('Error cargando pacientes:', error);
      return { success: false, error: error.message };
    }
  };

  const getPatientById = async (id) => {
    try {
      const data = await apiFetch(`/patients/${id}`);
      return data;
    } catch (error) {
      console.error('Error obteniendo paciente:', error);
      return { success: false, error: error.message };
    }
  };

  // AppContext.jsx - Modificar la función createPatient
const createPatient = async (patientData) => {
  try {
    console.log('📝 Datos del paciente a crear:', patientData);
    
    // IMPORTANTE: Convertir birthdate string vacío a null
    const formattedPatientData = {
      ...patientData,
      birthdate: patientData.birthdate ? patientData.birthdate : null,
      // Asegurar que number_phone sea numérico o null
      number_phone: patientData.number_phone ? 
        Number(patientData.number_phone) : null
    };
    
    console.log('📤 Enviando al backend:', formattedPatientData);
    
    const data = await apiFetch('/patients', {
      method: 'POST',
      body: JSON.stringify(formattedPatientData),
    });
    
    console.log('✅ Paciente creado exitosamente:', data);
    
    // Solo agregar al estado si hay data.data
    if (data.data) {
      setPatients(prev => [...prev, data.data]);
      setStats(prev => ({ ...prev, totalPatients: prev.totalPatients + 1 }));
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error detallado creando paciente:', {
      error: error.message,
      patientData,
      timestamp: new Date().toISOString()
    });
    
    // Retornar un objeto con success: false para que el frontend pueda manejarlo
    return { 
      success: false, 
      error: error.message || 'Error al crear paciente',
      details: 'Verificar consola para más detalles'
    };
  }
};

  const updatePatient = async (id, patientData) => {
    try {
      const data = await apiFetch(`/patients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patientData),
      });
      
      setPatients(prev => 
        prev.map(patient => patient.Patient_ID === id ? data.data : patient)
      );
      
      return data;
    } catch (error) {
      console.error('Error actualizando paciente:', error);
      return { success: false, error: error.message };
    }
  };

  const deletePatient = async (id) => {
    try {
      const data = await apiFetch(`/patients/${id}`, {
        method: 'DELETE',
      });
      
      setPatients(prev => prev.filter(patient => patient.Patient_ID !== id));
      setStats(prev => ({ ...prev, totalPatients: prev.totalPatients - 1 }));
      
      return data;
    } catch (error) {
      console.error('Error eliminando paciente:', error);
      return { success: false, error: error.message };
    }
  };

  // ========== INFORMACIÓN MÉDICA DE PACIENTES ==========
  const getPatientMedicalInfo = async (patientId) => {
    try {
      const data = await apiFetch(`/patients/${patientId}/medical-info`);
      return data;
    } catch (error) {
      console.error('Error obteniendo información médica:', error);
      return { success: false, error: error.message };
    }
  };

  const createPatientMedicalInfo = async (patientId, medicalData) => {
    try {
      const data = await apiFetch(`/patients/${patientId}/medical-info`, {
        method: 'POST',
        body: JSON.stringify(medicalData),
      });
      return data;
    } catch (error) {
      console.error('Error creando información médica:', error);
      return { success: false, error: error.message };
    }
  };

  const updatePatientMedicalInfo = async (patientId, medicalData) => {
    try {
      const data = await apiFetch(`/patients/${patientId}/medical-info`, {
        method: 'PUT',
        body: JSON.stringify(medicalData),
      });
      return data;
    } catch (error) {
      console.error('Error actualizando información médica:', error);
      return { success: false, error: error.message };
    }
  };

  // ========== CITAS ==========
  const fetchAppointments = async (filters = {}) => {
    try {
      // Procesar filtros para fechas
      const processedFilters = { ...filters };
      
      if (processedFilters.startDate) {
        processedFilters.startDate = adjustDateForQuery(processedFilters.startDate);
      }
      
      if (processedFilters.endDate) {
        processedFilters.endDate = adjustDateForQuery(processedFilters.endDate);
      }
      
      const queryParams = new URLSearchParams(processedFilters).toString();
      const endpoint = queryParams ? `/appointments?${queryParams}` : '/appointments';
      const data = await apiFetch(endpoint);
      
      // Las fechas ya vienen formateadas desde el backend en hora Nicaragua
      setAppointments(data.data);
      
      // Calcular citas de hoy (en hora Nicaragua)
      const todayNicaragua = getCurrentNicaraguaDateString();
      
      const todayCount = data.data.filter(apt => {
        // El backend devuelve appointment_date ya en hora Nicaragua
        const aptDate = apt.appointment_date?.split(' ')[0]; // Extraer solo la fecha
        return aptDate === todayNicaragua;
      }).length;
      
      setStats(prev => ({ ...prev, todayAppointments: todayCount }));
      
      return data;
    } catch (error) {
      console.error('Error cargando citas:', error);
      return { success: false, error: error.message };
    }
  };

  const getAppointmentsByDate = async (date) => {
    try {
      // Convertir fecha a formato YYYY-MM-DD para el backend
      const dateString = adjustDateForQuery(date);
      const data = await apiFetch(`/appointments/date/${dateString}`);
      return data;
    } catch (error) {
      console.error('Error obteniendo citas por fecha:', error);
      return { success: false, error: error.message };
    }
  };

  const createAppointment = async (appointmentData) => {
    try {
      console.log('📝 Datos de la cita original:', appointmentData);
      
      // IMPORTANTE: NO convertir aquí, el backend maneja la conversión
      // Solo enviar la fecha como está (en hora Nicaragua desde el input)
      const appointmentToSend = {
        ...appointmentData,
        // appointment_date ya está en hora Nicaragua del input datetime-local
      };
      
      console.log('📤 Enviando al backend (hora Nicaragua):', appointmentToSend.appointment_date);
      
      const data = await apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify(appointmentToSend),
      });
      
      console.log('✅ Cita creada exitosamente:', data);
      
      // El backend ya devuelve la fecha formateada en hora Nicaragua
      setAppointments(prev => [...prev, data.data]);
      
      return data;
    } catch (error) {
      console.error('❌ Error detallado creando cita:', {
        error: error.message,
        appointmentData,
        timestamp: new Date().toISOString()
      });
      setError('Error al crear cita: ' + error.message);
      return { success: false, error: error.message };
    }
  };

  const updateAppointment = async (id, appointmentData) => {
    try {
      // IMPORTANTE: NO convertir aquí, el backend maneja la conversión
      console.log('📝 Actualizando cita:', { id, appointmentData });
      
      const data = await apiFetch(`/appointments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(appointmentData),
      });
      
      // El backend ya devuelve la fecha formateada en hora Nicaragua
      setAppointments(prev => 
        prev.map(appointment => appointment.appointment_ID === id ? data.data : appointment)
      );
      
      return data;
    } catch (error) {
      console.error('Error actualizando cita:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteAppointment = async (id) => {
    try {
      const data = await apiFetch(`/appointments/${id}`, {
        method: 'DELETE',
      });
      
      setAppointments(prev => 
        prev.filter(appointment => appointment.appointment_ID !== id)
      );
      
      return data;
    } catch (error) {
      console.error('Error eliminando cita:', error);
      return { success: false, error: error.message };
    }
  };

  // ========== PROCEDIMIENTOS ==========
  // Procedimientos normales con filtros unificados
  const fetchProceduresNormal = async (filters = {}) => {
    try {
      console.log('🔍 Cargando procedimientos normales con filtros:', filters);
      
      // Construir parámetros de consulta
      const queryParams = new URLSearchParams();
      
      // Agregar filtro de tiempo si existe
      if (filters.timeFilter) {
        queryParams.append('timeFilter', filters.timeFilter);
      }
      
      // Agregar fechas específicas si existen
      if (filters.startDate) {
        queryParams.append('startDate', filters.startDate);
      }
      
      if (filters.endDate) {
        queryParams.append('endDate', filters.endDate);
      }
      
      if (filters.patientId) {
        queryParams.append('patientId', filters.patientId);
      }
      
      // Agregar paginación por defecto
      queryParams.append('page', '1');
      queryParams.append('limit', '50');
      
      const endpoint = `/procedures/normal?${queryParams.toString()}`;
      console.log('📤 Endpoint:', endpoint);
      
      const data = await apiFetch(endpoint);
      
      console.log(`✅ ${data.data?.length || 0} procedimientos cargados`);
      
      setProcedures(data.data || []); // ✅ Guarda en procedimientos normales
      setStats(prev => ({ 
        ...prev, 
        totalProcedures: data.total || 0,
        pendingProcedures: (data.data || []).filter(proc => !proc.state || proc.state !== 'COMPLETED').length
      }));
      
      return data;
    } catch (error) {
      console.error('❌ Error cargando procedimientos normales:', error);
      return { success: false, error: error.message };
    }
  };

  // Ortodoncias con filtros unificados - MODIFICADO
  const fetchOrthodontics = async (filters = {}) => {
    try {
      console.log('🔍 Cargando ortodoncias con filtros:', filters);
      
      // Construir parámetros de consulta
      const queryParams = new URLSearchParams();
      
      // Agregar filtro de tiempo si existe
      if (filters.timeFilter) {
        queryParams.append('timeFilter', filters.timeFilter);
      }
      
      // Agregar fechas específicas si existen
      if (filters.startDate) {
        queryParams.append('startDate', filters.startDate);
      }
      
      if (filters.endDate) {
        queryParams.append('endDate', filters.endDate);
      }
      
      if (filters.patientId) {
        queryParams.append('patientId', filters.patientId);
      }
      
      // Agregar paginación por defecto
      queryParams.append('page', '1');
      queryParams.append('limit', '50');
      
      const endpoint = `/procedures/orthodontics?${queryParams.toString()}`;
      console.log('📤 Endpoint (ortodoncia):', endpoint);
      
      const data = await apiFetch(endpoint);
      
      console.log(`✅ ${data.data?.length || 0} ortodoncias cargadas`);
      
      // ✅ MODIFICADO: Guardar en estado separado para ortodoncias
      setOrthodonticProcedures(data.data || []);
      
      return data;
    } catch (error) {
      console.error('❌ Error cargando ortodoncias:', error);
      return { success: false, error: error.message };
    }
  };

  // Función genérica (mantener para compatibilidad)
  const fetchProcedures = async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const endpoint = queryParams ? `/procedures/normal?${queryParams}` : '/procedures/normal';
      const data = await apiFetch(endpoint);
      
      setProcedures(data.data);
      setStats(prev => ({ 
        ...prev, 
        totalProcedures: data.total,
        pendingProcedures: data.data.filter(proc => !proc.state || proc.state !== 'COMPLETED').length
      }));
      
      return data;
    } catch (error) {
      console.error('Error cargando procedimientos:', error);
      return { success: false, error: error.message };
    }
  };

  const getProceduresByPatient = async (patientId) => {
    try {
      const data = await apiFetch(`/procedures/patient/${patientId}`);
      return data;
    } catch (error) {
      console.error('Error obteniendo procedimientos:', error);
      return { success: false, error: error.message };
    }
  };

  const getIncomeStats = async (startDate, endDate) => {
    try {
      const queryParams = new URLSearchParams({ 
        startDate: adjustDateForQuery(startDate), 
        endDate: adjustDateForQuery(endDate) 
      }).toString();
      
      const data = await apiFetch(`/procedures/stats/income?${queryParams}`);
      
      setStats(prev => ({ 
        ...prev, 
        monthlyIncome: data.data.clinic_income 
      }));
      
      return data;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return { success: false, error: error.message };
    }
  };

  const convertAppointmentToProcedure = async (appointmentId, procedureData) => {
    try {
      const data = await apiFetch(`/appointments/${appointmentId}/convert-to-procedure`, {
        method: 'POST',
        body: JSON.stringify(procedureData),
      });
      
      return data;
    } catch (error) {
      console.error('Error al convertir cita en procedimiento:', error);
      throw error;
    }
  };

  // ========== GASTOS ==========
  const fetchBills = async (filters = {}) => {
    try {
      // Procesar filtros para fechas
      const processedFilters = { ...filters };
      
      if (processedFilters.startDate) {
        processedFilters.startDate = adjustDateForQuery(processedFilters.startDate);
      }
      
      if (processedFilters.endDate) {
        processedFilters.endDate = adjustDateForQuery(processedFilters.endDate);
      }
      
      const queryParams = new URLSearchParams(processedFilters).toString();
      const endpoint = queryParams ? `/bills?${queryParams}` : '/bills';
      const data = await apiFetch(endpoint);
      
      setBills(data.data || []);
      
      // Calcular total de gastos
      const totalExpenses = (data.data || []).reduce((sum, bill) => sum + (bill.amount || 0), 0);
      setStats(prev => ({ ...prev, totalExpenses }));
      
      return data;
    } catch (error) {
      console.error('Error cargando gastos:', error);
      return { success: false, error: error.message };
    }
  };

  const getBillById = async (id) => {
    try {
      const data = await apiFetch(`/bills/${id}`);
      return data;
    } catch (error) {
      console.error('Error obteniendo gasto:', error);
      return { success: false, error: error.message };
    }
  };

  const createBill = async (billData) => {
    try {
      console.log('📝 Datos del gasto a crear:', billData);
      
      // Obtener tipo de cambio actual
      const settings = await getSystemSettings();
      const defaultExchangeRate = settings.exchange_rate || 36.5;
      
      // Para bill_date (que es DATE, no TIMESTAMP), solo necesitamos YYYY-MM-DD
      const billWithFormattedDate = {
        ...billData,
        bill_date: adjustDateForQuery(billData.bill_date)
      };
      
      // Usar los nombres de columna correctos y tipo de cambio dinámico
      const payload = {
        description: billData.description,
        amount: billData.amount || 0,
        amount_usd: billData.amount_USD || 0,
        bill_date: adjustDateForQuery(billData.bill_date),
        category: billData.category,
        currency_used: billData.currency_used || 'NIO',
        exchange_rate_bill: billData.exchange_rate_bill || defaultExchangeRate,
        is_recurrent: billData.is_recurrent || false
      };
      
      console.log('📤 Enviando al backend:', payload);
      
      const data = await apiFetch('/bills', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      console.log('✅ Gasto creado exitosamente:', data);
      
      setBills(prev => [...prev, data.data]);
      
      // Actualizar estadísticas
      setStats(prev => ({ 
        ...prev, 
        totalExpenses: prev.totalExpenses + (data.data.amount || 0) 
      }));
      
      return data;
    } catch (error) {
      console.error('❌ Error detallado creando gasto:', {
        error: error.message,
        billData,
        timestamp: new Date().toISOString()
      });
      setError('Error al crear gasto: ' + error.message);
      return { success: false, error: error.message };
    }
  };

  const updateBill = async (id, billData) => {
    try {
      // Formatear fecha si se actualiza
      const updateData = { ...billData };
      if (updateData.bill_date) {
        updateData.bill_date = adjustDateForQuery(updateData.bill_date);
      }
      
      // Convertir amount_USD a amount_usd (minúsculas para la BD)
      if (updateData.amount_USD !== undefined) {
        updateData.amount_usd = updateData.amount_USD;
        delete updateData.amount_USD;
      }
      
      const data = await apiFetch(`/bills/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      
      // Actualizar el estado local
      setBills(prev => 
        prev.map(bill => bill.bill_ID === id ? data.data : bill)
      );
      
      // Recalcular estadísticas
      const updatedBills = bills.map(bill => 
        bill.bill_ID === id ? data.data : bill
      );
      const totalExpenses = updatedBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
      setStats(prev => ({ ...prev, totalExpenses }));
      
      return data;
    } catch (error) {
      console.error('Error actualizando gasto:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteBill = async (id) => {
    try {
      const data = await apiFetch(`/bills/${id}`, {
        method: 'DELETE',
      });
      
      // Encontrar el gasto a eliminar para actualizar estadísticas
      const billToDelete = bills.find(bill => bill.bill_ID === id);
      
      // Actualizar el estado local
      setBills(prev => prev.filter(bill => bill.bill_ID !== id));
      
      // Actualizar estadísticas
      if (billToDelete) {
        setStats(prev => ({ 
          ...prev, 
          totalExpenses: prev.totalExpenses - (billToDelete.amount || 0) 
        }));
      }
      
      return data;
    } catch (error) {
      console.error('Error eliminando gasto:', error);
      return { success: false, error: error.message };
    }
  };

  const getRecurrentBills = async () => {
    try {
      const data = await apiFetch('/bills/recurrent/all');
      return data;
    } catch (error) {
      console.error('Error obteniendo gastos recurrentes:', error);
      return { success: false, error: error.message };
    }
  };

  const getExpenseStats = async (startDate, endDate) => {
    try {
      const queryParams = new URLSearchParams({ 
        startDate: adjustDateForQuery(startDate), 
        endDate: adjustDateForQuery(endDate) 
      }).toString();
      
      const data = await apiFetch(`/bills/stats/expenses?${queryParams}`);
      return data;
    } catch (error) {
      console.error('Error obteniendo estadísticas de gastos:', error);
      return { success: false, error: error.message };
    }
  };

  // ========== CIERRES MENSUALES ==========
  const fetchMonthlyClosings = async () => {
    try {
      const data = await apiFetch('/monthly-closings');
      
      setMonthlyClosings(data.data || []);
      
      // Obtener último cierre
      if (data.data && data.data.length > 0) {
        const lastClosing = data.data[0];
        setStats(prev => ({ 
          ...prev, 
          monthlyIncome: lastClosing.total_general_income || 0 
        }));
      }
      
      return data;
    } catch (error) {
      console.error('Error cargando cierres:', error);
      return { success: false, error: error.message };
    }
  };

  const getMonthlyClosingById = async (id) => {
    try {
      const data = await apiFetch(`/monthly-closings/${id}`);
      return data;
    } catch (error) {
      console.error('Error obteniendo cierre:', error);
      return { success: false, error: error.message };
    }
  };

  const createMonthlyClosing = async (closingData) => {
    try {
      console.log('📝 Datos del cierre a crear:', closingData);
      
      const data = await apiFetch('/monthly-closings', {
        method: 'POST',
        body: JSON.stringify(closingData),
      });
      
      console.log('✅ Cierre creado exitosamente:', data);
      
      const formattedClosing = {
        ...data.data,
        closing_ID: data.data.closing_ID || data.data.id,
        id: data.data.closing_ID || data.data.id,
        total_clinic_income: (data.data.total_general_income || 0) + (data.data.total_clinical_orthodontic_income || 0),
        total_expenses_including_doctor: (data.data.total_fixed_expenses || 0) + (data.data.total_variable_expenses || 0)
      };
      
      setMonthlyClosings(prev => [formattedClosing, ...prev]);
      
      return data;
    } catch (error) {
      console.error('❌ Error detallado creando cierre:', {
        error: error.message,
        closingData,
        timestamp: new Date().toISOString()
      });
      setError('Error al crear cierre: ' + error.message);
      return { success: false, error: error.message };
    }
  };

  const getFinancialSummary = async (startDate, endDate) => {
    try {
      const queryParams = new URLSearchParams({ 
        startDate: adjustDateForQuery(startDate), 
        endDate: adjustDateForQuery(endDate) 
      }).toString();
      
      const data = await apiFetch(`/monthly-closings/summary/financial?${queryParams}`);
      return data;
    } catch (error) {
      console.error('Error obteniendo resumen financiero:', error);
      return { success: false, error: error.message };
    }
  };

  // ========== CIERRES DIARIOS ==========
  const fetchDailyClosings = async (filters = {}) => {
    try {
      // Procesar filtros para fechas
      const processedFilters = { ...filters };
      
      if (processedFilters.startDate) {
        processedFilters.startDate = adjustDateForQuery(processedFilters.startDate);
      }
      
      if (processedFilters.endDate) {
        processedFilters.endDate = adjustDateForQuery(processedFilters.endDate);
      }
      
      const queryParams = new URLSearchParams(processedFilters).toString();
      const endpoint = queryParams ? `/daily-closings?${queryParams}` : '/daily-closings';
      const data = await apiFetch(endpoint);
      
      setDailyClosings(data.data || []);
      return data;
    } catch (error) {
      console.error('Error cargando cierres diarios:', error);
      return { success: false, error: error.message };
    }
  };

  const getDailyClosingById = async (id) => {
    try {
      const data = await apiFetch(`/daily-closings/${id}`);
      return data;
    } catch (error) {
      console.error('Error obteniendo cierre diario:', error);
      return { success: false, error: error.message };
    }
  };

  const createDailyClosing = async (closingData) => {
    try {
      console.log('📝 createDailyClosing - Datos originales:', closingData);
      
      // Validar que la fecha no esté vacía
      if (!closingData.date) {
        throw new Error('La fecha es requerida');
      }
      
      // Formatear la fecha correctamente
      const formattedDate = adjustDateForQuery(closingData.date);
      console.log('📅 Fecha formateada:', formattedDate);
      
      // Crear objeto con el nombre de campo CORRECTO para el backend
      const payload = {
        closing_date: formattedDate,
        closing_type: closingData.closing_type,
        comentary: closingData.comentary || ''
      };
      
      console.log('📤 Payload para backend:', payload);
      
      const data = await apiFetch('/daily-closings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      console.log('✅ Respuesta del backend:', data);
      
      if (!data.success) {
        // Mostrar error específico si existe
        const errorMsg = data.error || data.message || 'Error desconocido del backend';
        throw new Error(errorMsg);
      }
      
      // Formatear fechas para mostrar
      const closingWithFormattedDates = {
        ...data.data,
        closing_date_display: formatNicaraguaDate(data.data.closing_date),
        created_at_display: formatNicaraguaDateTime(data.data.created_at)
      };
      
      setDailyClosings(prev => [closingWithFormattedDates, ...prev]);
      
      return data;
    } catch (error) {
      console.error('❌ Error completo en createDailyClosing:', {
        error: error.message,
        stack: error.stack,
        closingData,
        timestamp: new Date().toISOString()
      });
      setError('Error al crear cierre diario: ' + error.message);
      return { success: false, error: error.message };
    }
  };

  const getDailySummary = async (date, closingType = 'general') => {
    try {
      const queryParams = new URLSearchParams({ 
        date: adjustDateForQuery(date), 
        closing_type: closingType 
      }).toString();
      
      const data = await apiFetch(`/daily-closings/summary/daily?${queryParams}`);
      return data;
    } catch (error) {
      console.error('Error obteniendo resumen diario:', error);
      return { success: false, error: error.message };
    }
  };

  const checkDailyClosingExists = async (date, closingType = 'general') => {
    try {
      const queryParams = new URLSearchParams({ 
        date: adjustDateForQuery(date), 
        closing_type: closingType 
      }).toString();
      
      const data = await apiFetch(`/daily-closings/check/exists?${queryParams}`);
      return data;
    } catch (error) {
      console.error('Error verificando cierre:', error);
      return { success: false, error: error.message };
    }
  };

  const getDailyStatsByRange = async (startDate, endDate, closingType = 'general') => {
    try {
      const queryParams = new URLSearchParams({ 
        startDate: adjustDateForQuery(startDate), 
        endDate: adjustDateForQuery(endDate), 
        closing_type: closingType 
      }).toString();
      
      const data = await apiFetch(`/daily-closings/stats/range?${queryParams}`);
      return data;
    } catch (error) {
      console.error('Error obteniendo estadísticas diarias:', error);
      return { success: false, error: error.message };
    }
  };

  // ========== FUNCIONES DE UTILIDAD PARA FECHAS ==========
  
  const prepareDateForForm = (dateString, includeTime = true) => {
    if (!dateString) {
      if (includeTime) {
        return createDateTimeInputFromUTC(getCurrentNicaraguaDateTime().toISOString());
      } else {
        return getCurrentNicaraguaDateString();
      }
    }
    
    if (includeTime) {
      return createDateTimeInputFromUTC(dateString);
    } else {
      return adjustDateForQuery(dateString);
    }
  };

  const formatDateForDisplay = (dateString, includeTime = true) => {
    if (!dateString) return '';
    return includeTime ? 
      formatNicaraguaDateTime(dateString) : 
      formatNicaraguaDate(dateString);
  };

  const getCurrentDate = (includeTime = false) => {
    if (includeTime) {
      return formatNicaraguaDateTime(new Date().toISOString());
    } else {
      return getCurrentNicaraguaDateString();
    }
  };

  // ========== CARGA INICIAL ==========
  useEffect(() => {
    if (user) {
      // Cargar datos iniciales
      const loadInitialData = async () => {
        // Cargar configuración primero
        const settings = await getSystemSettings();
        setSystemSettings(settings);
        
        await Promise.all([
          fetchPatients(),
          fetchAppointments(),
          fetchProceduresNormal(),
          fetchBills(), 
          fetchMonthlyClosings(),
          fetchDailyClosings(),
          // Obtener estadísticas del mes actual
          getIncomeStats(
            new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
            new Date().toISOString().split('T')[0]
          )
        ]);
      };
      
      loadInitialData();
    }
  }, [user]);

  const value = {
    // Estados
    patients,
    procedures,
    orthodonticProcedures, // ✅ AÑADIDO: estado separado para ortodoncias
    appointments,
    bills,
    monthlyClosings,
    dailyClosings,
    loading,
    error,
    stats,
    systemSettings,
    
    // Pacientes
    fetchPatients,
    getPatientById,
    createPatient,
    updatePatient,
    deletePatient,
    
    // Información médica de pacientes
    getPatientMedicalInfo,
    createPatientMedicalInfo,
    updatePatientMedicalInfo,
    
    // Citas
    fetchAppointments,
    getAppointmentsByDate,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    
    // Procedimientos
    fetchProceduresNormal,
    fetchOrthodontics,
    fetchProcedures,
    getProceduresByPatient,
    getIncomeStats,
    convertAppointmentToProcedure,
    
    // Gastos
    fetchBills,
    getBillById,
    createBill,
    updateBill,
    deleteBill,
    getRecurrentBills,
    getExpenseStats,
    
    // Cierres Mensuales
    fetchMonthlyClosings,
    getMonthlyClosingById,
    createMonthlyClosing,
    getFinancialSummary,
    
    // Cierres Diarios
    fetchDailyClosings,
    getDailyClosingById,
    createDailyClosing,
    getDailySummary,
    checkDailyClosingExists,
    getDailyStatsByRange,
    
    // Funciones de utilidad para fechas
    prepareDateForForm,
    formatDateForDisplay,
    getCurrentDate,
    
    // Utilerías
    clearError: () => setError(null),
    apiFetch,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};