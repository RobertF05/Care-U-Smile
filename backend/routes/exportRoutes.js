// routes/exportRoutes.js - Actualizado
import express from 'express';
import exportController from '../controllers/exportController.js';

const router = express.Router();

// Exportar a PDF
router.get('/pdf/monthly/:closingId', exportController.exportMonthlyPDF);
router.get('/pdf/daily/:closingId', exportController.exportDailyPDF);

// Exportar a Excel (nuevas rutas detalladas)
router.get('/excel/detailed/monthly/:closingId', exportController.exportMonthlyToExcelDetailed);
router.get('/excel/detailed/daily/:closingId', exportController.exportDailyToExcelDetailed);

// Exportar a Excel (general - mantener compatibilidad)
router.get('/excel', exportController.exportToExcel);

export default router;