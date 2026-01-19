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
      .eq('is_orthodontics', false)
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
      .eq('is_orthodontics', true)
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
      const clinic_income = item.total_cost * (item.clinic_payment_percentage || 40) / 100;
      const doctor_income = item.total_cost * (item.doctor_payment_percentage || 60) / 100;
      
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
    
    // Calcular ingresos basados en porcentajes
    const clinicPercentage = data.is_orthodontics ? (data.clinic_payment_percentage || 40) : 100;
    const doctorPercentage = data.is_orthodontics ? (data.doctor_payment_percentage || 60) : 0;
    
    const clinic_income = data.total_cost * clinicPercentage / 100;
    const doctor_income = data.total_cost * doctorPercentage / 100;
    
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
    const clinicPercentage = data.is_orthodontics ? (data.clinic_payment_percentage || 40) : 100;
    const doctorPercentage = data.is_orthodontics ? (data.doctor_payment_percentage || 60) : 0;
    
    const clinic_income = data.total_cost * clinicPercentage / 100;
    const doctor_income = data.total_cost * doctorPercentage / 100;
    
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

  // Obtener estadísticas de ingresos
  async getIncomeStats(startDate, endDate) {
    // Primero obtener la configuración actual de porcentajes
    const { data: settingsData } = await supabaseAdmin
      .from('settings')
      .select('*')
      .order('setting_ID', { ascending: false })
      .limit(1)
      .single();
    
    const clinicPercentage = settingsData?.clinic_payment || 40;
    const doctorPercentage = settingsData?.doctor_payment || 60;
    
    // Obtener todos los procedimientos del período
    const { data, error } = await supabaseAdmin
      .from('procedures')
      .select('total_cost, is_orthodontics, clinic_payment_percentage, doctor_payment_percentage')
      .gte('procedure_date', startDate)
      .lte('procedure_date', endDate);
    
    if (error) throw error;
    
    let generalIncome = 0;
    let clinicOrthodonticIncome = 0;
    let doctorOrthodonticIncome = 0;
    let totalOrthodontic = 0;
    
    data.forEach(procedure => {
      const cost = procedure.total_cost || 0;
      
      if (procedure.is_orthodontics) {
        // Usar porcentajes específicos del procedimiento o los globales
        const procClinicPercentage = procedure.clinic_payment_percentage || clinicPercentage;
        const procDoctorPercentage = procedure.doctor_payment_percentage || doctorPercentage;
        
        clinicOrthodonticIncome += cost * procClinicPercentage / 100;
        doctorOrthodonticIncome += cost * procDoctorPercentage / 100;
        totalOrthodontic += cost;
      } else {
        // Procedimientos generales: 100% clínica
        generalIncome += cost;
      }
    });
    
    const clinicIncome = generalIncome + clinicOrthodonticIncome;
    
    return {
      general_income: generalIncome,
      clinic_income: clinicIncome,
      doctor_income: doctorOrthodonticIncome,
      total_orthodontic: totalOrthodontic,
      total_all_procedures: generalIncome + totalOrthodontic
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