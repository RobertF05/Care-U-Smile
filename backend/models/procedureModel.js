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
      .select('total_procedure, total_cost, clinic_payment_percentage, doctor_payment_percentage')
      .eq('is_orthodontics', isOrthodontics)
      .gte('procedure_date', start)
      .lte('procedure_date', end);

    const { data, error } = await query;
    
    if (error) throw error;
    
    let totalIncome = 0;
    let clinicIncome = 0;
    let doctorIncome = 0;
    
    (data || []).forEach(procedure => {
      const amount = procedure.total_procedure || procedure.total_cost || 0;
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
        total_procedure,
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
      total_amount: unclosed.reduce((sum, p) => sum + (p.total_procedure || p.total_cost || 0), 0)
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
      const total = item.total_procedure || item.total_cost || 0;
      const clinicPercentage = item.clinic_payment_percentage || 40;
      const doctorPercentage = item.doctor_payment_percentage || 60;
      
      const clinic_income = total * (clinicPercentage / 100);
      const doctor_income = total * (doctorPercentage / 100);
      
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
        doctor_income,
        total_procedure: total // Asegurar que total_procedure esté presente
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
    
    const total = data.total_procedure || data.total_cost || 0;
    const clinicPercentage = data.is_orthodontics ? (data.clinic_payment_percentage || 40) : 100;
    const doctorPercentage = data.is_orthodontics ? (data.doctor_payment_percentage || 60) : 0;
    
    const clinic_income = total * clinicPercentage / 100;
    const doctor_income = total * doctorPercentage / 100;
    
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
    
    const total = data.total_procedure || data.total_cost || 0;
    const clinicPercentage = data.is_orthodontics ? (data.clinic_payment_percentage || 40) : 100;
    const doctorPercentage = data.is_orthodontics ? (data.doctor_payment_percentage || 60) : 0;
    
    const clinic_income = total * clinicPercentage / 100;
    const doctor_income = total * doctorPercentage / 100;
    
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

  // Obtener estadísticas de ingresos con fechas Nicaragua - VERSIÓN CORREGIDA
  async getIncomeStats(startDate, endDate) {
    console.log('🔍 Obteniendo estadísticas de ingresos para:', { startDate, endDate });
    
    // SOLO usar columnas que EXISTEN en la tabla
    const { data: procedures, error } = await supabaseAdmin
      .from('procedures')
      .select('total_procedure, total_cost_USD, is_orthodontics, clinic_payment_percentage, doctor_payment_percentage, amount_cordobas, amount_dollars')
      .gte('procedure_date', startDate)
      .lte('procedure_date', endDate);
    
    if (error) {
      console.error('❌ Error al obtener procedimientos:', error);
      throw error;
    }
    
    console.log(`📊 ${procedures.length} procedimientos encontrados`);
    
    let general_income = 0;
    let clinic_orthodontic_income = 0;
    let doctor_orthodontic_income = 0;
    
    // Calcular en ambas monedas
    let general_income_cordobas = 0;
    let general_income_dollars = 0;
    let clinic_orthodontic_income_cordobas = 0;
    let clinic_orthodontic_income_dollars = 0;
    let doctor_orthodontic_income_cordobas = 0;
    let doctor_orthodontic_income_dollars = 0;
    
    procedures.forEach(procedure => {
      // Usar total_procedure que SÍ existe (columna correcta)
      const total = procedure.total_procedure || 0;
      const cordobas = procedure.amount_cordobas || 0;
      const dollars = procedure.amount_dollars || 0;
      
      if (procedure.is_orthodontics) {
        const clinicPercentage = procedure.clinic_payment_percentage || 40;
        const doctorPercentage = procedure.doctor_payment_percentage || 60;
        
        clinic_orthodontic_income += total * (clinicPercentage / 100);
        doctor_orthodontic_income += total * (doctorPercentage / 100);
        
        // Calcular en ambas monedas
        clinic_orthodontic_income_cordobas += cordobas * (clinicPercentage / 100);
        clinic_orthodontic_income_dollars += dollars * (clinicPercentage / 100);
        doctor_orthodontic_income_cordobas += cordobas * (doctorPercentage / 100);
        doctor_orthodontic_income_dollars += dollars * (doctorPercentage / 100);
      } else {
        general_income += total;
        general_income_cordobas += cordobas;
        general_income_dollars += dollars;
      }
    });
    
    // Calcular ingresos totales de la clínica
    const clinic_income = general_income + clinic_orthodontic_income;
    const clinic_income_cordobas = general_income_cordobas + clinic_orthodontic_income_cordobas;
    const clinic_income_dollars = general_income_dollars + clinic_orthodontic_income_dollars;
    
    console.log('💰 Estadísticas calculadas:', {
      general_income,
      clinic_orthodontic_income,
      doctor_orthodontic_income,
      clinic_income,
      total_procedures: procedures.length
    });
    
    return {
      general_income,
      clinic_orthodontic_income,
      doctor_orthodontic_income,
      clinic_income,
      
      // Valores en ambas monedas (opcional, para mostrar en frontend)
      general_income_cordobas,
      general_income_dollars,
      clinic_orthodontic_income_cordobas,
      clinic_orthodontic_income_dollars,
      doctor_orthodontic_income_cordobas,
      doctor_orthodontic_income_dollars,
      clinic_income_cordobas,
      clinic_income_dollars,
      
      total_procedures: procedures.length,
      orthodontics_count: procedures.filter(p => p.is_orthodontics).length,
      general_count: procedures.filter(p => !p.is_orthodontics).length
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