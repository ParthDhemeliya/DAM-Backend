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
}

// Get database configuration from environment variables
const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dam_db',
  user: process.env.DB_USER || 'dam_user',
  password: process.env.DB_PASSWORD || '123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}

// Create a new pool instance
const pool = new Pool(dbConfig)

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})

// Get the pool instance
export const getPool = (): Pool => pool

// Close the pool (call this when shutting down the application)
export const closePool = async (): Promise<void> => {
  await pool.end()
}

export default pool
