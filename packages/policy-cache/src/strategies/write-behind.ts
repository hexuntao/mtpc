import type { CacheProvider } from '../types.js';

/**
 * 待处理的写操作
 */
interface PendingWrite<T> {
  /** 缓存键 */
  key: string;
  /** 缓存值 */
  value: T;
  /** 操作类型 */
  operation: 'set' | 'delete';
  /** 操作时间戳 */
  timestamp: number;
}

/**
 * 写回（写后）缓存策略
 * 立即写入缓存，然后批量写入到持久化存储中
 * 这种策略可以提高写入性能，但存在数据丢失的风险
 */
export class WriteBehindCache<T> {
  /** 底层缓存提供者 */
  private cache: CacheProvider;
  /** 持久化存储接口，用于实际的写入操作 */
  private store: {
    set: (key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  /** 待处理的写操作映射，使用 Map 实现去重 */
  private pendingWrites: Map<string, PendingWrite<T>> = new Map();
  /** 刷新间隔（毫秒），定时将待处理写操作批量写入存储 */
  private flushInterval: number;
  /** 最大批量大小，超过该大小会立即触发刷新 */
  private maxBatchSize: number;
  /** 刷新定时器 */
  private timer: ReturnType<typeof setInterval> | null = null;

  /**
   * 创建写回缓存实例
   * @param cache 底层缓存提供者
   * @param store 持久化存储接口
   * @param options 选项
   * @param options.flushInterval 刷新间隔（毫秒），默认 1000
   * @param options.maxBatchSize 最大批量大小，默认 100
   */
  constructor(
    cache: CacheProvider,
    store: {
      set: (key: string, value: T) => Promise<void>;
      delete: (key: string) => Promise<void>;
    },
    options: {
      flushInterval?: number;
      maxBatchSize?: number;
    } = {}
  ) {
    this.cache = cache;
    this.store = store;
    this.flushInterval = options.flushInterval ?? 1000;
    this.maxBatchSize = options.maxBatchSize ?? 100;

    this.startFlushTimer();
  }

  /**
   * 设置缓存值
   * 立即写入缓存，并将写操作添加到待处理队列
   * @param key 缓存键
   * @param value 缓存值
   */
  async set(key: string, value: T): Promise<void> {
    // 立即更新缓存
    await this.cache.set(key, value);

    // 将写操作添加到待处理队列
    this.pendingWrites.set(key, {
      key,
      value,
      operation: 'set',
      timestamp: Date.now(),
    });

    // 如果待处理写操作超过最大批量大小，立即刷新
    if (this.pendingWrites.size >= this.maxBatchSize) {
      await this.flush();
    }
  }

  /**
   * 删除缓存值
   * 立即从缓存中删除，并将删除操作添加到待处理队列
   * @param key 缓存键
   */
  async delete(key: string): Promise<void> {
    // 立即从缓存中删除
    await this.cache.delete(key);

    // 将删除操作添加到待处理队列
    this.pendingWrites.set(key, {
      key,
      value: null as T,
      operation: 'delete',
      timestamp: Date.now(),
    });

    // 如果待处理写操作超过最大批量大小，立即刷新
    if (this.pendingWrites.size >= this.maxBatchSize) {
      await this.flush();
    }
  }

  /**
   * 从缓存中获取值
   * @param key 缓存键
   * @returns 缓存值或 null（如果不存在）
   */
  async get(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  /**
   * 将待处理写操作批量写入到持久化存储
   * @returns 成功写入的操作数量
   */
  async flush(): Promise<number> {
    const writes = Array.from(this.pendingWrites.values());
    this.pendingWrites.clear();

    let count = 0;

    for (const write of writes) {
      try {
        if (write.operation === 'set') {
          await this.store.set(write.key, write.value);
        } else {
          await this.store.delete(write.key);
        }
        count++;
      } catch (error) {
        // 失败的写操作重新添加到待处理队列
        this.pendingWrites.set(write.key, write);
        console.error(`写回操作失败，键: ${write.key}`, error);
      }
    }

    return count;
  }

  /**
   * 获取待处理写操作的数量
   * @returns 待处理写操作数量
   */
  getPendingCount(): number {
    return this.pendingWrites.size;
  }

  /**
   * 启动刷新定时器
   * 定时将待处理写操作批量写入存储
   */
  private startFlushTimer(): void {
    this.timer = setInterval(() => {
      if (this.pendingWrites.size > 0) {
        this.flush().catch(console.error);
      }
    }, this.flushInterval);
  }

  /**
   * 停止并刷新
   * 清除定时器，并将所有待处理写操作写入存储
   */
  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    await this.flush();
  }
}

/**
 * 创建写回缓存实例
 * @param cache 底层缓存提供者
 * @param store 持久化存储接口
 * @param options 选项
 * @returns 写回缓存实例
 */
export function createWriteBehindCache<T>(
  cache: CacheProvider,
  store: {
    set: (key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
  },
  options?: {
    flushInterval?: number;
    maxBatchSize?: number;
  }
): WriteBehindCache<T> {
  return new WriteBehindCache(cache, store, options);
}
