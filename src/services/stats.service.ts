import { Pool } from 'pg'
import { getPool } from '../config/database.config'
import {
  getRealTimeStats,
  getPopularAssets,
  getAssetUsageAnalytics,
  initializeAnalytics,
} from './redis-analytics.service'

const pool: Pool = getPool()

// Interface for dashboard statistics
export interface DashboardStats {
  totalAssets: number
  totalDownloads: number
  totalUploads: number
  totalViews: number
  totalStorage: string
  fileTypeBreakdown: {
    [key: string]: number
  }
  recentActivity: {
    uploads: number
    downloads: number
    views: number
  }
  realTimeStats: {
    totalViews: number
    totalDownloads: number
    totalUploads: number
    timestamp: string
  }
}

// Interface for upload statistics
export interface UploadStats {
  totalUploads: number
  uploadsToday: number
  uploadsThisWeek: number
  uploadsThisMonth: number
  averageFileSize: string
  fileTypeBreakdown: {
    [key: string]: number
  }
}

// Interface for download statistics
export interface DownloadStats {
  totalDownloads: number
  downloadsToday: number
  downloadsThisWeek: number
  downloadsThisMonth: number
  popularAssets: {
    id: number
    filename: string
    file_type: string
    totalDownloads: number
    lastDownloaded: string
    popularityScore: number
  }[]
}

// Interface for latest assets
export interface LatestAsset {
  id: number
  filename: string
  file_type: string
  file_size: string
  status: string
  created_at: string
  metadata: any
}

// Get overall dashboard statistics
export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    // Get total assets count from database
    const assetsResult = await pool.query(
      'SELECT COUNT(*) as total FROM assets WHERE deleted_at IS NULL'
    )
    const totalAssets = parseInt(assetsResult.rows[0].total)

    // Get real-time stats from Redis
    const realTimeStats = await getRealTimeStats()
    const totalViews = realTimeStats.totalViews || 0
    const totalDownloads = realTimeStats.totalDownloads || 0
    
    // For uploads, use the actual asset count since that's more accurate
    // Redis upload count might be stale, but asset count is always current
    const totalUploads = totalAssets

    // Get total storage usage from database
    const storageResult = await pool.query(
      'SELECT COALESCE(SUM(file_size::BIGINT), 0) as total FROM assets WHERE deleted_at IS NULL'
    )
    const totalStorageBytes = parseInt(storageResult.rows[0].total)
    const totalStorage = formatBytes(totalStorageBytes)

    // Get file type breakdown from database
    const fileTypeResult = await pool.query(
      'SELECT file_type, COUNT(*) as count FROM assets WHERE deleted_at IS NULL GROUP BY file_type ORDER BY count DESC'
    )
    const fileTypeBreakdown: { [key: string]: number } = {}
    fileTypeResult.rows.forEach((row) => {
      fileTypeBreakdown[row.file_type] = parseInt(row.count)
    })

    // Get recent activity (dummy data for now, could be enhanced with Redis)
    const recentActivity = {
      uploads: Math.floor(Math.random() * 20) + 5,
      downloads: Math.floor(Math.random() * 30) + 10,
      views: Math.floor(Math.random() * 50) + 20,
    }

    return {
      totalAssets,
      totalDownloads,
      totalUploads,
      totalViews,
      totalStorage,
      fileTypeBreakdown,
      recentActivity,
      realTimeStats,
    }
  } catch (error) {
    console.error('Error getting dashboard stats:', error)
    throw error
  }
}

// Get upload statistics
export const getUploadStats = async (period: string): Promise<UploadStats> => {
  try {
    // Get real-time upload stats from Redis
    const realTimeStats = await getRealTimeStats()
    const totalUploads =
      realTimeStats.totalUploads || Math.floor(Math.random() * 200) + 100

    // Get uploads by period (dummy data for now, could be enhanced with Redis daily stats)
    const uploadsToday = Math.floor(Math.random() * 50) + 20
    const uploadsThisWeek = Math.floor(Math.random() * 200) + 100
    const uploadsThisMonth = Math.floor(Math.random() * 800) + 400

    // Get average file size from database
    const avgSizeResult = await pool.query(
      'SELECT COALESCE(AVG(file_size::BIGINT), 0) as avg_size FROM assets WHERE deleted_at IS NULL'
    )
    const averageFileSize = formatBytes(
      parseInt(avgSizeResult.rows[0].avg_size)
    )

    // Get file type breakdown from database
    const fileTypeResult = await pool.query(
      'SELECT file_type, COUNT(*) as count FROM assets WHERE deleted_at IS NULL GROUP BY file_type ORDER BY count DESC'
    )
    const fileTypeBreakdown: { [key: string]: number } = {}
    fileTypeResult.rows.forEach((row) => {
      fileTypeBreakdown[row.file_type] = parseInt(row.count)
    })

    return {
      totalUploads,
      uploadsToday,
      uploadsThisWeek,
      uploadsThisMonth,
      averageFileSize,
      fileTypeBreakdown,
    }
  } catch (error) {
    console.error('Error getting upload stats:', error)
    throw error
  }
}

// Get download statistics
export const getDownloadStats = async (
  period: string
): Promise<DownloadStats> => {
  try {
    // Get real-time download stats from Redis
    const realTimeStats = await getRealTimeStats()
    const totalDownloads =
      realTimeStats.totalDownloads || Math.floor(Math.random() * 100) + 50

    // Get downloads by period (dummy data for now, could be enhanced with Redis daily stats)
    const downloadsToday = Math.floor(Math.random() * 30) + 15
    const downloadsThisWeek = Math.floor(Math.random() * 150) + 75
    const downloadsThisMonth = Math.floor(Math.random() * 600) + 300

    // Get popular assets from Redis
    const redisPopularAssets = await getPopularAssets(10)

    // Combine Redis data with database data for popular assets
    const popularAssets = await Promise.all(
      redisPopularAssets.map(async (redisAsset) => {
        const assetResult = await pool.query(
          'SELECT id, filename, file_type, file_size FROM assets WHERE id = $1 AND deleted_at IS NULL',
          [redisAsset.assetId]
        )

        if (assetResult.rows.length === 0) {
          return null
        }

        const asset = assetResult.rows[0]

        return {
          id: asset.id,
          filename: asset.filename,
          file_type: asset.file_type,
          totalDownloads: redisAsset.totalAccesses,
          lastDownloaded: new Date().toISOString(),
          popularityScore: redisAsset.popularityScore,
        }
      })
    )

    // Filter out null values and get asset usage analytics
    const validPopularAssets = popularAssets.filter((asset) => asset !== null)

    // If no Redis data, fall back to dummy data
    if (validPopularAssets.length === 0) {
      const dummyPopularAssets = [
        {
          id: 71,
          filename: 'SampleVideo_720x480_2mb.mp4',
          file_type: 'video',
          totalDownloads: Math.floor(Math.random() * 50) + 20,
          lastDownloaded: new Date().toISOString(),
          popularityScore: Math.floor(Math.random() * 100) + 50,
        },
        {
          id: 72,
          filename: 'SampleImage_1920x1080.jpg',
          file_type: 'image',
          totalDownloads: Math.floor(Math.random() * 40) + 15,
          lastDownloaded: new Date(Date.now() - 86400000).toISOString(),
          popularityScore: Math.floor(Math.random() * 100) + 40,
        },
        {
          id: 73,
          filename: 'SampleDocument.pdf',
          file_type: 'document',
          totalDownloads: Math.floor(Math.random() * 30) + 10,
          lastDownloaded: new Date(Date.now() - 172800000).toISOString(),
          popularityScore: Math.floor(Math.random() * 100) + 30,
        },
      ]

      return {
        totalDownloads,
        downloadsToday,
        downloadsThisWeek,
        downloadsThisMonth,
        popularAssets: dummyPopularAssets,
      }
    }

    return {
      totalDownloads,
      downloadsToday,
      downloadsThisWeek,
      downloadsThisMonth,
      popularAssets: validPopularAssets,
    }
  } catch (error) {
    console.error('Error getting download stats:', error)
    throw error
  }
}

// Get latest assets
export const getLatestAssets = async (
  limit: number
): Promise<LatestAsset[]> => {
  try {
    const result = await pool.query(
      'SELECT id, filename, file_type, file_size, status, created_at, metadata FROM assets WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1',
      [limit]
    )

    return result.rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      file_type: row.file_type,
      file_size: formatBytes(parseInt(row.file_size)),
      status: row.status,
      created_at: row.created_at,
      metadata: row.metadata,
    }))
  } catch (error) {
    console.error('Error getting latest assets:', error)
    throw error
  }
}

// Get asset analytics for a specific asset
export const getAssetAnalytics = async (assetId: number): Promise<any> => {
  try {
    // Get Redis analytics
    const redisAnalytics = await getAssetUsageAnalytics(assetId)

    // Get database asset info
    const assetResult = await pool.query(
      'SELECT id, filename, file_type, file_size, created_at FROM assets WHERE id = $1 AND deleted_at IS NULL',
      [assetId]
    )

    if (assetResult.rows.length === 0) {
      return null
    }

    const asset = assetResult.rows[0]

    // Combine Redis and database data
    return {
      ...redisAnalytics,
      filename: asset.filename,
      fileType: asset.file_type,
      fileSize: formatBytes(parseInt(asset.file_size)),
      createdAt: asset.created_at,
    }
  } catch (error) {
    console.error('Error getting asset analytics:', error)
    return null
  }
}

// Helper function to format bytes
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Initialize stats service with Redis analytics
export const initializeStatsService = async (): Promise<void> => {
  try {
    await initializeAnalytics()
    console.log('Stats service initialized with Redis analytics')
  } catch (error) {
    console.warn(
      'Failed to initialize Redis analytics, continuing with fallback data'
    )
  }
}
