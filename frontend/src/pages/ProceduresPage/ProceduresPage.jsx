// frontend/src/pages/ProceduresPage/ProceduresPage.jsx
import { useContext, useState, useEffect } from "react";
import { AppContext } from "../../context/AppContext";
import { formatDate, formatCurrency, formatFullName } from "../../utils/formatters";
import "./ProceduresPage.css";

export default function ProceduresPage() {
  const { 
    procedures, 
    fetchProceduresNormal,
    loading,
    stats
  } = useContext(AppContext);
  
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: ""
  });

  // Cargar procedimientos al montar
  useEffect(() => {
    fetchProceduresNormal();
  }, []);

  // Aplicar filtros
  const applyFilters = () => {
    const filters = {};
    if (dateFilter.startDate) filters.startDate = dateFilter.startDate;
    if (dateFilter.endDate) filters.endDate = dateFilter.endDate;
    fetchProceduresNormal(filters);
  };

  // Limpiar filtros
  const clearFilters = () => {
    setDateFilter({ startDate: "", endDate: "" });
    setSearch("");
    fetchProceduresNormal();
  };

  // Filtrar procedimientos por búsqueda
  const filteredProcedures = procedures
    .filter(procedure => {
      const searchTerm = search.toLowerCase();
      return (
        procedure.procedure_description?.toLowerCase().includes(searchTerm) ||
        procedure.patient_name?.toLowerCase().includes(searchTerm) ||
        procedure.patient_identification?.includes(searchTerm)
      );
    });

  // Calcular estadísticas
  const calculateStats = () => {
    const totalIncome = filteredProcedures.reduce((sum, proc) => sum + (proc.total_cost || 0), 0);
    const completedCount = filteredProcedures.filter(proc => proc.state === 'COMPLETED').length;
    const pendingCount = filteredProcedures.length - completedCount;
    
    return {
      totalIncome,
      completedCount,
      pendingCount,
      averageCost: filteredProcedures.length > 0 ? totalIncome / filteredProcedures.length : 0
    };
  };

  const statsData = calculateStats();

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

  return (
    <div className="procedures-container">
      <div className="procedures-header">
        <h2>🦷 Procedimientos</h2>
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
            <span>/</span>
            <span>{stats.totalProcedures || 0}</span>
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

      {/* Estadísticas */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Ingresos Totales</h3>
            <p className="stat-value">{formatCurrency(statsData.totalIncome)}</p>
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
            {!search && !dateFilter.startDate && !dateFilter.endDate && (
              <button className="btn-add-first">
                Agregar primer procedimiento
              </button>
            )}
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
                  <th>Estado</th>
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
                      {procedure.procedure_description || "Sin descripción"}
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
                      <span className={`status-badge status-${procedure.state?.toLowerCase() || 'pending'}`}>
                        {procedure.state || "Pendiente"}
                      </span>
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