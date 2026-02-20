import express from 'express';
import dailyClosingController from '../controllers/dailyClosingController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// 🔐 Todas las rutas requieren JWT
router.use(authMiddleware.verifyToken);

// ============================================
// RUTAS ESPECÍFICAS (DEBEN IR ANTES DE /:id)
// ============================================

// Obtener resumen financiero del día
router.get('/summary/daily', dailyClosingController.getDailySummary);

// Verificar si existe cierre para una fecha
router.get('/check/exists', dailyClosingController.checkExists);

// ============================================
// RUTAS PRINCIPALES
// ============================================

router.get('/', dailyClosingController.getAll);
router.get('/:id', dailyClosingController.getById);
router.post('/', dailyClosingController.create);
router.put('/:id', dailyClosingController.update);
router.delete('/:id', dailyClosingController.delete);

export default router;