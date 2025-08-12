import { Router } from 'express';
import { JobService } from '../services/job.service';
import { CreateJobRequest, UpdateJobRequest } from '../interfaces/job.interface';

const router = Router();
const jobService = new JobService();

// GET /api/jobs - Get all jobs
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    const jobs = await jobService.getAllJobs(
      parseInt(limit as string),
      parseInt(offset as string),
      status as string
    );
    
    res.json({
      success: true,
      data: jobs,
      count: jobs.length
    });
  } catch (error) {
    console.error('Error getting jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get jobs'
    });
  }
});

// GET /api/jobs/:id - Get job by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const job = await jobService.getJobById(id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Error getting job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get job'
    });
  }
});

// POST /api/jobs - Create new job
router.post('/', async (req, res) => {
  try {
    const jobData: CreateJobRequest = req.body;
    
    // Basic validation
    if (!jobData.job_type || !jobData.asset_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: job_type, asset_id'
      });
    }
    
    const job = await jobService.createJob(jobData);
    
    res.status(201).json({
      success: true,
      data: job,
      message: 'Job created successfully'
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create job'
    });
  }
});

// PUT /api/jobs/:id - Update job
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData: UpdateJobRequest = req.body;
    
    const job = await jobService.updateJob(id, updateData);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    res.json({
      success: true,
      data: job,
      message: 'Job updated successfully'
    });
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update job'
    });
  }
});

// GET /api/jobs/asset/:assetId - Get jobs by asset ID
router.get('/asset/:assetId', async (req, res) => {
  try {
    const assetId = parseInt(req.params.assetId);
    const jobs = await jobService.getJobsByAssetId(assetId);
    
    res.json({
      success: true,
      data: jobs,
      count: jobs.length
    });
  } catch (error) {
    console.error('Error getting jobs by asset ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get jobs by asset ID'
    });
  }
});

// GET /api/jobs/type/:jobType - Get jobs by type
router.get('/type/:jobType', async (req, res) => {
  try {
    const jobType = req.params.jobType;
    const jobs = await jobService.getJobsByType(jobType);
    
    res.json({
      success: true,
      data: jobs,
      count: jobs.length
    });
  } catch (error) {
    console.error('Error getting jobs by type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get jobs by type'
    });
  }
});

// GET /api/jobs/pending - Get pending jobs
router.get('/pending', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const jobs = await jobService.getPendingJobs(parseInt(limit as string));
    
    res.json({
      success: true,
      data: jobs,
      count: jobs.length
    });
  } catch (error) {
    console.error('Error getting pending jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending jobs'
    });
  }
});

// POST /api/jobs/:id/start - Start a job
router.post('/:id/start', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const job = await jobService.startJob(id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    res.json({
      success: true,
      data: job,
      message: 'Job started successfully'
    });
  } catch (error) {
    console.error('Error starting job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start job'
    });
  }
});

// POST /api/jobs/:id/complete - Complete a job
router.post('/:id/complete', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { output_data } = req.body;
    
    const job = await jobService.completeJob(id, output_data);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    res.json({
      success: true,
      data: job,
      message: 'Job completed successfully'
    });
  } catch (error) {
    console.error('Error completing job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete job'
    });
  }
});

// POST /api/jobs/:id/fail - Fail a job
router.post('/:id/fail', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { error_message } = req.body;
    
    if (!error_message) {
      return res.status(400).json({
        success: false,
        error: 'Error message is required'
      });
    }
    
    const job = await jobService.failJob(id, error_message);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    res.json({
      success: true,
      data: job,
      message: 'Job marked as failed'
    });
  } catch (error) {
    console.error('Error failing job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark job as failed'
    });
  }
});

// GET /api/jobs/stats - Get job statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await jobService.getJobStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting job stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get job statistics'
    });
  }
});

export default router;
