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

// File type categorization
export type FileType =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'archive'
  | 'code'
  | 'font'
  | '3d'
  | 'other'

export type AssetStatus =
  | 'uploaded'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'deleted'

export interface AssetMetadata {
  description?: string
  category?: string
  tags?: string[]
  author?: string
  department?: string
  project?: string
  version?: string
  language?: string
  duration?: number
  dimensions?: {
    width: number
    height: number
  }
  bitrate?: number
  sampleRate?: number
  frameRate?: number
  colorSpace?: string
  compression?: string
  quality?: number
  orientation?: number
  gps?: {
    latitude: number
    longitude: number
  }
  // Duplicate detection and file management
  contentHash?: string
  fileType?: string
  extension?: string
  uploadMethod?: string
  formattedSize?: string
  uploadTimestamp?: string
  replacedFrom?: string
  replacedAt?: string

  // Processing results
  thumbnail_path?: string
  thumbnail_generated?: boolean
  thumbnail_dimensions?: {
    width: number
    height: number
  }
  video_transcode?: {
    success: boolean
    resolutions?: string[]
    output_paths?: string[]
  }

  custom?: Record<string, any>
}

// File type detection utilities
export const FILE_TYPE_MAPPING: Record<string, FileType> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/svg+xml': 'image',
  'image/webp': 'image',
  'image/bmp': 'image',
  'image/tiff': 'image',
  'image/ico': 'image',

  'video/mp4': 'video',
  'video/avi': 'video',
  'video/mov': 'video',
  'video/wmv': 'video',
  'video/flv': 'video',
  'video/webm': 'video',
  'video/mkv': 'video',
  'video/3gpp': 'video',
  'video/quicktime': 'video',

  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/flac': 'audio',
  'audio/aac': 'audio',
  'audio/ogg': 'audio',
  'audio/mp4': 'audio',
  'audio/wma': 'audio',
  'audio/webm': 'audio',

  'application/pdf': 'document',
  'text/plain': 'document',
  'text/html': 'document',
  'text/css': 'document',
  'text/javascript': 'document',
  'text/xml': 'document',
  'text/csv': 'document',
  'text/markdown': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'document',
  'application/rtf': 'document',

  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    'spreadsheet',
  'application/vnd.oasis.opendocument.spreadsheet': 'spreadsheet',

  'application/vnd.ms-powerpoint': 'presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'presentation',
  'application/vnd.oasis.opendocument.presentation': 'presentation',

  'application/zip': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/x-tar': 'archive',
  'application/gzip': 'archive',
  'application/x-bzip2': 'archive',

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

  'font/ttf': 'font',
  'font/otf': 'font',
  'font/woff': 'font',
  'font/woff2': 'font',
  'application/font-woff': 'font',
  'application/font-woff2': 'font',

  'model/obj': '3d',
  'model/fbx': '3d',
  'model/stl': '3d',
  'model/gltf': '3d',
  'model/glb': '3d',
  'application/x-blender': '3d',
}

// File size limits for different types
export const FILE_SIZE_LIMITS: Record<FileType, number> = {
  image: 50 * 1024 * 1024,
  video: 2 * 1024 * 1024 * 1024,
  audio: 500 * 1024 * 1024,
  document: 100 * 1024 * 1024,
  spreadsheet: 100 * 1024 * 1024,
  presentation: 100 * 1024 * 1024,
  archive: 1 * 1024 * 1024 * 1024,
  code: 50 * 1024 * 1024,
  font: 50 * 1024 * 1024,
  '3d': 2 * 1024 * 1024 * 1024,
  other: 100 * 1024 * 1024,
}

// Allowed file extensions for each type
export const ALLOWED_EXTENSIONS: Record<FileType, string[]> = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'tiff', 'ico'],
  video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', '3gp', 'qt'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'webm'],
  document: [
    'pdf',
    'txt',
    'html',
    'css',
    'js',
    'xml',
    'csv',
    'md',
    'doc',
    'docx',
    'rtf',
  ],
  spreadsheet: ['xls', 'xlsx', 'ods', 'csv'],
  presentation: ['ppt', 'pptx', 'odp'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
  code: [
    'js',
    'ts',
    'py',
    'java',
    'cpp',
    'c',
    'php',
    'rb',
    'go',
    'rs',
    'html',
    'css',
    'xml',
    'json',
  ],
  font: ['ttf', 'otf', 'woff', 'woff2'],
  '3d': ['obj', 'fbx', 'stl', 'gltf', 'glb', 'blend'],
  other: [],
}
