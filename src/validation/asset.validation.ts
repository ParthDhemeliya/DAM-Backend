import {
  validateString,
  validateNumber,
  validateInteger,
} from '../middleware/validation'
import {
  CreateAssetRequest,
  UpdateAssetRequest,
} from '../interfaces/asset.interface'

// Validate asset data before creation
export const validateAssetData = (assetData: CreateAssetRequest): void => {
  validateString(assetData.filename, 'filename')
  validateString(assetData.original_name, 'original_name')
  validateString(assetData.file_type, 'file_type')
  validateString(assetData.mime_type, 'mime_type')
  validateNumber(assetData.file_size, 'file_size', 1)
  validateString(assetData.storage_path, 'storage_path')
}

// Validate asset ID
export const validateAssetId = (id: number): void => {
  validateInteger(id, 'id', 1)
}

// Validate asset status
export const validateAssetStatus = (status: string): void => {
  const validStatuses = [
    'uploaded',
    'processing',
    'processed',
    'failed',
    'deleted',
  ]
  if (!validStatuses.includes(status)) {
    throw new Error(
      `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    )
  }
}

// Note: validateUploadOptions moved to upload.validation.ts to avoid duplicate exports

// Validate file conversion options
export const validateConversionOptions = (options: any): void => {
  if (!options.targetFormat) {
    throw new Error('targetFormat is required for file conversion')
  }

  const validFormats = [
    'jpeg',
    'jpg',
    'png',
    'webp',
    'gif',
    'bmp',
    'tiff',
    'mp4',
    'avi',
    'mov',
    'mp3',
    'wav',
    'aac',
  ]
  if (!validFormats.includes(options.targetFormat.toLowerCase())) {
    throw new Error(
      `Invalid target format. Must be one of: ${validFormats.join(', ')}`
    )
  }
}

// Validate thumbnail generation options
export const validateThumbnailOptions = (options: any): void => {
  if (options.size) {
    const sizeRegex = /^\d+x\d+$/
    if (!sizeRegex.test(options.size)) {
      throw new Error('Size must be in format: widthxheight (e.g., 300x300)')
    }
  }

  if (options.quality && (options.quality < 1 || options.quality > 100)) {
    throw new Error('Quality must be between 1 and 100')
  }
}

// Validate metadata extraction options
export const validateMetadataOptions = (options: any): void => {
  if (
    options.extractExif !== undefined &&
    typeof options.extractExif !== 'boolean'
  ) {
    throw new Error('extractExif must be a boolean')
  }

  if (
    options.extractIptc !== undefined &&
    typeof options.extractIptc !== 'boolean'
  ) {
    throw new Error('extractIptc must be a boolean')
  }
}
