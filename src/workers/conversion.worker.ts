import { Job } from 'bullmq';
import { getAssetById, updateAsset } from '../services/asset.service';
import { updateJob } from '../services/job.service';
import { createTempPath, cleanupTempFile } from '../utils/tempUtils';
import { downloadFile, uploadFile } from '../services/storage';
import { transcodeVideo } from '../services/video.service';
import fs from 'fs';

export interface ConversionJobData {
  assetId: number;
  jobId: number;
  options?: {
    format?: 'mp4' | 'webm' | 'mov';
    resolution?: '1080p' | '720p' | '480p';
    quality?: 'high' | 'medium' | 'low';
    codec?: string;
    bitrate?: number;
  };
}

// Process file conversion job
export const processConversionJob = async (job: Job<ConversionJobData>) => {
  const startTime = Date.now();
  const { assetId, jobId, options } = job.data;

  try {
    console.log(`Processing conversion job ${job.id} for asset ${assetId}`);

    // Update job status to processing
    await updateJob(jobId, {
      status: 'processing',
      started_at: new Date(),
    });

    // Get asset details
    const asset = await getAssetById(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    // Set default options
    const conversionOptions = {
      format: options?.format || 'mp4',
      resolution: options?.resolution || '720p',
      quality: options?.quality || 'medium',
      codec: options?.codec || 'h264',
      bitrate: options?.bitrate || 2000,
    };

    let convertedFilePath: string | null = null;

    // Handle different file types
    if (asset.file_type === 'video') {
      // Download file from storage
      const fileStream = await downloadFile(asset.storage_path);

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of fileStream) {
        chunks.push(Buffer.from(chunk));
      }
      const fileBuffer = Buffer.concat(chunks);

      // Create temp input file
      const tempInputPath = createTempPath(`input_${asset.id}`, 'temp');
      fs.writeFileSync(tempInputPath, fileBuffer);

      // Create temp output file
      const tempOutputPath = createTempPath(
        `output_${asset.id}`,
        conversionOptions.format
      );

      try {
        // Convert video using video service
        const result = await transcodeVideo({
          inputPath: tempInputPath,
          outputPath: tempOutputPath,
          resolution: conversionOptions.resolution,
          format: conversionOptions.format,
          quality: conversionOptions.quality,
        });

        if (result.success && result.outputPath) {
          // Upload converted file to storage
          const convertedFileName = `${asset.id}_converted_${Date.now()}.${conversionOptions.format}`;
          const storagePath = `converted/${asset.id}/${convertedFileName}`;

          const convertedBuffer = fs.readFileSync(result.outputPath);
          await uploadFile(storagePath, convertedBuffer);

          convertedFilePath = storagePath;
        } else {
          throw new Error(`Video conversion failed: ${result.error}`);
        }
      } finally {
        // Clean up temp files
        cleanupTempFile(tempInputPath);
        cleanupTempFile(tempOutputPath);
      }
    } else if (asset.file_type === 'image') {
      // For images, we could use Sharp for format conversion
      // For now, just copy the original file
      convertedFilePath = asset.storage_path;
    } else if (asset.file_type === 'audio') {
      // For audio files, we could use audio conversion libraries
      // For now, just copy the original file
      convertedFilePath = asset.storage_path;
    } else {
      // For other file types, no conversion needed
      convertedFilePath = asset.storage_path;
    }

    if (!convertedFilePath) {
      throw new Error('No converted file path generated');
    }

    // Update asset metadata with conversion information
    const updatedMetadata = {
      ...asset.metadata,
      custom: {
        ...asset.metadata?.custom,
        converted_path: convertedFilePath,
        conversion_format: conversionOptions.format,
        conversion_resolution: conversionOptions.resolution,
        conversion_quality: conversionOptions.quality,
        conversion_codec: conversionOptions.codec,
        conversion_completed_at: new Date().toISOString(),
        conversion_processing_time: Date.now() - startTime,
      },
    };

    await updateAsset(assetId, {
      metadata: updatedMetadata,
    });

    // Update job status to completed
    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      output_data: {
        convertedPath: convertedFilePath,
        conversionOptions,
        processingTime: Date.now() - startTime,
      },
      completed_at: new Date(),
    });

    console.log(`Conversion job ${job.id} completed successfully`);
    return {
      success: true,
      assetId,
      convertedPath: convertedFilePath,
      conversionOptions,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`Conversion job ${job.id} failed:`, error);

    // Update job status to failed
    try {
      await updateJob(jobId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (updateError) {
      console.error('Failed to update job status to failed:', updateError);
    }

    return {
      success: false,
      assetId,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
    };
  }
};
