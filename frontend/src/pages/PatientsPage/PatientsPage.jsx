// frontend/src/pages/PatientPage/PatientPage.jsx
import { useContext, useState, useEffect } from "react";
import { AppContext } from "../../context/AppContext";
import { formatDate, formatPhone, calculateAge, formatFullName } from "../../utils/formatters";
import "./PatientsPage.css";

export default function PatientsPage() {
  const { 
    patients, 
    fetchPatients, 
    createPatient, 
    updatePatient, 
    deletePatient,
    loading,
    apiFetch
  } = useContext(AppContext);
  
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(null);
  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    first_last_name: "",
    second_last_name: "",
    identification: "",
    number_phone: "",
    email: "",
    profession: "",
    address: "",
    birthdate: ""
  });
  const [editingPatient, setEditingPatient] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Cargar pacientes al montar el componente
  useEffect(() => {
    fetchPatients();
  }, []);

  // Filtrar pacientes por búsqueda
  const filteredPatients = patients
    .filter(patient => {
      const searchTerm = search.toLowerCase();
      return (
        patient.first_name?.toLowerCase().includes(searchTerm) ||
        patient.first_last_name?.toLowerCase().includes(searchTerm) ||
        patient.identification?.includes(searchTerm) ||
        patient.email?.toLowerCase().includes(searchTerm)
      );
    })
    .sort((a, b) => {
      // Ordenar por primer nombre (alfabético)
      const nameA = a.first_name?.toLowerCase() || '';
      const nameB = b.first_name?.toLowerCase() || '';
      return nameA.localeCompare(nameB);
    });

  // Mostrar notificación
  const showNotification = (message, type = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: "", type: "" });
    }, 3000);
  };

  // Manejar cambios en el formulario
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Abrir modal para agregar paciente
  const openAddModal = () => {
    setEditingPatient(null);
    setFormData({
      first_name: "",
      middle_name: "",
      first_last_name: "",
      second_last_name: "",
      identification: "",
      number_phone: "",
      email: "",
      profession: "",
      address: "",
      birthdate: ""
    });
    setModalOpen("add");
  };

  // Abrir modal para editar paciente
  const openEditModal = (patient) => {
    setEditingPatient(patient);
    setFormData({
      first_name: patient.first_name || "",
      middle_name: patient.middle_name || "",
      first_last_name: patient.first_last_name || "",
      second_last_name: patient.second_last_name || "",
      identification: patient.identification || "",
      number_phone: patient.number_phone || "",
      email: patient.email || "",
      profession: patient.profession || "",
      address: patient.address || "",
      birthdate: patient.birthdate ? patient.birthdate.split('T')[0] : ""
    });
    setModalOpen("edit");
  };

  // Cerrar modal
  const closeModal = () => {
    setModalOpen(null);
    setEditingPatient(null);
    setFormData({
      first_name: "",
      middle_name: "",
      first_last_name: "",
      second_last_name: "",
      identification: "",
      number_phone: "",
      email: "",
      profession: "",
      address: "",
      birthdate: ""
    });
  };

  // Validar formulario
  const validateForm = () => {
    if (!formData.first_name || !formData.first_last_name || !formData.identification) {
      showNotification("Nombre, apellido y cédula son campos obligatorios", "error");
      return false;
    }
    return true;
  };

  // Guardar paciente (agregar o editar)
  const handleSavePatient = async () => {
    if (!validateForm()) return;

    try {
      const patientData = {
        ...formData,
        number_phone: formData.number_phone ? Number(formData.number_phone) : null
      };

      let result;
      if (editingPatient) {
        result = await updatePatient(editingPatient.Patient_ID, patientData);
      } else {
        result = await createPatient(patientData);
      }

      if (result.success) {
        showNotification(
          editingPatient 
            ? "Paciente actualizado exitosamente" 
            : "Paciente agregado exitosamente"
        );
        closeModal();
        fetchPatients(); // Recargar la lista
      } else {
        showNotification(result.error || "Error al guardar paciente", "error");
      }
    } catch (error) {
      showNotification("Error al guardar paciente", "error");
      console.error("Error saving patient:", error);
    }
  };

  // Confirmar eliminación
  const confirmDelete = (patient) => {
    setDeleteConfirm({
      id: patient.Patient_ID,
      name: formatFullName(patient)
    });
  };

  // Ejecutar eliminación
  const handleDeletePatient = async () => {
    if (!deleteConfirm) return;

    try {
      const result = await deletePatient(deleteConfirm.id);
      
      if (result.success) {
        showNotification("Paciente eliminado exitosamente");
      } else {
        showNotification(result.error || "Error al eliminar paciente", "error");
      }
    } catch (error) {
      showNotification("Error al eliminar paciente", "error");
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Estado de carga
  if (loading && patients.length === 0) {
    return (
      <div className="patients-container">
        <div className="loading-message">
          <div className="loading-spinner"></div>
          <p>Cargando pacientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="patients-container">
      {/* Notificación */}
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>Confirmar Eliminación</h3>
            <p>¿Estás seguro de que deseas eliminar al paciente <strong>{deleteConfirm.name}</strong>?</p>
            <p className="warning-text">Esta acción no se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn-confirm" onClick={handleDeletePatient}>
                Sí, Eliminar
              </button>
              <button className="btn-cancel" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para agregar/editar paciente */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{editingPatient ? "Editar Paciente" : "Agregar Nuevo Paciente"}</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Primer Nombre *</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleFormChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Segundo Nombre</label>
                <input
                  type="text"
                  name="middle_name"
                  value={formData.middle_name}
                  onChange={handleFormChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Primer Apellido *</label>
                <input
                  type="text"
                  name="first_last_name"
                  value={formData.first_last_name}
                  onChange={handleFormChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Segundo Apellido</label>
                <input
                  type="text"
                  name="second_last_name"
                  value={formData.second_last_name}
                  onChange={handleFormChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Cédula o Identificación *</label>
                <input
                  type="text"
                  name="identification"
                  value={formData.identification}
                  onChange={handleFormChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Fecha de Nacimiento</label>
                <input
                  type="date"
                  name="birthdate"
                  value={formData.birthdate}
                  onChange={handleFormChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Teléfono</label>
              <input
                type="tel"
                name="number_phone"
                value={formData.number_phone}
                onChange={handleFormChange}
              />
            </div>

            <div className="form-group">
              <label>Correo Electrónico</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleFormChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Profesión</label>
                <input
                  type="text"
                  name="profession"
                  value={formData.profession}
                  onChange={handleFormChange}
                />
              </div>
              
              <div className="form-group address-field">
                <label>Dirección</label>
                <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleFormChange}
                    rows="3"
                    className="address-textarea"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-confirm" onClick={handleSavePatient}>
                {editingPatient ? "Actualizar Paciente" : "Agregar Paciente"}
              </button>
              <button className="btn-cancel" onClick={closeModal}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Encabezado de la página */}
      <div className="patients-header">
        <h2>Pacientes</h2>
        <div className="patients-tools">
          <div className="search-wrapper">
            <input
              className="search-box"
              placeholder="Buscar paciente por nombre, apellido o cédula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="gray" viewBox="0 0 16 16">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
            </svg>
          </div>
          
          {search && (
            <button 
              className="btn-clear-filters" 
              onClick={() => setSearch("")}
              title="Limpiar búsqueda"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708" />
              </svg>
            </button>
          )}
          
          <div className="patients-count">
            <span>{filteredPatients.length}</span>
            <span>/</span>
            <span>{patients.length}</span>
          </div>
        </div>
      </div>

      {/* Botón de acción principal */}
      <div className="action-buttons">
        <button className="btn-action-primary" onClick={openAddModal}>
          <span>👤</span>
          Agregar Nuevo Paciente
        </button>
      </div>

      {/* Sección de tabla */}
      <div className="patients-section">
        <h3>Lista de Pacientes ({filteredPatients.length})</h3>
        
        {filteredPatients.length === 0 ? (
          <div className="no-results">
            <p>
              {search 
                ? "No se encontraron pacientes que coincidan con la búsqueda." 
                : "No hay pacientes registrados."}
            </p>
            <button className="btn-add-first" onClick={openAddModal}>
              Agregar primer paciente
            </button>
          </div>
        ) : (
          <div className="table-responsive-container">
            <table className="patients-table">
              <thead>
                <tr>
                  <th>Nombre Completo</th>
                  <th>Cédula</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Edad</th>
                  <th>Fecha de Registro</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((patient) => (
                  <tr key={patient.Patient_ID}>
                    <td className="patient-name-cell">
                      <div className="patient-name">
                        <strong>{formatFullName(patient)}</strong>
                        {patient.profession && (
                          <span className="patient-profession">{patient.profession}</span>
                        )}
                      </div>
                    </td>
                    <td className="patient-id">
                      {patient.identification || "N/A"}
                    </td>
                    <td>
                      {patient.number_phone ? formatPhone(patient.number_phone) : "N/A"}
                    </td>
                    <td>
                      {patient.email ? (
                        <a href={`mailto:${patient.email}`} className="patient-email">
                          {patient.email}
                        </a>
                      ) : "N/A"}
                    </td>
                    <td>
                      {patient.birthdate ? `${calculateAge(patient.birthdate)} años` : "N/A"}
                    </td>
                    <td>
                      {patient.creation_date ? formatDate(patient.creation_date) : "N/A"}
                    </td>
                    <td className="actions-cell">
                      <button 
                        className="btn-edit"
                        onClick={() => openEditModal(patient)}
                        title="Editar paciente"
                      >
                        ✏️ Editar
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => confirmDelete(patient)}
                        title="Eliminar paciente"
                      >
                        🗑️ Eliminar
                      </button>
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