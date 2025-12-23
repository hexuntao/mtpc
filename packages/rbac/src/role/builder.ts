import type { RoleCreateInput, RoleDefinition, RoleType } from '../types.js';

/**
 * Role builder for fluent API
 */
export class RoleBuilder {
  private input: RoleCreateInput;

  constructor(name: string) {
    this.input = {
      name,
      type: 'custom',
      permissions: [],
    };
  }

  /**
   * Set display name
   */
  displayName(displayName: string): this {
    this.input.displayName = displayName;
    return this;
  }

  /**
   * Set description
   */
  description(description: string): this {
    this.input.description = description;
    return this;
  }

  /**
   * Set role type
   */
  type(type: RoleType): this {
    this.input.type = type;
    return this;
  }

  /**
   * Make it a system role
   */
  system(): this {
    this.input.type = 'system';
    return this;
  }

  /**
   * Make it a template role
   */
  template(): this {
    this.input.type = 'template';
    return this;
  }

  /**
   * Add permission
   */
  permission(permission: string): this {
    this.input.permissions = [...(this.input.permissions ?? []), permission];
    return this;
  }

  /**
   * Add multiple permissions
   */
  permissions(...permissions: string[]): this {
    this.input.permissions = [...(this.input.permissions ?? []), ...permissions];
    return this;
  }

  /**
   * Add resource permissions
   */
  resourcePermissions(resource: string, ...actions: string[]): this {
    const perms = actions.map(action => `${resource}:${action}`);
    return this.permissions(...perms);
  }

  /**
   * Add full CRUD permissions for resource
   */
  fullAccess(resource: string): this {
    return this.resourcePermissions(resource, 'create', 'read', 'update', 'delete', 'list');
  }

  /**
   * Add read-only permissions for resource
   */
  readOnly(resource: string): this {
    return this.resourcePermissions(resource, 'read', 'list');
  }

  /**
   * Inherit from another role
   */
  inherit(roleId: string): this {
    this.input.inherits = [...(this.input.inherits ?? []), roleId];
    return this;
  }

  /**
   * Inherit from multiple roles
   */
  inherits(...roleIds: string[]): this {
    this.input.inherits = [...(this.input.inherits ?? []), ...roleIds];
    return this;
  }

  /**
   * Set metadata
   */
  metadata(metadata: Record<string, unknown>): this {
    this.input.metadata = { ...this.input.metadata, ...metadata };
    return this;
  }

  /**
   * Build role input
   */
  build(): RoleCreateInput {
    return { ...this.input };
  }

  /**
   * Build complete role definition (for system roles)
   */
  buildDefinition(id: string, tenantId: string = 'system'): RoleDefinition {
    const now = new Date();

    return {
      id,
      tenantId,
      name: this.input.name,
      displayName: this.input.displayName,
      description: this.input.description,
      type: this.input.type ?? 'custom',
      status: 'active',
      permissions: this.input.permissions ?? [],
      inherits: this.input.inherits,
      metadata: this.input.metadata,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/**
 * Create role builder
 */
export function role(name: string): RoleBuilder {
  return new RoleBuilder(name);
}

/**
 * Create predefined system roles
 */
export const systemRoles = {
  /**
   * Super admin role with all permissions
   */
  superAdmin: () =>
    role('super_admin')
      .displayName('Super Administrator')
      .description('Full system access')
      .system()
      .permission('*'),

  /**
   * Tenant admin role
   */
  tenantAdmin: () =>
    role('tenant_admin')
      .displayName('Tenant Administrator')
      .description('Full tenant access')
      .system(),

  /**
   * Read-only role
   */
  viewer: () => role('viewer').displayName('Viewer').description('Read-only access').system(),
};
