-- Create Assets table
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    storage_bucket VARCHAR(100) DEFAULT 'dam-assets',
    status VARCHAR(50) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'processed', 'failed', 'deleted')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL
);


-- Create Jobs table for background processing tasks
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(100) NOT NULL,
    asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 10),
    progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_file_type ON assets(file_type);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_asset_id ON jobs(asset_id);
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_assets_updated_at 
    BEFORE UPDATE ON assets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at 
    BEFORE UPDATE ON jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data removed for clean startup
-- INSERT INTO assets (filename, original_name, file_type, mime_type, file_size, storage_path, status) VALUES
-- ('sample_image_1.jpg', 'sample_image_1.jpg', 'image', 'image/jpeg', 1024000, '/uploads/sample_image_1.jpg', 'uploaded'),
-- ('sample_document.pdf', 'sample_document.pdf', 'document', 'application/pdf', 2048000, '/uploads/sample_document.pdf', 'uploaded'),
-- ('sample_video.mp4', 'sample_video.mp4', 'video', 'video/mp4', 10485760, '/uploads/sample_video.mp4', 'uploaded')
-- ON CONFLICT DO NOTHING;

-- INSERT INTO jobs (job_type, asset_id, status, priority) VALUES
-- ('generate_thumbnail', 1, 'pending', 1),
-- ('extract_metadata', 2, 'pending', 2),
-- ('generate_preview', 3, 'pending', 1)
-- ON CONFLICT DO NOTHING;
