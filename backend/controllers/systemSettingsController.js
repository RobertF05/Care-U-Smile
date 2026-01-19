// backend/controllers/systemSettingsController.js
import SystemSettings from '../models/systemSettingsModel.js';

const systemSettingsController = {
  // Obtener todas las configuraciones
  getAll: async (req, res) => {
    try {
      const settings = await SystemSettings.getAll();
      
      res.json({ 
        success: true, 
        data: settings 
      });
    } catch (error) {
      console.error('Error al obtener configuraciones:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener configuraciones' 
      });
    }
  },

  // Obtener configuración por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const settings = await SystemSettings.getById(id);
      
      if (!settings) {
        return res.status(404).json({ 
          success: false, 
          error: 'Configuración no encontrada' 
        });
      }
      
      res.json({ 
        success: true, 
        data: settings 
      });
    } catch (error) {
      console.error('Error al obtener configuración:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener configuración' 
      });
    }
  },

  // Obtener configuración actual
  getCurrent: async (req, res) => {
    try {
      const settings = await SystemSettings.getCurrent();
      
      res.json({ 
        success: true, 
        data: settings || {
          clinic_payment: 40,
          doctor_payment: 60,
          exchange_rate: 36.5
        }
      });
    } catch (error) {
      console.error('Error al obtener configuración actual:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener configuración actual' 
      });
    }
  },

  // Obtener porcentajes de ortodoncia
  getOrthodonticsPercentages: async (req, res) => {
    try {
      const percentages = await SystemSettings.getOrthodonticsPercentages();
      
      res.json({ 
        success: true, 
        data: percentages 
      });
    } catch (error) {
      console.error('Error al obtener porcentajes:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener porcentajes' 
      });
    }
  },

  // Crear nueva configuración
  create: async (req, res) => {
    try {
      const { clinic_payment, doctor_payment, exchange_rate } = req.body;
      
      // Validar datos requeridos
      if (clinic_payment === undefined || doctor_payment === undefined || exchange_rate === undefined) {
        return res.status(400).json({ 
          success: false, 
          error: 'clinic_payment, doctor_payment y exchange_rate son requeridos' 
        });
      }

      // Validar que sean números
      if (isNaN(clinic_payment) || isNaN(doctor_payment) || isNaN(exchange_rate)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Todos los valores deben ser números' 
        });
      }

      const newSettings = await SystemSettings.create({
        clinic_payment,
        doctor_payment,
        exchange_rate
      });
      
      res.status(201).json({ 
        success: true, 
        message: 'Configuración creada exitosamente',
        data: newSettings 
      });
    } catch (error) {
      console.error('Error al crear configuración:', error);
      res.status(400).json({ 
        success: false, 
        error: error.message || 'Error al crear configuración' 
      });
    }
  },

  // Actualizar configuración
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const settingsData = req.body;
      
      // Validar que al menos un campo sea proporcionado
      if (Object.keys(settingsData).length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Debe proporcionar al menos un campo para actualizar' 
        });
      }

      const updatedSettings = await SystemSettings.update(id, settingsData);
      
      res.json({ 
        success: true, 
        message: 'Configuración actualizada exitosamente',
        data: updatedSettings 
      });
    } catch (error) {
      console.error('Error al actualizar configuración:', error);
      res.status(400).json({ 
        success: false, 
        error: error.message || 'Error al actualizar configuración' 
      });
    }
  },

  // Eliminar configuración
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      await SystemSettings.delete(id);
      
      res.json({ 
        success: true, 
        message: 'Configuración eliminada exitosamente'
      });
    } catch (error) {
      console.error('Error al eliminar configuración:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al eliminar configuración' 
      });
    }
  },

  // Obtener historial
  getHistory: async (req, res) => {
    try {
      const { limit = 10 } = req.query;
      const history = await SystemSettings.getHistory(parseInt(limit));
      
      res.json({ 
        success: true, 
        data: history 
      });
    } catch (error) {
      console.error('Error al obtener historial:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener historial' 
      });
    }
  }
};

export default systemSettingsController;