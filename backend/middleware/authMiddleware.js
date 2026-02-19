// backend/middlewares/authMiddleware.js
import jwt from 'jsonwebtoken';

const authMiddleware = {
  // Verificar tanto token JWT como user-id
  verifyToken: (req, res, next) => {
    // Primero intentar con user-id (tu sistema actual)
    const userId = req.headers['user-id'];
    
    if (userId) {
      req.userId = userId;
      return next();
    }
    
    // Si no, intentar con token JWT
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          error: 'Autenticación requerida' 
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_secreto_jwt');
      req.user = decoded;
      req.userId = decoded.id || decoded.userId;
      next();
    } catch (error) {
      console.error('Error verificando token:', error);
      res.status(401).json({ 
        success: false, 
        error: 'Token inválido o expirado' 
      });
    }
  },

  // Mantener verifyBasicAuth para compatibilidad
  verifyBasicAuth: (req, res, next) => {
    const userId = req.headers['user-id'];
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Autenticación requerida' 
      });
    }
    
    req.userId = userId;
    next();
  },

  isAdmin: async (req, res, next) => {
    try {
      // Implementar lógica de admin
      next();
    } catch (error) {
      console.error('Error verificando admin:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error de autorización' 
      });
    }
  }
};

export default authMiddleware;