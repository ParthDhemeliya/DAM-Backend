import { Router, Request, Response, NextFunction } from 'express'
import Busboy from 'busboy'
import {
  uploadStreamAsset,
  uploadMultipleStreamAssets,
  StreamAssetInput,
} from '../services/streaming-upload.service'
import { asyncHandler } from '../middleware/asyncHandler'

const router = Router()

router.post(
  '/upload',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // TODO: Replace with real authenticated user ID from middleware
      const userId = parseInt(req.headers['x-user-id'] as string) || 1

      // Configure Busboy for streaming file handling
      const bb = Busboy({
        headers: req.headers,
        limits: {
          files: 300, // Maximum 300 files per request
          fileSize: 1024 * 1024 * 1024, // 1GB per file
          fields: 50, // Maximum 50 form fields
        },
      })

      const results: any[] = []
      const filePromises: Promise<void>[] = []
      let fileCount = 0
      let totalSize = 0

      // Handle each file as it arrives - accept any field name
      bb.on('file', (fieldname, file, info) => {
        const { filename, mimeType } = info
        fileCount++

        // Create stream input for the service
        const streamInput: StreamAssetInput = {
          filename: filename || `file-${fileCount}`,
          mimeType: mimeType,
          userId: userId,
          stream: file,
          metadata: {
            fieldname,
            uploadOrder: fileCount,
            uploadTimestamp: new Date().toISOString(),
          },
        }

        const uploadPromise = uploadStreamAsset(streamInput)
          .then((assetRecord) => {
            results.push(assetRecord)
            totalSize += assetRecord.size
          })
          .catch((error) => {
            console.error(`File upload failed: ${filename}`, error)
            // Add error info to results
            results.push({
              error: true,
              filename: filename || `file-${fileCount}`,
              message: error.message,
              uploadOrder: fileCount,
            })
          })

        filePromises.push(uploadPromise)
      })

      // Handle form fields (metadata)
      bb.on('field', (fieldname, value) => {})

      // Handle errors
      bb.on('error', (err) => {
        console.error('Busboy error:', err)
        next(err)
      })

      bb.on('close', async () => {
        try {
          // Wait for all uploads + DB inserts to finish
          await Promise.all(filePromises)

          const successCount = results.filter((r) => !r.error).length
          const errorCount = results.filter((r) => r.error).length

          // Return comprehensive response
          res.json({
            success: true,
            message: `Multi-file upload completed`,
            summary: {
              totalFiles: fileCount,
              successful: successCount,
              failed: errorCount,
              totalSize: totalSize,
              uploadTimestamp: new Date().toISOString(),
            },
            files: results,
          })
        } catch (error) {
          console.error('Error during upload processing:', error)
          next(error)
        }
      })

      // Pipe the request to Busboy for streaming processing
      req.pipe(bb)
    } catch (error) {
      console.error('Streaming upload route error:', error)
      next(error)
    }
  }
)

/**
 * Health check endpoint for streaming upload service
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Streaming upload service is healthy',
    timestamp: new Date().toISOString(),
    service: 'streaming-upload',
  })
})

/**
 * Get upload statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Upload statistics endpoint',
      timestamp: new Date().toISOString(),
    })
  })
)

export default router
