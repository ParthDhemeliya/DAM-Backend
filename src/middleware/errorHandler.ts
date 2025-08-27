import { Request, Response, NextFunction } from 'express';
import {
  createValidationError,
  createUnauthorizedError,
} from '../utils/errors';

// Simple error response function
const createErrorResponse = (
  error: any,
  req: Request,
  statusCode: number = 500
) => ({
  success: false,
  error: error.message || 'Internal server error',
  timestamp: new Date().toISOString(),
  path: req.originalUrl,
  method: req.method,
});

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
  });

  // If it's our custom API error, use its status code
  if (error.statusCode) {
    const errorResponse = createErrorResponse(error, req, error.statusCode);
    res.status(error.statusCode).json(errorResponse);
    return;
  }

  // Handle specific error types
  if (error.name === 'ValidationError') {
    const errorResponse = createErrorResponse(error, req, 400);
    res.status(400).json(errorResponse);
    return;
  }

  if (error.name === 'CastError') {
    const errorResponse = createErrorResponse(
      createValidationError('Invalid ID format'),
      req,
      400
    );
    res.status(400).json(errorResponse);
    return;
  }

  if (error.name === 'JWTError') {
    const errorResponse = createErrorResponse(
      createUnauthorizedError('Invalid token'),
      req,
      401
    );
    res.status(401).json(errorResponse);
    return;
  }

  if (error.name === 'TokenExpired') {
    const errorResponse = createErrorResponse(
      createUnauthorizedError('Token expired'),
      req,
      401
    );
    res.status(401).json(errorResponse);
    return;
  }

  // Default error response
  const errorResponse = createErrorResponse(error, req, 500);
  res.status(500).json(errorResponse);
};
