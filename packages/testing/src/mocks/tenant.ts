import type { TenantContext } from '@mtpc/core';
import type { MockTenantOptions } from '../types.js';

let tenantCounter = 0;

/**
 * Create a mock tenant context
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
 * Create a default test tenant
 */
export function createDefaultTenant(): TenantContext {
  return {
    id: 'default-test-tenant',
    status: 'active',
  };
}

/**
 * Create a system tenant
 */
export function createSystemTenant(): TenantContext {
  return {
    id: 'system',
    status: 'active',
    metadata: { isSystem: true },
  };
}

/**
 * Create multiple mock tenants
 */
export function createMockTenants(count: number): TenantContext[] {
  return Array.from({ length: count }, (_, i) => createMockTenant({ id: `test-tenant-${i + 1}` }));
}
