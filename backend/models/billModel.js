import { supabaseAdmin } from '../config/supabase.js';

const Bill = {
  // Obtener todos los gastos
  async getAll(page = 1, limit = 20, filters = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    let query = supabaseAdmin
      .from('bills')
      .select('*', { count: 'exact' })
      .order('bill_date', { ascending: false });
    
    // Aplicar filtros
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    
    if (filters.type) {
      query = query.eq('is_recurrent', filters.type === 'FIJO');
    }
    
    if (filters.startDate) {
      query = query.gte('bill_date', filters.startDate);
    }
    
    if (filters.endDate) {
      query = query.lte('bill_date', filters.endDate);
    }
    
    query = query.range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    return {
      data,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  },

  // Obtener gasto por ID
  async getById(id) {
    const { data, error } = await supabaseAdmin
      .from('bills')
      .select('*')
      .eq('bill_id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Crear gasto
  async create(billData) {
    const { data, error } = await supabaseAdmin
      .from('bills')
      .insert([billData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Actualizar gasto
  async update(id, billData) {
    const { data, error } = await supabaseAdmin
      .from('bills')
      .update(billData)
      .eq('bill_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Eliminar gasto
  async delete(id) {
    const { data, error } = await supabaseAdmin
      .from('bills')
      .delete()
      .eq('bill_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Obtener gastos recurrentes
  async getRecurrentBills() {
    const { data, error } = await supabaseAdmin
      .from('bills')
      .select('*')
      .eq('is_recurrent', true)
      .order('description');
    
    if (error) throw error;
    return data;
  },

  // Estadísticas de gastos
  async getExpenseStats(startDate, endDate) {
    const { data, error } = await supabaseAdmin
      .from('bills')
      .select('amount, is_recurrent')
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);
    
    if (error) throw error;
    
    let fixedExpenses = 0;
    let variableExpenses = 0;
    let fixedCount = 0;
    let variableCount = 0;
    
    data.forEach(bill => {
      if (bill.is_recurrent) {
        fixedExpenses += bill.amount;
        fixedCount++;
      } else {
        variableExpenses += bill.amount;
        variableCount++;
      }
    });
    
    return {
      total_expenses: fixedExpenses + variableExpenses,
      fixed_expenses: fixedExpenses,
      variable_expenses: variableExpenses,
      total_bills: data.length,
      fixed_count: fixedCount,
      variable_count: variableCount
    };
  }
};

export default Bill;