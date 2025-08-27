import { initRedis } from '../config/redis.config';

export const initializeAnalytics = async () => {
  try {
    await initRedis();

    const { initializeAnalytics } = await import('./general-analytics.service');
    await initializeAnalytics();

    console.log('Analytics services initialized successfully');
  } catch (error) {
    console.warn(
      'Failed to initialize analytics services, continuing with fallback data:',
      error
    );
  }
};
