import { supabaseAdmin } from '../config/supabase.js';
import { 
  createMonthlyDateRange,
  formatNicaraguaDateTime,
  formatNicaraguaDate
} from '../utils/timezoneUtils.js';

const MonthlyClosing = {
  // Obtener todos los cierres
  async getAll(page = 1, limit = 12, filters = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    let query = supabaseAdmin
      .from('monthly_closings')
      .select('*', { count: 'exact' })
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    
    // Aplicar filtros si existen
    if (filters.closing_type) {
      query = query.eq('closing_type', filters.closing_type);
    }
    
    if (filters.year) {
      query = query.eq('year', filters.year);
    }
    
    query = query.range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    // Formatear fechas para mostrar
    const formattedData = data.map(closing => ({
      ...closing,
      closing_date_display: formatNicaraguaDate(closing.closing_date),
      fecha_creacion_display: formatNicaraguaDateTime(closing.closing_date),
      // Calcular valores si no existen
      total_clinic_income: (closing.total_general_income || 0) + (closing.total_clinical_orthodontic_income || 0),
      total_expenses: (closing.total_fixed_expenses || 0) + (closing.total_variable_expenses || 0)
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
      .from('monthly_closings')
      .select('*')
      .eq('closing_ID', id)
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      closing_date_display: formatNicaraguaDate(data.closing_date),
      fecha_creacion_display: formatNicaraguaDateTime(data.closing_date),
      total_clinic_income: (data.total_general_income || 0) + (data.total_clinical_orthodontic_income || 0),
      total_expenses: (data.total_fixed_expenses || 0) + (data.total_variable_expenses || 0)
    };
  },

  // Crear cierre
  async create(closingData) {
    console.log('📤 Insertando cierre con datos:', closingData);
    
    // Extraer solo las columnas que existen en la tabla
    const insertData = {
      month: closingData.month,
      year: closingData.year,
      closing_date: new Date().toISOString(),
      total_general_income: closingData.total_general_income || 0,
      total_clinical_orthodontic_income: closingData.total_clinical_orthodontic_income || 0,
      total_orthodontic_doctor_income: closingData.total_orthodontic_doctor_income || 0,
      total_fixed_expenses: closingData.total_fixed_expenses || 0,
      total_variable_expenses: closingData.total_variable_expenses || 0,
      net_profit: closingData.net_profit || 0,
      comentary: closingData.comentary || '',
      daily_closings_included: closingData.daily_closings_included || false,
      orthodontics_daily_closings_included: closingData.orthodontics_daily_closings_included || false,
      processed_variable_expenses: closingData.processed_variable_expenses || false,
      closing_type: closingData.closing_type || 'all'
    };
    
    console.log('📤 Datos filtrados para insertar:', insertData);
    
    const { data, error } = await supabaseAdmin
      .from('monthly_closings')
      .insert([insertData])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error Supabase al crear cierre:', error);
      throw error;
    }
    
    console.log('✅ Cierre creado exitosamente:', data);
    
    return {
      ...data,
      closing_date_display: formatNicaraguaDate(data.closing_date),
      fecha_creacion_display: formatNicaraguaDateTime(data.closing_date)
    };
  },

  // En monthlyClosingModel.js
async delete(id) {
  console.log('🗑️ Eliminando cierre mensual ID:', id);
  
  const { data, error } = await supabaseAdmin
    .from('monthly_closings')
    .delete()
    .eq('closing_ID', id)
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error eliminando cierre mensual:', error);
    throw error;
  }
  
  console.log('✅ Cierre mensual eliminado:', data);
  return data;
},

  // Verificar si existe cierre para mes/año/tipo
  async exists(month, year, closingType = 'all') {
    try {
      const { data, error } = await supabaseAdmin
        .from('monthly_closings')
        .select('closing_ID')
        .eq('month', month)
        .eq('year', parseInt(year))
        .eq('closing_type', closingType)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error en exists query:', error);
        throw error;
      }
      
      return !!data;
    } catch (error) {
      console.error('Error en exists:', error);
      return false;
    }
  },

  // Obtener configuraciones del sistema
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

  // En monthlyClosingModel.js, actualiza getGeneralProceduresStats
async getGeneralProceduresStats(startDate, endDate) {
  const { data, error } = await supabaseAdmin
    .from('procedures')
    .select(`
      total_procedure,
      total_procedure_usd,
      clinic_payment_cordobas,
      clinic_payment_dollars,
      external_doctor_payment,
      external_doctor_payment_usd,
      exchange_rate_used,
      is_orthodontics,
      theres_external_doctor
    `)
    .eq('is_orthodontics', false)
    .gte('procedure_date', startDate + 'T00:00:00')
    .lte('procedure_date', endDate + 'T23:59:59');
  
  if (error) throw error;
  
  // Usar clinic_payment_cordobas (ya incluye deducción de doctores externos)
  const clinicIncomeCordobas = data.reduce((sum, proc) => 
    sum + (parseFloat(proc.clinic_payment_cordobas) || 0), 0);
  
  const clinicIncomeDollars = data.reduce((sum, proc) => 
    sum + (parseFloat(proc.clinic_payment_dollars) || 0), 0);
  
  // Calcular pagos a doctores externos
  const totalExternalDoctorPaymentsCordobas = data.reduce((sum, proc) => {
    if (proc.theres_external_doctor) {
      const payment = parseFloat(proc.external_doctor_payment) || 0;
      return sum + payment;
    }
    return sum;
  }, 0);
  
  const totalExternalDoctorPaymentsUsd = data.reduce((sum, proc) => {
    if (proc.theres_external_doctor) {
      const payment = parseFloat(proc.external_doctor_payment_usd) || 0;
      return sum + payment;
    }
    return sum;
  }, 0);
  
  console.log('📊 Estadísticas generales:', {
    count: data.length,
    clinicIncomeCordobas,
    clinicIncomeDollars,
    totalExternalDoctorPaymentsCordobas,
    totalExternalDoctorPaymentsUsd,
    procedimientos_con_doctor_externo: data.filter(p => p.theres_external_doctor).length
  });
  
  return {
    general_income: clinicIncomeCordobas,
    general_income_usd: clinicIncomeDollars,
    clinic_income: clinicIncomeCordobas,
    total_external_doctor_payments: totalExternalDoctorPaymentsCordobas,
    total_external_doctor_payments_usd: totalExternalDoctorPaymentsUsd,
    procedure_count: data.length,
    external_doctor_count: data.filter(p => p.theres_external_doctor).length
  };
},

  // models/monthlyClosingModel.js - getOrthodonticsProceduresStats actualizado CORRECTAMENTE
async getOrthodonticsProceduresStats(startDate, endDate, clinicPercentage, doctorPercentage) {
  const { data, error } = await supabaseAdmin
    .from('procedures')
    .select(`
      total_procedure,
      total_procedure_usd,
      clinic_payment_cordobas,
      clinic_payment_dollars,
      doctor_payment_cordobas,
      doctor_payment_dollars,
      external_doctor_payment,
      exchange_rate_used,
      is_orthodontics
    `)
    .eq('is_orthodontics', true)
    .gte('procedure_date', startDate + 'T00:00:00')
    .lte('procedure_date', endDate + 'T23:59:59');
  
  if (error) throw error;
  
  // Usar los campos CORRECTOS ya calculados
  const clinicIncomeCordobas = data.reduce((sum, proc) => 
    sum + (parseFloat(proc.clinic_payment_cordobas) || 0), 0);
  
  const clinicIncomeDollars = data.reduce((sum, proc) => 
    sum + (parseFloat(proc.clinic_payment_dollars) || 0), 0);
  
  const doctorIncomeCordobas = data.reduce((sum, proc) => 
    sum + (parseFloat(proc.doctor_payment_cordobas) || 0), 0);
  
  const doctorIncomeDollars = data.reduce((sum, proc) => 
    sum + (parseFloat(proc.doctor_payment_dollars) || 0), 0);
  
  // Calcular pagos a doctores externos
  const totalExternalDoctorPaymentsCordobas = data.reduce((sum, proc) => {
    const payment = parseFloat(proc.external_doctor_payment) || 0;
    return sum + payment;
  }, 0);
  
  // Lo que pagó el paciente (solo para referencia)
  const totalPatientPaymentCordobas = data.reduce((sum, proc) => 
    sum + (proc.total_procedure || 0), 0);
  
  console.log('📊 Estadísticas ortodoncia CORRECTAS:', {
    count: data.length,
    clinicIncomeCordobas,
    clinicIncomeDollars,
    doctorIncomeCordobas,
    doctorIncomeDollars,
    totalExternalDoctorPaymentsCordobas,
    totalPatientPaymentCordobas,
    procedimientos_con_doctor_externo: data.filter(p => p.external_doctor_payment > 0).length
  });
  
  return {
    orthodontic_income: clinicIncomeCordobas + doctorIncomeCordobas, // Total ganancias
    orthodontic_income_usd: clinicIncomeDollars + doctorIncomeDollars,
    clinic_orthodontic_income: clinicIncomeCordobas,
    doctor_orthodontic_income: doctorIncomeCordobas,
    clinic_orthodontic_income_usd: clinicIncomeDollars,
    doctor_orthodontic_income_usd: doctorIncomeDollars,
    total_external_doctor_payments: totalExternalDoctorPaymentsCordobas,
    clinic_income: clinicIncomeCordobas,
    clinic_income_usd: clinicIncomeDollars,
    total_patient_payment: totalPatientPaymentCordobas, // Para referencia
    procedure_count: data.length
  };
},

  // Obtener todas las estadísticas
  async getAllProceduresStats(startDate, endDate, clinicPercentage, doctorPercentage) {
    const [generalStats, orthoStats] = await Promise.all([
      this.getGeneralProceduresStats(startDate, endDate),
      this.getOrthodonticsProceduresStats(startDate, endDate, clinicPercentage, doctorPercentage)
    ]);
    
    console.log('📊 Combinando estadísticas:', {
      general: generalStats.general_income,
      orthoClinic: orthoStats.clinic_orthodontic_income,
      orthoDoctor: orthoStats.doctor_orthodontic_income,
      totalClinic: generalStats.clinic_income + orthoStats.clinic_income
    });
    
    return {
      general_income: generalStats.general_income,
      general_income_usd: generalStats.general_income_usd,
      clinic_orthodontic_income: orthoStats.clinic_orthodontic_income,
      doctor_orthodontic_income: orthoStats.doctor_orthodontic_income,
      clinic_income: generalStats.clinic_income + orthoStats.clinic_income,
      clinic_income_usd: (generalStats.general_income_usd || 0) + (orthoStats.clinic_income_usd || 0),
      orthodontic_income: orthoStats.orthodontic_income,
      orthodontic_income_usd: orthoStats.orthodontic_income_usd,
      total_procedures: generalStats.procedure_count + orthoStats.procedure_count
    };
  },

// MODIFICAR getExpenseStats para usar las nuevas funciones
async getExpenseStats(startDate, endDate) {
  console.log('📊 Obteniendo estadísticas de gastos para cierre mensual:', { startDate, endDate });
  
  try {
    // Obtener configuración para conversiones
    const settings = await this.getSystemSettings();
    const defaultExchangeRate = settings?.exchange_rate || 36.5;
    
    // ============================================
    // 1. GASTOS FIJOS: Todos los del período
    // ============================================
    const fixedBills = await this.getFixedExpensesInRange(startDate, endDate);
    
    // ============================================
    // 2. GASTOS VARIABLES: Todos los del período (incluyendo ya procesados)
    // ============================================
    const variableBillsData = await this.getVariableExpensesForMonthly(startDate, endDate);
    
    // Función para calcular monto en córdobas
    const calculateAmountInCordobas = (bill) => {
      if (!bill) return 0;
      
      // Si hay amount directo en córdobas
      if (bill.amount && parseFloat(bill.amount) > 0) {
        return parseFloat(bill.amount);
      }
      
      // Si es USD, convertir
      if (bill.currency_used === 'USD') {
        const amountUSD = parseFloat(bill.amount_usd) || 0;
        const exchangeRate = parseFloat(bill.exchange_rate_bill) || defaultExchangeRate;
        return amountUSD * exchangeRate;
      }
      
      return 0;
    };
    
    // Calcular total de gastos fijos
    const fixedExpenses = fixedBills.reduce((sum, bill) => {
      return sum + calculateAmountInCordobas(bill);
    }, 0);
    
    // Calcular total de gastos variables (TODOS, independientemente de si ya están en cierres diarios)
    const variableExpenses = variableBillsData.all.reduce((sum, bill) => {
      return sum + calculateAmountInCordobas(bill);
    }, 0);
    
    const totalExpenses = fixedExpenses + variableExpenses;
    
    console.log('📊 RESUMEN COMPLETO DE GASTOS PARA CIERRE MENSUAL:', {
      gastosFijos: {
        cantidad: fixedBills.length,
        totalCordobas: fixedExpenses
      },
      gastosVariables: {
        total: variableBillsData.all.length,
        procesadosEnDiarios: variableBillsData.processedInDaily.length,
        noProcesados: variableBillsData.notProcessed.length,
        totalCordobas: variableExpenses
      },
      totalGastos: totalExpenses
    });
    
    return {
      fixed_expenses: fixedExpenses,
      variable_expenses: variableExpenses,
      total_expenses: totalExpenses,
      fixed_bills: fixedBills,
      variable_bills: variableBillsData.all,
      metadata: {
        total_fixed_bills: fixedBills.length,
        total_variable_bills: variableBillsData.all.length,
        variable_processed_in_daily: variableBillsData.processedInDaily.length,
        variable_not_processed: variableBillsData.notProcessed.length
      }
    };
  } catch (error) {
    console.error('❌ Error en getExpenseStats:', error);
    return { 
      fixed_expenses: 0, 
      variable_expenses: 0, 
      total_expenses: 0,
      fixed_bills: [],
      variable_bills: [],
      metadata: { error: error.message }
    };
  }
},

// AÑADIR función para obtener procedimientos con doctores externos (si no existe)
async getExternalDoctorPayments(startDate, endDate, closingType = 'all') {
  try {
    console.log('💰 Obteniendo pagos a doctores externos:', { startDate, endDate, closingType });
    
    let query = supabaseAdmin
      .from('procedures')
      .select(`
        procedure_ID,
        procedure_description,
        procedure_date,
        patients (first_name, first_last_name),
        total_procedure,
        theres_external_doctor,
        external_doctor_name,
        external_doctor_payment,
        external_doctor_payment_usd,
        external_doctor_payment_type,
        exchange_rate_used,
        is_orthodontics
      `)
      .eq('theres_external_doctor', true)
      .gte('procedure_date', startDate + 'T00:00:00')
      .lte('procedure_date', endDate + 'T23:59:59');
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Filtrar por tipo de cierre si es necesario
    let filteredData = data || [];
    if (closingType !== 'all') {
      const isOrtho = closingType === 'orthodontics';
      filteredData = filteredData.filter(proc => proc.is_orthodontics === isOrtho);
    }
    
    // Calcular totales
    const totalCordobas = filteredData.reduce((sum, proc) => {
      return sum + (parseFloat(proc.external_doctor_payment) || 0);
    }, 0);
    
    const totalUsd = filteredData.reduce((sum, proc) => {
      return sum + (parseFloat(proc.external_doctor_payment_usd) || 0);
    }, 0);
    
    console.log('💰 Pagos a doctores externos:', {
      count: filteredData.length,
      totalCordobas,
      totalUsd
    });
    
    return {
      payments: filteredData,
      total_payments_cordobas: totalCordobas,
      total_payments_usd: totalUsd,
      count: filteredData.length
    };
  } catch (error) {
    console.error('❌ Error en getExternalDoctorPayments:', error);
    return {
      payments: [],
      total_payments_cordobas: 0,
      total_payments_usd: 0,
      count: 0
    };
  }
},

// En monthlyClosingModel.js, agregar:
async verifyDateRange(startDate, endDate) {
  console.log('📅 Verificando rango de fechas:', { startDate, endDate });
  
  // Convertir a objetos Date para verificación
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  console.log('📅 Fechas convertidas:', {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    startIsValid: !isNaN(start.getTime()),
    endIsValid: !isNaN(end.getTime())
  });
  
  return {
    startDate: startDate,
    endDate: endDate,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    isValid: !isNaN(start.getTime()) && !isNaN(end.getTime())
  };
},

  // MODIFICAR getFinancialSummary para asegurar que los gastos variables se incluyan correctamente
async getFinancialSummary(startDate, endDate, closingType = 'all') {
  console.log('📊 Obteniendo resumen financiero mensual:', {
    inicio: startDate,
    fin: endDate,
    tipo: closingType
  });
  
  // Obtener configuración del sistema
  const settings = await this.getSystemSettings();
  const clinicPercentage = settings.clinic_payment || 40;
  const doctorPercentage = settings.doctor_payment || 60;
  
  // Obtener estadísticas según el tipo de cierre
  let incomeStats;
  let expenseStats = { 
    fixed_expenses: 0, 
    variable_expenses: 0, 
    total_expenses: 0,
    fixed_bills: [],
    variable_bills: [],
    metadata: {}
  };
  
  // Obtener pagos a doctores externos
  const externalDoctorStats = await this.getExternalDoctorPayments(startDate, endDate, closingType);
  
  if (closingType === 'general') {
    incomeStats = await this.getGeneralProceduresStats(startDate, endDate);
  } else if (closingType === 'orthodontics') {
    incomeStats = await this.getOrthodonticsProceduresStats(startDate, endDate, clinicPercentage, doctorPercentage);
  } else {
    // 'all' - ambos tipos
    incomeStats = await this.getAllProceduresStats(startDate, endDate, clinicPercentage, doctorPercentage);
    
    // Obtener gastos (incluye TODOS los variables del período)
    try {
      expenseStats = await this.getExpenseStats(startDate, endDate);
      console.log('💰 Gastos obtenidos para cierre mensual:', {
        fijos: expenseStats.fixed_expenses,
        variables: expenseStats.variable_expenses,
        total: expenseStats.total_expenses,
        metadata: expenseStats.metadata
      });
    } catch (expenseError) {
      console.error('❌ Error obteniendo gastos, usando valores por defecto:', expenseError);
    }
  }
  
  console.log('📊 Estadísticas obtenidas:', {
    incomeStats,
    expenseStats,
    externalDoctorStats,
    closingType
  });
  
  const generalIncome = incomeStats.general_income || 0;
  const clinicOrthodonticIncome = incomeStats.clinic_orthodontic_income || 0;
  const doctorOrthodonticIncome = incomeStats.doctor_orthodontic_income || 0;
  const clinicIncome = incomeStats.clinic_income || generalIncome + clinicOrthodonticIncome;
  
  let totalExpenses = 0;
  
  if (closingType === 'all') {
    totalExpenses = expenseStats.total_expenses || 0;
  }
  
  const netProfit = clinicIncome - totalExpenses;
  
  console.log('🧮 Cálculos finales cierre mensual:', {
    generalIncome,
    clinicOrthodonticIncome,
    doctorOrthodonticIncome,
    clinicIncome,
    totalExpenses,
    netProfit,
    closingType,
    externalDoctors: externalDoctorStats.total_payments_cordobas,
    gastosVariablesIncluidos: expenseStats.metadata?.total_variable_bills || 0,
    gastosVariablesProcesadosEnDiarios: expenseStats.metadata?.variable_processed_in_daily || 0,
    formula: `Utilidad = ${clinicIncome} - ${totalExpenses} = ${netProfit}`
  });
  
  return {
    total_general_income: generalIncome,
    total_clinical_orthodontic_income: clinicOrthodonticIncome,
    total_orthodontic_doctor_income: doctorOrthodonticIncome,
    total_fixed_expenses: expenseStats.fixed_expenses || 0,
    total_variable_expenses: expenseStats.variable_expenses || 0,
    net_profit: netProfit,
    closing_type: closingType,
    // Campos adicionales
    total_external_doctor_payments: externalDoctorStats.total_payments_cordobas,
    total_external_doctor_payments_usd: externalDoctorStats.total_payments_usd,
    external_doctor_count: externalDoctorStats.count || 0,
    clinic_percentage: clinicPercentage,
    doctor_percentage: doctorPercentage,
    exchange_rate: settings.exchange_rate || 36.5,
    // Metadatos de gastos
    expense_metadata: {
      variable_expenses_total: expenseStats.variable_expenses || 0,
      variable_expenses_count: expenseStats.metadata?.total_variable_bills || 0,
      variable_expenses_in_daily: expenseStats.metadata?.variable_processed_in_daily || 0,
      fixed_expenses_count: expenseStats.metadata?.total_fixed_bills || 0
    }
  };
},

// En monthlyClosingModel.js, actualiza getFinancialSummary
async getFinancialSummary(startDate, endDate, closingType = 'all') {
  console.log('Obteniendo resumen financiero:', {
    inicio: startDate,
    fin: endDate,
    tipo: closingType
  });
  
  // Obtener configuración del sistema
  const settings = await this.getSystemSettings();
  const clinicPercentage = settings.clinic_payment || 40;
  const doctorPercentage = settings.doctor_payment || 60;
  
  // Obtener estadísticas según el tipo de cierre
  let incomeStats;
  let expenseStats = { 
    fixed_expenses: 0, 
    variable_expenses: 0, 
    total_expenses: 0,
    fixed_bills: [],
    variable_bills: [] 
  };
  
  // Obtener pagos a doctores externos
  const externalDoctorStats = await this.getExternalDoctorPayments(startDate, endDate, closingType);
  
  if (closingType === 'general') {
    incomeStats = await this.getGeneralProceduresStats(startDate, endDate);
  } else if (closingType === 'orthodontics') {
    incomeStats = await this.getOrthodonticsProceduresStats(startDate, endDate, clinicPercentage, doctorPercentage);
  } else {
    // 'all' - ambos tipos
    incomeStats = await this.getAllProceduresStats(startDate, endDate, clinicPercentage, doctorPercentage);
    
    // Obtener gastos
    try {
      expenseStats = await this.getExpenseStats(startDate, endDate);
      console.log('💰 Gastos obtenidos para el cierre:', expenseStats);
    } catch (expenseError) {
      console.error('❌ Error obteniendo gastos, usando valores por defecto:', expenseError);
    }
  }
  
  console.log('📊 Estadísticas obtenidas:', {
    incomeStats,
    expenseStats,
    externalDoctorStats,
    closingType
  });
  
  const generalIncome = incomeStats.general_income || 0;
  const clinicOrthodonticIncome = incomeStats.clinic_orthodontic_income || 0;
  const doctorOrthodonticIncome = incomeStats.doctor_orthodontic_income || 0;
  const clinicIncome = incomeStats.clinic_income || generalIncome + clinicOrthodonticIncome;
  
  let totalExpenses = 0;
  
  if (closingType === 'all') {
    totalExpenses = expenseStats.total_expenses || 0;
  }
  
  const netProfit = clinicIncome - totalExpenses;
  
  console.log('🧮 Cálculos finales:', {
    generalIncome,
    clinicOrthodonticIncome,
    doctorOrthodonticIncome,
    clinicIncome,
    totalExpenses,
    netProfit,
    closingType,
    externalDoctors: externalDoctorStats.total_payments_cordobas,
    formula: `Utilidad = ${clinicIncome} - ${totalExpenses} = ${netProfit}`
  });
  
  return {
    total_general_income: generalIncome,
    total_clinical_orthodontic_income: clinicOrthodonticIncome,
    total_orthodontic_doctor_income: doctorOrthodonticIncome,
    total_fixed_expenses: expenseStats.fixed_expenses || 0,
    total_variable_expenses: expenseStats.variable_expenses || 0,
    net_profit: netProfit,
    closing_type: closingType,
    // Campos adicionales para pagos a doctores externos
    total_external_doctor_payments: externalDoctorStats.total_payments_cordobas,
    total_external_doctor_payments_usd: externalDoctorStats.total_payments_usd,
    external_doctor_count: externalDoctorStats.count,
    clinic_percentage: clinicPercentage,
    doctor_percentage: doctorPercentage,
    exchange_rate: settings.exchange_rate || 36.5
  };
},

  // Obtener resumen por mes específico
  async getMonthlySummary(month, year, closingType = 'all') {
    const { start, end } = createMonthlyDateRange(year, month);
    
    console.log('Calculando resumen mensual:', {
      mes: month,
      año: year,
      tipo: closingType,
      inicioUTC: start,
      finUTC: end
    });
    
    return await this.getFinancialSummary(
      new Date(start).toISOString().split('T')[0],
      new Date(end).toISOString().split('T')[0],
      closingType
    );
  },

  // Obtener gastos variables del período, considerando si ya están en cierres diarios
async getVariableExpensesForMonthly(startDate, endDate) {
  console.log('💰 Obteniendo gastos variables para cierre mensual:', { startDate, endDate });
  
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
    .eq('is_recurrent', false) // Solo gastos variables
    .gte('bill_date', startDate)
    .lte('bill_date', endDate);
  
  if (error) {
    console.error('❌ Error obteniendo gastos variables:', error);
    throw error;
  }
  
  console.log(`📊 Encontrados ${data?.length || 0} gastos variables en el período`);
  
  // Separar gastos ya procesados en cierres diarios
  const processedInDaily = (data || []).filter(b => b.is_processed_in_daily_closing === true);
  const notProcessed = (data || []).filter(b => b.is_processed_in_daily_closing !== true);
  
  console.log('📋 Estado de gastos variables:', {
    total: data?.length || 0,
    procesadosEnCierresDiarios: processedInDaily.length,
    noProcesados: notProcessed.length
  });
  
  return {
    all: data || [],
    processedInDaily,
    notProcessed
  };
},

// Obtener gastos fijos del período
async getFixedExpensesInRange(startDate, endDate) {
  console.log('💰 Obteniendo gastos fijos:', { startDate, endDate });
  
  const { data, error } = await supabaseAdmin
    .from('bills')
    .select('*')
    .eq('is_recurrent', true) // Solo gastos fijos
    .gte('bill_date', startDate)
    .lte('bill_date', endDate);
  
  if (error) {
    console.error('❌ Error obteniendo gastos fijos:', error);
    throw error;
  }
  
  console.log(`📊 Encontrados ${data?.length || 0} gastos fijos en el período`);
  return data || [];
},

// AÑADIR función para obtener detalles de doctores externos por período
async getExternalDoctorDetails(startDate, endDate, closingType = 'all') {
  try {
    let query = supabaseAdmin
      .from('procedures')
      .select(`
        procedure_ID,
        procedure_date,
        procedure_description,
        patients (first_name, first_last_name),
        theres_external_doctor,
        external_doctor_name,
        external_doctor_specialty,
        external_doctor_payment,
        external_doctor_payment_usd,
        external_doctor_payment_type,
        external_doctor_payment_value,
        external_doctor_payment_currency,
        exchange_rate_used,
        is_orthodontics
      `)
      .eq('theres_external_doctor', true)
      .gte('procedure_date', startDate + 'T00:00:00')
      .lte('procedure_date', endDate + 'T23:59:59')
      .order('procedure_date', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Filtrar por tipo de cierre
    let filteredData = data || [];
    if (closingType !== 'all') {
      const isOrtho = closingType === 'orthodontics';
      filteredData = filteredData.filter(proc => proc.is_orthodontics === isOrtho);
    }
    
    // Formatear datos
    const details = filteredData.map(proc => ({
      procedure_id: proc.procedure_ID,
      procedure_date: proc.procedure_date,
      procedure_description: proc.procedure_description,
      patient_name: proc.patients ? 
        `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
        'N/A',
      doctor_name: proc.external_doctor_name || 'No especificado',
      doctor_specialty: proc.external_doctor_specialty || 'General',
      payment_cordobas: parseFloat(proc.external_doctor_payment) || 0,
      payment_usd: parseFloat(proc.external_doctor_payment_usd) || 0,
      payment_type: proc.external_doctor_payment_type || 'fixed',
      payment_value: proc.external_doctor_payment_value,
      payment_currency: proc.external_doctor_payment_currency || 'C$',
      is_orthodontics: proc.is_orthodontics,
      exchange_rate_used: proc.exchange_rate_used
    }));
    
    // Calcular totales
    const totalCordobas = details.reduce((sum, d) => sum + d.payment_cordobas, 0);
    const totalUsd = details.reduce((sum, d) => sum + d.payment_usd, 0);
    
    return {
      payments: details,
      summary: {
        total_payments_cordobas: totalCordobas,
        total_payments_usd: totalUsd,
        count: details.length,
        count_orthodontics: details.filter(d => d.is_orthodontics).length,
        count_general: details.filter(d => !d.is_orthodontics).length
      }
    };
  } catch (error) {
    console.error('❌ Error en getExternalDoctorDetails:', error);
    throw error;
  }
}
};

export default MonthlyClosing;