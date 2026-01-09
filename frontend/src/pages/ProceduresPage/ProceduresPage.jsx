// frontend/src/pages/ProceduresPage/ProceduresPage.jsx
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
        procedure.original_query_type?.toLowerCase().includes(searchTerm)
      );
    });

  // Calcular estadísticas
  const calculateStats = () => {
    const totalIncome = filteredProcedures.reduce((sum, proc) => sum + (proc.total_cost || 0), 0);
    
    return {
      totalIncome,
      averageCost: filteredProcedures.length > 0 ? totalIncome / filteredProcedures.length : 0
    };
  };

  const statsData = calculateStats();
  
  // Manejar errores
  const error = localError || contextError;

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
              placeholder="Buscar por descripción, paciente o cédula..."
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

      {/* Estadísticas */}
      <div className="stats-cards">
        <div className="stat-card total-income">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Ingresos Totales</h3>
            <p className="stat-value">{formatCurrency(statsData.totalIncome)}</p>
            <p className="stat-subtitle">{filteredProcedures.length} procedimientos</p>
          </div>
        </div>
        
        <div className="stat-card avg-income">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Costo Promedio</h3>
            <p className="stat-value">{formatCurrency(statsData.averageCost)}</p>
            <p className="stat-subtitle">Por procedimiento</p>
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

      {/* Tabla de procedimientos */}
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
                  <th>Costo Total</th>
                  <th>Forma de Pago</th>
                  <th>Origen</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcedures.map((procedure) => (
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
                        {procedure.original_query_type && (
                          <div className="original-appointment">
                            <small>Origen: {procedure.original_query_type}</small>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="cost-cell">
                      <strong>{formatCurrency(procedure.total_cost)}</strong>
                    </td>
                    <td>
                      <span className={`payment-badge payment-${procedure.payment_method?.toLowerCase() || 'unknown'}`}>
                        {procedure.payment_method || "No especificado"}
                      </span>
                    </td>
                    <td>
                      {procedure.original_query_type ? (
                        <span className="origin-badge">Desde cita</span>
                      ) : (
                        <span className="origin-badge direct">Directo</span>
                      )}
                    </td>
                    <td className="observations-cell">
                      {procedure.observations || "Ninguna"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}