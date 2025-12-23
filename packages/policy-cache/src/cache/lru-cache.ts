import type { CacheEntry, CacheProvider } from '../types.js';

/**
 * 具有 O(1) 操作复杂度的 LRU 缓存实现
 * LRU (Least Recently Used) 缓存会优先淘汰最久未使用的缓存项
 */
export class LRUCache<T = unknown> implements CacheProvider {
  /** 缓存容量，超出容量时会驱逐最久未使用的项 */
  private capacity: number;
  /** 缓存项的生存时间（毫秒） */
  private ttl: number;
  /** 内部缓存存储，使用 Map 实现以保证 O(1) 操作复杂度 */
  private cache: Map<string, CacheEntry<T>> = new Map();

  /**
   * 创建 LRU 缓存实例
   * @param options 缓存选项
   * @param options.capacity 缓存容量，默认 1000
   * @param options.ttl 缓存项生存时间（毫秒），默认 60000
   */
  constructor(options: { capacity?: number; ttl?: number } = {}) {
    this.capacity = options.capacity ?? 1000;
    this.ttl = options.ttl ?? 60000;
  }

  /**
   * 从缓存中获取值
   * 如果缓存项存在且未过期，会将其移动到最近使用的位置
   * @param key 缓存键
   * @returns 缓存值或 null（如果不存在或已过期）
   */
  async get<V>(key: string): Promise<V | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查缓存是否过期
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    // 将缓存项移动到最近使用的位置（Map 的末尾）
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value as unknown as V;
  }

  /**
   * 将值存入缓存
   * 如果缓存项已存在，会先删除再重新添加以更新使用顺序
   * 如果超出容量，会驱逐最久未使用的项
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 缓存项生存时间（毫秒，可选，默认使用构造函数中指定的 ttl）
   */
  async set<V>(key: string, value: V, ttl?: number): Promise<void> {
    // 如果缓存项已存在，先删除以更新使用顺序
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 如果超出容量，驱逐最久未使用的项（Map 的第一个项）
    while (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const now = Date.now();
    const entry: CacheEntry<V> = {
      value,
      createdAt: now,
      expiresAt: now + (ttl ?? this.ttl),
    };

    this.cache.set(key, entry as unknown as CacheEntry<T>);
  }

  /**
   * 删除缓存项
   * @param key 缓存键
   * @returns 是否成功删除
   */
  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  /**
   * 检查缓存项是否存在且未过期
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
      return false;
    }

    return true;
  }

  /**
   * 清空所有缓存项
   */
  async clear(): Promise<void> {
    this.cache.clear();
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
   * @returns 缓存项数量
   */
  async size(): Promise<number> {
    return this.cache.size;
  }

  /**
   * 获取所有缓存条目（用于调试）
   * @returns 包含所有缓存条目的 Map 副本
   */
  entries(): Map<string, CacheEntry<T>> {
    return new Map(this.cache);
  }

  /**
   * 获取缓存值但不更新 LRU 顺序
   * @param key 缓存键
   * @returns 缓存值或 null（如果不存在或已过期）
   */
  peek(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry || entry.expiresAt < Date.now()) {
      return null;
    }

    return entry.value;
  }
}

/**
 * 创建 LRU 缓存实例
 * @param options 缓存选项
 * @param options.capacity 缓存容量，默认 1000
 * @param options.ttl 缓存项生存时间（毫秒），默认 60000
 * @returns LRU 缓存实例
 */
export function createLRUCache<T = unknown>(options?: {
  capacity?: number;
  ttl?: number;
}): LRUCache<T> {
  return new LRUCache<T>(options);
}
