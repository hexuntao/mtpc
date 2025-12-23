/**
 * MTPC Default action names
 */
export const DEFAULT_ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
} as const;

export type DefaultAction = (typeof DEFAULT_ACTIONS)[keyof typeof DEFAULT_ACTIONS];

/**
 * Permission code separator
 */
export const PERMISSION_SEPARATOR = ':';

/**
 * Wildcard permission
 */
export const PERMISSION_WILDCARD = '*';

/**
 * Default tenant header
 */
export const DEFAULT_TENANT_HEADER = 'x-tenant-id';

/**
 * Default subject header
 */
export const DEFAULT_SUBJECT_HEADER = 'x-subject-id';
