import type { PluginContext, PluginDefinition } from '@mtpc/core';
import { CacheManager } from './cache/cache-manager.js';
import type { PolicyCacheOptions } from './types.js';

/**
 * 创建 MTPC 策略缓存插件
 * 该插件用于在 MTPC 框架中集成策略缓存功能，自动处理缓存失效
 */
export function createPolicyCachePlugin(options: PolicyCacheOptions = {}): PluginDefinition {
  // 创建缓存管理器实例
  const cacheManager = new CacheManager(options);

  return {
    name: '@mtpc/policy-cache',
    version: '0.1.0',
    description: 'MTPC 的策略缓存扩展',

    /**
     * 插件安装方法
     * @param context 插件上下文
     */
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
    },

    /**
     * 插件销毁方法
     * 在插件被销毁时清理所有缓存
     */
    onDestroy(): void {
      cacheManager.clear();
    },
  };
}
