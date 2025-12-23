import type { CacheProvider, CacheStats, PolicyCacheOptions, VersionInfo } from '../types.js';
import { MemoryCache } from './memory-cache.js';

/**
 * Cache manager with versioning and invalidation
 */
export class CacheManager {
  private cache: CacheProvider;
  private versions: Map<string, VersionInfo> = new Map();
  private options: PolicyCacheOptions;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    evictions: 0,
    hitRate: 0,
  };

  constructor(options: PolicyCacheOptions = {}) {
    this.options = {
      defaultTTL: options.defaultTTL ?? 60000,
      maxEntries: options.maxEntries ?? 10000,
      keyPrefix: options.keyPrefix ?? 'mtpc:',
      enableStats: options.enableStats ?? true,
      ...options,
    };

    this.cache =
      options.provider ??
      new MemoryCache({
        ttl: this.options.defaultTTL,
        maxSize: this.options.maxEntries,
      });
  }

  /**
   * Build cache key
   */
  buildKey(...parts: string[]): string {
    return this.options.keyPrefix + parts.join(':');
  }

  /**
   * Get from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);
    const value = await this.cache.get<T>(fullKey);

    if (this.options.enableStats) {
      if (value !== null) {
        this.stats.hits++;
        this.options.onHit?.(key);
      } else {
        this.stats.misses++;
        this.options.onMiss?.(key);
      }
      this.updateHitRate();
    }

    return value;
  }

  /**
   * Set in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.buildKey(key);
    await this.cache.set(fullKey, value, ttl ?? this.options.defaultTTL);
    this.stats.size = await this.cache.size();
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const result = await this.cache.delete(fullKey);
    this.stats.size = await this.cache.size();
    return result;
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    return this.cache.has(fullKey);
  }

  /**
   * Get or set (cache-aside pattern)
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Invalidate by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    const keys = await this.cache.keys(this.options.keyPrefix + pattern);
    let count = 0;

    for (const key of keys) {
      await this.cache.delete(key);
      count++;
    }

    this.stats.size = await this.cache.size();
    return count;
  }

  /**
   * Invalidate tenant cache
   */
  async invalidateTenant(tenantId: string): Promise<number> {
    return this.invalidateByPattern(`*${tenantId}*`);
  }

  /**
   * Invalidate subject cache
   */
  async invalidateSubject(tenantId: string, subjectId: string): Promise<number> {
    return this.invalidateByPattern(`*${tenantId}*${subjectId}*`);
  }

  /**
   * Get version for tenant
   */
  getVersion(tenantId: string): number {
    return this.versions.get(tenantId)?.version ?? 0;
  }

  /**
   * Increment version
   */
  incrementVersion(tenantId: string): number {
    const current = this.getVersion(tenantId);
    const newVersion = current + 1;

    this.versions.set(tenantId, {
      tenantId,
      version: newVersion,
      updatedAt: new Date(),
    });

    return newVersion;
  }

  /**
   * Check version validity
   */
  isVersionValid(tenantId: string, version: number): boolean {
    return this.getVersion(tenantId) === version;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    await this.cache.clear();
    this.versions.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      evictions: 0,
      hitRate: 0,
    };
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Create cache manager
 */
export function createCacheManager(options?: PolicyCacheOptions): CacheManager {
  return new CacheManager(options);
}
