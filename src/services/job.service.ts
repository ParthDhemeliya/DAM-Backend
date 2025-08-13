import { Pool } from 'pg'
import {
  Job,
  CreateJobRequest,
  UpdateJobRequest,
} from '../interfaces/job.interface'
import { getPool } from '../config/database.config'
import {
  validateString,
  validateNumber,
  validateInteger,
} from '../middleware/validation'

// Shared database pool instance
const pool: Pool = getPool()

// Validate job data before creation
const validateJobData = (jobData: CreateJobRequest): void => {
  validateInteger(jobData.asset_id, 'asset_id', 1)
  validateString(jobData.job_type, 'job_type')
  validateString(jobData.status, 'status')
  if (jobData.priority !== undefined) {
    validateNumber(jobData.priority, 'priority', 1, 10)
  }
}

// Validate job ID
const validateJobId = (id: number): void => {
  validateInteger(id, 'id', 1)
}

// Create a new job
export const createJob = async (jobData: CreateJobRequest): Promise<Job> => {
  try {
    validateJobData(jobData)

    const query = `
      INSERT INTO jobs (asset_id, job_type, status, priority, progress)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `

    const values = [
      jobData.asset_id,
      jobData.job_type,
      jobData.status || 'pending',
      jobData.priority || 5,
      jobData.progress || 0,
    ]

    const result = await pool.query(query, values)

    if (!result.rows[0]) {
      throw new Error('Failed to create job - no data returned')
    }

    console.log(
      `Job created successfully: ${result.rows[0].job_type} for asset ${result.rows[0].asset_id}`
    )
    return result.rows[0]
  } catch (error) {
    console.error('Error creating job:', error)
    throw error
  }
}

// get job by id
export const getJobById = async (id: number): Promise<Job | null> => {
  try {
    validateJobId(id)

    const query = 'SELECT * FROM jobs WHERE id = $1'
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (error) {
    console.error('Error getting job by ID:', error)
    throw error
  }
}

// Get all jobs
export const getAllJobs = async (): Promise<Job[]> => {
  try {
    const query = 'SELECT * FROM jobs ORDER BY created_at DESC'
    const result = await pool.query(query)
    return result.rows
  } catch (error) {
    console.error('Error getting all jobs:', error)
    throw error
  }
}

// get jobs by asset id
export const getJobsByAssetId = async (assetId: number): Promise<Job[]> => {
  try {
    validateInteger(assetId, 'asset_id', 1)

    const query =
      'SELECT * FROM jobs WHERE asset_id = $1 ORDER BY created_at DESC'
    const result = await pool.query(query, [assetId])
    return result.rows
  } catch (error) {
    console.error('Error getting jobs by asset ID:', error)
    throw error
  }
}

// Update job
export const updateJob = async (
  id: number,
  updateData: UpdateJobRequest
): Promise<Job | null> => {
  try {
    console.log('=== UPDATE JOB SERVICE START ===')
    console.log('Job ID:', id)
    console.log('Update data:', updateData)

    validateJobId(id)
    console.log('Job ID validation passed')

    const fields: string[] = []
    const values: any[] = []
    let paramCount = 0

    // Build dynamic query based on provided fields
    if (updateData.status !== undefined) {
      console.log('Processing status update:', updateData.status)
      // Update these statuses to match your database constraint
      const validStatuses = [
        'pending',
        'processing',
        'completed',
        'failed',
        'cancelled',
      ]
      if (!validStatuses.includes(updateData.status)) {
        throw new Error(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        )
      }
      paramCount++
      fields.push(`status = $${paramCount}`)
      values.push(updateData.status)
      console.log('Status field added')
    }

    if (updateData.progress !== undefined) {
      console.log('Processing progress update:', updateData.progress)
      validateNumber(updateData.progress, 'progress', 0, 100)
      paramCount++
      fields.push(`progress = $${paramCount}`)
      values.push(updateData.progress)
      console.log('Progress field added')
    }

    if (updateData.priority !== undefined) {
      console.log('Processing priority update:', updateData.priority)
      validateNumber(updateData.priority, 'priority', 1, 10)
      paramCount++
      fields.push(`priority = $${paramCount}`)
      values.push(updateData.priority)
      console.log('Priority field added')
    }

    if (updateData.started_at !== undefined) {
      console.log('Processing started_at update:', updateData.started_at)
      paramCount++
      fields.push(`started_at = $${paramCount}`)
      values.push(updateData.started_at)
      console.log('Started_at field added')
    }

    if (updateData.completed_at !== undefined) {
      console.log('Processing completed_at update:', updateData.completed_at)
      paramCount++
      fields.push(`completed_at = $${paramCount}`)
      values.push(updateData.completed_at)
      console.log('Completed_at field added')
    }

    console.log('Fields to update:', fields)
    console.log('Values to use:', values)

    if (fields.length === 0) {
      console.log('No fields to update, returning current job')
      return getJobById(id)
    }

    paramCount++
    fields.push(`updated_at = $${paramCount}`)
    values.push(new Date())
    console.log('Updated_at field added')

    paramCount++
    values.push(id)
    console.log('ID parameter added')

    const query = `
      UPDATE jobs 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `
    console.log('Final SQL query:', query)
    console.log('Final values:', values)

    const result = await pool.query(query, values)
    console.log('Database update result:', result)
    console.log('Updated job:', result.rows[0])

    return result.rows[0] || null
  } catch (error) {
    console.error('=== UPDATE JOB SERVICE ERROR ===')
    console.error('Error type:', typeof error)
    console.error('Error constructor:', error?.constructor?.name)
    if (error && typeof error === 'object' && 'message' in error) {
      console.error('Error message:', (error as any).message)
    }
    if (error && typeof error === 'object' && 'stack' in error) {
      console.error('Error stack:', (error as any).stack)
    }
    console.error('Full error object:', error)
    throw error
  }
}

// Delete job
export const deleteJob = async (id: number): Promise<boolean> => {
  try {
    validateJobId(id)

    const query = 'DELETE FROM jobs WHERE id = $1'
    const result = await pool.query(query, [id])
    return result.rowCount ? result.rowCount > 0 : false
  } catch (error) {
    console.error('Error deleting job:', error)
    throw error
  }
}
