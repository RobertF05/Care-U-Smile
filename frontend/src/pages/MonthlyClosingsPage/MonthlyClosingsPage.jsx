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
  faCalendarCheck
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
    getIncomeStats,
    createMonthlyClosing,
    createDailyClosing,
    getDailySummary,
    checkDailyClosingExists,
    apiFetch
  } = useContext(AppContext);

  // Estados
  const [showFilters, setShowFilters] = useState(true);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [closingTypeFilter, setClosingTypeFilter] = useState('all'); // 'all', 'monthly', 'daily'
  const [closingSubTypeFilter, setClosingSubTypeFilter] = useState('all'); // 'all', 'general', 'orthodontics'
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateDailyModal, setShowCreateDailyModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [expandedClosings, setExpandedClosings] = useState({});
  const [selectedClosing, setSelectedClosing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [creatingDaily, setCreatingDaily] = useState(false);
  const [dailySummary, setDailySummary] = useState(null);
  
  // Formulario para crear cierre mensual
  const [newClosing, setNewClosing] = useState({
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    startDate: '',
    endDate: '',
    comentary: ''
  });

  // Formulario para crear cierre diario
  const [newDailyClosing, setNewDailyClosing] = useState({
    date: new Date().toISOString().split('T')[0],
    closing_type: 'general',
    comentary: ''
  });

  // Generar años para filtro (últimos 5 años)
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    if (user) {
      fetchMonthlyClosings();
      fetchDailyClosings();
    }
  }, [user]);

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

  // Formateadores
  const formatCurrency = (amount) => {
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

  // Combinar y filtrar todos los cierres
  const allClosings = useMemo(() => {
    const monthly = monthlyClosings.map(closing => ({
      ...closing,
      id: closing.closing_ID || closing.id,
      closing_id: closing.closing_ID,
      type: 'monthly',
      sub_type: 'monthly',
      display_date: `${closing.month} ${closing.year}`,
      date_sort: `${closing.year}-${getMonthNumber(closing.month).padStart(2, '0')}-01`,
      total_clinic_income: (closing.total_general_income || 0) + (closing.total_clinical_orthodontic_income || 0),
      total_expenses: (closing.total_fixed_expenses || 0) + (closing.total_variable_expenses || 0)
    }));

    const daily = dailyClosings.map(closing => ({
      ...closing,
      id: closing.daily_closing_id || closing.id,
      closing_id: closing.daily_closing_id,
      type: 'daily',
      sub_type: closing.closing_type,
      display_date: formatDate(closing.closing_date),
      date_sort: closing.closing_date,
      total_clinic_income: closing.total_clinic_income || 0,
      total_expenses: 0, // Los gastos se manejan diferente en diarios
      net_profit: closing.net_profit || 0
    }));

    return [...monthly, ...daily];
  }, [monthlyClosings, dailyClosings]);

  // Filtrar cierres combinados
  const filteredClosings = useMemo(() => {
    let filtered = [...allClosings];

    // Filtrar por tipo de cierre
    if (closingTypeFilter !== 'all') {
      filtered = filtered.filter(closing => closing.type === closingTypeFilter);
    }

    // Filtrar por subtipo (solo para diarios)
    if (closingSubTypeFilter !== 'all' && closingTypeFilter === 'daily') {
      filtered = filtered.filter(closing => closing.sub_type === closingSubTypeFilter);
    }

    // Filtrar por año (solo para mensuales)
    if (yearFilter !== 'all') {
      filtered = filtered.filter(closing => {
        if (closing.type === 'monthly') {
          return closing.year.toString() === yearFilter;
        }
        // Para diarios, verificar si el año coincide
        if (closing.type === 'daily') {
          const closingYear = new Date(closing.closing_date).getFullYear().toString();
          return closingYear === yearFilter;
        }
        return true;
      });
    }

    // Filtrar por búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(closing => 
        closing.display_date.toLowerCase().includes(term) ||
        (closing.month && closing.month.toLowerCase().includes(term)) ||
        (closing.year && closing.year.toString().includes(term)) ||
        (closing.closing_date && closing.closing_date.toLowerCase().includes(term)) ||
        (closing.comentary && closing.comentary.toLowerCase().includes(term)) ||
        (closing.closing_type && closing.closing_type.toLowerCase().includes(term))
      );
    }

    // Ordenar por fecha descendente
    return filtered.sort((a, b) => {
      if (b.date_sort < a.date_sort) return -1;
      if (b.date_sort > a.date_sort) return 1;
      return 0;
    });
  }, [allClosings, closingTypeFilter, closingSubTypeFilter, yearFilter, searchTerm]);

  // Estadísticas generales
  const stats = useMemo(() => {
    const monthly = allClosings.filter(c => c.type === 'monthly');
    const daily = allClosings.filter(c => c.type === 'daily');
    const dailyOrthodontics = daily.filter(c => c.sub_type === 'orthodontics');
    const dailyGeneral = daily.filter(c => c.sub_type === 'general');

    const totalMonthlyIncome = monthly.reduce((sum, closing) => 
      sum + (closing.total_clinic_income || 0), 0
    );
    
    const totalMonthlyExpenses = monthly.reduce((sum, closing) => 
      sum + (closing.total_expenses || 0), 0
    );
    
    const totalMonthlyProfit = monthly.reduce((sum, closing) => 
      sum + (closing.net_profit || 0), 0
    );

    const totalDailyIncome = daily.reduce((sum, closing) => 
      sum + (closing.total_clinic_income || 0), 0
    );
    
    const totalDailyProfit = daily.reduce((sum, closing) => 
      sum + (closing.net_profit || 0), 0
    );

    return {
      total: allClosings.length,
      monthlyCount: monthly.length,
      dailyCount: daily.length,
      dailyOrthodonticsCount: dailyOrthodontics.length,
      dailyGeneralCount: dailyGeneral.length,
      totalMonthlyIncome,
      totalMonthlyExpenses,
      totalMonthlyProfit,
      totalDailyIncome,
      totalDailyProfit,
      bestMonth: monthly.length > 0 ? 
        monthly.reduce((best, current) => 
          (current.net_profit > best.net_profit) ? current : best
        ) : null,
      worstMonth: monthly.length > 0 ? 
        monthly.reduce((worst, current) => 
          (current.net_profit < worst.net_profit) ? current : worst
        ) : null
    };
  }, [allClosings]);

  // Funciones para expandir/contraer
  const toggleExpandClosing = (closingId) => {
    setExpandedClosings(prev => ({
      ...prev,
      [closingId]: !prev[closingId]
    }));
  };

  // Crear cierre mensual
  // Crear cierre mensual - VERSIÓN CON LOGS MEJORADOS
const handleCreateClosing = async (e) => {
  e.preventDefault();
  setCreating(true);
  
  try {
    // Validar que no exista ya un cierre para ese mes/año
    const exists = monthlyClosings.some(
      closing => closing.month === newClosing.month && 
                 closing.year.toString() === newClosing.year
    );
    
    if (exists) {
      alert(`⚠️ Ya existe un cierre para ${newClosing.month} ${newClosing.year}`);
      setCreating(false);
      return;
    }

    // Calcular fechas del período
    const startDate = newClosing.startDate || `${newClosing.year}-${getMonthNumber(newClosing.month)}-01`;
    const endDate = newClosing.endDate || getLastDayOfMonth(newClosing.year, newClosing.month);
    
    console.log('📅 Período a calcular:', { startDate, endDate });
    
    // Obtener resumen financiero desde el backend
    console.log('🔍 Llamando a getIncomeStats...');
    const summaryResponse = await getIncomeStats(startDate, endDate);
    
    console.log('📊 Respuesta completa de getIncomeStats:', summaryResponse);
    console.log('📈 Datos del summary:', summaryResponse.data);
    
    if (!summaryResponse.success) {
      console.error('❌ Error en getIncomeStats:', summaryResponse.error);
      throw new Error('Error al obtener el resumen financiero: ' + summaryResponse.error);
    }

    const summary = summaryResponse.data;
    
    // Mostrar estructura completa para debug
    console.log('🔍 Estructura completa del summary:');
    Object.keys(summary).forEach(key => {
      console.log(`  ${key}:`, summary[key]);
    });
    
    // Usar valores por defecto si no existen
    const totalGeneralIncome = summary.general_income || summary.total_general_income || 0;
    const totalClinicOrthodonticIncome = summary.clinic_orthodontic_income || summary.total_clinical_orthodontic_income || 0;
    const totalDoctorOrthodonticIncome = summary.doctor_orthodontic_income || summary.total_orthodontic_doctor_income || 0;
    const totalFixedExpenses = summary.fixed_expenses || summary.total_fixed_expenses || 0;
    const totalVariableExpenses = summary.variable_expenses || summary.total_variable_expenses || 0;
    
    console.log('🧮 Valores calculados:', {
      totalGeneralIncome,
      totalClinicOrthodonticIncome,
      totalDoctorOrthodonticIncome,
      totalFixedExpenses,
      totalVariableExpenses
    });
    
    // Calcular valores correctamente
    const totalClinicIncome = totalGeneralIncome + totalClinicOrthodonticIncome;
    const totalExpenses = totalFixedExpenses + totalVariableExpenses;
    const netProfit = totalClinicIncome - totalExpenses - totalDoctorOrthodonticIncome;
    
    console.log('💰 Resultados finales:', {
      totalClinicIncome,
      totalExpenses,
      netProfit
    });
    
    // Crear cierre
    const closingData = {
      month: newClosing.month,
      year: parseInt(newClosing.year),
      total_general_income: totalGeneralIncome,
      total_clinical_orthodontic_income: totalClinicOrthodonticIncome,
      total_orthodontic_doctor_income: totalDoctorOrthodonticIncome,
      total_fixed_expenses: totalFixedExpenses,
      total_variable_expenses: totalVariableExpenses,
      net_profit: netProfit,
      comentary: newClosing.comentary || ''
    };
    
    console.log('📤 Datos para crear cierre mensual:', closingData);

    const response = await createMonthlyClosing(closingData);
    
    if (response.success) {
      alert(`✅ Cierre de ${newClosing.month} ${newClosing.year} creado exitosamente\n\n` +
            `Ingresos Generales: ${formatCurrency(closingData.total_general_income)}\n` +
            `Ortodoncia Clínica (40%): ${formatCurrency(closingData.total_clinical_orthodontic_income)}\n` +
            `Pago Doctora Ortodoncia (60%): ${formatCurrency(closingData.total_orthodontic_doctor_income)}\n` +
            `Gastos Fijos: ${formatCurrency(closingData.total_fixed_expenses)}\n` +
            `Gastos Variables: ${formatCurrency(closingData.total_variable_expenses)}\n` +
            `Utilidad Neta: ${formatCurrency(closingData.net_profit)}`);
      
      setShowCreateModal(false);
      setNewClosing({
        month: MONTHS[new Date().getMonth()],
        year: new Date().getFullYear().toString(),
        startDate: '',
        endDate: '',
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
        
        // Verificar si ya existe cierre
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

      // Crear cierre diario
      const closingData = {
        date: newDailyClosing.date,
        closing_type: newDailyClosing.closing_type,
        comentary: newDailyClosing.comentary
      };

      const response = await createDailyClosing(closingData);
      
      if (response.success) {
        const typeLabel = newDailyClosing.closing_type === 'orthodontics' ? 'de Ortodoncia' : 'General';
        alert(`✅ Cierre Diario ${typeLabel} creado exitosamente\n\n` +
              `Fecha: ${formatDate(newDailyClosing.date)}\n` +
              `Procedimientos incluidos: ${response.data.procedure_count || 0}\n` +
              `Gastos incluidos: ${response.data.bill_count || 0}\n` +
              `Ingresos Clínica: ${formatCurrency(response.data.total_clinic_income || 0)}\n` +
              `Utilidad Neta: ${formatCurrency(response.data.net_profit || 0)}`);
        
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

  // Exportar a PDF
  const handleExportPDF = (closing) => {
    alert(`📄 Exportando cierre de ${closing.display_date} a PDF...`);
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
    if (type === 'monthly') return faCalendarAlt;
    if (subType === 'orthodontics') return faTooth;
    return faHospital;
  };

  // Obtener color según tipo de cierre
  const getClosingTypeColor = (type, subType) => {
    if (type === 'monthly') return '#2196F3';
    if (subType === 'orthodontics') return '#9C27B0';
    return '#4CAF50';
  };

  // Obtener texto del tipo de cierre
  const getClosingTypeText = (type, subType) => {
    if (type === 'monthly') return 'Mensual';
    if (subType === 'orthodontics') return 'Ortodoncia Diario';
    return 'General Diario';
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
            Gestión de cierres mensuales y diarios de la clínica
          </p>
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
              {/* Filtro por tipo de cierre */}
              <div className="filter-group">
                <label className="filter-label">Tipo de cierre:</label>
                <select
                  value={closingTypeFilter}
                  onChange={(e) => setClosingTypeFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="all">Todos los tipos</option>
                  <option value="monthly">Cierres Mensuales</option>
                  <option value="daily">Cierres Diarios</option>
                </select>
              </div>

              {/* Filtro por subtipo (solo para diarios) */}
              {closingTypeFilter === 'daily' && (
                <div className="filter-group">
                  <label className="filter-label">Subtipo:</label>
                  <select
                    value={closingSubTypeFilter}
                    onChange={(e) => setClosingSubTypeFilter(e.target.value)}
                    className="form-select"
                  >
                    <option value="all">Todos</option>
                    <option value="general">General</option>
                    <option value="orthodontics">Ortodoncia</option>
                  </select>
                </div>
              )}

              {/* Filtro por año */}
              <div className="filter-group">
                <label className="filter-label">Año:</label>
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

            {/* Búsqueda */}
            <div className="filter-row">
              <div className="filter-group full-width">
                <label className="filter-label">
                  <FontAwesomeIcon icon={faSearch} /> Buscar:
                </label>
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Buscar por fecha, mes, año o comentario..."
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
        </div>
      )}

      {/* Estadísticas */}
      <div className="quick-stats">
        <div className="stat-card total">
          <div className="stat-icon">
            <FontAwesomeIcon icon={faFileInvoice} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Cierres Totales</div>
          </div>
        </div>
        
        <div className="stat-card monthly">
          <div className="stat-icon">
            <FontAwesomeIcon icon={faCalendarAlt} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.monthlyCount}</div>
            <div className="stat-label">Cierres Mensuales</div>
          </div>
        </div>
        
        <div className="stat-card daily">
          <div className="stat-icon">
            <FontAwesomeIcon icon={faCalendarDay} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.dailyCount}</div>
            <div className="stat-label">Cierres Diarios</div>
            <div className="stat-subtext">
              {stats.dailyGeneralCount} General / {stats.dailyOrthodonticsCount} Ortodoncia
            </div>
          </div>
        </div>
      </div>

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
                    {closing.type === 'monthly' ? (
                      <div className="closing-date">
                        <FontAwesomeIcon icon={faCalendarAlt} />
                        <span>Período: {closing.month} {closing.year}</span>
                      </div>
                    ) : (
                      <div className="closing-date">
                        <FontAwesomeIcon icon={faCalendarDay} />
                        <span>Fecha: {formatDate(closing.closing_date)}</span>
                        {closing.sub_type === 'orthodontics' && (
                          <span className="ortho-tag">
                            <FontAwesomeIcon icon={faTooth} />
                            Ortodoncia
                          </span>
                        )}
                      </div>
                    )}
                    
                    {closing.comentary && (
                      <div className="closing-comment">
                        <FontAwesomeIcon icon={faInfoCircle} />
                        <span>{closing.comentary}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="closing-right">
                  <div className="closing-profit">
                    <span 
                      className="profit-value"
                      style={{ color: getProfitColor(closing.net_profit) }}
                    >
                      {formatCurrency(closing.net_profit)}
                    </span>
                    <span className="profit-label">Utilidad Neta</span>
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
                      title="Ver detalles"
                    >
                      <FontAwesomeIcon icon={faEye} />
                    </button>
                    <button 
                      className="action-btn print"
                      onClick={() => handleExportPDF(closing)}
                      title="Exportar a PDF"
                    >
                      <FontAwesomeIcon icon={faPrint} />
                    </button>
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
                    <h5>Resumen Financiero</h5>
                    
                    {closing.type === 'monthly' ? (
                      <div className="summary-grid">
                        <div className="summary-item income">
                          <span className="summary-label">Ingresos Generales:</span>
                          <span className="summary-value">{formatCurrency(closing.total_general_income)}</span>
                        </div>
                        <div className="summary-item income-ortho">
                          <span className="summary-label">Ortodoncia (Clínica 40%):</span>
                          <span className="summary-value">{formatCurrency(closing.total_clinical_orthodontic_income)}</span>
                        </div>
                        <div className="summary-item expense-fixed">
                          <span className="summary-label">Gastos Fijos:</span>
                          <span className="summary-value">{formatCurrency(closing.total_fixed_expenses)}</span>
                        </div>
                        <div className="summary-item expense-variable">
                          <span className="summary-label">Gastos Variables:</span>
                          <span className="summary-value">{formatCurrency(closing.total_variable_expenses)}</span>
                        </div>
                        <div className="summary-item doctor-payment highlight">
                          <span className="summary-label">
                            <FontAwesomeIcon icon={faUserMd} /> Pago Doctora (60%):
                          </span>
                          <span className="summary-value">{formatCurrency(closing.total_orthodontic_doctor_income)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="summary-grid">
                        <div className="summary-item income">
                          <span className="summary-label">Ingresos Totales:</span>
                          <span className="summary-value">{formatCurrency(closing.total_income)}</span>
                        </div>
                        <div className="summary-item clinic-income">
                          <span className="summary-label">
                            {closing.sub_type === 'orthodontics' ? 'Clínica (40%)' : 'Ingresos Clínica'}:
                          </span>
                          <span className="summary-value">{formatCurrency(closing.total_clinic_income)}</span>
                        </div>
                        {closing.sub_type === 'orthodontics' && (
                          <div className="summary-item doctor-income">
                            <span className="summary-label">
                              <FontAwesomeIcon icon={faUserMd} /> Doctora (60%):
                            </span>
                            <span className="summary-value">{formatCurrency(closing.total_doctor_income)}</span>
                          </div>
                        )}
                        {closing.total_external_doctor_payments > 0 && (
                          <div className="summary-item external-doctor">
                            <span className="summary-label">Pagos Doctores Externos:</span>
                            <span className="summary-value">{formatCurrency(closing.total_external_doctor_payments)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="net-profit-summary">
                      <div className="net-profit-item">
                        <span className="net-profit-label">
                          {closing.type === 'monthly' ? 'Ingresos Clínica:' : 'Ingresos Netos:'}
                        </span>
                        <span className="net-profit-value">
                          {formatCurrency(closing.total_clinic_income)}
                        </span>
                      </div>
                      {closing.type === 'monthly' && (
                        <div className="net-profit-item">
                          <span className="net-profit-label">Gastos Totales:</span>
                          <span className="net-profit-value">
                            {formatCurrency(closing.total_expenses)}
                          </span>
                        </div>
                      )}
                      <div className="net-profit-final">
                        <span className="net-profit-label">Utilidad Neta:</span>
                        <span 
                          className="net-profit-value"
                          style={{ color: getProfitColor(closing.net_profit) }}
                        >
                          {formatCurrency(closing.net_profit)}
                        </span>
                      </div>
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
                  <strong>IMPORTANTE:</strong> El sistema calculará automáticamente:
                  <ul>
                    <li>✅ Todos los procedimientos del período</li>
                    <li>✅ Gastos fijos (se incluyen automáticamente)</li>
                    <li>✅ Gastos variables del período</li>
                    <li>✅ <strong>Pago a doctora ortodoncia (60%) como gasto</strong></li>
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
                      Calcular y Crear Cierre
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

              {/* Vista previa del resumen */}
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
                      <span>Ingresos Totales:</span>
                      <span className="preview-value">{formatCurrency(dailySummary.total_income || 0)}</span>
                    </div>
                    {newDailyClosing.closing_type === 'orthodontics' ? (
                      <>
                        <div className="preview-item">
                          <span>Clínica (40%):</span>
                          <span className="preview-value">{formatCurrency(dailySummary.total_clinic_income || 0)}</span>
                        </div>
                        <div className="preview-item">
                          <span>Doctora (60%):</span>
                          <span className="preview-value">{formatCurrency(dailySummary.total_doctor_income || 0)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="preview-item">
                        <span>Ingresos Clínica:</span>
                        <span className="preview-value">{formatCurrency(dailySummary.total_clinic_income || 0)}</span>
                      </div>
                    )}
                    <div className="preview-item">
                      <span>Gastos por incluir:</span>
                      <span className="preview-value">{formatCurrency(dailySummary.total_expenses || 0)}</span>
                    </div>
                    <div className="preview-item total">
                      <span>Utilidad Neta estimada:</span>
                      <span 
                        className="preview-value"
                        style={{ color: getProfitColor(dailySummary.net_profit || 0) }}
                      >
                        {formatCurrency(dailySummary.net_profit || 0)}
                      </span>
                    </div>
                    {dailySummary.closing_exists && (
                      <div className="preview-warning">
                        <FontAwesomeIcon icon={faTimesCircle} />
                        <span>Ya existe un cierre para esta fecha y tipo</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="form-note">
                <FontAwesomeIcon icon={faInfoCircle} />
                <div>
                  <strong>NOTA:</strong> 
                  <ul>
                    <li>Los cierres diarios de ortodoncia separan automáticamente el 40% para la clínica y 60% para la doctora</li>
                    <li>Los gastos variables del día se marcarán como procesados</li>
                    <li>No se pueden crear dos cierres para la misma fecha y tipo</li>
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

      {/* Modal de detalles */}
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
                    <span className="detail-label">Fecha/Período:</span>
                    <span className="detail-value">{selectedClosing.display_date}</span>
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
                      <span className="detail-label">Fecha exacta:</span>
                      <span className="detail-value">{formatDate(selectedClosing.closing_date)}</span>
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
                <h4>Resumen Financiero</h4>
                <div className="financial-breakdown">
                  
                  {selectedClosing.type === 'monthly' ? (
                    // Resumen mensual
                    <>
                      <div className="breakdown-section income">
                        <h5>Ingresos de la Clínica</h5>
                        <div className="breakdown-item">
                          <span>Procedimientos Generales (100% clínica):</span>
                          <span className="amount">{formatCurrency(selectedClosing.total_general_income)}</span>
                        </div>
                        <div className="breakdown-item">
                          <span>Ortodoncia (40% clínica):</span>
                          <span className="amount">{formatCurrency(selectedClosing.total_clinical_orthodontic_income)}</span>
                        </div>
                        <div className="breakdown-total">
                          <span>Total Ingresos Clínica:</span>
                          <span className="total-amount">
                            {formatCurrency(selectedClosing.total_clinic_income)}
                          </span>
                        </div>
                      </div>

                      <div className="breakdown-section expenses">
                        <h5>Gastos (Incluye honorarios doctora)</h5>
                        <div className="breakdown-item">
                          <span>Gastos Fijos:</span>
                          <span className="amount">{formatCurrency(selectedClosing.total_fixed_expenses)}</span>
                        </div>
                        <div className="breakdown-item highlight">
                          <span>
                            <FontAwesomeIcon icon={faUserMd} /> Gastos Variables (incl. doctora):
                          </span>
                          <span className="amount doctor-payment">
                            {formatCurrency(selectedClosing.total_variable_expenses)}
                          </span>
                          <small className="doctor-note">Incluye pago a doctora ortodoncia</small>
                        </div>
                        <div className="breakdown-total">
                          <span>Total Gastos:</span>
                          <span className="total-amount">
                            {formatCurrency(selectedClosing.total_expenses)}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    // Resumen diario
                    <>
                      <div className="breakdown-section income">
                        <h5>Ingresos</h5>
                        <div className="breakdown-item">
                          <span>Ingresos Totales:</span>
                          <span className="amount">{formatCurrency(selectedClosing.total_income)}</span>
                        </div>
                        {selectedClosing.sub_type === 'orthodontics' ? (
                          <>
                            <div className="breakdown-item">
                              <span>Clínica (40%):</span>
                              <span className="amount">{formatCurrency(selectedClosing.total_clinic_income)}</span>
                            </div>
                            <div className="breakdown-item">
                              <span>
                                <FontAwesomeIcon icon={faUserMd} /> Doctora (60%):
                              </span>
                              <span className="amount">{formatCurrency(selectedClosing.total_doctor_income)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="breakdown-item">
                            <span>Ingresos Clínica:</span>
                            <span className="amount">{formatCurrency(selectedClosing.total_clinic_income)}</span>
                          </div>
                        )}
                      </div>

                      {selectedClosing.total_external_doctor_payments > 0 && (
                        <div className="breakdown-section external">
                          <h5>Pagos a Doctores Externos</h5>
                          <div className="breakdown-item">
                            <span>Total pagos externos:</span>
                            <span className="amount">{formatCurrency(selectedClosing.total_external_doctor_payments)}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* RESUMEN FINAL */}
                  <div className="breakdown-section summary">
                    <h5>Resumen Final</h5>
                    <div className="breakdown-item">
                      <span>Ingresos Netos Clínica:</span>
                      <span className="amount">
                        {formatCurrency(selectedClosing.total_clinic_income)}
                      </span>
                    </div>
                    {selectedClosing.type === 'monthly' && (
                      <div className="breakdown-item">
                        <span>Gastos Totales:</span>
                        <span className="amount">
                          {formatCurrency(selectedClosing.total_expenses)}
                        </span>
                      </div>
                    )}
                    <div className="breakdown-final">
                      <span>Utilidad Neta Clínica:</span>
                      <span 
                        className="final-amount"
                        style={{ color: getProfitColor(selectedClosing.net_profit) }}
                      >
                        {formatCurrency(selectedClosing.net_profit)}
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

              {/* Acciones */}
              <div className="detail-actions">
                <button 
                  className="secondary-btn"
                  onClick={() => handleExportPDF(selectedClosing)}
                >
                  <FontAwesomeIcon icon={faPrint} />
                  Exportar a PDF
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