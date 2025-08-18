import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import { testConnection } from './config/database.config'

// Import routes
import assetsRoutes from './routes/assets.routes'
import jobsRoutes from './routes/jobs.routes'
import queuesRoutes from './routes/queues.routes'
import streamingUploadRoutes from './routes/streaming-upload.routes'
import videoRoutes from './routes/video.routes'

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
      video: {
        base: '/api/video',
        process: 'POST /api/video/process',
        transcode: 'POST /api/video/transcode',
        thumbnail: 'POST /api/video/thumbnail',
        metadata: 'POST /api/video/metadata',
        supportedFormats: 'GET /api/video/supported-formats',
        health: 'GET /api/video/health',
        jobs: 'GET /api/video/jobs/:assetId',
      },
    },
  })
})

// API Routes
app.use('/api/assets', assetsRoutes)
app.use('/api/jobs', jobsRoutes)
app.use('/api/queues', queuesRoutes)
app.use('/api/video', videoRoutes)

// Streaming upload route (uses Busboy, bypasses JSON/URL-encoded middleware)
app.use('/api/streaming-upload', streamingUploadRoutes)

// Database connection test endpoint
app.get('/api/db/test', async (req, res) => {
  try {
    const isConnected = await testConnection()
    if (isConnected) {
      res.json({
        success: true,
        message: 'Database connection successful',
        timestamp: new Date().toISOString(),
      })
    } else {
      res.status(500).json({
        success: false,
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
  }
})

// Debug endpoint to check table structure
app.get('/api/db/debug', async (req, res) => {
  try {
    const pool = require('./config/database.config').default
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'assets' 
      ORDER BY ordinal_position
    `)

    res.json({
      success: true,
      tableStructure: result.rows,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get table structure',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
  }
})

// Debug endpoint to check jobs table structure
app.get('/api/db/debug/jobs', async (req, res) => {
  try {
    const pool = require('./config/database.config').default
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      ORDER BY ordinal_position
    `)

    // Also get a sample row to see the actual data structure
    const sampleResult = await pool.query('SELECT * FROM jobs LIMIT 1')

    res.json({
      success: true,
      tableStructure: result.rows,
      sampleData: sampleResult.rows[0] || null,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get jobs table structure',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
  }
})

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
  console.log(`Video API: http://localhost:${PORT}/api/video`)
})

export default app
