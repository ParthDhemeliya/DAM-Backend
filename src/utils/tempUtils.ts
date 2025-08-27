import fs from 'fs'
import path from 'path'
import os from 'os'

// Get temp directory - use system temp dir if available, otherwise use project temp
export function getTempDir(): string {
  // Try to use system temp directory first
  const systemTemp = os.tmpdir()
  if (systemTemp && fs.existsSync(systemTemp)) {
    return systemTemp
  }

  // Fallback to project temp directory
  const projectTemp = path.join(process.cwd(), 'temp')
  if (!fs.existsSync(projectTemp)) {
    fs.mkdirSync(projectTemp, { recursive: true })
  }
  return projectTemp
}

// Create a temporary file path
export function createTempPath(prefix: string, extension: string): string {
  const tempDir = getTempDir()
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  const filename = `${prefix}_${timestamp}_${random}.${extension}`
  return path.join(tempDir, filename)
}

// Ensure temp directory exists
export function ensureTempDir(): string {
  const tempDir = getTempDir()
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  return tempDir
}

// Clean up temp file
export function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (error) {
    console.warn(`Could not clean up temp file ${filePath}:`, error)
  }
}

// Clean up temp directory (optional - use with caution)
export function cleanupTempDir(): void {
  try {
    const tempDir = getTempDir()
    if (tempDir !== os.tmpdir() && fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir)
      for (const file of files) {
        const filePath = path.join(tempDir, file)
        try {
          const stat = fs.statSync(filePath)
          if (stat.isFile()) {
            fs.unlinkSync(filePath)
          }
        } catch (error) {
          console.warn(`Could not clean up temp file ${filePath}:`, error)
        }
      }
    }
  } catch (error) {
    console.warn('Could not clean up temp directory:', error)
  }
}
