import React, { useState, useEffect, useMemo, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarAlt,
  faCalendarDay,
  faFilter,
  faTimes,
  faSearch,
  faPlus,
  faFileInvoice,
  faChartLine,
  faMoneyBillWave,
  faCalculator,
  faEye,
  faPrint,
  faDownload,
  faChevronDown,
  faChevronUp,
  faCheckCircle,
  faTimesCircle,
  faInfoCircle,
  faUserMd,
  faTooth,
  faHospital,
  faCalendarCheck,
  faFileExcel,
  faFilePdf,
  faListAlt,
  faDollarSign,
  faMoneyBill,
  faSyncAlt,
  faExclamationTriangle,
  faUserDoctor,
  faHandHoldingMedical,
  faMoneyBillTransfer,
  faUserFriends,
  faPercentage,
  faExchangeAlt,
  faReceipt,
  faUsers,
  faStethoscope,
  faTrashAlt, // NUEVO: Icono para eliminar
  faExclamationCircle // NUEVO: Icono para advertencias
} from '@fortawesome/free-solid-svg-icons';
import { AppContext } from '../../context/AppContext';
import { AuthContext } from '../../context/AuthContext';
import './MonthlyClosingsPage.css';

// Meses en español
const MONTHS = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const MonthlyClosingsPage = () => {
  const { user } = useContext(AuthContext);
  const { 
    monthlyClosings, 
    dailyClosings,
    loading, 
    fetchMonthlyClosings,
    fetchDailyClosings,
    createMonthlyClosing,
    createDailyClosing,
    getDailySummary,
    checkDailyClosingExists,
    apiFetch,
    systemSettings
  } = useContext(AppContext);

  // Estados
  const [showFilters, setShowFilters] = useState(true);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [closingTypeFilter, setClosingTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateDailyModal, setShowCreateDailyModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [expandedClosings, setExpandedClosings] = useState({});
  const [selectedClosing, setSelectedClosing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [creatingDaily, setCreatingDaily] = useState(false);
  const [dailySummary, setDailySummary] = useState(null);
  const [deleteVariableExpenses, setDeleteVariableExpenses] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(36.5);
  const [clinicPercentage, setClinicPercentage] = useState(40);
  const [doctorPercentage, setDoctorPercentage] = useState(60);
  const [externalDoctorDetails, setExternalDoctorDetails] = useState(null);
  const [showExternalDoctorsModal, setShowExternalDoctorsModal] = useState(false);
  
  // NUEVO: Estados para eliminar cierre
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [closingToDelete, setClosingToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // NUEVO: Estado para gastos variables en cierres diarios
  const [showVariableExpensesModal, setShowVariableExpensesModal] = useState(false);
  const [variableExpensesDetails, setVariableExpensesDetails] = useState(null);
  
  // Formulario para crear cierre mensual
  const [newClosing, setNewClosing] = useState({
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    startDate: '',
    endDate: '',
    closing_type: 'all',
    comentary: ''
  });

  // Formulario para crear cierre diario
  const [newDailyClosing, setNewDailyClosing] = useState({
    date: new Date().toISOString().split('T')[0],
    closing_type: 'general',
    comentary: ''
  });

  // Generar años para filtro
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => (currentYear - i).toString());
  }, []);

  useEffect(() => {
    if (user) {
      fetchMonthlyClosings();
      fetchDailyClosings();
    }
  }, [user]);

  // Obtener configuración del sistema
  useEffect(() => {
    if (systemSettings) {
      setExchangeRate(systemSettings.exchange_rate || 36.5);
      setClinicPercentage(systemSettings.clinic_payment || 40);
      setDoctorPercentage(systemSettings.doctor_payment || 60);
    }
  }, [systemSettings]);

  // Función auxiliar para número de mes
  function getMonthNumber(month) {
    const monthIndex = MONTHS.indexOf(month.toUpperCase());
    return (monthIndex + 1).toString().padStart(2, '0');
  }

  // Función auxiliar para último día del mes
  function getLastDayOfMonth(year, month) {
    const monthNumber = getMonthNumber(month);
    const lastDay = new Date(parseInt(year), parseInt(monthNumber), 0).getDate();
    return `${year}-${monthNumber}-${lastDay}`;
  }

  // Formateadores de moneda
  const formatCurrency = (amount, currency = 'NIO', showBoth = false) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      amount = 0;
    }
    
    if (showBoth) {
      const cordobas = new Intl.NumberFormat('es-NI', {
        style: 'currency',
        currency: 'NIO',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount || 0);
      
      const dollars = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format((amount || 0) / exchangeRate);
      
      return (
        <div className="dual-currency-display">
          <span className="main-currency">{cordobas}</span>
          <span className="secondary-currency">({dollars})</span>
        </div>
      );
    }
    
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount || 0);
    }
    
    return new Intl.NumberFormat('es-NI', {
      style: 'currency',
      currency: 'NIO',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatCurrencySimple = (amount, currency = 'NIO') => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      amount = 0;
    }
    
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount || 0);
    }
    
    return new Intl.NumberFormat('es-NI', {
      style: 'currency',
      currency: 'NIO'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-NI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Funciones para expandir/contraer
  const toggleExpandClosing = (closingId) => {
    setExpandedClosings(prev => ({
      ...prev,
      [closingId]: !prev[closingId]
    }));
  };

  // NUEVO: Función para obtener detalles de gastos variables de un cierre diario
  const fetchVariableExpensesDetails = async (closing) => {
    try {
      if (closing.type !== 'daily') {
        alert('Esta opción solo está disponible para cierres diarios');
        return;
      }
      
      const queryParams = new URLSearchParams({
        startDate: closing.closing_date,
        endDate: closing.closing_date
      }).toString();
      
      const response = await apiFetch(`/monthly-closings/variable-expenses?${queryParams}`);
      
      if (response.success) {
        setVariableExpensesDetails({
          ...response.data,
          closingInfo: closing
        });
        setShowVariableExpensesModal(true);
      } else {
        throw new Error(response.error || 'Error al obtener detalles de gastos');
      }
    } catch (error) {
      console.error('Error obteniendo detalles de gastos variables:', error);
      alert(`❌ Error: ${error.message}`);
    }
  };

  // Función para obtener detalles de doctores externos
  const fetchExternalDoctorDetails = async (closing) => {
    try {
      let startDate, endDate;
      
      if (closing.type === 'monthly') {
        const monthNumber = getMonthNumber(closing.month);
        startDate = `${closing.year}-${monthNumber}-01`;
        endDate = getLastDayOfMonth(closing.year, closing.month);
      } else {
        startDate = closing.closing_date;
        endDate = closing.closing_date;
      }
      
      const queryParams = new URLSearchParams({
        startDate,
        endDate,
        closing_type: closing.sub_type
      }).toString();
      
      const response = await apiFetch(`/monthly-closings/external-doctors?${queryParams}`);
      
      if (response.success) {
        setExternalDoctorDetails({
          ...response.data,
          closingInfo: closing
        });
        setShowExternalDoctorsModal(true);
      } else {
        throw new Error(response.error || 'Error al obtener detalles');
      }
    } catch (error) {
      console.error('Error obteniendo detalles de doctores externos:', error);
      alert(`❌ Error: ${error.message}`);
    }
  };

  // 🔴 CORREGIDO: handleDeleteClosing en MonthlyClosingsPage.jsx
const handleDeleteClosing = async () => {
  if (!closingToDelete) return;
  
  setDeleting(true);
  
  try {
    const confirmMessage = closingToDelete.type === 'monthly' 
      ? `¿Está seguro de eliminar el cierre mensual de ${closingToDelete.month} ${closingToDelete.year}?\n\nEsta acción no se puede deshacer.`
      : `¿Está seguro de eliminar el cierre diario del ${closingToDelete.date_exact}?\n\nEsta acción no se puede deshacer.`;
    
    if (!window.confirm(confirmMessage)) {
      setDeleting(false);
      setShowDeleteModal(false);
      setClosingToDelete(null);
      return;
    }
    
    let endpoint;
    if (closingToDelete.type === 'monthly') {
      // 🔴 CORREGIDO: Asegurar el ID correcto
      const closingId = closingToDelete.closing_id || closingToDelete.closing_ID || closingToDelete.id;
      endpoint = `/monthly-closings/${closingId}`;
      console.log('🗑️ Eliminando cierre mensual:', { id: closingId, endpoint });
    } else {
      const closingId = closingToDelete.daily_closing_id || closingToDelete.id;
      endpoint = `/daily-closings/${closingId}`;
      console.log('🗑️ Eliminando cierre diario:', { id: closingId, endpoint });
    }
    
    const response = await apiFetch(endpoint, {
      method: 'DELETE'
    });
    
    if (response.success) {
      alert('✅ Cierre eliminado exitosamente');
      
      // Recargar cierres según el tipo
      if (closingToDelete.type === 'monthly') {
        fetchMonthlyClosings();
      } else {
        fetchDailyClosings();
      }
    } else {
      throw new Error(response.error || 'Error al eliminar cierre');
    }
    
  } catch (error) {
    console.error('Error eliminando cierre:', error);
    alert(`❌ Error al eliminar cierre: ${error.message}`);
  } finally {
    setDeleting(false);
    setShowDeleteModal(false);
    setClosingToDelete(null);
  }
};

  // Combinar y filtrar todos los cierres (MODIFICADO para incluir gastos variables)
  const allClosings = useMemo(() => {
    const monthly = monthlyClosings.map(closing => {
      const clinicIncome = (closing.total_general_income || 0) + (closing.total_clinical_orthodontic_income || 0);
      const totalExpenses = (closing.total_fixed_expenses || 0) + (closing.total_variable_expenses || 0);
      const netProfit = clinicIncome - totalExpenses;
      const externalDoctorPayments = closing.total_external_doctor_payments || 0;
      
      return {
        ...closing,
        id: closing.closing_ID || closing.id,
        closing_id: closing.closing_ID,
        type: 'monthly',
        sub_type: closing.closing_type || 'all',
        display_date: `Cierre de ${closing.month} ${closing.year}`,
        date_exact: closing.closing_date_display || formatDate(closing.closing_date),
        date_sort: `${closing.year}-${getMonthNumber(closing.month).padStart(2, '0')}-01`,
        total_clinic_income: clinicIncome,
        total_expenses: totalExpenses,
        total_clinic_income_usd: clinicIncome / exchangeRate,
        total_expenses_usd: totalExpenses / exchangeRate,
        net_profit: netProfit,
        net_profit_usd: netProfit / exchangeRate,
        total_external_doctor_payments: externalDoctorPayments,
        total_external_doctor_payments_usd: externalDoctorPayments / exchangeRate,
        total_general_income: closing.total_general_income || 0,
        total_clinical_orthodontic_income: closing.total_clinical_orthodontic_income || 0,
        total_orthodontic_doctor_income: closing.total_orthodontic_doctor_income || 0,
        total_fixed_expenses: closing.total_fixed_expenses || 0,
        total_variable_expenses: closing.total_variable_expenses || 0,
        has_expenses: (closing.total_variable_expenses || 0) > 0
      };
    });

    const daily = dailyClosings.map(closing => ({
      ...closing,
      id: closing.daily_closing_id || closing.id,
      closing_id: closing.daily_closing_id,
      type: 'daily',
      sub_type: closing.closing_type || 'general',
      display_date: `Cierre Diario - ${closing.closing_date_formatted || formatDate(closing.closing_date)}`,
      date_exact: closing.closing_date_formatted || formatDate(closing.closing_date),
      date_sort: closing.closing_date,
      total_clinic_income: closing.total_clinic_income || 0,
      total_clinic_income_usd: (closing.total_clinic_income || 0) / exchangeRate,
      // IMPORTANTE: Ahora los gastos variables se guardan en total_variable_expenses
      total_variable_expenses: closing.total_variable_expenses || 0,
      total_variable_expenses_usd: (closing.total_variable_expenses || 0) / exchangeRate,
      total_expenses: closing.total_variable_expenses || 0,
      total_expenses_usd: (closing.total_variable_expenses || 0) / exchangeRate,
      net_profit: closing.net_profit || closing.total_clinic_income || 0,
      net_profit_usd: (closing.net_profit || closing.total_clinic_income || 0) / exchangeRate,
      total_income: closing.total_income || 0,
      total_income_usd: (closing.total_income || 0) / exchangeRate,
      total_doctor_income: closing.total_doctor_income || 0,
      total_doctor_income_usd: (closing.total_doctor_income || 0) / exchangeRate,
      total_external_doctor_payments: closing.total_external_doctor_payments || 0,
      total_external_doctor_payments_usd: (closing.total_external_doctor_payments || 0) / exchangeRate,
      has_expenses: (closing.total_variable_expenses || 0) > 0 // Indicador de gastos
    }));

    return [...monthly, ...daily];
  }, [monthlyClosings, dailyClosings, exchangeRate]);

  // Filtrar cierres combinados
  const filteredClosings = useMemo(() => {
    let filtered = [...allClosings];

    if (closingTypeFilter !== 'all') {
      if (closingTypeFilter === 'monthly' || closingTypeFilter === 'daily') {
        filtered = filtered.filter(closing => closing.type === closingTypeFilter);
      } else {
        filtered = filtered.filter(closing => closing.sub_type === closingTypeFilter);
      }
    }

    if (yearFilter !== 'all') {
      filtered = filtered.filter(closing => {
        if (closing.type === 'monthly') {
          return closing.year.toString() === yearFilter;
        }
        if (closing.type === 'daily') {
          const closingYear = new Date(closing.closing_date).getFullYear().toString();
          return closingYear === yearFilter;
        }
        return true;
      });
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(closing => 
        closing.display_date.toLowerCase().includes(term) ||
        (closing.month && closing.month.toLowerCase().includes(term)) ||
        (closing.year && closing.year.toString().includes(term)) ||
        (closing.closing_date && closing.closing_date.toLowerCase().includes(term)) ||
        (closing.comentary && closing.comentary.toLowerCase().includes(term)) ||
        (closing.closing_type && closing.closing_type.toLowerCase().includes(term)) ||
        (closing.sub_type && closing.sub_type.toLowerCase().includes(term))
      );
    }

    return filtered.sort((a, b) => {
      if (b.date_sort < a.date_sort) return -1;
      if (b.date_sort > a.date_sort) return 1;
      return 0;
    });
  }, [allClosings, closingTypeFilter, yearFilter, searchTerm]);

  // Función para verificar existencia de cierre mensual
  const checkMonthlyClosingExists = async (month, year, closingType) => {
    try {
      const queryParams = new URLSearchParams({ 
        month, 
        year, 
        closing_type: closingType 
      }).toString();
      
      const response = await apiFetch(`/monthly-closings/check/exists?${queryParams}`);
      
      if (response.success) {
        return response.data.exists;
      }
      return false;
    } catch (error) {
      console.error('Error verificando cierre:', error);
      return false;
    }
  };

  // Crear cierre mensual (MODIFICADO para mejor manejo de gastos)
  const handleCreateClosing = async (e) => {
    e.preventDefault();
    setCreating(true);
    
    try {
      const exists = await checkMonthlyClosingExists(newClosing.month, newClosing.year, newClosing.closing_type);
      
      if (exists) {
        alert(`⚠️ Ya existe un cierre ${getClosingTypeLabel(newClosing.closing_type)} para ${newClosing.month} ${newClosing.year}`);
        setCreating(false);
        return;
      }

      const startDate = newClosing.startDate || `${newClosing.year}-${getMonthNumber(newClosing.month)}-01`;
      const endDate = newClosing.endDate || getLastDayOfMonth(newClosing.year, newClosing.month);
      
      console.log('📅 Período a calcular:', { startDate, endDate, type: newClosing.closing_type });
      
      const closingData = {
        month: newClosing.month,
        year: parseInt(newClosing.year),
        startDate,
        endDate,
        closing_type: newClosing.closing_type,
        comentary: newClosing.comentary || '',
        deleteVariableExpenses: false
      };
      
      const response = await createMonthlyClosing(closingData);
      
      if (response.success) {
        let message = `✅ Cierre ${getClosingTypeLabel(newClosing.closing_type)} de ${newClosing.month} ${newClosing.year} creado exitosamente\n\n`;
        
        if (newClosing.closing_type === 'all') {
          const clinicIncome = (response.data.total_general_income || 0) + (response.data.total_clinical_orthodontic_income || 0);
          const totalExpenses = (response.data.total_fixed_expenses || 0) + (response.data.total_variable_expenses || 0);
          const netProfit = clinicIncome - totalExpenses;
          
          message += `📊 INGRESOS GENERALES (Clínica):\n`;
          message += `   Ganancia neta clínica: ${formatCurrencySimple(response.data.total_general_income || 0)}\n\n`;
          
          message += `🦷 ORTODONCIA:\n`;
          message += `   Total ganancias: ${formatCurrencySimple((response.data.total_clinical_orthodontic_income || 0) + (response.data.total_orthodontic_doctor_income || 0))}\n`;
          message += `   Clínica (${clinicPercentage}%): ${formatCurrencySimple(response.data.total_clinical_orthodontic_income || 0)}\n`;
          message += `   Doctora (${doctorPercentage}%): ${formatCurrencySimple(response.data.total_orthodontic_doctor_income || 0)}\n\n`;
          
          message += `💰 GASTOS INCLUIDOS:\n`;
          message += `   Gastos Fijos: ${formatCurrencySimple(response.data.total_fixed_expenses || 0)}\n`;
          message += `   Gastos Variables: ${formatCurrencySimple(response.data.total_variable_expenses || 0)}\n`;
          message += `   Total Gastos: ${formatCurrencySimple(totalExpenses)}\n\n`;
          
          message += `🧮 CÁLCULO DE UTILIDAD:\n`;
          message += `   Total ganancias clínica: ${formatCurrencySimple(clinicIncome)}\n`;
          message += `   - Total gastos: ${formatCurrencySimple(totalExpenses)}\n`;
          message += `   = Utilidad Neta Clínica: ${formatCurrencySimple(netProfit)}\n`;
          message += `   📈 Margen: ${netProfit > 0 ? ((netProfit / clinicIncome) * 100).toFixed(2) : '0.00'}%\n`;
        } else if (newClosing.closing_type === 'general') {
          message += `📊 INGRESOS GENERALES:\n`;
          message += `   Ganancia neta clínica: ${formatCurrencySimple(response.data.total_general_income || 0)}\n`;
        } else if (newClosing.closing_type === 'orthodontics') {
          message += `🦷 ORTODONCIA:\n`;
          message += `   Total ganancias: ${formatCurrencySimple((response.data.total_clinical_orthodontic_income || 0) + (response.data.total_orthodontic_doctor_income || 0))}\n`;
          message += `   Clínica (${clinicPercentage}%): ${formatCurrencySimple(response.data.total_clinical_orthodontic_income || 0)}\n`;
          message += `   Doctora (${doctorPercentage}%): ${formatCurrencySimple(response.data.total_orthodontic_doctor_income || 0)}\n`;
        }
        
        if (response.data.total_external_doctor_payments) {
          message += `\n👨‍⚕️ PAGOS DOCTORES EXTERNOS:\n`;
          message += `   Total pagado: ${formatCurrencySimple(response.data.total_external_doctor_payments)}\n`;
          message += `   (Ya deducido de las ganancias mostradas arriba)`;
        }
        
        // NUEVO: Información sobre gastos variables que ya estaban en cierres diarios
        if (response.data.expense_info) {
          message += `\n\n📋 INFORMACIÓN DE GASTOS:\n`;
          message += `   • Gastos variables totales: ${response.data.expense_info.variable_expenses_count}\n`;
          message += `   • Ya incluidos en cierres diarios: ${response.data.expense_info.variable_expenses_in_daily}\n`;
          if (response.data.expense_info.variable_expenses_count > response.data.expense_info.variable_expenses_in_daily) {
            const nuevos = response.data.expense_info.variable_expenses_count - response.data.expense_info.variable_expenses_in_daily;
            message += `   • Nuevos gastos (solo en mensual): ${nuevos}\n`;
          }
        }
        
        alert(message);
        
        setShowCreateModal(false);
        setNewClosing({
          month: MONTHS[new Date().getMonth()],
          year: new Date().getFullYear().toString(),
          startDate: '',
          endDate: '',
          closing_type: 'all',
          comentary: ''
        });
        
        fetchMonthlyClosings();
      } else {
        throw new Error(response.error || 'Error al crear cierre');
      }
      
    } catch (error) {
      console.error('❌ Error detallado al crear cierre:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  // Obtener resumen diario previo (MODIFICADO para incluir gastos variables)
  const handleGetDailySummary = async () => {
    try {
      setCreatingDaily(true);
      const summaryResponse = await getDailySummary(newDailyClosing.date, newDailyClosing.closing_type);
      
      if (summaryResponse.success) {
        setDailySummary(summaryResponse.data);
        
        // Mostrar advertencia si hay gastos variables pero no procedimientos
        if (summaryResponse.data.cantidad_gastos_variables > 0 && summaryResponse.data.cantidad_procedimientos === 0) {
          alert(`⚠️ Se encontraron ${summaryResponse.data.cantidad_gastos_variables} gastos variables por ${formatCurrencySimple(summaryResponse.data.total_variable_expenses)} pero no hay procedimientos. El cierre registrará solo los gastos.`);
        }
        
        if (summaryResponse.data.closing_exists) {
          alert(`⚠️ Ya existe un cierre ${newDailyClosing.closing_type === 'orthodontics' ? 'de ortodoncia' : 'general'} para esta fecha`);
        }
      } else {
        throw new Error('Error al obtener el resumen diario');
      }
    } catch (error) {
      console.error('Error al obtener resumen:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setCreatingDaily(false);
    }
  };

  // Crear cierre diario (MODIFICADO para incluir gastos variables)
  const handleCreateDailyClosing = async (e) => {
    e.preventDefault();
    setCreatingDaily(true);
    
    try {
      const existsResponse = await checkDailyClosingExists(newDailyClosing.date, newDailyClosing.closing_type);
      
      if (existsResponse.data.exists) {
        alert(`⚠️ Ya existe un cierre ${newDailyClosing.closing_type === 'orthodontics' ? 'de ortodoncia' : 'general'} para esta fecha`);
        setCreatingDaily(false);
        return;
      }

      const summaryResponse = await getDailySummary(newDailyClosing.date, newDailyClosing.closing_type);
      
      if (!summaryResponse.success) {
        throw new Error('Error al obtener el resumen diario');
      }
      
      const summary = summaryResponse.data;

      console.log('📊 Resumen para cierre:', {
  procedimientos: summary.cantidad_procedimientos,
  gastos_variables: summary.cantidad_gastos_variables,
  total_gastos: summary.total_variable_expenses
});
      
      // Advertencia mejorada considerando gastos variables
      if (summary.cantidad_procedimientos === 0 && summary.cantidad_gastos_variables === 0) {
        const confirmCreate = window.confirm(
          `⚠️ No se encontraron procedimientos ni gastos variables para la fecha ${formatDate(newDailyClosing.date)}.\n\n` +
          `¿Desea crear un cierre en cero igualmente?`
        );
        
        if (!confirmCreate) {
          setCreatingDaily(false);
          return;
        }
      } else if (summary.cantidad_procedimientos === 0 && summary.cantidad_gastos_variables > 0) {
        const confirmCreate = window.confirm(
          `⚠️ No hay procedimientos, pero hay ${summary.cantidad_gastos_variables} gastos variables por ${formatCurrencySimple(summary.total_variable_expenses)}.\n\n` +
          `Se creará un cierre con SOLO gastos variables. ¿Continuar?`
        );
        
        if (!confirmCreate) {
          setCreatingDaily(false);
          return;
        }
      }
      
      const closingData = {
        date: newDailyClosing.date,
        closing_type: newDailyClosing.closing_type,
        comentary: newDailyClosing.comentary
      };

      const response = await createDailyClosing(closingData);
      
      if (response.success) {
        const typeLabel = newDailyClosing.closing_type === 'orthodontics' ? 'de Ortodoncia' : 'General';
        let message = `✅ Cierre Diario ${typeLabel} creado exitosamente\n\n`;
        message += `📅 Fecha: ${formatDate(newDailyClosing.date)}\n`;
        message += `📋 Procedimientos: ${response.data.procedure_count || 0}\n`;
        message += `💰 Gastos variables: ${response.data.variable_expenses_count || 0} (${formatCurrencySimple(response.data.variable_expenses_total || 0)})\n`;
        message += `💱 Tipo de cambio: C$${exchangeRate.toFixed(2)} = $1\n\n`;
        
        if (response.data.procedure_count > 0 || response.data.variable_expenses_count > 0) {
          if (newDailyClosing.closing_type === 'orthodontics') {
            message += `🦷 ORTODONCIA:\n`;
            message += `   Total ganancias: ${formatCurrency(response.data.total_income, 'NIO', true)}\n`;
            message += `   Clínica (${clinicPercentage}%): ${formatCurrency(response.data.total_clinic_income, 'NIO', true)}\n`;
            message += `   Doctora (${doctorPercentage}%): ${formatCurrency(response.data.total_doctor_income, 'NIO', true)}\n`;
          } else {
            message += `📊 PROCEDIMIENTOS GENERALES:\n`;
            message += `   Ganancia neta clínica: ${formatCurrency(response.data.total_clinic_income, 'NIO', true)}\n`;
          }
          
          if (response.data.variable_expenses_total > 0) {
            message += `\n💰 GASTOS VARIABLES DEL DÍA:\n`;
            message += `   Total: ${formatCurrency(response.data.variable_expenses_total, 'NIO', true)}\n`;
          }
          
          message += `\n🧮 UTILIDAD NETA CLÍNICA: ${formatCurrency(response.data.net_profit, 'NIO', true)}`;
          
          if (response.data.total_external_doctor_payments > 0) {
            message += `\n\n👨‍⚕️ PAGOS DOCTORES EXTERNOS:\n`;
            message += `   Total pagado: ${formatCurrency(response.data.total_external_doctor_payments, 'NIO', true)} (ya deducido)`;
          }
        }
        
        alert(message);
        
        setShowCreateDailyModal(false);
        setNewDailyClosing({
          date: new Date().toISOString().split('T')[0],
          closing_type: 'general',
          comentary: ''
        });
        setDailySummary(null);
        
        fetchDailyClosings();
      } else {
        throw new Error(response.error || 'Error al crear cierre diario');
      }
      
    } catch (error) {
      console.error('Error al crear cierre diario:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setCreatingDaily(false);
    }
  };

  // Ver detalles del cierre
  const handleViewDetails = (closing) => {
    setSelectedClosing(closing);
    setShowDetailModal(true);
  };

  // NUEVO: Función para preparar eliminación
  const handleDeleteClick = (closing, e) => {
    e.stopPropagation();
    setClosingToDelete(closing);
    setShowDeleteModal(true);
  };

  // Obtener color según utilidad
  const getProfitColor = (profit) => {
    if (profit > 0) return '#4CAF50';
    if (profit < 0) return '#F44336';
    return '#FF9800';
  };

  // Obtener icono según utilidad
  const getProfitIcon = (profit) => {
    if (profit > 0) return faCheckCircle;
    if (profit < 0) return faTimesCircle;
    return faInfoCircle;
  };

  // Obtener icono según tipo de cierre
  const getClosingTypeIcon = (type, subType) => {
    if (type === 'monthly') {
      if (subType === 'orthodontics') return faTooth;
      if (subType === 'general') return faHospital;
      return faCalendarAlt;
    }
    if (subType === 'orthodontics') return faTooth;
    return faCalendarDay;
  };

  // Obtener color según tipo de cierre
  const getClosingTypeColor = (type, subType) => {
    if (type === 'monthly') {
      if (subType === 'orthodontics') return '#9C27B0';
      if (subType === 'general') return '#2196F3';
      return '#3F51B5';
    }
    if (subType === 'orthodontics') return '#E91E63';
    return '#4CAF50';
  };

  // Obtener texto del tipo de cierre
  const getClosingTypeText = (type, subType) => {
    if (type === 'monthly') {
      if (subType === 'orthodontics') return 'Mensual Ortodoncia';
      if (subType === 'general') return 'Mensual General';
      return 'Mensual Completo';
    }
    if (subType === 'orthodontics') return 'Diario Ortodoncia';
    return 'Diario General';
  };

  // Obtener etiqueta para formulario
  const getClosingTypeLabel = (type) => {
    const labels = {
      'general': 'de Procedimientos Generales',
      'orthodontics': 'de Ortodoncia',
      'all': 'Completo (General + Ortodoncia)'
    };
    return labels[type] || '';
  };

  // Exportar a PDF
  const handleExportPDF = async (closing) => {
    try {
      let endpoint;
      if (closing.type === 'monthly') {
        endpoint = `/export/pdf/monthly/${closing.closing_id}`;
      } else {
        endpoint = `/export/pdf/daily/${closing.closing_id}`;
      }
      
      window.open(`/api${endpoint}`, '_blank');
      
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      alert('Error al exportar a PDF');
    }
  };

  // Exportar a Excel DETALLADO
  const handleExportExcelDetailed = async (closing) => {
    try {
      let endpoint;
      if (closing.type === 'monthly') {
        endpoint = `/export/excel/detailed/monthly/${closing.closing_id}?type=${closing.sub_type}`;
      } else {
        endpoint = `/export/excel/detailed/daily/${closing.closing_id}?type=${closing.sub_type}`;
      }
      
      window.open(`/api${endpoint}`, '_blank');
      
    } catch (error) {
      console.error('Error al exportar Excel detallado:', error);
      alert('Error al exportar a Excel detallado');
    }
  };

  // Exportar a Excel GENERAL
  const handleExportExcelGeneral = async (type, filters = {}) => {
    try {
      const queryParams = new URLSearchParams({
        type: type,
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.closing_type && { closing_type: filters.closing_type })
      }).toString();
      
      const endpoint = `/export/excel${queryParams ? `?${queryParams}` : ''}`;
      
      window.open(`/api${endpoint}`, '_blank');
      
    } catch (error) {
      console.error('Error al exportar Excel general:', error);
      alert('Error al exportar a Excel general');
    }
  };

  if (loading && allClosings.length === 0) {
    return (
      <div className="closings-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando cierres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="closings-container">
      {/* Header */}
      <div className="closings-header">
        <div className="header-left">
          <h2>
            <FontAwesomeIcon icon={faCalculator} className="header-icon" />
            Cierres Financieros
          </h2>
        </div>
        <div className="header-right">
          <div className="btn-group">
            <button 
              className="secondary-btn"
              onClick={() => setShowCreateDailyModal(true)}
              disabled={creatingDaily}
            >
              <FontAwesomeIcon icon={faCalendarDay} />
              {creatingDaily ? 'Calculando...' : 'Cierre Diario'}
            </button>
            <button 
              className="primary-btn"
              onClick={() => setShowCreateModal(true)}
              disabled={creating}
            >
              <FontAwesomeIcon icon={faCalendarAlt} />
              {creating ? 'Calculando...' : 'Cierre Mensual'}
            </button>
          </div>
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
              Filtrar cierres
            </h3>
            <button 
              className="close-filter-btn"
              onClick={() => setShowFilters(false)}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          
          <div className="filter-controls">
            <div className="filter-row">
              <div className="filter-group">
                <label className="form-label">Tipo de cierre:</label>
                <select
                  value={closingTypeFilter}
                  onChange={(e) => setClosingTypeFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="all">Todos los cierres</option>
                  <optgroup label="Por frecuencia">
                    <option value="monthly">Cierres Mensuales</option>
                    <option value="daily">Cierres Diarios</option>
                  </optgroup>
                  <optgroup label="Por tipo específico">
                    <option value="all">Completos (General + Ortodoncia)</option>
                    <option value="general">Solo Procedimientos Generales</option>
                    <option value="orthodontics">Solo Ortodoncia</option>
                  </optgroup>
                </select>
              </div>

              <div className="filter-group">
                <label className="form-label">Año:</label>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="all">Todos los años</option>
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filter-row">
              <div className="filter-group full-width">
                <label className="form-label">
                  <FontAwesomeIcon icon={faSearch} /> Buscar:
                </label>
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Buscar por fecha, mes, año, tipo o comentario..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="form-input"
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
        </div>
      )}

      {/* Lista de cierres */}
      {filteredClosings.length === 0 ? (
        <div className="no-closings">
          <div className="no-closings-icon">
            <FontAwesomeIcon icon={faFileInvoice} />
          </div>
          <h3>No hay cierres registrados</h3>
          <p>
            {searchTerm || yearFilter !== 'all' || closingTypeFilter !== 'all'
              ? 'No se encontraron cierres con los filtros seleccionados'
              : 'Cree su primer cierre para ver el resumen financiero'}
          </p>
          <div className="action-buttons">
            <button 
              className="secondary-btn"
              onClick={() => setShowCreateDailyModal(true)}
            >
              <FontAwesomeIcon icon={faCalendarDay} />
              Crear cierre diario
            </button>
            <button 
              className="primary-btn"
              onClick={() => setShowCreateModal(true)}
            >
              <FontAwesomeIcon icon={faCalendarAlt} />
              Crear cierre mensual
            </button>
          </div>
        </div>
      ) : (
        <div className="closings-list">
          {filteredClosings.map(closing => (
            <div 
              key={closing.id} 
              className="closing-card"
              style={{ borderLeftColor: getClosingTypeColor(closing.type, closing.sub_type) }}
            >
              <div className="closing-main-info">
                <div className="closing-left">
                  <div className="closing-header-info">
                    <div className="closing-type-badge" style={{ 
                      backgroundColor: `${getClosingTypeColor(closing.type, closing.sub_type)}20`,
                      color: getClosingTypeColor(closing.type, closing.sub_type)
                    }}>
                      <FontAwesomeIcon icon={getClosingTypeIcon(closing.type, closing.sub_type)} />
                      <span>{getClosingTypeText(closing.type, closing.sub_type)}</span>
                    </div>
                    <h4>{closing.display_date}</h4>
                  </div>
                  
                  <div className="closing-period-info">
                    <div className="closing-date-container">
                      {closing.type === 'monthly' ? (
                        <div className="closing-date">
                          <FontAwesomeIcon icon={faCalendarAlt} />
                          <span>Período: {closing.month} {closing.year}</span>
                          <span className="date-badge" style={{ 
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            color: '#2196F3'
                          }}>
                            Fecha cierre: {formatDate(closing.closing_date)}
                          </span>
                        </div>
                      ) : (
                        <div className="closing-date">
                          <FontAwesomeIcon icon={faCalendarDay} />
                          <span>Fecha exacta: {closing.date_exact}</span>
                          {closing.sub_type === 'orthodontics' && (
                            <span className="ortho-tag">
                              <FontAwesomeIcon icon={faTooth} />
                              Ortodoncia
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {closing.comentary && (
                      <div className="closing-comment">
                        <FontAwesomeIcon icon={faInfoCircle} />
                        <span>{closing.comentary}</span>
                      </div>
                    )}
                    
                    {/* NUEVO: Mostrar indicador de gastos variables para cierres diarios */}
                    {closing.type === 'daily' && closing.has_expenses && (
                      <div className="expense-indicator" title="Este cierre incluye gastos variables">
                        <FontAwesomeIcon icon={faReceipt} />
                        <span>Gastos: {formatCurrency(closing.total_variable_expenses, 'NIO', false)}</span>
                      </div>
                    )}
                    
                    <div className="closing-quick-stats">
                      {closing.type === 'monthly' && closing.sub_type === 'all' && (
                        <>
                          <span className="quick-stat">
                            <FontAwesomeIcon icon={faHospital} />
                            <span>Clínica: {formatCurrency(closing.total_clinic_income, 'NIO', false)}</span>
                          </span>
                          <span className="quick-stat">
                            <FontAwesomeIcon icon={faUserMd} />
                            <span>Doctora: {formatCurrency(closing.total_orthodontic_doctor_income || 0, 'NIO', false)}</span>
                          </span>
                          <span className="quick-stat negative">
                            <FontAwesomeIcon icon={faReceipt} />
                            <span>Gastos: {formatCurrency(closing.total_expenses, 'NIO', false)}</span>
                          </span>
                        </>
                      )}
                      {closing.type === 'daily' && (
                        <>
                          <span className="quick-stat">
                            <FontAwesomeIcon icon={faHospital} />
                            <span>Clínica: {formatCurrency(closing.total_clinic_income, 'NIO', false)}</span>
                          </span>
                          {closing.has_expenses && (
                            <span className="quick-stat expense">
                              <FontAwesomeIcon icon={faReceipt} />
                              <span>Gastos: {formatCurrency(closing.total_variable_expenses, 'NIO', false)}</span>
                            </span>
                          )}
                        </>
                      )}
                      {closing.total_external_doctor_payments > 0 && (
                        <span className="quick-stat external" title="Ver detalles de doctores externos">
                          <FontAwesomeIcon icon={faUserDoctor} />
                          <span>Doctores externos: {formatCurrency(closing.total_external_doctor_payments, 'NIO', false)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="closing-right">
                  <div className="closing-profit">
                    <div 
                      className="profit-value"
                      style={{ color: getProfitColor(closing.net_profit) }}
                    >
                      {formatCurrency(closing.net_profit, 'NIO', true)}
                    </div>
                    <span className="profit-label">Utilidad Neta Clínica</span>
                    <div 
                      className={`profit-indicator ${closing.net_profit >= 0 ? 'positive' : 'negative'}`}
                    >
                      <FontAwesomeIcon icon={getProfitIcon(closing.net_profit)} />
                      <span>{closing.net_profit >= 0 ? 'Ganancia' : 'Pérdida'}</span>
                    </div>
                  </div>
                  
                  <div className="closing-actions">
                    <button 
                      className="action-btn view"
                      onClick={() => handleViewDetails(closing)}
                      title="Ver detalles completos"
                    >
                      <FontAwesomeIcon icon={faEye} />
                    </button>
                    <button 
                      className="action-btn print"
                      onClick={() => handleExportPDF(closing)}
                      title="Exportar a PDF"
                    >
                      <FontAwesomeIcon icon={faFilePdf} />
                    </button>
                    <button 
                      className="action-btn download"
                      onClick={() => handleExportExcelDetailed(closing)}
                      title="Exportar a Excel con desglose completo"
                    >
                      <FontAwesomeIcon icon={faListAlt} />
                      <span className="btn-tooltip">Excel Detallado</span>
                    </button>
                    
                    {/* NUEVO: Botón para ver gastos variables en cierres diarios */}
                    {closing.type === 'daily' && closing.has_expenses && (
                      <button 
                        className="action-btn expenses"
                        onClick={() => fetchVariableExpensesDetails(closing)}
                        title="Ver detalles de gastos variables"
                      >
                        <FontAwesomeIcon icon={faReceipt} />
                      </button>
                    )}
                    
                    {/* Botón para ver detalles de doctores externos */}
                    {closing.total_external_doctor_payments > 0 && (
                      <button 
                        className="action-btn external"
                        onClick={() => fetchExternalDoctorDetails(closing)}
                        title="Ver detalles de doctores externos"
                      >
                        <FontAwesomeIcon icon={faStethoscope} />
                      </button>
                    )}
                    
                    {/* NUEVO: Botón para eliminar cierre */}
                    <button 
                      className="action-btn delete"
                      onClick={(e) => handleDeleteClick(closing, e)}
                      title="Eliminar cierre (solo si hubo error)"
                    >
                      <FontAwesomeIcon icon={faTrashAlt} />
                    </button>
                    
                    <FontAwesomeIcon 
                      icon={expandedClosings[closing.id] ? faChevronUp : faChevronDown} 
                      className="expand-icon"
                      onClick={() => toggleExpandClosing(closing.id)}
                    />
                  </div>
                </div>
              </div>

              {/* Detalles expandidos (MODIFICADO para mostrar gastos variables en diarios) */}
              {expandedClosings[closing.id] && (
                <div className="closing-details">
                  <div className="financial-summary">
                    <h5>
                      <FontAwesomeIcon icon={faCalculator} />
                      Resumen Financiero - Ganancias Netas
                    </h5>
                    <div className="summary-note">
                      <FontAwesomeIcon icon={faInfoCircle} />
                      <small>Todos los montos muestran ganancias netas después de deducciones (POS, doctores externos, etc.)</small>
                    </div>
                    
                    {closing.type === 'monthly' ? (
                      <div className="summary-grid">
                        {closing.sub_type === 'all' && (
                          <>
                            <div className="summary-item income-general">
                              <div className="summary-header">
                                <FontAwesomeIcon icon={faHospital} />
                                <span className="summary-label">Procedimientos Generales:</span>
                              </div>
                              <span className="summary-value">{formatCurrency(closing.total_general_income, 'NIO', true)}</span>
                              <div className="summary-description">
                                <small>Ganancia neta 100% para la clínica</small>
                              </div>
                            </div>
                            
                            <div className="summary-section ortho-section">
                              <div className="section-title">
                                <FontAwesomeIcon icon={faTooth} />
                                <span>Ortodoncia</span>
                              </div>
                              
                              <div className="summary-item income-ortho-total">
                                <div className="summary-header">
                                  <span className="summary-label">Total ganancias ortodoncia:</span>
                                </div>
                                <span className="summary-value">
                                  {formatCurrency((closing.total_clinical_orthodontic_income || 0) + (closing.total_orthodontic_doctor_income || 0), 'NIO', true)}
                                </span>
                              </div>
                              
                              <div className="summary-item income-ortho-clinic">
                                <div className="summary-header">
                                  <FontAwesomeIcon icon={faPercentage} />
                                  <span className="summary-label">Clínica ({clinicPercentage}%):</span>
                                </div>
                                <span className="summary-value">{formatCurrency(closing.total_clinical_orthodontic_income, 'NIO', true)}</span>
                              </div>
                              
                              <div className="summary-item income-ortho-doctor">
                                <div className="summary-header">
                                  <FontAwesomeIcon icon={faUserMd} />
                                  <span className="summary-label">Doctora ({doctorPercentage}%):</span>
                                </div>
                                <span className="summary-value">{formatCurrency(closing.total_orthodontic_doctor_income, 'NIO', true)}</span>
                              </div>
                            </div>
                            
                            {/* Sección de doctores externos */}
                            {closing.total_external_doctor_payments > 0 && (
                              <div className="summary-section external-section">
                                <div className="section-title">
                                  <FontAwesomeIcon icon={faUserDoctor} />
                                  <span>Pagos a Doctores Externos</span>
                                </div>
                                
                                <div className="summary-item external-doctor">
                                  <span className="summary-label">Total pagado:</span>
                                  <span className="summary-value external">
                                    {formatCurrency(closing.total_external_doctor_payments, 'NIO', true)}
                                  </span>
                                  <div className="summary-description">
                                    <small>Ya deducido de las ganancias mostradas arriba</small>
                                    <button 
                                      className="details-btn small"
                                      onClick={() => fetchExternalDoctorDetails(closing)}
                                    >
                                      <FontAwesomeIcon icon={faEye} />
                                      Ver detalles
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <div className="summary-section expenses-section">
                              <div className="section-title">
                                <FontAwesomeIcon icon={faMoneyBillWave} />
                                <span>Gastos</span>
                              </div>
                              
                              <div className="summary-item expense-fixed">
                                <span className="summary-label">Gastos Fijos:</span>
                                <span className="summary-value">{formatCurrency(closing.total_fixed_expenses, 'NIO', true)}</span>
                                <div className="summary-description">
                                  <small>Gastos recurrentes mensuales</small>
                                </div>
                              </div>
                              
                              <div className="summary-item expense-variable">
                                <span className="summary-label">Gastos Variables:</span>
                                <span className="summary-value">{formatCurrency(closing.total_variable_expenses, 'NIO', true)}</span>
                                <div className="summary-description">
                                  <small>Gastos ocasionales del período</small>
                                </div>
                              </div>
                              
                              <div className="summary-total expense-total negative">
                                <span className="summary-label">Total Gastos:</span>
                                <span className="summary-value">{formatCurrency(closing.total_expenses, 'NIO', true)}</span>
                              </div>
                            </div>
                          </>
                        )}
                        
                        {closing.sub_type === 'general' && (
                          <>
                            <div className="summary-item income-general">
                              <div className="summary-header">
                                <FontAwesomeIcon icon={faHospital} />
                                <span className="summary-label">Procedimientos Generales:</span>
                              </div>
                              <span className="summary-value">{formatCurrency(closing.total_general_income, 'NIO', true)}</span>
                              <div className="summary-description">
                                <small>Ganancia neta 100% para la clínica</small>
                              </div>
                            </div>
                            
                            {closing.total_external_doctor_payments > 0 && (
                              <div className="summary-section external-section">
                                <div className="section-title">
                                  <FontAwesomeIcon icon={faUserDoctor} />
                                  <span>Pagos a Doctores Externos</span>
                                </div>
                                
                                <div className="summary-item external-doctor">
                                  <span className="summary-label">Total pagado:</span>
                                  <span className="summary-value external">
                                    {formatCurrency(closing.total_external_doctor_payments, 'NIO', true)}
                                  </span>
                                  <div className="summary-description">
                                    <small>Ya deducido de las ganancias mostradas arriba</small>
                                    <button 
                                      className="details-btn small"
                                      onClick={() => fetchExternalDoctorDetails(closing)}
                                    >
                                      <FontAwesomeIcon icon={faEye} />
                                      Ver detalles
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        
                        {closing.sub_type === 'orthodontics' && (
                          <>
                            <div className="summary-section ortho-section full">
                              <div className="section-title">
                                <FontAwesomeIcon icon={faTooth} />
                                <span>Ortodoncia</span>
                              </div>
                              
                              <div className="summary-item income-ortho-total">
                                <div className="summary-header">
                                  <span className="summary-label">Total ganancias ortodoncia:</span>
                                </div>
                                <span className="summary-value">
                                  {formatCurrency((closing.total_clinical_orthodontic_income || 0) + (closing.total_orthodontic_doctor_income || 0), 'NIO', true)}
                                </span>
                              </div>
                              
                              <div className="summary-item income-ortho-clinic">
                                <div className="summary-header">
                                  <FontAwesomeIcon icon={faPercentage} />
                                  <span className="summary-label">Clínica ({clinicPercentage}%):</span>
                                </div>
                                <span className="summary-value">{formatCurrency(closing.total_clinical_orthodontic_income, 'NIO', true)}</span>
                              </div>
                              
                              <div className="summary-item income-ortho-doctor">
                                <div className="summary-header">
                                  <FontAwesomeIcon icon={faUserMd} />
                                  <span className="summary-label">Doctora ({doctorPercentage}%):</span>
                                </div>
                                <span className="summary-value">{formatCurrency(closing.total_orthodontic_doctor_income, 'NIO', true)}</span>
                              </div>
                            </div>
                            
                            {closing.total_external_doctor_payments > 0 && (
                              <div className="summary-section external-section">
                                <div className="section-title">
                                  <FontAwesomeIcon icon={faUserDoctor} />
                                  <span>Pagos a Doctores Externos</span>
                                </div>
                                
                                <div className="summary-item external-doctor">
                                  <span className="summary-label">Total pagado:</span>
                                  <span className="summary-value external">
                                    {formatCurrency(closing.total_external_doctor_payments, 'NIO', true)}
                                  </span>
                                  <div className="summary-description">
                                    <small>Ya deducido de las ganancias mostradas arriba</small>
                                    <button 
                                      className="details-btn small"
                                      onClick={() => fetchExternalDoctorDetails(closing)}
                                    >
                                      <FontAwesomeIcon icon={faEye} />
                                      Ver detalles
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="summary-grid">
                        <div className="summary-item income-total">
                          <div className="summary-header">
                            <FontAwesomeIcon icon={faDollarSign} />
                            <span className="summary-label">Total ganancias del día:</span>
                          </div>
                          <span className="summary-value">{formatCurrency(closing.total_income, 'NIO', true)}</span>
                        </div>
                        
                        <div className="summary-section distribution-section">
                          <div className="section-title">
                            <FontAwesomeIcon icon={faUserFriends} />
                            <span>Distribución</span>
                          </div>
                          
                          <div className="summary-item clinic-income">
                            <div className="summary-header">
                              <FontAwesomeIcon icon={faHospital} />
                              <span className="summary-label">
                                {closing.sub_type === 'orthodontics' ? `Clínica (${clinicPercentage}%)` : 'Clínica (100%)'}:
                              </span>
                            </div>
                            <span className="summary-value">{formatCurrency(closing.total_clinic_income, 'NIO', true)}</span>
                            <div className="summary-description">
                              <small>Ganancia neta de la clínica</small>
                            </div>
                          </div>
                          
                          {closing.sub_type === 'orthodontics' && (
                            <div className="summary-item doctor-income">
                              <div className="summary-header">
                                <FontAwesomeIcon icon={faUserMd} />
                                <span className="summary-label">Doctora ({doctorPercentage}%):</span>
                              </div>
                              <span className="summary-value">{formatCurrency(closing.total_doctor_income, 'NIO', true)}</span>
                            </div>
                          )}
                          
                          {/* NUEVO: Sección de gastos variables para cierres diarios */}
                          {closing.has_expenses && (
                            <div className="summary-item expenses-daily">
                              <div className="summary-header">
                                <FontAwesomeIcon icon={faReceipt} />
                                <span className="summary-label">Gastos Variables del Día:</span>
                              </div>
                              <span className="summary-value expense">{formatCurrency(closing.total_variable_expenses, 'NIO', true)}</span>
                              <div className="summary-description">
                                <small>Gastos ocasionales registrados en esta fecha</small>
                                <button 
                                  className="details-btn small"
                                  onClick={() => fetchVariableExpensesDetails(closing)}
                                >
                                  <FontAwesomeIcon icon={faEye} />
                                  Ver detalles
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Doctores externos para cierres diarios */}
                        {closing.total_external_doctor_payments > 0 && (
                          <div className="summary-section external-section">
                            <div className="section-title">
                              <FontAwesomeIcon icon={faUserDoctor} />
                              <span>Pagos a Doctores Externos</span>
                            </div>
                            
                            <div className="summary-item external-doctor">
                              <span className="summary-label">Total pagado:</span>
                              <span className="summary-value external">{formatCurrency(closing.total_external_doctor_payments, 'NIO', true)}</span>
                              <div className="summary-description">
                                <small>Ya deducido de las ganancias mostradas arriba</small>
                                <button 
                                  className="details-btn small"
                                  onClick={() => fetchExternalDoctorDetails(closing)}
                                >
                                  <FontAwesomeIcon icon={faEye} />
                                  Ver detalles
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="net-profit-summary">
                      <div className="net-profit-header">
                        <h6>
                          <FontAwesomeIcon icon={faChartLine} />
                          Resumen Final - Clínica
                        </h6>
                      </div>
                      
                      <div className="net-profit-items">
                        <div className="net-profit-item">
                          <span className="net-profit-label">Total ganancias clínica:</span>
                          <span className="net-profit-value">
                            {formatCurrency(closing.total_clinic_income, 'NIO', true)}
                          </span>
                        </div>
                        
                        {/* Mostrar gastos si existen */}
                        {closing.has_expenses && (
                          <div className="net-profit-item expense-note">
                            <span className="net-profit-label">
                              <FontAwesomeIcon icon={faReceipt} /> Gastos:
                            </span>
                            <span className="net-profit-value expense">
                              -{formatCurrency(closing.total_variable_expenses, 'NIO', true)}
                            </span>
                          </div>
                        )}
                        
                        {/* Mostrar doctores externos en resumen final */}
                        {closing.total_external_doctor_payments > 0 && (
                          <div className="net-profit-item external-note">
                            <span className="net-profit-label">
                              <FontAwesomeIcon icon={faUserDoctor} /> Doctores externos:
                            </span>
                            <span className="net-profit-value external">
                              -{formatCurrency(closing.total_external_doctor_payments, 'NIO', true)}
                            </span>
                            <div className="net-profit-description">
                              <small>Ya incluido en ganancias clínicas</small>
                            </div>
                          </div>
                        )}
                        
                        {closing.type === 'monthly' && closing.sub_type === 'all' && (
                          <div className="net-profit-item">
                            <span className="net-profit-label">Total gastos:</span>
                            <span className="net-profit-value negative">
                              {formatCurrency(closing.total_expenses, 'NIO', true)}
                            </span>
                          </div>
                        )}
                        
                        <div className="net-profit-final">
                          <span className="net-profit-label">Utilidad neta clínica:</span>
                          <span 
                            className="net-profit-value"
                            style={{ color: getProfitColor(closing.net_profit) }}
                          >
                            {formatCurrency(closing.net_profit, 'NIO', true)}
                          </span>
                        </div>
                        
                        {closing.total_clinic_income > 0 && (
                          <div className="profit-margin">
                            <span className="margin-label">Margen de utilidad:</span>
                            <span className="margin-value">
                              {((closing.net_profit / closing.total_clinic_income) * 100).toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="export-options">
                    <h6>Opciones de Exportación:</h6>
                    <div className="export-buttons">
                      <button 
                        className="secondary-btn small"
                        onClick={() => handleExportPDF(closing)}
                      >
                        <FontAwesomeIcon icon={faFilePdf} />
                        PDF
                      </button>
                      <button 
                        className="secondary-btn small"
                        onClick={() => handleExportExcelDetailed(closing)}
                      >
                        <FontAwesomeIcon icon={faListAlt} />
                        Excel Detallado
                      </button>
                      <button 
                        className="secondary-btn small"
                        onClick={() => handleExportExcelGeneral(closing.type === 'monthly' ? 'monthly' : 'daily')}
                      >
                        <FontAwesomeIcon icon={faFileExcel} />
                        Excel General
                      </button>
                      {closing.type === 'daily' && closing.has_expenses && (
                        <button 
                          className="secondary-btn small expense"
                          onClick={() => fetchVariableExpensesDetails(closing)}
                        >
                          <FontAwesomeIcon icon={faReceipt} />
                          Ver Gastos
                        </button>
                      )}
                      {closing.total_external_doctor_payments > 0 && (
                        <button 
                          className="secondary-btn small external"
                          onClick={() => fetchExternalDoctorDetails(closing)}
                        >
                          <FontAwesomeIcon icon={faUserDoctor} />
                          Ver Doctores Externos
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal para crear cierre mensual (sin cambios) */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faCalendarAlt} />
                Crear Cierre Mensual
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => !creating && setShowCreateModal(false)}
                disabled={creating}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <form onSubmit={handleCreateClosing} className="closing-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Mes:</label>
                  <select
                    required
                    value={newClosing.month}
                    onChange={(e) => setNewClosing({...newClosing, month: e.target.value})}
                    className="form-select"
                    disabled={creating}
                  >
                    {MONTHS.map(month => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Año:</label>
                  <input
                    type="number"
                    required
                    min="2020"
                    max={new Date().getFullYear() + 5}
                    value={newClosing.year}
                    onChange={(e) => setNewClosing({...newClosing, year: e.target.value})}
                    className="form-input"
                    disabled={creating}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tipo de cierre:</label>
                  <select
                    required
                    value={newClosing.closing_type}
                    onChange={(e) => setNewClosing({...newClosing, closing_type: e.target.value})}
                    className="form-select"
                    disabled={creating}
                  >
                    <option value="all">Completo (General + Ortodoncia)</option>
                    <option value="general">Solo Procedimientos Generales</option>
                    <option value="orthodontics">Solo Ortodoncia</option>
                  </select>
                  <small className="form-help">
                    {newClosing.closing_type === 'all' && 'Incluye todos los procedimientos y gastos (fijos + variables)'}
                    {newClosing.closing_type === 'general' && 'Solo procedimientos generales, sin gastos'}
                    {newClosing.closing_type === 'orthodontics' && 'Solo ortodoncia, sin gastos'}
                  </small>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Fecha inicio del período (opcional):</label>
                <input
                  type="date"
                  value={newClosing.startDate}
                  onChange={(e) => setNewClosing({...newClosing, startDate: e.target.value})}
                  className="form-input"
                  disabled={creating}
                />
                <small className="form-help">Si no se especifica, se usará el primer día del mes</small>
              </div>

              <div className="form-group">
                <label className="form-label">Fecha fin del período (opcional):</label>
                  <input
                  type="date"
                  value={newClosing.endDate}
                  onChange={(e) => setNewClosing({...newClosing, endDate: e.target.value})}
                  className="form-input"
                  disabled={creating}
                />
                <small className="form-help">Si no se especifica, se usará el último día del mes</small>
              </div>

              <div className="form-group">
                <label className="form-label">Comentarios (opcional):</label>
                <textarea
                  value={newClosing.comentary}
                  onChange={(e) => setNewClosing({...newClosing, comentary: e.target.value})}
                  className="form-textarea"
                  placeholder="Notas adicionales sobre el cierre..."
                  rows="3"
                  disabled={creating}
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="secondary-btn"
                  onClick={() => !creating && setShowCreateModal(false)}
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="primary-btn"
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <div className="spinner-small"></div>
                      Calculando...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faCalculator} />
                      Crear Cierre {getClosingTypeLabel(newClosing.closing_type)}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para crear cierre diario (MODIFICADO con información de gastos) */}
      {showCreateDailyModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faCalendarDay} />
                Crear Cierre Diario
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => !creatingDaily && setShowCreateDailyModal(false)}
                disabled={creatingDaily}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <form onSubmit={handleCreateDailyClosing} className="closing-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Fecha:</label>
                  <input
                    type="date"
                    required
                    value={newDailyClosing.date}
                    onChange={(e) => {
                      setNewDailyClosing({...newDailyClosing, date: e.target.value});
                      setDailySummary(null);
                    }}
                    className="form-input"
                    disabled={creatingDaily}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tipo de cierre:</label>
                  <select
                    required
                    value={newDailyClosing.closing_type}
                    onChange={(e) => {
                      setNewDailyClosing({...newDailyClosing, closing_type: e.target.value});
                      setDailySummary(null);
                    }}
                    className="form-select"
                    disabled={creatingDaily}
                  >
                    <option value="general">General (Todos los procedimientos)</option>
                    <option value="orthodontics">Ortodoncia</option>
                  </select>
                  <small className="form-help">
                    {newDailyClosing.closing_type === 'orthodontics' 
                      ? `Separa automáticamente: Clínica (${clinicPercentage}%), Doctora (${doctorPercentage}%)`
                      : 'Todos los procedimientos generales del día'}
                  </small>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Comentarios (opcional):</label>
                <textarea
                  value={newDailyClosing.comentary}
                  onChange={(e) => setNewDailyClosing({...newDailyClosing, comentary: e.target.value})}
                  className="form-textarea"
                  placeholder="Notas adicionales sobre el cierre diario..."
                  rows="2"
                  disabled={creatingDaily}
                />
              </div>

              {dailySummary && (
                <div className="daily-summary-preview">
                  <h5>
                    <FontAwesomeIcon icon={faCalculator} />
                    Resumen del día {formatDate(newDailyClosing.date)}
                  </h5>
                  <div className="summary-preview-content">
                    <div className="preview-item">
                      <span>Procedimientos encontrados:</span>
                      <span className="preview-value">{dailySummary.cantidad_procedimientos || 0}</span>
                    </div>
                    
                    {/* NUEVO: Mostrar gastos variables en el resumen */}
                    {dailySummary.cantidad_gastos_variables > 0 && (
                      <div className="preview-item expense">
                        <span>
                          <FontAwesomeIcon icon={faReceipt} /> Gastos variables:
                        </span>
                        <span className="preview-value">{dailySummary.cantidad_gastos_variables}</span>
                        <div className="preview-note">
                          <small>Total: {formatCurrency(dailySummary.total_variable_expenses, 'NIO', true)}</small>
                        </div>
                      </div>
                    )}
                    
                    <div className="preview-item">
                      <span>Total ganancias:</span>
                      <span className="preview-value">{formatCurrency(dailySummary.total_income, 'NIO', true)}</span>
                      <div className="preview-note">
                        <small>Suma de ganancias netas</small>
                      </div>
                    </div>
                    
                    {newDailyClosing.closing_type === 'orthodontics' ? (
                      <>
                        <div className="preview-item">
                          <span>Clínica ({clinicPercentage}%):</span>
                          <span className="preview-value">{formatCurrency(dailySummary.total_clinic_income, 'NIO', true)}</span>
                        </div>
                        <div className="preview-item">
                          <span>Doctora ({doctorPercentage}%):</span>
                          <span className="preview-value">{formatCurrency(dailySummary.total_doctor_income, 'NIO', true)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="preview-item">
                        <span>Clínica (100%):</span>
                        <span className="preview-value">{formatCurrency(dailySummary.total_clinic_income, 'NIO', true)}</span>
                      </div>
                    )}
                    
                    {/* Mostrar utilidad después de gastos */}
                    <div className="preview-item total">
                      <span>Utilidad neta clínica (después de gastos):</span>
                      <span 
                        className="preview-value"
                        style={{ color: getProfitColor(dailySummary.net_profit || 0) }}
                      >
                        {formatCurrency(dailySummary.net_profit, 'NIO', true)}
                      </span>
                    </div>
                    
                    {dailySummary.total_external_doctor_payments > 0 && (
                      <div className="preview-item external">
                        <span>
                          <FontAwesomeIcon icon={faUserDoctor} /> Doctores externos:
                        </span>
                        <span className="preview-value">
                          {formatCurrency(dailySummary.total_external_doctor_payments, 'NIO', true)}
                        </span>
                        <div className="preview-note">
                          <small>Ya deducidos de las ganancias</small>
                        </div>
                      </div>
                    )}
                    
                    {dailySummary.closing_exists && (
                      <div className="preview-warning">
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <span>Ya existe un cierre para esta fecha y tipo</span>
                      </div>
                    )}
                    
                    {dailySummary.cantidad_procedimientos === 0 && dailySummary.cantidad_gastos_variables === 0 && (
                      <div className="preview-warning">
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <span>No se encontraron procedimientos ni gastos variables para esta fecha</span>
                      </div>
                    )}
                    
                    {dailySummary.cantidad_procedimientos === 0 && dailySummary.cantidad_gastos_variables > 0 && (
                      <div className="preview-warning info">
                        <FontAwesomeIcon icon={faInfoCircle} />
                        <span>Solo se registrarán {dailySummary.cantidad_gastos_variables} gastos variables</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button 
                  type="button" 
                  className="secondary-btn"
                  onClick={() => !creatingDaily && setShowCreateDailyModal(false)}
                  disabled={creatingDaily}
                >
                  Cancelar
                </button>
                <button 
                  type="button" 
                  className="secondary-btn"
                  onClick={handleGetDailySummary}
                  disabled={creatingDaily}
                >
                  <FontAwesomeIcon icon={faCalculator} />
                  Ver Resumen
                </button>
                <button 
                  type="submit" 
                  className="primary-btn"
                  disabled={creatingDaily || (dailySummary && dailySummary.closing_exists)}
                >
                  {creatingDaily ? (
                    <>
                      <div className="spinner-small"></div>
                      Creando...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faCalendarCheck} />
                      Crear Cierre Diario
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NUEVO: Modal de detalles de gastos variables */}
      {showVariableExpensesModal && variableExpensesDetails && (
        <div className="modal-overlay">
          <div className="modal-content wide">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faReceipt} />
                Detalles de Gastos Variables - {variableExpensesDetails.closingInfo.date_exact}
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowVariableExpensesModal(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="detail-content">
              <div className="detail-section">
                <h4>Información del Cierre</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Cierre:</span>
                    <span className="detail-value">{variableExpensesDetails.closingInfo.display_date}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Tipo:</span>
                    <span className="detail-value">{getClosingTypeText(variableExpensesDetails.closingInfo.type, variableExpensesDetails.closingInfo.sub_type)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Total gastos:</span>
                    <span className="detail-value expense">
                      {formatCurrency(variableExpensesDetails.summary?.total_expenses || 0, 'NIO', true)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Cantidad de gastos:</span>
                    <span className="detail-value">{variableExpensesDetails.summary?.total_count || 0}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Detalle de Gastos</h4>
                {variableExpensesDetails.expenses && variableExpensesDetails.expenses.length > 0 ? (
                  <div className="expenses-table">
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Descripción</th>
                          <th>Categoría</th>
                          <th>Monto (C$)</th>
                          <th>Monto ($)</th>
                          <th>Moneda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variableExpensesDetails.expenses.map((expense, index) => (
                          <tr key={index}>
                            <td>#{expense.bill_ID}</td>
                            <td>{expense.description}</td>
                            <td>
                              <span className="category-badge">{expense.category || 'General'}</span>
                            </td>
                            <td>{formatCurrencySimple(expense.amount_cordobas, 'NIO')}</td>
                            <td>{formatCurrencySimple(expense.amount_cordobas / exchangeRate, 'USD')}</td>
                            <td>{expense.currency_used || 'NIO'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="3" className="total-label"><strong>Total:</strong></td>
                          <td className="total-amount">
                            <strong>{formatCurrencySimple(variableExpensesDetails.summary?.total_expenses || 0, 'NIO')}</strong>
                          </td>
                          <td className="total-amount">
                            <strong>{formatCurrencySimple((variableExpensesDetails.summary?.total_expenses || 0) / exchangeRate, 'USD')}</strong>
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="no-data">
                    <FontAwesomeIcon icon={faInfoCircle} />
                    <p>No hay gastos variables registrados para este día.</p>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button 
                  className="secondary-btn"
                  onClick={() => setShowVariableExpensesModal(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalles de doctores externos (sin cambios) */}
      {showExternalDoctorsModal && externalDoctorDetails && (
        <div className="modal-overlay">
          <div className="modal-content wide">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faUserDoctor} />
                Detalles de Pagos a Doctores Externos
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowExternalDoctorsModal(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="detail-content">
              <div className="detail-section">
                <h4>Información del Cierre</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Cierre:</span>
                    <span className="detail-value">{externalDoctorDetails.closingInfo.display_date}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Tipo:</span>
                    <span className="detail-value">{getClosingTypeText(externalDoctorDetails.closingInfo.type, externalDoctorDetails.closingInfo.sub_type)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Total pagado:</span>
                    <span className="detail-value external">
                      {formatCurrency(externalDoctorDetails.summary?.total_payments_cordobas || 0, 'NIO', true)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Cantidad de pagos:</span>
                    <span className="detail-value">{externalDoctorDetails.summary?.count || 0}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Detalle de Pagos</h4>
                {externalDoctorDetails.payments && externalDoctorDetails.payments.length > 0 ? (
                  <div className="external-doctors-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Procedimiento</th>
                          <th>Paciente</th>
                          <th>Doctor</th>
                          <th>Tipo</th>
                          <th>Monto (C$)</th>
                          <th>Monto ($)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {externalDoctorDetails.payments.map((payment, index) => (
                          <tr key={index}>
                            <td>{formatDate(payment.procedure_date)}</td>
                            <td>
                              <div className="procedure-info">
                                <div className="procedure-id">#{payment.procedure_id}</div>
                                <div className="procedure-desc">{payment.procedure_description}</div>
                              </div>
                            </td>
                            <td>{payment.patient_name || 'No especificado'}</td>
                            <td>
                              <div className="doctor-info">
                                <FontAwesomeIcon icon={faUserDoctor} />
                                <span>{payment.doctor_name}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`payment-type ${payment.payment_type}`}>
                                {payment.payment_type === 'fixed' ? 'Monto Fijo' : 'Porcentaje'}
                              </span>
                            </td>
                            <td>{formatCurrencySimple(payment.payment_cordobas, 'NIO')}</td>
                            <td>{formatCurrencySimple(payment.payment_dollars, 'USD')}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="5" className="total-label"><strong>Total:</strong></td>
                          <td className="total-amount">
                            <strong>{formatCurrencySimple(externalDoctorDetails.summary?.total_payments_cordobas || 0, 'NIO')}</strong>
                          </td>
                          <td className="total-amount">
                            <strong>{formatCurrencySimple(externalDoctorDetails.summary?.total_payments_dollars || 0, 'USD')}</strong>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="no-data">
                    <FontAwesomeIcon icon={faInfoCircle} />
                    <p>No hay pagos a doctores externos registrados para este período.</p>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button 
                  className="secondary-btn"
                  onClick={() => setShowExternalDoctorsModal(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalles general del cierre (sin cambios) */}
      {showDetailModal && selectedClosing && (
        <div className="modal-overlay">
          <div className="modal-content wide">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faEye} />
                Detalles del Cierre - {selectedClosing.display_date}
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowDetailModal(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="detail-content">
              <div className="detail-section">
                <h4>Información General</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Tipo de cierre:</span>
                    <span className="detail-value type-badge" style={{ 
                      backgroundColor: `${getClosingTypeColor(selectedClosing.type, selectedClosing.sub_type)}20`,
                      color: getClosingTypeColor(selectedClosing.type, selectedClosing.sub_type)
                    }}>
                      <FontAwesomeIcon icon={getClosingTypeIcon(selectedClosing.type, selectedClosing.sub_type)} />
                      {getClosingTypeText(selectedClosing.type, selectedClosing.sub_type)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Fecha exacta:</span>
                    <span className="detail-value">{selectedClosing.date_exact}</span>
                  </div>
                  {selectedClosing.type === 'monthly' ? (
                    <>
                      <div className="detail-item">
                        <span className="detail-label">Mes:</span>
                        <span className="detail-value">{selectedClosing.month}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Año:</span>
                        <span className="detail-value">{selectedClosing.year}</span>
                      </div>
                    </>
                  ) : (
                    <div className="detail-item">
                      <span className="detail-label">Tipo específico:</span>
                      <span className="detail-value">
                        {selectedClosing.sub_type === 'orthodontics' ? 'Ortodoncia' : 'General'}
                      </span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">Estado:</span>
                    <span 
                      className="detail-value status-badge"
                      style={{ 
                        backgroundColor: getProfitColor(selectedClosing.net_profit) + '20',
                        color: getProfitColor(selectedClosing.net_profit)
                      }}
                    >
                      <FontAwesomeIcon icon={getProfitIcon(selectedClosing.net_profit)} />
                      {selectedClosing.net_profit >= 0 ? 'GANANCIA' : 'PÉRDIDA'}
                    </span>
                  </div>
                  {selectedClosing.comentary && (
                    <div className="detail-item full">
                      <span className="detail-label">Comentarios:</span>
                      <span className="detail-value">{selectedClosing.comentary}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h4>Resumen Financiero Detallado</h4>
                <div className="financial-breakdown">
                  
                  {selectedClosing.type === 'monthly' ? (
                    // Resumen mensual (sin cambios)
                    <>
                      {selectedClosing.sub_type === 'all' && (
                        <>
                          <div className="breakdown-section income">
                            <h5>
                              <FontAwesomeIcon icon={faHospital} />
                              Procedimientos Generales
                            </h5>
                            <div className="breakdown-item">
                              <span>Ganancia neta clínica:</span>
                              <span className="amount">{formatCurrency(selectedClosing.total_general_income, 'NIO', true)}</span>
                            </div>
                            <div className="breakdown-description">
                              <small>100% para la clínica, después de todas las deducciones</small>
                            </div>
                          </div>

                          <div className="breakdown-section ortho">
                            <h5>
                              <FontAwesomeIcon icon={faTooth} />
                              Ortodoncia
                            </h5>
                            <div className="breakdown-item">
                              <span>Total ganancias ortodoncia:</span>
                              <span className="amount">
                                {formatCurrency((selectedClosing.total_clinical_orthodontic_income || 0) + (selectedClosing.total_orthodontic_doctor_income || 0), 'NIO', true)}
                              </span>
                            </div>
                            <div className="breakdown-item">
                              <span>Clínica ({clinicPercentage}%):</span>
                              <span className="amount">{formatCurrency(selectedClosing.total_clinical_orthodontic_income, 'NIO', true)}</span>
                            </div>
                            <div className="breakdown-item">
                              <span>
                                <FontAwesomeIcon icon={faUserMd} /> Doctora ({doctorPercentage}%):
                              </span>
                              <span className="amount">{formatCurrency(selectedClosing.total_orthodontic_doctor_income, 'NIO', true)}</span>
                            </div>
                          </div>

                          {/* Sección de doctores externos */}
                          {selectedClosing.total_external_doctor_payments > 0 && (
                            <div className="breakdown-section external">
                              <h5>
                                <FontAwesomeIcon icon={faUserDoctor} />
                                Pagos a Doctores Externos
                              </h5>
                              <div className="breakdown-item">
                                <span>Total pagado:</span>
                                <span className="amount external">
                                  {formatCurrency(selectedClosing.total_external_doctor_payments, 'NIO', true)}
                                </span>
                              </div>
                              <div className="breakdown-description">
                                <small>Ya deducido de las ganancias mostradas arriba</small>
                                <button 
                                  className="details-btn"
                                  onClick={() => fetchExternalDoctorDetails(selectedClosing)}
                                >
                                  <FontAwesomeIcon icon={faEye} />
                                  Ver detalles completos
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="breakdown-section expenses">
                            <h5>
                              <FontAwesomeIcon icon={faMoneyBillWave} />
                              Gastos Incluidos
                            </h5>
                            <div className="breakdown-item">
                              <span>Gastos Fijos:</span>
                              <span className="amount">{formatCurrency(selectedClosing.total_fixed_expenses, 'NIO', true)}</span>
                              <div className="breakdown-description">
                                <small>Gastos recurrentes mensuales</small>
                              </div>
                            </div>
                            <div className="breakdown-item">
                              <span>Gastos Variables:</span>
                              <span className="amount">
                                {formatCurrency(selectedClosing.total_variable_expenses, 'NIO', true)}
                              </span>
                              <div className="breakdown-description">
                                <small>Gastos ocasionales del período</small>
                              </div>
                            </div>
                            <div className="breakdown-total negative">
                              <span>Total Gastos:</span>
                              <span className="total-amount">
                                {formatCurrency(selectedClosing.total_expenses, 'NIO', true)}
                              </span>
                            </div>
                          </div>
                        </>
                      )}

                      {selectedClosing.sub_type === 'general' && (
                        <>
                          <div className="breakdown-section income full">
                            <h5>
                              <FontAwesomeIcon icon={faHospital} />
                              Procedimientos Generales
                            </h5>
                            <div className="breakdown-item">
                              <span>Ganancia neta clínica:</span>
                              <span className="amount">{formatCurrency(selectedClosing.total_general_income, 'NIO', true)}</span>
                            </div>
                            <div className="breakdown-description">
                              <small>100% para la clínica, después de todas las deducciones</small>
                            </div>
                          </div>
                          
                          {selectedClosing.total_external_doctor_payments > 0 && (
                            <div className="breakdown-section external">
                              <h5>
                                <FontAwesomeIcon icon={faUserDoctor} />
                                Pagos a Doctores Externos
                              </h5>
                              <div className="breakdown-item">
                                <span>Total pagado:</span>
                                <span className="amount external">
                                  {formatCurrency(selectedClosing.total_external_doctor_payments, 'NIO', true)}
                                </span>
                              </div>
                              <div className="breakdown-description">
                                <small>Ya deducido de las ganancias mostradas arriba</small>
                                <button 
                                  className="details-btn"
                                  onClick={() => fetchExternalDoctorDetails(selectedClosing)}
                                >
                                  <FontAwesomeIcon icon={faEye} />
                                  Ver detalles completos
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {selectedClosing.sub_type === 'orthodontics' && (
                        <>
                          <div className="breakdown-section ortho full">
                            <h5>
                              <FontAwesomeIcon icon={faTooth} />
                              Ortodoncia
                            </h5>
                            <div className="breakdown-item">
                              <span>Total ganancias ortodoncia:</span>
                              <span className="amount">
                                {formatCurrency((selectedClosing.total_clinical_orthodontic_income || 0) + (selectedClosing.total_orthodontic_doctor_income || 0), 'NIO', true)}
                              </span>
                            </div>
                            <div className="breakdown-item">
                              <span>Clínica ({clinicPercentage}%):</span>
                              <span className="amount">{formatCurrency(selectedClosing.total_clinical_orthodontic_income, 'NIO', true)}</span>
                            </div>
                            <div className="breakdown-item">
                              <span>
                                <FontAwesomeIcon icon={faUserMd} /> Doctora ({doctorPercentage}%):
                              </span>
                              <span className="amount">{formatCurrency(selectedClosing.total_orthodontic_doctor_income, 'NIO', true)}</span>
                            </div>
                          </div>
                          
                          {selectedClosing.total_external_doctor_payments > 0 && (
                            <div className="breakdown-section external">
                              <h5>
                                <FontAwesomeIcon icon={faUserDoctor} />
                                Pagos a Doctores Externos
                              </h5>
                              <div className="breakdown-item">
                                <span>Total pagado:</span>
                                <span className="amount external">
                                  {formatCurrency(selectedClosing.total_external_doctor_payments, 'NIO', true)}
                                </span>
                              </div>
                              <div className="breakdown-description">
                                <small>Ya deducido de las ganancias mostradas arriba</small>
                                <button 
                                  className="details-btn"
                                  onClick={() => fetchExternalDoctorDetails(selectedClosing)}
                                >
                                  <FontAwesomeIcon icon={faEye} />
                                  Ver detalles completos
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    // Resumen diario (MODIFICADO para incluir gastos)
                    <>
                      <div className="breakdown-section income">
                        <h5>
                          <FontAwesomeIcon icon={faDollarSign} />
                          Ganancias Totales del Día
                        </h5>
                        <div className="breakdown-item">
                          <span>Total ganancias:</span>
                          <span className="amount">{formatCurrency(selectedClosing.total_income, 'NIO', true)}</span>
                        </div>
                      </div>

                      <div className="breakdown-section distribution">
                        <h5>
                          <FontAwesomeIcon icon={faUserFriends} />
                          Distribución
                        </h5>
                        <div className="breakdown-item">
                          <span>
                            {selectedClosing.sub_type === 'orthodontics' ? `Clínica (${clinicPercentage}%)` : 'Clínica (100%)'}:
                          </span>
                          <span className="amount">{formatCurrency(selectedClosing.total_clinic_income, 'NIO', true)}</span>
                        </div>
                        {selectedClosing.sub_type === 'orthodontics' && (
                          <div className="breakdown-item">
                            <span>
                              <FontAwesomeIcon icon={faUserMd} /> Doctora ({doctorPercentage}%):
                            </span>
                            <span className="amount">{formatCurrency(selectedClosing.total_doctor_income, 'NIO', true)}</span>
                          </div>
                        )}
                        
                        {/* NUEVO: Mostrar gastos variables si existen */}
                        {selectedClosing.has_expenses && (
                          <div className="breakdown-item expense">
                            <span>
                              <FontAwesomeIcon icon={faReceipt} /> Gastos Variables:
                            </span>
                            <span className="amount expense">{formatCurrency(selectedClosing.total_variable_expenses, 'NIO', true)}</span>
                          </div>
                        )}
                      </div>

                      {/* Doctores externos para cierres diarios */}
                      {selectedClosing.total_external_doctor_payments > 0 && (
                        <div className="breakdown-section external">
                          <h5>
                            <FontAwesomeIcon icon={faUserDoctor} />
                            Pagos a Doctores Externos
                          </h5>
                          <div className="breakdown-item">
                            <span>Total pagado:</span>
                            <span className="amount external">
                              {formatCurrency(selectedClosing.total_external_doctor_payments, 'NIO', true)}
                            </span>
                          </div>
                          <div className="breakdown-description">
                            <small>Esta cantidad YA FUE DEDUCIDA de las ganancias mostradas arriba</small>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* RESUMEN FINAL */}
                  <div className="breakdown-section summary final">
                    <h5>
                      <FontAwesomeIcon icon={faChartLine} />
                      Resumen Final - Clínica
                    </h5>
                    <div className="breakdown-item">
                      <span>Total ganancias clínica:</span>
                      <span className="amount">
                        {formatCurrency(selectedClosing.total_clinic_income, 'NIO', true)}
                      </span>
                    </div>
                    
                    {/* Mostrar gastos si existen */}
                    {selectedClosing.has_expenses && (
                      <div className="breakdown-item">
                        <span>
                          <FontAwesomeIcon icon={faReceipt} /> Gastos variables:
                        </span>
                        <span className="amount expense">
                          -{formatCurrency(selectedClosing.total_variable_expenses, 'NIO', true)}
                        </span>
                      </div>
                    )}
                    
                    {/* Mostrar deducción de doctores externos */}
                    {selectedClosing.total_external_doctor_payments > 0 && (
                      <div className="breakdown-item external-note">
                        <span>
                          <FontAwesomeIcon icon={faUserDoctor} /> Deducción doctores externos:
                        </span>
                        <span className="amount external">
                          -{formatCurrency(selectedClosing.total_external_doctor_payments, 'NIO', true)}
                        </span>
                        <div className="breakdown-description">
                          <small>Ya incluido en ganancias clínicas</small>
                        </div>
                      </div>
                    )}
                    
                    {selectedClosing.type === 'monthly' && selectedClosing.sub_type === 'all' && (
                      <div className="breakdown-item">
                        <span>Total gastos:</span>
                        <span className="amount negative">
                          {formatCurrency(selectedClosing.total_expenses, 'NIO', true)}
                        </span>
                      </div>
                    )}
                    <div className="breakdown-final">
                      <span>Utilidad neta clínica:</span>
                      <span 
                        className="final-amount"
                        style={{ color: getProfitColor(selectedClosing.net_profit) }}
                      >
                        {formatCurrency(selectedClosing.net_profit, 'NIO', true)}
                      </span>
                    </div>
                    {selectedClosing.total_clinic_income > 0 && (
                      <div className="profit-margin">
                        <span>Margen de Utilidad:</span>
                        <span className="margin-value">
                          {((selectedClosing.net_profit / selectedClosing.total_clinic_income) * 100).toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Opciones de Exportación */}
              <div className="detail-section">
                <h4>Opciones de Exportación</h4>
                <div className="export-options-grid">
                  <div className="export-option">
                    <div className="export-icon">
                      <FontAwesomeIcon icon={faFilePdf} />
                    </div>
                    <div className="export-info">
                      <h5>PDF (Formato Vertical)</h5>
                      <p>Documento profesional listo para imprimir o compartir</p>
                    </div>
                    <button 
                      className="primary-btn small"
                      onClick={() => handleExportPDF(selectedClosing)}
                    >
                      Descargar PDF
                    </button>
                  </div>
                  
                  <div className="export-option">
                    <div className="export-icon">
                      <FontAwesomeIcon icon={faListAlt} />
                    </div>
                    <div className="export-info">
                      <h5>Excel con Desglose Completo</h5>
                      <p>Incluye todas las hojas: resumen, procedimientos, gastos y análisis</p>
                    </div>
                    <button 
                      className="primary-btn small"
                      onClick={() => handleExportExcelDetailed(selectedClosing)}
                    >
                      Descargar Excel Detallado
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NUEVO: Modal de confirmación para eliminar */}
      {showDeleteModal && closingToDelete && (
        <div className="modal-overlay">
          <div className="modal-content small">
            <div className="modal-header warning">
              <h3>
                <FontAwesomeIcon icon={faExclamationCircle} />
                Confirmar Eliminación
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => !deleting && setShowDeleteModal(false)}
                disabled={deleting}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="delete-confirmation">
              <div className="warning-icon">
                <FontAwesomeIcon icon={faExclamationTriangle} size="3x" />
              </div>
              
              <p className="warning-message">
                ¿Está seguro de eliminar este cierre?
              </p>
              
              <div className="closing-info">
                <p><strong>Tipo:</strong> {getClosingTypeText(closingToDelete.type, closingToDelete.sub_type)}</p>
                <p><strong>Fecha:</strong> {closingToDelete.display_date}</p>
                {closingToDelete.type === 'monthly' ? (
                  <p><strong>Período:</strong> {closingToDelete.month} {closingToDelete.year}</p>
                ) : (
                  <p><strong>Fecha exacta:</strong> {closingToDelete.date_exact}</p>
                )}
                <p><strong>Utilidad neta:</strong> {formatCurrency(closingToDelete.net_profit, 'NIO', true)}</p>
              </div>
              
              <p className="warning-note">
                <FontAwesomeIcon icon={faInfoCircle} />
                Esta acción no se puede deshacer. Los procedimientos y gastos asociados volverán a estar disponibles para nuevos cierres.
              </p>
              
              <div className="modal-actions">
                <button 
                  className="secondary-btn"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button 
                  className="danger-btn"
                  onClick={handleDeleteClosing}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <div className="spinner-small"></div>
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faTrashAlt} />
                      Eliminar Cierre
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyClosingsPage;