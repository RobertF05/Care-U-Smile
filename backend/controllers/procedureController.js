// controllers/procedureController.js
import { supabaseAdmin } from '../config/supabase.js';

const procedureController = {
  // Obtener procedimientos regulares (NO ortodoncia)
  getAllNormal: async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        startDate, 
        endDate,
        patientId
      } = req.query;
      
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      let query = supabaseAdmin
        .from('procedures')
        .select(`
          *,
          patients (
            first_name,
            first_last_name,
            identification
          ),
          clinical_appointments (
            query_type
          )
        `, { count: 'exact' })
        .eq('is_orthodontics', false)
        .order('procedure_date', { ascending: false });
      
      // Aplicar filtros
      if (startDate) {
        query = query.gte('procedure_date', startDate);
      }
      
      if (endDate) {
        query = query.lte('procedure_date', endDate);
      }
      
      if (patientId) {
        query = query.eq('Patient_ID', patientId);
      }
      
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      // Transformar datos
      const transformedData = data.map(item => ({
        ...item,
        patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
        patient_identification: item.patients?.identification,
        original_query_type: item.clinical_appointments?.[0]?.query_type
      }));
      
      res.json({ 
        success: true, 
        data: transformedData,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      console.error('Error al obtener procedimientos:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener procedimientos' 
      });
    }
  },

  // Obtener procedimientos de ortodoncia
  getAllOrthodontics: async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        startDate, 
        endDate,
        patientId
      } = req.query;
      
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      let query = supabaseAdmin
        .from('procedures')
        .select(`
          *,
          patients (
            first_name,
            first_last_name,
            identification
          ),
          clinical_appointments (
            query_type
          )
        `, { count: 'exact' })
        .eq('is_orthodontics', true)
        .order('procedure_date', { ascending: false });
      
      // Aplicar filtros
      if (startDate) {
        query = query.gte('procedure_date', startDate);
      }
      
      if (endDate) {
        query = query.lte('procedure_date', endDate);
      }
      
      if (patientId) {
        query = query.eq('Patient_ID', patientId);
      }
      
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      // Transformar datos y calcular ganancias
      const transformedData = data.map(item => {
        const clinic_income = item.total_cost * 0.4;
        const doctor_income = item.total_cost * 0.6;
        
        return {
          ...item,
          patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
          patient_identification: item.patients?.identification,
          original_query_type: item.clinical_appointments?.[0]?.query_type,
          clinic_income,
          doctor_income
        };
      });
      
      res.json({ 
        success: true, 
        data: transformedData,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      console.error('Error al obtener ortodoncias:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener ortodoncias' 
      });
    }
  },

  // Obtener procedimiento por ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      
      const { data, error } = await supabaseAdmin
        .from('procedures')
        .select(`
          *,
          patients (
            first_name,
            first_last_name,
            identification,
            number_phone
          ),
          clinical_appointments (
            query_type,
            appointment_date,
            observations as appointment_observations
          )
        `)
        .eq('procedure_id', id)
        .single();
      
      if (error) throw error;
      
      if (!data) {
        return res.status(404).json({ 
          success: false, 
          error: 'Procedimiento no encontrado' 
        });
      }
      
      // Calcular ingresos si es ortodoncia
      const clinic_income = data.is_orthodontics ? data.total_cost * 0.4 : data.total_cost;
      const doctor_income = data.is_orthodontics ? data.total_cost * 0.6 : 0;
      
      const transformedData = {
        ...data,
        patient_name: `${data.patients?.first_name || ''} ${data.patients?.first_last_name || ''}`.trim(),
        patient_identification: data.patients?.identification,
        patient_phone: data.patients?.number_phone,
        clinic_income,
        doctor_income,
        original_query_type: data.clinical_appointments?.[0]?.query_type,
        original_appointment_date: data.clinical_appointments?.[0]?.appointment_date
      };
      
      res.json({ 
        success: true, 
        data: transformedData 
      });
    } catch (error) {
      console.error('Error al obtener procedimiento:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener procedimiento' 
      });
    }
  },

  // Crear procedimiento directamente (sin cita)
  create: async (req, res) => {
    try {
      const procedureData = req.body;
      
      // Validar datos requeridos
      if (!procedureData.patient_id || !procedureData.procedure_description || 
          !procedureData.total_cost || !procedureData.payment_method) {
        return res.status(400).json({ 
          success: false, 
          error: 'Paciente, descripción, costo y forma de pago son requeridos' 
        });
      }
      
      const { data, error } = await supabaseAdmin
        .from('procedures')
        .insert([{
          ...procedureData,
          Patient_ID: procedureData.patient_id,
          creation_date: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Calcular ingresos para respuesta
      const clinic_income = data.is_orthodontics ? data.total_cost * 0.4 : data.total_cost;
      const doctor_income = data.is_orthodontics ? data.total_cost * 0.6 : 0;
      
      const responseData = {
        ...data,
        clinic_income,
        doctor_income
      };
      
      res.status(201).json({ 
        success: true, 
        message: 'Procedimiento creado exitosamente',
        data: responseData 
      });
    } catch (error) {
      console.error('Error al crear procedimiento:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al crear procedimiento' 
      });
    }
  },

  // Actualizar procedimiento
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const procedureData = req.body;
      
      // Verificar que el procedimiento exista
      const { data: existingProcedure, error: checkError } = await supabaseAdmin
        .from('procedures')
        .select('procedure_ID')
        .eq('procedure_ID', id)
        .single();
      
      if (checkError || !existingProcedure) {
        return res.status(404).json({ 
          success: false, 
          error: 'Procedimiento no encontrado' 
        });
      }
      
      const { data, error } = await supabaseAdmin
        .from('procedures')
        .update(procedureData)
        .eq('procedure_ID', id)
        .select()
        .single();
      
      if (error) throw error;
      
      res.json({ 
        success: true, 
        message: 'Procedimiento actualizado exitosamente',
        data 
      });
    } catch (error) {
      console.error('Error al actualizar procedimiento:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al actualizar procedimiento' 
      });
    }
  },

  // Eliminar procedimiento
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar que el procedimiento exista
      const { data: existingProcedure, error: checkError } = await supabaseAdmin
        .from('procedures')
        .select('procedure_ID')
        .eq('procedure_ID', id)
        .single();
      
      if (checkError || !existingProcedure) {
        return res.status(404).json({ 
          success: false, 
          error: 'Procedimiento no encontrado' 
        });
      }
      
      const { data, error } = await supabaseAdmin
        .from('procedures')
        .delete()
        .eq('procedure_ID', id)
        .select()
        .single();
      
      if (error) throw error;
      
      res.json({ 
        success: true, 
        message: 'Procedimiento eliminado exitosamente',
        data 
      });
    } catch (error) {
      console.error('Error al eliminar procedimiento:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al eliminar procedimiento' 
      });
    }
  },

  // Obtener procedimientos por paciente
  getByPatientId: async (req, res) => {
    try {
      const { patientId } = req.params;
      
      const { data, error } = await supabaseAdmin
        .from('procedures')
        .select('*')
        .eq('Patient_ID', patientId)
        .order('procedure_date', { ascending: false });
      
      if (error) throw error;
      
      res.json({ 
        success: true, 
        data: data || [] 
      });
    } catch (error) {
      console.error('Error al obtener procedimientos:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener procedimientos' 
      });
    }
  },

  // Estadísticas de ingresos
  getIncomeStats: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          error: 'Fecha inicio y fin son requeridas' 
        });
      }
      
      // Obtener todos los procedimientos en el período
      const { data, error } = await supabaseAdmin
        .from('procedures')
        .select('total_cost, is_orthodontics')
        .gte('procedure_date', startDate)
        .lte('procedure_date', endDate);
      
      if (error) throw error;
      
      let totalGeneral = 0;
      let totalOrtho = 0;
      let orthoCount = 0;
      let generalCount = 0;
      
      data.forEach(proc => {
        if (proc.is_orthodontics) {
          totalOrtho += proc.total_cost;
          orthoCount++;
        } else {
          totalGeneral += proc.total_cost;
          generalCount++;
        }
      });
      
      const stats = {
        total_income: totalGeneral + totalOrtho,
        clinic_income: totalGeneral + (totalOrtho * 0.4),
        doctor_income: totalOrtho * 0.6,
        total_procedures: data.length,
        orthodontics_count: orthoCount,
        general_count: generalCount
      };
      
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
  },

  // Contar procedimientos totales
  count: async (req, res) => {
    try {
      const { count, error } = await supabaseAdmin
        .from('procedures')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      
      res.json({ 
        success: true, 
        count: count || 0 
      });
    } catch (error) {
      console.error('Error al contar procedimientos:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al contar procedimientos' 
      });
    }
  }
};

export default procedureController;