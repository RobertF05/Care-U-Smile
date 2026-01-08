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
      const response = await fetch(`/api${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error en la solicitud');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
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
      const data = await apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify(appointmentData),
      });
      
      setAppointments(prev => [...prev, data.data]);
      
      return data;
    } catch (error) {
      console.error('Error creando cita:', error);
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

  // ========== PROCEDIMIENTOS ==========
  const fetchProcedures = async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const endpoint = queryParams ? `/procedures?${queryParams}` : '/procedures';
      const data = await apiFetch(endpoint);
      
      setProcedures(data.data);
      setStats(prev => ({ 
        ...prev, 
        totalProcedures: data.total,
        // Calcular procedimientos pendientes (sin estado completado)
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

  // ========== GASTOS ==========
  const fetchBills = async (filters = {}) => {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const endpoint = queryParams ? `/bills?${queryParams}` : '/bills';
      const data = await apiFetch(endpoint);
      
      setBills(data.data);
      
      // Calcular total de gastos
      const totalExpenses = data.data.reduce((sum, bill) => sum + (bill.amount || 0), 0);
      setStats(prev => ({ ...prev, totalExpenses }));
      
      return data;
    } catch (error) {
      console.error('Error cargando gastos:', error);
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

  // ========== CIERRES MENSUALES ==========
  const fetchMonthlyClosings = async () => {
    try {
      const data = await apiFetch('/monthly-closings');
      
      setMonthlyClosings(data.data);
      
      // Obtener último cierre
      if (data.data.length > 0) {
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

  // ========== CARGA INICIAL ==========
  useEffect(() => {
    if (user) {
      // Cargar datos iniciales
      const loadInitialData = async () => {
        await Promise.all([
          fetchPatients(),
          fetchAppointments(),
          fetchProcedures(),
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
    
    // Citas
    fetchAppointments,
    getAppointmentsByDate,
    createAppointment,
    updateAppointment,
    
    // Procedimientos
    fetchProcedures,
    getProceduresByPatient,
    getIncomeStats,
    
    // Gastos
    fetchBills,
    getRecurrentBills,
    
    // Cierres
    fetchMonthlyClosings,
    
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