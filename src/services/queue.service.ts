import {
  assetProcessingQueue,
  thumbnailQueue,
  metadataQueue,
  conversionQueue,
  cleanupQueue,
  QUEUE_NAMES,
} from '../config/queue.config'
import { createJob } from './job.service'

// Queue job types
export interface QueueJobData {
  assetId: number
  priority?: number
  options?: any
  delay?: number
}

// Add asset processing job
export const addAssetProcessingJob = async (
  jobType: 'thumbnail' | 'metadata' | 'conversion' | 'cleanup',
  data: QueueJobData
) => {
  try {
    console.log(`Adding ${jobType} job to queue for asset ${data.assetId}`)

    // Create job record in database
    const jobRecord = await createJob({
      job_type: jobType,
      asset_id: data.assetId,
      status: 'pending',
      priority: data.priority || 1,
    })

    // Check if job was created successfully
    if (!jobRecord.id) {
      throw new Error('Failed to create job record - no ID returned')
    }

    // Add job to appropriate queue
    let queue
    let jobData: any

    switch (jobType) {
      case 'thumbnail':
        queue = thumbnailQueue
        jobData = {
          assetId: data.assetId,
          jobType: 'thumbnail',
          priority: data.priority,
          options: data.options,
          jobId: jobRecord.id,
        }
        break

      case 'metadata':
        queue = metadataQueue
        jobData = {
          assetId: data.assetId,
          jobType: 'metadata',
          priority: data.priority,
          options: data.options,
          jobId: jobRecord.id,
        }
        break

      case 'conversion':
        queue = conversionQueue
        jobData = {
          assetId: data.assetId,
          jobType: 'conversion',
          priority: data.priority,
          options: data.options,
          jobId: jobRecord.id,
        }
        break

      case 'cleanup':
        queue = cleanupQueue
        jobData = {
          assetId: data.assetId,
          jobType: 'cleanup',
          priority: data.priority,
          options: data.options,
          jobId: jobRecord.id,
        }
        break

      default:
        throw new Error(`Unknown job type: ${jobType}`)
    }

    // Add job to queue with delay if specified
    const jobOptions: any = {
      jobId: `job_${jobRecord.id}`, // BullMQ requires string IDs
      priority: data.priority || 1,
      removeOnComplete: 100,
      removeOnFail: 50,
    }

    if (data.delay) {
      jobOptions.delay = data.delay
    }

    const job = await queue.add(jobType, jobData, jobOptions)

    console.log(` ${jobType} job added to queue with ID: ${job.id}`)

    return {
      jobId: job.id,
      dbJobId: jobRecord.id,
      status: 'queued',
      queue: jobType,
    }
  } catch (error) {
    console.error(` Failed to add ${jobType} job to queue:`, error)
    throw error
  }
}

// Add multiple processing jobs for an asset
export const addAssetProcessingJobs = async (
  assetId: number,
  jobTypes: ('thumbnail' | 'metadata' | 'conversion' | 'cleanup')[],
  options?: any
) => {
  try {
    console.log(
      `Adding multiple processing jobs for asset ${assetId}:`,
      jobTypes
    )

    const jobs = []

    for (const jobType of jobTypes) {
      const job = await addAssetProcessingJob(jobType, {
        assetId,
        options,
        priority: 1,
      })
      jobs.push(job)
    }

    console.log(`Added ${jobs.length} processing jobs for asset ${assetId}`)

    return jobs
  } catch (error) {
    console.error(`Failed to add processing jobs for asset ${assetId}:`, error)
    throw error
  }
}

// Add thumbnail generation job
export const addThumbnailJob = async (data: QueueJobData) => {
  return addAssetProcessingJob('thumbnail', data)
}

// Add metadata extraction job
export const addMetadataJob = async (data: QueueJobData) => {
  return addAssetProcessingJob('metadata', data)
}

// Add file conversion job
export const addConversionJob = async (data: QueueJobData) => {
  return addAssetProcessingJob('conversion', data)
}

// Add cleanup job
export const addCleanupJob = async (data: QueueJobData) => {
  return addAssetProcessingJob('cleanup', data)
}

// Get queue statistics
export const getQueueStats = async () => {
  try {
    const stats = {
      assetProcessing: await assetProcessingQueue.getJobCounts(),
      thumbnail: await thumbnailQueue.getJobCounts(),
      metadata: await metadataQueue.getJobCounts(),
      conversion: await conversionQueue.getJobCounts(),
      cleanup: await cleanupQueue.getJobCounts(),
    }

    return stats
  } catch (error) {
    console.error(' Failed to get queue stats:', error)
    throw error
  }
}

// Pause all queues
export const pauseAllQueues = async () => {
  try {
    await Promise.all([
      assetProcessingQueue.pause(),
      thumbnailQueue.pause(),
      metadataQueue.pause(),
      conversionQueue.pause(),
      cleanupQueue.pause(),
    ])

    console.log('  All queues paused')
  } catch (error) {
    console.error('Failed to pause queues:', error)
    throw error
  }
}

// Resume all queues
export const resumeAllQueues = async () => {
  try {
    await Promise.all([
      assetProcessingQueue.resume(),
      thumbnailQueue.resume(),
      metadataQueue.resume(),
      conversionQueue.resume(),
      cleanupQueue.resume(),
    ])

    console.log(' All queues resumed')
  } catch (error) {
    console.error(' Failed to resume queues:', error)
    throw error
  }
}

// Clear all queues (use with caution!)
export const clearAllQueues = async () => {
  try {
    await Promise.all([
      assetProcessingQueue.obliterate(),
      thumbnailQueue.obliterate(),
      metadataQueue.obliterate(),
      conversionQueue.obliterate(),
      cleanupQueue.obliterate(),
    ])

    console.log(' All queues cleared')
  } catch (error) {
    console.error('Failed to clear queues:', error)
    throw error
  }
}
