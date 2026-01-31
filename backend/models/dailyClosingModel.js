import { supabaseAdmin } from '../config/supabase.js';
import { 
  toUTCFromNicaragua,
  toNicaraguaTime,
  formatNicaraguaDateTime,
  formatNicaraguaDate,
  createNicaraguaDateRange,
  adjustDateForQuery
} from '../utils/timezoneUtils.js';

const DailyClosing = {
  // Obtener todos los cierres diarios
  async getAll(page = 1, limit = 30, filters = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    let query = supabaseAdmin
      .from('daily_closings')
      .select('*', { count: 'exact' })
      .order('closing_date', { ascending: false });
    
    // Aplicar filtros
    if (filters.closing_type) {
      query = query.eq('closing_type', filters.closing_type);
    }
    
    if (filters.startDate) {
      const start = adjustDateForQuery(filters.startDate);
      query = query.gte('closing_date', start);
    }
    
    if (filters.endDate) {
      const end = adjustDateForQuery(filters.endDate);
      query = query.lte('closing_date', end);
    }
    
    query = query.range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    // Obtener configuración para convertir montos
    const settings = await this.getSystemSettings();
    const exchangeRate = settings?.exchange_rate || 36.5;
    
    // Convertir fechas para mostrar
    const formattedData = data.map(closing => ({
      ...closing,
      // Fecha exacta en formato legible
      closing_date_exact: closing.closing_date,
      closing_date_formatted: formatNicaraguaDate(closing.closing_date),
      closing_date_display: `${formatNicaraguaDate(closing.closing_date)} (${closing.closing_type === 'orthodontics' ? 'Ortodoncia' : 'General'})`,
      created_at_display: formatNicaraguaDateTime(closing.created_at),
      // Agregar montos en USD calculados
      total_income_usd: (closing.total_income || 0) / exchangeRate,
      total_clinic_income_usd: (closing.total_clinic_income || 0) / exchangeRate,
      total_doctor_income_usd: (closing.total_doctor_income || 0) / exchangeRate
    }));
    
    return {
      data: formattedData,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  },

  // Obtener cierre por ID
  async getById(id) {
    const { data, error } = await supabaseAdmin
      .from('daily_closings')
      .select('*')
      .eq('daily_closing_id', id)
      .single();
    
    if (error) throw error;
    
    // Obtener configuración
    const settings = await this.getSystemSettings();
    const exchangeRate = settings?.exchange_rate || 36.5;
    
    return {
      ...data,
      closing_date_display: formatNicaraguaDate(data.closing_date),
      created_at_display: formatNicaraguaDateTime(data.created_at),
      total_income_usd: (data.total_income || 0) / exchangeRate,
      total_clinic_income_usd: (data.total_clinic_income || 0) / exchangeRate,
      total_doctor_income_usd: (data.total_doctor_income || 0) / exchangeRate,
      total_external_doctor_payments_usd: (data.total_external_doctor_payments || 0) / exchangeRate
    };
  },

  // Crear cierre diario
  async create(closingData) {
    console.log('🔍 DEBUG Model create - Datos recibidos:', closingData);
    
    // Determinar fecha
    let closingDate;
    if (closingData.closing_date && closingData.closing_date.trim() !== '') {
      closingDate = adjustDateForQuery(closingData.closing_date);
    } else if (closingData.date && closingData.date.trim() !== '') {
      closingDate = adjustDateForQuery(closingData.date);
    } else {
      const today = new Date();
      closingDate = today.toISOString().split('T')[0];
    }
    
    const closingWithFormattedDate = {
      ...closingData,
      closing_date: closingDate,
      created_at: new Date().toISOString(),
      is_processed: false
    };
    
    // Eliminar propiedad date si existe
    delete closingWithFormattedDate.date;
    
    console.log('📤 Insertando en daily_closings:', closingWithFormattedDate);
    
    const { data, error } = await supabaseAdmin
      .from('daily_closings')
      .insert([closingWithFormattedDate])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error Supabase al crear cierre:', error);
      throw error;
    }
    
    console.log('✅ Cierre creado en BD, datos:', data);
    
    // Asegurar que tenemos el ID
    const closingId = data.daily_closing_id || data.id || data.daily_closing_ID;
    console.log('🆔 ID obtenido del cierre:', closingId);
    
    if (!closingId) {
      console.error('❌ No se pudo obtener ID del cierre creado');
      console.log('📄 Datos completos:', data);
    }
    
    // Obtener configuración para USD
    const settings = await this.getSystemSettings();
    const exchangeRate = settings?.exchange_rate || 36.5;
    
    const result = {
      ...data,
      daily_closing_id: closingId,
      closing_date_display: formatNicaraguaDate(data.closing_date),
      created_at_display: formatNicaraguaDateTime(data.created_at),
      total_income_usd: (data.total_income || 0) / exchangeRate,
      total_clinic_income_usd: (data.total_clinic_income || 0) / exchangeRate,
      total_doctor_income_usd: (data.total_doctor_income || 0) / exchangeRate
    };
    
    console.log('📋 Resultado final a devolver:', result);
    return result;
  },

  // Actualizar cierre diario
  async update(id, closingData) {
    const { data, error } = await supabaseAdmin
      .from('daily_closings')
      .update(closingData)
      .eq('daily_closing_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Eliminar cierre diario
  async delete(id) {
    const { data, error } = await supabaseAdmin
      .from('daily_closings')
      .delete()
      .eq('daily_closing_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Verificar si existe cierre para fecha y tipo
  async exists(date, type = 'general') {
    const closingDate = adjustDateForQuery(date);
    
    const { data, error } = await supabaseAdmin
      .from('daily_closings')
      .select('daily_closing_id')
      .eq('closing_date', closingDate)
      .eq('closing_type', type)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  },

  // Obtener configuración del sistema
  async getSystemSettings() {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .order('setting_ID', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.warn('No se pudo obtener configuración, usando valores por defecto');
      return {
        exchange_rate: 36.5,
        clinic_payment: 40,
        doctor_payment: 60
      };
    }
    
    return data;
  },

  // Obtener procedimientos del día para cierre
  // En dailyClosingModel.js - getDailyProcedures
async getDailyProcedures(date, closingType = 'general') {
  const { start, end } = createNicaraguaDateRange(date);
  
  console.log('🔍 Buscando procedimientos para cierre diario:', {
    fechaNicaragua: date,
    inicioUTC: start,
    finUTC: end,
    tipo: closingType
  });
  
  let query = supabaseAdmin
    .from('procedures')
    .select(`
      *,
      patients (first_name, first_last_name)
    `)
    .eq('is_orthodontics', closingType === 'orthodontics')
    .gte('procedure_date', start)
    .lte('procedure_date', end);
  
  const { data, error } = await query;
  
  if (error) {
    console.error('❌ Error obteniendo procedimientos:', error);
    throw error;
  }
  
  console.log(`✅ Encontrados ${data.length} procedimientos para el día ${date}`);
  
  // Convertir fechas a Nicaragua para mostrar
  const formattedData = data.map(procedure => ({
    ...procedure,
    procedure_date_display: formatNicaraguaDateTime(procedure.procedure_date),
    procedure_date_utc: procedure.procedure_date
  }));
  
  return formattedData;
},

  // Obtener gastos del día (solo para referencia, no se incluyen en cierres diarios)
  async getDailyBills(date) {
    const billDate = adjustDateForQuery(date);
    
    const { data, error } = await supabaseAdmin
      .from('bills')
      .select('*')
      .eq('bill_date', billDate)
      .eq('is_processed_in_closing', false);
    
    if (error) throw error;
    return data || [];
  },

  // Crear relación entre procedimientos y cierre diario
  async createProcedureRelations(procedureClosings) {
    if (!procedureClosings || procedureClosings.length === 0) {
      console.log('ℹ️ No hay relaciones de procedimientos para crear');
      return [];
    }
    
    console.log('🔍 createProcedureRelations - Datos recibidos:', procedureClosings);
    
    // Verificar que todos tengan los campos necesarios
    const validProcedureClosings = procedureClosings.map(pc => {
      // Verificar procedure_id
      if (!pc.procedure_id) {
        console.error('❌ Falta procedure_id en:', pc);
        throw new Error('procedure_id es requerido');
      }
      
      // Verificar daily_closing_id
      if (!pc.daily_closing_id) {
        console.error('❌ Falta daily_closing_id en:', pc);
        throw new Error('daily_closing_id es requerido');
      }
      
      return {
        procedure_id: pc.procedure_id,
        daily_closing_id: pc.daily_closing_id,
        clinic_income_portion: pc.clinic_income_portion || 0,
        doctor_income_portion: pc.doctor_income_portion || 0,
        external_doctor_payment: pc.external_doctor_payment || 0
      };
    });
    
    console.log('📤 Insertando en procedure_daily_closings:', validProcedureClosings);
    
    try {
      const { data, error } = await supabaseAdmin
        .from('procedure_daily_closings')
        .insert(validProcedureClosings)
        .select();
      
      if (error) {
        console.error('❌ Error Supabase al insertar relaciones:', error);
        throw error;
      }
      
      console.log('✅ Relaciones creadas exitosamente:', data.length, 'registros');
      return data;
    } catch (error) {
      console.error('❌ Error completo en createProcedureRelations:', error);
      throw error;
    }
  },

  // getDailyFinancialSummary - Actualizado para usar settings
  // models/dailyClosingModel.js - Corregir getDailyFinancialSummary
async getDailyFinancialSummary(date, closingType = 'general') {
  console.log('🔍 Obteniendo resumen diario para:', { date, closingType });
  
  const procedures = await this.getDailyProcedures(date, closingType);
  
  console.log('📊 Procedimientos encontrados:', procedures.length);
  console.log('📄 Procedimientos:', procedures.map(p => ({
    id: p.procedure_ID,
    desc: p.procedure_description,
    total_procedure: p.total_procedure,
    total_procedure_usd: p.total_procedure_usd,
    is_orthodontics: p.is_orthodontics
  })));
  
  // Obtener configuración desde settings
  const settings = await this.getSystemSettings();
  const exchangeRate = settings.exchange_rate || 36.5;
  let clinicPercentage = 100;
  let doctorPercentage = 0;
  
  if (closingType === 'orthodontics') {
    clinicPercentage = settings.clinic_payment || 40;
    doctorPercentage = settings.doctor_payment || 60;
  }
  
  console.log('🔢 Configuración aplicada:', {
    clinic: clinicPercentage,
    doctor: doctorPercentage,
    exchange_rate: exchangeRate,
    type: closingType
  });
  
  // Calcular ingresos USANDO total_procedure y total_procedure_usd
  let totalIncomeCordobas = 0;
  let totalIncomeDollars = 0;
  let totalClinicIncomeCordobas = 0;
  let totalDoctorIncomeCordobas = 0;
  let totalExternalDoctorPaymentsCordobas = 0;
  
  const procedureClosings = [];
  
  procedures.forEach(procedure => {
    console.log('📝 Procesando procedimiento:', {
      id: procedure.procedure_ID,
      desc: procedure.procedure_description,
      total_procedure: procedure.total_procedure,
      total_procedure_usd: procedure.total_procedure_usd
    });
    
    // Usar total_procedure y total_procedure_usd que ya están calculados
    const procedureAmountCordobas = procedure.total_procedure || 0;
    const procedureAmountDollars = procedure.total_procedure_usd || 0;
    
    totalIncomeCordobas += procedureAmountCordobas;
    totalIncomeDollars += procedureAmountDollars;
    
    let clinicPortionCordobas = 0;
    let doctorPortionCordobas = 0;
    
    if (closingType === 'orthodontics') {
      // Solo aplicar porcentajes si es ortodoncia
      clinicPortionCordobas = procedureAmountCordobas * (clinicPercentage / 100);
      doctorPortionCordobas = procedureAmountCordobas * (doctorPercentage / 100);
    } else {
      // Para cierres generales, 100% para clínica
      clinicPortionCordobas = procedureAmountCordobas;
    }
    
    // Restar pagos a doctores externos si existen
    let externalPaymentCordobas = 0;
    
    if (procedure.theres_external_doctor && procedure.external_doctor_payment_value) {
      console.log('💰 Procedimiento con doctor externo:', {
        valor: procedure.external_doctor_payment_value,
        moneda: procedure.external_doctor_payment_currency
      });
      
      if (procedure.external_doctor_payment_currency === 'C$') {
        externalPaymentCordobas = procedure.external_doctor_payment_value;
        clinicPortionCordobas -= externalPaymentCordobas;
      } else {
        // Si es USD, convertir a córdobas
        externalPaymentCordobas = procedure.external_doctor_payment_value * exchangeRate;
        clinicPortionCordobas -= externalPaymentCordobas;
      }
    }
    
    totalClinicIncomeCordobas += clinicPortionCordobas;
    totalDoctorIncomeCordobas += doctorPortionCordobas;
    totalExternalDoctorPaymentsCordobas += externalPaymentCordobas;
    
    procedureClosings.push({
      procedure_id: procedure.procedure_ID,
      clinic_income_portion: clinicPortionCordobas,
      doctor_income_portion: doctorPortionCordobas,
      external_doctor_payment: externalPaymentCordobas
    });
  });
  
  // Calcular totales
  const totalClinicIncome = totalClinicIncomeCordobas;
  const totalDoctorIncome = totalDoctorIncomeCordobas;
  const totalIncome = totalIncomeCordobas;
  
  // Los cierres diarios solo muestran ingresos, no gastos
  const netProfit = totalClinicIncome;
  
  const result = {
    procedures,
    procedureClosings,
    total_income: totalIncome,
    total_income_usd: totalIncomeDollars + (totalIncomeCordobas / exchangeRate),
    total_clinic_income: totalClinicIncome,
    total_clinic_income_usd: (totalClinicIncome / exchangeRate),
    total_doctor_income: totalDoctorIncome,
    total_doctor_income_usd: (totalDoctorIncome / exchangeRate),
    total_external_doctor_payments: totalExternalDoctorPaymentsCordobas,
    total_external_doctor_payments_usd: (totalExternalDoctorPaymentsCordobas / exchangeRate),
    net_profit: netProfit,
    net_profit_usd: netProfit / exchangeRate,
    clinic_percentage: clinicPercentage,
    doctor_percentage: doctorPercentage,
    exchange_rate: exchangeRate,
    fecha_nicaragua: date,
    cantidad_procedimientos: procedures.length
  };
  
  console.log('📋 Resultado final del resumen diario:', result);
  
  return result;
},

  // Obtener estadísticas por rango de fechas
  async getStatsByDateRange(startDate, endDate, closingType = 'general') {
    const start = adjustDateForQuery(startDate);
    const end = adjustDateForQuery(endDate);
    
    const { data, error } = await supabaseAdmin
      .from('daily_closings')
      .select('*')
      .eq('closing_type', closingType)
      .gte('closing_date', start)
      .lte('closing_date', end)
      .order('closing_date', { ascending: true });
    
    if (error) throw error;
    
    // Obtener configuración
    const settings = await this.getSystemSettings();
    const exchangeRate = settings?.exchange_rate || 36.5;
    
    const stats = {
      total_closings: data.length,
      total_income: 0,
      total_income_usd: 0,
      total_clinic_income: 0,
      total_clinic_income_usd: 0,
      total_doctor_income: 0,
      total_doctor_income_usd: 0,
      total_net_profit: 0,
      total_net_profit_usd: 0,
      average_daily_profit: 0
    };
    
    if (data.length > 0) {
      data.forEach(closing => {
        stats.total_income += closing.total_income || 0;
        stats.total_clinic_income += closing.total_clinic_income || 0;
        stats.total_doctor_income += closing.total_doctor_income || 0;
        stats.total_net_profit += closing.net_profit || 0;
      });
      
      stats.total_income_usd = stats.total_income / exchangeRate;
      stats.total_clinic_income_usd = stats.total_clinic_income / exchangeRate;
      stats.total_doctor_income_usd = stats.total_doctor_income / exchangeRate;
      stats.total_net_profit_usd = stats.total_net_profit / exchangeRate;
      stats.average_daily_profit = stats.total_net_profit / data.length;
    }
    
    return {
      data: data.map(closing => ({
        ...closing,
        closing_date_display: formatNicaraguaDate(closing.closing_date),
        total_income_usd: (closing.total_income || 0) / exchangeRate,
        total_clinic_income_usd: (closing.total_clinic_income || 0) / exchangeRate,
        total_doctor_income_usd: (closing.total_doctor_income || 0) / exchangeRate
      })),
      stats
    };
  }
};

export default DailyClosing;