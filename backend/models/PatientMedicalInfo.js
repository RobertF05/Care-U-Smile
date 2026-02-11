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
    try {
      const { data, error } = await supabaseAdmin
        .from('patient_medical_info')
        .insert([{
          Patient_ID: patientId,
          emergency_contact_name: medicalData.emergency_contact_name || null,
          emergency_contact_relationship: medicalData.emergency_contact_relationship || null,
          emergency_contact_phone: medicalData.emergency_contact_phone || null,
          oral_health_status: medicalData.oral_health_status || null,
          // IMPORTANTE: Manejar string vacío como null
          last_dental_visit: medicalData.last_dental_visit ? 
            medicalData.last_dental_visit : null,
          medical_conditions: medicalData.medical_conditions || null,
          allergies: medicalData.allergies || null,
          current_medications: medicalData.current_medications || null,
          previous_anesthesia: medicalData.previous_anesthesia || false,
          anesthesia_notes: medicalData.anesthesia_notes || null,
          smokes: medicalData.smokes || false,
          drinks_alcohol: medicalData.drinks_alcohol || false,
          other_substances: medicalData.other_substances || null,
          substance_frequency: medicalData.substance_frequency || null,
          general_notes: medicalData.general_notes || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al crear información médica:', error);
      throw error;
    }
  },

  // Actualizar información médica
  async update(patientId, medicalData) {
    try {
      // Verificar si existe información médica para este paciente
      const { data: existingInfo, error: checkError } = await supabaseAdmin
        .from('patient_medical_info')
        .select('medical_info_id')
        .eq('Patient_ID', patientId)
        .single();
      
      let data;
      
      if (checkError && checkError.code === 'PGRST116') {
        // No existe, crear nueva
        data = await this.create(patientId, medicalData);
      } else {
        // Existe, actualizar
        const updateData = {
          updated_at: new Date().toISOString()
        };
        
        // Solo actualizar campos que fueron enviados
        Object.keys(medicalData).forEach(key => {
          if (medicalData[key] !== undefined) {
            // Manejar especialmente last_dental_visit
            if (key === 'last_dental_visit') {
              updateData[key] = medicalData[key] ? medicalData[key] : null;
            } else {
              updateData[key] = medicalData[key];
            }
          }
        });
        
        const { data: updatedData, error } = await supabaseAdmin
          .from('patient_medical_info')
          .update(updateData)
          .eq('Patient_ID', patientId)
          .select()
          .single();
        
        if (error) throw error;
        data = updatedData;
      }
      
      return data;
    } catch (error) {
      console.error('Error al actualizar información médica:', error);
      throw error;
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