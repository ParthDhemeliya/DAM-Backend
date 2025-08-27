import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  getJobById,
  getAllJobs,
  createJob,
  updateJob,
  deleteJob,
  getJobsByAssetId,
  getJobsByStatus,
  getJobsByType,
  getPendingJobs,
  getRunningJobs,
  getCompletedJobs,
  getFailedJobs,
  retryJob,
  cancelJob,
  getJobStats,
  updateJobStatus,
  bulkUpdateJobs,
  cleanupOldJobs,
} from '../services/job.service';

export class JobController {
  // Get all jobs with pagination and filters
  getAllJobs = asyncHandler(async (req: Request, res: Response) => {
    try {
      const jobs = await getAllJobs();

      res.json({
        success: true,
        data: jobs,
        message: 'Jobs retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get job by ID
  getJobById = asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const job = await getJobById(id);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          message: `Job with ID ${id} not found`,
        });
      }

      res.json({
        success: true,
        data: job,
        message: 'Job retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve job',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Create new job
  createJob = asyncHandler(async (req: Request, res: Response) => {
    try {
      const jobData = req.body;
      const job = await createJob(jobData);

      res.status(201).json({
        success: true,
        data: job,
        message: 'Job created successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create job',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Update job
  updateJob = asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const jobData = req.body;
      const job = await updateJob(id, jobData);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          message: `Job with ID ${id} not found`,
        });
      }

      res.json({
        success: true,
        data: job,
        message: 'Job updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update job',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Delete job
  deleteJob = asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await deleteJob(id);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          message: `Job with ID ${id} not found`,
        });
      }

      res.json({
        success: true,
        message: 'Job deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete job',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get jobs by asset ID
  getJobsByAssetId = asyncHandler(async (req: Request, res: Response) => {
    try {
      const assetId = parseInt(req.params.assetId);
      const jobs = await getJobsByAssetId(assetId);

      res.json({
        success: true,
        data: jobs,
        message: 'Jobs retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get jobs by status
  getJobsByStatus = asyncHandler(async (req: Request, res: Response) => {
    try {
      const status = req.params.status;
      const jobs = await getJobsByStatus(status);

      res.json({
        success: true,
        data: jobs,
        message: 'Jobs retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get jobs by type
  getJobsByType = asyncHandler(async (req: Request, res: Response) => {
    try {
      const type = req.params.type;
      const jobs = await getJobsByType(type);

      res.json({
        success: true,
        data: jobs,
        message: 'Jobs retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get pending jobs
  getPendingJobs = asyncHandler(async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const jobs = await getPendingJobs(limit);

      res.json({
        success: true,
        data: jobs,
        message: 'Pending jobs retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve pending jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get running jobs
  getRunningJobs = asyncHandler(async (req: Request, res: Response) => {
    try {
      const jobs = await getRunningJobs();

      res.json({
        success: true,
        data: jobs,
        message: 'Running jobs retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve running jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get completed jobs
  getCompletedJobs = asyncHandler(async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const jobs = await getCompletedJobs(limit);

      res.json({
        success: true,
        data: jobs,
        message: 'Completed jobs retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve completed jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get failed jobs
  getFailedJobs = asyncHandler(async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const jobs = await getFailedJobs(limit);

      res.json({
        success: true,
        data: jobs,
        message: 'Failed jobs retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve failed jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Retry failed job
  retryJob = asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const job = await retryJob(id);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          message: `Job with ID ${id} not found`,
        });
      }

      res.json({
        success: true,
        data: job,
        message: 'Job retried successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retry job',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Cancel job
  cancelJob = asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const job = await cancelJob(id);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          message: `Job with ID ${id} not found`,
        });
      }

      res.json({
        success: true,
        data: job,
        message: 'Job cancelled successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to cancel job',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get job statistics
  getJobStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      const stats = await getJobStats();

      res.json({
        success: true,
        data: stats,
        message: 'Job statistics retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve job statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Update job status
  updateJobStatus = asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const job = await updateJobStatus(id, status);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          message: `Job with ID ${id} not found`,
        });
      }

      res.json({
        success: true,
        data: job,
        message: 'Job status updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update job status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Bulk update jobs
  bulkUpdateJobs = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { jobIds, updates } = req.body;
      const result = await bulkUpdateJobs(jobIds, updates);

      res.json({
        success: true,
        data: result,
        message: 'Jobs updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Cleanup old jobs
  cleanupOldJobs = asyncHandler(async (req: Request, res: Response) => {
    try {
      const daysOld = parseInt(req.query.daysOld as string) || 30;
      const deletedCount = await cleanupOldJobs(daysOld);

      res.json({
        success: true,
        data: { deletedCount },
        message: `${deletedCount} old jobs cleaned up successfully`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup old jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
