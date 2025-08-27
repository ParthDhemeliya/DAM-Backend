import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: null, // BullMQ requirement
};

// Create Redis connection
export const redis = new Redis(redisConfig);

// Queue names
export const QUEUE_NAMES = {
  ASSET_PROCESSING: 'asset-processing',
  THUMBNAIL_GENERATION: 'thumbnail-generation',
  METADATA_EXTRACTION: 'metadata-extraction',
  FILE_CONVERSION: 'file-conversion',
  CLEANUP: 'cleanup',
} as const;

// Create main asset processing queue
export const assetProcessingQueue = new Queue(QUEUE_NAMES.ASSET_PROCESSING, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Create thumbnail generation queue
export const thumbnailQueue = new Queue(QUEUE_NAMES.THUMBNAIL_GENERATION, {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 50,
    removeOnFail: 25,
  },
});

// Create metadata extraction queue
export const metadataQueue = new Queue(QUEUE_NAMES.METADATA_EXTRACTION, {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 50,
    removeOnFail: 25,
  },
});

// Create file conversion queue
export const conversionQueue = new Queue(QUEUE_NAMES.FILE_CONVERSION, {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 50,
    removeOnFail: 25,
  },
});

// Create cleanup queue
export const cleanupQueue = new Queue(QUEUE_NAMES.CLEANUP, {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

// Export all queues
export const queues = {
  assetProcessing: assetProcessingQueue,
  thumbnail: thumbnailQueue,
  metadata: metadataQueue,
  conversion: conversionQueue,
  cleanup: cleanupQueue,
};

// Graceful shutdown function
export const closeQueues = async () => {
  await Promise.all([
    assetProcessingQueue.close(),
    thumbnailQueue.close(),
    metadataQueue.close(),
    conversionQueue.close(),
    cleanupQueue.close(),
    redis.disconnect(),
  ]);
};
