// frontend/src/pages/OrthodonticsPage/OrthodonticsPage.jsx
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
        ortho.original_query_type?.toLowerCase().includes(searchTerm)
      );
    });

  // Calcular ganancias para cada ortodoncia (40% clínica, 60% doctora)
  const calculateOrthodonticEarnings = (orthodontic) => {
    const total = orthodontic.total_cost || 0;
    const clinicEarnings = total * 0.4;  // 40% para clínica
    const doctorEarnings = total * 0.6;  // 60% para doctora
    
    return {
      total,
      clinicEarnings,
      doctorEarnings
    };
  };

  // Calcular estadísticas totales
  const calculateTotalEarnings = () => {
    let totalClinicEarnings = 0;
    let totalDoctorEarnings = 0;
    let totalOverall = 0;
    
    filteredOrthodontics.forEach(ortho => {
      const earnings = calculateOrthodonticEarnings(ortho);
      totalClinicEarnings += earnings.clinicEarnings;
      totalDoctorEarnings += earnings.doctorEarnings;
      totalOverall += earnings.total;
    });
    
    return {
      totalClinicEarnings,
      totalDoctorEarnings,
      totalOverall,
      count: filteredOrthodontics.length,
      avgClinic: filteredOrthodontics.length > 0 ? totalClinicEarnings / filteredOrthodontics.length : 0,
      avgDoctor: filteredOrthodontics.length > 0 ? totalDoctorEarnings / filteredOrthodontics.length : 0
    };
  };

  const totalEarnings = calculateTotalEarnings();
  
  // Manejar errores
  const error = localError || contextError;

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
              placeholder="Buscar por descripción, paciente o cédula..."
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

      {/* Ganancias totales */}
      <div className="total-earnings-section">
        <h3>💰 Ganancias Totales</h3>
        <div className="earnings-cards">
          <div className="earnings-card clinic-earnings">
            <div className="earnings-icon">🏥</div>
            <div className="earnings-content">
              <h4>Ganancias Clínica (40%)</h4>
              <p className="earnings-value">{formatCurrency(totalEarnings.totalClinicEarnings)}</p>
              <p className="earnings-percentage">
                {formatCurrency(totalEarnings.avgClinic)} promedio
              </p>
            </div>
          </div>
          
          <div className="earnings-card doctor-earnings">
            <div className="earnings-icon">👩‍⚕️</div>
            <div className="earnings-content">
              <h4>Ganancias Doctora (60%)</h4>
              <p className="earnings-value">{formatCurrency(totalEarnings.totalDoctorEarnings)}</p>
              <p className="earnings-percentage">
                {formatCurrency(totalEarnings.avgDoctor)} promedio
              </p>
            </div>
          </div>
          
          <div className="earnings-card total-earnings">
            <div className="earnings-icon">📈</div>
            <div className="earnings-content">
              <h4>Total General</h4>
              <p className="earnings-value">{formatCurrency(totalEarnings.totalOverall)}</p>
              <p className="earnings-count">{totalEarnings.count} tratamientos</p>
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
                  <th>Cédula</th>
                  <th>Descripción</th>
                  <th>Costo Total</th>
                  <th>Ganancia Clínica</th>
                  <th>Ganancia Doctora</th>
                  <th>Forma de Pago</th>
                  <th>Origen</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrthodontics.map((orthodontic) => {
                  const earnings = calculateOrthodonticEarnings(orthodontic);
                  
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
                          {orthodontic.original_query_type && (
                            <div className="original-appointment">
                              <small>Origen: {orthodontic.original_query_type}</small>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="total-cost-cell">
                        <strong>{formatCurrency(earnings.total)}</strong>
                      </td>
                      <td className="clinic-earnings-cell">
                        <div className="earnings-amount clinic">
                          {formatCurrency(earnings.clinicEarnings)}
                        </div>
                        <div className="earnings-percentage">
                          40%
                        </div>
                      </td>
                      <td className="doctor-earnings-cell">
                        <div className="earnings-amount doctor">
                          {formatCurrency(earnings.doctorEarnings)}
                        </div>
                        <div className="earnings-percentage">
                          60%
                        </div>
                      </td>
                      <td>
                        <span className={`payment-badge payment-${orthodontic.payment_method?.toLowerCase() || 'unknown'}`}>
                          {orthodontic.payment_method || "No especificado"}
                        </span>
                      </td>
                      <td>
                        {orthodontic.original_query_type ? (
                          <span className="origin-badge">Desde cita</span>
                        ) : (
                          <span className="origin-badge direct">Directo</span>
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