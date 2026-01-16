import express, { Application } from 'express';
import cors from 'cors';
import path from 'path';
import { ticketRoutes } from './routes/tickets';
import { authMiddleware } from './middleware/auth';

export function createApp(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static Web App files
  app.use('/webapp', express.static(path.join(__dirname, '../../webapp/dist')));

  // API Routes (protected)
  app.use('/api/tickets', authMiddleware, ticketRoutes);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}