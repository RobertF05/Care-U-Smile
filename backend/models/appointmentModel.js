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
      query = query.eq('patient_id', filters.patientId);
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
      .eq('appointment_id', id)
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      patient_name: `${data.patients?.first_name || ''} ${data.patients?.first_last_name || ''}`.trim(),
      patient_identification: data.patients?.identification,
      patient_phone: data.patients?.number_phone,
      patient_email: data.patients?.email
    };
  },

  // Crear cita
  async create(appointmentData) {
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .insert([appointmentData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Actualizar cita
  async update(id, appointmentData) {
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .update(appointmentData)
      .eq('appointment_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Eliminar cita
  async delete(id) {
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .delete()
      .eq('appointment_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
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
      patient_phone: item.patients?.number_phone
    }));
  },

  // Obtener citas por paciente
  async getByPatientId(patientId) {
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .select('*')
      .eq('patient_id', patientId)
      .order('appointment_date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Contar citas por estado
  async countByState(state) {
    const { count, error } = await supabaseAdmin
      .from('clinical_appointments')
      .select('*', { count: 'exact', head: true })
      .eq('state', state);
    
    if (error) throw error;
    return count;
  }
};

export default Appointment;