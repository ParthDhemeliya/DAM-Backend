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

// Track asset upload
export const trackAssetUpload = async (
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
      console.warn('Redis client not available for analytics tracking')
      return
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const weekStart = getWeekStart(now)
    const monthStart = getMonthStart(now)

    // Increment asset uploads using pipeline for better performance
    const pipeline = redis.pipeline()

    pipeline.incr(ANALYTICS_KEYS.ASSET_UPLOADS(assetId))
    pipeline.incr(ANALYTICS_KEYS.TOTAL_UPLOADS)
    pipeline.incr(ANALYTICS_KEYS.DAILY_UPLOADS(today))
    pipeline.incr(ANALYTICS_KEYS.DAILY_UPLOADS(weekStart))
    pipeline.incr(ANALYTICS_KEYS.DAILY_UPLOADS(monthStart))

    // Track user activity if userId provided
    if (userId && userId.trim()) {
      pipeline.incr(ANALYTICS_KEYS.USER_ACTIVITY(userId))
      pipeline.sadd(ANALYTICS_KEYS.USER_ASSETS(userId), assetId.toString())
    }

    // Update last uploaded timestamp
    pipeline.set(
      `${ANALYTICS_KEYS.ASSET_UPLOADS(assetId)}:last`,
      now.toISOString()
    )

    // Execute all commands
    await pipeline.exec()
  } catch (error) {
    console.error('Error tracking asset upload:', error)
    // Don't throw - analytics tracking failure shouldn't break the main flow
  }
}

// Track asset view
export const trackAssetView = async (
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
      console.warn('Redis client not available for analytics tracking')
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
    // Don't throw - analytics tracking failure shouldn't break the main flow
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
      console.warn('Redis client not available for analytics tracking')
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
    // Don't throw - analytics tracking failure shouldn't break the main flow
  }
}

// Get asset usage analytics
export const getAssetUsageAnalytics = async (
  assetId: number
): Promise<AssetUsageAnalytics | null> => {
  try {
    const redis = getRedisClient()
    if (!redis) {
      console.warn('Redis client not available for analytics tracking')
      return null
    }

    const result = await redis
      .multi()
      .get(ANALYTICS_KEYS.ASSET_VIEWS(assetId))
      .get(ANALYTICS_KEYS.ASSET_DOWNLOADS(assetId))
      .get(`${ANALYTICS_KEYS.ASSET_VIEWS(assetId)}:last`)
      .get(`${ANALYTICS_KEYS.ASSET_DOWNLOADS(assetId)}:last`)
      .exec()

    if (!result) {
      return null
    }

    const totalViews = result[0]?.[1] || '0'
    const totalDownloads = result[1]?.[1] || '0'
    const lastViewed = result[2]?.[1] || null
    const lastDownloaded = result[3]?.[1] || null

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
      viewsToday: 0,
      downloadsToday: 0,
      viewsThisWeek: 0,
      downloadsThisWeek: 0,
      viewsThisMonth: 0,
      downloadsThisMonth: 0,
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
      console.warn('Redis client not available for analytics tracking')
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
      console.warn('Redis client not available for analytics tracking')
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
      console.warn('Redis client not available for analytics tracking')
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

// Initialize Redis analytics with sample data
export const initializeAnalytics = async (): Promise<void> => {
  try {
    const redis = getRedisClient()
    if (!redis) {
      console.warn('Redis client not available for analytics initialization')
      return
    }

    // Set initial values if they don't exist
    await redis
      .multi()
      .setnx(ANALYTICS_KEYS.TOTAL_VIEWS, '0')
      .setnx(ANALYTICS_KEYS.TOTAL_DOWNLOADS, '0')
      .setnx(ANALYTICS_KEYS.TOTAL_UPLOADS, '0')
      .exec()
  } catch (error) {
    console.error('Error initializing Redis analytics:', error)
    // Don't throw - analytics initialization failure shouldn't break the main flow
  }
}
