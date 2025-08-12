import { Pool } from 'pg';
import { Job, CreateJobRequest, UpdateJobRequest } from '../interfaces/job.interface';
import { getPool } from '../config/database.config';

export class JobService {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  // Create a new job
  async createJob(jobData: CreateJobRequest): Promise<Job> {
    const query = `
      INSERT INTO jobs (job_type, asset_id, priority, input_data)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      jobData.job_type,
      jobData.asset_id,
      jobData.priority || 1,
      JSON.stringify(jobData.input_data || {})
    ];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating job:', error);
      throw new Error(`Failed to create job: ${error}`);
    }
  }

  // Get job by ID
  async getJobById(id: number): Promise<Job | null> {
    const query = 'SELECT * FROM jobs WHERE id = $1';
    
    try {
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting job by ID:', error);
      throw new Error(`Failed to get job: ${error}`);
    }
  }

  // Get all jobs with optional filtering
  async getAllJobs(limit: number = 50, offset: number = 0, status?: string): Promise<Job[]> {
    let query = 'SELECT * FROM jobs';
    const values: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` WHERE status = $${paramCount}`;
      values.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);

    try {
      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting all jobs:', error);
      throw new Error(`Failed to get jobs: ${error}`);
    }
  }

  // Get jobs by asset ID
  async getJobsByAssetId(assetId: number): Promise<Job[]> {
    const query = 'SELECT * FROM jobs WHERE asset_id = $1 ORDER BY created_at DESC';
    
    try {
      const result = await this.pool.query(query, [assetId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting jobs by asset ID:', error);
      throw new Error(`Failed to get jobs by asset ID: ${error}`);
    }
  }

  // Get jobs by type
  async getJobsByType(jobType: string): Promise<Job[]> {
    const query = 'SELECT * FROM jobs WHERE job_type = $1 ORDER BY created_at DESC';
    
    try {
      const result = await this.pool.query(query, [jobType]);
      return result.rows;
    } catch (error) {
      console.error('Error getting jobs by type:', error);
      throw new Error(`Failed to get jobs by type: ${error}`);
    }
  }

  // Update job status and other fields
  async updateJob(id: number, updateData: UpdateJobRequest): Promise<Job | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    // Build dynamic query based on provided fields
    if (updateData.status !== undefined) {
      paramCount++;
      fields.push(`status = $${paramCount}`);
      values.push(updateData.status);
    }

    if (updateData.priority !== undefined) {
      paramCount++;
      fields.push(`priority = $${paramCount}`);
      values.push(updateData.priority);
    }

    if (updateData.progress !== undefined) {
      paramCount++;
      fields.push(`progress = $${paramCount}`);
      values.push(updateData.progress);
    }

    if (updateData.input_data !== undefined) {
      paramCount++;
      fields.push(`input_data = $${paramCount}`);
      values.push(JSON.stringify(updateData.input_data));
    }

    if (updateData.output_data !== undefined) {
      paramCount++;
      fields.push(`output_data = $${paramCount}`);
      values.push(JSON.stringify(updateData.output_data));
    }

    if (updateData.error_message !== undefined) {
      paramCount++;
      fields.push(`error_message = $${paramCount}`);
      values.push(updateData.error_message);
    }

    if (updateData.started_at !== undefined) {
      paramCount++;
      fields.push(`started_at = $${paramCount}`);
      values.push(updateData.started_at);
    }

    if (updateData.completed_at !== undefined) {
      paramCount++;
      fields.push(`completed_at = $${paramCount}`);
      values.push(updateData.completed_at);
    }

    if (fields.length === 0) {
      return this.getJobById(id);
    }

    paramCount++;
    fields.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    paramCount++;
    values.push(id);

    const query = `
      UPDATE jobs 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating job:', error);
      throw new Error(`Failed to update job: ${error}`);
    }
  }

  // Start a job (set status to processing and started_at)
  async startJob(id: number): Promise<Job | null> {
    return this.updateJob(id, {
      status: 'processing',
      started_at: new Date()
    });
  }

  // Complete a job (set status to completed and completed_at)
  async completeJob(id: number, outputData?: Record<string, any>): Promise<Job | null> {
    return this.updateJob(id, {
      status: 'completed',
      progress: 100,
      completed_at: new Date(),
      output_data: outputData
    });
  }

  // Fail a job (set status to failed and error message)
  async failJob(id: number, errorMessage: string): Promise<Job | null> {
    return this.updateJob(id, {
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date()
    });
  }

  // Get pending jobs (for processing)
  async getPendingJobs(limit: number = 10): Promise<Job[]> {
    const query = `
      SELECT * FROM jobs 
      WHERE status = 'pending' 
      ORDER BY priority DESC, created_at ASC 
      LIMIT $1
    `;
    
    try {
      const result = await this.pool.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting pending jobs:', error);
      throw new Error(`Failed to get pending jobs: ${error}`);
    }
  }

  // Get job statistics
  async getJobStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    const query = `
      SELECT 
        status,
        COUNT(*) as count
      FROM jobs 
      GROUP BY status
    `;
    
    try {
      const result = await this.pool.query(query);
      const stats = {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      };

      result.rows.forEach(row => {
        stats[row.status as keyof typeof stats] = parseInt(row.count);
        stats.total += parseInt(row.count);
      });

      return stats;
    } catch (error) {
      console.error('Error getting job stats:', error);
      throw new Error(`Failed to get job stats: ${error}`);
    }
  }
}
