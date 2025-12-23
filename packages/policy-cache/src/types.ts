import type { CompiledPolicy } from '@mtpc/core';

/**
 * 缓存条目
 * 表示缓存中的单个条目，包含值和元数据
 */
export interface CacheEntry<T> {
  /** 缓存的实际值 */
  value: T;
  /** 条目的创建时间戳（毫秒） */
  createdAt: number;
  /** 条目的过期时间戳（毫秒） */
  expiresAt: number;
  /** 条目的版本号 */
  version?: number;
  /** 额外的元数据信息 */
  metadata?: Record<string, unknown>;
}

/**
 * 缓存键组件
 * 用于构建缓存键的各个组成部分
 */
export interface CacheKeyComponents {
  /** 租户ID */
  tenantId: string;
  /** 主体ID（可选） */
  subjectId?: string;
  /** 资源ID（可选） */
  resourceId?: string;
  /** 权限代码（可选） */
  permission?: string;
}

/**
 * 缓存统计信息
 * 记录缓存的使用情况和性能指标
 */
export interface CacheStats {
  /** 缓存命中次数 */
  hits: number;
  /** 缓存未命中次数 */
  misses: number;
  /** 当前缓存大小 */
  size: number;
  /** 缓存驱逐次数 */
  evictions: number;
  /** 缓存命中率 */
  hitRate: number;
}

/**
 * 缓存选项
 * 用于配置缓存的行为和特性
 */
export interface CacheOptions {
  /** 缓存条目默认生存时间（毫秒） */
  ttl?: number;
  /** 缓存的最大大小 */
  maxSize?: number;
  /** 缓存策略 */
  strategy?: CacheStrategy;
  /** 条目被驱逐时的回调函数 */
  onEvict?: (key: string, entry: CacheEntry<unknown>) => void;
}

/**
 * 缓存策略类型
 * - lru: 最近最少使用
 * - lfu: 最不经常使用
 * - fifo: 先进先出
 * - ttl: 基于时间的过期
 */
export type CacheStrategy = 'lru' | 'lfu' | 'fifo' | 'ttl';

/**
 * 策略缓存条目
 * 用于缓存编译后的策略和相关权限
 */
export interface PolicyCacheEntry {
  /** 编译后的策略列表 */
  policies: CompiledPolicy[];
  /** 相关的权限集合 */
  permissions: Set<string>;
  /** 版本号 */
  version: number;
  /** 租户ID */
  tenantId: string;
  /** 主体ID（可选） */
  subjectId?: string;
}

/**
 * 权限缓存条目
 * 用于缓存主体的权限信息
 */
export interface PermissionCacheEntry {
  /** 权限集合 */
  permissions: Set<string>;
  /** 角色列表（可选） */
  roles?: string[];
  /** 权限计算时间戳（毫秒） */
  computedAt: number;
  /** 过期时间戳（毫秒） */
  expiresAt: number;
}

/**
 * 缓存提供者接口
 * 定义了缓存操作的标准方法
 */
export interface CacheProvider {
  /**
   * 从缓存中获取值
   * @param key 缓存键
   * @returns 缓存值或null（如果不存在）
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * 将值存入缓存
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 生存时间（毫秒，可选）
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * 删除缓存条目
   * @param key 缓存键
   * @returns 是否成功删除
   */
  delete(key: string): Promise<boolean>;

  /**
   * 检查缓存键是否存在
   * @param key 缓存键
   * @returns 是否存在
   */
  has(key: string): Promise<boolean>;

  /**
   * 清除所有缓存
   */
  clear(): Promise<void>;

  /**
   * 获取匹配模式的缓存键
   * @param pattern 匹配模式
   * @returns 匹配的键列表
   */
  keys(pattern?: string): Promise<string[]>;

  /**
   * 获取缓存大小
   * @returns 缓存条目数量
   */
  size(): Promise<number>;
}

/**
 * 策略缓存选项
 * 用于配置策略缓存的行为
 */
export interface PolicyCacheOptions {
  /** 自定义缓存提供者 */
  provider?: CacheProvider;
  /** 默认缓存生存时间（毫秒） */
  defaultTTL?: number;
  /** 最大缓存条目数 */
  maxEntries?: number;
  /** 缓存策略 */
  strategy?: CacheStrategy;
  /** 缓存键前缀 */
  keyPrefix?: string;
  /** 是否启用统计信息 */
  enableStats?: boolean;
  /** 缓存命中时的回调函数 */
  onHit?: (key: string) => void;
  /** 缓存未命中时的回调函数 */
  onMiss?: (key: string) => void;
}

/**
 * 版本信息
 * 用于跟踪租户的缓存版本
 */
export interface VersionInfo {
  /** 租户ID */
  tenantId: string;
  /** 版本号 */
  version: number;
  /** 更新时间 */
  updatedAt: Date;
}
