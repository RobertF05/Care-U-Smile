import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Importar rutas
import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import procedureRoutes from './routes/procedureRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import billRoutes from './routes/billRoutes.js';
import monthlyClosingRoutes from './routes/monthlyClosingRoutes.js';

// Importar y probar conexión
import { testConnection } from './config/supabase.js';

dotenv.config();

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API de Clínica Dental Care U Smile',
    endpoints: {
      login: '/api/auth/login',
      patients: '/api/patients',
      procedures: '/api/procedures',
      appointments: '/api/appointments',
      bills: '/api/bills',
      closings: '/api/monthly-closings'
    }
  });
});

// Health check
app.get('/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({ 
    status: dbStatus ? 'healthy' : 'unhealthy',
    database: dbStatus ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/procedures', procedureRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/monthly-closings', monthlyClosingRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
});