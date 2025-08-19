# DAM Backend

A Digital Asset Management (DAM) system backend built with Node.js, TypeScript, PostgreSQL, and MinIO.

## Features

- File upload and storage management
- Asset metadata management
- Duplicate file detection and handling
- Background job processing
- Video transcoding with FFmpeg
- Image thumbnail generation
- File format conversion

## Duplicate File Handling

The system includes duplicate file detection and handling to prevent duplicate entries while giving users control over how to handle duplicates.

### Duplicate Detection Methods

1. Content Hash: SHA-256 hash of file content (most accurate)
2. Filename: Exact filename match
3. Original Name: Original filename from upload
4. File Size: Basic size comparison

### Upload Options for Duplicates

When uploading files, you can specify how to handle duplicates using the `duplicateAction` parameter:

#### Skip Duplicates

```json
{
  "duplicateAction": "skip"
}
```

- Skips duplicate files
- Returns information about what was skipped
- Continues processing other files

#### Replace Duplicates

```json
{
  "duplicateAction": "replace",
  "replaceAssetId": 123
}
```

- Replaces existing asset with new file
- Requires `replaceAssetId` to specify which asset to replace
- Deletes old asset and creates new one

#### Error on Duplicates (Default)

```json
{
  "duplicateAction": "error"
}
```

- Throws error when duplicates are detected
- Stops processing
- User must explicitly choose how to handle

### API Endpoints

#### Upload with Duplicate Handling

```
POST /api/assets/upload
```

**Form Data:**

- `file`: File to upload
- `duplicateAction`: How to handle duplicates
- `replaceAssetId`: Asset ID to replace (if replace action)
- `category`: Optional category
- `description`: Optional description

#### Check for Duplicates

```
POST /api/assets/check-duplicates-simple
```

**Body:**

```json
{
  "filename": "example.jpg",
  "fileSize": 1024000,
  "contentHash": "sha256_hash_here"
}
```

### Example Usage

#### Upload with Skip Duplicates

```bash
curl -X POST http://localhost:3000/api/assets/upload \
  -F "file=@image.jpg" \
  -F "duplicateAction=skip" \
  -F "category=images" \
  -F "description=Sample image"
```

#### Upload with Replace

```bash
curl -X POST http://localhost:3000/api/assets/upload \
  -F "file=@updated_image.jpg" \
  -F "duplicateAction=replace" \
  -F "replaceAssetId=123"
```

### Response Format

The upload endpoint returns detailed information about what happened:

```json
{
  "success": true,
  "count": 1,
  "data": [...],
  "message": "Uploaded: 1 new files.",
  "summary": {
    "uploaded": 1,
    "replaced": 0,
    "skipped": 0
  }
}
```

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run database migrations
5. Start the server: `npm start`

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `MINIO_ENDPOINT`: MinIO server endpoint
- `MINIO_ACCESS_KEY`: MinIO access key
- `MINIO_SECRET_KEY`: MinIO secret key
- `MINIO_BUCKET`: Default storage bucket
- `MAX_FILE_SIZE`: Maximum file size in bytes
- `MAX_BATCH_SIZE`: Maximum batch upload size in bytes

## API Documentation

The system provides comprehensive APIs for:

- Asset management (CRUD operations)
- File upload with duplicate handling
- Background job processing
- Video transcoding
- Image processing
- Metadata extraction

For detailed API documentation, see the individual route files in `src/routes/`.
