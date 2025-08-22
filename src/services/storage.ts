import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { lookup as mimeLookup } from 'mime-types'
import { s3 } from '../clients/s3'
import { Readable } from 'stream'

const bucketName = process.env.MINIO_BUCKET || 'dam-media'

// 0. Ensure bucket exists
export async function ensureBucketExists(): Promise<void> {
  try {
    // Check if bucket exists
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }))
    console.log(`Bucket ${bucketName} already exists`)
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      // Bucket doesn't exist, create it
      try {
        await s3.send(new CreateBucketCommand({ Bucket: bucketName }))
        console.log(`Bucket ${bucketName} created successfully`)
      } catch (createError) {
        console.error(`Failed to create bucket ${bucketName}:`, createError)
        throw createError
      }
    } else {
      console.error(`Error checking bucket ${bucketName}:`, error)
      throw error
    }
  }
}

// 1. Upload file
export async function uploadFile(
  key: string,
  body: Buffer | Readable
): Promise<{ bucket: string; key: string }> {
  const contentType = mimeLookup(key) || 'application/octet-stream'

  const uploader = new Upload({
    client: s3,
    params: {
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
  })

  await uploader.done()
  return { bucket: bucketName, key }
}

// 2. Download file
export async function downloadFile(
  key: string
): Promise<Readable> {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: bucketName, Key: key })
  )
  return res.Body as Readable
}

// 3. Delete file
export async function deleteFile(key: string): Promise<{ deleted: boolean }> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }))
  return { deleted: true }
}

// 4. Get signed URL for reading
export async function getSignedReadUrl(
  key: string,
  expiresIn: number = 60
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucketName, Key: key })
  return await getSignedUrl(s3, command, { expiresIn })
}

// 5. Get signed URL for uploading
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  })
  return await getSignedUrl(s3, command, { expiresIn })
}

// 6. Check if file exists
export async function fileExists(key: string): Promise<boolean> {
  try {
    await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }))
    return true
  } catch (error) {
    return false
  }
}

// 7. Get file metadata
export async function getFileMetadata(key: string): Promise<any> {
  try {
    const response = await s3.send(
      new GetObjectCommand({ Bucket: bucketName, Key: key })
    )
    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      etag: response.ETag,
    }
  } catch (error) {
    throw new Error(`Failed to get metadata for ${key}: ${error}`)
  }
}

// 8. List files in a directory
export async function listFiles(
  prefix: string = '',
  maxKeys: number = 1000
): Promise<string[]> {
  try {
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      })
    )

    return response.Contents?.map((obj) => obj.Key || '') || []
  } catch (error) {
    throw new Error(`Failed to list files: ${error}`)
  }
}
