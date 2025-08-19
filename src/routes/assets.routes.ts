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
// Optional query parameters:
// - skipDuplicates=true: Skip duplicate files
// - replaceDuplicates=true: Replace duplicate files
router.post('/upload', upload.any(), async (req, res) => {
  const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9)

  try {
    const files = (req.files as Express.Multer.File[]) || []

    // Check for recent duplicates (within last 5 minutes)
    const recentDuplicates = []
    for (const file of files) {
      const result = await pool.query(
        "SELECT id, original_name, created_at FROM assets WHERE original_name = $1 AND created_at > NOW() - INTERVAL '5 minutes'",
        [file.originalname]
      )
      if (result.rows.length > 0) {
        recentDuplicates.push({
          filename: file.originalname,
          existingId: result.rows[0].id,
          uploadedAt: result.rows[0].created_at,
        })
      }
    }

    if (recentDuplicates.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate files detected',
        message:
          'These files were recently uploaded. Please wait before uploading again.',
        duplicates: recentDuplicates,
      })
    }

    validateUploadRequest(files)

    // Get upload options from query parameters
    const skipDuplicates = req.query.skipDuplicates === 'true'
    const replaceDuplicates = req.query.replaceDuplicates === 'true'

    // Validate upload options
    const uploadOptions = { skipDuplicates, replaceDuplicates }
    validateUploadOptions(uploadOptions)

    // Optional metadata from fields (applied to all)
    const baseMetadata = {
      category: (req.body.category as string) || 'upload',
      description: (req.body.description as string) || 'Uploaded via API',
    }

    validateUploadMetadata(baseMetadata)
    validateBatchUpload(files, uploadOptions)

    const results = []
    const skipped = []
    const replaced = []
    const uploaded = []

    for (const file of files) {
      const result = await uploadAssetFile(file, baseMetadata, {
        skipDuplicates,
        replaceDuplicates,
      })

      if (result.skipped) {
        skipped.push({ filename: file.originalname, reason: result.message })
      } else if (result.replaced) {
        replaced.push({ filename: file.originalname, message: result.message })
        results.push(result.asset)
      } else {
        uploaded.push({ filename: file.originalname, message: result.message })
        results.push(result.asset)
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
      message += `Skipped: ${skipped.length} duplicate files. `
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

// Process all operations for an asset (thumbnail + metadata + conversion)
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
