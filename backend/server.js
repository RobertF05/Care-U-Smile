import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Importar rutas
import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import patientMedicalInfoRoutes from './routes/patientMedicalInfoRoutes.js';
import procedureRoutes from './routes/procedureRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import billRoutes from './routes/billRoutes.js';
import monthlyClosingRoutes from './routes/monthlyClosingRoutes.js';
import systemSettingsRoutes from './routes/systemSettingsRoutes.js';
import dailyClosingRoutes from './routes/dailyClosingRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import exportDailyRoutes from './routes/exportDailyRoutes.js';

// Importar y probar conexión
import { testConnection } from './config/supabase.js';

dotenv.config();

const app = express();

// 🔴 CONFIGURACIÓN CORS BASADA EN TU .env
const allowedOrigins = [
  'http://localhost:5173',           // Desarrollo Vite
  'http://localhost:3000',            // Desarrollo alternativo
  'https://care-u-smile.onrender.com', // Producción frontend (si aplica)
  process.env.CORS_ORIGIN             // Del archivo .env: http://localhost:5173
].filter(Boolean); // Elimina valores undefined

// Log de configuración
console.log('🌐 Configuración CORS:', {
  NODE_ENV: process.env.NODE_ENV,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  allowedOrigins
});

app.use(cors({
  origin: function(origin, callback) {
    // Permitir solicitudes sin origen (como Postman o apps móviles)
    if (!origin) {
      console.log('✅ Solicitud sin origen permitida');
      return callback(null, true);
    }
    
    // En desarrollo, permitir todos los orígenes locales
    if (process.env.NODE_ENV === 'development') {
      if (origin.startsWith('http://localhost:')) {
        console.log(`✅ Origen local permitido en desarrollo: ${origin}`);
        return callback(null, true);
      }
    }
    
    // Verificar si el origen está en la lista de permitidos
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`✅ Origen permitido: ${origin}`);
      callback(null, true);
    } else {
      console.log(`🚫 Origen bloqueado por CORS: ${origin}`);
      console.log('   Orígenes permitidos:', allowedOrigins);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "user-id",           // 👈 IMPORTANTE: Este es el que necesitamos
    "X-Requested-With",
    "Accept",
    "Origin"
  ],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  optionsSuccessStatus: 200
}));

// Middleware para manejar preflight requests
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para logging de requests (útil para debug)
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.path} - Origin: ${req.get('origin') || 'sin origen'}`);
  console.log('   Headers:', {
    'user-id': req.get('user-id') || 'no enviado',
    'authorization': req.get('authorization') ? 'presente' : 'no enviado'
  });
  next();
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API de Clínica Dental Care U Smile',
    version: '2.0.0',
    environment: process.env.NODE_ENV,
    endpoints: {
      auth: '/api/auth/login',
      patients: '/api/patients',
      procedures: '/api/procedures',
      appointments: '/api/appointments',
      bills: '/api/bills',
      closings: '/api/monthly-closings',
      dailyClosings: '/api/daily-closings',
      settings: '/api/settings',
      export: '/api/export'
    }
  });
});

// Health check mejorado
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await testConnection();
    res.json({ 
      success: true,
      status: dbStatus ? 'healthy' : 'unhealthy',
      database: dbStatus ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      cors: {
        origin: req.get('origin') || 'ninguno',
        allowed: allowedOrigins.includes(req.get('origin')) || !req.get('origin'),
        headers: req.headers
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ============================================
// RUTAS API
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/patients', patientMedicalInfoRoutes);
app.use('/api/procedures', procedureRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/monthly-closings', monthlyClosingRoutes);
app.use('/api/settings', systemSettingsRoutes);
app.use('/api/daily-closings', dailyClosingRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/export', exportDailyRoutes);

// ============================================
// MANEJO DE ERRORES
// ============================================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  // Error de CORS específico
  if (err.message === 'No permitido por CORS') {
    return res.status(403).json({ 
      success: false,
      error: 'Acceso denegado por CORS',
      message: 'El origen no está autorizado',
      origin: req.get('origin'),
      allowedOrigins: allowedOrigins
    });
  }
  
  // Error de validación o de la aplicación
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ 
    success: false,
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Entorno: ${process.env.NODE_ENV}`);
  console.log(`🌐 Orígenes CORS permitidos:`, allowedOrigins);
  console.log(`🔑 Supabase URL: ${process.env.SUPABASE_URL ? 'Configurada' : 'No configurada'}`);
});