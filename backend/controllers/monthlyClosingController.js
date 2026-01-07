import MonthlyClosing from '../models/monthlyClosingModel.js';

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
      
      res.json({ 
        success: true, 
        data: closing 
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
  create: async (req, res) => {
    try {
      const { month, year, startDate, endDate, comentary = '' } = req.body;
      
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
      
      // Crear cierre
      const closingData = {
        month,
        year,
        ...financialSummary,
        comentary
      };
      
      const newClosing = await MonthlyClosing.create(closingData);
      
      res.status(201).json({ 
        success: true, 
        message: 'Cierre mensual creado exitosamente',
        data: newClosing 
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