import { Worker } from 'bullmq';
import {
  processThumbnailJob,
  processMetadataJob,
  processConversionJob,
  processCleanupJob,
  videoWorker,
} from '../workers';
import {
  thumbnailQueue,
  metadataQueue,
  conversionQueue,
  cleanupQueue,
} from '../config/queue.config';
import {
  backgroundJobLogger,
  thumbnailWorkerLogger,
  metadataWorkerLogger,
  conversionWorkerLogger,
  cleanupWorkerLogger,
  videoWorkerLogger,
} from '../config/logger.config';

// Start all background workers
export const startWorkers = async (): Promise<void> => {
  try {
    backgroundJobLogger.info('Starting background workers...');

    // Start thumbnail worker
    const thumbnailWorker = new Worker('thumbnail', processThumbnailJob);
    thumbnailWorkerLogger.info('Thumbnail worker started successfully');
    backgroundJobLogger.info('✓ Thumbnail worker started');

    // Start metadata worker
    const metadataWorker = new Worker('metadata', processMetadataJob);
    metadataWorkerLogger.info('Metadata worker started successfully');
    backgroundJobLogger.info('✓ Metadata worker started');

    // Start conversion worker
    const conversionWorker = new Worker('conversion', processConversionJob);
    conversionWorkerLogger.info('Conversion worker started successfully');
    backgroundJobLogger.info('✓ Conversion worker started');

    // Start cleanup worker
    const cleanupWorker = new Worker('cleanup', processCleanupJob);
    cleanupWorkerLogger.info('Cleanup worker started successfully');
    backgroundJobLogger.info('✓ Cleanup worker started');

    // Video worker is handled separately as it has its own queue
    videoWorkerLogger.info('Video worker ready for processing');
    backgroundJobLogger.info('✓ Video worker ready');

    backgroundJobLogger.info('All background workers started successfully');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    backgroundJobLogger.error('Failed to start workers', {
      error: errorMessage,
      stack: errorStack,
    });
    throw error;
  }
};

// Stop all workers
export const stopWorkers = async (): Promise<void> => {
  try {
    backgroundJobLogger.info('Stopping background workers...');

    // Close all queues
    await Promise.all([
      thumbnailQueue.close(),
      metadataQueue.close(),
      conversionQueue.close(),
      cleanupQueue.close(),
    ]);

    backgroundJobLogger.info('All background workers stopped successfully');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    backgroundJobLogger.error('Failed to stop workers', {
      error: errorMessage,
      stack: errorStack,
    });
    throw error;
  }
};

// Get worker status
export const getWorkerStatus = async (): Promise<any> => {
  try {
    const [thumbnailStatus, metadataStatus, conversionStatus, cleanupStatus] =
      await Promise.all([
        thumbnailQueue.getJobCounts(),
        metadataQueue.getJobCounts(),
        conversionQueue.getJobCounts(),
        cleanupQueue.getJobCounts(),
      ]);

    const status = {
      thumbnail: {
        queue: 'thumbnail',
        status: 'running',
        counts: thumbnailStatus,
      },
      metadata: {
        queue: 'metadata',
        status: 'running',
        counts: metadataStatus,
      },
      conversion: {
        queue: 'conversion',
        status: 'running',
        counts: conversionStatus,
      },
      cleanup: {
        queue: 'cleanup',
        status: 'running',
        counts: cleanupStatus,
      },
      video: {
        queue: 'video',
        status: 'ready',
        counts: { pending: 0, active: 0, completed: 0, failed: 0 },
      },
      timestamp: new Date().toISOString(),
    };

    backgroundJobLogger.info('Worker status retrieved successfully', {
      status,
    });
    return status;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    backgroundJobLogger.error('Failed to get worker status', {
      error: errorMessage,
      stack: errorStack,
    });
    throw error;
  }
};

// Pause all workers
export const pauseWorkers = async (): Promise<void> => {
  try {
    backgroundJobLogger.info('Pausing all workers...');

    await Promise.all([
      thumbnailQueue.pause(),
      metadataQueue.pause(),
      conversionQueue.pause(),
      cleanupQueue.pause(),
    ]);

    backgroundJobLogger.info('All workers paused successfully');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    backgroundJobLogger.error('Failed to pause workers', {
      error: errorMessage,
      stack: errorStack,
    });
    throw error;
  }
};

// Resume all workers
export const resumeWorkers = async (): Promise<void> => {
  try {
    backgroundJobLogger.info('Resuming all workers...');

    await Promise.all([
      thumbnailQueue.resume(),
      metadataQueue.resume(),
      conversionQueue.resume(),
      cleanupQueue.resume(),
    ]);

    backgroundJobLogger.info('All workers resumed successfully');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    backgroundJobLogger.error('Failed to resume workers', {
      error: errorMessage,
      stack: errorStack,
    });
    throw error;
  }
};
