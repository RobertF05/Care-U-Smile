// models/monthlyClosingModel.js
import { supabaseAdmin } from '../config/supabase.js';
import Procedure from './procedureModel.js';
import Bill from './billModel.js';
import { 
  createMonthlyDateRange,
  formatNicaraguaDateTime,
  formatNicaraguaDate
} from '../utils/timezoneUtils.js';

const MonthlyClosing = {
  // Obtener todos los cierres
  async getAll(page = 1, limit = 12) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    const { data, error, count } = await supabaseAdmin
      .from('monthly_closings')
      .select('*', { count: 'exact' })
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .range(from, to);
    
    if (error) throw error;
    
    // Formatear fechas para mostrar
    const formattedData = data.map(closing => ({
      ...closing,
      closing_date_display: formatNicaraguaDate(closing.closing_date),
      fecha_creacion_display: formatNicaraguaDateTime(closing.closing_date)
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
      fecha_creacion_display: formatNicaraguaDateTime(data.closing_date)
    };
  },

  // Crear cierre
  async create(closingData) {
    const { data, error } = await supabaseAdmin
      .from('monthly_closings')
      .insert([{
        ...closingData,
        closing_date: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      closing_date_display: formatNicaraguaDate(data.closing_date),
      fecha_creacion_display: formatNicaraguaDateTime(data.closing_date)
    };
  },

  // Verificar si existe cierre para mes/año
  async exists(month, year) {
    const { data, error } = await supabaseAdmin
      .from('monthly_closings')
      .select('closing_ID')
      .eq('month', month)
      .eq('year', year)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  },

  // Obtener resumen financiero con fechas Nicaragua
  async getFinancialSummary(startDate, endDate) {
    console.log('Obteniendo resumen financiero para fechas Nicaragua:', {
      inicio: startDate,
      fin: endDate
    });
    
    const [incomeStats, expenseStats] = await Promise.all([
      Procedure.getIncomeStats(startDate, endDate),
      Bill.getExpenseStats(startDate, endDate)
    ]);
    
    console.log('📊 Estadísticas de ingresos:', incomeStats);
    
    const generalIncome = incomeStats.general_income || 0;
    const clinicOrthodonticIncome = incomeStats.clinic_income - generalIncome;
    const doctorOrthodonticIncome = incomeStats.doctor_income || 0;
    const clinicIncome = incomeStats.clinic_income;
    const totalExpenses = (expenseStats.total_expenses || 0) + doctorOrthodonticIncome;
    const netProfit = clinicIncome - totalExpenses;
    
    console.log('🧮 Cálculos finales:', {
      generalIncome,
      clinicOrthodonticIncome,
      doctorOrthodonticIncome,
      clinicIncome,
      totalExpenses,
      netProfit
    });
    
    return {
      total_general_income: generalIncome,
      total_clinical_orthodontic_income: clinicOrthodonticIncome,
      total_orthodontic_doctor_income: doctorOrthodonticIncome,
      total_fixed_expenses: expenseStats.fixed_expenses || 0,
      total_variable_expenses: (expenseStats.variable_expenses || 0) + doctorOrthodonticIncome,
      net_profit: netProfit
    };
  },

  // Obtener resumen por mes específico (usando fechas Nicaragua)
  async getMonthlySummary(month, year) {
    const { start, end } = createMonthlyDateRange(year, month);
    
    console.log('Calculando resumen mensual:', {
      mes: month,
      año: year,
      inicioUTC: start,
      finUTC: end
    });
    
    return await this.getFinancialSummary(
      new Date(start).toISOString().split('T')[0],
      new Date(end).toISOString().split('T')[0]
    );
  }
};

export default MonthlyClosing;