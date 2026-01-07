import Patient from '../models/patientModel.js';

const patientController = {
  // Obtener todos los pacientes
  getAll: async (req, res) => {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const result = await Patient.getAll(parseInt(page), parseInt(limit), search);
      
      res.json({ 
        success: true, 
        ...result 
      });
    } catch (error) {
      console.error('Error al obtener pacientes:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener pacientes' 
      });
    }
  },

  // Obtener paciente por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const patient = await Patient.getById(id);
      
      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          error: 'Paciente no encontrado' 
        });
      }
      
      res.json({ 
        success: true, 
        data: patient 
      });
    } catch (error) {
      console.error('Error al obtener paciente:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener paciente' 
      });
    }
  },

  // Crear paciente
  create: async (req, res) => {
    try {
      const patientData = req.body;
      
      // Validar datos requeridos
      if (!patientData.first_name || !patientData.first_last_name || !patientData.identification) {
        return res.status(400).json({ 
          success: false, 
          error: 'Nombre, apellido y cédula son requeridos' 
        });
      }
      
      // Verificar si ya existe
      const existingPatient = await Patient.findByIdentification(patientData.identification);
      if (existingPatient) {
        return res.status(400).json({ 
          success: false, 
          error: 'Ya existe un paciente con esta cédula' 
        });
      }
      
      const newPatient = await Patient.create(patientData);
      
      res.status(201).json({ 
        success: true, 
        message: 'Paciente creado exitosamente',
        data: newPatient 
      });
    } catch (error) {
      console.error('Error al crear paciente:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al crear paciente' 
      });
    }
  },

  // Actualizar paciente
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const patientData = req.body;
      
      const patient = await Patient.getById(id);
      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          error: 'Paciente no encontrado' 
        });
      }
      
      const updatedPatient = await Patient.update(id, patientData);
      
      res.json({ 
        success: true, 
        message: 'Paciente actualizado exitosamente',
        data: updatedPatient 
      });
    } catch (error) {
      console.error('Error al actualizar paciente:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar paciente' 
      });
    }
  },

  // Eliminar paciente
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      const patient = await Patient.getById(id);
      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          error: 'Paciente no encontrado' 
        });
      }
      
      await Patient.delete(id);
      
      res.json({ 
        success: true, 
        message: 'Paciente eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error al eliminar paciente:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al eliminar paciente' 
      });
    }
  }
};

export default patientController;