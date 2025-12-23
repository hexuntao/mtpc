import type { SubjectContext, TenantContext } from '@mtpc/core';
import { matchesPattern } from '@mtpc/core';
import type {
  BindingSubjectType,
  EffectivePermissions,
  RBACCheckContext,
  RBACCheckResult,
  RBACStore,
} from '../types.js';

/**
 * RBAC permission evaluator
 */
export class RBACEvaluator {
  private store: RBACStore;
  private cache: Map<string, EffectivePermissions> = new Map();
  private cacheTTL: number;

  constructor(store: RBACStore, options: { cacheTTL?: number } = {}) {
    this.store = store;
    this.cacheTTL = options.cacheTTL ?? 60000; // 1 minute default
  }

  /**
   * Check permission
   */
  async check(context: RBACCheckContext): Promise<RBACCheckResult> {
    const effectivePerms = await this.getEffectivePermissions(
      context.tenant.id,
      context.subject.type as BindingSubjectType,
      context.subject.id
    );

    const matchedRoles: string[] = [];
    let allowed = false;

    // Check if permission is granted
    for (const perm of effectivePerms.permissions) {
      if (matchesPattern(context.permission, perm)) {
        allowed = true;
        break;
      }
    }

    // Get matched roles
    if (allowed) {
      matchedRoles.push(...effectivePerms.roles);
    }

    return {
      allowed,
      matchedRoles,
      reason: allowed
        ? `Granted by roles: ${matchedRoles.join(', ')}`
        : 'Permission not granted by any role',
    };
  }

  /**
   * Get effective permissions for subject
   */
  async getEffectivePermissions(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<EffectivePermissions> {
    const cacheKey = `${tenantId}:${subjectType}:${subjectId}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
      return cached;
    }

    // Fetch from store
    const effectivePerms = await this.store.getEffectivePermissions(
      tenantId,
      subjectType,
      subjectId
    );

    // Set cache expiration
    effectivePerms.expiresAt = new Date(Date.now() + this.cacheTTL);

    // Cache result
    this.cache.set(cacheKey, effectivePerms);

    return effectivePerms;
  }

  /**
   * Get all permissions for subject as array
   */
  async getPermissions(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<string[]> {
    const effective = await this.getEffectivePermissions(tenantId, subjectType, subjectId);
    return Array.from(effective.permissions);
  }

  /**
   * Check if subject has any of the permissions
   */
  async hasAnyPermission(
    context: Omit<RBACCheckContext, 'permission'>,
    permissions: string[]
  ): Promise<boolean> {
    const effectivePerms = await this.getEffectivePermissions(
      context.tenant.id,
      context.subject.type as BindingSubjectType,
      context.subject.id
    );

    for (const required of permissions) {
      for (const perm of effectivePerms.permissions) {
        if (matchesPattern(required, perm)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if subject has all of the permissions
   */
  async hasAllPermissions(
    context: Omit<RBACCheckContext, 'permission'>,
    permissions: string[]
  ): Promise<boolean> {
    const effectivePerms = await this.getEffectivePermissions(
      context.tenant.id,
      context.subject.type as BindingSubjectType,
      context.subject.id
    );

    for (const required of permissions) {
      let found = false;
      for (const perm of effectivePerms.permissions) {
        if (matchesPattern(required, perm)) {
          found = true;
          break;
        }
      }
      if (!found) {
        return false;
      }
    }

    return true;
  }

  /**
   * Invalidate cache
   */
  invalidate(tenantId: string, subjectId?: string): void {
    if (subjectId) {
      // Invalidate specific subject
      const prefix = `${tenantId}:`;
      const suffix = `:${subjectId}`;

      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix) && key.endsWith(suffix)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Invalidate entire tenant
      const prefix = `${tenantId}:`;

      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Create RBAC evaluator
 */
export function createRBACEvaluator(
  store: RBACStore,
  options?: { cacheTTL?: number }
): RBACEvaluator {
  return new RBACEvaluator(store, options);
}
