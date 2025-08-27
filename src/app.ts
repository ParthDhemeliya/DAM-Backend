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
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'Accept-Ranges'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  })
)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    const { testConnection } = await import('./config/database.config')
    const dbConnected = await testConnection()

    // Test Redis connection
    const redisConnected = await testRedisConnection()

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      message: 'DAM Backend API is running',
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

// Test workers endpoint
app.get('/test-workers', async (req, res) => {
  try {
    const { thumbnailQueue, metadataQueue, conversionQueue } = await import(
      './config/queue.config'
    )

    // Check queue status
    const thumbnailWaiting = await thumbnailQueue.getWaiting()
    const metadataWaiting = await metadataQueue.getWaiting()
    const conversionWaiting = await conversionQueue.getWaiting()

    // Check worker status
    const thumbnailWorkerStatus = thumbnailWorker.isRunning()
      ? 'running'
      : 'stopped'
    const metadataWorkerStatus = metadataWorker.isRunning()
      ? 'running'
      : 'stopped'
    const conversionWorkerStatus = conversionWorker.isRunning()
      ? 'running'
      : 'stopped'

    res.json({
      success: true,
      message: 'Worker status check completed',
      workers: {
        thumbnail: {
          status: thumbnailWorkerStatus,
          waitingJobs: thumbnailWaiting.length,
          queue: 'thumbnail-generation',
        },
        metadata: {
          status: metadataWorkerStatus,
          waitingJobs: metadataWaiting.length,
          queue: 'metadata-extraction',
        },
        conversion: {
          status: conversionWorkerStatus,
          waitingJobs: conversionWaiting.length,
          queue: 'file-conversion',
        },
      },
      queues: {
        thumbnail: thumbnailWaiting.length,
        metadata: metadataWaiting.length,
        conversion: conversionWaiting.length,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// Manual thumbnail generation endpoint for testing
app.post('/test-thumbnail/:assetId', async (req, res) => {
  try {
    const assetId = parseInt(req.params.assetId)

    // Get asset details
    const { getAssetById } = await import('./services/asset.service')
    const asset = await getAssetById(assetId)

    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    if (asset.file_type !== 'image') {
      return res
        .status(400)
        .json({ success: false, error: 'Asset is not an image' })
    }

    // Create thumbnail job
    const { createJob } = await import('./services/job.service')
    const { thumbnailQueue } = await import('./config/queue.config')

    const thumbnailJob = await createJob({
      job_type: 'thumbnail',
      asset_id: asset.id!,
      status: 'pending',
      priority: 1,
      input_data: { manualTrigger: true, reason: 'test', size: '300x300' },
    })

    await thumbnailQueue.add(
      'thumbnail-generation',
      {
        assetId: asset.id!,
        jobType: 'thumbnail',
        options: { manualTrigger: true, size: '300x300' },
        jobId: thumbnailJob.id,
      },
      {
        jobId: `thumb_${thumbnailJob.id}`,
        priority: 1,
      }
    )

    res.json({
      success: true,
      message: `Thumbnail job created for asset ${assetId}`,
      jobId: thumbnailJob.id,
      asset: {
        id: asset.id,
        filename: asset.filename,
        file_type: asset.file_type,
        file_size: asset.file_size,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// Root endpoint with API documentation
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
        list: 'GET /api/assets?page&limit&fileType&status&dateFrom&dateTo&tags&category&author&department&project&sortBy&sortOrder&includeSignedUrls&expiresIn',
        search:
          'GET /api/assets/search?q&page&limit&fileType&status&sortBy&sortOrder&includeSignedUrls&expiresIn',
        batchAccess: 'POST /api/assets/batch-access',
        checkDuplicates: 'POST /api/assets/check-duplicates-simple',
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
      stats: {
        base: '/api/stats',
        dashboard: 'GET /api/stats',
        uploads: 'GET /api/stats/uploads?period=month',
        downloads: 'GET /api/stats/downloads?period=month',
        latest: 'GET /api/stats/latest?limit=10',
        popular: 'GET /api/stats/popular?limit=10',
        assetAnalytics: 'GET /api/stats/asset/:assetId/analytics',
        trackView: 'POST /api/stats/track-view',
        trackDownload: 'POST /api/stats/track-download',
        userBehavior: 'GET /api/stats/user/:userId/behavior',
        realtime: 'GET /api/stats/realtime',
      },
    },
    // Asset Retrieval API Documentation
    assetRetrievalAPI: {
      description:
        'Enhanced asset retrieval with pagination, filtering, and search',
      features: [
        'Pagination support (page, limit)',
        'Filtering by file type, status, date range, tags, category, author, department, project',
        'Sorting by created_at, updated_at, filename, file_size',
        'Keyword search across filename, tags, description, and metadata',
        'Signed URL generation for direct asset access',
        'Batch asset retrieval with signed URLs',
        'Optimized database queries with proper indexing',
      ],
      examples: {
        list: 'GET /api/assets?page=1&limit=20&fileType=image&status=processed&includeSignedUrls=true',
        search: 'GET /api/assets/search?q=logo&fileType=image&page=1&limit=10',
        filters:
          'GET /api/assets?dateFrom=2024-01-01&dateTo=2024-12-31&tags=marketing&category=branding',
      },
    },
    // Dashboard Analytics API Documentation
    dashboardAnalyticsAPI: {
      description:
        'Dashboard analytics for uploads, downloads, and asset usage with Redis-powered real-time analytics',
      features: [
        'Download counts and trends',
        'Upload counts and trends',
        'Latest assets tracking',
        'Popular assets ranking',
        'Storage usage analytics',
        'Activity monitoring',
        'Period-based analytics (day, week, month, year)',
        'Real-time asset usage analytics',
        'Live view and download tracking',
        'User behavior analysis and segmentation',
        'Popular assets with popularity scoring',
        'Real-time statistics and metrics',
        'Performance monitoring and insights',
      ],
      examples: {
        dashboard: 'GET /api/stats',
        uploads: 'GET /api/stats/uploads?period=week',
        downloads: 'GET /api/stats/downloads?period=month',
        latest: 'GET /api/stats/latest?limit=20',
        popular: 'GET /api/stats/popular?limit=15',
        assetAnalytics: 'GET /api/stats/asset/71/analytics',
        trackView: 'POST /api/stats/track-view',
        trackDownload: 'POST /api/stats/track-download',
        userBehavior: 'GET /api/stats/user/user123/behavior',
        realtime: 'GET /api/stats/realtime',
      },
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
} from './workers/asset-processing.worker'

// Import Redis analytics initialization
import { initRedis, testRedisConnection } from './config/redis.config'
import { initializeStatsService } from './services/stats.service'

// Startup service check function (non-blocking)
const checkServices = async () => {
  try {
    // Check database connection
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
    // Check Redis connection
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
    // Check MinIO connection (optional)
    const { getSignedReadUrl, ensureBucketExists } = await import(
      './services/storage'
    )
    await getSignedReadUrl('test', 1)
    console.log('MinIO: Connected')

    // Ensure the required bucket exists
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

// Wrap worker startup in try-catch to prevent crashes
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

    // Initialize Redis analytics with current database state
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
  console.log('Server running on port: http://localhost:3000')
  console.log('API Documentation: http://localhost:3000/')
  console.log('Health Check: http://localhost:3000/health')
  console.log('')
  console.log('Service Status:')
  console.log('   • Server: Running')
  console.log('   • Database: Checking...')
  console.log('   • Redis: Checking...')
  console.log('   • MinIO: Checking...')
  console.log('   • Workers: Starting...')
  console.log('')
  console.log(
    'Note: Server will run with limited functionality if Docker services are unavailable'
  )
  console.log(
    'Start Docker services for full functionality (file uploads, processing, etc.)'
  )
  console.log('')
})

export default app
