-- Migration: Add indexes for Asset Retrieval API optimization
-- This script adds new indexes to improve query performance for filtering and search

-- Add GIN indexes for JSONB metadata fields (tags, category, author, department, project)
CREATE INDEX IF NOT EXISTS idx_assets_metadata_tags ON assets USING GIN ((metadata->'tags'));
CREATE INDEX IF NOT EXISTS idx_assets_metadata_category ON assets USING GIN ((metadata->'category'));
CREATE INDEX IF NOT EXISTS idx_assets_metadata_author ON assets USING GIN ((metadata->'author'));
CREATE INDEX IF NOT EXISTS idx_assets_metadata_department ON assets USING GIN ((metadata->'department'));
CREATE INDEX IF NOT EXISTS idx_assets_metadata_project ON assets USING GIN ((metadata->'project'));

-- Add indexes for date filtering
CREATE INDEX IF NOT EXISTS idx_assets_updated_at ON assets(updated_at);
CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON assets(deleted_at);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_assets_type_status_created ON assets(file_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_status_created_at ON assets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_type_created_at ON assets(file_type, created_at DESC);

-- Add index for filename search optimization
CREATE INDEX IF NOT EXISTS idx_assets_filename_lower ON assets(LOWER(filename));
CREATE INDEX IF NOT EXISTS idx_assets_original_name_lower ON assets(LOWER(original_name));

-- Add index for content hash (duplicate detection)
CREATE INDEX IF NOT EXISTS idx_assets_content_hash ON assets((metadata->>'contentHash'));

-- Add index for file size filtering
CREATE INDEX IF NOT EXISTS idx_assets_file_size ON assets(file_size);

-- Add index for storage bucket filtering
CREATE INDEX IF NOT EXISTS idx_assets_storage_bucket ON assets(storage_bucket);

-- Add index for processed_at timestamp
CREATE INDEX IF NOT EXISTS idx_assets_processed_at ON assets(processed_at);

-- Add partial index for active assets (not deleted)
CREATE INDEX IF NOT EXISTS idx_assets_active ON assets(id) WHERE deleted_at IS NULL;

-- Add partial index for processed assets
CREATE INDEX IF NOT EXISTS idx_assets_processed ON assets(id) WHERE status = 'processed';

-- Add partial index for failed assets
CREATE INDEX IF NOT EXISTS idx_assets_failed ON assets(id) WHERE status = 'failed';

-- Add partial index for processing assets
CREATE INDEX IF NOT EXISTS idx_assets_processing ON assets(id) WHERE status = 'processing';

-- Add partial index for uploaded assets
CREATE INDEX IF NOT EXISTS idx_assets_uploaded ON assets(id) WHERE status = 'uploaded';
