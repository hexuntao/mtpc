import type { CompiledPolicy, PolicyDefinition, TenantContext } from '@mtpc/core';

/**
 * Cache entry
 */
export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  version?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Cache key components
 */
export interface CacheKeyComponents {
  tenantId: string;
  subjectId?: string;
  resourceId?: string;
  permission?: string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
  hitRate: number;
}

/**
 * Cache options
 */
export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  strategy?: CacheStrategy;
  onEvict?: (key: string, entry: CacheEntry<unknown>) => void;
}

/**
 * Cache strategy
 */
export type CacheStrategy = 'lru' | 'lfu' | 'fifo' | 'ttl';

/**
 * Policy cache entry
 */
export interface PolicyCacheEntry {
  policies: CompiledPolicy[];
  permissions: Set<string>;
  version: number;
  tenantId: string;
  subjectId?: string;
}

/**
 * Permission cache entry
 */
export interface PermissionCacheEntry {
  permissions: Set<string>;
  roles?: string[];
  computedAt: number;
  expiresAt: number;
}

/**
 * Cache provider interface
 */
export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
  size(): Promise<number>;
}

/**
 * Policy cache options
 */
export interface PolicyCacheOptions {
  provider?: CacheProvider;
  defaultTTL?: number;
  maxEntries?: number;
  strategy?: CacheStrategy;
  keyPrefix?: string;
  enableStats?: boolean;
  onHit?: (key: string) => void;
  onMiss?: (key: string) => void;
}

/**
 * Version info
 */
export interface VersionInfo {
  tenantId: string;
  version: number;
  updatedAt: Date;
}
