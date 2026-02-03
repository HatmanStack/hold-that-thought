import { describe, it, expect } from 'vitest'

// Import the error utilities
import {
  toError,
  getStatusCode,
  getUserMessage,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  isConditionalCheckFailed,
  isAwsError,
  hasErrorName,
} from '../../backend/lambdas/api/src/lib/errors.ts'

describe('toError utility', () => {
  it('should return Error objects as-is', () => {
    const original = new Error('test error')
    const result = toError(original)
    expect(result).toBe(original)
    expect(result.message).toBe('test error')
  })

  it('should wrap string values in Error', () => {
    const result = toError('string error')
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('string error')
  })

  it('should handle null gracefully', () => {
    const result = toError(null)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('An error occurred (null)')
  })

  it('should handle undefined gracefully', () => {
    const result = toError(undefined)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('An error occurred (undefined)')
  })

  it('should convert objects with message property', () => {
    const obj = { message: 'object error', code: 123 }
    const result = toError(obj)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('object error')
  })

  it('should JSON stringify plain objects', () => {
    const obj = { code: 'ERR001', details: 'something' }
    const result = toError(obj)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toContain('ERR001')
  })

  it('should handle numbers', () => {
    const result = toError(42)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('42')
  })

  it('should handle booleans', () => {
    const result = toError(false)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('false')
  })
})

describe('AppError classes', () => {
  describe('ValidationError', () => {
    it('should have status code 400', () => {
      const error = new ValidationError('Invalid input')
      expect(error.statusCode).toBe(400)
      expect(error.message).toBe('Invalid input')
      expect(error.isOperational).toBe(true)
    })
  })

  describe('AuthenticationError', () => {
    it('should have status code 401', () => {
      const error = new AuthenticationError()
      expect(error.statusCode).toBe(401)
      expect(error.message).toBe('Authentication required')
    })

    it('should accept custom message', () => {
      const error = new AuthenticationError('Token expired')
      expect(error.message).toBe('Token expired')
    })
  })

  describe('AuthorizationError', () => {
    it('should have status code 403', () => {
      const error = new AuthorizationError()
      expect(error.statusCode).toBe(403)
      expect(error.isOperational).toBe(true)
    })
  })

  describe('NotFoundError', () => {
    it('should have status code 404', () => {
      const error = new NotFoundError('User not found')
      expect(error.statusCode).toBe(404)
      expect(error.message).toBe('User not found')
    })
  })

  describe('ConflictError', () => {
    it('should have status code 409', () => {
      const error = new ConflictError('Resource already exists')
      expect(error.statusCode).toBe(409)
    })
  })

  describe('RateLimitError', () => {
    it('should have status code 429 and retryAfter', () => {
      const error = new RateLimitError('Too many requests', 60)
      expect(error.statusCode).toBe(429)
      expect(error.retryAfter).toBe(60)
    })
  })

  describe('InternalError', () => {
    it('should have status code 500 and not be operational', () => {
      const error = new InternalError()
      expect(error.statusCode).toBe(500)
      expect(error.isOperational).toBe(false)
    })
  })
})

describe('getStatusCode', () => {
  it('should return status code from AppError', () => {
    expect(getStatusCode(new ValidationError('test'))).toBe(400)
    expect(getStatusCode(new NotFoundError())).toBe(404)
    expect(getStatusCode(new InternalError())).toBe(500)
  })

  it('should return 500 for regular Error', () => {
    expect(getStatusCode(new Error('test'))).toBe(500)
  })

  it('should return 500 for non-Error values', () => {
    expect(getStatusCode('string')).toBe(500)
    expect(getStatusCode(null)).toBe(500)
  })
})

describe('getUserMessage', () => {
  it('should return message for operational errors', () => {
    const error = new ValidationError('Invalid email format')
    expect(getUserMessage(error)).toBe('Invalid email format')
  })

  it('should return generic message for non-operational errors', () => {
    const error = new InternalError('database connection failed')
    expect(getUserMessage(error)).toBe('An unexpected error occurred')
  })

  it('should return generic message for non-AppError', () => {
    expect(getUserMessage(new Error('test'))).toBe('An unexpected error occurred')
    expect(getUserMessage('string')).toBe('An unexpected error occurred')
  })
})

describe('isAwsError', () => {
  it('should return true for Error with name property', () => {
    const error = new Error('test')
    error.name = 'SomeAwsError'
    expect(isAwsError(error)).toBe(true)
  })

  it('should return true for standard Error (has name)', () => {
    const error = new Error('test')
    expect(isAwsError(error)).toBe(true)
  })

  it('should return false for non-Error values', () => {
    expect(isAwsError('string')).toBe(false)
    expect(isAwsError(null)).toBe(false)
    expect(isAwsError(undefined)).toBe(false)
    expect(isAwsError({ name: 'NotAnError' })).toBe(false)
  })
})

describe('hasErrorName', () => {
  it('should return true when error name matches', () => {
    const error = new Error('test')
    error.name = 'ConditionalCheckFailedException'
    expect(hasErrorName(error, 'ConditionalCheckFailedException')).toBe(true)
  })

  it('should return false when error name does not match', () => {
    const error = new Error('test')
    error.name = 'SomeOtherError'
    expect(hasErrorName(error, 'ConditionalCheckFailedException')).toBe(false)
  })

  it('should return false for non-Error values', () => {
    expect(hasErrorName('string', 'SomeError')).toBe(false)
    expect(hasErrorName(null, 'SomeError')).toBe(false)
    expect(hasErrorName({ name: 'FakeError' }, 'FakeError')).toBe(false)
  })
})

describe('isConditionalCheckFailed', () => {
  it('should return true for ConditionalCheckFailedException', () => {
    const error = new Error('Condition not met')
    error.name = 'ConditionalCheckFailedException'
    expect(isConditionalCheckFailed(error)).toBe(true)
  })

  it('should return false for other errors', () => {
    expect(isConditionalCheckFailed(new Error('test'))).toBe(false)
    expect(isConditionalCheckFailed(new ValidationError('test'))).toBe(false)
  })

  it('should return false for non-Error values', () => {
    expect(isConditionalCheckFailed('string')).toBe(false)
    expect(isConditionalCheckFailed(null)).toBe(false)
  })
})
