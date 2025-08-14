import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import FormData from 'form-data'
import fetch from 'node-fetch'

// Load environment variables
dotenv.config()

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080'
const UPLOAD_ENDPOINT = `${API_BASE_URL}/api/streaming-upload/upload`

async function testStreamingUpload() {
  try {
    console.log('Starting Streaming Upload Test...\n')
    console.log(`API Endpoint: ${UPLOAD_ENDPUINT}`)

    // Create test files if they don't exist
    const testFiles = [
      { name: 'test-image.jpg', content: 'This is a test image file content' },
      { name: 'test-document.txt', content: 'This is a test document content' },
      { name: 'test-video.mp4', content: 'This is a test video file content' },
      { name: 'test-audio.mp3', content: 'This is a test audio file content' },
      {
        name: 'test-archive.zip',
        content: 'This is a test archive file content',
      },
    ]

    console.log('Creating test files...')
    for (const file of testFiles) {
      const filePath = path.join(__dirname, file.name)
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, file.content)
        console.log(`Created: ${file.name}`)
      } else {
        console.log(`Already exists: ${file.name}`)
      }
    }

    // Create FormData with multiple files
    console.log('\nPreparing multi-file upload...')
    const form = new FormData()

    for (const file of testFiles) {
      const filePath = path.join(__dirname, file.name)
      const fileStream = fs.createReadStream(filePath)
      form.append('files', fileStream, file.name)
    }

    // Add some metadata
    form.append(
      'metadata',
      JSON.stringify({
        testType: 'streaming-upload',
        timestamp: new Date().toISOString(),
        description: 'Test upload for Day 5 streaming functionality',
      })
    )

    console.log(`Uploading ${testFiles.length} files...`)
    console.log('This may take a moment...\n')

    // Send the request
    const startTime = Date.now()

    const response = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      body: form,
      headers: {
        'x-user-id': '1', // Test user ID
        ...form.getHeaders(),
      },
    })

    const endTime = Date.now()
    const duration = endTime - startTime

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    console.log('Upload completed successfully!')
    console.log(`Total time: ${duration}ms`)
    console.log(`Response:`, JSON.stringify(result, null, 2))

    // Clean up test files
    console.log('\nCleaning up test files...')
    for (const file of testFiles) {
      const filePath = path.join(__dirname, file.name)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log(`Deleted: ${file.name}`)
      }
    }

    console.log('\nStreaming upload test completed successfully!')
  } catch (error) {
    console.error('Streaming upload test failed:', error)
    process.exit(1)
  }
}

// Run the test
testStreamingUpload()
