import express from 'express';
import appointmentController from '../controllers/appointmentController.js';

const router = express.Router();

router.get('/', appointmentController.getAll);
router.get('/:id', appointmentController.getById);
router.post('/', appointmentController.create);
router.put('/:id', appointmentController.update);
router.delete('/:id', appointmentController.delete);
router.get('/date/:date', appointmentController.getByDate);
router.post('/:id/convert-to-procedure', appointmentController.convertToProcedure);

export default router;