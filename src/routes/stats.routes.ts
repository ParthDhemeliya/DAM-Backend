import { Router } from 'express';
import { StatsController } from '../controllers/stats.controller';

const router = Router();
const statsController = new StatsController();

// Get overall statistics
router.get('/', statsController.getOverallStats);

// Get asset statistics
router.get('/assets', statsController.getAssetStats);

// Get job statistics
router.get('/jobs', statsController.getJobStats);

// Get storage statistics
router.get('/storage', statsController.getStorageStats);

// Get upload trends
router.get('/trends', statsController.getUploadTrends);

// Get file type distribution
router.get('/file-types', statsController.getFileTypeDistribution);

// Get category distribution
router.get('/categories', statsController.getCategoryDistribution);

// Get author distribution
router.get('/authors', statsController.getAuthorDistribution);

// Get department distribution
router.get('/departments', statsController.getDepartmentDistribution);

// Get project distribution
router.get('/projects', statsController.getProjectDistribution);

// Get top assets by size
router.get('/top-assets', statsController.getTopAssetsBySize);

// Get recent assets
router.get('/recent-assets', statsController.getRecentAssets);

// Get asset growth rate
router.get('/growth-rate', statsController.getAssetGrowthRate);

// Get hourly upload patterns
router.get('/hourly-patterns', statsController.getHourlyUploadPatterns);

// Get weekly upload patterns
router.get('/weekly-patterns', statsController.getWeeklyUploadPatterns);

// Get job performance metrics
router.get('/job-performance', statsController.getJobPerformanceMetrics);

// Get system health metrics
router.get('/system-health', statsController.getSystemHealthMetrics);

// Get custom date range statistics
router.get('/custom-range', statsController.getCustomDateRangeStats);

// Export statistics
router.get('/export', statsController.exportStats);

export default router;
