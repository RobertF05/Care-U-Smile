// controllers/patientController.js
import { supabaseAdmin } from '../config/supabase.js';
// Agregar al principio del archivo:
import PatientMedicalInfo from '../models/PatientMedicalInfo.js';

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
// controllers/patientController.js - Actualizar el método create:
create: async (req, res) => {
  try {
    const patientData = req.body;
    
    // Separar datos personales y médicos
    const {
      emergency_contact_name,
      emergency_contact_relationship,
      emergency_contact_phone,
      oral_health_status,
      last_dental_visit,
      medical_conditions,
      allergies,
      current_medications,
      previous_anesthesia,
      anesthesia_notes,
      smokes,
      drinks_alcohol,
      other_substances,
      substance_frequency,
      general_notes,
      ...personalData
    } = patientData;
    
    // Validar datos personales requeridos
    if (!personalData.first_name || !personalData.first_last_name || !personalData.identification) {
      return res.status(400).json({
        success: false,
        error: 'Nombre, apellido e identificación son requeridos'
      });
    }
    
    // Crear paciente
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .insert([{
        ...personalData,
        creation_date: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (patientError) throw patientError;
    
    // Si hay datos médicos, crear información médica
    let medicalInfo = null;
    const hasMedicalData = 
      emergency_contact_name ||
      emergency_contact_relationship ||
      emergency_contact_phone ||
      oral_health_status ||
      last_dental_visit ||
      medical_conditions ||
      allergies ||
      current_medications ||
      previous_anesthesia !== undefined ||
      anesthesia_notes ||
      smokes !== undefined ||
      drinks_alcohol !== undefined ||
      other_substances ||
      substance_frequency ||
      general_notes;
    
    if (hasMedicalData && patient) {
      try {
        const medicalData = {
          emergency_contact_name,
          emergency_contact_relationship,
          emergency_contact_phone,
          oral_health_status,
          last_dental_visit,
          medical_conditions,
          allergies,
          current_medications,
          previous_anesthesia: previous_anesthesia || false,
          anesthesia_notes,
          smokes: smokes || false,
          drinks_alcohol: drinks_alcohol || false,
          other_substances,
          substance_frequency,
          general_notes
        };
        
        medicalInfo = await PatientMedicalInfo.create(patient.Patient_ID, medicalData);
      } catch (medicalError) {
        console.error('Error al crear información médica:', medicalError);
        // No fallar la creación del paciente si hay error en info médica
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Paciente creado exitosamente',
      data: {
        ...patient,
        medical_info: medicalInfo
      }
    });
  } catch (error) {
    console.error('Error al crear paciente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear paciente'
    });
  }
},

// Actualizar el método getById para incluir información médica:
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
    
    // Obtener información médica si existe
    let medicalInfo = null;
    try {
      medicalInfo = await PatientMedicalInfo.getByPatientId(id);
    } catch (medicalError) {
      console.error('Error al obtener información médica:', medicalError);
    }
    
    res.json({
      success: true,
      data: {
        ...data,
        medical_info: medicalInfo
      }
    });
  } catch (error) {
    console.error('Error al obtener paciente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener paciente'
    });
  }
},

// Actualizar el método update para manejar información médica:
update: async (req, res) => {
  try {
    const { id } = req.params;
    const patientData = req.body;
    
    // Separar datos personales y médicos
    const {
      emergency_contact_name,
      emergency_contact_relationship,
      emergency_contact_phone,
      oral_health_status,
      last_dental_visit,
      medical_conditions,
      allergies,
      current_medications,
      previous_anesthesia,
      anesthesia_notes,
      smokes,
      drinks_alcohol,
      other_substances,
      substance_frequency,
      general_notes,
      ...personalData
    } = patientData;
    
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
    
    // Actualizar datos personales
    const { data, error } = await supabaseAdmin
      .from('patients')
      .update(personalData)
      .eq('Patient_ID', id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Actualizar información médica si existe
    let medicalInfo = null;
    const hasMedicalData = 
      emergency_contact_name !== undefined ||
      emergency_contact_relationship !== undefined ||
      emergency_contact_phone !== undefined ||
      oral_health_status !== undefined ||
      last_dental_visit !== undefined ||
      medical_conditions !== undefined ||
      allergies !== undefined ||
      current_medications !== undefined ||
      previous_anesthesia !== undefined ||
      anesthesia_notes !== undefined ||
      smokes !== undefined ||
      drinks_alcohol !== undefined ||
      other_substances !== undefined ||
      substance_frequency !== undefined ||
      general_notes !== undefined;
    
    if (hasMedicalData) {
      try {
        const medicalData = {};
        
        // Solo incluir campos que fueron enviados
        if (emergency_contact_name !== undefined) medicalData.emergency_contact_name = emergency_contact_name;
        if (emergency_contact_relationship !== undefined) medicalData.emergency_contact_relationship = emergency_contact_relationship;
        if (emergency_contact_phone !== undefined) medicalData.emergency_contact_phone = emergency_contact_phone;
        if (oral_health_status !== undefined) medicalData.oral_health_status = oral_health_status;
        if (last_dental_visit !== undefined) medicalData.last_dental_visit = last_dental_visit;
        if (medical_conditions !== undefined) medicalData.medical_conditions = medical_conditions;
        if (allergies !== undefined) medicalData.allergies = allergies;
        if (current_medications !== undefined) medicalData.current_medications = current_medications;
        if (previous_anesthesia !== undefined) medicalData.previous_anesthesia = previous_anesthesia;
        if (anesthesia_notes !== undefined) medicalData.anesthesia_notes = anesthesia_notes;
        if (smokes !== undefined) medicalData.smokes = smokes;
        if (drinks_alcohol !== undefined) medicalData.drinks_alcohol = drinks_alcohol;
        if (other_substances !== undefined) medicalData.other_substances = other_substances;
        if (substance_frequency !== undefined) medicalData.substance_frequency = substance_frequency;
        if (general_notes !== undefined) medicalData.general_notes = general_notes;
        
        medicalInfo = await PatientMedicalInfo.update(id, medicalData);
      } catch (medicalError) {
        console.error('Error al actualizar información médica:', medicalError);
      }
    }
    
    res.json({
      success: true,
      message: 'Paciente actualizado exitosamente',
      data: {
        ...data,
        medical_info: medicalInfo
      }
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