// backend/models/userModel.js
import { supabaseAdmin } from '../config/supabase.js';

const User = {
  // Encontrar usuario por ID (CORREGIDO para usar user_ID)
  async findById(id) {
    try {
      console.log('🔍 Buscando usuario por ID:', id);
      
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('user_ID', id) // 👈 CAMBIADO de 'id' a 'user_ID'
        .maybeSingle();
      
      if (error) {
        console.error('Error en findById:', error);
        throw error;
      }
      
      console.log('✅ Usuario encontrado:', data ? 'Sí' : 'No');
      return data;
    } catch (error) {
      console.error('Error en User.findById:', error);
      return null;
    }
  },

  // Encontrar usuario por email
  async findByEmail(email) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error en User.findByEmail:', error);
      return null;
    }
  },

  // Verificar credenciales
  async verifyCredentials(email, password) {
    try {
      const user = await this.findByEmail(email);
      
      if (!user) return null;
      
      // ⚠️ En producción, usa bcrypt.compare()
      if (user.password !== password) return null;
      
      // No enviar la contraseña
      delete user.password;
      return user;
    } catch (error) {
      console.error('Error en User.verifyCredentials:', error);
      return null;
    }
  },

  // Crear nuevo usuario
  async create(userData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert([{
          email: userData.email,
          password: userData.password,
          username: userData.name,
          user_type: userData.user_type || 'USER'
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      // No enviar la contraseña
      delete data.password;
      return data;
    } catch (error) {
      console.error('Error en User.create:', error);
      throw error;
    }
  }
};

export default User;