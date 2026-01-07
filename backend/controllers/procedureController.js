import Procedure from '../models/procedureModel.js';

const procedureController = {
  // Obtener todos los procedimientos
  getAll: async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        startDate, 
        endDate, 
        isOrthodontics,
        patientId
      } = req.query;
      
      const filters = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (isOrthodontics !== undefined) filters.isOrthodontics = isOrthodontics === 'true';
      if (patientId) filters.patientId = patientId;
      
      const result = await Procedure.getAll(parseInt(page), parseInt(limit), filters);
      
      res.json({ 
        success: true, 
        ...result 
      });
    } catch (error) {
      console.error('Error al obtener procedimientos:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener procedimientos' 
      });
    }
  },

  // Obtener procedimiento por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const procedure = await Procedure.getById(id);
      
      if (!procedure) {
        return res.status(404).json({ 
          success: false, 
          error: 'Procedimiento no encontrado' 
        });
      }
      
      res.json({ 
        success: true, 
        data: procedure 
      });
    } catch (error) {
      console.error('Error al obtener procedimiento:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener procedimiento' 
      });
    }
  },

  // Crear procedimiento
  create: async (req, res) => {
    try {
      const procedureData = req.body;
      
      // Validar datos requeridos
      if (!procedureData.patient_id || !procedureData.procedure_description || 
          !procedureData.total_cost || !procedureData.payment_method) {
        return res.status(400).json({ 
          success: false, 
          error: 'Paciente, descripción, costo y forma de pago son requeridos' 
        });
      }
      
      const newProcedure = await Procedure.create(procedureData);
      
      res.status(201).json({ 
        success: true, 
        message: 'Procedimiento creado exitosamente',
        data: newProcedure 
      });
    } catch (error) {
      console.error('Error al crear procedimiento:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al crear procedimiento' 
      });
    }
  },

  // Actualizar procedimiento
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const procedureData = req.body;
      
      const procedure = await Procedure.getById(id);
      if (!procedure) {
        return res.status(404).json({ 
          success: false, 
          error: 'Procedimiento no encontrado' 
        });
      }
      
      const updatedProcedure = await Procedure.update(id, procedureData);
      
      res.json({ 
        success: true, 
        message: 'Procedimiento actualizado exitosamente',
        data: updatedProcedure 
      });
    } catch (error) {
      console.error('Error al actualizar procedimiento:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar procedimiento' 
      });
    }
  },

  // Eliminar procedimiento
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      const procedure = await Procedure.getById(id);
      if (!procedure) {
        return res.status(404).json({ 
          success: false, 
          error: 'Procedimiento no encontrado' 
        });
      }
      
      await Procedure.delete(id);
      
      res.json({ 
        success: true, 
        message: 'Procedimiento eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error al eliminar procedimiento:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al eliminar procedimiento' 
      });
    }
  },

  // Obtener procedimientos por paciente
  getByPatientId: async (req, res) => {
    try {
      const { patientId } = req.params;
      const procedures = await Procedure.getByPatientId(patientId);
      
      res.json({ 
        success: true, 
        data: procedures 
      });
    } catch (error) {
      console.error('Error al obtener procedimientos:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener procedimientos' 
      });
    }
  },

  // Obtener estadísticas de ingresos
  getIncomeStats: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          error: 'Fecha inicio y fin son requeridas' 
        });
      }
      
      const stats = await Procedure.getIncomeStats(startDate, endDate);
      
      res.json({ 
        success: true, 
        data: stats 
      });
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener estadísticas' 
      });
    }
  }
};

export default procedureController;