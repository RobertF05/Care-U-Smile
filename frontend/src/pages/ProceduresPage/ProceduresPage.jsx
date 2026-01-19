import { useContext, useState, useEffect } from "react";
import { AppContext } from "../../context/AppContext";
import { AuthContext } from "../../context/AuthContext";
import { formatDate, formatCurrency } from "../../utils/formatters";
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
    const totalProcedure = filteredProcedures.reduce((sum, proc) => sum + (proc.total_procedure || 0), 0);
    
    // Calcular pagos a doctores externos
    const externalDoctorPayments = filteredProcedures.reduce((sum, proc) => 
      sum + (proc.external_doctor_payment || 0), 0);
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
      totalProcedure,
      externalDoctorPayments,
      externalDoctorCount,
      averageProcedure: filteredProcedures.length > 0 ? totalProcedure / filteredProcedures.length : 0,
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

  // Obtener desglose de pagos
  const getPaymentBreakdown = (procedure) => {
    const cordobas = procedure.amount_cordobas || procedure.total_cost || 0;
    const dollars = procedure.amount_dollars || procedure.total_cost_USD || 0;
    const totalProcedure = procedure.total_procedure || 0;
    
    return {
      cordobas,
      dollars,
      totalProcedure,
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
          <div className="search-wrapper">
            <input
              className="search-box"
              placeholder="Buscar por descripción, paciente, cédula o doctor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="gray" viewBox="0 0 16 16">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
            </svg>
          </div>
          
          <div className="procedures-count">
            <span>{filteredProcedures.length}</span>
          </div>
        </div>
      </div>

      {/* Estadísticas actualizadas */}
      <div className="stats-cards">
        <div className="stat-card total-income">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Total en Córdobas</h3>
            <p className="stat-value">{formatCurrency(statsData.totalCordobas)}</p>
            <p className="stat-subtitle">C$ depositados</p>
          </div>
        </div>
        
        <div className="stat-card total-income-usd">
          <div className="stat-icon">💵</div>
          <div className="stat-content">
            <h3>Total en Dólares</h3>
            <p className="stat-value">{formatCurrencyUSD(statsData.totalDollars)}</p>
            <p className="stat-subtitle">US$ depositados</p>
          </div>
        </div>
        
        <div className="stat-card total-procedure">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Total del Procedimiento</h3>
            <p className="stat-value">{formatCurrency(statsData.totalProcedure)}</p>
            <p className="stat-subtitle">Sumatoria total (C$)</p>
          </div>
        </div>
        
        <div className="stat-card external-doctor">
          <div className="stat-icon">👨‍⚕️</div>
          <div className="stat-content">
            <h3>Doctores Externos</h3>
            <p className="stat-value">{statsData.externalDoctorCount}</p>
            <p className="stat-subtitle">
              Pagos: {formatCurrency(statsData.externalDoctorPayments)}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros por fecha */}
      <div className="filters-section">
        <h3>Filtros</h3>
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

      {/* Tabla de procedimientos actualizada */}
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
                  <th>Cédula</th>
                  <th>Descripción</th>
                  <th>Pago C$</th>
                  <th>Pago US$</th>
                  <th>Total (C$)</th>
                  <th>Métodos de Pago</th>
                  <th>Doctor Externo</th>
                  <th>Pago Doctor</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcedures.map((procedure) => {
                  const paymentBreakdown = getPaymentBreakdown(procedure);
                  const mainPaymentMethod = getMainPaymentMethod(procedure);
                  const hasExternalDoctor = procedure.theres_external_doctor || procedure.external_doctor;
                  
                  return (
                    <tr key={procedure.procedure_ID}>
                      <td>
                        {procedure.procedure_date ? formatDate(procedure.procedure_date) : "N/A"}
                      </td>
                      <td className="patient-cell">
                        <strong>{procedure.patient_name || "Paciente no especificado"}</strong>
                      </td>
                      <td className="patient-id">
                        {procedure.patient_identification || "N/A"}
                      </td>
                      <td className="description-cell">
                        <div className="description-content">
                          <strong>{procedure.procedure_description || "Sin descripción"}</strong>
                        </div>
                      </td>
                      
                      {/* Pagos en Córdobas */}
                      <td className="payment-cordobas-cell">
                        {paymentBreakdown.hasCordobas ? (
                          <div className="payment-amount-container">
                            <span className="payment-amount cordobas">
                              {formatCurrency(paymentBreakdown.cordobas)}
                            </span>
                            <div className="payment-method-badge">
                              <span className={`method-badge ${procedure.payment_method_cordobas?.toLowerCase() || 'default'}`}>
                                {procedure.payment_method_cordobas || "—"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="no-payment">—</span>
                        )}
                      </td>
                      
                      {/* Pagos en Dólares */}
                      <td className="payment-dollars-cell">
                        {paymentBreakdown.hasDollars ? (
                          <div className="payment-amount-container">
                            <span className="payment-amount dollars">
                              {formatCurrencyUSD(paymentBreakdown.dollars)}
                            </span>
                            <div className="payment-method-badge">
                              <span className={`method-badge ${procedure.payment_method_dollars?.toLowerCase() || 'default'}`}>
                                {procedure.payment_method_dollars || "—"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="no-payment">—</span>
                        )}
                      </td>
                      
                      {/* Total del Procedimiento */}
                      <td className="total-procedure-cell">
                        <div className="total-procedure-amount">
                          <strong>{formatCurrency(paymentBreakdown.totalProcedure)}</strong>
                        </div>
                        {paymentBreakdown.isMixed && (
                          <div className="mixed-payment-indicator">
                            <small>Pago mixto</small>
                          </div>
                        )}
                      </td>
                      
                      {/* Métodos de Pago (resumen) */}
                      <td className="payment-methods-cell">
                        <div className="payment-methods-summary">
                          <span className={`main-method ${mainPaymentMethod.toLowerCase()}`}>
                            {mainPaymentMethod}
                          </span>
                          {paymentBreakdown.isMixed && (
                            <div className="mixed-details">
                              <small>
                                {procedure.payment_method_cordobas && procedure.payment_method_dollars 
                                  ? `${procedure.payment_method_cordobas} + ${procedure.payment_method_dollars}`
                                  : 'Múltiples métodos'}
                              </small>
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* Doctor Externo */}
                      <td className="external-doctor-cell">
                        {hasExternalDoctor ? (
                          <div className="external-doctor-info">
                            <div className="external-doctor-name">
                              <strong>{procedure.external_doctor_name || procedure.external_doctor || "Doctor externo"}</strong>
                            </div>
                            {procedure.external_doctor_specialty && (
                              <div className="external-doctor-specialty">
                                <small>{procedure.external_doctor_specialty}</small>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="no-external-doctor">—</span>
                        )}
                      </td>
                      
                      {/* Pago Doctor Externo */}
                      <td className="external-doctor-payment-cell">
                        {hasExternalDoctor && procedure.external_doctor_payment ? (
                          <div className="payment-info">
                            <span className="payment-amount">
                              {formatCurrency(procedure.external_doctor_payment)}
                            </span>
                            {procedure.external_doctor_payment_type && (
                              <div className="payment-type">
                                <small>
                                  {procedure.external_doctor_payment_type === 'percentage' 
                                    ? `${procedure.external_doctor_payment_value}%`
                                    : procedure.external_doctor_payment_currency || 'C$'}
                                </small>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="no-payment">—</span>
                        )}
                      </td>
                      
                      <td className="observations-cell">
                        {procedure.observations || "Ninguna"}
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