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
  faListAlt
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
  const [closingTypeFilter, setClosingTypeFilter] = useState('all');
  const [closingSubTypeFilter, setClosingSubTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateDailyModal, setShowCreateDailyModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [expandedClosings, setExpandedClosings] = useState({});
  const [selectedClosing, setSelectedClosing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [creatingDaily, setCreatingDaily] = useState(false);
  const [dailySummary, setDailySummary] = useState(null);
  const [deleteVariableExpenses, setDeleteVariableExpenses] = useState(true);
  
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

  // Generar años para filtro
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  }, []);

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

  // Funciones para expandir/contraer - AGREGADA
  const toggleExpandClosing = (closingId) => {
    setExpandedClosings(prev => ({
      ...prev,
      [closingId]: !prev[closingId]
    }));
  };

  // Combinar y filtrar todos los cierres
  const allClosings = useMemo(() => {
    const monthly = monthlyClosings.map(closing => ({
      ...closing,
      id: closing.closing_ID || closing.id,
      closing_id: closing.closing_ID,
      type: 'monthly',
      sub_type: 'monthly',
      display_date: `Cierre de ${closing.month} ${closing.year}`,
      date_exact: closing.closing_date_display || formatDate(closing.closing_date),
      date_sort: `${closing.year}-${getMonthNumber(closing.month).padStart(2, '0')}-01`,
      total_clinic_income: (closing.total_general_income || 0) + (closing.total_clinical_orthodontic_income || 0),
      // CAMBIO: No incluir pago doctora en gastos mensuales
      total_expenses: (closing.total_fixed_expenses || 0) + (closing.total_variable_expenses || 0)
    }));

    const daily = dailyClosings.map(closing => ({
      ...closing,
      id: closing.daily_closing_id || closing.id,
      closing_id: closing.daily_closing_id,
      type: 'daily',
      sub_type: closing.closing_type,
      display_date: `Cierre Diario - ${closing.closing_date_formatted || formatDate(closing.closing_date)}`,
      date_exact: closing.closing_date_formatted || formatDate(closing.closing_date),
      date_sort: closing.closing_date,
      total_clinic_income: closing.total_clinic_income || 0,
      total_expenses: 0,
      net_profit: closing.net_profit || 0
    }));

    return [...monthly, ...daily];
  }, [monthlyClosings, dailyClosings]);

  // Filtrar cierres combinados
  const filteredClosings = useMemo(() => {
    let filtered = [...allClosings];

    if (closingTypeFilter !== 'all') {
      filtered = filtered.filter(closing => closing.type === closingTypeFilter);
    }

    if (closingSubTypeFilter !== 'all' && closingTypeFilter === 'daily') {
      filtered = filtered.filter(closing => closing.sub_type === closingSubTypeFilter);
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
        (closing.closing_type && closing.closing_type.toLowerCase().includes(term))
      );
    }

    return filtered.sort((a, b) => {
      if (b.date_sort < a.date_sort) return -1;
      if (b.date_sort > a.date_sort) return 1;
      return 0;
    });
  }, [allClosings, closingTypeFilter, closingSubTypeFilter, yearFilter, searchTerm]);

  // Crear cierre mensual
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
      
      // Usar valores por defecto si no existen
      const totalGeneralIncome = summary.general_income || summary.total_general_income || 0;
      const totalClinicOrthodonticIncome = summary.clinic_orthodontic_income || summary.total_clinical_orthodontic_income || 0;
      const totalFixedExpenses = summary.fixed_expenses || summary.total_fixed_expenses || 0;
      const totalVariableExpenses = summary.variable_expenses || summary.total_variable_expenses || 0;
      
      console.log('🧮 Valores calculados:', {
        totalGeneralIncome,
        totalClinicOrthodonticIncome,
        totalFixedExpenses,
        totalVariableExpenses
      });
      
      // CAMBIO: No incluir pago doctora ortodoncia en cálculo mensual
      const totalClinicIncome = totalGeneralIncome + totalClinicOrthodonticIncome;
      const totalExpenses = totalFixedExpenses + totalVariableExpenses;
      const netProfit = totalClinicIncome - totalExpenses; // Eliminado el pago doctora
      
      console.log('💰 Resultados finales:', {
        totalClinicIncome,
        totalExpenses,
        netProfit
      });
      
      // Crear cierre con opción de eliminar gastos variables
      const closingData = {
        month: newClosing.month,
        year: parseInt(newClosing.year),
        total_general_income: totalGeneralIncome,
        total_clinical_orthodontic_income: totalClinicOrthodonticIncome,
        // CAMBIO: No incluir pago doctora en datos de cierre mensual
        total_orthodontic_doctor_income: 0, // Se establece en 0
        total_fixed_expenses: totalFixedExpenses,
        total_variable_expenses: totalVariableExpenses,
        net_profit: netProfit,
        comentary: newClosing.comentary || '',
        deleteVariableExpenses: deleteVariableExpenses
      };
      
      console.log('📤 Datos para crear cierre mensual:', closingData);

      const response = await apiFetch('/monthly-closings', {
        method: 'POST',
        body: JSON.stringify(closingData),
      });
      
      if (response.success) {
        const deleteMessage = deleteVariableExpenses ? 
          '\n✅ Gastos variables eliminados automáticamente' : 
          '\n⚠️ Gastos variables conservados en el sistema';
        
        alert(`✅ Cierre de ${newClosing.month} ${newClosing.year} creado exitosamente${deleteMessage}\n\n` +
              `Ingresos Generales: ${formatCurrency(closingData.total_general_income)}\n` +
              `Ortodoncia Clínica (40%): ${formatCurrency(closingData.total_clinical_orthodontic_income)}\n` +
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
        endpoint = `/export/excel/detailed/monthly/${closing.closing_id}`;
      } else {
        endpoint = `/export/excel/detailed/daily/${closing.closing_id}`;
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
        ...(filters.endDate && { endDate: filters.endDate })
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
            Gestión de cierres mensuales y diarios de la clínica
          </p>
        </div>
        <div className="header-right">
          <div className="btn-group">
            <button 
              className="secondary-btn"
              onClick={() => handleExportExcelGeneral('monthly')}
              title="Exportar cierres mensuales a Excel (formato tabla)"
            >
              <FontAwesomeIcon icon={faFileExcel} />
              Excel Mensual
            </button>
            <button 
              className="secondary-btn"
              onClick={() => handleExportExcelGeneral('daily')}
              title="Exportar cierres diarios a Excel (formato tabla)"
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
                  <option value="all">Todos los tipos</option>
                  <option value="monthly">Cierres Mensuales</option>
                  <option value="daily">Cierres Diarios</option>
                </select>
              </div>

              {closingTypeFilter === 'daily' && (
                <div className="filter-group">
                  <label className="form-label">Subtipo:</label>
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
                    placeholder="Buscar por fecha, mes, año o comentario..."
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
                      title="Ver detalles completos"
                    >
                      <FontAwesomeIcon icon={faEye} />
                    </button>
                    <button 
                      className="action-btn print"
                      onClick={() => handleExportPDF(closing)}
                      title="Exportar a PDF (formato vertical)"
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
                    <FontAwesomeIcon 
                      icon={expandedClosings[closing.id] ? faChevronUp : faChevronDown} 
                      className="expand-icon"
                      onClick={() => toggleExpandClosing(closing.id)} // CORREGIDO
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
                        {/* NOTA: Se elimina la fila de pago doctora ortodoncia para cierres mensuales */}
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
                  
                  <div className="export-options">
                    <h6>Opciones de Exportación:</h6>
                    <div className="export-buttons">
                      <button 
                        className="secondary-btn small"
                        onClick={() => handleExportPDF(closing)}
                      >
                        <FontAwesomeIcon icon={faFilePdf} />
                        PDF (Formato Vertical)
                      </button>
                      <button 
                        className="secondary-btn small"
                        onClick={() => handleExportExcelDetailed(closing)}
                      >
                        <FontAwesomeIcon icon={faListAlt} />
                        Excel con Desglose Completo
                      </button>
                      <button 
                        className="secondary-btn small"
                        onClick={() => handleExportExcelGeneral(closing.type === 'monthly' ? 'monthly' : 'daily')}
                      >
                        <FontAwesomeIcon icon={faFileExcel} />
                        Excel (Formato Tabla)
                      </button>
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
                <label className="form-label">
                  <div className="switch-container">
                    <span>Eliminar gastos variables después del cierre:</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={deleteVariableExpenses}
                        onChange={(e) => setDeleteVariableExpenses(e.target.checked)}
                        disabled={creating}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span className="switch-label">
                      {deleteVariableExpenses ? 'Sí, eliminar automáticamente' : 'No, conservar en el sistema'}
                    </span>
                  </div>
                </label>
                <small className="form-help">
                  {deleteVariableExpenses 
                    ? '⚠️ Los gastos variables del período serán eliminados permanentemente para mantener la base de datos limpia'
                    : 'Los gastos variables se conservarán para futuras consultas'}
                </small>
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
                    <li>✅ Gastos variables del período {deleteVariableExpenses ? '(se eliminarán)' : ''}</li>
                    <li>✅ <strong>NOTA: El pago a doctora ortodoncia NO se incluye en cierres mensuales</strong></li>
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
                        <h5>Gastos</h5>
                        <div className="breakdown-item">
                          <span>Gastos Fijos:</span>
                          <span className="amount">{formatCurrency(selectedClosing.total_fixed_expenses)}</span>
                        </div>
                        <div className="breakdown-item highlight">
                          <span>
                            Gastos Variables:
                          </span>
                          <span className="amount">
                            {formatCurrency(selectedClosing.total_variable_expenses)}
                          </span>
                        </div>
                        {/* NOTA: Se elimina la sección de pago doctora ortodoncia para cierres mensuales */}
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
                  
                  <div className="export-option">
                    <div className="export-icon">
                      <FontAwesomeIcon icon={faFileExcel} />
                    </div>
                    <div className="export-info">
                      <h5>Excel (Formato Tabla)</h5>
                      <p>Tabla simple para análisis rápido o importación a otros sistemas</p>
                    </div>
                    <button 
                      className="secondary-btn small"
                      onClick={() => handleExportExcelGeneral(selectedClosing.type === 'monthly' ? 'monthly' : 'daily')}
                    >
                      Descargar Excel Simple
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