// frontend/src/context/AppContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { AuthContext } from './AuthContext';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  
  // Estados globales
  const [patients, setPatients] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [bills, setBills] = useState([]);
  const [monthlyClosings, setMonthlyClosings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    monthlyIncome: 0,
    pendingProcedures: 0,
    totalProcedures: 0,
    totalExpenses: 0
  });

  // Función genérica para fetch
  const apiFetch = async (endpoint, options = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`📤 Enviando solicitud a: /api${endpoint}`, options);
      
      // Obtener token si existe
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };
      
      // Añadir token si existe
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api${endpoint}`, {
        headers,
        ...options,
      });

      console.log(`📥 Respuesta recibida:`, response.status, response.statusText);
      
      const data = await response.json();
      console.log('📄 Datos de respuesta:', data);
      
      if (!data.success) {
        throw new Error(data.error || `Error en la solicitud (${response.status})`);
      }
      
      return data;
    } catch (error) {
      console.error('❌ API Error completo:', {
        endpoint,
        error: error.message,
        stack: error.stack
      });
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
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

  const createPatient = async (patientData) => {
    try {
      const data = await apiFetch('/patients', {
        method: 'POST',
        body: JSON.stringify(patientData),
      });
      
      setPatients(prev => [...prev, data.data]);
      setStats(prev => ({ ...prev, totalPatients: prev.totalPatients + 1 }));
      
      return data;
    } catch (error) {
      console.error('Error creando paciente:', error);
      return { success: false, error: error.message };
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
      const queryParams = new URLSearchParams(filters).toString();
      const endpoint = queryParams ? `/appointments?${queryParams}` : '/appointments';
      const data = await apiFetch(endpoint);
      
      setAppointments(data.data);
      
      // Calcular citas de hoy
      const today = new Date().toISOString().split('T')[0];
      const todayCount = data.data.filter(apt => 
        apt.appointment_date?.includes(today)
      ).length;
      
      setStats(prev => ({ ...prev, todayAppointments: todayCount }));
      
      return data;
    } catch (error) {
      console.error('Error cargando citas:', error);
      return { success: false, error: error.message };
    }
  };

  const getAppointmentsByDate = async (date) => {
    try {
      const data = await apiFetch(`/appointments/date/${date}`);
      return data;
    } catch (error) {
      console.error('Error obteniendo citas por fecha:', error);
      return { success: false, error: error.message };
    }
  };

  const createAppointment = async (appointmentData) => {
    try {
      console.log('📝 Datos de la cita a crear:', appointmentData);
      
      const data = await apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify(appointmentData),
      });
      
      console.log('✅ Cita creada exitosamente:', data);
      
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
      const data = await apiFetch(`/appointments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(appointmentData),
      });
      
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
  // Función para procedimientos regulares (is_orthodontics = false)
  const fetchProceduresNormal = async (filters = {}) => {
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
      console.error('Error cargando procedimientos normales:', error);
      return { success: false, error: error.message };
    }
  };

  // Función para ortodoncias (is_orthodontics = true)
  const fetchOrthodontics = async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const endpoint = queryParams ? `/procedures/orthodontics?${queryParams}` : '/procedures/orthodontics';
      const data = await apiFetch(endpoint);
      
      setProcedures(data.data);
      setStats(prev => ({ 
        ...prev, 
        totalOrthodontics: data.total,
        orthodonticsIncome: data.data.reduce((sum, ortho) => sum + (ortho.total_cost || 0), 0)
      }));
      
      return data;
    } catch (error) {
      console.error('Error cargando ortodoncias:', error);
      return { success: false, error: error.message };
    }
  };

  // Función general para todos los procedimientos (deprecada)
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
      const queryParams = new URLSearchParams({ startDate, endDate }).toString();
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

  // Función para convertir cita en procedimiento
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
    const queryParams = new URLSearchParams(filters).toString();
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
    
    const data = await apiFetch('/bills', {
      method: 'POST',
      body: JSON.stringify(billData),
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
    const data = await apiFetch(`/bills/${id}`, {
      method: 'PUT',
      body: JSON.stringify(billData),
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
    const queryParams = new URLSearchParams({ startDate, endDate }).toString();
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
      const lastClosing = data.data[0]; // Ordenados descendente
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
    
    // Asegurar que los datos sean consistentes
    const formattedClosing = {
      ...data.data,
      closing_ID: data.data.closing_ID || data.data.id,
      id: data.data.closing_ID || data.data.id,
      // Asegurar cálculos correctos
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
    const queryParams = new URLSearchParams({ startDate, endDate }).toString();
    const data = await apiFetch(`/monthly-closings/summary/financial?${queryParams}`);
    return data;
  } catch (error) {
    console.error('Error obteniendo resumen financiero:', error);
    return { success: false, error: error.message };
  }
};

  // ========== CARGA INICIAL ==========
useEffect(() => {
  if (user) {
    // Cargar datos iniciales
    const loadInitialData = async () => {
      await Promise.all([
        fetchPatients(),
        fetchAppointments(),
        fetchProceduresNormal(),
        fetchBills(), 
        fetchMonthlyClosings(),
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
    appointments,
    bills,
    monthlyClosings,
    loading,
    error,
    stats,
    
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
    fetchProceduresNormal, // Añadido
    fetchOrthodontics, // Añadido
    fetchProcedures, // Mantenido por compatibilidad
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
    
    // Cierres
    fetchMonthlyClosings,
    getMonthlyClosingById,
    createMonthlyClosing,
    getFinancialSummary,
    
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