import jwt from 'jsonwebtoken';

const authMiddleware = {

  verifyToken: (req, res, next) => {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Autenticación requerida'
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.userId = decoded.id;
      req.user = decoded;

      next();

    } catch (error) {
      console.error('Error verificando token:', error);
      return res.status(401).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }
  }

};

export default authMiddleware;