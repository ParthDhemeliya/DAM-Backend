import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import { testConnection } from './config/database.config'

// Import routes
import assetsRoutes from './routes/assets.routes'
import jobsRoutes from './routes/jobs.routes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

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
      assets: '/api/assets',
      jobs: '/api/jobs',
    },
  })
})

// API Routes
app.use('/api/assets', assetsRoutes)
app.use('/api/jobs', jobsRoutes)

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

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('Error:', err)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message || 'Something went wrong',
    })
  }
)

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
  console.log(`🚀 Server running on port: http://localhost:${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
  console.log(`🗄️  Database test: http://localhost:${PORT}/api/db/test`)
  console.log(`📁 Assets API: http://localhost:${PORT}/api/assets`)
  console.log(`⚙️  Jobs API: http://localhost:${PORT}/api/jobs`)
})

export default app
