import React, { useContext, useEffect, useState } from "react";
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
  faFileMedical,
  faHospitalUser,
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
  faNotesMedical,
  faChartLine,
  faTooth,
  faTeeth,
  faCalculator,
  faHandHoldingUsd,
  faUserMd,
  faBuilding,
  faChartPie
} from '@fortawesome/free-solid-svg-icons';
import "./OrthodonticsPage.css";

// Definir filtros de tiempo
const TIME_FILTERS = {
  TODAY: 'today',
  THIS_WEEK: 'thisWeek',
  THIS_MONTH: 'thisMonth',
  ALL: 'all'
};

export default function OrthodonticsPage() {
  const { user } = useContext(AuthContext);
  const { 
    orthodonticProcedures,
    fetchOrthodontics,
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
  const [selectedOrthodontic, setSelectedOrthodontic] = useState(null);

  useEffect(() => {
    if (user) {
      loadOrthodontics();
    }
  }, [user]);

  const loadOrthodontics = async () => {
    try {
      setLocalError("");
      clearError();
      await fetchOrthodontics({ 
        timeFilter,
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate
      });
    } catch (error) {
      console.error('Error al cargar ortodoncias:', error);
      setLocalError(error.message || 'Error al cargar ortodoncias');
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
      
      console.log('🔍 Aplicando filtros (ortodoncia):', filters);
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
      setTimeFilter(TIME_FILTERS.ALL);
      setSearch("");
      await fetchOrthodontics({ timeFilter: TIME_FILTERS.ALL });
    } catch (error) {
      console.error('Error al limpiar filtros:', error);
      setLocalError(error.message || 'Error al limpiar filtros');
    }
  };

  // Abrir modal para ver ortodoncia
  const openViewModal = (orthodontic) => {
    setSelectedOrthodontic(orthodontic);
    setViewModalOpen(true);
  };

  // Cerrar modal de vista
  const closeViewModal = () => {
    setViewModalOpen(false);
    setSelectedOrthodontic(null);
  };

  // CALCULO CORREGIDO PARA ORTODONCIA
  const calculateOrthodonticEarnings = (orthodontic) => {
    // Total del procedimiento (ya incluye deducción POS si aplica)
    const totalProcedureCordobas = orthodontic.total_procedure || 0;
    const totalProcedureDollars = orthodontic.total_procedure_usd || 0;
    
    // Porcentajes
    const clinicPercentage = orthodontic.clinic_payment_percentage || 40;
    const doctorPercentage = orthodontic.doctor_payment_percentage || 60;
    
    // Pago del doctor externo si existe
    const externalDoctorPayment = orthodontic.external_doctor_payment || 0;
    const externalDoctorPaymentUSD = orthodontic.external_doctor_payment_usd || 0;
    
    // Calcular distribución según si hay doctor externo
    if (orthodontic.has_external_doctor && orthodontic.external_doctor_percentage > 0) {
      const orthoPercentage = orthodontic.ortho_doctor_percentage || 60;
      const externalPercentage = orthodontic.external_doctor_percentage || 0;
      
      // Total del procedimiento se reparte según porcentajes
      const orthoPaymentCordobas = totalProcedureCordobas * (orthoPercentage / 100);
      const externalPaymentCordobas = totalProcedureCordobas * (externalPercentage / 100);
      const clinicPaymentCordobas = totalProcedureCordobas - orthoPaymentCordobas - externalPaymentCordobas;
      
      const orthoPaymentDollars = totalProcedureDollars * (orthoPercentage / 100);
      const externalPaymentDollars = totalProcedureDollars * (externalPercentage / 100);
      const clinicPaymentDollars = totalProcedureDollars - orthoPaymentDollars - externalPaymentDollars;
      
      return {
        totalProcedureCordobas,
        totalProcedureDollars,
        clinicPaymentCordobas,
        clinicPaymentDollars,
        doctorPaymentCordobas: orthoPaymentCordobas,
        doctorPaymentDollars: orthoPaymentDollars,
        externalPaymentCordobas,
        externalPaymentDollars,
        clinicPercentage: (clinicPaymentCordobas / totalProcedureCordobas) * 100,
        doctorPercentage: orthoPercentage,
        externalPercentage,
        hasExternalDoctor: true
      };
    } else {
      // Ortodoncia normal sin doctor externo
      const clinicPaymentCordobas = totalProcedureCordobas * (clinicPercentage / 100);
      const clinicPaymentDollars = totalProcedureDollars * (clinicPercentage / 100);
      const doctorPaymentCordobas = totalProcedureCordobas * (doctorPercentage / 100);
      const doctorPaymentDollars = totalProcedureDollars * (doctorPercentage / 100);
      
      return {
        totalProcedureCordobas,
        totalProcedureDollars,
        clinicPaymentCordobas,
        clinicPaymentDollars,
        doctorPaymentCordobas,
        doctorPaymentDollars,
        externalPaymentCordobas: 0,
        externalPaymentDollars: 0,
        clinicPercentage,
        doctorPercentage,
        externalPercentage: 0,
        hasExternalDoctor: false
      };
    }
  };

  // Calcular desglose completo para modal
  const calculateOrthodonticBreakdown = (orthodontic) => {
    const earnings = calculateOrthodonticEarnings(orthodontic);
    
    // Montos brutos (sin deducción POS)
    const grossCordobas = orthodontic.gross_amount_cordobas || 
                         orthodontic.total_cost || 
                         orthodontic.total_procedure || 0;
    
    const grossDollars = orthodontic.gross_amount_dollars || 
                        orthodontic.total_cost_USD || 
                        orthodontic.total_procedure_usd || 0;
    
    // Deducción POS
    const posDeductionCordobas = orthodontic.pos_deduction_cordobas || 0;
    const posDeductionDollars = orthodontic.pos_deduction_dollars || 0;
    
    return {
      ...earnings,
      grossCordobas,
      grossDollars,
      posDeductionCordobas,
      posDeductionDollars,
      exchangeRate: orthodontic.exchange_rate || 36.5
    };
  };

  const filteredOrthodontics = orthodonticProcedures
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

  if (loading && orthodonticProcedures.length === 0) {
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
      {/* Modal para VER ortodoncia (solo lectura) */}
      {viewModalOpen && selectedOrthodontic && (
        <div className="modal-backdrop" onClick={closeViewModal}>
          <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
            <h3><FontAwesomeIcon icon={faTooth} /> Información Completa del Tratamiento de Ortodoncia</h3>
            
            <div className="orthodontic-view-container">
              {(() => {
                const breakdown = calculateOrthodonticBreakdown(selectedOrthodontic);
                return (
                  <>
                    {/* Información básica */}
                    <div className="view-section">
                      <h4><FontAwesomeIcon icon={faFileMedical} /> Información del Tratamiento</h4>
                      <div className="view-grid">
                        <div className="view-item">
                          <span className="view-label">Fecha del Tratamiento:</span>
                          <span className="view-value">{formatDisplayDate(selectedOrthodontic.procedure_date)}</span>
                        </div>
                        <div className="view-item">
                          <span className="view-label">Fecha de Creación:</span>
                          <span className="view-value">{formatDisplayDate(selectedOrthodontic.creation_date)}</span>
                        </div>
                        <div className="view-item full-width">
                          <span className="view-label">Descripción:</span>
                          <span className="view-value">{selectedOrthodontic.procedure_description || "Sin descripción"}</span>
                        </div>
                        {selectedOrthodontic.observations && (
                          <div className="view-item full-width">
                            <span className="view-label">Observaciones:</span>
                            <span className="view-value multiline">{selectedOrthodontic.observations}</span>
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
                          <span className="view-value">{selectedOrthodontic.patient_name || "Paciente no especificado"}</span>
                        </div>
                        <div className="view-item">
                          <span className="view-label">Cédula:</span>
                          <span className="view-value">{selectedOrthodontic.patient_identification || "N/A"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Distribución de porcentajes */}
                    <div className="view-section">
                      <h4><FontAwesomeIcon icon={faChartLine} /> Distribución de Ganancia</h4>
                      
                      <div className="percentage-distribution-view">
                        <div className="percentage-card clinic-percentage">
                          <div className="percentage-header">
                            <FontAwesomeIcon icon={faHospitalUser} />
                            <span className="percentage-title">Clínica</span>
                          </div>
                          <div className="percentage-value">{breakdown.clinicPercentage.toFixed(1)}%</div>
                          <div className="percentage-amounts">
                            <span className="amount-cordobas">{formatCurrency(breakdown.clinicPaymentCordobas)}</span>
                            <span className="amount-dollars">{formatCurrencyUSD(breakdown.clinicPaymentDollars)}</span>
                          </div>
                        </div>
                        
                        <div className="percentage-card doctor-percentage">
                          <div className="percentage-header">
                            <FontAwesomeIcon icon={faUserMd} />
                            <span className="percentage-title">Doctora Ortodoncista</span>
                          </div>
                          <div className="percentage-value">{breakdown.doctorPercentage.toFixed(1)}%</div>
                          <div className="percentage-amounts">
                            <span className="amount-cordobas">{formatCurrency(breakdown.doctorPaymentCordobas)}</span>
                            <span className="amount-dollars">{formatCurrencyUSD(breakdown.doctorPaymentDollars)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Doctor externo si existe */}
                      {breakdown.hasExternalDoctor && breakdown.externalPercentage > 0 && (
                        <div className="percentage-distribution-view">
                          <div className="percentage-card external-doctor-card">
                            <div className="percentage-header">
                              <FontAwesomeIcon icon={faUserDoctor} />
                              <span className="percentage-title">Doctor Externo</span>
                            </div>
                            <div className="percentage-value">
                              {breakdown.externalPercentage.toFixed(1)}%
                            </div>
                            <div className="percentage-amounts">
                              <span className="amount-cordobas">{formatCurrency(breakdown.externalPaymentCordobas)}</span>
                              <span className="amount-dollars">{formatCurrencyUSD(breakdown.externalPaymentDollars)}</span>
                            </div>
                            {selectedOrthodontic.external_doctor_name && (
                              <div className="doctor-name">
                                {selectedOrthodontic.external_doctor_name}
                              </div>
                            )}
                            {selectedOrthodontic.external_doctor_split_type && (
                              <div className="split-type-info">
                                <small>
                                  Tipo de división: {
                                    selectedOrthodontic.external_doctor_split_type === 'from_total' 
                                      ? 'Del total' 
                                      : 'De la parte de la clínica'
                                  }
                                </small>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Totales */}
                      <div className="financial-totals-view">
                        <div className="total-item">
                          <span className="total-label">Total del Tratamiento:</span>
                          <div className="total-values">
                            <span className="total-cordobas">{formatCurrency(breakdown.totalProcedureCordobas)}</span>
                            <span className="total-dollars">{formatCurrencyUSD(breakdown.totalProcedureDollars)}</span>
                          </div>
                        </div>
                        
                        <div className="total-distribution">
                          <span className="distribution-label">Distribución total:</span>
                          <div className="distribution-values">
                            <span className="distribution-percentage">
                              {breakdown.clinicPercentage.toFixed(1)}% + {breakdown.doctorPercentage.toFixed(1)}% 
                              {breakdown.hasExternalDoctor ? ` + ${breakdown.externalPercentage.toFixed(1)}%` : ''}
                              = 100%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Detalles financieros */}
                    <div className="view-section">
                      <h4><FontAwesomeIcon icon={faMoneyBillWave} /> Detalles Financieros</h4>
                      
                      {/* Métodos de pago */}
                      {(selectedOrthodontic.amount_cordobas > 0 || selectedOrthodontic.amount_dollars > 0) && (
                        <div className="payment-methods-section">
                          <h5><FontAwesomeIcon icon={faCreditCard} /> Métodos de Pago</h5>
                          
                          {/* Pago en córdobas */}
                          {selectedOrthodontic.amount_cordobas > 0 && (
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
                                  <span className="method-value">{selectedOrthodontic.payment_method_cordobas || 'No especificado'}</span>
                                </div>
                                {breakdown.posDeductionCordobas > 0 && (
                                  <div className="method-row deduction">
                                    <span className="method-label">Deducción POS:</span>
                                    <span className="method-value">-{formatCurrency(breakdown.posDeductionCordobas)}</span>
                                  </div>
                                )}
                                <div className="method-row net-amount">
                                  <span className="method-label">Neto después de POS:</span>
                                  <span className="method-value">{formatCurrency(breakdown.totalProcedureCordobas - (breakdown.externalPaymentCordobas || 0))}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Pago en dólares */}
                          {selectedOrthodontic.amount_dollars > 0 && (
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
                                  <span className="method-value">{selectedOrthodontic.payment_method_dollars || 'No especificado'}</span>
                                </div>
                                {breakdown.posDeductionDollars > 0 && (
                                  <div className="method-row deduction">
                                    <span className="method-label">Deducción POS:</span>
                                    <span className="method-value">-{formatCurrencyUSD(breakdown.posDeductionDollars)}</span>
                                  </div>
                                )}
                                <div className="method-row net-amount">
                                  <span className="method-label">Neto después de POS:</span>
                                  <span className="method-value">{formatCurrencyUSD(breakdown.totalProcedureDollars - (breakdown.externalPaymentDollars || 0))}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Desglose de cálculo para ortodoncia */}
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
                                <span className="step-label">- Deducción del POS (5.5%):</span>
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
                              <span className="step-label">Total del tratamiento (después de POS):</span>
                              <div className="step-values">
                                <span className="step-value-cordobas">{formatCurrency(breakdown.totalProcedureCordobas)}</span>
                                <span className="step-value-dollars">{formatCurrencyUSD(breakdown.totalProcedureDollars)}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Paso 4: Distribución */}
                          <div className="breakdown-step distribution-step">
                            <div className="step-number">3</div>
                            <div className="step-content">
                              <span className="step-label">Distribución del total:</span>
                              <div className="step-values">
                                <div className="distribution-breakdown">
                                  {breakdown.hasExternalDoctor ? (
                                    <>
                                      <div className="distribution-part">
                                        <span className="part-label">Doctora ({breakdown.doctorPercentage.toFixed(1)}%):</span>
                                        <span className="part-value">{formatCurrency(breakdown.doctorPaymentCordobas)}</span>
                                      </div>
                                      <div className="distribution-part">
                                        <span className="part-label">Dr. Ext. ({breakdown.externalPercentage.toFixed(1)}%):</span>
                                        <span className="part-value">{formatCurrency(breakdown.externalPaymentCordobas)}</span>
                                      </div>
                                      <div className="distribution-part clinic">
                                        <span className="part-label">Clínica ({breakdown.clinicPercentage.toFixed(1)}%):</span>
                                        <span className="part-value">{formatCurrency(breakdown.clinicPaymentCordobas)}</span>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="distribution-part">
                                        <span className="part-label">Doctora ({breakdown.doctorPercentage.toFixed(1)}%):</span>
                                        <span className="part-value">{formatCurrency(breakdown.doctorPaymentCordobas)}</span>
                                      </div>
                                      <div className="distribution-part clinic">
                                        <span className="part-label">Clínica ({breakdown.clinicPercentage.toFixed(1)}%):</span>
                                        <span className="part-value">{formatCurrency(breakdown.clinicPaymentCordobas)}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Paso 5: Totales finales */}
                          <div className="breakdown-step final-step">
                            <div className="step-number">∑</div>
                            <div className="step-content">
                              <span className="step-label final-label">TOTAL DISTRIBUIDO:</span>
                              <div className="step-values final-values">
                                <span className="step-value-cordobas final-cordobas">
                                  {formatCurrency(breakdown.totalProcedureCordobas)}
                                </span>
                                <span className="step-value-dollars final-dollars">
                                  {formatCurrencyUSD(breakdown.totalProcedureDollars)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Resumen final */}
                      <div className="final-summary">
                        <div className="summary-grid">
                          <div className="summary-card clinic-summary">
                            <div className="summary-header">
                              <FontAwesomeIcon icon={faHospitalUser} />
                              <span>Ganancia clínica</span>
                            </div>
                            <div className="summary-amounts">
                              <div className="summary-amount">
                                <span className="amount-label">Córdobas:</span>
                                <span className="amount-value">{formatCurrency(breakdown.clinicPaymentCordobas)}</span>
                              </div>
                              <div className="summary-amount">
                                <span className="amount-label">Dólares:</span>
                                <span className="amount-value">{formatCurrencyUSD(breakdown.clinicPaymentDollars)}</span>
                              </div>
                            </div>
                            <div className="summary-percentage">
                              {breakdown.clinicPercentage.toFixed(1)}%
                            </div>
                          </div>
                          
                          <div className="summary-card doctor-summary">
                            <div className="summary-header">
                              <FontAwesomeIcon icon={faUserMd} />
                              <span>Ganancia doctora ortodoncista</span>
                            </div>
                            <div className="summary-amounts">
                              <div className="summary-amount">
                                <span className="amount-label">Córdobas:</span>
                                <span className="amount-value">{formatCurrency(breakdown.doctorPaymentCordobas)}</span>
                              </div>
                              <div className="summary-amount">
                                <span className="amount-label">Dólares:</span>
                                <span className="amount-value">{formatCurrencyUSD(breakdown.doctorPaymentDollars)}</span>
                              </div>
                            </div>
                            <div className="summary-percentage">
                              {breakdown.doctorPercentage.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                        
                        {breakdown.hasExternalDoctor && (
                          <div className="summary-grid">
                            <div className="summary-card external-summary">
                              <div className="summary-header">
                                <FontAwesomeIcon icon={faUserDoctor} />
                                <span>Pago doctor externo</span>
                              </div>
                              <div className="summary-amounts">
                                <div className="summary-amount">
                                  <span className="amount-label">Córdobas:</span>
                                  <span className="amount-value">{formatCurrency(breakdown.externalPaymentCordobas)}</span>
                                </div>
                                <div className="summary-amount">
                                  <span className="amount-label">Dólares:</span>
                                  <span className="amount-value">{formatCurrencyUSD(breakdown.externalPaymentDollars)}</span>
                                </div>
                              </div>
                              <div className="summary-percentage">
                                {breakdown.externalPercentage.toFixed(1)}%
                              </div>
                              {selectedOrthodontic.external_doctor_split_type && (
                                <div className="split-type-info">
                                  <small>
                                    <FontAwesomeIcon icon={
                                      selectedOrthodontic.external_doctor_split_type === 'from_total' 
                                        ? faChartPie 
                                        : faBuilding
                                    } />
                                    {selectedOrthodontic.external_doctor_split_type === 'from_total' 
                                      ? ' Del total' 
                                      : ' De la parte de la clínica'}
                                  </small>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Tasa de cambio */}
                      <div className="exchange-rate-section">
                        <FontAwesomeIcon icon={faExchangeAlt} />
                        <span>Tasa de cambio utilizada: {breakdown.exchangeRate} C$/US$</span>
                      </div>
                    </div>

                    {/* Doctor externo (si aplica) */}
                    {selectedOrthodontic.external_doctor_name && (
                      <div className="view-section">
                        <h4><FontAwesomeIcon icon={faUserDoctor} /> Doctor Externo</h4>
                        <div className="view-grid">
                          <div className="view-item">
                            <span className="view-label">Nombre:</span>
                            <span className="view-value">{selectedOrthodontic.external_doctor_name}</span>
                          </div>
                          {selectedOrthodontic.external_doctor_specialty && (
                            <div className="view-item">
                              <span className="view-label">Especialidad:</span>
                              <span className="view-value">{selectedOrthodontic.external_doctor_specialty}</span>
                            </div>
                          )}
                          {selectedOrthodontic.external_doctor_payment > 0 && (
                            <div className="view-item">
                              <span className="view-label">Pago al doctor:</span>
                              <span className="view-value">{formatCurrency(selectedOrthodontic.external_doctor_payment)}</span>
                            </div>
                          )}
                          {selectedOrthodontic.external_doctor_payment_type && (
                            <div className="view-item">
                              <span className="view-label">Tipo de pago:</span>
                              <span className="view-value">
                                {selectedOrthodontic.external_doctor_payment_type === 'fixed' ? 'Monto fijo' : 'Porcentaje'}
                              </span>
                            </div>
                          )}
                          {selectedOrthodontic.external_doctor_percentage && (
                            <div className="view-item">
                              <span className="view-label">Porcentaje:</span>
                              <span className="view-value">{selectedOrthodontic.external_doctor_percentage}%</span>
                            </div>
                          )}
                          {selectedOrthodontic.external_doctor_split_type && (
                            <div className="view-item">
                              <span className="view-label">Tipo de división:</span>
                              <span className="view-value">
                                {selectedOrthodontic.external_doctor_split_type === 'from_total' 
                                  ? 'Porcentaje del total' 
                                  : 'Porcentaje de la parte de la clínica'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
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
      <div className="orthodontics-header">
        <h2><FontAwesomeIcon icon={faTooth} /> Ortodoncia</h2>
        <div className="orthodontics-tools">
          <div className="orthodontics-count">
            <FontAwesomeIcon icon={faTeeth} />
            <span>{filteredOrthodontics.length}</span>
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
                await fetchOrthodontics({ timeFilter: TIME_FILTERS.TODAY });
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
                await fetchOrthodontics({ timeFilter: TIME_FILTERS.THIS_WEEK });
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
                await fetchOrthodontics({ timeFilter: TIME_FILTERS.THIS_MONTH });
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
                await fetchOrthodontics({ timeFilter: TIME_FILTERS.ALL });
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
        </div>
      </div>

      {/* Tabla de ortodoncias */}
      <div className="orthodontics-section">
        <h3><FontAwesomeIcon icon={faFileMedical} /> Tratamientos de Ortodoncia ({filteredOrthodontics.length})</h3>
        
        {filteredOrthodontics.length === 0 ? (
          <div className="no-results">
            <p>
              {search || dateFilter.startDate || dateFilter.endDate || timeFilter !== TIME_FILTERS.ALL
                ? "No se encontraron tratamientos con los filtros aplicados."
                : "No hay tratamientos de ortodoncia registrados."}
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
                  const hasPOS = (orthodontic.pos_deduction_cordobas || 0) > 0;
                  const hasExternalDoctor = (orthodontic.external_doctor_payment || 0) > 0;
                  
                  return (
                    <tr key={orthodontic.procedure_ID}>
                      <td>
                        {formatDisplayDate(orthodontic.procedure_date)}
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
                          {hasExternalDoctor && (
                            <small className="external-doctor-indicator">
                              <FontAwesomeIcon icon={faUserDoctor} /> Con doctor externo
                            </small>
                          )}
                        </div>
                      </td>
                      
                      <td className="total-cordobas-cell">
                        <div className="total-with-indicators">
                          {formatCurrency(earnings.totalProcedureCordobas)}
                          {hasPOS && (
                            <small className="total-indicator pos-indicator">
                              <FontAwesomeIcon icon={faCreditCard} />
                            </small>
                          )}
                        </div>
                      </td>
                      
                      <td className="total-dollars-cell">
                        {formatCurrencyUSD(earnings.totalProcedureDollars)}
                      </td>
                      
                      <td className="clinic-net-cell">
                        <div className="clinic-earnings">
                          {formatCurrency(earnings.clinicPaymentCordobas)}
                          <div className="percentage-badge">
                            {earnings.clinicPercentage.toFixed(1)}%
                          </div>
                        </div>
                      </td>
                      
                      <td className="doctor-net-cell">
                        <div className="doctor-earnings">
                          {formatCurrency(earnings.doctorPaymentCordobas)}
                          <div className="percentage-badge">
                            {earnings.doctorPercentage.toFixed(1)}%
                          </div>
                        </div>
                      </td>
                      
                      <td className="actions-cell">
                        <button 
                          className="btn-view"
                          onClick={() => openViewModal(orthodontic)}
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