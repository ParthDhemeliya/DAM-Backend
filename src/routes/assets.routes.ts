import { Router } from 'express'
import multer from 'multer'
import { Pool } from 'pg'
import {
  getAssetById,
  getAllAssets,
  updateAsset,
  deleteAsset,
  getAssetWithSignedUrl,
  getAssetsWithFilters,
  searchAssets,
  getAssetsWithSignedUrls,
} from '../services/asset.service'
import {
  CreateAssetRequest,
  UpdateAssetRequest,
} from '../interfaces/asset.interface'
import { asyncHandler } from '../middleware/asyncHandler'
import { createJob } from '../services/job.service'
import { getPool } from '../config/database.config'
import { formatFileSize, detectFileType } from '../utils/fileTypeUtils'
import {
  validateUploadRequest,
  validateBatchUpload,
  validateUploadOptions,
  validateUploadMetadata,
} from '../validation'
import { Upload } from '@aws-sdk/lib-storage'
import { s3 } from '../clients/s3'
import fs from 'fs'
import path from 'path'
import { createAsset } from '../services/asset.service'

const router = Router()
const pool: Pool = getPool()

// Configure multer for file uploads
// const upload = multer({
//   storage: multer.memoryStorage(), // Use memory storage for better performance
//   limits: {
//     fileSize: parseInt(process.env.MAX_FILE_SIZE || '4294967296'),
//   },
//   fileFilter: (req, file, cb) => {
//     cb(null, true)
//   },
// })

const bucket = process.env.MINIO_BUCKET || 'dam-media'

// Store uploaded files temporarily on disk
const upload = multer({ dest: '/tmp/uploads' })

// Get all assets with pagination and filters
router.get(
  '/',
  asyncHandler(async (req: any, res: any) => {
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
      includeSignedUrls = false,
      expiresIn = 3600,
    } = req.query

    // Parse array parameters
    const tagsArray = tags ? (Array.isArray(tags) ? tags : [tags]) : undefined

    // Get assets with filters
    const result = await getAssetsWithFilters({
      page: parseInt(page),
      limit: parseInt(limit),
      fileType,
      status,
      dateFrom,
      dateTo,
      tags: tagsArray,
      category,
      author,
      department,
      project,
      sortBy,
      sortOrder,
    })

    // Include signed URLs if requested
    let assets = result.assets
    if (includeSignedUrls === 'true') {
      const assetIds = assets.map((asset) => asset.id)
      assets = await getAssetsWithSignedUrls(assetIds, parseInt(expiresIn))
    }

    res.json({
      success: true,
      data: assets,
      pagination: result.pagination,
      filters: {
        fileType,
        status,
        dateFrom,
        dateTo,
        tags: tagsArray,
        category,
        author,
        department,
        project,
        sortBy,
        sortOrder,
      },
    })
  })
)

// Search assets by keyword
router.get(
  '/search',
  asyncHandler(async (req: any, res: any) => {
    const {
      q: query,
      page = 1,
      limit = 20,
      fileType,
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      includeSignedUrls = false,
      expiresIn = 3600,
    } = req.query

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query parameter "q" is required',
      })
    }

    // Search assets
    const result = await searchAssets({
      query: query.toString(),
      page: parseInt(page),
      limit: parseInt(limit),
      fileType,
      status,
      sortBy,
      sortOrder,
    })

    // Include signed URLs if requested
    let assets = result.assets
    if (includeSignedUrls === 'true') {
      const assetIds = assets.map((asset) => asset.id)
      assets = await getAssetsWithSignedUrls(assetIds, parseInt(expiresIn))
    }

    res.json({
      success: true,
      data: assets,
      pagination: result.pagination,
      search: {
        query,
        fileType,
        status,
        sortBy,
        sortOrder,
      },
    })
  })
)

// Get assets by IDs with signed URLs (batch access)
router.post(
  '/batch-access',
  asyncHandler(async (req: any, res: any) => {
    const { assetIds, expiresIn = 3600 } = req.body

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'assetIds array is required and must not be empty',
      })
    }

    if (assetIds.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 assets can be accessed at once',
      })
    }

    const assets = await getAssetsWithSignedUrls(assetIds, expiresIn)

    res.json({
      success: true,
      data: assets,
      count: assets.length,
      message: `Retrieved ${assets.length} assets with signed URLs`,
    })
  })
)

// Get asset by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const asset = await getAssetById(id)

    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    res.json({ success: true, data: asset })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get asset' })
  }
})

// Get asset by ID with signed URL for direct access
router.get('/:id/access', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const expiresIn = parseInt(req.query.expiresIn as string) || 3600 // Default 1 hour

    const asset = await getAssetWithSignedUrl(id, expiresIn)

    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    res.json({
      success: true,
      data: asset,
      message: 'Asset access URL generated successfully',
    })
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: 'Failed to get asset access URL' })
  }
})

router.post('/upload', upload.array('files'), async (req, res) => {
  const files = req.files as Express.Multer.File[]
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' })
  }

  try {
    const results = []
    const errors = []

    for (const file of files) {
      try {
        // Parse metadata from request body
        const metadata = {
          category: req.body.category || 'upload',
          description: req.body.description || 'Uploaded via API',
          tags: req.body.tags
            ? req.body.tags.split(',').map((tag: string) => tag.trim())
            : [],
          author: req.body.author || 'unknown',
          department: req.body.department || 'general',
          project: req.body.project || 'default',
        }

        // Generate unique filename and storage path
        const timestamp = Date.now()
        const extension = path.extname(file.originalname)
        const filename = `${timestamp}-${file.originalname}`
        const storagePath = `assets/${filename}`

        // Create file stream from disk file (multer writes to disk)
        const fileStream = fs.createReadStream(file.path)

        // Multipart upload using streaming (handles large files efficiently)
        const upload = new Upload({
          client: s3,
          params: {
            Bucket: bucket,
            Key: storagePath,
            Body: fileStream, // ✅ Streaming from disk for large files
            ContentType: file.mimetype,
          },
        })

        // Wait for upload to complete
        await upload.done()

        // Create asset record in database
        const assetData: CreateAssetRequest = {
          filename: file.originalname,
          original_name: file.originalname,
          file_type: detectFileType(file.mimetype),
          mime_type: file.mimetype,
          file_size: file.size,
          storage_path: storagePath,
          storage_bucket: bucket,
          metadata: {
            ...metadata,
            uploadMethod: 'streaming',
            uploadTimestamp: new Date().toISOString(),
            formattedSize: formatFileSize(file.size),
          },
        }

        // Create asset in database
        const asset = await createAsset(assetData)

        // Queue background jobs asynchronously (simplified version)
        setImmediate(async () => {
          try {
            // Always queue metadata extraction for all files
            const { metadataQueue } = await import('../config/queue.config')
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

            // Generate thumbnails for images
            if (asset.file_type === 'image') {
              const { thumbnailQueue } = await import('../config/queue.config')
              const thumbnailJob = await createJob({
                job_type: 'thumbnail',
                asset_id: asset.id!,
                status: 'pending',
                priority: 2,
                input_data: {
                  autoQueued: true,
                  reason: 'upload',
                  size: '300x300',
                },
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
            }
          } catch (error) {
            console.warn(
              `Failed to queue background jobs for asset ${asset.id} (non-critical):`,
              error
            )
          }
        })

        results.push({
          filename: file.originalname,
          assetId: asset.id,
          objectName: storagePath,
          bucket: bucket,
          message: 'File uploaded successfully with streaming',
          fileSize: file.size,
        })

        // Clean up temp file after successful upload
        fs.unlinkSync(file.path)
      } catch (fileError) {
        console.error(`Failed to process file ${file.originalname}:`, fileError)
        errors.push({
          filename: file.originalname,
          error:
            fileError instanceof Error ? fileError.message : 'Unknown error',
        })

        // Clean up temp file even if processing failed
        try {
          fs.unlinkSync(file.path)
        } catch (cleanupError) {
          console.warn(
            `Could not clean up temp file for ${file.originalname}:`,
            cleanupError
          )
        }
      }
    }

    const response: any = {
      success: true,
      message: 'Upload processing completed with streaming',
      files: results,
      totalFiles: files.length,
      successfulUploads: results.length,
      failedUploads: errors.length,
    }

    if (errors.length > 0) {
      response.errors = errors
      response.partialSuccess = true
    }

    return res.json(response)
  } catch (err) {
    console.error('Upload failed:', err)
    return res.status(500).json({
      success: false,
      error: 'Upload failed',
      details: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})
// Check for duplicate files before upload
router.post('/check-duplicates-simple', async (req, res) => {
  try {
    const { filename, fileSize, contentHash } = req.body

    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'filename is required',
      })
    }

    // Check for duplicates by filename
    const filenameQuery = `
      SELECT id, filename, original_name, file_size, created_at, metadata 
      FROM assets 
      WHERE filename = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `
    const filenameResult = await pool.query(filenameQuery, [filename])

    // Check for duplicates by content hash if provided
    let contentResult = { rows: [] }
    if (contentHash) {
      const contentQuery = `
        SELECT id, filename, original_name, file_size, created_at, metadata 
        FROM assets 
        WHERE metadata->>'contentHash' = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
      `
      contentResult = await pool.query(contentQuery, [contentHash])
    }

    // Check for duplicates by file size if provided
    let sizeResult = { rows: [] }
    if (fileSize) {
      const sizeQuery = `
        SELECT id, filename, original_name, file_size, created_at, metadata 
        FROM assets 
        WHERE file_size = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
      `
      sizeResult = await pool.query(sizeQuery, [fileSize])
    }

    // Combine and deduplicate results
    const allResults = [
      ...filenameResult.rows,
      ...contentResult.rows,
      ...sizeResult.rows,
    ]
    const uniqueResults = allResults.filter(
      (asset, index, self) => index === self.findIndex((a) => a.id === asset.id)
    )

    const duplicates = uniqueResults.map((asset) => ({
      id: asset.id,
      filename: asset.filename,
      original_name: asset.original_name,
      file_size: asset.file_size,
      created_at: asset.created_at,
      duplicateType:
        contentHash && asset.metadata?.contentHash === contentHash
          ? 'content'
          : filename === asset.filename
            ? 'filename'
            : 'size',
    }))

    res.json({
      success: true,
      hasDuplicates: duplicates.length > 0,
      duplicates: duplicates,
      count: duplicates.length,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check for duplicates',
    })
  }
})

// Update asset
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const assetData: UpdateAssetRequest = req.body
    const updatedAsset = await updateAsset(id, assetData)

    if (!updatedAsset) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    res.json({
      success: true,
      data: updatedAsset,
      message: 'Asset updated successfully',
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update asset' })
  }
})

// Delete asset
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const deleted = await deleteAsset(id)

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    res.json({
      success: true,
      message: 'Asset deleted successfully',
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete asset' })
  }
})

// Download asset
router.get('/:id/download', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const asset = await getAssetById(id)

    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    // Get the file from storage
    const { downloadFile } = await import('../services/storage')
    const fileStream = await downloadFile(asset.storage_path)

    if (!fileStream) {
      return res
        .status(404)
        .json({ success: false, error: 'File not found in storage' })
    }

    // Set appropriate headers for download
    res.setHeader('Content-Type', asset.mime_type || 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asset.original_name || asset.filename}"`
    )
    res.setHeader('Content-Length', asset.file_size)

    // Track download for analytics
    try {
      const { trackAssetDownload } = await import(
        '../services/redis-analytics.service'
      )
      await trackAssetDownload(id, 'anonymous', {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString(),
      })
    } catch (trackError) {
      // Don't fail the download if tracking fails
    }

    // Pipe the file stream to response
    fileStream.pipe(res)
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to download asset' })
  }
})

// Stream asset (for preview/playback)
router.get('/:id/stream', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const asset = await getAssetById(id)

    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    // Get the file from storage
    const { downloadFile } = await import('../services/storage')
    const fileStream = await downloadFile(asset.storage_path)

    if (!fileStream) {
      return res
        .status(404)
        .json({ success: false, error: 'File not found in storage' })
    }

    // Set appropriate headers for streaming
    res.setHeader('Content-Type', asset.mime_type || 'application/octet-stream')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Length', asset.file_size)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges')
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Range, Accept-Ranges, Content-Length'
    )

    // Handle range requests for video/audio streaming
    const range = req.headers.range
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : asset.file_size - 1
      const chunksize = end - start + 1

      // Validate range
      if (start >= asset.file_size || end >= asset.file_size) {
        res.status(416).json({
          success: false,
          error: 'Range not satisfiable',
          contentLength: asset.file_size,
        })
        return
      }

      res.status(206)
      res.setHeader('Content-Range', `bytes ${start}-${end}/${asset.file_size}`)
      res.setHeader('Content-Length', chunksize)

      // For now, just pipe the entire file for range requests
      // This can be optimized later with proper range handling
      fileStream.pipe(res)
    } else {
      // Stream the entire file
      fileStream.pipe(res)
    }

    // Track view for analytics
    try {
      const { trackAssetView } = await import(
        '../services/redis-analytics.service'
      )
      await trackAssetView(id, 'anonymous', {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString(),
        action: 'stream',
      })
    } catch (trackError) {
      // Don't fail the stream if tracking fails
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to stream asset' })
  }
})

// Test upload endpoint for debugging
router.post('/test-upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file provided' })
    }

    console.log('Test upload received:', {
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      buffer: file.buffer ? 'Buffer exists' : 'No buffer',
    })

    res.json({
      success: true,
      message: 'Test upload successful',
      file: {
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        hasBuffer: !!file.buffer,
      },
    })
  } catch (error) {
    console.error('Test upload failed:', error)
    res.status(500).json({
      success: false,
      error: 'Test upload failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router
