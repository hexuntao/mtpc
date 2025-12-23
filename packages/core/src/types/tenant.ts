/**
 * Tenant status
 */
export type TenantStatus = 'active' | 'inactive' | 'suspended' | 'deleted';

/**
 * Tenant context - minimal runtime context
 */
export interface TenantContext {
  readonly id: string;
  readonly status?: TenantStatus;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Tenant configuration
 */
export interface TenantConfig {
  features?: Record<string, boolean>;
  limits?: Record<string, number>;
  settings?: Record<string, unknown>;
}

/**
 * Tenant info - full tenant information
 */
export interface TenantInfo extends TenantContext {
  name: string;
  slug?: string;
  config?: TenantConfig;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tenant resolver - resolves tenant from request
 */
export type TenantResolver<TRequest = unknown> = (
  request: TRequest
) => Promise<TenantContext | null> | TenantContext | null;

/**
 * Tenant validator - validates tenant context
 */
export type TenantValidator = (tenant: TenantContext) => Promise<boolean> | boolean;

/**
 * Tenant isolation level
 */
export type TenantIsolationLevel =
  | 'none' // No isolation
  | 'soft' // Logical isolation (tenantId column)
  | 'hard'; // Physical isolation (separate schema/db)

/**
 * Tenant isolation config
 */
export interface TenantIsolationConfig {
  level: TenantIsolationLevel;
  columnName?: string;
  schemaPrefix?: string;
}

/**
 * Multi-tenant options
 */
export interface MultiTenantOptions {
  enabled: boolean;
  isolation: TenantIsolationConfig;
  defaultTenantId?: string;
  allowCrossTenant?: boolean;
  resolver?: TenantResolver;
  validator?: TenantValidator;
}
