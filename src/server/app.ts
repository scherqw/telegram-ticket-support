import express, { Application } from 'express';
import cors from 'cors';
import path from 'path';
import { ticketRoutes } from './routes/tickets';
import { authRoutes } from './routes/auth';
import { authMiddleware } from './middleware/auth';

export function createApp(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static Web App files
  app.use(express.static(path.join(__dirname, '../../webapp/dist')));

  // Public Routes
  app.use('/api/auth', authRoutes);
  
  // API Routes (protected)
  app.use('/api/tickets', authMiddleware, ticketRoutes);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // FALLBACK: Serve index.html for any unknown route (SPA support)
  // This ensures that refreshing the page on /dashboard or /login works
  app.get(/.*/, (req, res) => {
    // API 404s should return JSON, not HTML
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: 'API Endpoint not found' });
      return;
    }
    res.sendFile(path.join(__dirname, '../../webapp/dist/index.html'));
  });

  return app;
}