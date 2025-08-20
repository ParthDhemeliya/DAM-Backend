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

    // Rename functionality removed - only skip and replace are supported

    // Optional metadata from fields (applied to all)
    const baseMetadata = {
      category: (req.body.category as string) || 'upload',
      description: (req.body.description as string) || 'Uploaded via API',
    }

    validateUploadMetadata(baseMetadata)
    validateBatchUpload(files, {
      skipDuplicates: duplicateOptions.duplicateAction === 'skip',
    })

    const results = []
    const skipped = []
    const replaced = []
    const uploaded = []

    for (const file of files) {
      try {
        // Check for duplicates first
        const { checkForDuplicates } = await import(
          '../services/duplicate.service'
        )
        const duplicateResult = await checkForDuplicates(
          file.originalname || 'unknown',
          file.buffer,
          file.originalname
        )

        if (duplicateResult.isDuplicate) {
          // Handle duplicate based on user preference
          if (duplicateOptions.duplicateAction === 'skip') {
            skipped.push({
              filename: file.originalname,
              reason: `Skipped duplicate: ${duplicateResult.duplicateType}`,
            })
          } else if (duplicateOptions.duplicateAction === 'rename') {
            // Rename functionality removed - only skip and replace are supported
            skipped.push({
              filename: file.originalname,
              reason:
                'Rename functionality is not supported. Use "skip" or "replace" instead.',
            })
          } else if (
            duplicateOptions.duplicateAction === 'replace' &&
            duplicateOptions.replaceAssetId
          ) {
            // For replace, we need to delete the old asset first, then upload new one
            const assetToReplace = duplicateResult.existingAssets.find(
              (asset) => asset.id === duplicateOptions.replaceAssetId
            )

            if (assetToReplace) {
              // Delete old asset
              const { deleteAsset } = await import('../services/asset.service')
              await deleteAsset(assetToReplace.id)

              // Upload new asset
              const result = await uploadAssetFile(file, {
                ...baseMetadata,
                replacedFrom: assetToReplace.filename,
                replacedAt: new Date().toISOString(),
              })

              replaced.push({
                filename: file.originalname,
                message: `Replaced asset ID: ${assetToReplace.id}`,
              })
              results.push(result.asset)
            } else {
              skipped.push({
                filename: file.originalname,
                reason: 'Asset to replace not found',
              })
            }
          } else {
            // Default to error - skip the file
            skipped.push({
              filename: file.originalname,
              reason: `Duplicate detected: ${duplicateResult.duplicateType}. Use duplicateAction to specify how to handle.`,
            })
          }
        } else {
          // No duplicate, proceed with normal upload
          const result = await uploadAssetFile(file, baseMetadata)
          uploaded.push({
            filename: file.originalname,
            message: result.message,
          })
          results.push(result.asset)
        }
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error)
        skipped.push({
          filename: file.originalname,
          reason: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

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

    if (results.length === 1) {
      return res.status(201).json({
        success: true,
        data: results[0],
        message: message.trim(),
        summary: {
          uploaded: uploaded.length,
          replaced: replaced.length,
          skipped: skipped.length,
        },
      })
    }

    return res.status(201).json({
      success: true,
      count: results.length,
      data: results,
      message: message.trim(),
      summary: {
        uploaded: uploaded.length,
        replaced: replaced.length,
        skipped: skipped.length,
      },
    })
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

export default router
