// backend/models/dailyClosingModel.js
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
      query = query.gte('closing_date', filters.startDate);
    }
    
    if (filters.endDate) {
      query = query.lte('closing_date', filters.endDate);
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
  // FUNCIÓN ESTABLE PARA RESULTADOS EN VIVO
  // ============================================
  // En dailyClosingModel.js - función getDailyFinancialSummary CORREGIDA
async getDailyFinancialSummary(date) {
  console.log('🔍 [RESULTADOS EN VIVO] Obteniendo resumen diario para fecha:', date);
  
  // 1. Obtener TODOS los procedimientos del día
  // IMPORTANTE: Usar comillas dobles para campos con mayúsculas en la consulta
  const { data: procedures, error: procError } = await supabaseAdmin
    .from('procedures')
    .select(`
      *,
      patients!inner (
        "Patient_ID",
        first_name,
        first_last_name
      )
    `)
    .eq('procedure_date::date', date);
  
  if (procError) {
    console.error('❌ Error obteniendo procedimientos:', procError);
    throw procError;
  }
  
  console.log('📊 Procedimientos encontrados:', procedures?.length || 0);
  if (procedures && procedures.length > 0) {
    console.log('📋 Detalle de procedimientos:');
    procedures.forEach((proc, index) => {
      console.log(`   ${index + 1}. ID: ${proc.procedure_ID}, Monto: ${proc.clinic_payment_cordobas}`);
    });
  } else {
    console.log('⚠️ NO HAY PROCEDIMIENTOS para la fecha:', date);
  }
  
  // 2. Obtener TODOS los gastos variables del día
  const { data: expenses, error: expError } = await supabaseAdmin
    .from('bills')
    .select('*')
    .eq('is_recurrent', false)
    .eq('bill_date', date);
  
  if (expError) {
    console.error('❌ Error obteniendo gastos:', expError);
    throw expError;
  }
  
  console.log('💰 Gastos encontrados:', expenses?.length || 0);
  
  const settings = await this.getSystemSettings();
  const exchangeRate = settings.exchange_rate || 36.5;
  
  // Calcular ingresos totales de la clínica
  let totalClinicIncome = 0;
  let totalGeneralIncome = 0;
  let totalOrthoClinicIncome = 0;
  let totalOrthoDoctorIncome = 0;
  
  (procedures || []).forEach(procedure => {
    // Usar los nombres de campo correctos de la BD
    const clinicPayment = parseFloat(procedure.clinic_payment_cordobas) || 0;
    totalClinicIncome += clinicPayment;
    
    if (procedure.is_orthodontics) {
      totalOrthoClinicIncome += clinicPayment;
      totalOrthoDoctorIncome += parseFloat(procedure.doctor_payment_cordobas) || 0;
    } else {
      totalGeneralIncome += clinicPayment;
    }
  });
  
  // Calcular gastos totales
  let totalExpenses = 0;
  const expenseDetails = [];
  const expenseIds = [];
  
  (expenses || []).forEach(expense => {
    let amount = 0;
    if (expense.currency_used === 'USD') {
      const usdAmount = parseFloat(expense.amount_usd) || 0;
      const rate = parseFloat(expense.exchange_rate_bill) || exchangeRate;
      amount = usdAmount * rate;
    } else {
      amount = parseFloat(expense.amount) || 0;
    }
    
    totalExpenses += amount;
    expenseIds.push(expense.bill_ID);
    
    expenseDetails.push({
      bill_id: expense.bill_ID,
      description: expense.description,
      amount: amount,
      amount_original: expense.amount,
      amount_usd_original: expense.amount_usd,
      currency_used: expense.currency_used,
      category: expense.category,
      exchange_rate_used: expense.exchange_rate_bill || exchangeRate,
      is_processed_in_closing: expense.is_processed_in_closing || false
    });
  });
  
  // Calcular utilidad neta
  const netProfit = totalClinicIncome - totalExpenses;
  
  console.log('💰💰💰 RESUMEN FINAL:', {
    ingresos_totales: totalClinicIncome,
    generales: totalGeneralIncome,
    ortodoncia_clinica: totalOrthoClinicIncome,
    ortodoncia_doctora: totalOrthoDoctorIncome,
    gastos_totales: totalExpenses,
    utilidad_neta: netProfit,
    cantidad_gastos: expenses?.length || 0,
    cantidad_procedimientos: procedures?.length || 0
  });
  
  const result = {
    procedures: procedures || [],
    total_income: totalClinicIncome,
    total_general_income: totalGeneralIncome,
    total_ortho_clinic_income: totalOrthoClinicIncome,
    total_ortho_doctor_income: totalOrthoDoctorIncome,
    total_clinic_income: totalClinicIncome,
    total_variable_expenses: totalExpenses,
    net_profit: netProfit,
    exchange_rate: exchangeRate,
    fecha_nicaragua: date,
    cantidad_procedimientos: procedures?.length || 0,
    cantidad_gastos_variables: expenses?.length || 0,
    expense_ids: expenseIds,
    expense_details: expenseDetails
  };
  
  console.log('📤 Resultado final a enviar:', {
    procedimientos: result.cantidad_procedimientos,
    ingresos: result.total_income,
    gastos: result.total_variable_expenses,
    utilidad: result.net_profit
  });
  
  return result;
},

  // ============================================
  // FUNCIÓN PARA CIERRES (solo gastos NO procesados)
  // ============================================
  async getDailyClosingSummary(date, closingType = 'general') {
    console.log('🔍 [VERSIÓN PARA CIERRES] Obteniendo resumen diario para cierre:', { date, closingType });
    
    // Para cierres, necesitamos filtrar por tipo
    const { data: procedures, error: procError } = await supabaseAdmin
      .from('procedures')
      .select(`
        *,
        patients (first_name, first_last_name)
      `)
      .eq('procedure_date::date', date)
      .eq('is_orthodontics', closingType === 'orthodontics');
    
    if (procError) {
      console.error('❌ Error obteniendo procedimientos para cierre:', procError);
      throw procError;
    }
    
    // Para cierres, SOLO gastos NO procesados
    const { data: expenses, error: expError } = await supabaseAdmin
      .from('bills')
      .select('*')
      .eq('is_recurrent', false)
      .eq('is_processed_in_closing', false)
      .is('processed_in_daily_closing_ID', null)
      .eq('bill_date', date);
    
    if (expError) {
      console.error('❌ Error obteniendo gastos para cierre:', expError);
      throw expError;
    }
    
    console.log('📊 Procedimientos encontrados para cierre:', procedures?.length || 0);
    console.log('💰 Gastos variables NO procesados encontrados:', expenses?.length || 0);
    
    const settings = await this.getSystemSettings();
    const exchangeRate = settings.exchange_rate || 36.5;
    
    let totalClinicIncomeCordobas = 0;
    let totalClinicIncomeDollars = 0;
    let totalDoctorIncomeCordobas = 0;
    let totalDoctorIncomeDollars = 0;
    let totalExternalDoctorPaymentsCordobas = 0;
    let totalExternalDoctorPaymentsDollars = 0;
    
    const procedureClosings = [];
    
    (procedures || []).forEach(procedure => {
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
    
    (expenses || []).forEach(expense => {
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
      procedures: procedures || [],
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
      cantidad_procedimientos: procedures?.length || 0,
      cantidad_gastos_variables: expenses?.length || 0,
      expense_ids: expenseIds
    };
    
    console.log('📋 [CIERRES] Resumen diario con gastos NO procesados:', {
      total_clinic_income: result.total_clinic_income,
      total_variable_expenses: result.total_variable_expenses,
      net_profit: result.net_profit,
      cantidad_gastos: result.cantidad_gastos_variables
    });
    
    return result;
  },

  // Crear cierre diario
  async create(closingData) {
    console.log('🔍 create - Datos recibidos:', closingData);
    
    const closingWithFormattedDate = {
      closing_date: closingData.closing_date,
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
    const { data, error } = await supabaseAdmin
      .from('daily_closings')
      .select('daily_closing_id')
      .eq('closing_date', date)
      .eq('closing_type', type)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  },

  // Marcar gastos variables como procesados
  async markVariableExpensesAsProcessed(expenseIds, dailyClosingId) {
    if (!expenseIds || expenseIds.length === 0) return [];
    
    console.log('📝 Marcando gastos variables como procesados:', {
      expenseIds,
      dailyClosingId
    });
    
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
    
    const validProcedureClosings = procedureClosings.map(pc => {
      if (!pc.procedure_id) {
        throw new Error('procedure_id es requerido');
      }
      
      if (!pc.daily_closing_id) {
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
    
    try {
      const { data, error } = await supabaseAdmin
        .from('procedure_daily_closings')
        .insert(validProcedureClosings)
        .select();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('❌ Error en createProcedureRelations:', error);
      throw error;
    }
  }
};

export default DailyClosing;