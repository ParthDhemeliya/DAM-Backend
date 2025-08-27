import { Pool } from 'pg'
import {
  Asset,
  CreateAssetRequest,
  UpdateAssetRequest,
  FileType,
} from '../interfaces/asset.interface'
import { getPool } from '../config/database.config'
import {
  validateAssetData,
  validateAssetId,
  validateAssetStatus,
  validateUploadOptions,
} from '../validation'
import { validateString } from '../middleware/validation'
import { uploadFile, deleteFile, getSignedReadUrl, fileExists } from './storage'
import {
  checkForDuplicates,
  handleDuplicateFile,
  DuplicateHandlingOptions,
  DuplicateHandlingResult,
} from './duplicate.service'
import { Readable } from 'stream'
import {
  detectFileType,
  validateFileForUpload,
  generateStoragePath,
  extractBasicMetadata,
  formatFileSize,
} from '../utils/fileTypeUtils'
import path from 'path'
import crypto from 'crypto'

// Shared database pool instance
const pool: Pool = getPool()

// Create a new asset record in database (no file upload)
export const createAsset = async (
  assetData: CreateAssetRequest
): Promise<Asset> => {
  try {
    // Starting validation
    validateAssetData(assetData)

    // Building SQL query
    const query = `
      INSERT INTO assets (filename, original_name, file_type, mime_type, file_size, storage_path, storage_bucket, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `

    const values = [
      assetData.filename.trim(),
      assetData.original_name.trim(),
      assetData.file_type.trim(),
      assetData.mime_type.trim(),
      assetData.file_size,
      assetData.storage_path.trim(),
      assetData.storage_bucket || 'dam-media',
      JSON.stringify(assetData.metadata || {}),
    ]

    // Executing database query
    const result = await pool.query(query, values)

    if (!result.rows[0]) {
      throw new Error('Failed to create asset - no data returned')
    }

    // Asset created successfully
    return result.rows[0]
  } catch (error) {
    console.error('Asset creation failed:', error)

    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Asset creation failed: ${error.message}`)
    }
    throw new Error('Asset creation failed with unknown error')
  }
}

// Get asset by ID
export const getAssetById = async (id: number): Promise<Asset | null> => {
  try {
    validateAssetId(id)

    const query = 'SELECT * FROM assets WHERE id = $1 AND deleted_at IS NULL'
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (error) {
    console.error('Error getting asset by ID:', error)
    throw error
  }
}

// Get all assets
export const getAllAssets = async (): Promise<Asset[]> => {
  try {
    const query =
      'SELECT * FROM assets WHERE deleted_at IS NULL ORDER BY created_at DESC'
    const result = await pool.query(query)
    return result.rows
  } catch (error) {
    console.error('Error getting all assets:', error)
    throw error
  }
}

// Get assets with pagination and filters
export const getAssetsWithFilters = async (options: {
  page?: number
  limit?: number
  fileType?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  tags?: string[]
  category?: string
  author?: string
  department?: string
  project?: string
  sortBy?: 'created_at' | 'updated_at' | 'filename' | 'file_size'
  sortOrder?: 'ASC' | 'DESC'
}): Promise<{
  assets: Asset[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}> => {
  try {
    const {
      page = 1,
      limit = 20,
      fileType,
      status,
      dateFrom,
      dateTo,
      tags,
      category,
      author,
      department,
      project,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = options

    // Validate pagination parameters
    if (page < 1) throw new Error('Page must be greater than 0')
    if (limit < 1 || limit > 100)
      throw new Error('Limit must be between 1 and 100')

    // Build WHERE clause
    const whereConditions: string[] = ['deleted_at IS NULL']
    const queryParams: any[] = []
    let paramCount = 0

    if (fileType) {
      paramCount++
      whereConditions.push(`file_type = $${paramCount}`)
      queryParams.push(fileType)
    }

    if (status) {
      paramCount++
      whereConditions.push(`status = $${paramCount}`)
      queryParams.push(status)
    }

    if (dateFrom) {
      paramCount++
      whereConditions.push(`created_at >= $${paramCount}`)
      queryParams.push(dateFrom)
    }

    if (dateTo) {
      paramCount++
      whereConditions.push(`created_at <= $${paramCount}`)
      queryParams.push(dateTo)
    }

    if (category) {
      paramCount++
      whereConditions.push(`metadata->>'category' = $${paramCount}`)
      queryParams.push(category)
    }

    if (author) {
      paramCount++
      whereConditions.push(`metadata->>'author' = $${paramCount}`)
      queryParams.push(author)
    }

    if (department) {
      paramCount++
      whereConditions.push(`metadata->>'department' = $${paramCount}`)
      queryParams.push(department)
    }

    if (project) {
      paramCount++
      whereConditions.push(`metadata->>'project' = $${paramCount}`)
      queryParams.push(project)
    }

    if (tags && tags.length > 0) {
      const tagConditions = tags.map((_, index) => {
        paramCount++
        return `metadata->'tags' ? $${paramCount}`
      })
      whereConditions.push(`(${tagConditions.join(' AND ')})`)
      queryParams.push(...tags)
    }

    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Build ORDER BY clause
    const orderByClause = `ORDER BY ${sortBy} ${sortOrder}`

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) FROM assets ${whereClause}`
    const countResult = await pool.query(countQuery, queryParams)
    const total = parseInt(countResult.rows[0].count)

    // Calculate pagination
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit
    const hasNext = page < totalPages
    const hasPrev = page > 1

    // Get paginated results
    const dataQuery = `
      SELECT * FROM assets 
      ${whereClause} 
      ${orderByClause} 
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `
    const dataParams = [...queryParams, limit, offset]
    const dataResult = await pool.query(dataQuery, dataParams)

    return {
      assets: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev,
      },
    }
  } catch (error) {
    console.error('Error getting assets with filters:', error)
    throw error
  }
}

// Search assets by keyword (filename and tags)
export const searchAssets = async (options: {
  query: string
  page?: number
  limit?: number
  fileType?: string
  status?: string
  sortBy?: 'created_at' | 'updated_at' | 'filename' | 'file_size'
  sortOrder?: 'ASC' | 'DESC'
}): Promise<{
  assets: Asset[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}> => {
  try {
    const {
      query,
      page = 1,
      limit = 20,
      fileType,
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = options

    // Validate parameters
    if (!query || query.trim().length === 0) {
      throw new Error('Search query is required')
    }
    if (page < 1) throw new Error('Page must be greater than 0')
    if (limit < 1 || limit > 100)
      throw new Error('Limit must be between 1 and 100')

    // Build WHERE clause for search
    const whereConditions: string[] = ['deleted_at IS NULL']
    const queryParams: any[] = []
    let paramCount = 0

    // Add search conditions
    paramCount++
    whereConditions.push(`(
      filename ILIKE $${paramCount} OR 
      original_name ILIKE $${paramCount} OR 
      metadata->>'tags' ILIKE $${paramCount} OR
      metadata->>'description' ILIKE $${paramCount} OR
      metadata->>'category' ILIKE $${paramCount} OR
      metadata->>'author' ILIKE $${paramCount} OR
      metadata->>'department' ILIKE $${paramCount} OR
      metadata->>'project' ILIKE $${paramCount}
    )`)
    queryParams.push(`%${query.trim()}%`)

    // Add filters
    if (fileType) {
      paramCount++
      whereConditions.push(`file_type = $${paramCount}`)
      queryParams.push(fileType)
    }

    if (status) {
      paramCount++
      whereConditions.push(`status = $${paramCount}`)
      queryParams.push(status)
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`
    const orderByClause = `ORDER BY ${sortBy} ${sortOrder}`

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) FROM assets ${whereClause}`
    const countResult = await pool.query(countQuery, queryParams)
    const total = parseInt(countResult.rows[0].count)

    // Calculate pagination
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit
    const hasNext = page < totalPages
    const hasPrev = page > 1

    // Get paginated search results
    const dataQuery = `
      SELECT * FROM assets 
      ${whereClause} 
      ${orderByClause} 
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `
    const dataParams = [...queryParams, limit, offset]
    const dataResult = await pool.query(dataQuery, dataParams)

    return {
      assets: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev,
      },
    }
  } catch (error) {
    console.error('Error searching assets:', error)
    throw error
  }
}

// Get assets with signed URLs for batch access
export const getAssetsWithSignedUrls = async (
  assetIds: number[],
  expiresIn: number = 3600
): Promise<(Asset & { signedUrl: string | null })[]> => {
  try {
    if (!assetIds || assetIds.length === 0) {
      return []
    }

    // Get assets by IDs
    const placeholders = assetIds.map((_, index) => `$${index + 1}`).join(',')
    const query = `SELECT * FROM assets WHERE id IN (${placeholders}) AND deleted_at IS NULL`
    const result = await pool.query(query, assetIds)

    if (result.rows.length === 0) {
      return []
    }

    // Generate signed URLs for each asset
    const assetsWithUrls = await Promise.all(
      result.rows.map(async (asset) => {
        try {
          const signedUrl = await getSignedReadUrl(
            asset.storage_path,
            expiresIn
          )
          return {
            ...asset,
            signedUrl,
          }
        } catch (error) {
          console.warn(
            `Failed to generate signed URL for asset ${asset.id} (MinIO may be unavailable):`,
            error instanceof Error ? error.message : 'Unknown error'
          )
          return {
            ...asset,
            signedUrl: null,
          }
        }
      })
    )

    return assetsWithUrls
  } catch (error) {
    console.error('Error getting assets with signed URLs:', error)
    // Return assets without signed URLs instead of throwing error
    try {
      const placeholders = assetIds.map((_, index) => `$${index + 1}`).join(',')
      const query = `SELECT * FROM assets WHERE id IN (${placeholders}) AND deleted_at IS NULL`
      const result = await pool.query(query, assetIds)

      return result.rows.map((asset) => ({
        ...asset,
        signedUrl: null,
      }))
    } catch (dbError) {
      console.error('Database query also failed:', dbError)
      throw new Error('Failed to retrieve assets')
    }
  }
}

// Get asset with signed URL for access
export const getAssetWithSignedUrl = async (
  id: number,
  expiresIn: number = 3600
): Promise<(Asset & { signedUrl: string | null }) | null> => {
  try {
    const asset = await getAssetById(id)
    if (!asset) return null

    try {
      // Generate signed URL for MinIO access
      const signedUrl = await getSignedReadUrl(asset.storage_path, expiresIn)
      return {
        ...asset,
        signedUrl,
      }
    } catch (minioError) {
      console.warn(
        `Failed to generate signed URL for asset ${id} (MinIO may be unavailable):`,
        minioError instanceof Error ? minioError.message : 'Unknown error'
      )
      return {
        ...asset,
        signedUrl: null,
      }
    }
  } catch (error) {
    console.error('Error getting asset with signed URL:', error)
    throw error
  }
}

// Update asset
export const updateAsset = async (
  id: number,
  updateData: UpdateAssetRequest
): Promise<Asset | null> => {
  try {
    validateAssetId(id)

    const fields: string[] = []
    const values: any[] = []
    let paramCount = 0

    // Build dynamic query based on provided fields
    if (updateData.filename !== undefined) {
      validateString(updateData.filename, 'filename')
      paramCount++
      fields.push(`filename = $${paramCount}`)
      values.push(updateData.filename.trim())
    }

    if (updateData.status !== undefined) {
      validateAssetStatus(updateData.status)
      paramCount++
      fields.push(`status = $${paramCount}`)
      values.push(updateData.status)
    }

    if (updateData.metadata !== undefined) {
      paramCount++
      fields.push(`metadata = $${paramCount}`)
      values.push(JSON.stringify(updateData.metadata))
    }

    if (fields.length === 0) {
      return getAssetById(id)
    }

    paramCount++
    fields.push(`updated_at = $${paramCount}`)
    values.push(new Date())

    paramCount++
    values.push(id)

    const query = `
      UPDATE assets 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING *
    `

    const result = await pool.query(query, values)
    return result.rows[0] || null
  } catch (error) {
    console.error('Error updating asset:', error)
    throw error
  }
}

// Delete asset (soft delete) and remove from MinIO
export const deleteAsset = async (id: number): Promise<boolean> => {
  try {
    validateAssetId(id)

    // Get asset to find storage path
    const asset = await getAssetById(id)
    if (!asset) {
      throw new Error('Asset not found')
    }

    // Delete file from MinIO
    try {
      await deleteFile(asset.storage_path)
      console.log('File deleted from MinIO:', asset.storage_path)
    } catch (minioError) {
      console.warn('Failed to delete file from MinIO:', minioError)
      // Continue with database deletion even if MinIO deletion fails
    }

    // Soft delete from database
    const query = `
      UPDATE assets 
      SET deleted_at = $1, updated_at = $1
      WHERE id = $2 AND deleted_at IS NULL
    `

    const result = await pool.query(query, [new Date(), id])
    return result.rowCount ? result.rowCount > 0 : false
  } catch (error) {
    console.error('Error deleting asset:', error)
    throw error
  }
}

// Check for duplicate files using the duplicate service
async function checkDuplicateFile(
  filename: string,
  fileBuffer: Buffer
): Promise<{ isDuplicate: boolean; existingAsset?: Asset; reason: string }> {
  try {
    const duplicateResult = await checkForDuplicates(
      filename,
      fileBuffer,
      filename
    )

    if (duplicateResult.isDuplicate) {
      const existingAsset = duplicateResult.existingAssets[0]
      const reason = `File "${filename}" already exists (${duplicateResult.duplicateType} duplicate)`

      return {
        isDuplicate: true,
        existingAsset: existingAsset,
        reason: reason,
      }
    }

    return { isDuplicate: false, reason: 'No duplicate found' }
  } catch (error) {
    console.error('Error checking for duplicates:', error)
    return { isDuplicate: false, reason: 'Error checking duplicates' }
  }
}

// Upload file to MinIO and create asset
export const uploadAssetFile = async (
  file: Express.Multer.File,
  metadata?: any,
  options?: { skipDuplicates?: boolean; replaceDuplicates?: boolean }
): Promise<{
  asset?: Asset
  skipped?: boolean
  replaced?: boolean
  message: string
}> => {
  const functionId = Date.now() + '-' + Math.random().toString(36).substr(2, 9)

  try {
    // Validate upload options
    if (options) {
      validateUploadOptions(options)
    }

    // Skip duplicate checking for better performance during bulk uploads
    // This can be re-enabled later if needed
    const duplicateCheck = {
      isDuplicate: false,
      reason: 'Skipped for performance',
    }

    // Validate file type (keep this as it's fast)
    const validation = validateFileForUpload(
      file.originalname,
      file.mimetype,
      file.size
    )
    if (!validation.isValid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`)
    }
    const fileType = validation.fileType

    // Generate unique filename
    const timestamp = Date.now()
    const extension = path.extname(file.originalname)
    const filename = `${timestamp}-${file.originalname}`
    const storagePath = `assets/${filename}`

    // Upload file to storage first (this is the main bottleneck)
    await uploadFile(storagePath, file.buffer)

    // Skip content hash generation for better performance
    const contentHash = 'skipped-for-performance'

    // Create minimal metadata to speed up database insertion
    const assetData: CreateAssetRequest = {
      filename: file.originalname,
      original_name: file.originalname,
      file_type: fileType,
      mime_type: file.mimetype,
      file_size: file.size,
      storage_path: storagePath,
      storage_bucket: process.env.MINIO_BUCKET || 'dam-media',
      metadata: {
        ...metadata,
        fileType: fileType,
        extension: extension.substring(1),
        description: metadata?.description || 'Uploaded via API',
        uploadMethod: 'api',
        formattedSize: formatFileSize(file.size),
        uploadTimestamp: new Date().toISOString(),
        contentHash: contentHash,
      },
    }

    // Create asset in database (this is fast)
    const asset = await createAsset(assetData)

    // Queue background jobs asynchronously to not block the upload response
    // Use setImmediate to defer this operation
    setImmediate(() => {
      queueAutoProcessingJobs(asset).catch((error) => {
        console.warn(
          `Failed to queue background jobs for asset ${asset.id}:`,
          error
        )
      })
    })

    return {
      asset,
      message:
        duplicateCheck.isDuplicate && options?.replaceDuplicates
          ? `Replaced: ${file.originalname}`
          : `Uploaded: ${file.originalname}`,
    }
  } catch (error) {
    console.error(`Error:`, error)
    throw error
  }
}

// Auto-queue background processing jobs based on file type
async function queueAutoProcessingJobs(asset: Asset) {
  try {
    // Always queue metadata extraction for all files
    const { metadataQueue } = await import('../config/queue.config')
    const { createJob } = await import('./job.service')

    const metadataJob = await createJob({
      job_type: 'metadata',
      asset_id: asset.id!,
      status: 'pending',
      priority: 1,
      input_data: { autoQueued: true, reason: 'upload' },
    })

    await metadataQueue.add(
      'metadata-extraction',
      {
        assetId: asset.id!,
        jobType: 'metadata',
        options: { autoQueued: true },
        jobId: metadataJob.id,
      },
      {
        jobId: `meta_${metadataJob.id}`,
        priority: 1,
      }
    )

    // Generate thumbnails for ALL images (essential for gallery view)
    if (asset.file_type === 'image') {
      const thumbnailJob = await createJob({
        job_type: 'thumbnail',
        asset_id: asset.id!,
        status: 'pending',
        priority: 2,
        input_data: { autoQueued: true, reason: 'upload', size: '300x300' },
      })

      const { thumbnailQueue } = await import('../config/queue.config')
      await thumbnailQueue.add(
        'thumbnail-generation',
        {
          assetId: asset.id!,
          jobType: 'thumbnail',
          options: { autoQueued: true, size: '300x300' },
          jobId: thumbnailJob.id,
        },
        {
          jobId: `thumb_${thumbnailJob.id}`,
          priority: 2,
        }
      )
    }

    // For larger files, queue additional processing jobs
    if (asset.file_size >= 1024 * 1024) {
      const { conversionQueue } = await import('../config/queue.config')

      // Process videos with FFmpeg (only for files > 10MB)
      if (asset.file_type === 'video' && asset.file_size > 10 * 1024 * 1024) {
        // Queue video transcoding to multiple resolutions
        const videoTranscodeJob = await createJob({
          job_type: 'video_transcode',
          asset_id: asset.id!,
          status: 'pending',
          priority: 3,
          input_data: {
            autoQueued: true,
            reason: 'upload',
            operation: 'transcode',
            resolutions: ['1080p', '720p'],
          },
        })

        await conversionQueue.add(
          'file-conversion',
          {
            assetId: asset.id!,
            jobType: 'conversion',
            options: {
              autoQueued: true,
              resolutions: ['1080p', '720p'],
              targetFormat: 'mp4',
              quality: 'medium',
            },
            jobId: videoTranscodeJob.id,
          },
          {
            jobId: `video_transcode_${videoTranscodeJob.id}`,
            priority: 3,
          }
        )
      }

      // Process audio files (only for files > 5MB)
      if (asset.file_type === 'audio' && asset.file_size > 5 * 1024 * 1024) {
        const audioMetadataJob = await createJob({
          job_type: 'audio_metadata',
          asset_id: asset.id!,
          status: 'pending',
          priority: 2,
          input_data: {
            autoQueued: true,
            reason: 'upload',
            operation: 'metadata',
          },
        })

        await conversionQueue.add(
          'metadata-extraction',
          {
            assetId: asset.id!,
            jobType: 'metadata',
            options: { autoQueued: true },
            jobId: audioMetadataJob.id,
          },
          {
            jobId: `audio_meta_${audioMetadataJob.id}`,
            priority: 2,
          }
        )
      }
    }
  } catch (error) {
    console.error(`Failed to queue background jobs for asset ${asset.id}:`, error)
  }
}
