// Error type enums for consistent error handling
export enum ErrorType {
  VALIDATION_ERROR = 'ValidationError',
  CAST_ERROR = 'CastError',
  JWT_ERROR = 'JsonWebTokenError',
  TOKEN_EXPIRED = 'TokenExpiredError',
  NOT_FOUND = 'NotFoundError',
  UNAUTHORIZED = 'UnauthorizedError',
  FORBIDDEN = 'ForbiddenError',
  CONFLICT = 'ConflictError',
  RATE_LIMIT = 'RateLimitError',
  DATABASE_ERROR = 'DatabaseError',
  API_ERROR = 'ApiError',
}

// HTTP status code enums
export enum HttpStatus {
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  RATE_LIMIT = 429,
  INTERNAL_SERVER = 500,
}
