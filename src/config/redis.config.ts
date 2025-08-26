import Redis from 'ioredis'
import dotenv from 'dotenv'

dotenv.config()

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  // Add timeout configurations to prevent hanging
  connectTimeout: 10000, // 10 seconds
  commandTimeout: 5000,  // 5 seconds
  lazyConnect: true,     // Don't connect immediately
  retryDelayOnClusterDown: 300,
}

// Create Redis client
let redisClient: Redis | null = null

// Initialize Redis connection
export const initRedis = async (): Promise<Redis> => {
  try {
    if (!redisClient) {
      redisClient = new Redis(redisConfig)

      redisClient.on('connect', () => {
        console.log('Redis: Connected successfully')
      })

      redisClient.on('error', (error) => {
        console.error('Redis: Connection error:', error)
      })

      redisClient.on('close', () => {
        console.log('Redis: Connection closed')
      })
    }

    return redisClient
  } catch (error) {
    console.error('Redis: Failed to initialize:', error)
    throw error
  }
}

// Get Redis client instance
export const getRedisClient = (): Redis | null => {
  return redisClient
}

// Test Redis connection
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    const client = await initRedis()
    
    // Add timeout to prevent hanging
    const pingPromise = client.ping()
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis ping timeout')), 5000)
    })
    
    await Promise.race([pingPromise, timeoutPromise])
    return true
  } catch (error) {
    console.error('Redis: Connection test failed:', error)
    return false
  }
}

// Close Redis connection
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    console.log('Redis: Connection closed')
  }
}

// Analytics key patterns
export const ANALYTICS_KEYS = {
  // Asset usage
  ASSET_VIEWS: (assetId: number) => `asset:${assetId}:views`,
  ASSET_DOWNLOADS: (assetId: number) => `asset:${assetId}:downloads`,
  ASSET_ACCESSES: (assetId: number) => `asset:${assetId}:accesses`,

  // User activity
  USER_ACTIVITY: (userId: string) => `user:${userId}:activity`,
  USER_ASSETS: (userId: string) => `user:${userId}:assets`,

  // Global stats
  TOTAL_VIEWS: 'stats:total:views',
  TOTAL_DOWNLOADS: 'stats:total:downloads',
  TOTAL_UPLOADS: 'stats:total:uploads',

  // Time-based stats
  DAILY_VIEWS: (date: string) => `stats:daily:views:${date}`,
  DAILY_DOWNLOADS: (date: string) => `stats:daily:downloads:${date}`,
  DAILY_UPLOADS: (date: string) => `stats:daily:uploads:${date}`,

  // Popular assets
  POPULAR_ASSETS: 'stats:popular:assets',
  TRENDING_ASSETS: 'stats:trending:assets',

  // File type stats
  FILE_TYPE_VIEWS: (fileType: string) => `stats:filetype:${fileType}:views`,
  FILE_TYPE_DOWNLOADS: (fileType: string) =>
    `stats:filetype:${fileType}:downloads`,
}

export default redisConfig
