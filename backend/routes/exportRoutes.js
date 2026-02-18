import express from 'express';
import exportController from '../controllers/exportController.js';
import exportDailyController from '../controllers/exportDailyController.js';

const router = express.Router();

// VERIFICA QUE ESTAS FUNCIONES EXISTAN EN exportController.js
router.get('/pdf/monthly/:closingId', exportController.exportMonthlyPDF);
router.get('/excel/detailed/monthly/:closingId', exportController.exportMonthlyToExcelDetailed);

// VERIFICA QUE ESTAS FUNCIONES EXISTAN EN exportDailyController.js
router.get('/pdf/daily/:closingId', exportDailyController.exportDailyPDF);
router.get('/excel/detailed/daily/:closingId', exportDailyController.exportDailyToExcelDetailed);
router.get('/excel/daily/:closingId', exportDailyController.exportDailyToExcel);

router.get('/excel', exportController.exportToExcel);

export default router;