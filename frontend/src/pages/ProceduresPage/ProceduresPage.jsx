import { useContext, useState, useEffect } from "react";
import { AppContext } from "../../context/AppContext";
import { AuthContext } from "../../context/AuthContext";
import { formatDate, formatCurrency } from "../../utils/formatters";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChevronDown,
  faChevronUp,
  faChartBar,
  faFilter,
  faTimes,
  faSearch,
  faEye,
  faEyeSlash,
  faMoneyBillWave,
  faDollarSign,
  faPercentage,
  faUserDoctor
} from '@fortawesome/free-solid-svg-icons';
import "./ProceduresPage.css";

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
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: ""
  });
  const [localError, setLocalError] = useState("");
  const [expandedStats, setExpandedStats] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  // Cargar procedimientos al montar
  useEffect(() => {
    if (user) {
      loadProcedures();
    }
  }, [user]);

  const loadProcedures = async () => {
    try {
      setLocalError("");
      clearError();
      await fetchProceduresNormal();
    } catch (error) {
      console.error('Error al cargar procedimientos:', error);
      setLocalError(error.message || 'Error al cargar procedimientos');
    }
  };

  // Aplicar filtros
  const applyFilters = async () => {
    try {
      setLocalError("");
      const filters = {};
      if (dateFilter.startDate) filters.startDate = dateFilter.startDate;
      if (dateFilter.endDate) filters.endDate = dateFilter.endDate;
      await fetchProceduresNormal(filters);
    } catch (error) {
      console.error('Error al aplicar filtros:', error);
      setLocalError(error.message || 'Error al aplicar filtros');
    }
  };

  // Limpiar filtros
  const clearFilters = async () => {
    try {
      setLocalError("");
      setDateFilter({ startDate: "", endDate: "" });
      setSearch("");
      await fetchProceduresNormal();
    } catch (error) {
      console.error('Error al limpiar filtros:', error);
      setLocalError(error.message || 'Error al limpiar filtros');
    }
  };

  // Toggle para expandir/contraer fila
  const toggleRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Filtrar procedimientos por búsqueda
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

  // Calcular estadísticas
  const calculateStats = () => {
    const totalCordobas = filteredProcedures.reduce((sum, proc) => sum + (proc.amount_cordobas || proc.total_cost || 0), 0);
    const totalDollars = filteredProcedures.reduce((sum, proc) => sum + (proc.amount_dollars || proc.total_cost_USD || 0), 0);
    const totalProcedureCordobas = filteredProcedures.reduce((sum, proc) => sum + (proc.total_procedure || 0), 0);
    const totalProcedureDollars = filteredProcedures.reduce((sum, proc) => sum + (proc.total_procedure_usd || 0), 0);
    
    // Calcular ganancias de clínica (100% para procedimientos generales)
    const totalClinicEarningsCordobas = filteredProcedures.reduce((sum, proc) => 
      sum + (proc.clinic_payment_cordobas || proc.total_procedure || 0), 0);
    const totalClinicEarningsDollars = filteredProcedures.reduce((sum, proc) => 
      sum + (proc.clinic_payment_dollars || proc.total_procedure_usd || 0), 0);
    
    // Calcular pagos a doctores externos
    const externalDoctorPaymentsCordobas = filteredProcedures.reduce((sum, proc) => 
      sum + (proc.external_doctor_payment || 0), 0);
    const externalDoctorPaymentsDollars = filteredProcedures.reduce((sum, proc) => 
      sum + (proc.external_doctor_payment_usd || 0), 0);
    const externalDoctorCount = filteredProcedures.filter(proc => 
      proc.theres_external_doctor || proc.external_doctor
    ).length;
    
    // Métodos de pago más utilizados
    const paymentMethods = {};
    filteredProcedures.forEach(proc => {
      if (proc.payment_method_cordobas) {
        paymentMethods[proc.payment_method_cordobas] = (paymentMethods[proc.payment_method_cordobas] || 0) + 1;
      }
      if (proc.payment_method_dollars) {
        paymentMethods[proc.payment_method_dollars] = (paymentMethods[proc.payment_method_dollars] || 0) + 1;
      }
    });
    
    return {
      totalCordobas,
      totalDollars,
      totalProcedureCordobas,
      totalProcedureDollars,
      totalClinicEarningsCordobas,
      totalClinicEarningsDollars,
      externalDoctorPaymentsCordobas,
      externalDoctorPaymentsDollars,
      externalDoctorCount,
      averageProcedure: filteredProcedures.length > 0 ? totalProcedureCordobas / filteredProcedures.length : 0,
      procedureCount: filteredProcedures.length,
      paymentMethods
    };
  };

  const statsData = calculateStats();
  
  // Manejar errores
  const error = localError || contextError;

  // Formatear moneda en dólares
  const formatCurrencyUSD = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Obtener el método de pago principal
  const getMainPaymentMethod = (procedure) => {
    if (procedure.payment_method_cordobas && procedure.payment_method_dollars) {
      return 'Mixto';
    }
    return procedure.payment_method_cordobas || procedure.payment_method_dollars || procedure.payment_method || 'No especificado';
  };

  // Calcular ganancias para procedimiento general (100% para clínica)
  const calculateProcedureEarnings = (procedure) => {
    const clinicEarningsCordobas = procedure.clinic_payment_cordobas || procedure.total_procedure || 0;
    const clinicEarningsDollars = procedure.clinic_payment_dollars || procedure.total_procedure_usd || 0;
    
    return {
      clinicEarningsCordobas,
      clinicEarningsDollars,
      totalProcedureCordobas: procedure.total_procedure || 0,
      totalProcedureDollars: procedure.total_procedure_usd || 0,
      clinicPercentage: 100,
      doctorPercentage: 0
    };
  };

  // Obtener desglose de pagos
  const getPaymentBreakdown = (procedure) => {
    const cordobas = procedure.amount_cordobas || procedure.total_cost || 0;
    const dollars = procedure.amount_dollars || procedure.total_cost_USD || 0;
    const totalProcedureCordobas = procedure.total_procedure || 0;
    const totalProcedureDollars = procedure.total_procedure_usd || 0;
    
    return {
      cordobas,
      dollars,
      totalProcedureCordobas,
      totalProcedureDollars,
      hasCordobas: cordobas > 0,
      hasDollars: dollars > 0,
      isMixed: cordobas > 0 && dollars > 0
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

      {/* Estadísticas desplegables */}
      <div className={`appointments-stats ${expandedStats ? 'expanded' : ''}`}>
        <div className="stats-header-mobile" onClick={() => setExpandedStats(!expandedStats)}>
          <div className="stats-header-content">
            <h3 className="stats-title">
              <FontAwesomeIcon icon={faChartBar} />
              Estadísticas de Procedimientos
            </h3>
            <div className="stats-summary-mobile">
              <span className="stat-summary-item">Total: {statsData.procedureCount}</span>
              <span className="stat-summary-item">C$ {formatCurrency(statsData.totalProcedureCordobas)}</span>
              <span className="stat-summary-item">US$ {formatCurrencyUSD(statsData.totalProcedureDollars)}</span>
            </div>
          </div>
          <FontAwesomeIcon 
            icon={expandedStats ? faChevronUp : faChevronDown} 
            className="stats-toggle-icon"
          />
        </div>
        
        <div className="stats-grid-container">
          <div className="stat-card total-procedures">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faChartBar} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{statsData.procedureCount}</div>
              <div className="stat-label">Procedimientos</div>
            </div>
          </div>
          
          <div className="stat-card total-income-cordobas">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faMoneyBillWave} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(statsData.totalProcedureCordobas)}</div>
              <div className="stat-label">Total C$</div>
            </div>
          </div>
          
          <div className="stat-card total-income-dollars">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faDollarSign} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrencyUSD(statsData.totalProcedureDollars)}</div>
              <div className="stat-label">Total US$</div>
            </div>
          </div>
          
          <div className="stat-card clinic-earnings-cordobas">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faPercentage} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(statsData.totalClinicEarningsCordobas)}</div>
              <div className="stat-label">Ganancia Clínica C$</div>
            </div>
          </div>
          
          <div className="stat-card clinic-earnings-dollars">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faDollarSign} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrencyUSD(statsData.totalClinicEarningsDollars)}</div>
              <div className="stat-label">Ganancia Clínica US$</div>
            </div>
          </div>
          
          <div className="stat-card external-doctor">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faUserDoctor} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{statsData.externalDoctorCount}</div>
              <div className="stat-label">Doctores Externos</div>
            </div>
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
              {dateFilter.startDate ? `Desde: ${dateFilter.startDate}` : 'Sin fecha inicio'} • 
              {dateFilter.endDate ? ` Hasta: ${dateFilter.endDate}` : ' Sin fecha fin'}
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
              <div className="filter-group">
                <label>Fecha desde:</label>
                <input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => setDateFilter({...dateFilter, startDate: e.target.value})}
                />
              </div>
              <div className="filter-group">
                <label>Fecha hasta:</label>
                <input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => setDateFilter({...dateFilter, endDate: e.target.value})}
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

      {/* Tabla de procedimientos simplificada */}
      <div className="procedures-section">
        <h3>Lista de Procedimientos ({filteredProcedures.length})</h3>
        
        {filteredProcedures.length === 0 ? (
          <div className="no-results">
            <p>
              {search || dateFilter.startDate || dateFilter.endDate
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
                  <th>Ganancia Clínica C$</th>
                  <th>Ganancia Clínica US$</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcedures.map((procedure) => {
                  const earnings = calculateProcedureEarnings(procedure);
                  const paymentBreakdown = getPaymentBreakdown(procedure);
                  const isExpanded = expandedRows[procedure.procedure_ID];
                  
                  return (
                    <>
                      <tr key={procedure.procedure_ID} className={isExpanded ? "expanded-row" : ""}>
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
                        
                        {/* Totales en ambas monedas */}
                        <td className="total-cordobas-cell">
                          <div className="total-amount cordobas">
                            {formatCurrency(paymentBreakdown.totalProcedureCordobas)}
                          </div>
                        </td>
                        
                        <td className="total-dollars-cell">
                          <div className="total-amount dollars">
                            {formatCurrencyUSD(paymentBreakdown.totalProcedureDollars)}
                          </div>
                        </td>
                        
                        {/* Ganancias de clínica en ambas monedas */}
                        <td className="clinic-earnings-cordobas-cell">
                          <div className="earnings-amount clinic">
                            {formatCurrency(earnings.clinicEarningsCordobas)}
                          </div>
                        </td>
                        
                        <td className="clinic-earnings-dollars-cell">
                          <div className="earnings-amount clinic">
                            {formatCurrencyUSD(earnings.clinicEarningsDollars)}
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
                        <tr key={`${procedure.procedure_ID}-details`} className="details-row">
                          <td colSpan="8">
                            <div className="procedure-details">
                              <div className="details-header">
                                <h4>📋 Detalles del Procedimiento</h4>
                              </div>
                              
                              <div className="details-grid">
                                
                                {/* Información del procedimiento */}
                                <div className="details-section procedure-info">
                                  <h5>🦷 Detalles del Procedimiento</h5>
                                  <div className="details-content">
                                    <p><strong>Descripción:</strong> {procedure.procedure_description || "N/A"}</p>
                                    <p><strong>Fecha:</strong> {procedure.procedure_date ? formatDate(procedure.procedure_date) : "N/A"}</p>
                                    <p><strong>Observaciones:</strong> {procedure.observations || "Ninguna"}</p>
                                  </div>
                                </div>
                                
                                {/* Pagos */}
                                <div className="details-section payments-info">
                                  <h5>💰 Pagos Recibidos</h5>
                                  <div className="details-content">
                                    <div className="payment-row">
                                      <div className="payment-column">
                                        <h6>En Córdobas (C$)</h6>
                                        <p><strong>Cantidad:</strong> {formatCurrency(paymentBreakdown.cordobas)}</p>
                                        <p><strong>Método:</strong> {procedure.payment_method_cordobas || "No especificado"}</p>
                                        {procedure.payment_method_cordobas === 'POS' && (
                                          <>
                                            <p><strong>Deducción POS (5.5%):</strong> -{formatCurrency(procedure.pos_deduction_cordobas || 0)}</p>
                                            <p><strong>Neto:</strong> {formatCurrency(procedure.net_amount_cordobas || paymentBreakdown.cordobas)}</p>
                                          </>
                                        )}
                                      </div>
                                      <div className="payment-column">
                                        <h6>En Dólares (US$)</h6>
                                        <p><strong>Cantidad:</strong> {formatCurrencyUSD(paymentBreakdown.dollars)}</p>
                                        <p><strong>Método:</strong> {procedure.payment_method_dollars || "No especificado"}</p>
                                        {procedure.payment_method_dollars === 'POS' && (
                                          <>
                                            <p><strong>Deducción POS (5.5%):</strong> -{formatCurrencyUSD(procedure.pos_deduction_dollars || 0)}</p>
                                            <p><strong>Neto:</strong> {formatCurrencyUSD(procedure.net_amount_dollars || paymentBreakdown.dollars)}</p>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Totales */}
                                    <div className="total-summary">
                                      <div className="total-row">
                                        <span>Total Bruto (C$):</span>
                                        <span>{formatCurrency(procedure.gross_amount_cordobas || paymentBreakdown.cordobas)}</span>
                                      </div>
                                      <div className="total-row">
                                        <span>Total Bruto (US$):</span>
                                        <span>{formatCurrencyUSD(procedure.gross_amount_dollars || paymentBreakdown.dollars)}</span>
                                      </div>
                                      {procedure.total_pos_deduction > 0 && (
                                        <div className="total-row deduction">
                                          <span>Total Deducciones POS (C$):</span>
                                          <span>-{formatCurrency(procedure.total_pos_deduction)}</span>
                                        </div>
                                      )}
                                      <div className="total-row final">
                                        <span><strong>Total Neto (C$):</strong></span>
                                        <span><strong>{formatCurrency(paymentBreakdown.totalProcedureCordobas)}</strong></span>
                                      </div>
                                      <div className="total-row final">
                                        <span><strong>Total Neto (US$):</strong></span>
                                        <span><strong>{formatCurrencyUSD(paymentBreakdown.totalProcedureDollars)}</strong></span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Ganancias */}
                                <div className="details-section earnings-info">
                                  <h5>📈 Ganancias de la Clínica (100%)</h5>
                                  <div className="details-content">
                                    <div className="earnings-row">
                                      <div className="earnings-column">
                                        <h6>En Córdobas (C$)</h6>
                                        <p><strong>Total del procedimiento:</strong> {formatCurrency(earnings.clinicEarningsCordobas)}</p>
                                        {procedure.external_doctor_payment && (
                                          <>
                                            <p><strong>Pago a doctor externo:</strong> -{formatCurrency(procedure.external_doctor_payment)}</p>
                                            <p><strong>Ganancia neta clínica:</strong> {formatCurrency(earnings.clinicEarningsCordobas - (procedure.external_doctor_payment || 0))}</p>
                                          </>
                                        )}
                                      </div>
                                      <div className="earnings-column">
                                        <h6>En Dólares (US$)</h6>
                                        <p><strong>Total del procedimiento:</strong> {formatCurrencyUSD(earnings.clinicEarningsDollars)}</p>
                                        {procedure.external_doctor_payment_usd && (
                                          <>
                                            <p><strong>Pago a doctor externo:</strong> -{formatCurrencyUSD(procedure.external_doctor_payment_usd)}</p>
                                            <p><strong>Ganancia neta clínica:</strong> {formatCurrencyUSD(earnings.clinicEarningsDollars - (procedure.external_doctor_payment_usd || 0))}</p>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Doctor Externo (si aplica) */}
                                {(procedure.theres_external_doctor || procedure.external_doctor) && (
                                  <div className="details-section external-doctor-info">
                                    <h5>👨‍⚕️ Doctor Externo</h5>
                                    <div className="details-content">
                                      <p><strong>Nombre:</strong> {procedure.external_doctor_name || procedure.external_doctor || "N/A"}</p>
                                      <p><strong>Especialidad:</strong> {procedure.external_doctor_specialty || "N/A"}</p>
                                      <p><strong>Tipo de pago:</strong> {procedure.external_doctor_payment_type === 'percentage' ? 'Porcentaje' : 'Cantidad fija'}</p>
                                      <p><strong>Valor:</strong> {procedure.external_doctor_payment_type === 'percentage' ? 
                                        `${procedure.external_doctor_payment_value}%` : 
                                        formatCurrency(procedure.external_doctor_payment)} ({procedure.external_doctor_payment_currency})</p>
                                      {procedure.external_doctor_payment_usd && (
                                        <p><strong>Equivalente en US$:</strong> {formatCurrencyUSD(procedure.external_doctor_payment_usd)}</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Información adicional */}
                                <div className="details-section additional-info">
                                  <h5>📝 Información Adicional</h5>
                                  <div className="details-content">
                                    <p><strong>Tipo de cambio usado:</strong> C$ {procedure.exchange_rate_used || "36.5"} por US$ 1</p>
                                    <p><strong>Fecha de creación:</strong> {procedure.creation_date ? formatDate(procedure.creation_date) : "N/A"}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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