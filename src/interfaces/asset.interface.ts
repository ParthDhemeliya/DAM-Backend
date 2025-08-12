export interface Asset {
  id?: number;
  filename: string;
  original_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  storage_bucket?: string;
  status: 'uploaded' | 'processing' | 'processed' | 'failed' | 'deleted';
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
  processed_at?: Date;
  deleted_at?: Date;
}

export interface CreateAssetRequest {
  filename: string;
  original_name: string;
  file_type: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  storage_bucket?: string;
  metadata?: Record<string, any>;
}

export interface UpdateAssetRequest {
  filename?: string;
  status?: 'uploaded' | 'processing' | 'processed' | 'failed' | 'deleted';
  metadata?: Record<string, any>;
  processed_at?: Date;
  deleted_at?: Date;
}
