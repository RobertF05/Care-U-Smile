// frontend/src/pages/ProcedurePage/ProceduresPage.jsx
import React, { useContext, useState, useEffect, useRef } from "react";
import { AppContext } from "../../context/AppContext";
import { AuthContext } from "../../context/AuthContext";
import { formatDate, formatCurrency } from "../../utils/formatters";
import { useNotification } from '../../context/NotificationContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFilter,
  faTimes,
  faSearch,
  faEye,
  faEdit,
  faTrash,
  faUserDoctor,
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
  faFileMedical,
  faNotesMedical,
  faHospitalUser,
  faFileInvoiceDollar,
  faChartLine,
  faCalculator,
  faChevronDown,
  faChevronUp,
  faSave,
  faQuestionCircle,
  faCheckCircle,
  faTimesCircle,
  faTooth,
  faUserMd,
  faStethoscope
} from '@fortawesome/free-solid-svg-icons';
import "./ProceduresPage.css";

// Definir filtros de tiempo
const TIME_FILTERS = {
  TODAY: 'today',
  THIS_WEEK: 'thisWeek',
  THIS_MONTH: 'thisMonth',
  ALL: 'all'
};

export default function ProceduresPage() {
  const { user } = useContext(AuthContext);
  const { 
    procedures, 
    fetchProceduresNormal,
    updateAppointment, // No usar, es para citas
    loading,
    error: contextError,
    clearError,
    apiFetch
  } = useContext(AppContext);
  
  const { addNotification } = useNotification();
  
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState(TIME_FILTERS.ALL);
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: ""
  });
  const [localError, setLocalError] = useState("");
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState(null);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
  const [currentSettings, setCurrentSettings] = useState({
    exchange_rate: 36.5,
    clinic_payment: 40,
    doctor_payment: 60
  });
  
  // Estados para confirmaciones
  const [saveConfirm, setSaveConfirm] = useState(null);
  const [closeConfirm, setCloseConfirm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Formulario de edición - MISMO QUE EN CONVERSIÓN
  const [editForm, setEditForm] = useState({
    procedure_description: '',
    amount_cordobas: '',
    amount_dollars: '',
    payment_method_cordobas: 'Efectivo',
    payment_method_dollars: 'Efectivo',
    exchange_rate: 36.5,
    external_doctor: false,
    external_doctor_name: '',
    external_doctor_specialty: '',
    external_doctor_payment_type: 'percentage',
    external_doctor_payment_value: '',
    external_doctor_payment_currency: 'C$',
    clinic_payment_percentage: 40,
    doctor_payment_percentage: 60,
    ortho_doctor_percentage: 60,
    external_doctor_percentage: 0,
    external_doctor_split_type: 'from_total',
    observations: '',
    procedure_date: ''
  });
  
  const [externalDoctorPaymentCordobas, setExternalDoctorPaymentCordobas] = useState(0);
  const [externalDoctorPaymentDollars, setExternalDoctorPaymentDollars] = useState(0);
  
  const filtersRef = useRef(null);

  // Cargar configuración actual
  const loadCurrentSettings = async () => {
    try {
      const response = await apiFetch('/settings/current');
      if (response.success && response.data) {
        setCurrentSettings({
          exchange_rate: response.data.exchange_rate || 36.5,
          clinic_payment: response.data.clinic_payment || 40,
          doctor_payment: response.data.doctor_payment || 60
        });
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadProcedures();
      loadCurrentSettings();
    }
  }, [user]);

  // Cargar configuración cuando se abre modal de edición
  useEffect(() => {
    if (editModalOpen) {
      loadCurrentSettings();
    }
  }, [editModalOpen]);

  const loadProcedures = async () => {
    try {
      setLocalError("");
      clearError();
      await fetchProceduresNormal({ 
        timeFilter,
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate
      });
    } catch (error) {
      console.error('Error al cargar procedimientos:', error);
      setLocalError(error.message || 'Error al cargar procedimientos');
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
      
      console.log('🔍 Aplicando filtros:', filters);
      await fetchProceduresNormal(filters);
    } catch (error) {
      console.error('Error al aplicar filtros:', error);
      setLocalError(error.message || 'Error al aplicar filtros');
    }
  };

  const clearFilters = async () => {
    try {
      setLocalError("");
      setSearch("");
      setTimeFilter(TIME_FILTERS.ALL);
      setDateFilter({ startDate: "", endDate: "" });
      await fetchProceduresNormal({ timeFilter: TIME_FILTERS.ALL });
    } catch (error) {
      console.error('Error al limpiar filtros:', error);
      setLocalError(error.message || 'Error al limpiar filtros');
    }
  };

  // ===========================================
  // FUNCIONES DE CÁLCULO (IDÉNTICAS A APPOINTMENTPAGE)
  // ===========================================
  
  const calculatePOSDeduction = (amount) => {
    return amount * 0.055; // 5.5%
  };

  const calculateNetAfterPOS = (amount) => {
    return amount - calculatePOSDeduction(amount);
  };

  const calculateTotalsWithDeductions = () => {
    const cordobas = parseFloat(editForm.amount_cordobas) || 0;
    const dollars = parseFloat(editForm.amount_dollars) || 0;
    const exchangeRate = parseFloat(editForm.exchange_rate) || 1;
    
    const isCordobasPOS = editForm.payment_method_cordobas === 'POS';
    const isDollarsPOS = editForm.payment_method_dollars === 'POS';
    
    const posDeductionCordobas = isCordobasPOS ? (cordobas * 0.055) : 0;
    const posDeductionDollars = isDollarsPOS ? (dollars * 0.055) : 0;
    
    const netCordobas = cordobas - posDeductionCordobas;
    const netDollars = dollars - posDeductionDollars;
    
    const totalDeductions = posDeductionCordobas + (posDeductionDollars * exchangeRate);
    
    const totalProcedureCordobas = netCordobas + (netDollars * exchangeRate);
    const totalProcedureDollars = netDollars + (netCordobas / exchangeRate);
    
    const grossTotalCordobas = cordobas + (dollars * exchangeRate);
    const grossTotalDollars = dollars + (cordobas / exchangeRate);
    
    return {
      grossCordobas: cordobas,
      grossDollars: dollars,
      posDeductionCordobas,
      posDeductionDollars,
      totalDeductions,
      netCordobas,
      netDollars,
      netTotalCordobas: totalProcedureCordobas,
      netTotalDollars: totalProcedureDollars,
      grossTotalCordobas,
      grossTotalDollars,
      isCordobasPOS,
      isDollarsPOS,
      exchangeRate
    };
  };

  const calculateTotalProcedure = () => {
    const totals = calculateTotalsWithDeductions();
    return totals.netTotalCordobas;
  };

  const calculateTotalProcedureUSD = () => {
    const totals = calculateTotalsWithDeductions();
    return totals.netTotalDollars;
  };

  const calculateOrthoPayments = () => {
    const totals = calculateTotalsWithDeductions();
    const exchangeRate = parseFloat(editForm.exchange_rate) || 36.5;
    
    const totalConsultaCordobas = totals.netTotalCordobas;
    const totalConsultaDollars = totals.netTotalDollars;
    
    // Para ortodoncia (aunque no debería llegar aquí porque esto es para procedimientos normales)
    if (editForm.external_doctor) {
      const orthoPercentage = parseFloat(editForm.ortho_doctor_percentage) || 0;
      const externalPercentage = parseFloat(editForm.external_doctor_percentage) || 0;
      const clinicPercentage = 100 - orthoPercentage - externalPercentage;
      
      if (editForm.external_doctor_split_type === 'from_total') {
        const orthoPaymentCordobas = totalConsultaCordobas * (orthoPercentage / 100);
        const externalPaymentCordobas = totalConsultaCordobas * (externalPercentage / 100);
        const clinicPaymentCordobas = totalConsultaCordobas * (clinicPercentage / 100);
        
        const orthoPaymentDollars = totalConsultaDollars * (orthoPercentage / 100);
        const externalPaymentDollars = totalConsultaDollars * (externalPercentage / 100);
        const clinicPaymentDollars = totalConsultaDollars * (clinicPercentage / 100);
        
        return {
          totalConsultaCordobas,
          totalConsultaDollars,
          clinicPaymentCordobas,
          clinicPaymentDollars,
          doctorPaymentCordobas: orthoPaymentCordobas,
          doctorPaymentDollars: orthoPaymentDollars,
          externalPaymentCordobas,
          externalPaymentDollars,
          clinicPercentage,
          doctorPercentage: orthoPercentage,
          externalPercentage
        };
      }
    }
    
    // Procedimiento general con doctor externo
    if (editForm.external_doctor) {
      let externalPaymentCordobas = 0;
      let externalPaymentDollars = 0;
      
      if (editForm.external_doctor_payment_type === 'percentage') {
        const percentage = parseFloat(editForm.external_doctor_payment_value) || 0;
        externalPaymentCordobas = totalConsultaCordobas * (percentage / 100);
        externalPaymentDollars = totalConsultaDollars * (percentage / 100);
      } else {
        const paymentValue = parseFloat(editForm.external_doctor_payment_value) || 0;
        if (editForm.external_doctor_payment_currency === 'US$') {
          externalPaymentDollars = paymentValue;
          externalPaymentCordobas = paymentValue * exchangeRate;
        } else {
          externalPaymentCordobas = paymentValue;
          externalPaymentDollars = paymentValue / exchangeRate;
        }
      }
      
      const clinicPaymentCordobas = totalConsultaCordobas - externalPaymentCordobas;
      const clinicPaymentDollars = totalConsultaDollars - externalPaymentDollars;
      
      return {
        totalConsultaCordobas,
        totalConsultaDollars,
        clinicPaymentCordobas,
        clinicPaymentDollars,
        doctorPaymentCordobas: 0,
        doctorPaymentDollars: 0,
        externalPaymentCordobas,
        externalPaymentDollars,
        clinicPercentage: 100,
        doctorPercentage: 0,
        externalPercentage: editForm.external_doctor_payment_type === 'percentage' ? parseFloat(editForm.external_doctor_payment_value) || 0 : 0
      };
    }
    
    // Procedimiento general sin doctor externo
    return {
      totalConsultaCordobas,
      totalConsultaDollars,
      clinicPaymentCordobas: totalConsultaCordobas,
      clinicPaymentDollars: totalConsultaDollars,
      doctorPaymentCordobas: 0,
      doctorPaymentDollars: 0,
      externalPaymentCordobas: 0,
      externalPaymentDollars: 0,
      clinicPercentage: 100,
      doctorPercentage: 0,
      externalPercentage: 0
    };
  };

  // ===========================================
  // FUNCIONES PARA MANEJAR EL FORMULARIO
  // ===========================================

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePaymentChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleExternalDoctorPaymentChange = (field, value) => {
    let updatedForm = { ...editForm };
    
    if (field === 'payment_type') {
      updatedForm.external_doctor_payment_type = value;
      updatedForm.external_doctor_payment_value = '';
    } else if (field === 'external_doctor') {
      updatedForm.external_doctor = value;
      if (!value) {
        updatedForm.external_doctor_name = '';
        updatedForm.external_doctor_specialty = '';
        updatedForm.external_doctor_payment_value = '';
        updatedForm.external_doctor_percentage = 0;
      }
    } else {
      updatedForm[field] = value;
    }
    
    // Calcular montos de doctor externo
    if (updatedForm.external_doctor && updatedForm.external_doctor_payment_value) {
      const totals = calculateTotalsWithDeductions();
      const paymentValue = parseFloat(updatedForm.external_doctor_payment_value) || 0;
      const exchangeRate = parseFloat(updatedForm.exchange_rate) || 36.5;
      
      if (updatedForm.external_doctor_payment_type === 'percentage') {
        const percentage = paymentValue / 100;
        setExternalDoctorPaymentCordobas(totals.netTotalCordobas * percentage);
        setExternalDoctorPaymentDollars(totals.netTotalDollars * percentage);
      } else {
        if (updatedForm.external_doctor_payment_currency === 'US$') {
          setExternalDoctorPaymentDollars(paymentValue);
          setExternalDoctorPaymentCordobas(paymentValue * exchangeRate);
        } else {
          setExternalDoctorPaymentCordobas(paymentValue);
          setExternalDoctorPaymentDollars(paymentValue / exchangeRate);
        }
      }
    } else {
      setExternalDoctorPaymentCordobas(0);
      setExternalDoctorPaymentDollars(0);
    }
    
    setEditForm(updatedForm);
  };

  // ===========================================
  // FUNCIONES PARA ABRIR MODALES
  // ===========================================

  // Abrir modal para ver procedimiento
  const openViewModal = (procedure) => {
    setSelectedProcedure(procedure);
    setViewModalOpen(true);
  };

  // Abrir modal para editar procedimiento
  const openEditModal = (procedure) => {
    console.log('📝 Editando procedimiento:', procedure);
    
    setSelectedProcedure(procedure);
    
    // Cargar datos en el formulario
    setEditForm({
      procedure_description: procedure.procedure_description || '',
      amount_cordobas: procedure.amount_cordobas?.toString() || '',
      amount_dollars: procedure.amount_dollars?.toString() || '',
      payment_method_cordobas: procedure.payment_method_cordobas || 'Efectivo',
      payment_method_dollars: procedure.payment_method_dollars || 'Efectivo',
      exchange_rate: procedure.exchange_rate_used?.toString() || currentSettings.exchange_rate.toString(),
      external_doctor: procedure.has_external_doctor || !!procedure.external_doctor_name || (procedure.external_doctor_payment > 0),
      external_doctor_name: procedure.external_doctor_name || '',
      external_doctor_specialty: procedure.external_doctor_specialty || '',
      external_doctor_payment_type: procedure.external_doctor_payment_type || 'percentage',
      external_doctor_payment_value: procedure.external_doctor_payment_value?.toString() || 
                                     (procedure.external_doctor_percentage?.toString() || ''),
      external_doctor_payment_currency: procedure.external_doctor_payment_currency || 'C$',
      clinic_payment_percentage: procedure.clinic_payment_percentage || 40,
      doctor_payment_percentage: procedure.doctor_payment_percentage || 60,
      ortho_doctor_percentage: procedure.ortho_doctor_percentage || 60,
      external_doctor_percentage: procedure.external_doctor_percentage || 0,
      external_doctor_split_type: procedure.external_doctor_split_type || 'from_total',
      observations: procedure.observations || '',
      procedure_date: procedure.procedure_date_utc || procedure.procedure_date
    });
    
    // Calcular pagos de doctor externo si existe
    if (procedure.external_doctor_payment > 0 || procedure.external_doctor_payment_usd > 0) {
      setExternalDoctorPaymentCordobas(procedure.external_doctor_payment || 0);
      setExternalDoctorPaymentDollars(procedure.external_doctor_payment_usd || 0);
    }
    
    setEditModalOpen(true);
  };

  // ===========================================
  // FUNCIONES PARA CERRAR MODALES CON CONFIRMACIÓN
  // ===========================================

  // Verificar cambios en formulario de edición
  const hasEditFormChanges = () => {
    if (!selectedProcedure) return false;
    
    return (
      editForm.procedure_description !== (selectedProcedure.procedure_description || '') ||
      editForm.amount_cordobas !== (selectedProcedure.amount_cordobas?.toString() || '') ||
      editForm.amount_dollars !== (selectedProcedure.amount_dollars?.toString() || '') ||
      editForm.payment_method_cordobas !== (selectedProcedure.payment_method_cordobas || 'Efectivo') ||
      editForm.payment_method_dollars !== (selectedProcedure.payment_method_dollars || 'Efectivo') ||
      editForm.exchange_rate !== (selectedProcedure.exchange_rate_used?.toString() || currentSettings.exchange_rate.toString()) ||
      editForm.external_doctor !== (selectedProcedure.has_external_doctor || !!selectedProcedure.external_doctor_name) ||
      editForm.external_doctor_name !== (selectedProcedure.external_doctor_name || '') ||
      editForm.external_doctor_specialty !== (selectedProcedure.external_doctor_specialty || '') ||
      editForm.external_doctor_payment_type !== (selectedProcedure.external_doctor_payment_type || 'percentage') ||
      editForm.external_doctor_payment_value !== (selectedProcedure.external_doctor_payment_value?.toString() || selectedProcedure.external_doctor_percentage?.toString() || '') ||
      editForm.external_doctor_payment_currency !== (selectedProcedure.external_doctor_payment_currency || 'C$') ||
      editForm.observations !== (selectedProcedure.observations || '')
    );
  };

  // Solicitar confirmación para cerrar modal de edición
  const requestCloseEditModal = () => {
    if (hasEditFormChanges()) {
      setCloseConfirm({
        title: 'Cancelar edición',
        message: 'Tienes cambios sin guardar. ¿Estás seguro de que deseas cancelar la edición?',
        onConfirm: closeEditModal
      });
    } else {
      closeEditModal();
    }
  };

  // Cerrar modal de edición
  const closeEditModal = () => {
    setEditModalOpen(false);
    setSelectedProcedure(null);
    setCloseConfirm(null);
    setSaveConfirm(null);
    
    // Resetear formulario
    setEditForm({
      procedure_description: '',
      amount_cordobas: '',
      amount_dollars: '',
      payment_method_cordobas: 'Efectivo',
      payment_method_dollars: 'Efectivo',
      exchange_rate: currentSettings.exchange_rate.toString(),
      external_doctor: false,
      external_doctor_name: '',
      external_doctor_specialty: '',
      external_doctor_payment_type: 'percentage',
      external_doctor_payment_value: '',
      external_doctor_payment_currency: 'C$',
      clinic_payment_percentage: 40,
      doctor_payment_percentage: 60,
      ortho_doctor_percentage: 60,
      external_doctor_percentage: 0,
      external_doctor_split_type: 'from_total',
      observations: '',
      procedure_date: ''
    });
    setExternalDoctorPaymentCordobas(0);
    setExternalDoctorPaymentDollars(0);
  };

  // Cerrar modal de vista
  const closeViewModal = () => {
    setViewModalOpen(false);
    setSelectedProcedure(null);
  };

  // ===========================================
  // FUNCIONES PARA GUARDAR CON CONFIRMACIÓN
  // ===========================================

  // Validar formulario antes de guardar
  const validateEditForm = () => {
    if (!editForm.procedure_description) {
      addNotification('❌ Debe ingresar una descripción del procedimiento', 'error', 5000);
      return false;
    }

    if (!editForm.amount_cordobas && !editForm.amount_dollars) {
      addNotification('❌ Debe ingresar al menos un monto (córdobas o dólares)', 'error', 5000);
      return false;
    }

    return true;
  };

  // Confirmar guardado de edición
  const confirmSaveEdit = (e) => {
    e.preventDefault();
    
    if (!validateEditForm()) return;
    
    setSaveConfirm({
      title: 'Confirmar actualización',
      message: `¿Estás seguro de que deseas actualizar este procedimiento?`,
      patientName: selectedProcedure?.patient_name,
      totalCordobas: calculateTotalProcedure(),
      totalDollars: calculateTotalProcedureUSD(),
      onConfirm: handleSaveEdit
    });
  };

  // ===========================================
// FUNCIÓN PARA GUARDAR EDICIÓN - CORREGIDA
// ===========================================
const handleSaveEdit = async () => {
  if (!selectedProcedure) return;
  
  try {
    const totals = calculateTotalsWithDeductions();
    const orthoPayments = calculateOrthoPayments();
    
    // Preparar datos para enviar - ¡CORREGIDO!
    const procedureData = {
      // Información básica
      procedure_description: editForm.procedure_description,
      observations: editForm.observations,
      is_orthodontics: false,
      
      // ===== CANTIDADES ABONADAS =====
      total_cost: totals.grossCordobas,
      total_cost_USD: totals.grossDollars,
      amount_cordobas: totals.grossCordobas,
      amount_dollars: totals.grossDollars,
      
      // Métodos de pago
      payment_method_cordobas: editForm.payment_method_cordobas,
      payment_method_dollars: editForm.payment_method_dollars,
      
      // ===== DEDUCCIONES POS =====
      pos_deduction_cordobas: totals.posDeductionCordobas,
      pos_deduction_dollars: totals.posDeductionDollars,
      total_pos_deduction: totals.totalDeductions,
      
      // ===== MONTOS NETOS (después de POS) =====
      net_amount_cordobas: totals.netCordobas,
      net_amount_dollars: totals.netDollars,
      
      // ===== MONTOS BRUTOS (igual a abonado) =====
      gross_amount_cordobas: totals.grossCordobas,
      gross_amount_dollars: totals.grossDollars,
      
      // ===== TOTAL DEL PROCEDIMIENTO (después de POS) =====
      total_procedure: totals.netTotalCordobas,
      total_procedure_usd: totals.netTotalDollars,
      
      // ✅ IMPORTANTE: ENVIAR exchange_rate (NO exchange_rate_used)
      // El backend espera recibir exchange_rate y lo convierte internamente
      exchange_rate_used: parseFloat(editForm.exchange_rate) || currentSettings.exchange_rate,
      
      // ===== DOCTOR EXTERNO =====
      theres_external_doctor: editForm.external_doctor,
      external_doctor: editForm.external_doctor_name || '',
      external_doctor_name: editForm.external_doctor_name,
      external_doctor_specialty: editForm.external_doctor_specialty,
      external_doctor_payment_type: editForm.external_doctor_payment_type,
      external_doctor_payment_value: parseFloat(editForm.external_doctor_payment_value) || 0,
      external_doctor_payment_currency: editForm.external_doctor_payment_currency,
      
      // ===== PAGOS CALCULADOS =====
      clinic_payment_cordobas: orthoPayments.clinicPaymentCordobas,
      clinic_payment_dollars: orthoPayments.clinicPaymentDollars,
      doctor_payment_cordobas: orthoPayments.doctorPaymentCordobas,
      doctor_payment_dollars: orthoPayments.doctorPaymentDollars,
      external_doctor_payment: orthoPayments.externalPaymentCordobas,
      external_doctor_payment_usd: orthoPayments.externalPaymentDollars,
      
      // ===== PORCENTAJES =====
      clinic_payment_percentage: orthoPayments.clinicPercentage,
      doctor_payment_percentage: orthoPayments.doctorPercentage,
      external_doctor_percentage: orthoPayments.externalPercentage,
      ortho_doctor_percentage: null, // Siempre null para procedimientos normales
      external_doctor_split_type: editForm.external_doctor_split_type,
      
      // ===== FECHA =====
      procedure_date: selectedProcedure.procedure_date_utc || selectedProcedure.procedure_date
    };
    
    console.log('📤 Enviando al backend:', {
      procedure_id: selectedProcedure.procedure_ID,
      exchange_rate: procedureData.exchange_rate,
      total_procedure: procedureData.total_procedure,
      clinic_payment: procedureData.clinic_payment_cordobas,
      external_payment: procedureData.external_doctor_payment
    });
    
    const response = await apiFetch(`/procedures/${selectedProcedure.procedure_ID}`, {
      method: 'PUT',
      body: JSON.stringify(procedureData)
    });
    
    if (response.success) {
      addNotification('✅ Procedimiento actualizado exitosamente', 'success', 5000);
      setSaveConfirm(null);
      closeEditModal();
      await loadProcedures(); // Recargar la lista
    } else {
      throw new Error(response.error || 'Error al actualizar procedimiento');
    }
    
  } catch (error) {
    console.error('❌ Error al actualizar procedimiento:', error);
    addNotification(`❌ Error: ${error.message}`, 'error', 7000);
    setSaveConfirm(null);
  }
};

  // ===========================================
// FUNCIÓN PARA ELIMINAR PROCEDIMIENTO - CORREGIDA
// ===========================================
const confirmDelete = (procedure) => {
  setDeleteConfirm({
    id: procedure.procedure_ID,
    name: procedure.procedure_description || 'Procedimiento',
    patientName: procedure.patient_name,
    appointmentId: procedure.appointment_ID // <-- Guardar el appointment_ID
  });
};

// ============================================
// FUNCIÓN PARA ELIMINAR PROCEDIMIENTO - VERSIÓN CON ENDPOINT ESPECIAL
// ============================================
const handleDeleteProcedure = async () => {
  if (!deleteConfirm) return;
  
  try {
    // 1. Eliminar el procedimiento
    const deleteResponse = await apiFetch(`/procedures/${deleteConfirm.id}`, {
      method: 'DELETE'
    });
    
    if (deleteResponse.success) {
      // 2. Si el procedimiento tenía una cita asociada, desregistrarla
      if (deleteConfirm.appointmentId) {
        try {
          // 🔥 USAR ENDPOINT ESPECIAL PARA DESREGISTRAR
          const updateResponse = await apiFetch(`/appointments/${deleteConfirm.appointmentId}/unregister`, {
            method: 'PUT',
            body: JSON.stringify({ is_registered: false })
          });
          
          if (updateResponse.success) {
            console.log(`✅ Cita ${deleteConfirm.appointmentId} desregistrada exitosamente`);
            addNotification('✅ Cita actualizada correctamente', 'success', 3000);
          } else {
            console.error('⚠️ Error al desregistrar cita:', updateResponse.error);
            addNotification('⚠️ Procedimiento eliminado pero hubo un problema con la cita', 'warning', 5000);
          }
        } catch (appointmentError) {
          console.error('⚠️ Error al desregistrar cita:', appointmentError);
          addNotification('⚠️ Procedimiento eliminado pero no se pudo actualizar la cita', 'warning', 5000);
        }
      }
      
      addNotification('✅ Procedimiento eliminado exitosamente', 'success', 5000);
      setDeleteConfirm(null);
      await loadProcedures();
    } else {
      throw new Error(deleteResponse.error || 'Error al eliminar procedimiento');
    }
    
  } catch (error) {
    console.error('❌ Error al eliminar procedimiento:', error);
    addNotification(`❌ Error: ${error.message}`, 'error', 7000);
    setDeleteConfirm(null);
  }
};

  // ===========================================
  // FUNCIONES DE CÁLCULO PARA MOSTRAR
  // ===========================================

  const calculateClinicNetIncome = (procedure) => {
    const totalProcedure = procedure.total_procedure || 0;
    const externalDoctorPayment = procedure.external_doctor_payment || 0;
    return Math.max(0, totalProcedure - externalDoctorPayment);
  };

  const calculateClinicNetIncomeUSD = (procedure) => {
    const totalProcedureUSD = procedure.total_procedure_usd || 0;
    const externalDoctorPaymentUSD = procedure.external_doctor_payment_usd || 0;
    return Math.max(0, totalProcedureUSD - externalDoctorPaymentUSD);
  };

  const calculateBreakdown = (procedure) => {
    const grossCordobas = procedure.gross_amount_cordobas || procedure.total_cost || procedure.total_procedure || 0;
    const grossDollars = procedure.gross_amount_dollars || procedure.total_cost_USD || procedure.total_procedure_usd || 0;
    const posDeductionCordobas = procedure.pos_deduction_cordobas || 0;
    const posDeductionDollars = procedure.pos_deduction_dollars || 0;
    const totalProcedureCordobas = procedure.total_procedure || 0;
    const totalProcedureDollars = procedure.total_procedure_usd || 0;
    const externalDoctorCordobas = procedure.external_doctor_payment || 0;
    const externalDoctorDollars = procedure.external_doctor_payment_usd || 0;
    const clinicNetCordobas = calculateClinicNetIncome(procedure);
    const clinicNetDollars = calculateClinicNetIncomeUSD(procedure);
    
    return {
      grossCordobas,
      grossDollars,
      posDeductionCordobas,
      posDeductionDollars,
      totalProcedureCordobas,
      totalProcedureDollars,
      externalDoctorCordobas,
      externalDoctorDollars,
      clinicNetCordobas,
      clinicNetDollars
    };
  };

  // ===========================================
  // FILTRADO Y RENDERIZADO
  // ===========================================

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

  const error = localError || contextError;

  const formatCurrencyUSD = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return formatDate(dateString);
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return dateString;
    }
  };

  const toggleFilters = () => {
    setIsFiltersCollapsed(!isFiltersCollapsed);
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
      {/* =========================================== */}
      {/* MODALES DE CONFIRMACIÓN */}
      {/* =========================================== */}

      {/* Modal de confirmación de guardado */}
      {saveConfirm && (
        <div className="modal-overlay confirm-modal-overlay">
          <div className="modal-content confirm-modal">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faQuestionCircle} />
                {saveConfirm.title}
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => setSaveConfirm(null)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="confirm-modal-body">
              <div className="confirm-icon">
                <FontAwesomeIcon icon={faFileMedical} />
              </div>
              <p className="confirm-message">{saveConfirm.message}</p>
              {saveConfirm.patientName && (
                <p className="confirm-detail">
                  <strong>Paciente:</strong> {saveConfirm.patientName}
                </p>
              )}
              
              <div className="confirm-details">
                <div className="detail-row">
                  <span className="detail-label">Total en Córdobas:</span>
                  <span className="detail-value amount-cordobas">
                    {formatCurrency(saveConfirm.totalCordobas)}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Total en Dólares:</span>
                  <span className="detail-value amount-dollars">
                    {formatCurrencyUSD(saveConfirm.totalDollars)}
                  </span>
                </div>
              </div>
            </div>

            <div className="confirm-modal-actions">
              <button 
                className="btn-cancel"
                onClick={() => setSaveConfirm(null)}
              >
                Cancelar
              </button>
              <button 
                className="btn-confirm"
                onClick={saveConfirm.onConfirm}
              >
                <FontAwesomeIcon icon={faSave} />
                Sí, Actualizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para cerrar/cancelar */}
      {closeConfirm && (
        <div className="modal-overlay confirm-modal-overlay">
          <div className="modal-content confirm-modal close-confirm-modal">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faQuestionCircle} />
                {closeConfirm.title}
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => setCloseConfirm(null)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="confirm-modal-body">
              <div className="confirm-icon warning-icon">
                <FontAwesomeIcon icon={faTimesCircle} />
              </div>
              <p className="confirm-message">{closeConfirm.message}</p>
              <p className="warning-text">Los cambios no guardados se perderán.</p>
            </div>

            <div className="confirm-modal-actions">
              <button 
                className="btn-cancel"
                onClick={() => setCloseConfirm(null)}
              >
                Seguir Editando
              </button>
              <button 
                className="btn-confirm warning"
                onClick={() => {
                  closeConfirm.onConfirm();
                  setCloseConfirm(null);
                }}
              >
                Sí, Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {deleteConfirm && (
        <div className="modal-overlay confirm-modal-overlay">
          <div className="modal-content confirm-modal delete-confirm-modal">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faQuestionCircle} />
                Confirmar Eliminación
              </h3>
              <button 
                className="close-modal-btn"
                onClick={() => setDeleteConfirm(null)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="confirm-modal-body">
              <div className="confirm-icon delete-icon">
                <FontAwesomeIcon icon={faTrash} />
              </div>
              <p className="confirm-message">
                ¿Estás seguro de que deseas eliminar este procedimiento?
              </p>
              <p className="confirm-detail">
                <strong>Descripción:</strong> {deleteConfirm.name}
              </p>
              <p className="confirm-detail">
                <strong>Paciente:</strong> {deleteConfirm.patientName}
              </p>
              <p className="warning-text">Esta acción no se puede deshacer.</p>
            </div>

            <div className="confirm-modal-actions">
              <button 
                className="btn-cancel"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancelar
              </button>
              <button 
                className="btn-confirm delete"
                onClick={handleDeleteProcedure}
              >
                <FontAwesomeIcon icon={faTrash} />
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================== */}
      {/* MODAL PARA VER PROCEDIMIENTO */}
      {/* =========================================== */}
      {viewModalOpen && selectedProcedure && (
        <div className="modal-backdrop" onClick={closeViewModal}>
          <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
            <h3><FontAwesomeIcon icon={faFileMedical} /> Información Completa del Procedimiento</h3>
            
            <div className="procedure-view-container">
              {/* Información básica */}
              <div className="view-section">
                <h4><FontAwesomeIcon icon={faFileMedical} /> Información del Procedimiento</h4>
                <div className="view-grid">
                  <div className="view-item">
                    <span className="view-label">Fecha del Procedimiento:</span>
                    <span className="view-value">{formatDisplayDate(selectedProcedure.procedure_date)}</span>
                  </div>
                  <div className="view-item">
                    <span className="view-label">Fecha de Creación:</span>
                    <span className="view-value">{formatDisplayDate(selectedProcedure.creation_date)}</span>
                  </div>
                  <div className="view-item full-width">
                    <span className="view-label">Descripción:</span>
                    <span className="view-value">{selectedProcedure.procedure_description || "Sin descripción"}</span>
                  </div>
                  <div className="view-item">
                    <span className="view-label">Tipo de Consulta Original:</span>
                    <span className="view-value">{selectedProcedure.original_query_type || selectedProcedure.procedure_description}</span>
                  </div>
                  {selectedProcedure.original_appointment_date && (
                    <div className="view-item">
                      <span className="view-label">Fecha Cita Original:</span>
                      <span className="view-value">{formatDisplayDate(selectedProcedure.original_appointment_date)}</span>
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
                    <span className="view-value">{selectedProcedure.patient_name || "Paciente no especificado"}</span>
                  </div>
                  <div className="view-item">
                    <span className="view-label">Cédula:</span>
                    <span className="view-value">{selectedProcedure.patient_identification || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Detalles financieros */}
              <div className="view-section">
                <h4><FontAwesomeIcon icon={faMoneyBillWave} /> Detalles Financieros</h4>
                
                {(() => {
                  const breakdown = calculateBreakdown(selectedProcedure);
                  return (
                    <>
                      {/* Resumen financiero */}
                      <div className="financial-summary">
                        <div className="total-card">
                          <div className="total-header">
                            <FontAwesomeIcon icon={faMoneyBill} />
                            <span>Total del Procedimiento</span>
                          </div>
                          <div className="total-amounts">
                            <div className="amount-cordobas">{formatCurrency(breakdown.totalProcedureCordobas)}</div>
                            <div className="amount-dollars">{formatCurrencyUSD(breakdown.totalProcedureDollars)}</div>
                          </div>
                          <div className="total-subtitle">
                            Ya incluye deducción POS si aplica
                          </div>
                        </div>
                      </div>

                      {/* Métodos de pago */}
                      {(selectedProcedure.amount_cordobas > 0 || selectedProcedure.amount_dollars > 0) && (
                        <div className="payment-methods-section">
                          <h5><FontAwesomeIcon icon={faCreditCard} /> Métodos de Pago</h5>
                          
                          {selectedProcedure.amount_cordobas > 0 && (
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
                                  <span className="method-value">{selectedProcedure.payment_method_cordobas || 'No especificado'}</span>
                                </div>
                                {breakdown.posDeductionCordobas > 0 && (
                                  <div className="method-row deduction">
                                    <span className="method-label">Deducción POS:</span>
                                    <span className="method-value">-{formatCurrency(breakdown.posDeductionCordobas)}</span>
                                  </div>
                                )}
                                <div className="method-row net-amount">
                                  <span className="method-label">Neto después de POS:</span>
                                  <span className="method-value">{formatCurrency(breakdown.totalProcedureCordobas)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {selectedProcedure.amount_dollars > 0 && (
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
                                  <span className="method-value">{selectedProcedure.payment_method_dollars || 'No especificado'}</span>
                                </div>
                                {breakdown.posDeductionDollars > 0 && (
                                  <div className="method-row deduction">
                                    <span className="method-label">Deducción POS:</span>
                                    <span className="method-value">-{formatCurrencyUSD(breakdown.posDeductionDollars)}</span>
                                  </div>
                                )}
                                <div className="method-row net-amount">
                                  <span className="method-label">Neto después de POS:</span>
                                  <span className="method-value">{formatCurrencyUSD(breakdown.totalProcedureDollars)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Desglose de cálculo */}
                      <div className="breakdown-section">
                        <h5><FontAwesomeIcon icon={faCalculator} /> Desglose del Cálculo</h5>
                        <div className="breakdown-steps">
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
                          
                          {breakdown.posDeductionCordobas > 0 && (
                            <div className="breakdown-step deduction-step">
                              <div className="step-number">2</div>
                              <div className="step-content">
                                <span className="step-label">- Deducción del POS:</span>
                                <div className="step-values">
                                  <span className="step-value-cordobas">-{formatCurrency(breakdown.posDeductionCordobas)}</span>
                                  <span className="step-value-dollars">-{formatCurrencyUSD(breakdown.posDeductionDollars)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="breakdown-step result-step">
                            <div className="step-number">=</div>
                            <div className="step-content">
                              <span className="step-label">Total del procedimiento (después de POS):</span>
                              <div className="step-values">
                                <span className="step-value-cordobas">{formatCurrency(breakdown.totalProcedureCordobas)}</span>
                                <span className="step-value-dollars">{formatCurrencyUSD(breakdown.totalProcedureDollars)}</span>
                              </div>
                            </div>
                          </div>
                          
                          {breakdown.externalDoctorCordobas > 0 && (
                            <div className="breakdown-step deduction-step">
                              <div className="step-number">3</div>
                              <div className="step-content">
                                <span className="step-label">- Pago al doctor externo:</span>
                                <div className="step-values">
                                  <span className="step-value-cordobas">-{formatCurrency(breakdown.externalDoctorCordobas)}</span>
                                  <span className="step-value-dollars">-{formatCurrencyUSD(breakdown.externalDoctorDollars)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="breakdown-step final-step">
                            <div className="step-number">=</div>
                            <div className="step-content">
                              <span className="step-label final-label">GANANCIA NETA DE LA CLÍNICA:</span>
                              <div className="step-values final-values">
                                <span className="step-value-cordobas final-cordobas">{formatCurrency(breakdown.clinicNetCordobas)}</span>
                                <span className="step-value-dollars final-dollars">{formatCurrencyUSD(breakdown.clinicNetDollars)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="final-summary">
                        <div className="summary-card net-summary">
                          <div className="summary-header">
                            <FontAwesomeIcon icon={faChartLine} />
                            <span>Ganancia neta de la clínica</span>
                          </div>
                          <div className="summary-amounts">
                            <div className="summary-amount cordobas">
                              <span className="amount-label">Córdobas:</span>
                              <span className="amount-value">{formatCurrency(breakdown.clinicNetCordobas)}</span>
                            </div>
                            <div className="summary-amount dollars">
                              <span className="amount-label">Dólares:</span>
                              <span className="amount-value">{formatCurrencyUSD(breakdown.clinicNetDollars)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}

                <div className="exchange-rate-section">
                  <FontAwesomeIcon icon={faExchangeAlt} />
                  <span>Tasa de cambio utilizada: {selectedProcedure.exchange_rate_used || 36.5} C$/US$</span>
                </div>
              </div>

              {/* Doctor externo */}
              {(selectedProcedure.external_doctor_name || selectedProcedure.external_doctor_payment > 0) && (
                <div className="view-section">
                  <h4><FontAwesomeIcon icon={faUserDoctor} /> Doctor Externo</h4>
                  <div className="view-grid">
                    {selectedProcedure.external_doctor_name && (
                      <div className="view-item">
                        <span className="view-label">Nombre:</span>
                        <span className="view-value">{selectedProcedure.external_doctor_name}</span>
                      </div>
                    )}
                    {selectedProcedure.external_doctor_specialty && (
                      <div className="view-item">
                        <span className="view-label">Especialidad:</span>
                        <span className="view-value">{selectedProcedure.external_doctor_specialty}</span>
                      </div>
                    )}
                    {selectedProcedure.external_doctor_payment > 0 && (
                      <div className="view-item">
                        <span className="view-label">Pago al doctor:</span>
                        <span className="view-value">{formatCurrency(selectedProcedure.external_doctor_payment)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Observaciones */}
              {selectedProcedure.observations && (
                <div className="view-section">
                  <h4><FontAwesomeIcon icon={faNotesMedical} /> Observaciones</h4>
                  <div className="observations-content">
                    <p>{selectedProcedure.observations}</p>
                  </div>
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
                  openEditModal(selectedProcedure);
                }}
              >
                <FontAwesomeIcon icon={faEdit} />
                Editar Procedimiento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================== */}
      {/* MODAL PARA EDITAR PROCEDIMIENTO */}
      {/* =========================================== */}
      {editModalOpen && selectedProcedure && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faEdit} />
                Editar Procedimiento
              </h3>
              <button 
                className="close-modal-btn"
                onClick={requestCloseEditModal}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="appointment-info">
              <h4>Información del procedimiento:</h4>
              <p><strong>Paciente:</strong> {selectedProcedure.patient_name}</p>
              <p><strong>Fecha:</strong> {formatDisplayDate(selectedProcedure.procedure_date)}</p>
              <p><strong>Descripción:</strong> {selectedProcedure.procedure_description}</p>
            </div>
            
            <form onSubmit={confirmSaveEdit} className="procedure-form">
              <div className="form-section">
                <h4>Detalles del Procedimiento</h4>
                
                <div className="form-group">
                  <label className="form-label">Descripción del procedimiento:</label>
                  <input
                    type="text"
                    required
                    name="procedure_description"
                    value={editForm.procedure_description}
                    onChange={handleFormChange}
                    className="form-input"
                    placeholder="Ej: Limpieza dental, extracción, etc."
                  />
                </div>
                
                {/* Sección de pagos mixtos CON DEDUCCIONES POS */}
                <div className="mixed-payment-section">
                  <h5>Pagos Mixtos (Córdobas y Dólares)</h5>
                  <p className="section-note">
                    <small>Para pagos con POS (Tarjeta) se aplica deducción automática del 5.5% (4% comisión bancaria + 1.5% impuesto DGI)</small>
                  </p>
                  
                  <div className="payment-row">
                    <div className="payment-column">
                      <div className="form-group">
                        <label className="form-label">
                          <FontAwesomeIcon icon={faMoneyBillWave} /> Cantidad en Córdobas (C$):
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          name="amount_cordobas"
                          value={editForm.amount_cordobas}
                          onChange={handleFormChange}
                          className="form-input"
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Método de Pago (C$):</label>
                        <select
                          name="payment_method_cordobas"
                          value={editForm.payment_method_cordobas}
                          onChange={handleFormChange}
                          className="form-select"
                        >
                          <option value="Efectivo">Efectivo</option>
                          <option value="POS">POS (Tarjeta) -5.5%</option>
                          <option value="Transferencia">Transferencia</option>
                        </select>
                        {editForm.payment_method_cordobas === 'POS' && (
                          <small className="form-help-text warning-text">
                            ⚠️ Se aplicará deducción del 5.5% (4% comisión bancaria + 1.5% impuesto)
                          </small>
                        )}
                      </div>
                      
                      {editForm.payment_method_cordobas === 'POS' && editForm.amount_cordobas > 0 && (
                        <div className="deduction-info">
                          <small>
                            Bruto: {formatCurrency(parseFloat(editForm.amount_cordobas))}<br />
                            Deducción POS (5.5%): -{formatCurrency(calculatePOSDeduction(parseFloat(editForm.amount_cordobas)))}<br />
                            <strong>Neto: {formatCurrency(calculateNetAfterPOS(parseFloat(editForm.amount_cordobas)))}</strong>
                          </small>
                        </div>
                      )}
                    </div>
                    
                    <div className="payment-column">
                      <div className="form-group">
                        <label className="form-label">
                          <FontAwesomeIcon icon={faDollarSign} /> Cantidad en Dólares (US$):
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          name="amount_dollars"
                          value={editForm.amount_dollars}
                          onChange={handleFormChange}
                          className="form-input"
                          placeholder="0.00"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Método de Pago (USD):</label>
                        <select
                          name="payment_method_dollars"
                          value={editForm.payment_method_dollars}
                          onChange={handleFormChange}
                          className="form-select"
                        >
                          <option value="Efectivo">Efectivo</option>
                          <option value="POS">POS (Tarjeta) -5.5%</option>
                          <option value="Transferencia">Transferencia</option>
                        </select>
                        {editForm.payment_method_dollars === 'POS' && (
                          <small className="form-help-text warning-text">
                            ⚠️ Se aplicará deducción del 5.5% (4% comisión bancaria + 1.5% impuesto)
                          </small>
                        )}
                      </div>
                      
                      {editForm.payment_method_dollars === 'POS' && editForm.amount_dollars > 0 && (
                        <div className="deduction-info">
                          <small>
                            Bruto: {formatCurrencyUSD(parseFloat(editForm.amount_dollars))}<br />
                            Deducción POS (5.5%): -{formatCurrencyUSD(calculatePOSDeduction(parseFloat(editForm.amount_dollars)))}<br />
                            <strong>Neto: {formatCurrencyUSD(calculateNetAfterPOS(parseFloat(editForm.amount_dollars)))}</strong>
                          </small>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Tipo de cambio */}
                  <div className="form-group">
                    <label className="form-label">
                      <FontAwesomeIcon icon={faExchangeAlt} /> Tipo de Cambio (C$ por US$):
                    </label>
                    <input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      name="exchange_rate"
                      value={editForm.exchange_rate}
                      onChange={handleFormChange}
                      className="form-input"
                      placeholder="36.5000"
                    />
                  </div>
                  
                  {/* Totales calculados */}
                  <div className="totals-section">
                    <div className="total-row">
                      <span className="total-label">Bruto en Córdobas (C$):</span>
                      <span className="total-value">
                        {formatCurrency(calculateTotalsWithDeductions().grossCordobas)}
                      </span>
                    </div>
                    
                    {editForm.payment_method_cordobas === 'POS' && editForm.amount_cordobas > 0 && (
                      <div className="total-row deduction-row">
                        <span className="total-label">Deducción POS Córdobas:</span>
                        <span className="total-value deduction">
                          -{formatCurrency(calculateTotalsWithDeductions().posDeductionCordobas)}
                        </span>
                      </div>
                    )}
                    
                    <div className="total-row">
                      <span className="total-label">Bruto en Dólares (US$):</span>
                      <span className="total-value">
                        {formatCurrencyUSD(calculateTotalsWithDeductions().grossDollars)}
                      </span>
                    </div>
                    
                    {editForm.payment_method_dollars === 'POS' && editForm.amount_dollars > 0 && (
                      <div className="total-row deduction-row">
                        <span className="total-label">Deducción POS Dólares:</span>
                        <span className="total-value deduction">
                          -{formatCurrencyUSD(calculateTotalsWithDeductions().posDeductionDollars)}
                        </span>
                      </div>
                    )}
                    
                    <div className="total-row total-gross">
                      <span className="total-label">Total Bruto (C$):</span>
                      <span className="total-value">
                        {formatCurrency(calculateTotalsWithDeductions().grossTotalCordobas)}
                      </span>
                    </div>
                    
                    <div className="total-row total-gross-usd">
                      <span className="total-label">Total Bruto (US$):</span>
                      <span className="total-value">
                        {formatCurrencyUSD(calculateTotalsWithDeductions().grossTotalDollars)}
                      </span>
                    </div>
                    
                    {(editForm.payment_method_cordobas === 'POS' || editForm.payment_method_dollars === 'POS') && (
                      <div className="total-row total-deduction">
                        <span className="total-label">Total Deducciones POS (C$):</span>
                        <span className="total-value deduction">
                          -{formatCurrency(calculateTotalsWithDeductions().totalDeductions)}
                        </span>
                      </div>
                    )}
                    
                    <div className="total-row total-procedure">
                      <span className="total-label">
                        <strong>Total Neto del Procedimiento (C$):</strong>
                      </span>
                      <span className="total-value">
                        <strong>{formatCurrency(calculateTotalProcedure())}</strong>
                      </span>
                    </div>
                    
                    <div className="total-row total-procedure-usd">
                      <span className="total-label">
                        <strong>Total Neto del Procedimiento (US$):</strong>
                      </span>
                      <span className="total-value">
                        <strong>{formatCurrencyUSD(calculateTotalProcedureUSD())}</strong>
                      </span>
                    </div>
                    
                    <div className="total-breakdown">
                      <small>
                        * C$ {editForm.amount_cordobas || '0.00'} ({editForm.payment_method_cordobas || 'Sin método'})<br />
                        * US$ {editForm.amount_dollars || '0.00'} ({editForm.payment_method_dollars || 'Sin método'})<br />
                        * Tipo de cambio: C$ {editForm.exchange_rate} por US$ 1<br />
                        {editForm.payment_method_cordobas === 'POS' || editForm.payment_method_dollars === 'POS' ? (
                          <>
                            * Deducción POS aplicada: 5.5% (4% comisión bancaria + 1.5% impuesto DGI)
                          </>
                        ) : null}
                      </small>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Sección de Doctor Externo */}
              <div className="form-section">
                <div className="toggle-section">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={editForm.external_doctor}
                      onChange={(e) => handleExternalDoctorPaymentChange('external_doctor', e.target.checked)}
                    />
                    <span>¿Hubo participación de doctor externo?</span>
                  </label>
                </div>
                
                {editForm.external_doctor && (
                  <div className="external-doctor-section">
                    <div className="form-group">
                      <label className="form-label">Nombre del Doctor Externo:</label>
                      <input
                        type="text"
                        name="external_doctor_name"
                        value={editForm.external_doctor_name}
                        onChange={handleFormChange}
                        className="form-input"
                        placeholder="Dr. Nombre Apellido"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Especialidad:</label>
                      <input
                        type="text"
                        name="external_doctor_specialty"
                        value={editForm.external_doctor_specialty}
                        onChange={handleFormChange}
                        className="form-input"
                        placeholder="Ej: Cirujano maxilofacial, Endodoncista, etc."
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Tipo de Pago al Doctor:</label>
                      <div className="payment-type-buttons">
                        <button
                          type="button"
                          className={`payment-type-btn ${editForm.external_doctor_payment_type === 'percentage' ? 'active' : ''}`}
                          onClick={() => handleExternalDoctorPaymentChange('payment_type', 'percentage')}
                        >
                          Porcentaje del total
                        </button>
                        <button
                          type="button"
                          className={`payment-type-btn ${editForm.external_doctor_payment_type === 'fixed' ? 'active' : ''}`}
                          onClick={() => handleExternalDoctorPaymentChange('payment_type', 'fixed')}
                        >
                          Cantidad fija
                        </button>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">
                        {editForm.external_doctor_payment_type === 'percentage' ? 'Porcentaje:' : 'Cantidad:'}
                      </label>
                      <div className="payment-input-container">
                        {editForm.external_doctor_payment_type === 'fixed' && (
                          <select
                            name="external_doctor_payment_currency"
                            value={editForm.external_doctor_payment_currency}
                            onChange={handleFormChange}
                            className="currency-select"
                          >
                            <option value="C$">C$</option>
                            <option value="US$">US$</option>
                          </select>
                        )}
                        <input
                          type="number"
                          min="0"
                          step={editForm.external_doctor_payment_type === 'percentage' ? "0.1" : "0.01"}
                          max={editForm.external_doctor_payment_type === 'percentage' ? "100" : ""}
                          name="external_doctor_payment_value"
                          value={editForm.external_doctor_payment_value}
                          onChange={handleFormChange}
                          className="form-input"
                          placeholder={editForm.external_doctor_payment_type === 'percentage' ? '0.0%' : '0.00'}
                        />
                        {editForm.external_doctor_payment_type === 'percentage' && <span className="input-suffix">%</span>}
                      </div>
                      <small className="form-help-text">
                        {editForm.external_doctor_payment_type === 'percentage' 
                          ? `Equivalente: ${formatCurrency(externalDoctorPaymentCordobas)} (${formatCurrencyUSD(externalDoctorPaymentDollars)})`
                          : editForm.external_doctor_payment_currency === 'US$'
                            ? `Equivalente: ${formatCurrencyUSD(parseFloat(editForm.external_doctor_payment_value) || 0)} (${formatCurrency(externalDoctorPaymentCordobas)} en córdobas)`
                            : `Equivalente: ${formatCurrency(parseFloat(editForm.external_doctor_payment_value) || 0)} (${formatCurrencyUSD(externalDoctorPaymentDollars)} en dólares)`}
                      </small>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label className="form-label">Observaciones adicionales:</label>
                <textarea
                  name="observations"
                  value={editForm.observations}
                  onChange={handleFormChange}
                  className="form-textarea"
                  placeholder="Notas sobre el procedimiento..."
                  rows="3"
                />
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn-cancel"
                  onClick={requestCloseEditModal}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={!editForm.procedure_description || 
                            (!editForm.amount_cordobas && !editForm.amount_dollars)}
                >
                  <FontAwesomeIcon icon={faSave} />
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Encabezado de la página */}
      <div className="procedures-header">
        <h2><FontAwesomeIcon icon={faFileMedical} /> Procedimientos Regulares</h2>
        <div className="procedures-tools">
          <div className="procedures-count">
            <span>{filteredProcedures.length}</span>
          </div>
          <button 
            className="collapse-filters-btn"
            onClick={toggleFilters}
          >
            <FontAwesomeIcon icon={isFiltersCollapsed ? faChevronDown : faChevronUp} />
            <span>{isFiltersCollapsed ? 'Mostrar filtros' : 'Ocultar filtros'}</span>
          </button>
        </div>
      </div>

      {/* Filtros - Colapsables */}
      <div className={`filters-container ${isFiltersCollapsed ? 'collapsed' : ''}`} ref={filtersRef}>
        <div className="filter-group">
          <label>Periodo rápido:</label>
          <div className="time-filter-buttons">
            <button 
              className={`time-filter-btn ${timeFilter === TIME_FILTERS.TODAY ? 'active' : ''}`}
              onClick={async () => {
                setTimeFilter(TIME_FILTERS.TODAY);
                setDateFilter({ startDate: "", endDate: "" });
                await fetchProceduresNormal({ timeFilter: TIME_FILTERS.TODAY });
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
                await fetchProceduresNormal({ timeFilter: TIME_FILTERS.THIS_WEEK });
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
                await fetchProceduresNormal({ timeFilter: TIME_FILTERS.THIS_MONTH });
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
                await fetchProceduresNormal({ timeFilter: TIME_FILTERS.ALL });
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

      {/* BUSCADOR PRINCIPAL - Siempre visible */}
      <div className="search-box-main-container">
        <div className="filter-group">
          <label className="filter-label">Buscar procedimientos:</label>
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

      {/* Tabla de procedimientos */}
      <div className="procedures-section">
        <h3>Lista de Procedimientos ({filteredProcedures.length})</h3>
        
        {filteredProcedures.length === 0 ? (
          <div className="no-results">
            <p>
              {search || timeFilter !== TIME_FILTERS.ALL || dateFilter.startDate || dateFilter.endDate
                ? "No se encontraron procedimientos con los filtros aplicados."
                : "No hay procedimientos registrados."}
            </p>
          </div>
        ) : (
          <div className="table-responsive-container">
            <table className="procedures-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>Descripción</th>
                  <th>Total C$</th>
                  <th>Total US$</th>
                  <th>Clínica Neto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcedures.map((procedure) => {
                  const clinicNetIncome = calculateClinicNetIncome(procedure);
                  const hasPOS = (procedure.pos_deduction_cordobas || 0) > 0;
                  const hasExternalDoctor = (procedure.external_doctor_payment || 0) > 0;
                  
                  return (
                    <tr key={procedure.procedure_ID}>
                      <td>
                        {formatDisplayDate(procedure.procedure_date)}
                      </td>
                      <td className="patient-cell">
                        <div className="patient-info-compact">
                          <strong>{procedure.patient_name || "Paciente no especificado"}</strong>
                          <small>{procedure.patient_identification || "N/A"}</small>
                        </div>
                      </td>
                      <td className="description-cell">
                        <div className="description-content">
                          <strong>{procedure.procedure_description || "Sin descripción"}</strong>
                          {hasExternalDoctor && (
                            <small className="external-doctor-indicator">
                              <FontAwesomeIcon icon={faUserDoctor} /> Con doctor externo
                            </small>
                          )}
                        </div>
                      </td>
                      
                      <td className="total-cordobas-cell">
                        <div className="total-with-indicators">
                          {formatCurrency(procedure.total_procedure || procedure.total_cost || 0)}
                          {hasPOS && (
                            <small className="total-indicator pos-indicator">
                              <FontAwesomeIcon icon={faCreditCard} />
                            </small>
                          )}
                        </div>
                      </td>
                      
                      <td className="total-dollars-cell">
                        {formatCurrencyUSD(procedure.total_procedure_usd || procedure.total_cost_USD || 0)}
                      </td>
                      
                      <td className="clinic-net-cell">
                        <div className="clinic-earnings">
                          {formatCurrency(clinicNetIncome)}
                          <div className="earnings-details">
                            {hasPOS && (
                              <small className="net-indicator has-pos">
                                <FontAwesomeIcon icon={faCreditCard} /> POS
                              </small>
                            )}
                            {hasExternalDoctor && (
                              <small className="net-indicator has-doctor">
                                <FontAwesomeIcon icon={faUserDoctor} /> Dr. Ext.
                              </small>
                            )}
                          </div>
                        </div>
                      </td>
                      
                      <td className="actions-cell">
                        <button 
                          className="btn-view"
                          onClick={() => openViewModal(procedure)}
                          title="Ver información completa"
                        >
                          <FontAwesomeIcon icon={faEye} />
                          Ver
                        </button>
                        <button 
                          className="btn-edit"
                          onClick={() => openEditModal(procedure)}
                          title="Editar procedimiento"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                          Editar
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => confirmDelete(procedure)}
                          title="Eliminar procedimiento"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                          Eliminar
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