import express from 'express';
import monthlyClosingController from '../controllers/monthlyClosingController.js';

const router = express.Router();

// CRUD de cierres mensuales
router.get('/', monthlyClosingController.getAll);
router.get('/:id', monthlyClosingController.getById);
router.post('/', monthlyClosingController.create);
router.get('/summary/financial', monthlyClosingController.getFinancialSummary);

export default router;