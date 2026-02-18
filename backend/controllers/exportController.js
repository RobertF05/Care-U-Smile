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

// Función auxiliar para dibujar tabla en PDF
function drawTableHeader(doc, startX, y, col1Width, col2Width, col3Width) {
  const fontSize = 10;
  
  doc.rect(startX, y, col1Width + col2Width + col3Width + 30, fontSize * 2.2)
     .fillColor('#2196F3')
     .fill();
  
  doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#FFFFFF');
  doc.text('Descripción', startX + 10, y + 8);
  doc.text('Total Córdobas', startX + col1Width + 10, y + 8, { width: col2Width, align: 'right' });
  doc.text('Total Dólares', startX + col1Width + col2Width + 20, y + 8, { width: col3Width, align: 'right' });
  
  return y + fontSize * 2.2 + 5;
}

function drawTableRow(doc, startX, y, col1Width, col2Width, col3Width, col1Text, col2Value, col3Value, isSubtotal = false) {
  const fontSize = isSubtotal ? 10 : 9;
  const fontType = isSubtotal ? 'Helvetica-Bold' : 'Helvetica';
  
  doc.fontSize(fontSize).font(fontType).fillColor('#000000');
  
  doc.text(col1Text, startX + (isSubtotal ? 0 : 10), y, { width: col1Width - (isSubtotal ? 0 : 20) });
  
  const cordobasText = typeof col2Value === 'number' ? formatCurrency(col2Value, 'NIO') : col2Value;
  doc.text(cordobasText, startX + col1Width + 10, y, { width: col2Width, align: 'right' });
  
  const dollarsText = typeof col3Value === 'number' ? formatCurrency(col3Value, 'USD') : col3Value;
  doc.text(dollarsText, startX + col1Width + col2Width + 20, y, { width: col3Width, align: 'right' });
  
  return y + fontSize * 1.5;
}

const exportController = {
  // Exportar cierre mensual a PDF con LOGO y cálculos CORREGIDOS
  exportMonthlyPDF: async (req, res) => {
    try {
      const { closingId } = req.params;
      
      if (!closingId) {
        return res.status(400).json({ 
          success: false, 
          error: 'ID de cierre requerido' 
        });
      }
      
      // Obtener cierre mensual
      const { data: closing, error: closingError } = await supabaseAdmin
        .from('monthly_closings')
        .select('*')
        .eq('closing_ID', closingId)
        .single();
      
      if (closingError) throw closingError;
      if (!closing) {
        return res.status(404).json({ success: false, error: 'Cierre no encontrado' });
      }
      
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
      
      // Separar procedimientos y calcular SOLO ganancia de clínica
      const generalProcedures = [];
      const orthoProcedures = [];
      
      let totalGeneralCordobas = 0;
      let totalGeneralDollars = 0;
      let totalOrthoClinicCordobas = 0;
      let totalOrthoClinicDollars = 0;
      let totalOrthoDoctorCordobas = 0;
      let totalOrthoDoctorDollars = 0;
      let totalExternalPaymentsCordobas = 0;
      
      if (procedures) {
        procedures.forEach(proc => {
          const clinicCordobas = parseFloat(proc.clinic_payment_cordobas) || 0;
          const clinicDollars = parseFloat(proc.clinic_payment_dollars) || 0;
          const doctorCordobas = parseFloat(proc.doctor_payment_cordobas) || 0;
          const doctorDollars = parseFloat(proc.doctor_payment_dollars) || 0;
          const externalCordobas = parseFloat(proc.external_doctor_payment) || 0;
          
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
              external_payment: externalCordobas
            });
          } else {
            totalGeneralCordobas += clinicCordobas;
            totalGeneralDollars += clinicDollars;
            
            generalProcedures.push({
              ...proc,
              clinic_amount: clinicCordobas,
              clinic_amount_usd: clinicDollars,
              external_payment: externalCordobas
            });
          }
          
          totalExternalPaymentsCordobas += externalCordobas;
        });
      }
      
      // Obtener gastos del período
      const { data: bills, error: billsError } = await supabaseAdmin
        .from('bills')
        .select('*')
        .gte('bill_date', periodStartDate)
        .lte('bill_date', periodEndDate)
        .order('bill_date', { ascending: true });
      
      if (billsError && billsError.code !== 'PGRST116') throw billsError;
      
      // Calcular totales de gastos
      const fixedBills = bills ? bills.filter(bill => bill.is_recurrent) : [];
      const variableBills = bills ? bills.filter(bill => !bill.is_recurrent) : [];
      
      const totalFixedCordobas = fixedBills.reduce((sum, b) => sum + (parseFloat(b.amount_cordobas || b.amount) || 0), 0);
      const totalVariableCordobas = variableBills.reduce((sum, b) => sum + (parseFloat(b.amount_cordobas || b.amount) || 0), 0);
      const totalExpensesCordobas = totalFixedCordobas + totalVariableCordobas;
      
      const totalClinicIncomeCordobas = totalGeneralCordobas + totalOrthoClinicCordobas;
      const netProfitCordobas = totalClinicIncomeCordobas - totalExpensesCordobas;
      
      // Crear documento PDF
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        layout: 'portrait'
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      const fileName = `Cierre_${closing.month}_${closing.year}_${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      doc.pipe(res);
      
      // =========== AGREGAR LOGO ===========
      try {
        const possiblePaths = [
          path.join(__dirname, '../../frontend/public/2026web2.png'),
          path.join(__dirname, '../../../frontend/public/2026web2.png'),
          path.join(process.cwd(), 'frontend/public/2026web2.png'),
          path.join(process.cwd(), 'public/2026web2.png')
        ];
        
        let logoPath = null;
        for (const testPath of possiblePaths) {
          if (fs.existsSync(testPath)) {
            logoPath = testPath;
            break;
          }
        }
        
        if (logoPath) {
          doc.image(logoPath, 50, 45, { width: 80 });
        }
      } catch (logoError) {
        console.log('Logo no encontrado, continuando sin logo');
      }
      
      // =========== ENCABEZADO ===========
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#2196F3')
         .text('CARE U SMILE', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000')
         .text('REPORTE DE CIERRE MENSUAL', { align: 'center' });
      doc.moveDown(0.3);
      
      const tipoTexto = closing.closing_type === 'all' ? 'COMPLETO' : 
                       (closing.closing_type === 'orthodontics' ? 'ORTODONCIA' : 'GENERAL');
      
      doc.fontSize(14).font('Helvetica')
         .text(`${closing.month} ${closing.year} - ${tipoTexto}`, { align: 'center' });
      doc.moveDown(0.5);
      
      if (closing.comentary) {
        doc.fontSize(11).font('Helvetica-Oblique')
           .text(`Nota: ${closing.comentary}`, { align: 'center' });
        doc.moveDown(0.5);
      }
      
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#CCCCCC').stroke();
      doc.moveDown(1);
      
      doc.fontSize(9).text(`Fecha de generación: ${formatNicaraguaDateTime(new Date().toISOString())}`, { align: 'right' });
      doc.moveDown(1.5);
      
      const startX = 50;
      const col1Width = 250;
      const col2Width = 100;
      const col3Width = 100;
      
      // =========== SECCIÓN PROCEDIMIENTOS GENERALES ===========
      if (generalProcedures.length > 0 || closing.closing_type !== 'orthodontics') {
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#4CAF50')
           .text('PROCEDIMIENTOS GENERALES', { underline: true });
        doc.moveDown(0.5);
        
        let currentY = drawTableHeader(doc, startX, doc.y, col1Width, col2Width, col3Width);
        doc.y = currentY;
        
        if (generalProcedures.length > 0) {
          generalProcedures.forEach((proc, index) => {
            const patientName = proc.patients ? 
              `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
              'Sin paciente';
            const procDesc = proc.procedure_description || 'Procedimiento';
            
            drawTableRow(
              doc, startX, doc.y, col1Width, col2Width, col3Width,
              `${index + 1}. ${procDesc} - ${patientName}`,
              proc.clinic_amount || 0,
              proc.clinic_amount_usd || 0
            );
          });
        } else {
          doc.fontSize(9).font('Helvetica')
             .text('No hay procedimientos generales en el período', startX + 10, doc.y);
          doc.moveDown(0.5);
        }
        
        doc.moveDown(0.3);
        doc.moveTo(startX + 10, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 20, doc.y)
           .strokeColor('#CCCCCC').stroke();
        doc.moveDown(0.3);
        
        drawTableRow(
          doc, startX, doc.y, col1Width, col2Width, col3Width,
          'SUBTOTAL GENERALES',
          totalGeneralCordobas,
          totalGeneralDollars,
          true
        );
        
        doc.moveDown(1);
      }
      
      // =========== SECCIÓN ORTODONCIA ===========
      if (orthoProcedures.length > 0 || closing.closing_type !== 'general') {
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#9C27B0')
           .text('ORTODONCIA', { underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(10).font('Helvetica-Bold')
           .text('Distribución:', startX, doc.y);
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica')
           .text(`Clínica (${clinicPercentage}%) - Doctora (${doctorPercentage}%)`, startX + 10, doc.y);
        doc.moveDown(1);
        
        let currentY = drawTableHeader(doc, startX, doc.y, col1Width, col2Width, col3Width);
        doc.y = currentY;
        
        if (orthoProcedures.length > 0) {
          orthoProcedures.forEach((proc, index) => {
            const patientName = proc.patients ? 
              `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
              'Sin paciente';
            const procDesc = proc.procedure_description || 'Ortodoncia';
            
            drawTableRow(
              doc, startX, doc.y, col1Width, col2Width, col3Width,
              `${index + 1}. ${procDesc} - ${patientName}`,
              proc.clinic_amount || 0,
              proc.clinic_amount_usd || 0
            );
            
            doc.fontSize(8).font('Helvetica')
               .text(`     └─ Doctora: ${formatCurrency(proc.doctor_amount || 0, 'NIO')} / ${formatCurrency(proc.doctor_amount_usd || 0, 'USD')}`, 
                     startX + 20, doc.y - 10);
            doc.moveDown(0.3);
          });
        } else {
          doc.fontSize(9).font('Helvetica')
             .text('No hay procedimientos de ortodoncia en el período', startX + 10, doc.y);
          doc.moveDown(0.5);
        }
        
        doc.moveDown(0.3);
        doc.moveTo(startX + 10, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 20, doc.y)
           .strokeColor('#CCCCCC').stroke();
        doc.moveDown(0.3);
        
        drawTableRow(
          doc, startX, doc.y, col1Width, col2Width, col3Width,
          'SUBTOTAL ORTODONCIA (Clínica)',
          totalOrthoClinicCordobas,
          totalOrthoClinicDollars,
          true
        );
        
        doc.moveDown(0.5);
        
        doc.fontSize(9).font('Helvetica')
           .text(`Total Doctora: ${formatCurrency(totalOrthoDoctorCordobas, 'NIO')} / ${formatCurrency(totalOrthoDoctorDollars, 'USD')}`, 
                 startX + 10, doc.y);
        doc.moveDown(1);
      }
      
      // =========== RESUMEN DE INGRESOS ===========
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2196F3')
         .text('RESUMEN DE INGRESOS', { underline: true });
      doc.moveDown(0.5);
      
      const incomeStartY = doc.y;
      doc.rect(startX - 5, incomeStartY - 5, 520, 100)
         .strokeColor('#2196F3')
         .lineWidth(1)
         .stroke();
      
      let incomeY = incomeStartY;
      
      doc.fontSize(11).font('Helvetica-Bold')
         .text('Procedimientos Generales (Clínica):', startX + 10, incomeY);
      doc.fontSize(11).font('Helvetica')
         .text(formatCurrency(totalGeneralCordobas, 'NIO'), startX + 300, incomeY);
      doc.text(formatCurrency(totalGeneralDollars, 'USD'), startX + 420, incomeY);
      incomeY += 20;
      
      doc.fontSize(11).font('Helvetica-Bold')
         .text('Ortodoncia (Clínica):', startX + 10, incomeY);
      doc.fontSize(11).font('Helvetica')
         .text(formatCurrency(totalOrthoClinicCordobas, 'NIO'), startX + 300, incomeY);
      doc.text(formatCurrency(totalOrthoClinicDollars, 'USD'), startX + 420, incomeY);
      incomeY += 25;
      
      doc.fontSize(12).font('Helvetica-Bold')
         .text('TOTAL INGRESOS CLÍNICA:', startX + 10, incomeY);
      doc.fontSize(12).font('Helvetica-Bold')
         .fillColor('#4CAF50')
         .text(formatCurrency(totalClinicIncomeCordobas, 'NIO'), startX + 300, incomeY);
      doc.text(formatCurrency(totalClinicIncomeCordobas / exchangeRate, 'USD'), startX + 420, incomeY);
      
      doc.fillColor('#000000');
      doc.y = incomeY + 30;
      doc.moveDown(1);
      
      // =========== SECCIÓN GASTOS ===========
      if (bills && bills.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#FF9800')
           .text('GASTOS DEL PERÍODO', { underline: true });
        doc.moveDown(0.5);
        
        let currentY = drawTableHeader(doc, startX, doc.y, col1Width, col2Width, col3Width);
        doc.y = currentY;
        
        // Gastos fijos
        if (fixedBills.length > 0) {
          doc.fontSize(10).font('Helvetica-Bold')
             .text('Gastos Fijos:', startX + 10, doc.y);
          doc.moveDown(0.3);
          
          fixedBills.forEach((bill, index) => {
            const desc = bill.description || 'Gasto fijo';
            const amountCordobas = parseFloat(bill.amount_cordobas || bill.amount) || 0;
            const amountDollars = parseFloat(bill.amount_usd || bill.amount_dollars) || 0;
            
            drawTableRow(
              doc, startX, doc.y, col1Width, col2Width, col3Width,
              `  ${index + 1}. ${desc}`,
              amountCordobas,
              amountDollars
            );
          });
          doc.moveDown(0.5);
        }
        
        // Gastos variables
        if (variableBills.length > 0) {
          doc.fontSize(10).font('Helvetica-Bold')
             .text('Gastos Variables:', startX + 10, doc.y);
          doc.moveDown(0.3);
          
          variableBills.forEach((bill, index) => {
            const desc = bill.description || 'Gasto variable';
            const amountCordobas = parseFloat(bill.amount_cordobas || bill.amount) || 0;
            const amountDollars = parseFloat(bill.amount_usd || bill.amount_dollars) || 0;
            
            drawTableRow(
              doc, startX, doc.y, col1Width, col2Width, col3Width,
              `  ${index + 1}. ${desc}`,
              amountCordobas,
              amountDollars
            );
          });
          doc.moveDown(0.5);
        }
        
        doc.moveDown(0.3);
        doc.moveTo(startX + 10, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 20, doc.y)
           .strokeColor('#CCCCCC').stroke();
        doc.moveDown(0.3);
        
        drawTableRow(
          doc, startX, doc.y, col1Width, col2Width, col3Width,
          'TOTAL GASTOS',
          totalExpensesCordobas,
          totalExpensesCordobas / exchangeRate,
          true
        );
        
        doc.moveDown(1);
      }
      
      // =========== SECCIÓN DOCTORES EXTERNOS ===========
      if (totalExternalPaymentsCordobas > 0) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#9C27B0')
           .text('PAGOS A DOCTORES EXTERNOS', { underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(10).font('Helvetica')
           .text('Estos pagos YA FUERON DEDUCIDOS de las ganancias de la clínica.', startX + 10, doc.y, { color: '#666666' });
        doc.moveDown(0.5);
        
        const externalStartY = doc.y;
        doc.rect(startX - 5, externalStartY - 5, 520, 40)
           .strokeColor('#9C27B0')
           .lineWidth(1)
           .stroke();
        
        doc.fontSize(11).font('Helvetica-Bold')
           .text('Total pagado a doctores externos:', startX + 10, externalStartY);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#9C27B0')
           .text(formatCurrency(totalExternalPaymentsCordobas, 'NIO'), startX + 350, externalStartY);
        doc.text(formatCurrency(totalExternalPaymentsCordobas / exchangeRate, 'USD'), startX + 450, externalStartY);
        
        doc.fillColor('#000000');
        doc.y = externalStartY + 30;
        doc.moveDown(1);
      }
      
      // =========== RESULTADO FINAL ===========
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000')
         .text('RESULTADO FINAL - CLÍNICA', { align: 'center', underline: true });
      doc.moveDown(1);
      
      const finalStartY = doc.y;
      doc.rect(startX - 5, finalStartY - 5, 520, 140)
         .strokeColor('#000000')
         .lineWidth(1.5)
         .stroke();
      
      let finalY = finalStartY;
      
      doc.fontSize(12).font('Helvetica-Bold')
         .text('INGRESOS TOTALES CLÍNICA:', startX + 10, finalY);
      doc.fontSize(12).font('Helvetica')
         .text(formatCurrency(totalClinicIncomeCordobas, 'NIO'), startX + 320, finalY);
      doc.text(formatCurrency(totalClinicIncomeCordobas / exchangeRate, 'USD'), startX + 420, finalY);
      finalY += 25;
      
      doc.fontSize(12).font('Helvetica-Bold')
         .text('GASTOS TOTALES:', startX + 10, finalY);
      doc.fontSize(12).font('Helvetica')
         .text(`-${formatCurrency(totalExpensesCordobas, 'NIO')}`, startX + 320, finalY);
      doc.text(`-${formatCurrency(totalExpensesCordobas / exchangeRate, 'USD')}`, startX + 420, finalY);
      finalY += 25;
      
      doc.moveTo(startX + 10, finalY - 5).lineTo(startX + 510, finalY - 5)
         .strokeColor('#CCCCCC').stroke();
      
      doc.fontSize(14).font('Helvetica-Bold')
         .text('UTILIDAD NETA CLÍNICA:', startX + 10, finalY);
      doc.fontSize(14).font('Helvetica-Bold')
         .fillColor(netProfitCordobas >= 0 ? '#4CAF50' : '#F44336')
         .text(formatCurrency(netProfitCordobas, 'NIO'), startX + 320, finalY);
      doc.text(formatCurrency(netProfitCordobas / exchangeRate, 'USD'), startX + 420, finalY);
      finalY += 25;
      
      doc.fillColor('#000000');
      
      if (totalClinicIncomeCordobas > 0) {
        const profitMargin = ((netProfitCordobas / totalClinicIncomeCordobas) * 100).toFixed(2);
        doc.fontSize(11).font('Helvetica')
           .text(`Margen de utilidad: ${profitMargin}%`, startX + 10, finalY);
      }
      
      doc.y = finalY + 30;
      
      doc.fontSize(8).font('Helvetica').fillColor('#666666')
         .text('Care U Smile - Sistema de Gestión Odontológica', 50, doc.page.height - 40, { 
           align: 'center',
           width: 500 
         });
      
      doc.end();
      
    } catch (error) {
      console.error('Error al exportar PDF mensual:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al generar PDF mensual: ' + error.message 
      });
    }
  },

  // Exportar cierre mensual a Excel con cálculos CORREGIDOS
  exportMonthlyToExcelDetailed: async (req, res) => {
    try {
      const { closingId } = req.params;
      
      if (!closingId) {
        return res.status(400).json({ 
          success: false, 
          error: 'ID de cierre requerido' 
        });
      }
      
      // Obtener cierre mensual
      const { data: closing, error: closingError } = await supabaseAdmin
        .from('monthly_closings')
        .select('*')
        .eq('closing_ID', closingId)
        .single();
      
      if (closingError) throw closingError;
      if (!closing) {
        return res.status(404).json({ success: false, error: 'Cierre no encontrado' });
      }
      
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
      
      // Calcular totales CORRECTOS
      let totalGeneralCordobas = 0;
      let totalGeneralDollars = 0;
      let totalOrthoClinicCordobas = 0;
      let totalOrthoClinicDollars = 0;
      let totalOrthoDoctorCordobas = 0;
      let totalOrthoDoctorDollars = 0;
      let totalExternalPaymentsCordobas = 0;
      
      const generalProcedures = [];
      const orthoProcedures = [];
      
      if (procedures) {
        procedures.forEach(proc => {
          const clinicCordobas = parseFloat(proc.clinic_payment_cordobas) || 0;
          const clinicDollars = parseFloat(proc.clinic_payment_dollars) || 0;
          const doctorCordobas = parseFloat(proc.doctor_payment_cordobas) || 0;
          const doctorDollars = parseFloat(proc.doctor_payment_dollars) || 0;
          const externalCordobas = parseFloat(proc.external_doctor_payment) || 0;
          
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
              external_payment: externalCordobas
            });
          } else {
            totalGeneralCordobas += clinicCordobas;
            totalGeneralDollars += clinicDollars;
            
            generalProcedures.push({
              ...proc,
              clinic_amount: clinicCordobas,
              clinic_amount_usd: clinicDollars,
              external_payment: externalCordobas
            });
          }
          
          totalExternalPaymentsCordobas += externalCordobas;
        });
      }
      
      // Calcular gastos
      const fixedBills = bills ? bills.filter(bill => bill.is_recurrent) : [];
      const variableBills = bills ? bills.filter(bill => !bill.is_recurrent) : [];
      
      const totalFixedCordobas = fixedBills.reduce((sum, b) => sum + (parseFloat(b.amount_cordobas || b.amount) || 0), 0);
      const totalVariableCordobas = variableBills.reduce((sum, b) => sum + (parseFloat(b.amount_cordobas || b.amount) || 0), 0);
      const totalExpensesCordobas = totalFixedCordobas + totalVariableCordobas;
      
      const totalClinicIncomeCordobas = totalGeneralCordobas + totalOrthoClinicCordobas;
      const netProfitCordobas = totalClinicIncomeCordobas - totalExpensesCordobas;
      
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
      
      // =========== INGRESOS ===========
      const incomeHeader = summarySheet.addRow(['INGRESOS CLÍNICA', '', '']);
      incomeHeader.font = { bold: true, size: 12 };
      incomeHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F5E9' }
      };
      summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      
      // Generales
      summarySheet.addRow(['PROCEDIMIENTOS GENERALES:', '', '']);
      
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
      const subtotalGeneral = summarySheet.addRow(['SUBTOTAL GENERALES', totalGeneralCordobas, totalGeneralDollars]);
      subtotalGeneral.font = { bold: true };
      subtotalGeneral.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F8E9' }
      };
      
      summarySheet.addRow([]);
      
      // Ortodoncia
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
      const subtotalOrtho = summarySheet.addRow(['SUBTOTAL ORTODONCIA (Clínica)', totalOrthoClinicCordobas, totalOrthoClinicDollars]);
      subtotalOrtho.font = { bold: true };
      subtotalOrtho.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3E5F5' }
      };
      
      summarySheet.addRow([]);
      summarySheet.addRow([]);
      
      const totalIncomeRow = summarySheet.addRow(['TOTAL INGRESOS CLÍNICA', totalClinicIncomeCordobas, totalClinicIncomeCordobas / exchangeRate]);
      totalIncomeRow.font = { bold: true, size: 12 };
      totalIncomeRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC8E6C9' }
      };
      
      summarySheet.addRow([]);
      summarySheet.addRow([]);
      
      // =========== GASTOS ===========
      if (bills && bills.length > 0) {
        const expensesHeader = summarySheet.addRow(['GASTOS', '', '']);
        expensesHeader.font = { bold: true, size: 12 };
        expensesHeader.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF3E0' }
        };
        summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
        
        if (fixedBills.length > 0) {
          summarySheet.addRow(['GASTOS FIJOS:', '', '']);
          fixedBills.forEach(bill => {
            const desc = bill.description || 'Gasto fijo';
            const amountCordobas = parseFloat(bill.amount_cordobas || bill.amount) || 0;
            const amountDollars = parseFloat(bill.amount_usd || bill.amount_dollars) || 0;
            
            summarySheet.addRow([desc, amountCordobas, amountDollars]);
          });
          summarySheet.addRow([]);
        }
        
        if (variableBills.length > 0) {
          summarySheet.addRow(['GASTOS VARIABLES:', '', '']);
          variableBills.forEach(bill => {
            const desc = bill.description || 'Gasto variable';
            const amountCordobas = parseFloat(bill.amount_cordobas || bill.amount) || 0;
            const amountDollars = parseFloat(bill.amount_usd || bill.amount_dollars) || 0;
            
            summarySheet.addRow([desc, amountCordobas, amountDollars]);
          });
          summarySheet.addRow([]);
        }
        
        const totalExpensesRow = summarySheet.addRow(['TOTAL GASTOS', totalExpensesCordobas, totalExpensesCordobas / exchangeRate]);
        totalExpensesRow.font = { bold: true };
        totalExpensesRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE0B2' }
        };
        
        summarySheet.addRow([]);
        summarySheet.addRow([]);
      }
      
      // =========== DOCTORES EXTERNOS ===========
      if (totalExternalPaymentsCordobas > 0) {
        const externalHeader = summarySheet.addRow(['PAGOS A DOCTORES EXTERNOS', '', '']);
        externalHeader.font = { bold: true, size: 12 };
        externalHeader.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3E5F5' }
        };
        summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
        
        summarySheet.addRow(['Total pagado:', totalExternalPaymentsCordobas, totalExternalPaymentsCordobas / exchangeRate]);
        summarySheet.addRow(['(Estos pagos ya están deducidos de las ganancias)', '', '']);
        
        summarySheet.addRow([]);
        summarySheet.addRow([]);
      }
      
      // =========== RESULTADO FINAL ===========
      const resultHeader = summarySheet.addRow(['RESULTADO FINAL', '', '']);
      resultHeader.font = { bold: true, size: 12 };
      resultHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD1C4E9' }
      };
      summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      
      summarySheet.addRow(['Ingresos Clínica:', totalClinicIncomeCordobas, totalClinicIncomeCordobas / exchangeRate]);
      
      if (bills && bills.length > 0) {
        summarySheet.addRow(['Gastos:', -totalExpensesCordobas, -(totalExpensesCordobas / exchangeRate)]);
      }
      
      summarySheet.addRow([]);
      
      const netProfitRow = summarySheet.addRow(['UTILIDAD NETA CLÍNICA', netProfitCordobas, netProfitCordobas / exchangeRate]);
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
      
      if (totalClinicIncomeCordobas > 0) {
        const profitMargin = ((netProfitCordobas / totalClinicIncomeCordobas) * 100).toFixed(2);
        summarySheet.addRow([]);
        summarySheet.addRow([`Margen de Utilidad: ${profitMargin}%`, '', '']);
      }
      
      // =========== HOJA 2: DETALLE COMPLETO ===========
      const detailSheet = workbook.addWorksheet('DETALLE COMPLETO');
      
      detailSheet.columns = [
        { header: 'Fecha', key: 'date', width: 15 },
        { header: 'Paciente', key: 'patient', width: 30 },
        { header: 'Procedimiento', key: 'procedure', width: 40 },
        { header: 'Tipo', key: 'type', width: 15 },
        { header: 'Ganancia Clínica C$', key: 'clinic_cordobas', width: 18 },
        { header: 'Ganancia Clínica $', key: 'clinic_dollars', width: 18 },
        { header: 'Doctora C$', key: 'doctor_cordobas', width: 15 },
        { header: 'Doctora $', key: 'doctor_dollars', width: 15 },
        { header: 'Doctor Externo', key: 'external', width: 20 },
        { header: 'Pago Externo C$', key: 'external_payment', width: 15 }
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
        const externalDoctor = proc.theres_external_doctor ? (proc.external_doctor_name || 'Sí') : 'No';
        
        detailSheet.addRow({
          date: fecha,
          patient: patientName,
          procedure: proc.procedure_description || 'Sin descripción',
          type: tipo,
          clinic_cordobas: proc.clinic_amount || 0,
          clinic_dollars: proc.clinic_amount_usd || 0,
          doctor_cordobas: proc.doctor_amount || 0,
          doctor_dollars: proc.doctor_amount_usd || 0,
          external: externalDoctor,
          external_payment: proc.external_payment || 0
        });
      });
      
      // Aplicar formato de moneda
      workbook.eachSheet((sheet) => {
        sheet.eachRow((row, rowNumber) => {
          row.eachCell((cell, colNumber) => {
            if (rowNumber > 1 && typeof cell.value === 'number') {
              if (colNumber === 2 || colNumber === 5 || colNumber === 7 || colNumber === 10) {
                cell.numFmt = '"C$"#,##0.00';
              }
              if (colNumber === 3 || colNumber === 6 || colNumber === 8) {
                cell.numFmt = '"$"#,##0.00';
              }
            }
          });
        });
      });
      
      const fileName = `Cierre_${closing.month}_${closing.year}_Detallado_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      await workbook.xlsx.write(res);
      res.end();
      
    } catch (error) {
      console.error('Error al exportar Excel mensual detallado:', error);
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