import { ErrorType, HttpStatus } from '../types/error.types'

// Error factory functions using enums
export const createApiError = (
  message: string,
  statusCode: number = HttpStatus.INTERNAL_SERVER,
  isOperational: boolean = true
) => ({
  name: ErrorType.API_ERROR,
  message,
  statusCode,
  isOperational,
  stack: new Error().stack,
})

export const createValidationError = (message: string) => ({
  name: ErrorType.VALIDATION_ERROR,
  message,
  statusCode: HttpStatus.BAD_REQUEST,
  isOperational: true,
  stack: new Error().stack,
})

export const createNotFoundError = (
  message: string = 'Resource not found'
) => ({
  name: ErrorType.NOT_FOUND,
  message,
  statusCode: HttpStatus.NOT_FOUND,
  isOperational: true,
  stack: new Error().stack,
})

export const createUnauthorizedError = (
  message: string = 'Unauthorized access'
) => ({
  name: ErrorType.UNAUTHORIZED,
  message,
  statusCode: HttpStatus.UNAUTHORIZED,
  isOperational: true,
  stack: new Error().stack,
})

export const createForbiddenError = (message: string = 'Forbidden access') => ({
  name: ErrorType.FORBIDDEN,
  message,
  statusCode: HttpStatus.FORBIDDEN,
  isOperational: true,
  stack: new Error().stack,
})

export const createConflictError = (message: string = 'Resource conflict') => ({
  name: ErrorType.CONFLICT,
  message,
  statusCode: HttpStatus.CONFLICT,
  isOperational: true,
  stack: new Error().stack,
})

export const createRateLimitError = (
  message: string = 'Too many requests'
) => ({
  name: ErrorType.RATE_LIMIT,
  message,
  statusCode: HttpStatus.RATE_LIMIT,
  isOperational: true,
  stack: new Error().stack,
})

export const createDatabaseError = (
  message: string = 'Database operation failed'
) => ({
  name: ErrorType.DATABASE_ERROR,
  message,
  statusCode: HttpStatus.INTERNAL_SERVER,
  isOperational: false,
  stack: new Error().stack,
})
