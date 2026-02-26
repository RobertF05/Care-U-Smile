import { supabaseAdmin } from '../config/supabase.js';
import { 
  toUTCFromNicaragua, 
  toNicaraguaTime,
  formatNicaraguaDateTime,
  createNicaraguaDateRange,
  convertDateStringToUTCStart,
  convertDateStringToUTCEnd,
  getCurrentNicaraguaDateString
} from '../utils/timezoneUtils.js';

const Appointment = {
  // Obtener todas las citas
  async getAll(page = 1, limit = null, filters = {}) {
  try {
    let query = supabaseAdmin
      .from('clinical_appointments')
      .select(`
        *,
        patients (
          id,
          first_name,
          last_name,
          phone,
          email
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // =========================
    // FILTROS
    // =========================

    if (filters.startDate && filters.endDate) {
      const { startUTC, endUTC } = createNicaraguaDateRange(
        filters.startDate,
        filters.endDate
      );

      query = query
        .gte('appointment_date', startUTC)
        .lte('appointment_date', endUTC);
    }

    if (filters.state) {
      query = query.eq('state', filters.state);
    }

    if (filters.patientId) {
      query = query.eq('patient_id', filters.patientId);
    }

    if (filters.isOrthodontics !== undefined) {
      query = query.eq('is_orthodontics', filters.isOrthodontics);
    }

    if (filters.isRegistered !== undefined) {
      query = query.eq('is_registered', filters.isRegistered);
    }

    // =========================
    // PAGINACIÓN (solo si hay limit)
    // =========================

    if (limit) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // =========================
    // TRANSFORMACIÓN DE FECHAS
    // =========================

    const transformedData = data.map(appointment => ({
      ...appointment,
      appointment_date: appointment.appointment_date
        ? formatNicaraguaDateTime(appointment.appointment_date)
        : null,
      created_at: appointment.created_at
        ? formatNicaraguaDateTime(appointment.created_at)
        : null,
      updated_at: appointment.updated_at
        ? formatNicaraguaDateTime(appointment.updated_at)
        : null
    }));

    return {
      data: transformedData,
      total: count,
      page: limit ? page : 1,
      limit: limit || count
    };

  } catch (error) {
    console.error('Error en getAll appointments:', error);
    throw error;
  }
},

  // Obtener cita por ID
  async getById(id) {
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .select(`
        *,
        patients (
          first_name,
          first_last_name,
          identification,
          number_phone,
          email
        )
      `)
      .eq('appointment_ID', id)
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      appointment_date: formatNicaraguaDateTime(data.appointment_date),
      appointment_date_utc: data.appointment_date,
      patient_name: `${data.patients?.first_name || ''} ${data.patients?.first_last_name || ''}`.trim(),
      patient_identification: data.patients?.identification,
      patient_phone: data.patients?.number_phone,
      patient_email: data.patients?.email,
      is_registered: data.is_registered || false
    };
  },

  // Crear cita (convierte hora Nicaragua a UTC)
  async create(appointmentData) {
    // Convertir fecha de Nicaragua a UTC
    const appointmentWithUTC = {
      ...appointmentData,
      appointment_date: toUTCFromNicaragua(appointmentData.appointment_date).toISOString(),
      state: 'scheduled',
      is_registered: false // Por defecto no registrada
    };
    
    console.log('Guardando cita en UTC:', {
      original: appointmentData.appointment_date,
      utc: appointmentWithUTC.appointment_date
    });
    
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .insert([appointmentWithUTC])
      .select(`
        *,
        patients (
          first_name,
          first_last_name,
          identification
        )
      `)
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      appointment_date: formatNicaraguaDateTime(data.appointment_date),
      appointment_date_utc: data.appointment_date,
      is_registered: data.is_registered || false
    };
  },

  async update(id, appointmentData) {
  const updateData = { ...appointmentData };
  if (updateData.appointment_date) {
    updateData.appointment_date = toUTCFromNicaragua(updateData.appointment_date).toISOString();
  }
  
  const { data, error } = await supabaseAdmin
    .from('clinical_appointments')
    .update(updateData)
    .eq('appointment_ID', id)
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    ...data,
    appointment_date: formatNicaraguaDateTime(data.appointment_date),
    is_registered: data.is_registered || false
  };
},

  // Eliminar cita
  async delete(id) {
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .delete()
      .eq('appointment_ID', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Convertir cita en procedimiento - VERSIÓN CORREGIDA
  async convertToProcedure(appointmentId, procedureData) {
    console.log('📝 Iniciando conversión de cita a procedimiento:', {
      appointmentId,
      procedureData: JSON.stringify(procedureData, null, 2)
    });
    
    // 1. Obtener la cita
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from('clinical_appointments')
      .select('*')
      .eq('appointment_ID', appointmentId)
      .single();
    
    if (appointmentError) throw appointmentError;
    
    console.log('📅 Cita encontrada:', {
      appointment_ID: appointment.appointment_ID,
      is_registered: appointment.is_registered,
      state: appointment.state
    });
    
    // Verificar si ya está registrada
    if (appointment.is_registered) {
      throw new Error('Esta cita ya ha sido registrada como procedimiento');
    }
    
    // IMPORTANTE: Dar prioridad al total_procedure_USD que viene del frontend
    // El frontend ya calcula el valor correcto después de deducciones
    let total_procedure_USD = procedureData.total_procedure_USD;
    
    // Si no viene del frontend, calcularlo basado en el total_procedure y tipo de cambio
    const exchange_rate = procedureData.exchange_rate || 36.5;
    
    console.log('💰 Valores recibidos:', {
      total_procedure_USD_from_frontend: total_procedure_USD,
      total_procedure: procedureData.total_procedure,
      exchange_rate: exchange_rate,
      amount_dollars: procedureData.amount_dollars
    });
    
    // Solo calcular si no viene del frontend
    if (total_procedure_USD === undefined || total_procedure_USD === null) {
      console.log('⚠️ total_procedure_USD no viene del frontend, calculando...');
      if (procedureData.total_procedure) {
        total_procedure_USD = procedureData.total_procedure / exchange_rate;
        console.log('🔄 Calculado total_procedure_USD:', total_procedure_USD);
      } else {
        // Fallback: usar amount_dollars si está disponible
        total_procedure_USD = procedureData.amount_dollars || 0;
        console.log('🔄 Usando amount_dollars como total_procedure_USD:', total_procedure_USD);
      }
    }
    
    // También calcular amount_dollars si no viene
    let amount_dollars = procedureData.amount_dollars || 0;
    if (!amount_dollars && procedureData.amount_cordobas) {
      amount_dollars = procedureData.amount_cordobas / exchange_rate;
    }
    
    console.log('✅ Valores finales a guardar:', {
      total_procedure_USD: total_procedure_USD,
      amount_dollars: amount_dollars,
      exchange_rate: exchange_rate
    });
    
    // 2. Crear el procedimiento (usar misma fecha UTC de la cita)
    const procedureToInsert = {
  appointment_ID: appointmentId,
  Patient_ID: appointment.Patient_ID,
  procedure_date: appointment.appointment_date, // Mantener UTC
  procedure_description: procedureData.procedure_description,
  total_cost: procedureData.total_cost || 0,
  total_cost_USD: procedureData.total_cost_USD || 0,
  payment_method: procedureData.payment_method,
  is_orthodontics: appointment.is_orthodontics,
  observations: procedureData.observations || appointment.observations,
  creation_date: new Date().toISOString(),
  // Campos adicionales - ¡CORREGIDOS!
  total_procedure: procedureData.total_procedure || 0,
  total_procedure_usd: total_procedure_USD, // ¡CAMPO CORREGIDO!
  amount_cordobas: procedureData.amount_cordobas || 0,
  amount_dollars: amount_dollars,
  payment_method_cordobas: procedureData.payment_method_cordobas,
  payment_method_dollars: procedureData.payment_method_dollars,
  external_doctor: procedureData.external_doctor,
  external_doctor_payment: procedureData.external_doctor_payment,
  theres_external_doctor: procedureData.theres_external_doctor || false,
  external_doctor_name: procedureData.external_doctor_name,
  external_doctor_specialty: procedureData.external_doctor_specialty,
  external_doctor_payment_type: procedureData.external_doctor_payment_type,
  external_doctor_payment_value: procedureData.external_doctor_payment_value,
  external_doctor_payment_currency: procedureData.external_doctor_payment_currency,
  clinic_payment_percentage: procedureData.clinic_payment_percentage,
  doctor_payment_percentage: procedureData.doctor_payment_percentage,
  // Campos de deducción POS
  pos_deduction_cordobas: procedureData.pos_deduction_cordobas || 0,
  pos_deduction_dollars: procedureData.pos_deduction_dollars || 0,
  total_pos_deduction: procedureData.total_pos_deduction || 0,
  net_amount_cordobas: procedureData.net_amount_cordobas || procedureData.amount_cordobas || 0,
  net_amount_dollars: procedureData.net_amount_dollars || procedureData.amount_dollars || 0,
  gross_amount_cordobas: procedureData.gross_amount_cordobas || procedureData.amount_cordobas || 0,
  gross_amount_dollars: procedureData.gross_amount_dollars || procedureData.amount_dollars || 0,
  // ELIMINAR ESTA LÍNEA: exchange_rate: exchange_rate ❌
  // No existe en la tabla procedures
};
    
    console.log('📊 Insertando procedimiento con datos:', JSON.stringify(procedureToInsert, null, 2));
    
    const { data: procedure, error: procedureError } = await supabaseAdmin
      .from('procedures')
      .insert([procedureToInsert])
      .select()
      .single();
    
    if (procedureError) {
      console.error('❌ Error al crear procedimiento:', procedureError);
      throw procedureError;
    }
    
    console.log('✅ Procedimiento creado:', {
      procedure_ID: procedure.procedure_ID,
      total_procedure: procedure.total_procedure,
      total_procedure_usd: procedure.total_procedure_usd
    });
    
    // 3. Actualizar estado de la cita a "completed" y marcar como registrada
    const { data: updatedAppointment, error: updateError } = await supabaseAdmin
      .from('clinical_appointments')
      .update({ 
        state: 'completed',
        is_registered: true 
      })
      .eq('appointment_ID', appointmentId)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Error al actualizar cita:', updateError);
      // Revertir la creación del procedimiento si falla la actualización
      await supabaseAdmin
        .from('procedures')
        .delete()
        .eq('procedure_ID', procedure.procedure_ID);
      throw updateError;
    }
    
    console.log('✅ Cita actualizada:', {
      appointment_ID: updatedAppointment.appointment_ID,
      state: updatedAppointment.state,
      is_registered: updatedAppointment.is_registered
    });
    
    return {
      appointment: {
        ...updatedAppointment,
        appointment_date: formatNicaraguaDateTime(updatedAppointment.appointment_date),
        appointment_date_utc: updatedAppointment.appointment_date,
        is_registered: true
      },
      procedure: {
        ...procedure,
        procedure_date: formatNicaraguaDateTime(procedure.procedure_date),
        procedure_date_utc: procedure.procedure_date
      }
    };
  },

  // Obtener citas por fecha (Nicaragua)
  async getByDate(date) {
    const { start, end } = createNicaraguaDateRange(date);
    
    console.log('Buscando citas para fecha Nicaragua:', {
      fechaNicaragua: date,
      inicioUTC: start,
      finUTC: end
    });
    
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .select(`
        *,
        patients (
          first_name,
          first_last_name,
          number_phone
        )
      `)
      .gte('appointment_date', start)
      .lte('appointment_date', end)
      .order('appointment_date', { ascending: true });
    
    if (error) throw error;
    
    return data.map(item => ({
      ...item,
      appointment_date: formatNicaraguaDateTime(item.appointment_date),
      appointment_date_utc: item.appointment_date,
      appointment_date_obj: toNicaraguaTime(item.appointment_date),
      patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim(),
      patient_phone: item.patients?.number_phone,
      is_registered: item.is_registered || false
    }));
  },

  // Obtener citas por paciente
  async getByPatientId(patientId) {
    const { data, error } = await supabaseAdmin
      .from('clinical_appointments')
      .select('*')
      .eq('Patient_ID', patientId)
      .order('appointment_date', { ascending: false });
    
    if (error) throw error;
    
    return data.map(item => ({
      ...item,
      appointment_date: formatNicaraguaDateTime(item.appointment_date),
      appointment_date_utc: item.appointment_date,
      is_registered: item.is_registered || false
    }));
  },

  // Contar citas por estado
  async countByState(state) {
    const { count, error } = await supabaseAdmin
      .from('clinical_appointments')
      .select('*', { count: 'exact', head: true })
      .eq('state', state);
    
    if (error) throw error;
    return count;
  },

  // Contar citas registradas
  async countRegistered() {
    const { count, error } = await supabaseAdmin
      .from('clinical_appointments')
      .select('*', { count: 'exact', head: true })
      .eq('is_registered', true);
    
    if (error) throw error;
    return count;
  },

  // Contar citas no registradas
  async countUnregistered() {
    const { count, error } = await supabaseAdmin
      .from('clinical_appointments')
      .select('*', { count: 'exact', head: true })
      .eq('is_registered', false);
    
    if (error) throw error;
    return count;
  },

  // Verificar disponibilidad de horario en Nicaragua
  async checkAvailability(dateTimeNicaragua, durationMinutes = 30, excludeAppointmentId = null) {
    const startTimeUTC = toUTCFromNicaragua(dateTimeNicaragua);
    const endTimeUTC = new Date(startTimeUTC.getTime() + (durationMinutes * 60 * 1000));
    
    let query = supabaseAdmin
      .from('clinical_appointments')
      .select('appointment_date')
      .gte('appointment_date', startTimeUTC.toISOString())
      .lt('appointment_date', endTimeUTC.toISOString());
    
    if (excludeAppointmentId) {
      query = query.neq('appointment_ID', excludeAppointmentId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data.length === 0;
  }
};

export default Appointment;