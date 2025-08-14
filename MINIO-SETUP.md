# MinIO Setup for DAM Backend

This document explains how to set up and use MinIO for object storage in your DAM Backend application.

## What is MinIO?

MinIO is a high-performance, S3-compatible object storage server. It's perfect for development and production environments where you need scalable file storage.

## Prerequisites

- Docker Desktop installed and running
- Node.js and npm installed
- PowerShell (for Windows users)

## Quick Start

### 1. Start MinIO

```powershell
# Run the startup script
.\start-minio.ps1

# Or manually:
docker-compose -f docker-compose.minio.yml up -d
```

### 2. Access MinIO Console

1. Open your browser and go to: http://localhost:9001
2. Login with:
   - Username: `minioadmin`
   - Password: `minioadmin123`

### 3. Create Bucket

1. Click "Create Bucket"
2. Enter bucket name: `dam-media`
3. Keep it private (uncheck "Public Read")
4. Click "Create Bucket"

### 4. Install Dependencies

```bash
npm install
```

### 5. Test MinIO Integration

```bash
npm run test:minio
```

## Configuration

### Environment Variables

Create a `.env` file based on `env.local`:

```env
# MinIO Configuration
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_REGION=us-east-1
MINIO_BUCKET=dam-media
```

### Docker Compose

The MinIO service is configured in `docker-compose.minio.yml`:

```yaml
services:
  minio:
    image: minio/minio:latest
    container_name: minio
    command: server /data --console-address ":9001"
    ports:
      - '9000:9000' # API
      - '9001:9001' # Web console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    volumes:
      - ./minio-data:/data
```

## API Endpoints

### File Upload

```http
POST /api/assets/upload
Content-Type: multipart/form-data

file: [binary file]
metadata: {"description": "Sample file"}
```

### Get Asset with Access URL

```http
GET /api/assets/{id}/access?expiresIn=3600
```

### Create Asset (without file)

```http
POST /api/assets
Content-Type: application/json

{
  "filename": "sample.jpg",
  "original_name": "sample.jpg",
  "file_type": "image",
  "mime_type": "image/jpeg",
  "file_size": 1024000,
  "storage_path": "assets/1234567890-sample.jpg",
  "storage_bucket": "dam-media"
}
```

## Storage Service Functions

The storage service provides these functions:

### 1. Upload File

```typescript
import { uploadFile } from './services/storage'

const result = await uploadFile('path/to/file.jpg', fileBuffer)
// Returns: { bucket: 'dam-media', key: 'path/to/file.jpg' }
```

### 2. Download File

```typescript
import { downloadFile } from './services/storage'

const stream = await downloadFile('path/to/file.jpg')
// Returns: ReadableStream
```

### 3. Delete File

```typescript
import { deleteFile } from './services/storage'

const result = await deleteFile('path/to/file.jpg')
// Returns: { deleted: true }
```

### 4. Get Signed URL

```typescript
import { getSignedReadUrl } from './services/storage'

const url = await getSignedReadUrl('path/to/file.jpg', 3600)
// Returns: Signed URL valid for 1 hour
```

### 5. Check File Exists

```typescript
import { fileExists } from './services/storage'

const exists = await fileExists('path/to/file.jpg')
// Returns: boolean
```

### 6. Get File Metadata

```typescript
import { getFileMetadata } from './services/storage'

const metadata = await getFileMetadata('path/to/file.jpg')
// Returns: { contentType, contentLength, lastModified, etag }
```

## File Structure

```
src/
├── clients/
│   └── s3.ts              # S3 client configuration
├── services/
│   ├── storage.ts         # Storage service functions
│   └── asset.service.ts   # Asset service with MinIO integration
└── routes/
    └── assets.routes.ts   # Asset routes with file upload
```

## Testing

### Run MinIO Test

```bash
npm run test:minio
```

This will:

1. Create a test file
2. Upload it to MinIO
3. Check if it exists
4. Get metadata
5. Generate a signed URL
6. Download the file
7. Delete the file

### Manual Testing

1. Start MinIO: `.\start-minio.ps1`
2. Create bucket: `dam-media`
3. Start your backend: `npm run dev`
4. Test file upload: `POST /api/assets/upload`
5. Test file access: `GET /api/assets/{id}/access`

## Troubleshooting

### MinIO Won't Start

```bash
# Check Docker status
docker info

# Check container logs
docker-compose -f docker-compose.minio.yml logs

# Restart MinIO
docker-compose -f docker-compose.minio.yml restart
```

### Connection Errors

1. Verify MinIO is running: `docker ps`
2. Check endpoint URL: `http://localhost:9000`
3. Verify credentials in `.env`
4. Check bucket exists: `dam-media`

### File Upload Issues

1. Check file size limits in multer configuration
2. Verify MinIO bucket permissions
3. Check storage service logs
4. Verify file buffer is being passed correctly

## Production Considerations

1. **Security**: Change default credentials
2. **SSL**: Use HTTPS endpoints
3. **Backup**: Configure MinIO backup policies
4. **Monitoring**: Set up MinIO metrics
5. **Scaling**: Use MinIO distributed mode for high availability

## Next Steps

1. ✅ MinIO setup complete
2. ✅ Storage service implemented
3. ✅ Asset service updated
4. ✅ File upload routes added
5. 🔄 Test file uploads
6. 🔄 Implement file processing workflows
7. 🔄 Add file validation and virus scanning
8. 🔄 Implement file versioning
9. 🔄 Add file access controls
10. 🔄 Set up automated backups

## Resources

- [MinIO Documentation](https://docs.min.io/)
- [AWS S3 SDK Documentation](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)
- [Multer Documentation](https://github.com/expressjs/multer)
