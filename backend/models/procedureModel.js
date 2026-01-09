// procedureModel.js - Versión actualizada
import { supabaseAdmin } from '../config/supabase.js';

const Procedure = {
  // Obtener procedimientos regulares (NO ortodoncia)
  async getAllNormal(page = 1, limit = 20, filters = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    let query = supabaseAdmin
      .from('procedures')
      .select(`
        *,
        patients (
          first_name,
          first_last_name,
          identification
        ),
        clinical_appointments (
          query_type,
          appointment_date
        )
      `, { count: 'exact' })
      .eq('is_orthodontics', false) // Solo procedimientos regulares
      .order('procedure_date', { ascending: false });
    
    // Aplicar filtros
    if (filters.startDate) {
      query = query.gte('procedure_date', filters.startDate);
    }
    
    if (filters.endDate) {
      query = query.lte('procedure_date', filters.endDate);
    }
    
    if (filters.patientId) {
      query = query.eq('Patient_ID', filters.patientId);
    }
    
    query = query.range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    // Transformar datos
    const transformedData = data.map(item => ({
      ...item,
      patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
      patient_identification: item.patients?.identification,
      original_query_type: item.clinical_appointments?.query_type,
      original_appointment_date: item.clinical_appointments?.appointment_date
    }));
    
    return {
      data: transformedData,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  },

  // Obtener procedimientos de ortodoncia
  async getAllOrthodontics(page = 1, limit = 20, filters = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    let query = supabaseAdmin
      .from('procedures')
      .select(`
        *,
        patients (
          first_name,
          first_last_name,
          identification
        ),
        clinical_appointments (
          query_type,
          appointment_date
        )
      `, { count: 'exact' })
      .eq('is_orthodontics', true) // Solo ortodoncia
      .order('procedure_date', { ascending: false });
    
    // Aplicar filtros
    if (filters.startDate) {
      query = query.gte('procedure_date', filters.startDate);
    }
    
    if (filters.endDate) {
      query = query.lte('procedure_date', filters.endDate);
    }
    
    if (filters.patientId) {
      query = query.eq('Patient_ID', filters.patientId);
    }
    
    query = query.range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    // Transformar datos y calcular ganancias
    const transformedData = data.map(item => {
      const clinic_income = item.total_cost * 0.4;
      const doctor_income = item.total_cost * 0.6;
      
      return {
        ...item,
        patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
        patient_identification: item.patients?.identification,
        original_query_type: item.clinical_appointments?.query_type,
        original_appointment_date: item.clinical_appointments?.appointment_date,
        clinic_income,
        doctor_income
      };
    });
    
    return {
      data: transformedData,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  },

  // Obtener procedimiento por ID
  async getById(id) {
    const { data, error } = await supabaseAdmin
      .from('procedures')
      .select(`
        *,
        patients (
          first_name,
          first_last_name,
          identification,
          number_phone
        ),
        clinical_appointments (
          query_type,
          appointment_date,
          observations as appointment_observations
        )
      `)
      .eq('procedure_id', id)
      .single();
    
    if (error) throw error;
    
    // Calcular ingresos si es ortodoncia
    const clinic_income = data.is_orthodontics ? data.total_cost * 0.4 : data.total_cost;
    const doctor_income = data.is_orthodontics ? data.total_cost * 0.6 : 0;
    
    return {
      ...data,
      patient_name: `${data.patients?.first_name || ''} ${data.patients?.first_last_name || ''}`.trim(),
      patient_identification: data.patients?.identification,
      patient_phone: data.patients?.number_phone,
      clinic_income,
      doctor_income,
      original_query_type: data.clinical_appointments?.query_type,
      original_appointment_date: data.clinical_appointments?.appointment_date
    };
  },

  // Crear procedimiento directamente (sin cita)
  async create(procedureData) {
    const { data, error } = await supabaseAdmin
      .from('procedures')
      .insert([{
        ...procedureData,
        creation_date: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    // Calcular ingresos para respuesta
    const clinic_income = data.is_orthodontics ? data.total_cost * 0.4 : data.total_cost;
    const doctor_income = data.is_orthodontics ? data.total_cost * 0.6 : 0;
    
    return {
      ...data,
      clinic_income,
      doctor_income
    };
  },

  // Actualizar procedimiento
  async update(id, procedureData) {
    const { data, error } = await supabaseAdmin
      .from('procedures')
      .update(procedureData)
      .eq('procedure_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Eliminar procedimiento
  async delete(id) {
    const { data, error } = await supabaseAdmin
      .from('procedures')
      .delete()
      .eq('procedure_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Obtener por paciente
  async getByPatientId(patientId) {
    const { data, error } = await supabaseAdmin
      .from('procedures')
      .select('*')
      .eq('Patient_ID', patientId)
      .order('procedure_date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Estadísticas de ingresos
  async getIncomeStats(startDate, endDate) {
    // Obtener todos los procedimientos en el período
    const { data, error } = await supabaseAdmin
      .from('procedures')
      .select('total_cost, is_orthodontics')
      .gte('procedure_date', startDate)
      .lte('procedure_date', endDate);
    
    if (error) throw error;
    
    let totalGeneral = 0;
    let totalOrtho = 0;
    let orthoCount = 0;
    let generalCount = 0;
    
    data.forEach(proc => {
      if (proc.is_orthodontics) {
        totalOrtho += proc.total_cost;
        orthoCount++;
      } else {
        totalGeneral += proc.total_cost;
        generalCount++;
      }
    });
    
    return {
      total_income: totalGeneral + totalOrtho,
      clinic_income: totalGeneral + (totalOrtho * 0.4),
      doctor_income: totalOrtho * 0.6,
      total_procedures: data.length,
      orthodontics_count: orthoCount,
      general_count: generalCount
    };
  },

  // Contar procedimientos totales
  async count() {
    const { count, error } = await supabaseAdmin
      .from('procedures')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count;
  }
};

export default Procedure;