import type { MTPC, SubjectContext, TenantContext } from '@mtpc/core';
import { BindingManager } from './binding/manager.js';
import { RBACEvaluator } from './policy/evaluator.js';
import { systemRoles } from './role/builder.js';
import { RoleManager } from './role/manager.js';
import { InMemoryRBACStore } from './store/memory-store.js';
import type {
  BindingSubjectType,
  EffectivePermissions,
  RBACCheckContext,
  RBACCheckResult,
  RBACOptions,
  RBACStore,
  RoleBinding,
  RoleBindingCreateInput,
  RoleCreateInput,
  RoleDefinition,
  RoleUpdateInput,
} from './types.js';

/**
 * RBAC - Role-Based Access Control for MTPC
 */
export class RBAC {
  private store: RBACStore;
  private roleManager: RoleManager;
  private bindingManager: BindingManager;
  private evaluator: RBACEvaluator;

  constructor(options: RBACOptions = {}) {
    this.store = options.store ?? new InMemoryRBACStore();
    this.roleManager = new RoleManager(this.store);
    this.bindingManager = new BindingManager(this.store);
    this.evaluator = new RBACEvaluator(this.store, {
      cacheTTL: options.cacheTTL,
    });

    // Register default system roles
    const defaultSystemRoles = options.systemRoles ?? [
      systemRoles.superAdmin().buildDefinition('super_admin'),
      systemRoles.tenantAdmin().buildDefinition('tenant_admin'),
      systemRoles.viewer().buildDefinition('viewer'),
    ];

    for (const role of defaultSystemRoles) {
      this.roleManager.registerSystemRole(role);
    }
  }

  // ============== Role Management ==============

  /**
   * Create role
   */
  async createRole(
    tenantId: string,
    input: RoleCreateInput,
    createdBy?: string
  ): Promise<RoleDefinition> {
    return this.roleManager.createRole(tenantId, input, createdBy);
  }

  /**
   * Update role
   */
  async updateRole(
    tenantId: string,
    roleId: string,
    input: RoleUpdateInput
  ): Promise<RoleDefinition | null> {
    const result = await this.roleManager.updateRole(tenantId, roleId, input);
    if (result) {
      this.evaluator.invalidate(tenantId);
    }
    return result;
  }

  /**
   * Delete role
   */
  async deleteRole(tenantId: string, roleId: string): Promise<boolean> {
    const result = await this.roleManager.deleteRole(tenantId, roleId);
    if (result) {
      this.evaluator.invalidate(tenantId);
    }
    return result;
  }

  /**
   * Get role
   */
  async getRole(tenantId: string, roleId: string): Promise<RoleDefinition | null> {
    return this.roleManager.getRole(tenantId, roleId);
  }

  /**
   * List roles
   */
  async listRoles(tenantId: string): Promise<RoleDefinition[]> {
    return this.roleManager.listRoles(tenantId);
  }

  // ============== Role Binding ==============

  /**
   * Assign role to subject
   */
  async assignRole(
    tenantId: string,
    roleId: string,
    subjectType: BindingSubjectType,
    subjectId: string,
    options?: { expiresAt?: Date; createdBy?: string }
  ): Promise<RoleBinding> {
    const binding = await this.bindingManager.assignRole(
      tenantId,
      {
        roleId,
        subjectType,
        subjectId,
        expiresAt: options?.expiresAt,
      },
      options?.createdBy
    );
    this.evaluator.invalidate(tenantId, subjectId);
    return binding;
  }

  /**
   * Revoke role from subject
   */
  async revokeRole(
    tenantId: string,
    roleId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<boolean> {
    const result = await this.bindingManager.revokeRole(tenantId, roleId, subjectType, subjectId);
    if (result) {
      this.evaluator.invalidate(tenantId, subjectId);
    }
    return result;
  }

  /**
   * Get subject's roles
   */
  async getSubjectRoles(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<RoleBinding[]> {
    return this.bindingManager.getSubjectRoles(tenantId, subjectType, subjectId);
  }

  /**
   * Check if subject has role
   */
  async hasRole(
    tenantId: string,
    roleId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<boolean> {
    return this.bindingManager.hasRole(tenantId, roleId, subjectType, subjectId);
  }

  // ============== Permission Checking ==============

  /**
   * Check permission
   */
  async checkPermission(context: RBACCheckContext): Promise<RBACCheckResult> {
    return this.evaluator.check(context);
  }

  /**
   * Check permission with MTPC context
   */
  async check(
    tenant: TenantContext,
    subject: SubjectContext,
    permission: string
  ): Promise<RBACCheckResult> {
    return this.checkPermission({
      tenant,
      subject,
      permission,
    });
  }

  /**
   * Get effective permissions for subject
   */
  async getEffectivePermissions(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<EffectivePermissions> {
    return this.evaluator.getEffectivePermissions(tenantId, subjectType, subjectId);
  }

  /**
   * Get permissions as array
   */
  async getPermissions(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<string[]> {
    return this.evaluator.getPermissions(tenantId, subjectType, subjectId);
  }

  /**
   * Create permission resolver for MTPC
   */
  createPermissionResolver(): (tenantId: string, subjectId: string) => Promise<Set<string>> {
    return async (tenantId: string, subjectId: string) => {
      const effective = await this.getEffectivePermissions(tenantId, 'user', subjectId);
      return effective.permissions;
    };
  }

  // ============== Cache ==============

  /**
   * Invalidate permission cache
   */
  invalidateCache(tenantId: string, subjectId?: string): void {
    this.evaluator.invalidate(tenantId, subjectId);
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.evaluator.clearCache();
  }

  // ============== Accessors ==============

  /**
   * Get role manager
   */
  get roles(): RoleManager {
    return this.roleManager;
  }

  /**
   * Get binding manager
   */
  get bindings(): BindingManager {
    return this.bindingManager;
  }

  /**
   * Get store
   */
  getStore(): RBACStore {
    return this.store;
  }
}

/**
 * Create RBAC instance
 */
export function createRBAC(options?: RBACOptions): RBAC {
  return new RBAC(options);
}

/**
 * Integrate RBAC with MTPC
 */
export function integrateWithMTPC(mtpc: MTPC, rbac: RBAC): void {
  // The RBAC permission resolver can be used when creating MTPC
  // This function is provided as a convenience for existing MTPC instances
  console.log('RBAC integrated with MTPC');
}
