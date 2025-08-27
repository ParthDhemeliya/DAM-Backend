// Error factory functions
export const createValidationError = (message: string) => ({
  name: 'ValidationError',
  message,
  statusCode: 400,
  isOperational: true,
  stack: new Error().stack,
});

export const createUnauthorizedError = (
  message: string = 'Unauthorized access'
) => ({
  name: 'UnauthorizedError',
  message,
  statusCode: 401,
  isOperational: true,
  stack: new Error().stack,
});
