import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  getOverallStats,
  getAssetStats,
  getJobStats,
  getStorageStats,
  getUploadTrends,
  getFileTypeDistribution,
  getCategoryDistribution,
  getAuthorDistribution,
  getDepartmentDistribution,
  getProjectDistribution,
  getTopAssetsBySize,
  getRecentAssets,
  getAssetGrowthRate,
  getHourlyUploadPatterns,
  getWeeklyUploadPatterns,
  getJobPerformanceMetrics,
  getSystemHealthMetrics,
  getCustomDateRangeStats,
  exportStats,
} from '../services/stats.service';

export class StatsController {
  // Get overall system statistics
  getOverallStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      const stats = await getOverallStats();

      res.json({
        success: true,
        data: stats,
        message: 'Overall statistics retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve overall statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get asset statistics
  getAssetStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const stats = await getAssetStats(days);

      res.json({
        success: true,
        data: stats,
        message: 'Asset statistics retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve asset statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get job statistics
  getJobStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const stats = await getJobStats(days);

      res.json({
        success: true,
        data: stats,
        message: 'Job statistics retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve job statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get storage statistics
  getStorageStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      const stats = await getStorageStats();

      res.json({
        success: true,
        data: stats,
        message: 'Storage statistics retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve storage statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get upload trends
  getUploadTrends = asyncHandler(async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const granularity = (req.query.granularity as string) || 'daily';
      const trends = await getUploadTrends(days, granularity);

      res.json({
        success: true,
        data: trends,
        message: 'Upload trends retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve upload trends',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get file type distribution
  getFileTypeDistribution = asyncHandler(
    async (req: Request, res: Response) => {
      try {
        const distribution = await getFileTypeDistribution();

        res.json({
          success: true,
          data: distribution,
          message: 'File type distribution retrieved successfully',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve file type distribution',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Get category distribution
  getCategoryDistribution = asyncHandler(
    async (req: Request, res: Response) => {
      try {
        const distribution = await getCategoryDistribution();

        res.json({
          success: true,
          data: distribution,
          message: 'Category distribution retrieved successfully',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve category distribution',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Get author distribution
  getAuthorDistribution = asyncHandler(async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const distribution = await getAuthorDistribution(limit);

      res.json({
        success: true,
        data: distribution,
        message: 'Author distribution retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve author distribution',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get department distribution
  getDepartmentDistribution = asyncHandler(
    async (req: Request, res: Response) => {
      try {
        const distribution = await getDepartmentDistribution();

        res.json({
          success: true,
          data: distribution,
          message: 'Department distribution retrieved successfully',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve department distribution',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Get project distribution
  getProjectDistribution = asyncHandler(async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const distribution = await getProjectDistribution(limit);

      res.json({
        success: true,
        data: distribution,
        message: 'Project distribution retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve project distribution',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get top assets by size
  getTopAssetsBySize = asyncHandler(async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const assets = await getTopAssetsBySize(limit);

      res.json({
        success: true,
        data: assets,
        message: 'Top assets by size retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve top assets by size',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get recent assets
  getRecentAssets = asyncHandler(async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const assets = await getRecentAssets(limit);

      res.json({
        success: true,
        data: assets,
        message: 'Recent assets retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve recent assets',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get asset growth rate
  getAssetGrowthRate = asyncHandler(async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const growthRate = await getAssetGrowthRate(days);

      res.json({
        success: true,
        data: growthRate,
        message: 'Asset growth rate retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve asset growth rate',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get hourly upload patterns
  getHourlyUploadPatterns = asyncHandler(
    async (req: Request, res: Response) => {
      try {
        const days = parseInt(req.query.days as string) || 7;
        const patterns = await getHourlyUploadPatterns(days);

        res.json({
          success: true,
          data: patterns,
          message: 'Hourly upload patterns retrieved successfully',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve hourly upload patterns',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Get weekly upload patterns
  getWeeklyUploadPatterns = asyncHandler(
    async (req: Request, res: Response) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const patterns = await getWeeklyUploadPatterns(days);

        res.json({
          success: true,
          data: patterns,
          message: 'Weekly upload patterns retrieved successfully',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve weekly upload patterns',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Get job performance metrics
  getJobPerformanceMetrics = asyncHandler(
    async (req: Request, res: Response) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const metrics = await getJobPerformanceMetrics(days);

        res.json({
          success: true,
          data: metrics,
          message: 'Job performance metrics retrieved successfully',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve job performance metrics',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Get system health metrics
  getSystemHealthMetrics = asyncHandler(async (req: Request, res: Response) => {
    try {
      const metrics = await getSystemHealthMetrics();

      res.json({
        success: true,
        data: metrics,
        message: 'System health metrics retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve system health metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get custom date range statistics
  getCustomDateRangeStats = asyncHandler(
    async (req: Request, res: Response) => {
      try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameters',
            message: 'startDate and endDate are required',
          });
        }

        const stats = await getCustomDateRangeStats(
          startDate as string,
          endDate as string
        );

        res.json({
          success: true,
          data: stats,
          message: 'Custom date range statistics retrieved successfully',
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve custom date range statistics',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Export statistics
  exportStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      const format = (req.query.format as string) || 'json';
      const days = parseInt(req.query.days as string) || 30;

      const stats = await exportStats(format, days);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="stats_${days}_days.csv"`
        );
        res.send(stats);
      } else {
        res.json({
          success: true,
          data: stats,
          message: 'Statistics exported successfully',
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to export statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
