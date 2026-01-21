// controllers/patientMedicalInfoController.js
import { supabaseAdmin } from '../config/supabase.js';

const patientMedicalInfoController = {
  // Obtener información médica por ID de paciente
  getByPatientId: async (req, res) => {
    try {
      const { patientId } = req.params;
      
      const { data, error } = await supabaseAdmin
        .from('patient_medical_info')
        .select('*')
        .eq('Patient_ID', patientId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      res.json({
        success: true,
        data: data || null
      });
    } catch (error) {
      console.error('Error al obtener información médica:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener información médica'
      });
    }
  },

  // Crear información médica
  create: async (req, res) => {
    try {
      const { patientId } = req.params;
      const medicalData = req.body;
      
      const { data, error } = await supabaseAdmin
        .from('patient_medical_info')
        .insert([{
          Patient_ID: patientId,
          ...medicalData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      res.status(201).json({
        success: true,
        message: 'Información médica creada exitosamente',
        data
      });
    } catch (error) {
      console.error('Error al crear información médica:', error);
      res.status(500).json({
        success: false,
        error: 'Error al crear información médica'
      });
    }
  },

  // Actualizar información médica
  update: async (req, res) => {
    try {
      const { patientId } = req.params;
      const medicalData = req.body;
      
      // Primero verificar si existe
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('patient_medical_info')
        .select('medical_info_id')
        .eq('Patient_ID', patientId)
        .single();
      
      let result;
      if (checkError && checkError.code === 'PGRST116') {
        // No existe, crear
        const { data, error } = await supabaseAdmin
          .from('patient_medical_info')
          .insert([{
            Patient_ID: patientId,
            ...medicalData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      } else if (checkError) {
        throw checkError;
      } else {
        // Existe, actualizar
        const { data, error } = await supabaseAdmin
          .from('patient_medical_info')
          .update({
            ...medicalData,
            updated_at: new Date().toISOString()
          })
          .eq('Patient_ID', patientId)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      }
      
      res.json({
        success: true,
        message: 'Información médica actualizada exitosamente',
        data: result
      });
    } catch (error) {
      console.error('Error al actualizar información médica:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar información médica'
      });
    }
  },

  // Eliminar información médica
  delete: async (req, res) => {
    try {
      const { patientId } = req.params;
      
      const { data, error } = await supabaseAdmin
        .from('patient_medical_info')
        .delete()
        .eq('Patient_ID', patientId)
        .select()
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      res.json({
        success: true,
        message: 'Información médica eliminada exitosamente',
        data
      });
    } catch (error) {
      console.error('Error al eliminar información médica:', error);
      res.status(500).json({
        success: false,
        error: 'Error al eliminar información médica'
      });
    }
  }
};

export default patientMedicalInfoController;