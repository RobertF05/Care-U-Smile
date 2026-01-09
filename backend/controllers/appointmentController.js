// appointmentController.js
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
        isOrthodontics
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
        query = query.eq('Patient_ID', patientId); // <-- MAYÚSCULA
      }
      
      if (isOrthodontics !== undefined) {
        query = query.eq('is_orthodontics', isOrthodontics === 'true');
      }
      
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      // Transformar datos
      const transformedData = data.map(item => ({
        ...item,
        patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
        patient_identification: item.patients?.identification,
        patient_phone: item.patients?.number_phone
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

  // Obtener cita por ID - USANDO appointment_ID (MAYÚSCULA)
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
        .eq('appointment_ID', id) // <-- MAYÚSCULA
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
        patient_email: data.patients?.email
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
        Patient_ID: parseInt(appointmentData.Patient_ID || appointmentData.patient_id), // <-- MAYÚSCULA
        appointment_date: appointmentData.appointment_date,
        query_type: appointmentData.query_type || 'Consulta general',
        is_orthodontics: appointmentData.is_orthodontics || false,
        observations: appointmentData.observations || null
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
        .select('Patient_ID') // <-- MAYÚSCULA
        .eq('Patient_ID', normalizedData.Patient_ID) // <-- MAYÚSCULA
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
          state: 'scheduled'
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

  // Actualizar cita - USANDO appointment_ID (MAYÚSCULA)
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const appointmentData = req.body;
      
      // Verificar que la cita exista
      const { data: existingAppointment, error: checkError } = await supabaseAdmin
        .from('clinical_appointments')
        .select('appointment_ID') // <-- MAYÚSCULA
        .eq('appointment_ID', id) // <-- MAYÚSCULA
        .single();
      
      if (checkError || !existingAppointment) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cita no encontrada' 
        });
      }
      
      const { data, error } = await supabaseAdmin
        .from('clinical_appointments')
        .update(appointmentData)
        .eq('appointment_ID', id) // <-- MAYÚSCULA
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
        .eq('appointment_ID', id) // <-- MAYÚSCULA
        .single();
      
      if (appointmentError || !appointment) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cita no encontrada' 
        });
      }
      
      // Validar que la cita esté completada
      if (appointment.state !== 'completed') {
        return res.status(400).json({ 
          success: false, 
          error: 'Solo se pueden convertir citas completadas en procedimientos' 
        });
      }
      
      // Validar datos del procedimiento
      if (!procedureData.procedure_description || !procedureData.total_cost || !procedureData.payment_method) {
        return res.status(400).json({ 
          success: false, 
          error: 'Descripción, costo y forma de pago son requeridos' 
        });
      }
      
      // 2. Crear el procedimiento
      const { data: procedure, error: procedureError } = await supabaseAdmin
        .from('procedures')
        .insert([{
          appointment_ID: id,
          Patient_ID: appointment.Patient_ID, // <-- MAYÚSCULA
          procedure_date: appointment.appointment_date,
          procedure_description: procedureData.procedure_description,
          total_cost: parseFloat(procedureData.total_cost),
          payment_method: procedureData.payment_method,
          is_orthodontics: appointment.is_orthodontics,
          observations: procedureData.observations || appointment.observations,
          creation_date: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (procedureError) throw procedureError;
      
      res.json({ 
        success: true, 
        message: appointment.is_orthodontics ? 
          'Tratamiento de ortodoncia registrado exitosamente' : 
          'Procedimiento registrado exitosamente',
        data: {
          appointment,
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

  // Eliminar cita - USANDO appointment_ID (MAYÚSCULA)
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que la cita exista
      const { data: existingAppointment, error: checkError } = await supabaseAdmin
        .from('clinical_appointments')
        .select('appointment_ID') // <-- MAYÚSCULA
        .eq('appointment_ID', id) // <-- MAYÚSCULA
        .single();
      
      if (checkError || !existingAppointment) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cita no encontrada' 
        });
      }
      
      const { data, error } = await supabaseAdmin
        .from('clinical_appointments')
        .delete()
        .eq('appointment_ID', id) // <-- MAYÚSCULA
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
        patient_phone: item.patients?.number_phone
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

  // Obtener citas por paciente - USANDO Patient_ID (MAYÚSCULA)
  getByPatientId: async (req, res) => {
    try {
      const { patientId } = req.params;
      
      const { data, error } = await supabaseAdmin
        .from('clinical_appointments')
        .select('*')
        .eq('Patient_ID', patientId) // <-- MAYÚSCULA
        .order('appointment_date', { ascending: false });
      
      if (error) throw error;
      
      res.json({ 
        success: true, 
        data: data || [] 
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
  }
};

export default appointmentController;