import DailyClosing from '../models/dailyClosingModel.js';

const dailyClosingController = {
  // Obtener todos los cierres diarios
  getAll: async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 30, 
        closing_type, 
        startDate, 
        endDate 
      } = req.query;
      
      const filters = {};
      if (closing_type) filters.closing_type = closing_type;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      
      const result = await DailyClosing.getAll(parseInt(page), parseInt(limit), filters);
      
      res.json({ 
        success: true, 
        ...result 
      });
    } catch (error) {
      console.error('Error al obtener cierres diarios:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener cierres diarios' 
      });
    }
  },

  // Obtener cierre por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const closing = await DailyClosing.getById(id);
      
      if (!closing) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cierre diario no encontrado' 
        });
      }
      
      res.json({ 
        success: true, 
        data: closing 
      });
    } catch (error) {
      console.error('Error al obtener cierre diario:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener cierre diario' 
      });
    }
  },

  // Crear cierre diario - VERSIÓN SIMPLIFICADA
  create: async (req, res) => {
    try {
      const { date, closing_date, closing_type = 'general', comentary = '' } = req.body;
      
      console.log('🔍 DEBUG Controller - Datos recibidos:', req.body);
      
      // Determinar qué fecha usar
      const effectiveDate = date || closing_date;
      
      if (!effectiveDate) {
        return res.status(400).json({ 
          success: false, 
          error: 'La fecha es requerida' 
        });
      }
      
      // Verificar si ya existe cierre
      const exists = await DailyClosing.exists(effectiveDate, closing_type);
      if (exists) {
        return res.status(400).json({ 
          success: false, 
          error: `Ya existe un cierre ${closing_type === 'orthodontics' ? 'de ortodoncia' : 'general'} para esta fecha` 
        });
      }
      
      // Obtener resumen financiero
      const financialSummary = await DailyClosing.getDailyFinancialSummary(effectiveDate, closing_type);
      
      // Crear cierre diario
      const closingData = {
        closing_date: effectiveDate,
        closing_type,
        total_income: financialSummary.total_income,
        total_clinic_income: financialSummary.total_clinic_income,
        total_doctor_income: financialSummary.total_doctor_income,
        total_external_doctor_payments: financialSummary.total_external_doctor_payments,
        net_profit: financialSummary.net_profit,
        comentary,
        is_processed: false
      };
      
      console.log('📤 Creando cierre con datos:', closingData);
      
      const newClosing = await DailyClosing.create(closingData);
      
      console.log('✅ Cierre creado, ID:', newClosing.daily_closing_id);
      
      // Verificar que tenemos el ID
      if (!newClosing.daily_closing_id) {
        console.error('❌ No se recibió daily_closing_id del cierre creado');
        console.log('📄 Cierre completo recibido:', newClosing);
        
        // Intentar obtener el ID de diferentes formas
        const closingId = newClosing.daily_closing_id || newClosing.id || newClosing.daily_closing_ID;
        console.log('🔍 IDs disponibles:', { 
          daily_closing_id: newClosing.daily_closing_id,
          id: newClosing.id,
          daily_closing_ID: newClosing.daily_closing_ID 
        });
        
        if (!closingId) {
          throw new Error('No se pudo obtener el ID del cierre creado');
        }
        
        newClosing.daily_closing_id = closingId;
      }
      
      // Crear relaciones con procedimientos - USAR minúsculas
      if (financialSummary.procedureClosings && financialSummary.procedureClosings.length > 0) {
        console.log(`📝 Creando ${financialSummary.procedureClosings.length} relaciones de procedimientos`);
        
        // Verificar estructura del primer elemento
        const firstProcedure = financialSummary.procedureClosings[0];
        console.log('🔍 Estructura del primer procedureClosing:', firstProcedure);
        
        try {
          const procedureClosings = financialSummary.procedureClosings.map(pc => ({
            // IMPORTANTE: Usar minúsculas
            procedure_id: pc.procedure_id, // Ya viene como minúscula desde el modelo
            daily_closing_id: newClosing.daily_closing_id,
            clinic_income_portion: pc.clinic_income_portion || 0,
            doctor_income_portion: pc.doctor_income_portion || 0,
            external_doctor_payment: pc.external_doctor_payment || 0
          }));
          
          console.log('📤 Insertando relaciones con minúsculas:', procedureClosings);
          await DailyClosing.createProcedureRelations(procedureClosings);
        } catch (relationError) {
          console.warn('⚠️ No se pudieron crear relaciones, pero el cierre se guardó:', relationError.message);
          // Continuar sin relaciones - esto no debería impedir la creación del cierre
        }
      } else {
        console.log('ℹ️ No hay procedimientos para crear relaciones');
      }
      
      // Marcar gastos como procesados
      if (financialSummary.bills && financialSummary.bills.length > 0) {
        const billIds = financialSummary.bills.map(bill => bill.bill_ID);
        await DailyClosing.markBillsAsProcessed(billIds, newClosing.daily_closing_id, 'daily');
      }
      
      res.status(201).json({ 
        success: true, 
        message: `Cierre ${closing_type === 'orthodontics' ? 'de ortodoncia' : 'general'} creado exitosamente`,
        data: {
          ...newClosing,
          procedure_count: financialSummary.procedures ? financialSummary.procedures.length : 0,
          bill_count: financialSummary.bills ? financialSummary.bills.length : 0,
          clinic_percentage: financialSummary.clinic_percentage,
          doctor_percentage: financialSummary.doctor_percentage
        }
      });
    } catch (error) {
      console.error('❌ Error completo al crear cierre diario:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al crear cierre diario: ' + error.message 
      });
    }
  },

  // Actualizar cierre diario
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const closingData = req.body;
      
      const closing = await DailyClosing.getById(id);
      if (!closing) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cierre diario no encontrado' 
        });
      }
      
      const updatedClosing = await DailyClosing.update(id, closingData);
      
      res.json({ 
        success: true, 
        message: 'Cierre diario actualizado exitosamente',
        data: updatedClosing 
      });
    } catch (error) {
      console.error('Error al actualizar cierre diario:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar cierre diario' 
      });
    }
  },

  // Eliminar cierre diario
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      const closing = await DailyClosing.getById(id);
      if (!closing) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cierre diario no encontrado' 
        });
      }
      
      await DailyClosing.delete(id);
      
      res.json({ 
        success: true, 
        message: 'Cierre diario eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error al eliminar cierre diario:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al eliminar cierre diario' 
      });
    }
  },

  // Obtener resumen financiero del día (sin crear cierre)
  getDailySummary: async (req, res) => {
    try {
      const { date, closing_type = 'general' } = req.query;
      
      if (!date) {
        return res.status(400).json({ 
          success: false, 
          error: 'La fecha es requerida' 
        });
      }
      
      const summary = await DailyClosing.getDailyFinancialSummary(date, closing_type);
      
      // Verificar si ya existe cierre
      const exists = await DailyClosing.exists(date, closing_type);
      
      res.json({ 
        success: true, 
        data: {
          ...summary,
          closing_exists: exists
        }
      });
    } catch (error) {
      console.error('Error al obtener resumen diario:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener resumen diario' 
      });
    }
  },

  // Obtener estadísticas por rango de fechas
  getStatsByDateRange: async (req, res) => {
    try {
      const { startDate, endDate, closing_type = 'general' } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          error: 'Fecha inicio y fin son requeridas' 
        });
      }
      
      const result = await DailyClosing.getStatsByDateRange(startDate, endDate, closing_type);
      
      res.json({ 
        success: true, 
        ...result 
      });
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener estadísticas' 
      });
    }
  },

  // Verificar si existe cierre para fecha
  checkExists: async (req, res) => {
    try {
      const { date, closing_type = 'general' } = req.query;
      
      if (!date) {
        return res.status(400).json({ 
          success: false, 
          error: 'La fecha es requerida' 
        });
      }
      
      const exists = await DailyClosing.exists(date, closing_type);
      
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
  }
};

export default dailyClosingController;