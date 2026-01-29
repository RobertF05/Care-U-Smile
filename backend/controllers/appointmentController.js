import { supabaseAdmin } from '../config/supabase.js';

const appointmentController = {
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
      
      if (state) {
        query = query.eq('state', state);
      }
      
      if (patientId) {
        query = query.eq('Patient_ID', patientId);
      }
      
      if (isOrthodontics !== undefined) {
        query = query.eq('is_orthodontics', isOrthodontics === 'true');
      }
      
      if (isRegistered !== undefined) {
        query = query.eq('is_registered', isRegistered === 'true');
      }
      
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
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

  // Actualizar cita
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const appointmentData = req.body;
      
      console.log('📝 Actualizando cita:', { id, appointmentData });
      
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
      
      if (existingAppointment.is_registered && appointmentData.state !== 'cancelled') {
        return res.status(400).json({ 
          success: false, 
          error: 'No se puede editar una cita que ya ha sido registrada como procedimiento' 
        });
      }
      
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
        
        updateData.appointment_date = newDate.toISOString().replace('Z', '');
      }
      
      const { data, error } = await supabaseAdmin
        .from('clinical_appointments')
        .update(updateData)
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

  // Convertir cita en procedimiento - VERSIÓN CORREGIDA CON total_procedure_USD
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
        state: appointment.state
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
      
      console.log('📅 Fecha del procedimiento:', appointment.appointment_date);
      
      // IMPORTANTE: Tomar total_procedure_USD del frontend
      // El frontend ya calcula el valor correcto después de deducciones
      const total_procedure_USD = procedureData.total_procedure_USD;
      const exchange_rate = procedureData.exchange_rate || 36.5;
      
      console.log('💰 Valores recibidos del frontend:', {
        total_procedure_USD_from_frontend: total_procedure_USD,
        total_procedure: procedureData.total_procedure,
        exchange_rate: exchange_rate,
        amount_dollars: procedureData.amount_dollars
      });
      
      // Preparar datos para insertar - ¡INCLUYENDO total_procedure_USD!
      const procedureToInsert = {
  appointment_ID: id,
  Patient_ID: appointment.Patient_ID,
  procedure_date: appointment.appointment_date,
  procedure_description: procedureData.procedure_description,
  total_cost: procedureData.total_cost || 0, // Bruto en córdobas
  total_cost_USD: procedureData.total_cost_USD || 0, // Bruto en dólares
  total_procedure: procedureData.total_procedure || 0, // Neto después de deducciones en C$
  total_procedure_usd: total_procedure_USD || 0, // ¡CAMPO CORREGIDO! Neto después de deducciones en US$
  payment_method: procedureData.payment_method || 'Mixto',
  is_orthodontics: appointment.is_orthodontics,
  observations: procedureData.observations || appointment.observations,
  creation_date: new Date().toISOString().replace('Z', ''),
  
  // Campos de pagos múltiples
  amount_cordobas: procedureData.amount_cordobas || 0,
  amount_dollars: procedureData.amount_dollars || 0,
  payment_method_cordobas: procedureData.payment_method_cordobas || null,
  payment_method_dollars: procedureData.payment_method_dollars || null,
  
  // CAMPOS DE DEDUCCIÓN POS
  pos_deduction_cordobas: procedureData.pos_deduction_cordobas || 0,
  pos_deduction_dollars: procedureData.pos_deduction_dollars || 0,
  total_pos_deduction: procedureData.total_pos_deduction || 0,
  net_amount_cordobas: procedureData.net_amount_cordobas || procedureData.amount_cordobas || 0,
  net_amount_dollars: procedureData.net_amount_dollars || procedureData.amount_dollars || 0,
  gross_amount_cordobas: procedureData.gross_amount_cordobas || procedureData.amount_cordobas || 0,
  gross_amount_dollars: procedureData.gross_amount_dollars || procedureData.amount_dollars || 0,
  
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
    (appointment.is_orthodontics ? 60 : 0),
  
  // ELIMINAR ESTA LÍNEA: No existe en la tabla procedures
  // exchange_rate: exchange_rate ❌
};
      
      console.log('📊 Insertando procedimiento con total_procedure_usd:', {
        total_procedure_usd: procedureToInsert.total_procedure_usd,
        total_procedure: procedureToInsert.total_procedure,
        amount_dollars: procedureToInsert.amount_dollars
      });
      
      // 2. Crear el procedimiento
      const { data: procedure, error: procedureError } = await supabaseAdmin
        .from('procedures')
        .insert([procedureToInsert])
        .select()
        .single();
      
      if (procedureError) {
        console.error('❌ Error detallado al crear procedimiento:', procedureError);
        throw new Error(`Error al crear procedimiento: ${procedureError.message}`);
      }
      
      console.log('✅ Procedimiento creado:', {
        procedure_ID: procedure.procedure_ID,
        total_procedure: procedure.total_procedure,
        total_procedure_usd: procedure.total_procedure_usd
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
  }
};

export default appointmentController;