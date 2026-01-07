import express from 'express';
import billController from '../controllers/billController.js';

const router = express.Router();

// CRUD de gastos
router.get('/', billController.getAll);
router.get('/:id', billController.getById);
router.post('/', billController.create);
router.put('/:id', billController.update);
router.delete('/:id', billController.delete);

// Rutas adicionales
router.get('/recurrent/all', billController.getRecurrentBills);
router.get('/stats/expenses', billController.getExpenseStats);

export default router;