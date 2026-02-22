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

// Funciones auxiliares
function getMonthNumber(month) {
  const months = {
    'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04',
    'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08',
    'SEPTIEMBRE': '09', 'OCTUBRE': '10', 'NOVIEMBRE': '11', 'DICIEMBRE': '12'
  };
  return months[month.toUpperCase()] || '01';
}

function getLastDayOfMonth(year, month) {
  const monthNumber = getMonthNumber(month);
  const lastDay = new Date(parseInt(year), parseInt(monthNumber), 0).getDate();
  return `${year}-${monthNumber}-${lastDay}`;
}

const exportController = {
  exportMonthlyPDF: async (req, res) => {
  try {
    const { closingId } = req.params;

    const { data: closing } = await supabaseAdmin
      .from('monthly_closings')
      .select('*')
      .eq('closing_ID', closingId)
      .single();

    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('exchange_rate')
      .order('setting_ID', { ascending: false })
      .limit(1)
      .single();

    const exchangeRate = settings?.exchange_rate || 36.5;

    const periodStartDate = `${closing.year}-${getMonthNumber(closing.month)}-01`;
    const periodEndDate = getLastDayOfMonth(closing.year, closing.month);

    const { data: procedures } = await supabaseAdmin
      .from('procedures')
      .select(`*, patients (first_name, first_last_name)`)
      .gte('procedure_date', `${periodStartDate}T00:00:00`)
      .lte('procedure_date', `${periodEndDate}T23:59:59`)
      .order('procedure_date', { ascending: true });

    const { data: bills } = await supabaseAdmin
      .from('bills')
      .select('*')
      .gte('bill_date', periodStartDate)
      .lte('bill_date', periodEndDate)
      .order('bill_date', { ascending: true });

    let totalGeneralCord = 0;
    let totalGeneralUsd = 0;
    let totalOrthoCord = 0;
    let totalOrthoUsd = 0;

    const general = [];
    const ortho = [];

    procedures?.forEach(proc => {
      const cord = parseFloat(proc.clinic_payment_cordobas) || 0;
      const usd = parseFloat(proc.clinic_payment_dollars) || 0;

      if (proc.is_orthodontics) {
        totalOrthoCord += cord;
        totalOrthoUsd += usd;
        ortho.push({ ...proc, cord, usd });
      } else {
        totalGeneralCord += cord;
        totalGeneralUsd += usd;
        general.push({ ...proc, cord, usd });
      }
    });

    const fixedBills = bills?.filter(b => b.is_recurrent) || [];
    const variableBills = bills?.filter(b => !b.is_recurrent) || [];

    const totalFixed = fixedBills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
    const totalVariable = variableBills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
    const totalExpenses = totalFixed + totalVariable;

    const totalIncome = totalGeneralCord + totalOrthoCord;
    const netProfit = totalIncome - totalExpenses;

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="Cierre_${closing.month}_${closing.year}.pdf"`);

    doc.pipe(res);

    // LOGO
    const logoPath = path.join(process.cwd(), 'frontend/public/2026web2.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 70 });
    }

    doc.moveDown(2);

    doc.fontSize(20).font('Helvetica-Bold').fillColor('#2196F3')
      .text('CARE U SMILE', { align: 'center' });

    doc.moveDown(0.3);

    doc.fontSize(14).fillColor('#000')
      .text(`REPORTE DE CIERRE MENSUAL - ${closing.month} ${closing.year}`, { align: 'center' });

    doc.moveDown(2);

    const startX = 50;
    const col1 = 270;
    const col2 = 90;
    const col3 = 90;

    const drawRow = (desc, cord, usd, bold = false, color = '#000') => {
      const y = doc.y;

      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
         .fillColor(color)
         .fontSize(9);

      const h = Math.max(
        doc.heightOfString(desc, { width: col1 }),
        doc.heightOfString(cord, { width: col2 }),
        doc.heightOfString(usd, { width: col3 })
      );

      doc.text(desc, startX, y, { width: col1 });
      doc.text(cord, startX + col1 + 10, y, { width: col2, align: 'right' });
      doc.text(usd, startX + col1 + col2 + 20, y, { width: col3, align: 'right' });

      doc.y = y + h + 4;
    };

    // =====================
    // PROCEDIMIENTOS GENERALES
    // =====================

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000')
      .text('PROCEDIMIENTOS GENERALES', { align: 'left' });

    doc.moveDown();

    general.forEach((p, i) => {
      const date = new Date(p.procedure_date).toLocaleDateString();
      const patient = p.patients
        ? `${p.patients.first_name} ${p.patients.first_last_name}`
        : 'Sin paciente';

      drawRow(
        `${i + 1}. ${date} - ${p.procedure_description} - ${patient}`,
        formatCurrency(p.cord, 'NIO'),
        formatCurrency(p.usd, 'USD')
      );
    });

    drawRow(
      'SUBTOTAL GENERALES',
      formatCurrency(totalGeneralCord, 'NIO'),
      formatCurrency(totalGeneralUsd, 'USD'),
      true
    );

    doc.moveDown(2);

    // =====================
    // ORTODONCIA
    // =====================

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000')
      .text('ORTODONCIA', { align: 'left' });

    doc.moveDown();

    ortho.forEach((p, i) => {
      const date = new Date(p.procedure_date).toLocaleDateString();
      const patient = p.patients
        ? `${p.patients.first_name} ${p.patients.first_last_name}`
        : 'Sin paciente';

      drawRow(
        `${i + 1}. ${date} - ${p.procedure_description} - ${patient}`,
        formatCurrency(p.cord, 'NIO'),
        formatCurrency(p.usd, 'USD')
      );
    });

    drawRow(
      'SUBTOTAL ORTODONCIA',
      formatCurrency(totalOrthoCord, 'NIO'),
      formatCurrency(totalOrthoUsd, 'USD'),
      true
    );

    doc.moveDown(2);

    // =====================
    // GASTOS
    // =====================

    doc.fontSize(14).font('Helvetica-Bold')
      .text('GASTOS DEL PERÍODO', { align: 'left' });

    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Gastos Fijos');
    doc.moveDown(0.5);

    fixedBills.forEach((b, i) => {
      const date = new Date(b.bill_date).toLocaleDateString();
      drawRow(
        `${i + 1}. ${date} - ${b.description} (${b.category})`,
        `-${formatCurrency(b.amount, 'NIO')}`,
        `-${formatCurrency(b.amount / exchangeRate, 'USD')}`
      );
    });

    drawRow(
      'TOTAL GASTOS FIJOS',
      `-${formatCurrency(totalFixed, 'NIO')}`,
      `-${formatCurrency(totalFixed / exchangeRate, 'USD')}`,
      true
    );

    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('Gastos Variables');
    doc.moveDown(0.5);

    variableBills.forEach((b, i) => {
      const date = new Date(b.bill_date).toLocaleDateString();
      drawRow(
        `${i + 1}. ${date} - ${b.description} (${b.category})`,
        `-${formatCurrency(b.amount, 'NIO')}`,
        `-${formatCurrency(b.amount / exchangeRate, 'USD')}`
      );
    });

    drawRow(
      'TOTAL GASTOS VARIABLES',
      `-${formatCurrency(totalVariable, 'NIO')}`,
      `-${formatCurrency(totalVariable / exchangeRate, 'USD')}`,
      true
    );

    doc.moveDown(2);

    // =====================
    // RESULTADO
    // =====================

    doc.fontSize(14).font('Helvetica-Bold')
      .text('RESULTADO', { align: 'left' });

    doc.moveDown();

    drawRow(
      'INGRESOS TOTALES',
      formatCurrency(totalIncome, 'NIO'),
      formatCurrency(totalIncome / exchangeRate, 'USD'),
      true
    );

    drawRow(
      'GASTOS TOTALES',
      `-${formatCurrency(totalExpenses, 'NIO')}`,
      `-${formatCurrency(totalExpenses / exchangeRate, 'USD')}`,
      true
    );

    drawRow(
      'UTILIDAD NETA',
      formatCurrency(netProfit, 'NIO'),
      formatCurrency(netProfit / exchangeRate, 'USD'),
      true,
      netProfit >= 0 ? '#2E7D32' : '#C62828'
    );

    doc.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar PDF' });
  }
},

  // Exportar cierre mensual a Excel detallado - VERSIÓN CORREGIDA
exportMonthlyToExcelDetailed: async (req, res) => {
  try {
    const { closingId } = req.params;
    
    if (!closingId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID de cierre requerido' 
      });
    }
    
    console.log('🔍 Exportando cierre mensual detallado ID:', closingId);
    
    // Obtener cierre mensual
    const { data: closing, error: closingError } = await supabaseAdmin
      .from('monthly_closings')
      .select('*')
      .eq('closing_ID', closingId)
      .single();
    
    if (closingError) throw closingError;
    
    // Obtener configuración
    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('exchange_rate, clinic_payment, doctor_payment')
      .order('setting_ID', { ascending: false })
      .limit(1)
      .single();
    
    const exchangeRate = settings?.exchange_rate || 36.5;
    const clinicPercentage = settings?.clinic_payment || 40;
    const doctorPercentage = settings?.doctor_payment || 60;
    
    // Obtener procedimientos del período
    const periodStartDate = `${closing.year}-${getMonthNumber(closing.month)}-01`;
    const periodEndDate = getLastDayOfMonth(closing.year, closing.month);
    
    const { data: procedures, error: proceduresError } = await supabaseAdmin
      .from('procedures')
      .select(`
        *,
        patients (first_name, first_last_name)
      `)
      .gte('procedure_date', `${periodStartDate}T00:00:00`)
      .lte('procedure_date', `${periodEndDate}T23:59:59`)
      .order('procedure_date', { ascending: true });
    
    if (proceduresError) throw proceduresError;
    
    // Obtener gastos del período
    const { data: bills, error: billsError } = await supabaseAdmin
      .from('bills')
      .select('*')
      .gte('bill_date', periodStartDate)
      .lte('bill_date', periodEndDate)
      .order('bill_date', { ascending: true });
    
    if (billsError && billsError.code !== 'PGRST116') throw billsError;
    
    // Calcular totales
    let totalGeneralCordobas = 0;
    let totalGeneralDollars = 0;
    let totalOrthoClinicCordobas = 0;
    let totalOrthoClinicDollars = 0;
    let totalOrthoDoctorCordobas = 0;
    let totalOrthoDoctorDollars = 0;
    let totalExternalPaymentsCordobas = 0;
    let totalExternalPaymentsDollars = 0;
    
    const generalProcedures = [];
    const orthoProcedures = [];
    
    if (procedures) {
      procedures.forEach(proc => {
        const clinicCordobas = parseFloat(proc.clinic_payment_cordobas) || 0;
        const clinicDollars = parseFloat(proc.clinic_payment_dollars) || 0;
        const doctorCordobas = parseFloat(proc.doctor_payment_cordobas) || 0;
        const doctorDollars = parseFloat(proc.doctor_payment_dollars) || 0;
        const externalCordobas = parseFloat(proc.external_doctor_payment) || 0;
        const externalDollars = parseFloat(proc.external_doctor_payment_usd) || 0;
        
        if (proc.is_orthodontics) {
          totalOrthoClinicCordobas += clinicCordobas;
          totalOrthoClinicDollars += clinicDollars;
          totalOrthoDoctorCordobas += doctorCordobas;
          totalOrthoDoctorDollars += doctorDollars;
          
          orthoProcedures.push({
            ...proc,
            clinic_amount: clinicCordobas,
            clinic_amount_usd: clinicDollars,
            doctor_amount: doctorCordobas,
            doctor_amount_usd: doctorDollars,
            external_payment: externalCordobas,
            external_payment_usd: externalDollars
          });
        } else {
          totalGeneralCordobas += clinicCordobas;
          totalGeneralDollars += clinicDollars;
          
          generalProcedures.push({
            ...proc,
            clinic_amount: clinicCordobas,
            clinic_amount_usd: clinicDollars,
            external_payment: externalCordobas,
            external_payment_usd: externalDollars
          });
        }
        
        totalExternalPaymentsCordobas += externalCordobas;
        totalExternalPaymentsDollars += externalDollars;
      });
    }
    
    // Calcular gastos
    const fixedBills = bills ? bills.filter(bill => bill.is_recurrent) : [];
    const variableBills = bills ? bills.filter(bill => !bill.is_recurrent) : [];
    
    let totalFixedCordobas = 0;
    let totalFixedDollars = 0;
    let totalVariableCordobas = 0;
    let totalVariableDollars = 0;
    
    fixedBills.forEach(bill => {
      totalFixedCordobas += parseFloat(bill.amount_cordobas || bill.amount) || 0;
      totalFixedDollars += parseFloat(bill.amount_usd || bill.amount_dollars) || 0;
    });
    
    variableBills.forEach(bill => {
      totalVariableCordobas += parseFloat(bill.amount_cordobas || bill.amount) || 0;
      totalVariableDollars += parseFloat(bill.amount_usd || bill.amount_dollars) || 0;
    });
    
    const totalExpensesCordobas = totalFixedCordobas + totalVariableCordobas;
    const totalExpensesDollars = totalFixedDollars + totalVariableDollars;
    
    // 🔴 CORREGIDO: Definir todas las variables necesarias
    const totalClinicIncomeCordobas = totalGeneralCordobas + totalOrthoClinicCordobas;
    const totalClinicIncomeDollars = totalGeneralDollars + totalOrthoClinicDollars;
    const netProfitCordobas = totalClinicIncomeCordobas - totalExpensesCordobas;
    const netProfitDollars = totalClinicIncomeDollars - totalExpensesDollars;
    
    // Crear workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Care U Smile';
    workbook.created = new Date();
    
    // =========== HOJA 1: RESUMEN ===========
    const summarySheet = workbook.addWorksheet('RESUMEN MENSUAL');
    
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
    
    summarySheet.addRow(['REPORTE DE CIERRE MENSUAL', '', '']);
    summarySheet.mergeCells('A2:C2');
    
    const tipoTexto = closing.closing_type === 'all' ? 'COMPLETO' : 
                     (closing.closing_type === 'orthodontics' ? 'ORTODONCIA' : 'GENERAL');
    
    summarySheet.addRow([`${closing.month} ${closing.year} - ${tipoTexto}`, '', '']);
    summarySheet.mergeCells('A3:C3');
    
    if (closing.comentary) {
      summarySheet.addRow([`Nota: ${closing.comentary}`, '', '']);
      summarySheet.mergeCells('A4:C4');
    }
    
    summarySheet.addRow([]);
    
    // INGRESOS
    const incomeHeader = summarySheet.addRow(['INGRESOS CLÍNICA', '', '']);
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
    
    // Generales
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
    
    // Ortodoncia
    if (orthoProcedures.length > 0) {
      summarySheet.addRow(['ORTODONCIA:', '', '']);
      
      orthoProcedures.forEach(proc => {
        const patientName = proc.patients ? 
          `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
          'Sin paciente';
        const procDesc = proc.procedure_description || 'Ortodoncia';
        
        summarySheet.addRow([
          `${procDesc} - ${patientName} (Clínica ${clinicPercentage}%)`,
          proc.clinic_amount || 0,
          proc.clinic_amount_usd || 0
        ]);
        
        summarySheet.addRow([
          `  └─ Doctora (${doctorPercentage}%)`,
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
    
    // GASTOS
    if (bills && bills.length > 0) {
      const expensesHeader = summarySheet.addRow(['GASTOS', '', '']);
      expensesHeader.font = { bold: true, size: 12 };
      expensesHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF3E0' }
      };
      summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      
      const expensesTableHeader = summarySheet.addRow(['Descripción', 'Monto C$', 'Monto $']);
      expensesTableHeader.font = { bold: true };
      expensesTableHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF9800' }
      };
      expensesTableHeader.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      
      if (fixedBills.length > 0) {
        summarySheet.addRow(['GASTOS FIJOS:', '', '']);
        fixedBills.forEach(bill => {
          const desc = bill.description || 'Gasto fijo';
          const amountCordobas = parseFloat(bill.amount_cordobas || bill.amount) || 0;
          const amountDollars = parseFloat(bill.amount_usd || bill.amount_dollars) || 0;
          
          summarySheet.addRow([desc, amountCordobas, amountDollars]);
        });
      }
      
      if (variableBills.length > 0) {
        summarySheet.addRow(['GASTOS VARIABLES:', '', '']);
        variableBills.forEach(bill => {
          const desc = bill.description || 'Gasto variable';
          const amountCordobas = parseFloat(bill.amount_cordobas || bill.amount) || 0;
          const amountDollars = parseFloat(bill.amount_usd || bill.amount_dollars) || 0;
          
          summarySheet.addRow([desc, amountCordobas, amountDollars]);
        });
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
    } else {
      // Aún así mostrar sección de gastos aunque esté vacía
      const expensesHeader = summarySheet.addRow(['GASTOS', '', '']);
      expensesHeader.font = { bold: true, size: 12 };
      expensesHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF3E0' }
      };
      summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      summarySheet.addRow(['No hay gastos en el período', 0, 0]);
      summarySheet.addRow([]);
    }
    
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
      fgColor: { argb: 'FFD1C4E9' }
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
    
    const fileName = `Cierre_${closing.month}_${closing.year}_Detallado_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('❌ Error al exportar Excel mensual detallado:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al generar Excel mensual detallado: ' + error.message 
    });
  }
},

  // Exportar a Excel general
  exportToExcel: async (req, res) => {
    try {
      const { type, startDate, endDate } = req.query;
      
      if (!type) {
        return res.status(400).json({ 
          success: false, 
          error: 'Tipo de exportación requerido' 
        });
      }
      
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Care U Smile';
      workbook.created = new Date();
      
      let worksheet;
      let fileName = '';
      
      if (type === 'monthly') {
        worksheet = workbook.addWorksheet('Cierres Mensuales');
        fileName = `Cierres_Mensuales_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        const { data: closings, error } = await supabaseAdmin
          .from('monthly_closings')
          .select('*')
          .order('year', { ascending: false })
          .order('month', { ascending: false });
        
        if (error) throw error;
        
        worksheet.columns = [
          { header: 'Mes', key: 'month', width: 15 },
          { header: 'Año', key: 'year', width: 10 },
          { header: 'Fecha Cierre', key: 'closing_date', width: 15 },
          { header: 'Ingresos Clínica C$', key: 'clinic_income', width: 20 },
          { header: 'Gastos C$', key: 'expenses', width: 18 },
          { header: 'Utilidad Neta C$', key: 'net_profit', width: 18 }
        ];
        
        closings.forEach(closing => {
          const clinicIncome = (closing.total_general_income || 0) + (closing.total_clinical_orthodontic_income || 0);
          const expenses = (closing.total_fixed_expenses || 0) + (closing.total_variable_expenses || 0);
          
          worksheet.addRow({
            month: closing.month,
            year: closing.year,
            closing_date: formatNicaraguaDate(closing.closing_date),
            clinic_income: clinicIncome,
            expenses: expenses,
            net_profit: closing.net_profit || 0
          });
        });
        
      } else if (type === 'daily') {
        worksheet = workbook.addWorksheet('Cierres Diarios');
        fileName = `Cierres_Diarios_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        let query = supabaseAdmin
          .from('daily_closings')
          .select('*')
          .order('closing_date', { ascending: false });
        
        if (startDate && endDate) {
          query = query.gte('closing_date', startDate).lte('closing_date', endDate);
        }
        
        const { data: closings, error } = await query;
        if (error) throw error;
        
        worksheet.columns = [
          { header: 'Fecha', key: 'closing_date', width: 15 },
          { header: 'Tipo', key: 'closing_type', width: 15 },
          { header: 'Ingresos Clínica C$', key: 'clinic_income', width: 18 },
          { header: 'Gastos C$', key: 'expenses', width: 18 },
          { header: 'Utilidad Neta C$', key: 'net_profit', width: 18 },
          { header: 'Comentarios', key: 'comentary', width: 30 }
        ];
        
        closings.forEach(closing => {
          worksheet.addRow({
            closing_date: formatNicaraguaDate(closing.closing_date),
            closing_type: closing.closing_type === 'orthodontics' ? 'Ortodoncia' : 'General',
            clinic_income: closing.total_clinic_income || 0,
            expenses: closing.total_variable_expenses || 0,
            net_profit: closing.net_profit || 0,
            comentary: closing.comentary || ''
          });
        });
      }
      
      // Formato
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2196F3' }
      };
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          [4, 5, 6].forEach(colNumber => {
            const cell = row.getCell(colNumber);
            if (cell.value !== null && cell.value !== undefined) {
              cell.numFmt = '"C$"#,##0.00';
              if (colNumber === 6) {
                cell.font = { 
                  bold: true,
                  color: { argb: cell.value >= 0 ? 'FF4CAF50' : 'FFF44336' }
                };
              }
            }
          });
        }
      });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      await workbook.xlsx.write(res);
      res.end();
      
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al generar Excel: ' + error.message 
      });
    }
  }
};

export default exportController;