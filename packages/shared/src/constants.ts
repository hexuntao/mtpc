/**
 * MTPC 默认操作名称
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
 * 权限代码分隔符
 */
export const PERMISSION_SEPARATOR = ':';

/**
 * 通配符权限
 */
export const PERMISSION_WILDCARD = '*';

/**
 * 默认租户头信息
 */
export const DEFAULT_TENANT_HEADER = 'x-tenant-id';

/**
 * 默认主体头信息
 */
export const DEFAULT_SUBJECT_HEADER = 'x-subject-id';
