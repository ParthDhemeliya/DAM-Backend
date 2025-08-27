import { Job } from 'bullmq';
import { getAssetById, updateAsset } from '../services/asset.service';
import { updateJob } from '../services/job.service';
import { cleanupTempFile } from '../utils/tempUtils';
import { deleteFile } from '../services/storage';

export interface CleanupJobData {
  assetId: number;
  jobId: number;
  options?: {
    cleanupTempFiles?: boolean;
    cleanupOldVersions?: boolean;
    cleanupOrphanedFiles?: boolean;
    retentionDays?: number;
  };
}

// Process cleanup job
export const processCleanupJob = async (job: Job<CleanupJobData>) => {
  const startTime = Date.now();
  const { assetId, jobId, options } = job.data;

  try {
    console.log(`Processing cleanup job ${job.id} for asset ${assetId}`);

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
    const cleanupOptions = {
      cleanupTempFiles: options?.cleanupTempFiles ?? true,
      cleanupOldVersions: options?.cleanupOldVersions ?? false,
      cleanupOrphanedFiles: options?.cleanupOrphanedFiles ?? false,
      retentionDays: options?.retentionDays ?? 30,
    };

    const cleanupResults = {
      tempFilesCleaned: 0,
      oldVersionsCleaned: 0,
      orphanedFilesCleaned: 0,
      errors: [] as string[],
    };

    // Clean up temporary files if they exist in metadata
    if (cleanupOptions.cleanupTempFiles && asset.metadata?.custom?.temp_paths) {
      const tempPaths = asset.metadata.custom.temp_paths;
      if (Array.isArray(tempPaths)) {
        for (const tempPath of tempPaths) {
          try {
            if (tempPath && typeof tempPath === 'string') {
              cleanupTempFile(tempPath);
              cleanupResults.tempFilesCleaned++;
            }
          } catch (error) {
            const errorMsg = `Failed to cleanup temp file ${tempPath}: ${error}`;
            cleanupResults.errors.push(errorMsg);
            console.error(errorMsg);
          }
        }
      }
    }

    // Clean up old versions if enabled
    if (
      cleanupOptions.cleanupOldVersions &&
      asset.metadata?.custom?.converted_path
    ) {
      try {
        // Check if converted file is older than retention period
        const convertedAt = asset.metadata.custom.conversion_completed_at;
        if (convertedAt) {
          const convertedDate = new Date(convertedAt);
          const retentionDate = new Date();
          retentionDate.setDate(
            retentionDate.getDate() - cleanupOptions.retentionDays
          );

          if (convertedDate < retentionDate) {
            // Delete old converted file
            await deleteFile(asset.metadata.custom.converted_path);
            cleanupResults.oldVersionsCleaned++;
          }
        }
      } catch (error) {
        const errorMsg = `Failed to cleanup old version: ${error}`;
        cleanupResults.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // Clean up orphaned files (files that exist in storage but not referenced)
    if (cleanupOptions.cleanupOrphanedFiles) {
      try {
        // This would typically scan storage for unreferenced files
        // For now, just log that this feature is not fully implemented
        console.log('Orphaned file cleanup not fully implemented');
      } catch (error) {
        const errorMsg = `Failed to cleanup orphaned files: ${error}`;
        cleanupResults.errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // Update asset metadata with cleanup information
    const updatedMetadata = {
      ...asset.metadata,
      custom: {
        ...asset.metadata?.custom,
        last_cleanup: {
          completed_at: new Date().toISOString(),
          processing_time: Date.now() - startTime,
          options: cleanupOptions,
          results: cleanupResults,
        },
        // Remove temp paths after cleanup
        temp_paths: cleanupOptions.cleanupTempFiles
          ? []
          : asset.metadata?.custom?.temp_paths,
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
        cleanupResults,
        processingTime: Date.now() - startTime,
      },
      completed_at: new Date(),
    });

    console.log(`Cleanup job ${job.id} completed successfully`);
    return {
      success: true,
      assetId,
      cleanupResults,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`Cleanup job ${job.id} failed:`, error);

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
