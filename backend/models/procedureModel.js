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
  // ============================================
  // FUNCIÓN PARA CALCULAR PAGOS CON LÓGICA COMPLETA
  // ============================================
  calculateProcedurePayments: (procedureData) => {
    console.log('🧮 Calculando pagos para procedimiento:', procedureData);
    
    const {
      is_orthodontics = false,
      total_procedure = 0,
      amount_cordobas = 0,
      amount_dollars = 0,
      exchange_rate_used = 36.67,
      external_doctor = false,
      external_doctor_payment = 0,
      external_doctor_payment_usd = 0,
      external_doctor_payment_type = 'fixed',
      external_doctor_payment_value = 0,
      external_doctor_payment_currency = 'C$',
      clinic_payment_percentage = is_orthodontics ? 40 : 100,
      doctor_payment_percentage = is_orthodontics ? 60 : 0,
      clinic_payment_cordobas = 0,
      clinic_payment_dollars = 0,
      doctor_payment_cordobas = 0,
      doctor_payment_dollars = 0,
      // NUEVOS CAMPOS PARA DIVISIÓN DE ORTODONCIA CON DOCTOR EXTERNO
      ortho_doctor_percentage = is_orthodontics ? 60 : 0,
      external_doctor_percentage = 0,
      external_doctor_split_type = 'from_clinic', // 'from_clinic' o 'from_total'
      ...restData
    } = procedureData;
    
    // Calcular total en córdobas
    const totalInCordobas = total_procedure > 0 ? total_procedure : 
      (amount_cordobas + (amount_dollars * exchange_rate_used));
    
    // Calcular total en dólares
    const totalInDollars = total_procedure > 0 ? 
      (total_procedure / exchange_rate_used) : 
      (amount_dollars + (amount_cordobas / exchange_rate_used));
    
    let calculatedData = {
      ...restData,
      is_orthodontics,
      total_procedure: totalInCordobas,
      total_procedure_usd: totalInDollars,
      amount_cordobas,
      amount_dollars,
      exchange_rate_used,
      external_doctor: !!external_doctor,
      external_doctor_name: external_doctor ? procedureData.external_doctor_name : null,
      external_doctor_specialty: external_doctor ? procedureData.external_doctor_specialty : null,
      external_doctor_payment_type,
      external_doctor_payment_value,
      external_doctor_payment_currency,
      ortho_doctor_percentage: is_orthodontics ? ortho_doctor_percentage : null,
      external_doctor_percentage: external_doctor ? external_doctor_percentage : null,
      external_doctor_split_type: external_doctor ? external_doctor_split_type : null
    };
    
    // VALIDACIONES Y CÁLCULOS PARA ORTODONCIA CON DOCTOR EXTERNO
    if (is_orthodontics && external_doctor) {
      // Si hay doctor externo en ortodoncia, validar los porcentajes
      if (ortho_doctor_percentage + external_doctor_percentage >= 100) {
        throw new Error('La suma de porcentajes para doctora ortodoncista y doctor externo no puede ser 100% o más');
      }
      
      if (ortho_doctor_percentage < 0 || external_doctor_percentage < 0) {
        throw new Error('Los porcentajes no pueden ser negativos');
      }
      
      // Calcular porcentaje restante para la clínica
      const clinic_percentage = 100 - ortho_doctor_percentage - external_doctor_percentage;
      
      if (clinic_percentage <= 0) {
        throw new Error('La clínica debe tener un porcentaje de ganancia mayor a 0');
      }
      
      // Actualizar los porcentajes
      calculatedData.clinic_payment_percentage = clinic_percentage;
      calculatedData.doctor_payment_percentage = ortho_doctor_percentage;
      
      // Calcular pagos según el tipo de división
      if (external_doctor_split_type === 'from_total') {
        // El doctor externo recibe un porcentaje del total
        const external_payment_cordobas = totalInCordobas * (external_doctor_percentage / 100);
        const external_payment_dollars = external_payment_cordobas / exchange_rate_used;
        
        // Calcular pagos para la doctora ortodoncista
        const ortho_payment_cordobas = totalInCordobas * (ortho_doctor_percentage / 100);
        const ortho_payment_dollars = ortho_payment_cordobas / exchange_rate_used;
        
        // Calcular ganancia de la clínica
        const clinic_payment_cordobas = totalInCordobas * (clinic_percentage / 100);
        const clinic_payment_dollars = clinic_payment_cordobas / exchange_rate_used;
        
        // Actualizar todos los pagos
        calculatedData.clinic_payment_cordobas = clinic_payment_cordobas;
        calculatedData.clinic_payment_dollars = clinic_payment_dollars;
        calculatedData.doctor_payment_cordobas = ortho_payment_cordobas;
        calculatedData.doctor_payment_dollars = ortho_payment_dollars;
        calculatedData.external_doctor_payment = external_payment_cordobas;
        calculatedData.external_doctor_payment_usd = external_payment_dollars;
        
      } else if (external_doctor_split_type === 'from_clinic') {
        // El doctor externo recibe un porcentaje de la parte de la clínica
        
        // Primero, calcular pago de la doctora ortodoncista
        const ortho_payment_cordobas = totalInCordobas * (ortho_doctor_percentage / 100);
        const ortho_payment_dollars = ortho_payment_cordobas / exchange_rate_used;
        
        // Lo que queda es para la clínica (antes de doctor externo)
        const clinic_portion_before_external = totalInCordobas * (clinic_percentage / 100);
        
        // El doctor externo recibe un porcentaje de la parte de la clínica
        const external_payment_cordobas = clinic_portion_before_external * (external_doctor_percentage / 100);
        const external_payment_dollars = external_payment_cordobas / exchange_rate_used;
        
        // Ganancia final de la clínica (después de pagar al doctor externo)
        const clinic_payment_cordobas = clinic_portion_before_external - external_payment_cordobas;
        const clinic_payment_dollars = clinic_payment_cordobas / exchange_rate_used;
        
        // Actualizar todos los pagos
        calculatedData.external_doctor_payment = external_payment_cordobas;
        calculatedData.external_doctor_payment_usd = external_payment_dollars;
        calculatedData.clinic_payment_cordobas = clinic_payment_cordobas;
        calculatedData.clinic_payment_dollars = clinic_payment_dollars;
        calculatedData.doctor_payment_cordobas = ortho_payment_cordobas;
        calculatedData.doctor_payment_dollars = ortho_payment_dollars;
      }
      
    } else if (!is_orthodontics && external_doctor) {
      // PROCEDIMIENTO GENERAL CON DOCTOR EXTERNO
      
      // Calcular pago al doctor externo
      let external_payment_cordobas = 0;
      let external_payment_dollars = 0;
      
      if (external_doctor_payment_type === 'percentage') {
        external_payment_cordobas = totalInCordobas * (external_doctor_payment_value / 100);
        external_payment_dollars = external_payment_cordobas / exchange_rate_used;
      } else {
        // Monto fijo
        if (external_doctor_payment_currency === 'US$') {
          external_payment_dollars = external_doctor_payment_value;
          external_payment_cordobas = external_doctor_payment_value * exchange_rate_used;
        } else {
          external_payment_cordobas = external_doctor_payment_value;
          external_payment_dollars = external_doctor_payment_value / exchange_rate_used;
        }
      }
      
      // Ganancia de la clínica (total - pago al doctor externo)
      const clinic_payment_cordobas = totalInCordobas - external_payment_cordobas;
      const clinic_payment_dollars = clinic_payment_cordobas / exchange_rate_used;
      
      // Validar que la clínica tenga ganancia
      if (clinic_payment_cordobas <= 0) {
        throw new Error('El pago al doctor externo no puede ser mayor o igual al total del procedimiento');
      }
      
      // Actualizar pagos
      calculatedData.clinic_payment_cordobas = clinic_payment_cordobas;
      calculatedData.clinic_payment_dollars = clinic_payment_dollars;
      calculatedData.doctor_payment_cordobas = 0;
      calculatedData.doctor_payment_dollars = 0;
      calculatedData.external_doctor_payment = external_payment_cordobas;
      calculatedData.external_doctor_payment_usd = external_payment_dollars;
      calculatedData.clinic_payment_percentage = 100;
      calculatedData.doctor_payment_percentage = 0;
      
    } else if (is_orthodontics && !external_doctor) {
      // ORTODONCIA SIN DOCTOR EXTERNO (lógica normal)
      const clinic_payment_cordobas = totalInCordobas * (clinic_payment_percentage / 100);
      const clinic_payment_dollars = clinic_payment_cordobas / exchange_rate_used;
      const doctor_payment_cordobas = totalInCordobas * (doctor_payment_percentage / 100);
      const doctor_payment_dollars = doctor_payment_cordobas / exchange_rate_used;
      
      calculatedData.clinic_payment_cordobas = clinic_payment_cordobas;
      calculatedData.clinic_payment_dollars = clinic_payment_dollars;
      calculatedData.doctor_payment_cordobas = doctor_payment_cordobas;
      calculatedData.doctor_payment_dollars = doctor_payment_dollars;
      calculatedData.clinic_payment_percentage = clinic_payment_percentage;
      calculatedData.doctor_payment_percentage = doctor_payment_percentage;
      
    } else {
      // PROCEDIMIENTO GENERAL SIN DOCTOR EXTERNO
      calculatedData.clinic_payment_cordobas = totalInCordobas;
      calculatedData.clinic_payment_dollars = totalInCordobas / exchange_rate_used;
      calculatedData.doctor_payment_cordobas = 0;
      calculatedData.doctor_payment_dollars = 0;
      calculatedData.clinic_payment_percentage = 100;
      calculatedData.doctor_payment_percentage = 0;
    }
    
    console.log('✅ Datos calculados:', {
      totalInCordobas,
      totalInDollars,
      clinic_payment_cordobas: calculatedData.clinic_payment_cordobas,
      external_doctor_payment: calculatedData.external_doctor_payment
    });
    
    return calculatedData;
  },

  // Obtener estadísticas de ingresos por día (Nicaragua)
  async getDailyIncomeStats(date, isOrthodontics = false) {
    const { start, end } = createNicaraguaDateRange(date);
    
    let query = supabaseAdmin
      .from('procedures')
      .select('total_procedure, clinic_payment_cordobas, doctor_payment_cordobas, external_doctor_payment, is_orthodontics')
      .eq('is_orthodontics', isOrthodontics)
      .gte('procedure_date', start)
      .lte('procedure_date', end);

    const { data, error } = await query;
    
    if (error) throw error;
    
    let totalIncome = 0;
    let clinicIncome = 0;
    let doctorIncome = 0;
    let externalPayments = 0;
    
    (data || []).forEach(procedure => {
      const amount = procedure.total_procedure || 0;
      totalIncome += amount;
      
      // Usar los campos calculados directamente
      clinicIncome += procedure.clinic_payment_cordobas || 0;
      doctorIncome += procedure.doctor_payment_cordobas || 0;
      externalPayments += procedure.external_doctor_payment || 0;
    });
    
    return {
      total_income: totalIncome,
      clinic_income: clinicIncome,
      doctor_income: doctorIncome,
      external_payments: externalPayments,
      clinic_net_income: clinicIncome, // Ya incluye deducción de doctores externos
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
        clinic_payment_cordobas,
        doctor_payment_cordobas,
        external_doctor_payment,
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
      total_amount: unclosed.reduce((sum, p) => sum + (p.total_procedure || 0), 0),
      clinic_amount: unclosed.reduce((sum, p) => sum + (p.clinic_payment_cordobas || 0), 0),
      external_payments: unclosed.reduce((sum, p) => sum + (p.external_doctor_payment || 0), 0)
    };
  },

  // Obtener procedimientos regulares (NO ortodoncia)
async getAllNormal(filters = {}) {

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
    `)
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

  const { data, error } = await query;

  if (error) throw error;

  const transformedData = (data || []).map(item => ({
    ...item,
    procedure_date: formatNicaraguaDateTime(item.procedure_date),
    procedure_date_utc: item.procedure_date,
    creation_date: formatNicaraguaDateTime(item.creation_date),
    patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
    patient_identification: item.patients?.identification,
    original_query_type: item.clinical_appointments?.query_type,
    original_appointment_date: item.clinical_appointments?.appointment_date
      ? formatNicaraguaDateTime(item.clinical_appointments.appointment_date)
      : null,
    clinic_income: item.clinic_payment_cordobas || 0,
    external_doctor_payment: item.external_doctor_payment || 0,
    clinic_net_income: item.clinic_payment_cordobas || 0
  }));

  return {
    data: transformedData,
    total: transformedData.length
  };
},

  // Obtener procedimientos de ortodoncia
async getAllOrthodontics(filters = {}) {

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
    `)
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

  const { data, error } = await query;

  if (error) throw error;

  const transformedData = (data || []).map(item => {
    const total = item.total_procedure || 0;
    const clinicPayment = item.clinic_payment_cordobas || 0;
    const doctorPayment = item.doctor_payment_cordobas || 0;
    const externalPayment = item.external_doctor_payment || 0;

    return {
      ...item,
      procedure_date: formatNicaraguaDateTime(item.procedure_date),
      procedure_date_utc: item.procedure_date,
      creation_date: formatNicaraguaDateTime(item.creation_date),
      patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
      patient_identification: item.patients?.identification,
      original_query_type: item.clinical_appointments?.query_type,
      original_appointment_date: item.clinical_appointments?.appointment_date
        ? formatNicaraguaDateTime(item.clinical_appointments.appointment_date)
        : null,
      clinic_income: clinicPayment,
      doctor_income: doctorPayment,
      external_doctor_payment: externalPayment,
      clinic_net_income: clinicPayment,
      total_procedure: total
    };
  });

  return {
    data: transformedData,
    total: transformedData.length
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
    
    // Los cálculos ya están hechos en la BD
    const clinic_income = data.clinic_payment_cordobas || 0;
    const doctor_income = data.doctor_payment_cordobas || 0;
    const external_doctor_payment = data.external_doctor_payment || 0;
    
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
      external_doctor_payment,
      clinic_net_income: clinic_income, // Ya incluye deducción
      original_query_type: data.clinical_appointments?.query_type,
      original_appointment_date: data.clinical_appointments?.appointment_date ? 
        formatNicaraguaDateTime(data.clinical_appointments.appointment_date) : null
    };
  },

  // Crear procedimiento directamente (convierte hora Nicaragua a UTC)
  async create(procedureData) {
    // Calcular pagos antes de insertar
    const calculatedData = Procedure.calculateProcedurePayments(procedureData);
    
    // Convertir fecha a UTC si se proporciona
    const procedureWithUTC = {
      ...calculatedData,
      procedure_date: calculatedData.procedure_date ? 
        toUTCFromNicaragua(calculatedData.procedure_date).toISOString() : 
        new Date().toISOString(),
      creation_date: new Date().toISOString()
    };
    
    console.log('Creando procedimiento con datos calculados:', procedureWithUTC);
    
    const { data, error } = await supabaseAdmin
      .from('procedures')
      .insert([procedureWithUTC])
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      procedure_date: formatNicaraguaDateTime(data.procedure_date),
      procedure_date_utc: data.procedure_date,
      creation_date: formatNicaraguaDateTime(data.creation_date)
    };
  },

  // Actualizar procedimiento
  async update(id, procedureData) {
    // Calcular pagos antes de actualizar
    const calculatedData = Procedure.calculateProcedurePayments(procedureData);
    
    // Si se actualiza la fecha, convertir a UTC
    const updateData = { ...calculatedData };
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
    
    const { data: procedures, error } = await supabaseAdmin
      .from('procedures')
      .select(`
        total_procedure,
        clinic_payment_cordobas,
        doctor_payment_cordobas,
        external_doctor_payment,
        is_orthodontics,
        amount_cordobas,
        amount_dollars
      `)
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
    let external_doctor_payments = 0;
    
    procedures.forEach(procedure => {
      if (procedure.is_orthodontics) {
        clinic_orthodontic_income += procedure.clinic_payment_cordobas || 0;
        doctor_orthodontic_income += procedure.doctor_payment_cordobas || 0;
      } else {
        general_income += procedure.clinic_payment_cordobas || 0;
      }
      
      external_doctor_payments += procedure.external_doctor_payment || 0;
    });
    
    // Calcular ingresos totales de la clínica (ya incluyen deducción de doctores externos)
    const clinic_income = general_income + clinic_orthodontic_income;
    
    console.log('💰 Estadísticas calculadas:', {
      general_income,
      clinic_orthodontic_income,
      doctor_orthodontic_income,
      external_doctor_payments,
      clinic_income,
      total_procedures: procedures.length
    });
    
    return {
      general_income,
      clinic_orthodontic_income,
      doctor_orthodontic_income,
      external_doctor_payments,
      clinic_income,
      clinic_net_income: clinic_income, // Ya incluye deducción de doctores externos
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