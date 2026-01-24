// models/billModel.js
import { supabaseAdmin } from '../config/supabase.js';
import { 
  adjustDateForQuery,
  convertDateStringToUTCStart,
  convertDateStringToUTCEnd
} from '../utils/timezoneUtils.js';

const Bill = {
  // Obtener gastos no procesados (para cierres)
  async getUnprocessedBills(startDate, endDate, expenseType = 'general') {
    // Para campos DATE, solo necesitamos formato YYYY-MM-DD
    const start = adjustDateForQuery(startDate);
    const end = adjustDateForQuery(endDate);
    
    const { data, error } = await supabaseAdmin
      .from('bills')
      .select('*')
      .eq('is_processed_in_closing', false)
      .eq('expense_type', expenseType)
      .gte('bill_date', start)
      .lte('bill_date', end)
      .order('bill_date', { ascending: false });
    
    if (error) throw error;
    
    return {
      bills: data || [],
      total_count: data?.length || 0,
      total_amount: data?.reduce((sum, bill) => sum + (bill.amount || 0), 0) || 0
    };
  },

  // Reiniciar estado de procesamiento de gastos
  async resetProcessingStatus(billIds) {
    if (!billIds || billIds.length === 0) return;
    
    const { error } = await supabaseAdmin
      .from('bills')
      .update({
        is_processed_in_closing: false,
        processed_in_daily_closing_ID: null,
        processed_in_closing_ID: null
      })
      .in('bill_id', billIds);
    
    if (error) throw error;
  },

  // Obtener todos los gastos
  async getAll(page = 1, limit = 20, filters = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    let query = supabaseAdmin
      .from('bills')
      .select('*', { count: 'exact' })
      .order('bill_date', { ascending: false });
    
    // Aplicar filtros (campos DATE, no necesitan conversión de zona horaria)
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    
    if (filters.type) {
      query = query.eq('is_recurrent', filters.type === 'FIJO');
    }
    
    if (filters.startDate) {
      const start = adjustDateForQuery(filters.startDate);
      query = query.gte('bill_date', start);
    }
    
    if (filters.endDate) {
      const end = adjustDateForQuery(filters.endDate);
      query = query.lte('bill_date', end);
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

  // Crear gasto (bill_date es DATE, no TIMESTAMP)
  async create(billData) {
    // Asegurar que bill_date esté en formato YYYY-MM-DD
    const billWithFormattedDate = {
      ...billData,
      bill_date: adjustDateForQuery(billData.bill_date)
    };
    
    console.log('Creando gasto con fecha:', billWithFormattedDate.bill_date);
    
    const { data, error } = await supabaseAdmin
      .from('bills')
      .insert([billWithFormattedDate])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Actualizar gasto
  async update(id, billData) {
    // Si se actualiza la fecha, formatear
    const updateData = { ...billData };
    if (updateData.bill_date) {
      updateData.bill_date = adjustDateForQuery(updateData.bill_date);
    }
    
    const { data, error } = await supabaseAdmin
      .from('bills')
      .update(updateData)
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

  // Estadísticas de gastos (usar fechas Nicaragua como DATE)
  async getExpenseStats(startDate, endDate) {
    const start = adjustDateForQuery(startDate);
    const end = adjustDateForQuery(endDate);
    
    console.log('Obteniendo estadísticas de gastos:', { start, end });
    
    const { data, error } = await supabaseAdmin
      .from('bills')
      .select('amount, is_recurrent')
      .gte('bill_date', start)
      .lte('bill_date', end);
    
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