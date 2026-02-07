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
  faTeeth
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

  // Calcular ganancias de ortodoncia
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
      doctorPercentage
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
              {/* Información básica */}
              <div className="view-section">
                <h4><FontAwesomeIcon icon={faFileMedical} /> Información del Tratamiento</h4>
                <div className="view-grid">
                  <div className="view-item">
                    <span className="view-label">ID:</span>
                    <span className="view-value">{selectedOrthodontic.procedure_ID}</span>
                  </div>
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
                    <div className="percentage-value">{selectedOrthodontic.clinic_payment_percentage || 40}%</div>
                    <div className="percentage-amounts">
                      <span className="amount-cordobas">{formatCurrency(selectedOrthodontic.clinic_payment_cordobas || 0)}</span>
                      <span className="amount-dollars">{formatCurrencyUSD(selectedOrthodontic.clinic_payment_dollars || 0)}</span>
                    </div>
                  </div>
                  
                  <div className="percentage-card doctor-percentage">
                    <div className="percentage-header">
                      <FontAwesomeIcon icon={faUserDoctor} />
                      <span className="percentage-title">Doctora Ortodoncista</span>
                    </div>
                    <div className="percentage-value">{selectedOrthodontic.doctor_payment_percentage || 60}%</div>
                    <div className="percentage-amounts">
                      <span className="amount-cordobas">{formatCurrency(selectedOrthodontic.doctor_payment_cordobas || 0)}</span>
                      <span className="amount-dollars">{formatCurrencyUSD(selectedOrthodontic.doctor_payment_dollars || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Totales */}
                <div className="financial-totals-view">
                  <div className="total-item">
                    <span className="total-label">Total del Tratamiento:</span>
                    <div className="total-values">
                      <span className="total-cordobas">{formatCurrency(selectedOrthodontic.total_procedure || 0)}</span>
                      <span className="total-dollars">{formatCurrencyUSD(selectedOrthodontic.total_procedure_usd || 0)}</span>
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
                            <span className="method-label">Monto:</span>
                            <span className="method-value">{formatCurrency(selectedOrthodontic.amount_cordobas)}</span>
                          </div>
                          <div className="method-row">
                            <span className="method-label">Método:</span>
                            <span className="method-value">{selectedOrthodontic.payment_method_cordobas || 'No especificado'}</span>
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
                            <span className="method-label">Monto:</span>
                            <span className="method-value">{formatCurrencyUSD(selectedOrthodontic.amount_dollars)}</span>
                          </div>
                          <div className="method-row">
                            <span className="method-label">Método:</span>
                            <span className="method-value">{selectedOrthodontic.payment_method_dollars || 'No especificado'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tasa de cambio */}
                <div className="exchange-rate-section">
                  <FontAwesomeIcon icon={faExchangeAlt} />
                  <span>Tasa de cambio utilizada: {selectedOrthodontic.exchange_rate_used || 36.5} C$/US$</span>
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
                        </div>
                      </td>
                      
                      <td className="total-cordobas-cell">
                        {formatCurrency(earnings.totalProcedureCordobas)}
                      </td>
                      
                      <td className="total-dollars-cell">
                        {formatCurrencyUSD(earnings.totalProcedureDollars)}
                      </td>
                      
                      <td className="clinic-net-cell">
                        {formatCurrency(earnings.clinicEarningsCordobas)}
                      </td>
                      
                      <td className="doctor-net-cell">
                        {formatCurrency(earnings.doctorEarningsCordobas)}
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