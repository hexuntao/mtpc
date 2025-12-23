import { PermissionNotFoundError } from '@mtpc/shared';
import { compilePermission } from '../permission/generate.js';
import type { Permission, PermissionDefinition } from '../types/index.js';

/**
 * Permission registry
 */
export class PermissionRegistry {
  private permissions: Map<string, Permission> = new Map();
  private byResource: Map<string, Set<string>> = new Map();
  private frozen = false;

  /**
   * Register a permission
   */
  register(resourceName: string, definition: PermissionDefinition): Permission {
    if (this.frozen) {
      throw new Error('Registry is frozen. Cannot register new permissions.');
    }

    const permission = compilePermission(resourceName, definition);

    if (this.permissions.has(permission.code)) {
      // Update existing
      this.permissions.set(permission.code, permission);
    } else {
      this.permissions.set(permission.code, permission);

      // Update resource index
      let resourcePerms = this.byResource.get(resourceName);
      if (!resourcePerms) {
        resourcePerms = new Set();
        this.byResource.set(resourceName, resourcePerms);
      }
      resourcePerms.add(permission.code);
    }

    return permission;
  }

  /**
   * Register multiple permissions
   */
  registerMany(resourceName: string, definitions: PermissionDefinition[]): Permission[] {
    return definitions.map(def => this.register(resourceName, def));
  }

  /**
   * Get permission by code
   */
  get(code: string): Permission | undefined {
    return this.permissions.get(code);
  }

  /**
   * Get permission or throw
   */
  getOrThrow(code: string): Permission {
    const permission = this.permissions.get(code);

    if (!permission) {
      throw new PermissionNotFoundError(code);
    }

    return permission;
  }

  /**
   * Check if permission exists
   */
  has(code: string): boolean {
    return this.permissions.has(code);
  }

  /**
   * List all permissions
   */
  list(): Permission[] {
    return Array.from(this.permissions.values());
  }

  /**
   * List all permission codes
   */
  codes(): string[] {
    return Array.from(this.permissions.keys());
  }

  /**
   * Get permissions by resource
   */
  getByResource(resourceName: string): Permission[] {
    const codes = this.byResource.get(resourceName);

    if (!codes) {
      return [];
    }

    return Array.from(codes)
      .map(code => this.permissions.get(code)!)
      .filter(Boolean);
  }

  /**
   * Get permission codes by resource
   */
  getCodesByResource(resourceName: string): string[] {
    const codes = this.byResource.get(resourceName);
    return codes ? Array.from(codes) : [];
  }

  /**
   * Get all resource names
   */
  getResources(): string[] {
    return Array.from(this.byResource.keys());
  }

  /**
   * Freeze the registry
   */
  freeze(): void {
    this.frozen = true;
  }

  /**
   * Check if frozen
   */
  isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * Get count
   */
  get size(): number {
    return this.permissions.size;
  }

  /**
   * Clear all (for testing)
   */
  clear(): void {
    if (this.frozen) {
      throw new Error('Registry is frozen. Cannot clear permissions.');
    }
    this.permissions.clear();
    this.byResource.clear();
  }

  /**
   * Export as permission codes object
   */
  toCodesObject(): Record<string, string> {
    const result: Record<string, string> = {};

    for (const permission of this.permissions.values()) {
      const key = `${permission.resource.toUpperCase()}_${permission.action.toUpperCase()}`;
      result[key] = permission.code;
    }

    return result;
  }
}

/**
 * Create a permission registry
 */
export function createPermissionRegistry(): PermissionRegistry {
  return new PermissionRegistry();
}
