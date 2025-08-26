import { Router } from 'express'
import multer from 'multer'
import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
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
// Upload validation moved to dedicated upload routes

const router = Router()
const pool: Pool = getPool()

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

    const tagsArray = tags ? (Array.isArray(tags) ? tags : [tags]) : undefined

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

    const result = await searchAssets({
      query: query.toString(),
      page: parseInt(page),
      limit: parseInt(limit),
      fileType,
      status,
      sortBy,
      sortOrder,
    })

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

// Use centralized Multer configuration from upload middleware
import { uploadAny, handleUploadErrors } from '../middleware/upload.middleware'

// Main upload route using Multer with better error handling
router.post(
  '/upload',
  uploadAny,
  handleUploadErrors,
  async (req: any, res: any, next: any) => {
    // Set response timeout to 1 hour for large files
    res.setTimeout(3600000, () => {
      console.error('Upload response timeout after 1 hour')
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Upload timeout - file too large or connection too slow',
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
          help: 'Try uploading smaller files or check your internet connection',
        })
      }
    })

    // Set request timeout to 1 hour
    req.setTimeout(3600000, () => {
      console.error('Upload request timeout after 1 hour')
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Request timeout - connection too slow',
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
          help: 'Check your internet connection and try again',
        })
      }
    })

    // Disable response timeout for streaming
    res.set('Connection', 'keep-alive')
    res.set('Keep-Alive', 'timeout=3600')

    // Check if this is a multipart request
    const contentType = req.headers['content-type'] || ''
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({
        success: false,
        error: 'Content-Type must be multipart/form-data',
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        help: 'Make sure to use form-data in Postman and remove any Content-Type header',
      })
    }

    // Check if boundary is present
    if (!contentType.includes('boundary=')) {
      return res.status(400).json({
        success: false,
        error: 'Multipart boundary is missing',
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        help: 'In Postman: 1) Use form-data body type, 2) Remove Content-Type header, 3) Let Postman set headers automatically',
      })
    }

    console.log('Starting large file upload with extended timeouts...')

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files provided for upload',
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        help: 'Make sure to include files in your form-data request',
      })
    }

    // Set up upload timeout
    const uploadTimeout = setTimeout(() => {
      console.error('Upload processing timeout after 5 minutes')
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error:
            'Upload processing timeout - file too large or processing too slow',
          timestamp: new Date().toISOString(),
          requestId: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          help: 'Try uploading a smaller file or contact support if the issue persists',
        })
      }
    }, 300000) // 5 minutes timeout

    try {
      const requestId =
        Date.now() + '-' + Math.random().toString(36).substr(2, 9)

      console.log('UPLOAD ROUTE - Starting Multer upload:', {
        requestId,
        timestamp: new Date().toISOString(),
        files: req.files?.length || 0,
        contentType: req.headers['content-type'],
      })

      if (!req.files || req.files.length === 0) {
        clearTimeout(uploadTimeout)
        return res.status(400).json({
          success: false,
          error: 'No files were uploaded',
          timestamp: new Date().toISOString(),
          requestId,
        })
      }

      const uploadedFiles: any[] = []
      const errors: any[] = []

      // Process each uploaded file
      const files = Array.isArray(req.files)
        ? req.files
        : Object.values(req.files || {})
      for (const file of files) {
        try {
          // Type guard to ensure file is a single file, not an array
          if (Array.isArray(file)) {
            console.log('Skipping array file, expected single file')
            continue
          }

          console.log(
            `Processing file: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB)`
          )

          // Calculate SHA256 hash
          const fileBuffer = fs.readFileSync(file.path)
          const sha256 = crypto
            .createHash('sha256')
            .update(fileBuffer)
            .digest('hex')

          // Create file object for processing
          const fileObj = {
            fieldname: file.fieldname,
            originalname: file.originalname,
            encoding: file.encoding,
            mimetype: file.mimetype,
            size: file.size,
            path: file.path,
            sha256,
            timestamp: Date.now(),
          }

          // Process the uploaded file
          console.log('Processing uploaded file...')
          const startTime = Date.now()

          const result = await uploadAssetFile(fileObj, {
            category: 'upload',
            description: 'Uploaded via API',
          })

          const processingTime = Date.now() - startTime
          console.log(`File processing completed in ${processingTime}ms`)

          if (result.success) {
            uploadedFiles.push({
              filename: fileObj.originalname,
              assetId: result.assetId,
              message: result.message,
              size: fileObj.size,
              sha256: fileObj.sha256,
            })
            console.log(`File ${fileObj.originalname} processed successfully`)
          } else {
            errors.push({
              filename: fileObj.originalname,
              error: result.message,
            })
            console.log(
              `File ${fileObj.originalname} processing failed: ${result.message}`
            )
          }
        } catch (error) {
          console.error('File processing error:', error)
          // Type guard to ensure file is a single file, not an array
          if (!Array.isArray(file)) {
            errors.push({
              filename: file.originalname,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }
      }

      // Clear timeout since we're about to send response
      clearTimeout(uploadTimeout)

      // Send response
      const response = {
        success: true,
        message: 'Upload completed',
        requestId,
        summary: {
          uploaded: uploadedFiles.length,
          errors: errors.length,
          total: req.files.length,
        },
        uploaded: uploadedFiles,
        errors: errors,
        processingTime: Date.now() - parseInt(requestId.split('-')[0]),
      }

      console.log('Upload completed successfully:', response.summary)
      res.json(response)
    } catch (error) {
      // Clear timeout on error
      clearTimeout(uploadTimeout)

      console.error('Upload processing error:', error)
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Upload processing failed',
        timestamp: new Date().toISOString(),
        requestId: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      })
    }
  }
) // Close the upload route

// Debug route to check Multer configuration
router.get('/debug-config', (req: any, res: any) => {
  res.json({
    success: true,
    message: 'Multer upload configuration debug info',
    config: {
      name: 'Multer Upload - Simple and Reliable',
      limits: 'Unlimited file sizes with optimized limits',
      storage: 'Disk storage, then to S3',
      notes: [
        'Multer properly configured for unlimited file uploads',
        'Files are stored to disk first, then processed to S3',
        'SHA256 checksums are calculated during processing',
        'Simple and reliable file handling',
        'Support for up to 100 files per request',
        'No file size limits - truly unlimited uploads',
        'Accepts all file types',
        'Clean error handling and logging',
      ],
      multerConfig: {
        fileSize: 'Infinity (no file size limit)',
        files: '100 (max files per request)',
        fieldSize: 'Infinity (no field size limit)',
        fields: 'Infinity (no field count limit)',
        storage: 'Disk storage with timestamped filenames',
      },
      timestamp: new Date().toISOString(),
    },
  })
})

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
    const expiresIn = parseInt(req.query.expiresIn as string) || 3600

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

    const { downloadFile } = await import('../services/storage')
    const fileStream = await downloadFile(asset.storage_path)

    if (!fileStream) {
      return res
        .status(404)
        .json({ success: false, error: 'File not found in storage' })
    }

    res.setHeader('Content-Type', asset.mime_type || 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asset.original_name || asset.filename}"`
    )
    res.setHeader('Content-Length', asset.file_size)

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

    const { downloadFile } = await import('../services/storage')
    const fileStream = await downloadFile(asset.storage_path)

    if (!fileStream) {
      return res
        .status(404)
        .json({ success: false, error: 'File not found in storage' })
    }

    res.setHeader('Content-Type', asset.mime_type || 'application/octet-stream')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Length', asset.file_size)
    res.setHeader('Cache-Control', 'public, max-age=3600')

    fileStream.pipe(res)
  } catch (error) {
    console.error('Error streaming asset:', error)
    res.status(500).json({ success: false, error: 'Failed to stream asset' })
  }
})

export default router
