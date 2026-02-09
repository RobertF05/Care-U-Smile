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

  // monthlyClosingController.js - Función create COMPLETA
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
    
    console.log('📝 Datos recibidos para crear cierre:', {
      month, 
      year, 
      startDate, 
      endDate, 
      closing_type,
      deleteVariableExpenses
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
    
    console.log('📅 Período calculado para el cierre:', { 
      month,
      year,
      startDate: periodStartDate, 
      endDate: periodEndDate,
      type: closing_type,
      startDateProvided: !!startDate,
      endDateProvided: !!endDate
    });
    
    // DEBUG: Verificar formato de fechas
    console.log('🔍 DEBUG - Verificación de fechas:', {
      periodStartDate,
      periodEndDate,
      startDateLength: periodStartDate.length,
      endDateLength: periodEndDate.length,
      expectedFormat: 'YYYY-MM-DD'
    });
    
    // DEBUG: Verificar si hay datos en bills para este período
    console.log('🔍 DEBUG - Verificando gastos en bills...');
    try {
      const { data: billsInPeriod, error: billsError } = await supabaseAdmin
        .from('bills')
        .select('bill_ID, description, amount, bill_date, is_recurrent, currency_used')
        .gte('bill_date', periodStartDate)
        .lte('bill_date', periodEndDate);
      
      if (billsError) {
        console.error('❌ Error verificando bills:', billsError);
      } else {
        console.log('📊 DEBUG - Bills encontrados en período:', {
          total: billsInPeriod?.length || 0,
          fixed: billsInPeriod?.filter(b => b.is_recurrent === true).length || 0,
          variable: billsInPeriod?.filter(b => b.is_recurrent === false).length || 0,
          sample: billsInPeriod?.slice(0, 3).map(b => ({
            id: b.bill_ID,
            date: b.bill_date,
            amount: b.amount,
            recurrent: b.is_recurrent,
            desc: b.description
          }))
        });
      }
    } catch (debugError) {
      console.error('❌ Error en debug de bills:', debugError);
    }
    
    // Obtener resumen financiero según tipo
    console.log('🧮 Obteniendo resumen financiero...');
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
      closing_type: financialSummary.closing_type
    });
    
    // Solo obtener información de gastos para referencia, NO marcarlos como procesados
    let variableBillsProcessed = [];
    let variableExpensesAmount = 0;
    
    // Solo para cierres completos
    if (closing_type === 'all') {
      console.log('💰 Procesando información de gastos variables (solo lectura)...');
      try {
        const { data: variableBills, error } = await supabaseAdmin
          .from('bills')
          .select('bill_ID, description, amount, currency_used, amount_usd, exchange_rate_bill, bill_date')
          .eq('is_recurrent', false)
          .gte('bill_date', periodStartDate)
          .lte('bill_date', periodEndDate);
        
        if (!error && variableBills) {
          variableBillsProcessed = variableBills;
          
          // Calcular monto total en córdobas para referencia
          variableExpensesAmount = variableBillsProcessed.reduce((sum, bill) => {
            if (bill.currency_used === 'USD') {
              return sum + ((bill.amount_usd || 0) * (bill.exchange_rate_bill || 36.5));
            } else {
              return sum + (bill.amount || 0);
            }
          }, 0);
          
          console.log(`📊 ${variableBillsProcessed.length} gastos variables encontrados (NO procesados):`, {
            cantidad: variableBillsProcessed.length,
            montoTotal: variableExpensesAmount,
            muestra: variableBillsProcessed.slice(0, 3).map(b => ({
              id: b.bill_ID,
              desc: b.description,
              monto: b.amount || b.amount_usd,
              moneda: b.currency_used
            }))
          });
        } else if (error) {
          console.warn('⚠️ Error obteniendo gastos variables:', error.message);
        }
      } catch (billError) {
        console.warn('⚠️ Error al obtener gastos variables:', billError.message);
      }
    }
    
    // Crear cierre - SOLO con columnas que existen en la tabla
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
      // IMPORTANTE: Siempre false, no marcamos gastos como procesados
      processed_variable_expenses: false,
      daily_closings_included: false,
      orthodontics_daily_closings_included: false
    };
    
    console.log('📤 Datos finales para crear cierre en BD:', closingData);
    
    const newClosing = await MonthlyClosing.create(closingData);
    
    console.log('✅ Cierre creado en BD:', {
      id: newClosing.closing_ID,
      month: newClosing.month,
      year: newClosing.year,
      tipo: newClosing.closing_type
    });
    
    // Formatear respuesta
    const formattedClosing = {
      ...newClosing,
      closing_ID: newClosing.closing_ID,
      id: newClosing.closing_ID,
      variable_expenses_processed: 0, // Siempre 0 porque no procesamos
      variable_expenses_amount: variableExpensesAmount,
      delete_operation: 'skipped', // Siempre skipped
      // Agregar información adicional para la respuesta (no se guarda en BD)
      clinic_percentage: financialSummary.clinic_percentage,
      doctor_percentage: financialSummary.doctor_percentage,
      exchange_rate: financialSummary.exchange_rate,
      // Información de doctores externos si existe
      total_external_doctor_payments: financialSummary.total_external_doctor_payments || 0
    };
    
    const typeLabel = getClosingTypeLabel(closing_type);
    
    // Mensaje de éxito detallado
    let successMessage = `✅ Cierre mensual ${typeLabel} creado exitosamente`;
    
    if (closing_type === 'all') {
      const totalClinicIncome = (financialSummary.total_general_income || 0) + 
                               (financialSummary.total_clinical_orthodontic_income || 0);
      const totalExpenses = (financialSummary.total_fixed_expenses || 0) + 
                           (financialSummary.total_variable_expenses || 0);
      
      successMessage += `\n\n📊 RESUMEN:\n`;
      successMessage += `• Procedimientos Generales: C$${financialSummary.total_general_income?.toFixed(2) || '0.00'}\n`;
      successMessage += `• Ortodoncia Clínica (${financialSummary.clinic_percentage || 40}%): C$${financialSummary.total_clinical_orthodontic_income?.toFixed(2) || '0.00'}\n`;
      successMessage += `• Ortodoncia Doctora (${financialSummary.doctor_percentage || 60}%): C$${financialSummary.total_orthodontic_doctor_income?.toFixed(2) || '0.00'}\n`;
      successMessage += `• Gastos Fijos: C$${financialSummary.total_fixed_expenses?.toFixed(2) || '0.00'}\n`;
      successMessage += `• Gastos Variables: C$${financialSummary.total_variable_expenses?.toFixed(2) || '0.00'}\n`;
      successMessage += `• Total Gastos: C$${totalExpenses.toFixed(2)}\n`;
      successMessage += `• Total Ingresos Clínica: C$${totalClinicIncome.toFixed(2)}\n`;
      successMessage += `• Utilidad Neta: C$${financialSummary.net_profit?.toFixed(2) || '0.00'}`;
      
      if (financialSummary.total_external_doctor_payments) {
        successMessage += `\n• Pagos Doctores Externos: C$${financialSummary.total_external_doctor_payments.toFixed(2)} (ya deducidos)`;
      }
    }
    
    console.log('📤 Enviando respuesta al cliente...');
    
    res.status(201).json({ 
      success: true, 
      message: successMessage,
      data: formattedClosing,
      debug: {
        periodo: `${periodStartDate} al ${periodEndDate}`,
        gastos_variables_encontrados: variableBillsProcessed.length,
        gastos_variables_monto: variableExpensesAmount,
        procesamiento_gastos: 'NO PROCESADOS (solo lectura)'
      }
    });
    
  } catch (error) {
    console.error('❌ Error completo al crear cierre:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      timestamp: new Date().toISOString()
    });
    
    let errorMessage = 'Error al crear cierre: ' + error.message;
    
    // Mensajes de error más específicos
    if (error.message.includes('duplicate key')) {
      errorMessage = `Ya existe un cierre para ${req.body.month} ${req.body.year}`;
    } else if (error.message.includes('network') || error.message.includes('connection')) {
      errorMessage = 'Error de conexión con la base de datos. Verifique la conexión.';
    } else if (error.message.includes('invalid input syntax')) {
      errorMessage = 'Error en el formato de los datos. Verifique las fechas.';
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage,
      debug: req.body // Para ayudar en debugging
    });
  }
},

// Agregar en monthlyClosingController.js
getExternalDoctorDetails: async (req, res) => {
  try {
    const { startDate, endDate, closing_type = 'all' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Fecha inicio y fin son requeridas' 
      });
    }
    
    const details = await MonthlyClosing.getExternalDoctorPayments(startDate, endDate);
    
    // Filtrar por tipo si es necesario
    if (closing_type !== 'all') {
      // Necesitarías una función para obtener procedimientos por tipo
      // y luego filtrar los pagos de doctores externos
    }
    
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