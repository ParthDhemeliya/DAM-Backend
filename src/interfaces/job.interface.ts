export interface Job {
  id?: number
  job_type: string
  asset_id: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  priority?: number
  progress?: number
  started_at?: Date
  completed_at?: Date
  created_at?: Date
  updated_at?: Date
  output_data?: any
  error_message?: string
}

export interface CreateJobRequest {
  job_type: string
  asset_id: number
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  priority?: number
  progress?: number
  input_data?: any
}

export interface UpdateJobRequest {
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  priority?: number
  progress?: number
  started_at?: Date
  completed_at?: Date
  output_data?: any
  error_message?: string
}
