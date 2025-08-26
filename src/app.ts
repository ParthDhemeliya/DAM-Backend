import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'

// Import route files
import assetsRoutes from './routes/assets.routes'
import jobsRoutes from './routes/jobs.routes'
import statsRoutes from './routes/stats.routes'
import queuesRoutes from './routes/queues.routes'
import videoRoutes from './routes/video.routes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Configure server for large file uploads
const server = app.listen(Number(PORT), () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  console.log(`API Documentation: http://localhost:${PORT}/`)
  console.log(`Accessible at: http://localhost:${PORT}`)
  console.log(`Assets API: http://localhost:${PORT}/api/assets`)
  console.log(`Jobs API: http://localhost:${PORT}/api/jobs`)
  console.log(`Stats API: http://localhost:${PORT}/api/stats`)
  console.log(`Queues API: http://localhost:${PORT}/api/queues`)
  console.log(`Video API: http://localhost:${PORT}/api/video`)
  console.log(`Large file uploads: ENABLED (unlimited size)`)
})

// Configure server timeouts for large uploads
server.timeout = 0 // No timeout for large uploads
server.keepAliveTimeout = 65000 // 65 seconds
server.headersTimeout = 66000 // 66 seconds

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error)
})

// Handle connection errors
server.on('connection', (socket) => {
  // Set socket timeout to 0 for large uploads
  socket.setTimeout(0)

  socket.on('error', (error) => {
    console.error('Socket error:', error)
  })
})

// Middleware configuration
app.use(cors())

// Body parsing middleware - skip for upload routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/assets/upload')) {
    return next()
  }
  next()
})

// Apply body parsing for non-upload routes
app.use(express.json({ limit: '1gb' }))
app.use(express.urlencoded({ extended: true, limit: '1gb' }))

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'DAM Backend is running',
    version: '1.0.0',
  })
})

// Root route with API documentation
app.get('/', (req, res) => {
  res.json({
    message: 'DAM Backend API',
    version: '1.0.0',
    status: 'running',
    documentation: {
      health: '/health',
      assets: '/api/assets',
      jobs: '/api/jobs',
      stats: '/api/stats',
      queues: '/api/queues',
      video: '/api/video',
    },
    features: [
      'File upload and storage management',
      'Asset metadata management',
      'Duplicate file detection and handling',
      'Background job processing',
      'Video transcoding with FFmpeg',
      'Image thumbnail generation',
      'File format conversion',
    ],
    apiEndpoints: {
      assets: {
        'GET /api/assets': 'List all assets with filters and pagination',
        'GET /api/assets/:id': 'Get asset by ID',
        'POST /api/assets/upload': 'Upload files with duplicate detection',
        'PUT /api/assets/:id': 'Update asset',
        'DELETE /api/assets/:id': 'Delete asset',
        'GET /api/assets/:id/download': 'Download asset',
        'GET /api/assets/:id/stream': 'Stream asset for preview',
      },
      jobs: {
        'GET /api/jobs': 'List all jobs',
        'GET /api/jobs/:id': 'Get job by ID',
        'POST /api/jobs': 'Create new job',
        'PUT /api/jobs/:id': 'Update job',
        'DELETE /api/jobs/:id': 'Delete job',
      },
      queues: {
        'GET /api/queues/stats': 'Get queue statistics',
        'POST /api/queues/jobs': 'Add single processing job',
        'POST /api/queues/jobs/batch': 'Add multiple processing jobs',
        'POST /api/queues/jobs/thumbnail': 'Generate thumbnail',
        'POST /api/queues/jobs/metadata': 'Extract metadata',
        'POST /api/queues/jobs/conversion': 'Convert file format',
      },
      stats: {
        'GET /api/stats': 'Get dashboard statistics',
        'GET /api/stats/uploads': 'Get upload statistics',
        'GET /api/stats/downloads': 'Get download statistics',
        'GET /api/stats/latest': 'Get latest assets',
      },
    },
  })
})

// API Routes
app.use('/api/assets', assetsRoutes)
app.use('/api/jobs', jobsRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/queues', queuesRoutes)
app.use('/api/video', videoRoutes)

// Error handling middleware
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `The route ${req.method} ${req.path} does not exist`,
    timestamp: new Date().toISOString(),
    availableRoutes: [
      '/health',
      '/api/assets',
      '/api/jobs',
      '/api/stats',
      '/api/queues',
      '/api/video',
    ],
  })
})

// Global error handler
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Global error handler:', error)
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message || 'Something went wrong',
    timestamp: new Date().toISOString(),
  })
})

export default app
