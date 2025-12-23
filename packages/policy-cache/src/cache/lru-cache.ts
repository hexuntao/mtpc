import type { CacheEntry, CacheProvider } from '../types.js';

/**
 * LRU Cache implementation with O(1) operations
 */
export class LRUCache<T = unknown> implements CacheProvider {
  private capacity: number;
  private ttl: number;
  private cache: Map<string, CacheEntry<T>> = new Map();

  constructor(options: { capacity?: number; ttl?: number } = {}) {
    this.capacity = options.capacity ?? 1000;
    this.ttl = options.ttl ?? 60000;
  }

  async get<V>(key: string): Promise<V | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value as V;
  }

  async set<V>(key: string, value: V, ttl?: number): Promise<void> {
    // Remove if exists to update order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict if at capacity
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

    this.cache.set(key, entry as CacheEntry<T>);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

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

  async clear(): Promise<void> {
    this.cache.clear();
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

  /**
   * Get all entries (for debugging)
   */
  entries(): Map<string, CacheEntry<T>> {
    return new Map(this.cache);
  }

  /**
   * Peek without updating LRU order
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
 * Create LRU cache
 */
export function createLRUCache<T = unknown>(options?: {
  capacity?: number;
  ttl?: number;
}): LRUCache<T> {
  return new LRUCache<T>(options);
}
