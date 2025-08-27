import { z } from 'zod';

// Job type validation schema
export const JobTypeSchema = z.enum([
  'thumbnail',
  'metadata',
  'conversion',
  'video_metadata',
  'video_transcode',
  'audio_metadata',
  'audio_conversion',
  'cleanup',
]);

// Job status validation schema
export const JobStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);

// Job priority validation schema (1-10)
export const JobPrioritySchema = z.number().int().min(1).max(10);

// Job progress validation schema (0-100)
export const JobProgressSchema = z.number().min(0).max(100);

// Asset ID validation schema
export const AssetIdSchema = z
  .number()
  .int()
  .positive('Asset ID must be a positive integer');

// Job input data validation schema
export const JobInputDataSchema = z
  .record(z.string(), z.any())
  .nullable()
  .optional();

// Job output data validation schema
export const JobOutputDataSchema = z
  .record(z.string(), z.any())
  .nullable()
  .optional();

// Job error message validation schema
export const JobErrorMessageSchema = z
  .string()
  .max(1000, 'Error message too long (maximum 1000 characters)')
  .nullable()
  .optional();

// Thumbnail options validation schema
export const ThumbnailOptionsSchema = z.object({
  size: z
    .string()
    .regex(/^\d+x\d+$/, 'Size must be in format: widthxheight (e.g., 300x300)')
    .optional(),
  quality: z.number().int().min(1).max(100).optional(),
  format: z.enum(['jpeg', 'jpg', 'png', 'webp']).optional(),
});

// Conversion options validation schema
export const ConversionOptionsSchema = z.object({
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
});

// Video options validation schema
export const VideoOptionsSchema = z.object({
  codec: z.enum(['h264', 'h265', 'vp9', 'av1']).optional(),
  bitrate: z.number().int().positive().optional(),
  resolution: z
    .string()
    .regex(/^\d+x\d+$/, 'Resolution must be in format: widthxheight')
    .optional(),
  fps: z.number().int().positive().optional(),
});

// Audio options validation schema
export const AudioOptionsSchema = z.object({
  codec: z.enum(['mp3', 'aac', 'wav', 'flac']).optional(),
  bitrate: z.number().int().positive().optional(),
  sampleRate: z.number().int().positive().optional(),
  channels: z.number().int().min(1).max(8).optional(),
});

// Job options validation schema based on job type
export const JobOptionsSchema = z.union([
  z.object({
    jobType: z.literal('thumbnail'),
    options: ThumbnailOptionsSchema,
  }),
  z.object({
    jobType: z.literal('conversion'),
    options: ConversionOptionsSchema,
  }),
  z.object({
    jobType: z.literal('video_metadata'),
    options: z.record(z.string(), z.any()).optional(),
  }),
  z.object({
    jobType: z.literal('video_transcode'),
    options: VideoOptionsSchema,
  }),
  z.object({
    jobType: z.literal('audio_metadata'),
    options: z.record(z.string(), z.any()).optional(),
  }),
  z.object({
    jobType: z.literal('audio_conversion'),
    options: AudioOptionsSchema,
  }),
  z.object({
    jobType: z.literal('cleanup'),
    options: z.record(z.string(), z.any()).optional(),
  }),
  z.object({
    jobType: z.literal('metadata'),
    options: z.record(z.string(), z.any()).optional(),
  }),
]);

// Complete job validation schema
export const JobValidationSchema = z.object({
  id: z.number().int().positive().optional(),
  type: JobTypeSchema,
  status: JobStatusSchema.optional(),
  priority: JobPrioritySchema.optional(),
  progress: JobProgressSchema.optional(),
  asset_id: AssetIdSchema,
  input_data: JobInputDataSchema,
  output_data: JobOutputDataSchema,
  error_message: JobErrorMessageSchema,
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  started_at: z.date().nullable().optional(),
  completed_at: z.date().nullable().optional(),
  options: z.record(z.string(), z.any()).optional(),
});

// Create job request schema
export const CreateJobRequestSchema = JobValidationSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  started_at: true,
  completed_at: true,
});

// Update job request schema
export const UpdateJobRequestSchema = JobValidationSchema.partial().omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Export types
export type JobType = z.infer<typeof JobTypeSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type JobPriority = z.infer<typeof JobPrioritySchema>;
export type JobProgress = z.infer<typeof JobProgressSchema>;
export type AssetId = z.infer<typeof AssetIdSchema>;
export type JobInputData = z.infer<typeof JobInputDataSchema>;
export type JobOutputData = z.infer<typeof JobOutputDataSchema>;
export type JobErrorMessage = z.infer<typeof JobErrorMessageSchema>;
export type ThumbnailOptions = z.infer<typeof ThumbnailOptionsSchema>;
export type ConversionOptions = z.infer<typeof ConversionOptionsSchema>;
export type VideoOptions = z.infer<typeof VideoOptionsSchema>;
export type AudioOptions = z.infer<typeof AudioOptionsSchema>;
export type JobOptions = z.infer<typeof JobOptionsSchema>;
export type JobValidation = z.infer<typeof JobValidationSchema>;
export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;
export type UpdateJobRequest = z.infer<typeof UpdateJobRequestSchema>;
