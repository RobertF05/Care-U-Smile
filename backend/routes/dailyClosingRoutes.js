// backend/routes/dailyClosingRoutes.js
import express from 'express';
import dailyClosingController from '../controllers/dailyClosingController.js';
import authMiddleware from '../middleware/authMiddleware.js'; // Importar todo el objeto

const router = express.Router();

// Todas las rutas requieren autenticación básica
router.use(authMiddleware.verifyBasicAuth); // Usar el método correcto

// ============================================
// RUTAS PRINCIPALES
// ============================================

// Obtener todos los cierres diarios (con filtros opcionales)
router.get('/', dailyClosingController.getAll);

// Obtener un cierre específico por ID
router.get('/:id', dailyClosingController.getById);

// Crear un nuevo cierre diario
router.post('/', dailyClosingController.create);

// Actualizar un cierre diario
router.put('/:id', dailyClosingController.update);

// Eliminar un cierre diario
router.delete('/:id', dailyClosingController.delete);

// ============================================
// RUTAS ESPECÍFICAS (DEBEN IR ANTES DE /:id)
// ============================================

// Obtener resumen financiero del día (para vista en vivo)
router.get('/summary/daily', dailyClosingController.getDailySummary);

// Verificar si existe cierre para una fecha
router.get('/check/exists', dailyClosingController.checkExists);

export default router;