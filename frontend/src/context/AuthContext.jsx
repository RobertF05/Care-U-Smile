// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Verificar autenticación al cargar
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const savedUser = localStorage.getItem('user');
      
      if (!savedUser) {
        setLoading(false);
        return;
      }

      // Verificar con backend si la sesión es válida
      const userData = JSON.parse(savedUser);
      
      // Tu backend no tiene endpoint de verificación de sesión todavía
      // Por ahora, usar el usuario guardado
      // Cuando implementes JWT, aquí verificarías el token
      setUser(userData);
      
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      // Limpiar datos inválidos
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setAuthError(null);
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Basado en tu authController, devuelve: { success: true, data: { user } }
        const userData = data.data.user;
        
        // Guardar en localStorage
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        
        return { 
          success: true, 
          user: userData 
        };
      } else {
        setAuthError(data.error || 'Credenciales incorrectas');
        return { 
          success: false, 
          error: data.error || 'Error en login' 
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      setAuthError('Error de conexión con el servidor');
      return { 
        success: false, 
        error: 'Error de conexión con el servidor' 
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setAuthError(null);
  };

  const value = {
    user,
    login,
    logout,
    loading,
    authError,
    clearAuthError: () => setAuthError(null),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};