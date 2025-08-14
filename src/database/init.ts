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

    // Step 2: Sample data not needed - system has real data
    console.log('Skipping sample data - using real uploaded files')

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

// Sample data insertion removed - system uses real uploaded files
const insertSampleData = async (): Promise<void> => {
  console.log('Sample data insertion disabled - using real uploaded files only')
  return
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
