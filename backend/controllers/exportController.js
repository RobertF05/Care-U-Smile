import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '../config/supabase.js';
import { formatNicaraguaDate } from '../utils/timezoneUtils.js';

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
  
  // Encabezados con fondo
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
  
  // Columna 1: Descripción
  doc.text(col1Text, startX + (isSubtotal ? 0 : 10), y, { width: col1Width - (isSubtotal ? 0 : 20) });
  
  // Columna 2: Córdobas
  const cordobasText = typeof col2Value === 'number' ? formatCurrency(col2Value, 'NIO') : col2Value;
  doc.text(cordobasText, startX + col1Width + 10, y, { width: col2Width, align: 'right' });
  
  // Columna 3: Dólares
  const dollarsText = typeof col3Value === 'number' ? formatCurrency(col3Value, 'USD') : col3Value;
  doc.text(dollarsText, startX + col1Width + col2Width + 20, y, { width: col3Width, align: 'right' });
  
  return y + fontSize * 1.5;
}

const exportController = {
  // Exportar cierre mensual a PDF - FORMATO MEJORADO
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
      
      // Separar procedimientos generales y de ortodoncia
      const generalProcedures = procedures ? procedures.filter(p => !p.is_orthodontics) : [];
      const orthoProcedures = procedures ? procedures.filter(p => p.is_orthodontics) : [];
      
      // Obtener gastos del período con desglose fijo/variable
      const { data: bills, error: billsError } = await supabaseAdmin
        .from('bills')
        .select('*')
        .gte('bill_date', periodStartDate)
        .lte('bill_date', periodEndDate)
        .order('bill_date', { ascending: true });
      
      if (billsError && billsError.code !== 'PGRST116') throw billsError;
      
      // Filtrar gastos fijos y variables
      const fixedBills = bills ? bills.filter(bill => bill.is_recurrent) : [];
      const variableBills = bills ? bills.filter(bill => !bill.is_recurrent) : [];
      
      // Calcular totales
      const totalGeneralCordobas = generalProcedures.reduce((sum, p) => sum + (p.total_procedure || 0), 0);
      const totalGeneralDollars = generalProcedures.reduce((sum, p) => sum + (p.total_procedure_usd || 0), 0);
      const totalOrthoCordobas = orthoProcedures.reduce((sum, p) => sum + (p.total_procedure || 0), 0);
      const totalOrthoDollars = orthoProcedures.reduce((sum, p) => sum + (p.total_procedure_usd || 0), 0);
      const totalProceduresCordobas = totalGeneralCordobas + totalOrthoCordobas;
      const totalProceduresDollars = totalGeneralDollars + totalOrthoDollars;
      
      // Calcular totales de gastos
      const totalFixedCordobas = fixedBills.reduce((sum, b) => sum + (b.amount_cordobas || b.amount || 0), 0);
      const totalFixedDollars = fixedBills.reduce((sum, b) => sum + (b.amount_usd || b.amount_dollars || 0), 0);
      const totalVariableCordobas = variableBills.reduce((sum, b) => sum + (b.amount_cordobas || b.amount || 0), 0);
      const totalVariableDollars = variableBills.reduce((sum, b) => sum + (b.amount_usd || b.amount_dollars || 0), 0);
      const totalExpensesCordobas = totalFixedCordobas + totalVariableCordobas;
      const totalExpensesDollars = totalFixedDollars + totalVariableDollars;
      
      const netProfitCordobas = totalProceduresCordobas - totalExpensesCordobas;
      const netProfitDollars = totalProceduresDollars - totalExpensesDollars;
      
      // Crear documento PDF con márgenes mejorados
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        layout: 'portrait'
      });
      
      // Configurar encabezados de respuesta
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Cierre_${closing.month}_${closing.year}_${new Date().toISOString().split('T')[0]}.pdf"`);
      
      // Pipe del documento a la respuesta
      doc.pipe(res);
      
      // =========== ENCABEZADO MEJORADO ===========
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#2196F3')
         .text('CARE U SMILE', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(14).font('Helvetica').fillColor('#000000')
         .text('Reporte de Cierre Mensual', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(12).text(`${closing.month.toUpperCase()} ${closing.year}`, { align: 'center' });
      doc.moveDown(1);
      
      // Línea separadora
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#CCCCCC').stroke();
      doc.moveDown(1);
      
      // Información de fecha
      doc.fontSize(9).text(`Fecha de generación: ${formatNicaraguaDate(new Date().toISOString())}`, { align: 'right' });
      doc.moveDown(1.5);
      
      // Dimensiones de tabla
      const startX = 50;
      const col1Width = 250;
      const col2Width = 100;
      const col3Width = 100;
      let currentY = doc.y;
      
      // =========== SECCIÓN INGRESOS ===========
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#4CAF50')
         .text('* INGRESOS', { underline: true });
      doc.moveDown(0.5);
      
      // Encabezado de tabla
      currentY = drawTableHeader(doc, startX, doc.y, col1Width, col2Width, col3Width);
      doc.y = currentY;
      
      // Subsección: Consultas Generales
      doc.fontSize(10).font('Helvetica-Bold')
         .text('- Consultas Generales', startX, doc.y);
      doc.moveDown(0.3);
      
      // Lista de consultas generales
      if (generalProcedures.length > 0) {
        doc.fontSize(9).font('Helvetica');
        generalProcedures.forEach((proc, index) => {
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          const procDesc = proc.procedure_description || 'Consulta';
          
          drawTableRow(
            doc, startX, doc.y, col1Width, col2Width, col3Width,
            `  ${index + 1}. ${procDesc} - ${patientName}`,
            proc.total_procedure || 0,
            proc.total_procedure_usd || 0
          );
        });
      } else {
        doc.text('  No hay consultas generales', startX + 10, doc.y);
        doc.moveDown(0.5);
      }
      
      // Línea separadora antes del subtotal
      doc.moveDown(0.3);
      doc.moveTo(startX + 10, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 20, doc.y)
         .strokeColor('#CCCCCC').stroke();
      doc.moveDown(0.3);
      
      // Subtotal General
      doc.y = drawTableRow(
        doc, startX, doc.y, col1Width, col2Width, col3Width,
        '- Subtotal General',
        totalGeneralCordobas,
        totalGeneralDollars,
        true
      );
      
      doc.moveDown(0.8);
      
      // Subsección: Consultas de Ortodoncia
      doc.fontSize(10).font('Helvetica-Bold')
         .text('- Consultas de Ortodoncia', startX, doc.y);
      doc.moveDown(0.3);
      
      // Lista de consultas de ortodoncia
      if (orthoProcedures.length > 0) {
        doc.fontSize(9).font('Helvetica');
        orthoProcedures.forEach((proc, index) => {
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          const procDesc = proc.procedure_description || 'Ortodoncia';
          
          drawTableRow(
            doc, startX, doc.y, col1Width, col2Width, col3Width,
            `  ${index + 1}. ${procDesc} - ${patientName}`,
            proc.total_procedure || 0,
            proc.total_procedure_usd || 0
          );
        });
      } else {
        doc.text('  No hay consultas de ortodoncia', startX + 10, doc.y);
        doc.moveDown(0.5);
      }
      
      // Línea separadora antes del subtotal
      doc.moveDown(0.3);
      doc.moveTo(startX + 10, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 20, doc.y)
         .strokeColor('#CCCCCC').stroke();
      doc.moveDown(0.3);
      
      // Subtotal Ortodoncia
      doc.y = drawTableRow(
        doc, startX, doc.y, col1Width, col2Width, col3Width,
        '- Subtotal Ortodoncia',
        totalOrthoCordobas,
        totalOrthoDollars,
        true
      );
      
      doc.moveDown(0.8);
      
      // Línea gruesa antes del total
      doc.moveTo(startX, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 30, doc.y)
         .strokeColor('#000000').lineWidth(1.5).stroke();
      doc.moveDown(0.5);
      
      // Total Procedimientos
      doc.y = drawTableRow(
        doc, startX, doc.y, col1Width, col2Width, col3Width,
        'TOTAL PROCEDIMIENTOS',
        totalProceduresCordobas,
        totalProceduresDollars,
        true
      );
      doc.moveDown(1.5);
      
      // =========== SECCIÓN GASTOS ===========
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#FF9800')
         .text('* GASTOS', { underline: true });
      doc.moveDown(0.5);
      
      // Encabezado de tabla para gastos
      currentY = drawTableHeader(doc, startX, doc.y, col1Width, col2Width, col3Width);
      doc.y = currentY;
      
      // Subsección: Gastos Fijos
      doc.fontSize(10).font('Helvetica-Bold')
         .text('- Gastos Fijos', startX, doc.y);
      doc.moveDown(0.3);
      
      // Lista de gastos fijos
      if (fixedBills.length > 0) {
        doc.fontSize(9).font('Helvetica');
        fixedBills.forEach((bill, index) => {
          const desc = bill.description || 'Gasto fijo';
          
          drawTableRow(
            doc, startX, doc.y, col1Width, col2Width, col3Width,
            `  ${index + 1}. ${desc}`,
            bill.amount_cordobas || bill.amount || 0,
            bill.amount_usd || bill.amount_dollars || 0
          );
        });
      } else {
        doc.text('  No hay gastos fijos', startX + 10, doc.y);
        doc.moveDown(0.5);
      }
      
      // Línea separadora antes del subtotal
      doc.moveDown(0.3);
      doc.moveTo(startX + 10, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 20, doc.y)
         .strokeColor('#CCCCCC').stroke();
      doc.moveDown(0.3);
      
      // Subtotal Gastos Fijos
      doc.y = drawTableRow(
        doc, startX, doc.y, col1Width, col2Width, col3Width,
        '- Subtotal Gastos Fijos',
        totalFixedCordobas,
        totalFixedDollars,
        true
      );
      
      doc.moveDown(0.8);
      
      // Subsección: Gastos Variables
      doc.fontSize(10).font('Helvetica-Bold')
         .text('- Gastos Variables', startX, doc.y);
      doc.moveDown(0.3);
      
      // Lista de gastos variables
      if (variableBills.length > 0) {
        doc.fontSize(9).font('Helvetica');
        variableBills.forEach((bill, index) => {
          const desc = bill.description || 'Gasto variable';
          
          drawTableRow(
            doc, startX, doc.y, col1Width, col2Width, col3Width,
            `  ${index + 1}. ${desc}`,
            bill.amount_cordobas || bill.amount || 0,
            bill.amount_usd || bill.amount_dollars || 0
          );
        });
      } else {
        doc.text('  No hay gastos variables', startX + 10, doc.y);
        doc.moveDown(0.5);
      }
      
      // Línea separadora antes del subtotal
      doc.moveDown(0.3);
      doc.moveTo(startX + 10, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 20, doc.y)
         .strokeColor('#CCCCCC').stroke();
      doc.moveDown(0.3);
      
      // Subtotal Gastos Variables
      doc.y = drawTableRow(
        doc, startX, doc.y, col1Width, col2Width, col3Width,
        '- Subtotal Gastos Variables',
        totalVariableCordobas,
        totalVariableDollars,
        true
      );
      
      doc.moveDown(0.8);
      
      // Línea gruesa antes del total
      doc.moveTo(startX, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 30, doc.y)
         .strokeColor('#000000').lineWidth(1.5).stroke();
      doc.moveDown(0.5);
      
      // Total Gastos
      doc.y = drawTableRow(
        doc, startX, doc.y, col1Width, col2Width, col3Width,
        'TOTAL GASTOS',
        totalExpensesCordobas,
        totalExpensesDollars,
        true
      );
      doc.moveDown(1.5);
      
      // =========== SECCIÓN RESULTADO FINAL ===========
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#9C27B0')
         .text('* RESULTADO FINAL', { underline: true });
      doc.moveDown(0.8);
      
      // Marco para resumen final
      const summaryBoxY = doc.y;
      doc.rect(startX - 5, summaryBoxY - 10, 510, 120)
         .strokeColor('#9C27B0')
         .lineWidth(1)
         .stroke();
      
      // Fila 1: Ingresos Totales
      doc.fontSize(12).font('Helvetica-Bold')
         .text('Ingresos Totales:', startX + 10, summaryBoxY);
      doc.fontSize(12).font('Helvetica')
         .text(formatCurrency(totalProceduresCordobas, 'NIO'), startX + 150, summaryBoxY);
      doc.text(formatCurrency(totalProceduresDollars, 'USD'), startX + 350, summaryBoxY, { align: 'right' });
      
      // Fila 2: Gastos Totales
      doc.fontSize(12).font('Helvetica-Bold')
         .text('Gastos Totales:', startX + 10, summaryBoxY + 25);
      doc.fontSize(12).font('Helvetica')
         .text(`-${formatCurrency(totalExpensesCordobas, 'NIO')}`, startX + 150, summaryBoxY + 25);
      doc.text(`-${formatCurrency(totalExpensesDollars, 'USD')}`, startX + 350, summaryBoxY + 25, { align: 'right' });
      
      // Línea separadora
      doc.moveTo(startX + 10, summaryBoxY + 50).lineTo(startX + 500, summaryBoxY + 50)
         .strokeColor('#9C27B0').stroke();
      
      // Fila 3: Utilidad Neta (DESTACADA)
      doc.fontSize(14).font('Helvetica-Bold')
         .text('UTILIDAD NETA:', startX + 10, summaryBoxY + 65);
      doc.fontSize(14).font('Helvetica-Bold')
         .fillColor(netProfitCordobas >= 0 ? '#4CAF50' : '#F44336')
         .text(formatCurrency(netProfitCordobas, 'NIO'), startX + 150, summaryBoxY + 65);
      doc.text(formatCurrency(netProfitDollars, 'USD'), startX + 350, summaryBoxY + 65, { align: 'right' });
      doc.fillColor('#000000');
      
      // Fila 4: Margen de Utilidad
      if (totalProceduresCordobas > 0) {
        const profitMargin = ((netProfitCordobas / totalProceduresCordobas) * 100).toFixed(2);
        doc.fontSize(12).font('Helvetica-Bold')
           .text('Margen de Utilidad:', startX + 10, summaryBoxY + 95);
        doc.fontSize(12).font('Helvetica-Bold')
           .fillColor(profitMargin >= 0 ? '#4CAF50' : '#F44336')
           .text(`${profitMargin}%`, startX + 150, summaryBoxY + 95);
      }
      
      doc.y = summaryBoxY + 140;
      
      // Comentarios
      if (closing.comentary) {
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica-Bold').text('COMENTARIOS:', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(9).font('Helvetica').text(closing.comentary, { 
          width: 500,
          align: 'left' 
        });
      }
      
      // Pie de página
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
        error: 'Error al generar PDF mensual' 
      });
    }
  },

  // Exportar cierre diario a PDF - FORMATO MEJORADO
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
            *,
            patients (first_name, first_last_name)
          )
        `)
        .eq('daily_closing_id', closingId);
      
      if (relationsError) throw relationsError;
      
      // Separar procedimientos por tipo
      const generalProcedures = [];
      const orthoProcedures = [];
      
      if (procedureRelations) {
        procedureRelations.forEach(relation => {
          const proc = relation.procedures;
          if (!proc) return;
          
          if (proc.is_orthodontics) {
            orthoProcedures.push(proc);
          } else {
            generalProcedures.push(proc);
          }
        });
      }
      
      // Obtener gastos del día
      const { data: bills, error: billsError } = await supabaseAdmin
        .from('bills')
        .select('*')
        .eq('bill_date', closing.closing_date)
        .order('bill_date', { ascending: true });
      
      if (billsError && billsError.code !== 'PGRST116') throw billsError;
      
      // Filtrar gastos fijos y variables
      const fixedBills = bills ? bills.filter(bill => bill.is_recurrent) : [];
      const variableBills = bills ? bills.filter(bill => !bill.is_recurrent) : [];
      
      // Calcular totales
      const totalGeneralCordobas = generalProcedures.reduce((sum, p) => sum + (p.total_procedure || 0), 0);
      const totalGeneralDollars = generalProcedures.reduce((sum, p) => sum + (p.total_procedure_usd || 0), 0);
      const totalOrthoCordobas = orthoProcedures.reduce((sum, p) => sum + (p.total_procedure || 0), 0);
      const totalOrthoDollars = orthoProcedures.reduce((sum, p) => sum + (p.total_procedure_usd || 0), 0);
      const totalProceduresCordobas = totalGeneralCordobas + totalOrthoCordobas;
      const totalProceduresDollars = totalGeneralDollars + totalOrthoDollars;
      
      // Calcular totales de gastos
      const totalFixedCordobas = fixedBills.reduce((sum, b) => sum + (b.amount_cordobas || b.amount || 0), 0);
      const totalFixedDollars = fixedBills.reduce((sum, b) => sum + (b.amount_usd || b.amount_dollars || 0), 0);
      const totalVariableCordobas = variableBills.reduce((sum, b) => sum + (b.amount_cordobas || b.amount || 0), 0);
      const totalVariableDollars = variableBills.reduce((sum, b) => sum + (b.amount_usd || b.amount_dollars || 0), 0);
      const totalExpensesCordobas = totalFixedCordobas + totalVariableCordobas;
      const totalExpensesDollars = totalFixedDollars + totalVariableDollars;
      
      const netProfitCordobas = totalProceduresCordobas - totalExpensesCordobas;
      const netProfitDollars = totalProceduresDollars - totalExpensesDollars;
      
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
      
      // Pipe del documento a la respuesta
      doc.pipe(res);
      
      // =========== ENCABEZADO ===========
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#2196F3')
         .text('CARE U SMILE', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(14).font('Helvetica').fillColor('#000000')
         .text('Reporte de Cierre Diario', { align: 'center' });
      doc.moveDown(0.3);
      
      let dateText = `Fecha: ${formatNicaraguaDate(closing.closing_date)}`;
      if (closing.closing_type === 'orthodontics') {
        dateText += ' (Ortodoncia)';
      }
      
      doc.fontSize(12).text(dateText, { align: 'center' });
      doc.moveDown(1);
      
      // Línea separadora
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#CCCCCC').stroke();
      doc.moveDown(1);
      
      // Información de fecha
      doc.fontSize(9).text(`Fecha de generación: ${formatNicaraguaDate(new Date().toISOString())}`, { align: 'right' });
      doc.moveDown(1.5);
      
      // Dimensiones de tabla
      const startX = 50;
      const col1Width = 250;
      const col2Width = 100;
      const col3Width = 100;
      
      // =========== SECCIÓN INGRESOS ===========
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#4CAF50')
         .text('* INGRESOS', { underline: true });
      doc.moveDown(0.5);
      
      // Encabezado de tabla
      let currentY = drawTableHeader(doc, startX, doc.y, col1Width, col2Width, col3Width);
      doc.y = currentY;
      
      // Subsección: Consultas Generales
      doc.fontSize(10).font('Helvetica-Bold')
         .text('- Consultas Generales', startX, doc.y);
      doc.moveDown(0.3);
      
      // Lista de consultas generales
      if (generalProcedures.length > 0) {
        doc.fontSize(9).font('Helvetica');
        generalProcedures.forEach((proc, index) => {
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          const procDesc = proc.procedure_description || 'Consulta';
          
          drawTableRow(
            doc, startX, doc.y, col1Width, col2Width, col3Width,
            `  ${index + 1}. ${procDesc} - ${patientName}`,
            proc.total_procedure || 0,
            proc.total_procedure_usd || 0
          );
        });
      } else {
        doc.text('  No hay consultas generales', startX + 10, doc.y);
        doc.moveDown(0.5);
      }
      
      // Línea separadora antes del subtotal
      doc.moveDown(0.3);
      doc.moveTo(startX + 10, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 20, doc.y)
         .strokeColor('#CCCCCC').stroke();
      doc.moveDown(0.3);
      
      // Subtotal General
      doc.y = drawTableRow(
        doc, startX, doc.y, col1Width, col2Width, col3Width,
        '- Subtotal General',
        totalGeneralCordobas,
        totalGeneralDollars,
        true
      );
      
      doc.moveDown(0.8);
      
      // Subsección: Consultas de Ortodoncia
      doc.fontSize(10).font('Helvetica-Bold')
         .text('- Consultas de Ortodoncia', startX, doc.y);
      doc.moveDown(0.3);
      
      // Lista de consultas de ortodoncia
      if (orthoProcedures.length > 0) {
        doc.fontSize(9).font('Helvetica');
        orthoProcedures.forEach((proc, index) => {
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          const procDesc = proc.procedure_description || 'Ortodoncia';
          
          drawTableRow(
            doc, startX, doc.y, col1Width, col2Width, col3Width,
            `  ${index + 1}. ${procDesc} - ${patientName}`,
            proc.total_procedure || 0,
            proc.total_procedure_usd || 0
          );
        });
      } else {
        doc.text('  No hay consultas de ortodoncia', startX + 10, doc.y);
        doc.moveDown(0.5);
      }
      
      // Línea separadora antes del subtotal
      doc.moveDown(0.3);
      doc.moveTo(startX + 10, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 20, doc.y)
         .strokeColor('#CCCCCC').stroke();
      doc.moveDown(0.3);
      
      // Subtotal Ortodoncia
      doc.y = drawTableRow(
        doc, startX, doc.y, col1Width, col2Width, col3Width,
        '- Subtotal Ortodoncia',
        totalOrthoCordobas,
        totalOrthoDollars,
        true
      );
      
      doc.moveDown(0.8);
      
      // Línea gruesa antes del total
      doc.moveTo(startX, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 30, doc.y)
         .strokeColor('#000000').lineWidth(1.5).stroke();
      doc.moveDown(0.5);
      
      // Total Procedimientos
      doc.y = drawTableRow(
        doc, startX, doc.y, col1Width, col2Width, col3Width,
        'TOTAL PROCEDIMIENTOS',
        totalProceduresCordobas,
        totalProceduresDollars,
        true
      );
      doc.moveDown(1.5);
      
      // =========== SECCIÓN GASTOS ===========
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#FF9800')
         .text('* GASTOS', { underline: true });
      doc.moveDown(0.5);
      
      // Encabezado de tabla para gastos
      currentY = drawTableHeader(doc, startX, doc.y, col1Width, col2Width, col3Width);
      doc.y = currentY;
      
      // Subsección: Gastos Fijos
      doc.fontSize(10).font('Helvetica-Bold')
         .text('- Gastos Fijos', startX, doc.y);
      doc.moveDown(0.3);
      
      // Lista de gastos fijos
      if (fixedBills.length > 0) {
        doc.fontSize(9).font('Helvetica');
        fixedBills.forEach((bill, index) => {
          const desc = bill.description || 'Gasto fijo';
          
          drawTableRow(
            doc, startX, doc.y, col1Width, col2Width, col3Width,
            `  ${index + 1}. ${desc}`,
            bill.amount_cordobas || bill.amount || 0,
            bill.amount_usd || bill.amount_dollars || 0
          );
        });
      } else {
        doc.text('  No hay gastos fijos', startX + 10, doc.y);
        doc.moveDown(0.5);
      }
      
      // Línea separadora antes del subtotal
      doc.moveDown(0.3);
      doc.moveTo(startX + 10, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 20, doc.y)
         .strokeColor('#CCCCCC').stroke();
      doc.moveDown(0.3);
      
      // Subtotal Gastos Fijos
      doc.y = drawTableRow(
        doc, startX, doc.y, col1Width, col2Width, col3Width,
        '- Subtotal Gastos Fijos',
        totalFixedCordobas,
        totalFixedDollars,
        true
      );
      
      doc.moveDown(0.8);
      
      // Subsección: Gastos Variables
      doc.fontSize(10).font('Helvetica-Bold')
         .text('- Gastos Variables', startX, doc.y);
      doc.moveDown(0.3);
      
      // Lista de gastos variables
      if (variableBills.length > 0) {
        doc.fontSize(9).font('Helvetica');
        variableBills.forEach((bill, index) => {
          const desc = bill.description || 'Gasto variable';
          
          drawTableRow(
            doc, startX, doc.y, col1Width, col2Width, col3Width,
            `  ${index + 1}. ${desc}`,
            bill.amount_cordobas || bill.amount || 0,
            bill.amount_usd || bill.amount_dollars || 0
          );
        });
      } else {
        doc.text('  No hay gastos variables', startX + 10, doc.y);
        doc.moveDown(0.5);
      }
      
      // Línea separadora antes del subtotal
      doc.moveDown(0.3);
      doc.moveTo(startX + 10, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 20, doc.y)
         .strokeColor('#CCCCCC').stroke();
      doc.moveDown(0.3);
      
      // Subtotal Gastos Variables
      doc.y = drawTableRow(
        doc, startX, doc.y, col1Width, col2Width, col3Width,
        '- Subtotal Gastos Variables',
        totalVariableCordobas,
        totalVariableDollars,
        true
      );
      
      doc.moveDown(0.8);
      
      // Línea gruesa antes del total
      doc.moveTo(startX, doc.y).lineTo(startX + col1Width + col2Width + col3Width + 30, doc.y)
         .strokeColor('#000000').lineWidth(1.5).stroke();
      doc.moveDown(0.5);
      
      // Total Gastos
      doc.y = drawTableRow(
        doc, startX, doc.y, col1Width, col2Width, col3Width,
        'TOTAL GASTOS',
        totalExpensesCordobas,
        totalExpensesDollars,
        true
      );
      doc.moveDown(1.5);
      
      // =========== SECCIÓN RESULTADO FINAL ===========
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#9C27B0')
         .text('* RESULTADO FINAL', { underline: true });
      doc.moveDown(0.8);
      
      // Marco para resumen final
      const summaryBoxY = doc.y;
      doc.rect(startX - 5, summaryBoxY - 10, 510, 100)
         .strokeColor('#9C27B0')
         .lineWidth(1)
         .stroke();
      
      // Fila 1: Ingresos Totales
      doc.fontSize(12).font('Helvetica-Bold')
         .text('Ingresos Totales:', startX + 10, summaryBoxY);
      doc.fontSize(12).font('Helvetica')
         .text(formatCurrency(totalProceduresCordobas, 'NIO'), startX + 150, summaryBoxY);
      doc.text(formatCurrency(totalProceduresDollars, 'USD'), startX + 350, summaryBoxY, { align: 'right' });
      
      // Fila 2: Gastos Totales
      doc.fontSize(12).font('Helvetica-Bold')
         .text('Gastos Totales:', startX + 10, summaryBoxY + 25);
      doc.fontSize(12).font('Helvetica')
         .text(`-${formatCurrency(totalExpensesCordobas, 'NIO')}`, startX + 150, summaryBoxY + 25);
      doc.text(`-${formatCurrency(totalExpensesDollars, 'USD')}`, startX + 350, summaryBoxY + 25, { align: 'right' });
      
      // Línea separadora
      doc.moveTo(startX + 10, summaryBoxY + 50).lineTo(startX + 500, summaryBoxY + 50)
         .strokeColor('#9C27B0').stroke();
      
      // Fila 3: Utilidad Neta (DESTACADA)
      doc.fontSize(14).font('Helvetica-Bold')
         .text('UTILIDAD NETA:', startX + 10, summaryBoxY + 65);
      doc.fontSize(14).font('Helvetica-Bold')
         .fillColor(netProfitCordobas >= 0 ? '#4CAF50' : '#F44336')
         .text(formatCurrency(netProfitCordobas, 'NIO'), startX + 150, summaryBoxY + 65);
      doc.text(formatCurrency(netProfitDollars, 'USD'), startX + 350, summaryBoxY + 65, { align: 'right' });
      
      doc.y = summaryBoxY + 120;
      
      // Comentarios
      if (closing.comentary) {
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica-Bold').text('COMENTARIOS:', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(9).font('Helvetica').text(closing.comentary, { 
          width: 500,
          align: 'left' 
        });
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
        error: 'Error al generar PDF diario' 
      });
    }
  },

  // Exportar cierre mensual a Excel con NUEVO FORMATO
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
      
      // Separar procedimientos generales y de ortodoncia
      const generalProcedures = procedures ? procedures.filter(p => !p.is_orthodontics) : [];
      const orthoProcedures = procedures ? procedures.filter(p => p.is_orthodontics) : [];
      
      // Obtener gastos del período con desglose fijo/variable
      const { data: bills, error: billsError } = await supabaseAdmin
        .from('bills')
        .select('*')
        .gte('bill_date', periodStartDate)
        .lte('bill_date', periodEndDate)
        .order('bill_date', { ascending: true });
      
      if (billsError && billsError.code !== 'PGRST116') throw billsError;
      
      // Filtrar gastos fijos y variables
      const fixedBills = bills ? bills.filter(bill => bill.is_recurrent) : [];
      const variableBills = bills ? bills.filter(bill => !bill.is_recurrent) : [];
      
      // Calcular totales
      const totalGeneralCordobas = generalProcedures.reduce((sum, p) => sum + (p.total_procedure || 0), 0);
      const totalGeneralDollars = generalProcedures.reduce((sum, p) => sum + (p.total_procedure_usd || 0), 0);
      const totalOrthoCordobas = orthoProcedures.reduce((sum, p) => sum + (p.total_procedure || 0), 0);
      const totalOrthoDollars = orthoProcedures.reduce((sum, p) => sum + (p.total_procedure_usd || 0), 0);
      const totalProceduresCordobas = totalGeneralCordobas + totalOrthoCordobas;
      const totalProceduresDollars = totalGeneralDollars + totalOrthoDollars;
      
      // Calcular totales de gastos
      const totalFixedCordobas = fixedBills.reduce((sum, b) => sum + (b.amount_cordobas || b.amount || 0), 0);
      const totalFixedDollars = fixedBills.reduce((sum, b) => sum + (b.amount_usd || b.amount_dollars || 0), 0);
      const totalVariableCordobas = variableBills.reduce((sum, b) => sum + (b.amount_cordobas || b.amount || 0), 0);
      const totalVariableDollars = variableBills.reduce((sum, b) => sum + (b.amount_usd || b.amount_dollars || 0), 0);
      const totalExpensesCordobas = totalFixedCordobas + totalVariableCordobas;
      const totalExpensesDollars = totalFixedDollars + totalVariableDollars;
      
      const netProfitCordobas = totalProceduresCordobas - totalExpensesCordobas;
      const netProfitDollars = totalProceduresDollars - totalExpensesDollars;
      
      // Crear workbook de Excel
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Care U Smile';
      workbook.created = new Date();
      
      // Hoja 1: RESUMEN MENSUAL (NUEVO FORMATO)
      const summarySheet = workbook.addWorksheet('RESUMEN MENSUAL');
      
      // Configurar anchos de columna
      summarySheet.columns = [
        { header: 'CONSULTAS', key: 'description', width: 40 },
        { header: 'TOTAL CÓRDOBAS', key: 'cordobas', width: 20 },
        { header: 'TOTAL DÓLARES', key: 'dollars', width: 20 }
      ];
      
      // Título
      const titleRow = summarySheet.addRow(['CARE U SMILE', '', '']);
      titleRow.font = { bold: true, size: 16 };
      titleRow.alignment = { horizontal: 'center' };
      summarySheet.mergeCells('A1:C1');
      
      summarySheet.addRow(['Reporte de Cierre Mensual', '', '']);
      summarySheet.mergeCells('A2:C2');
      
      summarySheet.addRow([`${closing.month.toUpperCase()} ${closing.year}`, '', '']);
      summarySheet.mergeCells('A3:C3');
      
      summarySheet.addRow([`Fecha de generación: ${formatNicaraguaDate(new Date().toISOString())}`, '', '']);
      summarySheet.mergeCells('A4:C4');
      
      summarySheet.addRow(['', '', '']); // Espacio
      
      // *INGRESOS
      const incomeHeader = summarySheet.addRow(['*INGRESOS', '', '']);
      incomeHeader.font = { bold: true, size: 14 };
      incomeHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F5E9' }
      };
      summarySheet.mergeCells('A6:C6');
      
      // Encabezado de tabla
      const tableHeader = summarySheet.addRow(['Consultas', 'Total Córdobas', 'Total Dólares']);
      tableHeader.font = { bold: true };
      tableHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2196F3' }
      };
      tableHeader.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      
      summarySheet.addRow(['', '', '']);
      
      // -Consultas Generales
      const generalHeader = summarySheet.addRow(['-Consultas Generales', '', '']);
      generalHeader.font = { bold: true };
      
      // Lista de consultas generales
      if (generalProcedures.length > 0) {
        generalProcedures.forEach(proc => {
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          const procDesc = proc.procedure_description || 'Consulta';
          
          summarySheet.addRow([
            `${procDesc} - ${patientName}`,
            proc.total_procedure || 0,
            proc.total_procedure_usd || 0
          ]);
        });
      } else {
        summarySheet.addRow(['No hay consultas generales', '', '']);
      }
      
      summarySheet.addRow(['', '', '']);
      
      // -Subtotal General
      const subtotalGeneral = summarySheet.addRow(['-Subtotal General', totalGeneralCordobas, totalGeneralDollars]);
      subtotalGeneral.font = { bold: true };
      subtotalGeneral.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F8E9' }
      };
      
      summarySheet.addRow(['', '', '']);
      
      // -Consultas de Ortodoncia
      const orthoHeader = summarySheet.addRow(['-Consultas de Ortodoncia', '', '']);
      orthoHeader.font = { bold: true };
      
      // Lista de consultas de ortodoncia
      if (orthoProcedures.length > 0) {
        orthoProcedures.forEach(proc => {
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          const procDesc = proc.procedure_description || 'Ortodoncia';
          
          summarySheet.addRow([
            `${procDesc} - ${patientName}`,
            proc.total_procedure || 0,
            proc.total_procedure_usd || 0
          ]);
        });
      } else {
        summarySheet.addRow(['No hay consultas de ortodoncia', '', '']);
      }
      
      summarySheet.addRow(['', '', '']);
      
      // -Subtotal Ortodoncia
      const subtotalOrtho = summarySheet.addRow(['-Subtotal Ortodoncia', totalOrthoCordobas, totalOrthoDollars]);
      subtotalOrtho.font = { bold: true };
      subtotalOrtho.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F8E9' }
      };
      
      summarySheet.addRow(['', '', '']);
      
      // -Total Procedimientos
      const totalProceduresRow = summarySheet.addRow(['-Total Procedimientos', totalProceduresCordobas, totalProceduresDollars]);
      totalProceduresRow.font = { bold: true, size: 12 };
      totalProceduresRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC8E6C9' }
      };
      
      summarySheet.addRow(['', '', '']);
      summarySheet.addRow(['', '', '']);
      
      // *GASTOS
      const expensesHeader = summarySheet.addRow(['*GASTOS', '', '']);
      expensesHeader.font = { bold: true, size: 14 };
      expensesHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF3E0' }
      };
      summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      
      // -Gastos Fijos
      const fixedHeader = summarySheet.addRow(['-Gastos Fijos', '', '']);
      fixedHeader.font = { bold: true };
      
      // Lista de gastos fijos
      if (fixedBills.length > 0) {
        fixedBills.forEach(bill => {
          const desc = bill.description || 'Gasto fijo';
          summarySheet.addRow([
            desc,
            bill.amount_cordobas || bill.amount || 0,
            bill.amount_usd || bill.amount_dollars || 0
          ]);
        });
      } else {
        summarySheet.addRow(['No hay gastos fijos', '', '']);
      }
      
      summarySheet.addRow(['', '', '']);
      
      // -Subtotal Gastos Fijos
      const subtotalFixed = summarySheet.addRow(['-Subtotal Gastos Fijos', totalFixedCordobas, totalFixedDollars]);
      subtotalFixed.font = { bold: true };
      subtotalFixed.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F3F3' }
      };
      
      summarySheet.addRow(['', '', '']);
      
      // -Gastos Variables
      const variableHeader = summarySheet.addRow(['-Gastos Variables', '', '']);
      variableHeader.font = { bold: true };
      
      // Lista de gastos variables
      if (variableBills.length > 0) {
        variableBills.forEach(bill => {
          const desc = bill.description || 'Gasto variable';
          summarySheet.addRow([
            desc,
            bill.amount_cordobas || bill.amount || 0,
            bill.amount_usd || bill.amount_dollars || 0
          ]);
        });
      } else {
        summarySheet.addRow(['No hay gastos variables', '', '']);
      }
      
      summarySheet.addRow(['', '', '']);
      
      // -Subtotal Gastos Variables
      const subtotalVariable = summarySheet.addRow(['-Subtotal Gastos Variables', totalVariableCordobas, totalVariableDollars]);
      subtotalVariable.font = { bold: true };
      subtotalVariable.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F3F3' }
      };
      
      summarySheet.addRow(['', '', '']);
      
      // -Total Gastos
      const totalExpensesRow = summarySheet.addRow(['-Total Gastos', totalExpensesCordobas, totalExpensesDollars]);
      totalExpensesRow.font = { bold: true, size: 12 };
      totalExpensesRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFCC80' }
      };
      
      summarySheet.addRow(['', '', '']);
      summarySheet.addRow(['', '', '']);
      
      // *RESULTADO FINAL
      const resultHeader = summarySheet.addRow(['*RESULTADO FINAL', '', '']);
      resultHeader.font = { bold: true, size: 14 };
      resultHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3E5F5' }
      };
      summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      
      summarySheet.addRow(['', '', '']);
      
      // Ingresos Totales
      const totalIncomeRow = summarySheet.addRow(['Ingresos Totales', totalProceduresCordobas, totalProceduresDollars]);
      totalIncomeRow.font = { bold: true };
      
      summarySheet.addRow(['', '', '']);
      
      // Gastos Totales
      const totalExpensesFinalRow = summarySheet.addRow(['Gastos Totales', totalExpensesCordobas, totalExpensesDollars]);
      totalExpensesFinalRow.font = { bold: true };
      
      summarySheet.addRow(['', '', '']);
      
      // Utilidad Neta
      const netProfitRow = summarySheet.addRow(['Utilidad Neta', netProfitCordobas, netProfitDollars]);
      netProfitRow.font = { bold: true, size: 12 };
      netProfitRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3E5F5' }
      };
      netProfitRow.getCell(2).font = { 
        bold: true, 
        size: 12,
        color: { argb: netProfitCordobas >= 0 ? 'FF4CAF50' : 'FFF44336' }
      };
      netProfitRow.getCell(3).font = { 
        bold: true, 
        size: 12,
        color: { argb: netProfitDollars >= 0 ? 'FF4CAF50' : 'FFF44336' }
      };
      
      summarySheet.addRow(['', '', '']);
      
      // Margen de Utilidad
      if (totalProceduresCordobas > 0) {
        const profitMargin = ((netProfitCordobas / totalProceduresCordobas) * 100).toFixed(2);
        const marginRow = summarySheet.addRow(['Margen de Utilidad', `${profitMargin}%`, '']);
        marginRow.font = { bold: true };
        summarySheet.mergeCells(`B${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      }
      
      // Comentarios
      if (closing.comentary) {
        summarySheet.addRow(['', '', '']);
        summarySheet.addRow(['COMENTARIOS:', '', '']);
        summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
        summarySheet.addRow([closing.comentary, '', '']);
        summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      }
      
      // Aplicar formato de moneda a las columnas
      summarySheet.eachRow((row, rowNumber) => {
        if (rowNumber > 8 && row.getCell(2).value && typeof row.getCell(2).value === 'number') {
          row.getCell(2).numFmt = '"C$"#,##0.00';
        }
        if (rowNumber > 8 && row.getCell(3).value && typeof row.getCell(3).value === 'number') {
          row.getCell(3).numFmt = '"$"#,##0.00';
        }
      });
      
      // Hoja 2: DETALLE COMPLETO (opcional)
      if ((generalProcedures.length + orthoProcedures.length) > 0) {
        const detailSheet = workbook.addWorksheet('DETALLE COMPLETO');
        
        detailSheet.columns = [
          { header: 'FECHA', key: 'date', width: 15 },
          { header: 'PACIENTE', key: 'patient', width: 30 },
          { header: 'PROCEDIMIENTO', key: 'procedure', width: 40 },
          { header: 'TIPO', key: 'type', width: 15 },
          { header: 'MONTO C$', key: 'cordobas', width: 15 },
          { header: 'MONTO $', key: 'dollars', width: 15 },
          { header: 'MÉTODO PAGO', key: 'payment', width: 20 }
        ];
        
        // Encabezado
        const detailHeader = detailSheet.getRow(1);
        detailHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        detailHeader.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4CAF50' }
        };
        detailHeader.alignment = { horizontal: 'center' };
        
        // Agregar todos los procedimientos
        const allProcedures = [...generalProcedures, ...orthoProcedures];
        allProcedures.forEach(proc => {
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          
          detailSheet.addRow({
            date: formatNicaraguaDate(proc.procedure_date),
            patient: patientName,
            procedure: proc.procedure_description || 'Sin descripción',
            type: proc.is_orthodontics ? 'Ortodoncia' : 'General',
            cordobas: proc.total_procedure || 0,
            dollars: proc.total_procedure_usd || 0,
            payment: proc.payment_method || 'No especificado'
          });
        });
        
        // Aplicar formato de moneda
        detailSheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            row.getCell(5).numFmt = '"C$"#,##0.00';
            row.getCell(6).numFmt = '"$"#,##0.00';
          }
        });
      }
      
      // Configurar nombre del archivo
      const fileName = `Cierre_${closing.month}_${closing.year}_Nuevo_Formato_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Configurar respuesta
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      // Escribir Excel a la respuesta
      await workbook.xlsx.write(res);
      res.end();
      
    } catch (error) {
      console.error('Error al exportar Excel detallado:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al generar Excel detallado' 
      });
    }
  },

  // Exportar cierre diario a Excel con NUEVO FORMATO
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
            *,
            patients (first_name, first_last_name)
          )
        `)
        .eq('daily_closing_id', closingId);
      
      if (relationsError) throw relationsError;
      
      // Separar procedimientos por tipo
      const generalProcedures = [];
      const orthoProcedures = [];
      
      if (procedureRelations) {
        procedureRelations.forEach(relation => {
          const proc = relation.procedures;
          if (!proc) return;
          
          if (proc.is_orthodontics) {
            orthoProcedures.push(proc);
          } else {
            generalProcedures.push(proc);
          }
        });
      }
      
      // Obtener gastos del día
      const { data: bills, error: billsError } = await supabaseAdmin
        .from('bills')
        .select('*')
        .eq('bill_date', closing.closing_date)
        .order('bill_date', { ascending: true });
      
      if (billsError && billsError.code !== 'PGRST116') throw billsError;
      
      // Filtrar gastos fijos y variables
      const fixedBills = bills ? bills.filter(bill => bill.is_recurrent) : [];
      const variableBills = bills ? bills.filter(bill => !bill.is_recurrent) : [];
      
      // Calcular totales
      const totalGeneralCordobas = generalProcedures.reduce((sum, p) => sum + (p.total_procedure || 0), 0);
      const totalGeneralDollars = generalProcedures.reduce((sum, p) => sum + (p.total_procedure_usd || 0), 0);
      const totalOrthoCordobas = orthoProcedures.reduce((sum, p) => sum + (p.total_procedure || 0), 0);
      const totalOrthoDollars = orthoProcedures.reduce((sum, p) => sum + (p.total_procedure_usd || 0), 0);
      const totalProceduresCordobas = totalGeneralCordobas + totalOrthoCordobas;
      const totalProceduresDollars = totalGeneralDollars + totalOrthoDollars;
      
      // Calcular totales de gastos
      const totalFixedCordobas = fixedBills.reduce((sum, b) => sum + (b.amount_cordobas || b.amount || 0), 0);
      const totalFixedDollars = fixedBills.reduce((sum, b) => sum + (b.amount_usd || b.amount_dollars || 0), 0);
      const totalVariableCordobas = variableBills.reduce((sum, b) => sum + (b.amount_cordobas || b.amount || 0), 0);
      const totalVariableDollars = variableBills.reduce((sum, b) => sum + (b.amount_usd || b.amount_dollars || 0), 0);
      const totalExpensesCordobas = totalFixedCordobas + totalVariableCordobas;
      const totalExpensesDollars = totalFixedDollars + totalVariableDollars;
      
      const netProfitCordobas = totalProceduresCordobas - totalExpensesCordobas;
      const netProfitDollars = totalProceduresDollars - totalExpensesDollars;
      
      // Crear workbook de Excel
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Care U Smile';
      workbook.created = new Date();
      
      // Hoja 1: RESUMEN DIARIO (NUEVO FORMATO)
      const summarySheet = workbook.addWorksheet('RESUMEN DIARIO');
      
      // Configurar anchos de columna
      summarySheet.columns = [
        { header: 'CONSULTAS', key: 'description', width: 40 },
        { header: 'TOTAL CÓRDOBAS', key: 'cordobas', width: 20 },
        { header: 'TOTAL DÓLARES', key: 'dollars', width: 20 }
      ];
      
      // Título
      const titleRow = summarySheet.addRow(['CARE U SMILE', '', '']);
      titleRow.font = { bold: true, size: 16 };
      titleRow.alignment = { horizontal: 'center' };
      summarySheet.mergeCells('A1:C1');
      
      summarySheet.addRow(['Reporte de Cierre Diario', '', '']);
      summarySheet.mergeCells('A2:C2');
      
      summarySheet.addRow([`Fecha: ${formatNicaraguaDate(closing.closing_date)}`, '', '']);
      summarySheet.mergeCells('A3:C3');
      
      if (closing.closing_type === 'orthodontics') {
        summarySheet.addRow(['(Cierre de Ortodoncia)', '', '']);
        summarySheet.mergeCells('A4:C4');
      }
      
      summarySheet.addRow([`Fecha de generación: ${formatNicaraguaDate(new Date().toISOString())}`, '', '']);
      summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      
      summarySheet.addRow(['', '', '']); // Espacio
      
      // *INGRESOS
      const incomeHeader = summarySheet.addRow(['*INGRESOS', '', '']);
      incomeHeader.font = { bold: true, size: 14 };
      incomeHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F5E9' }
      };
      summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      
      // Encabezado de tabla
      const tableHeader = summarySheet.addRow(['Consultas', 'Total Córdobas', 'Total Dólares']);
      tableHeader.font = { bold: true };
      tableHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2196F3' }
      };
      tableHeader.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      
      summarySheet.addRow(['', '', '']);
      
      // -Consultas Generales
      const generalHeader = summarySheet.addRow(['-Consultas Generales', '', '']);
      generalHeader.font = { bold: true };
      
      // Lista de consultas generales
      if (generalProcedures.length > 0) {
        generalProcedures.forEach(proc => {
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          const procDesc = proc.procedure_description || 'Consulta';
          
          summarySheet.addRow([
            `${procDesc} - ${patientName}`,
            proc.total_procedure || 0,
            proc.total_procedure_usd || 0
          ]);
        });
      } else {
        summarySheet.addRow(['No hay consultas generales', '', '']);
      }
      
      summarySheet.addRow(['', '', '']);
      
      // -Subtotal General
      const subtotalGeneral = summarySheet.addRow(['-Subtotal General', totalGeneralCordobas, totalGeneralDollars]);
      subtotalGeneral.font = { bold: true };
      subtotalGeneral.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F8E9' }
      };
      
      summarySheet.addRow(['', '', '']);
      
      // -Consultas de Ortodoncia
      const orthoHeader = summarySheet.addRow(['-Consultas de Ortodoncia', '', '']);
      orthoHeader.font = { bold: true };
      
      // Lista de consultas de ortodoncia
      if (orthoProcedures.length > 0) {
        orthoProcedures.forEach(proc => {
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          const procDesc = proc.procedure_description || 'Ortodoncia';
          
          summarySheet.addRow([
            `${procDesc} - ${patientName}`,
            proc.total_procedure || 0,
            proc.total_procedure_usd || 0
          ]);
        });
      } else {
        summarySheet.addRow(['No hay consultas de ortodoncia', '', '']);
      }
      
      summarySheet.addRow(['', '', '']);
      
      // -Subtotal Ortodoncia
      const subtotalOrtho = summarySheet.addRow(['-Subtotal Ortodoncia', totalOrthoCordobas, totalOrthoDollars]);
      subtotalOrtho.font = { bold: true };
      subtotalOrtho.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F8E9' }
      };
      
      summarySheet.addRow(['', '', '']);
      
      // -Total Procedimientos
      const totalProceduresRow = summarySheet.addRow(['-Total Procedimientos', totalProceduresCordobas, totalProceduresDollars]);
      totalProceduresRow.font = { bold: true, size: 12 };
      totalProceduresRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC8E6C9' }
      };
      
      summarySheet.addRow(['', '', '']);
      summarySheet.addRow(['', '', '']);
      
      // *GASTOS
      const expensesHeader = summarySheet.addRow(['*GASTOS', '', '']);
      expensesHeader.font = { bold: true, size: 14 };
      expensesHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF3E0' }
      };
      summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      
      // -Gastos Fijos
      const fixedHeader = summarySheet.addRow(['-Gastos Fijos', '', '']);
      fixedHeader.font = { bold: true };
      
      // Lista de gastos fijos
      if (fixedBills.length > 0) {
        fixedBills.forEach(bill => {
          const desc = bill.description || 'Gasto fijo';
          summarySheet.addRow([
            desc,
            bill.amount_cordobas || bill.amount || 0,
            bill.amount_usd || bill.amount_dollars || 0
          ]);
        });
      } else {
        summarySheet.addRow(['No hay gastos fijos', '', '']);
      }
      
      summarySheet.addRow(['', '', '']);
      
      // -Subtotal Gastos Fijos
      const subtotalFixed = summarySheet.addRow(['-Subtotal Gastos Fijos', totalFixedCordobas, totalFixedDollars]);
      subtotalFixed.font = { bold: true };
      subtotalFixed.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F3F3' }
      };
      
      summarySheet.addRow(['', '', '']);
      
      // -Gastos Variables
      const variableHeader = summarySheet.addRow(['-Gastos Variables', '', '']);
      variableHeader.font = { bold: true };
      
      // Lista de gastos variables
      if (variableBills.length > 0) {
        variableBills.forEach(bill => {
          const desc = bill.description || 'Gasto variable';
          summarySheet.addRow([
            desc,
            bill.amount_cordobas || bill.amount || 0,
            bill.amount_usd || bill.amount_dollars || 0
          ]);
        });
      } else {
        summarySheet.addRow(['No hay gastos variables', '', '']);
      }
      
      summarySheet.addRow(['', '', '']);
      
      // -Subtotal Gastos Variables
      const subtotalVariable = summarySheet.addRow(['-Subtotal Gastos Variables', totalVariableCordobas, totalVariableDollars]);
      subtotalVariable.font = { bold: true };
      subtotalVariable.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F3F3' }
      };
      
      summarySheet.addRow(['', '', '']);
      
      // -Total Gastos
      const totalExpensesRow = summarySheet.addRow(['-Total Gastos', totalExpensesCordobas, totalExpensesDollars]);
      totalExpensesRow.font = { bold: true, size: 12 };
      totalExpensesRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFCC80' }
      };
      
      summarySheet.addRow(['', '', '']);
      summarySheet.addRow(['', '', '']);
      
      // *RESULTADO FINAL
      const resultHeader = summarySheet.addRow(['*RESULTADO FINAL', '', '']);
      resultHeader.font = { bold: true, size: 14 };
      resultHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3E5F5' }
      };
      summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      
      summarySheet.addRow(['', '', '']);
      
      // Ingresos Totales
      const totalIncomeRow = summarySheet.addRow(['Ingresos Totales', totalProceduresCordobas, totalProceduresDollars]);
      totalIncomeRow.font = { bold: true };
      
      summarySheet.addRow(['', '', '']);
      
      // Gastos Totales
      const totalExpensesFinalRow = summarySheet.addRow(['Gastos Totales', totalExpensesCordobas, totalExpensesDollars]);
      totalExpensesFinalRow.font = { bold: true };
      
      summarySheet.addRow(['', '', '']);
      
      // Utilidad Neta
      const netProfitRow = summarySheet.addRow(['Utilidad Neta', netProfitCordobas, netProfitDollars]);
      netProfitRow.font = { bold: true, size: 12 };
      netProfitRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3E5F5' }
      };
      netProfitRow.getCell(2).font = { 
        bold: true, 
        size: 12,
        color: { argb: netProfitCordobas >= 0 ? 'FF4CAF50' : 'FFF44336' }
      };
      netProfitRow.getCell(3).font = { 
        bold: true, 
        size: 12,
        color: { argb: netProfitDollars >= 0 ? 'FF4CAF50' : 'FFF44336' }
      };
      
      summarySheet.addRow(['', '', '']);
      
      // Margen de Utilidad
      if (totalProceduresCordobas > 0) {
        const profitMargin = ((netProfitCordobas / totalProceduresCordobas) * 100).toFixed(2);
        const marginRow = summarySheet.addRow(['Margen de Utilidad', `${profitMargin}%`, '']);
        marginRow.font = { bold: true };
        summarySheet.mergeCells(`B${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      }
      
      // Comentarios
      if (closing.comentary) {
        summarySheet.addRow(['', '', '']);
        summarySheet.addRow(['COMENTARIOS:', '', '']);
        summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
        summarySheet.addRow([closing.comentary, '', '']);
        summarySheet.mergeCells(`A${summarySheet.rowCount}:C${summarySheet.rowCount}`);
      }
      
      // Aplicar formato de moneda a las columnas
      summarySheet.eachRow((row, rowNumber) => {
        if (rowNumber > 8 && row.getCell(2).value && typeof row.getCell(2).value === 'number') {
          row.getCell(2).numFmt = '"C$"#,##0.00';
        }
        if (rowNumber > 8 && row.getCell(3).value && typeof row.getCell(3).value === 'number') {
          row.getCell(3).numFmt = '"$"#,##0.00';
        }
      });
      
      // Configurar nombre del archivo
      const fileName = `Cierre_Diario_${formatNicaraguaDate(closing.closing_date).replace(/\//g, '-')}_${closing.closing_type}_Nuevo_Formato_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Configurar respuesta
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      // Escribir Excel a la respuesta
      await workbook.xlsx.write(res);
      res.end();
      
    } catch (error) {
      console.error('Error al exportar Excel diario detallado:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al generar Excel diario detallado' 
      });
    }
  },

  // Exportar a Excel (general - mantener compatibilidad)
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
        
        // Formato simplificado para tabla general
        worksheet.columns = [
          { header: 'Mes', key: 'month', width: 15 },
          { header: 'Año', key: 'year', width: 10 },
          { header: 'Fecha Cierre', key: 'closing_date', width: 15 },
          { header: 'Ingresos Generales', key: 'total_general_income', width: 20 },
          { header: 'Ortodoncia (40%)', key: 'total_clinical_orthodontic_income', width: 20 },
          { header: 'Gastos Fijos', key: 'total_fixed_expenses', width: 15 },
          { header: 'Gastos Variables', key: 'total_variable_expenses', width: 15 },
          { header: 'Utilidad Neta', key: 'net_profit', width: 15 }
        ];
        
        closings.forEach(closing => {
          worksheet.addRow({
            month: closing.month,
            year: closing.year,
            closing_date: formatNicaraguaDate(closing.closing_date),
            total_general_income: closing.total_general_income,
            total_clinical_orthodontic_income: closing.total_clinical_orthodontic_income,
            total_fixed_expenses: closing.total_fixed_expenses,
            total_variable_expenses: closing.total_variable_expenses,
            net_profit: closing.net_profit
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
          { header: 'Ingresos Totales', key: 'total_income', width: 20 },
          { header: 'Ingresos Clínica', key: 'total_clinic_income', width: 20 },
          { header: 'Ingresos Doctora', key: 'total_doctor_income', width: 20 },
          { header: 'Pagos Externos', key: 'total_external_doctor_payments', width: 20 },
          { header: 'Utilidad Neta', key: 'net_profit', width: 15 },
          { header: 'Comentarios', key: 'comentary', width: 30 }
        ];
        
        closings.forEach(closing => {
          worksheet.addRow({
            closing_date: formatNicaraguaDate(closing.closing_date),
            closing_type: closing.closing_type === 'orthodontics' ? 'Ortodoncia' : 'General',
            total_income: closing.total_income,
            total_clinic_income: closing.total_clinic_income,
            total_doctor_income: closing.total_doctor_income,
            total_external_doctor_payments: closing.total_external_doctor_payments,
            net_profit: closing.net_profit,
            comentary: closing.comentary || ''
          });
        });
      }
      
      // Aplicar formato
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const relevantColumns = type === 'monthly' ? [4, 5, 6, 7, 8] : [3, 4, 5, 6, 7];
          relevantColumns.forEach(colNumber => {
            const cell = row.getCell(colNumber);
            if (cell.value !== null && cell.value !== undefined) {
              cell.numFmt = '"C$"#,##0.00';
              if ((type === 'monthly' && colNumber === 8) || (type === 'daily' && colNumber === 7)) {
                cell.font = { 
                  bold: true,
                  color: { argb: cell.value >= 0 ? 'FF4CAF50' : 'FFF44336' }
                };
              }
            }
          });
        }
      });
      
      // Estilo para encabezados
      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2196F3' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      await workbook.xlsx.write(res);
      res.end();
      
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al generar Excel' 
      });
    }
  }
};

export default exportController;