import express from 'express';
import dailyClosingController from '../controllers/dailyClosingController.js';

const router = express.Router();

// CRUD de cierres diarios
router.get('/', dailyClosingController.getAll);
router.get('/:id', dailyClosingController.getById);
router.post('/', dailyClosingController.create);
router.put('/:id', dailyClosingController.update);
router.delete('/:id', dailyClosingController.delete);

// Rutas adicionales
router.get('/summary/daily', dailyClosingController.getDailySummary);
router.get('/stats/range', dailyClosingController.getStatsByDateRange);
router.get('/check/exists', dailyClosingController.checkExists);

export default router;