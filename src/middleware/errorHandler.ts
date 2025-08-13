import { Request, Response, NextFunction } from 'express'
import { createErrorResponse } from '../utils/response.utils'
import { createValidationError, createUnauthorizedError } from '../utils/errors'

// Error handler middleware


//use enum
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

  // Handle specific error types
  if (error.name === 'ValidationError') {
    const errorResponse = createErrorResponse(error, req, 400)
    res.status(400).json(errorResponse)
    return
  }

  if (error.name === 'CastError') {
    const errorResponse = createErrorResponse(
      createValidationError('Invalid ID format'),
      req,
      400
    )
    res.status(400).json(errorResponse)
    return
  }

  if (error.name === 'JsonWebTokenError') {
    const errorResponse = createErrorResponse(
      createUnauthorizedError('Invalid token'),
      req,
      401
    )
    res.status(401).json(errorResponse)
    return
  }

  if (error.name === 'TokenExpiredError') {
    const errorResponse = createErrorResponse(
      createUnauthorizedError('Token expired'),
      req,
      401
    )
    res.status(401).json(errorResponse)
    return
  }

  // Default error response
  const errorResponse = createErrorResponse(error, req, 500)
  res.status(500).json(errorResponse)
}
