// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNotification } from './NotificationContext';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotification();

  // Determinar la URL base según el entorno
  const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? '' 
    : 'http://localhost:3000';

  // Verificar autenticación al cargar
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const savedUser = localStorage.getItem('user');
      
      if (!savedUser) {
        setLoading(false);
        return;
      }

      const userData = JSON.parse(savedUser);
      
      // Intentar verificar la sesión con el backend
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/check-session?user_id=${userData.user_id || userData.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
          setUser(data.data.user);
        } else {
          // Sesión inválida, limpiar
          localStorage.removeItem('user');
          setUser(null);
          addNotification('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 'warning', 4000);
        }
      } catch (error) {
        console.error('Error verificando sesión:', error);
        // En caso de error, usar los datos guardados temporalmente
        setUser(userData);
      }
      
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      // Limpiar datos inválidos
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const userData = data.data.user;
        
        // Guardar en localStorage
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        
        // Mostrar notificación de éxito
        addNotification(
          `¡Bienvenido ${userData.username || userData.email}!`,
          'success',
          3000
        );
        
        return { 
          success: true, 
          user: userData 
        };
      } else {
        // Mostrar notificación de error específico
        const errorMsg = data.error || 'Credenciales incorrectas';
        
        // Mensajes más amigables para el usuario
        let userFriendlyMsg = errorMsg;
        if (errorMsg.includes('Credenciales incorrectas')) {
          userFriendlyMsg = 'El correo electrónico o la contraseña son incorrectos';
        } else if (errorMsg.includes('no encontrado')) {
          userFriendlyMsg = 'No existe una cuenta con este correo electrónico';
        }
        
        addNotification(userFriendlyMsg, 'error', 5000);
        
        return { 
          success: false, 
          error: errorMsg 
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Mostrar notificación de error de conexión
      let errorMessage = 'Error de conexión con el servidor';
      let notificationType = 'error';
      
      if (error.message.includes('ConnectTimeoutError') || error.message.includes('fetch failed')) {
        errorMessage = 'No se pudo conectar al servidor. Verifica que esté corriendo en localhost:3000';
        notificationType = 'warning';
      } else if (error.message.includes('404')) {
        errorMessage = 'El servidor de autenticación no está disponible';
      } else if (error.message.includes('500')) {
        errorMessage = 'Error interno del servidor. Por favor, intenta más tarde';
      }
      
      addNotification(errorMessage, notificationType, 6000);
      
      return { 
        success: false, 
        error: errorMessage 
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    const userName = user?.username || user?.email || 'Usuario';
    localStorage.removeItem('user');
    setUser(null);
    
    // Mostrar notificación al cerrar sesión
    addNotification(`¡Hasta pronto ${userName}! Sesión cerrada correctamente.`, 'info', 3000);
  };

  const value = {
    user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};