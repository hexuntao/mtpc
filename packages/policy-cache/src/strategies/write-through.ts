import type { CacheProvider } from '../types.js';

/**
 * 直写缓存策略
 * 同步写入缓存和持久化存储，确保数据一致性
 * 这种策略可以保证数据的可靠性，但写入性能相对较低
 */
export class WriteThroughCache<T> {
  /** 底层缓存提供者 */
  private cache: CacheProvider;
  /** 持久化存储接口，用于实际的数据存储 */
  private store: {
    get: (key: string) => Promise<T | null>;
    set: (key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  /** 缓存条目生存时间（毫秒） */
  private ttl: number;

  /**
   * 创建直写缓存实例
   * @param cache 底层缓存提供者
   * @param store 持久化存储接口
   * @param options 选项
   * @param options.ttl 缓存条目生存时间（毫秒），默认 60000
   */
  constructor(
    cache: CacheProvider,
    store: {
      get: (key: string) => Promise<T | null>;
      set: (key: string, value: T) => Promise<void>;
      delete: (key: string) => Promise<void>;
    },
    options: { ttl?: number } = {}
  ) {
    this.cache = cache;
    this.store = store;
    this.ttl = options.ttl ?? 60000;
  }

  /**
   * 获取值（缓存优先）
   * 首先尝试从缓存获取，如果不存在则从存储获取，并将结果写入缓存
   * @param key 缓存键
   * @returns 缓存值或 null（如果不存在）
   */
  async get(key: string): Promise<T | null> {
    // 首先尝试从缓存获取
    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 从存储获取
    const value = await this.store.get(key);

    if (value !== null) {
      // 将结果写入缓存
      await this.cache.set(key, value, this.ttl);
    }

    return value;
  }

  /**
   * 设置值（同时写入缓存和存储）
   * 首先写入存储，然后更新缓存，确保数据一致性
   * @param key 缓存键
   * @param value 缓存值
   */
  async set(key: string, value: T): Promise<void> {
    // 首先写入存储，确保数据可靠性
    await this.store.set(key, value);

    // 然后更新缓存，提高后续读取性能
    await this.cache.set(key, value, this.ttl);
  }

  /**
   * 删除值（同时从缓存和存储删除）
   * 首先从存储删除，然后从缓存删除，确保数据一致性
   * @param key 缓存键
   */
  async delete(key: string): Promise<void> {
    // 首先从存储删除，确保数据可靠性
    await this.store.delete(key);

    // 然后从缓存删除，避免脏读
    await this.cache.delete(key);
  }

  /**
   * 从存储刷新缓存
   * 将存储中的最新数据更新到缓存中
   * @param key 缓存键
   * @returns 更新后的值或 null（如果不存在）
   */
  async refresh(key: string): Promise<T | null> {
    const value = await this.store.get(key);

    if (value !== null) {
      await this.cache.set(key, value, this.ttl);
    } else {
      await this.cache.delete(key);
    }

    return value;
  }
}

/**
 * 创建直写缓存实例
 * @param cache 底层缓存提供者
 * @param store 持久化存储接口
 * @param options 选项
 * @returns 直写缓存实例
 */
export function createWriteThroughCache<T>(
  cache: CacheProvider,
  store: {
    get: (key: string) => Promise<T | null>;
    set: (key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
  },
  options?: { ttl?: number }
): WriteThroughCache<T> {
  return new WriteThroughCache(cache, store, options);
}
