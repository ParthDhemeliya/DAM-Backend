import { getRedisClient, ANALYTICS_KEYS } from '../config/redis.config';

// Interface for performance metrics
export interface PerformanceMetrics {
  assetId: number;
  filename: string;
  responseTime: number;
  errorRate: number;
  availability: number;
  userSatisfaction: number;
  loadTime: number;
}

// Get real-time statistics
export const getRealTimeStats = async (): Promise<any> => {
  try {
    const redis = getRedisClient();
    if (!redis) {
      console.warn('Redis client not available for analytics tracking');
      return {};
    }

    const result = await redis
      .multi()
      .get(ANALYTICS_KEYS.TOTAL_VIEWS)
      .get(ANALYTICS_KEYS.TOTAL_DOWNLOADS)
      .get(ANALYTICS_KEYS.TOTAL_UPLOADS)
      .exec();

    if (!result) {
      return {};
    }

    const totalViews = result[0]?.[1] || '0';
    const totalDownloads = result[1]?.[1] || '0';
    const totalUploads = result[2]?.[1] || '0';

    return {
      totalViews: parseInt(totalViews as string),
      totalDownloads: parseInt(totalDownloads as string),
      totalUploads: parseInt(totalUploads as string),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting real-time stats:', error);
    return {};
  }
};

// Initialize Redis analytics with sample data
export const initializeAnalytics = async (): Promise<void> => {
  try {
    const redis = getRedisClient();
    if (!redis) {
      console.warn('Redis client not available for analytics initialization');
      return;
    }

    // Set initial values if they don't exist
    await redis
      .multi()
      .setnx(ANALYTICS_KEYS.TOTAL_VIEWS, '0')
      .setnx(ANALYTICS_KEYS.TOTAL_DOWNLOADS, '0')
      .setnx(ANALYTICS_KEYS.TOTAL_UPLOADS, '0')
      .exec();
  } catch (error) {
    console.error('Error initializing Redis analytics:', error);
    // Don't throw - analytics initialization failure shouldn't break the main flow
  }
};
