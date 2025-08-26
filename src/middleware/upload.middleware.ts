import { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

// Configure multer for unlimited file uploads
const configureMulter = () => {
  const uploadDir = path.join(__dirname, '../../uploads')

  // Ensure upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir)
    },
    filename: (req, file, cb) => {
      // Generate unique filename with timestamp
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
      cb(
        null,
        file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)
      )
    },
  })

  return multer({
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024 * 1024, // 10GB limit (very high)
      files: 10, // Allow up to 10 files
      fieldSize: 10 * 1024 * 1024 * 1024, // 10GB field size limit
    },
    fileFilter: (req, file, cb) => {
      // Accept all file types for now
      cb(null, true)
    },
  })
}

// Create multer instance
const upload = configureMulter()

// Middleware to skip body parsing for upload routes
export const skipBodyParsingForUploads = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.path.startsWith('/api/upload')) {
    // Skip body parsing for upload routes to prevent interference with large files
    next()
  } else {
    next()
  }
}

// Middleware to handle upload timeouts
export const uploadTimeoutMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.path.startsWith('/api/upload')) {
    // Set extended timeout for upload routes
    req.setTimeout(0) // No timeout for uploads
    res.setTimeout(0) // No timeout for uploads

    // Add timeout to prevent hanging uploads
    const uploadTimeout = setTimeout(() => {
      console.error('Upload request timeout after 1 hour')
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Upload timeout - file too large or connection too slow',
          help: 'Try uploading smaller files or check your internet connection',
        })
      }
    }, 3600000) // 1 hour timeout

    // Clear timeout when request completes
    res.on('finish', () => {
      clearTimeout(uploadTimeout)
    })

    res.on('close', () => {
      clearTimeout(uploadTimeout)
    })
  }

  next()
}

// Multer upload middleware for single file
export const uploadSingle = upload.single('file')

// Multer upload middleware for multiple files
export const uploadMultiple = upload.array('files', 10)

// Multer upload middleware for any field
export const uploadAny = upload.any()

// Validation middleware for upload requests
export const validateUploadRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.path.startsWith('/api/upload')) {
    // Basic validation for upload requests
    if (!req.files && !req.file) {
      return res.status(400).json({
        success: false,
        error: 'No files provided for upload',
      })
    }
  }
  next()
}

// Error handling middleware for upload errors
export const handleUploadErrors = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof multer.MulterError) {
    console.error('Multer upload error:', error)

    switch (error.code) {
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: 'Too many files uploaded',
          help: 'Maximum 10 files allowed per upload',
        })
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: 'File too large',
          help: 'File size limit exceeded',
        })
      default:
        return res.status(400).json({
          success: false,
          error: 'File upload error',
          details: error.message,
        })
    }
  }

  next(error)
}

// Export the configured multer instance
export { upload }
