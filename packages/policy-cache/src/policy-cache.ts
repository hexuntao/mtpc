import type { CompiledPolicy, SubjectContext, TenantContext } from '@mtpc/core';
import { type CacheManager, createCacheManager } from './cache/cache-manager.js';
import type { CacheStats, PermissionCacheEntry, PolicyCacheOptions } from './types.js';

/**
 * Policy cache for MTPC
 */
export class PolicyCache {
  private cacheManager: CacheManager;
  private permissionLoader?: (tenantId: string, subjectId: string) => Promise<Set<string>>;

  constructor(options: PolicyCacheOptions = {}) {
    this.cacheManager = createCacheManager(options);
  }

  /**
   * Set permission loader
   */
  setPermissionLoader(loader: (tenantId: string, subjectId: string) => Promise<Set<string>>): void {
    this.permissionLoader = loader;
  }

  /**
   * Get cached permissions for subject
   */
  async getPermissions(tenantId: string, subjectId: string): Promise<Set<string> | null> {
    const key = `permissions:${tenantId}:${subjectId}`;
    const entry = await this.cacheManager.get<PermissionCacheEntry>(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      await this.cacheManager.delete(key);
      return null;
    }

    return entry.permissions;
  }

  /**
   * Set cached permissions
   */
  async setPermissions(
    tenantId: string,
    subjectId: string,
    permissions: Set<string>,
    roles?: string[],
    ttl?: number
  ): Promise<void> {
    const key = `permissions:${tenantId}:${subjectId}`;
    const now = Date.now();

    const entry: PermissionCacheEntry = {
      permissions,
      roles,
      computedAt: now,
      expiresAt: now + (ttl ?? 60000),
    };

    await this.cacheManager.set(key, entry, ttl);
  }

  /**
   * Get or load permissions
   */
  async getOrLoadPermissions(
    tenantId: string,
    subjectId: string,
    ttl?: number
  ): Promise<Set<string>> {
    const cached = await this.getPermissions(tenantId, subjectId);

    if (cached !== null) {
      return cached;
    }

    if (!this.permissionLoader) {
      return new Set();
    }

    const permissions = await this.permissionLoader(tenantId, subjectId);
    await this.setPermissions(tenantId, subjectId, permissions, undefined, ttl);

    return permissions;
  }

  /**
   * Invalidate subject permissions
   */
  async invalidateSubject(tenantId: string, subjectId: string): Promise<void> {
    const key = `permissions:${tenantId}:${subjectId}`;
    await this.cacheManager.delete(key);
  }

  /**
   * Invalidate all permissions for tenant
   */
  async invalidateTenant(tenantId: string): Promise<number> {
    return this.cacheManager.invalidateTenant(tenantId);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    await this.cacheManager.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.cacheManager.getStats();
  }

  /**
   * Create permission resolver for MTPC
   */
  createPermissionResolver(): (tenantId: string, subjectId: string) => Promise<Set<string>> {
    return (tenantId, subjectId) => this.getOrLoadPermissions(tenantId, subjectId);
  }
}

/**
 * Create policy cache
 */
export function createPolicyCache(options?: PolicyCacheOptions): PolicyCache {
  return new PolicyCache(options);
}
