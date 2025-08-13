export interface Job {
  id?: number
  job_type: string
  asset_id: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority?: number
  progress?: number
  result?: string
  error_message?: string
  started_at?: Date
  completed_at?: Date
  created_at?: Date
  updated_at?: Date
}

export interface CreateJobRequest {
  job_type: string
  asset_id: number
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority?: number
  progress?: number
  result?: string
  error_message?: string
}

export interface UpdateJobRequest {
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority?: number
  progress?: number
  result?: string
  error_message?: string
  started_at?: Date
  completed_at?: Date
}
