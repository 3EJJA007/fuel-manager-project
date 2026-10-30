import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './server/routes/auth.js';
import usersRoutes from './server/routes/users.js';
import stationsRoutes from './server/routes/stations.js';
import fuelsRoutes from './server/routes/fuels.js';
import pumpsRoutes from './server/routes/pumps.js';
import tanksRoutes from './server/routes/tanks.js';
import suppliersRoutes from './server/routes/suppliers.js';
import deliveriesRoutes from './server/routes/deliveries.js';
import salesRoutes from './server/routes/sales.js';
import statsRoutes from './server/routes/stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/stations', stationsRoutes);
app.use('/api/fuels', fuelsRoutes);
app.use('/api/pumps', pumpsRoutes);
app.use('/api/tanks', tanksRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/deliveries', deliveriesRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/stats', statsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'FUEL//MANAGER',
    version: '1.0.0 (Sprint 1 & 2)',
    institution: 'ISET Charguia - PFE / Intégration',
    supervisor: 'Mme Sonia Gannar',
    timestamp: new Date().toISOString()
  });
});

// Single Page Application fallback to index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    message: 'Une erreur interne est survenue sur le serveur.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`⛽ FUEL//MANAGER - Application Web de Gestion de Carburant`);
  console.log(`🚀 Serveur actif sur : http://localhost:${PORT}`);
  console.log(`🎓 Projet ISET Charguia - Encadré par Mme Sonia Gannar`);
  console.log(`=======================================================`);
});
