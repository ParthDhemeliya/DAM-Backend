import { Pool, PoolConfig } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

// Database configuration interface
interface DatabaseConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  max: number
  idleTimeoutMillis: number
  connectionTimeoutMillis: number
  acquireTimeoutMillis: number
  reapIntervalMillis: number
  createTimeoutMillis: number
  destroyTimeoutMillis: number
}

// Get database configuration from environment variables
const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dam_db',
  user: process.env.DB_USER || 'dam_user',
  password: process.env.DB_PASSWORD || '123',
  max: 20,
  idleTimeoutMillis: 60000, // Increased from 30000 to 60000 (1 minute)
  connectionTimeoutMillis: 10000, // Increased from 2000 to 10000 (10 seconds)
  acquireTimeoutMillis: 10000, // New: timeout for acquiring connection from pool
  reapIntervalMillis: 1000, // New: how often to check for idle connections
  createTimeoutMillis: 10000, // New: timeout for creating new connections
  destroyTimeoutMillis: 5000, // New: timeout for destroying connections
}

// Create a new pool instance
const pool = new Pool(dbConfig)

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
  // Don't exit the process, just log the error
  console.error('Pool error occurred, but continuing...')
})

// Handle connection errors
pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.error('Client error:', err)
  })
})

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect()
    console.log('Database connection successful!')
    client.release()
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}

// Get the pool instance
export const getPool = (): Pool => pool

// Close the pool (call this when shutting down the application)
export const closePool = async (): Promise<void> => {
  await pool.end()
}

export default pool
