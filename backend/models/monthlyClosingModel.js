import { supabaseAdmin } from '../config/supabase.js';
import Procedure from './procedureModel.js';
import Bill from './billModel.js';

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
    
    return {
      data,
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
      .eq('closing_id', id)
      .single();
    
    if (error) throw error;
    return data;
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
    return data;
  },

  // Verificar si existe cierre para mes/año
  async exists(month, year) {
    const { data, error } = await supabaseAdmin
      .from('monthly_closings')
      .select('closing_id')
      .eq('month', month)
      .eq('year', year)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  },

  // Obtener resumen financiero
  async getFinancialSummary(startDate, endDate) {
    
    const [incomeStats, expenseStats] = await Promise.all([
      Procedure.getIncomeStats(startDate, endDate),
      Bill.getExpenseStats(startDate, endDate)
    ]);
    
    return {
      total_general_income: incomeStats.clinic_income,
      total_clinical_orthodontic_income: incomeStats.clinic_income,
      total_orthodontic_doctor_income: incomeStats.doctor_income,
      total_fixed_expenses: expenseStats.fixed_expenses,
      total_variable_expenses: expenseStats.variable_expenses,
      net_profit: incomeStats.clinic_income - expenseStats.total_expenses
    };
  }
};

export default MonthlyClosing;