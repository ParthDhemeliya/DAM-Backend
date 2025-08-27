import { z } from 'zod';

// File type validation schema
export const FileTypeSchema = z.enum([
  'image',
  'video',
  'audio',
  'document',
  'archive',
  'other',
]);

// Asset status validation schema
export const AssetStatusSchema = z.enum([
  'uploaded',
  'processing',
  'processed',
  'failed',
  'deleted',
]);

// MIME type validation schema
export const MimeTypeSchema = z
  .string()
  .regex(
    /^[a-zA-Z0-9!#$%&'*+-.^_`|~]+\/[a-zA-Z0-9!#$%&'*+-.^_`|~]+$/,
    'Invalid MIME type format'
  );

// File size validation schema (in bytes)
export const FileSizeSchema = z
  .number()
  .int()
  .positive('File size must be a positive integer');

// Storage path validation schema
export const StoragePathSchema = z.string().min(1, 'Storage path is required');

// Metadata validation schema
export const MetadataSchema = z.record(z.string(), z.any()).optional();

// Basic asset validation schema
export const AssetBaseSchema = z.object({
  filename: z
    .string()
    .min(1, 'Filename is required')
    .max(255, 'Filename too long'),
  original_name: z
    .string()
    .min(1, 'Original name is required')
    .max(255, 'Original name too long'),
  file_type: FileTypeSchema,
  mime_type: MimeTypeSchema,
  file_size: FileSizeSchema,
  storage_path: StoragePathSchema,
  metadata: MetadataSchema,
});

// Create asset request schema
export const CreateAssetRequestSchema = AssetBaseSchema;

// Update asset request schema
export const UpdateAssetRequestSchema = AssetBaseSchema.partial();

// Asset ID validation schema
export const AssetIdSchema = z
  .number()
  .int()
  .positive('Asset ID must be a positive integer');

// Asset search filters schema
export const AssetSearchFiltersSchema = z.object({
  file_type: FileTypeSchema.optional(),
  status: AssetStatusSchema.optional(),
  min_file_size: FileSizeSchema.optional(),
  max_file_size: FileSizeSchema.optional(),
  created_after: z.date().optional(),
  created_before: z.date().optional(),
  updated_after: z.date().optional(),
  updated_before: z.date().optional(),
  mime_type: z.string().optional(),
  filename: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Asset pagination schema
export const AssetPaginationSchema = z.object({
  page: z
    .number()
    .int()
    .min(1, 'Page must be at least 1')
    .optional()
    .default(1),
  limit: z
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .optional()
    .default(20),
  sort_by: z
    .enum(['filename', 'file_size', 'created_at', 'updated_at'])
    .optional()
    .default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Asset search request schema
export const AssetSearchRequestSchema = z.object({
  filters: AssetSearchFiltersSchema.optional(),
  pagination: AssetPaginationSchema.optional(),
  search_query: z.string().optional(),
});

// File conversion options schema
export const FileConversionOptionsSchema = z.object({
  targetFormat: z.enum([
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
  ]),
  quality: z.number().int().min(1).max(100).optional(),
  resize: z
    .object({
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      maintainAspectRatio: z.boolean().optional(),
    })
    .optional(),
  compression: z
    .object({
      level: z.number().int().min(0).max(9).optional(),
      progressive: z.boolean().optional(),
    })
    .optional(),
});

// Thumbnail generation options schema
export const ThumbnailOptionsSchema = z.object({
  size: z
    .string()
    .regex(/^\d+x\d+$/, 'Size must be in format: widthxheight (e.g., 300x300)')
    .optional(),
  quality: z.number().int().min(1).max(100).optional(),
  format: z.enum(['jpeg', 'jpg', 'png', 'webp']).optional(),
  crop: z.enum(['center', 'top', 'bottom', 'left', 'right']).optional(),
  background: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Background must be a valid hex color')
    .optional(),
});

// Metadata extraction options schema
export const MetadataExtractionOptionsSchema = z.object({
  extractExif: z.boolean().optional().default(true),
  extractIptc: z.boolean().optional().default(true),
  extractXmp: z.boolean().optional().default(true),
  extractVideoMetadata: z.boolean().optional().default(true),
  extractAudioMetadata: z.boolean().optional().default(true),
  extractImageMetadata: z.boolean().optional().default(true),
});

// Asset processing options schema
export const AssetProcessingOptionsSchema = z.object({
  conversion: FileConversionOptionsSchema.optional(),
  thumbnail: ThumbnailOptionsSchema.optional(),
  metadata: MetadataExtractionOptionsSchema.optional(),
  cleanup: z
    .object({
      removeOriginal: z.boolean().optional().default(false),
      keepBackup: z.boolean().optional().default(true),
    })
    .optional(),
});

// Complete asset schema (for database operations)
export const AssetSchema = AssetBaseSchema.extend({
  id: AssetIdSchema,
  status: AssetStatusSchema.optional().default('uploaded'),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  deleted_at: z.date().nullable().optional(),
  user_id: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  is_public: z.boolean().optional().default(false),
});

// Asset response schema (for API responses)
export const AssetResponseSchema = AssetSchema.omit({
  storage_path: true, // Don't expose internal storage paths
  deleted_at: true, // Don't expose deletion timestamps
});

// Asset list response schema
export const AssetListResponseSchema = z.object({
  assets: z.array(AssetResponseSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
  filters: AssetSearchFiltersSchema.optional(),
});

// Export types
export type FileType = z.infer<typeof FileTypeSchema>;
export type AssetStatus = z.infer<typeof AssetStatusSchema>;
export type MimeType = z.infer<typeof MimeTypeSchema>;
export type FileSize = z.infer<typeof FileSizeSchema>;
export type StoragePath = z.infer<typeof StoragePathSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type AssetBase = z.infer<typeof AssetBaseSchema>;
export type CreateAssetRequest = z.infer<typeof CreateAssetRequestSchema>;
export type UpdateAssetRequest = z.infer<typeof UpdateAssetRequestSchema>;
export type AssetId = z.infer<typeof AssetIdSchema>;
export type AssetSearchFilters = z.infer<typeof AssetSearchFiltersSchema>;
export type AssetPagination = z.infer<typeof AssetPaginationSchema>;
export type AssetSearchRequest = z.infer<typeof AssetSearchRequestSchema>;
export type FileConversionOptions = z.infer<typeof FileConversionOptionsSchema>;
export type ThumbnailOptions = z.infer<typeof ThumbnailOptionsSchema>;
export type MetadataExtractionOptions = z.infer<
  typeof MetadataExtractionOptionsSchema
>;
export type AssetProcessingOptions = z.infer<
  typeof AssetProcessingOptionsSchema
>;
export type Asset = z.infer<typeof AssetSchema>;
export type AssetResponse = z.infer<typeof AssetResponseSchema>;
export type AssetListResponse = z.infer<typeof AssetListResponseSchema>;
