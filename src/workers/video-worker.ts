import { Job } from 'bullmq'
import { IJobData } from '../interfaces/job.interface'
import videoService from '../services/video.service'
import { StorageService } from '../services/storage'
import { AssetService } from '../services/asset.service'
import path from 'path'
import fs from 'fs'

export interface VideoJobData extends IJobData {
  assetId: number
  operation: 'transcode' | 'thumbnail' | 'metadata' | 'all'
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
  private storageService: StorageService
  private assetService: AssetService

  constructor() {
    this.storageService = new StorageService()
    this.assetService = new AssetService()
  }

  /**
   * Process video job
   */
  async processVideoJob(job: Job<VideoJobData>): Promise<VideoJobResult> {
    const startTime = Date.now()
    const { assetId, operation, options } = job.data

    try {
      console.log(`Processing video job ${job.id} for asset ${assetId}, operation: ${operation}`)

      // Get asset information
      const asset = await this.assetService.getAssetById(assetId)
      if (!asset) {
        throw new Error(`Asset ${assetId} not found`)
      }

      // Check if FFmpeg is available
      const ffmpegAvailable = await videoService.checkFFmpegAvailability()
      if (!ffmpegAvailable) {
        throw new Error('FFmpeg is not available')
      }

      // Download asset from storage
      const localPath = await this.downloadAsset(asset.storage_path, asset.filename)
      
      let result: VideoJobResult = {
        success: true,
        assetId,
        operation,
        outputFiles: [],
        processingTime: Date.now() - startTime
      }

      // Process based on operation
      switch (operation) {
        case 'transcode':
          result = await this.processTranscode(localPath, asset, options, result)
          break
        case 'thumbnail':
          result = await this.processThumbnail(localPath, asset, options, result)
          break
        case 'metadata':
          result = await this.processMetadata(localPath, asset, result)
          break
        case 'all':
          result = await this.processAll(localPath, asset, options, result)
          break
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      // Clean up local file
      this.cleanupLocalFile(localPath)

      result.processingTime = Date.now() - startTime
      return result

    } catch (error) {
      const processingTime = Date.now() - startTime
      console.error(`Video job ${job.id} failed:`, error)
      
      return {
        success: false,
        assetId,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      }
    }
  }

  /**
   * Process video transcoding
   */
  private async processTranscode(
    localPath: string,
    asset: any,
    options: any,
    result: VideoJobResult
  ): Promise<VideoJobResult> {
    const resolutions = options?.resolution ? [options.resolution] : ['1080p', '720p']
    const outputFiles: string[] = []

    for (const resolution of resolutions) {
      const outputFilename = `${path.parse(asset.filename).name}_${resolution}.mp4`
      const outputPath = path.join('/tmp', outputFilename)
      
      try {
        const transcodeResult = await videoService.transcodeVideo({
          inputPath: localPath,
          outputPath,
          resolution: resolution as '1080p' | '720p' | '480p',
          quality: options?.quality || 'medium'
        })

        if (transcodeResult.success && transcodeResult.outputPath) {
          // Upload to storage
          const storagePath = `processed/${asset.id}/${resolution}/${outputFilename}`
          await this.storageService.uploadFile(transcodeResult.outputPath, storagePath)
          
          outputFiles.push(storagePath)
          
          // Clean up local output file
          this.cleanupLocalFile(outputPath)
        }
      } catch (error) {
        console.error(`Failed to transcode to ${resolution}:`, error)
      }
    }

    result.outputFiles = outputFiles
    return result
  }

  /**
   * Process thumbnail generation
   */
  private async processThumbnail(
    localPath: string,
    asset: any,
    options: any,
    result: VideoJobResult
  ): Promise<VideoJobResult> {
    try {
      const thumbnailTime = options?.thumbnailTime || '00:00:01'
      const thumbnailFilename = `${path.parse(asset.filename).name}_thumb.jpg`
      const thumbnailPath = path.join('/tmp', thumbnailFilename)
      
      // Generate thumbnail
      await videoService.generateThumbnail(localPath, thumbnailPath, thumbnailTime)
      
      // Upload to storage
      const storagePath = `thumbnails/${asset.id}/${thumbnailFilename}`
      await this.storageService.uploadFile(thumbnailPath, storagePath)
      
      result.outputFiles = [storagePath]
      
      // Clean up local thumbnail
      this.cleanupLocalFile(thumbnailPath)
      
    } catch (error) {
      console.error('Failed to generate thumbnail:', error)
      throw error
    }

    return result
  }

  /**
   * Process metadata extraction
   */
  private async processMetadata(
    localPath: string,
    asset: any,
    result: VideoJobResult
  ): Promise<VideoJobResult> {
    try {
      const metadata = await videoService.extractMetadata(localPath)
      
      // Update asset with video metadata
      await this.assetService.updateAsset(asset.id, {
        metadata: {
          ...asset.metadata,
          video: metadata
        }
      })
      
      result.metadata = metadata
      
    } catch (error) {
      console.error('Failed to extract metadata:', error)
      throw error
    }

    return result
  }

  /**
   * Process all operations
   */
  private async processAll(
    localPath: string,
    asset: any,
    options: any,
    result: VideoJobResult
  ): Promise<VideoJobResult> {
    // Process metadata first
    result = await this.processMetadata(localPath, asset, result)
    
    // Process transcoding
    result = await this.processTranscode(localPath, asset, options, result)
    
    // Process thumbnail
    result = await this.processThumbnail(localPath, asset, options, result)
    
    return result
  }

  /**
   * Download asset from storage to local temp
   */
  private async downloadAsset(storagePath: string, filename: string): Promise<string> {
    const localPath = path.join('/tmp', filename)
    
    try {
      await this.storageService.downloadFile(storagePath, localPath)
      return localPath
    } catch (error) {
      throw new Error(`Failed to download asset: ${error}`)
    }
  }

  /**
   * Clean up local file
   */
  private cleanupLocalFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (error) {
      console.error(`Failed to cleanup local file ${filePath}:`, error)
    }
  }
}

export default new VideoWorker()
