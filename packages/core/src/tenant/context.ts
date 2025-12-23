import type {
  TenantContext,
  TenantConfig,
  TenantInfo,
  TenantStatus,
} from '../types/index.js';
import { MissingTenantContextError, InvalidTenantError } from '@mtpc/shared';

/**
 * Create a tenant context
 */
export function createTenantContext(
  id: string,
  options?: {
    status?: TenantStatus;
    metadata?: Record<string, unknown>;
  }
): TenantContext {
  if (!id || typeof id !== 'string') {
    throw new InvalidTenantError('Tenant ID must be a non-empty string');
  }

  return {
    id,
    status: options?.status ?? 'active',
    metadata: options?.metadata,
  };
}

/**
 * Validate tenant context
 */
export function validateTenantContext(
  tenant: TenantContext | null | undefined
): asserts tenant is TenantContext {
  if (!tenant) {
    throw new MissingTenantContextError();
  }

  if (!tenant.id || typeof tenant.id !== 'string') {
    throw new InvalidTenantError('Tenant ID must be a non-empty string');
  }

  if (tenant.status === 'suspended') {
    throw new InvalidTenantError('Tenant is suspended');
  }

  if (tenant.status === 'deleted') {
    throw new InvalidTenantError('Tenant is deleted');
  }
}

/**
 * Check if tenant is active
 */
export function isTenantActive(tenant: TenantContext): boolean {
  return !tenant.status || tenant.status === 'active';
}

/**
 * Create a system tenant (for internal operations)
 */
export function createSystemTenant(): TenantContext {
  return {
    id: 'system',
    status: 'active',
    metadata: { isSystem: true },
  };
}

/**
 * Default tenant for single-tenant mode
 */
export const DEFAULT_TENANT: TenantContext = {
  id: 'default',
  status: 'active',
} as const;

/**
 * Tenant context holder (for async local storage pattern)
 */
export class TenantContextHolder {
  private static context: TenantContext | null = null;

  static set(tenant: TenantContext): void {
    this.context = tenant;
  }

  static get(): TenantContext | null {
    return this.context;
  }

  static getOrThrow(): TenantContext {
    if (!this.context) {
      throw new MissingTenantContextError();
    }
    return this.context;
  }

  static clear(): void {
    this.context = null;
  }

  static run<T>(tenant: TenantContext, fn: () => T): T {
    const previous = this.context;
    this.context = tenant;
    try {
      return fn();
    } finally {
      this.context = previous;
    }
  }

  static async runAsync<T>(
    tenant: TenantContext,
    fn: () => Promise<T>
  ): Promise<T> {
    const previous = this.context;
    this.context = tenant;
    try {
      return await fn();
    } finally {
      this.context = previous;
    }
  }
}
