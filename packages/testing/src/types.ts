import type {
  MTPCContext,
  Permission,
  PermissionCheckResult,
  PolicyDefinition,
  ResourceDefinition,
  SubjectContext,
  TenantContext,
} from '@mtpc/core';

/**
 * Mock tenant options
 */
export interface MockTenantOptions {
  id?: string;
  status?: 'active' | 'inactive' | 'suspended';
  metadata?: Record<string, unknown>;
}

/**
 * Mock subject options
 */
export interface MockSubjectOptions {
  id?: string;
  type?: 'user' | 'service' | 'system' | 'anonymous';
  roles?: string[];
  permissions?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Mock context options
 */
export interface MockContextOptions {
  tenant?: TenantContext | MockTenantOptions;
  subject?: SubjectContext | MockSubjectOptions;
  requestId?: string;
  timestamp?: Date;
  ip?: string;
  path?: string;
  method?: string;
}

/**
 * Mock MTPC options
 */
export interface MockMTPCOptions {
  resources?: ResourceDefinition[];
  policies?: PolicyDefinition[];
  defaultPermissions?: string[];
  defaultDeny?: boolean;
}

/**
 * Permission grant entry
 */
export interface PermissionGrant {
  tenantId: string;
  subjectId: string;
  permissions: Set<string>;
}

/**
 * Permission check spy
 */
export interface PermissionCheckSpy {
  calls: Array<{
    context: {
      tenantId: string;
      subjectId: string;
      resource: string;
      action: string;
    };
    result: PermissionCheckResult;
    timestamp: Date;
  }>;
  reset(): void;
  getCallsFor(permission: string): PermissionCheckSpy['calls'];
  wasChecked(permission: string): boolean;
  wasAllowed(permission: string): boolean;
  wasDenied(permission: string): boolean;
}

/**
 * Test permission matrix entry
 */
export interface PermissionMatrixEntry {
  role: string;
  permission: string;
  expected: boolean;
}

/**
 * Test context
 */
export interface TestContext {
  mtpc: MockMTPC;
  tenant: TenantContext;
  subject: SubjectContext;
  ctx: MTPCContext;
}

/**
 * Mock MTPC interface
 */
export interface MockMTPC {
  // Permission management
  grantPermission(permission: string, subjectId?: string, tenantId?: string): void;
  grantPermissions(permissions: string[], subjectId?: string, tenantId?: string): void;
  revokePermission(permission: string, subjectId?: string, tenantId?: string): void;
  revokeAllPermissions(subjectId?: string, tenantId?: string): void;
  setPermissions(permissions: string[], subjectId?: string, tenantId?: string): void;

  // Check
  checkPermission(context: {
    tenant: TenantContext;
    subject: SubjectContext;
    resource: string;
    action: string;
  }): Promise<PermissionCheckResult>;

  // Spy
  getSpy(): PermissionCheckSpy;

  // Reset
  reset(): void;

  // Registry access
  getResource(name: string): ResourceDefinition | undefined;
  getPermissions(): string[];

  // State inspection
  getGrantedPermissions(subjectId: string, tenantId?: string): string[];
  hasPermission(permission: string, subjectId: string, tenantId?: string): boolean;
}
