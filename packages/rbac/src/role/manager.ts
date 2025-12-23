import type {
  RBACStore,
  RoleCreateInput,
  RoleDefinition,
  RoleStatus,
  RoleType,
  RoleUpdateInput,
} from '../types.js';
import { validateRoleInput } from './validator.js';

/**
 * Role manager
 */
export class RoleManager {
  private store: RBACStore;
  private systemRoles: Map<string, RoleDefinition> = new Map();

  constructor(store: RBACStore) {
    this.store = store;
  }

  /**
   * Register system role
   */
  registerSystemRole(role: RoleDefinition): void {
    if (role.type !== 'system') {
      throw new Error('Only system roles can be registered');
    }
    this.systemRoles.set(role.id, role);
  }

  /**
   * Create role
   */
  async createRole(
    tenantId: string,
    input: RoleCreateInput,
    createdBy?: string
  ): Promise<RoleDefinition> {
    validateRoleInput(input);

    // Check for duplicate name
    const existing = await this.store.getRoleByName(tenantId, input.name);
    if (existing) {
      throw new Error(`Role with name "${input.name}" already exists`);
    }

    return this.store.createRole(tenantId, input, createdBy);
  }

  /**
   * Update role
   */
  async updateRole(
    tenantId: string,
    roleId: string,
    input: RoleUpdateInput
  ): Promise<RoleDefinition | null> {
    const existing = await this.store.getRole(tenantId, roleId);

    if (!existing) {
      return null;
    }

    // Prevent modifying system roles
    if (existing.type === 'system') {
      throw new Error('Cannot modify system roles');
    }

    // Invalidate permission cache
    await this.store.invalidatePermissions(tenantId);

    return this.store.updateRole(tenantId, roleId, input);
  }

  /**
   * Delete role
   */
  async deleteRole(tenantId: string, roleId: string): Promise<boolean> {
    const existing = await this.store.getRole(tenantId, roleId);

    if (!existing) {
      return false;
    }

    // Prevent deleting system roles
    if (existing.type === 'system') {
      throw new Error('Cannot delete system roles');
    }

    // Invalidate permission cache
    await this.store.invalidatePermissions(tenantId);

    return this.store.deleteRole(tenantId, roleId);
  }

  /**
   * Get role by ID
   */
  async getRole(tenantId: string, roleId: string): Promise<RoleDefinition | null> {
    // Check system roles first
    const systemRole = this.systemRoles.get(roleId);
    if (systemRole) {
      return { ...systemRole, tenantId };
    }

    return this.store.getRole(tenantId, roleId);
  }

  /**
   * Get role by name
   */
  async getRoleByName(tenantId: string, name: string): Promise<RoleDefinition | null> {
    // Check system roles first
    for (const role of this.systemRoles.values()) {
      if (role.name === name) {
        return { ...role, tenantId };
      }
    }

    return this.store.getRoleByName(tenantId, name);
  }

  /**
   * List roles
   */
  async listRoles(
    tenantId: string,
    options?: { status?: RoleStatus; type?: RoleType }
  ): Promise<RoleDefinition[]> {
    const storeRoles = await this.store.listRoles(tenantId, options);

    // Include system roles if not filtering by type or type is system
    if (!options?.type || options.type === 'system') {
      const systemRoles = Array.from(this.systemRoles.values())
        .filter(r => !options?.status || r.status === options.status)
        .map(r => ({ ...r, tenantId }));

      return [...systemRoles, ...storeRoles];
    }

    return storeRoles;
  }

  /**
   * Get role permissions (including inherited)
   */
  async getRolePermissions(tenantId: string, roleId: string): Promise<Set<string>> {
    const role = await this.getRole(tenantId, roleId);

    if (!role) {
      return new Set();
    }

    const permissions = new Set(role.permissions);

    // Add inherited permissions
    if (role.inherits && role.inherits.length > 0) {
      for (const parentRoleId of role.inherits) {
        const parentPermissions = await this.getRolePermissions(tenantId, parentRoleId);
        for (const perm of parentPermissions) {
          permissions.add(perm);
        }
      }
    }

    return permissions;
  }

  /**
   * Add permission to role
   */
  async addPermission(
    tenantId: string,
    roleId: string,
    permission: string
  ): Promise<RoleDefinition | null> {
    const role = await this.getRole(tenantId, roleId);

    if (!role) {
      return null;
    }

    if (role.permissions.includes(permission)) {
      return role;
    }

    return this.updateRole(tenantId, roleId, {
      permissions: [...role.permissions, permission],
    });
  }

  /**
   * Remove permission from role
   */
  async removePermission(
    tenantId: string,
    roleId: string,
    permission: string
  ): Promise<RoleDefinition | null> {
    const role = await this.getRole(tenantId, roleId);

    if (!role) {
      return null;
    }

    return this.updateRole(tenantId, roleId, {
      permissions: role.permissions.filter(p => p !== permission),
    });
  }

  /**
   * Set role permissions (replace all)
   */
  async setPermissions(
    tenantId: string,
    roleId: string,
    permissions: string[]
  ): Promise<RoleDefinition | null> {
    return this.updateRole(tenantId, roleId, { permissions });
  }

  /**
   * Clone role
   */
  async cloneRole(
    tenantId: string,
    sourceRoleId: string,
    newName: string,
    createdBy?: string
  ): Promise<RoleDefinition> {
    const source = await this.getRole(tenantId, sourceRoleId);

    if (!source) {
      throw new Error(`Source role not found: ${sourceRoleId}`);
    }

    return this.createRole(
      tenantId,
      {
        name: newName,
        displayName: `${source.displayName ?? source.name} (Copy)`,
        description: source.description,
        type: 'custom',
        permissions: [...source.permissions],
        inherits: source.inherits ? [...source.inherits] : undefined,
        metadata: source.metadata ? { ...source.metadata } : undefined,
      },
      createdBy
    );
  }
}

/**
 * Create role manager
 */
export function createRoleManager(store: RBACStore): RoleManager {
  return new RoleManager(store);
}
