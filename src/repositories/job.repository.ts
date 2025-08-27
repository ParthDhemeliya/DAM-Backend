import { Pool } from 'pg';
import { getPool } from '../config/database.config';
import {
  Job,
  CreateJobRequest,
  UpdateJobRequest,
} from '../interfaces/job.interface';

export class JobRepository {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  async findById(id: number): Promise<Job | null> {
    const query = `
      SELECT * FROM jobs 
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findAll(): Promise<Job[]> {
    const query = `
      SELECT * FROM jobs 
      WHERE deleted_at IS NULL 
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async create(jobData: CreateJobRequest): Promise<Job> {
    const query = `
      INSERT INTO jobs (
        job_type, asset_id, status, priority, progress, input_data,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `;
    const values = [
      jobData.job_type,
      jobData.asset_id,
      jobData.status || 'pending',
      jobData.priority || 5,
      jobData.progress || 0,
      JSON.stringify(jobData.input_data || {}),
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async update(id: number, jobData: UpdateJobRequest): Promise<Job | null> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (jobData.status !== undefined) {
      updateFields.push(`status = $${paramCount}`);
      values.push(jobData.status);
      paramCount++;
    }

    if (jobData.priority !== undefined) {
      updateFields.push(`priority = $${paramCount}`);
      values.push(jobData.priority);
      paramCount++;
    }

    if (jobData.progress !== undefined) {
      updateFields.push(`progress = $${paramCount}`);
      values.push(jobData.progress);
      paramCount++;
    }

    if (jobData.output_data !== undefined) {
      updateFields.push(`output_data = $${paramCount}`);
      values.push(JSON.stringify(jobData.output_data));
      paramCount++;
    }

    if (jobData.error_message !== undefined) {
      updateFields.push(`error_message = $${paramCount}`);
      values.push(jobData.error_message);
      paramCount++;
    }

    if (jobData.started_at !== undefined) {
      updateFields.push(`started_at = $${paramCount}`);
      values.push(jobData.started_at);
      paramCount++;
    }

    if (jobData.completed_at !== undefined) {
      updateFields.push(`completed_at = $${paramCount}`);
      values.push(jobData.completed_at);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE jobs 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const query = `
      UPDATE jobs 
      SET deleted_at = NOW() 
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `;
    const result = await this.pool.query(query, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async findByAssetId(assetId: number): Promise<Job[]> {
    const query = `
      SELECT * FROM jobs 
      WHERE asset_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query, [assetId]);
    return result.rows;
  }

  async findByStatus(status: string): Promise<Job[]> {
    const query = `
      SELECT * FROM jobs 
      WHERE status = $1 AND deleted_at IS NULL
      ORDER BY priority DESC, created_at ASC
    `;
    const result = await this.pool.query(query, [status]);
    return result.rows;
  }

  async findByType(jobType: string): Promise<Job[]> {
    const query = `
      SELECT * FROM jobs 
      WHERE job_type = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query, [jobType]);
    return result.rows;
  }

  async findPendingJobs(limit: number = 10): Promise<Job[]> {
    const query = `
      SELECT * FROM jobs 
      WHERE status = 'pending' AND deleted_at IS NULL
      ORDER BY priority DESC, created_at ASC
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  async findRunningJobs(): Promise<Job[]> {
    const query = `
      SELECT * FROM jobs 
      WHERE status = 'processing' AND deleted_at IS NULL
      ORDER BY started_at ASC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async findCompletedJobs(limit: number = 50): Promise<Job[]> {
    const query = `
      SELECT * FROM jobs 
      WHERE status = 'completed' AND deleted_at IS NULL
      ORDER BY completed_at DESC
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  async findFailedJobs(limit: number = 50): Promise<Job[]> {
    const query = `
      SELECT * FROM jobs 
      WHERE status = 'failed' AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  async updateStatus(
    id: number,
    status: string,
    additionalData?: any
  ): Promise<Job | null> {
    const updateData: UpdateJobRequest = { status: status as any };

    if (status === 'processing') {
      updateData.started_at = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date();
    }

    if (additionalData) {
      if (additionalData.output_data) {
        updateData.output_data = additionalData.output_data;
      }
      if (additionalData.error_message) {
        updateData.error_message = additionalData.error_message;
      }
    }

    return await this.update(id, updateData);
  }

  async getJobStats(): Promise<any> {
    const query = `
      SELECT 
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration
      FROM jobs 
      WHERE deleted_at IS NULL 
        AND started_at IS NOT NULL 
        AND completed_at IS NOT NULL
      GROUP BY status
    `;
    const result = await this.pool.query(query);

    const stats: any = {};
    result.rows.forEach(row => {
      stats[row.status] = {
        count: parseInt(row.count),
        avgDuration: row.avg_duration ? Math.round(row.avg_duration) : 0,
      };
    });

    return stats;
  }

  async cleanupOldJobs(daysOld: number = 30): Promise<number> {
    const query = `
      UPDATE jobs 
      SET deleted_at = NOW() 
      WHERE created_at < NOW() - INTERVAL '${daysOld} days' 
        AND deleted_at IS NULL
        AND status IN ('completed', 'failed')
      RETURNING id
    `;
    const result = await this.pool.query(query);
    return result.rowCount || 0;
  }
}
