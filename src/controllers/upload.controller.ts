import { Request, Response } from 'express'
import { uploadAssetFile } from '../services/asset.service'

export class UploadController {
  /**
   * Handle file upload with Multer
   */
  static async handleUpload(req: Request, res: Response) {
    try {
      console.log('UPLOAD ROUTE - Starting Multer upload:', {
        files: req.files,
        body: req.body,
      })

      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files were uploaded',
        })
      }

      const uploadedFiles: any[] = []

      // Process each uploaded file
      for (const [fieldName, file] of Object.entries(req.files)) {
        if (Array.isArray(file)) {
          // Handle multiple files in the same field
          for (const singleFile of file) {
            const fileObj = {
              fieldname: singleFile.fieldname,
              originalname: singleFile.originalname,
              encoding: singleFile.encoding,
              mimetype: singleFile.mimetype,
              size: singleFile.size,
              destination: singleFile.destination,
              filename: singleFile.filename,
              path: singleFile.path,
              sha256: '', // Will be calculated during upload
              timestamp: Date.now(),
            }

            // Process the uploaded file
            console.log('Processing uploaded file...')
            const result = await uploadAssetFile(fileObj, {
              category: 'upload',
              description: 'Uploaded via API',
              tags: req.body.tags ? req.body.tags.split(',') : [],
              metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
            })

            uploadedFiles.push({
              filename: singleFile.originalname,
              size: singleFile.size,
              mimetype: singleFile.mimetype,
              assetId: result.assetId,
              message: 'File uploaded successfully',
            })
          }
        } else {
          // Handle single file
          const fileObj = {
            fieldname: file.fieldname,
            originalname: file.originalname,
            encoding: file.encoding,
            mimetype: file.mimetype,
            size: file.size,
            destination: file.destination,
            filename: file.filename,
            path: file.path,
            sha256: '', // Will be calculated during upload
            timestamp: Date.now(),
          }

          // Process the uploaded file
          console.log('Processing uploaded file...')
          const result = await uploadAssetFile(fileObj, {
            category: 'upload',
            description: 'Uploaded via API',
            tags: req.body.tags ? req.body.tags.split(',') : [],
            metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
          })

          uploadedFiles.push({
            filename: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            assetId: result.assetId,
            message: 'File uploaded successfully',
          })
        }
      }

      const response = {
        success: true,
        message: 'Upload completed',
        summary: {
          total: uploadedFiles.length,
          uploaded: uploadedFiles.length,
          files: uploadedFiles,
        },
      }

      console.log('Upload completed successfully:', response.summary)
      res.status(200).json(response)
    } catch (error) {
      console.error('Upload processing error:', error)
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Upload processing failed',
        help: 'Check the file format and try again',
      })
    }
  }

  /**
   * Handle large file upload with streaming
   */
  static async handleLargeUpload(req: Request, res: Response) {
    try {
      console.log('Starting large file upload with extended timeouts...')

      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files were uploaded',
        })
      }

      const uploadedFiles: any[] = []

      // Process each uploaded file
      for (const [fieldName, file] of Object.entries(req.files)) {
        if (Array.isArray(file)) {
          // Handle multiple files in the same field
          for (const singleFile of file) {
            const fileObj = {
              fieldname: singleFile.fieldname,
              originalname: singleFile.originalname,
              encoding: singleFile.encoding,
              mimetype: singleFile.mimetype,
              size: singleFile.size,
              destination: singleFile.destination,
              filename: singleFile.filename,
              path: singleFile.path,
              sha256: '', // Will be calculated during upload
              timestamp: Date.now(),
            }

            // Process the uploaded file
            console.log('Processing large uploaded file...')
            const result = await uploadAssetFile(fileObj, {
              category: 'upload',
              description: 'Large file uploaded via API',
              tags: req.body.tags ? req.body.tags.split(',') : [],
              metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
            })

            uploadedFiles.push({
              filename: singleFile.originalname,
              size: singleFile.size,
              mimetype: singleFile.mimetype,
              assetId: result.assetId,
              message: 'Large file uploaded successfully',
            })
          }
        } else {
          // Handle single file
          const fileObj = {
            fieldname: file.fieldname,
            originalname: file.originalname,
            encoding: file.encoding,
            mimetype: file.mimetype,
            size: file.size,
            destination: file.destination,
            filename: file.filename,
            path: file.path,
            sha256: '', // Will be calculated during upload
            timestamp: Date.now(),
          }

          // Process the uploaded file
          console.log('Processing large uploaded file...')
          const result = await uploadAssetFile(fileObj, {
            category: 'upload',
            description: 'Large file uploaded via API',
            tags: req.body.tags ? req.body.tags.split(',') : [],
            metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
          })

          uploadedFiles.push({
            filename: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            assetId: result.assetId,
            message: 'Large file uploaded successfully',
          })
        }
      }

      const response = {
        success: true,
        message: 'Large file upload completed',
        summary: {
          total: uploadedFiles.length,
          uploaded: uploadedFiles.length,
          files: uploadedFiles,
        },
      }

      console.log('Large file upload completed successfully:', response.summary)
      res.status(200).json(response)
    } catch (error) {
      console.error('Large upload error:', error)
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Large file upload failed',
        help: 'Check the file format and try again',
      })
    }
  }

  /**
   * Get upload configuration info
   */
  static getUploadConfig(req: Request, res: Response) {
    res.status(200).json({
      success: true,
      message: 'Multer upload configuration debug info',
      config: {
        name: 'Multer Upload - Simple and Reliable',
        features: [
          'Multer properly configured for unlimited file uploads',
          'No file size limits - truly unlimited uploads',
          'Proper error handling and validation',
          'Support for multiple file uploads',
          'Metadata and tags support',
        ],
      },
    })
  }
}
