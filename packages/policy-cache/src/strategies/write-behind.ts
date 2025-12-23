import type { CacheProvider } from '../types.js';

/**
 * Pending write operation
 */
interface PendingWrite<T> {
  key: string;
  value: T;
  operation: 'set' | 'delete';
  timestamp: number;
}

/**
 * Write-behind (write-back) cache strategy
 * Writes to cache immediately, batches writes to store
 */
export class WriteBehindCache<T> {
  private cache: CacheProvider;
  private store: {
    set: (key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  private pendingWrites: Map<string, PendingWrite<T>> = new Map();
  private flushInterval: number;
  private maxBatchSize: number;
  private timer: ReturnType<typeof setInterval> | null = null;

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
   * Set value (writes to cache immediately)
   */
  async set(key: string, value: T): Promise<void> {
    // Update cache immediately
    await this.cache.set(key, value);

    // Queue write to store
    this.pendingWrites.set(key, {
      key,
      value,
      operation: 'set',
      timestamp: Date.now(),
    });

    // Flush if batch size exceeded
    if (this.pendingWrites.size >= this.maxBatchSize) {
      await this.flush();
    }
  }

  /**
   * Delete value
   */
  async delete(key: string): Promise<void> {
    // Remove from cache immediately
    await this.cache.delete(key);

    // Queue delete to store
    this.pendingWrites.set(key, {
      key,
      value: null as T,
      operation: 'delete',
      timestamp: Date.now(),
    });

    // Flush if batch size exceeded
    if (this.pendingWrites.size >= this.maxBatchSize) {
      await this.flush();
    }
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  /**
   * Flush pending writes to store
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
        // Re-queue failed writes
        this.pendingWrites.set(write.key, write);
        console.error(`Write-behind failed for key ${write.key}:`, error);
      }
    }

    return count;
  }

  /**
   * Get pending write count
   */
  getPendingCount(): number {
    return this.pendingWrites.size;
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.timer = setInterval(() => {
      if (this.pendingWrites.size > 0) {
        this.flush().catch(console.error);
      }
    }, this.flushInterval);
  }

  /**
   * Stop and flush
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
 * Create write-behind cache
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
