import { useContext, useState, useEffect } from "react";
import { AppContext } from "../../context/AppContext";
import { AuthContext } from "../../context/AuthContext";
import { formatDate, formatCurrency } from "../../utils/formatters";
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

  // Calcular ganancias para cada ortodoncia
  const calculateOrthodonticEarnings = (orthodontic) => {
    const totalProcedure = orthodontic.total_procedure || 0;
    const clinicPercentage = orthodontic.clinic_payment_percentage || 40;
    const doctorPercentage = orthodontic.doctor_payment_percentage || 60;
    
    const clinicEarnings = totalProcedure * clinicPercentage / 100;
    const doctorEarnings = totalProcedure * doctorPercentage / 100;
    
    // Pagos en monedas separadas
    const cordobasAmount = orthodontic.amount_cordobas || orthodontic.total_cost || 0;
    const dollarsAmount = orthodontic.amount_dollars || orthodontic.total_cost_USD || 0;
    
    return {
      totalProcedure,
      clinicEarnings,
      doctorEarnings,
      clinicPercentage,
      doctorPercentage,
      cordobasAmount,
      dollarsAmount,
      isMixed: cordobasAmount > 0 && dollarsAmount > 0
    };
  };

  // Calcular estadísticas totales
  const calculateTotalEarnings = () => {
    let totalClinicEarnings = 0;
    let totalDoctorEarnings = 0;
    let totalProcedureAll = 0;
    let totalCordobas = 0;
    let totalDollars = 0;
    let totalExternalDoctorPayments = 0;
    let externalDoctorCount = 0;
    let mixedPaymentCount = 0;
    
    filteredOrthodontics.forEach(ortho => {
      const earnings = calculateOrthodonticEarnings(ortho);
      totalClinicEarnings += earnings.clinicEarnings;
      totalDoctorEarnings += earnings.doctorEarnings;
      totalProcedureAll += earnings.totalProcedure;
      totalCordobas += earnings.cordobasAmount;
      totalDollars += earnings.dollarsAmount;
      
      if (earnings.isMixed) mixedPaymentCount++;
      
      // Contar pagos a doctores externos
      if (ortho.theres_external_doctor || ortho.external_doctor) {
        externalDoctorCount++;
        totalExternalDoctorPayments += ortho.external_doctor_payment || 0;
      }
    });
    
    return {
      totalClinicEarnings,
      totalDoctorEarnings,
      totalProcedureAll,
      totalCordobas,
      totalDollars,
      totalExternalDoctorPayments,
      externalDoctorCount,
      mixedPaymentCount,
      count: filteredOrthodontics.length,
      avgClinic: filteredOrthodontics.length > 0 ? totalClinicEarnings / filteredOrthodontics.length : 0,
      avgDoctor: filteredOrthodontics.length > 0 ? totalDoctorEarnings / filteredOrthodontics.length : 0,
      avgProcedure: filteredOrthodontics.length > 0 ? totalProcedureAll / filteredOrthodontics.length : 0
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

  // Obtener el método de pago principal
  const getMainPaymentMethod = (orthodontic) => {
    if (orthodontic.payment_method_cordobas && orthodontic.payment_method_dollars) {
      return 'Mixto';
    }
    return orthodontic.payment_method_cordobas || orthodontic.payment_method_dollars || orthodontic.payment_method || 'No especificado';
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
          
          <div className="orthodontics-count">
            <span>{filteredOrthodontics.length}</span>
          </div>
        </div>
      </div>

      {/* Ganancias totales actualizadas */}
      <div className="total-earnings-section">
        <h3>💰 Ganancias Totales</h3>
        <div className="earnings-cards">
          <div className="earnings-card clinic-earnings">
            <div className="earnings-icon">🏥</div>
            <div className="earnings-content">
              <h4>Ganancias Clínica</h4>
              <p className="earnings-value">{formatCurrency(totalEarnings.totalClinicEarnings)}</p>
              <p className="earnings-percentage">
                {formatCurrency(totalEarnings.avgClinic)} promedio
              </p>
              <p className="earnings-subtitle">
                {filteredOrthodontics.length > 0 
                  ? `${(totalEarnings.totalClinicEarnings / totalEarnings.totalProcedureAll * 100).toFixed(1)}% del total`
                  : '—'}
              </p>
            </div>
          </div>
          
          <div className="earnings-card doctor-earnings">
            <div className="earnings-icon">👩‍⚕️</div>
            <div className="earnings-content">
              <h4>Ganancias Doctora</h4>
              <p className="earnings-value">{formatCurrency(totalEarnings.totalDoctorEarnings)}</p>
              <p className="earnings-percentage">
                {formatCurrency(totalEarnings.avgDoctor)} promedio
              </p>
              <p className="earnings-subtitle">
                {filteredOrthodontics.length > 0 
                  ? `${(totalEarnings.totalDoctorEarnings / totalEarnings.totalProcedureAll * 100).toFixed(1)}% del total`
                  : '—'}
              </p>
            </div>
          </div>
          
          <div className="earnings-card total-earnings">
            <div className="earnings-icon">📊</div>
            <div className="earnings-content">
              <h4>Total del Procedimiento</h4>
              <p className="earnings-value">{formatCurrency(totalEarnings.totalProcedureAll)}</p>
              <p className="earnings-count">
                {totalEarnings.count} tratamientos
              </p>
              <p className="earnings-subtitle">
                {formatCurrency(totalEarnings.totalCordobas)} C$ + {formatCurrencyUSD(totalEarnings.totalDollars)}
              </p>
            </div>
          </div>
          
          <div className="earnings-card external-doctor">
            <div className="earnings-icon">👨‍⚕️</div>
            <div className="earnings-content">
              <h4>Doctores Externos</h4>
              <p className="earnings-value">{totalEarnings.externalDoctorCount}</p>
              <p className="earnings-count">
                Pagos: {formatCurrency(totalEarnings.totalExternalDoctorPayments)}
              </p>
              <p className="earnings-subtitle">
                {totalEarnings.mixedPaymentCount} pagos mixtos
              </p>
            </div>
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

      {/* Tabla de ortodoncias actualizada */}
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
                  <th>Cédula</th>
                  <th>Descripción</th>
                  <th>Pago C$</th>
                  <th>Pago US$</th>
                  <th>Total (C$)</th>
                  <th>Métodos de Pago</th>
                  <th>% Clínica</th>
                  <th>Ganancia Clínica</th>
                  <th>% Doctora</th>
                  <th>Ganancia Doctora</th>
                  <th>Doctor Externo</th>
                  <th>Pago Doctor</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrthodontics.map((orthodontic) => {
                  const earnings = calculateOrthodonticEarnings(orthodontic);
                  const hasExternalDoctor = orthodontic.theres_external_doctor || orthodontic.external_doctor;
                  const mainPaymentMethod = getMainPaymentMethod(orthodontic);
                  
                  return (
                    <tr key={orthodontic.procedure_ID}>
                      <td>
                        {orthodontic.procedure_date ? formatDate(orthodontic.procedure_date) : "N/A"}
                      </td>
                      <td className="patient-cell">
                        <strong>{orthodontic.patient_name || "Paciente no especificado"}</strong>
                      </td>
                      <td className="patient-id">
                        {orthodontic.patient_identification || "N/A"}
                      </td>
                      <td className="description-cell">
                        <div className="description-content">
                          <strong>{orthodontic.procedure_description || "Sin descripción"}</strong>
                        </div>
                      </td>
                      
                      {/* Pagos en Córdobas */}
                      <td className="payment-cordobas-cell">
                        {earnings.cordobasAmount > 0 ? (
                          <div className="payment-amount-container">
                            <span className="payment-amount cordobas">
                              {formatCurrency(earnings.cordobasAmount)}
                            </span>
                            <div className="payment-method-badge">
                              <span className={`method-badge ${orthodontic.payment_method_cordobas?.toLowerCase() || 'default'}`}>
                                {orthodontic.payment_method_cordobas || "—"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="no-payment">—</span>
                        )}
                      </td>
                      
                      {/* Pagos en Dólares */}
                      <td className="payment-dollars-cell">
                        {earnings.dollarsAmount > 0 ? (
                          <div className="payment-amount-container">
                            <span className="payment-amount dollars">
                              {formatCurrencyUSD(earnings.dollarsAmount)}
                            </span>
                            <div className="payment-method-badge">
                              <span className={`method-badge ${orthodontic.payment_method_dollars?.toLowerCase() || 'default'}`}>
                                {orthodontic.payment_method_dollars || "—"}
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
                          <strong>{formatCurrency(earnings.totalProcedure)}</strong>
                        </div>
                        {earnings.isMixed && (
                          <div className="mixed-payment-indicator">
                            <small>Pago mixto</small>
                          </div>
                        )}
                      </td>
                      
                      {/* Métodos de Pago */}
                      <td className="payment-methods-cell">
                        <div className="payment-methods-summary">
                          <span className={`main-method ${mainPaymentMethod.toLowerCase()}`}>
                            {mainPaymentMethod}
                          </span>
                          {earnings.isMixed && (
                            <div className="mixed-details">
                              <small>
                                {orthodontic.payment_method_cordobas && orthodontic.payment_method_dollars 
                                  ? `${orthodontic.payment_method_cordobas} + ${orthodontic.payment_method_dollars}`
                                  : 'Múltiples métodos'}
                              </small>
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* Porcentaje Clínica */}
                      <td className="clinic-percentage-cell">
                        <div className="percentage-badge clinic">
                          {earnings.clinicPercentage}%
                        </div>
                      </td>
                      
                      {/* Ganancia Clínica */}
                      <td className="clinic-earnings-cell">
                        <div className="earnings-amount clinic">
                          {formatCurrency(earnings.clinicEarnings)}
                        </div>
                        <div className="earnings-detail">
                          <small>
                            {(earnings.clinicEarnings / earnings.totalProcedure * 100).toFixed(1)}% del total
                          </small>
                        </div>
                      </td>
                      
                      {/* Porcentaje Doctora */}
                      <td className="doctor-percentage-cell">
                        <div className="percentage-badge doctor">
                          {earnings.doctorPercentage}%
                        </div>
                      </td>
                      
                      {/* Ganancia Doctora */}
                      <td className="doctor-earnings-cell">
                        <div className="earnings-amount doctor">
                          {formatCurrency(earnings.doctorEarnings)}
                        </div>
                        <div className="earnings-detail">
                          <small>
                            {(earnings.doctorEarnings / earnings.totalProcedure * 100).toFixed(1)}% del total
                          </small>
                        </div>
                      </td>
                      
                      {/* Doctor Externo */}
                      <td className="external-doctor-cell">
                        {hasExternalDoctor ? (
                          <div className="external-doctor-info">
                            <div className="external-doctor-name">
                              <strong>{orthodontic.external_doctor_name || orthodontic.external_doctor || "Doctor externo"}</strong>
                            </div>
                            {orthodontic.external_doctor_specialty && (
                              <div className="external-doctor-specialty">
                                <small>{orthodontic.external_doctor_specialty}</small>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="no-external-doctor">—</span>
                        )}
                      </td>
                      
                      {/* Pago Doctor Externo */}
                      <td className="external-doctor-payment-cell">
                        {hasExternalDoctor && orthodontic.external_doctor_payment ? (
                          <div className="payment-info">
                            <span className="payment-amount">
                              {formatCurrency(orthodontic.external_doctor_payment)}
                            </span>
                            {orthodontic.external_doctor_payment_type && (
                              <div className="payment-type">
                                <small>
                                  {orthodontic.external_doctor_payment_type === 'percentage' 
                                    ? `${orthodontic.external_doctor_payment_value}%`
                                    : orthodontic.external_doctor_payment_currency || 'C$'}
                                </small>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="no-payment">—</span>
                        )}
                      </td>
                      
                      <td className="observations-cell">
                        {orthodontic.observations || "Ninguna"}
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