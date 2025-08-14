import { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/asyncHandler'
import {
  addAssetProcessingJob,
  addAssetProcessingJobs,
  addThumbnailJob,
  addMetadataJob,
  addConversionJob,
  addCleanupJob,
  getQueueStats,
  pauseAllQueues,
  resumeAllQueues,
  clearAllQueues,
} from '../services/queue.service'

const router = Router()

// Get queue statistics
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await getQueueStats()
    res.json({
      success: true,
      data: stats,
      message: 'Queue statistics retrieved successfully',
    })
  })
)

// Add single processing job
router.post(
  '/jobs',
  asyncHandler(async (req: Request, res: Response) => {
    const { jobType, assetId, priority, options, delay } = req.body

    if (!jobType || !assetId) {
      return res.status(400).json({
        success: false,
        error: 'jobType and assetId are required',
      })
    }

    const validJobTypes = ['thumbnail', 'metadata', 'conversion', 'cleanup']
    if (!validJobTypes.includes(jobType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid job type. Must be one of: ${validJobTypes.join(', ')}`,
      })
    }

    const job = await addAssetProcessingJob(jobType, {
      assetId,
      priority,
      options,
      delay,
    })

    res.status(201).json({
      success: true,
      data: job,
      message: `${jobType} job added to queue successfully`,
    })
  })
)

// Add multiple processing jobs for an asset
router.post(
  '/jobs/batch',
  asyncHandler(async (req: Request, res: Response) => {
    const { assetId, jobTypes, options } = req.body

    if (!assetId || !jobTypes || !Array.isArray(jobTypes)) {
      return res.status(400).json({
        success: false,
        error: 'assetId and jobTypes array are required',
      })
    }

    const validJobTypes = ['thumbnail', 'metadata', 'conversion', 'cleanup']
    const invalidTypes = jobTypes.filter(type => !validJobTypes.includes(type))
    
    if (invalidTypes.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid job types: ${invalidTypes.join(', ')}. Must be one of: ${validJobTypes.join(', ')}`,
      })
    }

    const jobs = await addAssetProcessingJobs(assetId, jobTypes, options)

    res.status(201).json({
      success: true,
      data: jobs,
      message: `${jobs.length} jobs added to queue successfully`,
    })
  })
)

// Add thumbnail generation job
router.post(
  '/jobs/thumbnail',
  asyncHandler(async (req: Request, res: Response) => {
    const { assetId, priority, options, delay } = req.body

    if (!assetId) {
      return res.status(400).json({
        success: false,
        error: 'assetId is required',
      })
    }

    const job = await addThumbnailJob({
      assetId,
      priority,
      options,
      delay,
    })

    res.status(201).json({
      success: true,
      data: job,
      message: 'Thumbnail generation job added to queue successfully',
    })
  })
)

// Add metadata extraction job
router.post(
  '/jobs/metadata',
  asyncHandler(async (req: Request, res: Response) => {
    const { assetId, priority, options, delay } = req.body

    if (!assetId) {
      return res.status(400).json({
        success: false,
        error: 'assetId is required',
      })
    }

    const job = await addMetadataJob({
      assetId,
      priority,
      options,
      delay,
    })

    res.status(201).json({
      success: true,
      data: job,
      message: 'Metadata extraction job added to queue successfully',
    })
  })
)

// Add file conversion job
router.post(
  '/jobs/conversion',
  asyncHandler(async (req: Request, res: Response) => {
    const { assetId, priority, options, delay } = req.body

    if (!assetId) {
      return res.status(400).json({
        success: false,
        error: 'assetId is required',
      })
    }

    const job = await addConversionJob({
      assetId,
      priority,
      options,
      delay,
    })

    res.status(201).json({
      success: true,
      data: job,
      message: 'File conversion job added to queue successfully',
    })
  })
)

// Add cleanup job
router.post(
  '/jobs/cleanup',
  asyncHandler(async (req: Request, res: Response) => {
    const { assetId, priority, options, delay } = req.body

    if (!assetId) {
      return res.status(400).json({
        success: false,
        error: 'assetId is required',
      })
    }

    const job = await addCleanupJob({
      assetId,
      priority,
      options,
      delay,
    })

    res.status(201).json({
      success: true,
      data: job,
      message: 'Cleanup job added to queue successfully',
    })
  })
)

// Pause all queues
router.post(
  '/pause',
  asyncHandler(async (req: Request, res: Response) => {
    await pauseAllQueues()
    res.json({
      success: true,
      message: 'All queues paused successfully',
    })
  })
)

// Resume all queues
router.post(
  '/resume',
  asyncHandler(async (req: Request, res: Response) => {
    await resumeAllQueues()
    res.json({
      success: true,
      message: 'All queues resumed successfully',
    })
  })
)

// Clear all queues (use with caution!)
router.delete(
  '/clear',
  asyncHandler(async (req: Request, res: Response) => {
    const { confirm } = req.query
    
    if (confirm !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Add ?confirm=true to confirm clearing all queues',
      })
    }

    await clearAllQueues()
    res.json({
      success: true,
      message: 'All queues cleared successfully',
    })
  })
)

export default router
