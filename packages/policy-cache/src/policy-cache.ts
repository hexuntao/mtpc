import { type CacheManager, createCacheManager } from './cache/cache-manager.js';
import type { CacheStats, PermissionCacheEntry, PolicyCacheOptions } from './types.js';

/**
 * MTPC 策略缓存类
 * 用于缓存和管理权限信息，提高权限检查的性能
 */
export class PolicyCache {
  /** 缓存管理器实例 */
  private cacheManager: CacheManager;
  /** 权限加载器，用于从数据源加载权限 */
  private permissionLoader?: (tenantId: string, subjectId: string) => Promise<Set<string>>;

  /**
   * 创建策略缓存实例
   * @param options 策略缓存选项
   */
  constructor(options: PolicyCacheOptions = {}) {
    this.cacheManager = createCacheManager(options);
  }

  /**
   * 设置权限加载器
   * @param loader 权限加载器函数
   */
  setPermissionLoader(loader: (tenantId: string, subjectId: string) => Promise<Set<string>>): void {
    this.permissionLoader = loader;
  }

  /**
   * 获取主体的缓存权限
   * @param tenantId 租户ID
   * @param subjectId 主体ID
   * @returns 权限集合或null（如果缓存不存在或已过期）
   */
  async getPermissions(tenantId: string, subjectId: string): Promise<Set<string> | null> {
    const key = `permissions:${tenantId}:${subjectId}`;
    const entry = await this.cacheManager.get<PermissionCacheEntry>(key);

    if (!entry) {
      return null;
    }

    // 检查缓存是否过期
    if (entry.expiresAt < Date.now()) {
      await this.cacheManager.delete(key);
      return null;
    }

    return entry.permissions;
  }

  /**
   * 设置主体的缓存权限
   * @param tenantId 租户ID
   * @param subjectId 主体ID
   * @param permissions 权限集合
   * @param roles 角色列表（可选）
   * @param ttl 生存时间（毫秒，可选）
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
      expiresAt: now + (ttl ?? 60000), // 默认TTL为60秒
    };

    await this.cacheManager.set(key, entry, ttl);
  }

  /**
   * 获取或加载主体的权限
   * 如果缓存存在则直接返回，否则调用权限加载器加载并缓存
   * @param tenantId 租户ID
   * @param subjectId 主体ID
   * @param ttl 生存时间（毫秒，可选）
   * @returns 权限集合
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
   * 使主体的权限缓存失效
   * @param tenantId 租户ID
   * @param subjectId 主体ID
   */
  async invalidateSubject(tenantId: string, subjectId: string): Promise<void> {
    const key = `permissions:${tenantId}:${subjectId}`;
    await this.cacheManager.delete(key);
  }

  /**
   * 使租户的所有权限缓存失效
   * @param tenantId 租户ID
   * @returns 失效的缓存条目数
   */
  async invalidateTenant(tenantId: string): Promise<number> {
    return this.cacheManager.invalidateTenant(tenantId);
  }

  /**
   * 清除所有缓存
   */
  async clear(): Promise<void> {
    await this.cacheManager.clear();
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  getStats(): CacheStats {
    return this.cacheManager.getStats();
  }

  /**
   * 创建MTPC的权限解析器
   * @returns 权限解析器函数
   */
  createPermissionResolver(): (tenantId: string, subjectId: string) => Promise<Set<string>> {
    return (tenantId, subjectId) => this.getOrLoadPermissions(tenantId, subjectId);
  }
}

/**
 * 创建策略缓存实例
 * @param options 策略缓存选项
 * @returns 策略缓存实例
 */
export function createPolicyCache(options?: PolicyCacheOptions): PolicyCache {
  return new PolicyCache(options);
}
