// models/dailyClosingModel.js
import { supabaseAdmin } from '../config/supabase.js';
import { 
  toUTCFromNicaragua,
  toNicaraguaTime,
  formatNicaraguaDateTime,
  formatNicaraguaDate,
  createNicaraguaDateRange,
  adjustDateForQuery
} from '../utils/timezoneUtils.js';

const DailyClosing = {
  // Obtener todos los cierres diarios
  async getAll(page = 1, limit = 30, filters = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    let query = supabaseAdmin
      .from('daily_closings')
      .select('*', { count: 'exact' })
      .order('closing_date', { ascending: false });
    
    // Aplicar filtros (closing_date es DATE)
    if (filters.closing_type) {
      query = query.eq('closing_type', filters.closing_type);
    }
    
    if (filters.startDate) {
      const start = adjustDateForQuery(filters.startDate);
      query = query.gte('closing_date', start);
    }
    
    if (filters.endDate) {
      const end = adjustDateForQuery(filters.endDate);
      query = query.lte('closing_date', end);
    }
    
    query = query.range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    // Convertir fechas para mostrar
    const formattedData = data.map(closing => ({
      ...closing,
      closing_date_display: formatNicaraguaDate(closing.closing_date),
      created_at_display: formatNicaraguaDateTime(closing.created_at)
    }));
    
    return {
      data: formattedData,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    };
  },

  // Obtener cierre por ID
  async getById(id) {
    const { data, error } = await supabaseAdmin
      .from('daily_closings')
      .select('*')
      .eq('daily_closing_id', id)
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      closing_date_display: formatNicaraguaDate(data.closing_date),
      created_at_display: formatNicaraguaDateTime(data.created_at)
    };
  },

  // Crear cierre diario
  async create(closingData) {
    // closingData.date viene en formato YYYY-MM-DD (Nicaragua)
    const closingWithFormattedDate = {
      ...closingData,
      closing_date: adjustDateForQuery(closingData.date), // Solo fecha
      created_at: new Date().toISOString(),
      is_processed: false
    };
    
    delete closingWithFormattedDate.date;
    
    console.log('Creando cierre diario:', closingWithFormattedDate);
    
    const { data, error } = await supabaseAdmin
      .from('daily_closings')
      .insert([closingWithFormattedDate])
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      closing_date_display: formatNicaraguaDate(data.closing_date),
      created_at_display: formatNicaraguaDateTime(data.created_at)
    };
  },

  // Actualizar cierre diario
  async update(id, closingData) {
    const { data, error } = await supabaseAdmin
      .from('daily_closings')
      .update(closingData)
      .eq('daily_closing_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Eliminar cierre diario
  async delete(id) {
    const { data, error } = await supabaseAdmin
      .from('daily_closings')
      .delete()
      .eq('daily_closing_id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Verificar si existe cierre para fecha y tipo
  async exists(date, type = 'general') {
    const closingDate = adjustDateForQuery(date);
    
    const { data, error } = await supabaseAdmin
      .from('daily_closings')
      .select('daily_closing_id')
      .eq('closing_date', closingDate)
      .eq('closing_type', type)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  },

  // Obtener procedimientos del día para cierre (con fechas UTC)
  async getDailyProcedures(date, closingType = 'general') {
    const { start, end } = createNicaraguaDateRange(date);
    
    console.log('Buscando procedimientos para cierre diario:', {
      fechaNicaragua: date,
      inicioUTC: start,
      finUTC: end,
      tipo: closingType
    });
    
    let query = supabaseAdmin
      .from('procedures')
      .select(`
        *,
        patients (first_name, first_last_name)
      `)
      .eq('is_orthodontics', closingType === 'orthodontics')
      .gte('procedure_date', start)
      .lte('procedure_date', end);
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Convertir fechas a Nicaragua para mostrar
    return data.map(procedure => ({
      ...procedure,
      procedure_date_display: formatNicaraguaDateTime(procedure.procedure_date),
      procedure_date_utc: procedure.procedure_date
    }));
  },

  // Obtener gastos del día (bill_date es DATE)
  async getDailyBills(date, expenseType = 'general') {
    const billDate = adjustDateForQuery(date);
    
    const { data, error } = await supabaseAdmin
      .from('bills')
      .select('*')
      .eq('bill_date', billDate)
      .eq('expense_type', expenseType)
      .eq('is_processed_in_closing', false);
    
    if (error) throw error;
    return data || [];
  },

  // Marcar gastos como procesados
  async markBillsAsProcessed(billIds, closingId, closingType = 'daily') {
    if (!billIds || billIds.length === 0) return;
    
    const updateData = {
      is_processed_in_closing: true,
      processed_in_daily_closing_ID: closingType === 'daily' ? closingId : null,
      processed_in_closing_ID: closingType === 'monthly' ? closingId : null
    };
    
    const { error } = await supabaseAdmin
      .from('bills')
      .update(updateData)
      .in('bill_id', billIds);
    
    if (error) throw error;
  },

  // Crear relación entre procedimientos y cierre diario
  async createProcedureRelations(procedureClosings) {
    if (!procedureClosings || procedureClosings.length === 0) return [];
    
    const { data, error } = await supabaseAdmin
      .from('procedure_daily_closings')
      .insert(procedureClosings)
      .select();
    
    if (error) throw error;
    return data;
  },

  // Obtener resumen financiero del día (con fechas Nicaragua)
  async getDailyFinancialSummary(date, closingType = 'general') {
    const procedures = await this.getDailyProcedures(date, closingType);
    const bills = await this.getDailyBills(date, closingType);
    
    // Configuración de porcentajes (si es ortodoncia)
    let clinicPercentage = 100;
    let doctorPercentage = 0;
    
    if (closingType === 'orthodontics') {
      const { data: config } = await supabaseAdmin
        .from('specialty_payment_config')
        .select('clinic_percentage, doctor_percentage')
        .eq('specialty_name', 'orthodontics')
        .eq('is_active', true)
        .single();
      
      if (config) {
        clinicPercentage = config.clinic_percentage;
        doctorPercentage = config.doctor_percentage;
      }
    }
    
    // Calcular ingresos
    let totalIncome = 0;
    let totalClinicIncome = 0;
    let totalDoctorIncome = 0;
    let totalExternalDoctorPayments = 0;
    
    const procedureClosings = [];
    
    procedures.forEach(procedure => {
      const procedureAmount = procedure.total_cost || 0;
      totalIncome += procedureAmount;
      
      let clinicPortion = 0;
      let doctorPortion = 0;
      
      if (closingType === 'orthodontics') {
        clinicPortion = procedureAmount * (clinicPercentage / 100);
        doctorPortion = procedureAmount * (doctorPercentage / 100);
      } else {
        clinicPortion = procedureAmount;
        doctorPortion = 0;
      }
      
      let externalPayment = 0;
      if (procedure.theres_external_doctor && procedure.external_doctor_payment_value) {
        externalPayment = procedure.external_doctor_payment_value;
        clinicPortion -= externalPayment;
      }
      
      totalClinicIncome += clinicPortion;
      totalDoctorIncome += doctorPortion;
      totalExternalDoctorPayments += externalPayment;
      
      procedureClosings.push({
        procedure_id: procedure.procedure_ID,
        clinic_income_portion: clinicPortion,
        doctor_income_portion: doctorPortion,
        external_doctor_payment: externalPayment
      });
    });
    
    const totalExpenses = bills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
    const netProfit = totalClinicIncome - totalExpenses;
    
    return {
      procedures,
      procedureClosings,
      bills,
      total_income: totalIncome,
      total_clinic_income: totalClinicIncome,
      total_doctor_income: totalDoctorIncome,
      total_external_doctor_payments: totalExternalDoctorPayments,
      total_expenses: totalExpenses,
      net_profit: netProfit,
      clinic_percentage: clinicPercentage,
      doctor_percentage: doctorPercentage,
      fecha_nicaragua: date,
      cantidad_procedimientos: procedures.length,
      cantidad_gastos: bills.length
    };
  },

  // Obtener estadísticas por rango de fechas (fechas DATE)
  async getStatsByDateRange(startDate, endDate, closingType = 'general') {
    const start = adjustDateForQuery(startDate);
    const end = adjustDateForQuery(endDate);
    
    const { data, error } = await supabaseAdmin
      .from('daily_closings')
      .select('*')
      .eq('closing_type', closingType)
      .gte('closing_date', start)
      .lte('closing_date', end)
      .order('closing_date', { ascending: true });
    
    if (error) throw error;
    
    const stats = {
      total_closings: data.length,
      total_income: 0,
      total_clinic_income: 0,
      total_doctor_income: 0,
      total_expenses: 0,
      total_net_profit: 0,
      average_daily_profit: 0
    };
    
    if (data.length > 0) {
      data.forEach(closing => {
        stats.total_income += closing.total_income || 0;
        stats.total_clinic_income += closing.total_clinic_income || 0;
        stats.total_doctor_income += closing.total_doctor_income || 0;
        stats.total_expenses += closing.total_expenses || 0;
        stats.total_net_profit += closing.net_profit || 0;
      });
      
      stats.average_daily_profit = stats.total_net_profit / data.length;
    }
    
    return {
      data: data.map(closing => ({
        ...closing,
        closing_date_display: formatNicaraguaDate(closing.closing_date)
      })),
      stats
    };
  }
};

export default DailyClosing;