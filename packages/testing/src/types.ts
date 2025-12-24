import type {
  MTPCContext,
  PermissionCheckResult,
  PolicyDefinition,
  ResourceDefinition,
  SubjectContext,
  TenantContext,
} from '@mtpc/core';

/**
 * 模拟租户选项
 */
export interface MockTenantOptions {
  id?: string;
  status?: 'active' | 'inactive' | 'suspended';
  metadata?: Record<string, unknown>;
}

/**
 * 模拟主体选项
 */
export interface MockSubjectOptions {
  id?: string;
  type?: 'user' | 'service' | 'system' | 'anonymous';
  roles?: string[];
  permissions?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * 模拟上下文选项
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
 * 模拟 MTPC 选项
 */
export interface MockMTPCOptions {
  resources?: ResourceDefinition[];
  policies?: PolicyDefinition[];
  defaultPermissions?: string[];
  defaultDeny?: boolean;
}

/**
 * 权限授予条目
 */
export interface PermissionGrant {
  tenantId: string;
  subjectId: string;
  permissions: Set<string>;
}

/**
 * 权限检查监听器
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
 * 测试权限矩阵条目
 */
export interface PermissionMatrixEntry {
  role: string;
  permission: string;
  expected: boolean;
}

/**
 * 测试上下文
 */
export interface TestContext {
  mtpc: MockMTPC;
  tenant: TenantContext;
  subject: SubjectContext;
  ctx: MTPCContext;
}

/**
 * 模拟 MTPC 接口
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
