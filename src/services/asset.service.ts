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
import { Readable } from 'stream'
import {
  detectFileType,
  validateFileForUpload,
  generateStoragePath,
  extractBasicMetadata,
  formatFileSize,
} from '../utils/fileTypeUtils'
import path from 'path'

// Shared database pool instance
const pool: Pool = getPool()

// Create a new asset record in database (no file upload)
export const createAsset = async (
  assetData: CreateAssetRequest
): Promise<Asset> => {
  try {
    console.log('=== CREATE ASSET SERVICE START ===')
    console.log('Input asset data:', assetData)
    console.log('Asset data type:', typeof assetData)
    console.log('Asset data keys:', Object.keys(assetData || {}))

    // Note: File should already be uploaded before calling this function
    // This function only creates the database record

    console.log('Starting validation...')
    validateAssetData(assetData)
    console.log('Asset data validation passed')

    console.log('Building SQL query...')
    const query = `
      INSERT INTO assets (filename, original_name, file_type, mime_type, file_size, storage_path, storage_bucket, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `
    console.log('SQL Query:', query)

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
    console.log('Query values:', values)
    console.log(
      'Values types:',
      values.map((v) => typeof v)
    )

    console.log('Executing database query...')
    const result = await pool.query(query, values)
    console.log('Database query result:', result)
    console.log('Result rows:', result.rows)

    if (!result.rows[0]) {
      throw new Error('Failed to create asset - no data returned')
    }

    console.log(`Asset created successfully: ${result.rows[0].filename}`)
    return result.rows[0]
  } catch (error) {
    console.error('=== CREATE ASSET SERVICE ERROR ===')
    console.error('Error type:', typeof error)
    console.error('Error constructor:', error?.constructor?.name)

    // Use type guards to safely access error properties
    if (error && typeof error === 'object' && 'message' in error) {
      console.error('Error message:', (error as any).message)
    }
    if (error && typeof error === 'object' && 'stack' in error) {
      console.error('Error stack:', (error as any).stack)
    }
    console.error('Full error object:', error)

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

// Get asset with signed URL for access
export const getAssetWithSignedUrl = async (
  id: number,
  expiresIn: number = 3600
): Promise<(Asset & { signedUrl: string }) | null> => {
  try {
    const asset = await getAssetById(id)
    if (!asset) return null

    // Generate signed URL for MinIO access
    const signedUrl = await getSignedReadUrl(asset.storage_path, expiresIn)

    return {
      ...asset,
      signedUrl,
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

// Check for duplicate files by filename and content hash
async function checkDuplicateFile(
  filename: string,
  fileBuffer: Buffer
): Promise<{ isDuplicate: boolean; existingAsset?: Asset; reason: string }> {
  try {
    console.log(
      `Checking for duplicates: ${filename} (size: ${fileBuffer.length})`
    )

    // Check by filename first
    const existingByFilename = await pool.query(
      'SELECT * FROM assets WHERE filename = $1 ORDER BY created_at DESC LIMIT 1',
      [filename]
    )

    console.log(
      `Found ${existingByFilename.rows.length} existing files with name: ${filename}`
    )

    if (existingByFilename.rows.length > 0) {
      const existing = existingByFilename.rows[0]
      console.log(
        `Existing file: ${existing.filename}, size: ${existing.file_size}, new file size: ${fileBuffer.length}`
      )

      // Check if file sizes match (basic duplicate detection)
      if (existing.file_size === fileBuffer.length) {
        console.log(
          `DUPLICATE DETECTED: ${filename} - same size (${fileBuffer.length})`
        )
        return {
          isDuplicate: true,
          existingAsset: existing,
          reason: `File "${filename}" already exists with same size (${formatFileSize(fileBuffer.length)})`,
        }
      } else {
        console.log(
          `Size mismatch: existing=${existing.file_size}, new=${fileBuffer.length}`
        )
      }
    }

    console.log(`No duplicate found for: ${filename}`)
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
  console.log(`=== UPLOAD ASSET FILE START [${functionId}] ===`)
  console.log(`📁 [${functionId}] File info:`, {
    filename: file.filename,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    buffer: `Buffer(${file.buffer.length} bytes)`,
  })

  try {
    // Validate upload options
    if (options) {
      validateUploadOptions(options)
    }

    // Check for duplicates first
    const duplicateCheck = await checkDuplicateFile(
      file.originalname,
      file.buffer
    )

    if (duplicateCheck.isDuplicate) {
      const existingAsset = duplicateCheck.existingAsset!
      console.log(
        `🔄 [${functionId}] Duplicate detected: ${file.originalname} (size: ${file.buffer.length})`
      )

      if (options?.skipDuplicates) {
        console.log(
          `⏭️ [${functionId}] Skipping duplicate file: ${file.originalname}`
        )
        return {
          skipped: true,
          message: `Skipped: ${duplicateCheck.reason}`,
        }
      }

      if (options?.replaceDuplicates) {
        console.log(
          `🔄 [${functionId}] Replacing duplicate file: ${file.originalname}`
        )

        // Delete old file from MinIO
        try {
          await deleteFile(existingAsset.storage_path)
          console.log(
            `🗑️ [${functionId}] Deleted old file: ${existingAsset.storage_path}`
          )
        } catch (deleteError) {
          console.warn(
            `⚠️ [${functionId}] Could not delete old file: ${deleteError}`
          )
        }

        // Delete old asset from database
        await pool.query('DELETE FROM assets WHERE id = $1', [existingAsset.id])
        console.log(
          `🗑️ [${functionId}] Deleted old asset record: ${existingAsset.id}`
        )

        // Continue with new upload
      } else {
        // Default behavior: skip duplicates
        console.log(
          `⏭️ [${functionId}] Default behavior: Skipping duplicate file: ${file.originalname}`
        )
        return {
          skipped: true,
          message: `Skipped: ${duplicateCheck.reason}`,
        }
      }
    }

    // Validate file type
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

    console.log(`📤 [${functionId}] Uploading to MinIO: ${storagePath}`)
    // Upload to MinIO
    await uploadFile(storagePath, file.buffer)
    console.log(`✅ [${functionId}] MinIO upload successful: ${storagePath}`)

    // Create asset record
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
      },
    }

    console.log(
      `💾 [${functionId}] Creating database record for: ${file.originalname}`
    )
    const asset = await createAsset(assetData) // Remove file.buffer to prevent double upload
    console.log(
      `✅ [${functionId}] Asset created successfully: ${file.originalname} (ID: ${asset.id})`
    )

    // Auto-queue background processing jobs based on file type
    console.log(
      `🔄 [${functionId}] Queuing background jobs for: ${file.originalname}`
    )
    await queueAutoProcessingJobs(asset)
    console.log(
      `✅ [${functionId}] Background jobs queued for: ${file.originalname}`
    )

    return {
      asset,
      message:
        duplicateCheck.isDuplicate && options?.replaceDuplicates
          ? `Replaced: ${file.originalname}`
          : `Uploaded: ${file.originalname}`,
    }
  } catch (error) {
    console.log(`❌ [${functionId}] === UPLOAD ASSET FILE ERROR ===`)
    console.error(`❌ [${functionId}] Error:`, error)
    throw error
  }
}

// Auto-queue background processing jobs based on file type
async function queueAutoProcessingJobs(asset: Asset) {
  try {
    console.log(
      `Auto-queuing processing jobs for asset ${asset.id} (${asset.file_type})`
    )

    // Import queue config and job service
    const { thumbnailQueue, metadataQueue, conversionQueue } = await import(
      '../config/queue.config'
    )
    const { createJob } = await import('./job.service')

    const jobs = []

    // Always extract metadata for all files
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
    jobs.push({ id: metadataJob.id, type: 'metadata', status: 'queued' })

    // Generate thumbnails for images
    if (asset.file_type === 'image') {
      const thumbnailJob = await createJob({
        job_type: 'thumbnail',
        asset_id: asset.id!,
        status: 'pending',
        priority: 2,
        input_data: { autoQueued: true, reason: 'upload', size: '300x300' },
      })

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
      jobs.push({ id: thumbnailJob.id, type: 'thumbnail', status: 'queued' })

      // Auto-convert images to optimized formats
      const conversionJob = await createJob({
        job_type: 'conversion',
        asset_id: asset.id!,
        status: 'pending',
        priority: 3,
        input_data: {
          autoQueued: true,
          reason: 'upload',
          targetFormat: 'webp',
        },
      })

      await conversionQueue.add(
        'file-conversion',
        {
          assetId: asset.id!,
          jobType: 'conversion',
          options: { autoQueued: true, targetFormat: 'webp' },
          jobId: conversionJob.id,
        },
        {
          jobId: `conv_${conversionJob.id}`,
          priority: 3,
        }
      )
      jobs.push({ id: conversionJob.id, type: 'conversion', status: 'queued' })
    }

    // Process videos with FFmpeg
    if (asset.file_type === 'video') {
      // Queue video processing jobs (these will be handled by video workers)
      console.log(`Auto-queuing video processing jobs for asset ${asset.id}`)

      // Queue video metadata extraction
      const videoMetadataJob = await createJob({
        job_type: 'video_metadata',
        asset_id: asset.id!,
        status: 'pending',
        priority: 2,
        input_data: {
          autoQueued: true,
          reason: 'upload',
          operation: 'metadata',
        },
      })

      // Queue video transcoding to multiple resolutions
      const videoTranscodeJob = await createJob({
        job_type: 'video_transcode',
        asset_id: asset.id!,
        status: 'pending',
        priority: 4,
        input_data: {
          autoQueued: true,
          reason: 'upload',
          operation: 'transcode',
          resolutions: ['1080p', '720p'],
        },
      })

      // Add to video processing queue (using conversion queue for now)
      const { conversionQueue } = await import('../config/queue.config')

      await conversionQueue.add(
        'file-conversion',
        {
          assetId: asset.id!,
          operation: 'metadata',
          options: { autoQueued: true },
          jobId: videoMetadataJob.id,
        },
        {
          jobId: `video_meta_${videoMetadataJob.id}`,
          priority: 2,
        }
      )

      await conversionQueue.add(
        'file-conversion',
        {
          assetId: asset.id!,
          operation: 'transcode',
          options: { autoQueued: true, resolutions: ['1080p', '720p'] },
          jobId: videoTranscodeJob.id,
        },
        {
          jobId: `video_trans_${videoTranscodeJob.id}`,
          priority: 4,
        }
      )

      jobs.push(
        { id: videoMetadataJob.id, type: 'video_metadata', status: 'queued' },
        { id: videoTranscodeJob.id, type: 'video_transcode', status: 'queued' }
      )
    }

    // Process audio files
    if (asset.file_type === 'audio') {
      // Queue audio metadata extraction and conversion if needed
      console.log(`Auto-queuing audio processing jobs for asset ${asset.id}`)

      // Queue audio metadata extraction
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

      // Queue audio format conversion to MP3 (if not already MP3)
      const audioConversionJob = await createJob({
        job_type: 'audio_conversion',
        asset_id: asset.id!,
        status: 'pending',
        priority: 3,
        input_data: {
          autoQueued: true,
          reason: 'upload',
          operation: 'conversion',
          targetFormat: 'mp3',
        },
      })

      // Add to conversion queue
      const { conversionQueue } = await import('../config/queue.config')

      await conversionQueue.add(
        'file-conversion',
        {
          assetId: asset.id!,
          operation: 'metadata',
          options: { autoQueued: true },
          jobId: audioMetadataJob.id,
        },
        {
          jobId: `audio_meta_${audioMetadataJob.id}`,
          priority: 2,
        }
      )

      await conversionQueue.add(
        'file-conversion',
        {
          assetId: asset.id!,
          operation: 'conversion',
          options: { autoQueued: true, targetFormat: 'mp3' },
          jobId: audioConversionJob.id,
        },
        {
          jobId: `audio_conv_${audioConversionJob.id}`,
          priority: 3,
        }
      )

      jobs.push(
        { id: audioMetadataJob.id, type: 'audio_metadata', status: 'queued' },
        {
          id: audioConversionJob.id,
          type: 'audio_conversion',
          status: 'queued',
        }
      )
    }

    console.log(
      `Auto-queued ${jobs.length} processing jobs for asset ${asset.id}:`,
      jobs
    )
  } catch (error) {
    console.error(
      `Failed to auto-queue processing jobs for asset ${asset.id}:`,
      error
    )
    // Don't throw error - asset upload should still succeed even if job queuing fails
  }
}
