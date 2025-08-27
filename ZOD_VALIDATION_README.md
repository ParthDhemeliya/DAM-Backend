# Zod Validation System

This project now uses [Zod](https://zod.dev/) for runtime type validation and type safety. Zod provides a powerful, TypeScript-first schema validation library that ensures data integrity at runtime while maintaining full type safety.

## Overview

The validation system has been implemented across several key areas:

- **Metadata Worker**: Job data validation with comprehensive error handling
- **Asset Management**: Asset creation, updates, and search validation
- **Job Management**: Job creation, updates, and processing validation
- **Utility Functions**: Reusable validation helpers and error formatting

## Key Benefits

1. **Runtime Type Safety**: Validate data at runtime while maintaining TypeScript types
2. **Automatic Type Inference**: Use `z.infer<typeof Schema>` to automatically generate TypeScript types
3. **Comprehensive Error Messages**: Detailed validation errors with field paths and context
4. **Performance**: Zod is highly optimized for runtime validation
5. **Extensibility**: Easy to add new validation rules and schemas

## File Structure

```
src/validation/
├── asset.zod.ts          # Asset-related validation schemas
├── job.zod.ts            # Job-related validation schemas
├── zod-utils.ts          # Validation utility functions
└── index.ts              # Legacy validation exports (for backward compatibility)
```

## Usage Examples

### Basic Validation

```typescript
import { MetadataJobDataSchema } from '../workers/metadata.worker';
import { validateWithZod } from '../validation/zod-utils';

// Validate job data
const jobData = { assetId: 123, jobId: 456 };
const validation = validateWithZod(MetadataJobDataSchema, jobData, 'JobData');

if (validation.success) {
  // TypeScript knows this is valid MetadataJobData
  const { assetId, jobId, options } = validation.data;
  console.log(`Processing job ${jobId} for asset ${assetId}`);
} else {
  console.error('Validation failed:', validation.errors);
}
```

### Safe Validation

```typescript
import { safeValidate } from '../validation/zod-utils';
import { CreateAssetRequestSchema } from '../validation/asset.zod';

// Safe validation that returns undefined on failure
const assetData = safeValidate(CreateAssetRequestSchema, request.body);
if (assetData) {
  // Process valid asset data
  await createAsset(assetData);
} else {
  // Handle invalid data
  res.status(400).json({ error: 'Invalid asset data' });
}
```

### Direct Schema Usage

```typescript
import { z } from 'zod';
import { MetadataOptionsSchema } from '../workers/metadata.worker';

try {
  // Parse and validate directly
  const options = MetadataOptionsSchema.parse(request.body);

  // TypeScript knows the exact structure
  if (options.extractExif) {
    await extractExifMetadata(asset);
  }
} catch (error) {
  if (error instanceof z.ZodError) {
    // Handle validation errors
    const formattedErrors = formatValidationErrors(error);
    res.status(400).json(formattedErrors);
  }
}
```

## Available Schemas

### Metadata Worker Schemas

- `MetadataOptionsSchema`: Metadata extraction options
- `MetadataJobDataSchema`: Complete metadata job data

### Asset Schemas

- `FileTypeSchema`: Supported file types
- `AssetStatusSchema`: Asset processing statuses
- `CreateAssetRequestSchema`: Asset creation validation
- `UpdateAssetRequestSchema`: Asset update validation
- `AssetSearchRequestSchema`: Asset search and filtering
- `FileConversionOptionsSchema`: File conversion options
- `ThumbnailOptionsSchema`: Thumbnail generation options
- `MetadataExtractionOptionsSchema`: Metadata extraction options

### Job Schemas

- `JobTypeSchema`: Supported job types
- `JobStatusSchema`: Job processing statuses
- `CreateJobRequestSchema`: Job creation validation
- `UpdateJobRequestSchema`: Job update validation
- `ThumbnailOptionsSchema`: Thumbnail job options
- `ConversionOptionsSchema`: File conversion job options
- `VideoOptionsSchema`: Video processing options
- `AudioOptionsSchema`: Audio processing options

## Error Handling

### Validation Error Format

```typescript
import { formatValidationErrors } from '../validation/zod-utils';

try {
  const data = schema.parse(input);
} catch (error) {
  if (error instanceof z.ZodError) {
    const formatted = formatValidationErrors(error);
    // Returns:
    // {
    //   message: 'Validation failed',
    //   errors: [
    //     { field: 'filename', message: 'Filename is required', code: 'invalid_type' },
    //     { field: 'file_size', message: 'File size must be positive', code: 'too_small' }
    //   ]
    // }
  }
}
```

### Custom Error Messages

```typescript
const AssetIdSchema = z
  .number()
  .int('Asset ID must be an integer')
  .positive('Asset ID must be positive');

// Custom validation rules
const FileSizeSchema = z
  .number()
  .int('File size must be an integer')
  .min(1, 'File size must be at least 1 byte')
  .max(1024 * 1024 * 100, 'File size cannot exceed 100MB');
```

## Migration from Legacy Validation

The project previously used custom validation functions. Here's how to migrate:

### Before (Legacy)

```typescript
import { validateString, validateNumber } from '../middleware/validation';

export const validateAssetData = (assetData: CreateAssetRequest): void => {
  validateString(assetData.filename, 'filename');
  validateNumber(assetData.file_size, 'file_size', 1);
};
```

### After (Zod)

```typescript
import { z } from 'zod';

export const AssetSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  file_size: z.number().int().positive('File size must be positive'),
});

export type Asset = z.infer<typeof AssetSchema>;
```

## Best Practices

1. **Use Type Inference**: Always use `z.infer<typeof Schema>` for TypeScript types
2. **Provide Context**: Use descriptive error messages and field names
3. **Handle Errors Gracefully**: Use the utility functions for consistent error handling
4. **Validate Early**: Validate data as soon as it enters your system
5. **Use Safe Validation**: Use `safeValidate` when you want to handle invalid data gracefully

## Performance Considerations

- Zod schemas are compiled once and reused
- Validation is fast for most use cases
- For high-performance scenarios, consider using `safeParse` instead of `parse`
- Complex nested schemas may have higher overhead

## Testing

```typescript
import { MetadataJobDataSchema } from '../workers/metadata.worker';

describe('MetadataJobDataSchema', () => {
  it('should validate valid job data', () => {
    const validData = {
      assetId: 123,
      jobId: 456,
      options: { extractExif: true },
    };

    const result = MetadataJobDataSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid job data', () => {
    const invalidData = {
      assetId: -1, // Invalid: negative number
      jobId: 'not-a-number', // Invalid: string instead of number
    };

    const result = MetadataJobDataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(2);
  });
});
```

## Troubleshooting

### Common Issues

1. **Type Mismatches**: Ensure your data matches the expected schema structure
2. **Missing Fields**: Use `.optional()` for optional fields or provide defaults
3. **Validation Errors**: Check the error messages for specific field validation failures

### Debug Mode

Enable Zod debug mode for development:

```typescript
// In development
process.env.NODE_ENV === 'development' &&
  z.setErrorMap((issue, ctx) => {
    console.log('Validation issue:', issue);
    return { message: ctx.defaultError };
  });
```

## Future Enhancements

- Add custom validation rules for business logic
- Implement schema composition for complex validations
- Add validation middleware for Express routes
- Create schema versioning for API compatibility

## Resources

- [Zod Documentation](https://zod.dev/)
- [TypeScript Integration](https://zod.dev/?id=typescript)
- [Error Handling](https://zod.dev/?id=error-handling)
- [Schema Composition](https://zod.dev/?id=intersections)
