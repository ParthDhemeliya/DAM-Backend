import dotenv from 'dotenv'
import {
  S3Client,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3'
import { s3 } from '../src/clients/s3'

// Load environment variables
dotenv.config()

const bucketName = process.env.MINIO_BUCKET || 'dam-media'

async function setupMinIO() {
  try {
    console.log('🚀 Setting up MinIO bucket and testing connection...\n')

    // Test connection by listing buckets
    console.log('🔍 Testing MinIO connection...')
    const { ListBucketsCommand } = await import('@aws-sdk/client-s3')
    const listResult = await s3.send(new ListBucketsCommand({}))
    console.log('✅ MinIO connection successful!')
    console.log(
      '📦 Existing buckets:',
      listResult.Buckets?.map((b) => b.Name) || []
    )

    // Check if bucket already exists
    const bucketExists = listResult.Buckets?.some((b) => b.Name === bucketName)

    if (bucketExists) {
      console.log(`✅ Bucket '${bucketName}' already exists`)
    } else {
      // Create bucket
      console.log(`📦 Creating bucket '${bucketName}'...`)
      await s3.send(new CreateBucketCommand({ Bucket: bucketName }))
      console.log(`✅ Bucket '${bucketName}' created successfully`)
    }

    // Set bucket policy to allow public read (optional, for testing)
    try {
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: '*' },
            Action: ['s3:GetObject'],
            Resource: `arn:aws:s3:::${bucketName}/*`,
          },
        ],
      }

      await s3.send(
        new PutBucketPolicyCommand({
          Bucket: bucketName,
          Policy: JSON.stringify(policy),
        })
      )
      console.log(' Bucket policy set successfully')
    } catch (policyError) {
      console.log('  Could not set bucket policy (this is normal for MinIO)')
    }

    console.log('\n MinIO setup completed successfully!')
    console.log(` Bucket: ${bucketName}`)
    console.log(' API Endpoint:', process.env.MINIO_ENDPOINT)
    console.log(' Web Console: http://localhost:9001')
    console.log(' Username: minioadmin')
    console.log(' Password: minioadmin123')

    console.log('\n You can now run: npm run test:minio')
  } catch (error) {
    console.error(' MinIO setup failed:', error)
    process.exit(1)
  }
}

// Run the setup
setupMinIO()
