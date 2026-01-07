import Appointment from '../models/appointmentModel.js';

const appointmentController = {
  // Obtener todas las citas
  getAll: async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        startDate, 
        endDate, 
        state,
        patientId
      } = req.query;
      
      const filters = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (state) filters.state = state;
      if (patientId) filters.patientId = patientId;
      
      const result = await Appointment.getAll(parseInt(page), parseInt(limit), filters);
      
      res.json({ 
        success: true, 
        ...result 
      });
    } catch (error) {
      console.error('Error al obtener citas:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener citas' 
      });
    }
  },

  // Obtener cita por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const appointment = await Appointment.getById(id);
      
      if (!appointment) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cita no encontrada' 
        });
      }
      
      res.json({ 
        success: true, 
        data: appointment 
      });
    } catch (error) {
      console.error('Error al obtener cita:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener cita' 
      });
    }
  },

  // Crear cita
  create: async (req, res) => {
    try {
      const appointmentData = req.body;
      
      // Validar datos requeridos
      if (!appointmentData.patient_id || !appointmentData.appointment_date) {
        return res.status(400).json({ 
          success: false, 
          error: 'Paciente y fecha son requeridos' 
        });
      }
      
      const newAppointment = await Appointment.create(appointmentData);
      
      res.status(201).json({ 
        success: true, 
        message: 'Cita creada exitosamente',
        data: newAppointment 
      });
    } catch (error) {
      console.error('Error al crear cita:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al crear cita' 
      });
    }
  },

  // Actualizar cita
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const appointmentData = req.body;
      
      const appointment = await Appointment.getById(id);
      if (!appointment) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cita no encontrada' 
        });
      }
      
      const updatedAppointment = await Appointment.update(id, appointmentData);
      
      res.json({ 
        success: true, 
        message: 'Cita actualizada exitosamente',
        data: updatedAppointment 
      });
    } catch (error) {
      console.error('Error al actualizar cita:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar cita' 
      });
    }
  },

  // Eliminar cita
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      const appointment = await Appointment.getById(id);
      if (!appointment) {
        return res.status(404).json({ 
          success: false, 
          error: 'Cita no encontrada' 
        });
      }
      
      await Appointment.delete(id);
      
      res.json({ 
        success: true, 
        message: 'Cita eliminada exitosamente'
      });
    } catch (error) {
      console.error('Error al eliminar cita:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al eliminar cita' 
      });
    }
  },

  // Obtener citas por fecha
  getByDate: async (req, res) => {
    try {
      const { date } = req.params;
      const appointments = await Appointment.getByDate(date);
      
      res.json({ 
        success: true, 
        data: appointments 
      });
    } catch (error) {
      console.error('Error al obtener citas por fecha:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener citas por fecha' 
      });
    }
  }
};

export default appointmentController;