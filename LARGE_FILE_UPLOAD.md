# Large File Upload Feature (100GB+ Support)

## Overview

This DAM system now supports unlimited file uploads, including files up to 100GB or more, using streaming uploads and disk-based storage.

## Backend Implementation

### Key Features

- **Unlimited File Sizes**: No file size limits (up to 100GB+)
- **Streaming Uploads**: Files are processed in chunks to prevent memory issues
- **Disk Storage**: Files are temporarily stored on disk during upload
- **Progress Tracking**: Real-time upload progress with speed and ETA
- **Error Handling**: Comprehensive error handling for large uploads
- **Automatic Cleanup**: Temporary files are cleaned up after successful upload

### Configuration

#### Node.js Settings

```typescript
// app.ts
process.env.NODE_OPTIONS = '--max-old-space-size=8192' // 8GB heap
process.setMaxListeners(0) // Remove listener limit
```

#### Server Settings

```typescript
// app.ts
server.timeout = 0 // No timeout for large uploads
server.keepAliveTimeout = 65000 // 65 seconds
server.headersTimeout = 66000 // 66 seconds
```

#### Multer Configuration

```typescript
// assets.routes.ts
const uploadStreamingLargeMultipartMax = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const timestamp = Date.now()
      const uploadPath = `./uploads/${timestamp}`
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true })
      }
      cb(null, uploadPath)
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now()
      const originalName = file.originalname || 'unknown'
      cb(null, `${timestamp}-${originalName}`)
    },
  }),
  // No file size limits
  limits: {
    fileSize: Number.MAX_SAFE_INTEGER,
    files: Number.MAX_SAFE_INTEGER,
    fieldSize: Number.MAX_SAFE_INTEGER,
    fields: Number.MAX_SAFE_INTEGER,
    parts: Number.MAX_SAFE_INTEGER,
    headerPairs: Number.MAX_SAFE_INTEGER,
  },
})
```

### Upload Route

```typescript
// Main upload route for large files
router.post(
  '/upload',
  largeUploadTimeoutHandler, // Handle large uploads with timeout and progress tracking
  uploadStreamingLargeMultipartMax.any(), // Handle unlimited files with maximum efficiency
  enhancedLargeUploadErrorHandler, // Enhanced error handling for very large uploads
  async (req, res) => {
    // Streaming response implementation
    // Progress tracking
    // Error handling
    // File processing
  }
)
```

### Error Handling

- **File Size Errors**: Handled gracefully with detailed messages
- **Network Errors**: Proper error responses with retry information
- **Storage Errors**: Fallback mechanisms and cleanup
- **Validation Errors**: Comprehensive validation with helpful error messages

## Frontend Implementation

### Key Features

- **Large File Detection**: Automatically detects files >100MB
- **Streaming Progress**: Real-time progress with speed and ETA
- **Adaptive Upload**: Uses appropriate upload method based on file size
- **User Feedback**: Clear information about large file uploads
- **Error Handling**: Comprehensive error handling and user feedback

### Configuration

#### Environment Variables

```bash
# .env
VITE_MAX_FILE_SIZE=0                    # 0 = unlimited
VITE_CHUNK_SIZE=1048576                 # 1MB chunks
VITE_UPLOAD_TIMEOUT=0                   # 0 = no timeout
VITE_API_BASE_URL=http://localhost:5000/api
```

#### API Service

```typescript
// api.ts
export const uploadLargeFilesWithStreaming = async (
  files: File[],
  options: LargeFileUploadOptions = {}
): Promise<LargeFileUploadResponse> => {
  // Streaming upload implementation
  // Progress tracking
  // Error handling
  // Chunked upload support
}
```

#### Redux Store

```typescript
// uploadSlice.ts
export const uploadLargeFiles = createAsyncThunk<
  LargeFileUploadResponse,
  { files: FileWithPreview[]; options?: LargeFileUploadOptions },
  { rejectValue: string }
>(
  'upload/uploadLargeFiles',
  async ({ files, options = {} }, { rejectWithValue, dispatch }) => {
    // Large file upload logic
    // Automatic method selection
    // Progress tracking
  }
)
```

### Components

#### FileUploadArea

- Detects large files (>100MB)
- Shows upload method information
- Handles file validation
- Supports unlimited file sizes

#### UploadProgress

- Real-time progress display
- Speed and ETA information
- Large file specific details
- Responsive design

## Usage Examples

### Backend Testing

```bash
# Test with large file
curl -X POST http://localhost:5000/api/assets/upload \
  -F "files=@large-file.mov" \
  -F "category=video" \
  -F "description=Large video file"
```

### Frontend Testing

```typescript
// Upload large files
const result = await dispatch(
  uploadLargeFiles({
    files: selectedFiles,
    options: {
      chunkSize: 1024 * 1024, // 1MB chunks
      timeout: 0, // No timeout
      onProgress: (progress) => {
        console.log(`Uploading: ${progress.percentage}%`)
        console.log(`Speed: ${progress.speed} bytes/s`)
        console.log(`ETA: ${progress.estimatedTime} seconds`)
      },
    },
  })
).unwrap()
```

## Performance Considerations

### Backend

- **Memory Usage**: Disk storage prevents memory issues
- **Streaming**: Files are processed in chunks
- **Database**: Minimal database operations during upload
- **Cleanup**: Automatic cleanup of temporary files

### Frontend

- **Chunked Uploads**: Large files are uploaded in manageable chunks
- **Progress Tracking**: Real-time progress without blocking UI
- **Error Recovery**: Graceful error handling and retry mechanisms
- **User Experience**: Clear feedback and progress information

## Troubleshooting

### Common Issues

#### "File too large" Error

- Check backend multer configuration
- Verify file size limits are set to `Number.MAX_SAFE_INTEGER`
- Check Node.js memory settings

#### Upload Timeout

- Verify server timeout settings
- Check network configuration
- Monitor server resources

#### Memory Issues

- Ensure disk storage is configured
- Check Node.js heap size settings
- Monitor server memory usage

### Debug Information

```typescript
// Enable debug logging
console.log('🚀 Large file upload details:', {
  fileSize: file.size,
  uploadPath: file.path,
  timestamp: new Date().toISOString(),
  memoryUsage: process.memoryUsage(),
})
```

## Security Considerations

### File Validation

- File type validation
- Content validation
- Size monitoring (for logging)
- Path traversal protection

### Storage Security

- Temporary file isolation
- Automatic cleanup
- Access control
- Audit logging

## Monitoring and Logging

### Upload Metrics

- File sizes
- Upload durations
- Success/failure rates
- Performance metrics

### Error Logging

- Detailed error messages
- Stack traces (development)
- User context
- Timestamp information

## Future Enhancements

### Planned Features

- **Resumable Uploads**: Support for interrupted uploads
- **Parallel Uploads**: Multiple file uploads simultaneously
- **Compression**: Automatic file compression for large files
- **CDN Integration**: Direct upload to CDN
- **Progress Persistence**: Save progress across browser sessions

### Performance Optimizations

- **WebSocket Progress**: Real-time progress updates
- **Background Processing**: Non-blocking file processing
- **Caching**: Smart caching strategies
- **Load Balancing**: Multiple upload endpoints
