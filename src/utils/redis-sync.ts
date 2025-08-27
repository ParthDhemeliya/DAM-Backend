import { getPool } from '../config/database.config';
import { getRedisClient, ANALYTICS_KEYS } from '../config/redis.config';

const pool = getPool();

/**
 * Sync Redis analytics with current database state
 * This ensures Redis shows accurate, real-time data
 */
export const syncRedisAnalytics = async (): Promise<{
  success: boolean;
  message: string;
  details: {
    totalAssets: number;
    totalViews: number;
    totalDownloads: number;
    totalUploads: number;
    syncedAt: string;
  };
}> => {
  try {
    const redis = getRedisClient();
    if (!redis) {
      throw new Error('Redis client not available');
    }

    // Get current asset count from database
    const assetsResult = await pool.query(
      'SELECT COUNT(*) as total FROM assets WHERE deleted_at IS NULL'
    );
    const totalAssets = parseInt(assetsResult.rows[0].total);

    // Get current Redis values
    const currentRedisValues = await redis
      .multi()
      .get(ANALYTICS_KEYS.TOTAL_VIEWS)
      .get(ANALYTICS_KEYS.TOTAL_DOWNLOADS)
      .get(ANALYTICS_KEYS.TOTAL_UPLOADS)
      .exec();

    if (!currentRedisValues) {
      throw new Error('Failed to execute Redis multi command');
    }

    const currentViews = parseInt(
      (currentRedisValues[0]?.[1] as string) || '0'
    );
    const currentDownloads = parseInt(
      (currentRedisValues[1]?.[1] as string) || '0'
    );
    const currentUploads = parseInt(
      (currentRedisValues[2]?.[1] as string) || '0'
    );

    // Update Redis with accurate values
    await redis
      .multi()
      .set(ANALYTICS_KEYS.TOTAL_VIEWS, Math.max(currentViews, 0).toString())
      .set(
        ANALYTICS_KEYS.TOTAL_DOWNLOADS,
        Math.max(currentDownloads, 0).toString()
      )
      .set(ANALYTICS_KEYS.TOTAL_UPLOADS, totalAssets.toString()) // Use actual asset count
      .exec();

    const syncedAt = new Date().toISOString();

    return {
      success: true,
      message: 'Redis analytics synchronized successfully',
      details: {
        totalAssets,
        totalViews: Math.max(currentViews, 0),
        totalDownloads: Math.max(currentDownloads, 0),
        totalUploads: totalAssets,
        syncedAt,
      },
    };
  } catch (error) {
    console.error('Error syncing Redis analytics:', error);
    throw new Error(
      `Failed to sync Redis analytics: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Reset Redis analytics to initial state
 * This clears all counters and resets them to zero
 */
export const resetRedisAnalytics = async (): Promise<{
  success: boolean;
  message: string;
  details: {
    resetAt: string;
    previousValues: {
      totalViews: number;
      totalDownloads: number;
      totalUploads: number;
    };
  };
}> => {
  try {
    const redis = getRedisClient();
    if (!redis) {
      throw new Error('Redis client not available');
    }

    // Get current values before reset
    const currentRedisValues = await redis
      .multi()
      .get(ANALYTICS_KEYS.TOTAL_VIEWS)
      .get(ANALYTICS_KEYS.TOTAL_DOWNLOADS)
      .get(ANALYTICS_KEYS.TOTAL_UPLOADS)
      .exec();

    if (!currentRedisValues) {
      throw new Error('Failed to execute Redis multi command');
    }

    const previousViews = parseInt(
      (currentRedisValues[0]?.[1] as string) || '0'
    );
    const previousDownloads = parseInt(
      (currentRedisValues[1]?.[1] as string) || '0'
    );
    const previousUploads = parseInt(
      (currentRedisValues[2]?.[1] as string) || '0'
    );

    // Reset all counters to zero
    await redis
      .multi()
      .set(ANALYTICS_KEYS.TOTAL_VIEWS, '0')
      .set(ANALYTICS_KEYS.TOTAL_DOWNLOADS, '0')
      .set(ANALYTICS_KEYS.TOTAL_UPLOADS, '0')
      .exec();

    const resetAt = new Date().toISOString();

    return {
      success: true,
      message: 'Redis analytics reset successfully',
      details: {
        resetAt,
        previousValues: {
          totalViews: previousViews,
          totalDownloads: previousDownloads,
          totalUploads: previousUploads,
        },
      },
    };
  } catch (error) {
    console.error('Error resetting Redis analytics:', error);
    throw new Error(
      `Failed to reset Redis analytics: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Get current Redis analytics status
 * This shows the current state of Redis counters
 */
export const getRedisAnalyticsStatus = async (): Promise<{
  redisAvailable: boolean;
  currentValues: {
    totalViews: number;
    totalDownloads: number;
    totalUploads: number;
  };
  databaseValues: {
    totalAssets: number;
  };
  lastUpdated: string;
  status: 'healthy' | 'stale' | 'error';
}> => {
  try {
    const redis = getRedisClient();
    if (!redis) {
      return {
        redisAvailable: false,
        currentValues: { totalViews: 0, totalDownloads: 0, totalUploads: 0 },
        databaseValues: { totalAssets: 0 },
        lastUpdated: new Date().toISOString(),
        status: 'error',
      };
    }

    // Get current Redis values
    const currentRedisValues = await redis
      .multi()
      .get(ANALYTICS_KEYS.TOTAL_VIEWS)
      .get(ANALYTICS_KEYS.TOTAL_DOWNLOADS)
      .get(ANALYTICS_KEYS.TOTAL_UPLOADS)
      .exec();

    if (!currentRedisValues) {
      throw new Error('Failed to execute Redis multi command');
    }

    const totalViews = parseInt((currentRedisValues[0]?.[1] as string) || '0');
    const totalDownloads = parseInt(
      (currentRedisValues[1]?.[1] as string) || '0'
    );
    const totalUploads = parseInt(
      (currentRedisValues[2]?.[1] as string) || '0'
    );

    // Get current database values
    const assetsResult = await pool.query(
      'SELECT COUNT(*) as total FROM assets WHERE deleted_at IS NULL'
    );
    const totalAssets = parseInt(assetsResult.rows[0].total);

    // Determine status
    let status: 'healthy' | 'stale' | 'error' = 'healthy';

    if (totalUploads !== totalAssets) {
      status = 'stale'; // Upload count doesn't match asset count
    }

    if (totalViews < 0 || totalDownloads < 0 || totalUploads < 0) {
      status = 'error'; // Invalid negative values
    }

    return {
      redisAvailable: true,
      currentValues: {
        totalViews,
        totalDownloads,
        totalUploads,
      },
      databaseValues: {
        totalAssets,
      },
      lastUpdated: new Date().toISOString(),
      status,
    };
  } catch (error) {
    console.error('Error getting Redis analytics status:', error);
    return {
      redisAvailable: false,
      currentValues: { totalViews: 0, totalDownloads: 0, totalUploads: 0 },
      databaseValues: { totalAssets: 0 },
      lastUpdated: new Date().toISOString(),
      status: 'error',
    };
  }
};

/**
 * Initialize Redis analytics with current database state
 * This is called during app startup to ensure consistency
 */
export const initializeRedisAnalytics = async (): Promise<void> => {
  try {
    console.log('Initializing Redis analytics...');
    await syncRedisAnalytics();
    console.log('Redis analytics initialized successfully');
  } catch (error) {
    console.warn('Failed to initialize Redis analytics:', error);
    // Don't throw - app should continue working
  }
};
