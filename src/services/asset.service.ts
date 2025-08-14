import { Pool } from 'pg'
import {
  Asset,
  CreateAssetRequest,
  UpdateAssetRequest,
  FileType,
} from '../interfaces/asset.interface'
import { getPool } from '../config/database.config'
import {
  validateString,
  validateNumber,
  validateInteger,
} from '../middleware/validation'
import { uploadFile, deleteFile, getSignedReadUrl, fileExists } from './storage'
import { Readable } from 'stream'
import {
  detectFileType,
  validateFileForUpload,
  generateStoragePath,
  extractBasicMetadata,
} from '../utils/fileTypeUtils'

// Shared database pool instance
const pool: Pool = getPool()

// Validate asset data before creation
const validateAssetData = (assetData: CreateAssetRequest): void => {
  validateString(assetData.filename, 'filename')
  validateString(assetData.original_name, 'original_name')
  validateString(assetData.file_type, 'file_type')
  validateString(assetData.mime_type, 'mime_type')
  validateNumber(assetData.file_size, 'file_size', 1)
  validateString(assetData.storage_path, 'storage_path')
}

// Validate asset ID
const validateAssetId = (id: number): void => {
  validateInteger(id, 'id', 1)
}

// Create a new asset with MinIO storage
export const createAsset = async (
  assetData: CreateAssetRequest,
  fileBuffer?: Buffer
): Promise<Asset> => {
  try {
    console.log('=== CREATE ASSET SERVICE START ===')
    console.log('Input asset data:', assetData)
    console.log('Asset data type:', typeof assetData)
    console.log('Asset data keys:', Object.keys(assetData || {}))

    // Generate MinIO storage key
    const storageKey = `assets/${Date.now()}-${assetData.filename}`

    // Upload file to MinIO if buffer is provided
    if (fileBuffer) {
      console.log('Uploading file to MinIO...')
      await uploadFile(storageKey, fileBuffer)
      console.log('File uploaded to MinIO:', storageKey)

      // Update storage path to use MinIO key
      assetData.storage_path = storageKey
    }

    console.log('Starting validation...')
    validateAssetData(assetData)
    console.log('Asset data validation passed')

    console.log('Building SQL query...')
    const query = `
      INSERT INTO assets (filename, original_name, file_type, mime_type, file_size, storage_path, storage_bucket, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `
    console.log('SQL Query:', query)

    const values = [
      assetData.filename.trim(),
      assetData.original_name.trim(),
      assetData.file_type.trim(),
      assetData.mime_type.trim(),
      assetData.file_size,
      assetData.storage_path.trim(),
      assetData.storage_bucket || 'dam-media',
      JSON.stringify(assetData.metadata || {}),
    ]
    console.log('Query values:', values)
    console.log(
      'Values types:',
      values.map((v) => typeof v)
    )

    console.log('Executing database query...')
    const result = await pool.query(query, values)
    console.log('Database query result:', result)
    console.log('Result rows:', result.rows)

    if (!result.rows[0]) {
      throw new Error('Failed to create asset - no data returned')
    }

    console.log(`Asset created successfully: ${result.rows[0].filename}`)
    return result.rows[0]
  } catch (error) {
    console.error('=== CREATE ASSET SERVICE ERROR ===')
    console.error('Error type:', typeof error)
    console.error('Error constructor:', error?.constructor?.name)

    // Use type guards to safely access error properties
    if (error && typeof error === 'object' && 'message' in error) {
      console.error('Error message:', (error as any).message)
    }
    if (error && typeof error === 'object' && 'stack' in error) {
      console.error('Error stack:', (error as any).stack)
    }
    console.error('Full error object:', error)

    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Asset creation failed: ${error.message}`)
    }
    throw new Error('Asset creation failed with unknown error')
  }
}

// Get asset by ID
export const getAssetById = async (id: number): Promise<Asset | null> => {
  try {
    validateAssetId(id)

    const query = 'SELECT * FROM assets WHERE id = $1 AND deleted_at IS NULL'
    const result = await pool.query(query, [id])
    return result.rows[0] || null
  } catch (error) {
    console.error('Error getting asset by ID:', error)
    throw error
  }
}

// Get all assets
export const getAllAssets = async (): Promise<Asset[]> => {
  try {
    const query =
      'SELECT * FROM assets WHERE deleted_at IS NULL ORDER BY created_at DESC'
    const result = await pool.query(query)
    return result.rows
  } catch (error) {
    console.error('Error getting all assets:', error)
    throw error
  }
}

// Get asset with signed URL for access
export const getAssetWithSignedUrl = async (
  id: number,
  expiresIn: number = 3600
): Promise<(Asset & { signedUrl: string }) | null> => {
  try {
    const asset = await getAssetById(id)
    if (!asset) return null

    // Generate signed URL for MinIO access
    const signedUrl = await getSignedReadUrl(asset.storage_path, expiresIn)

    return {
      ...asset,
      signedUrl,
    }
  } catch (error) {
    console.error('Error getting asset with signed URL:', error)
    throw error
  }
}

// Update asset
export const updateAsset = async (
  id: number,
  updateData: UpdateAssetRequest
): Promise<Asset | null> => {
  try {
    validateAssetId(id)

    const fields: string[] = []
    const values: any[] = []
    let paramCount = 0

    // Build dynamic query based on provided fields
    if (updateData.filename !== undefined) {
      validateString(updateData.filename, 'filename')
      paramCount++
      fields.push(`filename = $${paramCount}`)
      values.push(updateData.filename.trim())
    }

    if (updateData.status !== undefined) {
      const validStatuses = [
        'uploaded',
        'processing',
        'processed',
        'failed',
        'deleted',
      ]
      if (!validStatuses.includes(updateData.status)) {
        throw new Error(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        )
      }
      paramCount++
      fields.push(`status = $${paramCount}`)
      values.push(updateData.status)
    }

    if (updateData.metadata !== undefined) {
      paramCount++
      fields.push(`metadata = $${paramCount}`)
      values.push(JSON.stringify(updateData.metadata))
    }

    if (fields.length === 0) {
      return getAssetById(id)
    }

    paramCount++
    fields.push(`updated_at = $${paramCount}`)
    values.push(new Date())

    paramCount++
    values.push(id)

    const query = `
      UPDATE assets 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING *
    `

    const result = await pool.query(query, values)
    return result.rows[0] || null
  } catch (error) {
    console.error('Error updating asset:', error)
    throw error
  }
}

// Delete asset (soft delete) and remove from MinIO
export const deleteAsset = async (id: number): Promise<boolean> => {
  try {
    validateAssetId(id)

    // Get asset to find storage path
    const asset = await getAssetById(id)
    if (!asset) {
      throw new Error('Asset not found')
    }

    // Delete file from MinIO
    try {
      await deleteFile(asset.storage_path)
      console.log('File deleted from MinIO:', asset.storage_path)
    } catch (minioError) {
      console.warn('Failed to delete file from MinIO:', minioError)
      // Continue with database deletion even if MinIO deletion fails
    }

    // Soft delete from database
    const query = `
      UPDATE assets 
      SET deleted_at = $1, updated_at = $1
      WHERE id = $2 AND deleted_at IS NULL
    `

    const result = await pool.query(query, [new Date(), id])
    return result.rowCount ? result.rowCount > 0 : false
  } catch (error) {
    console.error('Error deleting asset:', error)
    throw error
  }
}

// Upload file to MinIO and create asset
export const uploadAssetFile = async (
  file: Express.Multer.File,
  metadata?: any
): Promise<Asset> => {
  try {
    console.log('=== UPLOAD ASSET FILE START ===')
    console.log('File info:', {
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer ? `Buffer(${file.buffer.length} bytes)` : 'No buffer',
    })

    // Validate file for upload
    const validation = validateFileForUpload(
      file.originalname || 'unknown',
      file.mimetype || 'application/octet-stream',
      file.size
    )

    if (!validation.isValid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`)
    }

    console.log('File validation passed:', validation)

    // Extract basic metadata
    const basicMetadata = extractBasicMetadata(
      file.originalname || 'unknown',
      file.mimetype || 'application/octet-stream',
      file.size
    )

    console.log('Basic metadata extracted:', basicMetadata)

    const assetData: CreateAssetRequest = {
      filename: file.filename || file.originalname || 'unknown',
      original_name: file.originalname || 'unknown',
      file_type: validation.fileType,
      mime_type: file.mimetype || 'application/octet-stream',
      file_size: file.size,
      storage_path: '', // Will be set by createAsset
      storage_bucket: 'dam-media',
      metadata: {
        ...basicMetadata,
        ...metadata,
        uploadMethod: 'api',
        uploadTimestamp: new Date().toISOString(),
      },
    }

    console.log('Asset data prepared:', assetData)

    return await createAsset(assetData, file.buffer)
  } catch (error) {
    console.error('=== UPLOAD ASSET FILE ERROR ===')
    console.error('Error:', error)
    throw error
  }
}
