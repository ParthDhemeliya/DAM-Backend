import { Job } from 'bullmq';
import { getAssetById, updateAsset } from '../services/asset.service';
import { updateJob } from '../services/job.service';
import { createTempPath, cleanupTempFile } from '../utils/tempUtils';
import { downloadFile, uploadFile } from '../services/storage';
import sharp from 'sharp';
import fs from 'fs';
import { thumbnailWorkerLogger } from '../config/logger.config';

export interface ThumbnailJobData {
  assetId: number;
  jobId: number;
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  };
}

// Process thumbnail generation job
export const processThumbnailJob = async (job: Job<ThumbnailJobData>) => {
  const startTime = Date.now();
  const { assetId, jobId, options } = job.data;

  try {
    thumbnailWorkerLogger.info(
      `Processing thumbnail job ${job.id} for asset ${assetId}`
    );

    // Update job status to processing
    await updateJob(jobId, {
      status: 'processing',
      started_at: new Date(),
    });
    thumbnailWorkerLogger.info(`Job ${jobId} status updated to processing`);

    // Get asset details
    const asset = await getAssetById(assetId);
    if (!asset) {
      thumbnailWorkerLogger.error(
        `Asset ${assetId} not found for job ${jobId}`
      );
      throw new Error(`Asset ${assetId} not found`);
    }
    thumbnailWorkerLogger.info(`Asset ${assetId} retrieved successfully`, {
      filename: asset.filename,
      fileType: asset.file_type,
    });

    // Set default options
    const thumbnailOptions = {
      width: options?.width || 300,
      height: options?.height || 300,
      quality: options?.quality || 80,
      format: options?.format || 'jpeg',
    };
    thumbnailWorkerLogger.info(`Thumbnail options set`, {
      options: thumbnailOptions,
    });

    // Download file from storage
    thumbnailWorkerLogger.info(`Downloading file from storage`, {
      storagePath: asset.storage_path,
    });
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
    const outputExtension =
      thumbnailOptions.format === 'jpeg' ? 'jpg' : thumbnailOptions.format;
    const tempOutputPath = createTempPath(`thumb_${asset.id}`, outputExtension);

    // Generate thumbnail using Sharp
    thumbnailWorkerLogger.info(`Generating thumbnail using Sharp`, {
      inputPath: tempInputPath,
      outputPath: tempOutputPath,
    });
    await sharp(tempInputPath)
      .resize(thumbnailOptions.width, thumbnailOptions.height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat(thumbnailOptions.format, { quality: thumbnailOptions.quality })
      .toFile(tempOutputPath);
    thumbnailWorkerLogger.info(`Thumbnail generated successfully`);

    // Upload thumbnail to storage
    const thumbnailFileName = `${asset.id}_thumb_${Date.now()}.${outputExtension}`;
    const storagePath = `thumbnails/${asset.id}/${thumbnailFileName}`;

    thumbnailWorkerLogger.info(`Uploading thumbnail to storage`, {
      storagePath,
      fileName: thumbnailFileName,
    });
    const thumbnailBuffer = fs.readFileSync(tempOutputPath);
    await uploadFile(storagePath, thumbnailBuffer);
    thumbnailWorkerLogger.info(`Thumbnail uploaded to storage successfully`);

    // Update asset metadata with thumbnail information
    const updatedMetadata = {
      ...asset.metadata,
      custom: {
        ...asset.metadata?.custom,
        thumbnail_path: storagePath,
        thumbnail_size: `${thumbnailOptions.width}x${thumbnailOptions.height}`,
        thumbnail_format: thumbnailOptions.format,
        thumbnail_generated_at: new Date().toISOString(),
      },
    };

    thumbnailWorkerLogger.info(
      `Updating asset metadata with thumbnail information`
    );
    await updateAsset(assetId, {
      metadata: updatedMetadata,
    });
    thumbnailWorkerLogger.info(`Asset metadata updated successfully`);

    // Clean up temp files
    thumbnailWorkerLogger.info(`Cleaning up temporary files`);
    cleanupTempFile(tempInputPath);
    cleanupTempFile(tempOutputPath);
    thumbnailWorkerLogger.info(`Temporary files cleaned up successfully`);

    // Update job status to completed
    thumbnailWorkerLogger.info(`Updating job status to completed`);
    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      output_data: {
        thumbnailPath: storagePath,
        thumbnailSize: `${thumbnailOptions.width}x${thumbnailOptions.height}`,
        thumbnailFormat: thumbnailOptions.format,
        processingTime: Date.now() - startTime,
      },
      completed_at: new Date(),
    });
    thumbnailWorkerLogger.info(`Job status updated to completed successfully`);

    const totalProcessingTime = Date.now() - startTime;
    thumbnailWorkerLogger.info(
      `Thumbnail job ${job.id} completed successfully`,
      {
        processingTime: totalProcessingTime,
        assetId,
        thumbnailPath: storagePath,
      }
    );
    return {
      success: true,
      assetId,
      thumbnailPath: storagePath,
      processingTime: totalProcessingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    thumbnailWorkerLogger.error(`Thumbnail job ${job.id} failed`, {
      error: errorMessage,
      stack: errorStack,
    });

    // Update job status to failed
    thumbnailWorkerLogger.info(`Updating job status to failed`);
    try {
      await updateJob(jobId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
      thumbnailWorkerLogger.info(`Job status updated to failed successfully`);
    } catch (updateError) {
      const updateErrorMessage =
        updateError instanceof Error ? updateError.message : 'Unknown error';
      const updateErrorStack =
        updateError instanceof Error ? updateError.stack : undefined;
      thumbnailWorkerLogger.error('Failed to update job status to failed', {
        error: updateErrorMessage,
        stack: updateErrorStack,
      });
    }

    return {
      success: false,
      assetId,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
    };
  }
};
