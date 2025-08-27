import { Router } from 'express';
import { JobController } from '../controllers/job.controller';

const router = Router();
const jobController = new JobController();

// Get all jobs
router.get('/', jobController.getAllJobs);

// Get job by ID
router.get('/:id', jobController.getJobById);

// Create new job
router.post('/', jobController.createJob);

// Update job
router.put('/:id', jobController.updateJob);

// Delete job
router.delete('/:id', jobController.deleteJob);

// Get jobs by asset ID
router.get('/asset/:assetId', jobController.getJobsByAssetId);

// Get jobs by status
router.get('/status/:status', jobController.getJobsByStatus);

// Get jobs by type
router.get('/type/:jobType', jobController.getJobsByType);

// Get pending jobs
router.get('/pending', jobController.getPendingJobs);

// Get running jobs
router.get('/running', jobController.getRunningJobs);

// Get completed jobs
router.get('/completed', jobController.getCompletedJobs);

// Get failed jobs
router.get('/failed', jobController.getFailedJobs);

// Update job status
router.patch('/:id/status', jobController.updateJobStatus);

// Get job statistics
router.get('/stats', jobController.getJobStats);

// Retry failed job
router.post('/:id/retry', jobController.retryJob);

// Cancel running job
router.post('/:id/cancel', jobController.cancelJob);

// Bulk update jobs
router.patch('/bulk', jobController.bulkUpdateJobs);

// Cleanup old jobs
router.delete('/cleanup', jobController.cleanupOldJobs);

export default router;
