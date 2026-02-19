// frontend/src/context/AuthContext.jsx (VERSIÓN CORREGIDA)
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNotification } from './NotificationContext';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotification();

  // Determinar la URL base según el entorno
  const API_BASE_URL = import.meta.env.VITE_API_URL || '';

  // Verificar autenticación al cargar
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const savedUser = localStorage.getItem('user');
      
      if (!savedUser) {
        console.log('ℹ️ No hay usuario guardado en localStorage');
        setLoading(false);
        return;
      }

      const userData = JSON.parse(savedUser);
      console.log('👤 Usuario guardado:', userData);
      
      // 🔴 CORRECCIÓN: Buscar el ID en cualquiera de estos campos
      const userId = userData.user_ID || userData.user_id || userData.id;
      
      if (!userId) {
        console.warn('⚠️ Usuario guardado sin ID válido', userData);
        setUser(userData); // Usar datos guardados sin verificar
        setLoading(false);
        return;
      }
      
      console.log('🔍 Verificando sesión para user_id:', userId);
      
      // Intentar verificar la sesión con el backend
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/check-session?user_id=${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 400) {
            console.warn('⚠️ Backend rechazó la verificación, usando datos locales');
            setUser(userData);
            setLoading(false);
            return;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
          console.log('✅ Sesión verificada correctamente');
          setUser(data.data.user);
        } else {
          console.warn('⚠️ Sesión inválida en backend, usando datos locales');
          setUser(userData);
        }
      } catch (error) {
        console.error('Error verificando sesión con backend:', error);
        // En caso de error, usar los datos guardados temporalmente
        console.log('📱 Usando datos de localStorage por error de conexión');
        setUser(userData);
      }
      
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      // Limpiar datos inválidos solo si hay error de parseo
      if (error instanceof SyntaxError) {
        localStorage.removeItem('user');
        setUser(null);
      } else {
        // Si el usuario existe pero hay error de red, mantenerlo
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch {
            localStorage.removeItem('user');
            setUser(null);
          }
        }
      }
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
        
        console.log('✅ Usuario logueado:', userData);
        
        // Guardar en localStorage
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        
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
        const errorMsg = data.error || 'Credenciales incorrectas';
        
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