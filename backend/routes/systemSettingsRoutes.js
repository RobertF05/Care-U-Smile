// backend/routes/systemSettingsRoutes.js
import express from 'express';
import systemSettingsController from '../controllers/systemSettingsController.js';

const router = express.Router();

// Rutas de configuraciones
router.get('/', systemSettingsController.getAll);
router.get('/current', systemSettingsController.getCurrent);
router.get('/percentages', systemSettingsController.getOrthodonticsPercentages);
router.get('/history', systemSettingsController.getHistory);
router.get('/:id', systemSettingsController.getById);
router.post('/', systemSettingsController.create);
router.put('/:id', systemSettingsController.update);
router.delete('/:id', systemSettingsController.delete);

export default router;