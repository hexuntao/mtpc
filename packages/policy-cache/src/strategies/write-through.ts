import type { CacheProvider } from '../types.js';

/**
 * Write-through cache strategy
 * Writes to both cache and underlying store synchronously
 */
export class WriteThroughCache<T> {
  private cache: CacheProvider;
  private store: {
    get: (key: string) => Promise<T | null>;
    set: (key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  private ttl: number;

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
   * Get value (cache-first)
   */
  async get(key: string): Promise<T | null> {
    // Try cache first
    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from store
    const value = await this.store.get(key);

    if (value !== null) {
      // Populate cache
      await this.cache.set(key, value, this.ttl);
    }

    return value;
  }

  /**
   * Set value (writes to both)
   */
  async set(key: string, value: T): Promise<void> {
    // Write to store first
    await this.store.set(key, value);

    // Then update cache
    await this.cache.set(key, value, this.ttl);
  }

  /**
   * Delete value (from both)
   */
  async delete(key: string): Promise<void> {
    // Delete from store first
    await this.store.delete(key);

    // Then remove from cache
    await this.cache.delete(key);
  }

  /**
   * Refresh cache from store
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
 * Create write-through cache
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
