import { supabaseAdmin } from '../config/supabase.js';
import {
  formatNicaraguaDateTime,
  toUTCString,
  convertDateStringToUTCStart,
  convertDateStringToUTCEnd,
  safeToISOString
} from '../utils/timezoneUtils.js';

const procedureController = {
  // ============================================
  // FUNCIÓN AUXILIAR: getDateRangeFromFilter
  // ============================================
  getDateRangeFromFilter: (filter) => {
    console.log(`📅 Calculando rango para filtro: ${filter}`);
    
    if (filter === 'all') {
      console.log('📅 Filtro "Todos" - Sin rango de fechas');
      return {
        startDate: null,
        endDate: null
      };
    }
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    const dayOfWeek = now.getDay();
    
    let startDate = null;
    let endDate = null;
    
    switch(filter) {
      case 'today':
        startDate = new Date(year, month, day, 0, 0, 0, 0);
        endDate = new Date(year, month, day, 23, 59, 59, 999);
        console.log(`📅 Hoy: ${startDate.toISOString()} - ${endDate.toISOString()}`);
        break;
        
      case 'thisWeek':
        const startOfWeek = new Date(year, month, day - dayOfWeek, 0, 0, 0, 0);
        const endOfWeek = new Date(year, month, day + (6 - dayOfWeek), 23, 59, 59, 999);
        startDate = startOfWeek;
        endDate = endOfWeek;
        console.log(`📅 Esta semana: ${startDate.toISOString()} - ${endDate.toISOString()}`);
        break;
        
      case 'thisMonth':
        startDate = new Date(year, month, 1, 0, 0, 0, 0);
        endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
        console.log(`📅 Este mes: ${startDate.toISOString()} - ${endDate.toISOString()}`);
        break;
        
      default:
        console.log(`⚠️ Filtro no reconocido: ${filter} - Sin rango de fechas`);
        return {
          startDate: null,
          endDate: null
        };
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  },

  // ============================================
  // FUNCIÓN PARA CALCULAR PAGOS CON LÓGICA COMPLETA
  // ============================================
  calculateProcedurePayments: (procedureData) => {
    console.log('🧮 Calculando pagos para procedimiento:', procedureData);
    
    const {
      is_orthodontics = false,
      total_procedure = 0,
      amount_cordobas = 0,
      amount_dollars = 0,
      exchange_rate_used = 36.5,
      external_doctor = false,
      external_doctor_payment = 0,
      external_doctor_payment_usd = 0,
      external_doctor_payment_type = 'fixed',
      external_doctor_payment_value = 0,
      external_doctor_payment_currency = 'C$',
      clinic_payment_percentage = is_orthodontics ? 40 : 100,
      doctor_payment_percentage = is_orthodontics ? 60 : 0,
      clinic_payment_cordobas = 0,
      clinic_payment_dollars = 0,
      doctor_payment_cordobas = 0,
      doctor_payment_dollars = 0,
      // NUEVOS CAMPOS PARA DIVISIÓN DE ORTODONCIA CON DOCTOR EXTERNO
      ortho_doctor_percentage = is_orthodontics ? 60 : 0,
      external_doctor_percentage = 0,
      external_doctor_split_type = 'from_clinic', // 'from_clinic' o 'from_total'
      ...restData
    } = procedureData;
    
    // Calcular total en córdobas
    const totalInCordobas = total_procedure > 0 ? total_procedure : 
      (parseFloat(amount_cordobas) || 0) + ((parseFloat(amount_dollars) || 0) * exchange_rate_used);
    
    // Calcular total en dólares
    const totalInDollars = total_procedure > 0 ? 
      (total_procedure / exchange_rate_used) : 
      (parseFloat(amount_dollars) || 0) + ((parseFloat(amount_cordobas) || 0) / exchange_rate_used);
    
    let calculatedData = {
      ...restData,
      is_orthodontics,
      total_procedure: totalInCordobas,
      total_procedure_usd: totalInDollars,
      amount_cordobas: parseFloat(amount_cordobas) || 0,
      amount_dollars: parseFloat(amount_dollars) || 0,
      exchange_rate_used,
      external_doctor: !!external_doctor,
      external_doctor_name: external_doctor ? procedureData.external_doctor_name : null,
      external_doctor_specialty: external_doctor ? procedureData.external_doctor_specialty : null,
      external_doctor_payment_type,
      external_doctor_payment_value: parseFloat(external_doctor_payment_value) || 0,
      external_doctor_payment_currency,
      ortho_doctor_percentage: is_orthodontics ? parseFloat(ortho_doctor_percentage) : null,
      external_doctor_percentage: external_doctor ? parseFloat(external_doctor_percentage) : null,
      external_doctor_split_type: external_doctor ? external_doctor_split_type : null
    };
    
    // VALIDACIONES Y CÁLCULOS PARA ORTODONCIA CON DOCTOR EXTERNO
    if (is_orthodontics && external_doctor) {
      const orthoPercentage = parseFloat(ortho_doctor_percentage) || 0;
      const externalPercentage = parseFloat(external_doctor_percentage) || 0;
      
      // Validar porcentajes
      if (orthoPercentage + externalPercentage >= 100) {
        throw new Error('La suma de porcentajes para doctora ortodoncista y doctor externo no puede ser 100% o más');
      }
      
      if (orthoPercentage < 0 || externalPercentage < 0) {
        throw new Error('Los porcentajes no pueden ser negativos');
      }
      
      // Calcular porcentaje restante para la clínica
      const clinic_percentage = 100 - orthoPercentage - externalPercentage;
      
      if (clinic_percentage <= 0) {
        throw new Error('La clínica debe tener un porcentaje de ganancia mayor a 0');
      }
      
      // Actualizar los porcentajes
      calculatedData.clinic_payment_percentage = clinic_percentage;
      calculatedData.doctor_payment_percentage = orthoPercentage;
      
      // Calcular pagos según el tipo de división
      if (external_doctor_split_type === 'from_total') {
        // El doctor externo recibe un porcentaje del total
        const external_payment_cordobas = totalInCordobas * (externalPercentage / 100);
        const external_payment_dollars = external_payment_cordobas / exchange_rate_used;
        
        // Calcular pagos para la doctora ortodoncista
        const ortho_payment_cordobas = totalInCordobas * (orthoPercentage / 100);
        const ortho_payment_dollars = ortho_payment_cordobas / exchange_rate_used;
        
        // Calcular ganancia de la clínica
        const clinic_payment_cordobas = totalInCordobas * (clinic_percentage / 100);
        const clinic_payment_dollars = clinic_payment_cordobas / exchange_rate_used;
        
        // Actualizar todos los pagos
        calculatedData.clinic_payment_cordobas = clinic_payment_cordobas;
        calculatedData.clinic_payment_dollars = clinic_payment_dollars;
        calculatedData.doctor_payment_cordobas = ortho_payment_cordobas;
        calculatedData.doctor_payment_dollars = ortho_payment_dollars;
        calculatedData.external_doctor_payment = external_payment_cordobas;
        calculatedData.external_doctor_payment_usd = external_payment_dollars;
        
      } else if (external_doctor_split_type === 'from_clinic') {
        // El doctor externo recibe un porcentaje de la parte de la clínica
        
        // Primero, calcular pago de la doctora ortodoncista
        const ortho_payment_cordobas = totalInCordobas * (orthoPercentage / 100);
        const ortho_payment_dollars = ortho_payment_cordobas / exchange_rate_used;
        
        // Lo que queda es para la clínica (antes de doctor externo)
        const clinic_portion_before_external = totalInCordobas * (clinic_percentage / 100);
        
        // El doctor externo recibe un porcentaje de la parte de la clínica
        const external_payment_cordobas = clinic_portion_before_external * (externalPercentage / 100);
        const external_payment_dollars = external_payment_cordobas / exchange_rate_used;
        
        // Ganancia final de la clínica (después de pagar al doctor externo)
        const clinic_payment_cordobas = clinic_portion_before_external - external_payment_cordobas;
        const clinic_payment_dollars = clinic_payment_cordobas / exchange_rate_used;
        
        // Actualizar todos los pagos
        calculatedData.external_doctor_payment = external_payment_cordobas;
        calculatedData.external_doctor_payment_usd = external_payment_dollars;
        calculatedData.clinic_payment_cordobas = clinic_payment_cordobas;
        calculatedData.clinic_payment_dollars = clinic_payment_dollars;
        calculatedData.doctor_payment_cordobas = ortho_payment_cordobas;
        calculatedData.doctor_payment_dollars = ortho_payment_dollars;
      }
      
    } else if (!is_orthodontics && external_doctor) {
      // PROCEDIMIENTO GENERAL CON DOCTOR EXTERNO
      
      // Calcular pago al doctor externo
      let external_payment_cordobas = 0;
      let external_payment_dollars = 0;
      
      if (external_doctor_payment_type === 'percentage') {
        const percentage = parseFloat(external_doctor_payment_value) || 0;
        if (percentage > 100) {
          throw new Error('El porcentaje no puede ser mayor a 100%');
        }
        external_payment_cordobas = totalInCordobas * (percentage / 100);
        external_payment_dollars = external_payment_cordobas / exchange_rate_used;
      } else {
        // Monto fijo
        const fixedAmount = parseFloat(external_doctor_payment_value) || 0;
        if (external_doctor_payment_currency === 'US$') {
          external_payment_dollars = fixedAmount;
          external_payment_cordobas = fixedAmount * exchange_rate_used;
        } else {
          external_payment_cordobas = fixedAmount;
          external_payment_dollars = fixedAmount / exchange_rate_used;
        }
      }
      
      // Ganancia de la clínica (total - pago al doctor externo)
      const clinic_payment_cordobas = totalInCordobas - external_payment_cordobas;
      const clinic_payment_dollars = clinic_payment_cordobas / exchange_rate_used;
      
      // Validar que la clínica tenga ganancia
      if (clinic_payment_cordobas <= 0) {
        throw new Error('El pago al doctor externo no puede ser mayor o igual al total del procedimiento');
      }
      
      // Actualizar pagos
      calculatedData.clinic_payment_cordobas = clinic_payment_cordobas;
      calculatedData.clinic_payment_dollars = clinic_payment_dollars;
      calculatedData.doctor_payment_cordobas = 0;
      calculatedData.doctor_payment_dollars = 0;
      calculatedData.external_doctor_payment = external_payment_cordobas;
      calculatedData.external_doctor_payment_usd = external_payment_dollars;
      calculatedData.clinic_payment_percentage = 100;
      calculatedData.doctor_payment_percentage = 0;
      
    } else if (is_orthodontics && !external_doctor) {
      // ORTODONCIA SIN DOCTOR EXTERNO (lógica normal)
      const clinicPercentage = parseFloat(clinic_payment_percentage) || 40;
      const doctorPercentage = parseFloat(doctor_payment_percentage) || 60;
      
      const clinic_payment_cordobas = totalInCordobas * (clinicPercentage / 100);
      const clinic_payment_dollars = clinic_payment_cordobas / exchange_rate_used;
      const doctor_payment_cordobas = totalInCordobas * (doctorPercentage / 100);
      const doctor_payment_dollars = doctor_payment_cordobas / exchange_rate_used;
      
      calculatedData.clinic_payment_cordobas = clinic_payment_cordobas;
      calculatedData.clinic_payment_dollars = clinic_payment_dollars;
      calculatedData.doctor_payment_cordobas = doctor_payment_cordobas;
      calculatedData.doctor_payment_dollars = doctor_payment_dollars;
      calculatedData.clinic_payment_percentage = clinicPercentage;
      calculatedData.doctor_payment_percentage = doctorPercentage;
      
    } else {
      // PROCEDIMIENTO GENERAL SIN DOCTOR EXTERNO
      calculatedData.clinic_payment_cordobas = totalInCordobas;
      calculatedData.clinic_payment_dollars = totalInCordobas / exchange_rate_used;
      calculatedData.doctor_payment_cordobas = 0;
      calculatedData.doctor_payment_dollars = 0;
      calculatedData.clinic_payment_percentage = 100;
      calculatedData.doctor_payment_percentage = 0;
    }
    
    console.log('✅ Datos calculados:', {
      totalInCordobas,
      totalInDollars,
      clinic_payment_cordobas: calculatedData.clinic_payment_cordobas,
      external_doctor_payment: calculatedData.external_doctor_payment,
      clinic_payment_percentage: calculatedData.clinic_payment_percentage,
      doctor_payment_percentage: calculatedData.doctor_payment_percentage
    });
    
    return calculatedData;
  },

  // ============================================
  // OBTENER PROCEDIMIENTOS REGULARES (NO ORTODONCIA)
  // CON FILTROS DE TIEMPO Y FECHAS ESPECÍFICAS
  // ============================================
  getAllNormal: async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 100, 
        startDate, 
        endDate,
        patientId,
        timeFilter
      } = req.query;
      
      console.log('📋 Procedimientos normales - Parámetros:', { 
        page, limit, startDate, endDate, patientId, timeFilter 
      });
      
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      // Construir consulta base
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
            query_type,
            appointment_date
          )
        `, { count: 'exact' })
        .eq('is_orthodontics', false)
        .order('procedure_date', { ascending: false });
      
      // 1. SI HAY FECHAS ESPECÍFICAS -> Usar esas fechas
      if (startDate && endDate) {
        const startUTC = safeToISOString(`${startDate}T00:00:00`);
        const endUTC = safeToISOString(`${endDate}T23:59:59`);
        
        if (startUTC && endUTC) {
          console.log('📅 Usando fechas específicas:', { startUTC, endUTC });
          query = query.gte('procedure_date', startUTC);
          query = query.lte('procedure_date', endUTC);
        }
      } 
      // 2. SI HAY FILTRO DE TIEMPO Y NO ES 'all' -> Calcular rango
      else if (timeFilter && timeFilter !== 'all') {
        console.log('📅 Calculando rango para filtro:', timeFilter);
        
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        
        let startDateObj, endDateObj;
        
        switch(timeFilter) {
          case 'today':
            startDateObj = new Date(year, month, day, 0, 0, 0, 0);
            endDateObj = new Date(year, month, day, 23, 59, 59, 999);
            break;
            
          case 'thisWeek':
            const dayOfWeek = now.getDay();
            const startOfWeek = new Date(year, month, day - dayOfWeek, 0, 0, 0, 0);
            const endOfWeek = new Date(year, month, day + (6 - dayOfWeek), 23, 59, 59, 999);
            startDateObj = startOfWeek;
            endDateObj = endOfWeek;
            break;
            
          case 'thisMonth':
            startDateObj = new Date(year, month, 1, 0, 0, 0, 0);
            endDateObj = new Date(year, month + 1, 0, 23, 59, 59, 999);
            break;
            
          default:
            console.log('⚠️ Filtro no reconocido, sin filtro de fecha');
            break;
        }
        
        if (startDateObj && endDateObj) {
          query = query.gte('procedure_date', startDateObj.toISOString());
          query = query.lte('procedure_date', endDateObj.toISOString());
          console.log('📅 Rango aplicado:', { 
            start: startDateObj.toISOString(), 
            end: endDateObj.toISOString() 
          });
        }
      } 
      // 3. SI ES 'all' O NO HAY FILTROS -> NO aplicar filtro de fecha
      else {
        console.log('📅 Mostrando TODOS los procedimientos (sin filtro de fecha)');
      }
      
      // Filtro por paciente
      if (patientId && patientId.trim() !== "") {
        query = query.eq('Patient_ID', patientId);
      }
      
      // Paginación
      query = query.range(from, to);
      
      console.log('🔍 Ejecutando consulta...');
      const { data, error, count: totalCount } = await query;
      
      if (error) {
        console.error('❌ Error en Supabase:', error);
        throw error;
      }
      
      console.log(`✅ ${data?.length || 0} procedimientos encontrados`);
      
      // Transformar datos
      const transformedData = (data || []).map(item => {
        // Formatear fechas para mostrar
        let procedureDateFormatted = 'N/A';
        try {
          if (item.procedure_date) {
            procedureDateFormatted = formatNicaraguaDateTime(item.procedure_date);
          }
        } catch (error) {
          console.error('Error formateando fecha:', error);
        }
        
        let creationDateFormatted = 'N/A';
        try {
          if (item.creation_date) {
            creationDateFormatted = formatNicaraguaDateTime(item.creation_date);
          }
        } catch (error) {
          console.error('Error formateando creación:', error);
        }
        
        const originalAppointmentDate = item.clinical_appointments?.[0]?.appointment_date;
        let originalAppointmentDateFormatted = null;
        try {
          if (originalAppointmentDate) {
            originalAppointmentDateFormatted = formatNicaraguaDateTime(originalAppointmentDate);
          }
        } catch (error) {
          console.error('Error formateando cita original:', error);
        }
        
        // Calcular montos usando los campos ya calculados
        const exchangeRate = item.exchange_rate_used || 36.5;
        const totalProcedureUSD = item.total_procedure_usd || (item.total_procedure / exchangeRate);
        const clinicNetIncomeUSD = item.clinic_payment_dollars || (item.clinic_payment_cordobas / exchangeRate);
        const externalDoctorPaymentUSD = item.external_doctor_payment_usd || (item.external_doctor_payment / exchangeRate);
        
        return {
          ...item,
          procedure_date: procedureDateFormatted,
          procedure_date_utc: item.procedure_date,
          creation_date: creationDateFormatted,
          patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim() || 'Paciente no especificado',
          patient_identification: item.patients?.identification || 'N/A',
          original_query_type: item.clinical_appointments?.[0]?.query_type || item.procedure_description,
          original_appointment_date: originalAppointmentDateFormatted,
          // Ingresos en córdobas (ya calculados)
          clinic_income: item.clinic_payment_cordobas || 0,
          clinic_net_income: item.clinic_payment_cordobas || 0, // Ya incluye deducción
          external_doctor_payment: item.external_doctor_payment || 0,
          // Ingresos en dólares
          total_procedure_usd: totalProcedureUSD,
          clinic_net_income_usd: clinicNetIncomeUSD,
          external_doctor_payment_usd: externalDoctorPaymentUSD,
          // Asegurar que los campos estén presentes
          amount_cordobas: item.amount_cordobas || 0,
          amount_dollars: item.amount_dollars || 0,
          payment_method_cordobas: item.payment_method_cordobas || 'No especificado',
          payment_method_dollars: item.payment_method_dollars || 'No especificado',
          exchange_rate_used: exchangeRate,
          total_cost_USD: item.total_cost_USD || 0,
          // Información adicional
          has_external_doctor: !!item.external_doctor || !!item.external_doctor_name || (item.external_doctor_payment > 0),
          external_doctor_name: item.external_doctor_name || item.external_doctor || null,
          external_doctor_specialty: item.external_doctor_specialty || null,
          // NUEVOS CAMPOS
          ortho_doctor_percentage: item.ortho_doctor_percentage,
          external_doctor_percentage: item.external_doctor_percentage,
          external_doctor_split_type: item.external_doctor_split_type || 'from_clinic'
        };
      });
      
      // Calcular estadísticas
      const totalIncome = transformedData.reduce((sum, item) => sum + (item.clinic_income || 0), 0);
      const totalExternalPayments = transformedData.reduce((sum, item) => sum + (item.external_doctor_payment || 0), 0);
      
      res.json({ 
        success: true, 
        data: transformedData,
        total: totalCount || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((totalCount || 0) / limit),
        filterApplied: timeFilter || 'all',
        stats: {
          totalProcedures: transformedData.length,
          totalIncome,
          totalExternalPayments,
          clinicNetIncome: totalIncome, // Ya incluye deducción
          averageIncomePerProcedure: transformedData.length > 0 ? totalIncome / transformedData.length : 0
        }
      });
      
    } catch (error) {
      console.error('❌ Error al obtener procedimientos:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener procedimientos',
        details: error.message
      });
    }
  },

  // ============================================
  // OBTENER PROCEDIMIENTOS DE ORTODONCIA
  // VERSIÓN SIMPLIFICADA - SOLO FILTROS DIRECTOS
  // ============================================
  getAllOrthodontics: async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 100, 
        startDate, 
        endDate,
        patientId,
        timeFilter
      } = req.query;
      
      console.log('📋 Ortodoncias - Parámetros:', { 
        page, limit, startDate, endDate, patientId, timeFilter 
      });
      
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      // Construir consulta base
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
            query_type,
            appointment_date
          )
        `, { count: 'exact' })
        .eq('is_orthodontics', true)
        .order('procedure_date', { ascending: false });
      
      // 1. SI HAY FECHAS ESPECÍFICAS -> Usar esas fechas
      if (startDate && endDate) {
        const startUTC = safeToISOString(`${startDate}T00:00:00`);
        const endUTC = safeToISOString(`${endDate}T23:59:59`);
        
        if (startUTC && endUTC) {
          console.log('📅 Ortodoncias - Usando fechas específicas:', { startUTC, endUTC });
          query = query.gte('procedure_date', startUTC);
          query = query.lte('procedure_date', endUTC);
        }
      } 
      // 2. SI HAY FILTRO DE TIEMPO Y NO ES 'all' -> Calcular rango
      else if (timeFilter && timeFilter !== 'all') {
        console.log('📅 Ortodoncias - Calculando rango para filtro:', timeFilter);
        
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        
        let startDateObj, endDateObj;
        
        switch(timeFilter) {
          case 'today':
            startDateObj = new Date(year, month, day, 0, 0, 0, 0);
            endDateObj = new Date(year, month, day, 23, 59, 59, 999);
            break;
            
          case 'thisWeek':
            const dayOfWeek = now.getDay();
            const startOfWeek = new Date(year, month, day - dayOfWeek, 0, 0, 0, 0);
            const endOfWeek = new Date(year, month, day + (6 - dayOfWeek), 23, 59, 59, 999);
            startDateObj = startOfWeek;
            endDateObj = endOfWeek;
            break;
            
          case 'thisMonth':
            startDateObj = new Date(year, month, 1, 0, 0, 0, 0);
            endDateObj = new Date(year, month + 1, 0, 23, 59, 59, 999);
            break;
            
          default:
            console.log('⚠️ Ortodoncias - Filtro no reconocido, sin filtro de fecha');
            break;
        }
        
        if (startDateObj && endDateObj) {
          query = query.gte('procedure_date', startDateObj.toISOString());
          query = query.lte('procedure_date', endDateObj.toISOString());
          console.log('📅 Ortodoncias - Rango aplicado:', { 
            start: startDateObj.toISOString(), 
            end: endDateObj.toISOString() 
          });
        }
      } 
      // 3. SI ES 'all' O NO HAY FILTROS -> NO aplicar filtro de fecha
      else {
        console.log('📅 Ortodoncias - Mostrando TODAS las ortodoncias (sin filtro de fecha)');
      }
      
      // Filtro por paciente
      if (patientId && patientId.trim() !== "") {
        query = query.eq('Patient_ID', patientId);
      }
      
      // Paginación
      query = query.range(from, to);
      
      console.log('🔍 Ortodoncias - Ejecutando consulta...');
      const { data, error, count: totalCount } = await query;
      
      if (error) {
        console.error('❌ Error en Supabase (ortodoncias):', error);
        throw error;
      }
      
      console.log(`✅ ${data?.length || 0} ortodoncias encontradas`);
      
      // Transformar datos
      const transformedData = (data || []).map(item => {
        const exchangeRate = item.exchange_rate_used || 36.5;
        
        // Calcular en córdobas (ya calculados)
        const clinicIncomeCordobas = item.clinic_payment_cordobas || 0;
        const doctorIncomeCordobas = item.doctor_payment_cordobas || 0;
        const externalDoctorPaymentCordobas = item.external_doctor_payment || 0;
        
        // Calcular en dólares
        const totalUSD = item.total_procedure_usd || (item.total_procedure / exchangeRate);
        const clinicIncomeUSD = item.clinic_payment_dollars || (clinicIncomeCordobas / exchangeRate);
        const doctorIncomeUSD = item.doctor_payment_dollars || (doctorIncomeCordobas / exchangeRate);
        const externalDoctorPaymentUSD = item.external_doctor_payment_usd || (externalDoctorPaymentCordobas / exchangeRate);
        
        // Formatear fechas
        let procedureDateFormatted = 'N/A';
        try {
          if (item.procedure_date) {
            procedureDateFormatted = formatNicaraguaDateTime(item.procedure_date);
          }
        } catch (error) {
          console.error('Error formateando fecha:', error);
        }
        
        let creationDateFormatted = 'N/A';
        try {
          if (item.creation_date) {
            creationDateFormatted = formatNicaraguaDateTime(item.creation_date);
          }
        } catch (error) {
          console.error('Error formateando creación:', error);
        }
        
        const originalAppointmentDate = item.clinical_appointments?.[0]?.appointment_date;
        let originalAppointmentDateFormatted = null;
        try {
          if (originalAppointmentDate) {
            originalAppointmentDateFormatted = formatNicaraguaDateTime(originalAppointmentDate);
          }
        } catch (error) {
          console.error('Error formateando cita original:', error);
        }
        
        return {
          ...item,
          procedure_date: procedureDateFormatted,
          procedure_date_utc: item.procedure_date,
          creation_date: creationDateFormatted,
          patient_name: `${item.patients?.first_name || ''} ${item.patients?.first_last_name || ''}`.trim() || 'Paciente no especificado',
          patient_identification: item.patients?.identification || 'N/A',
          original_query_type: item.clinical_appointments?.[0]?.query_type || item.procedure_description,
          original_appointment_date: originalAppointmentDateFormatted,
          // Ingresos en córdobas
          clinic_income: clinicIncomeCordobas,
          doctor_income: doctorIncomeCordobas,
          clinic_net_income: clinicIncomeCordobas, // Ya incluye deducción
          external_doctor_payment: externalDoctorPaymentCordobas,
          // Ingresos en dólares
          clinic_income_usd: clinicIncomeUSD,
          doctor_income_usd: doctorIncomeUSD,
          clinic_net_income_usd: clinicIncomeUSD,
          external_doctor_payment_usd: externalDoctorPaymentUSD,
          // Montos específicos
          clinic_payment_cordobas: clinicIncomeCordobas,
          doctor_payment_cordobas: doctorIncomeCordobas,
          clinic_payment_dollars: clinicIncomeUSD,
          doctor_payment_dollars: doctorIncomeUSD,
          total_procedure: item.total_procedure,
          total_procedure_usd: totalUSD,
          // Asegurar que los campos de pago estén presentes
          amount_cordobas: item.amount_cordobas || 0,
          amount_dollars: item.amount_dollars || 0,
          payment_method_cordobas: item.payment_method_cordobas || 'No especificado',
          payment_method_dollars: item.payment_method_dollars || 'No especificado',
          exchange_rate_used: exchangeRate,
          total_cost_USD: item.total_cost_USD || 0,
          // Porcentajes
          clinic_payment_percentage: item.clinic_payment_percentage,
          doctor_payment_percentage: item.doctor_payment_percentage,
          // NUEVOS CAMPOS
          ortho_doctor_percentage: item.ortho_doctor_percentage,
          external_doctor_percentage: item.external_doctor_percentage,
          external_doctor_split_type: item.external_doctor_split_type || 'from_clinic',
          // Información adicional
          has_external_doctor: !!item.external_doctor || !!item.external_doctor_name || (item.external_doctor_payment > 0),
          external_doctor_name: item.external_doctor_name || item.external_doctor || null,
          external_doctor_specialty: item.external_doctor_specialty || null
        };
      });
      
      // Calcular estadísticas
      const totalIncome = transformedData.reduce((sum, item) => sum + (item.clinic_income || 0), 0);
      const totalDoctorIncome = transformedData.reduce((sum, item) => sum + (item.doctor_income || 0), 0);
      const totalExternalPayments = transformedData.reduce((sum, item) => sum + (item.external_doctor_payment || 0), 0);
      
      res.json({ 
        success: true, 
        data: transformedData,
        total: totalCount || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((totalCount || 0) / limit),
        filterApplied: timeFilter || 'all',
        stats: {
          totalProcedures: transformedData.length,
          totalIncome,
          totalDoctorIncome,
          totalExternalPayments,
          clinicNetIncome: totalIncome, // Ya incluye deducción
          clinicPercentage: transformedData.length > 0 ? 
            transformedData[0].clinic_payment_percentage || 40 : 40,
          doctorPercentage: transformedData.length > 0 ? 
            transformedData[0].doctor_payment_percentage || 60 : 60
        }
      });
      
    } catch (error) {
      console.error('❌ Error al obtener ortodoncias:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener ortodoncias',
        details: error.message
      });
    }
  },

  // ============================================
  // OBTENER PROCEDIMIENTO POR ID
  // ============================================
  getById: async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log('🔍 Obteniendo procedimiento ID:', id);
      
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
        .eq('procedure_ID', id)
        .single();
      
      if (error) {
        console.error('❌ Error en Supabase:', error);
        throw error;
      }
      
      if (!data) {
        return res.status(404).json({ 
          success: false, 
          error: 'Procedimiento no encontrado' 
        });
      }
      
      // Los cálculos ya están hechos en la BD
      const exchangeRate = data.exchange_rate_used || 36.5;
      const clinicIncome = data.clinic_payment_cordobas || 0;
      const doctorIncome = data.doctor_payment_cordobas || 0;
      const externalDoctorPayment = data.external_doctor_payment || 0;
      
      const clinicIncomeUSD = data.clinic_payment_dollars || (clinicIncome / exchangeRate);
      const doctorIncomeUSD = data.doctor_payment_dollars || (doctorIncome / exchangeRate);
      const externalDoctorPaymentUSD = data.external_doctor_payment_usd || (externalDoctorPayment / exchangeRate);
      
      // Formatear fechas
      const transformedData = {
        ...data,
        procedure_date: data.procedure_date ? formatNicaraguaDateTime(data.procedure_date) : 'N/A',
        procedure_date_utc: data.procedure_date,
        creation_date: data.creation_date ? formatNicaraguaDateTime(data.creation_date) : 'N/A',
        patient_name: `${data.patients?.first_name || ''} ${data.patients?.first_last_name || ''}`.trim() || 'Paciente no especificado',
        patient_identification: data.patients?.identification || 'N/A',
        patient_phone: data.patients?.number_phone || 'N/A',
        clinic_income: clinicIncome,
        doctor_income: doctorIncome,
        clinic_income_usd: clinicIncomeUSD,
        doctor_income_usd: doctorIncomeUSD,
        clinic_net_income: clinicIncome, // Ya incluye deducción
        clinic_net_income_usd: clinicIncomeUSD,
        external_doctor_payment: externalDoctorPayment,
        external_doctor_payment_usd: externalDoctorPaymentUSD,
        original_query_type: data.clinical_appointments?.[0]?.query_type || data.procedure_description,
        original_appointment_date: data.clinical_appointments?.[0]?.appointment_date ? 
          formatNicaraguaDateTime(data.clinical_appointments[0].appointment_date) : null,
        original_appointment_observations: data.clinical_appointments?.[0]?.appointment_observations || null,
        // NUEVOS CAMPOS
        ortho_doctor_percentage: data.ortho_doctor_percentage,
        external_doctor_percentage: data.external_doctor_percentage,
        external_doctor_split_type: data.external_doctor_split_type || 'from_clinic'
      };
      
      res.json({ 
        success: true, 
        data: transformedData 
      });
      
    } catch (error) {
      console.error('❌ Error al obtener procedimiento:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener procedimiento',
        details: error.message 
      });
    }
  },

  // ============================================
  // CREAR PROCEDIMIENTO DIRECTAMENTE (SIN CITA)
  // USANDO LA NUEVA LÓGICA DE CÁLCULO
  // ============================================
  create: async (req, res) => {
    try {
      const procedureData = req.body;
      
      console.log('📝 Creando procedimiento con datos:', procedureData);
      
      // Validar datos requeridos
      if (!procedureData.patient_id || !procedureData.procedure_description) {
        return res.status(400).json({ 
          success: false, 
          error: 'Paciente y descripción son requeridos' 
        });
      }
      
      // Calcular pagos usando la nueva función
      const calculatedData = procedureController.calculateProcedurePayments({
        ...procedureData,
        Patient_ID: procedureData.patient_id,
        creation_date: new Date().toISOString(),
        procedure_date: procedureData.procedure_date || new Date().toISOString()
      });
      
      const { data, error } = await supabaseAdmin
        .from('procedures')
        .insert([calculatedData])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error en Supabase:', error);
        throw error;
      }
      
      console.log('✅ Procedimiento creado exitosamente');
      
      // Formatear fechas para respuesta
      const responseData = {
        ...data,
        procedure_date: data.procedure_date ? formatNicaraguaDateTime(data.procedure_date) : 'N/A',
        creation_date: data.creation_date ? formatNicaraguaDateTime(data.creation_date) : 'N/A'
      };
      
      res.status(201).json({ 
        success: true, 
        message: 'Procedimiento creado exitosamente',
        data: responseData 
      });
      
    } catch (error) {
      console.error('❌ Error al crear procedimiento:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Error al crear procedimiento'
      });
    }
  },

  // ============================================
  // ACTUALIZAR PROCEDIMIENTO
  // USANDO LA NUEVA LÓGICA DE CÁLCULO
  // ============================================
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const procedureData = req.body;
      
      console.log('📝 Actualizando procedimiento ID:', id, 'con datos:', procedureData);
      
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
      
      // Calcular pagos usando la nueva función
      const calculatedData = procedureController.calculateProcedurePayments(procedureData);
      
      const { data, error } = await supabaseAdmin
        .from('procedures')
        .update(calculatedData)
        .eq('procedure_ID', id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error en Supabase:', error);
        throw error;
      }
      
      res.json({ 
        success: true, 
        message: 'Procedimiento actualizado exitosamente',
        data 
      });
      
    } catch (error) {
      console.error('❌ Error al actualizar procedimiento:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Error al actualizar procedimiento'
      });
    }
  },

  // ============================================
  // ELIMINAR PROCEDIMIENTO
  // ============================================
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log('🗑️ Eliminando procedimiento ID:', id);
      
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
      
      if (error) {
        console.error('❌ Error en Supabase:', error);
        throw error;
      }
      
      res.json({ 
        success: true, 
        message: 'Procedimiento eliminado exitosamente',
        data 
      });
      
    } catch (error) {
      console.error('❌ Error al eliminar procedimiento:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al eliminar procedimiento',
        details: error.message 
      });
    }
  },

  // ============================================
  // OBTENER PROCEDIMIENTOS POR PACIENTE
  // ============================================
  getByPatientId: async (req, res) => {
    try {
      const { patientId } = req.params;
      
      console.log('🔍 Obteniendo procedimientos para paciente ID:', patientId);
      
      const { data, error } = await supabaseAdmin
        .from('procedures')
        .select('*')
        .eq('Patient_ID', patientId)
        .order('procedure_date', { ascending: false });
      
      if (error) {
        console.error('❌ Error en Supabase:', error);
        throw error;
      }
      
      // Transformar datos
      const transformedData = (data || []).map(item => ({
        ...item,
        procedure_date: item.procedure_date ? formatNicaraguaDateTime(item.procedure_date) : 'N/A',
        creation_date: item.creation_date ? formatNicaraguaDateTime(item.creation_date) : 'N/A'
      }));
      
      res.json({ 
        success: true, 
        data: transformedData 
      });
      
    } catch (error) {
      console.error('❌ Error al obtener procedimientos por paciente:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener procedimientos por paciente',
        details: error.message 
      });
    }
  },

  // ============================================
  // ESTADÍSTICAS DE INGRESOS CON NUEVA LÓGICA
  // ============================================
  getIncomeStats: async (req, res) => {
    try {
      const { startDate, endDate, timeFilter = 'all' } = req.query;
      
      console.log('📊 Obteniendo estadísticas de ingresos:', { startDate, endDate, timeFilter });
      
      let finalStartDate = startDate;
      let finalEndDate = endDate;
      
      // Si no hay fechas específicas y no es 'all', calcular rango
      if (!startDate && !endDate && timeFilter !== 'all') {
        const dateRange = procedureController.getDateRangeFromFilter(timeFilter);
        finalStartDate = dateRange.startDate;
        finalEndDate = dateRange.endDate;
      }
      
      // Construir consulta
      let query = supabaseAdmin
        .from('procedures')
        .select(`
          total_procedure,
          clinic_payment_cordobas,
          doctor_payment_cordobas,
          external_doctor_payment,
          is_orthodontics,
          amount_cordobas,
          amount_dollars
        `);
      
      // Aplicar filtro de fecha solo si hay fechas
      if (finalStartDate && finalEndDate) {
        const startUTC = safeToISOString(finalStartDate);
        const endUTC = safeToISOString(finalEndDate);
        
        if (startUTC && endUTC) {
          query = query.gte('procedure_date', startUTC);
          query = query.lte('procedure_date', endUTC);
        }
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('❌ Error en Supabase:', error);
        throw error;
      }
      
      let general_income = 0;
      let clinic_orthodontic_income = 0;
      let doctor_orthodontic_income = 0;
      let external_doctor_payments = 0;
      let ortho_count = 0;
      let general_count = 0;
      
      (data || []).forEach(procedure => {
        if (procedure.is_orthodontics) {
          clinic_orthodontic_income += procedure.clinic_payment_cordobas || 0;
          doctor_orthodontic_income += procedure.doctor_payment_cordobas || 0;
          ortho_count++;
        } else {
          general_income += procedure.clinic_payment_cordobas || 0;
          general_count++;
        }
        
        external_doctor_payments += procedure.external_doctor_payment || 0;
      });
      
      // Calcular ingresos totales de la clínica (ya incluyen deducción de doctores externos)
      const clinic_income = general_income + clinic_orthodontic_income;
      
      const stats = {
        // Totales brutos
        total_income: (data || []).reduce((sum, p) => sum + (p.total_procedure || 0), 0),
        general_income,
        orthodontic_income: clinic_orthodontic_income + doctor_orthodontic_income,
        
        // Ingresos por clínica y doctora (ya calculados con deducciones)
        clinic_income,
        doctor_income: doctor_orthodontic_income,
        
        // Pagos a doctores externos
        external_doctor_payments,
        
        // Ingresos netos de la clínica (ya incluyen deducción de doctores externos)
        clinic_net_income: clinic_income,
        clinic_net_income_general: general_income,
        clinic_net_income_ortho: clinic_orthodontic_income,
        
        // Conteos
        total_procedures: (data || []).length,
        orthodontics_count: ortho_count,
        general_count: general_count,
        
        // Fechas del período
        period_start: finalStartDate,
        period_end: finalEndDate,
        time_filter_applied: timeFilter
      };
      
      res.json({ 
        success: true, 
        data: stats 
      });
      
    } catch (error) {
      console.error('❌ Error al obtener estadísticas:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener estadísticas',
        details: error.message 
      });
    }
  },

  // ============================================
  // CONTAR PROCEDIMIENTOS TOTALES
  // ============================================
  count: async (req, res) => {
    try {
      const { count, error } = await supabaseAdmin
        .from('procedures')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error('❌ Error en Supabase:', error);
        throw error;
      }
      
      res.json({ 
        success: true, 
        count: count || 0 
      });
      
    } catch (error) {
      console.error('❌ Error al contar procedimientos:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al contar procedimientos',
        details: error.message 
      });
    }
  }
};

export default procedureController;