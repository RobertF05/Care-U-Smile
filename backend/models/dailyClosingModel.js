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
      total_external_doctor_payments_usd: (data.total_external_doctor_payments || 0) / exchangeRate,
      total_variable_expenses_usd: (data.total_variable_expenses || 0) / exchangeRate,
      net_profit_usd: (data.net_profit || 0) / exchangeRate
    };
  },

  // models/dailyClosingModel.js
// CORREGIR la función getDailyVariableExpenses

async getDailyVariableExpenses(date) {
  console.log('🔍 Obteniendo gastos variables para el día:', date);
  
  // IMPORTANTE: La fecha ya viene en formato YYYY-MM-DD (Nicaragua)
  // Los bills tienen bill_date como DATE, no TIMESTAMP
  const queryDate = date; // Ya está en formato YYYY-MM-DD
  
  console.log('🔍 Buscando gastos con fecha:', queryDate);
  
  // Obtener gastos variables (no recurrentes) que NO han sido procesados
  // Y que corresponden a la fecha específica
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
      is_processed_in_daily_closing,
      processed_in_daily_closing_ID
    `)
    .eq('is_recurrent', false)  // Solo gastos variables
    .eq('is_processed_in_daily_closing', false)  // No procesados en cierre diario
    .eq('bill_date', queryDate);  // Comparar directamente con la fecha
  
  if (error) {
    console.error('❌ Error obteniendo gastos variables:', error);
    throw error;
  }
  
  console.log(`✅ Encontrados ${data?.length || 0} gastos variables para el día ${date}`);
  
  if (data && data.length > 0) {
    console.log('📋 Detalle de gastos variables:');
    data.forEach((bill, index) => {
      const amount = bill.currency_used === 'USD' 
        ? `$${bill.amount_usd} USD` 
        : `C$${bill.amount}`;
      console.log(`  ${index + 1}. ${bill.description}: ${amount} (${bill.category})`);
    });
  } else {
    console.log('ℹ️ No hay gastos variables para esta fecha');
  }
  
  return data || [];
},

  // models/dailyClosingModel.js
// CORREGIR la función markVariableExpensesAsProcessed

async markVariableExpensesAsProcessed(expenseIds, dailyClosingId) {
  if (!expenseIds || expenseIds.length === 0) return [];
  
  console.log('📝 Marcando gastos variables como procesados:', {
    expenseIds,
    dailyClosingId
  });
  
  const { data, error } = await supabaseAdmin
    .from('bills')
    .update({ 
      is_processed_in_daily_closing: true,
      processed_in_daily_closing_ID: dailyClosingId,
      is_processed_in_closing: true
    })
    .in('bill_ID', expenseIds)
    .select();
  
  if (error) {
    console.error('❌ Error marcando gastos variables:', error);
    throw error;
  }
  
  console.log(`✅ ${data?.length || 0} gastos variables marcados como procesados`);
  
  // Verificar que se marcaron correctamente
  if (data && data.length > 0) {
    console.log('📋 Gastos marcados:', data.map(b => ({
      id: b.bill_ID,
      desc: b.description,
      amount: b.amount
    })));
  }
  
  return data || [];
},

  // ============================================
  // FUNCIONES PARA PROCEDIMIENTOS
  // ============================================

  // Obtener procedimientos del día
  async getDailyProcedures(date, closingType = 'general') {
    console.log('🔍 DEBUG getDailyProcedures - Iniciando búsqueda:', {
      fechaRecibida: date,
      tipo: closingType
    });

    // IMPORTANTE: Crear rango para todo el día en Nicaragua
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
    
    // Convertir fechas a Nicaragua para mostrar
    const formattedData = data.map(procedure => ({
      ...procedure,
      procedure_date_display: formatNicaraguaDateTime(procedure.procedure_date),
      procedure_date_utc: procedure.procedure_date
    }));
    
    return formattedData;
  },

  // models/dailyClosingModel.js - CORREGIR getDailyFinancialSummary

async getDailyFinancialSummary(date, closingType = 'general') {
  console.log('🔍 Obteniendo resumen diario para:', { date, closingType });
  
  // Obtener procedimientos del día
  const procedures = await this.getDailyProcedures(date, closingType);
  
  // 🔴 CORREGIDO: Obtener TODOS los gastos variables del día (no solo no procesados)
  // Porque al recrear un cierre, necesitamos todos los gastos del día
  const variableExpenses = await this.getDailyVariableExpensesAll(date);
  
  console.log('📊 Procedimientos encontrados:', procedures.length);
  console.log('💰 Gastos variables encontrados:', variableExpenses.length);
  
  // Obtener configuración
  const settings = await this.getSystemSettings();
  const exchangeRate = settings.exchange_rate || 36.5;
  
  // Calcular ingresos
  let totalClinicIncomeCordobas = 0;
  let totalClinicIncomeDollars = 0;
  let totalDoctorIncomeCordobas = 0;
  let totalDoctorIncomeDollars = 0;
  let totalExternalDoctorPaymentsCordobas = 0;
  let totalExternalDoctorPaymentsDollars = 0;
  
  const procedureClosings = [];
  
  procedures.forEach(procedure => {
    // Sumar GANANCIA DE LA CLÍNICA
    const clinicCordobas = parseFloat(procedure.clinic_payment_cordobas) || 0;
    const clinicDollars = parseFloat(procedure.clinic_payment_dollars) || 0;
    totalClinicIncomeCordobas += clinicCordobas;
    totalClinicIncomeDollars += clinicDollars;
    
    // Sumar GANANCIA DE LA DOCTORA (si es ortodoncia)
    const doctorCordobas = parseFloat(procedure.doctor_payment_cordobas) || 0;
    const doctorDollars = parseFloat(procedure.doctor_payment_dollars) || 0;
    totalDoctorIncomeCordobas += doctorCordobas;
    totalDoctorIncomeDollars += doctorDollars;
    
    // Sumar PAGOS A DOCTORES EXTERNOS
    if (procedure.external_doctor_payment && procedure.external_doctor_payment > 0) {
      const externalPaymentCordobas = parseFloat(procedure.external_doctor_payment) || 0;
      
      // Convertir a dólares usando el tipo de cambio del procedimiento
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
  
  // 🔴 CORREGIDO: Calcular total de gastos variables de la tabla bills
  let totalVariableExpensesCordobas = 0;
  let totalVariableExpensesDollars = 0;
  const expenseDetails = [];
  const expenseIds = [];
  
  variableExpenses.forEach(expense => {
    // Calcular monto en córdobas
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
  
  // Calcular totales CON gastos incluidos
  let totalIncome = 0;
  let netProfit = 0;
  
  if (closingType === 'orthodontics') {
    totalIncome = totalClinicIncomeCordobas + totalDoctorIncomeCordobas;
    // Utilidad neta clínica = ganancia clínica - gastos variables
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
    total_variable_expenses: totalVariableExpensesCordobas,  // ← AHORA INCLUYE GASTOS DE BILLS
    total_variable_expenses_usd: totalVariableExpensesDollars,
    net_profit: netProfit,
    net_profit_usd: netProfit / exchangeRate,
    exchange_rate: exchangeRate,
    fecha_nicaragua: date,
    cantidad_procedimientos: procedures.length,
    cantidad_gastos_variables: variableExpenses.length,
    expense_ids: expenseIds // IDs para marcar como procesados
  };
  
  console.log('📋 Resumen diario CON GASTOS VARIABLES:', {
    total_clinic_income: result.total_clinic_income,
    total_variable_expenses: result.total_variable_expenses,
    net_profit: result.net_profit,
    cantidad_gastos: result.cantidad_gastos_variables,
    expense_ids: result.expense_ids
  });
  
  return result;
},

// 🔴 NUEVA FUNCIÓN: Obtener TODOS los gastos variables del día (procesados o no)
async getDailyVariableExpensesAll(date) {
  console.log('🔍 Obteniendo TODOS los gastos variables para el día:', date);
  
  // La fecha ya viene en formato YYYY-MM-DD
  const queryDate = date;
  
  console.log('🔍 Buscando TODOS los gastos con fecha:', queryDate);
  
  // Obtener gastos variables (no recurrentes) de la fecha específica
  // SIN filtrar por is_processed_in_daily_closing
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
      is_processed_in_daily_closing,
      processed_in_daily_closing_ID
    `)
    .eq('is_recurrent', false)  // Solo gastos variables
    .eq('bill_date', queryDate);  // Comparar directamente con la fecha
  
  if (error) {
    console.error('❌ Error obteniendo gastos variables:', error);
    throw error;
  }
  
  console.log(`✅ Encontrados ${data?.length || 0} gastos variables para el día ${date}`);
  console.log('📊 Estado de procesamiento:', {
    procesados: data?.filter(b => b.is_processed_in_daily_closing).length || 0,
    no_procesados: data?.filter(b => !b.is_processed_in_daily_closing).length || 0
  });
  
  return data || [];
},

  // models/dailyClosingModel.js
// CORREGIR la función create

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
  
  // IMPORTANTE: Asegurar que total_variable_expenses esté incluido
  const closingWithFormattedDate = {
    closing_date: closingDate,
    closing_type: closingData.closing_type,
    total_income: closingData.total_income || 0,
    total_clinic_income: closingData.total_clinic_income || 0,
    total_doctor_income: closingData.total_doctor_income || 0,
    total_external_doctor_payments: closingData.total_external_doctor_payments || 0,
    total_variable_expenses: closingData.total_variable_expenses || 0,  // ← CAMPO CRÍTICO
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
  
  console.log('✅ Cierre creado en BD, datos:', data);
  
  // Asegurar que tenemos el ID
  const closingId = data.daily_closing_id || data.id || data.daily_closing_ID;
  console.log('🆔 ID obtenido del cierre:', closingId);
  
  // DESPUÉS de crear el cierre, marcar los gastos variables como procesados
  if (closingData.expense_ids && closingData.expense_ids.length > 0) {
    try {
      await this.markVariableExpensesAsProcessed(closingData.expense_ids, closingId);
      console.log(`✅ ${closingData.expense_ids.length} gastos variables marcados como procesados`);
    } catch (markError) {
      console.warn('⚠️ No se pudieron marcar algunos gastos:', markError.message);
      // No fallar todo el proceso por esto
    }
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
    total_doctor_income_usd: (data.total_doctor_income || 0) / exchangeRate,
    total_variable_expenses_usd: (data.total_variable_expenses || 0) / exchangeRate,  // ← AÑADIDO
    net_profit_usd: (data.net_profit || 0) / exchangeRate,
    expenses_processed: closingData.expense_ids?.length || 0
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

  // models/dailyClosingModel.js
// CORREGIR la función createProcedureRelations

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
    
    // IMPORTANTE: Usar los nombres de columna EXACTOS de la base de datos
    return {
      procedure_ID: pc.procedure_id,           // ← Cambiado de procedure_id a procedure_ID
      daily_closing_ID: pc.daily_closing_id,   // ← Cambiado de daily_closing_id a daily_closing_ID
      clinic_income_portion: pc.clinic_income_portion || 0,
      doctor_income_portion: pc.doctor_income_portion || 0,
      external_doctor_payment: pc.external_doctor_payment || 0
    };
  });
  
  console.log('📤 Insertando en procedure_daily_closings con nombres correctos:', validProcedureClosings);
  
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