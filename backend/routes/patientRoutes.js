import express from 'express';
import patientController from '../controllers/patientController.js';

const router = express.Router();

// CRUD de pacientes
router.get('/', patientController.getAll);
router.get('/:id', patientController.getById);
router.post('/', patientController.create);
router.put('/:id', patientController.update);
router.delete('/:id', patientController.delete);

export default router;