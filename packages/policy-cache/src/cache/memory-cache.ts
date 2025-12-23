import type { CacheEntry, CacheOptions, CacheProvider, CacheStats } from '../types.js';

/**
 * In-memory cache provider
 */
export class MemoryCache implements CacheProvider {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    evictions: 0,
    hitRate: 0,
  };
  private options: CacheOptions;

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl ?? 60000, // 1 minute default
      maxSize: options.maxSize ?? 10000,
      strategy: options.strategy ?? 'lru',
      ...options,
    };
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.size--;
      this.updateHitRate();
      return null;
    }

    this.stats.hits++;
    this.updateHitRate();

    // Update access time for LRU
    if (this.options.strategy === 'lru') {
      this.cache.delete(key);
      this.cache.set(key, entry);
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTTL = ttl ?? this.options.ttl ?? 60000;
    const now = Date.now();

    // Check size limit
    if (this.cache.size >= (this.options.maxSize ?? 10000)) {
      this.evict();
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

  async delete(key: string): Promise<boolean> {
    const existed = this.cache.has(key);

    if (existed) {
      this.cache.delete(key);
      this.stats.size--;
    }

    return existed;
  }

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

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.size = 0;
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());

    if (!pattern) {
      return allKeys;
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private evict(): void {
    const strategy = this.options.strategy ?? 'lru';

    switch (strategy) {
      case 'lru':
        this.evictLRU();
        break;
      case 'fifo':
        this.evictFIFO();
        break;
      case 'ttl':
        this.evictExpired();
        break;
      default:
        this.evictLRU();
    }
  }

  private evictLRU(): void {
    // Map maintains insertion order, first key is least recently used
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

  private evictFIFO(): void {
    // Same as LRU for Map
    this.evictLRU();
  }

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

    // If no expired entries, fall back to LRU
    if (!evicted) {
      this.evictLRU();
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Cleanup expired entries
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
 * Create memory cache
 */
export function createMemoryCache(options?: CacheOptions): MemoryCache {
  return new MemoryCache(options);
}
