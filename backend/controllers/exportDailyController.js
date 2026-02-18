import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '../config/supabase.js';
import { formatNicaraguaDate, formatNicaraguaDateTime } from '../utils/timezoneUtils.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función formatCurrency local
const formatCurrency = (amount, currency = 'NIO') => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    amount = 0;
  }
  
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
  
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const exportDailyController = {
  // Exportar cierre diario a Excel DETALLADO - VERSIÓN CORREGIDA CON GASTOS
exportDailyToExcelDetailed: async (req, res) => {
  try {
    const { closingId } = req.params;
    
    if (!closingId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID de cierre requerido' 
      });
    }
    
    console.log('🔍 Exportando cierre diario detallado ID:', closingId);
    
    // Obtener cierre diario
    const { data: closing, error: closingError } = await supabaseAdmin
      .from('daily_closings')
      .select('*')
      .eq('daily_closing_id', closingId)
      .single();
    
    if (closingError) {
      console.error('❌ Error obteniendo cierre:', closingError);
      throw closingError;
    }
    
    if (!closing) {
      return res.status(404).json({ success: false, error: 'Cierre diario no encontrado' });
    }
    
    console.log('✅ Cierre encontrado:', {
      fecha: closing.closing_date,
      tipo: closing.closing_type,
      total_gastos_segun_cierre: closing.total_variable_expenses
    });
    
    // Obtener procedimientos del día
    const { data: procedureRelations, error: relationsError } = await supabaseAdmin
      .from('procedure_daily_closings')
      .select(`
        *,
        procedures (
          procedure_ID,
          procedure_description,
          procedure_date,
          patients (first_name, first_last_name),
          is_orthodontics,
          clinic_payment_cordobas,
          clinic_payment_dollars,
          doctor_payment_cordobas,
          doctor_payment_dollars,
          external_doctor_payment,
          external_doctor_payment_usd,
          theres_external_doctor,
          external_doctor_name
        )
      `)
      .eq('daily_closing_ID', closingId)
      .order('procedure_ID', { ascending: true });
    
    if (relationsError) {
      console.error('❌ Error obteniendo relaciones:', relationsError);
      throw relationsError;
    }
    
    console.log(`✅ Encontrados ${procedureRelations?.length || 0} procedimientos`);
    
    // 🔴 SECCIÓN CORREGIDA: Obtener gastos del día con TODOS los campos posibles
    console.log('🔍 Buscando gastos para la fecha:', closing.closing_date);
    
    // Primero, intentar con la consulta exacta (con processed)
    let { data: bills, error: billsError } = await supabaseAdmin
      .from('bills')
      .select('*')
      .eq('bill_date', closing.closing_date)
      .eq('is_processed_in_closing', true)
      .eq('processed_in_daily_closing_ID', closingId)
      .order('bill_date', { ascending: true });
    
    // Si no encuentra gastos, intentar con una consulta más amplia
    if (!bills || bills.length === 0) {
      console.log('⚠️ No se encontraron gastos con processed, intentando búsqueda más amplia...');
      
      const { data: billsAll, error: billsAllError } = await supabaseAdmin
        .from('bills')
        .select('*')
        .eq('bill_date', closing.closing_date)
        .eq('is_recurrent', false)
        .order('bill_date', { ascending: true });
      
      if (billsAllError && billsAllError.code !== 'PGRST116') {
        console.error('❌ Error en búsqueda amplia:', billsAllError);
      } else {
        bills = billsAll;
        console.log(`✅ Búsqueda amplia encontró ${bills?.length || 0} gastos`);
      }
    }
    
    // Si aún no encuentra gastos, intentar con cualquier gasto de la fecha
    if (!bills || bills.length === 0) {
      console.log('⚠️ Intentando búsqueda final sin filtros...');
      
      const { data: billsAny, error: billsAnyError } = await supabaseAdmin
        .from('bills')
        .select('*')
        .eq('bill_date', closing.closing_date)
        .order('bill_date', { ascending: true });
      
      if (billsAnyError && billsAnyError.code !== 'PGRST116') {
        console.error('❌ Error en búsqueda final:', billsAnyError);
      } else {
        bills = billsAny;
        console.log(`✅ Búsqueda final encontró ${bills?.length || 0} gastos totales en la fecha`);
      }
    }
    
    // DEBUG: Mostrar todos los gastos encontrados
    if (bills && bills.length > 0) {
      console.log('📋 GASTOS ENCONTRADOS:');
      bills.forEach((bill, index) => {
        console.log(`  ${index + 1}. ${bill.description || 'Sin descripción'}:`, {
          id: bill.bill_ID,
          amount: bill.amount,
          amount_cordobas: bill.amount_cordobas,
          amount_usd: bill.amount_usd,
          currency: bill.currency_used,
          is_processed: bill.is_processed_in_closing,
          daily_id: bill.processed_in_daily_closing_ID,
          is_recurrent: bill.is_recurrent
        });
      });
    } else {
      console.log('⚠️ No se encontraron gastos en la base de datos para esta fecha');
      
      // Verificar si hay gastos en la fecha sin importar el cierre
      const { data: checkBills, error: checkError } = await supabaseAdmin
        .from('bills')
        .select('count')
        .eq('bill_date', closing.closing_date);
      
      if (!checkError && checkBills) {
        console.log(`📊 Total de gastos en la fecha ${closing.closing_date}: ${checkBills.length}`);
      }
    }
    
    // Calcular totales de procedimientos
    let totalClinicIncomeCordobas = 0;
    let totalClinicIncomeDollars = 0;
    let totalDoctorIncomeCordobas = 0;
    let totalDoctorIncomeDollars = 0;
    let totalExternalPaymentsCordobas = 0;
    let totalExternalPaymentsDollars = 0;
    
    const generalProcedures = [];
    const orthoProcedures = [];
    
    if (procedureRelations) {
      procedureRelations.forEach(relation => {
        const proc = relation.procedures;
        if (!proc) return;
        
        const clinicCordobas = parseFloat(relation.clinic_income_portion || proc.clinic_payment_cordobas) || 0;
        const clinicDollars = parseFloat(proc.clinic_payment_dollars) || 0;
        const doctorCordobas = parseFloat(relation.doctor_income_portion || proc.doctor_payment_cordobas) || 0;
        const doctorDollars = parseFloat(proc.doctor_payment_dollars) || 0;
        const externalCordobas = parseFloat(relation.external_doctor_payment || proc.external_doctor_payment) || 0;
        const externalDollars = parseFloat(proc.external_doctor_payment_usd) || 0;
        
        totalClinicIncomeCordobas += clinicCordobas;
        totalClinicIncomeDollars += clinicDollars;
        totalDoctorIncomeCordobas += doctorCordobas;
        totalDoctorIncomeDollars += doctorDollars;
        totalExternalPaymentsCordobas += externalCordobas;
        totalExternalPaymentsDollars += externalDollars;
        
        const procedureData = {
          ...proc,
          clinic_amount: clinicCordobas,
          clinic_amount_usd: clinicDollars,
          doctor_amount: doctorCordobas,
          doctor_amount_usd: doctorDollars,
          external_payment: externalCordobas,
          external_payment_usd: externalDollars
        };
        
        if (proc.is_orthodontics) {
          orthoProcedures.push(procedureData);
        } else {
          generalProcedures.push(procedureData);
        }
      });
    }
    
    // Calcular gastos - AHORA USA LOS DATOS REALES
    let totalExpensesCordobas = 0;
    let totalExpensesDollars = 0;
    
    if (bills && bills.length > 0) {
      bills.forEach(bill => {
        // Intentar diferentes campos posibles para el monto
        const amountCordobas = parseFloat(
          bill.amount_cordobas || 
          bill.amount || 
          (bill.currency_used === 'NIO' ? bill.amount : bill.amount_usd * (bill.exchange_rate_bill || 36.5))
        ) || 0;
        
        const amountDollars = parseFloat(
          bill.amount_usd || 
          bill.amount_dollars || 
          (bill.currency_used === 'USD' ? bill.amount : amountCordobas / 36.5)
        ) || 0;
        
        totalExpensesCordobas += amountCordobas;
        totalExpensesDollars += amountDollars;
      });
    }
    
    // SIEMPRE usar los gastos del cierre como respaldo
    if (totalExpensesCordobas === 0 && closing.total_variable_expenses > 0) {
      console.log('⚠️ Usando gastos del cierre como respaldo:', closing.total_variable_expenses);
      totalExpensesCordobas = closing.total_variable_expenses || 0;
      totalExpensesDollars = closing.total_variable_expenses / 36.5 || 0;
    }
    
    const netProfitCordobas = totalClinicIncomeCordobas - totalExpensesCordobas;
    const netProfitDollars = totalClinicIncomeDollars - totalExpensesDollars;
    
    console.log('💰 RESUMEN FINANCIERO:');
    console.log('   Ingresos Clínica:', formatCurrency(totalClinicIncomeCordobas, 'NIO'));
    console.log('   Gastos:', formatCurrency(totalExpensesCordobas, 'NIO'));
    console.log('   Utilidad Neta:', formatCurrency(netProfitCordobas, 'NIO'));
    
    // Crear workbook de Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Care U Smile';
    workbook.created = new Date();
    
    // =========== HOJA 1: RESUMEN ===========
    const summarySheet = workbook.addWorksheet('RESUMEN');
    
    summarySheet.columns = [
      { header: 'DESCRIPCIÓN', key: 'desc', width: 40 },
      { header: 'MONTO C$', key: 'cordobas', width: 20 },
      { header: 'MONTO $', key: 'dollars', width: 20 }
    ];
    
    // Título
    const titleRow = summarySheet.addRow(['CARE U SMILE', '', '']);
    titleRow.font = { bold: true, size: 16 };
    titleRow.alignment = { horizontal: 'center' };
    summarySheet.mergeCells('A1:C1');
    
    summarySheet.addRow(['REPORTE DE CIERRE DIARIO', '', '']);
    summarySheet.mergeCells('A2:C2');
    
    const fechaTitulo = formatNicaraguaDate(closing.closing_date);
    const tipoTitulo = closing.closing_type === 'orthodontics' ? 'ORTODONCIA' : 'GENERAL';
    summarySheet.addRow([`Fecha: ${fechaTitulo} - ${tipoTitulo}`, '', '']);
    summarySheet.mergeCells('A3:C3');
    
    if (closing.comentary) {
      summarySheet.addRow([`Nota: ${closing.comentary}`, '', '']);
      summarySheet.mergeCells('A4:C4');
    }
    
    summarySheet.addRow([]);
    
    // INGRESOS
    const incomeHeader = summarySheet.addRow(['INGRESOS', '', '']);
    incomeHeader.font = { bold: true, size: 12 };
    incomeHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F5E9' }
    };
    summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
    
    const incomeTableHeader = summarySheet.addRow(['Procedimiento', 'Ganancia C$', 'Ganancia $']);
    incomeTableHeader.font = { bold: true };
    incomeTableHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };
    incomeTableHeader.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    
    // Procedimientos generales
    if (generalProcedures.length > 0) {
      summarySheet.addRow(['GENERALES:', '', '']);
      
      generalProcedures.forEach(proc => {
        const patientName = proc.patients ? 
          `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
          'Sin paciente';
        const procDesc = proc.procedure_description || 'Procedimiento';
        
        summarySheet.addRow([
          `${procDesc} - ${patientName}`,
          proc.clinic_amount || 0,
          proc.clinic_amount_usd || 0
        ]);
      });
      summarySheet.addRow([]);
    }
    
    // Procedimientos ortodoncia
    if (orthoProcedures.length > 0) {
      summarySheet.addRow(['ORTODONCIA:', '', '']);
      
      orthoProcedures.forEach(proc => {
        const patientName = proc.patients ? 
          `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
          'Sin paciente';
        const procDesc = proc.procedure_description || 'Ortodoncia';
        
        summarySheet.addRow([
          `${procDesc} - ${patientName}`,
          proc.clinic_amount || 0,
          proc.clinic_amount_usd || 0
        ]);
        
        // Fila de desglose
        summarySheet.addRow([
          `  └─ Doctora (60%)`,
          proc.doctor_amount || 0,
          proc.doctor_amount_usd || 0
        ]);
      });
      summarySheet.addRow([]);
    }
    
    // Subtotal ingresos
    const subtotalRow = summarySheet.addRow(['SUBTOTAL INGRESOS CLÍNICA', totalClinicIncomeCordobas, totalClinicIncomeDollars]);
    subtotalRow.font = { bold: true };
    subtotalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F8E9' }
    };
    
    summarySheet.addRow([]);
    
    // GASTOS VARIABLES - AHORA SIEMPRE SE MUESTRAN CORRECTAMENTE
    const expensesHeader = summarySheet.addRow(['GASTOS VARIABLES', '', '']);
    expensesHeader.font = { bold: true, size: 12 };
    expensesHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF3E0' }
    };
    summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
    
    if (bills && bills.length > 0) {
      const expensesTableHeader = summarySheet.addRow(['Descripción', 'Monto C$', 'Monto $']);
      expensesTableHeader.font = { bold: true };
      expensesTableHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF9800' }
      };
      expensesTableHeader.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      
      bills.forEach(bill => {
        const desc = bill.description || 'Gasto variable';
        const amountCordobas = parseFloat(bill.amount_cordobas || bill.amount || 0);
        const amountDollars = parseFloat(bill.amount_usd || bill.amount_dollars || 0);
        
        summarySheet.addRow([desc, amountCordobas, amountDollars]);
      });
    } else {
      summarySheet.addRow(['No hay gastos variables en este día', 0, 0]);
    }
    
    summarySheet.addRow([]);
    
    const totalExpensesRow = summarySheet.addRow(['TOTAL GASTOS', totalExpensesCordobas, totalExpensesDollars]);
    totalExpensesRow.font = { bold: true };
    totalExpensesRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFE0B2' }
    };
    
    summarySheet.addRow([]);
    
    // DOCTORES EXTERNOS
    if (totalExternalPaymentsCordobas > 0) {
      const externalHeader = summarySheet.addRow(['PAGOS A DOCTORES EXTERNOS', '', '']);
      externalHeader.font = { bold: true, size: 12 };
      externalHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3E5F5' }
      };
      summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      
      summarySheet.addRow(['Total pagado:', totalExternalPaymentsCordobas, totalExternalPaymentsDollars]);
      summarySheet.addRow(['(Ya deducido de las ganancias)', '', '']);
      summarySheet.addRow([]);
    }
    
    // RESULTADO FINAL
    const resultHeader = summarySheet.addRow(['RESULTADO FINAL', '', '']);
    resultHeader.font = { bold: true, size: 12 };
    resultHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3E5F5' }
    };
    summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
    
    summarySheet.addRow(['Ingresos Clínica:', totalClinicIncomeCordobas, totalClinicIncomeDollars]);
    summarySheet.addRow(['Gastos:', -totalExpensesCordobas, -totalExpensesDollars]);
    summarySheet.addRow([]);
    
    const netProfitRow = summarySheet.addRow(['UTILIDAD NETA CLÍNICA', netProfitCordobas, netProfitDollars]);
    netProfitRow.font = { bold: true, size: 12 };
    netProfitRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD1C4E9' }
    };
    
    if (netProfitCordobas >= 0) {
      netProfitRow.getCell(2).font = { color: { argb: 'FF4CAF50' }, bold: true };
      netProfitRow.getCell(3).font = { color: { argb: 'FF4CAF50' }, bold: true };
    } else {
      netProfitRow.getCell(2).font = { color: { argb: 'FFF44336' }, bold: true };
      netProfitRow.getCell(3).font = { color: { argb: 'FFF44336' }, bold: true };
    }
    
    // Margen
    if (totalClinicIncomeCordobas > 0) {
      const profitMargin = ((netProfitCordobas / totalClinicIncomeCordobas) * 100).toFixed(2);
      summarySheet.addRow([]);
      summarySheet.addRow([`Margen de Utilidad: ${profitMargin}%`, '', '']);
    }
    
    // Aplicar formato de moneda
    summarySheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (rowNumber > 5 && typeof cell.value === 'number') {
          if (colNumber === 2) {
            cell.numFmt = '"C$"#,##0.00';
          }
          if (colNumber === 3) {
            cell.numFmt = '"$"#,##0.00';
          }
        }
      });
    });
    
    // =========== HOJA 2: DETALLE ===========
    if (generalProcedures.length > 0 || orthoProcedures.length > 0) {
      const detailSheet = workbook.addWorksheet('DETALLE');
      
      detailSheet.columns = [
        { header: 'Fecha', key: 'date', width: 15 },
        { header: 'Paciente', key: 'patient', width: 30 },
        { header: 'Procedimiento', key: 'procedure', width: 40 },
        { header: 'Tipo', key: 'type', width: 15 },
        { header: 'Clínica C$', key: 'clinic_cordobas', width: 18 },
        { header: 'Clínica $', key: 'clinic_dollars', width: 18 },
        { header: 'Doctora C$', key: 'doctor_cordobas', width: 15 },
        { header: 'Doctora $', key: 'doctor_dollars', width: 15 }
      ];
      
      const detailHeader = detailSheet.getRow(1);
      detailHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      detailHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2196F3' }
      };
      
      const allProcedures = [...generalProcedures, ...orthoProcedures];
      allProcedures.forEach(proc => {
        const patientName = proc.patients ? 
          `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
          'Sin paciente';
        const fecha = proc.procedure_date ? formatNicaraguaDate(proc.procedure_date) : '';
        const tipo = proc.is_orthodontics ? 'Ortodoncia' : 'General';
        
        detailSheet.addRow({
          date: fecha,
          patient: patientName,
          procedure: proc.procedure_description || 'Sin descripción',
          type: tipo,
          clinic_cordobas: proc.clinic_amount || 0,
          clinic_dollars: proc.clinic_amount_usd || 0,
          doctor_cordobas: proc.doctor_amount || 0,
          doctor_dollars: proc.doctor_amount_usd || 0
        });
      });
    }
    
    // Configurar respuesta
    const fileName = `Cierre_Diario_${fechaTitulo.replace(/\//g, '-')}_${tipoTitulo}_Detallado_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('❌ Error al exportar Excel diario detallado:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al generar Excel diario detallado: ' + error.message 
    });
  }
},

  // Exportar cierre diario a Excel (versión simplificada)
  exportDailyToExcel: async (req, res) => {
    try {
      const { closingId } = req.params;
      
      if (!closingId) {
        return res.status(400).json({ 
          success: false, 
          error: 'ID de cierre requerido' 
        });
      }
      
      const { data: closing, error: closingError } = await supabaseAdmin
        .from('daily_closings')
        .select('*')
        .eq('daily_closing_id', closingId)
        .single();
      
      if (closingError) throw closingError;
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Cierre Diario');
      
      worksheet.columns = [
        { header: 'Fecha', key: 'date', width: 15 },
        { header: 'Tipo', key: 'type', width: 15 },
        { header: 'Ingresos C$', key: 'income_cordobas', width: 18 },
        { header: 'Ingresos $', key: 'income_dollars', width: 18 },
        { header: 'Gastos C$', key: 'expenses_cordobas', width: 18 },
        { header: 'Gastos $', key: 'expenses_dollars', width: 18 },
        { header: 'Utilidad C$', key: 'profit_cordobas', width: 18 },
        { header: 'Utilidad $', key: 'profit_dollars', width: 18 },
        { header: 'Comentarios', key: 'comentary', width: 30 }
      ];
      
      const exchangeRate = 36.5;
      
      worksheet.addRow({
        date: formatNicaraguaDate(closing.closing_date),
        type: closing.closing_type === 'orthodontics' ? 'Ortodoncia' : 'General',
        income_cordobas: closing.total_clinic_income || 0,
        income_dollars: (closing.total_clinic_income || 0) / exchangeRate,
        expenses_cordobas: closing.total_variable_expenses || 0,
        expenses_dollars: (closing.total_variable_expenses || 0) / exchangeRate,
        profit_cordobas: closing.net_profit || 0,
        profit_dollars: (closing.net_profit || 0) / exchangeRate,
        comentary: closing.comentary || ''
      });
      
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2196F3' }
      };
      worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
      
      const fileName = `Cierre_Diario_${formatNicaraguaDate(closing.closing_date).replace(/\//g, '-')}_${closing.closing_type}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      await workbook.xlsx.write(res);
      res.end();
      
    } catch (error) {
      console.error('Error al exportar Excel diario:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al generar Excel diario: ' + error.message 
      });
    }
  },

  // Exportar cierre diario a PDF
  exportDailyPDF: async (req, res) => {
    try {
      const { closingId } = req.params;
      
      if (!closingId) {
        return res.status(400).json({ 
          success: false, 
          error: 'ID de cierre requerido' 
        });
      }
      
      const { data: closing, error: closingError } = await supabaseAdmin
        .from('daily_closings')
        .select('*')
        .eq('daily_closing_id', closingId)
        .single();
      
      if (closingError) throw closingError;
      
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      
      res.setHeader('Content-Type', 'application/pdf');
      const fileName = `Cierre_Diario_${formatNicaraguaDate(closing.closing_date).replace(/\//g, '-')}_${closing.closing_type}_${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      doc.pipe(res);
      
      // Logo
      try {
        const possiblePaths = [
          path.join(__dirname, '../../frontend/public/2026web2.png'),
          path.join(process.cwd(), 'frontend/public/2026web2.png')
        ];
        
        for (const testPath of possiblePaths) {
          if (fs.existsSync(testPath)) {
            doc.image(testPath, 50, 45, { width: 80 });
            break;
          }
        }
      } catch (logoError) {}
      
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#2196F3')
         .text('CARE U SMILE', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(16).font('Helvetica-Bold')
         .text('REPORTE DE CIERRE DIARIO', { align: 'center' });
      doc.moveDown(0.5);
      
      const fechaTitulo = formatNicaraguaDate(closing.closing_date);
      const tipoTitulo = closing.closing_type === 'orthodontics' ? 'ORTODONCIA' : 'GENERAL';
      doc.fontSize(14).text(`Fecha: ${fechaTitulo} - ${tipoTitulo}`, { align: 'center' });
      doc.moveDown(1);
      
      doc.fontSize(10).text(`Fecha de generación: ${formatNicaraguaDateTime(new Date().toISOString())}`, { align: 'right' });
      doc.moveDown(1.5);
      
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#4CAF50')
         .text('RESUMEN DEL DÍA', { underline: true });
      doc.moveDown(0.5);
      
      const exchangeRate = 36.5;
      doc.fontSize(12).font('Helvetica')
         .text(`Total Ingresos Clínica: ${formatCurrency(closing.total_clinic_income || 0, 'NIO')} / ${formatCurrency((closing.total_clinic_income || 0) / exchangeRate, 'USD')}`);
      doc.moveDown(0.3);
      
      if (closing.total_variable_expenses > 0) {
        doc.text(`Gastos Variables: ${formatCurrency(closing.total_variable_expenses || 0, 'NIO')} / ${formatCurrency((closing.total_variable_expenses || 0) / exchangeRate, 'USD')}`);
        doc.moveDown(0.3);
      }
      
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica-Bold')
         .fillColor(closing.net_profit >= 0 ? '#4CAF50' : '#F44336')
         .text(`UTILIDAD NETA: ${formatCurrency(closing.net_profit || 0, 'NIO')} / ${formatCurrency((closing.net_profit || 0) / exchangeRate, 'USD')}`);
      
      if (closing.comentary) {
        doc.moveDown(1);
        doc.fontSize(11).font('Helvetica-Oblique').fillColor('#666')
           .text(`Nota: ${closing.comentary}`);
      }
      
      doc.end();
      
    } catch (error) {
      console.error('Error al exportar PDF diario:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al generar PDF diario: ' + error.message 
      });
    }
  }
};

export default exportDailyController;