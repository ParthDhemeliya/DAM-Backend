import { PassThrough, Transform } from 'stream'
import { uploadFile } from './storage'
import { getPool } from '../config/database.config'
import { Pool } from 'pg'
import { CreateAssetRequest, FileType } from '../interfaces/asset.interface'

// Shared database pool instance
const pool: Pool = getPool()

export interface StreamAssetInput {
  filename: string
  mimeType?: string
  userId: number
  stream: NodeJS.ReadableStream
  metadata?: any
}

export interface UploadResult {
  id: number
  bucket: string
  key: string
  originalName: string
  mimeType: string | null
  size: number
  createdAt: Date
  metadata?: any
}

/**
 * Upload a file stream directly to MinIO without buffering in memory
 * This function handles large files efficiently by streaming chunk-by-chunk
 */
export async function uploadStreamAsset(
  input: StreamAssetInput
): Promise<UploadResult> {
  const { filename, mimeType, userId, stream, metadata } = input

  // 1. Generate a unique storage key
  const timestamp = Date.now()
  const sanitizedFilename = sanitizeFilename(filename)
  const key = `users/${userId}/${timestamp}-${sanitizedFilename}`
  const bucket = process.env.MINIO_BUCKET || 'dam-media'

  // 2. Create a transform stream that counts bytes and forwards data
  let totalSize = 0
  const countingStream = new Transform({
    transform(chunk: Buffer, encoding: string, callback: Function) {
      totalSize += chunk.length
      // Forward the chunk to the next stream
      callback(null, chunk)
    },
  })

  // 3. Create a promise that resolves when the upload is complete
  const uploadPromise = new Promise<void>((resolve, reject) => {
    // Handle stream errors
    stream.on('error', reject)
    countingStream.on('error', reject)

    // Handle upload completion
    countingStream.on('end', () => {
      console.log(`📊 File ${filename} size calculated: ${totalSize} bytes`)
    })

    // Start the upload process - uploadFile only takes 2 parameters
    uploadFile(key, countingStream)
      .then(() => resolve())
      .catch(reject)
  })

  // 4. Pipe the incoming stream through our counting stream
  stream.pipe(countingStream)

  // 5. Wait for the upload to complete
  await uploadPromise

  // 6. Prepare asset data for database
  const assetData: CreateAssetRequest = {
    filename: sanitizedFilename,
    original_name: filename,
    file_type: detectFileType(filename, mimeType), // This returns FileType
    mime_type: mimeType || 'application/octet-stream',
    file_size: totalSize,
    storage_path: key,
    storage_bucket: bucket,
    metadata: {
      ...metadata,
      uploadMethod: 'streaming',
      uploadTimestamp: new Date().toISOString(),
      userId: userId,
      originalFilename: filename,
    },
  }

  // 7. Store metadata in database
  const query = `
    INSERT INTO assets (filename, original_name, file_type, mime_type, file_size, storage_path, storage_bucket, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, created_at
  `

  const values = [
    assetData.filename,
    assetData.original_name,
    assetData.file_type,
    assetData.mime_type,
    assetData.file_size,
    assetData.storage_path,
    assetData.storage_bucket,
    JSON.stringify(assetData.metadata),
  ]

  const result = await pool.query(query, values)

  if (!result.rows[0]) {
    throw new Error('Failed to create asset record in database')
  }

  return {
    id: result.rows[0].id,
    bucket,
    key,
    originalName: filename,
    mimeType: mimeType || null,
    size: totalSize,
    createdAt: result.rows[0].created_at,
    metadata: assetData.metadata,
  }
}

/**
 * Handle multiple file uploads with streaming
 * This function processes multiple files concurrently without memory spikes
 */
export async function uploadMultipleStreamAssets(
  files: StreamAssetInput[],
  maxConcurrency: number = 5
): Promise<UploadResult[]> {
  const results: UploadResult[] = []
  const errors: Error[] = []

  // Process files in batches to control concurrency
  for (let i = 0; i < files.length; i += maxConcurrency) {
    const batch = files.slice(i, i + maxConcurrency)
    console.log(
      ` Processing batch ${Math.floor(i / maxConcurrency) + 1}/${Math.ceil(files.length / maxConcurrency)}`
    )

    const batchPromises = batch.map(async (fileInput) => {
      try {
        const result = await uploadStreamAsset(fileInput)
        return { success: true, result }
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error('Unknown upload error')
        errors.push(err)
        return { success: false, error: err, filename: fileInput.filename }
      }
    })

    try {
      const batchResults = await Promise.all(batchPromises)

      // Process successful uploads
      const successfulResults = batchResults
        .filter((r) => r.success)
        .map((r) => (r as any).result)

      results.push(...successfulResults)

      // Log failed uploads
      const failedResults = batchResults.filter((r) => !r.success)
      if (failedResults.length > 0) {
        console.error(
          `Batch ${Math.floor(i / maxConcurrency) + 1} had ${failedResults.length} failures:`,
          failedResults.map((r) => (r as any).filename)
        )
      }
    } catch (error) {
      // Continue with next batch even if current batch fails
      console.error(
        `Batch ${Math.floor(i / maxConcurrency) + 1} failed:`,
        error
      )
    }
  }

  if (errors.length > 0) {
    console.error(` Total upload errors: ${errors.length} files failed`)
  }

  console.log(
    `Batch processing complete. Success: ${results.length}, Errors: ${errors.length}`
  )
  return results
}

/**
 * Sanitize filename for safe storage
 */
function sanitizeFilename(name: string): string {
  if (!name || name.trim().length === 0) {
    return `unnamed-file-${Date.now()}`
  }

  return name
    .trim()
    .replace(/[^\w.\-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .substring(0, 255) // Limit length
}

/**
 * Detect file type based on filename and MIME type
 * Returns FileType enum value
 */
function detectFileType(filename: string, mimeType?: string): FileType {
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType.startsWith('text/')) return 'document'
    if (mimeType.includes('pdf')) return 'document'
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive'
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet'))
      return 'spreadsheet'
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation'))
      return 'presentation'
    if (
      mimeType.includes('javascript') ||
      mimeType.includes('json') ||
      mimeType.includes('python')
    )
      return 'code'
    if (
      mimeType.includes('font') ||
      mimeType.includes('woff') ||
      mimeType.includes('ttf')
    )
      return 'font'
    if (mimeType.includes('model') || mimeType.includes('3d')) return '3d'
  }

  // Fallback to filename extension
  const ext = filename.toLowerCase().split('.').pop()
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext || ''))
    return 'image'
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext || ''))
    return 'video'
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext || ''))
    return 'audio'
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext || ''))
    return 'document'
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext || '')) return 'spreadsheet'
  if (['ppt', 'pptx', 'odp'].includes(ext || '')) return 'presentation'
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext || ''))
    return 'archive'
  if (
    [
      'js',
      'ts',
      'py',
      'java',
      'cpp',
      'c',
      'php',
      'rb',
      'go',
      'rs',
      'html',
      'css',
      'xml',
      'json',
    ].includes(ext || '')
  )
    return 'code'
  if (['ttf', 'otf', 'woff', 'woff2'].includes(ext || '')) return 'font'
  if (['obj', 'fbx', 'stl', 'gltf', 'glb', 'blend'].includes(ext || ''))
    return '3d'

  return 'other'
}
