// Error factory functions (no classes)
export const createApiError = (
  message: string,
  statusCode: number = 500,
  isOperational: boolean = true
) => ({
  name: 'ApiError',
  message,
  statusCode,
  isOperational,
  stack: new Error().stack,
})

export const createValidationError = (message: string) => ({
  name: 'ValidationError',
  message,
  statusCode: 400,
  isOperational: true,
  stack: new Error().stack,
})

export const createNotFoundError = (
  message: string = 'Resource not found'
) => ({
  name: 'NotFoundError',
  message,
  statusCode: 404,
  isOperational: true,
  stack: new Error().stack,
})

export const createUnauthorizedError = (
  message: string = 'Unauthorized access'
) => ({
  name: 'UnauthorizedError',
  message,
  statusCode: 401,
  isOperational: true,
  stack: new Error().stack,
})

export const createForbiddenError = (message: string = 'Forbidden access') => ({
  name: 'ForbiddenError',
  message,
  statusCode: 403,
  isOperational: true,
  stack: new Error().stack,
})

export const createConflictError = (message: string = 'Resource conflict') => ({
  name: 'ConflictError',
  message,
  statusCode: 409,
  isOperational: true,
  stack: new Error().stack,
})

export const createRateLimitError = (
  message: string = 'Too many requests'
) => ({
  name: 'RateLimitError',
  message,
  statusCode: 429,
  isOperational: true,
  stack: new Error().stack,
})

export const createDatabaseError = (
  message: string = 'Database operation failed'
) => ({
  name: 'DatabaseError',
  message,
  statusCode: 500,
  isOperational: false,
  stack: new Error().stack,
})
