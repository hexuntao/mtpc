/**
 * MTPC Policy Cache - 架构级测试
 *
 * 测试目标：
 * 1. 缓存不改变权限语义
 * 2. 租户隔离
 * 3. 缓存异常时 Fail-safe
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyCache, createPolicyCache } from '../policy-cache.js';
import type { PermissionCacheEntry } from '../types.js';

// ========== Fixtures ==========

describe('TC-CACHE-001: 缓存不改变权限语义 [架构级测试 - Semantic Preservation]', () => {
  let cache: PolicyCache;
  let loadCount: number;

  beforeEach(() => {
    cache = createPolicyCache();
    loadCount = 0;
  });

  it('should return consistent results for cache hit and miss', async () => {
    // 设置加载器
    cache.setPermissionLoader(async (_tenantId, _subjectId) => {
      loadCount++;
      return new Set(['user:read', 'user:update']);
    });

    // 首次加载（miss）
    const result1 = await cache.getOrLoadPermissions('tenant-1', 'user-1');
    expect(loadCount).toBe(1);
    expect(result1.has('user:read')).toBe(true);
    expect(result1.has('user:update')).toBe(true);

    // 再次加载（hit）- 应该命中缓存
    const result2 = await cache.getOrLoadPermissions('tenant-1', 'user-1');
    expect(loadCount).toBe(1); // 不应该再次调用加载器
    expect(result2).toEqual(result1); // 结果应该一致
  });

  it('should return identical Set objects for same cache entry', async () => {
    cache.setPermissionLoader(async () => new Set(['order:read']));

    const result1 = await cache.getOrLoadPermissions('tenant-1', 'user-1');
    const result2 = await cache.getOrLoadPermissions('tenant-1', 'user-1');

    // 命中缓存时，返回的是同一个 Set 对象
    expect(result1).toBe(result2);
  });
});

describe('TC-CACHE-002: 缓存租户隔离 [架构级测试 - Tenant Isolation]', () => {
  let cache: PolicyCache;

  beforeEach(() => {
    cache = createPolicyCache();
  });

  it('should not share cache between different tenants', async () => {
    cache.setPermissionLoader(async (tenantId, _subjectId) => {
      if (tenantId === 'tenant-A') {
        return new Set(['user:read']);
      }
      return new Set();
    });

    // 加载租户 A 的权限
    const permissionsA = await cache.getOrLoadPermissions('tenant-A', 'user-1');
    expect(permissionsA.has('user:read')).toBe(true);

    // 加载租户 B 的权限 - 应该 miss，不应该返回 A 的权限
    const permissionsB = await cache.getOrLoadPermissions('tenant-B', 'user-1');
    expect(permissionsB.has('user:read')).toBe(false);
    expect(permissionsB.size).toBe(0);
  });

  it('should isolate cache keys by tenant and subject', async () => {
    let tenantACalls = 0;
    let tenantBCalls = 0;

    cache.setPermissionLoader(async (tenantId, subjectId) => {
      if (tenantId === 'tenant-A') {
        tenantACalls++;
        return new Set([`${subjectId}:permission-A`]);
      }
      tenantBCalls++;
      return new Set([`${subjectId}:permission-B`]);
    });

    // 并发请求
    await Promise.all([
      cache.getOrLoadPermissions('tenant-A', 'user-1'),
      cache.getOrLoadPermissions('tenant-B', 'user-1'),
      cache.getOrLoadPermissions('tenant-A', 'user-2'),
    ]);

    // 验证每个唯一的 (tenant, subject) 组合只加载一次
    expect(tenantACalls).toBe(2); // tenant-A 的 user-1 和 user-2
    expect(tenantBCalls).toBe(1); // tenant-B 的 user-1
  });
});

describe('TC-CACHE-003: 权限变更后精确失效', () => {
  let cache: PolicyCache;

  beforeEach(() => {
    cache = createPolicyCache();
  });

  it('should invalidate single subject cache', async () => {
    cache.setPermissionLoader(async () => new Set(['user:read']));

    // 加载并缓存
    const result1 = await cache.getOrLoadPermissions('tenant-1', 'user-1');
    expect(result1.has('user:read')).toBe(true);

    // 使失效
    await cache.invalidateSubject('tenant-1', 'user-1');

    // 重新加载 - 应该回源
    const result2 = await cache.getOrLoadPermissions('tenant-1', 'user-1');
    expect(result2.has('user:read')).toBe(true);

    // 验证是不同的 Set（表示重新加载了）
    expect(result1).not.toBe(result2);
  });

  it('should invalidate all subject caches for tenant', async () => {
    cache.setPermissionLoader(async () => new Set(['user:read']));

    // 缓存多个用户的权限
    await Promise.all([
      cache.getOrLoadPermissions('tenant-1', 'user-1'),
      cache.getOrLoadPermissions('tenant-1', 'user-2'),
      cache.getOrLoadPermissions('tenant-2', 'user-1'), // tenant-2 不应该失效
    ]);

    // 使租户 1 的所有缓存失效
    const invalidatedCount = await cache.invalidateTenant('tenant-1');
    expect(invalidatedCount).toBe(2);

    // tenant-1 的用户需要重新加载
    const result1 = await cache.getOrLoadPermissions('tenant-1', 'user-1');
    expect(result1.has('user:read')).toBe(true);

    // tenant-2 的用户应该仍然命中缓存
    const cachedPermissions = await cache.getPermissions('tenant-2', 'user-1');
    expect(cachedPermissions?.has('user:read')).toBe(true);
  });
});

describe('TC-CACHE-004: 缓存加载器异常处理 [架构级测试 - Fail-safe]', () => {
  let cache: PolicyCache;

  beforeEach(() => {
    cache = createPolicyCache();
  });

  it('should return empty set when loader throws error', async () => {
    cache.setPermissionLoader(async () => {
      throw new Error('Database connection failed');
    });

    const result = await cache.getOrLoadPermissions('tenant-1', 'user-1');

    // 异常时应该返回空 Set，不抛出异常
    expect(result.size).toBe(0);
  });

  it('should return empty set when loader is not set', async () => {
    const cacheWithoutLoader = createPolicyCache();

    const result = await cacheWithoutLoader.getOrLoadPermissions('tenant-1', 'user-1');

    expect(result.size).toBe(0);
  });

  it('should return null for getPermissions when cache does not exist', async () => {
    const result = await cache.getPermissions('tenant-1', 'user-1');

    expect(result).toBeNull();
  });

  it('should return null for expired cache entries', async () => {
    // 设置一个立即过期的缓存
    await cache.setPermissions('tenant-1', 'user-1', new Set(['user:read']), undefined, 0);

    // 等待过期
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = await cache.getPermissions('tenant-1', 'user-1');

    expect(result).toBeNull();
  });
});

describe('TC-CACHE-005: 缓存统计与状态', () => {
  it('should track cache statistics', async () => {
    const cache = createPolicyCache();

    cache.setPermissionLoader(async () => new Set(['user:read']));

    // 加载数据
    await cache.getOrLoadPermissions('tenant-1', 'user-1');
    await cache.getOrLoadPermissions('tenant-1', 'user-1'); // 命中缓存

    const stats = cache.getStats();

    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });

  it('should clear all caches', async () => {
    const cache = createPolicyCache();

    cache.setPermissionLoader(async () => new Set(['user:read']));

    await cache.getOrLoadPermissions('tenant-1', 'user-1');
    await cache.getOrLoadPermissions('tenant-2', 'user-1');

    await cache.clear();

    const stats = cache.getStats();
    expect(stats.size).toBe(0);
  });
});

// ============================================================================
// 组合测试：高风险场景
// ============================================================================

describe('组合测试：高风险场景演练', () => {
  it('TC-COMBO-001: 权限变更后缓存精确失效', async () => {
    const cache = createPolicyCache();
    let currentPermissions = new Set(['user:read']);

    cache.setPermissionLoader(async (_tenantId, _subjectId) => {
      return currentPermissions;
    });

    // 初始状态：用户有 user:read
    const result1 = await cache.getOrLoadPermissions('tenant-1', 'user-1');
    expect(result1.has('user:read')).toBe(true);
    expect(result1.has('user:delete')).toBe(false);

    // 权限变更：撤销 user:read，添加 user:delete
    currentPermissions = new Set(['user:delete']);

    // 立即查询 - 应该仍然返回缓存（因为还没过期）
    const result2 = await cache.getOrLoadPermissions('tenant-1', 'user-1');
    expect(result2.has('user:read')).toBe(true); // 旧权限
    expect(result2.has('user:delete')).toBe(false);

    // 使缓存失效
    await cache.invalidateSubject('tenant-1', 'user-1');

    // 重新查询 - 应该返回新权限
    const result3 = await cache.getOrLoadPermissions('tenant-1', 'user-1');
    expect(result3.has('user:read')).toBe(false);
    expect(result3.has('user:delete')).toBe(true);
  });
});
