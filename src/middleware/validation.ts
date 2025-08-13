import { createValidationError } from '../utils/errors'

// Validation helper functions
export const validateRequired = (value: any, fieldName: string): void => {
  if (value === undefined || value === null || value === '') {
    throw createValidationError(`${fieldName} is required`)
  }
}

export const validateString = (
  value: any,
  fieldName: string,
  minLength: number = 1
): void => {
  validateRequired(value, fieldName)
  if (typeof value !== 'string' || value.trim().length < minLength) {
    throw createValidationError(
      `${fieldName} must be a string with at least ${minLength} character(s)`
    )
  }
}

export const validateNumber = (
  value: any,
  fieldName: string,
  min?: number,
  max?: number
): void => {
  validateRequired(value, fieldName)
  if (typeof value !== 'number' || isNaN(value)) {
    throw createValidationError(`${fieldName} must be a valid number`)
  }
  if (min !== undefined && value < min) {
    throw createValidationError(`${fieldName} must be at least ${min}`)
  }
  if (max !== undefined && value > max) {
    throw createValidationError(`${fieldName} must be at most ${max}`)
  }
}

export const validateInteger = (
  value: any,
  fieldName: string,
  min?: number,
  max?: number
): void => {
  validateNumber(value, fieldName, min, max)
  if (!Number.isInteger(value)) {
    throw createValidationError(`${fieldName} must be an integer`)
  }
}

export const validateEnum = (
  value: any,
  fieldName: string,
  allowedValues: string[]
): void => {
  validateRequired(value, fieldName)
  if (!allowedValues.includes(value)) {
    throw createValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`
    )
  }
}

export const validateDate = (value: any, fieldName: string): void => {
  validateRequired(value, fieldName)
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    throw createValidationError(`${fieldName} must be a valid date`)
  }
}
