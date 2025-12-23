import type { CacheEntry, CacheOptions, CacheProvider, CacheStats } from '../types.js';

/**
 * 内存缓存提供者
 * 基于 Map 实现的内存缓存，支持多种缓存策略
 */
export class MemoryCache implements CacheProvider {
  /** 内部缓存存储，使用 Map 实现 */
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  /** 缓存统计信息 */
  private stats: CacheStats = {
    hits: 0, // 缓存命中次数
    misses: 0, // 缓存未命中次数
    size: 0, // 当前缓存大小
    evictions: 0, // 缓存驱逐次数
    hitRate: 0, // 缓存命中率
  };
  /** 缓存选项 */
  private options: CacheOptions;

  /**
   * 创建内存缓存实例
   * @param options 缓存选项
   */
  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl ?? 60000, // 默认TTL为60秒
      maxSize: options.maxSize ?? 10000, // 默认最大条目数为10000
      strategy: options.strategy ?? 'lru', // 默认使用LRU策略
      ...options,
    };
  }

  /**
   * 从缓存中获取值
   * @param key 缓存键
   * @returns 缓存值或null（如果不存在或已过期）
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // 检查缓存是否过期
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size--;
      this.updateHitRate();
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();

    // 对于LRU策略，更新访问顺序
    if (this.options.strategy === 'lru') {
      this.cache.delete(key);
      this.cache.set(key, entry);
    }

    return entry.value as T;
  }

  /**
   * 将值存入缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 生存时间（毫秒，可选）
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTTL = ttl ?? this.options.ttl ?? 60000;
    const now = Date.now();

    // 检查是否超过最大大小限制
    if (this.cache.size >= (this.options.maxSize ?? 10000)) {
      this.evict(); // 执行缓存驱逐
    }

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt: now + effectiveTTL,
    };

    const isNew = !this.cache.has(key);
    this.cache.set(key, entry);

    if (isNew) {
      this.stats.size++;
    }
  }

  /**
   * 删除缓存条目
   * @param key 缓存键
   * @returns 是否成功删除
   */
  async delete(key: string): Promise<boolean> {
    const existed = this.cache.has(key);

    if (existed) {
      this.cache.delete(key);
      this.stats.size--;
    }

    return existed;
  }

  /**
   * 检查缓存键是否存在
   * @param key 缓存键
   * @returns 是否存在且未过期
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.size--;
      return false;
    }

    return true;
  }

  /**
   * 清除所有缓存
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * 获取匹配模式的缓存键
   * @param pattern 匹配模式，支持通配符 *
   * @returns 匹配的键列表
   */
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());

    if (!pattern) {
      return allKeys;
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  /**
   * 获取缓存大小
   * @returns 缓存条目数量
   */
  async size(): Promise<number> {
    return this.cache.size;
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 根据策略执行缓存驱逐
   */
  private evict(): void {
    const strategy = this.options.strategy ?? 'lru';

    switch (strategy) {
      case 'lru': // 最近最少使用
        this.evictLRU();
        break;
      case 'fifo': // 先进先出
        this.evictFIFO();
        break;
      case 'ttl': // 基于时间的过期
        this.evictExpired();
        break;
      default:
        this.evictLRU();
    }
  }

  /**
   * 执行LRU缓存驱逐
   * Map 维护了插入顺序，第一个键是最久未使用的
   */
  private evictLRU(): void {
    const firstKey = this.cache.keys().next().value;

    if (firstKey) {
      const entry = this.cache.get(firstKey);
      this.cache.delete(firstKey);
      this.stats.size--;
      this.stats.evictions++;

      if (this.options.onEvict && entry) {
        this.options.onEvict(firstKey, entry);
      }
    }
  }

  /**
   * 执行FIFO缓存驱逐
   * 对于Map来说，FIFO和LRU的实现相同
   */
  private evictFIFO(): void {
    this.evictLRU();
  }

  /**
   * 执行基于TTL的缓存驱逐
   * 删除所有已过期的缓存条目
   */
  private evictExpired(): void {
    const now = Date.now();
    let evicted = false;

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        this.stats.size--;
        this.stats.evictions++;
        evicted = true;

        if (this.options.onEvict) {
          this.options.onEvict(key, entry);
        }
      }
    }

    // 如果没有过期条目，回退到LRU策略
    if (!evicted) {
      this.evictLRU();
    }
  }

  /**
   * 更新缓存命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 清理过期的缓存条目
   * @returns 清理的条目数量
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        this.stats.size--;
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * 创建内存缓存实例
 * @param options 缓存选项
 * @returns 内存缓存实例
 */
export function createMemoryCache(options?: CacheOptions): MemoryCache {
  return new MemoryCache(options);
}
