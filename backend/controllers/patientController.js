// controllers/patientController.js
import { supabaseAdmin } from '../config/supabase.js';

const patientController = {
  // Obtener todos los pacientes
  getAll: async (req, res) => {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      let query = supabaseAdmin
        .from('patients')
        .select('*', { count: 'exact' })
        .order('creation_date', { ascending: false });
      
      if (search) {
        query = query.or(`first_name.ilike.%${search}%,first_last_name.ilike.%${search}%,identification.ilike.%${search}%`);
      }
      
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      res.json({
        success: true,
        data,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
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
      
      const { data, error } = await supabaseAdmin
        .from('patients')
        .select('*')
        .eq('Patient_ID', id)
        .single();
      
      if (error) throw error;
      
      if (!data) {
        return res.status(404).json({
          success: false,
          error: 'Paciente no encontrado'
        });
      }
      
      res.json({
        success: true,
        data
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
          error: 'Nombre, apellido e identificación son requeridos'
        });
      }
      
      const { data, error } = await supabaseAdmin
        .from('patients')
        .insert([{
          ...patientData,
          creation_date: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(201).json({
        success: true,
        message: 'Paciente creado exitosamente',
        data
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
      
      const { data: existingPatient, error: checkError } = await supabaseAdmin
        .from('patients')
        .select('Patient_ID')
        .eq('Patient_ID', id)
        .single();
      
      if (checkError || !existingPatient) {
        return res.status(404).json({
          success: false,
          error: 'Paciente no encontrado'
        });
      }
      
      const { data, error } = await supabaseAdmin
        .from('patients')
        .update(patientData)
        .eq('Patient_ID', id)
        .select()
        .single();
      
      if (error) throw error;
      
      res.json({
        success: true,
        message: 'Paciente actualizado exitosamente',
        data
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
      
      // Verificar que el paciente exista
      const { data: existingPatient, error: checkError } = await supabaseAdmin
        .from('patients')
        .select('Patient_ID')
        .eq('Patient_ID', id)
        .single();
      
      if (checkError || !existingPatient) {
        return res.status(404).json({
          success: false,
          error: 'Paciente no encontrado'
        });
      }
      
      // Verificar si el paciente tiene citas asociadas
      const { data: appointments, error: appointmentsError } = await supabaseAdmin
        .from('clinical_appointments')
        .select('appointment_ID')
        .eq('Patient_ID', id);
      
      if (appointmentsError) throw appointmentsError;
      
      if (appointments && appointments.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'No se puede eliminar el paciente porque tiene citas asociadas'
        });
      }
      
      // Eliminar paciente
      const { data, error } = await supabaseAdmin
        .from('patients')
        .delete()
        .eq('Patient_ID', id)
        .select()
        .single();
      
      if (error) throw error;
      
      res.json({
        success: true,
        message: 'Paciente eliminado exitosamente',
        data
      });
    } catch (error) {
      console.error('Error al eliminar paciente:', error);
      res.status(500).json({
        success: false,
        error: 'Error al eliminar paciente'
      });
    }
  },

  // Buscar pacientes
  search: async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q) {
        return res.json({
          success: true,
          data: []
        });
      }
      
      const { data, error } = await supabaseAdmin
        .from('patients')
        .select('*')
        .or(`first_name.ilike.%${q}%,first_last_name.ilike.%${q}%,identification.ilike.%${q}%`)
        .limit(10);
      
      if (error) throw error;
      
      res.json({
        success: true,
        data: data || []
      });
    } catch (error) {
      console.error('Error al buscar pacientes:', error);
      res.status(500).json({
        success: false,
        error: 'Error al buscar pacientes'
      });
    }
  },

  // Contar pacientes
  count: async (req, res) => {
    try {
      const { count, error } = await supabaseAdmin
        .from('patients')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      
      res.json({
        success: true,
        count: count || 0
      });
    } catch (error) {
      console.error('Error al contar pacientes:', error);
      res.status(500).json({
        success: false,
        error: 'Error al contar pacientes'
      });
    }
  }
};

export default patientController;