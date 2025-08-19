import { validateString, validateNumber } from '../middleware/validation'

// File type validation
export const validateFileType = (fileType: string): void => {
  const validTypes = ['image', 'video', 'audio', 'document', 'archive', 'other']
  if (!validTypes.includes(fileType)) {
    throw new Error(
      `Invalid file type. Must be one of: ${validTypes.join(', ')}`
    )
  }
}

// MIME type validation
export const validateMimeType = (mimeType: string): void => {
  if (!mimeType || typeof mimeType !== 'string') {
    throw new Error('MIME type is required and must be a string')
  }

  // Basic MIME type format validation
  const mimeRegex = /^[a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9!#$&\-\^_]*$/
  if (!mimeRegex.test(mimeType)) {
    throw new Error('Invalid MIME type format')
  }
}

// File size validation
export const validateFileSize = (size: number, maxSize?: number): void => {
  validateNumber(size, 'file size', 1)

  if (maxSize && size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024))
    const actualSizeMB = Math.round(size / (1024 * 1024))
    throw new Error(
      `File size ${actualSizeMB}MB exceeds maximum allowed size ${maxSizeMB}MB`
    )
  }
}

// Filename validation
export const validateFilename = (filename: string): void => {
  validateString(filename, 'filename')

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*]/
  if (invalidChars.test(filename)) {
    throw new Error('Filename contains invalid characters: < > : " / \\ | ? *')
  }

  // Check length
  if (filename.length > 255) {
    throw new Error('Filename too long (maximum 255 characters)')
  }

  // Check for reserved names (Windows)
  const reservedNames = [
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'LPT1',
    'LPT2',
    'LPT3',
    'LPT4',
    'LPT5',
    'LPT6',
    'LPT7',
    'LPT8',
    'LPT9',
  ]
  const upperFilename = filename.toUpperCase()
  if (reservedNames.includes(upperFilename)) {
    throw new Error('Filename is a reserved system name')
  }
}

// File extension validation
export const validateFileExtension = (
  filename: string,
  allowedExtensions?: string[]
): void => {
  validateFilename(filename)

  if (allowedExtensions && allowedExtensions.length > 0) {
    const extension = filename.split('.').pop()?.toLowerCase()
    if (!extension || !allowedExtensions.includes(extension)) {
      throw new Error(
        `File extension not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`
      )
    }
  }
}

// Image-specific validation
export const validateImageFile = (mimeType: string, size: number): void => {
  const imageMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
  ]
  if (!imageMimes.includes(mimeType)) {
    throw new Error('File is not a valid image type')
  }

  // Max image size: 50MB
  validateFileSize(size, 50 * 1024 * 1024)
}

// Video-specific validation
export const validateVideoFile = (mimeType: string, size: number): void => {
  const videoMimes = [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/flv',
    'video/webm',
    'video/mkv',
  ]
  if (!videoMimes.includes(mimeType)) {
    throw new Error('File is not a valid video type')
  }

  // Max video size: 2GB
  validateFileSize(size, 2 * 1024 * 1024 * 1024)
}

// Audio-specific validation
export const validateAudioFile = (mimeType: string, size: number): void => {
  const audioMimes = [
    'audio/mp3',
    'audio/wav',
    'audio/aac',
    'audio/ogg',
    'audio/flac',
    'audio/m4a',
  ]
  if (!audioMimes.includes(mimeType)) {
    throw new Error('File is not a valid audio type')
  }

  // Max audio size: 100MB
  validateFileSize(size, 100 * 1024 * 1024)
}

// Document-specific validation
export const validateDocumentFile = (mimeType: string, size: number): void => {
  const documentMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ]
  if (!documentMimes.includes(mimeType)) {
    throw new Error('File is not a valid document type')
  }

  // Max document size: 25MB
  validateFileSize(size, 25 * 1024 * 1024)
}
