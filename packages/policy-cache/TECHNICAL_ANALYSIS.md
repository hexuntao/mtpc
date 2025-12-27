# @mtpc/policy-cache 技术分析文档

## 1. 概述

`@mtpc/policy-cache` 是 MTPC (Multi-Tenant Permission Core) 的策略缓存扩展，用于优化权限策略评估的运行时性能。该包提供了完整的缓存基础设施，包括多种缓存实现、缓存策略和与 MTPC Core 的集成插件。

### 1.1 核心设计原则

1. **业务无关**：不绑定任何具体业务逻辑，仅提供缓存能力
2. **可组合**：支持多种缓存策略和存储后端
3. **可扩展**：通过 `CacheProvider` 接口支持自定义缓存实现
4. **租户隔离**：所有缓存操作都以租户为隔离边界
5. **性能优先**：提供 O(1) 操作复杂度的缓存实现

### 1.2 架构层次

```
┌─────────────────────────────────────────────────────────┐
│                  PolicyCache (策略缓存)                │
│              - 权限缓存管理                            │
│              - 权限加载器集成                          │
│              - MTPC 集成接口                           │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────┐
│              CacheManager (缓存管理器)                  │
│              - 版本控制                                │
│              - 失效策略                                │
│              - 统计信息                                │
│              - 键构建                                  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────┐
│           CacheProvider (缓存提供者接口)                │
│              - get/set/delete/has/clear                │
│              - keys/size                              │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────┴──────┐ ┌───┴────┐ ┌────┴─────────┐
│ MemoryCache   │ │LRUCache│ │Custom Cache │
│              │ │        │ │(Provider)   │
└──────────────┘ └────────┘ └──────────────┘
```

---

## 2. 核心类型定义

### 2.1 CacheEntry<T>

缓存条目接口，表示缓存中的单个条目。

```typescript
export interface CacheEntry<T> {
  value: T;              // 缓存的实际值
  createdAt: number;     // 条目的创建时间戳（毫秒）
  expiresAt: number;     // 条目的过期时间戳（毫秒）
  version?: number;      // 条目的版本号（可选）
  metadata?: Record<string, unknown>; // 额外的元数据信息（可选）
}
```

**使用场景**：
- 存储缓存值及其元数据
- 支持 TTL 过期机制
- 支持版本控制（用于缓存一致性检查）

### 2.2 CacheKeyComponents

缓存键组件，用于构建缓存键的各个组成部分。

```typescript
export interface CacheKeyComponents {
  tenantId: string;      // 租户ID（必需）
  subjectId?: string;    // 主体ID（可选）
  resourceId?: string;   // 资源ID（可选）
  permission?: string;   // 权限代码（可选）
}
```

**使用场景**：
- 构建结构化的缓存键
- 支持租户级别的缓存隔离
- 支持细粒度的缓存失效

### 2.3 CacheStats

缓存统计信息，记录缓存的使用情况和性能指标。

```typescript
export interface CacheStats {
  hits: number;      // 缓存命中次数
  misses: number;    // 缓存未命中次数
  size: number;      // 当前缓存大小
  evictions: number; // 缓存驱逐次数
  hitRate: number;   // 缓存命中率（0-1之间的小数）
}
```

**使用场景**：
- 监控缓存性能
- 优化缓存配置
- 诊断缓存问题

### 2.4 CacheOptions

缓存选项，用于配置缓存的行为和特性。

```typescript
export interface CacheOptions {
  ttl?: number;                              // 缓存条目默认生存时间（毫秒）
  maxSize?: number;                          // 缓存的最大大小
  strategy?: CacheStrategy;                   // 缓存策略
  onEvict?: (key: string, entry: CacheEntry<unknown>) => void; // 条目被驱逐时的回调
}
```

**使用场景**：
- 配置缓存行为
- 监控缓存驱逐事件
- 自定义缓存策略

### 2.5 CacheStrategy

缓存策略类型，定义了多种缓存驱逐策略。

```typescript
export type CacheStrategy = 'lru' | 'lfu' | 'fifo' | 'ttl';
```

**策略说明**：
- `lru` (Least Recently Used)：最近最少使用，优先淘汰最久未使用的条目
- `lfu` (Least Frequently Used)：最不经常使用，优先淘汰访问次数最少的条目
- `fifo` (First In First Out)：先进先出，按插入顺序淘汰
- `ttl` (Time To Live)：基于时间的过期，优先淘汰已过期的条目

**当前实现状态**：
- `lru`：✅ 完整实现
- `fifo`：✅ 完整实现（与 LRU 相同）
- `ttl`：✅ 完整实现
- `lfu`：⚠️ 接口定义但未实现

### 2.6 PolicyCacheEntry

策略缓存条目，用于缓存编译后的策略和相关权限。

```typescript
export interface PolicyCacheEntry {
  policies: CompiledPolicy[];  // 编译后的策略列表
  permissions: Set<string>;     // 相关的权限集合
  version: number;             // 版本号
  tenantId: string;            // 租户ID
  subjectId?: string;          // 主体ID（可选）
}
```

**使用场景**：
- 缓存编译后的策略
- 支持策略版本控制
- 支持租户级别的策略隔离

### 2.7 PermissionCacheEntry

权限缓存条目，用于缓存主体的权限信息。

```typescript
export interface PermissionCacheEntry {
  permissions: Set<string>;   // 权限集合
  roles?: string[];           // 角色列表（可选）
  computedAt: number;          // 权限计算时间戳（毫秒）
  expiresAt: number;          // 过期时间戳（毫秒）
}
```

**使用场景**：
- 缓存主体的权限集合
- 支持角色信息缓存
- 支持权限计算时间跟踪

### 2.8 CacheProvider

缓存提供者接口，定义了缓存操作的标准方法。

```typescript
export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
  size(): Promise<number>;
}
```

**使用场景**：
- 定义缓存操作的标准接口
- 支持自定义缓存实现
- 支持多种存储后端（内存、Redis、Memcached 等）

### 2.9 PolicyCacheOptions

策略缓存选项，用于配置策略缓存的行为。

```typescript
export interface PolicyCacheOptions {
  provider?: CacheProvider;           // 自定义缓存提供者
  defaultTTL?: number;               // 默认缓存生存时间（毫秒）
  maxEntries?: number;               // 最大缓存条目数
  strategy?: CacheStrategy;          // 缓存策略
  keyPrefix?: string;                // 缓存键前缀
  enableStats?: boolean;             // 是否启用统计信息
  onHit?: (key: string) => void;    // 缓存命中时的回调函数
  onMiss?: (key: string) => void;   // 缓存未命中时的回调函数
}
```

**默认值**：
- `defaultTTL`: 60000 (60秒)
- `maxEntries`: 10000
- `keyPrefix`: 'mtpc:'
- `enableStats`: true
- `strategy`: 'lru'

### 2.10 VersionInfo

版本信息，用于跟踪租户的缓存版本。

```typescript
export interface VersionInfo {
  tenantId: string;      // 租户ID
  version: number;      // 版本号
  updatedAt: Date;      // 更新时间
}
```

**使用场景**：
- 跟踪租户缓存版本
- 支持缓存一致性检查
- 支持细粒度的缓存失效

---

## 3. 缓存实现层

### 3.1 MemoryCache

基于 Map 实现的内存缓存，支持多种缓存策略。

#### 3.1.1 核心特性

- 使用 Map 存储缓存条目
- 支持 TTL 过期机制
- 支持 LRU、FIFO、TTL 三种缓存策略
- 提供缓存统计信息
- 支持模式匹配的键查询

#### 3.1.2 关键方法

**get<T>(key: string): Promise<T | null>**

从缓存中获取值，自动处理过期和 LRU 更新。

```typescript
async get<T>(key: string): Promise<T | null> {
  const entry = this.cache.get(key);
  
  if (!entry) {
    this.stats.misses++;
    this.updateHitRate();
    return null;
  }
  
  // 检查缓存是否过期
  if (entry.expiresAt < Date.now()) {
    this.cache.delete(key);
    this.stats.misses++;
    this.stats.size--;
    this.updateHitRate();
    return null;
  }
  
  this.stats.hits++;
  this.updateHitRate();
  
  // 对于LRU策略，更新访问顺序
  if (this.options.strategy === 'lru') {
    this.cache.delete(key);
    this.cache.set(key, entry);
  }
  
  return entry.value as T;
}
```

**set<T>(key: string, value: T, ttl?: number): Promise<void>**

将值存入缓存，自动处理容量限制。

```typescript
async set<T>(key: string, value: T, ttl?: number): Promise<void> {
  const effectiveTTL = ttl ?? this.options.ttl ?? 60000;
  const now = Date.now();
  
  // 检查是否超过最大大小限制
  if (this.cache.size >= (this.options.maxSize ?? 10000)) {
    this.evict(); // 执行缓存驱逐
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
```

**delete(key: string): Promise<boolean>**

删除缓存条目。

```typescript
async delete(key: string): Promise<boolean> {
  const existed = this.cache.has(key);
  
  if (existed) {
    this.cache.delete(key);
    this.stats.size--;
  }
  
  return existed;
}
```

**has(key: string): Promise<boolean>**

检查缓存键是否存在且未过期。

```typescript
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
```

**clear(): Promise<void>**

清除所有缓存。

```typescript
async clear(): Promise<void> {
  this.cache.clear();
  this.stats.size = 0;
}
```

**keys(pattern?: string): Promise<string[]>**

获取匹配模式的缓存键，支持通配符 `*`。

```typescript
async keys(pattern?: string): Promise<string[]> {
  const allKeys = Array.from(this.cache.keys());
  
  if (!pattern) {
    return allKeys;
  }
  
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  return allKeys.filter(key => regex.test(key));
}
```

**size(): Promise<number>**

获取缓存大小。

```typescript
async size(): Promise<number> {
  return this.cache.size;
}
```

**cleanup(): number**

清理过期的缓存条目，返回清理的条目数量。

```typescript
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
```

#### 3.1.3 驱逐策略实现

**evictLRU(): void**

执行 LRU 缓存驱逐，Map 维护了插入顺序，第一个键是最久未使用的。

```typescript
private evictLRU(): void {
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
```

**evictFIFO(): void**

执行 FIFO 缓存驱逐，对于 Map 来说，FIFO 和 LRU 的实现相同。

```typescript
private evictFIFO(): void {
  this.evictLRU();
}
```

**evictExpired(): void**

执行基于 TTL 的缓存驱逐，删除所有已过期的缓存条目。

```typescript
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
  
  // 如果没有过期条目，回退到LRU策略
  if (!evicted) {
    this.evictLRU();
  }
}
```

#### 3.1.4 默认配置

```typescript
constructor(options: CacheOptions = {}) {
  this.options = {
    ttl: options.ttl ?? 60000,        // 默认TTL为60秒
    maxSize: options.maxSize ?? 10000, // 默认最大条目数为10000
    strategy: options.strategy ?? 'lru', // 默认使用LRU策略
    ...options,
  };
}
```

### 3.2 LRUCache

具有 O(1) 操作复杂度的 LRU 缓存实现。

#### 3.2.1 核心特性

- 使用 Map 保证 O(1) 操作复杂度
- 通过删除和重新插入实现 LRU 顺序
- 支持 TTL 过期机制
- 自动容量管理和驱逐

#### 3.2.2 关键方法

**get<V>(key: string): Promise<V | null>**

从缓存中获取值，如果缓存项存在且未过期，会将其移动到最近使用的位置。

```typescript
async get<V>(key: string): Promise<V | null> {
  const entry = this.cache.get(key);
  
  if (!entry) {
    return null;
  }
  
  // 检查缓存是否过期
  if (entry.expiresAt < Date.now()) {
    this.cache.delete(key);
    return null;
  }
  
  // 将缓存项移动到最近使用的位置（Map 的末尾）
  this.cache.delete(key);
  this.cache.set(key, entry);
  
  return entry.value as unknown as V;
}
```

**set<V>(key: string, value: V, ttl?: number): Promise<void>**

将值存入缓存，如果缓存项已存在，会先删除再重新添加以更新使用顺序。如果超出容量，会驱逐最久未使用的项。

```typescript
async set<V>(key: string, value: V, ttl?: number): Promise<void> {
  // 如果缓存项已存在，先删除以更新使用顺序
  if (this.cache.has(key)) {
    this.cache.delete(key);
  }
  
  // 如果超出容量，驱逐最久未使用的项（Map 的第一个项）
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
  
  this.cache.set(key, entry as unknown as CacheEntry<T>);
}
```

**peek(key: string): T | null**

获取缓存值但不更新 LRU 顺序。

```typescript
peek(key: string): T | null {
  const entry = this.cache.get(key);
  
  if (!entry || entry.expiresAt < Date.now()) {
    return null;
  }
  
  return entry.value;
}
```

**entries(): Map<string, CacheEntry<T>>**

获取所有缓存条目（用于调试）。

```typescript
entries(): Map<string, CacheEntry<T>> {
  return new Map(this.cache);
}
```

#### 3.2.3 默认配置

```typescript
constructor(options: { capacity?: number; ttl?: number } = {}) {
  this.capacity = options.capacity ?? 1000;
  this.ttl = options.ttl ?? 60000;
}
```

### 3.3 CacheManager

带版本控制和失效机制的缓存管理器。

#### 3.3.1 核心特性

- 版本控制机制，跟踪每个租户的缓存版本
- 多种失效策略（租户级、主体级、模式匹配）
- 统计信息收集
- 支持 getOrSet 模式

#### 3.3.2 关键方法

**buildKey(...parts: string[]): string**

构建缓存键。

```typescript
buildKey(...parts: string[]): string {
  return this.options.keyPrefix + parts.join(':');
}
```

**get<T>(key: string): Promise<T | null>**

从缓存中获取值，更新统计信息。

```typescript
async get<T>(key: string): Promise<T | null> {
  const fullKey = this.buildKey(key);
  const value = await this.cache.get<T>(fullKey);
  
  // 更新统计信息
  if (this.options.enableStats) {
    if (value !== null) {
      this.stats.hits++;
      this.options.onHit?.(key);
    } else {
      this.stats.misses++;
      this.options.onMiss?.(key);
    }
    this.updateHitRate();
  }
  
  return value;
}
```

**set<T>(key: string, value: T, ttl?: number): Promise<void>**

将值存入缓存，更新缓存大小统计。

```typescript
async set<T>(key: string, value: T, ttl?: number): Promise<void> {
  const fullKey = this.buildKey(key);
  await this.cache.set(fullKey, value, ttl ?? this.options.defaultTTL);
  // 更新缓存大小统计
  this.stats.size = await this.cache.size();
}
```

**getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T>**

获取或设置缓存（cache-aside 模式），如果缓存存在则返回，否则调用工厂函数生成并缓存。

```typescript
async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
  const cached = await this.get<T>(key);
  
  if (cached !== null) {
    return cached;
  }
  
  const value = await factory();
  await this.set(key, value, ttl);
  return value;
}
```

**invalidateByPattern(pattern: string): Promise<number>**

根据模式使缓存失效。

```typescript
async invalidateByPattern(pattern: string): Promise<number> {
  const keys = await this.cache.keys(this.options.keyPrefix + pattern);
  let count = 0;
  
  for (const key of keys) {
    await this.cache.delete(key);
    count++;
  }
  
  // 更新缓存大小统计
  this.stats.size = await this.cache.size();
  return count;
}
```

**invalidateTenant(tenantId: string): Promise<number>**

使指定租户的所有缓存失效。

```typescript
async invalidateTenant(tenantId: string): Promise<number> {
  return this.invalidateByPattern(`*${tenantId}*`);
}
```

**invalidateSubject(tenantId: string, subjectId: string): Promise<number>**

使指定租户和主体的缓存失效。

```typescript
async invalidateSubject(tenantId: string, subjectId: string): Promise<number> {
  return this.invalidateByPattern(`*${tenantId}*${subjectId}*`);
}
```

**getVersion(tenantId: string): number**

获取指定租户的缓存版本。

```typescript
getVersion(tenantId: string): number {
  return this.versions.get(tenantId)?.version ?? 0;
}
```

**incrementVersion(tenantId: string): number**

增加指定租户的缓存版本。

```typescript
incrementVersion(tenantId: string): number {
  const current = this.getVersion(tenantId);
  const newVersion = current + 1;
  
  this.versions.set(tenantId, {
    tenantId,
    version: newVersion,
    updatedAt: new Date(),
  });
  
  return newVersion;
}
```

**isVersionValid(tenantId: string, version: number): boolean**

检查指定租户的版本是否有效。

```typescript
isVersionValid(tenantId: string, version: number): boolean {
  return this.getVersion(tenantId) === version;
}
```

#### 3.3.3 默认配置

```typescript
constructor(options: PolicyCacheOptions = {}) {
  this.options = {
    defaultTTL: options.defaultTTL ?? 60000,    // 默认TTL为60秒
    maxEntries: options.maxEntries ?? 10000,    // 默认最大条目数为10000
    keyPrefix: options.keyPrefix ?? 'mtpc:',    // 默认缓存键前缀
    enableStats: options.enableStats ?? true,    // 默认启用统计
    ...options,
  };
  
  // 使用自定义缓存提供者或默认的内存缓存
  this.cache = options.provider ??
    new MemoryCache({
      ttl: this.options.defaultTTL,
      maxSize: this.options.maxEntries,
    });
}
```

---

## 4. 缓存策略层

### 4.1 WriteThroughCache

直写缓存策略，同步写入缓存和持久化存储，确保数据一致性。

#### 4.1.1 核心特性

- 先写入存储，再更新缓存
- 确保数据一致性
- 缓存优先的读取策略

#### 4.1.2 关键方法

**get(key: string): Promise<T | null>**

获取值（缓存优先），首先尝试从缓存获取，如果不存在则从存储获取，并将结果写入缓存。

```typescript
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
```

**set(key: string, value: T): Promise<void>**

设置值（同时写入缓存和存储），首先写入存储，然后更新缓存，确保数据一致性。

```typescript
async set(key: string, value: T): Promise<void> {
  // 首先写入存储，确保数据可靠性
  await this.store.set(key, value);
  
  // 然后更新缓存，提高后续读取性能
  await this.cache.set(key, value, this.ttl);
}
```

**delete(key: string): Promise<void>**

删除值（同时从缓存和存储删除），首先从存储删除，然后从缓存删除，确保数据一致性。

```typescript
async delete(key: string): Promise<void> {
  // 首先从存储删除，确保数据可靠性
  await this.store.delete(key);
  
  // 然后从缓存删除，避免脏读
  await this.cache.delete(key);
}
```

**refresh(key: string): Promise<T | null>**

从存储刷新缓存，将存储中的最新数据更新到缓存中。

```typescript
async refresh(key: string): Promise<T | null> {
  const value = await this.store.get(key);
  
  if (value !== null) {
    await this.cache.set(key, value, this.ttl);
  } else {
    await this.cache.delete(key);
  }
  
  return value;
}
```

#### 4.1.3 适用场景

- 数据一致性要求高的场景
- 写入频率较低的场景
- 数据丢失不可接受的场景

### 4.2 WriteBehindCache

写回（写后）缓存策略，立即写入缓存，然后批量写入到持久化存储中。

#### 4.2.1 核心特性

- 立即更新缓存
- 批量写入持久化存储
- 支持定时刷新和批量大小控制
- 去重机制（使用 Map）

#### 4.2.2 关键方法

**set(key: string, value: T): Promise<void>**

设置缓存值，立即写入缓存，并将写操作添加到待处理队列。

```typescript
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
```

**delete(key: string): Promise<void>**

删除缓存值，立即从缓存中删除，并将删除操作添加到待处理队列。

```typescript
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
```

**flush(): Promise<number>**

将待处理写操作批量写入到持久化存储。

```typescript
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
```

**getPendingCount(): number**

获取待处理写操作的数量。

```typescript
getPendingCount(): number {
  return this.pendingWrites.size;
}
```

**stop(): Promise<void>**

停止并刷新，清除定时器，并将所有待处理写操作写入存储。

```typescript
async stop(): Promise<void> {
  if (this.timer) {
    clearInterval(this.timer);
    this.timer = null;
  }
  
  await this.flush();
}
```

#### 4.2.3 默认配置

```typescript
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
  this.flushInterval = options.flushInterval ?? 1000;  // 默认1秒
  this.maxBatchSize = options.maxBatchSize ?? 100;    // 默认100
  
  this.startFlushTimer();
}
```

#### 4.2.4 适用场景

- 写入频率高的场景
- 可以容忍数据短暂不一致的场景
- 需要高写入性能的场景

### 4.3 RefreshAheadCache

预刷新缓存策略，在缓存条目即将过期之前主动刷新，提高缓存命中率，减少缓存未命中时的延迟。

#### 4.3.1 核心特性

- 在缓存即将过期前触发后台刷新
- 避免并发刷新同一键
- 跟踪过期时间

#### 4.3.2 关键方法

**get(key: string): Promise<T | null>**

获取值并应用预刷新策略，如果缓存存在且即将过期，会在后台触发刷新。如果缓存不存在，会同步加载数据。

```typescript
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
```

**set(key: string, value: T): Promise<void>**

设置缓存值。

```typescript
async set(key: string, value: T): Promise<void> {
  await this.cache.set(key, value, this.ttl);
  this.expirations.set(key, Date.now() + this.ttl);
}
```

**invalidate(key: string): Promise<void>**

使缓存键失效。

```typescript
async invalidate(key: string): Promise<void> {
  await this.cache.delete(key);
  this.expirations.delete(key);
}
```

**isRefreshing(key: string): boolean**

检查键是否正在刷新。

```typescript
isRefreshing(key: string): boolean {
  return this.refreshing.has(key);
}
```

#### 4.3.3 默认配置

```typescript
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
  this.ttl = options.ttl ?? 60000;                     // 默认60秒
  this.refreshThreshold = options.refreshThreshold ?? 0.2; // 默认20%
}
```

#### 4.3.4 适用场景

- 读密集型场景
- 对延迟敏感的场景
- 缓存命中率要求高的场景

---

## 5. PolicyCache

MTPC 策略缓存类，用于缓存和管理权限信息。

### 5.1 核心特性

- 使用 CacheManager 管理缓存
- 支持自定义权限加载器
- 提供权限缓存失效机制
- 创建 MTPC 的权限解析器

### 5.2 关键方法

**setPermissionLoader(loader): void**

设置权限加载器。

```typescript
setPermissionLoader(loader: (tenantId: string, subjectId: string) => Promise<Set<string>>): void {
  this.permissionLoader = loader;
}
```

**getPermissions(tenantId: subjectId): Promise<Set<string> | null>**

获取主体的缓存权限。

```typescript
async getPermissions(tenantId: string, subjectId: string): Promise<Set<string> | null> {
  const key = `permissions:${tenantId}:${subjectId}`;
  const entry = await this.cacheManager.get<PermissionCacheEntry>(key);
  
  if (!entry) {
    return null;
  }
  
  // 检查缓存是否过期
  if (entry.expiresAt < Date.now()) {
    await this.cacheManager.delete(key);
    return null;
  }
  
  return entry.permissions;
}
```

**setPermissions(tenantId, subjectId, permissions, roles?, ttl?): Promise<void>**

设置主体的缓存权限。

```typescript
async setPermissions(
  tenantId: string,
  subjectId: string,
  permissions: Set<string>,
  roles?: string[],
  ttl?: number
): Promise<void> {
  const key = `permissions:${tenantId}:${subjectId}`;
  const now = Date.now();
  
  const entry: PermissionCacheEntry = {
    permissions,
    roles,
    computedAt: now,
    expiresAt: now + (ttl ?? 60000), // 默认TTL为60秒
  };
  
  await this.cacheManager.set(key, entry, ttl);
}
```

**getOrLoadPermissions(tenantId, subjectId, ttl?): Promise<Set<string>>**

获取或加载主体的权限，如果缓存存在则直接返回，否则调用权限加载器加载并缓存。

```typescript
async getOrLoadPermissions(
  tenantId: string,
  subjectId: string,
  ttl?: number
): Promise<Set<string>> {
  const cached = await this.getPermissions(tenantId, subjectId);
  
  if (cached !== null) {
    return cached;
  }
  
  if (!this.permissionLoader) {
    return new Set();
  }
  
  const permissions = await this.permissionLoader(tenantId, subjectId);
  await this.setPermissions(tenantId, subjectId, permissions, undefined, ttl);
  
  return permissions;
}
```

**invalidateSubject(tenantId, subjectId): Promise<void>**

使主体的权限缓存失效。

```typescript
async invalidateSubject(tenantId: string, subjectId: string): Promise<void> {
  const key = `permissions:${tenantId}:${subjectId}`;
  await this.cacheManager.delete(key);
}
```

**invalidateTenant(tenantId): Promise<number>**

使租户的所有权限缓存失效。

```typescript
async invalidateTenant(tenantId: string): Promise<number> {
  return this.cacheManager.invalidateTenant(tenantId);
}
```

**clear(): Promise<void>**

清除所有缓存。

```typescript
async clear(): Promise<void> {
  await this.cacheManager.clear();
}
```

**getStats(): CacheStats**

获取缓存统计信息。

```typescript
getStats(): CacheStats {
  return this.cacheManager.getStats();
}
```

**createPermissionResolver(): (tenantId: string, subjectId: string) => Promise<Set<string>>**

创建 MTPC 的权限解析器。

```typescript
createPermissionResolver(): (tenantId: string, subjectId: string) => Promise<Set<string>> {
  return (tenantId, subjectId) => this.getOrLoadPermissions(tenantId, subjectId);
}
```

---

## 6. 插件集成

### 6.1 createPolicyCachePlugin

创建 MTPC 策略缓存插件，用于在 MTPC 框架中集成策略缓存功能。

#### 6.1.1 核心特性

- 自动处理缓存失效
- 在写操作（创建、更新、删除）时使租户缓存失效
- 插件销毁时清理所有缓存

#### 6.1.2 插件生命周期

**install(context: PluginContext): void**

插件安装方法，注册全局钩子用于缓存失效。

```typescript
install(context: PluginContext): void {
  // 注册全局钩子用于缓存失效
  context.registerGlobalHooks({
    afterAny: [
      async (mtpcContext, operation, _resourceName, _result) => {
        // 在写操作（创建、更新、删除）时使缓存失效
        if (['create', 'update', 'delete'].includes(operation)) {
          await cacheManager.invalidateTenant(mtpcContext.tenant.id);
        }
      },
    ],
  });
}
```

**onDestroy(): void**

插件销毁方法，在插件被销毁时清理所有缓存。

```typescript
onDestroy(): void {
  cacheManager.clear();
}
```

#### 6.1.3 使用示例

```typescript
import { createMTPC } from '@mtpc/core';
import { createPolicyCachePlugin } from '@mtpc/policy-cache';

// 创建 MTPC 实例
const mtpc = createMTPC();

// 使用策略缓存插件
mtpc.use(createPolicyCachePlugin({
  defaultTTL: 1800000, // 30分钟
  maxEntries: 5000,
  strategy: 'lru'
}));

// 初始化 MTPC
await mtpc.init();
```

---

## 7. 与 README.md 的差异对比

### 7.1 PolicyCacheOptions 接口差异

| 项目 | README.md | 源码 | 差异说明 |
|------|-----------|------|----------|
| strategy | `'write-through' \| 'write-behind' \| 'refresh-ahead'` | `'lru' \| 'lfu' \| 'fifo' \| 'ttl'` | 完全不一致 |
| cacheType | `'memory' \| 'lru'` | 不存在 | README.md 中有不存在的选项 |
| cache | `CacheManager` | `provider?: CacheProvider` | 参数名称和类型不一致 |

### 7.2 缺失的 API 文档

源码中存在但 README.md 未详细说明的功能：

1. **LRUCache 类**
   - `peek(key: string): T | null` - 获取值但不更新 LRU 顺序
   - `entries(): Map<string, CacheEntry<T>>` - 获取所有缓存条目

2. **WriteThroughCache 类**
   - `refresh(key: string): Promise<T | null>` - 从存储刷新缓存

3. **WriteBehindCache 类**
   - `getPendingCount(): number` - 获取待处理写操作数量
   - `stop(): Promise<void>` - 停止并刷新

4. **RefreshAheadCache 类**
   - `isRefreshing(key: string): boolean` - 检查键是否正在刷新

5. **CacheManager 版本控制方法**
   - `getVersion(tenantId: string): number`
   - `incrementVersion(tenantId: string): number`
   - `isVersionValid(tenantId: string, version: number): boolean`

6. **MemoryCache 方法**
   - `cleanup(): number` - 清理过期的缓存条目

7. **类型接口**
   - `CacheKeyComponents` - 缓存键组件
   - `PolicyCacheEntry` - 策略缓存条目
   - `VersionInfo` - 版本信息

### 7.3 默认配置值差异

| 配置项 | README.md 示例 | 源码默认值 | 差异 |
|--------|----------------|-------------|------|
| ttl | 3600000 (1小时) | 60000 (60秒) | ✓ 示例值不同 |
| maxSize | 10000 | 10000 | ✓ 一致 |
| keyPrefix | 未明确说明 | 'mtpc:' | ✓ 源码明确 |
| enableStats | 未明确说明 | true | ✓ 源码明确 |
| strategy | 'write-through' | 'lru' | ✗ 完全不一致 |

### 7.4 导入路径错误

README.md 第 388 行：
```typescript
import { CacheManager } from '@mtpc/policy-cache/dist/cache'
```

正确路径应该是：
```typescript
import { CacheManager } from '@mtpc/policy-cache/dist/cache/cache-manager'
```

---

## 8. 最佳实践建议

### 8.1 缓存策略选择

| 场景 | 推荐策略 | 原因 |
|------|-----------|------|
| 读密集型 | `lru` + `refresh-ahead` | 提高缓存命中率，减少延迟 |
| 写密集型 | `write-behind` | 批量写入，提高写入性能 |
| 数据一致性要求高 | `write-through` | 同步写入，确保一致性 |
| 缓存容量有限 | `lru` | 优先淘汰最久未使用的条目 |
| 过期时间固定 | `ttl` | 基于时间过期，简单可靠 |

### 8.2 TTL 配置建议

| 场景 | 推荐TTL | 原因 |
|------|----------|------|
| 权限变化不频繁 | 3600000 (1小时) | 减少缓存失效，提高命中率 |
| 权限变化频繁 | 300000 (5分钟) | 及时更新缓存，保证一致性 |
| 关键权限 | 60000 (1分钟) | 快速失效，保证安全性 |
| 测试环境 | 10000 (10秒) | 快速验证，方便调试 |

### 8.3 缓存失效策略

1. **细粒度失效**：优先使用 `invalidateSubject` 而非 `invalidateTenant`
2. **版本控制**：使用版本号检查缓存有效性，避免脏读
3. **模式匹配**：使用 `invalidateByPattern` 进行批量失效
4. **自动失效**：通过插件钩子自动失效缓存

### 8.4 性能优化建议

1. **监控缓存命中率**：定期检查 `hitRate`，低于 80% 时考虑优化
2. **调整缓存大小**：根据实际负载调整 `maxSize`
3. **使用合适的策略**：根据访问模式选择合适的缓存策略
4. **批量操作**：使用 `getOrSet` 模式减少重复加载

---

## 9. 总结

`@mtpc/policy-cache` 是一个功能完善的缓存扩展，提供了：

1. **多种缓存实现**：MemoryCache、LRUCache
2. **多种缓存策略**：LRU、FIFO、TTL
3. **多种写入策略**：Write-Through、Write-Behind、Refresh-Ahead
4. **完整的版本控制**：支持租户级别的版本管理
5. **灵活的失效机制**：支持租户级、主体级、模式匹配失效
6. **与 MTPC Core 无缝集成**：通过插件机制自动处理缓存失效

通过合理配置和使用，可以显著提高权限检查的性能，特别是在多租户、高并发的场景下。
