import express, { Request, Response } from 'express'
import { addVideoJob, getVideoJobsByAsset } from '../services/queue.service'
import videoService from '../services/video.service'
import { asyncHandler } from '../middleware/asyncHandler'

const router = express.Router()

// Helper function to validate required fields
const validateRequired = (body: any, fields: string[]): void => {
  for (const field of fields) {
    if (!body[field]) {
      throw new Error(`${field} is required`)
    }
  }
}

/**
 * Process video with specified operations
 */
router.post('/process', 
  asyncHandler(async (req: Request, res: Response) => {
    const { assetId, operation, options } = req.body

    // Validate required fields
    validateRequired(req.body, ['assetId', 'operation'])

    // Validate operation
    const validOperations = ['transcode', 'thumbnail', 'metadata', 'all']
    if (!validOperations.includes(operation)) {
      return res.status(400).json({
        success: false,
        error: `Invalid operation. Must be one of: ${validOperations.join(', ')}`
      })
    }

    // Add job to video processing queue
    const job = await addVideoJob({
      assetId,
      operation,
      options: options || {}
    })

    res.json({
      success: true,
      message: `Video processing job queued successfully`,
      jobId: job.id,
      data: {
        assetId,
        operation,
        options,
        status: 'queued'
      }
    })
  })
)

/**
 * Transcode video to different resolutions
 */
router.post('/transcode',
  asyncHandler(async (req: Request, res: Response) => {
    const { assetId, resolutions, quality, format } = req.body

    // Validate required fields
    validateRequired(req.body, ['assetId'])

    // Validate resolutions
    const validResolutions = ['1080p', '720p', '480p']
    const resolutionsToProcess = resolutions || ['1080p', '720p']
    
    for (const res of resolutionsToProcess) {
      if (!validResolutions.includes(res)) {
        return res.status(400).json({
          success: false,
          error: `Invalid resolution: ${res}. Must be one of: ${validResolutions.join(', ')}`
        })
      }
    }

    // Add transcoding job
    const job = await addVideoJob({
      assetId,
      operation: 'transcode',
      options: {
        resolution: resolutionsToProcess[0], // Will process all in worker
        quality: quality || 'medium',
        format: format || 'mp4'
      }
    })

    res.json({
      success: true,
      message: `Video transcoding job queued successfully`,
      jobId: job.id,
      data: {
        assetId,
        operation: 'transcode',
        resolutions: resolutionsToProcess,
        quality,
        format,
        status: 'queued'
      }
    })
  })
)

/**
 * Generate thumbnail from video
 */
router.post('/thumbnail',
  asyncHandler(async (req: Request, res: Response) => {
    const { assetId, time } = req.body

    // Validate required fields
    validateRequired(req.body, ['assetId'])

    // Validate time format (HH:MM:SS)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/
    if (time && !timeRegex.test(time)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid time format. Use HH:MM:SS format'
      })
    }

    // Add thumbnail generation job
    const job = await addVideoJob({
      assetId,
      operation: 'thumbnail',
      options: {
        thumbnailTime: time || '00:00:01'
      }
    })

    res.json({
      success: true,
      message: `Thumbnail generation job queued successfully`,
      jobId: job.id,
      data: {
        assetId,
        operation: 'thumbnail',
        time: time || '00:00:01',
        status: 'queued'
      }
    })
  })
)

/**
 * Extract metadata from video
 */
router.post('/metadata',
  asyncHandler(async (req: Request, res: Response) => {
    const { assetId } = req.body

    // Validate required fields
    validateRequired(req.body, ['assetId'])

    // Add metadata extraction job
    const job = await addVideoJob({
      assetId,
      operation: 'metadata'
    })

    res.json({
      success: true,
      message: `Metadata extraction job queued successfully`,
      jobId: job.id,
      data: {
        assetId,
        operation: 'metadata',
        status: 'queued'
      }
    })
  })
)

/**
 * Get supported video formats
 */
router.get('/supported-formats',
  asyncHandler(async (req: Request, res: Response) => {
    const formats = videoService.getSupportedFormats()
    const resolutions = videoService.getSupportedResolutions()

    res.json({
      success: true,
      data: {
        formats,
        resolutions,
        quality: ['high', 'medium', 'low']
      }
    })
  })
)

/**
 * Check video processing service health
 */
router.get('/health',
  asyncHandler(async (req: Request, res: Response) => {
    const ffmpegAvailable = await videoService.checkFFmpegAvailability()
    
    res.json({
      success: true,
      data: {
        service: 'video-processing',
        status: ffmpegAvailable ? 'healthy' : 'unhealthy',
        ffmpeg: ffmpegAvailable ? 'available' : 'not available',
        timestamp: new Date().toISOString()
      }
    })
  })
)

/**
 * Get video processing jobs for an asset
 */
router.get('/jobs/:assetId',
  asyncHandler(async (req: Request, res: Response) => {
    const { assetId } = req.params
    const { status, limit = 10, offset = 0 } = req.query

    const jobs = await getVideoJobsByAsset(
      parseInt(assetId),
      status as string,
      parseInt(limit as string),
      parseInt(offset as string)
    )

    res.json({
      success: true,
      data: {
        assetId: parseInt(assetId),
        jobs,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: jobs.length
        }
      }
    })
  })
)

export default router
