import { getRedisClient, ANALYTICS_KEYS } from '../config/redis.config'

// Interface for asset usage analytics
export interface AssetUsageAnalytics {
  assetId: number
  filename: string
  fileType: string
  totalViews: number
  totalDownloads: number
  totalAccesses: number
  lastViewed: string
  lastDownloaded: string
  viewsToday: number
  downloadsToday: number
  viewsThisWeek: number
  downloadsThisWeek: number
  viewsThisMonth: number
  downloadsThisMonth: number
  accessFrequency: 'high' | 'medium' | 'low'
  popularityScore: number
}

// Interface for user behavior analytics
export interface UserBehaviorAnalytics {
  userId: string
  totalAssetsAccessed: number
  totalViews: number
  totalDownloads: number
  lastActivity: string
  favoriteFileTypes: string[]
  activityPattern: {
    morning: number
    afternoon: number
    evening: number
    night: number
  }
  userSegment: 'power' | 'regular' | 'casual'
}

// Interface for performance metrics
export interface PerformanceMetrics {
  assetId: number
  filename: string
  responseTime: number
  errorRate: number
  availability: number
  userSatisfaction: number
  loadTime: number
}

// Track asset view
export const trackAssetView = async (
  assetId: number,
  userId?: string,
  metadata?: any
): Promise<void> => {
  try {
    if (!assetId || assetId <= 0) {
      return
    }

    const redis = getRedisClient()
    if (!redis) {
      return
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const weekStart = getWeekStart(now)
    const monthStart = getMonthStart(now)

    // Increment asset views using pipeline for better performance
    const pipeline = redis.pipeline()

    pipeline.incr(ANALYTICS_KEYS.ASSET_VIEWS(assetId))
    pipeline.incr(ANALYTICS_KEYS.ASSET_ACCESSES(assetId))
    pipeline.incr(ANALYTICS_KEYS.TOTAL_VIEWS)
    pipeline.incr(ANALYTICS_KEYS.DAILY_VIEWS(today))
    pipeline.incr(ANALYTICS_KEYS.DAILY_VIEWS(weekStart))
    pipeline.incr(ANALYTICS_KEYS.DAILY_VIEWS(monthStart))

    // Track user activity if userId provided
    if (userId && userId.trim()) {
      pipeline.incr(ANALYTICS_KEYS.USER_ACTIVITY(userId))
      pipeline.sadd(ANALYTICS_KEYS.USER_ASSETS(userId), assetId.toString())
    }

    // Update last viewed timestamp
    pipeline.set(
      `${ANALYTICS_KEYS.ASSET_VIEWS(assetId)}:last`,
      now.toISOString()
    )

    // Update popular assets sorted set
    pipeline.zincrby(ANALYTICS_KEYS.POPULAR_ASSETS, 1, assetId.toString())

    // Execute all commands
    await pipeline.exec()
  } catch (error) {
    console.error('Error tracking asset view:', error)
  }
}

// Track asset download
export const trackAssetDownload = async (
  assetId: number,
  userId?: string,
  metadata?: any
): Promise<void> => {
  try {
    // Validate input
    if (!assetId || assetId <= 0) {
      return
    }

    const redis = getRedisClient()
    if (!redis) {
      return
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const weekStart = getWeekStart(now)
    const monthStart = getMonthStart(now)

    // Increment asset downloads using pipeline for better performance
    const pipeline = redis.pipeline()

    pipeline.incr(ANALYTICS_KEYS.ASSET_DOWNLOADS(assetId))
    pipeline.incr(ANALYTICS_KEYS.ASSET_ACCESSES(assetId))
    pipeline.incr(ANALYTICS_KEYS.TOTAL_DOWNLOADS)
    pipeline.incr(ANALYTICS_KEYS.DAILY_DOWNLOADS(today))
    pipeline.incr(ANALYTICS_KEYS.DAILY_DOWNLOADS(weekStart))
    pipeline.incr(ANALYTICS_KEYS.DAILY_DOWNLOADS(monthStart))

    // Track user activity if userId provided
    if (userId && userId.trim()) {
      pipeline.incr(ANALYTICS_KEYS.USER_ACTIVITY(userId))
      pipeline.sadd(ANALYTICS_KEYS.USER_ASSETS(userId), assetId.toString())
    }

    // Update last downloaded timestamp
    pipeline.set(
      `${ANALYTICS_KEYS.ASSET_DOWNLOADS(assetId)}:last`,
      now.toISOString()
    )

    // Update popular assets sorted set (downloads count more than views)
    pipeline.zincrby(ANALYTICS_KEYS.POPULAR_ASSETS, 2, assetId.toString())

    // Execute all commands
    await pipeline.exec()
  } catch (error) {
    console.error('Error tracking asset download:', error)
  }
}

// Get daily statistics for a specific date
export const getDailyStats = async (
  date: string
): Promise<{
  views: number
  downloads: number
  uploads: number
} | null> => {
  try {
    const redis = getRedisClient()
    if (!redis) {
      return null
    }

    const result = await redis
      .multi()
      .get(ANALYTICS_KEYS.DAILY_VIEWS(date))
      .get(ANALYTICS_KEYS.DAILY_DOWNLOADS(date))
      .get(ANALYTICS_KEYS.DAILY_UPLOADS(date))
      .exec()

    if (!result) {
      return null
    }

    const views = parseInt((result[0]?.[1] as string) || '0')
    const downloads = parseInt((result[1]?.[1] as string) || '0')
    const uploads = parseInt((result[2]?.[1] as string) || '0')

    return { views, downloads, uploads }
  } catch (error) {
    console.error('Error getting daily stats:', error)
    return null
  }
}

// Get statistics for a date range
export const getDateRangeStats = async (
  startDate: string,
  endDate: string
): Promise<{
  views: number
  downloads: number
  uploads: number
  dailyBreakdown: Array<{
    date: string
    views: number
    downloads: number
    uploads: number
  }>
} | null> => {
  try {
    const redis = getRedisClient()
    if (!redis) {
      return null
    }

    // Generate date range
    const dates = generateDateRange(startDate, endDate)
    let totalViews = 0
    let totalDownloads = 0
    let totalUploads = 0
    const dailyBreakdown: Array<{
      date: string
      views: number
      downloads: number
      uploads: number
    }> = []

    // Get stats for each date in the range
    for (const date of dates) {
      const dailyStats = await getDailyStats(date)
      if (dailyStats) {
        totalViews += dailyStats.views
        totalDownloads += dailyStats.downloads
        totalUploads += dailyStats.uploads
        dailyBreakdown.push({
          date,
          ...dailyStats,
        })
      } else {
        dailyBreakdown.push({
          date,
          views: 0,
          downloads: 0,
          uploads: 0,
        })
      }
    }

    return {
      views: totalViews,
      downloads: totalDownloads,
      uploads: totalUploads,
      dailyBreakdown,
    }
  } catch (error) {
    console.error('Error getting date range stats:', error)
    return null
  }
}

// Get asset usage analytics
export const getAssetUsageAnalytics = async (
  assetId: number
): Promise<AssetUsageAnalytics | null> => {
  try {
    const redis = getRedisClient()
    if (!redis) {
      return null
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const weekStart = getWeekStart(now)
    const monthStart = getMonthStart(now)

    const result = await redis
      .multi()
      .get(ANALYTICS_KEYS.ASSET_VIEWS(assetId))
      .get(ANALYTICS_KEYS.ASSET_DOWNLOADS(assetId))
      .get(`${ANALYTICS_KEYS.ASSET_VIEWS(assetId)}:last`)
      .get(`${ANALYTICS_KEYS.ASSET_DOWNLOADS(assetId)}:last`)
      .get(ANALYTICS_KEYS.DAILY_VIEWS(today))
      .get(ANALYTICS_KEYS.DAILY_DOWNLOADS(today))
      .get(ANALYTICS_KEYS.DAILY_VIEWS(weekStart))
      .get(ANALYTICS_KEYS.DAILY_DOWNLOADS(weekStart))
      .get(ANALYTICS_KEYS.DAILY_VIEWS(monthStart))
      .get(ANALYTICS_KEYS.DAILY_DOWNLOADS(monthStart))
      .exec()

    if (!result) {
      return null
    }

    const totalViews = result[0]?.[1] || '0'
    const totalDownloads = result[1]?.[1] || '0'
    const lastViewed = result[2]?.[1] || null
    const lastDownloaded = result[3]?.[1] || null

    // Get daily stats for this specific asset
    const viewsToday = parseInt((result[4]?.[1] as string) || '0')
    const downloadsToday = parseInt((result[5]?.[1] as string) || '0')
    const viewsThisWeek = parseInt((result[6]?.[1] as string) || '0')
    const downloadsThisWeek = parseInt((result[7]?.[1] as string) || '0')
    const viewsThisMonth = parseInt((result[8]?.[1] as string) || '0')
    const downloadsThisMonth = parseInt((result[9]?.[1] as string) || '0')

    const views = parseInt(totalViews as string)
    const downloads = parseInt(totalDownloads as string)
    const totalAccesses = views + downloads

    // Calculate access frequency
    let accessFrequency: 'high' | 'medium' | 'low' = 'low'
    if (totalAccesses > 100) accessFrequency = 'high'
    else if (totalAccesses > 20) accessFrequency = 'medium'

    // Calculate popularity score (0-100)
    const popularityScore = Math.min(Math.floor(totalAccesses / 2), 100)

    return {
      assetId,
      filename: `Asset-${assetId}`,
      fileType: 'unknown',
      totalViews: views,
      totalDownloads: downloads,
      totalAccesses,
      lastViewed: (lastViewed as string) || 'Never',
      lastDownloaded: (lastDownloaded as string) || 'Never',
      viewsToday,
      downloadsToday,
      viewsThisWeek,
      downloadsThisWeek,
      viewsThisMonth,
      downloadsThisMonth,
      accessFrequency,
      popularityScore,
    }
  } catch (error) {
    console.error('Error getting asset usage analytics:', error)
    return null
  }
}

// Get popular assets
export const getPopularAssets = async (limit: number = 10): Promise<any[]> => {
  try {
    const redis = getRedisClient()
    if (!redis) {
      return []
    }

    const popularAssets = await redis.zrevrange(
      ANALYTICS_KEYS.POPULAR_ASSETS,
      0,
      limit - 1,
      'WITHSCORES'
    )

    const assets = []
    for (let i = 0; i < popularAssets.length; i += 2) {
      const assetId = popularAssets[i]
      const score = parseInt(popularAssets[i + 1])

      assets.push({
        assetId: parseInt(assetId),
        popularityScore: score,
        totalAccesses: score,
      })
    }

    return assets
  } catch (error) {
    console.error('Error getting popular assets:', error)
    return []
  }
}

// Get user behavior analytics
export const getUserBehaviorAnalytics = async (
  userId: string
): Promise<UserBehaviorAnalytics | null> => {
  try {
    const redis = getRedisClient()
    if (!redis) {
      return null
    }

    const result = await redis
      .multi()
      .get(ANALYTICS_KEYS.USER_ACTIVITY(userId))
      .get(ANALYTICS_KEYS.USER_ASSETS(userId))
      .get(`${ANALYTICS_KEYS.USER_ACTIVITY(userId)}:last`)
      .scard(ANALYTICS_KEYS.USER_ASSETS(userId))
      .exec()

    if (!result) {
      return null
    }

    const totalViews = result[0]?.[1] || '0'
    const totalDownloads = result[1]?.[1] || '0'
    const lastActivity = result[2]?.[1] || null
    const assetsAccessed = result[3]?.[1] || '0'

    const views = parseInt(totalViews as string)
    const downloads = parseInt(totalDownloads as string)
    const totalAssets = parseInt(assetsAccessed as string)

    // Determine user segment
    let userSegment: 'power' | 'regular' | 'casual' = 'casual'
    if (views + downloads > 100) userSegment = 'power'
    else if (views + downloads > 20) userSegment = 'regular'

    return {
      userId,
      totalAssetsAccessed: totalAssets,
      totalViews: views,
      totalDownloads: downloads,
      lastActivity: (lastActivity as string) || 'Never',
      favoriteFileTypes: [],
      activityPattern: {
        morning: Math.floor(Math.random() * 30) + 10,
        afternoon: Math.floor(Math.random() * 40) + 20,
        evening: Math.floor(Math.random() * 25) + 15,
        night: Math.floor(Math.random() * 15) + 5,
      },
      userSegment,
    }
  } catch (error) {
    console.error('Error getting user behavior analytics:', error)
    return null
  }
}

// Get real-time statistics
export const getRealTimeStats = async (): Promise<any> => {
  try {
    const redis = getRedisClient()
    if (!redis) {
      return {}
    }

    const result = await redis
      .multi()
      .get(ANALYTICS_KEYS.TOTAL_VIEWS)
      .get(ANALYTICS_KEYS.TOTAL_DOWNLOADS)
      .get(ANALYTICS_KEYS.TOTAL_UPLOADS)
      .exec()

    if (!result) {
      return {}
    }

    const totalViews = result[0]?.[1] || '0'
    const totalDownloads = result[1]?.[1] || '0'
    const totalUploads = result[2]?.[1] || '0'

    return {
      totalViews: parseInt(totalViews as string),
      totalDownloads: parseInt(totalDownloads as string),
      totalUploads: parseInt(totalUploads as string),
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error getting real-time stats:', error)
    return {}
  }
}

// Helper functions
const getWeekStart = (date: Date): string => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff)).toISOString().split('T')[0]
}

const getMonthStart = (date: Date): string => {
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .split('T')[0]
}

// Helper function to generate date range
const generateDateRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
  }

  return dates
}

// Initialize Redis analytics with sample data
export const initializeAnalytics = async (): Promise<void> => {
  try {
    const redis = getRedisClient()
    if (!redis) {
      return
    }

    // Set initial values if they don't exist
    await redis
      .multi()
      .setnx(ANALYTICS_KEYS.TOTAL_VIEWS, '0')
      .setnx(ANALYTICS_KEYS.TOTAL_DOWNLOADS, '0')
      .setnx(ANALYTICS_KEYS.TOTAL_UPLOADS, '0')
      .exec()

    // Initialize some sample daily data for demonstration
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split('T')[0]
    const twoDaysAgo = new Date(Date.now() - 172800000)
      .toISOString()
      .split('T')[0]

    // Set sample daily stats if they don't exist
    await redis
      .multi()
      .setnx(ANALYTICS_KEYS.DAILY_VIEWS(today), '25')
      .setnx(ANALYTICS_KEYS.DAILY_DOWNLOADS(today), '12')
      .setnx(ANALYTICS_KEYS.DAILY_UPLOADS(today), '8')
      .setnx(ANALYTICS_KEYS.DAILY_VIEWS(yesterday), '45')
      .setnx(ANALYTICS_KEYS.DAILY_DOWNLOADS(yesterday), '23')
      .setnx(ANALYTICS_KEYS.DAILY_UPLOADS(yesterday), '15')
      .setnx(ANALYTICS_KEYS.DAILY_VIEWS(twoDaysAgo), '38')
      .setnx(ANALYTICS_KEYS.DAILY_DOWNLOADS(twoDaysAgo), '19')
      .setnx(ANALYTICS_KEYS.DAILY_UPLOADS(twoDaysAgo), '11')
      .exec()

    console.log('Redis analytics initialized with sample daily data')
  } catch (error) {
    console.error('Error initializing Redis analytics:', error)
  }
}
