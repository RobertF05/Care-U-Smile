import express from 'express';
import procedureController from '../controllers/procedureController.js';

const router = express.Router();

// CRUD de procedimientos
router.get('/', procedureController.getAll);
router.get('/:id', procedureController.getById);
router.post('/', procedureController.create);
router.put('/:id', procedureController.update);
router.delete('/:id', procedureController.delete);

// Rutas adicionales
router.get('/patient/:patientId', procedureController.getByPatientId);
router.get('/stats/income', procedureController.getIncomeStats);

export default router;