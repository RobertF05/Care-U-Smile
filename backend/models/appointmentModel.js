import { supabaseAdmin } from '../config/supabase.js';

const Appointment = {
  // Obtener todas las citas
  async getAll(page = 1, limit = 20, filters = {}) {
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
    if (filters.startDate) {
      query = query.gte('appointment_date', filters.startDate);
    }
    
    if (filters.endDate) {
      query = query.lte('appointment_date', filters.endDate);
    }
    
    if (filters.state) {
      query = query.eq('state', filters.state);
    }
    
    if (filters.patientId) {
      query = query.eq('Patient_ID', filters.patientId);
    }
    
    if (filters.isOrthodontics !== undefined) {
      query = query.eq('is_orthodontics', filters.isOrthodontics);
    }
    
    if (filters.isRegistered !== undefined) {
      query = query.eq('is_registered', filters.isRegistered);
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
    
    return {
      data: transformedData,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  },

  // Obtener cita por ID
  async getById(id) {
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
    
    return {
      ...data,
      patient_name: `${data.patients?.first_name || ''} ${data.patients?.first_last_name || ''}`.trim(),
      patient_identification: data.patients?.identification,
      patient_phone: data.patients?.number_phone,
      patient_email: data.patients?.email,
      is_registered: data.is_registered || false
    };
  },

  // Crear cita
  async create(appointmentData) {
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .insert([{
        ...appointmentData,
        state: 'scheduled',
        is_registered: false // Por defecto no registrada
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
    
    if (error) throw error;
    return {
      ...data,
      is_registered: data.is_registered || false
    };
  },

  // Actualizar cita
  async update(id, appointmentData) {
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .update(appointmentData)
      .eq('appointment_ID', id)
      .select()
      .single();
    
    if (error) throw error;
    return {
      ...data,
      is_registered: data.is_registered || false
    };
  },

  // Eliminar cita
  async delete(id) {
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .delete()
      .eq('appointment_ID', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Convertir cita en procedimiento
  async convertToProcedure(appointmentId, procedureData) {
    // 1. Obtener la cita
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from('clinical_appointments')
      .select('*')
      .eq('appointment_ID', appointmentId)
      .single();
    
    if (appointmentError) throw appointmentError;
    
    // Verificar si ya está registrada
    if (appointment.is_registered) {
      throw new Error('Esta cita ya ha sido registrada como procedimiento');
    }
    
    // 2. Crear el procedimiento
    const { data: procedure, error: procedureError } = await supabaseAdmin
      .from('procedures')
      .insert([{
        appointment_ID: appointmentId,
        Patient_ID: appointment.Patient_ID,
        procedure_date: appointment.appointment_date,
        procedure_description: procedureData.procedure_description,
        total_cost: procedureData.total_cost,
        payment_method: procedureData.payment_method,
        is_orthodontics: appointment.is_orthodontics,
        observations: procedureData.observations || appointment.observations,
        creation_date: new Date().toISOString(),
        // Campos adicionales
        total_cost_USD: procedureData.total_cost_USD || 0,
        total_procedure: procedureData.total_procedure || 0,
        amount_cordobas: procedureData.amount_cordobas || 0,
        amount_dollars: procedureData.amount_dollars || 0,
        payment_method_cordobas: procedureData.payment_method_cordobas,
        payment_method_dollars: procedureData.payment_method_dollars,
        external_doctor: procedureData.external_doctor,
        external_doctor_payment: procedureData.external_doctor_payment,
        theres_external_doctor: procedureData.theres_external_doctor || false,
        external_doctor_name: procedureData.external_doctor_name,
        external_doctor_specialty: procedureData.external_doctor_specialty,
        external_doctor_payment_type: procedureData.external_doctor_payment_type,
        external_doctor_payment_value: procedureData.external_doctor_payment_value,
        external_doctor_payment_currency: procedureData.external_doctor_payment_currency,
        clinic_payment_percentage: procedureData.clinic_payment_percentage,
        doctor_payment_percentage: procedureData.doctor_payment_percentage
      }])
      .select()
      .single();
    
    if (procedureError) throw procedureError;
    
    // 3. Actualizar estado de la cita a "completed" y marcar como registrada
    const { data: updatedAppointment, error: updateError } = await supabaseAdmin
      .from('clinical_appointments')
      .update({ 
        state: 'completed',
        is_registered: true 
      })
      .eq('appointment_ID', appointmentId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    return {
      appointment: {
        ...updatedAppointment,
        is_registered: true
      },
      procedure
    };
  },

  // Obtener citas por fecha
  async getByDate(date) {
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
    
    return data.map(item => ({
      ...item,
      patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
      patient_phone: item.patients?.number_phone,
      is_registered: item.is_registered || false
    }));
  },

  // Obtener citas por paciente
  async getByPatientId(patientId) {
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .select('*')
      .eq('Patient_ID', patientId)
      .order('appointment_date', { ascending: false });
    
    if (error) throw error;
    return data.map(item => ({
      ...item,
      is_registered: item.is_registered || false
    }));
  },

  // Contar citas por estado
  async countByState(state) {
    const { count, error } = await supabaseAdmin
      .from('clinical_appointments')
      .select('*', { count: 'exact', head: true })
      .eq('state', state);
    
    if (error) throw error;
    return count;
  },

  // Contar citas registradas
  async countRegistered() {
    const { count, error } = await supabaseAdmin
      .from('clinical_appointments')
      .select('*', { count: 'exact', head: true })
      .eq('is_registered', true);
    
    if (error) throw error;
    return count;
  },

  // Contar citas no registradas
  async countUnregistered() {
    const { count, error } = await supabaseAdmin
      .from('clinical_appointments')
      .select('*', { count: 'exact', head: true })
      .eq('is_registered', false);
    
    if (error) throw error;
    return count;
  }
};

export default Appointment;