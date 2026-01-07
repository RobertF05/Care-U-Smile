import Bill from '../models/billModel.js';

const billController = {
  // Obtener todos los gastos
  getAll: async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        category, 
        type, 
        startDate, 
        endDate 
      } = req.query;
      
      const filters = {};
      if (category) filters.category = category;
      if (type) filters.type = type;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      
      const result = await Bill.getAll(parseInt(page), parseInt(limit), filters);
      
      res.json({ 
        success: true, 
        ...result 
      });
    } catch (error) {
      console.error('Error al obtener gastos:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener gastos' 
      });
    }
  },

  // Obtener gasto por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const bill = await Bill.getById(id);
      
      if (!bill) {
        return res.status(404).json({ 
          success: false, 
          error: 'Gasto no encontrado' 
        });
      }
      
      res.json({ 
        success: true, 
        data: bill 
      });
    } catch (error) {
      console.error('Error al obtener gasto:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener gasto' 
      });
    }
  },

  // Crear gasto
  create: async (req, res) => {
    try {
      const billData = req.body;
      
      // Validar datos requeridos
      if (!billData.description || !billData.amount || !billData.bill_date) {
        return res.status(400).json({ 
          success: false, 
          error: 'Descripción, monto y fecha son requeridos' 
        });
      }
      
      const newBill = await Bill.create(billData);
      
      res.status(201).json({ 
        success: true, 
        message: 'Gasto creado exitosamente',
        data: newBill 
      });
    } catch (error) {
      console.error('Error al crear gasto:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al crear gasto' 
      });
    }
  },

  // Actualizar gasto
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const billData = req.body;
      
      const bill = await Bill.getById(id);
      if (!bill) {
        return res.status(404).json({ 
          success: false, 
          error: 'Gasto no encontrado' 
        });
      }
      
      const updatedBill = await Bill.update(id, billData);
      
      res.json({ 
        success: true, 
        message: 'Gasto actualizado exitosamente',
        data: updatedBill 
      });
    } catch (error) {
      console.error('Error al actualizar gasto:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar gasto' 
      });
    }
  },

  // Eliminar gasto
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      const bill = await Bill.getById(id);
      if (!bill) {
        return res.status(404).json({ 
          success: false, 
          error: 'Gasto no encontrado' 
        });
      }
      
      await Bill.delete(id);
      
      res.json({ 
        success: true, 
        message: 'Gasto eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error al eliminar gasto:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al eliminar gasto' 
      });
    }
  },

  // Obtener gastos recurrentes
  getRecurrentBills: async (req, res) => {
    try {
      const bills = await Bill.getRecurrentBills();
      
      res.json({ 
        success: true, 
        data: bills 
      });
    } catch (error) {
      console.error('Error al obtener gastos recurrentes:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener gastos recurrentes' 
      });
    }
  },

  // Obtener estadísticas de gastos
  getExpenseStats: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          error: 'Fecha inicio y fin son requeridas' 
        });
      }
      
      const stats = await Bill.getExpenseStats(startDate, endDate);
      
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

export default billController;