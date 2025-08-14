import { getPool } from '../config/database.config'
import fs from 'fs'
import path from 'path'

// Shared database pool instance
const pool = getPool()

// Main function to initialize the entire database
export const initializeDatabase = async (): Promise<void> => {
  try {
    await executeSchemaFile()
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

    await pool.query(schemaSQL)
  } catch (error) {
    console.error('Error executing schema:', error)
    throw error
  }
}

const insertSampleData = async (): Promise<void> => {
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
