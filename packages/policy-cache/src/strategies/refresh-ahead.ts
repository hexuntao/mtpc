import type { CacheProvider } from '../types.js';

/**
 * Refresh-ahead cache strategy
 * Proactively refreshes cache entries before expiration
 */
export class RefreshAheadCache<T> {
  private cache: CacheProvider;
  private loader: (key: string) => Promise<T | null>;
  private ttl: number;
  private refreshThreshold: number; // Refresh when this % of TTL remains
  private refreshing: Set<string> = new Set();
  private expirations: Map<string, number> = new Map();

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
   * Get value with refresh-ahead
   */
  async get(key: string): Promise<T | null> {
    const value = await this.cache.get<T>(key);
    const expiration = this.expirations.get(key);

    // Check if needs refresh
    if (value !== null && expiration) {
      const remaining = expiration - Date.now();
      const threshold = this.ttl * this.refreshThreshold;

      if (remaining < threshold && !this.refreshing.has(key)) {
        // Trigger background refresh
        this.refreshInBackground(key);
      }
    }

    // If not in cache, load synchronously
    if (value === null) {
      return this.load(key);
    }

    return value;
  }

  /**
   * Set value
   */
  async set(key: string, value: T): Promise<void> {
    await this.cache.set(key, value, this.ttl);
    this.expirations.set(key, Date.now() + this.ttl);
  }

  /**
   * Load value from source
   */
  private async load(key: string): Promise<T | null> {
    const value = await this.loader(key);

    if (value !== null) {
      await this.set(key, value);
    }

    return value;
  }

  /**
   * Refresh in background
   */
  private async refreshInBackground(key: string): Promise<void> {
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
      console.error(`Refresh-ahead failed for key ${key}:`, error);
    } finally {
      this.refreshing.delete(key);
    }
  }

  /**
   * Invalidate key
   */
  async invalidate(key: string): Promise<void> {
    await this.cache.delete(key);
    this.expirations.delete(key);
  }

  /**
   * Get refresh status
   */
  isRefreshing(key: string): boolean {
    return this.refreshing.has(key);
  }
}

/**
 * Create refresh-ahead cache
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
