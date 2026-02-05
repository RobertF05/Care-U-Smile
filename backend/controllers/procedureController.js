// controllers/procedureController.js - VERSIÓN UNIFICADA CON AMBOS FILTROS
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
        timeFilter = 'thisMonth'
      } = req.query;
      
      console.log('📋 Parámetros recibidos (procedimientos normales):', { 
        page, limit, startDate, endDate, patientId, timeFilter 
      });
      
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      // Función auxiliar para obtener fechas según filtro de tiempo
      const getDateRangeFromFilter = (filter) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        const dayOfWeek = now.getDay();
        
        console.log(`📅 Calculando rango para filtro: ${filter}`);
        
        let startDate = null;
        let endDate = null;
        
        switch(filter) {
          case 'today':
            // Hoy (desde inicio del día hasta fin del día)
            startDate = new Date(year, month, day, 0, 0, 0, 0);
            endDate = new Date(year, month, day, 23, 59, 59, 999);
            console.log(`📅 Hoy: ${startDate.toISOString()} - ${endDate.toISOString()}`);
            break;
            
          case 'thisWeek':
            // Esta semana (desde domingo hasta sábado)
            const startOfWeek = new Date(year, month, day - dayOfWeek, 0, 0, 0, 0);
            const endOfWeek = new Date(year, month, day + (6 - dayOfWeek), 23, 59, 59, 999);
            startDate = startOfWeek;
            endDate = endOfWeek;
            console.log(`📅 Esta semana: ${startDate.toISOString()} - ${endDate.toISOString()}`);
            break;
            
          case 'thisMonth':
            // Este mes (desde día 1 hasta último día del mes)
            startDate = new Date(year, month, 1, 0, 0, 0, 0);
            endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
            console.log(`📅 Este mes: ${startDate.toISOString()} - ${endDate.toISOString()}`);
            break;
            
          case 'all':
          default:
            // Sin filtro de fecha
            console.log('📅 Sin filtro de fechas (todos)');
            return {
              startDate: null,
              endDate: null
            };
        }
        
        // Asegurarse de que las fechas sean válidas
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          console.error('❌ Fechas calculadas inválidas');
          return {
            startDate: null,
            endDate: null
          };
        }
        
        return {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        };
      };
      
      // LÓGICA DE PRIORIDAD: Fechas específicas > Filtro de tiempo
      let finalStartDate = null;
      let finalEndDate = null;
      let filterApplied = 'none';
      
      // 1. PRIORIDAD: Si hay fechas específicas, usarlas
      if (startDate || endDate) {
        finalStartDate = startDate;
        finalEndDate = endDate;
        filterApplied = 'specificDates';
        console.log('📅 Usando fechas específicas:', { start: finalStartDate, end: finalEndDate });
      }
      // 2. Si NO hay fechas específicas, usar el filtro de tiempo
      else if (timeFilter && timeFilter !== 'all') {
        const dateRange = getDateRangeFromFilter(timeFilter);
        finalStartDate = dateRange.startDate;
        finalEndDate = dateRange.endDate;
        filterApplied = timeFilter;
        console.log('📅 Usando filtro de tiempo:', { 
          filter: timeFilter, 
          start: finalStartDate, 
          end: finalEndDate 
        });
      }
      // 3. Filtro "Todos" o sin filtro
      else {
        console.log('📅 Sin filtro de fechas (mostrando todos los procedimientos)');
        filterApplied = 'all';
      }
      
      // Construir consulta
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
      
      // Aplicar filtros de fecha SI existen
      if (finalStartDate && finalEndDate) {
        try {
          // Convertir fechas a formato UTC para la consulta
          const startUTC = safeToISOString(finalStartDate);
          const endUTC = safeToISOString(finalEndDate);
          
          if (startUTC && endUTC) {
            console.log('📅 Aplicando filtro de fechas UTC:', { 
              start: startUTC, 
              end: endUTC 
            });
            query = query.gte('procedure_date', startUTC);
            query = query.lte('procedure_date', endUTC);
          } else {
            console.warn('⚠️ Fechas inválidas después de conversión, no se aplicará filtro');
          }
        } catch (dateError) {
          console.error('❌ Error procesando fechas:', dateError.message);
        }
      }
      
      // Otros filtros
      if (patientId) {
        query = query.eq('Patient_ID', patientId);
      }
      
      // Paginación
      query = query.range(from, to);
      
      console.log('🔍 Ejecutando consulta a Supabase...');
      const { data, error, count: totalCount } = await query;
      
      if (error) {
        console.error('❌ Error en Supabase:', error);
        throw error;
      }
      
      console.log(`✅ ${data?.length || 0} procedimientos normales encontrados`);
      
      // Transformar datos
      const transformedData = (data || []).map(item => {
        // Calcular ingresos
        const clinicIncome = item.total_procedure || item.total_cost || 0;
        const externalDoctorPayment = item.external_doctor_payment || 0;
        const clinicNetIncome = Math.max(0, clinicIncome - externalDoctorPayment);
        
        // Formatear fechas para mostrar
        const procedureDateFormatted = item.procedure_date ? 
          formatNicaraguaDateTime(item.procedure_date) : 'N/A';
        
        const creationDateFormatted = item.creation_date ? 
          formatNicaraguaDateTime(item.creation_date) : 'N/A';
        
        const originalAppointmentDate = item.clinical_appointments?.[0]?.appointment_date;
        const originalAppointmentDateFormatted = originalAppointmentDate ? 
          formatNicaraguaDateTime(originalAppointmentDate) : null;
        
        // Calcular totales en dólares si hay tipo de cambio
        const exchangeRate = item.exchange_rate_used || 36.5;
        const totalProcedureUSD = item.total_procedure_usd || (clinicIncome / exchangeRate);
        const clinicNetIncomeUSD = item.clinic_payment_dollars || (clinicNetIncome / exchangeRate);
        const externalDoctorPaymentUSD = item.external_doctor_payment_usd || (externalDoctorPayment / exchangeRate);
        
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
          clinic_income: clinicIncome,
          clinic_net_income: clinicNetIncome,
          external_doctor_payment: externalDoctorPayment,
          // Ingresos en dólares
          total_procedure_usd: totalProcedureUSD,
          clinic_net_income_usd: clinicNetIncomeUSD,
          external_doctor_payment_usd: externalDoctorPaymentUSD,
          // Asegurar que los campos de pago estén presentes
          amount_cordobas: item.amount_cordobas || 0,
          amount_dollars: item.amount_dollars || 0,
          payment_method_cordobas: item.payment_method_cordobas || 'No especificado',
          payment_method_dollars: item.payment_method_dollars || 'No especificado',
          exchange_rate_used: exchangeRate,
          total_cost_USD: item.total_cost_USD || 0,
          // Campos para deducciones POS
          pos_deduction_cordobas: item.pos_deduction_cordobas || 0,
          pos_deduction_dollars: item.pos_deduction_dollars || 0,
          net_amount_cordobas: item.net_amount_cordobas || clinicIncome,
          net_amount_dollars: item.net_amount_dollars || totalProcedureUSD,
          gross_amount_cordobas: item.gross_amount_cordobas || item.amount_cordobas || clinicIncome,
          gross_amount_dollars: item.gross_amount_dollars || item.amount_dollars || totalProcedureUSD,
          // Información adicional
          has_external_doctor: !!item.external_doctor || !!item.external_doctor_name || (item.external_doctor_payment > 0),
          external_doctor_name: item.external_doctor_name || item.external_doctor || null,
          external_doctor_specialty: item.external_doctor_specialty || null
        };
      });
      
      // Calcular estadísticas del filtro aplicado
      const totalIncome = transformedData.reduce((sum, item) => sum + (item.clinic_income || 0), 0);
      const totalNetIncome = transformedData.reduce((sum, item) => sum + (item.clinic_net_income || 0), 0);
      const totalExternalPayments = transformedData.reduce((sum, item) => sum + (item.external_doctor_payment || 0), 0);
      
      res.json({ 
        success: true, 
        data: transformedData,
        total: totalCount || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((totalCount || 0) / limit),
        filterApplied: {
          type: filterApplied,
          startDate: finalStartDate,
          endDate: finalEndDate,
          hasDateFilter: !!(finalStartDate && finalEndDate)
        },
        stats: {
          totalProcedures: transformedData.length,
          totalIncome,
          totalNetIncome,
          totalExternalPayments,
          averageIncomePerProcedure: transformedData.length > 0 ? totalIncome / transformedData.length : 0
        }
      });
      
    } catch (error) {
      console.error('❌ Error al obtener procedimientos:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al obtener procedimientos',
        details: error.message,
        filter: req.query.timeFilter || 'unknown'
      });
    }
  },

  // ============================================
  // OBTENER PROCEDIMIENTOS DE ORTODONCIA
  // CON FILTROS DE TIEMPO Y FECHAS ESPECÍFICAS (ACTUALIZADO)
  // ============================================
  getAllOrthodontics: async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 100, 
        startDate, 
        endDate,
        patientId,
        timeFilter = 'thisMonth'  // NUEVO PARÁMETRO
      } = req.query;
      
      console.log('📋 Parámetros recibidos (ortodoncia):', { 
        page, limit, startDate, endDate, patientId, timeFilter 
      });
      
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      // Función auxiliar para obtener fechas según filtro de tiempo (MISMA QUE getAllNormal)
      const getDateRangeFromFilter = (filter) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        const dayOfWeek = now.getDay();
        
        console.log(`📅 [Ortodoncia] Calculando rango para filtro: ${filter}`);
        
        let startDate = null;
        let endDate = null;
        
        switch(filter) {
          case 'today':
            startDate = new Date(year, month, day, 0, 0, 0, 0);
            endDate = new Date(year, month, day, 23, 59, 59, 999);
            break;
            
          case 'thisWeek':
            const startOfWeek = new Date(year, month, day - dayOfWeek, 0, 0, 0, 0);
            const endOfWeek = new Date(year, month, day + (6 - dayOfWeek), 23, 59, 59, 999);
            startDate = startOfWeek;
            endDate = endOfWeek;
            break;
            
          case 'thisMonth':
            startDate = new Date(year, month, 1, 0, 0, 0, 0);
            endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
            break;
            
          case 'all':
          default:
            return {
              startDate: null,
              endDate: null
            };
        }
        
        // Asegurarse de que las fechas sean válidas
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          console.error('❌ [Ortodoncia] Fechas calculadas inválidas');
          return {
            startDate: null,
            endDate: null
          };
        }
        
        return {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        };
      };
      
      // LÓGICA DE PRIORIDAD UNIFICADA: Fechas específicas > Filtro de tiempo
      let finalStartDate = null;
      let finalEndDate = null;
      let filterApplied = 'none';
      
      // 1. PRIORIDAD: Si hay fechas específicas, usarlas
      if (startDate || endDate) {
        finalStartDate = startDate;
        finalEndDate = endDate;
        filterApplied = 'specificDates';
        console.log('📅 [Ortodoncia] Usando fechas específicas:', { start: finalStartDate, end: finalEndDate });
      }
      // 2. Si NO hay fechas específicas, usar el filtro de tiempo
      else if (timeFilter && timeFilter !== 'all') {
        const dateRange = getDateRangeFromFilter(timeFilter);
        finalStartDate = dateRange.startDate;
        finalEndDate = dateRange.endDate;
        filterApplied = timeFilter;
        console.log('📅 [Ortodoncia] Usando filtro de tiempo:', { 
          filter: timeFilter, 
          start: finalStartDate, 
          end: finalEndDate 
        });
      }
      // 3. Filtro "Todos" o sin filtro
      else {
        console.log('📅 [Ortodoncia] Sin filtro de fechas (mostrando todas las ortodoncias)');
        filterApplied = 'all';
      }
      
      // Construir consulta
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
      
      // Aplicar filtros de fecha SI existen
      if (finalStartDate && finalEndDate) {
        try {
          const startUTC = safeToISOString(finalStartDate);
          const endUTC = safeToISOString(finalEndDate);
          
          if (startUTC && endUTC) {
            console.log('📅 [Ortodoncia] Aplicando filtro de fechas UTC:', { start: startUTC, end: endUTC });
            query = query.gte('procedure_date', startUTC);
            query = query.lte('procedure_date', endUTC);
          }
        } catch (dateError) {
          console.error('❌ [Ortodoncia] Error procesando fechas:', dateError.message);
        }
      }
      
      // Otros filtros
      if (patientId) {
        query = query.eq('Patient_ID', patientId);
      }
      
      // Paginación
      query = query.range(from, to);
      
      console.log('🔍 [Ortodoncia] Ejecutando consulta a Supabase...');
      const { data, error, count: totalCount } = await query;
      
      if (error) {
        console.error('❌ Error en Supabase (ortodoncia):', error);
        throw error;
      }
      
      console.log(`✅ ${data?.length || 0} ortodoncias encontradas`);
      
      // Transformar datos
      const transformedData = (data || []).map(item => {
        const clinicPercentage = item.clinic_payment_percentage || 40;
        const doctorPercentage = item.doctor_payment_percentage || 60;
        const total = item.total_procedure || item.total_cost || 0;
        const exchangeRate = item.exchange_rate_used || 36.5;
        
        // Calcular en córdobas
        const clinicIncomeCordobas = total * (clinicPercentage / 100);
        const doctorIncomeCordobas = total * (doctorPercentage / 100);
        const externalDoctorPaymentCordobas = item.external_doctor_payment || 0;
        const clinicNetIncomeCordobas = Math.max(0, clinicIncomeCordobas - externalDoctorPaymentCordobas);
        
        // Calcular en dólares
        const totalUSD = item.total_procedure_usd || (total / exchangeRate);
        const clinicIncomeUSD = totalUSD * (clinicPercentage / 100);
        const doctorIncomeUSD = totalUSD * (doctorPercentage / 100);
        const externalDoctorPaymentUSD = item.external_doctor_payment_usd || (externalDoctorPaymentCordobas / exchangeRate);
        const clinicNetIncomeUSD = Math.max(0, clinicIncomeUSD - externalDoctorPaymentUSD);
        
        // Formatear fechas
        const procedureDateFormatted = item.procedure_date ? 
          formatNicaraguaDateTime(item.procedure_date) : 'N/A';
        
        const creationDateFormatted = item.creation_date ? 
          formatNicaraguaDateTime(item.creation_date) : 'N/A';
        
        const originalAppointmentDate = item.clinical_appointments?.[0]?.appointment_date;
        const originalAppointmentDateFormatted = originalAppointmentDate ? 
          formatNicaraguaDateTime(originalAppointmentDate) : null;
        
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
          clinic_net_income: clinicNetIncomeCordobas,
          external_doctor_payment: externalDoctorPaymentCordobas,
          // Ingresos en dólares
          clinic_income_usd: clinicIncomeUSD,
          doctor_income_usd: doctorIncomeUSD,
          clinic_net_income_usd: clinicNetIncomeUSD,
          external_doctor_payment_usd: externalDoctorPaymentUSD,
          // Montos específicos
          clinic_payment_cordobas: item.clinic_payment_cordobas || clinicIncomeCordobas,
          doctor_payment_cordobas: item.doctor_payment_cordobas || doctorIncomeCordobas,
          clinic_payment_dollars: item.clinic_payment_dollars || clinicIncomeUSD,
          doctor_payment_dollars: item.doctor_payment_dollars || doctorIncomeUSD,
          total_procedure: total,
          total_procedure_usd: totalUSD,
          // Asegurar que los campos de pago estén presentes
          amount_cordobas: item.amount_cordobas || 0,
          amount_dollars: item.amount_dollars || 0,
          payment_method_cordobas: item.payment_method_cordobas || 'No especificado',
          payment_method_dollars: item.payment_method_dollars || 'No especificado',
          exchange_rate_used: exchangeRate,
          total_cost_USD: item.total_cost_USD || 0,
          // Porcentajes
          clinic_payment_percentage: clinicPercentage,
          doctor_payment_percentage: doctorPercentage,
          // Información adicional
          has_external_doctor: !!item.external_doctor || !!item.external_doctor_name || (item.external_doctor_payment > 0),
          external_doctor_name: item.external_doctor_name || item.external_doctor || null,
          external_doctor_specialty: item.external_doctor_specialty || null
        };
      });
      
      // Calcular estadísticas
      const totalIncome = transformedData.reduce((sum, item) => sum + (item.clinic_income || 0), 0);
      const totalNetIncome = transformedData.reduce((sum, item) => sum + (item.clinic_net_income || 0), 0);
      const totalExternalPayments = transformedData.reduce((sum, item) => sum + (item.external_doctor_payment || 0), 0);
      const totalDoctorIncome = transformedData.reduce((sum, item) => sum + (item.doctor_income || 0), 0);
      
      res.json({ 
        success: true, 
        data: transformedData,
        total: totalCount || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((totalCount || 0) / limit),
        filterApplied: {
          type: filterApplied,
          startDate: finalStartDate,
          endDate: finalEndDate,
          hasDateFilter: !!(finalStartDate && finalEndDate)
        },
        stats: {
          totalProcedures: transformedData.length,
          totalIncome,
          totalNetIncome,
          totalExternalPayments,
          totalDoctorIncome,
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
        details: error.message,
        filter: req.query.timeFilter || 'unknown'
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
      
      // Calcular ingresos
      const total = data.total_procedure || data.total_cost || 0;
      const exchangeRate = data.exchange_rate_used || 36.5;
      let clinicIncome, doctorIncome, clinicIncomeUSD, doctorIncomeUSD;
      
      if (data.is_orthodontics) {
        const clinicPercentage = data.clinic_payment_percentage || 40;
        const doctorPercentage = data.doctor_payment_percentage || 60;
        clinicIncome = total * clinicPercentage / 100;
        doctorIncome = total * doctorPercentage / 100;
        clinicIncomeUSD = (total / exchangeRate) * clinicPercentage / 100;
        doctorIncomeUSD = (total / exchangeRate) * doctorPercentage / 100;
      } else {
        clinicIncome = total;
        doctorIncome = 0;
        clinicIncomeUSD = total / exchangeRate;
        doctorIncomeUSD = 0;
      }
      
      const externalDoctorPayment = data.external_doctor_payment || 0;
      const externalDoctorPaymentUSD = data.external_doctor_payment_usd || (externalDoctorPayment / exchangeRate);
      const clinicNetIncome = Math.max(0, clinicIncome - externalDoctorPayment);
      const clinicNetIncomeUSD = Math.max(0, clinicIncomeUSD - externalDoctorPaymentUSD);
      
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
        clinic_net_income: clinicNetIncome,
        clinic_net_income_usd: clinicNetIncomeUSD,
        external_doctor_payment: externalDoctorPayment,
        external_doctor_payment_usd: externalDoctorPaymentUSD,
        original_query_type: data.clinical_appointments?.[0]?.query_type || data.procedure_description,
        original_appointment_date: data.clinical_appointments?.[0]?.appointment_date ? 
          formatNicaraguaDateTime(data.clinical_appointments[0].appointment_date) : null,
        original_appointment_observations: data.clinical_appointments?.[0]?.appointment_observations || null
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
      
      const { data, error } = await supabaseAdmin
        .from('procedures')
        .insert([{
          ...procedureData,
          Patient_ID: procedureData.patient_id,
          creation_date: new Date().toISOString(),
          procedure_date: procedureData.procedure_date || new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error en Supabase:', error);
        throw error;
      }
      
      // Calcular ingresos para respuesta
      const total = data.total_procedure || data.total_cost || 0;
      const exchangeRate = data.exchange_rate_used || 36.5;
      let clinicIncome, doctorIncome, clinicIncomeUSD, doctorIncomeUSD;
      
      if (data.is_orthodontics) {
        const clinicPercentage = data.clinic_payment_percentage || 40;
        const doctorPercentage = data.doctor_payment_percentage || 60;
        clinicIncome = total * clinicPercentage / 100;
        doctorIncome = total * doctorPercentage / 100;
        clinicIncomeUSD = (total / exchangeRate) * clinicPercentage / 100;
        doctorIncomeUSD = (total / exchangeRate) * doctorPercentage / 100;
      } else {
        clinicIncome = total;
        doctorIncome = 0;
        clinicIncomeUSD = total / exchangeRate;
        doctorIncomeUSD = 0;
      }
      
      const externalDoctorPayment = data.external_doctor_payment || 0;
      const externalDoctorPaymentUSD = data.external_doctor_payment_usd || (externalDoctorPayment / exchangeRate);
      const clinicNetIncome = Math.max(0, clinicIncome - externalDoctorPayment);
      const clinicNetIncomeUSD = Math.max(0, clinicIncomeUSD - externalDoctorPaymentUSD);
      
      const responseData = {
        ...data,
        procedure_date: data.procedure_date ? formatNicaraguaDateTime(data.procedure_date) : 'N/A',
        creation_date: data.creation_date ? formatNicaraguaDateTime(data.creation_date) : 'N/A',
        clinic_income: clinicIncome,
        doctor_income: doctorIncome,
        clinic_income_usd: clinicIncomeUSD,
        doctor_income_usd: doctorIncomeUSD,
        clinic_net_income: clinicNetIncome,
        clinic_net_income_usd: clinicNetIncomeUSD,
        external_doctor_payment: externalDoctorPayment,
        external_doctor_payment_usd: externalDoctorPaymentUSD
      };
      
      console.log('✅ Procedimiento creado exitosamente');
      
      res.status(201).json({ 
        success: true, 
        message: 'Procedimiento creado exitosamente',
        data: responseData 
      });
      
    } catch (error) {
      console.error('❌ Error al crear procedimiento:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al crear procedimiento',
        details: error.message 
      });
    }
  },

  // ============================================
  // ACTUALIZAR PROCEDIMIENTO
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
      
      const { data, error } = await supabaseAdmin
        .from('procedures')
        .update(procedureData)
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
        error: 'Error al actualizar procedimiento',
        details: error.message 
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
  // ESTADÍSTICAS DE INGRESOS
  // ============================================
  getIncomeStats: async (req, res) => {
    try {
      const { startDate, endDate, timeFilter = 'thisMonth' } = req.query;
      
      console.log('📊 Obteniendo estadísticas de ingresos:', { startDate, endDate, timeFilter });
      
      // Usar la misma lógica de filtro de tiempo
      const getDateRangeFromFilter = (filter) => {
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
            break;
            
          case 'thisWeek':
            const startOfWeek = new Date(year, month, day - dayOfWeek, 0, 0, 0, 0);
            const endOfWeek = new Date(year, month, day + (6 - dayOfWeek), 23, 59, 59, 999);
            startDate = startOfWeek;
            endDate = endOfWeek;
            break;
            
          case 'thisMonth':
            startDate = new Date(year, month, 1, 0, 0, 0, 0);
            endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
            break;
            
          case 'all':
          default:
            return {
              startDate: null,
              endDate: null
            };
        }
        
        return {
          startDate: startDate ? startDate.toISOString() : null,
          endDate: endDate ? endDate.toISOString() : null
        };
      };
      
      let finalStartDate = startDate;
      let finalEndDate = endDate;
      
      // Aplicar filtro de tiempo si no hay fechas específicas
      if (!startDate && !endDate) {
        const dateRange = getDateRangeFromFilter(timeFilter);
        finalStartDate = dateRange.startDate;
        finalEndDate = dateRange.endDate;
      }
      
      if (!finalStartDate || !finalEndDate) {
        return res.status(400).json({ 
          success: false, 
          error: 'Fecha inicio y fin son requeridas' 
        });
      }
      
      const startUTC = safeToISOString(finalStartDate);
      const endUTC = safeToISOString(finalEndDate);
      
      if (!startUTC || !endUTC) {
        return res.status(400).json({ 
          success: false, 
          error: 'Fechas inválidas' 
        });
      }
      
      // Obtener todos los procedimientos en el período
      const { data, error } = await supabaseAdmin
        .from('procedures')
        .select('total_procedure, is_orthodontics, external_doctor_payment, clinic_payment_percentage, doctor_payment_percentage')
        .gte('procedure_date', startUTC)
        .lte('procedure_date', endUTC);
      
      if (error) {
        console.error('❌ Error en Supabase:', error);
        throw error;
      }
      
      let totalGeneral = 0;
      let totalOrtho = 0;
      let clinicOrthoIncome = 0;
      let doctorOrthoIncome = 0;
      let externalDoctorPayments = 0;
      let orthoCount = 0;
      let generalCount = 0;
      
      (data || []).forEach(proc => {
        const total = proc.total_procedure || 0;
        const externalPayment = proc.external_doctor_payment || 0;
        
        if (proc.is_orthodontics) {
          totalOrtho += total;
          orthoCount++;
          
          const clinicPercentage = proc.clinic_payment_percentage || 40;
          const doctorPercentage = proc.doctor_payment_percentage || 60;
          
          clinicOrthoIncome += total * (clinicPercentage / 100);
          doctorOrthoIncome += total * (doctorPercentage / 100);
          externalDoctorPayments += externalPayment;
        } else {
          totalGeneral += total;
          generalCount++;
        }
      });
      
      // Calcular ingresos netos de la clínica
      const clinicNetIncomeOrtho = Math.max(0, clinicOrthoIncome - externalDoctorPayments);
      const clinicNetIncomeGeneral = totalGeneral;
      const totalClinicNetIncome = clinicNetIncomeGeneral + clinicNetIncomeOrtho;
      
      const stats = {
        // Totales brutos
        total_income: totalGeneral + totalOrtho,
        general_income: totalGeneral,
        orthodontic_income: totalOrtho,
        
        // Ingresos por clínica y doctora (brutos)
        clinic_income: totalGeneral + clinicOrthoIncome,
        doctor_income: doctorOrthoIncome,
        
        // Pagos a doctores externos
        external_doctor_payments: externalDoctorPayments,
        
        // Ingresos netos de la clínica (después de doctores externos)
        clinic_net_income: totalClinicNetIncome,
        clinic_net_income_general: clinicNetIncomeGeneral,
        clinic_net_income_ortho: clinicNetIncomeOrtho,
        
        // Conteos
        total_procedures: (data || []).length,
        orthodontics_count: orthoCount,
        general_count: generalCount,
        
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