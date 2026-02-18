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

// Función auxiliar para dibujar tabla en PDF
function drawTableHeader(doc, startX, y, col1Width, col2Width, col3Width, col4Width = null) {
  const fontSize = 10;
  const hasFourColumns = col4Width !== null;
  const totalWidth = hasFourColumns 
    ? col1Width + col2Width + col3Width + col4Width + 40 
    : col1Width + col2Width + col3Width + 30;
  
  doc.rect(startX, y, totalWidth, fontSize * 2.2)
     .fillColor('#2196F3')
     .fill();
  
  doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#FFFFFF');
  
  if (hasFourColumns) {
    doc.text('Descripción', startX + 10, y + 8);
    doc.text('Tipo', startX + col1Width + 10, y + 8, { width: col2Width, align: 'center' });
    doc.text('Monto C$', startX + col1Width + col2Width + 20, y + 8, { width: col3Width, align: 'right' });
    doc.text('Monto $', startX + col1Width + col2Width + col3Width + 30, y + 8, { width: col4Width, align: 'right' });
  } else {
    doc.text('Descripción', startX + 10, y + 8);
    doc.text('Total Córdobas', startX + col1Width + 10, y + 8, { width: col2Width, align: 'right' });
    doc.text('Total Dólares', startX + col1Width + col2Width + 20, y + 8, { width: col3Width, align: 'right' });
  }
  
  return y + fontSize * 2.2 + 5;
}

function drawTableRow(doc, startX, y, col1Width, col2Width, col3Width, col1Text, col2Value, col3Value, isSubtotal = false, col4Width = null, col4Value = null) {
  const fontSize = isSubtotal ? 10 : 9;
  const fontType = isSubtotal ? 'Helvetica-Bold' : 'Helvetica';
  
  doc.fontSize(fontSize).font(fontType).fillColor('#000000');
  
  if (col4Width !== null && col4Value !== null) {
    // Fila con 4 columnas
    doc.text(col1Text, startX + 10, y, { width: col1Width - 20 });
    
    const tipoText = typeof col2Value === 'string' ? col2Value : '';
    doc.text(tipoText, startX + col1Width + 10, y, { width: col2Width, align: 'center' });
    
    const cordobasText = typeof col3Value === 'number' ? formatCurrency(col3Value, 'NIO') : col3Value;
    doc.text(cordobasText, startX + col1Width + col2Width + 20, y, { width: col3Width, align: 'right' });
    
    const dollarsText = typeof col4Value === 'number' ? formatCurrency(col4Value, 'USD') : col4Value;
    doc.text(dollarsText, startX + col1Width + col2Width + col3Width + 30, y, { width: col4Width, align: 'right' });
  } else {
    // Fila con 3 columnas
    doc.text(col1Text, startX + (isSubtotal ? 0 : 10), y, { width: col1Width - (isSubtotal ? 0 : 20) });
    
    const cordobasText = typeof col2Value === 'number' ? formatCurrency(col2Value, 'NIO') : col2Value;
    doc.text(cordobasText, startX + col1Width + 10, y, { width: col2Width, align: 'right' });
    
    const dollarsText = typeof col3Value === 'number' ? formatCurrency(col3Value, 'USD') : col3Value;
    doc.text(dollarsText, startX + col1Width + col2Width + 20, y, { width: col3Width, align: 'right' });
  }
  
  return y + fontSize * 1.5;
}

const exportDailyController = {
  // Exportar cierre diario a PDF con LOGO y cálculos CORREGIDOS
  exportDailyPDF: async (req, res) => {
    try {
      const { closingId } = req.params;
      
      if (!closingId) {
        return res.status(400).json({ 
          success: false, 
          error: 'ID de cierre requerido' 
        });
      }
      
      // Obtener cierre diario
      const { data: closing, error: closingError } = await supabaseAdmin
        .from('daily_closings')
        .select('*')
        .eq('daily_closing_id', closingId)
        .single();
      
      if (closingError) throw closingError;
      if (!closing) {
        return res.status(404).json({ success: false, error: 'Cierre diario no encontrado' });
      }
      
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
        .eq('daily_closing_id', closingId);
      
      if (relationsError) throw relationsError;
      
      // Obtener gastos del día
      const { data: bills, error: billsError } = await supabaseAdmin
        .from('bills')
        .select('*')
        .eq('bill_date', closing.closing_date)
        .eq('is_processed_in_daily_closing', true)
        .eq('processed_in_daily_closing_ID', closingId);
      
      if (billsError && billsError.code !== 'PGRST116') throw billsError;
      
      // Separar procedimientos por tipo y calcular SOLO ganancia de clínica
      const generalProcedures = [];
      const orthoProcedures = [];
      
      let totalClinicIncomeCordobas = 0;
      let totalClinicIncomeDollars = 0;
      let totalDoctorIncomeCordobas = 0;
      let totalDoctorIncomeDollars = 0;
      let totalExternalPaymentsCordobas = 0;
      let totalExternalPaymentsDollars = 0;
      
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
      
      // Calcular totales de gastos
      let totalExpensesCordobas = 0;
      let totalExpensesDollars = 0;
      
      if (bills) {
        bills.forEach(bill => {
          totalExpensesCordobas += parseFloat(bill.amount_cordobas || bill.amount || 0);
          totalExpensesDollars += parseFloat(bill.amount_usd || bill.amount_dollars || 0);
        });
      }
      
      const netProfitCordobas = totalClinicIncomeCordobas - totalExpensesCordobas;
      const netProfitDollars = totalClinicIncomeDollars - totalExpensesDollars;
      
      // Crear documento PDF
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        layout: 'portrait'
      });
      
      // Configurar encabezados de respuesta
      res.setHeader('Content-Type', 'application/pdf');
      const fileName = `Cierre_Diario_${formatNicaraguaDate(closing.closing_date).replace(/\//g, '-')}_${closing.closing_type}_${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      doc.pipe(res);
      
      // =========== AGREGAR LOGO ===========
      try {
        // Intentar diferentes rutas posibles para el logo
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
          console.log('✅ Logo cargado desde:', logoPath);
        } else {
          console.log('⚠️ Logo no encontrado, continuando sin logo');
        }
      } catch (logoError) {
        console.log('Error al cargar logo:', logoError.message);
      }
      
      // =========== ENCABEZADO ===========
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#2196F3')
         .text('CARE U SMILE', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000')
         .text('REPORTE DE CIERRE DIARIO', { align: 'center' });
      doc.moveDown(0.5);
      
      const fechaFormateada = formatNicaraguaDate(closing.closing_date);
      const tipoTexto = closing.closing_type === 'orthodontics' ? 'ORTODONCIA' : 'GENERAL';
      
      doc.fontSize(14).font('Helvetica')
         .text(`Fecha: ${fechaFormateada} - ${tipoTexto}`, { align: 'center' });
      doc.moveDown(0.5);
      
      if (closing.comentary) {
        doc.fontSize(11).font('Helvetica-Oblique')
           .text(`Nota: ${closing.comentary}`, { align: 'center' });
        doc.moveDown(0.5);
      }
      
      // Línea separadora
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#CCCCCC').stroke();
      doc.moveDown(1);
      
      doc.fontSize(9).text(`Fecha de generación: ${formatNicaraguaDateTime(new Date().toISOString())}`, { align: 'right' });
      doc.moveDown(1.5);
      
      // =========== SECCIÓN PROCEDIMIENTOS ===========
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#4CAF50')
         .text('PROCEDIMIENTOS REALIZADOS', { underline: true });
      doc.moveDown(0.5);
      
      // Tabla de procedimientos
      const startX = 50;
      const col1Width = 250;
      const col2Width = 80;
      const col3Width = 90;
      const col4Width = 90;
      
      let currentY = drawTableHeader(doc, startX, doc.y, col1Width, col2Width, col3Width, col4Width);
      doc.y = currentY;
      
      // Procedimientos generales
      if (generalProcedures.length > 0) {
        doc.fontSize(10).font('Helvetica-Bold')
           .text('GENERALES:', startX + 10, doc.y);
        doc.moveDown(0.5);
        
        generalProcedures.forEach((proc, index) => {
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          const procDesc = proc.procedure_description || 'Procedimiento';
          const tipo = 'General';
          
          drawTableRow(
            doc, startX, doc.y, col1Width, col2Width, col3Width,
            `${index + 1}. ${procDesc} - ${patientName}`,
            tipo,
            proc.clinic_amount || 0,
            proc.clinic_amount_usd || 0,
            false,
            col4Width,
            (proc.clinic_amount_usd || 0)
          );
        });
        doc.moveDown(0.5);
      }
      
      // Procedimientos de ortodoncia
      if (orthoProcedures.length > 0) {
        doc.fontSize(10).font('Helvetica-Bold')
           .text('ORTODONCIA:', startX + 10, doc.y);
        doc.moveDown(0.5);
        
        orthoProcedures.forEach((proc, index) => {
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          const procDesc = proc.procedure_description || 'Ortodoncia';
          const tipo = 'Ortodoncia';
          
          drawTableRow(
            doc, startX, doc.y, col1Width, col2Width, col3Width,
            `${index + 1}. ${procDesc} - ${patientName}`,
            tipo,
            proc.clinic_amount || 0,
            proc.clinic_amount_usd || 0,
            false,
            col4Width,
            (proc.clinic_amount_usd || 0)
          );
          
          // Mostrar desglose para ortodoncia
          doc.fontSize(8).font('Helvetica')
             .text(`     └─ Doctora: ${formatCurrency(proc.doctor_amount || 0, 'NIO')} / ${formatCurrency(proc.doctor_amount_usd || 0, 'USD')}`, 
                   startX + 20, doc.y - 10);
          doc.moveDown(0.3);
        });
        doc.moveDown(0.5);
      }
      
      // Subtotal procedimientos
      doc.moveDown(0.3);
      doc.moveTo(startX + 10, doc.y).lineTo(startX + col1Width + col2Width + col3Width + col4Width + 30, doc.y)
         .strokeColor('#CCCCCC').stroke();
      doc.moveDown(0.3);
      
      doc.fontSize(10).font('Helvetica-Bold')
         .text('SUBTOTAL PROCEDIMIENTOS:', startX + 10, doc.y);
      doc.fontSize(10).font('Helvetica-Bold')
         .text(formatCurrency(totalClinicIncomeCordobas, 'NIO'), startX + col1Width + 10, doc.y, { width: col2Width, align: 'right' });
      doc.text(formatCurrency(totalClinicIncomeDollars, 'USD'), startX + col1Width + col2Width + 20, doc.y, { width: col3Width, align: 'right' });
      doc.text(formatCurrency(totalClinicIncomeDollars, 'USD'), startX + col1Width + col2Width + col3Width + 30, doc.y, { width: col4Width, align: 'right' });
      
      doc.moveDown(1.5);
      
      // =========== SECCIÓN GASTOS VARIABLES ===========
      if (bills && bills.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#FF9800')
           .text('GASTOS VARIABLES DEL DÍA', { underline: true });
        doc.moveDown(0.5);
        
        currentY = drawTableHeader(doc, startX, doc.y, col1Width, col2Width, col3Width, col4Width);
        doc.y = currentY;
        
        bills.forEach((bill, index) => {
          const desc = bill.description || 'Gasto variable';
          const categoria = bill.category || 'General';
          const montoCordobas = parseFloat(bill.amount_cordobas || bill.amount || 0);
          const montoDollars = parseFloat(bill.amount_usd || bill.amount_dollars || 0);
          
          drawTableRow(
            doc, startX, doc.y, col1Width, col2Width, col3Width,
            `${index + 1}. ${desc}`,
            categoria,
            montoCordobas,
            montoDollars,
            false,
            col4Width,
            montoDollars
          );
        });
        
        doc.moveDown(0.3);
        doc.moveTo(startX + 10, doc.y).lineTo(startX + col1Width + col2Width + col3Width + col4Width + 30, doc.y)
           .strokeColor('#CCCCCC').stroke();
        doc.moveDown(0.3);
        
        doc.fontSize(10).font('Helvetica-Bold')
           .text('TOTAL GASTOS:', startX + 10, doc.y);
        doc.fontSize(10).font('Helvetica-Bold')
           .text(formatCurrency(totalExpensesCordobas, 'NIO'), startX + col1Width + 10, doc.y, { width: col2Width, align: 'right' });
        doc.text(formatCurrency(totalExpensesDollars, 'USD'), startX + col1Width + col2Width + 20, doc.y, { width: col3Width, align: 'right' });
        doc.text(formatCurrency(totalExpensesDollars, 'USD'), startX + col1Width + col2Width + col3Width + 30, doc.y, { width: col4Width, align: 'right' });
        
        doc.moveDown(1.5);
      }
      
      // =========== SECCIÓN DOCTORES EXTERNOS ===========
      if (totalExternalPaymentsCordobas > 0) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#9C27B0')
           .text('PAGOS A DOCTORES EXTERNOS', { underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(10).font('Helvetica')
           .text('Estos pagos YA FUERON DEDUCIDOS de las ganancias mostradas arriba.', startX + 10, doc.y, { color: '#666666' });
        doc.moveDown(0.5);
        
        const externalStartY = doc.y;
        doc.rect(startX - 5, externalStartY - 5, 520, 40)
           .strokeColor('#9C27B0')
           .lineWidth(1)
           .stroke();
        
        doc.fontSize(11).font('Helvetica-Bold')
           .text('Total pagado a doctores externos:', startX + 10, externalStartY);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#9C27B0')
           .text(formatCurrency(totalExternalPaymentsCordobas, 'NIO'), startX + 300, externalStartY);
        doc.text(formatCurrency(totalExternalPaymentsDollars, 'USD'), startX + 400, externalStartY);
        
        doc.fillColor('#000000');
        doc.y = externalStartY + 30;
        doc.moveDown(1);
      }
      
      // =========== SECCIÓN RESUMEN FINAL ===========
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000')
         .text('RESUMEN FINAL - CLÍNICA', { align: 'center', underline: true });
      doc.moveDown(1);
      
      const summaryStartY = doc.y;
      doc.rect(startX - 5, summaryStartY - 5, 520, 140)
         .strokeColor('#000000')
         .lineWidth(1.5)
         .stroke();
      
      let summaryY = summaryStartY;
      
      // Fila 1: Ingresos
      doc.fontSize(12).font('Helvetica-Bold')
         .text('INGRESOS CLÍNICA:', startX + 10, summaryY);
      doc.fontSize(12).font('Helvetica')
         .text(formatCurrency(totalClinicIncomeCordobas, 'NIO'), startX + 250, summaryY);
      doc.text(formatCurrency(totalClinicIncomeDollars, 'USD'), startX + 400, summaryY);
      summaryY += 25;
      
      // Fila 2: Gastos
      doc.fontSize(12).font('Helvetica-Bold')
         .text('GASTOS:', startX + 10, summaryY);
      doc.fontSize(12).font('Helvetica')
         .text(`-${formatCurrency(totalExpensesCordobas, 'NIO')}`, startX + 250, summaryY);
      doc.text(`-${formatCurrency(totalExpensesDollars, 'USD')}`, startX + 400, summaryY);
      summaryY += 25;
      
      // Línea separadora
      doc.moveTo(startX + 10, summaryY - 5).lineTo(startX + 510, summaryY - 5)
         .strokeColor('#CCCCCC').stroke();
      
      // Fila 3: Utilidad Neta
      doc.fontSize(14).font('Helvetica-Bold')
         .text('UTILIDAD NETA CLÍNICA:', startX + 10, summaryY);
      doc.fontSize(14).font('Helvetica-Bold')
         .fillColor(netProfitCordobas >= 0 ? '#4CAF50' : '#F44336')
         .text(formatCurrency(netProfitCordobas, 'NIO'), startX + 250, summaryY);
      doc.text(formatCurrency(netProfitDollars, 'USD'), startX + 400, summaryY);
      summaryY += 25;
      
      doc.fillColor('#000000');
      
      // Fila 4: Margen
      if (totalClinicIncomeCordobas > 0) {
        const profitMargin = ((netProfitCordobas / totalClinicIncomeCordobas) * 100).toFixed(2);
        doc.fontSize(11).font('Helvetica')
           .text(`Margen de utilidad: ${profitMargin}%`, startX + 10, summaryY);
      }
      
      doc.y = summaryY + 30;
      
      // =========== RESUMEN DE DISTRIBUCIÓN (si es ortodoncia) ===========
      if (closing.closing_type === 'orthodontics' && orthoProcedures.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold')
           .text('DISTRIBUCIÓN ORTODONCIA:', { underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(10).font('Helvetica')
           .text(`Clínica (40%): ${formatCurrency(totalClinicIncomeCordobas, 'NIO')} / ${formatCurrency(totalClinicIncomeDollars, 'USD')}`, startX + 10, doc.y);
        doc.moveDown(0.3);
        doc.text(`Doctora (60%): ${formatCurrency(totalDoctorIncomeCordobas, 'NIO')} / ${formatCurrency(totalDoctorIncomeDollars, 'USD')}`, startX + 10, doc.y);
      }
      
      // Pie de página
      doc.fontSize(8).font('Helvetica').fillColor('#666666')
         .text('Care U Smile - Sistema de Gestión Odontológica', 50, doc.page.height - 40, { 
           align: 'center',
           width: 500 
         });
      
      doc.end();
      
    } catch (error) {
      console.error('Error al exportar PDF diario:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al generar PDF diario: ' + error.message 
      });
    }
  },

  // Exportar cierre diario a Excel DETALLADO con cálculos CORREGIDOS
  exportDailyToExcelDetailed: async (req, res) => {
    try {
      const { closingId } = req.params;
      
      if (!closingId) {
        return res.status(400).json({ 
          success: false, 
          error: 'ID de cierre requerido' 
        });
      }
      
      // Obtener cierre diario
      const { data: closing, error: closingError } = await supabaseAdmin
        .from('daily_closings')
        .select('*')
        .eq('daily_closing_id', closingId)
        .single();
      
      if (closingError) throw closingError;
      if (!closing) {
        return res.status(404).json({ success: false, error: 'Cierre diario no encontrado' });
      }
      
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
        .eq('daily_closing_id', closingId);
      
      if (relationsError) throw relationsError;
      
      // Obtener gastos del día
      const { data: bills, error: billsError } = await supabaseAdmin
        .from('bills')
        .select('*')
        .eq('bill_date', closing.closing_date)
        .eq('is_processed_in_daily_closing', true)
        .eq('processed_in_daily_closing_ID', closingId);
      
      if (billsError && billsError.code !== 'PGRST116') throw billsError;
      
      // Calcular totales CORRECTOS
      let totalClinicIncomeCordobas = 0;
      let totalClinicIncomeDollars = 0;
      let totalDoctorIncomeCordobas = 0;
      let totalDoctorIncomeDollars = 0;
      let totalExternalPaymentsCordobas = 0;
      
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
          
          totalClinicIncomeCordobas += clinicCordobas;
          totalClinicIncomeDollars += clinicDollars;
          totalDoctorIncomeCordobas += doctorCordobas;
          totalDoctorIncomeDollars += doctorDollars;
          totalExternalPaymentsCordobas += externalCordobas;
          
          const procedureData = {
            ...proc,
            clinic_amount: clinicCordobas,
            clinic_amount_usd: clinicDollars,
            doctor_amount: doctorCordobas,
            doctor_amount_usd: doctorDollars,
            external_payment: externalCordobas
          };
          
          if (proc.is_orthodontics) {
            orthoProcedures.push(procedureData);
          } else {
            generalProcedures.push(procedureData);
          }
        });
      }
      
      // Calcular gastos
      let totalExpensesCordobas = 0;
      let totalExpensesDollars = 0;
      
      if (bills) {
        bills.forEach(bill => {
          totalExpensesCordobas += parseFloat(bill.amount_cordobas || bill.amount || 0);
          totalExpensesDollars += parseFloat(bill.amount_usd || bill.amount_dollars || 0);
        });
      }
      
      const netProfitCordobas = totalClinicIncomeCordobas - totalExpensesCordobas;
      const netProfitDollars = totalClinicIncomeDollars - totalExpensesDollars;
      
      // Crear workbook
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
      
      summarySheet.addRow([]); // Espacio
      
      // INGRESOS
      const incomeHeader = summarySheet.addRow(['INGRESOS', '', '']);
      incomeHeader.font = { bold: true, size: 12 };
      incomeHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F5E9' }
      };
      summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      
      // Tabla de ingresos
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
      }
      
      summarySheet.addRow([]);
      
      // Subtotal ingresos
      const subtotalRow = summarySheet.addRow(['SUBTOTAL INGRESOS CLÍNICA', totalClinicIncomeCordobas, totalClinicIncomeDollars]);
      subtotalRow.font = { bold: true };
      subtotalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F8E9' }
      };
      
      summarySheet.addRow([]);
      summarySheet.addRow([]);
      
      // GASTOS
      if (bills && bills.length > 0) {
        const expensesHeader = summarySheet.addRow(['GASTOS VARIABLES', '', '']);
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
        
        bills.forEach(bill => {
          const desc = bill.description || 'Gasto variable';
          const montoCordobas = parseFloat(bill.amount_cordobas || bill.amount || 0);
          const montoDollars = parseFloat(bill.amount_usd || bill.amount_dollars || 0);
          
          summarySheet.addRow([desc, montoCordobas, montoDollars]);
        });
        
        summarySheet.addRow([]);
        
        const totalExpensesRow = summarySheet.addRow(['TOTAL GASTOS', totalExpensesCordobas, totalExpensesDollars]);
        totalExpensesRow.font = { bold: true };
        totalExpensesRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE0B2' }
        };
        
        summarySheet.addRow([]);
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
      
      if (bills && bills.length > 0) {
        summarySheet.addRow(['Gastos:', -totalExpensesCordobas, -totalExpensesDollars]);
      }
      
      summarySheet.addRow([]);
      
      const netProfitRow = summarySheet.addRow(['UTILIDAD NETA CLÍNICA', netProfitCordobas, netProfitDollars]);
      netProfitRow.font = { bold: true, size: 12 };
      netProfitRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD1C4E9' }
      };
      
      // Colorear según resultado
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
        { header: 'Pago Externo', key: 'external_payment', width: 15 }
      ];
      
      const detailHeader = detailSheet.getRow(1);
      detailHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      detailHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2196F3' }
      };
      
      // Agregar todos los procedimientos
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
      
      // =========== HOJA 3: GASTOS ===========
      if (bills && bills.length > 0) {
        const expensesSheet = workbook.addWorksheet('GASTOS');
        
        expensesSheet.columns = [
          { header: 'ID', key: 'id', width: 10 },
          { header: 'Descripción', key: 'description', width: 40 },
          { header: 'Categoría', key: 'category', width: 20 },
          { header: 'Monto C$', key: 'cordobas', width: 18 },
          { header: 'Monto $', key: 'dollars', width: 18 }
        ];
        
        const expensesHeader = expensesSheet.getRow(1);
        expensesHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        expensesHeader.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF9800' }
        };
        
        bills.forEach(bill => {
          expensesSheet.addRow({
            id: bill.bill_ID,
            description: bill.description || 'Sin descripción',
            category: bill.category || 'General',
            cordobas: parseFloat(bill.amount_cordobas || bill.amount || 0),
            dollars: parseFloat(bill.amount_usd || bill.amount_dollars || 0)
          });
        });
        
        // Total gastos
        expensesSheet.addRow([]);
        const totalExpensesRow = expensesSheet.addRow({
          description: 'TOTAL GASTOS',
          cordobas: totalExpensesCordobas,
          dollars: totalExpensesDollars
        });
        totalExpensesRow.font = { bold: true };
        totalExpensesRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFE0B2' }
        };
      }
      
      // Aplicar formato de moneda a todas las hojas
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
      
      // Configurar respuesta
      const fileName = `Cierre_Diario_${formatNicaraguaDate(closing.closing_date).replace(/\//g, '-')}_${closing.closing_type}_Detallado_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      await workbook.xlsx.write(res);
      res.end();
      
    } catch (error) {
      console.error('Error al exportar Excel diario detallado:', error);
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
      
      // Obtener cierre diario
      const { data: closing, error: closingError } = await supabaseAdmin
        .from('daily_closings')
        .select('*')
        .eq('daily_closing_id', closingId)
        .single();
      
      if (closingError) throw closingError;
      
      // Crear workbook simplificado
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
      
      const exchangeRate = 36.5; // Valor por defecto
      
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
      
      // Formato
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
        error: 'Error al generar Excel diario' 
      });
    }
  }
};

export default exportDailyController;