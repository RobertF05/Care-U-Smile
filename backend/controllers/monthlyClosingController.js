// monthlyClosingController.js - Corrección completa
import MonthlyClosing from '../models/monthlyClosingModel.js';
import { supabaseAdmin } from '../config/supabase.js'; // ¡IMPORTAR supabaseAdmin!
import Bill from '../models/billModel.js';

const monthlyClosingController = {
  // Obtener todos los cierres
  getAll: async (req, res) => {
    try {
      const { page = 1, limit = 12 } = req.query;
      const result = await MonthlyClosing.getAll(parseInt(page), parseInt(limit));
      
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

  // Crear cierre mensual - VERSIÓN CORREGIDA
  // monthlyClosingController.js - Modificar función create

create: async (req, res) => {
  try {
    const { month, year, startDate, endDate, comentary = '', deleteVariableExpenses = false } = req.body; // Cambiar por defecto a false
    
    if (!month || !year) {
      return res.status(400).json({ 
        success: false, 
        error: 'Mes y año son requeridos' 
      });
    }
    
    // Verificar si ya existe cierre
    const exists = await MonthlyClosing.exists(month, year);
    if (exists) {
      return res.status(400).json({ 
        success: false, 
        error: 'Ya existe un cierre para este mes y año' 
      });
    }
    
    // Calcular fechas del período
    const periodStartDate = startDate || `${year}-${getMonthNumber(month)}-01`;
    const periodEndDate = endDate || getLastDayOfMonth(year, month);
    
    // Obtener resumen financiero
    const financialSummary = await MonthlyClosing.getFinancialSummary(
      periodStartDate,
      periodEndDate
    );
    
    // SOLO marcar gastos como procesados, NO eliminarlos
    let variableBillsProcessed = [];
    let variableExpensesAmount = 0;
    
    if (deleteVariableExpenses) { // Solo si el usuario específicamente lo solicita
      try {
        // Obtener gastos variables no procesados
        const { data: variableBills, error } = await supabaseAdmin
          .from('bills')
          .select('bill_ID, description, amount')
          .eq('is_recurrent', false)
          .eq('is_processed_in_closing', false)
          .gte('bill_date', periodStartDate)
          .lte('bill_date', periodEndDate);
        
        if (!error && variableBills) {
          variableBillsProcessed = variableBills;
          variableExpensesAmount = variableBillsProcessed.reduce((sum, bill) => sum + (bill.amount || 0), 0);
          
          // Marcar como procesados (NO eliminar)
          const billIds = variableBillsProcessed.map(bill => bill.bill_ID);
          
          const { error: updateError } = await supabaseAdmin
            .from('bills')
            .update({
              is_processed_in_closing: true,
              processed_in_closing_ID: null // Solo marcamos, no vinculamos
            })
            .in('bill_ID', billIds);
          
          if (updateError) {
            console.warn('⚠️ No se pudieron marcar gastos como procesados:', updateError.message);
          } else {
            console.log(`✅ Marcados ${billIds.length} gastos variables como procesados (NO eliminados)`);
          }
        }
      } catch (billError) {
        console.warn('⚠️ Error al procesar gastos variables:', billError.message);
      }
    }
    
    // Crear cierre
    const closingData = {
      month,
      year,
      ...financialSummary,
      comentary,
      daily_closings_included: false,
      orthodontics_daily_closings_included: false,
      processed_variable_expenses: deleteVariableExpenses
    };
    
    const newClosing = await MonthlyClosing.create(closingData);
    
    // Formatear respuesta
    const formattedClosing = {
      ...newClosing,
      closing_ID: newClosing.closing_ID,
      id: newClosing.closing_ID,
      variable_expenses_processed: variableBillsProcessed.length,
      variable_expenses_amount: variableExpensesAmount,
      delete_operation: deleteVariableExpenses ? 'marked_as_processed' : 'skipped'
    };
    
    res.status(201).json({ 
      success: true, 
      message: 'Cierre mensual creado exitosamente' + 
              (deleteVariableExpenses ? ' (gastos variables marcados como procesados)' : ''),
      data: formattedClosing 
    });
  } catch (error) {
    console.error('Error al crear cierre:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al crear cierre' 
    });
  }
},

  // Obtener resumen financiero
  getFinancialSummary: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          error: 'Fecha inicio y fin son requeridas' 
        });
      }
      
      const summary = await MonthlyClosing.getFinancialSummary(startDate, endDate);
      
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

export default monthlyClosingController;