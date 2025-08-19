import { Worker, Job } from 'bullmq'
import {
  thumbnailQueue,
  metadataQueue,
  conversionQueue,
  cleanupQueue,
  redis,
} from '../config/queue.config'
import { getAssetById, updateAsset } from '../services/asset.service'
import { downloadFile, uploadFile } from '../services/storage'
import { createJob, updateJob } from '../services/job.service'
import sharp from 'sharp'
import path from 'path'

// Job types
export interface AssetProcessingJobData {
  assetId: number
  jobType: 'thumbnail' | 'metadata' | 'conversion' | 'cleanup'
  priority?: number
  options?: any
  jobId: number // Database job ID
}

// Helper function to extract numeric ID from BullMQ job ID
function extractJobId(bullmqJobId: string | number): number {
  if (typeof bullmqJobId === 'number') {
    return bullmqJobId
  }

  // Handle "job_6" format -> extract 6
  if (bullmqJobId.startsWith('job_')) {
    const numericPart = bullmqJobId.replace('job_', '')
    const parsed = parseInt(numericPart)
    if (!isNaN(parsed)) {
      return parsed
    }
  }

  // Try direct parsing
  const parsed = parseInt(bullmqJobId)
  if (!isNaN(parsed)) {
    return parsed
  }

  throw new Error(`Cannot extract numeric job ID from: ${bullmqJobId}`)
}

// Create workers for each queue
export const thumbnailWorker = new Worker(
  'thumbnail-generation',
  async (job: Job<AssetProcessingJobData>) => {
    const { assetId, jobType, options, jobId } = job.data

    console.log(`Processing ${jobType} for asset ${assetId}`)

    try {
      // Use the jobId from the job data (database job ID)
      const numericJobId = jobId
      console.log(`Processing job ID: ${numericJobId} (BullMQ ID: ${job.id})`)

      // Update job status to processing
      await updateJob(numericJobId, {
        status: 'processing',
        started_at: new Date(),
      })

      // Get asset details
      const asset = await getAssetById(assetId)
      if (!asset) {
        throw new Error(`Asset ${assetId} not found`)
      }

      // Process thumbnail
      const result = await processThumbnail(asset, options)

      // Update asset with processing results
      await updateAsset(assetId, {
        status: 'processed',
        metadata: { ...asset.metadata, [jobType]: result },
      })

      // Update job status to completed
      await updateJob(numericJobId, {
        status: 'completed',
        progress: 100,
        output_data: result,
        completed_at: new Date(),
      })

      console.log(`${jobType} completed for asset ${assetId}`)
      return result
    } catch (error) {
      console.error(`${jobType} failed for asset ${assetId}:`, error)

      // Update job status to failed
      try {
        const numericJobId = jobId
        await updateJob(numericJobId, {
          status: 'failed',
          error_message:
            error instanceof Error ? error.message : 'Unknown error',
        })
      } catch (updateError) {
        console.error('Failed to update job status to failed:', updateError)
      }

      throw error
    }
  },
  {
    connection: redis,
    concurrency: 2,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  }
)

// Add debugging for worker startup
console.log(
  'Thumbnail worker created, listening to queue: thumbnail-generation'
)
console.log('Redis connection config:', {
  host: redis.options.host,
  port: redis.options.port,
})

export const metadataWorker = new Worker(
  'metadata-extraction',
  async (job: Job<AssetProcessingJobData>) => {
    const { assetId, jobType, options, jobId } = job.data

    console.log(`Processing ${jobType} for asset ${assetId}`)

    try {
      // Use the jobId from the job data (database job ID)
      const numericJobId = jobId
      console.log(`Processing job ID: ${numericJobId} (BullMQ ID: ${job.id})`)

      // Update job status to processing
      await updateJob(numericJobId, {
        status: 'processing',
        started_at: new Date(),
      })

      // Get asset details
      const asset = await getAssetById(assetId)
      if (!asset) {
        throw new Error(`Asset ${assetId} not found`)
      }

      // Process metadata
      const result = await processMetadata(asset, options)

      // Update asset with processing results
      await updateAsset(assetId, {
        status: 'processed',
        metadata: { ...asset.metadata, [jobType]: result },
      })

      // Update job status to completed
      await updateJob(numericJobId, {
        status: 'completed',
        progress: 100,
        output_data: result,
        completed_at: new Date(),
      })

      console.log(`${jobType} completed for asset ${assetId}`)
      return result
    } catch (error) {
      console.error(`${jobType} failed for asset ${assetId}:`, error)

      // Update job status to failed
      try {
        const numericJobId = jobId
        await updateJob(numericJobId, {
          status: 'failed',
          error_message:
            error instanceof Error ? error.message : 'Unknown error',
        })
      } catch (updateError) {
        console.error('Failed to update job status to failed:', updateError)
      }

      throw error
    }
  },
  {
    connection: redis,
    concurrency: 2,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  }
)

console.log('Metadata worker created, listening to queue: metadata-extraction')

// Add debugging for conversion worker
console.log('Conversion worker created, listening to queue: file-conversion')

export const conversionWorker = new Worker(
  'file-conversion',
  async (job: Job<AssetProcessingJobData>) => {
    const { assetId, jobType, options, jobId } = job.data

    console.log(`Processing ${jobType} for asset ${assetId}`)

    try {
      // Use the jobId from the job data (database job ID)
      const numericJobId = jobId
      console.log(`Processing job ID: ${numericJobId} (BullMQ ID: ${job.id})`)

      // Update job status to processing
      await updateJob(numericJobId, {
        status: 'processing',
        started_at: new Date(),
      })

      // Get asset details
      const asset = await getAssetById(assetId)
      if (!asset) {
        throw new Error(`Asset ${assetId} not found`)
      }

      // Process conversion
      const result = await processConversion(asset, options)

      // Update asset with processing results
      await updateAsset(assetId, {
        status: 'processed',
        metadata: { ...asset.metadata, [jobType]: result },
      })

      // Update job status to completed
      await updateJob(numericJobId, {
        status: 'completed',
        progress: 100,
        output_data: result,
        completed_at: new Date(),
      })

      console.log(`${jobType} completed for asset ${assetId}`)
      return result
    } catch (error) {
      console.error(`${jobType} failed for asset ${assetId}:`, error)

      // Update job status to failed
      try {
        const numericJobId = jobId
        await updateJob(numericJobId, {
          status: 'failed',
          error_message:
            error instanceof Error ? error.message : 'Unknown error',
        })
      } catch (updateError) {
        console.error('Failed to update job status to failed:', updateError)
      }

      throw error
    }
  },
  {
    connection: redis,
    concurrency: 2,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  }
)

// Thumbnail generation with Sharp
async function processThumbnail(asset: any, options: any) {
  console.log(`Generating thumbnail for ${asset.filename}`)

  try {
    // Download file from MinIO
    const fileStream = await downloadFile(asset.storage_path)

    // Convert stream to buffer
    const chunks: Buffer[] = []
    for await (const chunk of fileStream) {
      chunks.push(Buffer.from(chunk))
    }
    const fileBuffer = Buffer.concat(chunks)

    // Generate thumbnail using Sharp
    const thumbnailBuffer = await sharp(fileBuffer)
      .resize(300, 300, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 80 })
      .toBuffer()

    // Create thumbnail path
    const thumbnailPath = `thumbnails/${asset.id}-thumb-${Date.now()}.jpg`

    // Upload thumbnail to MinIO
    await uploadFile(thumbnailPath, thumbnailBuffer)

    console.log(`Thumbnail generated and uploaded: ${thumbnailPath}`)

    return {
      thumbnail_path: thumbnailPath,
      dimensions: { width: 300, height: 300 },
      generated_at: new Date(),
      file_size: thumbnailBuffer.length,
    }
  } catch (error) {
    console.error(`Failed to generate thumbnail for ${asset.filename}:`, error)
    throw new Error(`Thumbnail generation failed: ${error}`)
  }
}

// Metadata extraction
async function processMetadata(asset: any, options: any) {
  console.log(`Extracting metadata for ${asset.filename}`)

  try {
    // Download file from MinIO
    const fileStream = await downloadFile(asset.storage_path)

    // Convert stream to buffer
    const chunks: Buffer[] = []
    for await (const chunk of fileStream) {
      chunks.push(Buffer.from(chunk))
    }
    const fileBuffer = Buffer.concat(chunks)

    let metadata: any = {
      file_size: asset.file_size,
      mime_type: asset.mime_type,
      extracted_at: new Date(),
    }

    // Extract image-specific metadata using Sharp
    if (asset.file_type === 'image') {
      try {
        const imageInfo = await sharp(fileBuffer).metadata()
        metadata = {
          ...metadata,
          width: imageInfo.width,
          height: imageInfo.height,
          format: imageInfo.format,
          space: imageInfo.space,
          channels: imageInfo.channels,
          depth: imageInfo.depth,
          density: imageInfo.density,
          hasProfile: imageInfo.hasProfile,
          hasAlpha: imageInfo.hasAlpha,
        }
      } catch (sharpError) {
        console.warn(`Could not extract image metadata: ${sharpError}`)
      }
    }

    // Extract video metadata using FFmpeg (if available)
    if (asset.file_type === 'video') {
      // This would require FFmpeg integration
      // For now, return basic metadata
      metadata.video_metadata = 'FFmpeg integration needed for video metadata'
    }

    return metadata
  } catch (error) {
    console.error(`Failed to extract metadata for ${asset.filename}:`, error)
    throw new Error(`Metadata extraction failed: ${error}`)
  }
}

// File conversion
async function processConversion(asset: any, options: any) {
  console.log(`Converting file ${asset.filename}`)

  try {
    // Download file from MinIO
    const fileStream = await downloadFile(asset.storage_path)

    // Convert stream to buffer
    const chunks: Buffer[] = []
    for await (const chunk of fileStream) {
      chunks.push(Buffer.from(chunk))
    }
    const fileBuffer = Buffer.concat(chunks)

    let result: any = {
      converted_format: options?.targetFormat || 'mp4',
      conversion_time: new Date(),
    }

    // Handle image conversion using Sharp
    if (asset.file_type === 'image') {
      const targetFormat = options?.targetFormat || 'jpeg'
      const convertedBuffer = await sharp(fileBuffer)
        .toFormat(targetFormat as any)
        .toBuffer()

      const convertedPath = `converted/${asset.id}-${Date.now()}.${targetFormat}`
      await uploadFile(convertedPath, convertedBuffer)

      result = {
        ...result,
        converted_path: convertedPath,
        original_size: fileBuffer.length,
        converted_size: convertedBuffer.length,
        compression_ratio:
          (
            ((fileBuffer.length - convertedBuffer.length) / fileBuffer.length) *
            100
          ).toFixed(2) + '%',
      }
    }

    // Handle video conversion (would need FFmpeg integration)
    if (asset.file_type === 'video') {
      result.video_conversion = 'FFmpeg integration needed for video conversion'
    }

    return result
  } catch (error) {
    console.error(`Failed to convert file ${asset.filename}:`, error)
    throw new Error(`File conversion failed: ${error}`)
  }
}

// Cleanup processing
async function processCleanup(asset: any, options: any) {
  console.log(`Cleaning up ${asset.filename}`)

  try {
    // TODO: Implement cleanup logic
    // - Remove temporary files
    // - Clean up cache
    // - Archive old files

    await new Promise((resolve) => setTimeout(resolve, 1000))

    return {
      cleaned_at: new Date(),
      temp_files_removed: 0,
      cache_cleared: true,
    }
  } catch (error) {
    console.error(`Failed to cleanup ${asset.filename}:`, error)
    throw new Error(`Cleanup failed: ${error}`)
  }
}

// Handle worker events
thumbnailWorker.on('completed', (job) => {
  console.log(`Thumbnail job ${job.id} completed successfully`)
})

thumbnailWorker.on('failed', (job, err) => {
  if (job) {
    console.error(`Thumbnail job ${job.id} failed:`, err.message)
  } else {
    console.error(`Thumbnail job failed:`, err.message)
  }
})

metadataWorker.on('completed', (job) => {
  console.log(`Metadata job ${job.id} completed successfully`)
})

metadataWorker.on('failed', (job, err) => {
  if (job) {
    console.error(`Metadata job ${job.id} failed:`, err.message)
  } else {
    console.error(`Metadata job failed:`, err.message)
  }
})

conversionWorker.on('completed', (job) => {
  console.log(`Conversion job ${job.id} completed successfully`)
})

conversionWorker.on('failed', (job, err) => {
  if (job) {
    console.error(`Conversion job ${job.id} failed:`, err.message)
  } else {
    console.error(`Conversion job failed:`, err.message)
  }
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...')
  await Promise.all([
    thumbnailWorker.close(),
    metadataWorker.close(),
    conversionWorker.close(),
  ])
  process.exit(0)
})

export default { thumbnailWorker, metadataWorker, conversionWorker }
