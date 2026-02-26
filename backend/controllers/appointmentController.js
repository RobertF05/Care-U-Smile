import { supabaseAdmin } from '../config/supabase.js';
import Procedure from '../models/procedureModel.js';
import procedureController from './procedureController.js'; 
import Appointment from '../models/appointmentModel.js';

const appointmentController = {
  getAll: async (req, res) => {
  try {
    const { 
      page = 1, 
      limit,
      startDate, 
      endDate, 
      state,
      patientId,
      isOrthodontics,
      isRegistered
    } = req.query;

    const filters = {};

    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (state) filters.state = state;
    if (patientId) filters.patientId = patientId;
    if (isOrthodontics !== undefined) filters.isOrthodontics = isOrthodontics === 'true';
    if (isRegistered !== undefined) filters.isRegistered = isRegistered === 'true';

    const result = await Appointment.getAll(
      parseInt(page),
      limit ? parseInt(limit) : undefined,
      filters
    );

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error al obtener citas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener citas'
    });
  }
},

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const { data, error } = await supabaseAdmin
        .from('clinical_appointments')
        .select(`
          *,
          patients (
            first_name,
            first_last_name,
            identification,
            number_phone,
            email
          )
        `)
        .eq('appointment_ID', id)
        .single();
      
      if (error) throw error;
      
      if (!data) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cita no encontrada' 
        });
      }
      
      const fechaBD = new Date(data.appointment_date);
      const formattedDate = fechaBD.toLocaleString('es-NI', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      
      const transformedData = {
        ...data,
        appointment_date: formattedDate,
        patient_name: `${data.patients?.first_name || ''} ${data.patients?.first_last_name || ''}`.trim(),
        patient_identification: data.patients?.identification,
        patient_phone: data.patients?.number_phone,
        patient_email: data.patients?.email,
        is_registered: data.is_registered || false
      };
      
      res.json({ 
        success: true, 
        data: transformedData 
      });
    } catch (error) {
      console.error('Error al obtener cita:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener cita' 
      });
    }
  },

  // Crear cita - MODIFICADO PARA ACEPTAR DEDUCCIONES
  create: async (req, res) => {
    try {
      const appointmentData = req.body;
      
      console.log('📥 Datos recibidos para crear cita:', appointmentData);
      console.log('🕐 Hora recibida del frontend:', appointmentData.appointment_date);
      
      if (!appointmentData.Patient_ID || !appointmentData.appointment_date) {
        return res.status(400).json({ 
          success: false, 
          error: 'Paciente y fecha son requeridos' 
        });
      }
      
      const { data: patient, error: patientError } = await supabaseAdmin
        .from('patients')
        .select('Patient_ID')
        .eq('Patient_ID', appointmentData.Patient_ID)
        .single();
      
      if (patientError || !patient) {
        return res.status(404).json({ 
          success: false, 
          error: 'Paciente no encontrada' 
        });
      }
      
      if (!appointmentData.appointment_date.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Formato de fecha/hora inválido. Use YYYY-MM-DDTHH:mm:ss' 
        });
      }
      
      const appointmentToInsert = {
        Patient_ID: appointmentData.Patient_ID,
        appointment_date: appointmentData.appointment_date,
        query_type: appointmentData.query_type || 'Consulta general',
        state: 'scheduled',
        is_orthodontics: appointmentData.is_orthodontics || false,
        observations: appointmentData.observations || null,
        is_registered: false
      };
      
      console.log('📊 Guardando en BD (EXACTO):', appointmentToInsert);
      
      const { data: newAppointment, error: createError } = await supabaseAdmin
        .from('clinical_appointments')
        .insert([appointmentToInsert])
        .select(`
          *,
          patients (
            first_name,
            first_last_name,
            identification
          )
        `)
        .single();
      
      if (createError) {
        console.error('Error de Supabase:', createError);
        throw createError;
      }
      
      const [datePart, timePart] = newAppointment.appointment_date.split('T');
      const [year, month, day] = datePart.split('-');
      const [hours, minutes, seconds] = timePart.split(':');
      
      const dateObj = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes),
        parseInt(seconds)
      );
      
      const formattedDate = dateObj.toLocaleString('es-NI', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      
      console.log('🔄 MOSTRAR al usuario:', {
        bd: newAppointment.appointment_date,
        fechaObjeto: dateObj.toISOString(),
        mostrado: formattedDate
      });
      
      const formattedAppointment = {
        ...newAppointment,
        appointment_date: formattedDate,
        patient_name: `${newAppointment.patients?.first_name || ''} ${newAppointment.patients?.first_last_name || ''}`.trim(),
        patient_identification: newAppointment.patients?.identification,
        is_registered: newAppointment.is_registered || false
      };
      
      res.status(201).json({ 
        success: true, 
        message: 'Cita creada exitosamente',
        data: formattedAppointment 
      });
    } catch (error) {
      console.error('Error al crear cita:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Error al crear cita' 
      });
    }
  },

  // ============================================
// ACTUALIZAR CITA - VERSIÓN ULTRA SIMPLE (PONER AL INICIO DEL CONTROLLER)
// ============================================
update: async (req, res) => {
  try {
    const { id } = req.params;
    const appointmentData = req.body;
    
    console.log('🚨🚨🚨 UPDATE CITAS - INICIANDO 🚨🚨🚨');
    console.log('📝 ID:', id);
    console.log('📝 Datos:', JSON.stringify(appointmentData, null, 2));
    
    // ✅ CASO ESPECIAL: DESREGISTRAR (is_registered: false)
    if (appointmentData.is_registered === false) {
      console.log(`🎯 CASO ESPECIAL: Desregistrando cita ${id}`);
      
      const { data, error } = await supabaseAdmin
        .from('clinical_appointments')
        .update({ is_registered: false })
        .eq('appointment_ID', id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error en Supabase:', error);
        return res.status(500).json({ success: false, error: error.message });
      }
      
      console.log('✅ Cita desregistrada exitosamente:', data);
      
      return res.json({ 
        success: true, 
        message: 'Cita desregistrada exitosamente',
        data
      });
    }
    
    // Si no es desregistrar, continuar con validaciones normales
    console.log('⏭️ No es desregistrar, validando...');
    
    const { data: existingAppointment, error: checkError } = await supabaseAdmin
      .from('clinical_appointments')
      .select('is_registered')
      .eq('appointment_ID', id)
      .single();
    
    if (checkError || !existingAppointment) {
      return res.status(404).json({ success: false, error: 'Cita no encontrada' });
    }
    
    if (existingAppointment.is_registered) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se puede editar una cita que ya ha sido registrada como procedimiento' 
      });
    }
    
    // Actualización normal
    const updateData = { ...appointmentData };
    if (updateData.appointment_date) {
      updateData.appointment_date = new Date(updateData.appointment_date).toISOString().replace('Z', '');
    }
    
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .update(updateData)
      .eq('appointment_ID', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Cita actualizada exitosamente', data });
    
  } catch (error) {
    console.error('❌ Error en update:', error);
    res.status(500).json({ success: false, error: error.message });
  }
},

// ============================================
// ENDPOINT ESPECIAL PARA DESREGISTRAR CITA (SIN VALIDACIONES)
// ============================================
unregisterAppointment: async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🎯 ENDPOINT ESPECIAL: Desregistrando cita ${id}`);
    
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .update({ is_registered: false })
      .eq('appointment_ID', id)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error en Supabase:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
    
    console.log('✅ Cita desregistrada exitosamente:', data.appointment_ID);
    
    res.json({ 
      success: true, 
      message: 'Cita desregistrada exitosamente',
      data
    });
    
  } catch (error) {
    console.error('❌ Error en unregisterAppointment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
},

  convertToProcedure: async (req, res) => {
  try {
    const { id } = req.params;
    const procedureData = req.body;
    
    console.log('🔄 Iniciando conversión de cita a procedimiento:', {
      appointmentId: id,
      procedureData: JSON.stringify(procedureData, null, 2)
    });
    
    // 1. Obtener la cita
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from('clinical_appointments')
      .select('*')
      .eq('appointment_ID', id)
      .single();
    
    if (appointmentError || !appointment) {
      console.error('❌ Cita no encontrada:', appointmentError);
      return res.status(404).json({ 
        success: false, 
        error: 'Cita no encontrada' 
      });
    }
    
    console.log('📅 Cita encontrada:', {
      appointment_ID: appointment.appointment_ID,
      is_registered: appointment.is_registered,
      state: appointment.state,
      is_orthodontics: appointment.is_orthodontics,
      Patient_ID: appointment.Patient_ID
    });
    
    // Verificar si ya está registrada
    if (appointment.is_registered) {
      return res.status(400).json({ 
        success: false, 
        error: 'Esta cita ya ha sido registrada como procedimiento' 
      });
    }
    
    // Validar datos mínimos
    if (!procedureData.procedure_description) {
      return res.status(400).json({ 
        success: false, 
        error: 'Descripción del procedimiento es requerida' 
      });
    }
    
    // Cargar configuración para valores por defecto
    let defaultExchangeRate = 36.5;
    try {
      const response = await supabaseAdmin
        .from('settings')
        .select('exchange_rate')
        .limit(1)
        .single();
      
      if (response.data && response.data.exchange_rate) {
        defaultExchangeRate = response.data.exchange_rate;
      }
    } catch (error) {
      console.log('⚠️ No se pudo cargar configuración, usando valor por defecto:', defaultExchangeRate);
    }
    
    // Preparar datos para insertar - CORREGIDO con nombres de campos correctos
    const procedureToInsert = {
      // Información básica y referencias
      appointment_ID: id,
      Patient_ID: appointment.Patient_ID,
      procedure_date: appointment.appointment_date,
      is_orthodontics: appointment.is_orthodontics,
      creation_date: new Date().toISOString(),
      procedure_description: procedureData.procedure_description || '',
      observations: procedureData.observations || '',
      
      // ===== CANTIDADES ABONADAS =====
      total_cost: parseFloat(procedureData.total_cost) || 0,
      total_cost_USD: parseFloat(procedureData.total_cost_USD) || 0,
      amount_cordobas: parseFloat(procedureData.amount_cordobas) || 0,
      amount_dollars: parseFloat(procedureData.amount_dollars) || 0,
      
      // Métodos de pago
      payment_method_cordobas: procedureData.payment_method_cordobas || 'Efectivo',
      payment_method_dollars: procedureData.payment_method_dollars || 'Efectivo',
      
      // ===== DEDUCCIONES POS =====
      pos_deduction_cordobas: parseFloat(procedureData.pos_deduction_cordobas) || 0,
      pos_deduction_dollars: parseFloat(procedureData.pos_deduction_dollars) || 0,
      total_pos_deduction: parseFloat(procedureData.total_pos_deduction) || 0,
      
      // ===== MONTOS NETOS =====
      net_amount_cordobas: parseFloat(procedureData.net_amount_cordobas) || 0,
      net_amount_dollars: parseFloat(procedureData.net_amount_dollars) || 0,
      
      // ===== MONTOS BRUTOS =====
      gross_amount_cordobas: parseFloat(procedureData.gross_amount_cordobas) || 0,
      gross_amount_dollars: parseFloat(procedureData.gross_amount_dollars) || 0,
      
      // ===== TOTALES DEL PROCEDIMIENTO =====
      total_procedure: parseFloat(procedureData.total_procedure) || 0,
      total_procedure_usd: parseFloat(procedureData.total_procedure_usd) || 0,
      
      // ===== TIPO DE CAMBIO =====
      exchange_rate_used: parseFloat(procedureData.exchange_rate) || defaultExchangeRate, // ¡CORREGIDO!
      
      // ===== PAGOS =====
      clinic_payment_cordobas: parseFloat(procedureData.clinic_payment_cordobas) || 0,
      clinic_payment_dollars: parseFloat(procedureData.clinic_payment_dollars) || 0,
      doctor_payment_cordobas: parseFloat(procedureData.doctor_payment_cordobas) || 0,
      doctor_payment_dollars: parseFloat(procedureData.doctor_payment_dollars) || 0,
      
      // ===== DOCTOR EXTERNO =====
      external_doctor: procedureData.external_doctor_name || '',
      theres_external_doctor: procedureData.theres_external_doctor || false,
      external_doctor_name: procedureData.external_doctor_name || '',
      external_doctor_specialty: procedureData.external_doctor_specialty || '',
      external_doctor_payment_type: procedureData.external_doctor_payment_type || 'fixed',
      external_doctor_payment_value: parseFloat(procedureData.external_doctor_payment_value) || 0,
      external_doctor_payment_currency: procedureData.external_doctor_payment_currency || 'C$',
      external_doctor_payment: parseFloat(procedureData.external_doctor_payment) || 0,
      external_doctor_payment_usd: parseFloat(procedureData.external_doctor_payment_usd) || 0,
      
      // ===== PORCENTAJES =====
      clinic_payment_percentage: parseFloat(procedureData.clinic_payment_percentage) || 
        (appointment.is_orthodontics ? 40 : 100),
      doctor_payment_percentage: parseFloat(procedureData.doctor_payment_percentage) || 
        (appointment.is_orthodontics ? 60 : 0),
      ortho_doctor_percentage: parseFloat(procedureData.ortho_doctor_percentage) || 
        (appointment.is_orthodontics ? 60 : 0),
      external_doctor_percentage: parseFloat(procedureData.external_doctor_percentage) || 0,
      external_doctor_split_type: procedureData.external_doctor_split_type || 'from_clinic'
    };
    
    console.log('📤 Insertando procedimiento con datos:', {
      totalProcedure: procedureToInsert.total_procedure,
      clinicPayment: procedureToInsert.clinic_payment_cordobas,
      externalDoctorPayment: procedureToInsert.external_doctor_payment,
      exchangeRateUsed: procedureToInsert.exchange_rate_used // ¡Verifica esto!
    });
    
    console.log('🔍 Campos a insertar:', Object.keys(procedureToInsert));
    
    // 2. Crear el procedimiento en la base de datos
    const { data: procedure, error: procedureError } = await supabaseAdmin
      .from('procedures')
      .insert([procedureToInsert])
      .select()
      .single();
    
    if (procedureError) {
      console.error('❌ Error al crear procedimiento:', procedureError);
      console.error('❌ Detalles del error:', {
        code: procedureError.code,
        message: procedureError.message,
        details: procedureError.details
      });
      throw procedureError;
    }
    
    console.log('✅ Procedimiento creado:', {
      procedure_ID: procedure.procedure_ID,
      total_procedure: procedure.total_procedure,
      clinic_payment_cordobas: procedure.clinic_payment_cordobas,
      external_doctor_payment: procedure.external_doctor_payment,
      exchange_rate_used: procedure.exchange_rate_used
    });
    
    // 3. Actualizar estado de la cita a "completed" y marcar como registrada
    const { data: updatedAppointment, error: updateError } = await supabaseAdmin
      .from('clinical_appointments')
      .update({ 
        state: 'completed',
        is_registered: true 
      })
      .eq('appointment_ID', id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Error al actualizar cita:', updateError);
      // Revertir la creación del procedimiento
      await supabaseAdmin
        .from('procedures')
        .delete()
        .eq('procedure_ID', procedure.procedure_ID);
      
      throw new Error(`Error al actualizar cita: ${updateError.message}`);
    }
    
    console.log('✅ Cita actualizada:', {
      appointment_ID: updatedAppointment.appointment_ID,
      state: updatedAppointment.state,
      is_registered: updatedAppointment.is_registered
    });
    
    // Formatear fechas para respuesta
    const fechaBD = new Date(updatedAppointment.appointment_date);
    const formattedUpdatedDate = fechaBD.toLocaleString('es-NI', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    const procedureDate = new Date(procedure.procedure_date);
    const formattedProcedureDate = procedureDate.toLocaleString('es-NI', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    const formattedAppointment = {
      ...updatedAppointment,
      appointment_date: formattedUpdatedDate,
      is_registered: true
    };
    
    const formattedProcedure = {
      ...procedure,
      procedure_date: formattedProcedureDate
    };
    
    res.json({ 
      success: true, 
      message: appointment.is_orthodontics ? 
        'Tratamiento de ortodoncia registrado exitosamente' : 
        'Procedimiento registrado exitosamente',
      data: {
        appointment: formattedAppointment,
        procedure: formattedProcedure
      }
    });
  } catch (error) {
    console.error('❌ Error completo al convertir cita en procedimiento:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al registrar procedimiento' 
    });
  }
},

  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      const { data: existingAppointment, error: checkError } = await supabaseAdmin
        .from('clinical_appointments')
        .select('appointment_ID, is_registered')
        .eq('appointment_ID', id)
        .single();
      
      if (checkError || !existingAppointment) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cita no encontrada' 
        });
      }
      
      if (existingAppointment.is_registered) {
        return res.status(400).json({ 
          success: false, 
          error: 'No se puede eliminar una cita que ya ha sido registrada como procedimiento' 
        });
      }
      
      const { data, error } = await supabaseAdmin
        .from('clinical_appointments')
        .delete()
        .eq('appointment_ID', id)
        .select()
        .single();
      
      if (error) throw error;
      
      const fechaBD = new Date(data.appointment_date);
      const formattedDate = fechaBD.toLocaleString('es-NI', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      
      const formattedAppointment = {
        ...data,
        appointment_date: formattedDate,
        is_registered: data.is_registered || false
      };
      
      res.json({ 
        success: true, 
        message: 'Cita eliminada exitosamente',
        data: formattedAppointment 
      });
    } catch (error) {
      console.error('Error al eliminar cita:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al eliminar cita' 
      });
    }
  },

  getByDate: async (req, res) => {
    try {
      const { date } = req.params;
      console.log('📅 Buscando citas para fecha:', date);
      
      const startNicaragua = `${date}T00:00:00`;
      const endNicaragua = `${date}T23:59:59`;
      
      const { data, error } = await supabaseAdmin
        .from('clinical_appointments')
        .select(`
          *,
          patients (
            first_name,
            first_last_name,
            number_phone
          )
        `)
        .gte('appointment_date', startNicaragua)
        .lte('appointment_date', endNicaragua)
        .order('appointment_date', { ascending: true });
      
      if (error) throw error;
      
      const transformedData = data.map(item => {
        const fechaBD = new Date(item.appointment_date);
        const formattedDate = fechaBD.toLocaleString('es-NI', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        
        return {
          ...item,
          appointment_date: formattedDate,
          patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
          patient_phone: item.patients?.number_phone,
          is_registered: item.is_registered || false
        };
      });
      
      res.json({ 
        success: true, 
        data: transformedData 
      });
    } catch (error) {
      console.error('Error al obtener citas por fecha:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener citas por fecha' 
      });
    }
  },

  getByPatientId: async (req, res) => {
    try {
      const { patientId } = req.params;
      
      const { data, error } = await supabaseAdmin
        .from('clinical_appointments')
        .select('*')
        .eq('Patient_ID', patientId)
        .order('appointment_date', { ascending: false });
      
      if (error) throw error;
      
      const transformedData = data.map(item => {
        const fechaBD = new Date(item.appointment_date);
        const formattedDate = fechaBD.toLocaleString('es-NI', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        
        return {
          ...item,
          appointment_date: formattedDate,
          is_registered: item.is_registered || false
        };
      });
      
      res.json({ 
        success: true, 
        data: transformedData || [] 
      });
    } catch (error) {
      console.error('Error al obtener citas:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener citas' 
      });
    }
  },

  countByState: async (req, res) => {
    try {
      const { state } = req.query;
      
      const { count, error } = await supabaseAdmin
        .from('clinical_appointments')
        .select('*', { count: 'exact', head: true })
        .eq('state', state);
      
      if (error) throw error;
      
      res.json({ 
        success: true, 
        count: count || 0 
      });
    } catch (error) {
      console.error('Error al contar citas:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al contar citas' 
      });
    }
  },

  countRegistered: async (req, res) => {
    try {
      const { count, error } = await supabaseAdmin
        .from('clinical_appointments')
        .select('*', { count: 'exact', head: true })
        .eq('is_registered', true);
      
      if (error) throw error;
      
      res.json({ 
        success: true, 
        count: count || 0 
      });
    } catch (error) {
      console.error('Error al contar citas registradas:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al contar citas registradas' 
      });
    }
  },

  countUnregistered: async (req, res) => {
    try {
      const { count, error } = await supabaseAdmin
        .from('clinical_appointments')
        .select('*', { count: 'exact', head: true })
        .eq('is_registered', false);
      
      if (error) throw error;
      
      res.json({ 
        success: true, 
        count: count || 0 
      });
    } catch (error) {
      console.error('Error al contar citas no registradas:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al contar citas no registradas' 
      });
    }
  },

  // Obtener conteo de citas pendientes
  countPending: async (req, res) => {
    try {
      const { count, error } = await supabaseAdmin
        .from('clinical_appointments')
        .select('*', { count: 'exact', head: true })
        .eq('state', 'scheduled');
      
      if (error) throw error;
      
      res.json({ 
        success: true, 
        count: count || 0 
      });
    } catch (error) {
      console.error('Error al contar citas pendientes:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al contar citas pendientes' 
      });
    }
  }
};

export default appointmentController;