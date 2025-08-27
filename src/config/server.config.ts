import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

export const createServer = () => {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Range',
        'Accept-Ranges',
      ],
      exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
    })
  );
  app.use(express.json({ limit: '1gb' }));
  app.use(express.urlencoded({ extended: true, limit: '1gb' }));

  return { app, PORT };
};

export const setupRoutes = (app: express.Application) => {
  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      message: 'DAM Backend API',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        assets: '/api/assets',
        jobs: '/api/jobs',
        queues: '/api/queues',
        video: '/api/video',
        stats: '/api/stats',
      },
    });
  });

  // API Routes
  const assetsRoutes = require('../routes/assets.routes').default;
  const jobsRoutes = require('../routes/jobs.routes').default;
  const queuesRoutes = require('../routes/queues.routes').default;
  const videoRoutes = require('../routes/video.routes').default;
  const statsRoutes = require('../routes/stats.routes').default;

  app.use('/api/assets', assetsRoutes);
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/queues', queuesRoutes);
  app.use('/api/video', videoRoutes);
  app.use('/api/stats', statsRoutes);
};
