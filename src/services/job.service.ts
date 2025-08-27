import {
  Job,
  CreateJobRequest,
  UpdateJobRequest,
} from '../interfaces/job.interface';
import { JobRepository } from '../repositories/job.repository';

const jobRepository = new JobRepository();

export const getJobById = async (id: number): Promise<Job | null> => {
  return await jobRepository.findById(id);
};

export const getAllJobs = async (): Promise<Job[]> => {
  return await jobRepository.findAll();
};

export const createJob = async (jobData: CreateJobRequest): Promise<Job> => {
  return await jobRepository.create(jobData);
};

export const updateJob = async (
  id: number,
  jobData: UpdateJobRequest
): Promise<Job | null> => {
  return await jobRepository.update(id, jobData);
};

export const deleteJob = async (id: number): Promise<boolean> => {
  return await jobRepository.delete(id);
};

export const getJobsByAssetId = async (assetId: number): Promise<Job[]> => {
  return await jobRepository.findByAssetId(assetId);
};

export const getJobsByStatus = async (status: string): Promise<Job[]> => {
  return await jobRepository.findByStatus(status);
};

export const getJobsByType = async (jobType: string): Promise<Job[]> => {
  return await jobRepository.findByType(jobType);
};

export const getPendingJobs = async (limit: number = 10): Promise<Job[]> => {
  return await jobRepository.findPendingJobs(limit);
};

export const getRunningJobs = async (): Promise<Job[]> => {
  return await jobRepository.findRunningJobs();
};

export const getCompletedJobs = async (limit: number = 50): Promise<Job[]> => {
  return await jobRepository.findCompletedJobs(limit);
};

export const getFailedJobs = async (limit: number = 50): Promise<Job[]> => {
  return await jobRepository.findFailedJobs(limit);
};

export const updateJobStatus = async (
  id: number,
  status: string,
  additionalData?: any
): Promise<Job | null> => {
  return await jobRepository.updateStatus(id, status, additionalData);
};

export const getJobStats = async (): Promise<any> => {
  return await jobRepository.getJobStats();
};

export const cleanupOldJobs = async (daysOld: number = 30): Promise<number> => {
  return await jobRepository.cleanupOldJobs(daysOld);
};

// Business logic methods
export const retryJob = async (id: number): Promise<Job | null> => {
  const job = await jobRepository.findById(id);

  if (!job) {
    return null;
  }

  if (job.status !== 'failed') {
    throw new Error('Only failed jobs can be retried');
  }

  // Create a new job with the same parameters
  const retryJobData: CreateJobRequest = {
    job_type: job.job_type,
    asset_id: job.asset_id,
    status: 'pending',
    priority: (job.priority || 5) + 1, // Increase priority for retry
    input_data: job.output_data, // Use output data as input for retry
  };

  const newJob = await jobRepository.create(retryJobData);
  return newJob;
};

export const cancelJob = async (id: number): Promise<Job | null> => {
  const job = await jobRepository.findById(id);

  if (!job) {
    return null;
  }

  if (job.status === 'completed' || job.status === 'failed') {
    throw new Error('Cannot cancel completed or failed jobs');
  }

  // Update job status to cancelled
  const updatedJob = await jobRepository.updateStatus(id, 'cancelled', {
    cancelled_at: new Date(),
    cancelled_reason: 'User cancelled',
  });

  return updatedJob;
};

export const bulkUpdateJobs = async (
  jobIds: number[],
  updates: Partial<UpdateJobRequest>
): Promise<{ success: number; failed: number }> => {
  let success = 0;
  let failed = 0;

  for (const id of jobIds) {
    try {
      await jobRepository.update(id, updates);
      success++;
    } catch (error) {
      console.error(`Failed to update job ${id}:`, error);
      failed++;
    }
  }

  return { success, failed };
};

export const validateJobData = async (
  jobData: CreateJobRequest
): Promise<{ isValid: boolean; errors: string[] }> => {
  const errors: string[] = [];

  if (!jobData.job_type) {
    errors.push('Job type is required');
  }

  if (!jobData.asset_id) {
    errors.push('Asset ID is required');
  }

  if (jobData.priority && (jobData.priority < 1 || jobData.priority > 10)) {
    errors.push('Priority must be between 1 and 10');
  }

  if (
    jobData.status &&
    !['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(
      jobData.status
    )
  ) {
    errors.push('Invalid job status');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const getJobQueuePosition = async (jobId: number): Promise<number> => {
  const job = await jobRepository.findById(jobId);
  if (!job) return -1;

  // Get all pending jobs with higher priority or same priority but earlier creation time
  const pendingJobs = await jobRepository.findPendingJobs(1000);

  const position = pendingJobs.findIndex(j => j.id === jobId);
  return position >= 0 ? position + 1 : -1;
};

export const estimateJobCompletionTime = async (
  jobId: number
): Promise<number | null> => {
  const job = await jobRepository.findById(jobId);
  if (!job || !job.created_at) return null;

  // Get average completion time for similar jobs
  const similarJobs = await jobRepository.findByType(job.job_type);
  const completedJobs = similarJobs.filter(
    j => j.status === 'completed' && j.completed_at && j.started_at
  );

  if (completedJobs.length === 0) return null;

  const avgCompletionTime =
    completedJobs.reduce((total, j) => {
      const startTime = new Date(j.started_at!).getTime();
      const endTime = new Date(j.completed_at!).getTime();
      return total + (endTime - startTime);
    }, 0) / completedJobs.length;

  return avgCompletionTime;
};
