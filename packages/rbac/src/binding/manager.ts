import type {
  BindingSubjectType,
  RBACStore,
  RoleBinding,
  RoleBindingCreateInput,
} from '../types.js';
import { validateBindingInput } from './validator.js';

/**
 * Role binding manager
 */
export class BindingManager {
  private store: RBACStore;

  constructor(store: RBACStore) {
    this.store = store;
  }

  /**
   * Assign role to subject
   */
  async assignRole(
    tenantId: string,
    input: RoleBindingCreateInput,
    createdBy?: string
  ): Promise<RoleBinding> {
    validateBindingInput(input);

    // Check if binding already exists
    const existing = await this.getExistingBinding(
      tenantId,
      input.roleId,
      input.subjectType,
      input.subjectId
    );

    if (existing) {
      // If already exists and not expired, return it
      if (!existing.expiresAt || existing.expiresAt > new Date()) {
        return existing;
      }
      // Remove expired binding
      await this.store.deleteBinding(tenantId, existing.id);
    }

    // Invalidate permission cache
    await this.store.invalidatePermissions(tenantId, input.subjectId);

    return this.store.createBinding(tenantId, input, createdBy);
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
    const binding = await this.getExistingBinding(tenantId, roleId, subjectType, subjectId);

    if (!binding) {
      return false;
    }

    // Invalidate permission cache
    await this.store.invalidatePermissions(tenantId, subjectId);

    return this.store.deleteBinding(tenantId, binding.id);
  }

  /**
   * Revoke all roles from subject
   */
  async revokeAllRoles(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<number> {
    const bindings = await this.store.getSubjectBindings(tenantId, subjectType, subjectId);

    let count = 0;
    for (const binding of bindings) {
      const deleted = await this.store.deleteBinding(tenantId, binding.id);
      if (deleted) count++;
    }

    // Invalidate permission cache
    await this.store.invalidatePermissions(tenantId, subjectId);

    return count;
  }

  /**
   * Get subject's roles
   */
  async getSubjectRoles(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<RoleBinding[]> {
    const bindings = await this.store.getSubjectBindings(tenantId, subjectType, subjectId);

    // Filter out expired bindings
    const now = new Date();
    return bindings.filter(b => !b.expiresAt || b.expiresAt > now);
  }

  /**
   * Get role's subjects
   */
  async getRoleSubjects(tenantId: string, roleId: string): Promise<RoleBinding[]> {
    const bindings = await this.store.listBindings(tenantId, { roleId });

    // Filter out expired bindings
    const now = new Date();
    return bindings.filter(b => !b.expiresAt || b.expiresAt > now);
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
    const binding = await this.getExistingBinding(tenantId, roleId, subjectType, subjectId);

    if (!binding) {
      return false;
    }

    // Check if expired
    if (binding.expiresAt && binding.expiresAt <= new Date()) {
      return false;
    }

    return true;
  }

  /**
   * Set role expiration
   */
  async setExpiration(
    tenantId: string,
    bindingId: string,
    expiresAt: Date | null
  ): Promise<RoleBinding | null> {
    const binding = await this.store.getBinding(tenantId, bindingId);

    if (!binding) {
      return null;
    }

    // Need to delete and recreate with new expiration
    await this.store.deleteBinding(tenantId, bindingId);

    return this.store.createBinding(
      tenantId,
      {
        roleId: binding.roleId,
        subjectType: binding.subjectType,
        subjectId: binding.subjectId,
        expiresAt: expiresAt ?? undefined,
        metadata: binding.metadata,
      },
      binding.createdBy
    );
  }

  /**
   * Clean up expired bindings
   */
  async cleanupExpired(tenantId: string): Promise<number> {
    const allBindings = await this.store.listBindings(tenantId, {});
    const now = new Date();
    let count = 0;

    for (const binding of allBindings) {
      if (binding.expiresAt && binding.expiresAt <= now) {
        await this.store.deleteBinding(tenantId, binding.id);
        count++;
      }
    }

    return count;
  }

  /**
   * Get existing binding
   */
  private async getExistingBinding(
    tenantId: string,
    roleId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<RoleBinding | null> {
    const bindings = await this.store.listBindings(tenantId, {
      roleId,
      subjectType,
      subjectId,
    });

    return bindings[0] ?? null;
  }
}

/**
 * Create binding manager
 */
export function createBindingManager(store: RBACStore): BindingManager {
  return new BindingManager(store);
}
