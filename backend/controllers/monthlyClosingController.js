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

  // Crear cierre mensual
  // monthlyClosingController.js - Corregir función create

create: async (req, res) => {
  try {
    const { 
      month, 
      year, 
      startDate, 
      endDate, 
      closing_type = 'all',
      comentary = '', 
      deleteVariableExpenses = false 
    } = req.body;
    
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
    
    console.log('📅 Período a calcular:', { 
      startDate: periodStartDate, 
      endDate: periodEndDate,
      type: closing_type 
    });
    
    // Obtener resumen financiero según tipo
    const financialSummary = await MonthlyClosing.getFinancialSummary(
      periodStartDate,
      periodEndDate,
      closing_type
    );
    
    // Solo procesar gastos variables si es cierre 'all'
    let variableBillsProcessed = [];
    let variableExpensesAmount = 0;
    
    if (deleteVariableExpenses && closing_type === 'all') {
      try {
        const { data: variableBills, error } = await supabaseAdmin
          .from('bills')
          .select('bill_ID, description, amount, currency_used, amount_usd, exchange_rate_bill')
          .eq('is_recurrent', false)
          .eq('is_processed_in_closing', false)
          .gte('bill_date', periodStartDate)
          .lte('bill_date', periodEndDate);
        
        if (!error && variableBills) {
          variableBillsProcessed = variableBills;
          
          // Calcular monto total en córdobas
          variableExpensesAmount = variableBillsProcessed.reduce((sum, bill) => {
            if (bill.currency_used === 'USD') {
              return sum + ((bill.amount_usd || 0) * (bill.exchange_rate_bill || 36.5));
            } else {
              return sum + (bill.amount || 0);
            }
          }, 0);
          
          const billIds = variableBillsProcessed.map(bill => bill.bill_ID);
          
          const { error: updateError } = await supabaseAdmin
            .from('bills')
            .update({
              is_processed_in_closing: true,
              processed_in_closing_ID: null
            })
            .in('bill_ID', billIds);
          
          if (updateError) {
            console.warn('⚠️ No se pudieron marcar gastos como procesados:', updateError.message);
          } else {
            console.log(`✅ Marcados ${billIds.length} gastos variables como procesados`);
          }
        }
      } catch (billError) {
        console.warn('⚠️ Error al procesar gastos variables:', billError.message);
      }
    }
    
    // Crear cierre - SOLO con columnas que existen
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
      processed_variable_expenses: deleteVariableExpenses && closing_type === 'all',
      daily_closings_included: false,
      orthodontics_daily_closings_included: false
    };
    
    console.log('📤 Datos para crear cierre:', closingData);
    
    const newClosing = await MonthlyClosing.create(closingData);
    
    // Formatear respuesta
    const formattedClosing = {
      ...newClosing,
      closing_ID: newClosing.closing_ID,
      id: newClosing.closing_ID,
      variable_expenses_processed: variableBillsProcessed.length,
      variable_expenses_amount: variableExpensesAmount,
      delete_operation: deleteVariableExpenses ? 'marked_as_processed' : 'skipped',
      // Agregar información adicional para la respuesta (no se guarda en BD)
      clinic_percentage: financialSummary.clinic_percentage,
      doctor_percentage: financialSummary.doctor_percentage,
      exchange_rate: financialSummary.exchange_rate
    };
    
    const typeLabel = getClosingTypeLabel(closing_type);
    
    res.status(201).json({ 
      success: true, 
      message: `Cierre mensual ${typeLabel} creado exitosamente` + 
              (deleteVariableExpenses && closing_type === 'all' ? ' (gastos variables procesados)' : ''),
      data: formattedClosing 
    });
  } catch (error) {
    console.error('Error al crear cierre:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al crear cierre: ' + error.message 
    });
  }
},

  // Agregar esta función al monthlyClosingController.js

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