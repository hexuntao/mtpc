import type { TenantContext } from '@mtpc/core';
import type { MockTenantOptions } from '../types.js';

let tenantCounter = 0;

/**
 * 创建模拟租户上下文
 */
export function createMockTenant(idOrOptions?: string | MockTenantOptions): TenantContext {
  const options: MockTenantOptions =
    typeof idOrOptions === 'string' ? { id: idOrOptions } : (idOrOptions ?? {});

  return {
    id: options.id ?? `test-tenant-${++tenantCounter}`,
    status: options.status ?? 'active',
    metadata: options.metadata,
  };
}

/**
 * 创建默认测试租户
 */
export function createDefaultTenant(): TenantContext {
  return {
    id: 'default-test-tenant',
    status: 'active',
  };
}

/**
 * 创建系统租户
 */
export function createSystemTenant(): TenantContext {
  return {
    id: 'system',
    status: 'active',
    metadata: { isSystem: true },
  };
}

/**
 * 创建多个模拟租户
 */
export function createMockTenants(count: number): TenantContext[] {
  return Array.from({ length: count }, (_, i) => createMockTenant({ id: `test-tenant-${i + 1}` }));
}
