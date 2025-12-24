import { Hono } from 'hono';
import type { CacheStats } from '@mtpc/policy-cache';

// 从 MTPC 插件中获取缓存管理器
// 注意：这里需要从插件状态中获取缓存管理器
// 由于插件状态访问方式可能因实现而异，这里提供一个简化的实现

export const cacheRoutes = new Hono();

// 内存中的缓存统计信息（用于演示）
// 实际应用中应该从插件状态中获取
let cacheStats: CacheStats = {
  hits: 0,
  misses: 0,
  size: 0,
  evictions: 0,
  hitRate: 0,
};

// 模拟缓存操作（用于演示）
// 实际应用中应该通过 MTPC 插件状态获取真实数据
function updateHitRate() {
  const total = cacheStats.hits + cacheStats.misses;
  cacheStats.hitRate = total > 0 ? cacheStats.hits / total : 0;
}

/**
 * 获取缓存统计信息
 *
 * GET /api/cache/stats
 */
cacheRoutes.get('/stats', (c) => {
  // 在实际应用中，这里应该从 MTPC 插件状态中获取真实的缓存统计
  // 例如：
  // const cachePlugin = mtpc.plugins.get('@mtpc/policy-cache');
  // const stats = await cachePlugin.getStats();

  return c.json({
    success: true,
    data: {
      ...cacheStats,
      // 计算命中率百分比
      hitRatePercent: (cacheStats.hitRate * 100).toFixed(2) + '%',
      // 缓存配置信息
      config: {
        strategy: 'lru',
        maxEntries: 1000,
        ttl: 5 * 60 * 1000, // 5 分钟
        keyPrefix: 'mtpc:policy',
      },
    },
  });
});

/**
 * 清空缓存
 *
 * POST /api/cache/clear
 */
cacheRoutes.post('/clear', async (c) => {
  // 在实际应用中，这里应该调用 MTPC 插件的清除方法
  // 例如：
  // const cachePlugin = mtpc.plugins.get('@mtpc/policy-cache');
  // await cachePlugin.clear();

  // 重置统计信息（用于演示）
  cacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    evictions: 0,
    hitRate: 0,
  };

  return c.json({
    success: true,
    message: '缓存已清空',
    data: { cleared: true },
  });
});

/**
 * 按租户使缓存失效
 *
 * POST /api/cache/invalidate
 */
cacheRoutes.post('/invalidate', async (c) => {
  const { tenantId } = await c.req.json();

  if (!tenantId) {
    return c.json(
      {
        success: false,
        error: 'INVALID_REQUEST',
        message: '缺少 tenantId 参数',
      },
      400
    );
  }

  // 在实际应用中，这里应该调用 MTPC 插件的失效方法
  // 例如：
  // const cachePlugin = mtpc.plugins.get('@mtpc/policy-cache');
  // await cachePlugin.invalidateTenant(tenantId);

  return c.json({
    success: true,
    message: `租户 ${tenantId} 的缓存已失效`,
    data: { tenantId, invalidated: true },
  });
});

/**
 * 重置缓存统计
 *
 * POST /api/cache/stats/reset
 */
cacheRoutes.post('/stats/reset', (c) => {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.evictions = 0;
  updateHitRate();

  return c.json({
    success: true,
    message: '缓存统计已重置',
    data: cacheStats,
  });
});

// 导出更新统计的函数（用于其他模块记录缓存命中/未命中）
export function recordCacheHit() {
  cacheStats.hits++;
  updateHitRate();
}

export function recordCacheMiss() {
  cacheStats.misses++;
  updateHitRate();
}

export function recordCacheEviction() {
  cacheStats.evictions++;
}

export function updateCacheSize(size: number) {
  cacheStats.size = size;
}
