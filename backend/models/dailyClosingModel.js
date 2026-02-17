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
    
    const settings = await this.getSystemSettings();
    const exchangeRate = settings?.exchange_rate || 36.5;
    
    const formattedData = data.map(closing => ({
      ...closing,
      closing_date_exact: closing.closing_date,
      closing_date_formatted: formatNicaraguaDate(closing.closing_date),
      closing_date_display: `${formatNicaraguaDate(closing.closing_date)} (${closing.closing_type === 'orthodontics' ? 'Ortodoncia' : 'General'})`,
      created_at_display: formatNicaraguaDateTime(closing.created_at),
      total_income_usd: (closing.total_income || 0) / exchangeRate,
      total_clinic_income_usd: (closing.total_clinic_income || 0) / exchangeRate,
      total_doctor_income_usd: (closing.total_doctor_income || 0) / exchangeRate,
      total_variable_expenses_usd: (closing.total_variable_expenses || 0) / exchangeRate,
      net_profit_usd: (closing.net_profit || 0) / exchangeRate
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
    
    const settings = await this.getSystemSettings();
    const exchangeRate = settings?.exchange_rate || 36.5;
    
    return {
      ...data,
      closing_date_display: formatNicaraguaDate(data.closing_date),
      created_at_display: formatNicaraguaDateTime(data.created_at),
      total_income_usd: (data.total_income || 0) / exchangeRate,
      total_clinic_income_usd: (data.total_clinic_income || 0) / exchangeRate,
      total_doctor_income_usd: (data.total_doctor_income || 0) / exchangeRate,
      total_external_doctor_payments_usd: (data.total_external_doctor_payments || 0) / exchangeRate,
      total_variable_expenses_usd: (data.total_variable_expenses || 0) / exchangeRate,
      net_profit_usd: (data.net_profit || 0) / exchangeRate
    };
  },

  // ============================================
  // FUNCIONES PARA PROCEDIMIENTOS
  // ============================================

  // Obtener procedimientos del día
  async getDailyProcedures(date, closingType = 'general') {
    console.log('🔍 getDailyProcedures - Iniciando búsqueda:', {
      fechaRecibida: date,
      tipo: closingType
    });

    const startDate = new Date(date + 'T00:00:00-06:00');
    const endDate = new Date(date + 'T23:59:59.999-06:00');
    
    const startUTC = startDate.toISOString();
    const endUTC = endDate.toISOString();
    
    console.log('🔍 Rango de tiempo calculado:', {
      fechaNicaragua: date,
      inicioUTC: startUTC,
      finUTC: endUTC,
      tipo: closingType
    });
    
    let query = supabaseAdmin
      .from('procedures')
      .select(`
        *,
        patients (first_name, first_last_name)
      `)
      .eq('is_orthodontics', closingType === 'orthodontics')
      .gte('procedure_date', startUTC)
      .lte('procedure_date', endUTC);
    
    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Error obteniendo procedimientos:', error);
      throw error;
    }
    
    console.log(`✅ Encontrados ${data.length} procedimientos para el día ${date}`);
    
    const formattedData = data.map(procedure => ({
      ...procedure,
      procedure_date_display: formatNicaraguaDateTime(procedure.procedure_date),
      procedure_date_utc: procedure.procedure_date
    }));
    
    return formattedData;
  },

  // ============================================
  // FUNCIONES PARA GASTOS VARIABLES
  // ============================================

  // 🔴 FUNCIÓN ORIGINAL: Gastos NO procesados (para resultados en vivo)
async getDailyVariableExpenses(date) {
  console.log('🔍 [ORIGINAL] Obteniendo gastos variables NO procesados para el día:', date);
  
  const queryDate = date;
  
  // Usar los campos correctos de la base de datos
  const { data, error } = await supabaseAdmin
    .from('bills')
    .select(`
      bill_ID,
      description,
      amount,
      amount_usd,
      bill_date,
      category,
      currency_used,
      exchange_rate_bill,
      is_processed_in_closing,
      processed_in_daily_closing_ID
    `)
    .eq('is_recurrent', false)
    .eq('is_processed_in_closing', false)  // ← CAMPO CORRECTO
    .is('processed_in_daily_closing_ID', null)  // ← También verificar que no tenga daily ID
    .eq('bill_date', queryDate);
  
  if (error) {
    console.error('❌ Error obteniendo gastos variables:', error);
    throw error;
  }
  
  console.log(`✅ Encontrados ${data?.length || 0} gastos variables NO procesados`);
  return data || [];
},

// 🔴 NUEVA FUNCIÓN: Todos los gastos del día (para cierres)
async getDailyVariableExpensesAll(date) {
  console.log('🔍 [CIERRES] Obteniendo TODOS los gastos variables para el día:', date);
  
  const queryDate = date;
  
  // Usar los campos correctos - SIN filtrar por procesados
  const { data, error } = await supabaseAdmin
    .from('bills')
    .select(`
      bill_ID,
      description,
      amount,
      amount_usd,
      bill_date,
      category,
      currency_used,
      exchange_rate_bill,
      is_processed_in_closing,
      processed_in_daily_closing_ID
    `)
    .eq('is_recurrent', false)  // Solo gastos variables
    .eq('bill_date', queryDate);  // TODOS, sin filtrar por procesados
  
  if (error) {
    console.error('❌ Error obteniendo gastos variables:', error);
    throw error;
  }
  
  console.log(`✅ Encontrados ${data?.length || 0} gastos variables TOTALES`);
  console.log('📊 Estado de procesamiento:', {
    procesados_mensual: data?.filter(b => b.is_processed_in_closing).length || 0,
    con_daily_id: data?.filter(b => b.processed_in_daily_closing_ID).length || 0,
    no_procesados: data?.filter(b => !b.is_processed_in_closing && !b.processed_in_daily_closing_ID).length || 0
  });
  
  return data || [];
},

  // Marcar gastos variables como procesados
async markVariableExpensesAsProcessed(expenseIds, dailyClosingId) {
  if (!expenseIds || expenseIds.length === 0) return [];
  
  console.log('📝 Marcando gastos variables como procesados:', {
    expenseIds,
    dailyClosingId
  });
  
  // Usar los campos correctos
  const { data, error } = await supabaseAdmin
    .from('bills')
    .update({ 
      is_processed_in_closing: true,
      processed_in_daily_closing_ID: dailyClosingId
    })
    .in('bill_ID', expenseIds)
    .select();
  
  if (error) {
    console.error('❌ Error marcando gastos variables:', error);
    throw error;
  }
  
  console.log(`✅ ${data?.length || 0} gastos variables marcados como procesados`);
  return data || [];
},

  // ============================================
  // FUNCIONES DE RESUMEN FINANCIERO
  // ============================================

  // 🔴 FUNCIÓN ORIGINAL: Para resultados en vivo (usa gastos NO procesados)
  async getDailyFinancialSummary(date, closingType = 'general') {
    console.log('🔍 [VERSIÓN ORIGINAL - RESULTADOS EN VIVO] Obteniendo resumen diario para:', { date, closingType });
    
    const procedures = await this.getDailyProcedures(date, closingType);
    const variableExpenses = await this.getDailyVariableExpenses(date);
    
    console.log('📊 Procedimientos encontrados:', procedures.length);
    console.log('💰 Gastos variables NO procesados encontrados:', variableExpenses.length);
    
    const settings = await this.getSystemSettings();
    const exchangeRate = settings.exchange_rate || 36.5;
    
    let totalClinicIncomeCordobas = 0;
    let totalClinicIncomeDollars = 0;
    let totalDoctorIncomeCordobas = 0;
    let totalDoctorIncomeDollars = 0;
    let totalExternalDoctorPaymentsCordobas = 0;
    let totalExternalDoctorPaymentsDollars = 0;
    
    const procedureClosings = [];
    
    procedures.forEach(procedure => {
      const clinicCordobas = parseFloat(procedure.clinic_payment_cordobas) || 0;
      const clinicDollars = parseFloat(procedure.clinic_payment_dollars) || 0;
      totalClinicIncomeCordobas += clinicCordobas;
      totalClinicIncomeDollars += clinicDollars;
      
      const doctorCordobas = parseFloat(procedure.doctor_payment_cordobas) || 0;
      const doctorDollars = parseFloat(procedure.doctor_payment_dollars) || 0;
      totalDoctorIncomeCordobas += doctorCordobas;
      totalDoctorIncomeDollars += doctorDollars;
      
      if (procedure.external_doctor_payment && procedure.external_doctor_payment > 0) {
        const externalPaymentCordobas = parseFloat(procedure.external_doctor_payment) || 0;
        const procExchangeRate = parseFloat(procedure.exchange_rate_used) || exchangeRate;
        const externalPaymentDollars = externalPaymentCordobas / procExchangeRate;
        
        totalExternalDoctorPaymentsCordobas += externalPaymentCordobas;
        totalExternalDoctorPaymentsDollars += externalPaymentDollars;
      }
      
      procedureClosings.push({
        procedure_id: procedure.procedure_ID,
        clinic_income_portion: clinicCordobas,
        doctor_income_portion: doctorCordobas,
        external_doctor_payment: parseFloat(procedure.external_doctor_payment) || 0
      });
    });
    
    let totalVariableExpensesCordobas = 0;
    let totalVariableExpensesDollars = 0;
    const expenseDetails = [];
    const expenseIds = [];
    
    variableExpenses.forEach(expense => {
      let amountCordobas = 0;
      let amountDollars = 0;
      
      if (expense.currency_used === 'USD') {
        const usdAmount = parseFloat(expense.amount_usd) || 0;
        const expenseExchangeRate = parseFloat(expense.exchange_rate_bill) || exchangeRate;
        amountCordobas = usdAmount * expenseExchangeRate;
        amountDollars = usdAmount;
      } else {
        amountCordobas = parseFloat(expense.amount) || 0;
        amountDollars = amountCordobas / exchangeRate;
      }
      
      totalVariableExpensesCordobas += amountCordobas;
      totalVariableExpensesDollars += amountDollars;
      
      expenseIds.push(expense.bill_ID);
      
      expenseDetails.push({
        bill_id: expense.bill_ID,
        description: expense.description,
        amount: amountCordobas,
        amount_usd: amountDollars,
        category: expense.category,
        exchange_rate: expense.exchange_rate_bill || exchangeRate
      });
    });
    
    let totalIncome = 0;
    let netProfit = 0;
    
    if (closingType === 'orthodontics') {
      totalIncome = totalClinicIncomeCordobas + totalDoctorIncomeCordobas;
      netProfit = totalClinicIncomeCordobas - totalVariableExpensesCordobas;
    } else {
      totalIncome = totalClinicIncomeCordobas;
      netProfit = totalClinicIncomeCordobas - totalVariableExpensesCordobas;
    }
    
    const result = {
      procedures,
      procedureClosings,
      variableExpenses: expenseDetails,
      total_income: totalIncome,
      total_income_usd: totalIncome / exchangeRate,
      total_clinic_income: totalClinicIncomeCordobas,
      total_clinic_income_usd: totalClinicIncomeDollars,
      total_doctor_income: totalDoctorIncomeCordobas,
      total_doctor_income_usd: totalDoctorIncomeDollars,
      total_external_doctor_payments: totalExternalDoctorPaymentsCordobas,
      total_external_doctor_payments_usd: totalExternalDoctorPaymentsDollars,
      total_variable_expenses: totalVariableExpensesCordobas,
      total_variable_expenses_usd: totalVariableExpensesDollars,
      net_profit: netProfit,
      net_profit_usd: netProfit / exchangeRate,
      exchange_rate: exchangeRate,
      fecha_nicaragua: date,
      cantidad_procedimientos: procedures.length,
      cantidad_gastos_variables: variableExpenses.length,
      expense_ids: expenseIds
    };
    
    console.log('📋 [ORIGINAL] Resumen diario:', {
      total_clinic_income: result.total_clinic_income,
      total_variable_expenses: result.total_variable_expenses,
      net_profit: result.net_profit,
      cantidad_gastos: result.cantidad_gastos_variables
    });
    
    return result;
  },

  // 🔴 NUEVA FUNCIÓN: Para cierres (usa TODOS los gastos)
  async getDailyClosingSummary(date, closingType = 'general') {
    console.log('🔍 [VERSIÓN PARA CIERRES] Obteniendo resumen diario para cierre:', { date, closingType });
    
    const procedures = await this.getDailyProcedures(date, closingType);
    const variableExpenses = await this.getDailyVariableExpensesAll(date);
    
    console.log('📊 Procedimientos encontrados:', procedures.length);
    console.log('💰 Gastos variables TOTALES encontrados:', variableExpenses.length);
    
    const settings = await this.getSystemSettings();
    const exchangeRate = settings.exchange_rate || 36.5;
    
    let totalClinicIncomeCordobas = 0;
    let totalClinicIncomeDollars = 0;
    let totalDoctorIncomeCordobas = 0;
    let totalDoctorIncomeDollars = 0;
    let totalExternalDoctorPaymentsCordobas = 0;
    let totalExternalDoctorPaymentsDollars = 0;
    
    const procedureClosings = [];
    
    procedures.forEach(procedure => {
      const clinicCordobas = parseFloat(procedure.clinic_payment_cordobas) || 0;
      const clinicDollars = parseFloat(procedure.clinic_payment_dollars) || 0;
      totalClinicIncomeCordobas += clinicCordobas;
      totalClinicIncomeDollars += clinicDollars;
      
      const doctorCordobas = parseFloat(procedure.doctor_payment_cordobas) || 0;
      const doctorDollars = parseFloat(procedure.doctor_payment_dollars) || 0;
      totalDoctorIncomeCordobas += doctorCordobas;
      totalDoctorIncomeDollars += doctorDollars;
      
      if (procedure.external_doctor_payment && procedure.external_doctor_payment > 0) {
        const externalPaymentCordobas = parseFloat(procedure.external_doctor_payment) || 0;
        const procExchangeRate = parseFloat(procedure.exchange_rate_used) || exchangeRate;
        const externalPaymentDollars = externalPaymentCordobas / procExchangeRate;
        
        totalExternalDoctorPaymentsCordobas += externalPaymentCordobas;
        totalExternalDoctorPaymentsDollars += externalPaymentDollars;
      }
      
      procedureClosings.push({
        procedure_id: procedure.procedure_ID,
        clinic_income_portion: clinicCordobas,
        doctor_income_portion: doctorCordobas,
        external_doctor_payment: parseFloat(procedure.external_doctor_payment) || 0
      });
    });
    
    let totalVariableExpensesCordobas = 0;
    let totalVariableExpensesDollars = 0;
    const expenseDetails = [];
    const expenseIds = [];
    
    variableExpenses.forEach(expense => {
      let amountCordobas = 0;
      let amountDollars = 0;
      
      if (expense.currency_used === 'USD') {
        const usdAmount = parseFloat(expense.amount_usd) || 0;
        const expenseExchangeRate = parseFloat(expense.exchange_rate_bill) || exchangeRate;
        amountCordobas = usdAmount * expenseExchangeRate;
        amountDollars = usdAmount;
      } else {
        amountCordobas = parseFloat(expense.amount) || 0;
        amountDollars = amountCordobas / exchangeRate;
      }
      
      totalVariableExpensesCordobas += amountCordobas;
      totalVariableExpensesDollars += amountDollars;
      
      expenseIds.push(expense.bill_ID);
      
      expenseDetails.push({
        bill_id: expense.bill_ID,
        description: expense.description,
        amount: amountCordobas,
        amount_usd: amountDollars,
        category: expense.category,
        exchange_rate: expense.exchange_rate_bill || exchangeRate
      });
    });
    
    let totalIncome = 0;
    let netProfit = 0;
    
    if (closingType === 'orthodontics') {
      totalIncome = totalClinicIncomeCordobas + totalDoctorIncomeCordobas;
      netProfit = totalClinicIncomeCordobas - totalVariableExpensesCordobas;
    } else {
      totalIncome = totalClinicIncomeCordobas;
      netProfit = totalClinicIncomeCordobas - totalVariableExpensesCordobas;
    }
    
    const result = {
      procedures,
      procedureClosings,
      variableExpenses: expenseDetails,
      total_income: totalIncome,
      total_income_usd: totalIncome / exchangeRate,
      total_clinic_income: totalClinicIncomeCordobas,
      total_clinic_income_usd: totalClinicIncomeDollars,
      total_doctor_income: totalDoctorIncomeCordobas,
      total_doctor_income_usd: totalDoctorIncomeDollars,
      total_external_doctor_payments: totalExternalDoctorPaymentsCordobas,
      total_external_doctor_payments_usd: totalExternalDoctorPaymentsDollars,
      total_variable_expenses: totalVariableExpensesCordobas,
      total_variable_expenses_usd: totalVariableExpensesDollars,
      net_profit: netProfit,
      net_profit_usd: netProfit / exchangeRate,
      exchange_rate: exchangeRate,
      fecha_nicaragua: date,
      cantidad_procedimientos: procedures.length,
      cantidad_gastos_variables: variableExpenses.length,
      expense_ids: expenseIds
    };
    
    console.log('📋 [CIERRES] Resumen diario con TODOS los gastos:', {
      total_clinic_income: result.total_clinic_income,
      total_variable_expenses: result.total_variable_expenses,
      net_profit: result.net_profit,
      cantidad_gastos: result.cantidad_gastos_variables,
      gastos_procesados: variableExpenses.filter(e => e.is_processed_in_daily_closing).length,
      gastos_no_procesados: variableExpenses.filter(e => !e.is_processed_in_daily_closing).length
    });
    
    return result;
  },

  // Crear cierre diario
  async create(closingData) {
    console.log('🔍 create - Datos recibidos:', closingData);
    
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
      closing_date: closingDate,
      closing_type: closingData.closing_type,
      total_income: closingData.total_income || 0,
      total_clinic_income: closingData.total_clinic_income || 0,
      total_doctor_income: closingData.total_doctor_income || 0,
      total_external_doctor_payments: closingData.total_external_doctor_payments || 0,
      total_variable_expenses: closingData.total_variable_expenses || 0,
      net_profit: closingData.net_profit || 0,
      comentary: closingData.comentary || '',
      is_processed: false,
      created_at: new Date().toISOString()
    };
    
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
    
    console.log('✅ Cierre creado en BD, ID:', data.daily_closing_id);
    
    const closingId = data.daily_closing_id || data.id || data.daily_closing_ID;
    
    if (closingData.expense_ids && closingData.expense_ids.length > 0) {
      try {
        await this.markVariableExpensesAsProcessed(closingData.expense_ids, closingId);
        console.log(`✅ ${closingData.expense_ids.length} gastos variables marcados como procesados`);
      } catch (markError) {
        console.warn('⚠️ No se pudieron marcar algunos gastos:', markError.message);
      }
    }
    
    const settings = await this.getSystemSettings();
    const exchangeRate = settings?.exchange_rate || 36.5;
    
    const result = {
      ...data,
      daily_closing_id: closingId,
      closing_date_display: formatNicaraguaDate(data.closing_date),
      created_at_display: formatNicaraguaDateTime(data.created_at),
      total_income_usd: (data.total_income || 0) / exchangeRate,
      total_clinic_income_usd: (data.total_clinic_income || 0) / exchangeRate,
      total_doctor_income_usd: (data.total_doctor_income || 0) / exchangeRate,
      total_variable_expenses_usd: (data.total_variable_expenses || 0) / exchangeRate,
      net_profit_usd: (data.net_profit || 0) / exchangeRate,
      expenses_processed: closingData.expense_ids?.length || 0
    };
    
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
    console.log('🗑️ Eliminando cierre diario ID:', id);
    
    const { data, error } = await supabaseAdmin
      .from('daily_closings')
      .delete()
      .eq('daily_closing_id', id)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error eliminando cierre diario:', error);
      throw error;
    }
    
    console.log('✅ Cierre diario eliminado:', data);
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
      .maybeSingle();
    
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

  // Crear relaciones con procedimientos
  async createProcedureRelations(procedureClosings) {
    if (!procedureClosings || procedureClosings.length === 0) {
      console.log('ℹ️ No hay relaciones de procedimientos para crear');
      return [];
    }
    
    console.log('🔍 createProcedureRelations - Datos recibidos:', procedureClosings);
    
    const validProcedureClosings = procedureClosings.map(pc => {
      if (!pc.procedure_id) {
        console.error('❌ Falta procedure_id en:', pc);
        throw new Error('procedure_id es requerido');
      }
      
      if (!pc.daily_closing_id) {
        console.error('❌ Falta daily_closing_id en:', pc);
        throw new Error('daily_closing_id es requerido');
      }
      
      return {
        procedure_ID: pc.procedure_id,
        daily_closing_ID: pc.daily_closing_id,
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
      total_variable_expenses: 0,
      total_variable_expenses_usd: 0,
      total_net_profit: 0,
      total_net_profit_usd: 0,
      average_daily_profit: 0
    };
    
    if (data.length > 0) {
      data.forEach(closing => {
        stats.total_income += closing.total_income || 0;
        stats.total_clinic_income += closing.total_clinic_income || 0;
        stats.total_doctor_income += closing.total_doctor_income || 0;
        stats.total_variable_expenses += closing.total_variable_expenses || 0;
        stats.total_net_profit += closing.net_profit || 0;
      });
      
      stats.total_income_usd = stats.total_income / exchangeRate;
      stats.total_clinic_income_usd = stats.total_clinic_income / exchangeRate;
      stats.total_doctor_income_usd = stats.total_doctor_income / exchangeRate;
      stats.total_variable_expenses_usd = stats.total_variable_expenses / exchangeRate;
      stats.total_net_profit_usd = stats.total_net_profit / exchangeRate;
      stats.average_daily_profit = stats.total_net_profit / data.length;
    }
    
    return {
      data: data.map(closing => ({
        ...closing,
        closing_date_display: formatNicaraguaDate(closing.closing_date),
        total_income_usd: (closing.total_income || 0) / exchangeRate,
        total_clinic_income_usd: (closing.total_clinic_income || 0) / exchangeRate,
        total_doctor_income_usd: (closing.total_doctor_income || 0) / exchangeRate,
        total_variable_expenses_usd: (closing.total_variable_expenses || 0) / exchangeRate,
        net_profit_usd: (closing.net_profit || 0) / exchangeRate
      })),
      stats
    };
  },

  // Obtener gastos del día (solo para referencia)
  async getDailyBills(date) {
    const billDate = adjustDateForQuery(date);
    
    const { data, error } = await supabaseAdmin
      .from('bills')
      .select('*')
      .eq('bill_date', billDate)
      .eq('is_processed_in_closing', false);
    
    if (error) throw error;
    return data || [];
  }
};

export default DailyClosing;