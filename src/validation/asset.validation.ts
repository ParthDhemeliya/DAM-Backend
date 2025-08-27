import {
  Asset,
  FileType,
  AssetStatus,
  CreateAssetRequest,
} from '../interfaces/asset.interface';
import {
  validateString,
  validateNumber,
  validateInteger,
} from '../middleware/validation';

// Validate asset data before creation
export const validateAssetData = (assetData: CreateAssetRequest): void => {
  validateString(assetData.filename, 'filename');
  validateString(assetData.original_name, 'original_name');
  validateString(assetData.file_type, 'file_type');
  validateString(assetData.mime_type, 'mime_type');
  validateNumber(assetData.file_size, 'file_size', 1);
  validateString(assetData.storage_path, 'storage_path');
};

// Validate asset ID
export const validateAssetId = (id: number): void => {
  validateInteger(id, 'id', 1);
};

// Validate asset status
export const validateAssetStatus = (status: string): void => {
  const validStatuses = [
    'uploaded',
    'processing',
    'processed',
    'failed',
    'deleted',
  ];
  if (!validStatuses.includes(status)) {
    throw new Error(
      `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    );
  }
};

// Note: validateUploadOptions moved to upload.validation.ts to avoid duplicate exports

// Validate file conversion options
export const validateConversionOptions = (options: any): void => {
  if (!options.targetFormat) {
    throw new Error('targetFormat is required for file conversion');
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
  ];
  if (!validFormats.includes(options.targetFormat.toLowerCase())) {
    throw new Error(
      `Invalid target format. Must be one of: ${validFormats.join(', ')}`
    );
  }
};

// Validate thumbnail generation options
export const validateThumbnailOptions = (options: any): void => {
  if (options.size) {
    const sizeRegex = /^\d+x\d+$/;
    if (!sizeRegex.test(options.size)) {
      throw new Error('Size must be in format: widthxheight (e.g., 300x300)');
    }
  }

  if (options.quality && (options.quality < 1 || options.quality > 100)) {
    throw new Error('Quality must be between 1 and 100');
  }
};

// Validate metadata extraction options
export const validateMetadataOptions = (options: any): void => {
  if (
    options.extractExif !== undefined &&
    typeof options.extractExif !== 'boolean'
  ) {
    throw new Error('extractExif must be a boolean');
  }

  if (
    options.extractIptc !== undefined &&
    typeof options.extractIptc !== 'boolean'
  ) {
    throw new Error('extractIptc must be a boolean');
  }
};

// Validation for asset retrieval filters
export const validateAssetFilters = (filters: any) => {
  const errors: string[] = [];

  // Validate file type
  if (filters.fileType) {
    const validFileTypes = [
      'image',
      'video',
      'audio',
      'document',
      'spreadsheet',
      'presentation',
      'archive',
      'code',
      'font',
      '3d',
      'other',
    ];
    if (!validFileTypes.includes(filters.fileType)) {
      errors.push(
        `Invalid file type. Must be one of: ${validFileTypes.join(', ')}`
      );
    }
  }

  // Validate status
  if (filters.status) {
    const validStatuses = [
      'uploaded',
      'processing',
      'processed',
      'failed',
      'deleted',
    ];
    if (!validStatuses.includes(filters.status)) {
      errors.push(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      );
    }
  }

  // Validate date format
  if (filters.dateFrom && !isValidDate(filters.dateFrom)) {
    errors.push('Invalid dateFrom format. Use YYYY-MM-DD or ISO 8601 format');
  }

  if (filters.dateTo && !isValidDate(filters.dateTo)) {
    errors.push('Invalid dateTo format. Use YYYY-MM-DD or ISO 8601 format');
  }

  // Validate date range
  if (filters.dateFrom && filters.dateTo) {
    const fromDate = new Date(filters.dateFrom);
    const toDate = new Date(filters.dateTo);
    if (fromDate > toDate) {
      errors.push('dateFrom cannot be later than dateTo');
    }
  }

  // Validate tags array
  if (filters.tags && !Array.isArray(filters.tags)) {
    errors.push('tags must be an array');
  }

  // Validate sort options
  const validSortFields = ['created_at', 'updated_at', 'filename', 'file_size'];
  if (filters.sortBy && !validSortFields.includes(filters.sortBy)) {
    errors.push(
      `Invalid sortBy. Must be one of: ${validSortFields.join(', ')}`
    );
  }

  const validSortOrders = ['ASC', 'DESC'];
  if (
    filters.sortOrder &&
    !validSortOrders.includes(filters.sortOrder.toUpperCase())
  ) {
    errors.push(
      `Invalid sortOrder. Must be one of: ${validSortOrders.join(', ')}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Validation for pagination parameters
export const validatePagination = (pagination: any) => {
  const errors: string[] = [];

  const page = parseInt(pagination.page);
  const limit = parseInt(pagination.limit);

  if (isNaN(page) || page < 1) {
    errors.push('page must be a positive integer');
  }

  if (isNaN(limit) || limit < 1 || limit > 100) {
    errors.push('limit must be between 1 and 100');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Validation for search parameters
export const validateSearchParams = (search: any) => {
  const errors: string[] = [];

  if (
    !search.query ||
    typeof search.query !== 'string' ||
    search.query.trim().length === 0
  ) {
    errors.push('Search query is required and must not be empty');
  }

  if (search.query && search.query.trim().length < 2) {
    errors.push('Search query must be at least 2 characters long');
  }

  // Validate other search parameters
  const filterValidation = validateAssetFilters(search);
  if (!filterValidation.isValid) {
    errors.push(...filterValidation.errors);
  }

  const paginationValidation = validatePagination(search);
  if (!paginationValidation.isValid) {
    errors.push(...paginationValidation.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Validation for batch access parameters
export const validateBatchAccess = (params: any) => {
  const errors: string[] = [];

  if (!params.assetIds || !Array.isArray(params.assetIds)) {
    errors.push('assetIds must be an array');
  } else {
    if (params.assetIds.length === 0) {
      errors.push('assetIds array cannot be empty');
    }

    if (params.assetIds.length > 100) {
      errors.push('Maximum 100 assets can be accessed at once');
    }

    // Validate each asset ID
    params.assetIds.forEach((id: any, index: number) => {
      if (!Number.isInteger(id) || id < 1) {
        errors.push(
          `Invalid asset ID at index ${index}: must be a positive integer`
        );
      }
    });
  }

  if (params.expiresIn) {
    const expiresIn = parseInt(params.expiresIn);
    if (isNaN(expiresIn) || expiresIn < 60 || expiresIn > 86400) {
      errors.push(
        'expiresIn must be between 60 and 86400 seconds (1 minute to 24 hours)'
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Helper function to validate date format
const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};
