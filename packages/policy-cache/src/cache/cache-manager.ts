import type { CacheProvider, CacheStats, PolicyCacheOptions, VersionInfo } from '../types.js';
import { MemoryCache } from './memory-cache.js';

/**
 * 带版本控制和失效机制的缓存管理器
 * 负责缓存的获取、设置、失效和统计
 */
export class CacheManager {
  /** 底层缓存提供者实例 */
  private cache: CacheProvider;
  /** 租户版本映射，用于跟踪每个租户的缓存版本 */
  private versions: Map<string, VersionInfo> = new Map();
  /** 缓存选项 */
  private options: PolicyCacheOptions;
  /** 缓存统计信息 */
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    evictions: 0,
    hitRate: 0,
  };

  /**
   * 创建缓存管理器实例
   * @param options 缓存选项
   */
  constructor(options: PolicyCacheOptions = {}) {
    this.options = {
      defaultTTL: options.defaultTTL ?? 60000, // 默认TTL为60秒
      maxEntries: options.maxEntries ?? 10000, // 默认最大条目数为10000
      keyPrefix: options.keyPrefix ?? 'mtpc:', // 默认缓存键前缀
      enableStats: options.enableStats ?? true, // 默认启用统计
      ...options,
    };

    // 使用自定义缓存提供者或默认的内存缓存
    this.cache =
      options.provider ??
      new MemoryCache({
        ttl: this.options.defaultTTL,
        maxSize: this.options.maxEntries,
      });
  }

  /**
   * 构建缓存键
   * @param parts 缓存键的各个组成部分
   * @returns 完整的缓存键字符串
   */
  buildKey(...parts: string[]): string {
    return this.options.keyPrefix + parts.join(':');
  }

  /**
   * 从缓存中获取值
   * @param key 缓存键
   * @returns 缓存值或null（如果不存在）
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);
    const value = await this.cache.get<T>(fullKey);

    // 更新统计信息
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
   * 将值存入缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 生存时间（毫秒，可选）
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.buildKey(key);
    await this.cache.set(fullKey, value, ttl ?? this.options.defaultTTL);
    // 更新缓存大小统计
    this.stats.size = await this.cache.size();
  }

  /**
   * 删除缓存条目
   * @param key 缓存键
   * @returns 是否成功删除
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const result = await this.cache.delete(fullKey);
    // 更新缓存大小统计
    this.stats.size = await this.cache.size();
    return result;
  }

  /**
   * 检查缓存键是否存在
   * @param key 缓存键
   * @returns 是否存在
   */
  async has(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    return this.cache.has(fullKey);
  }

  /**
   * 获取或设置缓存（cache-aside模式）
   * 如果缓存存在则返回，否则调用工厂函数生成并缓存
   * @param key 缓存键
   * @param factory 生成缓存值的工厂函数
   * @param ttl 生存时间（毫秒，可选）
   * @returns 缓存值
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
   * 根据模式使缓存失效
   * @param pattern 匹配模式
   * @returns 失效的缓存条目数
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    const keys = await this.cache.keys(this.options.keyPrefix + pattern);
    let count = 0;

    for (const key of keys) {
      await this.cache.delete(key);
      count++;
    }

    // 更新缓存大小统计
    this.stats.size = await this.cache.size();
    return count;
  }

  /**
   * 使指定租户的所有缓存失效
   * @param tenantId 租户ID
   * @returns 失效的缓存条目数
   */
  async invalidateTenant(tenantId: string): Promise<number> {
    return this.invalidateByPattern(`*${tenantId}*`);
  }

  /**
   * 使指定租户和主体的缓存失效
   * @param tenantId 租户ID
   * @param subjectId 主体ID
   * @returns 失效的缓存条目数
   */
  async invalidateSubject(tenantId: string, subjectId: string): Promise<number> {
    return this.invalidateByPattern(`*${tenantId}*${subjectId}*`);
  }

  /**
   * 获取指定租户的缓存版本
   * @param tenantId 租户ID
   * @returns 版本号
   */
  getVersion(tenantId: string): number {
    return this.versions.get(tenantId)?.version ?? 0;
  }

  /**
   * 增加指定租户的缓存版本
   * @param tenantId 租户ID
   * @returns 新的版本号
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
   * 检查指定租户的版本是否有效
   * @param tenantId 租户ID
   * @param version 要检查的版本号
   * @returns 版本是否有效
   */
  isVersionValid(tenantId: string, version: number): boolean {
    return this.getVersion(tenantId) === version;
  }

  /**
   * 清除所有缓存
   */
  async clear(): Promise<void> {
    await this.cache.clear();
    this.versions.clear();
    this.stats.size = 0;
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息的副本
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 重置缓存统计信息
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

  /**
   * 更新缓存命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * 创建缓存管理器实例
 * @param options 缓存选项
 * @returns 缓存管理器实例
 */
export function createCacheManager(options?: PolicyCacheOptions): CacheManager {
  return new CacheManager(options);
}
