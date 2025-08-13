import { Request } from 'express'
import { HttpStatus } from '../types/error.types'

// Error response interface
export interface ErrorResponse {
  success: false
  error: string
  message: string
  timestamp: string
  path?: string
  method?: string
  statusCode?: number
}

// Success response interface
export interface SuccessResponse<T = any> {
  success: true
  data: T
  message?: string
  timestamp: string
  count?: number
}

// Create error response
export const createErrorResponse = (
  error: Error | any,
  req?: Request,
  statusCode?: number
): ErrorResponse => {
  const code = statusCode || error.statusCode || HttpStatus.INTERNAL_SERVER

  return {
    success: false,
    error: error.name || 'Error',
    message: error.message || 'Something went wrong',
    timestamp: new Date().toISOString(),
    path: req?.originalUrl,
    method: req?.method,
    statusCode: code,
  }
}

// Create success response
export const createSuccessResponse = <T>(
  data: T,
  message?: string,
  count?: number
): SuccessResponse<T> => {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    count,
  }
}
