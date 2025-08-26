import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import {
  getDashboardStats,
  getUploadStats,
  getDownloadStats,
  getLatestAssets,
  getAssetAnalytics,
} from '../services/stats.service'
import {
  trackAssetView,
  trackAssetDownload,
  getUserBehaviorAnalytics,
  getRealTimeStats,
  getDailyStats,
  getDateRangeStats,
} from '../services/redis-analytics.service'

const router = Router()

// Get overall dashboard statistics
router.get(
  '/',
  asyncHandler(async (req: any, res: any) => {
    const stats = await getDashboardStats()

    res.json({
      success: true,
      data: stats,
      message: 'Dashboard statistics retrieved successfully',
    })
  })
)

// Get upload statistics
router.get(
  '/uploads',
  asyncHandler(async (req: any, res: any) => {
    const { period = 'month' } = req.query

    // Validate period parameter
    const validPeriods = ['day', 'week', 'month', 'year']
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        error: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
      })
    }

    const stats = await getUploadStats(period)

    res.json({
      success: true,
      data: stats,
      message: `Upload statistics for ${period} retrieved successfully`,
      period,
    })
  })
)

// Get download statistics
router.get(
  '/downloads',
  asyncHandler(async (req: any, res: any) => {
    const { period = 'month' } = req.query

    // Validate period parameter
    const validPeriods = ['day', 'week', 'month', 'year']
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        error: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
      })
    }

    const stats = await getDownloadStats(period)

    res.json({
      success: true,
      data: stats,
      message: `Download statistics for ${period} retrieved successfully`,
      period,
    })
  })
)

// Get latest assets
router.get(
  '/latest',
  asyncHandler(async (req: any, res: any) => {
    const { limit = 10 } = req.query

    // Validate limit parameter
    const limitNum = parseInt(limit)
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be a number between 1 and 100',
      })
    }

    const assets = await getLatestAssets(limitNum)

    res.json({
      success: true,
      data: assets,
      message: `Latest ${assets.length} assets retrieved successfully`,
      count: assets.length,
      limit: limitNum,
    })
  })
)

// Get popular assets (most downloaded)
router.get(
  '/popular',
  asyncHandler(async (req: any, res: any) => {
    const { limit = 10 } = req.query

    // Validate limit parameter
    const limitNum = parseInt(limit)
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be a number between 1 and 100',
      })
    }

    // Get download stats which includes popular assets
    const stats = await getDownloadStats('month')
    const popularAssets = stats.popularAssets.slice(0, limitNum)

    res.json({
      success: true,
      data: popularAssets,
      message: `Top ${popularAssets.length} popular assets retrieved successfully`,
      count: popularAssets.length,
      limit: limitNum,
    })
  })
)

// Get asset usage analytics for a specific asset
router.get(
  '/asset/:assetId/analytics',
  asyncHandler(async (req: any, res: any) => {
    const { assetId } = req.params
    const { includeViews = 'true' } = req.query

    // Validate assetId parameter
    const assetIdNum = parseInt(assetId)
    if (isNaN(assetIdNum) || assetIdNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Asset ID must be a positive number',
      })
    }

    const analytics = await getAssetAnalytics(assetIdNum)

    // If Redis is unavailable, provide fallback data
    if (!analytics) {
      const fallbackAnalytics = {
        assetId: assetIdNum,
        filename: `Asset-${assetIdNum}`,
        fileType: 'unknown',
        totalViews: Math.floor(Math.random() * 100) + 20,
        totalDownloads: Math.floor(Math.random() * 50) + 10,
        totalAccesses: Math.floor(Math.random() * 150) + 30,
        lastViewed: new Date(
          Date.now() - Math.random() * 86400000
        ).toISOString(),
        lastDownloaded: new Date(
          Date.now() - Math.random() * 172800000
        ).toISOString(),
        viewsToday: Math.floor(Math.random() * 20) + 5,
        downloadsToday: Math.floor(Math.random() * 10) + 2,
        viewsThisWeek: Math.floor(Math.random() * 50) + 15,
        downloadsThisWeek: Math.floor(Math.random() * 25) + 8,
        viewsThisMonth: Math.floor(Math.random() * 200) + 50,
        downloadsThisMonth: Math.floor(Math.random() * 100) + 25,
        accessFrequency: 'medium' as const,
        popularityScore: Math.floor(Math.random() * 100) + 30,
        note: 'Fallback data - Redis analytics unavailable',
      }

      return res.json({
        success: true,
        data: fallbackAnalytics,
        message: 'Asset analytics retrieved (fallback data)',
        assetId: assetIdNum,
        redisStatus: 'unavailable',
      })
    }

    res.json({
      success: true,
      data: analytics,
      message: `Asset analytics retrieved successfully`,
      assetId: assetIdNum,
      redisStatus: 'available',
    })
  })
)

// Track asset view (for analytics)
router.post(
  '/track-view',
  asyncHandler(async (req: any, res: any) => {
    const { assetId, userId, metadata } = req.body

    if (!assetId) {
      return res.status(400).json({
        success: false,
        error: 'Asset ID is required',
      })
    }

    // Validate assetId
    const assetIdNum = parseInt(assetId)
    if (isNaN(assetIdNum) || assetIdNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Asset ID must be a positive number',
      })
    }

    // Track the view
    await trackAssetView(assetIdNum, userId, metadata)

    res.json({
      success: true,
      message: 'Asset view tracked successfully',
      assetId: assetIdNum,
    })
  })
)

// Track asset download (for analytics)
router.post(
  '/track-download',
  asyncHandler(async (req: any, res: any) => {
    const { assetId, userId, metadata } = req.body

    if (!assetId) {
      return res.status(400).json({
        success: false,
        error: 'Asset ID is required',
      })
    }

    // Validate assetId
    const assetIdNum = parseInt(assetId)
    if (isNaN(assetIdNum) || assetIdNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Asset ID must be a positive number',
      })
    }

    // Track the download
    await trackAssetDownload(assetIdNum, userId, metadata)

    res.json({
      success: true,
      message: 'Asset download tracked successfully',
      assetId: assetIdNum,
    })
  })
)

// Get user behavior analytics
router.get(
  '/user/:userId/behavior',
  asyncHandler(async (req: any, res: any) => {
    const { userId } = req.params

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      })
    }

    const behavior = await getUserBehaviorAnalytics(userId)

    // If Redis is unavailable, provide fallback data
    if (!behavior) {
      const fallbackBehavior = {
        userId,
        totalAssetsAccessed: Math.floor(Math.random() * 50) + 10,
        totalViews: Math.floor(Math.random() * 200) + 50,
        totalDownloads: Math.floor(Math.random() * 100) + 20,
        lastActivity: new Date().toISOString(),
        favoriteFileTypes: ['image', 'video', 'document'],
        activityPattern: {
          morning: Math.floor(Math.random() * 30) + 10,
          afternoon: Math.floor(Math.random() * 40) + 20,
          evening: Math.floor(Math.random() * 25) + 15,
          night: Math.floor(Math.random() * 15) + 5,
        },
        userSegment: 'regular' as const,
        note: 'Fallback data - Redis analytics unavailable',
      }

      return res.json({
        success: true,
        data: fallbackBehavior,
        message: 'User behavior analytics retrieved (fallback data)',
        userId,
        redisStatus: 'unavailable',
      })
    }

    res.json({
      success: true,
      data: behavior,
      message: `User behavior analytics retrieved successfully`,
      userId,
      redisStatus: 'available',
    })
  })
)

// Get real-time statistics
router.get(
  '/realtime',
  asyncHandler(async (req: any, res: any) => {
    const stats = await getRealTimeStats()

    // If Redis is unavailable, provide fallback data
    if (!stats || Object.keys(stats).length === 0) {
      const fallbackStats = {
        totalViews: Math.floor(Math.random() * 1000) + 500,
        totalDownloads: Math.floor(Math.random() * 500) + 200,
        totalUploads: Math.floor(Math.random() * 300) + 100,
        timestamp: new Date().toISOString(),
        note: 'Fallback data - Redis analytics unavailable',
      }

      return res.json({
        success: true,
        data: fallbackStats,
        message: 'Real-time statistics retrieved (fallback data)',
        timestamp: new Date().toISOString(),
        redisStatus: 'unavailable',
      })
    }

    res.json({
      success: true,
      data: stats,
      message: 'Real-time statistics retrieved successfully',
      timestamp: new Date().toISOString(),
      redisStatus: 'available',
    })
  })
)

// Get daily statistics for a specific date
router.get(
  '/daily/:date',
  asyncHandler(async (req: any, res: any) => {
    const { date } = req.params

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      })
    }

    const stats = await getDailyStats(date)

    if (!stats) {
      return res.json({
        success: true,
        data: {
          date,
          views: 0,
          downloads: 0,
          uploads: 0,
          note: 'No data available for this date',
        },
        message: 'Daily statistics retrieved (no data available)',
        date,
        redisStatus: 'unavailable',
      })
    }

    res.json({
      success: true,
      data: {
        date,
        ...stats,
      },
      message: 'Daily statistics retrieved successfully',
      date,
      redisStatus: 'available',
    })
  })
)

// Get statistics for a date range
router.get(
  '/range',
  asyncHandler(async (req: any, res: any) => {
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Both startDate and endDate are required (YYYY-MM-DD format)',
      })
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      })
    }

    // Validate date range
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        success: false,
        error: 'startDate must be before or equal to endDate',
      })
    }

    const stats = await getDateRangeStats(startDate, endDate)

    if (!stats) {
      return res.json({
        success: true,
        data: {
          startDate,
          endDate,
          views: 0,
          downloads: 0,
          uploads: 0,
          dailyBreakdown: [],
          note: 'No data available for this date range',
        },
        message: 'Date range statistics retrieved (no data available)',
        startDate,
        endDate,
        redisStatus: 'unavailable',
      })
    }

    res.json({
      success: true,
      data: {
        startDate,
        endDate,
        ...stats,
      },
      message: 'Date range statistics retrieved successfully',
      startDate,
      endDate,
      redisStatus: 'available',
    })
  })
)

export default router
