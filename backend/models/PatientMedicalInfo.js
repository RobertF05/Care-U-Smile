// models/PatientMedicalInfo.js
import { supabaseAdmin } from '../config/supabase.js';

const PatientMedicalInfo = {
  // Obtener información médica por ID de paciente
  async getByPatientId(patientId) {
    const { data, error } = await supabaseAdmin
      .from('patient_medical_info')
      .select('*')
      .eq('Patient_ID', patientId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Crear información médica
  async create(patientId, medicalData) {
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
    return data;
  },

  // Actualizar información médica
  async update(patientId, medicalData) {
    // Primero verificar si existe
    const existing = await this.getByPatientId(patientId);
    
    if (existing) {
      // Actualizar
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
      return data;
    } else {
      // Crear si no existe
      return await this.create(patientId, medicalData);
    }
  },

  // Eliminar información médica
  async delete(patientId) {
    const { data, error } = await supabaseAdmin
      .from('patient_medical_info')
      .delete()
      .eq('Patient_ID', patientId)
      .select()
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Obtener información médica con paciente (join)
  async getWithPatient(patientId) {
    const { data, error } = await supabaseAdmin
      .from('patient_medical_info')
      .select(`
        *,
        patients (
          first_name,
          first_last_name,
          identification,
          number_phone
        )
      `)
      .eq('Patient_ID', patientId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
};

export default PatientMedicalInfo;