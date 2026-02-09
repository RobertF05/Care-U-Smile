import React, { useContext, useState, useEffect } from "react";
import { AppContext } from "../../context/AppContext";
import { AuthContext } from "../../context/AuthContext";
import { formatDate, formatCurrency } from "../../utils/formatters";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFilter,
  faTimes,
  faSearch,
  faEye,
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
  faCalendarAlt,
  faFileMedical,
  faNotesMedical,
  faHospitalUser,
  faFileInvoiceDollar,
  faChartLine,
  faCalculator
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
  const [timeFilter, setTimeFilter] = useState(TIME_FILTERS.ALL);
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: ""
  });
  const [localError, setLocalError] = useState("");
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState(null);

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

  // FUNCIÓN SIMPLIFICADA DE FILTRADO
  const applyFilters = async () => {
    try {
      setLocalError("");
      
      const filters = {};
      
      if (dateFilter.startDate && dateFilter.endDate) {
        filters.startDate = dateFilter.startDate;
        filters.endDate = dateFilter.endDate;
      } else {
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
      setTimeFilter(TIME_FILTERS.ALL);
      setDateFilter({ startDate: "", endDate: "" });
      await fetchProceduresNormal({ timeFilter: TIME_FILTERS.ALL });
    } catch (error) {
      console.error('Error al limpiar filtros:', error);
      setLocalError(error.message || 'Error al limpiar filtros');
    }
  };

  // Abrir modal para ver procedimiento
  const openViewModal = (procedure) => {
    setSelectedProcedure(procedure);
    setViewModalOpen(true);
  };

  // Cerrar modal de vista
  const closeViewModal = () => {
    setViewModalOpen(false);
    setSelectedProcedure(null);
  };

  // CALCULO CORREGIDO PARA PROCEDIMIENTOS GENERALES
  const calculateClinicNetIncome = (procedure) => {
    // Usar total_procedure que YA incluye la deducción del POS
    // total_procedure = Monto bruto - deducción POS (si aplica)
    const totalProcedure = procedure.total_procedure || 0;
    
    // Restar pago al doctor externo si existe
    const externalDoctorPayment = procedure.external_doctor_payment || 0;
    
    // Monto neto = Total del procedimiento - Pago doctor externo
    const netIncome = Math.max(0, totalProcedure - externalDoctorPayment);
    
    return netIncome;
  };

  const calculateClinicNetIncomeUSD = (procedure) => {
    const totalProcedureUSD = procedure.total_procedure_usd || 0;
    const externalDoctorPaymentUSD = procedure.external_doctor_payment_usd || 0;
    
    const netIncomeUSD = Math.max(0, totalProcedureUSD - externalDoctorPaymentUSD);
    
    return netIncomeUSD;
  };

  // Calcular desglose completo para modal
  const calculateBreakdown = (procedure) => {
    const grossCordobas = procedure.gross_amount_cordobas || 
                         procedure.total_cost || 
                         procedure.total_procedure || 0;
    
    const grossDollars = procedure.gross_amount_dollars || 
                        procedure.total_cost_USD || 
                        procedure.total_procedure_usd || 0;
    
    const posDeductionCordobas = procedure.pos_deduction_cordobas || 0;
    const posDeductionDollars = procedure.pos_deduction_dollars || 0;
    
    const totalProcedureCordobas = procedure.total_procedure || 0;
    const totalProcedureDollars = procedure.total_procedure_usd || 0;
    
    const externalDoctorCordobas = procedure.external_doctor_payment || 0;
    const externalDoctorDollars = procedure.external_doctor_payment_usd || 0;
    
    const clinicNetCordobas = calculateClinicNetIncome(procedure);
    const clinicNetDollars = calculateClinicNetIncomeUSD(procedure);
    
    return {
      grossCordobas,
      grossDollars,
      posDeductionCordobas,
      posDeductionDollars,
      totalProcedureCordobas,
      totalProcedureDollars,
      externalDoctorCordobas,
      externalDoctorDollars,
      clinicNetCordobas,
      clinicNetDollars
    };
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

  // Formatear fecha para mostrar
  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return formatDate(dateString);
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return dateString;
    }
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
      {/* Modal para VER procedimiento (solo lectura) */}
      {viewModalOpen && selectedProcedure && (
        <div className="modal-backdrop" onClick={closeViewModal}>
          <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
            <h3><FontAwesomeIcon icon={faFileMedical} /> Información Completa del Procedimiento</h3>
            
            <div className="procedure-view-container">
              {/* Información básica */}
              <div className="view-section">
                <h4><FontAwesomeIcon icon={faFileMedical} /> Información del Procedimiento</h4>
                <div className="view-grid">
                  <div className="view-item">
                    <span className="view-label">Fecha del Procedimiento:</span>
                    <span className="view-value">{formatDisplayDate(selectedProcedure.procedure_date)}</span>
                  </div>
                  <div className="view-item">
                    <span className="view-label">Fecha de Creación:</span>
                    <span className="view-value">{formatDisplayDate(selectedProcedure.creation_date)}</span>
                  </div>
                  <div className="view-item full-width">
                    <span className="view-label">Descripción:</span>
                    <span className="view-value">{selectedProcedure.procedure_description || "Sin descripción"}</span>
                  </div>
                  <div className="view-item">
                    <span className="view-label">Tipo de Consulta Original:</span>
                    <span className="view-value">{selectedProcedure.original_query_type || selectedProcedure.procedure_description}</span>
                  </div>
                  {selectedProcedure.original_appointment_date && (
                    <div className="view-item">
                      <span className="view-label">Fecha Cita Original:</span>
                      <span className="view-value">{formatDisplayDate(selectedProcedure.original_appointment_date)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Información del paciente */}
              <div className="view-section">
                <h4><FontAwesomeIcon icon={faHospitalUser} /> Información del Paciente</h4>
                <div className="view-grid">
                  <div className="view-item">
                    <span className="view-label">Nombre:</span>
                    <span className="view-value">{selectedProcedure.patient_name || "Paciente no especificado"}</span>
                  </div>
                  <div className="view-item">
                    <span className="view-label">Cédula:</span>
                    <span className="view-value">{selectedProcedure.patient_identification || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Detalles financieros */}
              <div className="view-section">
                <h4><FontAwesomeIcon icon={faMoneyBillWave} /> Detalles Financieros</h4>
                
                {(() => {
                  const breakdown = calculateBreakdown(selectedProcedure);
                  return (
                    <>
                      {/* Resumen financiero */}
                      <div className="financial-summary">
                        <div className="total-card">
                          <div className="total-header">
                            <FontAwesomeIcon icon={faMoneyBill} />
                            <span>Total del Procedimiento</span>
                          </div>
                          <div className="total-amounts">
                            <div className="amount-cordobas">{formatCurrency(breakdown.totalProcedureCordobas)}</div>
                            <div className="amount-dollars">{formatCurrencyUSD(breakdown.totalProcedureDollars)}</div>
                          </div>
                          <div className="total-subtitle">
                            Ya incluye deducción POS si aplica
                          </div>
                        </div>
                      </div>

                      {/* Métodos de pago */}
                      {(selectedProcedure.amount_cordobas > 0 || selectedProcedure.amount_dollars > 0) && (
                        <div className="payment-methods-section">
                          <h5><FontAwesomeIcon icon={faCreditCard} /> Métodos de Pago</h5>
                          
                          {/* Pago en córdobas */}
                          {selectedProcedure.amount_cordobas > 0 && (
                            <div className="payment-method-card">
                              <div className="method-header">
                                <FontAwesomeIcon icon={faMoneyBill} />
                                <span className="method-name">Córdobas</span>
                              </div>
                              <div className="method-details">
                                <div className="method-row">
                                  <span className="method-label">Monto bruto:</span>
                                  <span className="method-value">{formatCurrency(breakdown.grossCordobas)}</span>
                                </div>
                                <div className="method-row">
                                  <span className="method-label">Método:</span>
                                  <span className="method-value">{selectedProcedure.payment_method_cordobas || 'No especificado'}</span>
                                </div>
                                {breakdown.posDeductionCordobas > 0 && (
                                  <div className="method-row deduction">
                                    <span className="method-label">Deducción POS:</span>
                                    <span className="method-value">-{formatCurrency(breakdown.posDeductionCordobas)}</span>
                                  </div>
                                )}
                                <div className="method-row net-amount">
                                  <span className="method-label">Neto después de POS:</span>
                                  <span className="method-value">{formatCurrency(breakdown.totalProcedureCordobas)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Pago en dólares */}
                          {selectedProcedure.amount_dollars > 0 && (
                            <div className="payment-method-card">
                              <div className="method-header">
                                <FontAwesomeIcon icon={faDollarSign} />
                                <span className="method-name">Dólares</span>
                              </div>
                              <div className="method-details">
                                <div className="method-row">
                                  <span className="method-label">Monto bruto:</span>
                                  <span className="method-value">{formatCurrencyUSD(breakdown.grossDollars)}</span>
                                </div>
                                <div className="method-row">
                                  <span className="method-label">Método:</span>
                                  <span className="method-value">{selectedProcedure.payment_method_dollars || 'No especificado'}</span>
                                </div>
                                {breakdown.posDeductionDollars > 0 && (
                                  <div className="method-row deduction">
                                    <span className="method-label">Deducción POS:</span>
                                    <span className="method-value">-{formatCurrencyUSD(breakdown.posDeductionDollars)}</span>
                                  </div>
                                )}
                                <div className="method-row net-amount">
                                  <span className="method-label">Neto después de POS:</span>
                                  <span className="method-value">{formatCurrencyUSD(breakdown.totalProcedureDollars)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Desglose de cálculo - NUEVO Y MEJORADO */}
                      <div className="breakdown-section">
                        <h5><FontAwesomeIcon icon={faCalculator} /> Desglose del Cálculo</h5>
                        <div className="breakdown-steps">
                          {/* Paso 1: Monto bruto */}
                          <div className="breakdown-step">
                            <div className="step-number">1</div>
                            <div className="step-content">
                              <span className="step-label">Monto bruto (pago del paciente):</span>
                              <div className="step-values">
                                <span className="step-value-cordobas">{formatCurrency(breakdown.grossCordobas)}</span>
                                <span className="step-value-dollars">{formatCurrencyUSD(breakdown.grossDollars)}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Paso 2: Deducción POS */}
                          {breakdown.posDeductionCordobas > 0 && (
                            <div className="breakdown-step deduction-step">
                              <div className="step-number">2</div>
                              <div className="step-content">
                                <span className="step-label">- Deducción del POS:</span>
                                <div className="step-values">
                                  <span className="step-value-cordobas">-{formatCurrency(breakdown.posDeductionCordobas)}</span>
                                  <span className="step-value-dollars">-{formatCurrencyUSD(breakdown.posDeductionDollars)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Paso 3: Total después de POS */}
                          <div className="breakdown-step result-step">
                            <div className="step-number">=</div>
                            <div className="step-content">
                              <span className="step-label">Total del procedimiento (después de POS):</span>
                              <div className="step-values">
                                <span className="step-value-cordobas">{formatCurrency(breakdown.totalProcedureCordobas)}</span>
                                <span className="step-value-dollars">{formatCurrencyUSD(breakdown.totalProcedureDollars)}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Paso 4: Pago doctor externo */}
                          {breakdown.externalDoctorCordobas > 0 && (
                            <div className="breakdown-step deduction-step">
                              <div className="step-number">3</div>
                              <div className="step-content">
                                <span className="step-label">- Pago al doctor externo:</span>
                                <div className="step-values">
                                  <span className="step-value-cordobas">-{formatCurrency(breakdown.externalDoctorCordobas)}</span>
                                  <span className="step-value-dollars">-{formatCurrencyUSD(breakdown.externalDoctorDollars)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Paso 5: Ganancia neta clínica */}
                          <div className="breakdown-step final-step">
                            <div className="step-number">=</div>
                            <div className="step-content">
                              <span className="step-label final-label">GANANCIA NETA DE LA CLÍNICA:</span>
                              <div className="step-values final-values">
                                <span className="step-value-cordobas final-cordobas">{formatCurrency(breakdown.clinicNetCordobas)}</span>
                                <span className="step-value-dollars final-dollars">{formatCurrencyUSD(breakdown.clinicNetDollars)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Resumen final */}
                      <div className="final-summary">
                        <div className="summary-card net-summary">
                          <div className="summary-header">
                            <FontAwesomeIcon icon={faChartLine} />
                            <span>Ganancia neta de la clínica</span>
                          </div>
                          <div className="summary-amounts">
                            <div className="summary-amount cordobas">
                              <span className="amount-label">Córdobas:</span>
                              <span className="amount-value">{formatCurrency(breakdown.clinicNetCordobas)}</span>
                            </div>
                            <div className="summary-amount dollars">
                              <span className="amount-label">Dólares:</span>
                              <span className="amount-value">{formatCurrencyUSD(breakdown.clinicNetDollars)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Tasa de cambio */}
                <div className="exchange-rate-section">
                  <FontAwesomeIcon icon={faExchangeAlt} />
                  <span>Tasa de cambio utilizada: {selectedProcedure.exchange_rate_used || 36.5} C$/US$</span>
                </div>
              </div>

              {/* Doctor externo */}
              {(selectedProcedure.external_doctor_name || selectedProcedure.external_doctor_payment > 0) && (
                <div className="view-section">
                  <h4><FontAwesomeIcon icon={faUserDoctor} /> Doctor Externo</h4>
                  <div className="view-grid">
                    {selectedProcedure.external_doctor_name && (
                      <div className="view-item">
                        <span className="view-label">Nombre:</span>
                        <span className="view-value">{selectedProcedure.external_doctor_name}</span>
                      </div>
                    )}
                    {selectedProcedure.external_doctor_specialty && (
                      <div className="view-item">
                        <span className="view-label">Especialidad:</span>
                        <span className="view-value">{selectedProcedure.external_doctor_specialty}</span>
                      </div>
                    )}
                    {selectedProcedure.external_doctor_payment > 0 && (
                      <div className="view-item">
                        <span className="view-label">Pago al doctor:</span>
                        <span className="view-value">{formatCurrency(selectedProcedure.external_doctor_payment)}</span>
                      </div>
                    )}
                    {selectedProcedure.external_doctor_payment_type && (
                      <div className="view-item">
                        <span className="view-label">Tipo de pago:</span>
                        <span className="view-value">
                          {selectedProcedure.external_doctor_payment_type === 'fixed' ? 'Monto fijo' : 'Porcentaje'}
                        </span>
                      </div>
                    )}
                    {selectedProcedure.external_doctor_percentage && (
                      <div className="view-item">
                        <span className="view-label">Porcentaje:</span>
                        <span className="view-value">{selectedProcedure.external_doctor_percentage}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Observaciones */}
              {selectedProcedure.observations && (
                <div className="view-section">
                  <h4><FontAwesomeIcon icon={faNotesMedical} /> Observaciones</h4>
                  <div className="observations-content">
                    <p>{selectedProcedure.observations}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={closeViewModal}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Encabezado de la página */}
      <div className="procedures-header">
        <h2><FontAwesomeIcon icon={faFileMedical} /> Procedimientos Regulares</h2>
        <div className="procedures-tools">
          <div className="procedures-count">
            <span>{filteredProcedures.length}</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="filters-container">
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
        
        <div className="date-filters">
          <div className="filter-group">
            <label>Desde:</label>
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={(e) => setDateFilter({...dateFilter, startDate: e.target.value})}
            />
          </div>
          <div className="filter-group">
            <label>Hasta:</label>
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
                  <th>Clínica Neto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcedures.map((procedure) => {
                  const clinicNetIncome = calculateClinicNetIncome(procedure);
                  const hasPOS = (procedure.pos_deduction_cordobas || 0) > 0;
                  const hasExternalDoctor = (procedure.external_doctor_payment || 0) > 0;
                  
                  return (
                    <tr key={procedure.procedure_ID}>
                      <td>
                        {formatDisplayDate(procedure.procedure_date)}
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
                      
                      <td className="total-cordobas-cell">
                        {formatCurrency(procedure.total_procedure || procedure.total_cost || 0)}
                      </td>
                      
                      <td className="total-dollars-cell">
                        {formatCurrencyUSD(procedure.total_procedure_usd || procedure.total_cost_USD || 0)}
                      </td>
                      
                      <td className="clinic-net-cell">
                        <div className="net-amount-display">
                          <div className="net-main-amount">
                            {formatCurrency(clinicNetIncome)}
                          </div>
                          <div className="net-details">
                            {hasPOS && (
                              <small className="net-indicator has-pos">
                                <FontAwesomeIcon icon={faCreditCard} /> POS
                              </small>
                            )}
                            {hasExternalDoctor && (
                              <small className="net-indicator has-doctor">
                                <FontAwesomeIcon icon={faUserDoctor} /> Dr. Ext.
                              </small>
                            )}
                          </div>
                        </div>
                      </td>
                      
                      <td className="actions-cell">
                        <button 
                          className="btn-view"
                          onClick={() => openViewModal(procedure)}
                          title="Ver información completa"
                        >
                          <FontAwesomeIcon icon={faEye} />
                          Ver
                        </button>
                      </td>
                    </tr>
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