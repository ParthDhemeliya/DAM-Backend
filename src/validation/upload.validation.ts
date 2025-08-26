import { Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'

// Validation rules for upload requests
export const validateUploadRequest = [
  // Optional tags validation
  body('tags')
    .optional()
    .isString()
    .withMessage('Tags must be a string')
    .custom((value) => {
      if (value) {
        const tags = value.split(',')
        if (tags.length > 20) {
          throw new Error('Maximum 20 tags allowed')
        }
        // Validate each tag
        for (const tag of tags) {
          if (tag.trim().length > 50) {
            throw new Error('Each tag must be 50 characters or less')
          }
          if (!/^[a-zA-Z0-9\s\-_]+$/.test(tag.trim())) {
            throw new Error(
              'Tags can only contain letters, numbers, spaces, hyphens, and underscores'
            )
          }
        }
      }
      return true
    }),

  // Optional metadata validation
  body('metadata')
    .optional()
    .isString()
    .withMessage('Metadata must be a JSON string')
    .custom((value) => {
      if (value) {
        try {
          const parsed = JSON.parse(value)
          if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Metadata must be a valid JSON object')
          }
          // Check metadata size limit (1MB)
          const metadataSize = JSON.stringify(parsed).length
          if (metadataSize > 1024 * 1024) {
            throw new Error('Metadata size exceeds 1MB limit')
          }
          return true
        } catch (error) {
          throw new Error('Invalid JSON format for metadata')
        }
      }
      return true
    }),

  // Optional category validation
  body('category')
    .optional()
    .isString()
    .withMessage('Category must be a string')
    .isLength({ min: 1, max: 100 })
    .withMessage('Category must be between 1 and 100 characters'),

  // Optional description validation
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Description must be between 1 and 1000 characters'),

  // Process validation results
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array().map((err: any) => ({
          field: err.path || 'unknown',
          message: err.msg || 'Validation error',
          value: err.value || 'unknown',
        })),
      })
    }
    next()
  },
]

// Validation for file type checking
export const validateFileType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.files && !req.file) {
      return next()
    }

    const files = req.files
      ? Array.isArray(req.files)
        ? req.files
        : Object.values(req.files).flat()
      : [req.file]

    for (const file of files) {
      if (file && !allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          error: 'File type not allowed',
          details: {
            filename: file.originalname,
            mimetype: file.mimetype,
            allowedTypes: allowedTypes,
          },
        })
      }
    }

    next()
  }
}

// Validation for file size checking (optional, since we have unlimited uploads)
export const validateFileSize = (maxSizeInBytes: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.files && !req.file) {
      return next()
    }

    const files = req.files
      ? Array.isArray(req.files)
        ? req.files
        : Object.values(req.files).flat()
      : [req.file]

    for (const file of files) {
      if (file && file.size > maxSizeInBytes) {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds limit',
          details: {
            filename: file.originalname,
            size: file.size,
            maxSize: maxSizeInBytes,
            sizeInMB: (file.size / (1024 * 1024)).toFixed(2),
          },
        })
      }
    }

    next()
  }
}

// Validation for number of files
export const validateFileCount = (maxFiles: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.files && !req.file) {
      return next()
    }

    const files = req.files
      ? Array.isArray(req.files)
        ? req.files
        : Object.values(req.files).flat()
      : [req.file]

    if (files.length > maxFiles) {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        details: {
          uploaded: files.length,
          maxAllowed: maxFiles,
        },
      })
    }

    next()
  }
}

// Validation for upload options
export const validateUploadOptions = (options: any): void => {
  if (options && typeof options !== 'object') {
    throw new Error('Upload options must be an object')
  }

  if (
    options?.skipDuplicates !== undefined &&
    typeof options.skipDuplicates !== 'boolean'
  ) {
    throw new Error('skipDuplicates must be a boolean')
  }

  if (
    options?.replaceDuplicates !== undefined &&
    typeof options.replaceDuplicates !== 'boolean'
  ) {
    throw new Error('replaceDuplicates must be a boolean')
  }

  if (options?.category && typeof options.category !== 'string') {
    throw new Error('category must be a string')
  }

  if (options?.description && typeof options.description !== 'string') {
    throw new Error('description must be a string')
  }

  if (options?.description && options.description.length > 500) {
    throw new Error('description too long (maximum 500 characters)')
  }
}
