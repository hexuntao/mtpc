import type { Permission, SubjectContext, TenantContext } from '@mtpc/core';

/**
 * Role status
 */
export type RoleStatus = 'active' | 'inactive' | 'archived';

/**
 * Role type
 */
export type RoleType = 'system' | 'custom' | 'template';

/**
 * Role definition
 */
export interface RoleDefinition {
  id: string;
  tenantId: string;
  name: string;
  displayName?: string;
  description?: string;
  type: RoleType;
  status: RoleStatus;
  permissions: string[];
  inherits?: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * Role create input
 */
export interface RoleCreateInput {
  name: string;
  displayName?: string;
  description?: string;
  type?: RoleType;
  permissions?: string[];
  inherits?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Role update input
 */
export interface RoleUpdateInput {
  displayName?: string;
  description?: string;
  status?: RoleStatus;
  permissions?: string[];
  inherits?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Role binding type
 */
export type BindingSubjectType = 'user' | 'group' | 'service';

/**
 * Role binding
 */
export interface RoleBinding {
  id: string;
  tenantId: string;
  roleId: string;
  subjectType: BindingSubjectType;
  subjectId: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  createdBy?: string;
}

/**
 * Role binding create input
 */
export interface RoleBindingCreateInput {
  roleId: string;
  subjectType: BindingSubjectType;
  subjectId: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Effective permissions result
 */
export interface EffectivePermissions {
  tenantId: string;
  subjectId: string;
  subjectType: BindingSubjectType;
  roles: string[];
  permissions: Set<string>;
  computedAt: Date;
  expiresAt?: Date;
}

/**
 * Permission check context for RBAC
 */
export interface RBACCheckContext {
  tenant: TenantContext;
  subject: SubjectContext;
  permission: string;
  resourceId?: string;
}

/**
 * RBAC check result
 */
export interface RBACCheckResult {
  allowed: boolean;
  matchedRoles: string[];
  reason?: string;
}

/**
 * RBAC store interface
 */
export interface RBACStore {
  // Roles
  createRole(tenantId: string, input: RoleCreateInput, createdBy?: string): Promise<RoleDefinition>;
  updateRole(
    tenantId: string,
    roleId: string,
    input: RoleUpdateInput
  ): Promise<RoleDefinition | null>;
  deleteRole(tenantId: string, roleId: string): Promise<boolean>;
  getRole(tenantId: string, roleId: string): Promise<RoleDefinition | null>;
  getRoleByName(tenantId: string, name: string): Promise<RoleDefinition | null>;
  listRoles(
    tenantId: string,
    options?: { status?: RoleStatus; type?: RoleType }
  ): Promise<RoleDefinition[]>;

  // Bindings
  createBinding(
    tenantId: string,
    input: RoleBindingCreateInput,
    createdBy?: string
  ): Promise<RoleBinding>;
  deleteBinding(tenantId: string, bindingId: string): Promise<boolean>;
  getBinding(tenantId: string, bindingId: string): Promise<RoleBinding | null>;
  listBindings(
    tenantId: string,
    options?: { roleId?: string; subjectId?: string; subjectType?: BindingSubjectType }
  ): Promise<RoleBinding[]>;
  getSubjectBindings(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<RoleBinding[]>;

  // Permissions
  getEffectivePermissions(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<EffectivePermissions>;
  invalidatePermissions(tenantId: string, subjectId?: string): Promise<void>;
}

/**
 * RBAC options
 */
export interface RBACOptions {
  store?: RBACStore;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  systemRoles?: RoleDefinition[];
  permissionResolver?: (tenantId: string, subjectId: string) => Promise<Set<string>>;
}
