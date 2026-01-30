import { useContext, useState, useEffect } from "react";
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
  faCommentMedical,
  faHospitalUser,
  faStethoscope,
  faClipboardList,
  faMoneyBillWave,
  faDollarSign,
  faExchangeAlt,
  faMoneyBill,
  faPercentage,
  faCreditCard
} from '@fortawesome/free-solid-svg-icons';
import "./OrthodonticsPage.css";

export default function OrthodonticsPage() {
  const { user } = useContext(AuthContext);
  const { 
    procedures, 
    fetchOrthodontics,
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
  const [expandedFilters, setExpandedFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    if (user) {
      loadOrthodontics();
    }
  }, [user]);

  const loadOrthodontics = async () => {
    try {
      setLocalError("");
      clearError();
      await fetchOrthodontics();
    } catch (error) {
      console.error('Error al cargar ortodoncias:', error);
      setLocalError(error.message || 'Error al cargar ortodoncias');
    }
  };

  const applyFilters = async () => {
    try {
      setLocalError("");
      const filters = {};
      if (dateFilter.startDate) filters.startDate = dateFilter.startDate;
      if (dateFilter.endDate) filters.endDate = dateFilter.endDate;
      await fetchOrthodontics(filters);
    } catch (error) {
      console.error('Error al aplicar filtros:', error);
      setLocalError(error.message || 'Error al aplicar filtros');
    }
  };

  const clearFilters = async () => {
    try {
      setLocalError("");
      setDateFilter({ startDate: "", endDate: "" });
      setSearch("");
      await fetchOrthodontics();
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

  const filteredOrthodontics = procedures
    .filter(ortho => {
      if (!search.trim()) return true;
      
      const searchTerm = search.toLowerCase();
      return (
        ortho.procedure_description?.toLowerCase().includes(searchTerm) ||
        ortho.patient_name?.toLowerCase().includes(searchTerm) ||
        ortho.patient_identification?.includes(searchTerm) ||
        (ortho.external_doctor_name?.toLowerCase() || '').includes(searchTerm)
      );
    });

  const calculateOrthodonticEarnings = (orthodontic) => {
    const clinicPercentage = orthodontic.clinic_payment_percentage || 40;
    const doctorPercentage = orthodontic.doctor_payment_percentage || 60;
    
    const totalProcedureCordobas = orthodontic.total_procedure || 0;
    const clinicEarningsCordobas = orthodontic.clinic_payment_cordobas || (totalProcedureCordobas * clinicPercentage / 100);
    const doctorEarningsCordobas = orthodontic.doctor_payment_cordobas || (totalProcedureCordobas * doctorPercentage / 100);
    
    const totalProcedureDollars = orthodontic.total_procedure_usd || 0;
    const clinicEarningsDollars = orthodontic.clinic_payment_dollars || (totalProcedureDollars * clinicPercentage / 100);
    const doctorEarningsDollars = orthodontic.doctor_payment_dollars || (totalProcedureDollars * doctorPercentage / 100);
    
    return {
      totalProcedureCordobas,
      totalProcedureDollars,
      clinicEarningsCordobas,
      clinicEarningsDollars,
      doctorEarningsCordobas,
      doctorEarningsDollars,
      clinicPercentage,
      doctorPercentage,
      cordobasAmount: orthodontic.amount_cordobas || orthodontic.total_cost || 0,
      dollarsAmount: orthodontic.amount_dollars || orthodontic.total_cost_USD || 0
    };
  };

  const error = localError || contextError;

  const formatCurrencyUSD = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Calcular totales separados
  const calculateSeparateTotals = (procedure) => {
    const cordobas = procedure.amount_cordobas || procedure.total_cost || 0;
    const dollars = procedure.amount_dollars || procedure.total_cost_USD || 0;
    const exchangeRate = procedure.exchange_rate_used || 36.5;
    
    // Si solo hay total_procedure (neto), estimamos los bruto
    if (procedure.total_procedure && !cordobas && !dollars) {
      // Asumimos que es todo en córdobas
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

  if (loading && procedures.length === 0) {
    return (
      <div className="orthodontics-container">
        <div className="loading-message">
          <div className="loading-spinner"></div>
          <p>Cargando tratamientos de ortodoncia...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="orthodontics-container">
        <div className="error-message">
          <h3>❌ Error</h3>
          <p>{error}</p>
          <button onClick={loadOrthodontics} className="btn-retry">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="orthodontics-container">
      <div className="orthodontics-header">
        <h2>🔧 Ortodoncia</h2>
        <div className="orthodontics-tools">
          <div className="orthodontics-count">
            <span>{filteredOrthodontics.length}</span>
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
          <label className="filter-label">Buscar ortodoncias:</label>
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
            Busca por descripción del tratamiento, nombre del paciente, cédula o nombre del doctor externo
          </small>
        </div>
      </div>

      {/* Tabla de ortodoncias */}
      <div className="orthodontics-section">
        <h3>Tratamientos de Ortodoncia ({filteredOrthodontics.length})</h3>
        
        {filteredOrthodontics.length === 0 ? (
          <div className="no-results">
            <p>
              {search || dateFilter.startDate || dateFilter.endDate
                ? "No se encontraron tratamientos con los filtros aplicados."
                : "No hay tratamientos de ortodoncia registrados."}
            </p>
            <p className="no-results-help">
              Los tratamientos de ortodoncia se crean al completar una cita de ortodoncia y registrar los detalles.
            </p>
          </div>
        ) : (
          <div className="table-responsive-container">
            <table className="orthodontics-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>Descripción</th>
                  <th>Total C$</th>
                  <th>Total US$</th>
                  <th>Clínica C$</th>
                  <th>Doctora C$</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrthodontics.map((orthodontic) => {
                  const earnings = calculateOrthodonticEarnings(orthodontic);
                  const isExpanded = expandedRows[orthodontic.procedure_ID];
                  const hasExternalDoctor = orthodontic.theres_external_doctor || orthodontic.external_doctor;
                  const hasObservations = orthodontic.observations && orthodontic.observations.trim() !== "";
                  const mainPaymentMethod = getMainPaymentMethod(orthodontic);
                  const paymentIcon = getPaymentMethodIcon(mainPaymentMethod);
                  const paymentColor = getPaymentMethodColor(mainPaymentMethod);
                  
                  // Calcular totales separados
                  const separateTotals = calculateSeparateTotals(orthodontic);
                  
                  return (
                    <>
                      <tr key={orthodontic.procedure_ID} className={isExpanded ? "expanded-row" : ""}>
                        <td>
                          {orthodontic.procedure_date ? formatDate(orthodontic.procedure_date) : "N/A"}
                        </td>
                        <td className="patient-cell">
                          <div className="patient-info-compact">
                            <strong>{orthodontic.patient_name || "Paciente no especificado"}</strong>
                            <small>{orthodontic.patient_identification || "N/A"}</small>
                          </div>
                        </td>
                        <td className="description-cell">
                          <div className="description-content">
                            <strong>{orthodontic.procedure_description || "Sin descripción"}</strong>
                          </div>
                        </td>
                        
                        {/* Totales en ambas monedas con desglose */}
                        <td className="total-cordobas-cell">
                          <div className="total-amount-container">
                            <div className="total-amount cordobas">
                              {formatCurrency(earnings.totalProcedureCordobas)}
                            </div>
                            {separateTotals.cordobas > 0 && (
                              <div className="payment-breakdown">
                                <div className="breakdown-row">
                                  <span className="breakdown-label">Abono C$:</span>
                                  <span className="breakdown-value">{formatCurrency(separateTotals.cordobas)}</span>
                                </div>
                                <div className="breakdown-row method">
                                  <FontAwesomeIcon 
                                    icon={getPaymentMethodIcon(orthodontic.payment_method_cordobas)}
                                    style={{ color: getPaymentMethodColor(orthodontic.payment_method_cordobas) }}
                                  />
                                  <span>{orthodontic.payment_method_cordobas || 'No especificado'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="total-dollars-cell">
                          <div className="total-amount-container">
                            <div className="total-amount dollars">
                              {formatCurrencyUSD(earnings.totalProcedureDollars)}
                            </div>
                            {separateTotals.dollars > 0 && (
                              <div className="payment-breakdown">
                                <div className="breakdown-row">
                                  <span className="breakdown-label">Abono US$:</span>
                                  <span className="breakdown-value">{formatCurrencyUSD(separateTotals.dollars)}</span>
                                </div>
                                <div className="breakdown-row method">
                                  <FontAwesomeIcon 
                                    icon={getPaymentMethodIcon(orthodontic.payment_method_dollars)}
                                    style={{ color: getPaymentMethodColor(orthodontic.payment_method_dollars) }}
                                  />
                                  <span>{orthodontic.payment_method_dollars || 'No especificado'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Ganancias de clínica en córdobas */}
                        <td className="clinic-earnings-cordobas-cell">
                          <div className="earnings-amount-container">
                            <div className="earnings-amount clinic">
                              {formatCurrency(earnings.clinicEarningsCordobas)}
                            </div>
                            <div className="percentage-badge clinic">
                              {earnings.clinicPercentage}%
                            </div>
                          </div>
                        </td>
                        
                        {/* Ganancias de doctora en córdobas */}
                        <td className="doctor-earnings-cordobas-cell">
                          <div className="earnings-amount-container">
                            <div className="earnings-amount doctor">
                              {formatCurrency(earnings.doctorEarningsCordobas)}
                            </div>
                            <div className="percentage-badge doctor">
                              {earnings.doctorPercentage}%
                            </div>
                          </div>
                        </td>
                        
                        {/* Botón Ver/Detalles */}
                        <td className="actions-cell">
                          <button 
                            className="btn-view-details"
                            onClick={() => toggleRow(orthodontic.procedure_ID)}
                            title={isExpanded ? "Ocultar detalles" : "Ver detalles"}
                          >
                            <FontAwesomeIcon icon={isExpanded ? faEyeSlash : faEye} />
                            <span>{isExpanded ? "Ocultar" : "Ver"}</span>
                          </button>
                        </td>
                      </tr>
                      
                      {/* Fila expandida con LAYOUT HORIZONTAL */}
                      {isExpanded && (
                        <tr key={`${orthodontic.procedure_ID}-details`} className="details-row">
                          <td colSpan="8">
                            <div className="orthodontic-details">
                              <div className="details-header">
                                <h4>📋 Información Adicional del Tratamiento</h4>
                              </div>
                              
                              <div className="horizontal-details-grid">
                                {/* Observaciones del procedimiento */}
                                {hasObservations && (
                                  <div className="detail-card observations-card">
                                    <div className="detail-card-header">
                                      <FontAwesomeIcon icon={faClipboardList} />
                                      <h5>Observaciones del Procedimiento</h5>
                                    </div>
                                    <div className="detail-card-content">
                                      <div className="observations-content">
                                        <p>{orthodontic.observations}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Información de pagos con tasa de cambio */}
                                <div className="detail-card payment-details-card">
                                  <div className="detail-card-header">
                                    <FontAwesomeIcon icon={faMoneyBill} />
                                    <h5>Detalles de Pagos</h5>
                                  </div>
                                  <div className="detail-card-content">
                                    {/* Tasa de cambio */}
                                    <div className="exchange-rate-info">
                                      <div className="exchange-rate-row">
                                        <span className="exchange-rate-label">Tasa de cambio:</span>
                                        <span className="exchange-rate-value">
                                          <FontAwesomeIcon icon={faExchangeAlt} />
                                          C$ {separateTotals.exchangeRate} = US$ 1
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {/* Desglose de pagos en Córdobas */}
                                    {separateTotals.cordobas > 0 && (
                                      <div className="payment-currency-section cordobas-section">
                                        <h6 className="currency-title">
                                          <FontAwesomeIcon icon={faMoneyBillWave} />
                                          Pagos en Córdobas (C$)
                                        </h6>
                                        <div className="payment-details">
                                          <div className="payment-detail-row">
                                            <span className="payment-detail-label">Monto bruto:</span>
                                            <span className="payment-detail-value">
                                              {formatCurrency(orthodontic.gross_amount_cordobas || separateTotals.cordobas)}
                                            </span>
                                          </div>
                                          {orthodontic.pos_deduction_cordobas > 0 && (
                                            <div className="payment-detail-row deduction">
                                              <span className="payment-detail-label">Deducción POS:</span>
                                              <span className="payment-detail-value">
                                                -{formatCurrency(orthodontic.pos_deduction_cordobas)}
                                              </span>
                                            </div>
                                          )}
                                          <div className="payment-detail-row net">
                                            <span className="payment-detail-label">Monto neto:</span>
                                            <span className="payment-detail-value">
                                              {formatCurrency(orthodontic.net_amount_cordobas || separateTotals.cordobas)}
                                            </span>
                                          </div>
                                          <div className="payment-method-info">
                                            <FontAwesomeIcon 
                                              icon={getPaymentMethodIcon(orthodontic.payment_method_cordobas)}
                                              style={{ color: getPaymentMethodColor(orthodontic.payment_method_cordobas) }}
                                            />
                                            <span>{orthodontic.payment_method_cordobas || 'No especificado'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Desglose de pagos en Dólares */}
                                    {separateTotals.dollars > 0 && (
                                      <div className="payment-currency-section dollars-section">
                                        <h6 className="currency-title">
                                          <FontAwesomeIcon icon={faDollarSign} />
                                          Pagos en Dólares (US$)
                                        </h6>
                                        <div className="payment-details">
                                          <div className="payment-detail-row">
                                            <span className="payment-detail-label">Monto bruto:</span>
                                            <span className="payment-detail-value">
                                              {formatCurrencyUSD(orthodontic.gross_amount_dollars || separateTotals.dollars)}
                                            </span>
                                          </div>
                                          {orthodontic.pos_deduction_dollars > 0 && (
                                            <div className="payment-detail-row deduction">
                                              <span className="payment-detail-label">Deducción POS:</span>
                                              <span className="payment-detail-value">
                                                -{formatCurrencyUSD(orthodontic.pos_deduction_dollars)}
                                              </span>
                                            </div>
                                          )}
                                          <div className="payment-detail-row net">
                                            <span className="payment-detail-label">Monto neto:</span>
                                            <span className="payment-detail-value">
                                              {formatCurrencyUSD(orthodontic.net_amount_dollars || separateTotals.dollars)}
                                            </span>
                                          </div>
                                          <div className="payment-method-info">
                                            <FontAwesomeIcon 
                                              icon={getPaymentMethodIcon(orthodontic.payment_method_dollars)}
                                              style={{ color: getPaymentMethodColor(orthodontic.payment_method_dollars) }}
                                            />
                                            <span>{orthodontic.payment_method_dollars || 'No especificado'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Totales generales */}
                                    <div className="totals-summary">
                                      <div className="total-summary-row">
                                        <span className="total-summary-label">Total bruto (C$):</span>
                                        <span className="total-summary-value">
                                          {formatCurrency(orthodontic.total_cost || separateTotals.cordobas)}
                                        </span>
                                      </div>
                                      <div className="total-summary-row">
                                        <span className="total-summary-label">Total bruto (US$):</span>
                                        <span className="total-summary-value">
                                          {formatCurrencyUSD(orthodontic.total_cost_USD || separateTotals.dollars)}
                                        </span>
                                      </div>
                                      <div className="total-summary-row net-total">
                                        <span className="total-summary-label">Total neto (C$):</span>
                                        <span className="total-summary-value">
                                          {formatCurrency(orthodontic.total_procedure || separateTotals.cordobas)}
                                        </span>
                                      </div>
                                      <div className="total-summary-row net-total">
                                        <span className="total-summary-label">Total neto (US$):</span>
                                        <span className="total-summary-value">
                                          {formatCurrencyUSD(orthodontic.total_procedure_usd || separateTotals.dollars)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Distribución de Ganancias */}
                                <div className="detail-card earnings-card">
                                  <div className="detail-card-header">
                                    <FontAwesomeIcon icon={faStethoscope} />
                                    <h5>Distribución de Ganancias</h5>
                                  </div>
                                  <div className="detail-card-content">
                                    <div className="earnings-distribution">
                                      <div className="distribution-column clinic-column">
                                        <div className="distribution-header">
                                          <FontAwesomeIcon icon={faHospitalUser} />
                                          <h6>Clínica ({earnings.clinicPercentage}%)</h6>
                                        </div>
                                        <div className="distribution-amounts">
                                          <div className="amount-item">
                                            <span className="amount-label">C$:</span>
                                            <span className="amount-value clinic">
                                              {formatCurrency(earnings.clinicEarningsCordobas)}
                                            </span>
                                          </div>
                                          <div className="amount-item">
                                            <span className="amount-label">US$:</span>
                                            <span className="amount-value clinic">
                                              {formatCurrencyUSD(earnings.clinicEarningsDollars)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="distribution-column doctor-column">
                                        <div className="distribution-header">
                                          <FontAwesomeIcon icon={faUserDoctor} />
                                          <h6>Doctora ({earnings.doctorPercentage}%)</h6>
                                        </div>
                                        <div className="distribution-amounts">
                                          <div className="amount-item">
                                            <span className="amount-label">C$:</span>
                                            <span className="amount-value doctor">
                                              {formatCurrency(earnings.doctorEarningsCordobas)}
                                            </span>
                                          </div>
                                          <div className="amount-item">
                                            <span className="amount-label">US$:</span>
                                            <span className="amount-value doctor">
                                              {formatCurrencyUSD(earnings.doctorEarningsDollars)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Resumen total */}
                                    <div className="distribution-summary">
                                      <div className="summary-row">
                                        <span className="summary-label">Total tratamiento (C$):</span>
                                        <span className="summary-value total-cordobas">
                                          {formatCurrency(earnings.totalProcedureCordobas)}
                                        </span>
                                      </div>
                                      <div className="summary-row">
                                        <span className="summary-label">Total tratamiento (US$):</span>
                                        <span className="summary-value total-dollars">
                                          {formatCurrencyUSD(earnings.totalProcedureDollars)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Información de Doctor Externo */}
                                {hasExternalDoctor ? (
                                  <div className="detail-card doctor-card">
                                    <div className="detail-card-header">
                                      <FontAwesomeIcon icon={faUserDoctor} />
                                      <h5>Doctor Externo</h5>
                                    </div>
                                    <div className="detail-card-content">
                                      <div className="doctor-info-row">
                                        <span className="doctor-info-label">Nombre:</span>
                                        <span className="doctor-info-value">{orthodontic.external_doctor_name || orthodontic.external_doctor}</span>
                                      </div>
                                      {orthodontic.external_doctor_specialty && (
                                        <div className="doctor-info-row">
                                          <span className="doctor-info-label">Especialidad:</span>
                                          <span className="doctor-info-value">{orthodontic.external_doctor_specialty}</span>
                                        </div>
                                      )}
                                      <div className="doctor-info-row">
                                        <span className="doctor-info-label">Tipo de pago:</span>
                                        <span className="doctor-info-value">
                                          {orthodontic.external_doctor_payment_type === 'percentage' ? 'Porcentaje' : 'Cantidad fija'}
                                        </span>
                                      </div>
                                      
                                      {orthodontic.external_doctor_payment_type === 'percentage' ? (
                                        <div className="doctor-info-row">
                                          <span className="doctor-info-label">Porcentaje:</span>
                                          <span className="doctor-info-value">
                                            {orthodontic.external_doctor_payment_value}%
                                            <FontAwesomeIcon icon={faPercentage} className="percentage-icon" />
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="doctor-info-row">
                                          <span className="doctor-info-label">Monto fijo:</span>
                                          <span className="doctor-info-value">{formatCurrency(orthodontic.external_doctor_payment || 0)}</span>
                                        </div>
                                      )}
                                      
                                      {/* Pagos en ambas monedas */}
                                      <div className="doctor-payments-row">
                                        <div className="payment-item">
                                          <span className="payment-label">Pago C$:</span>
                                          <span className="payment-value">{formatCurrency(orthodontic.external_doctor_payment || 0)}</span>
                                        </div>
                                        {orthodontic.external_doctor_payment_usd && (
                                          <div className="payment-item">
                                            <span className="payment-label">Pago US$:</span>
                                            <span className="payment-value">{formatCurrencyUSD(orthodontic.external_doctor_payment_usd)}</span>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* Ajuste en ganancias después de pago externo */}
                                      <div className="external-doctor-impact">
                                        <h6>Impacto en distribución:</h6>
                                        <div className="impact-row">
                                          <span className="impact-label">Clínica recibe:</span>
                                          <div className="impact-values">
                                            <span className="impact-value cordobas">
                                              {formatCurrency(earnings.clinicEarningsCordobas - (orthodontic.external_doctor_payment || 0))}
                                            </span>
                                            <span className="impact-value dollars">
                                              {formatCurrencyUSD(earnings.clinicEarningsDollars - (orthodontic.external_doctor_payment_usd || 0))}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="detail-card no-external-card">
                                    <div className="detail-card-header">
                                      <FontAwesomeIcon icon={faUserDoctor} />
                                      <h5>Doctor Externo</h5>
                                    </div>
                                    <div className="detail-card-content">
                                      <p className="no-doctor-message">✅ No se registró doctor externo</p>
                                      <p className="additional-info">Las ganancias se distribuyen únicamente entre clínica y doctora.</p>
                                    </div>
                                  </div>
                                )}
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