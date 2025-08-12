export interface Job {
  id?: number;
  job_type: string;
  asset_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority?: number;
  progress?: number;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  error_message?: string;
  started_at?: Date;
  completed_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface CreateJobRequest {
  job_type: string;
  asset_id: number;
  priority?: number;
  input_data?: Record<string, any>;
}

export interface UpdateJobRequest {
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority?: number;
  progress?: number;
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  error_message?: string;
  started_at?: Date;
  completed_at?: Date;
}
