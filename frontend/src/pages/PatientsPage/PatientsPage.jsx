// frontend/src/pages/PatientPage/PatientPage.jsx
import { useContext, useState, useEffect } from "react";
import { AppContext } from "../../context/AppContext";
import { formatDate, formatPhone, calculateAge, formatFullName, formatBoolean } from "../../utils/formatters";
import "./PatientsPage.css";

export default function PatientsPage() {
  const { 
    patients, 
    fetchPatients, 
    createPatient, 
    updatePatient, 
    deletePatient,
    getPatientMedicalInfo,
    createPatientMedicalInfo,
    updatePatientMedicalInfo,
    loading
  } = useContext(AppContext);
  
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(null);
  const [formData, setFormData] = useState({
    // Información personal
    first_name: "",
    middle_name: "",
    first_last_name: "",
    second_last_name: "",
    identification: "",
    number_phone: "",
    email: "",
    profession: "",
    address: "",
    birthdate: "",
    
    // Información médica
    emergency_contact_name: "",
    emergency_contact_relationship: "",
    emergency_contact_phone: "",
    oral_health_status: "",
    last_dental_visit: "",
    medical_conditions: "",
    allergies: "",
    current_medications: "",
    previous_anesthesia: false,
    anesthesia_notes: "",
    smokes: false,
    drinks_alcohol: false,
    other_substances: "",
    substance_frequency: "",
    general_notes: "",
    
    // Nuevos campos de odontograma
    odontogram_1: "",
    odontogram_2: "",
    odontogram_3: "",
    odontogram_4: ""
  });
  const [editingPatient, setEditingPatient] = useState(null);
  const [viewingPatient, setViewingPatient] = useState(null);
  const [patientMedicalInfo, setPatientMedicalInfo] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // Estados para confirmación de guardado
  const [saveConfirm, setSaveConfirm] = useState(null);
  // Estado para confirmación de cancelar/cerrar
  const [closeConfirm, setCloseConfirm] = useState(null);

  // CONSTANTE PARA EL LINK DE GOOGLE DRIVE
  // ===================================================
  // TODO: Reemplazar con el enlace real de Google Drive
  // ===================================================
  const GOOGLE_DRIVE_CLINICAL_FILES_URL = ""; // Agrega aquí el link de Google Drive

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

  // Verificar si hay cambios en el formulario
  const hasFormChanges = () => {
    if (!modalOpen) return false;

    if (editingPatient) {
      // Comparar con datos originales del paciente
      return Object.keys(formData).some(key => {
        if (key === 'birthdate') {
          const formDate = formData[key] || null;
          const patientDate = editingPatient[key] ? editingPatient[key].split('T')[0] : null;
          return formDate !== patientDate;
        }
        // Para campos médicos que no están en el objeto patient
        if (!(key in editingPatient)) {
          return formData[key] !== "" && formData[key] !== false;
        }
        return formData[key] !== (editingPatient[key] || "");
      });
    } else {
      // Para creación, verificar si hay algún campo lleno
      return Object.keys(formData).some(key => {
        const value = formData[key];
        return value !== "" && value !== false;
      });
    }
  };

  // Manejar cambios en el formulario
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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
      birthdate: "",
      emergency_contact_name: "",
      emergency_contact_relationship: "",
      emergency_contact_phone: "",
      oral_health_status: "",
      last_dental_visit: "",
      medical_conditions: "",
      allergies: "",
      current_medications: "",
      previous_anesthesia: false,
      anesthesia_notes: "",
      smokes: false,
      drinks_alcohol: false,
      other_substances: "",
      substance_frequency: "",
      general_notes: "",
      odontogram_1: "",
      odontogram_2: "",
      odontogram_3: "",
      odontogram_4: ""
    });
    setModalOpen("add");
  };

  // Abrir modal para editar paciente - VERSIÓN CORREGIDA (SIN TIMEOUT)
const openEditModal = async (patient) => {
  setEditingPatient(patient);
  
  // Primero cargar los datos básicos del paciente
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
    birthdate: patient.birthdate ? patient.birthdate.split('T')[0] : "",
    // Resetear TODOS los campos médicos a vacío
    emergency_contact_name: "",
    emergency_contact_relationship: "",
    emergency_contact_phone: "",
    oral_health_status: "",
    last_dental_visit: "",
    medical_conditions: "",
    allergies: "",
    current_medications: "",
    previous_anesthesia: false,
    anesthesia_notes: "",
    smokes: false,
    drinks_alcohol: false,
    other_substances: "",
    substance_frequency: "",
    general_notes: "",
    odontogram_1: "",
    odontogram_2: "",
    odontogram_3: "",
    odontogram_4: ""
  });
  
  // ABRIR EL MODAL PRIMERO
  setModalOpen("edit");
  
  // Cargar información médica (usando await y llamando directamente)
  await loadMedicalInfo(patient.Patient_ID);
};

  // Abrir modal para ver paciente (solo lectura)
  const openViewModal = async (patient) => {
    setViewingPatient(patient);
    
    // Cargar información médica
    await loadMedicalInfo(patient.Patient_ID);
    setViewModalOpen(true);
  };

  // Cargar información médica - VERSIÓN CORREGIDA
const loadMedicalInfo = async (patientId) => {
  try {
    const result = await getPatientMedicalInfo(patientId);
    if (result.success && result.data) {
      setPatientMedicalInfo(result.data);
      
      // Cargar los datos médicos en el formulario SIEMPRE que estemos en modo edición
      if (modalOpen === "edit") {
        console.log("📥 Cargando información médica en formulario:", result.data);
        
        setFormData(prev => ({
          ...prev,
          emergency_contact_name: result.data.emergency_contact_name || "",
          emergency_contact_relationship: result.data.emergency_contact_relationship || "",
          emergency_contact_phone: result.data.emergency_contact_phone || "",
          oral_health_status: result.data.oral_health_status || "",
          last_dental_visit: result.data.last_dental_visit ? result.data.last_dental_visit.split('T')[0] : "",
          medical_conditions: result.data.medical_conditions || "",
          allergies: result.data.allergies || "",
          current_medications: result.data.current_medications || "",
          previous_anesthesia: result.data.previous_anesthesia || false,
          anesthesia_notes: result.data.anesthesia_notes || "",
          smokes: result.data.smokes || false,
          drinks_alcohol: result.data.drinks_alcohol || false,
          other_substances: result.data.other_substances || "",
          substance_frequency: result.data.substance_frequency || "",
          general_notes: result.data.general_notes || "",
          // Cargar odontograma
          odontogram_1: result.data.odontogram_1 || "",
          odontogram_2: result.data.odontogram_2 || "",
          odontogram_3: result.data.odontogram_3 || "",
          odontogram_4: result.data.odontogram_4 || ""
        }));
      }
    } else {
      setPatientMedicalInfo(null);
    }
  } catch (error) {
    console.error("Error cargando información médica:", error);
    setPatientMedicalInfo(null);
  }
};

  // SOLICITAR CONFIRMACIÓN PARA CERRAR
  const requestCloseModal = () => {
    if (hasFormChanges()) {
      setCloseConfirm({
        action: "cerrar",
        message: editingPatient 
          ? "Tienes cambios sin guardar. ¿Estás seguro de que deseas cancelar la edición?"
          : "Tienes información sin guardar. ¿Estás seguro de que deseas cancelar la creación?"
      });
    } else {
      // Si no hay cambios, cerrar directamente
      closeModal();
    }
  };

  // Cerrar modal de edición (sin confirmación, uso interno)
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
      birthdate: "",
      emergency_contact_name: "",
      emergency_contact_relationship: "",
      emergency_contact_phone: "",
      oral_health_status: "",
      last_dental_visit: "",
      medical_conditions: "",
      allergies: "",
      current_medications: "",
      previous_anesthesia: false,
      anesthesia_notes: "",
      smokes: false,
      drinks_alcohol: false,
      other_substances: "",
      substance_frequency: "",
      general_notes: "",
      odontogram_1: "",
      odontogram_2: "",
      odontogram_3: "",
      odontogram_4: ""
    });
    setPatientMedicalInfo(null);
    setSaveConfirm(null);
    setCloseConfirm(null);
  };

  // Cancelar cierre (volver al formulario)
  const cancelClose = () => {
    setCloseConfirm(null);
  };

  // Cerrar modal de vista
  const closeViewModal = () => {
    setViewModalOpen(false);
    setViewingPatient(null);
    setPatientMedicalInfo(null);
  };

  // Validar formulario
  const validateForm = () => {
    if (!formData.first_name || !formData.first_last_name) {
      showNotification("Nombre y apellido son campos obligatorios", "error");
      return false;
    }
    return true;
  };

  // MOSTRAR CONFIRMACIÓN DE GUARDADO
  const confirmSave = () => {
    if (!validateForm()) return;
    
    // Verificar si hay cambios (solo para edición)
    if (editingPatient) {
      const hasChanges = Object.keys(formData).some(key => {
        if (key === 'birthdate') {
          const formDate = formData[key] || null;
          const patientDate = editingPatient[key] ? editingPatient[key].split('T')[0] : null;
          return formDate !== patientDate;
        }
        // Para campos médicos que no están en el objeto patient
        if (!(key in editingPatient)) {
          return formData[key] !== "" && formData[key] !== false;
        }
        return formData[key] !== (editingPatient[key] || "");
      });

      if (!hasChanges) {
        showNotification("No hay cambios para guardar", "info");
        return;
      }
    }

    // Mostrar confirmación
    setSaveConfirm({
      action: editingPatient ? "actualizar" : "crear",
      patientName: editingPatient 
        ? formatFullName(editingPatient)
        : `${formData.first_name || ''} ${formData.first_last_name || ''}`.trim() || "nuevo paciente"
    });
  };

  // CANCELAR GUARDADO
  const cancelSave = () => {
    setSaveConfirm(null);
  };

  // EJECUTAR GUARDADO (cuando se confirma)
  const handleSavePatient = async () => {
    if (!saveConfirm) return;

    try {
      // Separar datos personales y médicos
      const { 
        emergency_contact_name,
        emergency_contact_relationship,
        emergency_contact_phone,
        oral_health_status,
        last_dental_visit,
        medical_conditions,
        allergies,
        current_medications,
        previous_anesthesia,
        anesthesia_notes,
        smokes,
        drinks_alcohol,
        other_substances,
        substance_frequency,
        general_notes,
        odontogram_1,
        odontogram_2,
        odontogram_3,
        odontogram_4,
        ...patientData 
      } = formData;

      console.log('📋 Datos del formulario:', formData);
      
      // Preparar datos personales con birthdate como null si está vacío
      const personalData = {
        ...patientData,
        birthdate: patientData.birthdate ? patientData.birthdate : null,
        number_phone: patientData.number_phone ? 
          Number(patientData.number_phone) : null
      };

      console.log('👤 Datos personales preparados:', personalData);
      
      // Preparar datos médicos con last_dental_visit como null si está vacío
      const medicalInfoData = {
        emergency_contact_name,
        emergency_contact_relationship,
        emergency_contact_phone,
        oral_health_status,
        last_dental_visit: last_dental_visit ? last_dental_visit : null,
        medical_conditions,
        allergies,
        current_medications,
        previous_anesthesia,
        anesthesia_notes,
        smokes,
        drinks_alcohol,
        other_substances,
        substance_frequency,
        general_notes,
        // Nuevos campos de odontograma
        odontogram_1,
        odontogram_2,
        odontogram_3,
        odontogram_4
      };

      console.log('🏥 Datos médicos preparados:', medicalInfoData);

      let result;
      if (editingPatient) {
        // Actualizar datos personales
        result = await updatePatient(editingPatient.Patient_ID, personalData);
        
        // Actualizar información médica (usar PUT para upsert)
        if (result.success) {
          await updatePatientMedicalInfo(editingPatient.Patient_ID, medicalInfoData);
        }
      } else {
        // Crear paciente - Solo enviar datos personales primero
        result = await createPatient(personalData);
        
        console.log('📦 Resultado de createPatient:', result);
        
        if (result.success && result.data && result.data.Patient_ID) {
          const patientId = result.data.Patient_ID;
          
          // Verificar si hay datos médicos para crear
          const hasMedicalData = Object.values(medicalInfoData).some(value => 
            value !== "" && value !== false && value !== null && value !== undefined
          );
          
          if (hasMedicalData) {
            console.log('📝 Creando información médica para paciente ID:', patientId);
            await createPatientMedicalInfo(patientId, medicalInfoData);
          }
        }
      }

      if (result.success) {
        showNotification(
          editingPatient 
            ? "Paciente actualizado exitosamente" 
            : "Paciente agregado exitosamente"
        );
        setSaveConfirm(null);
        closeModal();
        fetchPatients();
      } else {
        const errorMessage = result.error || "Error al guardar paciente";
        showNotification(errorMessage, "error");
        console.error('❌ Error en handleSavePatient:', result);
        setSaveConfirm(null);
      }
    } catch (error) {
      showNotification("Error al guardar paciente: " + error.message, "error");
      console.error("Error saving patient:", error);
      setSaveConfirm(null);
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

  // Función para formatear valores booleanos
  const formatBooleanValue = (value) => {
    return value ? "Sí" : "No";
  };

  // Función para formatear salud bucal
  const formatOralHealth = (status) => {
    const statusMap = {
      'buena': 'Buena',
      'regular': 'Regular',
      'mala': 'Mala'
    };
    return statusMap[status] || 'No especificado';
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
        <div className="modal-backdrop delete-confirm-backdrop" onClick={() => setDeleteConfirm(null)}>
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

      {/* Modal de confirmación de guardado */}
      {saveConfirm && (
        <div className="modal-backdrop save-confirm-backdrop" onClick={cancelSave}>
          <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>Confirmar {saveConfirm.action === "actualizar" ? "Actualización" : "Creación"}</h3>
            <p>
              ¿Estás seguro de que deseas <strong>{saveConfirm.action}</strong> al paciente{' '}
              <strong>{saveConfirm.patientName}</strong>?
            </p>
            {saveConfirm.action === "actualizar" && (
              <p className="info-text">Los datos del paciente serán actualizados con la información proporcionada.</p>
            )}
            <div className="modal-actions">
              <button className="btn-confirm" onClick={handleSavePatient}>
                Sí, {saveConfirm.action === "actualizar" ? "Actualizar" : "Crear"}
              </button>
              <button className="btn-cancel" onClick={cancelSave}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para cerrar/cancelar */}
      {closeConfirm && (
        <div className="modal-backdrop close-confirm-backdrop" onClick={cancelClose}>
          <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>¿Cancelar cambios?</h3>
            <p>{closeConfirm.message}</p>
            <p className="warning-text">Los cambios no guardados se perderán.</p>
            <div className="modal-actions">
              <button className="btn-confirm" onClick={closeModal}>
                Sí, Cancelar
              </button>
              <button className="btn-cancel" onClick={cancelClose}>
                Seguir Editando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para VER paciente (solo lectura) */}
      {viewModalOpen && viewingPatient && (
        <div className="modal-backdrop" onClick={closeViewModal}>
          <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
            <h3>Información Completa del Paciente</h3>
            
            <div className="patient-view-container">
              {/* Información Personal */}
              <div className="view-section">
                <h4>Información Personal</h4>
                <div className="view-grid">
                  <div className="view-item">
                    <span className="view-label">Nombre Completo:</span>
                    <span className="view-value">{formatFullName(viewingPatient)}</span>
                  </div>
                  <div className="view-item">
                    <span className="view-label">Cédula:</span>
                    <span className="view-value">{viewingPatient.identification || "N/A"}</span>
                  </div>
                  <div className="view-item">
                    <span className="view-label">Teléfono:</span>
                    <span className="view-value">{viewingPatient.number_phone ? formatPhone(viewingPatient.number_phone) : "N/A"}</span>
                  </div>
                  <div className="view-item">
                    <span className="view-label">Email:</span>
                    <span className="view-value">{viewingPatient.email || "N/A"}</span>
                  </div>
                  <div className="view-item">
                    <span className="view-label">Profesión:</span>
                    <span className="view-value">{viewingPatient.profession || "N/A"}</span>
                  </div>
                  <div className="view-item">
                    <span className="view-label">Fecha de Nacimiento:</span>
                    <span className="view-value">
                      {viewingPatient.birthdate 
                        ? `${formatDate(viewingPatient.birthdate)} (${calculateAge(viewingPatient.birthdate)} años)`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="view-item full-width">
                    <span className="view-label">Dirección:</span>
                    <span className="view-value address-value">{viewingPatient.address || "N/A"}</span>
                  </div>
                  <div className="view-item">
                    <span className="view-label">Fecha de Registro:</span>
                    <span className="view-value">{formatDate(viewingPatient.creation_date)}</span>
                  </div>
                </div>
              </div>

              {/* Información Médica */}
              {patientMedicalInfo && (
                <div className="view-section">
                  <h4>Información Médica y de Emergencia</h4>
                  
                  {/* Contacto de Emergencia */}
                  <div className="view-subsection">
                    <h5>Contacto de Emergencia</h5>
                    <div className="view-grid">
                      <div className="view-item">
                        <span className="view-label">Nombre:</span>
                        <span className="view-value">{patientMedicalInfo.emergency_contact_name || "N/A"}</span>
                      </div>
                      <div className="view-item">
                        <span className="view-label">Parentesco:</span>
                        <span className="view-value">{patientMedicalInfo.emergency_contact_relationship || "N/A"}</span>
                      </div>
                      <div className="view-item">
                        <span className="view-label">Teléfono:</span>
                        <span className="view-value">{patientMedicalInfo.emergency_contact_phone || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Salud Bucal */}
                  <div className="view-subsection">
                    <h5>Salud Bucal</h5>
                    <div className="view-grid">
                      <div className="view-item">
                        <span className="view-label">Estado:</span>
                        <span className="view-value">{formatOralHealth(patientMedicalInfo.oral_health_status)}</span>
                      </div>
                      <div className="view-item">
                        <span className="view-label">Última Visita:</span>
                        <span className="view-value">
                          {patientMedicalInfo.last_dental_visit 
                            ? formatDate(patientMedicalInfo.last_dental_visit)
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Historial Médico */}
                  <div className="view-subsection">
                    <h5>Historial Médico</h5>
                    <div className="view-grid">
                      <div className="view-item full-width">
                        <span className="view-label">Enfermedades Importantes:</span>
                        <span className="view-value multiline">{patientMedicalInfo.medical_conditions || "N/A"}</span>
                      </div>
                      <div className="view-item full-width">
                        <span className="view-label">Alergias a Medicamentos:</span>
                        <span className="view-value multiline">{patientMedicalInfo.allergies || "N/A"}</span>
                      </div>
                      <div className="view-item full-width">
                        <span className="view-label">Medicamentos Actuales:</span>
                        <span className="view-value multiline">{patientMedicalInfo.current_medications || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Anestesia */}
                  <div className="view-subsection">
                    <h5>Historial de Anestesia</h5>
                    <div className="view-grid">
                      <div className="view-item">
                        <span className="view-label">Anestesiado Anteriormente:</span>
                        <span className="view-value">{formatBooleanValue(patientMedicalInfo.previous_anesthesia)}</span>
                      </div>
                      {patientMedicalInfo.previous_anesthesia && (
                        <div className="view-item full-width">
                          <span className="view-label">Notas sobre Anestesia:</span>
                          <span className="view-value multiline">{patientMedicalInfo.anesthesia_notes || "N/A"}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hábitos */}
                  <div className="view-subsection">
                    <h5>Hábitos</h5>
                    <div className="view-grid">
                      <div className="view-item">
                        <span className="view-label">Fuma:</span>
                        <span className="view-value">{formatBooleanValue(patientMedicalInfo.smokes)}</span>
                      </div>
                      <div className="view-item">
                        <span className="view-label">Bebidas Alcohólicas:</span>
                        <span className="view-value">{formatBooleanValue(patientMedicalInfo.drinks_alcohol)}</span>
                      </div>
                      <div className="view-item">
                        <span className="view-label">Otras Sustancias:</span>
                        <span className="view-value">{patientMedicalInfo.other_substances || "N/A"}</span>
                      </div>
                      <div className="view-item">
                        <span className="view-label">Frecuencia de Consumo:</span>
                        <span className="view-value">{patientMedicalInfo.substance_frequency || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notas Generales */}
                  {patientMedicalInfo.general_notes && (
                    <div className="view-subsection">
                      <h5>Notas Adicionales</h5>
                      <div className="view-item full-width">
                        <span className="view-value multiline">{patientMedicalInfo.general_notes}</span>
                      </div>
                    </div>
                  )}

                  {/* SECCIÓN DE ODONTOGRAMA - VERSIÓN VERTICAL */}
                  <div className="view-subsection odontogram-view-section">
                    <h4 className="odontogram-title">Odontograma</h4>
                    
                    <div className="odontogram-vertical-view">
                      {/* Sección 1 - Superior Derecho */}
                      <div className="odontogram-segment-horizontal">
                        <div className="odontogram-header">1. Superior Derecho</div>
                        <div className="odontogram-content-horizontal">
                          {patientMedicalInfo.odontogram_1 ? (
                            <div className="odontogram-text-display">{patientMedicalInfo.odontogram_1}</div>
                          ) : (
                            <p className="odontogram-empty">Sin datos</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Sección 2 - Superior Izquierdo */}
                      <div className="odontogram-segment-horizontal">
                        <div className="odontogram-header">2. Superior Izquierdo</div>
                        <div className="odontogram-content-horizontal">
                          {patientMedicalInfo.odontogram_2 ? (
                            <div className="odontogram-text-display">{patientMedicalInfo.odontogram_2}</div>
                          ) : (
                            <p className="odontogram-empty">Sin datos</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Sección 3 - Inferior Izquierdo */}
                      <div className="odontogram-segment-horizontal">
                        <div className="odontogram-header">3. Inferior Izquierdo</div>
                        <div className="odontogram-content-horizontal">
                          {patientMedicalInfo.odontogram_3 ? (
                            <div className="odontogram-text-display">{patientMedicalInfo.odontogram_3}</div>
                          ) : (
                            <p className="odontogram-empty">Sin datos</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Sección 4 - Inferior Derecho */}
                      <div className="odontogram-segment-horizontal">
                        <div className="odontogram-header">4. Inferior Derecho</div>
                        <div className="odontogram-content-horizontal">
                          {patientMedicalInfo.odontogram_4 ? (
                            <div className="odontogram-text-display">{patientMedicalInfo.odontogram_4}</div>
                          ) : (
                            <p className="odontogram-empty">Sin datos</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Si no hay información médica */}
              {!patientMedicalInfo && (
                <div className="view-section">
                  <h4>Información Médica</h4>
                  <p className="no-medical-info">No hay información médica registrada para este paciente.</p>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={closeViewModal}>
                Cerrar
              </button>
              <button 
                className="btn-confirm" 
                onClick={() => {
                  closeViewModal();
                  openEditModal(viewingPatient);
                }}
              >
                Editar Paciente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para AGREGAR/EDITAR paciente */}
      {modalOpen && (
        <div className="modal-backdrop form-modal-backdrop">
          <div className="modal-content form-modal" onClick={e => e.stopPropagation()}>
            <h3>{editingPatient ? "Editar Paciente" : "Agregar Nuevo Paciente"}</h3>
            
            <div className="form-scroll-container">
              {/* Sección de información personal */}
              <div className="personal-info-section">
                <h4>Información Personal</h4>
                
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
                    <label>Cédula o Identificación</label>
                    <input
                      type="text"
                      name="identification"
                      value={formData.identification}
                      onChange={handleFormChange}
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

              {/* Sección de información médica */}
              <div className="medical-info-section">
                <h4>Información Médica y de Emergencia</h4>
                
                {/* Contacto de Emergencia */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Contacto de Emergencia (Nombre)</label>
                    <input
                      type="text"
                      name="emergency_contact_name"
                      value={formData.emergency_contact_name}
                      onChange={handleFormChange}
                      placeholder="Nombre del contacto"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Parentesco</label>
                    <input
                      type="text"
                      name="emergency_contact_relationship"
                      value={formData.emergency_contact_relationship}
                      onChange={handleFormChange}
                      placeholder="Ej: Padre, Madre, Cónyuge"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Teléfono de Emergencia</label>
                  <input
                    type="tel"
                    name="emergency_contact_phone"
                    value={formData.emergency_contact_phone}
                    onChange={handleFormChange}
                    placeholder="Número de teléfono"
                  />
                </div>
                
                {/* Salud Bucal */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Salud Bucal</label>
                    <select
                      name="oral_health_status"
                      value={formData.oral_health_status}
                      onChange={handleFormChange}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="buena">Buena</option>
                      <option value="regular">Regular</option>
                      <option value="mala">Mala</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Última Visita al Odontólogo</label>
                    <input
                      type="date"
                      name="last_dental_visit"
                      value={formData.last_dental_visit}
                      onChange={handleFormChange}
                    />
                  </div>
                </div>
                
                {/* Historial Médico */}
                <div className="form-group">
                  <label>Enfermedades Importantes</label>
                  <textarea
                    name="medical_conditions"
                    value={formData.medical_conditions}
                    onChange={handleFormChange}
                    rows="2"
                    placeholder="¿Padece o ha padecido alguna enfermedad que considere importante dar a conocer?"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Alergias a Medicamentos</label>
                    <textarea
                      name="allergies"
                      value={formData.allergies}
                      onChange={handleFormChange}
                      rows="2"
                      placeholder="¿Es alérgico a algún medicamento?"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Medicamentos Actuales</label>
                    <textarea
                      name="current_medications"
                      value={formData.current_medications}
                      onChange={handleFormChange}
                      rows="2"
                      placeholder="¿Está tomando algún medicamento?"
                    />
                  </div>
                </div>
                
                {/* Anestesia */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="previous_anesthesia"
                        checked={formData.previous_anesthesia}
                        onChange={handleFormChange}
                      />
                      ¿Ha sido anestesiado anteriormente?
                    </label>
                  </div>
                </div>
                
                {formData.previous_anesthesia && (
                  <div className="form-group">
                    <label>Notas sobre Anestesia</label>
                    <textarea
                      name="anesthesia_notes"
                      value={formData.anesthesia_notes}
                      onChange={handleFormChange}
                      rows="2"
                      placeholder="Detalles sobre experiencias previas con anestesia..."
                    />
                  </div>
                )}
                
                {/* Hábitos */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="smokes"
                        checked={formData.smokes}
                        onChange={handleFormChange}
                      />
                      ¿Fuma?
                    </label>
                  </div>
                  
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="drinks_alcohol"
                        checked={formData.drinks_alcohol}
                        onChange={handleFormChange}
                      />
                      ¿Ingiere bebidas alcohólicas?
                    </label>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Otras Sustancias</label>
                    <input
                      type="text"
                      name="other_substances"
                      value={formData.other_substances}
                      onChange={handleFormChange}
                      placeholder="¿Otro tipo de sustancia?"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Frecuencia de Consumo</label>
                    <input
                      type="text"
                      name="substance_frequency"
                      value={formData.substance_frequency}
                      onChange={handleFormChange}
                      placeholder="¿Cada cuánto consume?"
                    />
                  </div>
                </div>
                
                
              </div>

              {/* SECCIÓN DE ODONTOGRAMA - VERSIÓN VERTICAL */}
              <div className="odontogram-form-section">
                <h4 className="odontogram-section-title">Odontograma</h4>
                <p className="odontogram-instructions">Ingresa la información de cada cuadrante dental según el formato establecido.</p>
                
                <div className="odontogram-vertical-grid">
                  <div className="odontogram-input-group-full">
                    <label>
                      1. Superior Derecho 
                      <span className="odontogram-hint">(Dientes: 18 al 11)</span>
                    </label>
                    <textarea
                      name="odontogram_1"
                      value={formData.odontogram_1}
                      onChange={handleFormChange}
                      rows="3"
                      placeholder="Ej: 1.1(01), 1.2(02), 1.3(05+01)..."
                      className="odontogram-textarea-horizontal"
                    />
                  </div>
                  
                  <div className="odontogram-input-group-full">
                    <label>
                      2. Superior Izquierdo 
                      <span className="odontogram-hint">(Dientes: 21 al 28)</span>
                    </label>
                    <textarea
                      name="odontogram_2"
                      value={formData.odontogram_2}
                      onChange={handleFormChange}
                      rows="3"
                      placeholder="Ej: 2.1(01), 2.2(02), 2.3(05+01)..."
                      className="odontogram-textarea-horizontal"
                    />
                  </div>
                  
                  <div className="odontogram-input-group-full">
                    <label>
                      3. Inferior Izquierdo 
                      <span className="odontogram-hint">(Dientes: 31 al 38)</span>
                    </label>
                    <textarea
                      name="odontogram_3"
                      value={formData.odontogram_3}
                      onChange={handleFormChange}
                      rows="3"
                      placeholder="Ej: 3.1(01), 3.2(02), 3.3(05+01)..."
                      className="odontogram-textarea-horizontal"
                    />
                  </div>
                  
                  <div className="odontogram-input-group-full">
                    <label>
                      4. Inferior Derecho 
                      <span className="odontogram-hint">(Dientes: 41 al 48)</span>
                    </label>
                    <textarea
                      name="odontogram_4"
                      value={formData.odontogram_4}
                      onChange={handleFormChange}
                      rows="3"
                      placeholder="Ej: 4.1(01), 4.2(02), 4.3(05+01)..."
                      className="odontogram-textarea-horizontal"
                    />
                  </div>
                </div>
              </div>

                {/* Notas Generales */}
                <div className="form-group">
                  <label>Notas Adicionales</label>
                  <textarea
                    name="general_notes"
                    value={formData.general_notes}
                    onChange={handleFormChange}
                    rows="3"
                    placeholder="Notas adicionales sobre el paciente..."
                  />
                </div>

            </div>

            <div className="modal-actions">
              <button className="btn-confirm" onClick={confirmSave}>
                {editingPatient ? "Actualizar Paciente" : "Agregar Paciente"}
              </button>
              <button className="btn-cancel" onClick={requestCloseModal}>
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

      {/* Botones de acción principales */}
      <div className="action-buttons">
        <button className="btn-action-primary" onClick={openAddModal}>
          <span>👤</span>
          Agregar Nuevo Paciente
        </button>
        
        {/* BOTÓN PARA GOOGLE DRIVE - SIEMPRE VISIBLE */}
        {GOOGLE_DRIVE_CLINICAL_FILES_URL ? (
          <a 
            href={GOOGLE_DRIVE_CLINICAL_FILES_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn-action-drive"
          >
            <span>📁</span>
            Archivos Clínicos
          </a>
        ) : (
          <button 
            className="btn-action-drive placeholder"
            onClick={() => {
              showNotification("Configura el link de Google Drive en la constante GOOGLE_DRIVE_CLINICAL_FILES_URL", "info");
              console.log('⚠️ GOOGLE_DRIVE_CLINICAL_FILES_URL está vacío - Configurar en PatientPage.jsx');
            }}
            title="Click para ver instrucciones"
          >
            <span>📁</span>
            Archivos Clínicos
            <span style={{ fontSize: '12px', marginLeft: '8px', opacity: 0.9 }}>⚙️</span>
          </button>
        )}
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
                  <th>Edad</th>
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
                      {patient.birthdate ? `${calculateAge(patient.birthdate)} años` : "N/A"}
                    </td>
                    <td className="actions-cell">
                      <button 
                        className="btn-view"
                        onClick={() => openViewModal(patient)}
                        title="Ver información completa"
                      >
                        👁️ Ver
                      </button>
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