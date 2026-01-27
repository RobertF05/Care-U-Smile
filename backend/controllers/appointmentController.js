// controllers/appointmentController.js
import { supabaseAdmin } from '../config/supabase.js';

const appointmentController = {
  // Obtener todas las citas
  // appointmentController.js - getAll method (VERSIÓN FINAL)
getAll: async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      startDate, 
      endDate, 
      state,
      patientId,
      isOrthodontics,
      isRegistered
    } = req.query;
    
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    let query = supabaseAdmin
      .from('clinical_appointments')
      .select(`
        *,
        patients (
          first_name,
          first_last_name,
          identification,
          number_phone
        )
      `, { count: 'exact' })
      .order('appointment_date', { ascending: true });
    
    // Filtros directos - SIN conversiones
    if (startDate) {
      const startNicaragua = `${startDate}T00:00:00`;
      console.log(`🔍 Filtro startDate: ${startNicaragua}`);
      query = query.gte('appointment_date', startNicaragua);
    }
    
    if (endDate) {
      const endNicaragua = `${endDate}T23:59:59`;
      console.log(`🔍 Filtro endDate: ${endNicaragua}`);
      query = query.lte('appointment_date', endNicaragua);
    }
    
    // ... resto de filtros
    
    query = query.range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    // Transformar datos - SIN conversión de zona horaria
    const transformedData = data.map(item => {
      // Parsear fecha directamente del string
      const [datePart, timePart] = item.appointment_date.split('T');
      const [year, month, day] = datePart.split('-');
      const [hours, minutes, seconds] = timePart.split(':');
      
      // Crear fecha manualmente
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
      
      return {
        ...item,
        appointment_date: formattedDate,
        patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
        patient_identification: item.patients?.identification,
        patient_phone: item.patients?.number_phone,
        is_registered: item.is_registered || false
      };
    });
    
    res.json({ 
      success: true, 
      data: transformedData,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Error al obtener citas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener citas' 
    });
  }
},

  // Obtener cita por ID
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

  // Crear cita - SIN CONVERSIONES de zona horaria
  // appointmentController.js - create method (VERSIÓN FINAL)
create: async (req, res) => {
  try {
    const appointmentData = req.body;
    
    console.log('📥 Datos recibidos para crear cita:', appointmentData);
    console.log('🕐 Hora recibida del frontend (EXACTA):', appointmentData.appointment_date);
    
    // Validar datos requeridos
    if (!appointmentData.Patient_ID || !appointmentData.appointment_date) {
      return res.status(400).json({ 
        success: false, 
        error: 'Paciente y fecha son requeridos' 
      });
    }
    
    // Verificar que el paciente exista
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
    
    // IMPORTANTE: NO validar con Date() porque puede añadir conversiones
    // Solo verificar que tenga formato válido
    if (!appointmentData.appointment_date.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Formato de fecha/hora inválido. Use YYYY-MM-DDTHH:mm:ss' 
      });
    }
    
    // Guardar EXACTAMENTE lo que viene del frontend
    const appointmentToInsert = {
      Patient_ID: appointmentData.Patient_ID,
      appointment_date: appointmentData.appointment_date, // EXACTAMENTE igual
      query_type: appointmentData.query_type || 'Consulta general',
      state: 'scheduled',
      is_orthodontics: appointmentData.is_orthodontics || false,
      observations: appointmentData.observations || null,
      is_registered: false
    };
    
    console.log('📊 Guardando en BD (EXACTO):', appointmentToInsert);
    
    // Crear la cita
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
    
    // Para mostrar al usuario: NO convertir, interpretar directamente
    // La fecha ya está en formato "2024-01-28T14:00:00"
    // Parsearla directamente
    const [datePart, timePart] = newAppointment.appointment_date.split('T');
    const [year, month, day] = datePart.split('-');
    const [hours, minutes, seconds] = timePart.split(':');
    
    // Crear fecha manualmente para evitar conversiones automáticas
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

  // Actualizar cita
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const appointmentData = req.body;
      
      console.log('📝 Actualizando cita:', { id, appointmentData });
      
      // Verificar que la cita exista
      const { data: existingAppointment, error: checkError } = await supabaseAdmin
        .from('clinical_appointments')
        .select('appointment_ID, is_registered, appointment_date')
        .eq('appointment_ID', id)
        .single();
      
      if (checkError || !existingAppointment) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cita no encontrada' 
        });
      }
      
      // No permitir editar si ya está registrada como procedimiento
      if (existingAppointment.is_registered && appointmentData.state !== 'cancelled') {
        return res.status(400).json({ 
          success: false, 
          error: 'No se puede editar una cita que ya ha sido registrada como procedimiento' 
        });
      }
      
      // Si se actualiza la fecha, guardar tal cual
      const updateData = { ...appointmentData };
      if (updateData.appointment_date) {
        console.log('📅 Procesando fecha para actualizar:', updateData.appointment_date);
        
        const newDate = new Date(updateData.appointment_date);
        
        if (isNaN(newDate.getTime())) {
          return res.status(400).json({ 
            success: false, 
            error: 'Fecha/hora inválida' 
          });
        }
        
        // Crear string en formato ISO SIN conversiones
        updateData.appointment_date = newDate.toISOString().replace('Z', '');
      }
      
      const { data, error } = await supabaseAdmin
        .from('clinical_appointments')
        .update(updateData)
        .eq('appointment_ID', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Formatear fecha para respuesta (SIN conversión)
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
        message: 'Cita actualizada exitosamente',
        data: formattedAppointment 
      });
    } catch (error) {
      console.error('Error al actualizar cita:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar cita' 
      });
    }
  },

  // Convertir cita en procedimiento
  convertToProcedure: async (req, res) => {
    try {
      const { id } = req.params;
      const procedureData = req.body;
      
      // 1. Obtener la cita
      const { data: appointment, error: appointmentError } = await supabaseAdmin
        .from('clinical_appointments')
        .select('*')
        .eq('appointment_ID', id)
        .single();
      
      if (appointmentError || !appointment) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cita no encontrada' 
        });
      }
      
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
      
      // La fecha del procedimiento se mantiene igual
      console.log('📅 Fecha del procedimiento:', appointment.appointment_date);
      
      // Preparar datos para insertar
      const procedureToInsert = {
        appointment_ID: id,
        Patient_ID: appointment.Patient_ID,
        procedure_date: appointment.appointment_date, // Mantener igual
        procedure_description: procedureData.procedure_description,
        total_cost: procedureData.total_cost || 0,
        total_cost_USD: procedureData.total_cost_USD || 0,
        total_procedure: procedureData.total_procedure || 0,
        payment_method: procedureData.payment_method || 'Mixto',
        is_orthodontics: appointment.is_orthodontics,
        observations: procedureData.observations || appointment.observations,
        creation_date: new Date().toISOString().replace('Z', ''),
        // Campos de pagos múltiples
        amount_cordobas: procedureData.amount_cordobas || 0,
        amount_dollars: procedureData.amount_dollars || 0,
        payment_method_cordobas: procedureData.payment_method_cordobas || null,
        payment_method_dollars: procedureData.payment_method_dollars || null,
        // Campos de doctor externo
        external_doctor: procedureData.external_doctor || null,
        external_doctor_payment: procedureData.external_doctor_payment || null,
        theres_external_doctor: procedureData.theres_external_doctor || false,
        external_doctor_name: procedureData.external_doctor_name || null,
        external_doctor_specialty: procedureData.external_doctor_specialty || null,
        external_doctor_payment_type: procedureData.external_doctor_payment_type || 'fixed',
        external_doctor_payment_value: procedureData.external_doctor_payment_value || null,
        external_doctor_payment_currency: procedureData.external_doctor_payment_currency || 'C$',
        // Campos de porcentajes
        clinic_payment_percentage: procedureData.clinic_payment_percentage || 
          (appointment.is_orthodontics ? 40 : 100),
        doctor_payment_percentage: procedureData.doctor_payment_percentage || 
          (appointment.is_orthodontics ? 60 : 0)
      };
      
      // 2. Crear el procedimiento
      const { data: procedure, error: procedureError } = await supabaseAdmin
        .from('procedures')
        .insert([procedureToInsert])
        .select()
        .single();
      
      if (procedureError) {
        console.error('Error detallado al crear procedimiento:', procedureError);
        throw new Error(`Error al crear procedimiento: ${procedureError.message}`);
      }
      
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
        // Si falla la actualización, revertir el procedimiento
        await supabaseAdmin
          .from('procedures')
          .delete()
          .eq('procedure_ID', procedure.procedure_ID);
        
        throw new Error(`Error al actualizar cita: ${updateError.message}`);
      }
      
      // Formatear fechas para respuesta (SIN conversión)
      const updatedDate = new Date(updatedAppointment.appointment_date);
      const formattedUpdatedDate = updatedDate.toLocaleString('es-NI', {
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
      console.error('Error al convertir cita en procedimiento:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Error al registrar procedimiento' 
      });
    }
  },

  // Eliminar cita
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que la cita exista
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
      
      // No permitir eliminar si ya está registrada como procedimiento
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
      
      // Formatear fecha para respuesta (SIN conversión)
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

  // Obtener citas por fecha
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

  // Obtener citas por paciente
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

  // Contar citas por estado
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

  // Contar citas registradas
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

  // Contar citas no registradas
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
  }
};

export default appointmentController;