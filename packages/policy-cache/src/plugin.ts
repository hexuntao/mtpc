import type { PluginContext, PluginDefinition } from '@mtpc/core';
import { CacheManager } from './cache/cache-manager.js';
import type { PolicyCacheOptions } from './types.js';

/**
 * Create policy cache plugin
 */
export function createPolicyCachePlugin(options: PolicyCacheOptions = {}): PluginDefinition {
  const cacheManager = new CacheManager(options);

  return {
    name: '@mtpc/policy-cache',
    version: '0.1.0',
    description: 'Policy caching extension for MTPC',

    install(context: PluginContext): void {
      // Register hooks for cache invalidation
      context.registerGlobalHooks({
        afterAny: [
          async (mtpcContext, operation, resourceName, result) => {
            // Invalidate cache on write operations
            if (['create', 'update', 'delete'].includes(operation)) {
              await cacheManager.invalidateTenant(mtpcContext.tenant.id);
            }
          },
        ],
      });
    },

    onDestroy(): void {
      cacheManager.clear();
    },
  };
}
