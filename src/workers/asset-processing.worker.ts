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
import fs from 'fs'

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Helper function to detect if file is binary
function isBinaryFile(buffer: Buffer): boolean {
  const sampleSize = Math.min(buffer.length, 512)
  const sample = buffer.slice(0, sampleSize)

  // Check for null bytes (common in binary files)
  if (sample.includes(0)) return true

  // Check for high percentage of non-printable ASCII characters
  let nonPrintableCount = 0
  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i]
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      nonPrintableCount++
    }
  }

  const nonPrintableRatio = nonPrintableCount / sample.length
  return nonPrintableRatio > 0.3
}

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

      // Update asset with processing results and thumbnail path
      await updateAsset(assetId, {
        status: 'processed',
        metadata: {
          ...asset.metadata,
          [jobType]: result,
          thumbnail_path: result.thumbnail_path,
          thumbnail_generated: true,
          thumbnail_dimensions: result.dimensions,
        },
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

    // Create thumbnail path - ensure it's in the correct bucket structure
    const thumbnailPath = `thumbnails/${asset.id}-thumb-${Date.now()}.jpg`

    // Log the thumbnail path for debugging
    console.log(`Thumbnail will be stored at: ${thumbnailPath}`)

    // Upload thumbnail to MinIO
    console.log(`Uploading thumbnail to MinIO at path: ${thumbnailPath}`)
    const uploadResult = await uploadFile(thumbnailPath, thumbnailBuffer)
    console.log(`Thumbnail uploaded successfully:`, uploadResult)

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

    if (asset.file_type === 'video') {
      try {
        console.log(`Extracting video metadata for ${asset.filename}`)

        const videoService = await import('../services/video.service')
        const defaultVideoService = videoService.default

        const ffmpegAvailable =
          await defaultVideoService.checkFFmpegAvailability()
        if (!ffmpegAvailable) {
          console.warn('FFmpeg not available for video metadata extraction')
          metadata.video_metadata = 'FFmpeg not available'
        } else {
          // Create temporary file for FFmpeg analysis
          const tempPath = `/tmp/metadata_${asset.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`
          fs.writeFileSync(tempPath, fileBuffer)

          // Use FFmpeg to extract video metadata
          const { spawn } = await import('child_process')

          const ffmpeg = spawn('ffprobe', [
            '-v',
            'quiet',
            '-print_format',
            'json',
            '-show_format',
            '-show_streams',
            tempPath,
          ])

          let stdout = ''
          let stderr = ''

          ffmpeg.stdout.on('data', (data) => {
            stdout += data.toString()
          })

          ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString()
          })

          const metadataResult = await new Promise<any>((resolve, reject) => {
            ffmpeg.on('close', (code) => {
              if (code === 0) {
                try {
                  const videoInfo = JSON.parse(stdout)
                  resolve(videoInfo)
                } catch (parseError) {
                  reject(
                    new Error(`Failed to parse FFmpeg output: ${parseError}`)
                  )
                }
              } else {
                reject(new Error(`FFprobe failed with code ${code}: ${stderr}`))
              }
            })
          })

          try {
            fs.unlinkSync(tempPath)
          } catch (cleanupError) {
            console.warn(
              `Could not clean up temp file ${tempPath}:`,
              cleanupError
            )
          }

          // Extract relevant video metadata
          const videoStream = metadataResult.streams?.find(
            (s: any) => s.codec_type === 'video'
          )
          const audioStream = metadataResult.streams?.find(
            (s: any) => s.codec_type === 'audio'
          )

          metadata.video_metadata = {
            format: metadataResult.format?.format_name || 'unknown',
            duration: metadataResult.format?.duration || 'unknown',
            bitrate: metadataResult.format?.bit_rate || 'unknown',
            video_stream: videoStream
              ? {
                  codec: videoStream.codec_name || 'unknown',
                  width: videoStream.width || 'unknown',
                  height: videoStream.height || 'unknown',
                  fps: videoStream.r_frame_rate || 'unknown',
                  bitrate: videoStream.bit_rate || 'unknown',
                }
              : null,
            audio_stream: audioStream
              ? {
                  codec: audioStream.codec_name || 'unknown',
                  sample_rate: audioStream.sample_rate || 'unknown',
                  channels: audioStream.channels || 'unknown',
                  bitrate: audioStream.bit_rate || 'unknown',
                }
              : null,
            extracted_at: new Date(),
          }

          console.log(
            `Video metadata extracted successfully for ${asset.filename}`
          )
        }
      } catch (error) {
        console.error(
          `Failed to extract video metadata for ${asset.filename}:`,
          error
        )
        metadata.video_metadata = {
          error: error instanceof Error ? error.message : 'Unknown error',
          extracted_at: new Date(),
        }
      }
    }

    // Extract audio metadata using FFmpeg (if available)
    if (asset.file_type === 'audio') {
      try {
        console.log(`Extracting audio metadata for ${asset.filename}`)

        const videoService = await import('../services/video.service')
        const defaultVideoService = videoService.default

        const ffmpegAvailable =
          await defaultVideoService.checkFFmpegAvailability()
        if (!ffmpegAvailable) {
          console.warn('FFmpeg not available for audio metadata extraction')
          metadata.audio_metadata = 'FFmpeg not available'
        } else {
          const tempPath = `/tmp/metadata_${asset.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${asset.mime_type.split('/')[1] || 'mp3'}`
          fs.writeFileSync(tempPath, fileBuffer)

          const { spawn } = await import('child_process')

          const ffmpeg = spawn('ffprobe', [
            '-v',
            'quiet',
            '-print_format',
            'json',
            '-show_format',
            '-show_streams',
            tempPath,
          ])

          let stdout = ''
          let stderr = ''

          ffmpeg.stdout.on('data', (data) => {
            stdout += data.toString()
          })

          ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString()
          })

          const metadataResult = await new Promise<any>((resolve, reject) => {
            ffmpeg.on('close', (code) => {
              if (code === 0) {
                try {
                  const audioInfo = JSON.parse(stdout)
                  resolve(audioInfo)
                } catch (parseError) {
                  reject(
                    new Error(`Failed to parse FFmpeg output: ${parseError}`)
                  )
                }
              } else {
                reject(new Error(`FFprobe failed with code ${code}: ${stderr}`))
              }
            })
          })

          // Clean up temp file
          try {
            fs.unlinkSync(tempPath)
          } catch (cleanupError) {
            console.warn(
              `Could not clean up temp file ${tempPath}:`,
              cleanupError
            )
          }

          // Extract relevant audio metadata
          const audioStream = metadataResult.streams?.find(
            (s: any) => s.codec_type === 'audio'
          )

          metadata.audio_metadata = {
            format: metadataResult.format?.format_name || 'unknown',
            duration: metadataResult.format?.duration || 'unknown',
            bitrate: metadataResult.format?.bit_rate || 'unknown',
            audio_stream: audioStream
              ? {
                  codec: audioStream.codec_name || 'unknown',
                  sample_rate: audioStream.sample_rate || 'unknown',
                  channels: audioStream.channels || 'unknown',
                  bitrate: audioStream.bit_rate || 'unknown',
                  language: audioStream.tags?.language || 'unknown',
                }
              : null,
            extracted_at: new Date(),
          }

          console.log(
            `Audio metadata extracted successfully for ${asset.filename}`
          )
        }
      } catch (error) {
        console.error(
          `Failed to extract audio metadata for ${asset.filename}:`,
          error
        )
        metadata.audio_metadata = {
          error: error instanceof Error ? error.message : 'Unknown error',
          extracted_at: new Date(),
        }
      }
    }

    // Extract document metadata using file analysis
    if (
      [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/html',
        'application/json',
        'application/xml',
      ].includes(asset.mime_type)
    ) {
      try {
        console.log(`Extracting document metadata for ${asset.filename}`)

        // Basic document metadata extraction
        metadata.document_metadata = {
          file_extension: asset.filename.split('.').pop() || 'unknown',
          mime_type: asset.mime_type,
          file_size_bytes: fileBuffer.length,
          file_size_formatted: formatFileSize(fileBuffer.length),
          encoding: 'binary',
          extracted_at: new Date(),
        }

        // Try to extract text content for text-based files
        if (
          asset.mime_type.startsWith('text/') ||
          asset.mime_type === 'application/json' ||
          asset.mime_type === 'application/xml'
        ) {
          try {
            const textContent = fileBuffer.toString('utf8')
            metadata.document_metadata.text_preview =
              textContent.substring(0, 500) +
              (textContent.length > 500 ? '...' : '')
            metadata.document_metadata.encoding = 'utf8'
            metadata.document_metadata.line_count =
              textContent.split('\n').length
            metadata.document_metadata.word_count = textContent
              .split(/\s+/)
              .filter((word) => word.length > 0).length
          } catch (textError) {
            console.warn(`Could not extract text content: ${textError}`)
          }
        }

        console.log(
          `Document metadata extracted successfully for ${asset.filename}`
        )
      } catch (error) {
        console.error(
          `Failed to extract document metadata for ${asset.filename}:`,
          error
        )
        metadata.document_metadata = {
          error: error instanceof Error ? error.message : 'Unknown error',
          extracted_at: new Date(),
        }
      }
    }

    // Extract generic file metadata for any other file types
    if (
      !metadata.image_metadata &&
      !metadata.video_metadata &&
      !metadata.audio_metadata &&
      !metadata.document_metadata
    ) {
      try {
        console.log(`Extracting generic metadata for ${asset.filename}`)

        metadata.generic_metadata = {
          file_extension: asset.filename.split('.').pop() || 'unknown',
          mime_type: asset.mime_type,
          file_size_bytes: fileBuffer.length,
          file_size_formatted: formatFileSize(fileBuffer.length),
          is_binary: isBinaryFile(fileBuffer),
          extracted_at: new Date(),
        }

        console.log(
          `Generic metadata extracted successfully for ${asset.filename}`
        )
      } catch (error) {
        console.error(
          `Failed to extract generic metadata for ${asset.filename}:`,
          error
        )
        metadata.generic_metadata = {
          error: error instanceof Error ? error.message : 'Unknown error',
          extracted_at: new Date(),
        }
      }
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

    // Handle video conversion using FFmpeg
    if (asset.file_type === 'video') {
      console.log(`Processing video transcode for ${asset.filename}`)

      try {
        // Import video service
        const videoService = await import('../services/video.service')
        const defaultVideoService = videoService.default

        // Check if FFmpeg is available
        const ffmpegAvailable =
          await defaultVideoService.checkFFmpegAvailability()
        if (!ffmpegAvailable) {
          throw new Error('FFmpeg not available for video processing')
        }

        const tempInputPath = `/tmp/input_${asset.id}_${Date.now()}.mp4`
        fs.writeFileSync(tempInputPath, fileBuffer)

        const resolutions = options?.resolutions || ['1080p', '720p']
        const transcodeResults = []

        for (const resolution of resolutions) {
          const outputFileName = `${asset.id}_${resolution}_${Date.now()}.mp4`
          const tempOutputPath = `/tmp/${outputFileName}`
          const minioOutputPath = `transcoded/${asset.id}/${outputFileName}`

          console.log(`Transcoding ${asset.filename} to ${resolution}`)

          // Transcode video
          const transcodeResult = await defaultVideoService.transcodeVideo({
            inputPath: tempInputPath,
            outputPath: tempOutputPath,
            resolution: resolution as '1080p' | '720p',
            quality: 'medium',
            format: 'mp4',
          })

          if (transcodeResult.success) {
            const transcodedBuffer = fs.readFileSync(tempOutputPath)
            await uploadFile(minioOutputPath, transcodedBuffer)

            // Clean up temp file
            fs.unlinkSync(tempOutputPath)

            transcodeResults.push({
              resolution,
              output_path: minioOutputPath,
              file_size: transcodedBuffer.length,
              processing_time: transcodeResult.processingTime,
            })

            console.log(
              `Successfully transcoded to ${resolution}: ${minioOutputPath}`
            )
          } else {
            console.error(
              `Failed to transcode to ${resolution}:`,
              transcodeResult.error
            )
          }
        }

        // Clean up input temp file
        fs.unlinkSync(tempInputPath)

        result.video_transcode = {
          success: true,
          resolutions: transcodeResults,
          total_files: transcodeResults.length,
        }
      } catch (error) {
        console.error(`Video transcode failed for ${asset.filename}:`, error)
        result.video_transcode = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
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
