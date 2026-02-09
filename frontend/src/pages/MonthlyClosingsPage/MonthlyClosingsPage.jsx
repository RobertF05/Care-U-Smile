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
  faStethoscope
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

  // Combinar y filtrar todos los cierres
  const allClosings = useMemo(() => {
    const monthly = monthlyClosings.map(closing => {
      // Calcular utilidad neta CORRECTA incluyendo gastos
      const clinicIncome = (closing.total_general_income || 0) + (closing.total_clinical_orthodontic_income || 0);
      const totalExpenses = (closing.total_fixed_expenses || 0) + (closing.total_variable_expenses || 0);
      const netProfit = clinicIncome - totalExpenses;
      
      // Agregar pagos a doctores externos si existen
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
        total_external_doctor_payments: externalDoctorPayments, // AGREGADO
        total_external_doctor_payments_usd: externalDoctorPayments / exchangeRate, // AGREGADO
        // Mantener los campos individuales para el desglose
        total_general_income: closing.total_general_income || 0,
        total_clinical_orthodontic_income: closing.total_clinical_orthodontic_income || 0,
        total_orthodontic_doctor_income: closing.total_orthodontic_doctor_income || 0,
        total_fixed_expenses: closing.total_fixed_expenses || 0,
        total_variable_expenses: closing.total_variable_expenses || 0
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
      total_expenses: 0, // Cierres diarios no incluyen gastos
      total_expenses_usd: 0,
      net_profit: closing.net_profit || closing.total_clinic_income || 0,
      net_profit_usd: (closing.net_profit || closing.total_clinic_income || 0) / exchangeRate,
      total_income: closing.total_income || 0,
      total_income_usd: (closing.total_income || 0) / exchangeRate,
      total_doctor_income: closing.total_doctor_income || 0,
      total_doctor_income_usd: (closing.total_doctor_income || 0) / exchangeRate,
      total_external_doctor_payments: closing.total_external_doctor_payments || 0,
      total_external_doctor_payments_usd: (closing.total_external_doctor_payments || 0) / exchangeRate
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

  // Crear cierre mensual
  const handleCreateClosing = async (e) => {
    e.preventDefault();
    setCreating(true);
    
    try {
      // Verificar si ya existe cierre
      const exists = await checkMonthlyClosingExists(newClosing.month, newClosing.year, newClosing.closing_type);
      
      if (exists) {
        alert(`⚠️ Ya existe un cierre ${getClosingTypeLabel(newClosing.closing_type)} para ${newClosing.month} ${newClosing.year}`);
        setCreating(false);
        return;
      }

      // Calcular fechas del período
      const startDate = newClosing.startDate || `${newClosing.year}-${getMonthNumber(newClosing.month)}-01`;
      const endDate = newClosing.endDate || getLastDayOfMonth(newClosing.year, newClosing.month);
      
      console.log('📅 Período a calcular:', { startDate, endDate, type: newClosing.closing_type });
      
      // Crear cierre - NO vamos a eliminar gastos
      const closingData = {
        month: newClosing.month,
        year: parseInt(newClosing.year),
        startDate,
        endDate,
        closing_type: newClosing.closing_type,
        comentary: newClosing.comentary || '',
        deleteVariableExpenses: false // Siempre false, no eliminamos gastos
      };
      
      console.log('📤 Datos para crear cierre mensual:', closingData);

      const response = await createMonthlyClosing(closingData);
      
      if (response.success) {
        let message = `✅ Cierre ${getClosingTypeLabel(newClosing.closing_type)} de ${newClosing.month} ${newClosing.year} creado exitosamente\n\n`;
        
        if (newClosing.closing_type === 'all') {
          // Calcular utilidad neta correctamente
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
        
        // Agregar información de doctores externos si existe
        if (response.data.total_external_doctor_payments) {
          message += `\n👨‍⚕️ PAGOS DOCTORES EXTERNOS:\n`;
          message += `   Total pagado: ${formatCurrencySimple(response.data.total_external_doctor_payments)}\n`;
          message += `   (Ya deducido de las ganancias mostradas arriba)`;
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
        
        // Recargar cierres
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

  // Obtener resumen diario previo
  const handleGetDailySummary = async () => {
    try {
      setCreatingDaily(true);
      const summaryResponse = await getDailySummary(newDailyClosing.date, newDailyClosing.closing_type);
      
      if (summaryResponse.success) {
        setDailySummary(summaryResponse.data);
        
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

  // Crear cierre diario
  const handleCreateDailyClosing = async (e) => {
    e.preventDefault();
    setCreatingDaily(true);
    
    try {
      // Verificar si ya existe cierre para esta fecha y tipo
      const existsResponse = await checkDailyClosingExists(newDailyClosing.date, newDailyClosing.closing_type);
      
      if (existsResponse.data.exists) {
        alert(`⚠️ Ya existe un cierre ${newDailyClosing.closing_type === 'orthodontics' ? 'de ortodoncia' : 'general'} para esta fecha`);
        setCreatingDaily(false);
        return;
      }

      // Obtener resumen primero para verificar si hay procedimientos
      const summaryResponse = await getDailySummary(newDailyClosing.date, newDailyClosing.closing_type);
      
      if (!summaryResponse.success) {
        throw new Error('Error al obtener el resumen diario');
      }
      
      const summary = summaryResponse.data;
      
      // VERIFICAR: Si no hay procedimientos, mostrar advertencia
      if (!summary.procedures || summary.procedures.length === 0) {
        const confirmCreate = window.confirm(
          `⚠️ No se encontraron procedimientos de tipo "${newDailyClosing.closing_type}" para la fecha ${formatDate(newDailyClosing.date)}.\n\n` +
          `¿Desea crear el cierre igualmente?`
        );
        
        if (!confirmCreate) {
          setCreatingDaily(false);
          return;
        }
      }
      
      // Crear cierre diario
      const closingData = {
        date: newDailyClosing.date,
        closing_type: newDailyClosing.closing_type,
        comentary: newDailyClosing.comentary
      };

      const response = await createDailyClosing(closingData);
      
      if (response.success) {
        // Mensaje personalizado basado en si hay procedimientos o no
        const typeLabel = newDailyClosing.closing_type === 'orthodontics' ? 'de Ortodoncia' : 'General';
        let message = `✅ Cierre Diario ${typeLabel} creado exitosamente\n\n`;
        message += `📅 Fecha: ${formatDate(newDailyClosing.date)}\n`;
        message += `📋 Procedimientos incluidos: ${response.data.procedure_count || 0}\n`;
        
        if (response.data.procedure_count === 0) {
          message += `⚠️ Nota: No se encontraron procedimientos de este tipo para esta fecha\n`;
        }
        
        message += `💱 Tipo de cambio: C$${exchangeRate.toFixed(2)} = $1\n\n`;
        
        // Solo mostrar ganancias si hay procedimientos
        if (response.data.procedure_count > 0) {
          if (newDailyClosing.closing_type === 'orthodontics') {
            message += `🦷 ORTODONCIA:\n`;
            message += `   Total ganancias: ${formatCurrency(response.data.total_income, 'NIO', true)}\n`;
            message += `   Clínica (${clinicPercentage}%): ${formatCurrency(response.data.total_clinic_income, 'NIO', true)}\n`;
            message += `   Doctora (${doctorPercentage}%): ${formatCurrency(response.data.total_doctor_income, 'NIO', true)}\n`;
          } else {
            message += `📊 PROCEDIMIENTOS GENERALES:\n`;
            message += `   Ganancia neta clínica: ${formatCurrency(response.data.total_clinic_income, 'NIO', true)}\n`;
          }
          
          // Agregar información de doctores externos si existe
          if (response.data.total_external_doctor_payments > 0) {
            message += `\n👨‍⚕️ PAGOS DOCTORES EXTERNOS:\n`;
            message += `   Total pagado: ${formatCurrency(response.data.total_external_doctor_payments, 'NIO', true)}\n`;
            message += `   (Ya deducido de las ganancias mostradas arriba)`;
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
        
        // Recargar cierres diarios
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
          <p className="subtitle">
            Gestión de cierres mensuales y diarios - Tipo de cambio: C${exchangeRate.toFixed(2)} = $1
          </p>
          <div className="clinic-info">
            <span className="info-item">
              <FontAwesomeIcon icon={faPercentage} />
              <span>Clínica: {clinicPercentage}%</span>
            </span>
            <span className="info-item">
              <FontAwesomeIcon icon={faUserMd} />
              <span>Doctora: {doctorPercentage}%</span>
            </span>
            <span className="info-item">
              <FontAwesomeIcon icon={faUserDoctor} />
              <span>Doctores externos: Deducidos automáticamente</span>
            </span>
            <span className="info-item">
              <FontAwesomeIcon icon={faExchangeAlt} />
              <span>Tipo cambio: C${exchangeRate.toFixed(2)}</span>
            </span>
          </div>
        </div>
        <div className="header-right">
          <div className="btn-group">
            <button 
              className="secondary-btn"
              onClick={() => handleExportExcelGeneral('monthly')}
              title="Exportar cierres mensuales a Excel"
            >
              <FontAwesomeIcon icon={faFileExcel} />
              Excel Mensual
            </button>
            <button 
              className="secondary-btn"
              onClick={() => handleExportExcelGeneral('daily')}
              title="Exportar cierres diarios a Excel"
            >
              <FontAwesomeIcon icon={faFileExcel} />
              Excel Diario
            </button>
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
                    
                    {/* Mostrar desglose básico - AGREGADO DOCTORES EXTERNOS */}
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
                        <span className="quick-stat">
                          <FontAwesomeIcon icon={faHospital} />
                          <span>Clínica: {formatCurrency(closing.total_clinic_income, 'NIO', false)}</span>
                        </span>
                      )}
                      {/* AGREGADO: Mostrar doctores externos si existen */}
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
                    {/* AGREGADO: Botón para ver detalles de doctores externos */}
                    {closing.total_external_doctor_payments > 0 && (
                      <button 
                        className="action-btn external"
                        onClick={() => fetchExternalDoctorDetails(closing)}
                        title="Ver detalles de doctores externos"
                      >
                        <FontAwesomeIcon icon={faStethoscope} />
                      </button>
                    )}
                    <FontAwesomeIcon 
                      icon={expandedClosings[closing.id] ? faChevronUp : faChevronDown} 
                      className="expand-icon"
                      onClick={() => toggleExpandClosing(closing.id)}
                    />
                  </div>
                </div>
              </div>

              {/* Detalles expandidos */}
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
                            
                            {/* AGREGADO: Sección de doctores externos */}
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
                            
                            {/* AGREGADO: Doctores externos para general */}
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
                            
                            {/* AGREGADO: Doctores externos para ortodoncia */}
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
                        </div>
                        
                        {/* AGREGADO: Doctores externos para cierres diarios */}
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
                        
                        {/* AGREGADO: Mostrar doctores externos en resumen final */}
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
                      {/* AGREGADO: Botón para exportar detalles de doctores externos */}
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

      {/* Modal para crear cierre mensual */}
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

              <div className="form-note important">
                <FontAwesomeIcon icon={faInfoCircle} />
                <div>
                  <strong>IMPORTANTE - CÁLCULOS CORRECTOS:</strong>
                  <ul>
                    <li>✅ Usa <strong>clinic_payment_cordobas/dollars</strong> para ganancia clínica</li>
                    <li>✅ Usa <strong>doctor_payment_cordobas/dollars</strong> para ganancia doctora</li>
                    <li>✅ Usa <strong>external_doctor_payment</strong> para pagos externos</li>
                    <li>✅ <strong>NO usa total_procedure</strong> (es lo que paga el paciente)</li>
                    <li>✅ Incluye automáticamente <strong>pagos a doctores externos</strong> en el resumen</li>
                    {newClosing.closing_type === 'all' && (
                      <>
                        <li>✅ Incluye <strong>TODOS los gastos fijos</strong> del período</li>
                        <li>✅ Incluye <strong>TODOS los gastos variables</strong> del período</li>
                        <li>⚠️ Los gastos <strong>NO se marcan como procesados</strong></li>
                      </>
                    )}
                    <li>💱 Tipo de cambio: C${exchangeRate.toFixed(2)} = $1</li>
                    <li>✅ Todos los cálculos son sobre <strong>GANANCIAS NETAS</strong></li>
                  </ul>
                </div>
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

      {/* Modal para crear cierre diario */}
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
                      <span className="preview-value">{dailySummary.procedures?.length || 0}</span>
                    </div>
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
                    <div className="preview-item total">
                      <span>Utilidad neta clínica:</span>
                      <span 
                        className="preview-value"
                        style={{ color: getProfitColor(dailySummary.net_profit || 0) }}
                      >
                        {formatCurrency(dailySummary.net_profit, 'NIO', true)}
                      </span>
                    </div>
                    {dailySummary.closing_exists && (
                      <div className="preview-warning">
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <span>Ya existe un cierre para esta fecha y tipo</span>
                      </div>
                    )}
                    {dailySummary.procedures?.length === 0 && (
                      <div className="preview-warning">
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <span>No se encontraron procedimientos para esta fecha y tipo</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="form-note">
                <FontAwesomeIcon icon={faInfoCircle} />
                <div>
                  <strong>INFORMACIÓN IMPORTANTE:</strong> 
                  <ul>
                    <li>✅ Calcula sobre <strong>ganancias netas</strong> (no sobre pagos de pacientes)</li>
                    <li>✅ Usa <strong>clinic_payment_cordobas/dollars</strong> para ganancia clínica</li>
                    <li>✅ Usa <strong>doctor_payment_cordobas/dollars</strong> para ganancia doctora</li>
                    <li>✅ Incluye automáticamente <strong>pagos a doctores externos</strong> si existen</li>
                    <li>❌ <strong>NO incluye gastos</strong> en cierres diarios</li>
                    <li>💱 Tipo de cambio: C${exchangeRate.toFixed(2)} = $1</li>
                    <li>⚠️ No se pueden crear dos cierres para la misma fecha y tipo</li>
                    <li>⚠️ Puede crear cierres diarios incluso si no hay procedimientos</li>
                  </ul>
                </div>
              </div>

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

      {/* Modal de detalles de doctores externos */}
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
                      {formatCurrency(externalDoctorDetails.total_payments_cordobas, 'NIO', true)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Cantidad de pagos:</span>
                    <span className="detail-value">{externalDoctorDetails.count}</span>
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
                          <th>Procedimiento</th>
                          <th>Doctor</th>
                          <th>Tipo de Pago</th>
                          <th>Valor Original</th>
                          <th>Valor en Córdobas</th>
                          <th>Valor en Dólares</th>
                        </tr>
                      </thead>
                      <tbody>
                        {externalDoctorDetails.payments.map((payment, index) => (
                          <tr key={index}>
                            <td>
                              <div className="procedure-info">
                                <div className="procedure-id">#{payment.procedure_id}</div>
                                <div className="procedure-desc">{payment.description}</div>
                              </div>
                            </td>
                            <td>
                              <div className="doctor-info">
                                <FontAwesomeIcon icon={faUserDoctor} />
                                <span>{payment.doctor_name || 'Sin nombre'}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`payment-type ${payment.payment_type}`}>
                                {payment.payment_type === 'fixed' ? 'Monto Fijo' : 'Porcentaje'}
                              </span>
                              <div className="payment-currency">{payment.currency}</div>
                            </td>
                            <td>
                              <div className="original-payment">
                                {payment.currency === 'C$' ? 'C$' : '$'}
                                {payment.payment_value?.toFixed(2) || '0.00'}
                              </div>
                            </td>
                            <td>
                              <div className="payment-amount">
                                C${payment.payment_cordobas?.toFixed(2) || '0.00'}
                              </div>
                            </td>
                            <td>
                              <div className="payment-amount">
                                ${payment.payment_usd?.toFixed(2) || '0.00'}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="4" className="total-label">
                            <strong>Total General:</strong>
                          </td>
                          <td className="total-amount">
                            <strong>C${externalDoctorDetails.total_payments_cordobas?.toFixed(2) || '0.00'}</strong>
                          </td>
                          <td className="total-amount">
                            <strong>${externalDoctorDetails.total_payments_usd?.toFixed(2) || '0.00'}</strong>
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

              <div className="detail-section">
                <h4>Notas Importantes</h4>
                <div className="notes-container">
                  <div className="note-item important">
                    <FontAwesomeIcon icon={faInfoCircle} />
                    <div>
                      <strong>IMPORTANTE:</strong> Estos pagos ya han sido deducidos de las ganancias 
                      mostradas en el cierre. Representan pagos realizados a doctores externos que 
                      colaboraron en los procedimientos durante este período.
                    </div>
                  </div>
                  <div className="note-item">
                    <FontAwesomeIcon icon={faCalculator} />
                    <div>
                      <strong>Cálculo:</strong> Los montos se calculan automáticamente desde los 
                      procedimientos usando el campo <code>external_doctor_payment</code> y se 
                      convierten a ambas monedas usando el tipo de cambio del sistema.
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  className="secondary-btn"
                  onClick={() => setShowExternalDoctorsModal(false)}
                >
                  Cerrar
                </button>
                <button 
                  className="primary-btn"
                  onClick={() => {
                    // Exportar a Excel
                    const blob = new Blob([
                      `Detalles de Pagos a Doctores Externos\n` +
                      `Cierre: ${externalDoctorDetails.closingInfo.display_date}\n` +
                      `Fecha: ${new Date().toLocaleDateString()}\n\n` +
                      `Procedimiento,Doctor,Tipo Pago,Moneda Original,Valor Original,Córdobas,Dólares\n` +
                      externalDoctorDetails.payments.map(p => 
                        `"${p.description}","${p.doctor_name}","${p.payment_type}","${p.currency}","${p.payment_value}","${p.payment_cordobas}","${p.payment_usd}"`
                      ).join('\n') + `\n\nTotal,,,,"C$${externalDoctorDetails.total_payments_cordobas}","$${externalDoctorDetails.total_payments_usd}"`
                    ], { type: 'text/csv' });
                    
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `doctores_externos_${externalDoctorDetails.closingInfo.display_date.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  }}
                  disabled={!externalDoctorDetails.payments || externalDoctorDetails.payments.length === 0}
                >
                  <FontAwesomeIcon icon={faDownload} />
                  Exportar a CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalles general del cierre */}
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
                  
                  {/* Nota importante */}
                  <div className="breakdown-note important">
                    <FontAwesomeIcon icon={faInfoCircle} />
                    <div>
                      <strong>NOTA:</strong> Todos los montos mostrados son <strong>ganancias netas</strong> 
                      calculadas directamente desde la base de datos usando los campos correctos:
                      <ul>
                        <li><code>clinic_payment_cordobas/dollars</code> para ganancia clínica</li>
                        <li><code>doctor_payment_cordobas/dollars</code> para ganancia doctora</li>
                        <li><code>external_doctor_payment</code> para pagos externos</li>
                        <li><strong>NO</strong> se usa <code>total_procedure</code> (pagos de pacientes)</li>
                      </ul>
                    </div>
                  </div>
                  
                  {selectedClosing.type === 'monthly' ? (
                    // Resumen mensual
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

                          {/* AGREGADO: Sección de doctores externos */}
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
                          
                          {/* AGREGADO: Doctores externos para general */}
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
                          
                          {/* AGREGADO: Doctores externos para ortodoncia */}
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
                    // Resumen diario
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
                      </div>

                      {/* AGREGADO: Doctores externos para cierres diarios */}
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
                    
                    {/* AGREGADO: Mostrar deducción de doctores externos */}
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
    </div>
  );
};

export default MonthlyClosingsPage;