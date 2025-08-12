import { Pool } from 'pg';
import { Asset, CreateAssetRequest, UpdateAssetRequest } from '../interfaces/asset.interface';
import { getPool } from '../config/database.config';

export class AssetService {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  // Create a new asset
  async createAsset(assetData: CreateAssetRequest): Promise<Asset> {
    const query = `
      INSERT INTO assets (filename, original_name, file_type, mime_type, file_size, storage_path, storage_bucket, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      assetData.filename,
      assetData.original_name,
      assetData.file_type,
      assetData.mime_type,
      assetData.file_size,
      assetData.storage_path,
      assetData.storage_bucket || 'dam-assets',
      JSON.stringify(assetData.metadata || {})
    ];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating asset:', error);
      throw new Error(`Failed to create asset: ${error}`);
    }
  }

  // Get asset by ID
  async getAssetById(id: number): Promise<Asset | null> {
    const query = 'SELECT * FROM assets WHERE id = $1 AND deleted_at IS NULL';
    
    try {
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting asset by ID:', error);
      throw new Error(`Failed to get asset: ${error}`);
    }
  }

  // Get all assets with optional filtering
  async getAllAssets(limit: number = 50, offset: number = 0, status?: string): Promise<Asset[]> {
    let query = 'SELECT * FROM assets WHERE deleted_at IS NULL';
    const values: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      values.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);

    try {
      const result = await this.pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting all assets:', error);
      throw new Error(`Failed to get assets: ${error}`);
    }
  }

  // Update asset status and other fields
  async updateAsset(id: number, updateData: UpdateAssetRequest): Promise<Asset | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    // Build dynamic query based on provided fields
    if (updateData.filename !== undefined) {
      paramCount++;
      fields.push(`filename = $${paramCount}`);
      values.push(updateData.filename);
    }

    if (updateData.status !== undefined) {
      paramCount++;
      fields.push(`status = $${paramCount}`);
      values.push(updateData.status);
    }

    if (updateData.metadata !== undefined) {
      paramCount++;
      fields.push(`metadata = $${paramCount}`);
      values.push(JSON.stringify(updateData.metadata));
    }

    if (updateData.processed_at !== undefined) {
      paramCount++;
      fields.push(`processed_at = $${paramCount}`);
      values.push(updateData.processed_at);
    }

    if (updateData.deleted_at !== undefined) {
      paramCount++;
      fields.push(`deleted_at = $${paramCount}`);
      values.push(updateData.deleted_at);
    }

    if (fields.length === 0) {
      return this.getAssetById(id);
    }

    paramCount++;
    fields.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    paramCount++;
    values.push(id);

    const query = `
      UPDATE assets 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating asset:', error);
      throw new Error(`Failed to update asset: ${error}`);
    }
  }

  // Soft delete asset (set deleted_at timestamp)
  async deleteAsset(id: number): Promise<boolean> {
    const query = `
      UPDATE assets 
      SET deleted_at = $1, updated_at = $1
      WHERE id = $2 AND deleted_at IS NULL
    `;
    
    try {
      const result = await this.pool.query(query, [new Date(), id]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting asset:', error);
      throw new Error(`Failed to delete asset: ${error}`);
    }
  }

  // Get assets by file type
  async getAssetsByType(fileType: string): Promise<Asset[]> {
    const query = 'SELECT * FROM assets WHERE file_type = $1 AND deleted_at IS NULL ORDER BY created_at DESC';
    
    try {
      const result = await this.pool.query(query, [fileType]);
      return result.rows;
    } catch (error) {
      console.error('Error getting assets by type:', error);
      throw new Error(`Failed to get assets by type: ${error}`);
    }
  }

  // Get assets by status
  async getAssetsByStatus(status: string): Promise<Asset[]> {
    const query = 'SELECT * FROM assets WHERE status = $1 AND deleted_at IS NULL ORDER BY created_at DESC';
    
    try {
      const result = await this.pool.query(query, [status]);
      return result.rows;
    } catch (error) {
      console.error('Error getting assets by status:', error);
      throw new Error(`Failed to get assets by status: ${error}`);
    }
  }
}
