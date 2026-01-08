import React, { createContext, useState, useEffect } from 'react';

// Crear el contexto
export const AuthContext = createContext();

// Provider del contexto
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Simular verificación de sesión al cargar
  useEffect(() => {
    const checkAuth = async () => {
      // Aquí iría la lógica para verificar si hay un token válido
      // Por ahora, simulamos una carga
      setTimeout(() => {
        // Verificar si hay usuario en localStorage (temporal)
        const savedUser = localStorage.getItem('dentalUser');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
        setLoading(false);
      }, 1000);
    };

    checkAuth();
  }, []);

  // Función para iniciar sesión
  const login = async (email, password) => {
    try {
      // Aquí conectarías con tu backend
      // Ejemplo: const response = await fetch('/api/auth/login', {...})
      
      // Simulación exitosa
      const mockUser = {
        id: '1',
        email,
        name: 'Dr. Administrador',
        role: 'odontologo',
        clinic: 'Care U Smile'
      };
      
      setUser(mockUser);
      localStorage.setItem('dentalUser', JSON.stringify(mockUser));
      
      return { success: true, user: mockUser };
    } catch (error) {
      console.error('Error en login:', error);
      return { success: false, error: 'Credenciales incorrectas' };
    }
  };

  // Función para cerrar sesión
  const logout = () => {
    setUser(null);
    localStorage.removeItem('dentalUser');
    console.log('Sesión cerrada');
  };

  // Valores que estarán disponibles en el contexto
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