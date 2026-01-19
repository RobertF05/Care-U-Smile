// backend/models/systemSettingsModel.js
import { supabaseAdmin } from '../config/supabase.js';

const SystemSettings = {
  // Obtener todas las configuraciones
  async getAll() {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .order('setting_ID', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  // Obtener configuración por ID
  async getById(id) {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('setting_ID', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Obtener configuración actual (última)
  async getCurrent() {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .order('setting_ID', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Crear nueva configuración
  async create(settingsData) {
    // Validar que los porcentajes sumen 100%
    const totalPercentage = (parseFloat(settingsData.clinic_payment) || 0) + 
                           (parseFloat(settingsData.doctor_payment) || 0);
    
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error(`Los porcentajes deben sumar 100%. Actual: ${totalPercentage}%`);
    }

    // Validar tipo de cambio
    if (settingsData.exchange_rate <= 0) {
      throw new Error('El tipo de cambio debe ser mayor a 0');
    }

    const { data, error } = await supabaseAdmin
      .from('settings')
      .insert([{
        clinic_payment: parseFloat(settingsData.clinic_payment),
        doctor_payment: parseFloat(settingsData.doctor_payment),
        exchange_rate: parseFloat(settingsData.exchange_rate)
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Actualizar configuración
  async update(id, settingsData) {
    // Si se están actualizando porcentajes, validar
    if (settingsData.clinic_payment !== undefined || 
        settingsData.doctor_payment !== undefined) {
      
      const currentSettings = await this.getById(id);
      const clinic = settingsData.clinic_payment !== undefined ? 
                     parseFloat(settingsData.clinic_payment) : 
                     parseFloat(currentSettings.clinic_payment);
      const doctor = settingsData.doctor_payment !== undefined ? 
                     parseFloat(settingsData.doctor_payment) : 
                     parseFloat(currentSettings.doctor_payment);
      
      const totalPercentage = clinic + doctor;
      
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new Error(`Los porcentajes deben sumar 100%. Actual: ${totalPercentage}%`);
      }
    }

    // Preparar datos para actualizar
    const updateData = {};
    
    if (settingsData.clinic_payment !== undefined) {
      updateData.clinic_payment = parseFloat(settingsData.clinic_payment);
    }
    
    if (settingsData.doctor_payment !== undefined) {
      updateData.doctor_payment = parseFloat(settingsData.doctor_payment);
    }
    
    if (settingsData.exchange_rate !== undefined) {
      if (parseFloat(settingsData.exchange_rate) <= 0) {
        throw new Error('El tipo de cambio debe ser mayor a 0');
      }
      updateData.exchange_rate = parseFloat(settingsData.exchange_rate);
    }

    const { data, error } = await supabaseAdmin
      .from('settings')
      .update(updateData)
      .eq('setting_ID', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Eliminar configuración
  async delete(id) {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .delete()
      .eq('setting_ID', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Obtener porcentajes de ortodoncia
  async getOrthodonticsPercentages() {
    const settings = await this.getCurrent();
    
    if (!settings) {
      // Valores por defecto si no hay configuraciones
      return {
        clinic_percentage: 40,
        doctor_percentage: 60,
        exchange_rate: 36.5
      };
    }
    
    return {
      clinic_percentage: parseFloat(settings.clinic_payment) || 40,
      doctor_percentage: parseFloat(settings.doctor_payment) || 60,
      exchange_rate: parseFloat(settings.exchange_rate) || 36.5
    };
  },

  // Obtener historial de configuraciones
  async getHistory(limit = 10) {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .order('setting_ID', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }
};

export default SystemSettings;