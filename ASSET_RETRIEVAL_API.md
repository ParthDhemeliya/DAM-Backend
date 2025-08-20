# Asset Retrieval API Documentation

## Overview

The Asset Retrieval API provides enhanced functionality for retrieving, filtering, searching, and accessing digital assets with optimized performance and comprehensive metadata support.

## Features

- ✅ **Pagination Support** - Efficient handling of large asset collections
- ✅ **Advanced Filtering** - Filter by type, status, date range, tags, and metadata
- ✅ **Full-Text Search** - Search across filename, tags, description, and metadata
- ✅ **Signed URL Generation** - Secure direct access to assets
- ✅ **Batch Operations** - Retrieve multiple assets with single request
- ✅ **Optimized Queries** - Database indexes for fast performance
- ✅ **Flexible Sorting** - Sort by various fields and directions

## Endpoints

### 1. List Assets with Filters

**GET** `/api/assets`

Retrieve assets with pagination, filtering, and sorting options.

#### Query Parameters

| Parameter           | Type     | Description                   | Default      | Example                     |
| ------------------- | -------- | ----------------------------- | ------------ | --------------------------- |
| `page`              | number   | Page number (1-based)         | 1            | `?page=2`                   |
| `limit`             | number   | Items per page (1-100)        | 20           | `?limit=50`                 |
| `fileType`          | string   | Filter by file type           | -            | `?fileType=image`           |
| `status`            | string   | Filter by asset status        | -            | `?status=processed`         |
| `dateFrom`          | string   | Filter from date (YYYY-MM-DD) | -            | `?dateFrom=2024-01-01`      |
| `dateTo`            | string   | Filter to date (YYYY-MM-DD)   | -            | `?dateTo=2024-12-31`        |
| `tags`              | string[] | Filter by tags (multiple)     | -            | `?tags=marketing&tags=logo` |
| `category`          | string   | Filter by category            | -            | `?category=branding`        |
| `author`            | string   | Filter by author              | -            | `?author=john`              |
| `department`        | string   | Filter by department          | -            | `?department=marketing`     |
| `project`           | string   | Filter by project             | -            | `?project=website`          |
| `sortBy`            | string   | Sort field                    | `created_at` | `?sortBy=filename`          |
| `sortOrder`         | string   | Sort direction (ASC/DESC)     | `DESC`       | `?sortOrder=ASC`            |
| `includeSignedUrls` | boolean  | Include signed URLs           | `false`      | `?includeSignedUrls=true`   |
| `expiresIn`         | number   | Signed URL expiry (seconds)   | 3600         | `?expiresIn=7200`           |

#### Supported File Types

- `image` - Images (JPG, PNG, GIF, SVG, WebP, etc.)
- `video` - Videos (MP4, AVI, MOV, WebM, etc.)
- `audio` - Audio files (MP3, WAV, FLAC, etc.)
- `document` - Documents (PDF, DOC, TXT, etc.)
- `spreadsheet` - Spreadsheets (XLS, XLSX, CSV, etc.)
- `presentation` - Presentations (PPT, PPTX, etc.)
- `archive` - Archives (ZIP, RAR, TAR, etc.)
- `code` - Source code files
- `font` - Font files
- `3d` - 3D model files
- `other` - Other file types

#### Supported Asset Statuses

- `uploaded` - File uploaded, pending processing
- `processing` - Currently being processed
- `processed` - Processing completed successfully
- `failed` - Processing failed
- `deleted` - Asset marked as deleted

#### Supported Sort Fields

- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `filename` - Asset filename
- `file_size` - File size in bytes

#### Example Requests

```bash
# Get first page of processed images
GET /api/assets?page=1&limit=20&fileType=image&status=processed

# Get assets from specific date range with tags
GET /api/assets?dateFrom=2024-01-01&dateTo=2024-03-31&tags=marketing&tags=logo

# Get assets sorted by filename with signed URLs
GET /api/assets?sortBy=filename&sortOrder=ASC&includeSignedUrls=true&expiresIn=7200

# Get assets by category and author
GET /api/assets?category=branding&author=john&limit=50
```

#### Response Format

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "filename": "company_logo.png",
      "original_name": "company_logo.png",
      "file_type": "image",
      "mime_type": "image/png",
      "file_size": 1024000,
      "storage_path": "assets/1234567890-company_logo.png",
      "storage_bucket": "dam-media",
      "status": "processed",
      "metadata": {
        "tags": ["logo", "branding", "company"],
        "category": "branding",
        "author": "john",
        "department": "marketing",
        "project": "website",
        "description": "Company logo for website"
      },
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:35:00Z",
      "processed_at": "2024-01-15T10:35:00Z",
      "signedUrl": "https://minio.example.com/..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "filters": {
    "fileType": "image",
    "status": "processed",
    "page": 1,
    "limit": 20,
    "sortBy": "created_at",
    "sortOrder": "DESC"
  }
}
```

### 2. Search Assets

**GET** `/api/assets/search`

Search assets by keyword across filename, tags, description, and metadata.

#### Query Parameters

| Parameter           | Type    | Required | Description                 | Default      |
| ------------------- | ------- | -------- | --------------------------- | ------------ |
| `q`                 | string  | ✅       | Search query (min 2 chars)  | -            |
| `page`              | number  | -        | Page number (1-based)       | 1            |
| `limit`             | number  | -        | Items per page (1-100)      | 20           |
| `fileType`          | string  | -        | Filter by file type         | -            |
| `status`            | string  | -        | Filter by asset status      | -            |
| `sortBy`            | string  | -        | Sort field                  | `created_at` |
| `sortOrder`         | string  | -        | Sort direction (ASC/DESC)   | `DESC`       |
| `includeSignedUrls` | boolean | -        | Include signed URLs         | `false`      |
| `expiresIn`         | number  | -        | Signed URL expiry (seconds) | 3600         |

#### Search Scope

The search covers the following fields:

- `filename` - Asset filename
- `original_name` - Original filename
- `metadata.tags` - Asset tags
- `metadata.description` - Asset description
- `metadata.category` - Asset category
- `metadata.author` - Asset author
- `metadata.department` - Asset department
- `metadata.project` - Asset project

#### Example Requests

```bash
# Search for logo files
GET /api/assets/search?q=logo&fileType=image

# Search for marketing assets
GET /api/assets/search?q=marketing&status=processed&limit=50

# Search with signed URLs
GET /api/assets/search?q=website&includeSignedUrls=true&expiresIn=7200
```

#### Response Format

```json
{
  "success": true,
  "data": [...],
  "pagination": {...},
  "search": {
    "query": "logo",
    "fileType": "image",
    "status": "processed",
    "sortBy": "created_at",
    "sortOrder": "DESC"
  }
}
```

### 3. Batch Asset Access

**POST** `/api/assets/batch-access`

Retrieve multiple assets by IDs with signed URLs in a single request.

#### Request Body

```json
{
  "assetIds": [1, 2, 3, 4, 5],
  "expiresIn": 7200
}
```

#### Parameters

| Parameter   | Type     | Required | Description                 | Constraints |
| ----------- | -------- | -------- | --------------------------- | ----------- |
| `assetIds`  | number[] | ✅       | Array of asset IDs          | Max 100 IDs |
| `expiresIn` | number   | -        | Signed URL expiry (seconds) | 60-86400    |

#### Example Request

```bash
POST /api/assets/batch-access
Content-Type: application/json

{
  "assetIds": [1, 2, 3, 4, 5],
  "expiresIn": 7200
}
```

#### Response Format

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "filename": "asset1.jpg",
      "signedUrl": "https://minio.example.com/...",
      ...
    },
    {
      "id": 2,
      "filename": "asset2.png",
      "signedUrl": "https://minio.example.com/...",
      ...
    }
  ],
  "count": 5,
  "message": "Retrieved 5 assets with signed URLs"
}
```

## Performance Optimization

### Database Indexes

The API includes optimized database indexes for fast query performance:

- **GIN indexes** for JSONB metadata fields (tags, category, author, etc.)
- **Composite indexes** for common query patterns
- **Partial indexes** for status-based filtering
- **Text search indexes** for filename and metadata search

### Query Optimization

- Efficient pagination with COUNT queries
- Parameterized queries to prevent SQL injection
- Optimized WHERE clauses with proper indexing
- Batch operations to reduce database round trips

## Error Handling

### Common Error Responses

```json
{
  "success": false,
  "error": "Error message description"
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found
- `500` - Internal Server Error

### Validation Errors

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    "page must be a positive integer",
    "limit must be between 1 and 100"
  ]
}
```

## Rate Limiting

- **List/Search endpoints**: 100 requests per minute per IP
- **Batch access**: 20 requests per minute per IP
- **Signed URL generation**: 1000 requests per minute per IP

## Best Practices

### 1. Pagination

- Use appropriate `limit` values (20-50 for most use cases)
- Implement infinite scroll or pagination controls
- Cache results when possible

### 2. Filtering

- Combine multiple filters for precise results
- Use date ranges for time-based queries
- Leverage tags for categorization

### 3. Search

- Use specific keywords for better results
- Combine search with filters for targeted results
- Implement search suggestions based on tags

### 4. Performance

- Use `includeSignedUrls=true` only when needed
- Set appropriate `expiresIn` values
- Implement client-side caching for static data

## Migration Guide

### Adding New Indexes

Run the migration script to add performance indexes:

```sql
-- Run the migration script
\i database/migration-01-asset-retrieval-indexes.sql
```

### Updating Existing Code

Replace old `getAllAssets()` calls with new filtered endpoints:

```typescript
// Old way
const assets = await getAllAssets()

// New way
const result = await getAssetsWithFilters({
  page: 1,
  limit: 20,
  fileType: 'image',
  status: 'processed',
})
```

## Testing

### Postman Collection

Import the provided Postman collection for testing all endpoints:

1. **List Assets**: Test various filter combinations
2. **Search Assets**: Test search queries and filters
3. **Batch Access**: Test bulk asset retrieval
4. **Error Cases**: Test validation and error handling

### Sample Test Data

```sql
-- Insert test assets with various metadata
INSERT INTO assets (filename, original_name, file_type, mime_type, file_size, storage_path, status, metadata) VALUES
('logo.png', 'company_logo.png', 'image', 'image/png', 1024000, '/assets/logo.png', 'processed', '{"tags": ["logo", "branding"], "category": "branding", "author": "john"}'),
('video.mp4', 'product_demo.mp4', 'video', 'video/mp4', 10485760, '/assets/video.mp4', 'processed', '{"tags": ["demo", "product"], "category": "marketing", "author": "jane"}');
```

## Support

For questions or issues with the Asset Retrieval API:

1. Check the API documentation at `/` endpoint
2. Review error messages and validation details
3. Check database connection and index status
4. Monitor API performance and response times

## Changelog

### Version 1.0.0 (Current)

- ✅ Pagination support
- ✅ Advanced filtering by type, status, date, tags
- ✅ Full-text search functionality
- ✅ Signed URL generation
- ✅ Batch asset access
- ✅ Performance optimization with database indexes
- ✅ Comprehensive validation and error handling
