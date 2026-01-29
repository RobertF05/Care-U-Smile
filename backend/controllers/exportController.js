import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '../config/supabase.js';
import { formatNicaraguaDate } from '../utils/timezoneUtils.js';

// Función formatCurrency local
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    amount = 0;
  }
  
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const exportController = {
  // Exportar cierre mensual a PDF
  // Exportar cierre mensual a PDF - CORREGIDO
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
      
      // Crear documento PDF
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      
      // Configurar encabezados de respuesta
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Cierre_${closing.month}_${closing.year}_${new Date().toISOString().split('T')[0]}.pdf"`);
      
      // Pipe del documento a la respuesta
      doc.pipe(res);
      
      // Función para agregar pie de página
      const addFooter = (pageNumber, totalPages) => {
        doc.fontSize(8).font('Helvetica').fillColor('#666666')
          .text(`Página ${pageNumber} de ${totalPages}`, 50, doc.page.height - 50, { align: 'center' });
        doc.text('Care U Smile - Sistema de Gestión Odontológica', 50, doc.page.height - 35, { align: 'center' });
      };
      
      // Contador de páginas
      let pageNumber = 1;
      let totalPages = 1;
      
      // Encabezado
      doc.fontSize(20).font('Helvetica-Bold').text('CARE U SMILE', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(16).font('Helvetica').text('Reporte de Cierre Mensual', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).text(`${closing.month.toUpperCase()} ${closing.year}`, { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(10).text(`Fecha de generación: ${formatNicaraguaDate(new Date().toISOString())}`, { align: 'right' });
      doc.moveDown(2);
      
      // Sección 1: Resumen Ejecutivo
      doc.fontSize(14).font('Helvetica-Bold').text('RESUMEN EJECUTIVO', { underline: true });
      doc.moveDown(1);
      
      const summaryData = [
        ['DESCRIPCIÓN', 'VALOR'],
        ['INGRESOS', ''],
        ['Procedimientos Generales (100% clínica)', formatCurrency(closing.total_general_income)],
        ['Ortodoncia (40% Clínica)', formatCurrency(closing.total_clinical_orthodontic_income)],
        ['TOTAL INGRESOS CLÍNICA', formatCurrency(closing.total_general_income + closing.total_clinical_orthodontic_income)],
        ['', ''],
        ['GASTOS', ''],
        ['Gastos Fijos', formatCurrency(closing.total_fixed_expenses)],
        ['Gastos Variables', formatCurrency(closing.total_variable_expenses)],
        ['TOTAL GASTOS', formatCurrency(closing.total_fixed_expenses + closing.total_variable_expenses)],
        ['', ''],
        ['RESULTADO FINAL', ''],
        ['Ingresos Totales Clínica', formatCurrency(closing.total_general_income + closing.total_clinical_orthodontic_income)],
        ['Gastos Totales', formatCurrency(closing.total_fixed_expenses + closing.total_variable_expenses)],
        ['UTILIDAD NETA', formatCurrency(closing.net_profit)]
      ];
      
      const summaryTableTop = doc.y;
      const summaryTableLeft = 50;
      const summaryColWidths = [300, 150];
      
      doc.font('Helvetica');
      summaryData.forEach((row, rowIndex) => {
        const y = summaryTableTop + (rowIndex * 20);
        
        if (row[0] === 'INGRESOS' || row[0] === 'GASTOS' || row[0] === 'RESULTADO FINAL') {
          doc.font('Helvetica-Bold').fillColor('#000000');
          doc.rect(summaryTableLeft, y, summaryColWidths[0] + summaryColWidths[1], 20).fill('#F0F0F0');
        } else if (row[0] === 'UTILIDAD NETA') {
          doc.font('Helvetica-Bold').fillColor(closing.net_profit >= 0 ? '#4CAF50' : '#F44336');
        } else {
          doc.font('Helvetica').fillColor('#000000');
        }
        
        doc.text(row[0], summaryTableLeft + 5, y + 5, { width: summaryColWidths[0] - 10, continued: false });
        doc.text(row[1] || '', summaryTableLeft + summaryColWidths[0] + 5, y + 5, { width: summaryColWidths[1] - 10, align: 'right' });
      });
      
      // Agregar pie de página a la primera página
      addFooter(pageNumber, totalPages);
      
      // Sección 2: Detalle de Procedimientos
      if (procedures && procedures.length > 0) {
        doc.addPage();
        pageNumber++;
        totalPages++;
        
        doc.fontSize(14).font('Helvetica-Bold').text('DETALLE DE PROCEDIMIENTOS', { underline: true });
        doc.moveDown(1);
        
        const procData = [
          ['FECHA', 'PACIENTE', 'PROCEDIMIENTO', 'MONTO']
        ];
        
        procedures.forEach(proc => {
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          
          procData.push([
            formatNicaraguaDate(proc.procedure_date).split(' ')[0],
            patientName.substring(0, 30),
            proc.procedure_description || 'Sin descripción',
            formatCurrency(proc.total_procedure || proc.total_cost || 0)
          ]);
        });
        
        // Total
        const totalAmount = procedures.reduce((sum, proc) => sum + (proc.total_procedure || proc.total_cost || 0), 0);
        procData.push(['', '', 'TOTAL:', formatCurrency(totalAmount)]);
        
        const procTableTop = doc.y;
        const procTableLeft = 30;
        const procColWidths = [60, 100, 170, 80];
        
        doc.font('Helvetica');
        procData.forEach((row, rowIndex) => {
          const y = procTableTop + (rowIndex * 20);
          
          if (rowIndex === 0) {
            doc.font('Helvetica-Bold').fillColor('#FFFFFF');
            doc.rect(procTableLeft, y, procColWidths.reduce((a, b) => a + b, 0), 20).fill('#4CAF50');
          } else if (rowIndex === procData.length - 1) {
            doc.font('Helvetica-Bold').fillColor('#000000');
          } else {
            doc.font('Helvetica').fillColor('#000000');
            if (rowIndex % 2 === 0) {
              doc.rect(procTableLeft, y, procColWidths.reduce((a, b) => a + b, 0), 20).fill('#F9F9F9');
            }
          }
          
          doc.text(row[0], procTableLeft + 5, y + 5, { width: procColWidths[0] - 10 });
          doc.text(row[1], procTableLeft + procColWidths[0] + 5, y + 5, { width: procColWidths[1] - 10 });
          doc.text(row[2], procTableLeft + procColWidths[0] + procColWidths[1] + 5, y + 5, { width: procColWidths[2] - 10 });
          doc.text(row[3], procTableLeft + procColWidths[0] + procColWidths[1] + procColWidths[2] + 5, y + 5, { width: procColWidths[3] - 10, align: 'right' });
        });
        
        doc.moveDown(2);
        
        // Agregar pie de página a la segunda página
        addFooter(pageNumber, totalPages);
      }
      
      // Sección 3: Detalle de Gastos con desglose fijo/variable
      if (bills && bills.length > 0) {
        doc.addPage();
        pageNumber++;
        totalPages++;
        
        doc.fontSize(14).font('Helvetica-Bold').text('DETALLE DE GASTOS', { underline: true });
        doc.moveDown(1);
        
        // Gastos Fijos
        if (fixedBills.length > 0) {
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#2196F3').text('GASTOS FIJOS', { underline: true });
          doc.moveDown(0.5);
          
          const fixedData = [
            ['FECHA', 'DESCRIPCIÓN', 'CATEGORÍA', 'MONTO']
          ];
          
          fixedBills.forEach(bill => {
            fixedData.push([
              formatNicaraguaDate(bill.bill_date).split(' ')[0],
              bill.description || 'Sin descripción',
              bill.category || 'No categorizado',
              formatCurrency(bill.amount || 0)
            ]);
          });
          
          const fixedTotal = fixedBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
          fixedData.push(['', '', 'SUBTOTAL GASTOS FIJOS:', formatCurrency(fixedTotal)]);
          
          const fixedTableTop = doc.y;
          const fixedTableLeft = 30;
          const fixedColWidths = [60, 130, 100, 80];
          
          fixedData.forEach((row, rowIndex) => {
            const y = fixedTableTop + (rowIndex * 20);
            
            if (rowIndex === 0) {
              doc.font('Helvetica-Bold').fillColor('#FFFFFF');
              doc.rect(fixedTableLeft, y, fixedColWidths.reduce((a, b) => a + b, 0), 20).fill('#2196F3');
            } else if (rowIndex === fixedData.length - 1) {
              doc.font('Helvetica-Bold').fillColor('#000000');
            } else {
              doc.font('Helvetica').fillColor('#000000');
              if (rowIndex % 2 === 0) {
                doc.rect(fixedTableLeft, y, fixedColWidths.reduce((a, b) => a + b, 0), 20).fill('#F0F7FF');
              }
            }
            
            doc.text(row[0], fixedTableLeft + 5, y + 5, { width: fixedColWidths[0] - 10 });
            doc.text(row[1], fixedTableLeft + fixedColWidths[0] + 5, y + 5, { width: fixedColWidths[1] - 10 });
            doc.text(row[2], fixedTableLeft + fixedColWidths[0] + fixedColWidths[1] + 5, y + 5, { width: fixedColWidths[2] - 10 });
            doc.text(row[3], fixedTableLeft + fixedColWidths[0] + fixedColWidths[1] + fixedColWidths[2] + 5, y + 5, { width: fixedColWidths[3] - 10, align: 'right' });
          });
          
          doc.moveDown(2);
        }
        
        // Gastos Variables
        if (variableBills.length > 0) {
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#FF9800').text('GASTOS VARIABLES', { underline: true });
          doc.moveDown(0.5);
          
          const variableData = [
            ['FECHA', 'DESCRIPCIÓN', 'CATEGORÍA', 'MONTO']
          ];
          
          variableBills.forEach(bill => {
            variableData.push([
              formatNicaraguaDate(bill.bill_date).split(' ')[0],
              bill.description || 'Sin descripción',
              bill.category || 'No categorizado',
              formatCurrency(bill.amount || 0)
            ]);
          });
          
          const variableTotal = variableBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
          variableData.push(['', '', 'SUBTOTAL GASTOS VARIABLES:', formatCurrency(variableTotal)]);
          
          const variableTableTop = doc.y;
          const variableTableLeft = 30;
          const variableColWidths = [60, 130, 100, 80];
          
          variableData.forEach((row, rowIndex) => {
            const y = variableTableTop + (rowIndex * 20);
            
            if (rowIndex === 0) {
              doc.font('Helvetica-Bold').fillColor('#FFFFFF');
              doc.rect(variableTableLeft, y, variableColWidths.reduce((a, b) => a + b, 0), 20).fill('#FF9800');
            } else if (rowIndex === variableData.length - 1) {
              doc.font('Helvetica-Bold').fillColor('#000000');
            } else {
              doc.font('Helvetica').fillColor('#000000');
              if (rowIndex % 2 === 0) {
                doc.rect(variableTableLeft, y, variableColWidths.reduce((a, b) => a + b, 0), 20).fill('#FFF8E1');
              }
            }
            
            doc.text(row[0], variableTableLeft + 5, y + 5, { width: variableColWidths[0] - 10 });
            doc.text(row[1], variableTableLeft + variableColWidths[0] + 5, y + 5, { width: variableColWidths[1] - 10 });
            doc.text(row[2], variableTableLeft + variableColWidths[0] + variableColWidths[1] + 5, y + 5, { width: variableColWidths[2] - 10 });
            doc.text(row[3], variableTableLeft + variableColWidths[0] + variableColWidths[1] + variableColWidths[2] + 5, y + 5, { width: variableColWidths[3] - 10, align: 'right' });
          });
          
          doc.moveDown(1);
          
          // Total de todos los gastos
          doc.fontSize(12).font('Helvetica-Bold').text('TOTAL GENERAL DE GASTOS:', { continued: true });
          doc.font('Helvetica').text(` ${formatCurrency((fixedBills.reduce((sum, bill) => sum + (bill.amount || 0), 0) + variableBills.reduce((sum, bill) => sum + (bill.amount || 0), 0)))}`, { align: 'right' });
        }
        
        // Agregar pie de página a la tercera página
        addFooter(pageNumber, totalPages);
      }
      
      // Comentarios
      if (closing.comentary) {
        doc.addPage();
        pageNumber++;
        totalPages++;
        
        doc.fontSize(14).font('Helvetica-Bold').text('COMENTARIOS ADICIONALES', { underline: true });
        doc.moveDown(1);
        doc.fontSize(11).font('Helvetica').text(closing.comentary, { align: 'justify' });
        
        // Agregar pie de página a la página de comentarios
        addFooter(pageNumber, totalPages);
      }
      
      // Actualizar pies de página en todas las páginas anteriores
      // Esta es una solución alternativa que evita el error switchToPage
      // Nota: No podemos retroceder a páginas anteriores fácilmente en PDFKit
      // La mejor práctica es agregar el pie de página inmediatamente después de cada página
      
      doc.end();
      
    } catch (error) {
      console.error('Error al exportar PDF mensual:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al generar PDF mensual' 
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
      
      // Crear documento PDF
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      
      // Configurar encabezados de respuesta
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Cierre_Diario_${formatNicaraguaDate(closing.closing_date).replace(/\//g, '-')}_${closing.closing_type}_${new Date().toISOString().split('T')[0]}.pdf"`);
      
      // Pipe del documento a la respuesta
      doc.pipe(res);
      
      // Función para agregar pie de página
      const addFooter = (pageNumber, totalPages) => {
        doc.fontSize(8).font('Helvetica').fillColor('#666666')
          .text(`Página ${pageNumber} de ${totalPages}`, 50, doc.page.height - 50, { align: 'center' });
        doc.text('Care U Smile - Sistema de Gestión Odontológica', 50, doc.page.height - 35, { align: 'center' });
      };
      
      // Contador de páginas
      let pageNumber = 1;
      let totalPages = 1;
      
      // Encabezado
      doc.fontSize(20).font('Helvetica-Bold').text('CARE U SMILE', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(16).font('Helvetica').text('Reporte de Cierre Diario', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).text(`Fecha: ${formatNicaraguaDate(closing.closing_date)}`, { align: 'center' });
      
      if (closing.closing_type === 'orthodontics') {
        doc.fontSize(12).text('(Cierre de Ortodoncia)', { align: 'center', color: '#9C27B0' });
      }
      
      doc.moveDown(1);
      doc.fontSize(10).text(`Fecha de generación: ${formatNicaraguaDate(new Date().toISOString())}`, { align: 'right' });
      doc.moveDown(2);
      
      // Sección 1: Resumen del Día
      doc.fontSize(14).font('Helvetica-Bold').text('RESUMEN DEL DÍA', { underline: true });
      doc.moveDown(1);
      
      const summaryData = [
        ['DESCRIPCIÓN', 'VALOR'],
        ['Ingresos Totales', formatCurrency(closing.total_income)],
        ['Ingresos Clínica', formatCurrency(closing.total_clinic_income)]
      ];
      
      // Agregar pago doctora solo para ortodoncia
      if (closing.closing_type === 'orthodontics') {
        summaryData.push(['Pago Doctora Ortodoncia (60%)', formatCurrency(closing.total_doctor_income)]);
      }
      
      // Agregar pagos externos si existen
      if (closing.total_external_doctor_payments > 0) {
        summaryData.push(['Pagos Doctores Externos', formatCurrency(closing.total_external_doctor_payments)]);
      }
      
      summaryData.push(
        ['Gastos del Día', formatCurrency(closing.total_expenses || 0)],
        ['', ''],
        ['UTILIDAD NETA', formatCurrency(closing.net_profit)]
      );
      
      if (closing.total_clinic_income > 0) {
        const profitMargin = ((closing.net_profit / closing.total_clinic_income) * 100).toFixed(2);
        summaryData.push(['Margen de Utilidad', `${profitMargin}%`]);
      }
      
      const summaryTableTop = doc.y;
      const summaryTableLeft = 50;
      const summaryColWidths = [300, 150];
      
      doc.font('Helvetica');
      summaryData.forEach((row, rowIndex) => {
        const y = summaryTableTop + (rowIndex * 20);
        
        if (row[0] === 'UTILIDAD NETA') {
          doc.font('Helvetica-Bold').fillColor(closing.net_profit >= 0 ? '#4CAF50' : '#F44336');
        } else if (row[0] === 'DESCRIPCIÓN') {
          doc.font('Helvetica-Bold').fillColor('#FFFFFF');
          doc.rect(summaryTableLeft, y, summaryColWidths[0] + summaryColWidths[1], 20).fill('#2196F3');
        } else {
          doc.font('Helvetica').fillColor('#000000');
        }
        
        doc.text(row[0], summaryTableLeft + 5, y + 5, { width: summaryColWidths[0] - 10, continued: false });
        doc.text(row[1] || '', summaryTableLeft + summaryColWidths[0] + 5, y + 5, { width: summaryColWidths[1] - 10, align: 'right' });
      });
      
      // Agregar pie de página a la primera página
      addFooter(pageNumber, totalPages);
      
      // Sección 2: Detalle de Procedimientos
      if (procedureRelations && procedureRelations.length > 0) {
        doc.addPage();
        pageNumber++;
        totalPages++;
        
        doc.fontSize(14).font('Helvetica-Bold').text('DETALLE DE PROCEDIMIENTOS', { underline: true });
        doc.moveDown(1);
        
        const procData = [
          ['FECHA', 'PACIENTE', 'PROCEDIMIENTO', 'TOTAL', 'CLÍNICA', 'DOCTORA', 'EXTERNO']
        ];
        
        let totalClinic = 0;
        let totalDoctor = 0;
        let totalExternal = 0;
        
        procedureRelations.forEach(relation => {
          const proc = relation.procedures;
          if (!proc) return;
          
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          
          procData.push([
            formatNicaraguaDate(proc.procedure_date).split(' ')[0],
            patientName.substring(0, 20),
            proc.procedure_description || 'Sin descripción',
            formatCurrency(proc.total_procedure || proc.total_cost || 0),
            formatCurrency(relation.clinic_income_portion || 0),
            formatCurrency(relation.doctor_income_portion || 0),
            formatCurrency(relation.external_doctor_payment || 0)
          ]);
          
          totalClinic += relation.clinic_income_portion || 0;
          totalDoctor += relation.doctor_income_portion || 0;
          totalExternal += relation.external_doctor_payment || 0;
        });
        
        // Totales
        procData.push(['', '', '', '', '', '', '']);
        procData.push(['TOTAL CLÍNICA:', '', '', '', formatCurrency(totalClinic), '', '']);
        
        if (closing.closing_type === 'orthodontics') {
          procData.push(['TOTAL DOCTORA:', '', '', '', '', formatCurrency(totalDoctor), '']);
        }
        
        if (totalExternal > 0) {
          procData.push(['TOTAL EXTERNOS:', '', '', '', '', '', formatCurrency(totalExternal)]);
        }
        
        procData.push(['TOTAL GENERAL:', '', '', formatCurrency(totalClinic + totalDoctor + totalExternal), '', '', '']);
        
        const procTableTop = doc.y;
        const procTableLeft = 20;
        const procColWidths = [50, 70, 110, 50, 50, 50, 50];
        
        doc.font('Helvetica');
        procData.forEach((row, rowIndex) => {
          const y = procTableTop + (rowIndex * 20);
          
          if (rowIndex === 0) {
            doc.font('Helvetica-Bold').fillColor('#FFFFFF');
            doc.rect(procTableLeft, y, procColWidths.reduce((a, b) => a + b, 0), 20).fill('#4CAF50');
          } else if (rowIndex >= procData.length - 5) {
            doc.font('Helvetica-Bold').fillColor('#000000');
          } else {
            doc.font('Helvetica').fillColor('#000000');
            if (rowIndex % 2 === 0) {
              doc.rect(procTableLeft, y, procColWidths.reduce((a, b) => a + b, 0), 20).fill('#F9F9F9');
            }
          }
          
          // Ajustar texto para cada columna
          row.forEach((cell, cellIndex) => {
            const x = procTableLeft + procColWidths.slice(0, cellIndex).reduce((a, b) => a + b, 0) + 5;
            const align = cellIndex >= 3 ? 'right' : 'left';
            doc.text(cell, x, y + 5, { 
              width: procColWidths[cellIndex] - 10, 
              align: align 
            });
          });
        });
        
        doc.moveDown(2);
        
        // Agregar pie de página a la segunda página
        addFooter(pageNumber, totalPages);
      }
      
      // Sección 3: Detalle de Gastos
      if (bills && bills.length > 0) {
        doc.addPage();
        pageNumber++;
        totalPages++;
        
        doc.fontSize(14).font('Helvetica-Bold').text('DETALLE DE GASTOS', { underline: true });
        doc.moveDown(1);
        
        // Gastos Fijos
        if (fixedBills.length > 0) {
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#2196F3').text('GASTOS FIJOS', { underline: true });
          doc.moveDown(0.5);
          
          const fixedData = [
            ['FECHA', 'DESCRIPCIÓN', 'CATEGORÍA', 'MONTO']
          ];
          
          fixedBills.forEach(bill => {
            fixedData.push([
              formatNicaraguaDate(bill.bill_date).split(' ')[0],
              bill.description || 'Sin descripción',
              bill.category || 'No categorizado',
              formatCurrency(bill.amount || 0)
            ]);
          });
          
          const fixedTotal = fixedBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
          fixedData.push(['', '', 'SUBTOTAL GASTOS FIJOS:', formatCurrency(fixedTotal)]);
          
          const fixedTableTop = doc.y;
          const fixedTableLeft = 30;
          const fixedColWidths = [60, 130, 100, 80];
          
          fixedData.forEach((row, rowIndex) => {
            const y = fixedTableTop + (rowIndex * 20);
            
            if (rowIndex === 0) {
              doc.font('Helvetica-Bold').fillColor('#FFFFFF');
              doc.rect(fixedTableLeft, y, fixedColWidths.reduce((a, b) => a + b, 0), 20).fill('#2196F3');
            } else if (rowIndex === fixedData.length - 1) {
              doc.font('Helvetica-Bold').fillColor('#000000');
            } else {
              doc.font('Helvetica').fillColor('#000000');
              if (rowIndex % 2 === 0) {
                doc.rect(fixedTableLeft, y, fixedColWidths.reduce((a, b) => a + b, 0), 20).fill('#F0F7FF');
              }
            }
            
            doc.text(row[0], fixedTableLeft + 5, y + 5, { width: fixedColWidths[0] - 10 });
            doc.text(row[1], fixedTableLeft + fixedColWidths[0] + 5, y + 5, { width: fixedColWidths[1] - 10 });
            doc.text(row[2], fixedTableLeft + fixedColWidths[0] + fixedColWidths[1] + 5, y + 5, { width: fixedColWidths[2] - 10 });
            doc.text(row[3], fixedTableLeft + fixedColWidths[0] + fixedColWidths[1] + fixedColWidths[2] + 5, y + 5, { width: fixedColWidths[3] - 10, align: 'right' });
          });
          
          doc.moveDown(2);
        }
        
        // Gastos Variables
        if (variableBills.length > 0) {
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#FF9800').text('GASTOS VARIABLES', { underline: true });
          doc.moveDown(0.5);
          
          const variableData = [
            ['FECHA', 'DESCRIPCIÓN', 'CATEGORÍA', 'MONTO']
          ];
          
          variableBills.forEach(bill => {
            variableData.push([
              formatNicaraguaDate(bill.bill_date).split(' ')[0],
              bill.description || 'Sin descripción',
              bill.category || 'No categorizado',
              formatCurrency(bill.amount || 0)
            ]);
          });
          
          const variableTotal = variableBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
          variableData.push(['', '', 'SUBTOTAL GASTOS VARIABLES:', formatCurrency(variableTotal)]);
          
          const variableTableTop = doc.y;
          const variableTableLeft = 30;
          const variableColWidths = [60, 130, 100, 80];
          
          variableData.forEach((row, rowIndex) => {
            const y = variableTableTop + (rowIndex * 20);
            
            if (rowIndex === 0) {
              doc.font('Helvetica-Bold').fillColor('#FFFFFF');
              doc.rect(variableTableLeft, y, variableColWidths.reduce((a, b) => a + b, 0), 20).fill('#FF9800');
            } else if (rowIndex === variableData.length - 1) {
              doc.font('Helvetica-Bold').fillColor('#000000');
            } else {
              doc.font('Helvetica').fillColor('#000000');
              if (rowIndex % 2 === 0) {
                doc.rect(variableTableLeft, y, variableColWidths.reduce((a, b) => a + b, 0), 20).fill('#FFF8E1');
              }
            }
            
            doc.text(row[0], variableTableLeft + 5, y + 5, { width: variableColWidths[0] - 10 });
            doc.text(row[1], variableTableLeft + variableColWidths[0] + 5, y + 5, { width: variableColWidths[1] - 10 });
            doc.text(row[2], variableTableLeft + variableColWidths[0] + variableColWidths[1] + 5, y + 5, { width: variableColWidths[2] - 10 });
            doc.text(row[3], variableTableLeft + variableColWidths[0] + variableColWidths[1] + variableColWidths[2] + 5, y + 5, { width: variableColWidths[3] - 10, align: 'right' });
          });
          
          doc.moveDown(1);
          
          // Total de todos los gastos
          const totalGastos = (fixedBills.reduce((sum, bill) => sum + (bill.amount || 0), 0) + 
                              variableBills.reduce((sum, bill) => sum + (bill.amount || 0), 0));
          doc.fontSize(12).font('Helvetica-Bold').text('TOTAL GENERAL DE GASTOS:', { continued: true });
          doc.font('Helvetica').text(` ${formatCurrency(totalGastos)}`, { align: 'right' });
        }
        
        // Agregar pie de página a la tercera página
        addFooter(pageNumber, totalPages);
      }
      
      // Comentarios
      if (closing.comentary) {
        doc.addPage();
        pageNumber++;
        totalPages++;
        
        doc.fontSize(14).font('Helvetica-Bold').text('OBSERVACIONES', { underline: true });
        doc.moveDown(1);
        doc.fontSize(11).font('Helvetica').text(closing.comentary, { align: 'justify' });
        
        // Agregar pie de página a la página de comentarios
        addFooter(pageNumber, totalPages);
      }
      
      doc.end();
      
    } catch (error) {
      console.error('Error al exportar PDF diario:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error al generar PDF diario' 
      });
    }
  },

  // Exportar cierre mensual a Excel con formato vertical y desglose
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
      
      // Obtener gastos del período con desglose
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
      
      // Crear workbook de Excel
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Care U Smile';
      workbook.created = new Date();
      
      // Hoja 1: Resumen Ejecutivo (formato vertical como PDF)
      const summarySheet = workbook.addWorksheet('RESUMEN EJECUTIVO');
      
      // Configurar anchos de columna
      summarySheet.columns = [
        { header: 'DESCRIPCIÓN', key: 'description', width: 40 },
        { header: 'VALOR', key: 'value', width: 25 }
      ];
      
      // Título - CAMBIO: Clínica Odontológica por Care U Smile
      const titleRow = summarySheet.addRow(['CARE U SMILE', '']);
      titleRow.font = { bold: true, size: 16 };
      titleRow.alignment = { horizontal: 'center' };
      summarySheet.mergeCells('A1:B1');
      
      summarySheet.addRow(['Reporte de Cierre Mensual', '']);
      summarySheet.mergeCells('A2:B2');
      
      summarySheet.addRow([`${closing.month.toUpperCase()} ${closing.year}`, '']);
      summarySheet.mergeCells('A3:B3');
      
      summarySheet.addRow([`Fecha de generación: ${formatNicaraguaDate(new Date().toISOString())}`, '']);
      summarySheet.mergeCells('A4:B4');
      
      summarySheet.addRow(['', '']); // Espacio
      
      // Encabezado de sección
      const headerRow = summarySheet.addRow(['RESUMEN FINANCIERO', '']);
      headerRow.font = { bold: true, size: 14 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2196F3' }
      };
      headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      summarySheet.mergeCells('A6:B6');
      
      summarySheet.addRow(['', '']); // Espacio
      
      // INGRESOS
      const incomeHeader = summarySheet.addRow(['INGRESOS', '']);
      incomeHeader.font = { bold: true };
      incomeHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F5E9' }
      };
      summarySheet.mergeCells('A8:B8');
      
      summarySheet.addRow(['Procedimientos Generales (100% clínica)', closing.total_general_income]);
      summarySheet.addRow(['Ortodoncia (40% Clínica)', closing.total_clinical_orthodontic_income]);
      summarySheet.addRow(['TOTAL INGRESOS CLÍNICA', closing.total_general_income + closing.total_clinical_orthodontic_income]);
      
      // GASTOS - CAMBIO: Eliminar pago a doctora ortodoncia de cierres mensuales
      const expensesHeader = summarySheet.addRow(['', '']);
      summarySheet.addRow(['GASTOS', '']);
      expensesHeader.font = { bold: true };
      expensesHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF3E0' }
      };
      summarySheet.mergeCells(`A${summarySheet.rowCount}:B${summarySheet.rowCount}`);
      
      summarySheet.addRow(['Gastos Fijos', closing.total_fixed_expenses]);
      summarySheet.addRow(['Gastos Variables', closing.total_variable_expenses]);
      // NOTA: Se elimina la fila de pago doctora ortodoncia para cierres mensuales
      summarySheet.addRow(['TOTAL GASTOS', closing.total_fixed_expenses + closing.total_variable_expenses]);
      
      summarySheet.addRow(['', '']); // Espacio
      
      // RESULTADO FINAL
      const resultHeader = summarySheet.addRow(['RESULTADO FINAL', '']);
      resultHeader.font = { bold: true, size: 12 };
      resultHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3E5F5' }
      };
      summarySheet.mergeCells(`A${summarySheet.rowCount}:B${summarySheet.rowCount}`);
      
      const totalIncome = closing.total_general_income + closing.total_clinical_orthodontic_income;
      const totalExpenses = closing.total_fixed_expenses + closing.total_variable_expenses;
      const netProfit = closing.net_profit;
      
      summarySheet.addRow(['Ingresos Totales Clínica', totalIncome]);
      summarySheet.addRow(['Gastos Totales', totalExpenses]);
      
      const netProfitRow = summarySheet.addRow(['UTILIDAD NETA', netProfit]);
      netProfitRow.font = { bold: true, size: 14 };
      netProfitRow.getCell(2).font = { 
        bold: true, 
        size: 14,
        color: { argb: netProfit >= 0 ? 'FF4CAF50' : 'FFF44336' }
      };
      
      // Porcentaje de utilidad
      if (totalIncome > 0) {
        const profitMargin = ((netProfit / totalIncome) * 100).toFixed(2);
        summarySheet.addRow(['Margen de Utilidad', `${profitMargin}%`]);
      }
      
      // Comentarios
      if (closing.comentary) {
        summarySheet.addRow(['', '']); // Espacio
        summarySheet.addRow(['COMENTARIOS:', '']);
        summarySheet.mergeCells(`A${summarySheet.rowCount}:B${summarySheet.rowCount}`);
        summarySheet.addRow([closing.comentary, '']);
        summarySheet.mergeCells(`A${summarySheet.rowCount}:B${summarySheet.rowCount}`);
      }
      
      // Aplicar formato de moneda a las celdas de valores
      summarySheet.eachRow((row, rowNumber) => {
        if (rowNumber > 8 && row.getCell(2).value && typeof row.getCell(2).value === 'number') {
          row.getCell(2).numFmt = '"C$"#,##0.00';
        }
      });
      
      // Estilo para las filas de totales
      [13, 17, 20, 21].forEach(rowNum => {
        const row = summarySheet.getRow(rowNum);
        row.font = { bold: true };
        row.getCell(1).font = { bold: true };
        row.getCell(2).font = { bold: true };
      });
      
      // Hoja 2: DETALLE DE PROCEDIMIENTOS (si hay procedimientos)
      if (procedures && procedures.length > 0) {
        const proceduresSheet = workbook.addWorksheet('DETALLE PROCEDIMIENTOS');
        
        proceduresSheet.columns = [
          { header: 'FECHA', key: 'date', width: 15 },
          { header: 'PACIENTE', key: 'patient', width: 30 },
          { header: 'PROCEDIMIENTO', key: 'procedure', width: 40 },
          { header: 'MONTO TOTAL', key: 'total_amount', width: 20 },
          { header: 'MÉTODO PAGO', key: 'payment_method', width: 20 },
          { header: 'ORTODONCIA', key: 'orthodontics', width: 15 },
          { header: 'OBSERVACIONES', key: 'observations', width: 30 }
        ];
        
        // Encabezado
        const procHeaderRow = proceduresSheet.getRow(1);
        procHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        procHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4CAF50' }
        };
        procHeaderRow.alignment = { horizontal: 'center' };
        
        // Agregar procedimientos
        procedures.forEach(proc => {
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          
          proceduresSheet.addRow({
            date: formatNicaraguaDate(proc.procedure_date),
            patient: patientName,
            procedure: proc.procedure_description || 'Sin descripción',
            total_amount: proc.total_procedure || proc.total_cost || 0,
            payment_method: proc.payment_method || 'No especificado',
            orthodontics: proc.is_orthodontics ? 'Sí' : 'No',
            observations: proc.observations || ''
          });
        });
        
        // Totales al final
        const totalProcedures = procedures.length;
        const totalAmount = procedures.reduce((sum, proc) => sum + (proc.total_procedure || proc.total_cost || 0), 0);
        
        proceduresSheet.addRow(['', '', '', '', '', '', '']);
        proceduresSheet.addRow(['TOTAL PROCEDIMIENTOS:', '', '', totalProcedures, '', '', '']);
        proceduresSheet.addRow(['MONTO TOTAL:', '', '', totalAmount, '', '', '']);
        
        // Aplicar formato de moneda
        proceduresSheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1 && rowNumber <= procedures.length + 1) {
            row.getCell(4).numFmt = '"C$"#,##0.00';
          }
        });
        
        // Formato para totales
        const lastRow = proceduresSheet.getRow(proceduresSheet.rowCount);
        lastRow.font = { bold: true };
        lastRow.getCell(4).numFmt = '"C$"#,##0.00';
        
        const secondLastRow = proceduresSheet.getRow(proceduresSheet.rowCount - 1);
        secondLastRow.font = { bold: true };
      }
      
      // Hoja 3: DETALLE DE GASTOS (si hay gastos) - CON DESGLOSE COMPLETO
      if (bills && bills.length > 0) {
        const billsSheet = workbook.addWorksheet('DETALLE GASTOS');
        
        billsSheet.columns = [
          { header: 'FECHA', key: 'date', width: 15 },
          { header: 'DESCRIPCIÓN', key: 'description', width: 40 },
          { header: 'CATEGORÍA', key: 'category', width: 25 },
          { header: 'MONTO', key: 'amount', width: 20 },
          { header: 'TIPO', key: 'type', width: 15 },
          { header: 'PROCESADO', key: 'processed', width: 15 }
        ];
        
        // Encabezado
        const billsHeaderRow = billsSheet.getRow(1);
        billsHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        billsHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF9800' }
        };
        billsHeaderRow.alignment = { horizontal: 'center' };
        
        // Agregar gastos
        let currentRow = 2;
        
        // Sección de Gastos Fijos
        if (fixedBills.length > 0) {
          // Subtítulo Gastos Fijos
          billsSheet.getCell(`A${currentRow}`).value = 'GASTOS FIJOS';
          billsSheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
          billsSheet.getCell(`A${currentRow}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE3F2FD' }
          };
          billsSheet.mergeCells(`A${currentRow}:F${currentRow}`);
          currentRow++;
          
          // Datos de gastos fijos
          fixedBills.forEach(bill => {
            billsSheet.addRow({
              date: formatNicaraguaDate(bill.bill_date),
              description: bill.description || 'Sin descripción',
              category: bill.category || 'No categorizado',
              amount: bill.amount || 0,
              type: 'Fijo',
              processed: bill.is_processed_in_closing ? 'Sí' : 'No'
            });
            currentRow++;
          });
          
          // Subtotal Gastos Fijos
          const fixedTotal = fixedBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
          billsSheet.getCell(`C${currentRow}`).value = 'SUBTOTAL GASTOS FIJOS:';
          billsSheet.getCell(`C${currentRow}`).font = { bold: true };
          billsSheet.getCell(`D${currentRow}`).value = fixedTotal;
          billsSheet.getCell(`D${currentRow}`).font = { bold: true };
          billsSheet.getCell(`D${currentRow}`).numFmt = '"C$"#,##0.00';
          billsSheet.mergeCells(`C${currentRow}:D${currentRow}`);
          currentRow += 2;
        }
        
        // Sección de Gastos Variables
        if (variableBills.length > 0) {
          // Subtítulo Gastos Variables
          billsSheet.getCell(`A${currentRow}`).value = 'GASTOS VARIABLES';
          billsSheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
          billsSheet.getCell(`A${currentRow}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF8E1' }
          };
          billsSheet.mergeCells(`A${currentRow}:F${currentRow}`);
          currentRow++;
          
          // Datos de gastos variables
          variableBills.forEach(bill => {
            billsSheet.addRow({
              date: formatNicaraguaDate(bill.bill_date),
              description: bill.description || 'Sin descripción',
              category: bill.category || 'No categorizado',
              amount: bill.amount || 0,
              type: 'Variable',
              processed: bill.is_processed_in_closing ? 'Sí' : 'No'
            });
            currentRow++;
          });
          
          // Subtotal Gastos Variables
          const variableTotal = variableBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
          billsSheet.getCell(`C${currentRow}`).value = 'SUBTOTAL GASTOS VARIABLES:';
          billsSheet.getCell(`C${currentRow}`).font = { bold: true };
          billsSheet.getCell(`D${currentRow}`).value = variableTotal;
          billsSheet.getCell(`D${currentRow}`).font = { bold: true };
          billsSheet.getCell(`D${currentRow}`).numFmt = '"C$"#,##0.00';
          billsSheet.mergeCells(`C${currentRow}:D${currentRow}`);
          currentRow++;
        }
        
        // Total General de Gastos
        const totalBillsAmount = bills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
        billsSheet.getCell(`C${currentRow}`).value = 'TOTAL GENERAL DE GASTOS:';
        billsSheet.getCell(`C${currentRow}`).font = { bold: true, size: 12 };
        billsSheet.getCell(`C${currentRow}`).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFCE4EC' }
        };
        billsSheet.getCell(`D${currentRow}`).value = totalBillsAmount;
        billsSheet.getCell(`D${currentRow}`).font = { bold: true, size: 12 };
        billsSheet.getCell(`D${currentRow}`).numFmt = '"C$"#,##0.00';
        billsSheet.getCell(`D${currentRow}`).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFCE4EC' }
        };
        billsSheet.mergeCells(`C${currentRow}:D${currentRow}`);
        
        // Aplicar formato de moneda a todas las celdas de monto
        billsSheet.eachRow((row, rowNumber) => {
          if (row.getCell(4).value && typeof row.getCell(4).value === 'number') {
            row.getCell(4).numFmt = '"C$"#,##0.00';
          }
        });
      }
      
      // Hoja 4: ANÁLISIS DETALLADO
      const analysisSheet = workbook.addWorksheet('ANÁLISIS');
      
      analysisSheet.columns = [
        { header: 'INDICADOR', key: 'indicator', width: 35 },
        { header: 'VALOR', key: 'value', width: 25 },
        { header: 'PORCENTAJE', key: 'percentage', width: 20 }
      ];
      
      // Encabezado
      const analysisHeaderRow = analysisSheet.getRow(1);
      analysisHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      analysisHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF9C27B0' }
      };
      analysisHeaderRow.alignment = { horizontal: 'center' };
      
      // Análisis de rentabilidad
      const analysisData = [
        ['Ingresos Totales', totalIncome, '100%'],
        ['Gastos Totales', totalExpenses, `${((totalExpenses / totalIncome) * 100).toFixed(2)}%`],
        ['Utilidad Neta', netProfit, `${((netProfit / totalIncome) * 100).toFixed(2)}%`],
        ['', '', ''],
        ['Composición de Gastos:', '', ''],
        ['  • Gastos Fijos', closing.total_fixed_expenses, `${((closing.total_fixed_expenses / totalExpenses) * 100).toFixed(2)}%`],
        ['  • Gastos Variables', closing.total_variable_expenses, `${((closing.total_variable_expenses / totalExpenses) * 100).toFixed(2)}%`],
        // NOTA: Se elimina pago doctora ortodoncia del análisis mensual
        ['', '', ''],
        ['Composición de Ingresos:', '', ''],
        ['  • Procedimientos Generales', closing.total_general_income, `${((closing.total_general_income / totalIncome) * 100).toFixed(2)}%`],
        ['  • Ortodoncia (40% Clínica)', closing.total_clinical_orthodontic_income, `${((closing.total_clinical_orthodontic_income / totalIncome) * 100).toFixed(2)}%`]
      ];
      
      analysisData.forEach(([indicator, value, percentage]) => {
        analysisSheet.addRow({ indicator, value, percentage });
      });
      
      // Aplicar formato
      analysisSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && typeof row.getCell(2).value === 'number') {
          row.getCell(2).numFmt = '"C$"#,##0.00';
        }
        
        // Estilo para subtítulos
        if (row.getCell(1).value && row.getCell(1).value.toString().includes(':')) {
          row.font = { bold: true };
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3E5F5' }
          };
        }
        
        // Estilo para elementos de lista
        if (row.getCell(1).value && row.getCell(1).value.toString().startsWith('  •')) {
          row.getCell(1).font = { italic: true };
        }
      });
      
      // Estilo para filas importantes
      [2, 3, 4].forEach(rowNum => {
        const row = analysisSheet.getRow(rowNum);
        row.font = { bold: true };
        if (rowNum === 4) { // Utilidad neta
          row.getCell(2).font = { 
            bold: true,
            color: { argb: netProfit >= 0 ? 'FF4CAF50' : 'FFF44336' }
          };
          row.getCell(3).font = { 
            bold: true,
            color: { argb: netProfit >= 0 ? 'FF4CAF50' : 'FFF44336' }
          };
        }
      });
      
      // Configurar nombre del archivo
      const fileName = `Cierre_${closing.month}_${closing.year}_Detallado_${new Date().toISOString().split('T')[0]}.xlsx`;
      
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

  // Exportar cierre diario a Excel con formato vertical
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
      
      // Crear workbook de Excel
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Care U Smile';
      workbook.created = new Date();
      
      // Hoja 1: Resumen Ejecutivo
      const summarySheet = workbook.addWorksheet('RESUMEN EJECUTIVO');
      
      summarySheet.columns = [
        { header: 'DESCRIPCIÓN', key: 'description', width: 40 },
        { header: 'VALOR', key: 'value', width: 25 }
      ];
      
      // Título - CAMBIO: Clínica Odontológica por Care U Smile
      const titleRow = summarySheet.addRow(['CARE U SMILE', '']);
      titleRow.font = { bold: true, size: 16 };
      titleRow.alignment = { horizontal: 'center' };
      summarySheet.mergeCells('A1:B1');
      
      summarySheet.addRow(['Reporte de Cierre Diario', '']);
      summarySheet.mergeCells('A2:B2');
      
      summarySheet.addRow([`Fecha: ${formatNicaraguaDate(closing.closing_date)}`, '']);
      summarySheet.mergeCells('A3:B3');
      
      if (closing.closing_type === 'orthodontics') {
        summarySheet.addRow(['(Cierre de Ortodoncia)', '']);
        summarySheet.mergeCells('A4:B4');
      }
      
      summarySheet.addRow([`Fecha de generación: ${formatNicaraguaDate(new Date().toISOString())}`, '']);
      summarySheet.mergeCells(`A${summarySheet.rowCount}:B${summarySheet.rowCount}`);
      
      summarySheet.addRow(['', '']); // Espacio
      
      // Encabezado de sección
      const headerRow = summarySheet.addRow(['RESUMEN DEL DÍA', '']);
      headerRow.font = { bold: true, size: 14 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2196F3' }
      };
      headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      summarySheet.mergeCells(`A${summarySheet.rowCount}:B${summarySheet.rowCount}`);
      
      summarySheet.addRow(['', '']); // Espacio
      
      // Datos del resumen
      const summaryData = [
        ['Ingresos Totales', closing.total_income],
        ['Ingresos Clínica', closing.total_clinic_income],
        closing.closing_type === 'orthodontics' ? 
          ['Pago Doctora Ortodoncia (60%)', closing.total_doctor_income] : null,
        closing.total_external_doctor_payments > 0 ? 
          ['Pagos Doctores Externos', closing.total_external_doctor_payments] : null,
        ['Gastos del Día', closing.total_expenses || 0],
        ['', ''], // Separador
        ['UTILIDAD NETA', closing.net_profit]
      ].filter(Boolean);
      
      summaryData.forEach(([desc, value]) => {
        summarySheet.addRow([desc, value]);
      });
      
      // Porcentaje de utilidad si hay ingresos
      if (closing.total_clinic_income > 0) {
        const profitMargin = ((closing.net_profit / closing.total_clinic_income) * 100).toFixed(2);
        summarySheet.addRow(['Margen de Utilidad', `${profitMargin}%`]);
      }
      
      // Comentarios
      if (closing.comentary) {
        summarySheet.addRow(['', '']); // Espacio
        summarySheet.addRow(['OBSERVACIONES:', '']);
        summarySheet.mergeCells(`A${summarySheet.rowCount}:B${summarySheet.rowCount}`);
        summarySheet.addRow([closing.comentary, '']);
        summarySheet.mergeCells(`A${summarySheet.rowCount}:B${summarySheet.rowCount}`);
      }
      
      // Aplicar formato de moneda
      summarySheet.eachRow((row, rowNumber) => {
        const valueCell = row.getCell(2);
        if (rowNumber > 8 && valueCell.value && typeof valueCell.value === 'number') {
          valueCell.numFmt = '"C$"#,##0.00';
          
          // Destacar utilidad neta
          if (row.getCell(1).value === 'UTILIDAD NETA') {
            row.font = { bold: true, size: 14 };
            valueCell.font = { 
              bold: true, 
              size: 14,
              color: { argb: closing.net_profit >= 0 ? 'FF4CAF50' : 'FFF44336' }
            };
          }
        }
      });
      
      // Hoja 2: Detalle de Procedimientos (si hay)
      if (procedureRelations && procedureRelations.length > 0) {
        const proceduresSheet = workbook.addWorksheet('DETALLE PROCEDIMIENTOS');
        
        proceduresSheet.columns = [
          { header: 'FECHA', key: 'date', width: 15 },
          { header: 'PACIENTE', key: 'patient', width: 30 },
          { header: 'PROCEDIMIENTO', key: 'procedure', width: 40 },
          { header: 'MONTO TOTAL', key: 'total_amount', width: 20 },
          { header: 'CLÍNICA', key: 'clinic_portion', width: 20 },
          { header: 'DOCTORA', key: 'doctor_portion', width: 20 },
          { header: 'EXTERNO', key: 'external_payment', width: 20 }
        ];
        
        // Encabezado
        const procHeaderRow = proceduresSheet.getRow(1);
        procHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        procHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4CAF50' }
        };
        procHeaderRow.alignment = { horizontal: 'center' };
        
        // Agregar procedimientos
        let totalClinic = 0;
        let totalDoctor = 0;
        let totalExternal = 0;
        
        procedureRelations.forEach(relation => {
          const proc = relation.procedures;
          if (!proc) return;
          
          const patientName = proc.patients ? 
            `${proc.patients.first_name || ''} ${proc.patients.first_last_name || ''}`.trim() : 
            'Sin paciente';
          
          proceduresSheet.addRow({
            date: formatNicaraguaDate(proc.procedure_date),
            patient: patientName,
            procedure: proc.procedure_description || 'Sin descripción',
            total_amount: proc.total_procedure || proc.total_cost || 0,
            clinic_portion: relation.clinic_income_portion || 0,
            doctor_portion: relation.doctor_income_portion || 0,
            external_payment: relation.external_doctor_payment || 0
          });
          
          totalClinic += relation.clinic_income_portion || 0;
          totalDoctor += relation.doctor_income_portion || 0;
          totalExternal += relation.external_doctor_payment || 0;
        });
        
        // Totales
        proceduresSheet.addRow(['', '', '', '', '', '', '']);
        proceduresSheet.addRow(['TOTAL CLÍNICA:', '', '', '', totalClinic, '', '']);
        proceduresSheet.addRow(['TOTAL DOCTORA:', '', '', '', '', totalDoctor, '']);
        proceduresSheet.addRow(['TOTAL EXTERNOS:', '', '', '', '', '', totalExternal]);
        proceduresSheet.addRow(['TOTAL GENERAL:', '', '', totalClinic + totalDoctor + totalExternal, '', '', '']);
        
        // Aplicar formato de moneda
        proceduresSheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1 && rowNumber <= procedureRelations.length + 1) {
            [4, 5, 6, 7].forEach(col => {
              if (row.getCell(col).value) {
                row.getCell(col).numFmt = '"C$"#,##0.00';
              }
            });
          }
        });
        
        // Formato para totales
        for (let i = proceduresSheet.rowCount - 4; i <= proceduresSheet.rowCount; i++) {
          const row = proceduresSheet.getRow(i);
          row.font = { bold: true };
          [4, 5, 6, 7].forEach(col => {
            if (row.getCell(col).value) {
              row.getCell(col).numFmt = '"C$"#,##0.00';
            }
          });
        }
      }
      
      // Hoja 3: Detalle de Gastos con desglose completo
      if (bills && bills.length > 0) {
        const billsSheet = workbook.addWorksheet('DETALLE GASTOS');
        
        billsSheet.columns = [
          { header: 'FECHA', key: 'date', width: 15 },
          { header: 'DESCRIPCIÓN', key: 'description', width: 40 },
          { header: 'CATEGORÍA', key: 'category', width: 25 },
          { header: 'MONTO', key: 'amount', width: 20 },
          { header: 'TIPO', key: 'type', width: 15 },
          { header: 'PROCESADO', key: 'processed', width: 15 }
        ];
        
        // Encabezado
        const billsHeaderRow = billsSheet.getRow(1);
        billsHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        billsHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF9800' }
        };
        billsHeaderRow.alignment = { horizontal: 'center' };
        
        // Agregar gastos con desglose
        let currentRow = 2;
        
        // Sección de Gastos Fijos
        if (fixedBills.length > 0) {
          // Subtítulo Gastos Fijos
          billsSheet.getCell(`A${currentRow}`).value = 'GASTOS FIJOS';
          billsSheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
          billsSheet.getCell(`A${currentRow}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE3F2FD' }
          };
          billsSheet.mergeCells(`A${currentRow}:F${currentRow}`);
          currentRow++;
          
          // Datos de gastos fijos
          fixedBills.forEach(bill => {
            billsSheet.addRow({
              date: formatNicaraguaDate(bill.bill_date),
              description: bill.description || 'Sin descripción',
              category: bill.category || 'No categorizado',
              amount: bill.amount || 0,
              type: 'Fijo',
              processed: bill.is_processed_in_closing ? 'Sí' : 'No'
            });
            currentRow++;
          });
          
          // Subtotal Gastos Fijos
          const fixedTotal = fixedBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
          billsSheet.getCell(`C${currentRow}`).value = 'SUBTOTAL GASTOS FIJOS:';
          billsSheet.getCell(`C${currentRow}`).font = { bold: true };
          billsSheet.getCell(`D${currentRow}`).value = fixedTotal;
          billsSheet.getCell(`D${currentRow}`).font = { bold: true };
          billsSheet.getCell(`D${currentRow}`).numFmt = '"C$"#,##0.00';
          billsSheet.mergeCells(`C${currentRow}:D${currentRow}`);
          currentRow += 2;
        }
        
        // Sección de Gastos Variables
        if (variableBills.length > 0) {
          // Subtítulo Gastos Variables
          billsSheet.getCell(`A${currentRow}`).value = 'GASTOS VARIABLES';
          billsSheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
          billsSheet.getCell(`A${currentRow}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF8E1' }
          };
          billsSheet.mergeCells(`A${currentRow}:F${currentRow}`);
          currentRow++;
          
          // Datos de gastos variables
          variableBills.forEach(bill => {
            billsSheet.addRow({
              date: formatNicaraguaDate(bill.bill_date),
              description: bill.description || 'Sin descripción',
              category: bill.category || 'No categorizado',
              amount: bill.amount || 0,
              type: 'Variable',
              processed: bill.is_processed_in_closing ? 'Sí' : 'No'
            });
            currentRow++;
          });
          
          // Subtotal Gastos Variables
          const variableTotal = variableBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
          billsSheet.getCell(`C${currentRow}`).value = 'SUBTOTAL GASTOS VARIABLES:';
          billsSheet.getCell(`C${currentRow}`).font = { bold: true };
          billsSheet.getCell(`D${currentRow}`).value = variableTotal;
          billsSheet.getCell(`D${currentRow}`).font = { bold: true };
          billsSheet.getCell(`D${currentRow}`).numFmt = '"C$"#,##0.00';
          billsSheet.mergeCells(`C${currentRow}:D${currentRow}`);
          currentRow++;
        }
        
        // Total General de Gastos
        const totalBillsAmount = bills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
        billsSheet.getCell(`C${currentRow}`).value = 'TOTAL GENERAL DE GASTOS:';
        billsSheet.getCell(`C${currentRow}`).font = { bold: true, size: 12 };
        billsSheet.getCell(`C${currentRow}`).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFCE4EC' }
        };
        billsSheet.getCell(`D${currentRow}`).value = totalBillsAmount;
        billsSheet.getCell(`D${currentRow}`).font = { bold: true, size: 12 };
        billsSheet.getCell(`D${currentRow}`).numFmt = '"C$"#,##0.00';
        billsSheet.getCell(`D${currentRow}`).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFCE4EC' }
        };
        billsSheet.mergeCells(`C${currentRow}:D${currentRow}`);
        
        // Aplicar formato de moneda a todas las celdas de monto
        billsSheet.eachRow((row, rowNumber) => {
          if (row.getCell(4).value && typeof row.getCell(4).value === 'number') {
            row.getCell(4).numFmt = '"C$"#,##0.00';
          }
        });
      }
      
      // Configurar nombre del archivo
      const fileName = `Cierre_Diario_${formatNicaraguaDate(closing.closing_date).replace(/\//g, '-')}_${closing.closing_type}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
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

  // Función para exportación general (mantener compatibilidad)
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
      workbook.creator = 'Care U Smile'; // CAMBIO
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
        
        // CAMBIO: Eliminar columna de pago doctora de cierres mensuales
        worksheet.columns = [
          { header: 'Mes', key: 'month', width: 15 },
          { header: 'Año', key: 'year', width: 10 },
          { header: 'Fecha Cierre', key: 'closing_date', width: 15 },
          { header: 'Ingresos Generales', key: 'total_general_income', width: 20 },
          { header: 'Ortodoncia (40%)', key: 'total_clinical_orthodontic_income', width: 20 },
          { header: 'Gastos Fijos', key: 'total_fixed_expenses', width: 15 },
          { header: 'Gastos Variables', key: 'total_variable_expenses', width: 15 },
          // NOTA: Se elimina la columna de pago doctora para cierres mensuales
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

export default exportController;