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

  // Obtener estadísticas de procedimientos generales - USANDO total_procedure
  async getGeneralProceduresStats(startDate, endDate) {
    const { data, error } = await supabaseAdmin
      .from('procedures')
      .select('total_procedure, total_procedure_usd, exchange_rate_used')
      .eq('is_orthodontics', false)
      .gte('procedure_date', startDate + 'T00:00:00')
      .lte('procedure_date', endDate + 'T23:59:59');
    
    if (error) throw error;
    
    // Usar total_procedure y total_procedure_usd que ya están calculados
    const totalCordobas = data.reduce((sum, proc) => sum + (proc.total_procedure || 0), 0);
    const totalDollars = data.reduce((sum, proc) => sum + (proc.total_procedure_usd || 0), 0);
    
    console.log('📊 Estadísticas generales:', {
      totalCordobas,
      totalDollars,
      count: data.length,
      procedimientos: data.map(p => ({ 
        total_procedure: p.total_procedure, 
        total_procedure_usd: p.total_procedure_usd 
      }))
    });
    
    return {
      general_income: totalCordobas,
      general_income_usd: totalDollars,
      clinic_income: totalCordobas,  // 100% para clínica en procedimientos generales
      procedure_count: data.length
    };
  },

  // Obtener estadísticas de ortodoncia - USANDO total_procedure y aplicando porcentajes
  async getOrthodonticsProceduresStats(startDate, endDate, clinicPercentage, doctorPercentage) {
    const { data, error } = await supabaseAdmin
      .from('procedures')
      .select('total_procedure, total_procedure_usd, exchange_rate_used')
      .eq('is_orthodontics', true)
      .gte('procedure_date', startDate + 'T00:00:00')
      .lte('procedure_date', endDate + 'T23:59:59');
    
    if (error) throw error;
    
    // Usar total_procedure y total_procedure_usd que ya están calculados
    const totalCordobas = data.reduce((sum, proc) => sum + (proc.total_procedure || 0), 0);
    const totalDollars = data.reduce((sum, proc) => sum + (proc.total_procedure_usd || 0), 0);
    
    // Aplicar porcentajes
    const clinicPortionCordobas = totalCordobas * (clinicPercentage / 100);
    const doctorPortionCordobas = totalCordobas * (doctorPercentage / 100);
    const clinicPortionDollars = totalDollars * (clinicPercentage / 100);
    const doctorPortionDollars = totalDollars * (doctorPercentage / 100);
    
    console.log('📊 Estadísticas ortodoncia:', {
      totalCordobas,
      totalDollars,
      clinicPercentage,
      doctorPercentage,
      clinicPortionCordobas,
      doctorPortionCordobas,
      count: data.length
    });
    
    return {
      orthodontic_income: totalCordobas,
      orthodontic_income_usd: totalDollars,
      clinic_orthodontic_income: clinicPortionCordobas,
      doctor_orthodontic_income: doctorPortionCordobas,
      clinic_orthodontic_income_usd: clinicPortionDollars,
      doctor_orthodontic_income_usd: doctorPortionDollars,
      clinic_income: clinicPortionCordobas,
      clinic_income_usd: clinicPortionDollars,
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

  // Obtener estadísticas de gastos - USANDO amount (ya está en córdobas)
  async getExpenseStats(startDate, endDate) {
    const { data: fixedBills, error: fixedError } = await supabaseAdmin
      .from('bills')
      .select('amount')
      .eq('is_recurrent', true)
      .eq('is_processed_in_closing', false)
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);
    
    const { data: variableBills, error: variableError } = await supabaseAdmin
      .from('bills')
      .select('amount')
      .eq('is_recurrent', false)
      .eq('is_processed_in_closing', false)
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);
    
    if (fixedError || variableError) {
      console.error('Error obteniendo gastos:', fixedError || variableError);
      return { fixed_expenses: 0, variable_expenses: 0, total_expenses: 0 };
    }
    
    // Calcular gastos fijos - amount ya está en córdobas
    const fixedExpenses = fixedBills?.reduce((sum, bill) => sum + (bill.amount || 0), 0) || 0;
    
    // Calcular gastos variables - amount ya está en córdobas
    const variableExpenses = variableBills?.reduce((sum, bill) => sum + (bill.amount || 0), 0) || 0;
    
    console.log('📊 Gastos obtenidos:', {
      fixedBills: fixedBills?.length || 0,
      variableBills: variableBills?.length || 0,
      fixedExpenses,
      variableExpenses,
      total: fixedExpenses + variableExpenses
    });
    
    return {
      fixed_expenses: fixedExpenses,
      variable_expenses: variableExpenses,
      total_expenses: fixedExpenses + variableExpenses
    };
  },

  // Obtener resumen financiero principal
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
    let expenseStats = { fixed_expenses: 0, variable_expenses: 0, total_expenses: 0 };
    
    if (closingType === 'general') {
      incomeStats = await this.getGeneralProceduresStats(startDate, endDate);
    } else if (closingType === 'orthodontics') {
      incomeStats = await this.getOrthodonticsProceduresStats(startDate, endDate, clinicPercentage, doctorPercentage);
    } else {
      // 'all' - ambos tipos
      incomeStats = await this.getAllProceduresStats(startDate, endDate, clinicPercentage, doctorPercentage);
      expenseStats = await this.getExpenseStats(startDate, endDate);
    }
    
    console.log('📊 Estadísticas obtenidas:', incomeStats);
    
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
      closingType
    });
    
    // DEVOLVER SOLO LAS COLUMNAS QUE EXISTEN EN LA TABLA
    return {
      total_general_income: generalIncome,
      total_clinical_orthodontic_income: clinicOrthodonticIncome,
      total_orthodontic_doctor_income: doctorOrthodonticIncome,
      total_fixed_expenses: expenseStats.fixed_expenses || 0,
      total_variable_expenses: expenseStats.variable_expenses || 0,
      net_profit: netProfit,
      closing_type: closingType
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
  }
};

export default MonthlyClosing;