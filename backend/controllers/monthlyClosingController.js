import MonthlyClosing from '../models/monthlyClosingModel.js';
import { supabaseAdmin } from '../config/supabase.js';

const monthlyClosingController = {
  // Obtener todos los cierres
  getAll: async (req, res) => {
    try {
      const { page = 1, limit = 12, closing_type, year } = req.query;
      
      const filters = {};
      if (closing_type) filters.closing_type = closing_type;
      if (year) filters.year = parseInt(year);
      
      const result = await MonthlyClosing.getAll(parseInt(page), parseInt(limit), filters);
      
      res.json({ 
        success: true, 
        ...result 
      });
    } catch (error) {
      console.error('Error al obtener cierres:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener cierres' 
      });
    }
  },

  // Obtener cierre por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const closing = await MonthlyClosing.getById(id);
      
      if (!closing) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cierre no encontrado' 
        });
      }
      
      const formattedClosing = {
        ...closing,
        id: closing.closing_ID || closing.id
      };
      
      res.json({ 
        success: true, 
        data: formattedClosing 
      });
    } catch (error) {
      console.error('Error al obtener cierre:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener cierre' 
      });
    }
  },

  create: async (req, res) => {
  try {
    const { 
      month, 
      year, 
      startDate, 
      endDate, 
      closing_type = 'all',
      comentary = '' 
    } = req.body;
    
    console.log('📝 Datos recibidos para crear cierre mensual:', {
      month, 
      year, 
      startDate, 
      endDate, 
      closing_type
    });
    
    if (!month || !year) {
      return res.status(400).json({ 
        success: false, 
        error: 'Mes y año son requeridos' 
      });
    }
    
    // Validar tipo de cierre
    const validTypes = ['general', 'orthodontics', 'all'];
    if (!validTypes.includes(closing_type)) {
      return res.status(400).json({ 
        success: false, 
        error: `Tipo de cierre inválido. Use: ${validTypes.join(', ')}` 
      });
    }
    
    // Verificar si ya existe cierre para este tipo
    const exists = await MonthlyClosing.exists(month, year, closing_type);
    if (exists) {
      return res.status(400).json({ 
        success: false, 
        error: `Ya existe un cierre ${getClosingTypeLabel(closing_type)} para ${month} ${year}` 
      });
    }
    
    // Calcular fechas del período
    const periodStartDate = startDate || `${year}-${getMonthNumber(month)}-01`;
    const periodEndDate = endDate || getLastDayOfMonth(year, month);
    
    console.log('📅 Período calculado:', { periodStartDate, periodEndDate });
    
    // Obtener resumen financiero (ahora incluye TODOS los gastos variables)
    const financialSummary = await MonthlyClosing.getFinancialSummary(
      periodStartDate,
      periodEndDate,
      closing_type
    );
    
    console.log('📊 Resumen financiero obtenido:', {
      total_general_income: financialSummary.total_general_income,
      total_clinical_orthodontic_income: financialSummary.total_clinical_orthodontic_income,
      total_orthodontic_doctor_income: financialSummary.total_orthodontic_doctor_income,
      total_fixed_expenses: financialSummary.total_fixed_expenses,
      total_variable_expenses: financialSummary.total_variable_expenses,
      net_profit: financialSummary.net_profit,
      expense_metadata: financialSummary.expense_metadata
    });
    
    // Crear cierre - IMPORTANTE: NO marcamos gastos como procesados
    const closingData = {
      month,
      year: parseInt(year),
      closing_type,
      total_general_income: financialSummary.total_general_income,
      total_clinical_orthodontic_income: financialSummary.total_clinical_orthodontic_income,
      total_orthodontic_doctor_income: financialSummary.total_orthodontic_doctor_income,
      total_fixed_expenses: financialSummary.total_fixed_expenses,
      total_variable_expenses: financialSummary.total_variable_expenses,
      net_profit: financialSummary.net_profit,
      comentary,
      // IMPORTANTE: Siempre false porque los gastos ya están marcados en cierres diarios
      processed_variable_expenses: false,
      daily_closings_included: false,
      orthodontics_daily_closings_included: false
    };
    
    console.log('📤 Datos para crear cierre en BD:', closingData);
    
    const newClosing = await MonthlyClosing.create(closingData);
    
    console.log('✅ Cierre creado en BD:', {
      id: newClosing.closing_ID,
      month: newClosing.month,
      year: newClosing.year,
      tipo: newClosing.closing_type
    });
    
    // Formatear respuesta con información de gastos
    const formattedClosing = {
      ...newClosing,
      closing_ID: newClosing.closing_ID,
      id: newClosing.closing_ID,
      clinic_percentage: financialSummary.clinic_percentage,
      doctor_percentage: financialSummary.doctor_percentage,
      exchange_rate: financialSummary.exchange_rate,
      total_external_doctor_payments: financialSummary.total_external_doctor_payments || 0,
      expense_info: {
        variable_expenses_total: financialSummary.total_variable_expenses,
        variable_expenses_count: financialSummary.expense_metadata?.variable_expenses_count || 0,
        variable_expenses_in_daily: financialSummary.expense_metadata?.variable_expenses_in_daily || 0,
        fixed_expenses_count: financialSummary.expense_metadata?.fixed_expenses_count || 0
      }
    };
    
    const typeLabel = getClosingTypeLabel(closing_type);
    
    // Mensaje de éxito detallado
    let successMessage = `✅ Cierre mensual ${typeLabel} creado exitosamente`;
    
    if (closing_type === 'all') {
      const totalClinicIncome = (financialSummary.total_general_income || 0) + 
                               (financialSummary.total_clinical_orthodontic_income || 0);
      
      successMessage += `\n\n📊 RESUMEN DEL MES:\n`;
      successMessage += `• Procedimientos Generales: C$${financialSummary.total_general_income?.toFixed(2) || '0.00'}\n`;
      successMessage += `• Ortodoncia Clínica (${financialSummary.clinic_percentage || 40}%): C$${financialSummary.total_clinical_orthodontic_income?.toFixed(2) || '0.00'}\n`;
      successMessage += `• Ortodoncia Doctora (${financialSummary.doctor_percentage || 60}%): C$${financialSummary.total_orthodontic_doctor_income?.toFixed(2) || '0.00'}\n\n`;
      
      successMessage += `💰 GASTOS DEL MES:\n`;
      successMessage += `• Gastos Fijos: C$${financialSummary.total_fixed_expenses?.toFixed(2) || '0.00'}\n`;
      successMessage += `• Gastos Variables: C$${financialSummary.total_variable_expenses?.toFixed(2) || '0.00'}\n`;
      
      if (financialSummary.expense_metadata?.variable_expenses_in_daily > 0) {
        successMessage += `  └─ ${financialSummary.expense_metadata.variable_expenses_in_daily} gastos ya incluidos en cierres diarios\n`;
      }
      
      if (financialSummary.expense_metadata?.variable_expenses_count > financialSummary.expense_metadata?.variable_expenses_in_daily) {
        const nuevos = financialSummary.expense_metadata.variable_expenses_count - 
                      financialSummary.expense_metadata.variable_expenses_in_daily;
        successMessage += `  └─ ${nuevos} gastos nuevos (solo en mensual)\n`;
      }
      
      successMessage += `• Total Gastos: C$${(financialSummary.total_fixed_expenses + financialSummary.total_variable_expenses).toFixed(2)}\n\n`;
      
      successMessage += `🧮 RESULTADO FINAL:\n`;
      successMessage += `• Total Ingresos Clínica: C$${totalClinicIncome.toFixed(2)}\n`;
      successMessage += `• Utilidad Neta: C$${financialSummary.net_profit?.toFixed(2) || '0.00'}`;
      
      if (financialSummary.total_external_doctor_payments) {
        successMessage += `\n• Pagos Doctores Externos: C$${financialSummary.total_external_doctor_payments.toFixed(2)} (ya deducidos)`;
      }
    }
    
    res.status(201).json({ 
      success: true, 
      message: successMessage,
      data: formattedClosing,
      debug: {
        periodo: `${periodStartDate} al ${periodEndDate}`,
        gastos_variables_totales: financialSummary.expense_metadata?.variable_expenses_count || 0,
        gastos_variables_en_diarios: financialSummary.expense_metadata?.variable_expenses_in_daily || 0,
        gastos_variables_nuevos: (financialSummary.expense_metadata?.variable_expenses_count || 0) - 
                                 (financialSummary.expense_metadata?.variable_expenses_in_daily || 0)
      }
    });
    
  } catch (error) {
    console.error('❌ Error al crear cierre mensual:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json({ 
      success: false, 
      error: 'Error al crear cierre: ' + error.message
    });
  }
},

// En monthlyClosingController.js
delete: async (req, res) => {
  try {
    const { id } = req.params;
    
    const closing = await MonthlyClosing.getById(id);
    if (!closing) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cierre no encontrado' 
      });
    }
    
    await MonthlyClosing.delete(id);
    
    res.json({ 
      success: true, 
      message: 'Cierre eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar cierre mensual:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al eliminar cierre' 
    });
  }
},

// AÑADIR función para obtener detalles de doctores externos
getExternalDoctorDetails: async (req, res) => {
  try {
    const { startDate, endDate, closing_type = 'all' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Fecha inicio y fin son requeridas' 
      });
    }
    
    const details = await MonthlyClosing.getExternalDoctorDetails(startDate, endDate, closing_type);
    
    res.json({
      success: true,
      data: details
    });
    
  } catch (error) {
    console.error('Error al obtener detalles de doctores externos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener detalles de doctores externos' 
    });
  }
},

  // Verificar si existe cierre
  checkExists: async (req, res) => {
    try {
      const { month, year, closing_type = 'all' } = req.query;
      
      if (!month || !year) {
        return res.status(400).json({ 
          success: false, 
          error: 'Mes y año son requeridos' 
        });
      }
      
      const exists = await MonthlyClosing.exists(month, year, closing_type);
      
      res.json({ 
        success: true, 
        data: { exists } 
      });
    } catch (error) {
      console.error('Error al verificar cierre:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al verificar cierre' 
      });
    }
  },

  // Obtener resumen financiero
  getFinancialSummary: async (req, res) => {
    try {
      const { startDate, endDate, closing_type = 'all' } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          error: 'Fecha inicio y fin son requeridas' 
        });
      }
      
      const summary = await MonthlyClosing.getFinancialSummary(startDate, endDate, closing_type);
      
      res.json({ 
        success: true, 
        data: summary 
      });
    } catch (error) {
      console.error('Error al obtener resumen:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener resumen' 
      });
    }
  },

  // En monthlyClosingController.js, agregar esta función:
testBillsConnection: async (req, res) => {
  try {
    console.log('🔍 Test de conexión a tabla bills');
    
    // Test 1: Contar todos los gastos
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('bills')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error contando bills:', countError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error contando bills: ' + countError.message 
      });
    }
    
    // Test 2: Obtener algunos gastos de ejemplo
    const { data: sampleBills, error: sampleError } = await supabaseAdmin
      .from('bills')
      .select('*')
      .limit(5)
      .order('bill_date', { ascending: false });
    
    if (sampleError) {
      console.error('❌ Error obteniendo sample bills:', sampleError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error obteniendo sample bills: ' + sampleError.message 
      });
    }
    
    // Test 3: Verificar estructura de fechas
    const { data: dateRange, error: dateError } = await supabaseAdmin
      .from('bills')
      .select('bill_date')
      .order('bill_date', { ascending: true })
      .limit(1);
    
    res.json({
      success: true,
      data: {
        totalBills: totalCount || 0,
        sampleBills: sampleBills || [],
        earliestDate: dateRange && dateRange.length > 0 ? dateRange[0].bill_date : 'No hay datos',
        connectionTest: 'OK',
        message: sampleBills && sampleBills.length > 0 
          ? `✅ Hay ${totalCount} gastos en la tabla` 
          : '⚠️ No hay gastos registrados en la tabla bills'
      }
    });
    
  } catch (error) {
    console.error('❌ Error en testBillsConnection:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error en test: ' + error.message 
    });
  }
},

  // Obtener resumen por mes
  getMonthlySummary: async (req, res) => {
    try {
      const { month, year, closing_type = 'all' } = req.query;
      
      if (!month || !year) {
        return res.status(400).json({ 
          success: false, 
          error: 'Mes y año son requeridos' 
        });
      }
      
      const summary = await MonthlyClosing.getMonthlySummary(month, year, closing_type);
      
      res.json({ 
        success: true, 
        data: summary 
      });
    } catch (error) {
      console.error('Error al obtener resumen mensual:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener resumen mensual' 
      });
    }
  },

  // AÑADIR función para obtener detalles de gastos variables del período
getVariableExpensesDetails: async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Fecha inicio y fin son requeridas' 
      });
    }
    
    const { data: variableExpenses, error } = await supabaseAdmin
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
      .eq('is_recurrent', false)
      .gte('bill_date', startDate)
      .lte('bill_date', endDate)
      .order('bill_date', { ascending: false });
    
    if (error) throw error;
    
    // Obtener configuración para conversiones
    const settings = await MonthlyClosing.getSystemSettings();
    const defaultExchangeRate = settings?.exchange_rate || 36.5;
    
    // Calcular montos en córdobas
    const formattedExpenses = variableExpenses.map(exp => {
      let amountCordobas = exp.amount || 0;
      
      if (exp.currency_used === 'USD' && !amountCordobas) {
        amountCordobas = (exp.amount_usd || 0) * (exp.exchange_rate_bill || defaultExchangeRate);
      }
      
      return {
        ...exp,
        amount_cordobas: amountCordobas,
        processed_in_daily: exp.is_processed_in_daily_closing || false
      };
    });
    
    // Calcular totales
    const totalCordobas = formattedExpenses.reduce((sum, e) => sum + e.amount_cordobas, 0);
    const processedInDaily = formattedExpenses.filter(e => e.processed_in_daily);
    const notProcessed = formattedExpenses.filter(e => !e.processed_in_daily);
    
    res.json({
      success: true,
      data: {
        expenses: formattedExpenses,
        summary: {
          total_expenses: totalCordobas,
          total_count: formattedExpenses.length,
          processed_in_daily: {
            count: processedInDaily.length,
            total: processedInDaily.reduce((sum, e) => sum + e.amount_cordobas, 0)
          },
          not_processed: {
            count: notProcessed.length,
            total: notProcessed.reduce((sum, e) => sum + e.amount_cordobas, 0)
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error al obtener detalles de gastos variables:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener detalles de gastos variables' 
    });
  }
}
};

// Funciones auxiliares
function getMonthNumber(month) {
  const months = {
    'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04',
    'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08',
    'SEPTIEMBRE': '09', 'OCTUBRE': '10', 'NOVIEMBRE': '11', 'DICIEMBRE': '12'
  };
  return months[month.toUpperCase()] || '01';
}

function getLastDayOfMonth(year, month) {
  const monthNumber = getMonthNumber(month);
  const lastDay = new Date(parseInt(year), parseInt(monthNumber), 0).getDate();
  return `${year}-${monthNumber}-${lastDay}`;
}

function getClosingTypeLabel(type) {
  const labels = {
    'general': 'de Procedimientos Generales',
    'orthodontics': 'de Ortodoncia',
    'all': 'Completo (General + Ortodoncia)'
  };
  return labels[type] || '';
}

export default monthlyClosingController;