import { Request, Response } from 'express';
import { testRedisConnection } from '../config/redis.config';

export const healthCheck = async (req: Request, res: Response) => {
  try {
    const { testConnection } = await import('../config/database.config');
    const dbConnected = await testConnection();
    const redisConnected = await testRedisConnection();

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
    });
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
    });
  }
};

export const checkServices = async () => {
  try {
    const { testConnection } = await import('../config/database.config');
    const dbConnected = await testConnection();
    if (dbConnected) {
      console.log('Database: Connected');
    } else {
      console.log('Database: Connection failed');
    }
  } catch (error) {
    console.log(
      'Database: Connection error -',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  try {
    const redisConnected = await testRedisConnection();
    if (redisConnected) {
      console.log('Redis: Connected');
    } else {
      console.log('Redis: Connection failed');
    }
  } catch (error) {
    console.log(
      'Redis: Connection error -',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  try {
    const { getSignedReadUrl, ensureBucketExists } = await import(
      '../services/storage'
    );
    await getSignedReadUrl('test', 1);
    console.log('MinIO: Connected');

    try {
      await ensureBucketExists();
      console.log('MinIO: Bucket ready');
    } catch (bucketError) {
      console.warn('MinIO: Bucket initialization failed -', bucketError);
    }
  } catch (error) {
    console.log('MinIO: Not available (Docker may be down)');
  }
};
