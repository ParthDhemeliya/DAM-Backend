import { Job } from 'bullmq'
import videoService from '../services/video.service'
import { createTempPath, cleanupTempFile } from '../utils/tempUtils'
import { getAssetById, updateAsset } from '../services/asset.service'
import { downloadFile, uploadFile } from '../services/storage'
import { updateJob } from '../services/job.service'
import fs from 'fs'

export interface VideoJobData {
  assetId: number
  operation: 'transcode' | 'thumbnail' | 'metadata' | 'all'
  jobId: number // Database job ID
  options?: {
    resolution?: '1080p' | '720p' | '480p'
    format?: 'mp4' | 'webm' | 'mov'
    quality?: 'high' | 'medium' | 'low'
    thumbnailTime?: string
  }
}

export interface VideoJobResult {
  success: boolean
  assetId: number
  operation: string
  outputFiles?: string[]
  metadata?: any
  error?: string
  processingTime?: number
}

export class VideoWorker {
  constructor() {
    // Initialize services when needed
  }

  // Process video job
  async processVideoJob(job: Job<VideoJobData>): Promise<VideoJobResult> {
    const startTime = Date.now()
    const { assetId, operation, options, jobId } = job.data

    try {
      console.log(
        `Processing video job ${job.id} for asset ${assetId}, operation: ${operation}`
      )

      // Update job status to processing
      await updateJob(jobId, {
        status: 'processing',
        started_at: new Date(),
      })

      // Get asset details
      const asset = await getAssetById(assetId)
      if (!asset) {
        throw new Error(`Asset ${assetId} not found`)
      }

      const result: VideoJobResult = {
        success: true,
        assetId,
        operation,
        outputFiles: [],
        processingTime: Date.now() - startTime,
      }

      // Process based on operation type
      switch (operation) {
        case 'transcode':
          result.outputFiles = await this.processTranscode(asset, options)
          break
        case 'thumbnail':
          result.outputFiles = await this.processThumbnail(asset, options)
          break
        case 'metadata':
          result.metadata = await this.processMetadata(asset)
          break
        case 'all':
          result.outputFiles = await this.processTranscode(asset, options)
          result.metadata = await this.processMetadata(asset)
          break
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      // Update job status to completed
      await updateJob(jobId, {
        status: 'completed',
        progress: 100,
        output_data: result,
        completed_at: new Date(),
      })

      console.log(`Video job ${job.id} completed successfully`)
      return result
    } catch (error) {
      const processingTime = Date.now() - startTime
      console.error(`Video job ${job.id} failed:`, error)

      // Update job status to failed
      try {
        await updateJob(jobId, {
          status: 'failed',
          error_message:
            error instanceof Error ? error.message : 'Unknown error',
        })
      } catch (updateError) {
        console.error('Failed to update job status to failed:', updateError)
      }

      return {
        success: false,
        assetId,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
      }
    }
  }

  // Process video transcode
  private async processTranscode(asset: any, options?: any): Promise<string[]> {
    const outputFiles: string[] = []

    try {
      // Download file from storage
      const fileStream = await downloadFile(asset.storage_path)

      // Convert stream to buffer
      const chunks: Buffer[] = []
      for await (const chunk of fileStream) {
        chunks.push(Buffer.from(chunk))
      }
      const fileBuffer = Buffer.concat(chunks)

      // Create temp input file
      const tempInputPath = createTempPath(`input_${asset.id}`, 'mp4')
      fs.writeFileSync(tempInputPath, fileBuffer)

      const resolutions = options?.resolutions || ['1080p', '720p']

      for (const resolution of resolutions) {
        const outputFileName = `${asset.id}_${resolution}_${Date.now()}.mp4`
        const tempOutputPath = createTempPath(
          `output_${asset.id}_${resolution}`,
          'mp4'
        )
        const minioOutputPath = `transcoded/${asset.id}/${outputFileName}`

        console.log(`Transcoding ${asset.filename} to ${resolution}`)

        // Transcode video using video service
        const transcodeResult = await videoService.transcodeVideo({
          inputPath: tempInputPath,
          outputPath: tempOutputPath,
          resolution: resolution as '1080p' | '720p',
          quality: options?.quality || 'medium',
          format: options?.format || 'mp4',
        })

        if (transcodeResult.success && transcodeResult.outputPath) {
          const transcodedBuffer = fs.readFileSync(tempOutputPath)
          await uploadFile(minioOutputPath, transcodedBuffer)

          // Clean up temp file
          cleanupTempFile(tempOutputPath)

          outputFiles.push(minioOutputPath)
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
      cleanupTempFile(tempInputPath)
    } catch (error) {
      console.error(`Video transcode failed for ${asset.filename}:`, error)
      throw error
    }

    return outputFiles
  }

  // Process video thumbnail
  private async processThumbnail(asset: any, options?: any): Promise<string[]> {
    try {
      // Download file from storage
      const fileStream = await downloadFile(asset.storage_path)

      // Convert stream to buffer
      const chunks: Buffer[] = []
      for await (const chunk of fileStream) {
        chunks.push(Buffer.from(chunk))
      }
      const fileBuffer = Buffer.concat(chunks)

      // Create temp input file
      const tempInputPath = createTempPath(`input_${asset.id}`, 'mp4')
      fs.writeFileSync(tempInputPath, fileBuffer)

      const thumbnailTime = options?.thumbnailTime || '00:00:01'
      const outputFileName = `${asset.id}_thumb_${Date.now()}.jpg`
      const tempOutputPath = createTempPath(`thumb_${asset.id}`, 'jpg')
      const minioOutputPath = `thumbnails/${asset.id}/${outputFileName}`

      // Generate thumbnail
      await videoService.generateThumbnail(
        tempInputPath,
        tempOutputPath,
        thumbnailTime
      )

      // Upload thumbnail to storage
      const thumbnailBuffer = fs.readFileSync(tempOutputPath)
      await uploadFile(minioOutputPath, thumbnailBuffer)

      // Clean up temp files
      cleanupTempFile(tempInputPath)
      cleanupTempFile(tempOutputPath)

      return [minioOutputPath]
    } catch (error) {
      console.error(`Thumbnail generation failed for ${asset.filename}:`, error)
      throw error
    }
  }

  // Process video metadata
  private async processMetadata(asset: any): Promise<any> {
    try {
      // Download file from storage
      const fileStream = await downloadFile(asset.storage_path)

      // Convert stream to buffer
      const chunks: Buffer[] = []
      for await (const chunk of fileStream) {
        chunks.push(Buffer.from(chunk))
      }
      const fileBuffer = Buffer.concat(chunks)

      // Create temp file for analysis
      const tempPath = createTempPath(`metadata_${asset.id}`, 'mp4')
      fs.writeFileSync(tempPath, fileBuffer)

      // Extract metadata using video service
      const metadata = await videoService.extractMetadata(tempPath)

      // Clean up temp file
      cleanupTempFile(tempPath)

      return metadata
    } catch (error) {
      console.error(`Metadata extraction failed for ${asset.filename}:`, error)
      throw error
    }
  }

  // Check if video processing is available
  async checkVideoProcessingAvailability(): Promise<boolean> {
    try {
      return await videoService.checkFFmpegAvailability()
    } catch (error) {
      console.error('Failed to check video processing availability:', error)
      return false
    }
  }
}

export default new VideoWorker()
