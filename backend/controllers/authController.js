import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';

const authController = {

  // 🔐 Login con JWT
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email y contraseña son requeridos'
        });
      }

      const user = await User.verifyCredentials(email, password);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Credenciales incorrectas'
        });
      }

      // 🎟 Generar token
      const token = jwt.sign(
        {
          id: user.user_ID,
          email: user.email,
          user_type: user.user_type
        },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );

      res.json({
        success: true,
        message: 'Login exitoso',
        data: {
          user,
          token
        }
      });

    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({
        success: false,
        error: 'Error en el servidor'
      });
    }
  },

  // 🔐 Verificar sesión usando JWT
  checkSession: async (req, res) => {
    try {
      const userId = req.userId;

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Usuario no encontrado'
        });
      }

      res.json({
        success: true,
        data: { user }
      });

    } catch (error) {
      console.error('Error verificando sesión:', error);
      res.status(500).json({
        success: false,
        error: 'Error en el servidor'
      });
    }
  }
};

export default authController;