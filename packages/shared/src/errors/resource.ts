import { MTPCError } from './base.js';

/**
 * Resource not found error
 */
export class ResourceNotFoundError extends MTPCError {
  constructor(resourceName: string) {
    super(`Resource not found: ${resourceName}`, 'RESOURCE_NOT_FOUND', { resourceName });
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Resource already exists error
 */
export class ResourceAlreadyExistsError extends MTPCError {
  constructor(resourceName: string) {
    super(`Resource already exists: ${resourceName}`, 'RESOURCE_ALREADY_EXISTS', { resourceName });
    this.name = 'ResourceAlreadyExistsError';
  }
}

/**
 * Invalid resource definition error
 */
export class InvalidResourceDefinitionError extends MTPCError {
  constructor(resourceName: string, reason: string) {
    super(
      `Invalid resource definition for "${resourceName}": ${reason}`,
      'INVALID_RESOURCE_DEFINITION',
      { resourceName, reason }
    );
    this.name = 'InvalidResourceDefinitionError';
  }
}

/**
 * Resource operation not allowed error
 */
export class ResourceOperationNotAllowedError extends MTPCError {
  constructor(resourceName: string, operation: string) {
    super(
      `Operation "${operation}" not allowed on resource "${resourceName}"`,
      'RESOURCE_OPERATION_NOT_ALLOWED',
      { resourceName, operation }
    );
    this.name = 'ResourceOperationNotAllowedError';
  }
}
