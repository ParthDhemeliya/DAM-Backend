import dotenv from 'dotenv'
import { S3Client } from '@aws-sdk/client-s3'

dotenv.config()
// create connection with minio , act Aws S3
const s3 = new S3Client({
  region: process.env.MINIO_REGION || 'us-east-1',
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  forcePathStyle: true, // imp  for minio
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
  },
})

export { s3 }
