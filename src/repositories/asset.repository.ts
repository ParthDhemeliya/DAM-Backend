import { Pool } from 'pg';
import { getPool } from '../config/database.config';
import {
  Asset,
  CreateAssetRequest,
  UpdateAssetRequest,
} from '../interfaces/asset.interface';

export class AssetRepository {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  async findById(id: number): Promise<Asset | null> {
    const query = `
      SELECT * FROM assets 
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findAll(): Promise<Asset[]> {
    const query = `
      SELECT * FROM assets 
      WHERE deleted_at IS NULL 
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async create(assetData: CreateAssetRequest): Promise<Asset> {
    const query = `
      INSERT INTO assets (
        filename, original_name, file_type, mime_type, file_size,
        storage_path, storage_bucket, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `;
    const values = [
      assetData.filename,
      assetData.original_name,
      assetData.file_type,
      assetData.mime_type,
      assetData.file_size,
      assetData.storage_path,
      assetData.storage_bucket,
      JSON.stringify(assetData.metadata),
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async update(
    id: number,
    assetData: UpdateAssetRequest
  ): Promise<Asset | null> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (assetData.filename !== undefined) {
      updateFields.push(`filename = $${paramCount}`);
      values.push(assetData.filename);
      paramCount++;
    }

    if (assetData.status !== undefined) {
      updateFields.push(`status = $${paramCount}`);
      values.push(assetData.status);
      paramCount++;
    }

    if (assetData.metadata !== undefined) {
      updateFields.push(`metadata = $${paramCount}`);
      values.push(JSON.stringify(assetData.metadata));
      paramCount++;
    }

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE assets 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const query = `
      UPDATE assets 
      SET deleted_at = NOW() 
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `;
    const result = await this.pool.query(query, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async findWithFilters(filters: {
    page: number;
    limit: number;
    fileType?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    tags?: string[];
    category?: string;
    author?: string;
    department?: string;
    project?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ assets: Asset[]; pagination: any }> {
    const {
      page,
      limit,
      fileType,
      status,
      dateFrom,
      dateTo,
      tags,
      category,
      author,
      department,
      project,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = filters;

    const whereConditions: string[] = ['deleted_at IS NULL'];
    const values: any[] = [];
    let paramCount = 1;

    if (fileType) {
      whereConditions.push(`file_type = $${paramCount}`);
      values.push(fileType);
      paramCount++;
    }

    if (status) {
      whereConditions.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (dateFrom) {
      whereConditions.push(`created_at >= $${paramCount}`);
      values.push(dateFrom);
      paramCount++;
    }

    if (dateTo) {
      whereConditions.push(`created_at <= $${paramCount}`);
      values.push(dateTo);
      paramCount++;
    }

    if (category) {
      whereConditions.push(`metadata->>'category' = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (author) {
      whereConditions.push(`metadata->>'author' = $${paramCount}`);
      values.push(author);
      paramCount++;
    }

    if (department) {
      whereConditions.push(`metadata->>'department' = $${paramCount}`);
      values.push(department);
      paramCount++;
    }

    if (project) {
      whereConditions.push(`metadata->>'project' = $${paramCount}`);
      values.push(project);
      paramCount++;
    }

    if (tags && tags.length > 0) {
      const tagConditions = tags.map((_, index) => {
        const paramIndex = paramCount + index;
        return `metadata->>'tags' LIKE $${paramIndex}`;
      });
      whereConditions.push(`(${tagConditions.join(' OR ')})`);
      values.push(...tags.map(tag => `%${tag}%`));
      paramCount += tags.length;
    }

    const whereClause = whereConditions.join(' AND ');
    const offset = (page - 1) * limit;

    // Count total records
    const countQuery = `SELECT COUNT(*) FROM assets WHERE ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const dataQuery = `
      SELECT * FROM assets 
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    values.push(limit, offset);
    const dataResult = await this.pool.query(dataQuery, values);

    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return {
      assets: dataResult.rows,
      pagination,
    };
  }

  async search(
    query: string,
    filters: {
      page: number;
      limit: number;
      fileType?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: string;
    }
  ): Promise<{ assets: Asset[]; pagination: any }> {
    const {
      page,
      limit,
      fileType,
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = filters;

    const whereConditions: string[] = ['deleted_at IS NULL'];
    const values: any[] = [query, query, query];
    let paramCount = 4;

    whereConditions.push(`
      (filename ILIKE $1 OR 
       original_name ILIKE $2 OR 
       metadata::text ILIKE $3)
    `);

    if (fileType) {
      whereConditions.push(`file_type = $${paramCount}`);
      values.push(fileType);
      paramCount++;
    }

    if (status) {
      whereConditions.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    const whereClause = whereConditions.join(' AND ');
    const offset = (page - 1) * limit;

    // Count total records
    const countQuery = `SELECT COUNT(*) FROM assets WHERE ${whereClause}`;
    const countResult = await this.pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const dataQuery = `
      SELECT * FROM assets 
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    values.push(limit, offset);
    const dataResult = await this.pool.query(dataQuery, values);

    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return {
      assets: dataResult.rows,
      pagination,
    };
  }

  async findByIds(ids: number[]): Promise<Asset[]> {
    if (ids.length === 0) return [];

    const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
    const query = `
      SELECT * FROM assets 
      WHERE id IN (${placeholders}) AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query, ids);
    return result.rows;
  }

  async checkDuplicates(
    filename: string,
    fileSize?: number,
    contentHash?: string
  ): Promise<any[]> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const values: any[] = [filename];
    let paramCount = 2;

    conditions.push(`filename = $1`);

    if (contentHash) {
      conditions.push(`metadata->>'contentHash' = $${paramCount}`);
      values.push(contentHash);
      paramCount++;
    }

    if (fileSize) {
      conditions.push(`file_size = $${paramCount}`);
      values.push(fileSize);
      paramCount++;
    }

    const whereClause = conditions.join(' OR ');
    const query = `
      SELECT id, filename, original_name, file_size, created_at, metadata 
      FROM assets 
      WHERE ${whereClause}
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, values);
    return result.rows;
  }
}
