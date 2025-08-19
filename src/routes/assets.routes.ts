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
  validateConversionOptions,
  validateThumbnailOptions,
  validateMetadataOptions,
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

// Get all assets
router.get(
  '/',
  asyncHandler(async (req: any, res: any) => {
    const assets = await getAllAssets()
    res.json({ success: true, data: assets, count: assets.length })
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

// Generate thumbnail for an asset
router.post('/:id/thumbnail', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const options = req.body || {}

    // Validate thumbnail options
    validateThumbnailOptions(options)

    // Create thumbnail generation job
    const job = await createJob({
      job_type: 'thumbnail',
      asset_id: id,
      status: 'pending',
      priority: options.priority || 1,
      input_data: options,
    })

    // Add job to thumbnail queue
    const thumbnailQueue = (await import('../config/queue.config'))
      .thumbnailQueue
    await thumbnailQueue.add(
      'generate-thumbnail',
      {
        assetId: id,
        jobType: 'thumbnail',
        options: options,
        jobId: job.id,
      },
      {
        jobId: `thumb_${job.id}`,
        priority: options.priority || 1,
      }
    )

    res.status(201).json({
      success: true,
      message: 'Thumbnail generation job queued successfully',
      jobId: job.id,
      data: {
        assetId: id,
        operation: 'thumbnail',
        status: 'queued',
      },
    })
  } catch (error) {
    console.error('Error queuing thumbnail job:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to queue thumbnail generation job',
    })
  }
})

// Check for duplicate files before upload
router.post('/check-duplicates', upload.any(), async (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[]) || []

    // Validate upload request
    validateUploadRequest(files)

    const duplicates = []
    const newFiles = []

    for (const file of files) {
      // Check if file exists by filename and size
      const existingAsset = await pool.query(
        'SELECT id, filename, file_size, created_at FROM assets WHERE filename = $1 AND file_size = $2',
        [file.originalname, file.size]
      )

      if (existingAsset.rows.length > 0) {
        duplicates.push({
          filename: file.originalname,
          existingAsset: existingAsset.rows[0],
          fileSize: formatFileSize(file.size),
        })
      } else {
        newFiles.push({
          filename: file.originalname,
          fileSize: formatFileSize(file.size),
        })
      }
    }

    res.json({
      success: true,
      summary: {
        totalFiles: files.length,
        newFiles: newFiles.length,
        duplicateFiles: duplicates.length,
      },
      newFiles,
      duplicates,
      message:
        duplicates.length > 0
          ? `Found ${duplicates.length} duplicate files. Use skipDuplicates=true to skip or replaceDuplicates=true to replace.`
          : 'All files are new and ready for upload.',
    })
  } catch (error) {
    console.error('Error checking duplicates:', error)
    res
      .status(500)
      .json({ success: false, error: 'Failed to check for duplicates' })
  }
})

// Extract metadata for an asset
router.post('/:id/metadata', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const options = req.body || {}

    // Validate metadata options
    validateMetadataOptions(options)

    // Create metadata extraction job
    const job = await createJob({
      job_type: 'metadata',
      asset_id: id,
      status: 'pending',
      priority: options.priority || 1,
      input_data: options,
    })

    // Add job to metadata queue
    const metadataQueue = (await import('../config/queue.config')).metadataQueue
    await metadataQueue.add(
      'extract-metadata',
      {
        assetId: id,
        jobType: 'metadata',
        options: options,
        jobId: job.id,
      },
      {
        jobId: `meta_${job.id}`,
        priority: options.priority || 1,
      }
    )

    res.status(201).json({
      success: true,
      message: 'Metadata extraction job queued successfully',
      jobId: job.id,
      data: {
        assetId: id,
        operation: 'metadata',
        status: 'queued',
      },
    })
  } catch (error) {
    console.error('Error queuing metadata job:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to queue metadata extraction job',
    })
  }
})

// Convert asset to different format
router.post('/:id/convert', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const options = req.body || {}

    // Validate conversion options
    validateConversionOptions(options)

    // Create conversion job
    const job = await createJob({
      job_type: 'conversion',
      asset_id: id,
      status: 'pending',
      priority: options.priority || 1,
      input_data: options,
    })

    // Add job to conversion queue
    const conversionQueue = (await import('../config/queue.config'))
      .conversionQueue
    await conversionQueue.add(
      'convert-file',
      {
        assetId: id,
        jobType: 'conversion',
        options: options,
        jobId: job.id,
      },
      {
        jobId: `conv_${job.id}`,
        priority: options.priority || 1,
      }
    )

    res.status(201).json({
      success: true,
      message: 'File conversion job queued successfully',
      jobId: job.id,
      data: {
        assetId: id,
        operation: 'conversion',
        targetFormat: options.targetFormat,
        status: 'queued',
      },
    })
  } catch (error) {
    console.error('Error queuing conversion job:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to queue file conversion job',
    })
  }
})

// Process all operations for an asset
router.post('/:id/process-all', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const options = req.body || {}

    // Create multiple jobs
    const jobs = []
    const operations = ['thumbnail', 'metadata', 'conversion']

    for (const operation of operations) {
      const job = await createJob({
        job_type: operation,
        asset_id: id,
        status: 'pending',
        priority: options.priority || 1,
        input_data: options,
      })

      jobs.push(job)

      // Add to appropriate queue
      const queueConfig = await import('../config/queue.config')
      let queue
      let jobData

      switch (operation) {
        case 'thumbnail':
          queue = queueConfig.thumbnailQueue
          jobData = {
            assetId: id,
            jobType: 'thumbnail',
            options,
            jobId: job.id,
          }
          break
        case 'metadata':
          queue = queueConfig.metadataQueue
          jobData = { assetId: id, jobType: 'metadata', options, jobId: job.id }
          break
        case 'conversion':
          queue = queueConfig.conversionQueue
          jobData = {
            assetId: id,
            jobType: 'conversion',
            options,
            jobId: job.id,
          }
          break
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      if (!queue) {
        throw new Error(`Queue not found for operation: ${operation}`)
      }

      await queue.add(`${operation}-job`, jobData, {
        jobId: `${operation}_${job.id}`,
        priority: options.priority || 1,
      })
    }

    res.status(201).json({
      success: true,
      message: 'All processing jobs queued successfully',
      jobs: jobs.map((job) => ({
        id: job.id,
        type: job.job_type,
        status: 'queued',
      })),
      data: {
        assetId: id,
        operations: operations,
        status: 'queued',
      },
    })
  } catch (error) {
    console.error('Error queuing processing jobs:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to queue processing jobs',
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
