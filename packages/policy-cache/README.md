# @mtpc/policy-cache 使用指南

## 1. 包简介

`@mtpc/policy-cache` 是 MTPC (Multi-Tenant Permission Core) 的策略缓存扩展，用于优化权限策略评估的运行时性能，尤其适用于多租户环境、复杂权限策略和高频权限校验场景。

### 核心功能

- 多级缓存支持（MemoryCache、LRUCache）
- 智能缓存失效策略（租户级、主体级、模式匹配）
- 支持多种缓存驱逐策略（LRU、LFU、FIFO、TTL）
- 支持多种缓存写入策略（Write-Through、Write-Behind、Refresh-Ahead）
- 租户级别的缓存隔离
- 版本控制机制
- 缓存统计和监控
- 易于与 MTPC Core 集成
- 支持自定义缓存实现（通过 CacheProvider 接口）

### 适用场景

- 多租户 SaaS 应用
- 高频权限校验场景
- 复杂权限策略评估
- 大规模用户群体
- 对权限检查性能要求高的应用
- 需要缓存权限决策结果的场景

## 2. 安装指南

### 2.1 安装依赖

使用 pnpm 安装 `@mtpc/policy-cache` 包：

```bash
pnpm add @mtpc/policy-cache @mtpc/core
```

### 2.2 依赖要求

| 依赖包 | 版本要求 | 说明 |
|--------|----------|------|
| `@mtpc/core` | ^1.0.0 | MTPC 核心包，提供基础权限能力 |

## 3. 快速开始

### 3.1 基本使用示例

```typescript
import { createMTPC } from '@mtpc/core';
import { createPolicyCache } from '@mtpc/policy-cache';

// 创建策略缓存实例
const policyCache = createPolicyCache({
  // 缓存配置选项
  defaultTTL: 3600000, // 缓存过期时间：1小时（毫秒）
  maxEntries: 10000, // 最大缓存条目数
  strategy: 'lru' // 缓存驱逐策略：'lru' | 'lfu' | 'fifo' | 'ttl'
});

// 设置权限加载器
policyCache.setPermissionLoader(async (tenantId, subjectId) => {
  // 示例：从数据库加载权限
  // 实际应用中，这里应该是从数据库或外部服务获取权限
  console.log(`Loading permissions for tenant ${tenantId}, subject ${subjectId}`);
  return new Set(['user:read', 'user:create', 'user:update']);
});

// 创建 MTPC 实例，并使用缓存的权限解析器
const mtpc = createMTPC({
  defaultPermissionResolver: policyCache.createPermissionResolver()
});

// 使用 MTPC 实例进行权限检查
async function checkPermission() {
  const result = await mtpc.checkPermission({
    tenant: { id: 'tenant-1', status: 'active' },
    subject: { id: 'user-1', type: 'user' },
    resource: 'user',
    action: 'read'
  });
  
  console.log('Permission check result:', result);
  // 第一次调用会加载权限并缓存
  // 第二次调用会直接从缓存获取
}

// 第一次调用（加载并缓存权限）
await checkPermission();
// 第二次调用（直接从缓存获取）
await checkPermission();
```

### 3.2 通过插件集成

```typescript
import { createMTPC } from '@mtpc/core';
import { createPolicyCachePlugin } from '@mtpc/policy-cache';

// 创建 MTPC 实例
const mtpc = createMTPC();

// 使用策略缓存插件
mtpc.use(createPolicyCachePlugin({
  // 插件配置选项
  defaultTTL: 1800000, // 30分钟
  maxEntries: 5000,
  strategy: 'lru' // 缓存驱逐策略：'lru' | 'lfu' | 'fifo' | 'ttl'
}));

// 初始化 MTPC
await mtpc.init();

// 现在 MTPC 会自动在写操作后使租户缓存失效
```

## 4. 核心 API 详解

### 4.1 PolicyCache 类

#### 构造函数

```typescript
new PolicyCache(options?)
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `options` | `PolicyCacheOptions` | `{}` | 策略缓存配置选项 |

#### PolicyCacheOptions

```typescript
interface PolicyCacheOptions {
  provider?: CacheProvider;           // 自定义缓存提供者
  defaultTTL?: number;               // 默认缓存生存时间（毫秒），默认 60000 (60秒）
  maxEntries?: number;               // 最大缓存条目数，默认 10000
  strategy?: CacheStrategy;          // 缓存驱逐策略：'lru' | 'lfu' | 'fifo' | 'ttl'，默认 'lru'
  keyPrefix?: string;                // 缓存键前缀，默认 'mtpc:'
  enableStats?: boolean;             // 是否启用统计信息，默认 true
  onHit?: (key: string) => void;    // 缓存命中时的回调函数
  onMiss?: (key: string) => void;   // 缓存未命中时的回调函数
}

// CacheStrategy 类型
type CacheStrategy = 'lru' | 'lfu' | 'fifo' | 'ttl';
```

**默认配置值**：
- `defaultTTL`: 60000 (60秒)
- `maxEntries`: 10000
- `keyPrefix`: 'mtpc:'
- `enableStats`: true
- `strategy`: 'lru'

#### setPermissionLoader 方法

设置权限加载器，用于从数据源加载权限：

```typescript
setPermissionLoader(loader): void
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `loader` | `(tenantId: string, subjectId: string) => Promise<Set<string>>` | 权限加载器函数 |

#### getPermissions 方法

获取主体的缓存权限：

```typescript
getPermissions(tenantId, subjectId): Promise<Set<string> | null>
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `tenantId` | `string` | 租户ID |
| `subjectId` | `string` | 主体ID |
| **返回值** | `Promise<Set<string> | null>` | 权限集合或null（如果缓存不存在或已过期） |

#### setPermissions 方法

设置主体的缓存权限：

```typescript
setPermissions(tenantId, subjectId, permissions, roles?, ttl?): Promise<void>
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `tenantId` | `string` | 租户ID |
| `subjectId` | `string` | 主体ID |
| `permissions` | `Set<string>` | 权限集合 |
| `roles` | `string[]` | 角色列表（可选） |
| `ttl` | `number` | 生存时间（毫秒，可选） |

#### getOrLoadPermissions 方法

获取或加载主体的权限（如果缓存不存在则加载）：

```typescript
getOrLoadPermissions(tenantId, subjectId, ttl?): Promise<Set<string>>
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `tenantId` | `string` | 租户ID |
| `subjectId` | `string` | 主体ID |
| `ttl` | `number` | 生存时间（毫秒，可选） |
| **返回值** | `Promise<Set<string>>` | 权限集合 |

#### invalidateSubject 方法

使主体的权限缓存失效：

```typescript
invalidateSubject(tenantId, subjectId): Promise<void>
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `tenantId` | `string` | 租户ID |
| `subjectId` | `string` | 主体ID |

#### invalidateTenant 方法

使租户的所有权限缓存失效：

```typescript
invalidateTenant(tenantId): Promise<number>
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `tenantId` | `string` | 租户ID |
| **返回值** | `Promise<number>` | 失效的缓存条目数 |

#### clear 方法

清除所有缓存：

```typescript
clear(): Promise<void>
```

#### getStats 方法

获取缓存统计信息：

```typescript
getStats(): CacheStats
```

| 返回值 | 类型 | 说明 |
|--------|------|------|
| | `CacheStats` | 缓存统计信息 |

#### createPermissionResolver 方法

创建 MTPC 的权限解析器：

```typescript
createPermissionResolver(): (tenantId: string, subjectId: string) => Promise<Set<string>>
```

| 返回值 | 类型 | 说明 |
|--------|------|------|
| | `(tenantId: string, subjectId: string) => Promise<Set<string>>` | 权限解析器函数 |

### 4.2 缓存统计信息 (CacheStats)

```typescript
interface CacheStats {
  hits: number; // 缓存命中次数
  misses: number; // 缓存未命中次数
  hitRate: number; // 命中率
  size: number; // 当前缓存大小
  maxSize: number; // 最大缓存大小
  evictions: number; // 缓存驱逐次数
  sets: number; // 缓存写入次数
  gets: number; // 缓存读取次数
  deletes: number; // 缓存删除次数
}
```

## 5. 高级功能演示

### 5.1 自定义缓存配置

```typescript
import { createPolicyCache } from '@mtpc/policy-cache';

// 创建具有自定义配置的策略缓存
const customCache = createPolicyCache({
  defaultTTL: 300000, // 5分钟过期
  maxEntries: 1000, // 最多缓存1000个条目
  strategy: 'lru', // 缓存驱逐策略：'lru' | 'lfu' | 'fifo' | 'ttl'
  keyPrefix: 'myapp:', // 自定义缓存键前缀
  enableStats: true, // 启用统计信息
  onHit: (key) => console.log(`Cache hit: ${key}`),
  onMiss: (key) => console.log(`Cache miss: ${key}`)
});

// 设置权限加载器
customCache.setPermissionLoader(async (tenantId, subjectId) => {
  // 从数据源加载权限
  return new Set(['user:read', 'user:write']);
});
```

### 5.2 缓存失效策略

```typescript
import { createPolicyCache } from '@mtpc/policy-cache';

const policyCache = createPolicyCache();

// 设置权限加载器
policyCache.setPermissionLoader(async (tenantId, subjectId) => {
  return new Set(['user:read', 'user:create']);
});

// 权限变更时手动失效缓存
async function onPermissionChange(tenantId, subjectId) {
  // 使指定主体的缓存失效
  await policyCache.invalidateSubject(tenantId, subjectId);
  console.log(`Invalidated cache for tenant ${tenantId}, subject ${subjectId}`);
}

// 租户权限批量变更时失效整个租户的缓存
async function onTenantPermissionChange(tenantId) {
  const count = await policyCache.invalidateTenant(tenantId);
  console.log(`Invalidated ${count} cache entries for tenant ${tenantId}`);
}
```

### 5.3 监控缓存性能

```typescript
import { createPolicyCache } from '@mtpc/policy-cache';

const policyCache = createPolicyCache();

// 定期输出缓存统计信息
setInterval(() => {
  const stats = policyCache.getStats();
  console.log('Cache Stats:', {
    hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
    size: `${stats.size}/${stats.maxSize}`,
    hits: stats.hits,
    misses: stats.misses,
    evictions: stats.evictions
  });
}, 60000); // 每分钟输出一次

// 使用缓存
policyCache.setPermissionLoader(async (tenantId, subjectId) => {
  return new Set(['user:read', 'user:write']);
});
```

### 5.4 缓存驱逐策略

#### 5.4.1 LRU 策略（默认）

最近最少使用（Least Recently Used）策略，优先淘汰最久未使用的缓存项。

```typescript
import { createPolicyCache } from '@mtpc/policy-cache';

const lruCache = createPolicyCache({
  defaultTTL: 3600000, // 1小时
  maxEntries: 10000,
  strategy: 'lru' // 最近最少使用
});
```

#### 5.4.2 LFU 策略

最不经常使用（Least Frequently Used）策略，优先淘汰访问次数最少的缓存项。

```typescript
import { createPolicyCache } from '@mtpc/policy-cache';

const lfuCache = createPolicyCache({
  defaultTTL: 3600000,
  maxEntries: 10000,
  strategy: 'lfu' // 最不经常使用
});
```

#### 5.4.3 FIFO 策略

先进先出（First In First Out）策略，按插入顺序淘汰缓存项。

```typescript
import { createPolicyCache } from '@mtpc/policy-cache';

const fifoCache = createPolicyCache({
  defaultTTL: 3600000,
  maxEntries: 10000,
  strategy: 'fifo' // 先进先出
});
```

#### 5.4.4 TTL 策略

基于时间的过期策略，优先淘汰已过期的缓存项。

```typescript
import { createPolicyCache } from '@mtpc/policy-cache';

const ttlCache = createPolicyCache({
  defaultTTL: 3600000,
  maxEntries: 10000,
  strategy: 'ttl' // 基于时间的过期
});
```

### 5.5 缓存写入策略

#### 5.5.1 Write-Through 策略

直写策略：同步写入缓存和持久化存储，确保数据一致性。

```typescript
import { createPolicyCache, createWriteThroughCache } from '@mtpc/policy-cache';
import { MemoryCache } from '@mtpc/policy-cache';

// 创建底层缓存
const memoryCache = new MemoryCache({
  ttl: 60000,
  maxSize: 10000
});

// 创建直写缓存
const writeThroughCache = createWriteThroughCache(
  memoryCache,
  {
    get: async (key) => {
      // 从持久化存储获取
      return await storage.get(key);
    },
    set: async (key, value) => {
      // 写入持久化存储
      await storage.set(key, value);
    },
    delete: async (key) => {
      // 从持久化存储删除
      await storage.delete(key);
    }
  },
  { ttl: 60000 }
);
```

#### 5.5.2 Write-Behind 策略

写回策略：立即写入缓存，然后批量写入到持久化存储中。

```typescript
import { createWriteBehindCache } from '@mtpc/policy-cache';
import { MemoryCache } from '@mtpc/policy-cache';

const memoryCache = new MemoryCache({
  ttl: 60000,
  maxSize: 10000
});

const writeBehindCache = createWriteBehindCache(
  memoryCache,
  {
    set: async (key, value) => {
      await storage.set(key, value);
    },
    delete: async (key) => {
      await storage.delete(key);
    }
  },
  {
    flushInterval: 1000, // 刷新间隔（毫秒）
    maxBatchSize: 100 // 最大批量大小
  }
);

// 停止并刷新所有待处理写操作
await writeBehindCache.stop();
```

#### 5.5.3 Refresh-Ahead 策略

预刷新策略：在缓存条目即将过期之前主动刷新。

```typescript
import { createRefreshAheadCache } from '@mtpc/policy-cache';
import { MemoryCache } from '@mtpc/policy-cache';

const memoryCache = new MemoryCache({
  ttl: 60000,
  maxSize: 10000
});

const refreshAheadCache = createRefreshAheadCache(
  memoryCache,
  async (key) => {
    // 从数据源加载数据
    return await dataSource.get(key);
  },
  {
    ttl: 60000,
    refreshThreshold: 0.8 // 过期前 20% 时间刷新
  }
);

// 检查键是否正在刷新
const isRefreshing = refreshAheadCache.isRefreshing('some-key');
```

### 5.5 自定义缓存实现

```typescript
import { createPolicyCache } from '@mtpc/policy-cache';
import { CacheProvider } from '@mtpc/policy-cache';

// 实现自定义缓存提供者
class CustomCacheProvider implements CacheProvider {
  // 实现 CacheProvider 接口
  private cache = new Map<string, any>();
  
  async get<T>(key: string): Promise<T | null> {
    return this.cache.get(key) || null;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.cache.set(key, value);
    // 实现自定义过期逻辑
    if (ttl) {
      setTimeout(() => this.cache.delete(key), ttl);
    }
  }
  
  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }
  
  async clear(): Promise<void> {
    this.cache.clear();
  }
  
  async invalidateTenant(tenantId: string): Promise<number> {
    // 实现租户级缓存失效
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(`permissions:${tenantId}:`)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }
  
  getStats(): import('@mtpc/policy-cache/dist/types').CacheStats {
    // 实现自定义统计
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: this.cache.size,
      maxSize: Infinity,
      evictions: 0,
      sets: 0,
      gets: 0,
      deletes: 0
    };
  }
}

// 使用自定义缓存提供者
const customCache = createPolicyCache({
  provider: new CustomCacheProvider()
});
```

### 5.6 集成外部缓存系统

```typescript
import { createPolicyCache } from '@mtpc/policy-cache';
import { CacheProvider } from '@mtpc/policy-cache';
import Redis from 'ioredis';

// 连接到 Redis
const redis = new Redis();

// 实现基于 Redis 的缓存提供者
class RedisCacheProvider implements CacheProvider {
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const stringValue = JSON.stringify(value);
    if (ttl) {
      await redis.setex(key, ttl / 1000, stringValue);
    } else {
      await redis.set(key, stringValue);
    }
  }
  
  async delete(key: string): Promise<boolean> {
    const result = await redis.del(key);
    return result > 0;
  }
  
  async has(key: string): Promise<boolean> {
    const result = await redis.exists(key);
    return result > 0;
  }
  
  async clear(): Promise<void> {
    await redis.flushdb();
  }
  
  async keys(): Promise<string[]> {
    return await redis.keys('*');
  }
  
  async size(): Promise<number> {
    return await redis.dbsize();
  }
  
  async invalidateTenant(tenantId: string): Promise<number> {
    const keys = await redis.keys(`permissions:${tenantId}:*`);
    if (keys.length === 0) {
      return 0;
    }
    const result = await redis.del(...keys);
    return result;
  }
  
  getStats() {
    // Redis 统计需要特殊实现，这里简化处理
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      maxSize: Infinity,
      evictions: 0,
      sets: 0,
      gets: 0,
      deletes: 0
    };
  }
}

// 使用 Redis 缓存提供者
const redisCache = createPolicyCache({
  provider: new RedisCacheProvider()
});
```

### 5.7 LRUCache 高级用法

LRUCache 提供了一些高级方法用于调试和特殊场景。

```typescript
import { LRUCache, createLRUCache } from '@mtpc/policy-cache';

const lruCache = createLRUCache({
  capacity: 1000,
  ttl: 60000 // 60秒
});

// 获取值但不更新 LRU 顺序
const value = lruCache.peek('some-key');

// 获取所有缓存条目（用于调试）
const allEntries = lruCache.entries();
console.log('All cache entries:', allEntries);
```

### 5.8 CacheManager 版本控制

CacheManager 提供了版本控制机制，用于跟踪租户的缓存版本。

```typescript
import { CacheManager, createCacheManager } from '@mtpc/policy-cache';

const cacheManager = createCacheManager({
  defaultTTL: 3600000,
  maxEntries: 10000
});

// 获取租户的缓存版本
const version = cacheManager.getVersion('tenant-1');
console.log('Tenant version:', version);

// 增加租户的缓存版本
const newVersion = cacheManager.incrementVersion('tenant-1');
console.log('New version:', newVersion);

// 检查版本是否有效
const isValid = cacheManager.isVersionValid('tenant-1', version);
console.log('Is version valid:', isValid);
```

### 5.9 MemoryCache 清理过期缓存

MemoryCache 提供了清理过期缓存的方法。

```typescript
import { MemoryCache, createMemoryCache } from '@mtpc/policy-cache';

const memoryCache = createMemoryCache({
  ttl: 60000,
  maxSize: 10000
});

// 清理过期的缓存条目
const cleaned = memoryCache.cleanup();
console.log(`Cleaned ${cleaned} expired entries`);
```

### 5.10 WriteBehindCache 待处理操作管理

WriteBehindCache 提供了管理待处理写操作的方法。

```typescript
import { WriteBehindCache, createWriteBehindCache } from '@mtpc/policy-cache';
import { MemoryCache } from '@mtpc/policy-cache';

const memoryCache = new MemoryCache({
  ttl: 60000,
  maxSize: 10000
});

const writeBehindCache = createWriteBehindCache(
  memoryCache,
  {
    set: async (key, value) => {
      await storage.set(key, value);
    },
    delete: async (key) => {
      await storage.delete(key);
    }
  },
  {
    flushInterval: 1000,
    maxBatchSize: 100
  }
);

// 获取待处理写操作数量
const pendingCount = writeBehindCache.getPendingCount();
console.log('Pending writes:', pendingCount);

// 手动刷新待处理写操作
const flushed = await writeBehindCache.flush();
console.log(`Flushed ${flushed} writes`);

// 停止并刷新所有待处理写操作
await writeBehindCache.stop();
```

### 5.11 RefreshAheadCache 刷新状态检查

RefreshAheadCache 提供了检查键是否正在刷新的方法。

```typescript
import { RefreshAheadCache, createRefreshAheadCache } from '@mtpc/policy-cache';
import { MemoryCache } from '@mtpc/policy-cache';

const memoryCache = new MemoryCache({
  ttl: 60000,
  maxSize: 10000
});

const refreshAheadCache = createRefreshAheadCache(
  memoryCache,
  async (key) => {
    return await dataSource.get(key);
  },
  {
    ttl: 60000,
    refreshThreshold: 0.8
  }
);

// 检查键是否正在刷新
const isRefreshing = refreshAheadCache.isRefreshing('some-key');
console.log('Is refreshing:', isRefreshing);
```

### 5.12 WriteThroughCache 刷新方法

WriteThroughCache 提供了手动刷新缓存的方法。

```typescript
import { WriteThroughCache, createWriteThroughCache } from '@mtpc/policy-cache';
import { MemoryCache } from '@mtpc/policy-cache';

const memoryCache = new MemoryCache({
  ttl: 60000,
  maxSize: 10000
});

const writeThroughCache = createWriteThroughCache(
  memoryCache,
  {
    get: async (key) => {
      return await storage.get(key);
    },
    set: async (key, value) => {
      await storage.set(key, value);
    },
    delete: async (key) => {
      await storage.delete(key);
    }
  },
  { ttl: 60000 }
);

// 手动刷新指定键的缓存
const value = await writeThroughCache.refresh('some-key');
console.log('Refreshed value:', value);
```

## 6. 最佳实践

### 6.1 合理设置缓存过期时间

```typescript
// 根据业务需求设置不同的缓存过期时间
const policyCache = createPolicyCache({
  // 权限变化不频繁的场景，设置较长过期时间
  defaultTTL: 3600000, // 1小时
  // 对于关键权限或变化频繁的场景，设置较短过期时间
  // defaultTTL: 300000, // 5分钟
});
```

### 6.2 监控缓存命中率

```typescript
// 定期检查缓存命中率，优化缓存配置
setInterval(() => {
  const stats = policyCache.getStats();
  if (stats.hitRate < 0.8) { // 如果命中率低于80%
    console.warn('Low cache hit rate detected:', stats.hitRate);
    // 考虑增大缓存大小或调整过期时间
  }
}, 300000); // 每5分钟检查一次
```

### 6.3 权限变更时及时失效缓存

```typescript
// 在权限管理服务中
async function updateUserPermissions(tenantId: string, userId: string, permissions: Set<string>) {
  // 1. 更新数据库中的权限
  await permissionRepository.updatePermissions(tenantId, userId, permissions);
  
  // 2. 失效缓存
  await policyCache.invalidateSubject(tenantId, userId);
  
  // 3. 可选：通知相关服务
  await notifyPermissionChange(tenantId, userId);
}
```

### 6.4 考虑租户规模的缓存配置

```typescript
// 根据租户规模动态调整缓存配置
function getCacheConfig(tenantType: 'small' | 'medium' | 'large') {
  switch (tenantType) {
    case 'small':
      return {
        ttl: 3600000,
        maxSize: 1000
      };
    case 'medium':
      return {
        ttl: 1800000,
        maxSize: 5000
      };
    case 'large':
      return {
        ttl: 600000,
        maxSize: 20000
      };
    default:
      return {
        ttl: 3600000,
        maxSize: 10000
      };
  }
}

// 根据租户类型创建缓存
const tenantCache = createPolicyCache(getCacheConfig('large'));
```

### 6.5 结合使用多种缓存策略

```typescript
// 针对不同场景使用不同的缓存驱逐策略

// 写密集型场景使用 LRU 策略（驱逐最少使用的项）
const writeIntensiveCache = createPolicyCache({
  strategy: 'lru',
  maxEntries: 20000,
  defaultTTL: 60000
});

// 读密集型场景使用 LFU 策略（驱逐访问频率最低的项）
const readIntensiveCache = createPolicyCache({
  strategy: 'lfu',
  maxEntries: 5000,
  defaultTTL: 3600000
});

// FIFO 策略适用于顺序访问场景
const fifoCache = createPolicyCache({
  strategy: 'fifo',
  maxEntries: 1000,
  defaultTTL: 1800000
});
```

## 7. 常见问题解答

### 7.1 Q: 如何选择合适的缓存过期时间？

A: 缓存过期时间的选择取决于业务需求：
- 权限变化不频繁的场景：设置较长过期时间（1小时或更长）
- 权限变化频繁的场景：设置较短过期时间（5-30分钟）
- 关键权限（如管理员权限）：设置更短过期时间或实时失效

### 7.2 Q: 如何处理缓存一致性问题？

A: 可以采用以下策略：
1. **主动失效**：在权限变更时立即失效相关缓存
2. **定期刷新**：设置合理的过期时间，定期刷新缓存
3. **版本控制**：为权限数据添加版本号，缓存时同时存储版本号，检查时验证版本

### 7.3 Q: 缓存策略对性能有什么影响？

A: 不同缓存策略的性能特点：
- **write-through**：写入较慢，读取较快，数据一致性高
- **write-behind**：写入较快，读取较快，数据一致性较低
- **refresh-ahead**：读取最快，写入一般，能有效避免缓存雪崩

### 7.4 Q: 如何处理缓存雪崩问题？

A: 缓存雪崩是指大量缓存同时过期导致系统压力骤增的情况。可以采用以下策略：
1. 设置随机过期时间：为每个缓存条目添加随机偏移量
2. 使用 refresh-ahead 策略：在缓存过期前自动刷新
3. 分层缓存：使用多级缓存，不同层级设置不同过期时间
4. 限流降级：在缓存失效时进行限流，避免系统过载

### 7.5 Q: 如何监控缓存性能？

A: 可以通过以下方式监控缓存性能：
1. 使用 `getStats()` 方法获取缓存统计信息
2. 定期记录缓存命中率、大小、驱逐次数等指标
3. 结合监控系统（如 Prometheus、Grafana）可视化缓存性能
4. 设置告警阈值，当命中率过低或驱逐次数过高时告警

### 7.6 Q: 支持分布式缓存吗？

A: `@mtpc/policy-cache` 支持自定义缓存实现，可以通过实现 `CacheProvider` 接口来集成分布式缓存系统（如 Redis、Memcached 等）。

## 8. 性能优化建议

1. **合理设置缓存大小**：根据实际业务规模和内存资源设置合适的缓存大小
2. **使用合适的缓存类型**：
   - 小型应用使用内存缓存
   - 大型应用使用 LRU 缓存或分布式缓存
3. **优化权限加载逻辑**：权限加载器应尽量高效，避免复杂计算或慢查询
4. **批量操作**：对于批量权限检查，考虑批量加载和缓存权限
5. **预加载热点数据**：对于频繁访问的权限数据，可以在系统启动时预加载到缓存
6. **避免缓存大对象**：只缓存必要的权限信息，避免缓存过大的对象
7. **使用异步加载**：权限加载过程应异步进行，避免阻塞主线程
8. **考虑缓存分片**：对于超大规模应用，可以考虑按租户或业务模块进行缓存分片

## 9. 版本更新日志

### v1.0.0 (2024-01-01)

- 初始版本发布
- 支持内存缓存和 LRU 缓存
- 支持 write-through、write-behind、refresh-ahead 缓存策略
- 支持租户级缓存隔离
- 提供缓存统计和监控
- 支持自定义缓存实现

## 10. 贡献指南

欢迎为 `@mtpc/policy-cache` 包贡献代码或提出改进建议。请遵循以下准则：

1. 提交 Issues 描述问题或建议
2. 提交 Pull Requests 前确保所有测试通过
3. 遵循项目的代码风格和命名规范
4. 提供完整的测试用例
5. 更新相关文档

## 11. 许可证

`@mtpc/policy-cache` 包采用 MIT 许可证，详见 LICENSE 文件。

## 12. 联系方式

- 项目仓库：https://github.com/your-org/mtpc
- 问题反馈：https://github.com/your-org/mtpc/issues
- 文档地址：https://docs.mtpc.io

---

通过本指南，您应该已经掌握了 `@mtpc/policy-cache` 包的核心功能和使用方法。如果您有任何问题或建议，欢迎随时反馈。
