import React, { useContext, useEffect, useState, useRef } from "react";
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
  faTeeth,
  faCalculator,
  faHandHoldingUsd,
  faUserMd,
  faBuilding,
  faChartPie,
  faChevronDown,
  faChevronUp,
  faQuestionCircle,
  faSave,
  faCheckCircle,
  faTimesCircle
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
    clearError,
    apiFetch
  } = useContext(AppContext);
  
  const { addNotification } = useNotification();
  
  // Estados para filtros y búsqueda
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState(TIME_FILTERS.ALL);
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: ""
  });
  const [localError, setLocalError] = useState("");
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedOrthodontic, setSelectedOrthodontic] = useState(null);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const filtersRef = useRef(null);
  
  // Estados para edición
  const [saveConfirm, setSaveConfirm] = useState(null);
  const [closeConfirm, setCloseConfirm] = useState(null);
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
  const [currentSettings, setCurrentSettings] = useState({
    exchange_rate: 36.5,
    clinic_payment: 40,
    doctor_payment: 60
  });

  // ===========================================
  // FUNCIONES DE CARGA INICIAL
  // ===========================================

  useEffect(() => {
    if (user) {
      loadOrthodontics();
      loadCurrentSettings();
    }
  }, [user]);

  // Cargar configuración cuando se abre modal de edición
  useEffect(() => {
    if (editModalOpen) {
      loadCurrentSettings();
    }
  }, [editModalOpen]);

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

  // ===========================================
  // FUNCIONES DE FILTRADO
  // ===========================================

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

  // ===========================================
  // FUNCIONES DE CÁLCULO (IGUAL QUE EN PROCEDURES)
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
    
    if (editForm.external_doctor) {
      const orthoPercentage = parseFloat(editForm.ortho_doctor_percentage) || 60;
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
      } else {
        // from_clinic
        const orthoPaymentCordobas = totalConsultaCordobas * (orthoPercentage / 100);
        const orthoPaymentDollars = totalConsultaDollars * (orthoPercentage / 100);
        
        const clinicPortionBeforeExternal = totalConsultaCordobas * (clinicPercentage / 100);
        const externalPaymentCordobas = clinicPortionBeforeExternal * (externalPercentage / 100);
        const externalPaymentDollars = externalPaymentCordobas / exchangeRate;
        
        const clinicPaymentCordobas = clinicPortionBeforeExternal - externalPaymentCordobas;
        const clinicPaymentDollars = clinicPaymentDollars;
        
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
    } else {
      const clinicPercentage = parseFloat(editForm.clinic_payment_percentage) || 40;
      const doctorPercentage = parseFloat(editForm.doctor_payment_percentage) || 60;
      
      const clinicPaymentCordobas = totalConsultaCordobas * (clinicPercentage / 100);
      const clinicPaymentDollars = totalConsultaDollars * (clinicPercentage / 100);
      const doctorPaymentCordobas = totalConsultaCordobas * (doctorPercentage / 100);
      const doctorPaymentDollars = totalConsultaDollars * (doctorPercentage / 100);
      
      return {
        totalConsultaCordobas,
        totalConsultaDollars,
        clinicPaymentCordobas,
        clinicPaymentDollars,
        doctorPaymentCordobas,
        doctorPaymentDollars,
        externalPaymentCordobas: 0,
        externalPaymentDollars: 0,
        clinicPercentage,
        doctorPercentage,
        externalPercentage: 0
      };
    }
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

  const openViewModal = (orthodontic) => {
    setSelectedOrthodontic(orthodontic);
    setViewModalOpen(true);
  };

  const openEditModal = (orthodontic) => {
    console.log('📝 Editando ortodoncia:', orthodontic);
    
    setSelectedOrthodontic(orthodontic);
    
    // Cargar datos en el formulario
    setEditForm({
      procedure_description: orthodontic.procedure_description || '',
      amount_cordobas: orthodontic.amount_cordobas?.toString() || '',
      amount_dollars: orthodontic.amount_dollars?.toString() || '',
      payment_method_cordobas: orthodontic.payment_method_cordobas || 'Efectivo',
      payment_method_dollars: orthodontic.payment_method_dollars || 'Efectivo',
      exchange_rate: orthodontic.exchange_rate_used?.toString() || currentSettings.exchange_rate.toString(),
      external_doctor: orthodontic.has_external_doctor || !!orthodontic.external_doctor_name || (orthodontic.external_doctor_payment > 0),
      external_doctor_name: orthodontic.external_doctor_name || '',
      external_doctor_specialty: orthodontic.external_doctor_specialty || '',
      external_doctor_payment_type: orthodontic.external_doctor_payment_type || 'percentage',
      external_doctor_payment_value: orthodontic.external_doctor_payment_value?.toString() || 
                                     (orthodontic.external_doctor_percentage?.toString() || ''),
      external_doctor_payment_currency: orthodontic.external_doctor_payment_currency || 'C$',
      clinic_payment_percentage: orthodontic.clinic_payment_percentage || 40,
      doctor_payment_percentage: orthodontic.doctor_payment_percentage || 60,
      ortho_doctor_percentage: orthodontic.ortho_doctor_percentage || 60,
      external_doctor_percentage: orthodontic.external_doctor_percentage || 0,
      external_doctor_split_type: orthodontic.external_doctor_split_type || 'from_total',
      observations: orthodontic.observations || '',
      procedure_date: orthodontic.procedure_date_utc || orthodontic.procedure_date
    });
    
    // Calcular pagos de doctor externo si existe
    if (orthodontic.external_doctor_payment > 0 || orthodontic.external_doctor_payment_usd > 0) {
      setExternalDoctorPaymentCordobas(orthodontic.external_doctor_payment || 0);
      setExternalDoctorPaymentDollars(orthodontic.external_doctor_payment_usd || 0);
    }
    
    setEditModalOpen(true);
  };

  const closeViewModal = () => {
    setViewModalOpen(false);
    setSelectedOrthodontic(null);
  };

  // ===========================================
  // FUNCIONES PARA CERRAR MODALES CON CONFIRMACIÓN
  // ===========================================

  const hasEditFormChanges = () => {
    if (!selectedOrthodontic) return false;
    
    return (
      editForm.procedure_description !== (selectedOrthodontic.procedure_description || '') ||
      editForm.amount_cordobas !== (selectedOrthodontic.amount_cordobas?.toString() || '') ||
      editForm.amount_dollars !== (selectedOrthodontic.amount_dollars?.toString() || '') ||
      editForm.payment_method_cordobas !== (selectedOrthodontic.payment_method_cordobas || 'Efectivo') ||
      editForm.payment_method_dollars !== (selectedOrthodontic.payment_method_dollars || 'Efectivo') ||
      editForm.exchange_rate !== (selectedOrthodontic.exchange_rate_used?.toString() || currentSettings.exchange_rate.toString()) ||
      editForm.external_doctor !== (selectedOrthodontic.has_external_doctor || !!selectedOrthodontic.external_doctor_name) ||
      editForm.external_doctor_name !== (selectedOrthodontic.external_doctor_name || '') ||
      editForm.external_doctor_specialty !== (selectedOrthodontic.external_doctor_specialty || '') ||
      editForm.external_doctor_payment_type !== (selectedOrthodontic.external_doctor_payment_type || 'percentage') ||
      editForm.external_doctor_payment_value !== (selectedOrthodontic.external_doctor_payment_value?.toString() || selectedOrthodontic.external_doctor_percentage?.toString() || '') ||
      editForm.external_doctor_payment_currency !== (selectedOrthodontic.external_doctor_payment_currency || 'C$') ||
      editForm.ortho_doctor_percentage !== (selectedOrthodontic.ortho_doctor_percentage?.toString() || '60') ||
      editForm.external_doctor_percentage !== (selectedOrthodontic.external_doctor_percentage?.toString() || '0') ||
      editForm.external_doctor_split_type !== (selectedOrthodontic.external_doctor_split_type || 'from_total') ||
      editForm.observations !== (selectedOrthodontic.observations || '')
    );
  };

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

  const closeEditModal = () => {
    setEditModalOpen(false);
    setSelectedOrthodontic(null);
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

  // ===========================================
  // FUNCIONES PARA GUARDAR CON CONFIRMACIÓN
  // ===========================================

  const validateEditForm = () => {
    if (!editForm.procedure_description) {
      addNotification('❌ Debe ingresar una descripción del tratamiento', 'error', 5000);
      return false;
    }

    if (!editForm.amount_cordobas && !editForm.amount_dollars) {
      addNotification('❌ Debe ingresar al menos un monto (córdobas o dólares)', 'error', 5000);
      return false;
    }

    return true;
  };

  const confirmSaveEdit = (e) => {
    e.preventDefault();
    
    if (!validateEditForm()) return;
    
    setSaveConfirm({
      title: 'Confirmar actualización',
      message: `¿Estás seguro de que deseas actualizar este tratamiento de ortodoncia?`,
      patientName: selectedOrthodontic?.patient_name,
      totalCordobas: calculateTotalProcedure(),
      totalDollars: calculateTotalProcedureUSD(),
      onConfirm: handleSaveEdit
    });
  };

  // ===========================================
  // FUNCIÓN PARA GUARDAR EDICIÓN
  // ===========================================

  const handleSaveEdit = async () => {
    if (!selectedOrthodontic) return;
    
    try {
      const totals = calculateTotalsWithDeductions();
      const orthoPayments = calculateOrthoPayments();
      
      // Preparar datos para enviar
      const procedureData = {
        procedure_description: editForm.procedure_description,
        observations: editForm.observations,
        is_orthodontics: true,
        
        // Cantidades abonadas
        total_cost: totals.grossCordobas,
        total_cost_USD: totals.grossDollars,
        amount_cordobas: totals.grossCordobas,
        amount_dollars: totals.grossDollars,
        
        // Métodos de pago
        payment_method_cordobas: editForm.payment_method_cordobas,
        payment_method_dollars: editForm.payment_method_dollars,
        
        // Deducciones POS
        pos_deduction_cordobas: totals.posDeductionCordobas,
        pos_deduction_dollars: totals.posDeductionDollars,
        total_pos_deduction: totals.totalDeductions,
        
        // Montos netos
        net_amount_cordobas: totals.netCordobas,
        net_amount_dollars: totals.netDollars,
        
        // Montos brutos
        gross_amount_cordobas: totals.grossCordobas,
        gross_amount_dollars: totals.grossDollars,
        
        // Total del procedimiento
        total_procedure: totals.netTotalCordobas,
        total_procedure_usd: totals.netTotalDollars,
        
        // Tipo de cambio
        exchange_rate_used: parseFloat(editForm.exchange_rate) || currentSettings.exchange_rate,
        
        // Doctor externo
        theres_external_doctor: editForm.external_doctor,
        external_doctor: editForm.external_doctor_name || '',
        external_doctor_name: editForm.external_doctor_name,
        external_doctor_specialty: editForm.external_doctor_specialty,
        external_doctor_payment_type: editForm.external_doctor_payment_type,
        external_doctor_payment_value: parseFloat(editForm.external_doctor_payment_value) || 0,
        external_doctor_payment_currency: editForm.external_doctor_payment_currency,
        
        // Pagos calculados
        clinic_payment_cordobas: orthoPayments.clinicPaymentCordobas,
        clinic_payment_dollars: orthoPayments.clinicPaymentDollars,
        doctor_payment_cordobas: orthoPayments.doctorPaymentCordobas,
        doctor_payment_dollars: orthoPayments.doctorPaymentDollars,
        external_doctor_payment: orthoPayments.externalPaymentCordobas,
        external_doctor_payment_usd: orthoPayments.externalPaymentDollars,
        
        // Porcentajes
        clinic_payment_percentage: orthoPayments.clinicPercentage,
        doctor_payment_percentage: orthoPayments.doctorPercentage,
        ortho_doctor_percentage: orthoPayments.doctorPercentage,
        external_doctor_percentage: orthoPayments.externalPercentage,
        external_doctor_split_type: editForm.external_doctor_split_type,
        
        // Fecha
        procedure_date: selectedOrthodontic.procedure_date_utc || selectedOrthodontic.procedure_date
      };
      
      console.log('📤 Enviando al backend (ortodoncia):', {
        procedure_id: selectedOrthodontic.procedure_ID,
        exchange_rate: procedureData.exchange_rate_used,
        total_procedure: procedureData.total_procedure,
        clinic_payment: procedureData.clinic_payment_cordobas,
        doctor_payment: procedureData.doctor_payment_cordobas,
        external_payment: procedureData.external_doctor_payment
      });
      
      const response = await apiFetch(`/procedures/${selectedOrthodontic.procedure_ID}`, {
        method: 'PUT',
        body: JSON.stringify(procedureData)
      });
      
      if (response.success) {
        addNotification('✅ Tratamiento de ortodoncia actualizado exitosamente', 'success', 5000);
        setSaveConfirm(null);
        closeEditModal();
        await loadOrthodontics(); // Recargar la lista
      } else {
        throw new Error(response.error || 'Error al actualizar tratamiento');
      }
      
    } catch (error) {
      console.error('❌ Error al actualizar ortodoncia:', error);
      addNotification(`❌ Error: ${error.message}`, 'error', 7000);
      setSaveConfirm(null);
    }
  };

  // ===========================================
  // FUNCIÓN PARA ELIMINAR
  // ===========================================

  const confirmDelete = (orthodontic) => {
    setDeleteConfirm({
      id: orthodontic.procedure_ID,
      name: orthodontic.procedure_description || 'Tratamiento de ortodoncia',
      patientName: orthodontic.patient_name,
      appointmentId: orthodontic.appointment_ID
    });
  };

  const handleDeleteOrthodontic = async () => {
    if (!deleteConfirm) return;
    
    try {
      const deleteResponse = await apiFetch(`/procedures/${deleteConfirm.id}`, {
        method: 'DELETE'
      });
      
      if (deleteResponse.success) {
        if (deleteConfirm.appointmentId) {
          try {
            await apiFetch(`/appointments/${deleteConfirm.appointmentId}`, {
              method: 'PUT',
              body: JSON.stringify({ is_registered: false })
            });
          } catch (appointmentError) {
            console.error('⚠️ No se pudo actualizar la cita:', appointmentError);
            addNotification('⚠️ Tratamiento eliminado pero no se pudo actualizar la cita', 'warning', 5000);
          }
        }
        
        addNotification('✅ Tratamiento de ortodoncia eliminado exitosamente', 'success', 5000);
        setDeleteConfirm(null);
        await loadOrthodontics();
      } else {
        throw new Error(deleteResponse.error || 'Error al eliminar tratamiento');
      }
      
    } catch (error) {
      console.error('❌ Error al eliminar ortodoncia:', error);
      addNotification(`❌ Error: ${error.message}`, 'error', 7000);
      setDeleteConfirm(null);
    }
  };

  // ===========================================
  // FUNCIONES DE CÁLCULO PARA MOSTRAR
  // ===========================================

  const calculateOrthodonticEarnings = (orthodontic) => {
    const totalProcedureCordobas = orthodontic.total_procedure || 0;
    const totalProcedureDollars = orthodontic.total_procedure_usd || 0;
    
    const clinicPercentage = orthodontic.clinic_payment_percentage || 40;
    const doctorPercentage = orthodontic.doctor_payment_percentage || 60;
    
    const externalDoctorPayment = orthodontic.external_doctor_payment || 0;
    const externalDoctorPaymentUSD = orthodontic.external_doctor_payment_usd || 0;
    
    if (orthodontic.has_external_doctor && orthodontic.external_doctor_percentage > 0) {
      const orthoPercentage = orthodontic.ortho_doctor_percentage || 60;
      const externalPercentage = orthodontic.external_doctor_percentage || 0;
      
      const orthoPaymentCordobas = totalProcedureCordobas * (orthoPercentage / 100);
      const externalPaymentCordobas = totalProcedureCordobas * (externalPercentage / 100);
      const clinicPaymentCordobas = totalProcedureCordobas - orthoPaymentCordobas - externalPaymentCordobas;
      
      const orthoPaymentDollars = totalProcedureDollars * (orthoPercentage / 100);
      const externalPaymentDollars = totalProcedureDollars * (externalPercentage / 100);
      const clinicPaymentDollars = totalProcedureDollars - orthoPaymentDollars - externalPaymentDollars;
      
      return {
        totalProcedureCordobas,
        totalProcedureDollars,
        clinicPaymentCordobas,
        clinicPaymentDollars,
        doctorPaymentCordobas: orthoPaymentCordobas,
        doctorPaymentDollars: orthoPaymentDollars,
        externalPaymentCordobas,
        externalPaymentDollars,
        clinicPercentage: (clinicPaymentCordobas / totalProcedureCordobas) * 100,
        doctorPercentage: orthoPercentage,
        externalPercentage,
        hasExternalDoctor: true
      };
    } else {
      const clinicPaymentCordobas = totalProcedureCordobas * (clinicPercentage / 100);
      const clinicPaymentDollars = totalProcedureDollars * (clinicPercentage / 100);
      const doctorPaymentCordobas = totalProcedureCordobas * (doctorPercentage / 100);
      const doctorPaymentDollars = totalProcedureDollars * (doctorPercentage / 100);
      
      return {
        totalProcedureCordobas,
        totalProcedureDollars,
        clinicPaymentCordobas,
        clinicPaymentDollars,
        doctorPaymentCordobas,
        doctorPaymentDollars,
        externalPaymentCordobas: 0,
        externalPaymentDollars: 0,
        clinicPercentage,
        doctorPercentage,
        externalPercentage: 0,
        hasExternalDoctor: false
      };
    }
  };

  const calculateOrthodonticBreakdown = (orthodontic) => {
    const earnings = calculateOrthodonticEarnings(orthodontic);
    
    const grossCordobas = orthodontic.gross_amount_cordobas || 
                         orthodontic.total_cost || 
                         orthodontic.total_procedure || 0;
    
    const grossDollars = orthodontic.gross_amount_dollars || 
                        orthodontic.total_cost_USD || 
                        orthodontic.total_procedure_usd || 0;
    
    const posDeductionCordobas = orthodontic.pos_deduction_cordobas || 0;
    const posDeductionDollars = orthodontic.pos_deduction_dollars || 0;
    
    return {
      ...earnings,
      grossCordobas,
      grossDollars,
      posDeductionCordobas,
      posDeductionDollars,
      exchangeRate: orthodontic.exchange_rate || 36.5
    };
  };

  // ===========================================
  // FILTRADO Y RENDERIZADO
  // ===========================================

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
                <FontAwesomeIcon icon={faTooth} />
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
                ¿Estás seguro de que deseas eliminar este tratamiento de ortodoncia?
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
                onClick={handleDeleteOrthodontic}
              >
                <FontAwesomeIcon icon={faTrash} />
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================== */}
      {/* MODAL PARA VER ORTODONCIA */}
      {/* =========================================== */}
      {viewModalOpen && selectedOrthodontic && (
        <div className="modal-backdrop" onClick={closeViewModal}>
          <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
            <h3><FontAwesomeIcon icon={faTooth} /> Información Completa del Tratamiento de Ortodoncia</h3>
            
            <div className="orthodontic-view-container">
              {(() => {
                const breakdown = calculateOrthodonticBreakdown(selectedOrthodontic);
                return (
                  <>
                    {/* Información básica */}
                    <div className="view-section">
                      <h4><FontAwesomeIcon icon={faFileMedical} /> Información del Tratamiento</h4>
                      <div className="view-grid">
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

                    {/* Resto del contenido del modal de vista (igual que antes) */}
                    {/* ... (mantener el contenido existente del modal de vista) ... */}
                  </>
                );
              })()}
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={closeViewModal}>
                Cerrar
              </button>
              <button 
                className="btn-confirm"
                onClick={() => {
                  closeViewModal();
                  openEditModal(selectedOrthodontic);
                }}
              >
                <FontAwesomeIcon icon={faEdit} />
                Editar Tratamiento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================== */}
      {/* MODAL PARA EDITAR ORTODONCIA */}
      {/* =========================================== */}
      {editModalOpen && selectedOrthodontic && (
        <div className="modal-overlay">
          <div className="modal-content large-modal">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faEdit} />
                Editar Tratamiento de Ortodoncia
              </h3>
              <button 
                className="close-modal-btn"
                onClick={requestCloseEditModal}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="appointment-info">
              <h4>Información del tratamiento:</h4>
              <p><strong>Paciente:</strong> {selectedOrthodontic.patient_name}</p>
              <p><strong>Fecha:</strong> {formatDisplayDate(selectedOrthodontic.procedure_date)}</p>
              <p><strong>Descripción:</strong> {selectedOrthodontic.procedure_description}</p>
            </div>
            
            <form onSubmit={confirmSaveEdit} className="procedure-form">
              <div className="form-section">
                <h4>Detalles del Tratamiento</h4>
                
                <div className="form-group">
                  <label className="form-label">Descripción del tratamiento:</label>
                  <input
                    type="text"
                    required
                    name="procedure_description"
                    value={editForm.procedure_description}
                    onChange={handleFormChange}
                    className="form-input"
                    placeholder="Ej: Colocación de brackets, ajuste mensual, etc."
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
                        <strong>Total Neto del Tratamiento (C$):</strong>
                      </span>
                      <span className="total-value">
                        <strong>{formatCurrency(calculateTotalProcedure())}</strong>
                      </span>
                    </div>
                    
                    <div className="total-row total-procedure-usd">
                      <span className="total-label">
                        <strong>Total Neto del Tratamiento (US$):</strong>
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
              
              {/* Sección de distribución de ortodoncia */}
              <div className="form-section">
                <h4><FontAwesomeIcon icon={faPercentage} /> Distribución de Ortodoncia</h4>
                
                <div className="toggle-section">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={editForm.external_doctor}
                      onChange={(e) => handleExternalDoctorPaymentChange('external_doctor', e.target.checked)}
                    />
                    <span>¿Hay doctor externo participando?</span>
                  </label>
                </div>
                
                {editForm.external_doctor ? (
                  <div className="ortho-distribution-with-external">
                    <div className="form-group">
                      <label className="form-label">Porcentaje para Doctora Ortodoncista:</label>
                      <div className="percentage-input-container">
                        <input
                          type="number"
                          min="0"
                          max="99.9"
                          step="0.1"
                          name="ortho_doctor_percentage"
                          value={editForm.ortho_doctor_percentage}
                          onChange={handleFormChange}
                          className="form-input"
                          placeholder="60"
                        />
                        <span className="input-suffix">%</span>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Porcentaje para Doctor Externo:</label>
                      <div className="percentage-input-container">
                        <input
                          type="number"
                          min="0"
                          max="99.9"
                          step="0.1"
                          name="external_doctor_percentage"
                          value={editForm.external_doctor_percentage}
                          onChange={handleFormChange}
                          className="form-input"
                          placeholder="20"
                        />
                        <span className="input-suffix">%</span>
                      </div>
                      <small className="form-help-text">
                        La clínica recibirá: {100 - (parseFloat(editForm.ortho_doctor_percentage) || 0) - (parseFloat(editForm.external_doctor_percentage) || 0)}%
                      </small>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Tipo de división:</label>
                      <div className="split-type-buttons">
                        <button
                          type="button"
                          className={`split-type-btn ${editForm.external_doctor_split_type === 'from_total' ? 'active' : ''}`}
                          onClick={() => setEditForm(prev => ({
                            ...prev,
                            external_doctor_split_type: 'from_total'
                          }))}
                        >
                          <FontAwesomeIcon icon={faChartPie} />
                          Del total del tratamiento
                        </button>
                        <button
                          type="button"
                          className={`split-type-btn ${editForm.external_doctor_split_type === 'from_clinic' ? 'active' : ''}`}
                          onClick={() => setEditForm(prev => ({
                            ...prev,
                            external_doctor_split_type: 'from_clinic'
                          }))}
                        >
                          <FontAwesomeIcon icon={faBuilding} />
                          De la parte de la clínica
                        </button>
                      </div>
                    </div>
                    
                    <div className="distribution-summary">
                      <h5>Resumen de distribución:</h5>
                      <div className="distribution-breakdown">
                        <div className="distribution-item">
                          <span className="distribution-label">Doctora Ortodoncista:</span>
                          <span className="distribution-value">
                            {editForm.ortho_doctor_percentage || 0}%
                          </span>
                        </div>
                        <div className="distribution-item">
                          <span className="distribution-label">Doctor Externo:</span>
                          <span className="distribution-value">
                            {editForm.external_doctor_percentage || 0}%
                          </span>
                        </div>
                        <div className="distribution-item clinic">
                          <span className="distribution-label">Clínica:</span>
                          <span className="distribution-value">
                            {100 - (editForm.ortho_doctor_percentage || 0) - (editForm.external_doctor_percentage || 0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Nombre del doctor externo */}
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
                        placeholder="Ej: Ortodoncista, Cirujano maxilofacial, etc."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="ortho-distribution-normal">
                    <div className="distribution-info">
                      <p>Distribución estándar de ortodoncia:</p>
                      <div className="percentage-display">
                        <div className="percentage-item">
                          <span className="percentage-label">Clínica:</span>
                          <span className="percentage-value">{editForm.clinic_payment_percentage}%</span>
                        </div>
                        <div className="percentage-item">
                          <span className="percentage-label">Doctora:</span>
                          <span className="percentage-value">{editForm.doctor_payment_percentage}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Observaciones */}
              <div className="form-group">
                <label className="form-label">Observaciones adicionales:</label>
                <textarea
                  name="observations"
                  value={editForm.observations}
                  onChange={handleFormChange}
                  className="form-textarea"
                  placeholder="Notas sobre el tratamiento..."
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
      <div className="orthodontics-header">
        <h2><FontAwesomeIcon icon={faTooth} /> Ortodoncia</h2>
        <div className="orthodontics-tools">
          <div className="orthodontics-count">
            <FontAwesomeIcon icon={faTeeth} />
            <span>{filteredOrthodontics.length}</span>
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

      {/* BUSCADOR PRINCIPAL - Siempre visible */}
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
                  const hasPOS = (orthodontic.pos_deduction_cordobas || 0) > 0;
                  const hasExternalDoctor = (orthodontic.external_doctor_payment || 0) > 0;
                  
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
                          {hasExternalDoctor && (
                            <small className="external-doctor-indicator">
                              <FontAwesomeIcon icon={faUserDoctor} /> Con doctor externo
                            </small>
                          )}
                        </div>
                      </td>
                      
                      <td className="total-cordobas-cell">
                        <div className="total-with-indicators">
                          {formatCurrency(earnings.totalProcedureCordobas)}
                          {hasPOS && (
                            <small className="total-indicator pos-indicator">
                              <FontAwesomeIcon icon={faCreditCard} />
                            </small>
                          )}
                        </div>
                      </td>
                      
                      <td className="total-dollars-cell">
                        {formatCurrencyUSD(earnings.totalProcedureDollars)}
                      </td>
                      
                      <td className="clinic-net-cell">
                        <div className="clinic-earnings">
                          {formatCurrency(earnings.clinicPaymentCordobas)}
                          <div className="percentage-badge">
                            {earnings.clinicPercentage.toFixed(1)}%
                          </div>
                        </div>
                      </td>
                      
                      <td className="doctor-net-cell">
                        <div className="doctor-earnings">
                          {formatCurrency(earnings.doctorPaymentCordobas)}
                          <div className="percentage-badge">
                            {earnings.doctorPercentage.toFixed(1)}%
                          </div>
                        </div>
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
                        <button 
                          className="btn-edit"
                          onClick={() => openEditModal(orthodontic)}
                          title="Editar tratamiento"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                          Editar
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => confirmDelete(orthodontic)}
                          title="Eliminar tratamiento"
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