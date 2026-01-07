import { supabaseAdmin } from '../config/supabase.js';

const Patient = {
  // Obtener todos los pacientes
  async getAll(page = 1, limit = 20, search = '') {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    let query = supabaseAdmin
      .from('patients')
      .select('*', { count: 'exact' })
      .order('creation_date', { ascending: false });
    
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,first_last_name.ilike.%${search}%,identification.ilike.%${search}%`);
    }
    
    query = query.range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    return {
      data,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  },

  // Obtener paciente por ID
  async getById(id) {
    const { data, error } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('Patient_ID', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Crear paciente
  async create(patientData) {
    const { data, error } = await supabaseAdmin
      .from('patients')
      .insert([{
        ...patientData,
        creation_date: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Actualizar paciente
  async update(id, patientData) {
    const { data, error } = await supabaseAdmin
      .from('patients')
      .update(patientData)
      .eq('Patient_ID', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Eliminar paciente
  async delete(id) {
    const { data, error } = await supabaseAdmin
      .from('patients')
      .delete()
      .eq('Patient_ID', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Buscar por cédula
  async findByIdentification(identification) {
    const { data, error } = await supabaseAdmin
      .from('patients')
      .select('*')
      .eq('identification', identification)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Contar pacientes totales
  async count() {
    const { count, error } = await supabaseAdmin
      .from('patients')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count;
  }
};

export default Patient;