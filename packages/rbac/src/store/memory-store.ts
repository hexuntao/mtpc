import type {
  BindingSubjectType,
  EffectivePermissions,
  RBACStore,
  RoleBinding,
  RoleBindingCreateInput,
  RoleCreateInput,
  RoleDefinition,
  RoleStatus,
  RoleType,
  RoleUpdateInput,
} from '../types.js';

/**
 * In-memory RBAC store
 */
export class InMemoryRBACStore implements RBACStore {
  private roles: Map<string, RoleDefinition> = new Map();
  private bindings: Map<string, RoleBinding> = new Map();
  private idCounter = 0;

  private generateId(): string {
    return `rbac_${++this.idCounter}_${Date.now()}`;
  }

  // ============== Roles ==============

  async createRole(
    tenantId: string,
    input: RoleCreateInput,
    createdBy?: string
  ): Promise<RoleDefinition> {
    const id = this.generateId();
    const now = new Date();

    const role: RoleDefinition = {
      id,
      tenantId,
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      type: input.type ?? 'custom',
      status: 'active',
      permissions: input.permissions ?? [],
      inherits: input.inherits,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    this.roles.set(id, role);
    return role;
  }

  async updateRole(
    tenantId: string,
    roleId: string,
    input: RoleUpdateInput
  ): Promise<RoleDefinition | null> {
    const existing = this.roles.get(roleId);

    if (!existing || existing.tenantId !== tenantId) {
      return null;
    }

    const updated: RoleDefinition = {
      ...existing,
      ...input,
      id: roleId,
      tenantId,
      name: existing.name, // Name cannot be changed
      type: existing.type, // Type cannot be changed
      updatedAt: new Date(),
    };

    this.roles.set(roleId, updated);
    return updated;
  }

  async deleteRole(tenantId: string, roleId: string): Promise<boolean> {
    const existing = this.roles.get(roleId);

    if (!existing || existing.tenantId !== tenantId) {
      return false;
    }

    this.roles.delete(roleId);

    // Also delete all bindings for this role
    for (const [bindingId, binding] of this.bindings) {
      if (binding.roleId === roleId && binding.tenantId === tenantId) {
        this.bindings.delete(bindingId);
      }
    }

    return true;
  }

  async getRole(tenantId: string, roleId: string): Promise<RoleDefinition | null> {
    const role = this.roles.get(roleId);

    if (!role || role.tenantId !== tenantId) {
      return null;
    }

    return role;
  }

  async getRoleByName(tenantId: string, name: string): Promise<RoleDefinition | null> {
    for (const role of this.roles.values()) {
      if (role.tenantId === tenantId && role.name === name) {
        return role;
      }
    }
    return null;
  }

  async listRoles(
    tenantId: string,
    options?: { status?: RoleStatus; type?: RoleType }
  ): Promise<RoleDefinition[]> {
    const roles: RoleDefinition[] = [];

    for (const role of this.roles.values()) {
      if (role.tenantId !== tenantId) continue;
      if (options?.status && role.status !== options.status) continue;
      if (options?.type && role.type !== options.type) continue;
      roles.push(role);
    }

    return roles;
  }

  // ============== Bindings ==============

  async createBinding(
    tenantId: string,
    input: RoleBindingCreateInput,
    createdBy?: string
  ): Promise<RoleBinding> {
    const id = this.generateId();
    const now = new Date();

    const binding: RoleBinding = {
      id,
      tenantId,
      roleId: input.roleId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      expiresAt: input.expiresAt,
      metadata: input.metadata,
      createdAt: now,
      createdBy,
    };

    this.bindings.set(id, binding);
    return binding;
  }

  async deleteBinding(tenantId: string, bindingId: string): Promise<boolean> {
    const existing = this.bindings.get(bindingId);

    if (!existing || existing.tenantId !== tenantId) {
      return false;
    }

    this.bindings.delete(bindingId);
    return true;
  }

  async getBinding(tenantId: string, bindingId: string): Promise<RoleBinding | null> {
    const binding = this.bindings.get(bindingId);

    if (!binding || binding.tenantId !== tenantId) {
      return null;
    }

    return binding;
  }

  async listBindings(
    tenantId: string,
    options?: { roleId?: string; subjectId?: string; subjectType?: BindingSubjectType }
  ): Promise<RoleBinding[]> {
    const bindings: RoleBinding[] = [];

    for (const binding of this.bindings.values()) {
      if (binding.tenantId !== tenantId) continue;
      if (options?.roleId && binding.roleId !== options.roleId) continue;
      if (options?.subjectId && binding.subjectId !== options.subjectId) continue;
      if (options?.subjectType && binding.subjectType !== options.subjectType) continue;
      bindings.push(binding);
    }

    return bindings;
  }

  async getSubjectBindings(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<RoleBinding[]> {
    return this.listBindings(tenantId, { subjectType, subjectId });
  }

  // ============== Permissions ==============

  async getEffectivePermissions(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<EffectivePermissions> {
    const bindings = await this.getSubjectBindings(tenantId, subjectType, subjectId);
    const permissions = new Set<string>();
    const roleIds: string[] = [];
    const now = new Date();

    // Collect permissions from all active bindings
    for (const binding of bindings) {
      // Skip expired bindings
      if (binding.expiresAt && binding.expiresAt <= now) {
        continue;
      }

      const role = await this.getRole(tenantId, binding.roleId);
      if (!role || role.status !== 'active') {
        continue;
      }

      roleIds.push(role.id);

      // Add direct permissions
      for (const perm of role.permissions) {
        permissions.add(perm);
      }

      // Add inherited permissions
      if (role.inherits) {
        const inheritedPerms = await this.getInheritedPermissions(tenantId, role.inherits);
        for (const perm of inheritedPerms) {
          permissions.add(perm);
        }
      }
    }

    return {
      tenantId,
      subjectId,
      subjectType,
      roles: roleIds,
      permissions,
      computedAt: now,
    };
  }

  private async getInheritedPermissions(
    tenantId: string,
    roleIds: string[],
    visited: Set<string> = new Set()
  ): Promise<Set<string>> {
    const permissions = new Set<string>();

    for (const roleId of roleIds) {
      if (visited.has(roleId)) continue;
      visited.add(roleId);

      const role = await this.getRole(tenantId, roleId);
      if (!role || role.status !== 'active') continue;

      for (const perm of role.permissions) {
        permissions.add(perm);
      }

      if (role.inherits) {
        const inherited = await this.getInheritedPermissions(tenantId, role.inherits, visited);
        for (const perm of inherited) {
          permissions.add(perm);
        }
      }
    }

    return permissions;
  }

  async invalidatePermissions(tenantId: string, subjectId?: string): Promise<void> {
    // In-memory store doesn't need cache invalidation
    // This is a no-op, but required by the interface
  }

  // ============== Utility ==============

  clear(): void {
    this.roles.clear();
    this.bindings.clear();
    this.idCounter = 0;
  }
}

/**
 * Create in-memory RBAC store
 */
export function createInMemoryRBACStore(): InMemoryRBACStore {
  return new InMemoryRBACStore();
}
