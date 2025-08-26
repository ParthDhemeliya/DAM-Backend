# Upload Structure Documentation

This document describes the new organized structure for upload-related functionality in the DAM Backend.

## File Organization

### Controllers

- **`src/controllers/upload.controller.ts`** - Contains all upload-related business logic
  - `handleUpload()` - Processes file uploads with Multer
  - `handleLargeUpload()` - Handles large file uploads with streaming
  - `getUploadConfig()` - Returns upload configuration information

### Middleware

- **`src/middleware/upload.middleware.ts`** - Upload-specific middleware
  - `uploadSingle` - Multer middleware for single file uploads
  - `uploadMultiple` - Multer middleware for multiple file uploads
  - `uploadAny` - Multer middleware for flexible field names
  - `skipBodyParsingForUploads` - Skips body parsing for upload routes
  - `uploadTimeoutMiddleware` - Handles upload timeouts
  - `validateUploadRequest` - Basic upload request validation
  - `handleUploadErrors` - Error handling for upload-specific errors

### Routes

- **`src/routes/upload.routes.ts`** - Dedicated upload routes
  - `POST /api/upload/single` - Upload single file
  - `POST /api/upload/multiple` - Upload multiple files
  - `POST /api/upload/any` - Upload with flexible field names
  - `POST /api/upload/large` - Large file streaming upload
  - `GET /api/upload/config` - Get upload configuration
  - `GET /api/upload/health` - Upload service health check

### Validation

- **`src/validation/upload.validation.ts`** - Upload-specific validation rules
  - `validateUploadRequest` - Validates upload request body
  - `validateFileType` - Validates file types
  - `validateFileSize` - Validates file sizes (optional)
  - `validateFileCount` - Validates number of files

## API Endpoints

### Single File Upload

```
POST /api/upload/single
Content-Type: multipart/form-data

Body:
- file: File (required)
- tags: string (optional, comma-separated)
- metadata: JSON string (optional)
- category: string (optional)
- description: string (optional)
```

### Multiple Files Upload

```
POST /api/upload/multiple
Content-Type: multipart/form-data

Body:
- files: File[] (required, up to 10 files)
- tags: string (optional, comma-separated)
- metadata: JSON string (optional)
- category: string (optional)
- description: string (optional)
```

### Large File Upload

```
POST /api/upload/large
Content-Type: multipart/form-data

Body:
- file: File (required)
- tags: string (optional, comma-separated)
- metadata: JSON string (optional)
- category: string (optional)
- description: string (optional)
```

## Features

- **Unlimited File Sizes** - No file size limits
- **Multiple File Support** - Upload up to 10 files at once
- **Flexible Field Names** - Use any field name for files
- **Metadata Support** - Add tags, categories, and descriptions
- **Streaming Uploads** - Support for large files
- **Error Handling** - Comprehensive error handling and validation
- **Timeout Management** - Configurable timeouts for large uploads

## Configuration

The upload system is configured with:

- No file size limits
- Support for up to 10 files per upload
- Automatic upload directory creation
- Unique filename generation
- Extended timeouts for large files

## Error Handling

Upload errors are handled with:

- Multer-specific error handling
- File validation errors
- Size and count limit errors
- Custom error messages with helpful suggestions

## Usage Examples

### Frontend Integration

```typescript
// Single file upload
const formData = new FormData()
formData.append('file', file)
formData.append('tags', 'image,photo')
formData.append('metadata', JSON.stringify({ source: 'camera' }))

const response = await fetch('/api/upload/single', {
  method: 'POST',
  body: formData,
})
```

### Multiple files upload

```typescript
const formData = new FormData()
files.forEach((file) => formData.append('files', file))
formData.append('category', 'gallery')

const response = await fetch('/api/upload/multiple', {
  method: 'POST',
  body: formData,
})
```

## Migration Notes

The upload functionality has been moved from `assets.routes.ts` to dedicated upload files:

- Upload logic is now in `UploadController`
- Upload middleware is in `upload.middleware.ts`
- Upload routes are in `upload.routes.ts`
- Upload validation is in `upload.validation.ts`

The existing `/api/assets/upload` endpoint remains functional for backward compatibility.
