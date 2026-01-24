// models/procedureModel.js
import { supabaseAdmin } from '../config/supabase.js';
import { 
  toUTCFromNicaragua,
  toNicaraguaTime,
  formatNicaraguaDateTime,
  formatNicaraguaDate,
  createNicaraguaDateRange,
  convertDateStringToUTCStart,
  convertDateStringToUTCEnd
} from '../utils/timezoneUtils.js';

const Procedure = {
  // Obtener estadísticas de ingresos por día (Nicaragua)
  async getDailyIncomeStats(date, isOrthodontics = false) {
    const { start, end } = createNicaraguaDateRange(date);
    
    let query = supabaseAdmin
      .from('procedures')
      .select('total_cost, total_procedure, clinic_payment_percentage, doctor_payment_percentage')
      .eq('is_orthodontics', isOrthodontics)
      .gte('procedure_date', start)
      .lte('procedure_date', end);

    const { data, error } = await query;
    
    if (error) throw error;
    
    let totalIncome = 0;
    let clinicIncome = 0;
    let doctorIncome = 0;
    
    (data || []).forEach(procedure => {
      const amount = procedure.total_cost || procedure.total_procedure || 0;
      totalIncome += amount;
      
      if (isOrthodontics) {
        const clinicPercentage = procedure.clinic_payment_percentage || 40;
        const doctorPercentage = procedure.doctor_payment_percentage || 60;
        
        clinicIncome += amount * (clinicPercentage / 100);
        doctorIncome += amount * (doctorPercentage / 100);
      } else {
        clinicIncome += amount;
      }
    });
    
    return {
      total_income: totalIncome,
      clinic_income: clinicIncome,
      doctor_income: doctorIncome,
      procedure_count: data?.length || 0,
      fecha_nicaragua: date
    };
  },

  // Obtener procedimientos no incluidos en cierres diarios
  async getUnclosedProcedures(startDate, endDate, closingType = 'general') {
    const isOrthodontics = closingType === 'orthodontics';
    const startUTC = convertDateStringToUTCStart(startDate);
    const endUTC = convertDateStringToUTCEnd(endDate);
    
    let query = supabaseAdmin
      .from('procedures')
      .select(`
        procedure_ID,
        procedure_date,
        total_cost,
        is_orthodontics,
        patients (first_name, first_last_name)
      `)
      .eq('is_orthodontics', isOrthodontics)
      .gte('procedure_date', startUTC)
      .lte('procedure_date', endUTC)
      .order('procedure_date', { ascending: false });

    const { data: procedures, error } = await query;
    
    if (error) throw error;
    
    const { data: closedProcedures } = await supabaseAdmin
      .from('procedure_daily_closings')
      .select('procedure_id')
      .in('procedure_id', procedures.map(p => p.procedure_ID));
    
    const closedIds = new Set(closedProcedures?.map(cp => cp.procedure_id) || []);
    const unclosed = procedures.filter(p => !closedIds.has(p.procedure_ID));
    
    // Convertir fechas a Nicaragua para mostrar
    const unclosedWithNicaraguaTime = unclosed.map(p => ({
      ...p,
      procedure_date_display: formatNicaraguaDateTime(p.procedure_date),
      procedure_date_utc: p.procedure_date
    }));
    
    return {
      procedures: unclosedWithNicaraguaTime,
      total_count: unclosed.length,
      total_amount: unclosed.reduce((sum, p) => sum + (p.total_cost || 0), 0)
    };
  },

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
    
    // Aplicar filtros con conversión de zona horaria
    if (filters.startDate) {
      const startUTC = convertDateStringToUTCStart(filters.startDate);
      query = query.gte('procedure_date', startUTC);
    }
    
    if (filters.endDate) {
      const endUTC = convertDateStringToUTCEnd(filters.endDate);
      query = query.lte('procedure_date', endUTC);
    }
    
    if (filters.patientId) {
      query = query.eq('Patient_ID', filters.patientId);
    }
    
    query = query.range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    // Transformar datos y convertir fechas
    const transformedData = data.map(item => ({
      ...item,
      procedure_date: formatNicaraguaDateTime(item.procedure_date),
      procedure_date_utc: item.procedure_date,
      creation_date: formatNicaraguaDateTime(item.creation_date),
      patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
      patient_identification: item.patients?.identification,
      original_query_type: item.clinical_appointments?.query_type,
      original_appointment_date: item.clinical_appointments?.appointment_date ? 
        formatNicaraguaDateTime(item.clinical_appointments.appointment_date) : null
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
    
    // Aplicar filtros con conversión de zona horaria
    if (filters.startDate) {
      const startUTC = convertDateStringToUTCStart(filters.startDate);
      query = query.gte('procedure_date', startUTC);
    }
    
    if (filters.endDate) {
      const endUTC = convertDateStringToUTCEnd(filters.endDate);
      query = query.lte('procedure_date', endUTC);
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
        procedure_date: formatNicaraguaDateTime(item.procedure_date),
        procedure_date_utc: item.procedure_date,
        creation_date: formatNicaraguaDateTime(item.creation_date),
        patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
        patient_identification: item.patients?.identification,
        original_query_type: item.clinical_appointments?.query_type,
        original_appointment_date: item.clinical_appointments?.appointment_date ? 
          formatNicaraguaDateTime(item.clinical_appointments.appointment_date) : null,
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
    
    const clinicPercentage = data.is_orthodontics ? (data.clinic_payment_percentage || 40) : 100;
    const doctorPercentage = data.is_orthodontics ? (data.doctor_payment_percentage || 60) : 0;
    
    const clinic_income = data.total_cost * clinicPercentage / 100;
    const doctor_income = data.total_cost * doctorPercentage / 100;
    
    return {
      ...data,
      procedure_date: formatNicaraguaDateTime(data.procedure_date),
      procedure_date_utc: data.procedure_date,
      creation_date: formatNicaraguaDateTime(data.creation_date),
      patient_name: `${data.patients?.first_name || ''} ${data.patients?.first_last_name || ''}`.trim(),
      patient_identification: data.patients?.identification,
      patient_phone: data.patients?.number_phone,
      clinic_income,
      doctor_income,
      original_query_type: data.clinical_appointments?.query_type,
      original_appointment_date: data.clinical_appointments?.appointment_date ? 
        formatNicaraguaDateTime(data.clinical_appointments.appointment_date) : null
    };
  },

  // Crear procedimiento directamente (convierte hora Nicaragua a UTC)
  async create(procedureData) {
    // Convertir fecha a UTC si se proporciona
    const procedureWithUTC = {
      ...procedureData,
      procedure_date: procedureData.procedure_date ? 
        toUTCFromNicaragua(procedureData.procedure_date).toISOString() : 
        new Date().toISOString(),
      creation_date: new Date().toISOString()
    };
    
    console.log('Creando procedimiento:', {
      fechaOriginal: procedureData.procedure_date,
      fechaUTC: procedureWithUTC.procedure_date
    });
    
    const { data, error } = await supabaseAdmin
      .from('procedures')
      .insert([procedureWithUTC])
      .select()
      .single();
    
    if (error) throw error;
    
    const clinicPercentage = data.is_orthodontics ? (data.clinic_payment_percentage || 40) : 100;
    const doctorPercentage = data.is_orthodontics ? (data.doctor_payment_percentage || 60) : 0;
    
    const clinic_income = data.total_cost * clinicPercentage / 100;
    const doctor_income = data.total_cost * doctorPercentage / 100;
    
    return {
      ...data,
      procedure_date: formatNicaraguaDateTime(data.procedure_date),
      procedure_date_utc: data.procedure_date,
      creation_date: formatNicaraguaDateTime(data.creation_date),
      clinic_income,
      doctor_income
    };
  },

  // Actualizar procedimiento
  async update(id, procedureData) {
    // Si se actualiza la fecha, convertir a UTC
    const updateData = { ...procedureData };
    if (updateData.procedure_date) {
      updateData.procedure_date = toUTCFromNicaragua(updateData.procedure_date).toISOString();
    }
    
    const { data, error } = await supabaseAdmin
      .from('procedures')
      .update(updateData)
      .eq('procedure_id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      procedure_date: formatNicaraguaDateTime(data.procedure_date),
      procedure_date_utc: data.procedure_date
    };
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
    
    return data.map(item => ({
      ...item,
      procedure_date: formatNicaraguaDateTime(item.procedure_date),
      procedure_date_utc: item.procedure_date,
      creation_date: formatNicaraguaDateTime(item.creation_date)
    }));
  },

  // Obtener estadísticas de ingresos con fechas Nicaragua
  async getIncomeStats(startDate, endDate) {
    const startUTC = convertDateStringToUTCStart(startDate);
    const endUTC = convertDateStringToUTCEnd(endDate);
    
    console.log('Obteniendo estadísticas de ingresos:', {
      inicioNicaragua: startDate,
      finNicaragua: endDate,
      inicioUTC: startUTC,
      finUTC: endUTC
    });
    
    // Primero obtener la configuración actual
    const { data: settingsData } = await supabaseAdmin
      .from('settings')
      .select('*')
      .order('setting_ID', { ascending: false })
      .limit(1)
      .single();
    
    const clinicPercentage = settingsData?.clinic_payment || 40;
    const doctorPercentage = settingsData?.doctor_payment || 60;
    
    // Obtener procedimientos del período
    const { data, error } = await supabaseAdmin
      .from('procedures')
      .select('total_cost, is_orthodontics, clinic_payment_percentage, doctor_payment_percentage')
      .gte('procedure_date', startUTC)
      .lte('procedure_date', endUTC);
    
    if (error) throw error;
    
    let generalIncome = 0;
    let clinicOrthodonticIncome = 0;
    let doctorOrthodonticIncome = 0;
    let totalOrthodontic = 0;
    
    data.forEach(procedure => {
      const cost = procedure.total_cost || 0;
      
      if (procedure.is_orthodontics) {
        const procClinicPercentage = procedure.clinic_payment_percentage || clinicPercentage;
        const procDoctorPercentage = procedure.doctor_payment_percentage || doctorPercentage;
        
        clinicOrthodonticIncome += cost * procClinicPercentage / 100;
        doctorOrthodonticIncome += cost * procDoctorPercentage / 100;
        totalOrthodontic += cost;
      } else {
        generalIncome += cost;
      }
    });
    
    const clinicIncome = generalIncome + clinicOrthodonticIncome;
    
    return {
      general_income: generalIncome,
      clinic_income: clinicIncome,
      doctor_income: doctorOrthodonticIncome,
      total_orthodontic: totalOrthodontic,
      total_all_procedures: generalIncome + totalOrthodontic,
      periodo_inicio: startDate,
      periodo_fin: endDate
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