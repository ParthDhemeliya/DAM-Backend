import { z } from 'zod';
import {
  MetadataJobDataSchema,
  MetadataOptionsSchema,
} from '../workers/metadata.worker';
import {
  CreateAssetRequestSchema,
  UpdateAssetRequestSchema,
  AssetSearchRequestSchema,
  FileConversionOptionsSchema,
  ThumbnailOptionsSchema,
  MetadataExtractionOptionsSchema,
} from './asset.zod';
import {
  CreateJobRequestSchema,
  UpdateJobRequestSchema,
  JobTypeSchema,
  JobStatusSchema,
} from './job.zod';

// Generic validation function with proper error handling
export function validateWithZod<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map(issue => {
        const path = issue.path.join('.');
        return context
          ? `${context}.${path}: ${issue.message}`
          : `${path}: ${issue.message}`;
      });
      return { success: false, errors };
    }
    return {
      success: false,
      errors: ['Unknown validation error occurred'],
    };
  }
}

// Safe validation function that returns undefined on failure
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T | undefined {
  try {
    return schema.parse(data);
  } catch {
    return undefined;
  }
}

// Validation functions for specific schemas
export const validateMetadataJobData = (data: unknown) =>
  validateWithZod(MetadataJobDataSchema, data, 'MetadataJobData');

export const validateMetadataOptions = (data: unknown) =>
  validateWithZod(MetadataOptionsSchema, data, 'MetadataOptions');

export const validateCreateAssetRequest = (data: unknown) =>
  validateWithZod(CreateAssetRequestSchema, data, 'CreateAssetRequest');

export const validateUpdateAssetRequest = (data: unknown) =>
  validateWithZod(UpdateAssetRequestSchema, data, 'UpdateAssetRequest');

export const validateAssetSearchRequest = (data: unknown) =>
  validateWithZod(AssetSearchRequestSchema, data, 'AssetSearchRequest');

export const validateFileConversionOptions = (data: unknown) =>
  validateWithZod(FileConversionOptionsSchema, data, 'FileConversionOptions');

export const validateThumbnailOptions = (data: unknown) =>
  validateWithZod(ThumbnailOptionsSchema, data, 'ThumbnailOptions');

export const validateMetadataExtractionOptions = (data: unknown) =>
  validateWithZod(
    MetadataExtractionOptionsSchema,
    data,
    'MetadataExtractionOptions'
  );

export const validateCreateJobRequest = (data: unknown) =>
  validateWithZod(CreateJobRequestSchema, data, 'CreateJobRequest');

export const validateUpdateJobRequest = (data: unknown) =>
  validateWithZod(UpdateJobRequestSchema, data, 'UpdateJobRequest');

export const validateJobType = (data: unknown) =>
  validateWithZod(JobTypeSchema, data, 'JobType');

export const validateJobStatus = (data: unknown) =>
  validateWithZod(JobStatusSchema, data, 'JobStatus');

// Example usage functions
export function processMetadataJobData(data: unknown) {
  const validation = validateMetadataJobData(data);

  if (!validation.success) {
    console.error('Metadata job data validation failed:', validation.errors);
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  // Now we have type-safe data
  const { assetId, jobId, options } = validation.data;

  // TypeScript knows the exact types here
  console.log(`Processing metadata job ${jobId} for asset ${assetId}`);

  if (options) {
    console.log('Metadata options:', {
      extractExif: options.extractExif,
      extractIptc: options.extractIptc,
      extractXmp: options.extractXmp,
    });
  }

  return validation.data;
}

export function processAssetCreation(data: unknown) {
  const validation = validateCreateAssetRequest(data);

  if (!validation.success) {
    console.error('Asset creation validation failed:', validation.errors);
    throw new Error(`Asset validation failed: ${validation.errors.join(', ')}`);
  }

  // TypeScript knows this is a valid CreateAssetRequest
  const assetData = validation.data;

  console.log('Creating asset:', {
    filename: assetData.filename,
    fileType: assetData.file_type,
    fileSize: assetData.file_size,
    mimeType: assetData.mime_type,
  });

  return assetData;
}

export function processJobCreation(data: unknown) {
  const validation = validateCreateJobRequest(data);

  if (!validation.success) {
    console.error('Job creation validation failed:', validation.errors);
    throw new Error(`Job validation failed: ${validation.errors.join(', ')}`);
  }

  // TypeScript knows this is a valid CreateJobRequest
  const jobData = validation.data;

  console.log('Creating job:', {
    type: jobData.type,
    assetId: jobData.asset_id,
    priority: jobData.priority || 'default',
  });

  return jobData;
}

// Utility function to extract validation errors for API responses
export function formatValidationErrors(error: z.ZodError): {
  message: string;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
} {
  return {
    message: 'Validation failed',
    errors: error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  };
}

// Export types for convenience
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: string[] };

export type ValidationError = {
  message: string;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
};
