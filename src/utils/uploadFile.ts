import { Upload } from '@aws-sdk/lib-storage'
import { s3 } from '../clients/s3'
import { Readable } from 'stream'

const bucketName = process.env.MINIO_BUCKET || 'dam-media'

/**
 * Upload file to S3/MinIO with streaming support for large files
 * @param key - S3 key (path) for the file
 * @param body - File content as Buffer or ReadableStream
 * @param contentType - MIME type of the file
 * @param metadata - Additional metadata for the file
 * @returns Promise with bucket and key information
 */
export async function uploadFile(
  key: string,
  body: Buffer | Readable,
  contentType?: string,
  metadata?: Record<string, string>
): Promise<{ bucket: string; key: string }> {
  try {
    console.log(`Starting S3 upload: ${key} to bucket ${bucketName}`)

    const uploader = new Upload({
      client: s3,
      params: {
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
        Metadata: metadata,
      },
      // Add timeout to prevent hanging uploads
      queueSize: 4, // Number of parts to upload concurrently
      partSize: 1024 * 1024 * 5, // 5MB part size
    })

    // Handle upload progress for large files
    uploader.on('httpUploadProgress', (progress) => {
      if (progress.loaded && progress.total) {
        const percentage = Math.round((progress.loaded / progress.total) * 100)
        const loadedMB = (progress.loaded / (1024 * 1024)).toFixed(2)
        const totalMB = (progress.total / (1024 * 1024)).toFixed(2)
        console.log(
          `S3 Upload Progress: ${key} - ${loadedMB}MB / ${totalMB}MB (${percentage}%)`
        )
      }
    })

    // Add timeout to the upload
    const uploadPromise = uploader.done()
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('S3 upload timeout after 10 minutes'))
      }, 600000) // 10 minutes timeout
    })

    // Wait for upload to complete with timeout
    await Promise.race([uploadPromise, timeoutPromise])

    console.log(`S3 upload completed: ${key}`)
    return { bucket: bucketName, key }
  } catch (error) {
    console.error(`S3 upload failed for ${key}:`, error)
    throw new Error(
      `Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
