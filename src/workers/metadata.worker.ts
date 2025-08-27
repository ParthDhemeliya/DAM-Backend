import { Job } from 'bullmq';
import { z } from 'zod';
import { getAssetById, updateAsset } from '../services/asset.service';
import { updateJob } from '../services/job.service';
import { createTempPath, cleanupTempFile } from '../utils/tempUtils';
import { downloadFile } from '../services/storage';
import { extractMetadata } from '../services/video.service';
import { FileType } from '../interfaces/asset.interface';
import fs from 'fs';
import { metadataWorkerLogger } from '../config/logger.config';

// Zod validation schemas
export const MetadataOptionsSchema = z.object({
  extractExif: z.boolean().optional().default(true),
  extractIptc: z.boolean().optional().default(true),
  extractXmp: z.boolean().optional().default(true),
});

export const MetadataJobDataSchema = z.object({
  assetId: z.number().int().positive('Asset ID must be a positive integer'),
  jobId: z.number().int().positive('Job ID must be a positive integer'),
  options: MetadataOptionsSchema.optional(),
});

export type MetadataJobData = z.infer<typeof MetadataJobDataSchema>;

// Process metadata extraction job
export const processMetadataJob = async (job: Job<MetadataJobData>) => {
  const startTime = Date.now();

  try {
    // Validate job data using Zod
    const validatedData = MetadataJobDataSchema.parse(job.data);
    const { assetId, jobId, options } = validatedData;

    metadataWorkerLogger.info(
      `Processing metadata job ${job.id} for asset ${assetId}`
    );

    // Update job status to processing
    await updateJob(jobId, {
      status: 'processing',
      started_at: new Date(),
    });
    metadataWorkerLogger.info(`Job ${jobId} status updated to processing`);

    // Get asset details
    const asset = await getAssetById(assetId);
    if (!asset) {
      metadataWorkerLogger.error(`Asset ${assetId} not found for job ${jobId}`);
      throw new Error(`Asset ${assetId} not found`);
    }
    metadataWorkerLogger.info(`Asset ${assetId} retrieved successfully`, {
      filename: asset.filename,
      fileType: asset.file_type,
    });

    // Set default options using validated data
    const metadataOptions = {
      extractExif: options?.extractExif ?? true,
      extractIptc: options?.extractIptc ?? true,
      extractXmp: options?.extractXmp ?? true,
    };
    metadataWorkerLogger.info(`Metadata extraction options set`, {
      options: metadataOptions,
    });

    let extractedMetadata: any = {};

    // Extract metadata based on file type
    if (asset.file_type === 'video') {
      metadataWorkerLogger.info(
        `Processing video file for metadata extraction`,
        { assetId, fileType: asset.file_type }
      );
      // Extract video metadata using video service
      const fileStream = await downloadFile(asset.storage_path);

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of fileStream) {
        chunks.push(Buffer.from(chunk));
      }
      const fileBuffer = Buffer.concat(chunks);

      // Create temp file for analysis
      const tempPath = createTempPath(`metadata_${asset.id}`, 'temp');
      fs.writeFileSync(tempPath, fileBuffer);

      try {
        metadataWorkerLogger.info(
          `Extracting video metadata from temporary file`,
          { tempPath }
        );
        const videoMetadata = await extractMetadata(tempPath);
        extractedMetadata = {
          ...extractedMetadata,
          video: videoMetadata,
        };
        metadataWorkerLogger.info(`Video metadata extracted successfully`, {
          metadataKeys: Object.keys(videoMetadata),
        });
      } finally {
        metadataWorkerLogger.info(`Cleaning up temporary video file`, {
          tempPath,
        });
        cleanupTempFile(tempPath);
      }
    } else if (asset.file_type === 'image') {
      metadataWorkerLogger.info(
        `Processing image file for metadata extraction`,
        { assetId, fileType: asset.file_type }
      );
      // For images, we could use Sharp or other image processing libraries
      // For now, extract basic file information
      extractedMetadata = {
        ...extractedMetadata,
        image: {
          width: null, // Would be extracted from image
          height: null, // Would be extracted from image
          format: asset.mime_type?.split('/')[1] || 'unknown',
          colorSpace: null, // Would be extracted from image
          hasAlpha: null, // Would be extracted from image
        },
      };
      metadataWorkerLogger.info(`Basic image metadata extracted`, {
        format: asset.mime_type?.split('/')[1] || 'unknown',
      });
    } else if (asset.file_type === 'audio') {
      metadataWorkerLogger.info(
        `Processing audio file for metadata extraction`,
        { assetId, fileType: asset.file_type }
      );
      // For audio files, we could use audio metadata libraries
      extractedMetadata = {
        ...extractedMetadata,
        audio: {
          duration: null, // Would be extracted from audio
          bitrate: null, // Would be extracted from audio
          sampleRate: null, // Would be extracted from audio
          channels: null, // Would be extracted from audio
          codec: null, // Would be extracted from audio
        },
      };
      metadataWorkerLogger.info(`Basic audio metadata extracted`);
    }

    // Add basic file metadata
    const basicMetadata = {
      filename: asset.filename,
      fileSize: asset.file_size,
      mimeType: asset.mime_type,
      fileType: asset.file_type,
      createdAt: asset.created_at,
      updatedAt: asset.updated_at,
    };

    // Combine all metadata
    const completeMetadata = {
      ...asset.metadata,
      basic: basicMetadata,
      extracted: extractedMetadata,
      processing: {
        extracted_at: new Date().toISOString(),
        processing_time: Date.now() - startTime,
        options: metadataOptions,
      },
    };

    // Update asset with extracted metadata
    metadataWorkerLogger.info(`Updating asset with extracted metadata`);
    await updateAsset(assetId, {
      metadata: completeMetadata,
    });
    metadataWorkerLogger.info(`Asset metadata updated successfully`);

    // Update job status to completed
    metadataWorkerLogger.info(`Updating job status to completed`);
    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      output_data: {
        metadata: completeMetadata,
        processingTime: Date.now() - startTime,
      },
      completed_at: new Date(),
    });
    metadataWorkerLogger.info(`Job status updated to completed successfully`);

    const totalProcessingTime = Date.now() - startTime;
    metadataWorkerLogger.info(`Metadata job ${job.id} completed successfully`, {
      processingTime: totalProcessingTime,
      assetId,
      metadataKeys: Object.keys(completeMetadata),
    });
    return {
      success: true,
      assetId,
      metadata: completeMetadata,
      processingTime: totalProcessingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Handle Zod validation errors specifically
    if (error instanceof z.ZodError) {
      const validationErrors = error.issues
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');

      metadataWorkerLogger.error(`Metadata job ${job.id} validation failed`, {
        validationErrors,
        jobData: job.data,
      });

      // Try to update job status to failed with validation error
      try {
        await updateJob(job.data.jobId, {
          status: 'failed',
          error_message: `Validation failed: ${validationErrors}`,
        });
        metadataWorkerLogger.info(
          `Job status updated to failed due to validation`
        );
      } catch (updateError) {
        const updateErrorMessage =
          updateError instanceof Error ? updateError.message : 'Unknown error';
        metadataWorkerLogger.error('Failed to update job status to failed', {
          error: updateErrorMessage,
        });
      }

      return {
        success: false,
        assetId: job.data.assetId,
        error: `Validation failed: ${validationErrors}`,
        processingTime,
      };
    }

    // Handle other errors
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    metadataWorkerLogger.error(`Metadata job ${job.id} failed`, {
      error: errorMessage,
      stack: errorStack,
    });

    // Update job status to failed
    metadataWorkerLogger.info(`Updating job status to failed`);
    try {
      await updateJob(job.data.jobId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
      metadataWorkerLogger.info(`Job status updated to failed successfully`);
    } catch (updateError) {
      const updateErrorMessage =
        updateError instanceof Error ? updateError.message : 'Unknown error';
      const updateErrorStack =
        updateError instanceof Error ? updateError.stack : undefined;
      metadataWorkerLogger.error('Failed to update job status to failed', {
        error: updateErrorMessage,
        stack: updateErrorStack,
      });
    }

    return {
      success: false,
      assetId: job.data.assetId,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime,
    };
  }
};
