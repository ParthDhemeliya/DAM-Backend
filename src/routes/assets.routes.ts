import { Router } from 'express'
import multer from 'multer'
import { Pool } from 'pg'
import {
  createAsset,
  getAssetById,
  getAllAssets,
  updateAsset,
  deleteAsset,
  getAssetWithSignedUrl,
  uploadAssetFile,
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
import { formatFileSize } from '../utils/fileTypeUtils'
import {
  validateUploadRequest,
  validateBatchUpload,
  validateUploadOptions,
  validateUploadMetadata,
} from '../validation'

const router = Router()
const pool: Pool = getPool()

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB default
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now, you can add validation here
    cb(null, true)
  },
})

// Test streaming endpoint
router.get('/test-stream/:id', async (req, res) => {
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
      return res.status(404).json({ success: false, error: 'File not found in storage' })
    }

    // Set appropriate headers for streaming
    res.setHeader('Content-Type', asset.mime_type || 'application/octet-stream')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Length', asset.file_size)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length')

    // Stream the entire file
    fileStream.pipe(res)
  } catch (error) {
    console.error('Error testing stream:', error)
    res.status(500).json({ success: false, error: 'Failed to test stream' })
  }
})

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
    console.error('Error getting asset by ID:', error)
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
    console.error('Error getting asset with signed URL:', error)
    res
      .status(500)
      .json({ success: false, error: 'Failed to get asset access URL' })
  }
})

// Upload one or many files and create assets
// Accepts: form-data with keys 'file' (single) or 'files' (multiple), or multiple 'file' entries
// Optional body parameters for duplicate handling:
// - duplicateAction: 'skip' | 'replace' | 'error'
// - replaceAssetId: ID of asset to replace (required if duplicateAction is 'replace')
router.post('/upload', upload.any(), async (req, res) => {
  const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9)

  try {
    const files = (req.files as Express.Multer.File[]) || []

    // Parse duplicate handling options from request body
    const duplicateOptions = {
      duplicateAction: req.body.duplicateAction || 'error',
      replaceAssetId: req.body.replaceAssetId
        ? parseInt(req.body.replaceAssetId)
        : undefined,
    }

    validateUploadRequest(files)

    // Validate duplicate handling options
    if (
      duplicateOptions.duplicateAction === 'replace' &&
      !duplicateOptions.replaceAssetId
    ) {
      return res.status(400).json({
        success: false,
        error: 'replaceAssetId is required when duplicateAction is "replace"',
      })
    }

    // Optional metadata from fields (applied to all)
    const baseMetadata = {
      category: (req.body.category as string) || 'upload',
      description: (req.body.description as string) || 'Uploaded via API',
    }

    validateUploadMetadata(baseMetadata)
    validateBatchUpload(files, {
      skipDuplicates: duplicateOptions.duplicateAction === 'skip',
    })

    // Set headers for streaming response
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Transfer-Encoding', 'chunked')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    // Start response immediately
    res.write('{"success":true,"message":"Upload started","files":[')

    const results = []
    const skipped = []
    const replaced = []
    const uploaded = []
    let isFirstFile = true

    // Process files sequentially for better memory management and smoother progress
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        // Send progress update for each file
        if (!isFirstFile) {
          res.write(',')
        }
        isFirstFile = false

        // Process file
        const result = await uploadAssetFile(file, baseMetadata)

        if (result.skipped) {
          skipped.push({
            filename: file.originalname,
            reason: result.message,
          })
          res.write(
            `{"status":"skipped","filename":"${file.originalname}","reason":"${result.message}"}`
          )
        } else if (result.replaced) {
          replaced.push({
            filename: file.originalname,
            message: result.message,
          })
          results.push(result.asset)
          res.write(
            `{"status":"replaced","filename":"${file.originalname}","message":"${result.message}"}`
          )
        } else {
          uploaded.push({
            filename: file.originalname,
            message: result.message,
          })
          results.push(result.asset)
          res.write(
            `{"status":"uploaded","filename":"${file.originalname}","message":"${result.message}"}`
          )
        }

        // Flush response to show progress
        if (res.flush) {
          res.flush()
        }
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error)
        skipped.push({
          filename: file.originalname,
          reason: error instanceof Error ? error.message : 'Unknown error',
        })

        if (!isFirstFile) {
          res.write(',')
        }
        isFirstFile = false
        res.write(
          `{"status":"error","filename":"${file.originalname}","error":"${error instanceof Error ? error.message : 'Unknown error'}"}`
        )
      }
    }

    // Close the response
    let message = ''
    if (uploaded.length > 0) {
      message += `Uploaded: ${uploaded.length} new files. `
    }
    if (replaced.length > 0) {
      message += `Replaced: ${replaced.length} duplicate files. `
    }
    if (skipped.length > 0) {
      message += `Skipped: ${skipped.length} files. `
    }

    const finalResponse = `],"summary":{"uploaded":${uploaded.length},"replaced":${replaced.length},"skipped":${skipped.length},"total":${files.length}},"message":"${message.trim()}"}`

    res.write(finalResponse)
    res.end()
  } catch (error) {
    console.error(`Error uploading file(s):`, error)
    res.status(500).json({ success: false, error: 'Failed to upload file(s)' })
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
    console.error('Error checking for duplicates:', error)
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
    console.error('Error updating asset:', error)
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
    console.error('Error deleting asset:', error)
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

    console.log(`[DEBUG] Download request for asset ${id}:`, {
      id: asset.id,
      filename: asset.filename,
      storage_path: asset.storage_path,
      file_size: asset.file_size,
      mime_type: asset.mime_type
    })

    // Get the file from storage
    const { downloadFile } = await import('../services/storage')
    const fileStream = await downloadFile(asset.storage_path)

    if (!fileStream) {
      console.error(`[DEBUG] File stream is null for storage path: ${asset.storage_path}`)
      return res
        .status(404)
        .json({ success: false, error: 'File not found in storage' })
    }

    console.log(`[DEBUG] File stream created successfully for: ${asset.storage_path}`)

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
      console.warn('Failed to track download:', trackError)
      // Don't fail the download if tracking fails
    }

    // Pipe the file stream to response
    fileStream.pipe(res)
  } catch (error) {
    console.error('Error downloading asset:', error)
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

    console.log(`[DEBUG] Stream request for asset ${id}:`, {
      id: asset.id,
      filename: asset.filename,
      storage_path: asset.storage_path,
      file_size: asset.file_size,
      mime_type: asset.mime_type
    })

    // Get the file from storage
    const { downloadFile } = await import('../services/storage')
    const fileStream = await downloadFile(asset.storage_path)

    if (!fileStream) {
      console.error(`[DEBUG] File stream is null for storage path: ${asset.storage_path}`)
      return res
        .status(404)
        .json({ success: false, error: 'File not found in storage' })
    }

    console.log(`[DEBUG] File stream created successfully for: ${asset.storage_path}`)

    // Set appropriate headers for streaming
    res.setHeader('Content-Type', asset.mime_type || 'application/octet-stream')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Length', asset.file_size)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length')

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
          contentLength: asset.file_size
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
      console.warn('Failed to track stream view:', trackError)
      // Don't fail the stream if tracking fails
    }
  } catch (error) {
    console.error('Error streaming asset:', error)
    res.status(500).json({ success: false, error: 'Failed to stream asset' })
  }
})

export default router
