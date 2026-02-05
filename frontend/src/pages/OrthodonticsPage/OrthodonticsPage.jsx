import React, { useContext, useEffect, useState } from "react";
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
  faCreditCard,
  faCalendarDay,
  faCalendarWeek,
  faCalendar,
  faCalendarAlt,
  faEdit,
  faTrash,
  faFileMedical,
  faTooth,
  faTeeth,
  faTeethOpen,
  faGripLinesVertical,
  faSmile,
  faNotesMedical,
  faFileInvoiceDollar,
  faUserMd,
  faChartLine,
  faListAlt
} from '@fortawesome/free-solid-svg-icons';
import "./OrthodonticsPage.css";

// Definir filtros de tiempo
const TIME_FILTERS = {
  TODAY: 'today',
  THIS_WEEK: 'thisWeek',
  THIS_MONTH: 'thisMonth',
  ALL: 'all'
};

// Configurar íconos disponibles
const ICONS = {
  ORTHODONTICS: faTooth, // Icono principal para ortodoncia
  TEETH: faTeeth || faTeethOpen || faTooth, // Icono para dientes
  BRACES: faGripLinesVertical || faBracketsCurly, // Icono para brackets
  PATIENT: faHospitalUser,
  DOCTOR: faUserDoctor,
  MONEY: faMoneyBillWave,
  DOLLAR: faDollarSign,
  CALENDAR: faCalendar,
  SEARCH: faSearch,
  FILTER: faFilter,
  EYE: faEye,
  EYE_SLASH: faEyeSlash,
  EDIT: faEdit,
  DELETE: faTrash,
  FILE: faFileMedical,
  CLIPBOARD: faClipboardList,
  NOTES: faNotesMedical || faCommentMedical,
  INVOICE: faFileInvoiceDollar || faFileMedical,
  DOCTOR_MD: faUserMd || faUserDoctor,
  CHART: faChartLine,
  LIST: faListAlt || faClipboardList,
  STETHOSCOPE: faStethoscope,
  EXCHANGE: faExchangeAlt,
  PERCENTAGE: faPercentage,
  CREDIT_CARD: faCreditCard,
  CHEVRON_DOWN: faChevronDown,
  CHEVRON_UP: faChevronUp,
  TIMES: faTimes,
  SMILE: faSmile
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
      
      // Lógica SIMPLE: usar el filtro que esté activo
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

  const toggleRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // ✅ CORREGIDO: Usar orthodonticProcedures en lugar de procedures
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

  if (loading && orthodonticProcedures.length === 0) {  // ✅ CORREGIDO
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
        <h2><FontAwesomeIcon icon={ICONS.ORTHODONTICS} /> Ortodoncia</h2>
        <div className="orthodontics-tools">
          <div className="orthodontics-count">
            <FontAwesomeIcon icon={ICONS.TEETH} />
            <span>{filteredOrthodontics.length}</span>
          </div>
        </div>
      </div>

      {/* Filtros desplegables */}
      <div className={`filter-section ${expandedFilters ? 'expanded' : ''}`}>
        <div className="filter-header-mobile" onClick={() => setExpandedFilters(!expandedFilters)}>
          <div className="filter-header-content">
            <h3>
              <FontAwesomeIcon icon={ICONS.FILTER} />
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
            icon={expandedFilters ? ICONS.CHEVRON_UP : ICONS.CHEVRON_DOWN} 
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
                      await fetchOrthodontics({ timeFilter: TIME_FILTERS.TODAY });
                    }}
                  >
                    <FontAwesomeIcon icon={ICONS.CALENDAR} />
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
                    <FontAwesomeIcon icon={ICONS.CALENDAR} />
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
                    <FontAwesomeIcon icon={ICONS.CALENDAR} />
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
                <FontAwesomeIcon icon={ICONS.TIMES} />
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
        <h3>
          <FontAwesomeIcon icon={ICONS.FILE} />
          Tratamientos de Ortodoncia ({filteredOrthodontics.length})
        </h3>
        
        {filteredOrthodontics.length === 0 ? (
          <div className="no-results">
            <p>
              {search || dateFilter.startDate || dateFilter.endDate || timeFilter !== TIME_FILTERS.ALL
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
                  
                  return (
                    <React.Fragment key={orthodontic.procedure_ID}>
                      <tr className={isExpanded ? "expanded-row" : ""}>
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
                            {orthodontic.observations && (
                              <small className="observations-preview">
                                {orthodontic.observations.substring(0, 50)}...
                              </small>
                            )}
                          </div>
                        </td>
                        
                        {/* Total Córdobas */}
                        <td className="total-cordobas-cell">
                          <div className="total-amount-container">
                            <div className="total-amount cordobas">
                              {formatCurrency(earnings.totalProcedureCordobas)}
                            </div>
                            {earnings.cordobasAmount > 0 && (
                              <div className="payment-breakdown">
                                <div className="breakdown-row">
                                  <span className="breakdown-label">Abono C$:</span>
                                  <span className="breakdown-value">{formatCurrency(earnings.cordobasAmount)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Total Dólares */}
                        <td className="total-dollars-cell">
                          <div className="total-amount-container">
                            <div className="total-amount dollars">
                              {formatCurrencyUSD(earnings.totalProcedureDollars)}
                            </div>
                            {earnings.dollarsAmount > 0 && (
                              <div className="payment-breakdown">
                                <div className="breakdown-row">
                                  <span className="breakdown-label">Abono US$:</span>
                                  <span className="breakdown-value">{formatCurrencyUSD(earnings.dollarsAmount)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* Cantidad de la Clínica */}
                        <td className="clinic-net-cell">
                          <div className="net-amount-container">
                            <div className="net-amount clinic-net">
                              {formatCurrency(earnings.clinicEarningsCordobas)}
                            </div>
                            <div className="percentage-badge clinic-percentage">
                              <FontAwesomeIcon icon={ICONS.PERCENTAGE} />
                              <span>{earnings.clinicPercentage}%</span>
                            </div>
                          </div>
                        </td>
                        
                        {/* Cantidad de la Doctora */}
                        <td className="doctor-net-cell">
                          <div className="net-amount-container">
                            <div className="net-amount doctor-net">
                              {formatCurrency(earnings.doctorEarningsCordobas)}
                            </div>
                            <div className="percentage-badge doctor-percentage">
                              <FontAwesomeIcon icon={ICONS.PERCENTAGE} />
                              <span>{earnings.doctorPercentage}%</span>
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
                            <FontAwesomeIcon icon={isExpanded ? ICONS.EYE_SLASH : ICONS.EYE} />
                            <span>{isExpanded ? "Ocultar" : "Ver"}</span>
                          </button>
                        </td>
                      </tr>
                      
                      {/* Fila expandida con detalles */}
                      {isExpanded && (
                        <tr className="details-row">
                          <td colSpan="8">
                            <div className="orthodontic-details">
                              <div className="details-grid">
                                {/* Información básica */}
                                <div className="details-section">
                                  <h4><FontAwesomeIcon icon={ICONS.FILE} /> Información del Tratamiento</h4>
                                  <div className="details-row">
                                    <span className="detail-label">ID:</span>
                                    <span className="detail-value">{orthodontic.procedure_ID}</span>
                                  </div>
                                  <div className="details-row">
                                    <span className="detail-label">Fecha:</span>
                                    <span className="detail-value">{formatDisplayDate(orthodontic.procedure_date)}</span>
                                  </div>
                                  <div className="details-row">
                                    <span className="detail-label">Descripción:</span>
                                    <span className="detail-value">{orthodontic.procedure_description}</span>
                                  </div>
                                  {orthodontic.observations && (
                                    <div className="details-row">
                                      <span className="detail-label">Observaciones:</span>
                                      <span className="detail-value">{orthodontic.observations}</span>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Información del paciente */}
                                <div className="details-section">
                                  <h4><FontAwesomeIcon icon={ICONS.PATIENT} /> Información del Paciente</h4>
                                  <div className="details-row">
                                    <span className="detail-label">Nombre:</span>
                                    <span className="detail-value">{orthodontic.patient_name}</span>
                                  </div>
                                  <div className="details-row">
                                    <span className="detail-label">Cédula:</span>
                                    <span className="detail-value">{orthodontic.patient_identification}</span>
                                  </div>
                                </div>
                                
                                {/* Detalles financieros */}
                                <div className="details-section">
                                  <h4><FontAwesomeIcon icon={ICONS.MONEY} /> Detalles Financieros</h4>
                                  
                                  {/* Totales */}
                                  <div className="financial-totals">
                                    <div className="total-item">
                                      <span className="total-label">Total del Procedimiento:</span>
                                      <div className="total-values">
                                        <span className="total-cordobas">{formatCurrency(earnings.totalProcedureCordobas)}</span>
                                        <span className="total-dollars">{formatCurrencyUSD(earnings.totalProcedureDollars)}</span>
                                      </div>
                                    </div>
                                    
                                    {/* Distribución */}
                                    <div className="distribution-section">
                                      <h5><FontAwesomeIcon icon={ICONS.PERCENTAGE} /> Distribución</h5>
                                      <div className="distribution-row clinic-distribution">
                                        <span className="dist-label">Clínica ({earnings.clinicPercentage}%):</span>
                                        <div className="dist-values">
                                          <span className="dist-cordobas">{formatCurrency(earnings.clinicEarningsCordobas)}</span>
                                          <span className="dist-dollars">{formatCurrencyUSD(earnings.clinicEarningsDollars)}</span>
                                        </div>
                                      </div>
                                      <div className="distribution-row doctor-distribution">
                                        <span className="dist-label">Doctora ({earnings.doctorPercentage}%):</span>
                                        <div className="dist-values">
                                          <span className="dist-cordobas">{formatCurrency(earnings.doctorEarningsCordobas)}</span>
                                          <span className="dist-dollars">{formatCurrencyUSD(earnings.doctorEarningsDollars)}</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Métodos de pago */}
                                    {(orthodontic.payment_method_cordobas || orthodontic.payment_method_dollars) && (
                                      <div className="payment-methods">
                                        <h5><FontAwesomeIcon icon={ICONS.CREDIT_CARD} /> Métodos de Pago</h5>
                                        {orthodontic.payment_method_cordobas && (
                                          <div className="payment-method">
                                            <FontAwesomeIcon icon={ICONS.MONEY} />
                                            <span>{orthodontic.payment_method_cordobas}: {formatCurrency(earnings.cordobasAmount)}</span>
                                          </div>
                                        )}
                                        {orthodontic.payment_method_dollars && (
                                          <div className="payment-method">
                                            <FontAwesomeIcon icon={ICONS.DOLLAR} />
                                            <span>{orthodontic.payment_method_dollars}: {formatCurrencyUSD(earnings.dollarsAmount)}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Información de doctor externo */}
                                {orthodontic.external_doctor_name && (
                                  <div className="details-section">
                                    <h4><FontAwesomeIcon icon={ICONS.DOCTOR} /> Doctor Externo</h4>
                                    <div className="details-row">
                                      <span className="detail-label">Nombre:</span>
                                      <span className="detail-value">{orthodontic.external_doctor_name}</span>
                                    </div>
                                    {orthodontic.external_doctor_specialty && (
                                      <div className="details-row">
                                        <span className="detail-label">Especialidad:</span>
                                        <span className="detail-value">{orthodontic.external_doctor_specialty}</span>
                                      </div>
                                    )}
                                    {orthodontic.external_doctor_payment > 0 && (
                                      <div className="details-row">
                                        <span className="detail-label">Pago al doctor:</span>
                                        <span className="detail-value">{formatCurrency(orthodontic.external_doctor_payment)}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {/* Acciones */}
                              <div className="details-actions">
                                <button className="btn-edit">
                                  <FontAwesomeIcon icon={ICONS.EDIT} />
                                  Editar
                                </button>
                                <button className="btn-delete">
                                  <FontAwesomeIcon icon={ICONS.DELETE} />
                                  Eliminar
                                </button>
                              </div>
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