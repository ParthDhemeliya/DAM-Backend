import dotenv from 'dotenv'
import {
  addAssetProcessingJob,
  getQueueStats,
} from '../src/services/queue.service'

// Load environment variables
dotenv.config()

async function testQueue() {
  try {
    console.log('Testing Queue System...\n')

    // Test 1: Get queue stats
    console.log('Getting queue statistics...')
    const stats = await getQueueStats()
    console.log('Queue stats:', stats)

    // Test 2: Add a thumbnail generation job
    console.log('\nAdding thumbnail generation job...')
    const thumbnailJob = await addAssetProcessingJob('thumbnail', {
      assetId: 1, // Use an existing asset ID
      priority: 1,
      options: { width: 300, height: 300 },
    })
    console.log('Thumbnail job added:', thumbnailJob)

    // Test 3: Add a metadata extraction job
    console.log('\nAdding metadata extraction job...')
    const metadataJob = await addAssetProcessingJob('metadata', {
      assetId: 1,
      priority: 2,
      options: { extractExif: true },
    })
    console.log('Metadata job added:', metadataJob)

    // Test 4: Add a file conversion job
    console.log('\nAdding file conversion job...')
    const conversionJob = await addAssetProcessingJob('conversion', {
      assetId: 1,
      priority: 3,
      options: { targetFormat: 'mp4' },
    })
    console.log('Conversion job added:', conversionJob)

    // Test 5: Get updated queue stats
    console.log('\nGetting updated queue statistics...')
    const updatedStats = await getQueueStats()
    console.log('Updated queue stats:', updatedStats)

    console.log('\nQueue system test completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Start the worker: npm run worker')
    console.log('2. Watch jobs being processed')
    console.log('3. Check the jobs table in your database')
  } catch (error) {
    console.error('Queue test failed:', error)
    process.exit(1)
  }
}

// Run the test
testQueue()
