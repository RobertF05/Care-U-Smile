import { supabaseAdmin } from '../config/supabase.js';

const appointmentController = {
  // Obtener todas las citas
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
      
      // Aplicar filtros
      if (startDate) {
        query = query.gte('appointment_date', startDate);
      }
      
      if (endDate) {
        query = query.lte('appointment_date', endDate);
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
      
      // Transformar datos
      const transformedData = data.map(item => ({
        ...item,
        patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
        patient_identification: item.patients?.identification,
        patient_phone: item.patients?.number_phone,
        is_registered: item.is_registered || false
      }));
      
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
      
      const transformedData = {
        ...data,
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

  // Crear cita
  create: async (req, res) => {
    try {
      const appointmentData = req.body;
      
      console.log('📥 Datos recibidos para crear cita:', appointmentData);
      
      // Normalizar nombres de campos
      const normalizedData = {
        Patient_ID: parseInt(appointmentData.Patient_ID || appointmentData.patient_id),
        appointment_date: appointmentData.appointment_date,
        query_type: appointmentData.query_type || 'Consulta general',
        is_orthodontics: appointmentData.is_orthodontics || false,
        observations: appointmentData.observations || null,
        is_registered: false // Siempre false al crear
      };
      
      // Validar datos requeridos
      if (!normalizedData.Patient_ID || !normalizedData.appointment_date) {
        return res.status(400).json({ 
          success: false, 
          error: 'Paciente y fecha son requeridos' 
        });
      }
      
      // Verificar que el paciente exista
      const { data: patient, error: patientError } = await supabaseAdmin
        .from('patients')
        .select('Patient_ID')
        .eq('Patient_ID', normalizedData.Patient_ID)
        .single();
      
      if (patientError || !patient) {
        return res.status(404).json({ 
          success: false, 
          error: 'Paciente no encontrado' 
        });
      }
      
      // Crear la cita
      const { data: newAppointment, error: createError } = await supabaseAdmin
        .from('clinical_appointments')
        .insert([{
          ...normalizedData,
          state: 'scheduled',
          is_registered: false
        }])
        .select(`
          *,
          patients (
            first_name,
            first_last_name,
            identification
          )
        `)
        .single();
      
      if (createError) throw createError;
      
      res.status(201).json({ 
        success: true, 
        message: 'Cita creada exitosamente',
        data: newAppointment 
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
      
      // No permitir editar si ya está registrada como procedimiento
      if (existingAppointment.is_registered && appointmentData.state !== 'cancelled') {
        return res.status(400).json({ 
          success: false, 
          error: 'No se puede editar una cita que ya ha sido registrada como procedimiento' 
        });
      }
      
      const { data, error } = await supabaseAdmin
        .from('clinical_appointments')
        .update(appointmentData)
        .eq('appointment_ID', id)
        .select()
        .single();
      
      if (error) throw error;
      
      res.json({ 
        success: true, 
        message: 'Cita actualizada exitosamente',
        data 
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
      
      // Validar que haya al menos un método de pago
      if (!procedureData.payment_method_cordobas && !procedureData.payment_method_dollars) {
        return res.status(400).json({ 
          success: false, 
          error: 'Debe especificar al menos un método de pago' 
        });
      }
      
      // Preparar datos para insertar
      const procedureToInsert = {
        appointment_ID: id,
        Patient_ID: appointment.Patient_ID,
        procedure_date: appointment.appointment_date,
        procedure_description: procedureData.procedure_description,
        total_cost: procedureData.total_cost || 0,
        total_cost_USD: procedureData.total_cost_USD || 0,
        total_procedure: procedureData.total_procedure || 0,
        payment_method: procedureData.payment_method || 'Mixto',
        is_orthodontics: appointment.is_orthodontics,
        observations: procedureData.observations || appointment.observations,
        creation_date: new Date().toISOString(),
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
      
      res.json({ 
        success: true, 
        message: appointment.is_orthodontics ? 
          'Tratamiento de ortodoncia registrado exitosamente' : 
          'Procedimiento registrado exitosamente',
        data: {
          appointment: {
            ...updatedAppointment,
            is_registered: true
          },
          procedure
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
      
      res.json({ 
        success: true, 
        message: 'Cita eliminada exitosamente',
        data 
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
      const startDate = `${date}T00:00:00`;
      const endDate = `${date}T23:59:59`;
      
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
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .order('appointment_date', { ascending: true });
      
      if (error) throw error;
      
      const transformedData = data.map(item => ({
        ...item,
        patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
        patient_phone: item.patients?.number_phone,
        is_registered: item.is_registered || false
      }));
      
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
      
      const transformedData = data.map(item => ({
        ...item,
        is_registered: item.is_registered || false
      }));
      
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