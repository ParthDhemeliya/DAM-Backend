import { validateString, validateNumber } from '../middleware/validation'
import {
  validateFilename,
  validateMimeType,
  validateFileSize,
} from './file.validation'

// Upload request validation
export const validateUploadRequest = (files: Express.Multer.File[]): void => {
  if (!files || !Array.isArray(files)) {
    throw new Error('Files must be an array')
  }

  if (files.length === 0) {
    throw new Error('At least one file must be provided')
  }

  if (files.length > 50) {
    throw new Error('Maximum 50 files can be uploaded at once')
  }

  // Validate each file
  for (const file of files) {
    validateUploadedFile(file)
  }
}

// Individual uploaded file validation
export const validateUploadedFile = (file: Express.Multer.File): void => {
  if (!file) {
    throw new Error('File object is required')
  }

  // Check required properties
  if (!file.originalname) {
    throw new Error('File originalname is required')
  }

  if (!file.mimetype) {
    throw new Error('File mimetype is required')
  }

  if (!file.size && file.size !== 0) {
    throw new Error('File size is required')
  }

  if (!file.buffer) {
    throw new Error('File buffer is required')
  }

  // Validate file properties
  validateFilename(file.originalname)
  validateMimeType(file.mimetype)
  validateFileSize(file.size)

  // Validate file buffer
  validateFileBuffer(file.buffer)
}

// File buffer validation
export const validateFileBuffer = (buffer: Buffer): void => {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('File must be a valid buffer')
  }

  if (buffer.length === 0) {
    throw new Error('File cannot be empty')
  }

  // Check for maximum file size (100MB default)
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '104857600')
  if (buffer.length > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024))
    const actualSizeMB = Math.round(buffer.length / (1024 * 1024))
    throw new Error(
      `File size ${actualSizeMB}MB exceeds maximum allowed size ${maxSizeMB}MB`
    )
  }
}

// Upload options validation
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

// Metadata validation for uploads
export const validateUploadMetadata = (metadata: any): void => {
  if (metadata && typeof metadata !== 'object') {
    throw new Error('Metadata must be an object')
  }

  if (metadata?.tags && !Array.isArray(metadata.tags)) {
    throw new Error('Tags must be an array')
  }

  if (metadata?.tags && metadata.tags.length > 20) {
    throw new Error('Maximum 20 tags allowed')
  }

  if (metadata?.tags) {
    for (const tag of metadata.tags) {
      if (typeof tag !== 'string') {
        throw new Error('All tags must be strings')
      }
      if (tag.length > 50) {
        throw new Error('Individual tag too long (maximum 50 characters)')
      }
    }
  }

  if (metadata?.customFields && typeof metadata.customFields !== 'object') {
    throw new Error('Custom fields must be an object')
  }

  if (metadata?.customFields) {
    for (const [key, value] of Object.entries(metadata.customFields)) {
      if (typeof key !== 'string' || key.length > 50) {
        throw new Error('Custom field key too long (maximum 50 characters)')
      }
      if (
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean'
      ) {
        throw new Error(
          'Custom field values must be string, number, or boolean'
        )
      }
      if (typeof value === 'string' && value.length > 500) {
        throw new Error('Custom field value too long (maximum 500 characters)')
      }
    }
  }
}

// Batch upload validation
export const validateBatchUpload = (
  files: Express.Multer.File[],
  options?: any
): void => {
  validateUploadRequest(files)

  if (options) {
    validateUploadOptions(options)
  }

  // Check for duplicate filenames in the same batch
  const filenames = files.map((f) => f.originalname)
  const uniqueFilenames = new Set(filenames)

  if (filenames.length !== uniqueFilenames.size) {
    throw new Error('Duplicate filenames detected in upload batch')
  }

  // Check total size of all files
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const maxBatchSize = parseInt(process.env.MAX_BATCH_SIZE || '524288000') // 500MB default

  if (totalSize > maxBatchSize) {
    const maxBatchSizeMB = Math.round(maxBatchSize / (1024 * 1024))
    const actualBatchSizeMB = Math.round(totalSize / (1024 * 1024))
    throw new Error(
      `Total batch size ${actualBatchSizeMB}MB exceeds maximum allowed size ${maxBatchSizeMB}MB`
    )
  }
}

// File type specific upload validation
export const validateFileTypeUpload = (
  file: Express.Multer.File,
  allowedTypes?: string[]
): void => {
  validateUploadedFile(file)

  if (allowedTypes && allowedTypes.length > 0) {
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase()
    if (!fileExtension || !allowedTypes.includes(fileExtension)) {
      throw new Error(
        `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
      )
    }
  }
}

// Image upload validation
export const validateImageUpload = (file: Express.Multer.File): void => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff']
  validateFileTypeUpload(file, imageExtensions)

  const imageMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
  ]
  if (!imageMimes.includes(file.mimetype)) {
    throw new Error('File is not a valid image type')
  }
}

// Video upload validation
export const validateVideoUpload = (file: Express.Multer.File): void => {
  const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv']
  validateFileTypeUpload(file, videoExtensions)

  const videoMimes = [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/flv',
    'video/webm',
    'video/mkv',
  ]
  if (!videoMimes.includes(file.mimetype)) {
    throw new Error('File is not a valid video type')
  }
}

// Audio upload validation
export const validateAudioUpload = (file: Express.Multer.File): void => {
  const audioExtensions = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a']
  validateFileTypeUpload(file, audioExtensions)

  const audioMimes = [
    'audio/mp3',
    'audio/wav',
    'audio/aac',
    'audio/ogg',
    'audio/flac',
    'audio/m4a',
  ]
  if (!audioMimes.includes(file.mimetype)) {
    throw new Error('File is not a valid audio type')
  }
}

// Document upload validation
export const validateDocumentUpload = (file: Express.Multer.File): void => {
  const documentExtensions = ['pdf', 'doc', 'docx', 'txt', 'rtf']
  validateFileTypeUpload(file, documentExtensions)

  const documentMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf',
  ]
  if (!documentMimes.includes(file.mimetype)) {
    throw new Error('File is not a valid document type')
  }
}
