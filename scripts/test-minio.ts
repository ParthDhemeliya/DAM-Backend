import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import {
  uploadFile,
  getSignedReadUrl,
  downloadFile,
  deleteFile,
  fileExists,
  getFileMetadata,
} from '../src/services/storage'
import { Readable } from 'stream'

// Load environment variables
dotenv.config()

async function testMinIO() {
  try {
    console.log(' Starting MinIO integration test...\n')

    // Create a test file if it doesn't exist
    const testFilePath = path.join(__dirname, 'test-file.txt')
    if (!fs.existsSync(testFilePath)) {
      fs.writeFileSync(
        testFilePath,
        'This is a test file for MinIO integration!'
      )
      console.log('Created test file:', testFilePath)
    }

    const key = `test/${Date.now()}-test-file.txt`
    console.log('Test file key:', key)

    // 1. Upload file
    console.log('\n Testing file upload...')
    const uploadResult = await uploadFile(
      key,
      fs.createReadStream(testFilePath)
    )
    console.log('Upload successful:', uploadResult)

    // 2. Check if file exists
    console.log('\n Testing file existence check...')
    const exists = await fileExists(key)
    console.log(' File exists:', exists)

    // 3. Get file metadata
    console.log('\nTesting metadata retrieval...')
    const metadata = await getFileMetadata(key)
    console.log('File metadata:', metadata)

    // 4. Get signed URL
    console.log('\n Testing signed URL generation...')
    const signedUrl = await getSignedReadUrl(key, 120)
    console.log(' Signed URL (valid for 2 minutes):', signedUrl)

    // 5. Download file
    console.log('\n Testing file download...')
    const stream = await downloadFile(key)
    const chunks: Buffer[] = []

    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => {
      const downloadedContent = Buffer.concat(chunks).toString()
      console.log('Downloaded content:', downloadedContent)

      // 6. Delete file
      deleteFile(key)
        .then(() => {
          console.log(' File deleted successfully')
          console.log('\n All MinIO tests passed!')
        })
        .catch(console.error)
    })

    stream.on('error', (error) => {
      console.error('Download error:', error)
    })
  } catch (error) {
    console.error(' Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testMinIO()
