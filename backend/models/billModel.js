import { supabaseAdmin } from '../config/supabase.js';
import { 
  adjustDateForQuery
} from '../utils/timezoneUtils.js';

const Bill = {
  // Obtener todos los gastos
  // Obtener todos los gastos SIN paginación
async getAll(filters = {}) {

  let query = supabaseAdmin
    .from('bills')
    .select('*', { count: 'exact' })
    .order('bill_date', { ascending: false });

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

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    data: data || [],
    total: count || 0
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

  // Crear gasto CON SOPORTE PARA DÓLARES
  async create(billData) {
    // Asegurar que bill_date esté en formato YYYY-MM-DD
    const billWithFormattedDate = {
      ...billData,
      bill_date: adjustDateForQuery(billData.bill_date)
    };
    
    // Asegurar que tengamos valores por defecto para los campos nuevos
    const finalBillData = {
      description: billData.description,
      amount: parseFloat(billData.amount) || 0,
      amount_usd: parseFloat(billData.amount_usd) || 0, // ¡minúsculas!
      bill_date: adjustDateForQuery(billData.bill_date),
      category: billData.category || 'Otros',
      currency_used: billData.currency_used || 'NIO',
      exchange_rate_bill: parseFloat(billData.exchange_rate_bill) || 36.5,
      is_recurrent: billData.is_recurrent || false,
      is_processed_in_closing: false
    };
    
    console.log('Creando gasto con datos:', finalBillData);
    
    const { data, error } = await supabaseAdmin
      .from('bills')
      .insert([finalBillData])
      .select()
      .single();
    
    if (error) {
      console.error('Error de Supabase al crear gasto:', error);
      throw error;
    }
    
    return data;
  },

  // Actualizar gasto CON SOPORTE PARA DÓLARES
  async update(id, billData) {
    // Si se actualiza la fecha, formatear
    const updateData = { ...billData };
    if (updateData.bill_date) {
      updateData.bill_date = adjustDateForQuery(updateData.bill_date);
    }
    
    // Asegurar campos numéricos
    if (updateData.amount !== undefined) {
      updateData.amount = parseFloat(updateData.amount) || 0;
    }
    
    if (updateData.amount_usd !== undefined) {
      updateData.amount_usd = parseFloat(updateData.amount_usd) || 0;
    }
    
    if (updateData.exchange_rate_bill !== undefined) {
      updateData.exchange_rate_bill = parseFloat(updateData.exchange_rate_bill) || 36.5;
    }
    
    console.log('Actualizando gasto:', { id, updateData });
    
    const { data, error } = await supabaseAdmin
      .from('bills')
      .update(updateData)
      .eq('bill_ID', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error de Supabase al actualizar gasto:', error);
      throw error;
    }
    
    return data;
  },

  // Eliminar gasto
  async delete(id) {
    console.log('Eliminando gasto con ID:', id);
    
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

  // Estadísticas de gastos (actualizada para manejar dólares)
  async getExpenseStats(startDate, endDate) {
    const start = adjustDateForQuery(startDate);
    const end = adjustDateForQuery(endDate);
    
    console.log('Obteniendo estadísticas de gastos:', { start, end });
    
    const { data, error } = await supabaseAdmin
      .from('bills')
      .select('amount, amount_usd, is_recurrent, currency_used, exchange_rate_bill')
      .gte('bill_date', start)
      .lte('bill_date', end);
    
    if (error) throw error;
    
    let fixedExpenses = 0;
    let variableExpenses = 0;
    let fixedCount = 0;
    let variableCount = 0;
    let fixedExpensesUSD = 0;
    let variableExpensesUSD = 0;
    
    data.forEach(bill => {
      const amount = bill.amount || 0;
      const amount_usd = bill.amount_usd || 0;
      
      if (bill.is_recurrent) {
        fixedExpenses += amount;
        fixedExpensesUSD += amount_usd;
        fixedCount++;
      } else {
        variableExpenses += amount;
        variableExpensesUSD += amount_usd;
        variableCount++;
      }
    });
    
    return {
      total_expenses: fixedExpenses + variableExpenses,
      total_expenses_usd: fixedExpensesUSD + variableExpensesUSD,
      fixed_expenses: fixedExpenses,
      fixed_expenses_usd: fixedExpensesUSD,
      variable_expenses: variableExpenses,
      variable_expenses_usd: variableExpensesUSD,
      total_bills: data.length,
      fixed_count: fixedCount,
      variable_count: variableCount
    };
  },

  // Obtener gastos no procesados (para cierres)
  async getUnprocessedBills(startDate, endDate, expenseType = 'general') {
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
    
    const { data: billsToDelete, error: selectError } = await supabaseAdmin
      .from('bills')
      .select('bill_ID, description, amount, amount_usd')
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
  }
};

export default Bill;