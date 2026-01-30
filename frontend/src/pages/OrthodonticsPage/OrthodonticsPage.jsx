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
  faUserDoctor,
  faHospitalUser
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
  const [expandedStats, setExpandedStats] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  // Cargar ortodoncias al montar
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

  // Aplicar filtros
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

  // Limpiar filtros
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

  // Toggle para expandir/contraer fila
  const toggleRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Filtrar ortodoncias por búsqueda
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

  // Calcular ganancias para cada ortodoncia en ambas monedas
  const calculateOrthodonticEarnings = (orthodontic) => {
    const clinicPercentage = orthodontic.clinic_payment_percentage || 40;
    const doctorPercentage = orthodontic.doctor_payment_percentage || 60;
    
    // Montos en córdobas
    const totalProcedureCordobas = orthodontic.total_procedure || 0;
    const clinicEarningsCordobas = orthodontic.clinic_payment_cordobas || (totalProcedureCordobas * clinicPercentage / 100);
    const doctorEarningsCordobas = orthodontic.doctor_payment_cordobas || (totalProcedureCordobas * doctorPercentage / 100);
    
    // Montos en dólares
    const totalProcedureDollars = orthodontic.total_procedure_usd || 0;
    const clinicEarningsDollars = orthodontic.clinic_payment_dollars || (totalProcedureDollars * clinicPercentage / 100);
    const doctorEarningsDollars = orthodontic.doctor_payment_dollars || (totalProcedureDollars * doctorPercentage / 100);
    
    // Pagos recibidos
    const cordobasAmount = orthodontic.amount_cordobas || orthodontic.total_cost || 0;
    const dollarsAmount = orthodontic.amount_dollars || orthodontic.total_cost_USD || 0;
    
    return {
      totalProcedureCordobas,
      totalProcedureDollars,
      clinicEarningsCordobas,
      clinicEarningsDollars,
      doctorEarningsCordobas,
      doctorEarningsDollars,
      clinicPercentage,
      doctorPercentage,
      cordobasAmount,
      dollarsAmount,
      isMixed: cordobasAmount > 0 && dollarsAmount > 0
    };
  };

  // Calcular estadísticas totales en ambas monedas
  const calculateTotalEarnings = () => {
    let totalClinicEarningsCordobas = 0;
    let totalClinicEarningsDollars = 0;
    let totalDoctorEarningsCordobas = 0;
    let totalDoctorEarningsDollars = 0;
    let totalProcedureCordobas = 0;
    let totalProcedureDollars = 0;
    let totalCordobas = 0;
    let totalDollars = 0;
    let totalExternalDoctorPaymentsCordobas = 0;
    let totalExternalDoctorPaymentsDollars = 0;
    let externalDoctorCount = 0;
    let mixedPaymentCount = 0;
    
    filteredOrthodontics.forEach(ortho => {
      const earnings = calculateOrthodonticEarnings(ortho);
      totalClinicEarningsCordobas += earnings.clinicEarningsCordobas;
      totalClinicEarningsDollars += earnings.clinicEarningsDollars;
      totalDoctorEarningsCordobas += earnings.doctorEarningsCordobas;
      totalDoctorEarningsDollars += earnings.doctorEarningsDollars;
      totalProcedureCordobas += earnings.totalProcedureCordobas;
      totalProcedureDollars += earnings.totalProcedureDollars;
      totalCordobas += earnings.cordobasAmount;
      totalDollars += earnings.dollarsAmount;
      
      if (earnings.isMixed) mixedPaymentCount++;
      
      // Contar pagos a doctores externos
      if (ortho.theres_external_doctor || ortho.external_doctor) {
        externalDoctorCount++;
        totalExternalDoctorPaymentsCordobas += ortho.external_doctor_payment || 0;
        totalExternalDoctorPaymentsDollars += ortho.external_doctor_payment_usd || 0;
      }
    });
    
    return {
      totalClinicEarningsCordobas,
      totalClinicEarningsDollars,
      totalDoctorEarningsCordobas,
      totalDoctorEarningsDollars,
      totalProcedureCordobas,
      totalProcedureDollars,
      totalCordobas,
      totalDollars,
      totalExternalDoctorPaymentsCordobas,
      totalExternalDoctorPaymentsDollars,
      externalDoctorCount,
      mixedPaymentCount,
      count: filteredOrthodontics.length,
      avgClinicCordobas: filteredOrthodontics.length > 0 ? totalClinicEarningsCordobas / filteredOrthodontics.length : 0,
      avgClinicDollars: filteredOrthodontics.length > 0 ? totalClinicEarningsDollars / filteredOrthodontics.length : 0,
      avgDoctorCordobas: filteredOrthodontics.length > 0 ? totalDoctorEarningsCordobas / filteredOrthodontics.length : 0,
      avgDoctorDollars: filteredOrthodontics.length > 0 ? totalDoctorEarningsDollars / filteredOrthodontics.length : 0
    };
  };

  const totalEarnings = calculateTotalEarnings();
  
  // Manejar errores
  const error = localError || contextError;

  // Formatear moneda en dólares
  const formatCurrencyUSD = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
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

      {/* Estadísticas desplegables */}
      <div className={`appointments-stats ${expandedStats ? 'expanded' : ''}`}>
        <div className="stats-header-mobile" onClick={() => setExpandedStats(!expandedStats)}>
          <div className="stats-header-content">
            <h3 className="stats-title">
              <FontAwesomeIcon icon={faChartBar} />
              Estadísticas de Ortodoncia
            </h3>
            <div className="stats-summary-mobile">
              <span className="stat-summary-item">Total: {totalEarnings.count}</span>
              <span className="stat-summary-item">C$ {formatCurrency(totalEarnings.totalProcedureCordobas)}</span>
              <span className="stat-summary-item">US$ {formatCurrencyUSD(totalEarnings.totalProcedureDollars)}</span>
            </div>
          </div>
          <FontAwesomeIcon 
            icon={expandedStats ? faChevronUp : faChevronDown} 
            className="stats-toggle-icon"
          />
        </div>
        
        <div className="stats-grid-container">
          <div className="stat-card total-orthodontics">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faChartBar} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{totalEarnings.count}</div>
              <div className="stat-label">Tratamientos</div>
            </div>
          </div>
          
          <div className="stat-card total-income-cordobas">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faMoneyBillWave} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(totalEarnings.totalProcedureCordobas)}</div>
              <div className="stat-label">Total C$</div>
            </div>
          </div>
          
          <div className="stat-card total-income-dollars">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faDollarSign} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrencyUSD(totalEarnings.totalProcedureDollars)}</div>
              <div className="stat-label">Total US$</div>
            </div>
          </div>
          
          <div className="stat-card clinic-earnings-cordobas">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faHospitalUser} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(totalEarnings.totalClinicEarningsCordobas)}</div>
              <div className="stat-label">Clínica C$</div>
            </div>
          </div>
          
          <div className="stat-card clinic-earnings-dollars">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faDollarSign} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrencyUSD(totalEarnings.totalClinicEarningsDollars)}</div>
              <div className="stat-label">Clínica US$</div>
            </div>
          </div>
          
          <div className="stat-card doctor-earnings-cordobas">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faUserDoctor} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(totalEarnings.totalDoctorEarningsCordobas)}</div>
              <div className="stat-label">Doctora C$</div>
            </div>
          </div>
          
          <div className="stat-card doctor-earnings-dollars">
            <div className="stat-icon">
              <FontAwesomeIcon icon={faDollarSign} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrencyUSD(totalEarnings.totalDoctorEarningsDollars)}</div>
              <div className="stat-label">Doctora US$</div>
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

      {/* Tabla de ortodoncias simplificada */}
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
                  <th>Clínica US$</th>
                  <th>Doctora C$</th>
                  <th>Doctora US$</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrthodontics.map((orthodontic) => {
                  const earnings = calculateOrthodonticEarnings(orthodontic);
                  const isExpanded = expandedRows[orthodontic.procedure_ID];
                  
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
                        
                        {/* Totales en ambas monedas */}
                        <td className="total-cordobas-cell">
                          <div className="total-amount cordobas">
                            {formatCurrency(earnings.totalProcedureCordobas)}
                          </div>
                        </td>
                        
                        <td className="total-dollars-cell">
                          <div className="total-amount dollars">
                            {formatCurrencyUSD(earnings.totalProcedureDollars)}
                          </div>
                        </td>
                        
                        {/* Ganancias de clínica en ambas monedas */}
                        <td className="clinic-earnings-cordobas-cell">
                          <div className="earnings-amount clinic">
                            {formatCurrency(earnings.clinicEarningsCordobas)}
                          </div>
                          <div className="percentage-badge">
                            {earnings.clinicPercentage}%
                          </div>
                        </td>
                        
                        <td className="clinic-earnings-dollars-cell">
                          <div className="earnings-amount clinic">
                            {formatCurrencyUSD(earnings.clinicEarningsDollars)}
                          </div>
                          <div className="percentage-badge">
                            {earnings.clinicPercentage}%
                          </div>
                        </td>
                        
                        {/* Ganancias de doctora en ambas monedas */}
                        <td className="doctor-earnings-cordobas-cell">
                          <div className="earnings-amount doctor">
                            {formatCurrency(earnings.doctorEarningsCordobas)}
                          </div>
                          <div className="percentage-badge">
                            {earnings.doctorPercentage}%
                          </div>
                        </td>
                        
                        <td className="doctor-earnings-dollars-cell">
                          <div className="earnings-amount doctor">
                            {formatCurrencyUSD(earnings.doctorEarningsDollars)}
                          </div>
                          <div className="percentage-badge">
                            {earnings.doctorPercentage}%
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
                      
                      {/* Fila expandida con detalles */}
                      {isExpanded && (
                        <tr key={`${orthodontic.procedure_ID}-details`} className="details-row">
                          <td colSpan="10">
                            <div className="orthodontic-details">
                              <div className="details-header">
                                <h4>📋 Detalles del Tratamiento de Ortodoncia</h4>
                              </div>
                              
                              <div className="details-grid">
                                
                                {/* Información del tratamiento */}
                                <div className="details-section treatment-info">
                                  <h5>🔧 Detalles del Tratamiento</h5>
                                  <div className="details-content">
                                    <p><strong>Descripción:</strong> {orthodontic.procedure_description || "N/A"}</p>
                                    <p><strong>Fecha:</strong> {orthodontic.procedure_date ? formatDate(orthodontic.procedure_date) : "N/A"}</p>
                                    <p><strong>Observaciones:</strong> {orthodontic.observations || "Ninguna"}</p>
                                  </div>
                                </div>
                                
                                {/* Pagos */}
                                <div className="details-section payments-info">
                                  <h5>💰 Pagos Recibidos</h5>
                                  <div className="details-content">
                                    <div className="payment-row">
                                      <div className="payment-column">
                                        <h6>En Córdobas (C$)</h6>
                                        <p><strong>Cantidad:</strong> {formatCurrency(earnings.cordobasAmount)}</p>
                                        <p><strong>Método:</strong> {orthodontic.payment_method_cordobas || "No especificado"}</p>
                                        {orthodontic.payment_method_cordobas === 'POS' && (
                                          <>
                                            <p><strong>Deducción POS (5.5%):</strong> -{formatCurrency(orthodontic.pos_deduction_cordobas || 0)}</p>
                                            <p><strong>Neto:</strong> {formatCurrency(orthodontic.net_amount_cordobas || earnings.cordobasAmount)}</p>
                                          </>
                                        )}
                                      </div>
                                      <div className="payment-column">
                                        <h6>En Dólares (US$)</h6>
                                        <p><strong>Cantidad:</strong> {formatCurrencyUSD(earnings.dollarsAmount)}</p>
                                        <p><strong>Método:</strong> {orthodontic.payment_method_dollars || "No especificado"}</p>
                                        {orthodontic.payment_method_dollars === 'POS' && (
                                          <>
                                            <p><strong>Deducción POS (5.5%):</strong> -{formatCurrencyUSD(orthodontic.pos_deduction_dollars || 0)}</p>
                                            <p><strong>Neto:</strong> {formatCurrencyUSD(orthodontic.net_amount_dollars || earnings.dollarsAmount)}</p>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Totales */}
                                    <div className="total-summary">
                                      <div className="total-row">
                                        <span>Total Bruto (C$):</span>
                                        <span>{formatCurrency(orthodontic.gross_amount_cordobas || earnings.cordobasAmount)}</span>
                                      </div>
                                      <div className="total-row">
                                        <span>Total Bruto (US$):</span>
                                        <span>{formatCurrencyUSD(orthodontic.gross_amount_dollars || earnings.dollarsAmount)}</span>
                                      </div>
                                      {orthodontic.total_pos_deduction > 0 && (
                                        <div className="total-row deduction">
                                          <span>Total Deducciones POS (C$):</span>
                                          <span>-{formatCurrency(orthodontic.total_pos_deduction)}</span>
                                        </div>
                                      )}
                                      <div className="total-row final">
                                        <span><strong>Total Neto (C$):</strong></span>
                                        <span><strong>{formatCurrency(earnings.totalProcedureCordobas)}</strong></span>
                                      </div>
                                      <div className="total-row final">
                                        <span><strong>Total Neto (US$):</strong></span>
                                        <span><strong>{formatCurrencyUSD(earnings.totalProcedureDollars)}</strong></span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Distribución de ganancias */}
                                <div className="details-section earnings-distribution">
                                  <h5>📈 Distribución de Ganancias</h5>
                                  <div className="details-content">
                                    <div className="distribution-header">
                                      <div className="distribution-title">Clínica ({earnings.clinicPercentage}%)</div>
                                      <div className="distribution-title">Doctora ({earnings.doctorPercentage}%)</div>
                                    </div>
                                    
                                    <div className="distribution-row">
                                      <div className="distribution-column clinic">
                                        <h6>En Córdobas (C$)</h6>
                                        <p><strong>Monto:</strong> {formatCurrency(earnings.clinicEarningsCordobas)}</p>
                                        <p><strong>Porcentaje:</strong> {earnings.clinicPercentage}%</p>
                                      </div>
                                      <div className="distribution-column doctor">
                                        <h6>En Córdobas (C$)</h6>
                                        <p><strong>Monto:</strong> {formatCurrency(earnings.doctorEarningsCordobas)}</p>
                                        <p><strong>Porcentaje:</strong> {earnings.doctorPercentage}%</p>
                                      </div>
                                    </div>
                                    
                                    <div className="distribution-row">
                                      <div className="distribution-column clinic">
                                        <h6>En Dólares (US$)</h6>
                                        <p><strong>Monto:</strong> {formatCurrencyUSD(earnings.clinicEarningsDollars)}</p>
                                        <p><strong>Porcentaje:</strong> {earnings.clinicPercentage}%</p>
                                      </div>
                                      <div className="distribution-column doctor">
                                        <h6>En Dólares (US$)</h6>
                                        <p><strong>Monto:</strong> {formatCurrencyUSD(earnings.doctorEarningsDollars)}</p>
                                        <p><strong>Porcentaje:</strong> {earnings.doctorPercentage}%</p>
                                      </div>
                                    </div>
                                    
                                    {/* Ganancias netas después de doctor externo */}
                                    {(orthodontic.theres_external_doctor || orthodontic.external_doctor) && (
                                      <div className="net-earnings">
                                        <h6>Ganancias Netas después de pago a doctor externo:</h6>
                                        <div className="net-earnings-row">
                                          <div className="net-earnings-column">
                                            <p><strong>Clínica C$:</strong> {formatCurrency(earnings.clinicEarningsCordobas - (orthodontic.external_doctor_payment || 0))}</p>
                                            <p><strong>Clínica US$:</strong> {formatCurrencyUSD(earnings.clinicEarningsDollars - (orthodontic.external_doctor_payment_usd || 0))}</p>
                                          </div>
                                          <div className="net-earnings-column">
                                            <p><strong>Doctora C$:</strong> {formatCurrency(earnings.doctorEarningsCordobas)}</p>
                                            <p><strong>Doctora US$:</strong> {formatCurrencyUSD(earnings.doctorEarningsDollars)}</p>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Doctor Externo (si aplica) */}
                                {(orthodontic.theres_external_doctor || orthodontic.external_doctor) && (
                                  <div className="details-section external-doctor-info">
                                    <h5>👨‍⚕️ Doctor Externo</h5>
                                    <div className="details-content">
                                      <p><strong>Nombre:</strong> {orthodontic.external_doctor_name || orthodontic.external_doctor || "N/A"}</p>
                                      <p><strong>Especialidad:</strong> {orthodontic.external_doctor_specialty || "N/A"}</p>
                                      <p><strong>Tipo de pago:</strong> {orthodontic.external_doctor_payment_type === 'percentage' ? 'Porcentaje' : 'Cantidad fija'}</p>
                                      <p><strong>Valor:</strong> {orthodontic.external_doctor_payment_type === 'percentage' ? 
                                        `${orthodontic.external_doctor_payment_value}%` : 
                                        formatCurrency(orthodontic.external_doctor_payment)} ({orthodontic.external_doctor_payment_currency})</p>
                                      {orthodontic.external_doctor_payment_usd && (
                                        <p><strong>Equivalente en US$:</strong> {formatCurrencyUSD(orthodontic.external_doctor_payment_usd)}</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Información adicional */}
                                <div className="details-section additional-info">
                                  <h5>📝 Información Adicional</h5>
                                  <div className="details-content">
                                    <p><strong>Tipo de cambio usado:</strong> C$ {orthodontic.exchange_rate_used || "36.5"} por US$ 1</p>
                                    <p><strong>Fecha de creación:</strong> {orthodontic.creation_date ? formatDate(orthodontic.creation_date) : "N/A"}</p>
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