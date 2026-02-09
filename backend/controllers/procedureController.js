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
  // FUNCIÓN PARA CALCULAR PAGOS CON LÓGICA COMPLETA CORREGIDA
  // ============================================
  calculateProcedurePayments: (procedureData) => {
    console.log('🧮 Calculando pagos para procedimiento:', procedureData);
    
    const {
      is_orthodontics = false,
      amount_cordobas = 0,
      amount_dollars = 0,
      payment_method_cordobas = 'Efectivo',
      payment_method_dollars = 'Efectivo',
      exchange_rate = 36.5,
      external_doctor = false,
      external_doctor_name = '',
      external_doctor_specialty = '',
      external_doctor_payment_type = 'fixed',
      external_doctor_payment_value = 0,
      external_doctor_payment_currency = 'C$',
      // Campos para ortodoncia con doctor externo - VALIDACIÓN MEJORADA
      ortho_doctor_percentage = is_orthodontics ? 60 : 0,
      external_doctor_percentage = 0,
      external_doctor_split_type = 'from_total', // 'from_total' o 'from_clinic'
      observations = '',
      procedure_description = '',
      ...restData
    } = procedureData;
    
    // 1. Calcular montos brutos
    const grossCordobas = parseFloat(amount_cordobas) || 0;
    const grossDollars = parseFloat(amount_dollars) || 0;
    const exchangeRate = parseFloat(exchange_rate) || 36.5;
    
    // 2. Aplicar deducciones POS (5.5%) solo si el pago es con POS
    const isCordobasPOS = payment_method_cordobas === 'POS';
    const isDollarsPOS = payment_method_dollars === 'POS';
    
    const posDeductionCordobas = isCordobasPOS ? grossCordobas * 0.055 : 0;
    const posDeductionDollars = isDollarsPOS ? grossDollars * 0.055 : 0;
    
    // 3. Montos netos después de POS
    const netCordobas = grossCordobas - posDeductionCordobas;
    const netDollars = grossDollars - posDeductionDollars;
    
    // 4. Total del procedimiento en córdobas (después de POS)
    const totalProcedureCordobas = netCordobas + (netDollars * exchangeRate);
    
    // 5. Total del procedimiento en dólares (después de POS)
    const totalProcedureDollars = netDollars + (netCordobas / exchangeRate);
    
    // 6. Preparar datos base
    let calculatedData = {
      ...restData,
      is_orthodontics,
      procedure_description,
      observations,
      
      // Montos abonados
      amount_cordobas: grossCordobas,
      amount_dollars: grossDollars,
      total_cost: grossCordobas, // Para compatibilidad
      total_cost_USD: grossDollars, // Para compatibilidad
      
      // Métodos de pago
      payment_method_cordobas,
      payment_method_dollars,
      
      // Deducciones POS
      pos_deduction_cordobas: posDeductionCordobas,
      pos_deduction_dollars: posDeductionDollars,
      total_pos_deduction: posDeductionCordobas + (posDeductionDollars * exchangeRate),
      
      // Montos netos
      net_amount_cordobas: netCordobas,
      net_amount_dollars: netDollars,
      
      // Montos brutos
      gross_amount_cordobas: grossCordobas,
      gross_amount_dollars: grossDollars,
      
      // Total del procedimiento
      total_procedure: totalProcedureCordobas,
      total_procedure_usd: totalProcedureDollars,
      
      // Tipo de cambio
      exchange_rate: exchangeRate,
      
      // Doctor externo
      external_doctor: !!external_doctor,
      external_doctor_name: external_doctor ? external_doctor_name : null,
      external_doctor_specialty: external_doctor ? external_doctor_specialty : null,
      external_doctor_payment_type: external_doctor ? external_doctor_payment_type : null,
      external_doctor_payment_value: external_doctor ? parseFloat(external_doctor_payment_value) || 0 : null,
      external_doctor_payment_currency: external_doctor ? external_doctor_payment_currency : null,
      theres_external_doctor: !!external_doctor,
      
      // Campos para ortodoncia con validación
      ortho_doctor_percentage: is_orthodontics ? parseFloat(ortho_doctor_percentage) : null,
      external_doctor_percentage: external_doctor ? parseFloat(external_doctor_percentage) : null,
      external_doctor_split_type: external_doctor ? external_doctor_split_type : null
    };
    
    // ============================================
    // LÓGICA DE DISTRIBUCIÓN CORREGIDA
    // ============================================
    
    // CASO 1: ORTODONCIA CON DOCTOR EXTERNO - VALIDACIÓN MEJORADA
    if (is_orthodontics && external_doctor) {
      const orthoPercentage = parseFloat(ortho_doctor_percentage) || 0;
      const externalPercentage = parseFloat(external_doctor_percentage) || 0;
      
      // VALIDACIÓN ESTRICTA: La suma debe ser MENOR a 100%
      if (orthoPercentage + externalPercentage >= 100) {
        throw new Error(
          `La suma de porcentajes para doctora ortodoncista (${orthoPercentage}%) ` +
          `y doctor externo (${externalPercentage}%) no puede ser 100% o más. ` +
          `La clínica debe recibir al menos un 1% de ganancia.`
        );
      }
      
      if (orthoPercentage < 0 || externalPercentage < 0) {
        throw new Error('Los porcentajes no pueden ser negativos');
      }
      
      // Calcular porcentaje de la clínica
      const clinicPercentage = 100 - orthoPercentage - externalPercentage;
      
      if (clinicPercentage <= 0) {
        throw new Error(`La clínica debe tener un porcentaje de ganancia mayor a 0%`);
      }
      
      console.log('✅ Distribución validada (ortodoncia con externo):', {
        doctoraOrtodoncista: orthoPercentage + '%',
        doctorExterno: externalPercentage + '%',
        clinica: clinicPercentage + '%',
        total: '100%'
      });
      
      // Actualizar porcentajes
      calculatedData.clinic_payment_percentage = clinicPercentage;
      calculatedData.doctor_payment_percentage = orthoPercentage;
      
      // Calcular pagos según tipo de división
      if (external_doctor_split_type === 'from_total') {
        // El doctor externo recibe un porcentaje del TOTAL
        const orthoPaymentCordobas = totalProcedureCordobas * (orthoPercentage / 100);
        const externalPaymentCordobas = totalProcedureCordobas * (externalPercentage / 100);
        const clinicPaymentCordobas = totalProcedureCordobas * (clinicPercentage / 100);
        
        const orthoPaymentDollars = totalProcedureDollars * (orthoPercentage / 100);
        const externalPaymentDollars = totalProcedureDollars * (externalPercentage / 100);
        const clinicPaymentDollars = totalProcedureDollars * (clinicPercentage / 100);
        
        calculatedData.clinic_payment_cordobas = clinicPaymentCordobas;
        calculatedData.clinic_payment_dollars = clinicPaymentDollars;
        calculatedData.doctor_payment_cordobas = orthoPaymentCordobas;
        calculatedData.doctor_payment_dollars = orthoPaymentDollars;
        calculatedData.external_doctor_payment = externalPaymentCordobas;
        calculatedData.external_doctor_payment_usd = externalPaymentDollars;
        
      } else if (external_doctor_split_type === 'from_clinic') {
        // El doctor externo recibe un porcentaje de la PARTE DE LA CLÍNICA
        const orthoPaymentCordobas = totalProcedureCordobas * (orthoPercentage / 100);
        const orthoPaymentDollars = totalProcedureDollars * (orthoPercentage / 100);
        
        const clinicPortionBeforeExternal = totalProcedureCordobas * (clinicPercentage / 100);
        const externalPaymentCordobas = clinicPortionBeforeExternal * (externalPercentage / 100);
        const externalPaymentDollars = (clinicPortionBeforeExternal / exchangeRate) * (externalPercentage / 100);
        
        const clinicPaymentCordobas = clinicPortionBeforeExternal - externalPaymentCordobas;
        const clinicPaymentDollars = (clinicPortionBeforeExternal / exchangeRate) - externalPaymentDollars;
        
        calculatedData.external_doctor_payment = externalPaymentCordobas;
        calculatedData.external_doctor_payment_usd = externalPaymentDollars;
        calculatedData.clinic_payment_cordobas = clinicPaymentCordobas;
        calculatedData.clinic_payment_dollars = clinicPaymentDollars;
        calculatedData.doctor_payment_cordobas = orthoPaymentCordobas;
        calculatedData.doctor_payment_dollars = orthoPaymentDollars;
      }
      
    // CASO 2: ORTODONCIA SIN DOCTOR EXTERNO
    } else if (is_orthodontics && !external_doctor) {
      const clinicPercentage = 40; // Por defecto para ortodoncia
      const doctorPercentage = 60; // Por defecto para ortodoncia
      
      const clinicPaymentCordobas = totalProcedureCordobas * (clinicPercentage / 100);
      const clinicPaymentDollars = clinicPaymentCordobas / exchangeRate;
      const doctorPaymentCordobas = totalProcedureCordobas * (doctorPercentage / 100);
      const doctorPaymentDollars = doctorPaymentCordobas / exchangeRate;
      
      calculatedData.clinic_payment_cordobas = clinicPaymentCordobas;
      calculatedData.clinic_payment_dollars = clinicPaymentDollars;
      calculatedData.doctor_payment_cordobas = doctorPaymentCordobas;
      calculatedData.doctor_payment_dollars = doctorPaymentDollars;
      calculatedData.clinic_payment_percentage = clinicPercentage;
      calculatedData.doctor_payment_percentage = doctorPercentage;
      calculatedData.ortho_doctor_percentage = doctorPercentage;
      calculatedData.external_doctor_payment = 0;
      calculatedData.external_doctor_payment_usd = 0;
      
    // CASO 3: PROCEDIMIENTO GENERAL CON DOCTOR EXTERNO
    } else if (!is_orthodontics && external_doctor) {
      let externalPaymentCordobas = 0;
      let externalPaymentDollars = 0;
      
      if (external_doctor_payment_type === 'percentage') {
        const percentage = parseFloat(external_doctor_payment_value) || 0;
        if (percentage > 100) {
          throw new Error('El porcentaje no puede ser mayor a 100%');
        }
        externalPaymentCordobas = totalProcedureCordobas * (percentage / 100);
        externalPaymentDollars = totalProcedureDollars * (percentage / 100);
      } else {
        const fixedAmount = parseFloat(external_doctor_payment_value) || 0;
        if (external_doctor_payment_currency === 'US$') {
          externalPaymentDollars = fixedAmount;
          externalPaymentCordobas = fixedAmount * exchangeRate;
        } else {
          externalPaymentCordobas = fixedAmount;
          externalPaymentDollars = fixedAmount / exchangeRate;
        }
      }
      
      const clinicPaymentCordobas = totalProcedureCordobas - externalPaymentCordobas;
      const clinicPaymentDollars = totalProcedureDollars - externalPaymentDollars;
      
      if (clinicPaymentCordobas <= 0) {
        throw new Error('El pago al doctor externo no puede ser mayor o igual al total del procedimiento');
      }
      
      calculatedData.clinic_payment_cordobas = clinicPaymentCordobas;
      calculatedData.clinic_payment_dollars = clinicPaymentDollars;
      calculatedData.doctor_payment_cordobas = 0;
      calculatedData.doctor_payment_dollars = 0;
      calculatedData.external_doctor_payment = externalPaymentCordobas;
      calculatedData.external_doctor_payment_usd = externalPaymentDollars;
      calculatedData.clinic_payment_percentage = 100;
      calculatedData.doctor_payment_percentage = 0;
      
    // CASO 4: PROCEDIMIENTO GENERAL SIN DOCTOR EXTERNO
    } else {
      calculatedData.clinic_payment_cordobas = totalProcedureCordobas;
      calculatedData.clinic_payment_dollars = totalProcedureDollars;
      calculatedData.doctor_payment_cordobas = 0;
      calculatedData.doctor_payment_dollars = 0;
      calculatedData.clinic_payment_percentage = 100;
      calculatedData.doctor_payment_percentage = 0;
      calculatedData.external_doctor_payment = 0;
      calculatedData.external_doctor_payment_usd = 0;
    }
    
    console.log('✅ Datos calculados finales:', {
      totalAbonadoCordobas: grossCordobas,
      totalAbonadoDolares: grossDollars,
      totalProcedimientoCordobas: totalProcedureCordobas,
      totalProcedimientoDolares: totalProcedureDollars,
      gananciaClinicaCordobas: calculatedData.clinic_payment_cordobas,
      gananciaDoctoraCordobas: calculatedData.doctor_payment_cordobas,
      pagoDoctorExterno: calculatedData.external_doctor_payment,
      deduccionPOS: calculatedData.total_pos_deduction
    });
    
    return calculatedData;
  },

  // ============================================
  // OBTENER PROCEDIMIENTOS REGULARES (NO ORTODONCIA)
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
        const exchangeRate = item.exchange_rate || 36.5;
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
          exchange_rate: exchangeRate,
          total_cost_USD: item.total_cost_USD || 0,
          // Información adicional
          has_external_doctor: !!item.external_doctor || !!item.external_doctor_name || (item.external_doctor_payment > 0),
          external_doctor_name: item.external_doctor_name || item.external_doctor || null,
          external_doctor_specialty: item.external_doctor_specialty || null,
          // NUEVOS CAMPOS
          ortho_doctor_percentage: item.ortho_doctor_percentage,
          external_doctor_percentage: item.external_doctor_percentage,
          external_doctor_split_type: item.external_doctor_split_type || 'from_total'
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
        const exchangeRate = item.exchange_rate || 36.5;
        
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
          exchange_rate: exchangeRate,
          total_cost_USD: item.total_cost_USD || 0,
          // Porcentajes
          clinic_payment_percentage: item.clinic_payment_percentage,
          doctor_payment_percentage: item.doctor_payment_percentage,
          // NUEVOS CAMPOS
          ortho_doctor_percentage: item.ortho_doctor_percentage,
          external_doctor_percentage: item.external_doctor_percentage,
          external_doctor_split_type: item.external_doctor_split_type || 'from_total',
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
      const exchangeRate = data.exchange_rate || 36.5;
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
        external_doctor_split_type: data.external_doctor_split_type || 'from_total'
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
  // CREAR PROCEDIMIENTO DIRECTAMENTE
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
      
      // Calcular pagos usando la función corregida
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
      
      // Calcular pagos usando la función corregida
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
  // ESTADÍSTICAS DE INGRESOS
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