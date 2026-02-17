import express from 'express';
import monthlyClosingController from '../controllers/monthlyClosingController.js';

const router = express.Router();

// CRUD de cierres mensuales
router.get('/', monthlyClosingController.getAll);
router.get('/:id', monthlyClosingController.getById);
router.post('/', monthlyClosingController.create);
router.delete('/:id', monthlyClosingController.delete);
router.get('/summary/financial', monthlyClosingController.getFinancialSummary);
router.get('/check/exists', monthlyClosingController.checkExists);
router.get('/monthly-closings/external-doctors', monthlyClosingController.getExternalDoctorDetails);

export default router;