import express from 'express';
import procedureController from '../controllers/procedureController.js';

const router = express.Router();

// Rutas para procedimientos regulares
router.get('/normal', procedureController.getAllNormal);

// Rutas para ortodoncias
router.get('/orthodontics', procedureController.getAllOrthodontics);

// Ruta para estadísticas de ingresos
router.get('/stats/income', procedureController.getIncomeStats);

// Ruta para contar procedimientos
router.get('/count', procedureController.count);

// Rutas CRUD básicas
router.get('/:id', procedureController.getById);
router.post('/', procedureController.create);
router.put('/:id', procedureController.update);
router.delete('/:id', procedureController.delete);

// Ruta para obtener procedimientos por paciente
router.get('/patient/:patientId', procedureController.getByPatientId);

export default router;