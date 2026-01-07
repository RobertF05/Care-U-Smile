import express from 'express';
import appointmentController from '../controllers/appointmentController.js';

const router = express.Router();

// CRUD de citas
router.get('/', appointmentController.getAll);
router.get('/:id', appointmentController.getById);
router.post('/', appointmentController.create);
router.put('/:id', appointmentController.update);
router.delete('/:id', appointmentController.delete);

// Ruta adicional
router.get('/date/:date', appointmentController.getByDate);

export default router;