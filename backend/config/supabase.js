import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Cliente para operaciones del servidor (con service role)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Cliente para operaciones públicas (con anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Función para probar conexión
export const testConnection = async () => {
  try {
    const { error } = await supabase.from('patients').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Conectado a Supabase');
    return true;
  } catch (error) {
    console.error('❌ Error conectando a Supabase:', error.message);
    return false;
  }
};

export default supabase;