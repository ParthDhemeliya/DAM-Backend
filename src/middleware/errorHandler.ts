import { Request, Response, NextFunction } from 'express'
import { createErrorResponse } from '../utils/response.utils'
import { createValidationError, createUnauthorizedError } from '../utils/errors'
import { ErrorType, HttpStatus } from '../types/error.types'

// Error handler middleware using enums

export const errorHandler = (
  error: Error | any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  })

  // If it's our custom API error, use its status code
  if (error.statusCode) {
    const errorResponse = createErrorResponse(error, req)
    res.status(error.statusCode).json(errorResponse)
    return
  }

  // Handle specific error types using enums
  if (error.name === ErrorType.VALIDATION_ERROR) {
    const errorResponse = createErrorResponse(
      error,
      req,
      HttpStatus.BAD_REQUEST
    )
    res.status(HttpStatus.BAD_REQUEST).json(errorResponse)
    return
  }

  if (error.name === ErrorType.CAST_ERROR) {
    const errorResponse = createErrorResponse(
      createValidationError('Invalid ID format'),
      req,
      HttpStatus.BAD_REQUEST
    )
    res.status(HttpStatus.BAD_REQUEST).json(errorResponse)
    return
  }

  if (error.name === ErrorType.JWT_ERROR) {
    const errorResponse = createErrorResponse(
      createUnauthorizedError('Invalid token'),
      req,
      HttpStatus.UNAUTHORIZED
    )
    res.status(HttpStatus.UNAUTHORIZED).json(errorResponse)
    return
  }

  if (error.name === ErrorType.TOKEN_EXPIRED) {
    const errorResponse = createErrorResponse(
      createUnauthorizedError('Token expired'),
      req,
      HttpStatus.UNAUTHORIZED
    )
    res.status(HttpStatus.UNAUTHORIZED).json(errorResponse)
    return
  }

  // Default error response
  const errorResponse = createErrorResponse(
    error,
    req,
    HttpStatus.INTERNAL_SERVER
  )
  res.status(HttpStatus.INTERNAL_SERVER).json(errorResponse)
}
