import { Router } from 'express'
import {
  createJob,
  getJobById,
  getAllJobs,
  updateJob,
  deleteJob,
  getJobsByAssetId,
} from '../services/job.service'
import { CreateJobRequest, UpdateJobRequest } from '../interfaces/job.interface'

const router = Router()

// Get all jobs
router.get('/', async (req, res) => {
  try {
    const jobs = await getAllJobs()
    res.json({ success: true, data: jobs, count: jobs.length })
  } catch (error) {
    console.error('Error getting all jobs:', error)
    res.status(500).json({ success: false, error: 'Failed to get jobs' })
  }
})

// Get job by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const job = await getJobById(id)

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' })
    }

    res.json({ success: true, data: job })
  } catch (error) {
    console.error('Error getting job by ID:', error)
    res.status(500).json({ success: false, error: 'Failed to get job' })
  }
})

// Get jobs by asset ID
router.get('/asset/:assetId', async (req, res) => {
  try {
    const assetId = parseInt(req.params.assetId)
    const jobs = await getJobsByAssetId(assetId)
    res.json({ success: true, data: jobs, count: jobs.length })
  } catch (error) {
    console.error('Error getting jobs by asset ID:', error)
    res
      .status(500)
      .json({ success: false, error: 'Failed to get jobs by asset' })
  }
})

//  Create new job
router.post('/', async (req, res) => {
  try {
    const jobData: CreateJobRequest = req.body
    console.log('Creating job with data:', jobData)
    const job = await createJob(jobData)
    res
      .status(201)
      .json({ success: true, data: job, message: 'Job created successfully' })
  } catch (error) {
    console.error('Error creating job:', error)
    // Return the actual error message for debugging
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    res.status(400).json({
      success: false,
      error: 'Failed to create job',
      details: errorMessage,
      receivedData: req.body,
    })
  }
})

// Update job
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const updateData: UpdateJobRequest = req.body
    console.log('Updating job with ID:', id, 'Data:', updateData)
    const job = await updateJob(id, updateData)

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' })
    }

    res.json({ success: true, data: job, message: 'Job updated successfully' })
  } catch (error) {
    console.error('Error updating job:', error)
    // Return the actual error message for debugging
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    res.status(400).json({
      success: false,
      error: 'Failed to update job',
      details: errorMessage,
      receivedData: req.body,
    })
  }
})

//  Delete job
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const deleted = await deleteJob(id)

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Job not found' })
    }

    res.json({ success: true, message: 'Job deleted successfully' })
  } catch (error) {
    console.error('Error deleting job:', error)
    res.status(500).json({ success: false, error: 'Failed to delete job' })
  }
})

export default router
