import User from '../models/userModel.js';

const authController = {
  // Login de usuario
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
      
      res.json({ 
        success: true, 
        message: 'Login exitoso',
        data: { user }
      });
    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error en el servidor' 
      });
    }
  },

  // Registro de usuario (solo admin)
  register: async (req, res) => {
    try {
      const { email, password, name, user_type = 'USER' } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email, contraseña y nombre son requeridos' 
        });
      }
      
      // Verificar si usuario existe
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'El usuario ya existe' 
        });
      }
      
      const newUser = await User.create({
        email,
        password, // ⚠️ En producción, usar bcrypt
        name,
        user_type
      });
      
      res.status(201).json({ 
        success: true, 
        message: 'Usuario creado exitosamente',
        data: { user: newUser }
      });
    } catch (error) {
      console.error('Error en registro:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error en el servidor' 
      });
    }
  },

  // Verificar sesión
  checkSession: async (req, res) => {
    try {
      const { user_id } = req.query;
      
      if (!user_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'ID de usuario requerido' 
        });
      }
      
      const user = await User.findById(user_id);
      
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