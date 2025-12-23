import { MTPCError } from './base.js';

/**
 * Permission denied error
 */
export class PermissionDeniedError extends MTPCError {
  constructor(permission: string, details?: Record<string, unknown>) {
    super(`Permission denied: ${permission}`, 'PERMISSION_DENIED', { permission, ...details });
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Permission not found error
 */
export class PermissionNotFoundError extends MTPCError {
  constructor(permission: string) {
    super(`Permission not found: ${permission}`, 'PERMISSION_NOT_FOUND', { permission });
    this.name = 'PermissionNotFoundError';
  }
}

/**
 * Invalid permission code error
 */
export class InvalidPermissionCodeError extends MTPCError {
  constructor(code: string, reason: string) {
    super(`Invalid permission code "${code}": ${reason}`, 'INVALID_PERMISSION_CODE', {
      code,
      reason,
    });
    this.name = 'InvalidPermissionCodeError';
  }
}
