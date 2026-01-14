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

  // Obtener cierre por ID - CORREGIDO
  async getById(id) {
    const { data, error } = await supabaseAdmin
      .from('monthly_closings')
      .select('*')
      .eq('closing_ID', id)  // ← CAMBIADO: 'closing_id' → 'closing_ID'
      .single();
    
    if (error) throw error;
    return data;
  },

  // Crear cierre - CORREGIDO
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

  // Verificar si existe cierre para mes/año - CORREGIDO
  async exists(month, year) {
    const { data, error } = await supabaseAdmin
      .from('monthly_closings')
      .select('closing_ID')  // ← CAMBIADO: 'closing_id' → 'closing_ID'
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
  
  console.log('📊 Estadísticas de ingresos recibidas:', incomeStats);
  
  // Desglose claro
  const generalIncome = incomeStats.general_income || 0; // Solo procedimientos generales
  const clinicOrthodonticIncome = incomeStats.clinic_income - generalIncome; // 40% de ortodoncia
  const doctorOrthodonticIncome = incomeStats.doctor_income || 0; // 60% de ortodoncia (GASTO)
  
  // VERIFICACIÓN: clinicIncome ya incluye generalIncome + 40% ortodoncia
  const clinicIncome = incomeStats.clinic_income; // Esto ya es correcto
  
  // Gastos totales (incluyendo pago a doctora)
  const totalExpenses = (expenseStats.total_expenses || 0) + doctorOrthodonticIncome;
  
  // Utilidad neta
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
    // INGRESOS
    total_general_income: generalIncome, // Solo procedimientos generales
    total_clinical_orthodontic_income: clinicOrthodonticIncome, // Solo 40% de ortodoncia
    total_orthodontic_doctor_income: doctorOrthodonticIncome, // 60% que se paga a doctora (GASTO)
    
    // GASTOS
    total_fixed_expenses: expenseStats.fixed_expenses || 0,
    total_variable_expenses: (expenseStats.variable_expenses || 0) + doctorOrthodonticIncome, // Doctora incluida
    
    // RESULTADO
    net_profit: netProfit
  };
}
};

export default MonthlyClosing;