export interface Asset {
  id: number
  filename: string
  original_name: string
  file_type: FileType
  mime_type: string
  file_size: number
  storage_path: string
  storage_bucket: string
  status: AssetStatus
  metadata: AssetMetadata
  created_at: Date
  updated_at: Date
  processed_at?: Date
  deleted_at?: Date
}

export interface CreateAssetRequest {
  filename: string
  original_name: string
  file_type: FileType
  mime_type: string
  file_size: number
  storage_path: string
  storage_bucket?: string
  metadata?: AssetMetadata
}

export interface UpdateAssetRequest {
  filename?: string
  status?: AssetStatus
  metadata?: AssetMetadata
}

// Comprehensive file type categorization
export type FileType = 
  | 'image'      // jpg, png, gif, svg, webp, etc.
  | 'video'      // mp4, avi, mov, wmv, flv, etc.
  | 'audio'      // mp3, wav, flac, aac, ogg, etc.
  | 'document'   // pdf, doc, docx, txt, rtf, etc.
  | 'spreadsheet' // xls, xlsx, csv, etc.
  | 'presentation' // ppt, pptx, etc.
  | 'archive'    // zip, rar, 7z, tar, gz, etc.
  | 'code'       // js, ts, py, java, cpp, etc.
  | 'font'       // ttf, otf, woff, woff2, etc.
  | '3d'         // obj, fbx, stl, blend, etc.
  | 'other'      // unknown or unsupported types

export type AssetStatus = 
  | 'uploaded'    // File uploaded successfully
  | 'processing'  // File being processed (thumbnails, metadata, etc.)
  | 'processed'   // File processing completed
  | 'failed'      // File processing failed
  | 'deleted'     // File marked for deletion

export interface AssetMetadata {
  description?: string
  category?: string
  tags?: string[]
  author?: string
  department?: string
  project?: string
  version?: string
  language?: string
  duration?: number        // For audio/video files (seconds)
  dimensions?: {           // For image/video files
    width: number
    height: number
  }
  bitrate?: number         // For audio/video files
  sampleRate?: number      // For audio files
  frameRate?: number       // For video files
  colorSpace?: string      // For image files
  compression?: string     // Compression algorithm used
  quality?: number         // Quality level (0-100)
  orientation?: number     // Image orientation (EXIF)
  gps?: {                  // GPS coordinates if available
    latitude: number
    longitude: number
  }
  custom?: Record<string, any> // Custom metadata fields
}

// File type detection utilities
export const FILE_TYPE_MAPPING: Record<string, FileType> = {
  // Images
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/svg+xml': 'image',
  'image/webp': 'image',
  'image/bmp': 'image',
  'image/tiff': 'image',
  'image/ico': 'image',
  
  // Videos
  'video/mp4': 'video',
  'video/avi': 'video',
  'video/mov': 'video',
  'video/wmv': 'video',
  'video/flv': 'video',
  'video/webm': 'video',
  'video/mkv': 'video',
  'video/3gpp': 'video',
  'video/quicktime': 'video',
  
  // Audio
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/flac': 'audio',
  'audio/aac': 'audio',
  'audio/ogg': 'audio',
  'audio/mp4': 'audio',
  'audio/wma': 'audio',
  'audio/webm': 'audio',
  
  // Documents
  'application/pdf': 'document',
  'text/plain': 'document',
  'text/html': 'document',
  'text/css': 'document',
  'text/javascript': 'document',
  'text/xml': 'document',
  'text/csv': 'document',
  'text/markdown': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/rtf': 'document',
  
  // Spreadsheets
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'application/vnd.oasis.opendocument.spreadsheet': 'spreadsheet',
  
  // Presentations
  'application/vnd.ms-powerpoint': 'presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
  'application/vnd.oasis.opendocument.presentation': 'presentation',
  
  // Archives
  'application/zip': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/x-tar': 'archive',
  'application/gzip': 'archive',
  'application/x-bzip2': 'archive',
  
  // Code
  'application/javascript': 'code',
  'application/json': 'code',
  'text/x-python': 'code',
  'text/x-java-source': 'code',
  'text/x-c++src': 'code',
  'text/x-c': 'code',
  'text/x-php': 'code',
  'text/x-ruby': 'code',
  'text/x-go': 'code',
  'text/x-rust': 'code',
  
  // Fonts
  'font/ttf': 'font',
  'font/otf': 'font',
  'font/woff': 'font',
  'font/woff2': 'font',
  'application/font-woff': 'font',
  'application/font-woff2': 'font',
  
  // 3D Models
  'model/obj': '3d',
  'model/fbx': '3d',
  'model/stl': '3d',
  'model/gltf': '3d',
  'model/glb': '3d',
  'application/x-blender': '3d'
}

// File size limits for different types
export const FILE_SIZE_LIMITS: Record<FileType, number> = {
  image: 50 * 1024 * 1024,        // 50MB
  video: 2 * 1024 * 1024 * 1024,  // 2GB
  audio: 500 * 1024 * 1024,        // 500MB
  document: 100 * 1024 * 1024,     // 100MB
  spreadsheet: 100 * 1024 * 1024,  // 100MB
  presentation: 100 * 1024 * 1024, // 100MB
  archive: 1 * 1024 * 1024 * 1024, // 1GB
  code: 50 * 1024 * 1024,          // 50MB
  font: 50 * 1024 * 1024,          // 50MB
  '3d': 2 * 1024 * 1024 * 1024,   // 2GB
  other: 100 * 1024 * 1024         // 100MB
}

// Allowed file extensions for each type
export const ALLOWED_EXTENSIONS: Record<FileType, string[]> = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'tiff', 'ico'],
  video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', '3gp', 'qt'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'webm'],
  document: ['pdf', 'txt', 'html', 'css', 'js', 'xml', 'csv', 'md', 'doc', 'docx', 'rtf'],
  spreadsheet: ['xls', 'xlsx', 'ods', 'csv'],
  presentation: ['ppt', 'pptx', 'odp'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
  code: ['js', 'ts', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs', 'html', 'css', 'xml', 'json'],
  font: ['ttf', 'otf', 'woff', 'woff2'],
  '3d': ['obj', 'fbx', 'stl', 'gltf', 'glb', 'blend'],
  other: []
}
