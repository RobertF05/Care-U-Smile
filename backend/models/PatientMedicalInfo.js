// models/patientMedicalInfoModel.js
import { supabaseAdmin } from '../config/supabase.js';
import { 
  formatNicaraguaDateTime,
  formatNicaraguaDate
} from '../utils/timezoneUtils.js';

const PatientMedicalInfo = {
  // Obtener información médica por ID de paciente
  async getByPatientId(patientId) {
    const { data, error } = await supabaseAdmin
      .from('patient_medical_info')
      .select('*')
      .eq('Patient_ID', patientId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (data) {
      return {
        ...data,
        created_at_display: formatNicaraguaDateTime(data.created_at),
        updated_at_display: formatNicaraguaDateTime(data.updated_at),
        last_dental_visit_display: data.last_dental_visit ? 
          formatNicaraguaDate(data.last_dental_visit) : null
      };
    }
    
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
    
    return {
      ...data,
      created_at_display: formatNicaraguaDateTime(data.created_at),
      updated_at_display: formatNicaraguaDateTime(data.updated_at),
      last_dental_visit_display: data.last_dental_visit ? 
        formatNicaraguaDate(data.last_dental_visit) : null
    };
  },

  // Actualizar información médica
  async update(patientId, medicalData) {
    const existing = await this.getByPatientId(patientId);
    
    if (existing) {
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
      
      return {
        ...data,
        created_at_display: formatNicaraguaDateTime(data.created_at),
        updated_at_display: formatNicaraguaDateTime(data.updated_at),
        last_dental_visit_display: data.last_dental_visit ? 
          formatNicaraguaDate(data.last_dental_visit) : null
      };
    } else {
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

  // Obtener información médica con paciente
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
    
    if (data) {
      return {
        ...data,
        created_at_display: formatNicaraguaDateTime(data.created_at),
        updated_at_display: formatNicaraguaDateTime(data.updated_at),
        last_dental_visit_display: data.last_dental_visit ? 
          formatNicaraguaDate(data.last_dental_visit) : null,
        patient_name: `${data.patients?.first_name || ''} ${data.patients?.first_last_name || ''}`.trim(),
        patient_identification: data.patients?.identification,
        patient_phone: data.patients?.number_phone
      };
    }
    
    return data;
  }
};

export default PatientMedicalInfo;