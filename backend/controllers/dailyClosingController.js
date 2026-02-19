// backend/controllers/dailyClosingController.js
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

  // Crear cierre diario
  create: async (req, res) => {
    try {
      const { date, closing_date, closing_type = 'general', comentary = '' } = req.body;
      
      const effectiveDate = date || closing_date;
      
      if (!effectiveDate) {
        return res.status(400).json({ 
          success: false, 
          error: 'La fecha es requerida' 
        });
      }
      
      const validTypes = ['general', 'orthodontics'];
      if (!validTypes.includes(closing_type)) {
        return res.status(400).json({ 
          success: false, 
          error: `Tipo de cierre inválido. Use: ${validTypes.join(', ')}` 
        });
      }
      
      const exists = await DailyClosing.exists(effectiveDate, closing_type);
      if (exists) {
        return res.status(400).json({ 
          success: false, 
          error: `Ya existe un cierre ${closing_type === 'orthodontics' ? 'de ortodoncia' : 'general'} para esta fecha` 
        });
      }

      const financialSummary = await DailyClosing.getDailyClosingSummary(effectiveDate, closing_type);
      
      const closingData = {
        closing_date: effectiveDate,
        closing_type,
        total_income: financialSummary.total_income,
        total_clinic_income: financialSummary.total_clinic_income,
        total_doctor_income: financialSummary.total_doctor_income,
        total_external_doctor_payments: financialSummary.total_external_doctor_payments,
        total_variable_expenses: financialSummary.total_variable_expenses,
        net_profit: financialSummary.net_profit,
        comentary,
        is_processed: false,
        expense_ids: financialSummary.expense_ids
      };
      
      const newClosing = await DailyClosing.create(closingData);
      
      if (financialSummary.procedureClosings && financialSummary.procedureClosings.length > 0) {
        try {
          const procedureClosings = financialSummary.procedureClosings.map(pc => ({
            procedure_id: pc.procedure_id,
            daily_closing_id: newClosing.daily_closing_id,
            clinic_income_portion: pc.clinic_income_portion || 0,
            doctor_income_portion: pc.doctor_income_portion || 0,
            external_doctor_payment: pc.external_doctor_payment || 0
          }));
          
          await DailyClosing.createProcedureRelations(procedureClosings);
        } catch (relationError) {
          console.warn('⚠️ No se pudieron crear relaciones:', relationError.message);
        }
      }
      
      const typeLabel = closing_type === 'orthodontics' ? 'de Ortodoncia' : 'General';
      
      res.status(201).json({ 
        success: true, 
        message: `✅ Cierre Diario ${typeLabel} creado exitosamente`,
        data: {
          ...newClosing,
          procedure_count: financialSummary.cantidad_procedimientos,
          variable_expenses_count: financialSummary.cantidad_gastos_variables,
          variable_expenses_total: financialSummary.total_variable_expenses
        }
      });
    } catch (error) {
      console.error('❌ Error al crear cierre diario:', error);
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
        error: error.message || 'Error al eliminar cierre diario' 
      });
    }
  },

  // Obtener resumen financiero del día (VERSIÓN PARA VISTA EN VIVO)
  getDailySummary: async (req, res) => {
    try {
      const { date } = req.query;
      
      if (!date) {
        return res.status(400).json({ 
          success: false, 
          error: 'La fecha es requerida' 
        });
      }
      
      console.log('📥 Obteniendo resumen diario para fecha:', date);
      
      const summary = await DailyClosing.getDailyFinancialSummary(date);
      
      res.json({ 
        success: true, 
        data: summary
      });
    } catch (error) {
      console.error('❌ Error en getDailySummary:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
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
      
      const validTypes = ['general', 'orthodontics'];
      if (!validTypes.includes(closing_type)) {
        return res.status(400).json({ 
          success: false, 
          error: `Tipo de cierre inválido. Use: ${validTypes.join(', ')}` 
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