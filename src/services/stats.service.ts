import { StatsRepository } from '../repositories/stats.repository';

const statsRepository = new StatsRepository();

export const getOverallStats = async (): Promise<any> => {
  const [assetCounts, jobCounts, storageUsage] = await Promise.all([
    statsRepository.getAssetCounts(),
    statsRepository.getJobCounts(),
    statsRepository.getStorageUsage(),
  ]);

  return {
    assets: assetCounts,
    jobs: jobCounts,
    storage: storageUsage,
    timestamp: new Date().toISOString(),
  };
};

export const getAssetStats = async (days: number = 30): Promise<any> => {
  const [
    counts,
    countsByType,
    countsByStatus,
    countsByCategory,
    uploadsByDate,
    growthRate,
  ] = await Promise.all([
    statsRepository.getAssetCounts(),
    statsRepository.getAssetCountsByType(),
    statsRepository.getAssetCountsByStatus(),
    statsRepository.getAssetCountsByCategory(),
    statsRepository.getAssetUploadsByDate(days),
    statsRepository.getAssetGrowthRate(days),
  ]);

  return {
    counts,
    countsByType,
    countsByStatus,
    countsByCategory,
    uploadsByDate,
    growthRate,
    period: `${days} days`,
  };
};

export const getJobStats = async (days: number = 30): Promise<any> => {
  const [counts, countsByType, countsByDate] = await Promise.all([
    statsRepository.getJobCounts(),
    statsRepository.getJobCountsByType(),
    statsRepository.getJobCountsByDate(days),
  ]);

  return {
    counts,
    countsByType,
    countsByDate,
    period: `${days} days`,
  };
};

export const getStorageStats = async (): Promise<any> => {
  const [usage, usageByType, topAssets, recentAssets] = await Promise.all([
    statsRepository.getStorageUsage(),
    statsRepository.getStorageUsageByType(),
    statsRepository.getTopAssetsBySize(10),
    statsRepository.getRecentAssets(10),
  ]);

  return {
    usage,
    usageByType,
    topAssets,
    recentAssets,
  };
};

export const getUploadTrends = async (
  days: number = 30,
  granularity: string = 'daily'
): Promise<any> => {
  if (granularity === 'hourly') {
    return await statsRepository.getAssetUploadsByHour(days);
  } else if (granularity === 'weekly') {
    return await statsRepository.getAssetUploadsByDayOfWeek(days);
  } else {
    return await statsRepository.getAssetUploadsByDate(days);
  }
};

export const getFileTypeDistribution = async (): Promise<any[]> => {
  return await statsRepository.getAssetCountsByType();
};

export const getCategoryDistribution = async (): Promise<any[]> => {
  return await statsRepository.getAssetCountsByCategory();
};

export const getAuthorDistribution = async (
  limit: number = 20
): Promise<any[]> => {
  return await statsRepository.getAssetCountsByAuthor();
};

export const getDepartmentDistribution = async (): Promise<any[]> => {
  return await statsRepository.getAssetCountsByDepartment();
};

export const getProjectDistribution = async (
  limit: number = 20
): Promise<any[]> => {
  return await statsRepository.getAssetCountsByProject();
};

export const getTopAssetsBySize = async (
  limit: number = 10
): Promise<any[]> => {
  return await statsRepository.getTopAssetsBySize(limit);
};

export const getRecentAssets = async (limit: number = 10): Promise<any[]> => {
  return await statsRepository.getRecentAssets(limit);
};

export const getAssetGrowthRate = async (days: number = 30): Promise<any> => {
  return await statsRepository.getAssetGrowthRate(days);
};

export const getHourlyUploadPatterns = async (
  days: number = 7
): Promise<any[]> => {
  return await statsRepository.getAssetUploadsByHour(days);
};

export const getWeeklyUploadPatterns = async (
  days: number = 30
): Promise<any[]> => {
  return await statsRepository.getAssetUploadsByDayOfWeek(days);
};

export const getJobPerformanceMetrics = async (
  days: number = 30
): Promise<any> => {
  const [jobCounts, avgProcessingTime, successRate] = await Promise.all([
    statsRepository.getJobCounts(),
    statsRepository.getAverageJobProcessingTime(),
    statsRepository.getJobSuccessRate(),
  ]);

  return {
    totalJobs: jobCounts.total,
    avgProcessingTime,
    successRate,
    period: `${days} days`,
  };
};

export const getSystemHealthMetrics = async (): Promise<any> => {
  const [assetCounts, jobCounts, storageUsage] = await Promise.all([
    statsRepository.getAssetCounts(),
    statsRepository.getJobCounts(),
    statsRepository.getStorageUsage(),
  ]);

  // Calculate system health score
  const totalAssets = assetCounts.total || 0;
  const activeJobs = jobCounts.processing || 0;
  const failedJobs = jobCounts.failed || 0;
  const storageUsed = storageUsage.used || 0;
  const storageTotal = storageUsage.total || 1;

  const healthScore = Math.min(
    100,
    Math.max(
      0,
      100 - activeJobs * 5 - failedJobs * 10 - (storageUsed / storageTotal) * 20
    )
  );

  return {
    healthScore,
    totalAssets,
    activeJobs,
    failedJobs,
    storageUsage: {
      used: storageUsed,
      total: storageTotal,
      percentage: Math.round((storageUsed / storageTotal) * 100),
    },
    timestamp: new Date().toISOString(),
  };
};

export const getCustomDateRangeStats = async (
  startDate: string,
  endDate: string
): Promise<any> => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  const [assetStats, jobStats, storageStats] = await Promise.all([
    getAssetStats(daysDiff),
    getJobStats(daysDiff),
    getStorageStats(),
  ]);

  return {
    period: `${startDate} to ${endDate}`,
    days: daysDiff,
    assets: assetStats,
    jobs: jobStats,
    storage: storageStats,
  };
};

export const exportStats = async (
  format: string = 'json',
  days: number = 30
): Promise<any> => {
  const stats = await getOverallStats();

  if (format === 'csv') {
    // Convert to CSV format
    return convertToCSV(stats);
  }

  return stats;
};

// Helper function to convert stats to CSV
const convertToCSV = (data: any): string => {
  // Simple CSV conversion - in production, use a proper CSV library
  const rows = [];
  const headers = Object.keys(data);
  rows.push(headers.join(','));

  const values = headers.map(header => {
    const value = data[header];
    return typeof value === 'string' ? `"${value}"` : value;
  });
  rows.push(values.join(','));

  return rows.join('\n');
};
