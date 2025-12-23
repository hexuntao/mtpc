import type { CacheProvider } from '../types.js';

/**
 * 预刷新缓存策略
 * 在缓存条目即将过期之前主动刷新，提高缓存命中率，减少缓存未命中时的延迟
 */
export class RefreshAheadCache<T> {
  /** 底层缓存提供者 */
  private cache: CacheProvider;
  /** 从数据源加载数据的函数 */
  private loader: (key: string) => Promise<T | null>;
  /** 缓存条目生存时间（毫秒） */
  private ttl: number;
  /** 预刷新阈值（TTL的百分比），当剩余时间低于此阈值时触发刷新 */
  private refreshThreshold: number;
  /** 正在刷新中的键集合，用于避免并发刷新同一键 */
  private refreshing: Set<string> = new Set();
  /** 缓存条目的过期时间映射 */
  private expirations: Map<string, number> = new Map();

  /**
   * 创建预刷新缓存实例
   * @param cache 底层缓存提供者
   * @param loader 从数据源加载数据的函数
   * @param options 选项
   * @param options.ttl 缓存条目生存时间（毫秒），默认 60000
   * @param options.refreshThreshold 预刷新阈值（TTL的百分比），默认 0.2（20%）
   */
  constructor(
    cache: CacheProvider,
    loader: (key: string) => Promise<T | null>,
    options: {
      ttl?: number;
      refreshThreshold?: number;
    } = {}
  ) {
    this.cache = cache;
    this.loader = loader;
    this.ttl = options.ttl ?? 60000;
    this.refreshThreshold = options.refreshThreshold ?? 0.2; // 20%
  }

  /**
   * 获取值并应用预刷新策略
   * 如果缓存存在且即将过期，会在后台触发刷新
   * 如果缓存不存在，会同步加载数据
   * @param key 缓存键
   * @returns 缓存值或 null（如果加载失败）
   */
  async get(key: string): Promise<T | null> {
    const value = await this.cache.get<T>(key);
    const expiration = this.expirations.get(key);

    // 检查是否需要刷新
    if (value !== null && expiration) {
      const remaining = expiration - Date.now();
      const threshold = this.ttl * this.refreshThreshold;

      // 如果剩余时间低于阈值且不在刷新中，则触发后台刷新
      if (remaining < threshold && !this.refreshing.has(key)) {
        this.refreshInBackground(key);
      }
    }

    // 如果缓存不存在，同步加载数据
    if (value === null) {
      return this.load(key);
    }

    return value;
  }

  /**
   * 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   */
  async set(key: string, value: T): Promise<void> {
    await this.cache.set(key, value, this.ttl);
    this.expirations.set(key, Date.now() + this.ttl);
  }

  /**
   * 从数据源加载数据并设置到缓存
   * @param key 缓存键
   * @returns 加载的值或 null（如果加载失败）
   */
  private async load(key: string): Promise<T | null> {
    const value = await this.loader(key);

    if (value !== null) {
      await this.set(key, value);
    }

    return value;
  }

  /**
   * 在后台刷新缓存
   * 异步执行，不阻塞主线程
   * @param key 缓存键
   */
  private async refreshInBackground(key: string): Promise<void> {
    // 避免并发刷新同一键
    if (this.refreshing.has(key)) {
      return;
    }

    this.refreshing.add(key);

    try {
      const value = await this.loader(key);

      if (value !== null) {
        await this.set(key, value);
      }
    } catch (error) {
      console.error(`预刷新失败，键: ${key}`, error);
    } finally {
      this.refreshing.delete(key);
    }
  }

  /**
   * 使缓存键失效
   * @param key 缓存键
   */
  async invalidate(key: string): Promise<void> {
    await this.cache.delete(key);
    this.expirations.delete(key);
  }

  /**
   * 检查键是否正在刷新
   * @param key 缓存键
   * @returns 是否正在刷新
   */
  isRefreshing(key: string): boolean {
    return this.refreshing.has(key);
  }
}

/**
 * 创建预刷新缓存实例
 * @param cache 底层缓存提供者
 * @param loader 从数据源加载数据的函数
 * @param options 选项
 * @returns 预刷新缓存实例
 */
export function createRefreshAheadCache<T>(
  cache: CacheProvider,
  loader: (key: string) => Promise<T | null>,
  options?: {
    ttl?: number;
    refreshThreshold?: number;
  }
): RefreshAheadCache<T> {
  return new RefreshAheadCache(cache, loader, options);
}
