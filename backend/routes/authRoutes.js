import express from 'express';
import authController from '../controllers/authController.js';

const router = express.Router();

// Rutas públicas
router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/check-session', authController.checkSession);

export default router;