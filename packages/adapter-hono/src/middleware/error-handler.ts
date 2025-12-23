import {
  MissingTenantContextError,
  MTPCError,
  PermissionDeniedError,
  ResourceNotFoundError,
  ValidationError,
} from '@mtpc/shared';
import type { Context, ErrorHandler } from 'hono';

/**
 * Error response format
 */

/**
 * MTPC error handler for Hono
 */
export const mtpcErrorHandler = (options = {}) => {
  const { includeStack = false, onError } = options;

  const handler = async (err, c) => {
    // Call custom error handler if provided
    if (onError) {
      await onError(err, c);
    }

    // Handle MTPC errors
    if (err instanceof MTPCError) {
      const status = getStatusCode(err);

      const response = {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      };

      if (includeStack && err.stack) {
        response.error.stack = err.stack;
      }

      return c.json(response, status);
    }

    // Handle Zod validation errors
    if (err.name === 'ZodError') {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: { issues: err.issues },
          },
        },
        400
      );
    }

    // Handle generic errors
    console.error('Unhandled error:', err);

    const response = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      },
    };

    if (includeStack && err.stack && process.env.NODE_ENV !== 'production') {
      response.error.stack = err.stack;
    }

    return c.json(response, 500);
  };

  return handler;
};

/**
 * Get HTTP status code for error
 */
function getStatusCode(err) {
  if (err instanceof PermissionDeniedError) {
    return 403;
  }

  if (err instanceof MissingTenantContextError) {
    return 400;
  }

  if (err instanceof ResourceNotFoundError) {
    return 404;
  }

  if (err instanceof ValidationError) {
    return 400;
  }

  if (err.code?.includes('NOT_FOUND')) {
    return 404;
  }

  if (err.code?.includes('DENIED') || err.code?.includes('UNAUTHORIZED')) {
    return 403;
  }

  if (err.code?.includes('VALIDATION') || err.code?.includes('INVALID')) {
    return 400;
  }

  return 500;
}

/**
 * Not found handler
 */
export const notFoundHandler = c => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route not found: ${c.req.method} ${c.req.path}`,
      },
    },
    404
  );
};
