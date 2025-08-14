// import { Worker, Job } from 'bullmq'
// import {
//   thumbnailQueue,
//   metadataQueue,
//   conversionQueue,
//   cleanupQueue,
//   redis,
// } from '../config/queue.config'
// import { getAssetById, updateAsset } from '../services/asset.service'
// import { downloadFile, uploadFile } from '../services/storage'
// import { createJob, updateJob } from '../services/job.service'

// // Job types
// export interface AssetProcessingJobData {
//   assetId: number
//   jobType: 'thumbnail' | 'metadata' | 'conversion' | 'cleanup'
//   priority?: number
//   options?: any
// }

// // Helper function to extract numeric ID from BullMQ job ID
// function extractJobId(bullmqJobId: string | number): number {
//   if (typeof bullmqJobId === 'number') {
//     return bullmqJobId
//   }

//   // Handle "job_6" format -> extract 6
//   if (bullmqJobId.startsWith('job_')) {
//     const numericPart = bullmqJobId.replace('job_', '')
//     const parsed = parseInt(numericPart)
//     if (!isNaN(parsed)) {
//       return parsed
//     }
//   }

//   // Try direct parsing
//   const parsed = parseInt(bullmqJobId)
//   if (!isNaN(parsed)) {
//     return parsed
//   }

//   throw new Error(`Cannot extract numeric job ID from: ${bullmqJobId}`)
// }

// // Create workers for each queue
// export const thumbnailWorker = new Worker(
//   'thumbnail-generation',
//   async (job: Job<AssetProcessingJobData>) => {
//     const { assetId, jobType, options } = job.data

//     console.log(`🚀 Processing ${jobType} for asset ${assetId}`)

//     try {
//       // Extract the numeric job ID from BullMQ job ID
//       // const numericJobId = extractJobId(job.id)
//       console.log(
//         // `📋 Processing job ID: ${numericJobId} (BullMQ ID: ${job.id})`
//       )

//       // // Update job status to processing
//       // await updateJob(numericJobId, {
//       //   status: 'processing',
//       //   started_at: new Date(),
//       // })

//       // Get asset details
//       const asset = await getAssetById(assetId)
//       if (!asset) {
//         throw new Error(`Asset ${assetId} not found`)
//       }

//       // Process thumbnail
//       const result = await processThumbnail(asset, options)

//       // Update asset with processing results
//       await updateAsset(assetId, {
//         status: 'processed',
//         metadata: { ...asset.metadata, [jobType]: result },
//       })

//       // // Update job status to completed
//       // await updateJob(numericJobId, {
//       //   status: 'completed',
//       //   progress: 100,
//       //   output_data: result,
//       //   completed_at: new Date(),
//       // })

//       console.log(` ${jobType} completed for asset ${assetId}`)
//       return result
//     } catch (error) {
//       console.error(` ${jobType} failed for asset ${assetId}:`, error)

//       // Update job status to failed
//       // try {
//       //   const numericJobId = extractJobId(job.id)
//       //   await updateJob(numericJobId, {
//       //     status: 'failed',
//       //     error_message:
//       //       error instanceof Error ? error.message : 'Unknown error',
//       //   })
//       // } catch (updateError) {
//       //   console.error('Failed to update job status to failed:', updateError)
//       // }

//       throw error
//     }
//   },
//   {
//     connection: redis,
//     concurrency: 2,
//     removeOnComplete: { count: 100 },
//     removeOnFail: { count: 50 },
//   }
// )

// export const metadataWorker = new Worker(
//   'metadata-extraction',
//   async (job: Job<AssetProcessingJobData>) => {
//     const { assetId, jobType, options } = job.data

//     console.log(`🚀 Processing ${jobType} for asset ${assetId}`)

//     try {
//       // Extract the numeric job ID from BullMQ job ID
//       // const numericJobId = extractJobId(job.id)
//       console.log(
//         // `📋 Processing job ID: ${numericJobId} (BullMQ ID: ${job.id})`
//       )

//       // // Update job status to processing
//       // await updateJob(numericJobId, {
//       //   status: 'processing',
//       //   started_at: new Date(),
//       // })

//       // Get asset details
//       const asset = await getAssetById(assetId)
//       if (!asset) {
//         throw new Error(`Asset ${assetId} not found`)
//       }

//       // Process metadata
//       const result = await processMetadata(asset, options)

//       // Update asset with processing results
//       await updateAsset(assetId, {
//         status: 'processed',
//         metadata: { ...asset.metadata, [jobType]: result },
//       })

//       // Update job status to completed
//       // await updateJob(numericJobId, {
//       //   status: 'completed',
//       //   progress: 100,
//       //   output_data: result,
//       //   completed_at: new Date(),
//       // })

//       console.log(`✅ ${jobType} completed for asset ${assetId}`)
//       return result
//     } catch (error) {
//       console.error(` ${jobType} failed for asset ${assetId}:`, error)

//       // Update job status to failed
//       try {
//         // const numericJobId = extractJobId(job.id)
//         // await updateJob(numericJobId, {
//         //   status: 'failed',
//         //   error_message:
//         //     error instanceof Error ? error.message : 'Unknown error',
//         // })
//       } catch (updateError) {
//         console.error('Failed to update job status to failed:', updateError)
//       }

//       throw error
//     }
//   },
//   {
//     connection: redis,
//     concurrency: 2,
//     removeOnComplete: { count: 100 },
//     removeOnFail: { count: 50 },
//   }
// )

// export const conversionWorker = new Worker(
//   'file-conversion',
//   async (job: Job<AssetProcessingJobData>) => {
//     const { assetId, jobType, options } = job.data

//     console.log(`🚀 Processing ${jobType} for asset ${assetId}`)

//     try {
//       // Extract the numeric job ID from BullMQ job ID
//       // const numericJobId = extractJobId(job?.id)
//       console.log(
//         // `📋 Processing job ID: ${numericJobId} (BullMQ ID: ${job.id})`
//       )

//       // Update job status to processing
//       // await updateJob(numericJobId, {
//       //   status: 'processing',
//       //   started_at: new Date(),
//       // })

//       // Get asset details
//       const asset = await getAssetById(assetId)
//       if (!asset) {
//         throw new Error(`Asset ${assetId} not found`)
//       }

//       // Process conversion
//       const result = await processConversion(asset, options)

//       // Update asset with processing results
//       await updateAsset(assetId, {
//         status: 'processed',
//         metadata: { ...asset.metadata, [jobType]: result },
//       })

//       // Update job status to completed
//       // await updateJob(numericJobId, {
//       //   status: 'completed',
//       //   progress: 100,
//       //   output_data: result,
//       //   completed_at: new Date(),
//       // })

//       console.log(`✅ ${jobType} completed for asset ${assetId}`)
//       return result
//     } catch (error) {
//       console.error(`❌ ${jobType} failed for asset ${assetId}:`, error)

//       // Update job status to failed
//       try {
//         const numericJobId = extractJobId(job.id)
//         await updateJob(numericJobId, {
//           status: 'failed',
//           error_message:
//             error instanceof Error ? error.message : 'Unknown error',
//         })
//       } catch (updateError) {
//         console.error('Failed to update job status to failed:', updateError)
//       }

//       throw error
//     }
//   },
//   {
//     connection: redis,
//     concurrency: 2,
//     removeOnComplete: { count: 100 },
//     removeOnFail: { count: 50 },
//   }
// )

// // Thumbnail generation
// async function processThumbnail(asset: any, options: any) {
//   console.log(`🖼️  Generating thumbnail for ${asset.filename}`)

//   // Download file from MinIO
//   const fileStream = await downloadFile(asset.storage_path)

//   // TODO: Implement actual thumbnail generation
//   // This would use libraries like sharp, jimp, or imagemagick

//   // For now, simulate processing
//   await new Promise((resolve) => setTimeout(resolve, 2000))

//   const thumbnailPath = `thumbnails/${asset.id}-thumb.jpg`

//   // TODO: Generate actual thumbnail and upload to MinIO
//   // await uploadFile(thumbnailPath, thumbnailBuffer)

//   return {
//     thumbnail_path: thumbnailPath,
//     dimensions: { width: 300, height: 300 },
//     generated_at: new Date(),
//   }
// }

// // Metadata extraction
// async function processMetadata(asset: any, options: any) {
//   console.log(`📊 Extracting metadata for ${asset.filename}`)

//   // Download file from MinIO
//   const fileStream = await downloadFile(asset.storage_path)

//   // TODO: Implement actual metadata extraction
//   // This would use libraries like exifr, music-metadata, etc.

//   // For now, simulate processing
//   await new Promise((resolve) => setTimeout(resolve, 1500))

//   return {
//     file_size: asset.file_size,
//     mime_type: asset.mime_type,
//     extracted_at: new Date(),
//     // Add more metadata fields based on file type
//   }
// }

// // File conversion
// async function processConversion(asset: any, options: any) {
//   console.log(`🔄 Converting file ${asset.filename}`)

//   // Download file from MinIO
//   const fileStream = await downloadFile(asset.storage_path)

//   // TODO: Implement actual file conversion
//   // This would use libraries like ffmpeg, sharp, etc.

//   // For now, simulate processing
//   await new Promise((resolve) => setTimeout(resolve, 3000))

//   return {
//     converted_format: options?.targetFormat || 'mp4',
//     conversion_time: new Date(),
//     // Add more conversion details
//   }
// }

// // Cleanup processing
// async function processCleanup(asset: any, options: any) {
//   console.log(`🧹 Cleaning up ${asset.filename}`)

//   // TODO: Implement cleanup logic
//   // - Remove temporary files
//   // - Clean up cache
//   // - Archive old files

//   await new Promise((resolve) => setTimeout(resolve, 1000))

//   return {
//     cleaned_at: new Date(),
//     temp_files_removed: 0,
//     cache_cleared: true,
//   }
// }

// // Handle worker events
// thumbnailWorker.on('completed', (job) => {
//   console.log(`✅ Thumbnail job ${job.id} completed successfully`)
// })

// thumbnailWorker.on('failed', (job, err) => {
//   if (job) {
//     console.error(`❌ Thumbnail job ${job.id} failed:`, err.message)
//   } else {
//     console.error(`❌ Thumbnail job failed:`, err.message)
//   }
// })

// metadataWorker.on('completed', (job) => {
//   console.log(`✅ Metadata job ${job.id} completed successfully`)
// })

// metadataWorker.on('failed', (job, err) => {
//   if (job) {
//     console.error(`❌ Metadata job ${job.id} failed:`, err.message)
//   } else {
//     console.error(`❌ Metadata job failed:`, err.message)
//   }
// })

// conversionWorker.on('completed', (job) => {
//   console.log(`✅ Conversion job ${job.id} completed successfully`)
// })

// conversionWorker.on('failed', (job, err) => {
//   if (job) {
//     console.error(`❌ Conversion job ${job.id} failed:`, err.message)
//   } else {
//     console.error(`❌ Conversion job failed:`, err.message)
//   }
// })

// // Graceful shutdown
// process.on('SIGTERM', async () => {
//   console.log('🛑 Shutting down workers...')
//   await Promise.all([
//     thumbnailWorker.close(),
//     metadataWorker.close(),
//     conversionWorker.close(),
//   ])
//   process.exit(0)
// })

// export default { thumbnailWorker, metadataWorker, conversionWorker }
