import React, { useContext, useState, useEffect } from "react";
import { AppContext } from "../../context/AppContext";
import { AuthContext } from "../../context/AuthContext";
import { formatDate, formatCurrency } from "../../utils/formatters";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChevronDown,
  faChevronUp,
  faFilter,
  faTimes,
  faSearch,
  faEye,
  faEyeSlash,
  faUserDoctor,
  faClipboardList,
  faMoneyBillWave,
  faDollarSign,
  faExchangeAlt,
  faMoneyBill,
  faPercentage,
  faCreditCard,
  faCalendarDay,
  faCalendarWeek,
  faCalendar,
  faCalendarAlt
} from '@fortawesome/free-solid-svg-icons';
import "./ProceduresPage.css";

// Definir filtros de tiempo
const TIME_FILTERS = {
  TODAY: 'today',
  THIS_WEEK: 'thisWeek',
  THIS_MONTH: 'thisMonth',
  ALL: 'all'
};

export default function ProceduresPage() {
  const { user } = useContext(AuthContext);
  const { 
    procedures, 
    fetchProceduresNormal,
    loading,
    error: contextError,
    clearError
  } = useContext(AppContext);
  
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState(TIME_FILTERS.ALL); // CAMBIADO A 'all' por defecto
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: ""
  });
  const [expandedFilters, setExpandedFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (user) {
      loadProcedures();
    }
  }, [user]);

  const loadProcedures = async () => {
    try {
      setLocalError("");
      clearError();
      await fetchProceduresNormal({ 
        timeFilter,
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate
      });
    } catch (error) {
      console.error('Error al cargar procedimientos:', error);
      setLocalError(error.message || 'Error al cargar procedimientos');
    }
  };

  // FUNCIÓN SIMPLIFICADA DE FILTRADO - como en citas
  const applyFilters = async () => {
    try {
      setLocalError("");
      
      const filters = {};
      
      // Lógica SIMPLE: usar el filtro que esté activo
      if (dateFilter.startDate && dateFilter.endDate) {
        // Si hay fechas específicas, usarlas
        filters.startDate = dateFilter.startDate;
        filters.endDate = dateFilter.endDate;
      } else {
        // Si no hay fechas específicas, usar el filtro de tiempo
        filters.timeFilter = timeFilter;
      }
      
      console.log('🔍 Aplicando filtros:', filters);
      await fetchProceduresNormal(filters);
    } catch (error) {
      console.error('Error al aplicar filtros:', error);
      setLocalError(error.message || 'Error al aplicar filtros');
    }
  };

  const clearFilters = async () => {
    try {
      setLocalError("");
      setSearch("");
      setTimeFilter(TIME_FILTERS.ALL); // Cambiado a 'all'
      setDateFilter({ startDate: "", endDate: "" });
      await fetchProceduresNormal({ timeFilter: TIME_FILTERS.ALL });
    } catch (error) {
      console.error('Error al limpiar filtros:', error);
      setLocalError(error.message || 'Error al limpiar filtros');
    }
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredProcedures = procedures
    .filter(procedure => {
      if (!search.trim()) return true;
      
      const searchTerm = search.toLowerCase();
      return (
        procedure.procedure_description?.toLowerCase().includes(searchTerm) ||
        procedure.patient_name?.toLowerCase().includes(searchTerm) ||
        procedure.patient_identification?.includes(searchTerm) ||
        (procedure.external_doctor_name?.toLowerCase() || '').includes(searchTerm)
      );
    });

  const error = localError || contextError;

  const formatCurrencyUSD = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Calcular cantidad neta de la clínica
  const calculateClinicNetIncome = (procedure) => {
    const clinicIncome = procedure.clinic_income || procedure.total_cost || 0;
    const externalDoctorPayment = procedure.external_doctor_payment || 0;
    return Math.max(0, clinicIncome - externalDoctorPayment);
  };

  // Calcular cantidad neta en dólares
  const calculateClinicNetIncomeUSD = (procedure) => {
    const clinicIncomeUSD = procedure.clinic_payment_dollars || 
                           (procedure.total_procedure_usd || procedure.total_cost_USD || 0);
    const externalDoctorPaymentUSD = procedure.external_doctor_payment_usd || 0;
    return Math.max(0, clinicIncomeUSD - externalDoctorPaymentUSD);
  };

  // Obtener método de pago principal
  const getMainPaymentMethod = (procedure) => {
    if (procedure.payment_method_cordobas && procedure.payment_method_dollars) {
      return 'Mixto';
    }
    return procedure.payment_method_cordobas || procedure.payment_method_dollars || procedure.payment_method || 'No especificado';
  };

  // Obtener icono según método de pago
  const getPaymentMethodIcon = (method) => {
    if (!method) return faMoneyBillWave;
    
    const methodLower = method.toLowerCase();
    if (methodLower.includes('efectivo')) return faMoneyBillWave;
    if (methodLower.includes('pos') || methodLower.includes('tarjeta')) return faCreditCard;
    if (methodLower.includes('transferencia')) return faExchangeAlt;
    if (methodLower.includes('mixto')) return faExchangeAlt;
    if (methodLower.includes('cheque')) return faMoneyBillWave;
    return faMoneyBillWave;
  };

  // Obtener color según método de pago
  const getPaymentMethodColor = (method) => {
    if (!method) return '#78909C';
    
    const methodLower = method.toLowerCase();
    if (methodLower.includes('efectivo')) return '#4CAF50';
    if (methodLower.includes('pos') || methodLower.includes('tarjeta')) return '#2196F3';
    if (methodLower.includes('transferencia')) return '#9C27B0';
    if (methodLower.includes('mixto')) return '#FF5722';
    if (methodLower.includes('cheque')) return '#FF9800';
    return '#78909C';
  };

  // Calcular totales separados
  const calculateSeparateTotals = (procedure) => {
    const cordobas = procedure.amount_cordobas || procedure.total_cost || 0;
    const dollars = procedure.amount_dollars || procedure.total_cost_USD || 0;
    const exchangeRate = procedure.exchange_rate_used || 36.5;
    
    if (procedure.total_procedure && !cordobas && !dollars) {
      return {
        cordobas: procedure.total_procedure,
        dollars: 0,
        exchangeRate
      };
    }
    
    return {
      cordobas,
      dollars,
      exchangeRate
    };
  };

  if (loading && procedures.length === 0) {
    return (
      <div className="procedures-container">
        <div className="loading-message">
          <div className="loading-spinner"></div>
          <p>Cargando procedimientos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="procedures-container">
        <div className="error-message">
          <h3>❌ Error</h3>
          <p>{error}</p>
          <button onClick={loadProcedures} className="btn-retry">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="procedures-container">
      <div className="procedures-header">
        <h2>🦷 Procedimientos Regulares</h2>
        <div className="procedures-tools">
          <div className="procedures-count">
            <span>{filteredProcedures.length}</span>
          </div>
        </div>
      </div>

      {/* Filtros desplegables */}
      <div className={`filter-section ${expandedFilters ? 'expanded' : ''}`}>
        <div className="filter-header-mobile" onClick={() => setExpandedFilters(!expandedFilters)}>
          <div className="filter-header-content">
            <h3>
              <FontAwesomeIcon icon={faFilter} />
              Filtros
            </h3>
            <span className="filter-summary">
              {timeFilter === TIME_FILTERS.TODAY ? 'Hoy' : 
               timeFilter === TIME_FILTERS.THIS_WEEK ? 'Esta semana' :
               timeFilter === TIME_FILTERS.THIS_MONTH ? 'Este mes' : 
               dateFilter.startDate || dateFilter.endDate ? 'Fechas específicas' : 'Todos'}
            </span>
          </div>
          <FontAwesomeIcon 
            icon={expandedFilters ? faChevronUp : faChevronDown} 
            className="filter-toggle-icon"
          />
        </div>
        
        <div className="filter-content-container">
          <div className="filters-section">
            <div className="filters-row">
              {/* Filtro de tiempo */}
              <div className="filter-group">
                <label>Periodo rápido:</label>
                <div className="time-filter-buttons">
                  <button 
                    className={`time-filter-btn ${timeFilter === TIME_FILTERS.TODAY ? 'active' : ''}`}
                    onClick={async () => {
                      setTimeFilter(TIME_FILTERS.TODAY);
                      setDateFilter({ startDate: "", endDate: "" });
                      await fetchProceduresNormal({ timeFilter: TIME_FILTERS.TODAY });
                    }}
                  >
                    <FontAwesomeIcon icon={faCalendarDay} />
                    Hoy
                  </button>
                  <button 
                    className={`time-filter-btn ${timeFilter === TIME_FILTERS.THIS_WEEK ? 'active' : ''}`}
                    onClick={async () => {
                      setTimeFilter(TIME_FILTERS.THIS_WEEK);
                      setDateFilter({ startDate: "", endDate: "" });
                      await fetchProceduresNormal({ timeFilter: TIME_FILTERS.THIS_WEEK });
                    }}
                  >
                    <FontAwesomeIcon icon={faCalendarWeek} />
                    Esta semana
                  </button>
                  <button 
                    className={`time-filter-btn ${timeFilter === TIME_FILTERS.THIS_MONTH ? 'active' : ''}`}
                    onClick={async () => {
                      setTimeFilter(TIME_FILTERS.THIS_MONTH);
                      setDateFilter({ startDate: "", endDate: "" });
                      await fetchProceduresNormal({ timeFilter: TIME_FILTERS.THIS_MONTH });
                    }}
                  >
                    <FontAwesomeIcon icon={faCalendar} />
                    Este mes
                  </button>
                  <button 
                    className={`time-filter-btn ${timeFilter === TIME_FILTERS.ALL ? 'active' : ''}`}
                    onClick={async () => {
                      setTimeFilter(TIME_FILTERS.ALL);
                      setDateFilter({ startDate: "", endDate: "" });
                      await fetchProceduresNormal({ timeFilter: TIME_FILTERS.ALL });
                    }}
                  >
                    <FontAwesomeIcon icon={faCalendarAlt} />
                    Todos
                  </button>
                </div>
              </div>
              
              {/* Fechas específicas */}
              <div className="filter-group">
                <label>Fecha desde:</label>
                <input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => {
                    setDateFilter({...dateFilter, startDate: e.target.value});
                  }}
                />
              </div>
              
              <div className="filter-group">
                <label>Fecha hasta:</label>
                <input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => {
                    setDateFilter({...dateFilter, endDate: e.target.value});
                  }}
                />
              </div>
              
              <div className="filter-actions">
                <button className="btn-apply-filters" onClick={applyFilters}>
                  Aplicar Filtros
                </button>
                <button className="btn-clear-filters" onClick={clearFilters}>
                  Limpiar Filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BUSCADOR PRINCIPAL */}
      <div className="search-box-main-container">
        <div className="filter-group">
          <label className="filter-label">Buscar procedimientos:</label>
          <div className="search-box-main">
            <input
              type="text"
              placeholder="Buscar por descripción, paciente, cédula o doctor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input-main"
            />
            {search && (
              <button 
                className="clear-search-btn"
                onClick={() => setSearch('')}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            )}
          </div>
          <small className="search-help-text">
            Busca por descripción del procedimiento, nombre del paciente, cédula o nombre del doctor externo
          </small>
        </div>
      </div>

      {/* Tabla de procedimientos */}
      <div className="procedures-section">
        <h3>Lista de Procedimientos ({filteredProcedures.length})</h3>
        
        {filteredProcedures.length === 0 ? (
          <div className="no-results">
            <p>
              {search || timeFilter !== TIME_FILTERS.ALL || dateFilter.startDate || dateFilter.endDate
                ? "No se encontraron procedimientos con los filtros aplicados."
                : "No hay procedimientos registrados."}
            </p>
            <p className="no-results-help">
              Los procedimientos regulares se crean al completar una cita NO de ortodoncia y registrar los detalles del servicio.
            </p>
          </div>
        ) : (
          <div className="table-responsive-container">
            <table className="procedures-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>Descripción</th>
                  <th>Total C$</th>
                  <th>Total US$</th>
                  <th>Clínica Neto C$</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcedures.map((procedure) => {
                  const isExpanded = expandedRows[procedure.procedure_ID];
                  const hasExternalDoctor = procedure.theres_external_doctor || procedure.external_doctor;
                  const hasObservations = procedure.observations && procedure.observations.trim() !== "";
                  const mainPaymentMethod = getMainPaymentMethod(procedure);
                  
                  // Calcular totales separados
                  const separateTotals = calculateSeparateTotals(procedure);
                  
                  // Calcular cantidad neta de la clínica
                  const clinicNetIncome = calculateClinicNetIncome(procedure);
                  const clinicNetIncomeUSD = calculateClinicNetIncomeUSD(procedure);
                  
                  return (
                    <React.Fragment key={procedure.procedure_ID}>
                      <tr className={isExpanded ? "expanded-row" : ""}>
                        <td>
                          {procedure.procedure_date ? formatDate(procedure.procedure_date) : "N/A"}
                        </td>
                        <td className="patient-cell">
                          <div className="patient-info-compact">
                            <strong>{procedure.patient_name || "Paciente no especificado"}</strong>
                            <small>{procedure.patient_identification || "N/A"}</small>
                          </div>
                        </td>
                        <td className="description-cell">
                          <div className="description-content">
                            <strong>{procedure.procedure_description || "Sin descripción"}</strong>
                          </div>
                        </td>
                        
                        {/* Total Córdobas */}
                        <td className="total-cordobas-cell">
                          <div className="total-amount-container">
                            <div className="total-amount cordobas">
                              {formatCurrency(procedure.total_procedure || procedure.total_cost || 0)}
                            </div>
                            {separateTotals.cordobas > 0 && (
                              <div className="payment-breakdown">
                                <div className="breakdown-row">
                                  <span className="breakdown-label">Abono C$:</span>
                                  <span className="breakdown-value">{formatCurrency(separateTotals.cordobas)}</span>
                                </div>
                                <div className="breakdown-row method">
                                  <FontAwesomeIcon 
                                    icon={getPaymentMethodIcon(procedure.payment_method_cordobas)}
                                    style={{ color: getPaymentMethodColor(procedure.payment_method_cordobas) }}
                                  />
                                  <span>{procedure.payment_method_cordobas || 'No especificado'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Total Dólares */}
                        <td className="total-dollars-cell">
                          <div className="total-amount-container">
                            <div className="total-amount dollars">
                              {formatCurrencyUSD(procedure.total_procedure_usd || procedure.total_cost_USD || 0)}
                            </div>
                            {separateTotals.dollars > 0 && (
                              <div className="payment-breakdown">
                                <div className="breakdown-row">
                                  <span className="breakdown-label">Abono US$:</span>
                                  <span className="breakdown-value">{formatCurrencyUSD(separateTotals.dollars)}</span>
                                </div>
                                <div className="breakdown-row method">
                                  <FontAwesomeIcon 
                                    icon={getPaymentMethodIcon(procedure.payment_method_dollars)}
                                    style={{ color: getPaymentMethodColor(procedure.payment_method_dollars) }}
                                  />
                                  <span>{procedure.payment_method_dollars || 'No especificado'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Cantidad neta de la clínica */}
                        <td className="clinic-net-cell">
                          <div className="net-amount-container">
                            <div className="net-amount clinic-net">
                              {formatCurrency(clinicNetIncome)}
                            </div>
                            {hasExternalDoctor && (
                              <div className="external-doctor-impact">
                                <small>
                                  -{formatCurrency(procedure.external_doctor_payment || 0)} doctor externo
                                </small>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Botón Ver/Detalles */}
                        <td className="actions-cell">
                          <button 
                            className="btn-view-details"
                            onClick={() => toggleRow(procedure.procedure_ID)}
                            title={isExpanded ? "Ocultar detalles" : "Ver detalles"}
                          >
                            <FontAwesomeIcon icon={isExpanded ? faEyeSlash : faEye} />
                            <span>{isExpanded ? "Ocultar" : "Ver"}</span>
                          </button>
                        </td>
                      </tr>
                      
                      {/* Fila expandida con detalles */}
                      {isExpanded && (
                        <tr className="details-row">
                          <td colSpan="7">
                            <div className="procedure-details">
                              {/* ... mantén el mismo contenido de detalles expandidos ... */}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}