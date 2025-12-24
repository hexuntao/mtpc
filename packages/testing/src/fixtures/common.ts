import type { SubjectContext, TenantContext } from '@mtpc/core';

/**
 * 通用测试租户
 */
export const TEST_TENANTS = {
  default: {
    id: 'test-tenant-default',
    status: 'active' as const,
  },
  secondary: {
    id: 'test-tenant-secondary',
    status: 'active' as const,
  },
  inactive: {
    id: 'test-tenant-inactive',
    status: 'inactive' as const,
  },
  suspended: {
    id: 'test-tenant-suspended',
    status: 'suspended' as const,
  },
} satisfies Record<string, TenantContext>;

/**
 * 通用测试主体
 */
export const TEST_SUBJECTS = {
  admin: {
    id: 'test-admin',
    type: 'user' as const,
    roles: ['admin'],
    permissions: ['*'],
  },
  manager: {
    id: 'test-manager',
    type: 'user' as const,
    roles: ['manager'],
    permissions: [],
  },
  viewer: {
    id: 'test-viewer',
    type: 'user' as const,
    roles: ['viewer'],
    permissions: [],
  },
  anonymous: {
    id: 'anonymous',
    type: 'anonymous' as const,
    roles: [],
    permissions: [],
  },
  system: {
    id: 'system',
    type: 'system' as const,
    roles: ['system'],
    permissions: ['*'],
  },
} satisfies Record<string, SubjectContext>;

/**
 * 通用测试角色权限
 */
export const TEST_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  manager: ['product:*', 'order:*', 'customer:read', 'customer:list'],
  viewer: [
    'product:read',
    'product:list',
    'order:read',
    'order:list',
    'customer:read',
    'customer:list',
  ],
  guest: [],
};

/**
 * 通用测试资源
 */
export const TEST_RESOURCES = ['product', 'order', 'customer'] as const;

/**
 * 通用测试操作
 */
export const TEST_ACTIONS = ['create', 'read', 'update', 'delete', 'list'] as const;

/**
 * 生成所有权限代码
 */
export function generateAllPermissions(
  resources: readonly string[] = TEST_RESOURCES,
  actions: readonly string[] = TEST_ACTIONS
): string[] {
  const permissions: string[] = [];
  for (const resource of resources) {
    for (const action of actions) {
      permissions.push(`${resource}:${action}`);
    }
  }
  return permissions;
}
