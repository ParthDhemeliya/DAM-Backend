import { getPool } from '../config/database.config'
import fs from 'fs'
import path from 'path'

// Shared database pool instance
const pool = getPool()

// Main function to initialize the entire database
export const initializeDatabase = async (): Promise<void> => {
  try {
    console.log('Starting database initialization...')

    // Step 1: Create database structure
    await executeSchemaFile()

    // Step 2: Add sample data for testing
    await insertSampleData()

    console.log('Database initialization completed successfully!')
  } catch (error) {
    console.error('Database initialization failed:', error)
    throw error
  }
}

// Execute the SQL schema file to create database structure
const executeSchemaFile = async (): Promise<void> => {
  try {
    const schemaPath = path.join(__dirname, '../../database/schema.sql')
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8')

    console.log('Executing database schema...')
    await pool.query(schemaSQL)
    console.log('Database schema created successfully')
  } catch (error) {
    console.error('Error executing schema:', error)
    throw error
  }
}

// Insert sample data for testing and development
const insertSampleData = async (): Promise<void> => {
  try {
    console.log('Inserting sample data...')

    // Check if sample data already exists
    const existingAssets = await pool.query('SELECT COUNT(*) FROM assets')
    if (parseInt(existingAssets.rows[0].count) > 0) {
      console.log('Sample data already exists, skipping...')
      return
    }

    // Insert sample assets
    const sampleAssets = [
      {
        filename: 'sample_image_1.jpg',
        original_name: 'sample_image_1.jpg',
        file_type: 'image',
        mime_type: 'image/jpeg',
        file_size: 1024000,
        storage_path: '/uploads/sample_image_1.jpg',
        status: 'uploaded',
      },
      {
        filename: 'sample_document.pdf',
        original_name: 'sample_document.pdf',
        file_type: 'document',
        mime_type: 'application/pdf',
        file_size: 2048000,
        storage_path: '/uploads/sample_document.pdf',
        status: 'uploaded',
      },
      {
        filename: 'sample_video.mp4',
        original_name: 'sample_video.mp4',
        file_type: 'video',
        mime_type: 'video/mp4',
        file_size: 10485760,
        storage_path: '/uploads/sample_video.mp4',
        status: 'uploaded',
      },
    ]

    for (const asset of sampleAssets) {
      await pool.query(
        `
          INSERT INTO assets (filename, original_name, file_type, mime_type, file_size, storage_path, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          asset.filename,
          asset.original_name,
          asset.file_type,
          asset.mime_type,
          asset.file_size,
          asset.storage_path,
          asset.status,
        ]
      )
    }

    // Insert sample jobs
    const sampleJobs = [
      {
        job_type: 'generate_thumbnail',
        asset_id: 1,
        status: 'pending',
        priority: 1,
      },
      {
        job_type: 'extract_metadata',
        asset_id: 2,
        status: 'pending',
        priority: 2,
      },
      {
        job_type: 'generate_preview',
        asset_id: 3,
        status: 'pending',
        priority: 1,
      },
    ]

    for (const job of sampleJobs) {
      await pool.query(
        `
          INSERT INTO jobs (job_type, asset_id, status, priority)
          VALUES ($1, $2, $3, $4)
        `,
        [job.job_type, job.asset_id, job.status, job.priority]
      )
    }

    console.log('Sample data inserted successfully')
  } catch (error) {
    console.error('Error inserting sample data:', error)
    throw error
  }
}

// Close database connection pool
export const closeConnection = async (): Promise<void> => {
  await pool.end()
}

// If this file is run directly, initialize the database
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database initialization completed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Database initialization failed:', error)
      process.exit(1)
    })
    .finally(() => {
      closeConnection()
    })
}
