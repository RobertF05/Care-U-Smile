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

  // Eliminar gastos variables de un período
  async deleteVariableExpensesFromPeriod(startDate, endDate) {
    const start = adjustDateForQuery(startDate);
    const end = adjustDateForQuery(endDate);
    
    console.log('🗑️ Eliminando gastos variables del período:', { start, end });
    
    // Primero obtener los IDs para registro
    const { data: billsToDelete, error: selectError } = await supabaseAdmin
      .from('bills')
      .select('bill_ID, description, amount')
      .eq('is_recurrent', false)
      .eq('is_processed_in_closing', false)
      .gte('bill_date', start)
      .lte('bill_date', end);
    
    if (selectError) {
      console.error('Error al seleccionar gastos para eliminar:', selectError);
      throw selectError;
    }
    
    if (!billsToDelete || billsToDelete.length === 0) {
      console.log('ℹ️ No hay gastos variables para eliminar');
      return { deletedCount: 0, totalAmount: 0 };
    }
    
    const totalAmount = billsToDelete.reduce((sum, bill) => sum + (bill.amount || 0), 0);
    
    console.log(`📊 Gastos a eliminar: ${billsToDelete.length}, Monto total: ${totalAmount}`);
    
    // Eliminar los gastos
    const { error: deleteError } = await supabaseAdmin
      .from('bills')
      .delete()
      .eq('is_recurrent', false)
      .eq('is_processed_in_closing', false)
      .gte('bill_date', start)
      .lte('bill_date', end);
    
    if (deleteError) {
      console.error('Error al eliminar gastos variables:', deleteError);
      throw deleteError;
    }
    
    console.log(`✅ Eliminados ${billsToDelete.length} gastos variables exitosamente`);
    
    return {
      deletedCount: billsToDelete.length,
      totalAmount: totalAmount,
      deletedBills: billsToDelete
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
      .in('bill_ID', billIds);
    
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
      .eq('bill_ID', id)
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
      .eq('bill_ID', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Eliminar gasto
  // models/billModel.js - Función delete mejorada
async delete(id) {
  console.log('Eliminando gasto con ID:', id);
  console.log('Tipo de ID:', typeof id);
  
  const { data, error } = await supabaseAdmin
    .from('bills')
    .delete()
    .eq('bill_ID', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error detallado de Supabase al eliminar:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      table: 'bills',
      column: 'bill_ID'
    });
    throw new Error(`Error al eliminar gasto: ${error.message}`);
  }
  
  console.log('Gasto eliminado exitosamente:', data);
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