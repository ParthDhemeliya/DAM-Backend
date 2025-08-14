import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'

// Import routes
import assetsRoutes from './routes/assets.routes'
import jobsRoutes from './routes/jobs.routes'
import queuesRoutes from './routes/queues.routes'
import streamingUploadRoutes from './routes/streaming-upload.routes'

// Import and start job workers
import './workers/job-workers'

// Import middleware
import { errorHandler } from './middleware/errorHandler'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())

// Skip JSON/URL-encoded parsing for streaming upload route
app.use((req, res, next) => {
  if (req.path.startsWith('/api/streaming-upload')) {
    // Skip JSON/URL-encoded parsing for streaming routes
    return next()
  }

  // Apply JSON/URL-encoded parsing for other routes
  express.json({ limit: '10mb' })(req, res, next)
})

app.use((req, res, next) => {
  if (req.path.startsWith('/api/streaming-upload')) {
    // Skip URL-encoded parsing for streaming routes
    return next()
  }

  // Apply URL-encoded parsing for other routes
  express.urlencoded({ extended: true, limit: '10mb' })(req, res, next)
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'DAM Backend API is running',
  })
})

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'DAM Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      assets: {
        base: '/api/assets',
        byId: '/api/assets/:id',
        create: 'POST /api/assets',
        update: 'PUT /api/assets/:id',
        delete: 'DELETE /api/assets/:id',
        upload: 'POST /api/assets/upload',
        access: 'GET /api/assets/:id/access',
      },
      jobs: {
        base: '/api/jobs',
        byId: '/api/jobs/:id',
        byAsset: '/api/jobs/asset/:assetId',
        create: 'POST /api/jobs',
        update: 'PUT /api/jobs/:id',
        delete: 'DELETE /api/jobs/:id',
      },
      queues: {
        base: '/api/queues',
        stats: 'GET /api/queues/stats',
        addJob: 'POST /api/queues/jobs',
        addBatch: 'POST /api/queues/jobs/batch',
        thumbnail: 'POST /api/queues/jobs/thumbnail',
        metadata: 'POST /api/queues/jobs/metadata',
        conversion: 'POST /api/queues/jobs/metadata',
        cleanup: 'POST /api/queues/jobs/cleanup',
        pause: 'POST /api/queues/pause',
        resume: 'POST /api/queues/resume',
        clear: 'DELETE /api/queues/clear?confirm=true',
      },
      streamingUpload: {
        base: '/api/streaming-upload',
        upload: 'POST /api/streaming-upload/upload',
        health: 'GET /api/streaming-upload/health',
        stats: 'GET /api/streaming-upload/stats',
      },
    },
  })
})

// API Routes
app.use('/api/assets', assetsRoutes)
app.use('/api/jobs', jobsRoutes)
app.use('/api/queues', queuesRoutes)

// Streaming upload route (uses Busboy, bypasses JSON/URL-encoded middleware)
app.use('/api/streaming-upload', streamingUploadRoutes)

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port: http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  console.log(`Assets API: http://localhost:${PORT}/api/assets`)
  console.log(`Jobs API: http://localhost:${PORT}/api/jobs`)
})

export default app
