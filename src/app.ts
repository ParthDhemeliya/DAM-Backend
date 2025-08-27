import express from 'express';
import dotenv from 'dotenv';

// Import middleware
import { errorHandler } from './middleware/errorHandler';

// Import services
import { createServer, setupRoutes } from './config/server.config';
import { healthCheck, checkServices } from './services/health.service';
import { startWorkers } from './services/worker.service';
import { initializeAnalytics } from './services/analytics-init.service';

dotenv.config();

const { app, PORT } = createServer();

// Setup routes
setupRoutes(app);

// Health check endpoint
app.get('/health', healthCheck);

// Start services check and workers asynchronously
checkServices().catch(error => {
  console.warn('Service check failed, but server will continue:', error);
});

// Initialize analytics services
initializeAnalytics().catch(error => {
  console.warn(
    'Analytics initialization failed, but server will continue:',
    error
  );
});

// Start workers
startWorkers().catch(error => {
  console.warn('Worker startup failed, but server will continue:', error);
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Start server
app.listen(PORT, () => {
  console.log('Server running on port', PORT);
  console.log(`API Documentation: http://localhost:${PORT}/`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
});

export default app;
