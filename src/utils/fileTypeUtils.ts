import {
  FileType,
  FILE_TYPE_MAPPING,
  FILE_SIZE_LIMITS,
  ALLOWED_EXTENSIONS,
} from '../interfaces/asset.interface'
import path from 'path'

// Detect file type from MIME type
export function detectFileType(mimeType: string): FileType {
  return FILE_TYPE_MAPPING[mimeType] || 'other'
}

// Detect file type from file extension
export function detectFileTypeFromExtension(filename: string): FileType {
  const ext = path.extname(filename).toLowerCase().slice(1)

  for (const [type, extensions] of Object.entries(ALLOWED_EXTENSIONS)) {
    if (extensions.includes(ext)) {
      return type as FileType
    }
  }

  return 'other'
}

// Validate file size based on file type
export function validateFileSize(
  fileSize: number,
  fileType: FileType
): boolean {
  const maxSize = FILE_SIZE_LIMITS[fileType]
  return fileSize <= maxSize
}

// Get file size limit for a specific file type
export function getFileSizeLimit(fileType: FileType): number {
  return FILE_SIZE_LIMITS[fileType]
}

// Format file size to human readable format
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Validate file extension
export function validateFileExtension(
  filename: string,
  fileType: FileType
): boolean {
  const ext = path.extname(filename).toLowerCase().slice(1)
  return ALLOWED_EXTENSIONS[fileType].includes(ext)
}

// Get allowed extensions for a file type
export function getAllowedExtensions(fileType: FileType): string[] {
  return ALLOWED_EXTENSIONS[fileType]
}

// Check if file type is supported
export function isFileTypeSupported(fileType: FileType): boolean {
  return fileType !== 'other'
}

// Get file type category (for grouping)
export function getFileTypeCategory(fileType: FileType): string {
  const categories: Record<FileType, string> = {
    image: 'Media',
    video: 'Media',
    audio: 'Media',
    document: 'Documents',
    spreadsheet: 'Documents',
    presentation: 'Documents',
    archive: 'Archives',
    code: 'Development',
    font: 'Design',
    '3d': '3D & Design',
    other: 'Other',
  }

  return categories[fileType]
}

// Extract basic metadata from file
export function extractBasicMetadata(
  filename: string,
  mimeType: string,
  fileSize: number
): {
  fileType: FileType
  extension: string
  category: string
  formattedSize: string
} {
  const fileType = detectFileType(mimeType)
  const extension = path.extname(filename).toLowerCase().slice(1)
  const category = getFileTypeCategory(fileType)
  const formattedSize = formatFileSize(fileSize)

  return {
    fileType,
    extension,
    category,
    formattedSize,
  }
}

// Generate storage path based on file type and date
export function generateStoragePath(
  filename: string,
  fileType: FileType,
  timestamp: number = Date.now()
): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  // Organize by type and date
  return `assets/${fileType}/${year}/${month}/${day}/${timestamp}-${filename}`
}

// Validate file for upload
export function validateFileForUpload(
  filename: string,
  mimeType: string,
  fileSize: number
): {
  isValid: boolean
  fileType: FileType
  errors: string[]
} {
  const errors: string[] = []
  const fileType = detectFileType(mimeType)

  // Check file type support
  if (!isFileTypeSupported(fileType)) {
    errors.push(`Unsupported file type: ${mimeType}`)
  }

  // Removed file size validation - no limits

  // Check file extension
  if (!validateFileExtension(filename, fileType)) {
    const allowed = getAllowedExtensions(fileType).join(', ')
    errors.push(`Invalid file extension. Allowed for ${fileType}: ${allowed}`)
  }

  return {
    isValid: errors.length === 0,
    fileType,
    errors,
  }
}
