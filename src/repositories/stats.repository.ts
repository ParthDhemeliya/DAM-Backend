import { Pool } from 'pg';
import { getPool } from '../config/database.config';

export class StatsRepository {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  async getAssetCounts(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active,
        COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted
      FROM assets
    `;
    const result = await this.pool.query(query);
    return result.rows[0];
  }

  async getAssetCountsByType(): Promise<any[]> {
    const query = `
      SELECT 
        file_type,
        COUNT(*) as count,
        SUM(file_size) as total_size
      FROM assets 
      WHERE deleted_at IS NULL
      GROUP BY file_type
      ORDER BY count DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getAssetCountsByStatus(): Promise<any[]> {
    const query = `
      SELECT 
        COALESCE(status, 'unknown') as status,
        COUNT(*) as count
      FROM assets 
      WHERE deleted_at IS NULL
      GROUP BY status
      ORDER BY count DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getAssetCountsByCategory(): Promise<any[]> {
    const query = `
      SELECT 
        COALESCE(metadata->>'category', 'uncategorized') as category,
        COUNT(*) as count
      FROM assets 
      WHERE deleted_at IS NULL
      GROUP BY metadata->>'category'
      ORDER BY count DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getAssetCountsByAuthor(): Promise<any[]> {
    const query = `
      SELECT 
        COALESCE(metadata->>'author', 'unknown') as author,
        COUNT(*) as count
      FROM assets 
      WHERE deleted_at IS NULL
      GROUP BY metadata->>'author'
      ORDER BY count DESC
      LIMIT 20
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getAssetCountsByDepartment(): Promise<any[]> {
    const query = `
      SELECT 
        COALESCE(metadata->>'department', 'general') as department,
        COUNT(*) as count
      FROM assets 
      WHERE deleted_at IS NULL
      GROUP BY metadata->>'department'
      ORDER BY count DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getAssetCountsByProject(): Promise<any[]> {
    const query = `
      SELECT 
        COALESCE(metadata->>'project', 'default') as project,
        COUNT(*) as count
      FROM assets 
      WHERE deleted_at IS NULL
      GROUP BY metadata->>'project'
      ORDER BY count DESC
      LIMIT 20
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getAssetUploadsByDate(days: number = 30): Promise<any[]> {
    const query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        SUM(file_size) as total_size
      FROM assets 
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getAssetUploadsByHour(days: number = 7): Promise<any[]> {
    const query = `
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as count
      FROM assets 
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        AND deleted_at IS NULL
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getAssetUploadsByDayOfWeek(days: number = 30): Promise<any[]> {
    const query = `
      SELECT 
        EXTRACT(DOW FROM created_at) as day_of_week,
        COUNT(*) as count
      FROM assets 
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        AND deleted_at IS NULL
      GROUP BY EXTRACT(DOW FROM created_at)
      ORDER BY day_of_week
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getJobCounts(): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM jobs
      WHERE deleted_at IS NULL
    `;
    const result = await this.pool.query(query);
    return result.rows[0];
  }

  async getJobCountsByType(): Promise<any[]> {
    const query = `
      SELECT 
        job_type,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM jobs 
      WHERE deleted_at IS NULL
      GROUP BY job_type
      ORDER BY count DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getJobCountsByDate(days: number = 30): Promise<any[]> {
    const query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
      FROM jobs 
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getStorageUsage(): Promise<any> {
    const query = `
      SELECT 
        SUM(file_size) as total_size,
        AVG(file_size) as avg_file_size,
        MIN(file_size) as min_file_size,
        MAX(file_size) as max_file_size,
        COUNT(*) as file_count
      FROM assets 
      WHERE deleted_at IS NULL
    `;
    const result = await this.pool.query(query);
    return result.rows[0];
  }

  async getStorageUsageByType(): Promise<any[]> {
    const query = `
      SELECT 
        file_type,
        SUM(file_size) as total_size,
        AVG(file_size) as avg_file_size,
        COUNT(*) as file_count
      FROM assets 
      WHERE deleted_at IS NULL
      GROUP BY file_type
      ORDER BY total_size DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getTopAssetsBySize(limit: number = 10): Promise<any[]> {
    const query = `
      SELECT 
        id,
        filename,
        original_name,
        file_type,
        file_size,
        created_at
      FROM assets 
      WHERE deleted_at IS NULL
      ORDER BY file_size DESC
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  async getRecentAssets(limit: number = 10): Promise<any[]> {
    const query = `
      SELECT 
        id,
        filename,
        original_name,
        file_type,
        file_size,
        created_at
      FROM assets 
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  async getAssetGrowthRate(days: number = 30): Promise<any> {
    const currentQuery = `
      SELECT COUNT(*) as current_count
      FROM assets 
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        AND deleted_at IS NULL
    `;
    const previousQuery = `
      SELECT COUNT(*) as previous_count
      FROM assets 
      WHERE created_at >= NOW() - INTERVAL '${days * 2} days'
        AND created_at < NOW() - INTERVAL '${days} days'
        AND deleted_at IS NULL
    `;

    const [currentResult, previousResult] = await Promise.all([
      this.pool.query(currentQuery),
      this.pool.query(previousQuery),
    ]);

    const currentCount = parseInt(currentResult.rows[0].current_count);
    const previousCount = parseInt(previousResult.rows[0].previous_count);

    const growthRate =
      previousCount > 0
        ? ((currentCount - previousCount) / previousCount) * 100
        : 0;

    return {
      currentPeriod: currentCount,
      previousPeriod: previousCount,
      growthRate: Math.round(growthRate * 100) / 100,
      days,
    };
  }

  async getAverageJobProcessingTime(): Promise<number> {
    const query = `
      SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_time
      FROM jobs 
      WHERE status IN ('completed', 'failed') 
        AND created_at IS NOT NULL 
        AND updated_at IS NOT NULL
    `;
    const result = await this.pool.query(query);
    return parseFloat(result.rows[0]?.avg_processing_time || '0');
  }

  async getJobSuccessRate(): Promise<number> {
    const query = `
      SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(*) as total
      FROM jobs 
      WHERE status IN ('completed', 'failed')
    `;
    const result = await this.pool.query(query);
    const completed = parseInt(result.rows[0]?.completed || '0');
    const total = parseInt(result.rows[0]?.total || '0');
    return total > 0 ? (completed / total) * 100 : 0;
  }
}
