import { Queue, Worker, ConnectionOptions } from 'bullmq'
import Redis from 'ioredis'
import dotenv from 'dotenv'

dotenv.config()

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3, // BullMQ requirement
  lazyConnect: true, // Don't connect immediately
  retryDelayOnClusterDown: 300,
}

// Create Redis connection with error handling
let redis: Redis | null = null
let isRedisConnected = false

try {
  redis = new Redis(redisConfig)

  redis.on('connect', () => {
    console.log('Redis connected successfully')
    isRedisConnected = true
  })

  redis.on('error', (error) => {
    console.warn(
      'Redis connection failed, queues will be disabled:',
      error.message
    )
    isRedisConnected = false
  })

  redis.on('close', () => {
    console.log('🔌 Redis connection closed')
    isRedisConnected = false
  })
} catch (error) {
  console.warn(
    ' Failed to create Redis connection, queues will be disabled:',
    error
  )
  isRedisConnected = false
}

// Create connection options for BullMQ
const createConnectionOptions = (): ConnectionOptions => {
  return {
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
  }
}

// Queue names
export const QUEUE_NAMES = {
  ASSET_PROCESSING: 'asset-processing',
  THUMBNAIL_GENERATION: 'thumbnail-generation',
  METADATA_EXTRACTION: 'metadata-extraction',
  FILE_CONVERSION: 'file-conversion',
  CLEANUP: 'cleanup',
} as const

// Create main asset processing queue
export const assetProcessingQueue = new Queue(QUEUE_NAMES.ASSET_PROCESSING, {
  connection: createConnectionOptions(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
})

// Create thumbnail generation queue
export const thumbnailQueue = new Queue(QUEUE_NAMES.THUMBNAIL_GENERATION, {
  connection: createConnectionOptions(),
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 50,
    removeOnFail: 25,
  },
})

// Create metadata extraction queue
export const metadataQueue = new Queue(QUEUE_NAMES.METADATA_EXTRACTION, {
  connection: createConnectionOptions(),
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 50,
    removeOnFail: 25,
  },
})

// Create file conversion queue
export const conversionQueue = new Queue(QUEUE_NAMES.FILE_CONVERSION, {
  connection: createConnectionOptions(),
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 50,
    removeOnFail: 25,
  },
})

// Create cleanup queue
export const cleanupQueue = new Queue(QUEUE_NAMES.CLEANUP, {
  connection: createConnectionOptions(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 100,
  },
})

// Export all queues
export const queues = {
  assetProcessing: assetProcessingQueue,
  thumbnail: thumbnailQueue,
  metadata: metadataQueue,
  conversion: conversionQueue,
  cleanup: cleanupQueue,
}

// Check if Redis is available
export const isRedisAvailable = () => isRedisConnected

// Graceful shutdown function
export const closeQueues = async () => {
  try {
    await Promise.all([
      assetProcessingQueue.close(),
      thumbnailQueue.close(),
      metadataQueue.close(),
      conversionQueue.close(),
      cleanupQueue.close(),
    ])

    if (redis) {
      await redis.disconnect()
    }
  } catch (error) {
    console.warn(' Error closing queues:', error)
  }
}
