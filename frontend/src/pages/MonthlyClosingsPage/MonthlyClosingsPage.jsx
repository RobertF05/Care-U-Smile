import React, { useState, useEffect, useMemo, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarAlt,
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
  faUserMd
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
    loading, 
    fetchMonthlyClosings,
    getIncomeStats,
    apiFetch,
    createMonthlyClosing
  } = useContext(AppContext);

  // Estados
  const [showFilters, setShowFilters] = useState(true);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [expandedClosings, setExpandedClosings] = useState({});
  const [selectedClosing, setSelectedClosing] = useState(null);
  const [creating, setCreating] = useState(false);
  
  // Formulario para crear cierre
  const [newClosing, setNewClosing] = useState({
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    startDate: '',
    endDate: '',
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
    }
  }, [user]);

  // Filtrar cierres
  const filteredClosings = useMemo(() => {
    let filtered = [...monthlyClosings];

    // Filtrar por año
    if (yearFilter !== 'all') {
      filtered = filtered.filter(closing => closing.year.toString() === yearFilter);
    }

    // Filtrar por búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(closing => 
        closing.month.toLowerCase().includes(term) ||
        closing.year.toString().includes(term) ||
        (closing.comentary && closing.comentary.toLowerCase().includes(term))
      );
    }

    return filtered.sort((a, b) => {
      const yearA = parseInt(a.year);
      const yearB = parseInt(b.year);
      if (yearA !== yearB) return yearB - yearA;
      
      const monthA = MONTHS.indexOf(a.month.toUpperCase());
      const monthB = MONTHS.indexOf(b.month.toUpperCase());
      return monthB - monthA;
    });
  }, [monthlyClosings, yearFilter, searchTerm]);

  // Estadísticas generales
  const stats = useMemo(() => {
    if (monthlyClosings.length === 0) {
      return {
        total: 0,
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
        bestMonth: null,
        worstMonth: null
      };
    }

    // IMPORTANTE: El 60% de ortodoncia ya está incluido como gasto variable
    const totalIncome = monthlyClosings.reduce((sum, closing) => 
      sum + ((closing.total_general_income || 0) + (closing.total_clinical_orthodontic_income || 0)), 0
    );
    
    const totalExpenses = monthlyClosings.reduce((sum, closing) => 
      sum + ((closing.total_fixed_expenses || 0) + (closing.total_variable_expenses || 0)), 0
    );
    
    const totalProfit = monthlyClosings.reduce((sum, closing) => 
      sum + (closing.net_profit || 0), 0
    );

    // Encontrar mejor y peor mes
    let bestMonth = monthlyClosings[0];
    let worstMonth = monthlyClosings[0];
    
    monthlyClosings.forEach(closing => {
      if (closing.net_profit > bestMonth.net_profit) bestMonth = closing;
      if (closing.net_profit < worstMonth.net_profit) worstMonth = closing;
    });

    return {
      total: monthlyClosings.length,
      totalIncome,
      totalExpenses,
      totalProfit,
      bestMonth: bestMonth ? `${bestMonth.month} ${bestMonth.year}` : 'N/A',
      worstMonth: worstMonth ? `${worstMonth.month} ${worstMonth.year}` : 'N/A'
    };
  }, [monthlyClosings]);

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

  // Funciones para expandir/contraer
  const toggleExpandClosing = (closingId) => {
    setExpandedClosings(prev => ({
      ...prev,
      [closingId]: !prev[closingId]
    }));
  };

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

  // Crear cierre mensual - MODIFICADO
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
      
      // Obtener resumen financiero desde el backend
      const summaryResponse = await getIncomeStats(startDate, endDate);
      
      if (!summaryResponse.success) {
        throw new Error('Error al obtener el resumen financiero');
      }

      const summary = summaryResponse.data;
      
      console.log('📊 Resumen financiero obtenido:', summary);
      
      // IMPORTANTE: El 60% de ortodoncia ya está incluido en variable_expenses
      // No necesitamos sumarlo manualmente aquí
      
      // Crear cierre - los cálculos ya se hacen en el backend
      const closingData = {
        month: newClosing.month,
        year: parseInt(newClosing.year),
        total_general_income: summary.general_income || 0,
        total_clinical_orthodontic_income: summary.clinic_income || 0,
        total_orthodontic_doctor_income: summary.doctor_income || 0, // Esto es GASTO
        total_fixed_expenses: summary.fixed_expenses || 0,
        total_variable_expenses: (summary.variable_expenses || 0) + (summary.doctor_income || 0), // Doctora incluida
        net_profit: summary.net_profit || 0,
        comentary: newClosing.comentary || ''
      };

      console.log('📤 Enviando datos de cierre:', closingData);
      
      const response = await createMonthlyClosing(closingData);
      
      if (response.success) {
        alert(`✅ Cierre de ${newClosing.month} ${newClosing.year} creado exitosamente\n\n` +
              `Ingresos Clínica: ${formatCurrency(closingData.total_general_income + closingData.total_clinical_orthodontic_income)}\n` +
              `Gastos (incl. doctora): ${formatCurrency(closingData.total_fixed_expenses + closingData.total_variable_expenses)}\n` +
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
      console.error('Error al crear cierre:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  // Ver detalles del cierre
  const handleViewDetails = (closing) => {
    setSelectedClosing(closing);
    setShowDetailModal(true);
  };

  // Exportar a PDF (simulación)
  const handleExportPDF = (closing) => {
    alert(`📄 Exportando cierre de ${closing.month} ${closing.year} a PDF...`);
    // Aquí iría la lógica real de exportación
  };

  // Obtener color según utilidad
  const getProfitColor = (profit) => {
    if (profit > 0) return '#4CAF50'; // Verde para ganancias
    if (profit < 0) return '#F44336'; // Rojo para pérdidas
    return '#FF9800'; // Naranja para neutral
  };

  // Obtener icono según utilidad
  const getProfitIcon = (profit) => {
    if (profit > 0) return faCheckCircle;
    if (profit < 0) return faTimesCircle;
    return faInfoCircle;
  };

  // Calcular total de gastos incluyendo doctora
  const calculateTotalExpenses = (closing) => {
  return (closing.total_fixed_expenses || 0) + (closing.total_variable_expenses || 0);
};

  // Calcular total de ingresos de la clínica
  const calculateTotalClinicIncome = (closing) => {
  // Ya no sumamos general_income + clinical_orthodontic_income
  // Porque clinic_income YA incluye ambos
  return (closing.total_general_income || 0) + (closing.total_clinical_orthodontic_income || 0);
};

const calculateGastosSinDoctora = (closing) => {
  // Gastos variables sin incluir el pago a doctora
  return (closing.total_variable_expenses || 0) - (closing.total_orthodontic_doctor_income || 0);
};

  if (loading && monthlyClosings.length === 0) {
    return (
      <div className="closings-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando cierres mensuales...</p>
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
            Cierres Mensuales
          </h2>
          <p className="subtitle">
            Resumen financiero mensual de la clínica - 
            <span className="doctor-note-inline">
              <FontAwesomeIcon icon={faUserMd} /> Pago a doctora incluido como gasto
            </span>
          </p>
        </div>
        <div className="header-right">
          <button 
            className="primary-btn"
            onClick={() => setShowCreateModal(true)}
            disabled={creating}
          >
            <FontAwesomeIcon icon={faPlus} />
            {creating ? 'Calculando...' : 'Nuevo Cierre'}
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

              {/* Búsqueda */}
              <div className="filter-group">
                <label className="filter-label">
                  <FontAwesomeIcon icon={faSearch} /> Buscar:
                </label>
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Buscar por mes, año o comentario..."
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
        
        <div className="stat-card income">
          <div className="stat-icon">
            <FontAwesomeIcon icon={faChartLine} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(stats.totalIncome)}</div>
            <div className="stat-label">Ingresos Clínica*</div>
            <div className="stat-note">*Sin incluir 60% doctora</div>
          </div>
        </div>
        
        <div className="stat-card expenses">
          <div className="stat-icon">
            <FontAwesomeIcon icon={faMoneyBillWave} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatCurrency(stats.totalExpenses)}</div>
            <div className="stat-label">Gastos Totales</div>
            <div className="stat-note">*Incluye pago a doctora</div>
          </div>
        </div>
        
        <div className="stat-card profit">
          <div className="stat-icon">
            <FontAwesomeIcon icon={faCalculator} />
          </div>
          <div className="stat-content">
            <div className="stat-value" style={{ color: getProfitColor(stats.totalProfit) }}>
              {formatCurrency(stats.totalProfit)}
            </div>
            <div className="stat-label">Utilidad Total</div>
          </div>
        </div>
      </div>

      {/* Mejor/Peor mes */}
      <div className="performance-stats">
        <div className="performance-card best">
          <FontAwesomeIcon icon={faCheckCircle} />
          <div className="performance-content">
            <div className="performance-title">Mejor mes</div>
            <div className="performance-value">{stats.bestMonth}</div>
          </div>
        </div>
        
        <div className="performance-card worst">
          <FontAwesomeIcon icon={faTimesCircle} />
          <div className="performance-content">
            <div className="performance-title">Peor mes</div>
            <div className="performance-value">{stats.worstMonth}</div>
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
            {searchTerm || yearFilter !== 'all'
              ? 'No se encontraron cierres con los filtros seleccionados'
              : 'Cree su primer cierre mensual para ver el resumen financiero'}
          </p>
          <button 
            className="primary-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <FontAwesomeIcon icon={faPlus} />
            Crear primer cierre
          </button>
        </div>
      ) : (
        <div className="closings-list">
          {filteredClosings.map(closing => (
            <div 
              key={closing.closing_ID || closing.id} 
              className="closing-card"
              style={{ borderLeftColor: getProfitColor(closing.net_profit) }}
            >
              <div className="closing-main-info">
                <div className="closing-left">
                  <div className="closing-period">
                    <h4>
                      {closing.month} {closing.year}
                    </h4>
                    <div className="closing-date">
                      <FontAwesomeIcon icon={faCalendarAlt} />
                      <span>Cerrado el: {formatDate(closing.closing_date)}</span>
                    </div>
                  </div>
                  
                  {closing.comentary && (
                    <div className="closing-comment">
                      <FontAwesomeIcon icon={faInfoCircle} />
                      <span>{closing.comentary}</span>
                    </div>
                  )}
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
                    <button 
                      className="action-btn download"
                      onClick={() => handleExportPDF(closing)}
                      title="Descargar informe"
                    >
                      <FontAwesomeIcon icon={faDownload} />
                    </button>
                    <FontAwesomeIcon 
                      icon={expandedClosings[closing.closing_ID || closing.id] ? faChevronUp : faChevronDown} 
                      className="expand-icon"
                      onClick={() => toggleExpandClosing(closing.closing_ID || closing.id)}
                    />
                  </div>
                </div>
              </div>

              {/* Detalles expandidos */}
              {expandedClosings[closing.closing_ID || closing.id] && (
                <div className="closing-details">
                  <div className="financial-summary">
                    <h5>Resumen Financiero</h5>
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
                      <div className="summary-item total-expenses">
                        <span className="summary-label">Total Gastos (incl. doctora):</span>
                        <span className="summary-value">
                          {formatCurrency(calculateTotalExpenses(closing))}
                        </span>
                      </div>
                    </div>
                    
                    <div className="net-profit-summary">
                      <div className="net-profit-item">
                        <span className="net-profit-label">Ingresos Clínica:</span>
                        <span className="net-profit-value">
                          {formatCurrency(calculateTotalClinicIncome(closing))}
                        </span>
                      </div>
                      <div className="net-profit-item">
                        <span className="net-profit-label">Gastos Totales:</span>
                        <span className="net-profit-value">
                          {formatCurrency(calculateTotalExpenses(closing))}
                        </span>
                      </div>
                      <div className="net-profit-final">
                        <span className="net-profit-label">Utilidad Neta:</span>
                        <span 
                          className="net-profit-value"
                          style={{ color: getProfitColor(closing.net_profit) }}
                        >
                          {formatCurrency(closing.net_profit)}
                        </span>
                      </div>
                      <div className="net-profit-percentage">
                        <span>Margen de utilidad:</span>
                        <span className="percentage-value">
                          {calculateTotalClinicIncome(closing) > 0 
                            ? `${((closing.net_profit / calculateTotalClinicIncome(closing)) * 100).toFixed(2)}%`
                            : '0.00%'
                          }
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

      {/* Modal para crear cierre */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faCalculator} />
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

      {/* Modal de detalles */}
      {showDetailModal && selectedClosing && (
        <div className="modal-overlay">
          <div className="modal-content wide">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faEye} />
                Detalles del Cierre - {selectedClosing.month} {selectedClosing.year}
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowDetailModal(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="detail-content">
              {/* Información general */}
              <div className="detail-section">
                <h4>Información General</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Fecha de cierre:</span>
                    <span className="detail-value">{formatDate(selectedClosing.closing_date)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Período:</span>
                    <span className="detail-value">{selectedClosing.month} {selectedClosing.year}</span>
                  </div>
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

              {/* Resumen financiero - MODIFICADO */}
              <div className="detail-section">
                <h4>Resumen Financiero Detallado</h4>
                <div className="financial-breakdown">
                  
                  {/* INGRESOS DE LA CLÍNICA */}
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
                        {formatCurrency(calculateTotalClinicIncome(selectedClosing))}
                      </span>
                    </div>
                  </div>

                  {/* GASTOS - ¡INCLUYENDO PAGO A DOCTORA! */}
                  <div className="breakdown-section expenses">
                    <h5>Gastos (Incluye honorarios doctora)</h5>
                    <div className="breakdown-item">
                      <span>Gastos Fijos:</span>
                      <span className="amount">{formatCurrency(selectedClosing.total_fixed_expenses)}</span>
                      <small className="expense-note">(Alquiler, salarios, servicios públicos)</small>
                    </div>
                    <div className="breakdown-item">
                      <span>Gastos Variables (sin doctora):</span>
                      <span className="amount">
                        {formatCurrency(calculateGastosSinDoctora(selectedClosing))}
                      </span>
                      <small className="expense-note">(Materiales, otros gastos operativos)</small>
                    </div>
                    <div className="breakdown-item highlight">
                      <span>
                        <FontAwesomeIcon icon={faUserMd} /> Pago a Doctora Ortodoncia:
                      </span>
                      <span className="amount doctor-payment">
                        {formatCurrency(selectedClosing.total_orthodontic_doctor_income)}
                      </span>
                      <small className="doctor-note">(60% de ortodoncia - Honorarios profesionales)</small>
                    </div>
                    <div className="breakdown-total">
                      <span>Total Gastos (incl. doctora):</span>
                      <span className="total-amount">
                        {formatCurrency(calculateTotalExpenses(selectedClosing))}
                      </span>
                    </div>
                  </div>

                  {/* RESUMEN FINAL */}
                  <div className="breakdown-section summary">
                    <h5>Resumen Final Clínica</h5>
                    <div className="breakdown-item">
                      <span>Ingresos Totales Clínica:</span>
                      <span className="amount">
                        {formatCurrency(calculateTotalClinicIncome(selectedClosing))}
                      </span>
                    </div>
                    <div className="breakdown-item">
                      <span>Gastos Totales (Incl. doctora):</span>
                      <span className="amount">
                        {formatCurrency(calculateTotalExpenses(selectedClosing))}
                      </span>
                    </div>
                    <div className="breakdown-final">
                      <span>Utilidad Neta Clínica:</span>
                      <span 
                        className="final-amount"
                        style={{ color: getProfitColor(selectedClosing.net_profit) }}
                      >
                        {formatCurrency(selectedClosing.net_profit)}
                      </span>
                    </div>
                    <div className="profit-margin">
                      <span>Margen de Utilidad:</span>
                      <span className="margin-value">
                        {calculateTotalClinicIncome(selectedClosing) > 0 
                          ? `${((selectedClosing.net_profit / calculateTotalClinicIncome(selectedClosing)) * 100).toFixed(2)}%`
                          : '0.00%'
                        }
                      </span>
                    </div>
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
                <button 
                  className="secondary-btn"
                  onClick={() => handleExportPDF(selectedClosing)}
                >
                  <FontAwesomeIcon icon={faDownload} />
                  Descargar Informe
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