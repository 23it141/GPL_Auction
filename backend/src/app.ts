import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/auth';
import teamRoutes from './routes/teams';
import playerRoutes from './routes/players';
import reportRoutes from './routes/reports';

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for local networking (multiple devices on same Wi-Fi)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // Support base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const frontendDistPath = path.join(__dirname, '../../frontend/dist');

// Serve static assets from frontend build
app.use(express.static(frontendDistPath));

// Route registrations
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Serve frontend SPA routing
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(frontendDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ message: `API route ${req.method} ${req.url} not found` });
  }
});

// Fallback 404 for unmatched API routes
app.use((req, res) => {
  res.status(404).json({ message: `API route ${req.method} ${req.url} not found` });
});

export default app;

