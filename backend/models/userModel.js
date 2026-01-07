import { supabaseAdmin } from '../config/supabase.js';

const User = {
  // Buscar usuario por email
  async findByEmail(email) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Buscar usuario por ID
  async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, user_type, created_at')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Crear usuario
  async create(userData) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert([{
        ...userData,
        created_at: new Date().toISOString()
      }])
      .select('id, email, name, user_type, created_at')
      .single();
    
    if (error) throw error;
    return data;
  },

  // Verificar credenciales
  async verifyCredentials(email, password) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (data) {
      // Eliminar password de la respuesta
      const { password: _, ...userWithoutPassword } = data;
      return userWithoutPassword;
    }
    
    return null;
  }
};

export default User;