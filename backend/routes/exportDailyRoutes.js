import express from 'express';
import exportDailyController from '../controllers/exportDailyController.js';

const router = express.Router();

// Exportar cierre diario a PDF
router.get('/pdf/daily/:closingId', exportDailyController.exportDailyPDF);

// Exportar cierre diario a Excel detallado
router.get('/excel/detailed/daily/:closingId', exportDailyController.exportDailyToExcelDetailed);

// Exportar cierre diario a Excel general
router.get('/excel/daily/:closingId', exportDailyController.exportDailyToExcel);

export default router;