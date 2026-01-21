// routes/patientMedicalInfoRoutes.js
import express from 'express';
import patientMedicalInfoController from '../controllers/patientMedicalInfoController.js';

const router = express.Router();

// Todas las rutas requieren un patientId
router.get('/:patientId/medical-info', patientMedicalInfoController.getByPatientId);
router.post('/:patientId/medical-info', patientMedicalInfoController.create);
router.put('/:patientId/medical-info', patientMedicalInfoController.update);
router.delete('/:patientId/medical-info', patientMedicalInfoController.delete);

export default router;