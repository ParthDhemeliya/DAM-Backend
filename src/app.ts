import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'

// Import routes
import assetsRoutes from './routes/assets.routes'
import jobsRoutes from './routes/jobs.routes'
import queuesRoutes from './routes/queues.routes'
import videoRoutes from './routes/video.routes'
import statsRoutes from './routes/stats.routes'

// Import middleware
import { errorHandler } from './middleware/errorHandler'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'Accept-Ranges'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  })
)
app.use(express.json({ limit: '1gb' }))
app.use(express.urlencoded({ extended: true, limit: '1gb' }))

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const { testConnection } = await import('./config/database.config')
    const dbConnected = await testConnection()
    const redisConnected = await testRedisConnection()

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? 'connected' : 'disconnected',
        redis: redisConnected ? 'connected' : 'disconnected',
        server: 'running',
        port: process.env.PORT || 3000,
      },
      environment: process.env.NODE_ENV || 'development',
    })
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      services: {
        database: 'error',
        redis: 'error',
        server: 'running',
        port: process.env.PORT || 3000,
      },
    })
  }
})

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
  })
})

// API Routes
app.use('/api/assets', assetsRoutes)
app.use('/api/jobs', jobsRoutes)
app.use('/api/queues', queuesRoutes)
app.use('/api/video', videoRoutes)
app.use('/api/stats', statsRoutes)

// Start background workers
import {
  thumbnailWorker,
  metadataWorker,
  conversionWorker,
  cleanupWorker,
} from './workers/asset-processing.worker'

// Import Redis analytics initialization
import { initRedis, testRedisConnection } from './config/redis.config'
import { initializeStatsService } from './services/stats.service'

// Startup service check function
const checkServices = async () => {
  try {
    const { testConnection } = await import('./config/database.config')
    const dbConnected = await testConnection()
    if (dbConnected) {
      console.log('Database: Connected')
    } else {
      console.log('Database: Connection failed')
    }
  } catch (error) {
    console.log(
      'Database: Connection error -',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }

  try {
    const redisConnected = await testRedisConnection()
    if (redisConnected) {
      console.log('Redis: Connected')
    } else {
      console.log('Redis: Connection failed')
    }
  } catch (error) {
    console.log(
      'Redis: Connection error -',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }

  try {
    const { getSignedReadUrl, ensureBucketExists } = await import(
      './services/storage'
    )
    await getSignedReadUrl('test', 1)
    console.log('MinIO: Connected')

    try {
      await ensureBucketExists()
      console.log('MinIO: Bucket ready')
    } catch (bucketError) {
      console.warn('MinIO: Bucket initialization failed -', bucketError)
    }
  } catch (error) {
    console.log('MinIO: Not available (Docker may be down)')
  }
}

// Start workers
const startWorkers = async () => {
  try {
    console.log('Starting background workers...')

    if (!thumbnailWorker.isRunning()) {
      thumbnailWorker.run()
      console.log('Thumbnail worker started')
    }

    if (!metadataWorker.isRunning()) {
      metadataWorker.run()
      console.log('Metadata worker started')
    }

    if (!conversionWorker.isRunning()) {
      conversionWorker.run()
      console.log('Conversion worker started')
    }

    if (!cleanupWorker.isRunning()) {
      cleanupWorker.run()
      console.log('Cleanup worker started')
    }

    console.log('All background workers started successfully!')
  } catch (error) {
    console.warn(
      'Some background workers failed to start (Docker services may be unavailable):',
      error
    )
    console.log('Server will continue running with limited functionality')
  }
}

// Start services check and workers asynchronously
checkServices().catch((error) => {
  console.warn('Service check failed, but server will continue:', error)
})

// Initialize Redis and analytics services
const initializeAnalytics = async () => {
  try {
    await initRedis()
    await initializeStatsService()

    const { initializeRedisAnalytics } = await import('./utils/redis-sync')
    await initializeRedisAnalytics()

    console.log('Analytics services initialized successfully')
  } catch (error) {
    console.warn(
      'Failed to initialize analytics services, continuing with fallback data:',
      error
    )
  }
}

initializeAnalytics().catch((error) => {
  console.warn(
    'Analytics initialization failed, but server will continue:',
    error
  )
})

startWorkers().catch((error) => {
  console.warn('Worker startup failed, but server will continue:', error)
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
  console.log('Server running on port', PORT)
  console.log('API Documentation: http://localhost:3000/')
  console.log('Health Check: http://localhost:3000/health')
})

export default app
