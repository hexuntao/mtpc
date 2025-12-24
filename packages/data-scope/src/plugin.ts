import type { FilterCondition, MTPCContext, PluginContext, PluginDefinition } from '@mtpc/core';
import { setHierarchyResolver } from './filter/generator.js';
import { createScopeResolver, type ScopeResolver } from './resolver/scope-resolver.js';
import {
  createScopeRegistry,
  InMemoryDataScopeStore,
  type ScopeRegistry,
} from './scope/registry.js';
import type { DataScopeOptions, ScopeResolutionResult } from './types.js';

/**
 * 数据范围插件状态
 */
export interface DataScopePluginState {
  registry: ScopeRegistry;
  resolver: ScopeResolver;
  unsubscribeCallbacks: Array<() => void>;
}

/**
 * 创建数据范围插件
 *
 * 支持声明式配置：通过资源的 metadata.dataScope 配置是否启用数据范围控制
 *
 * @example
 * ```typescript
 * import { createMTPC, defineResource } from '@mtpc/core';
 * import { createDataScopePlugin } from '@mtpc/data-scope';
 *
 * const mtpc = createMTPC();
 *
 * // 注册资源，声明式配置数据范围
 * mtpc.registry.registerResource(
 *   defineResource({
 *     name: 'user',
 *     schema: z.object({ id: z.string(), name: z.string() }),
 *     metadata: {
 *       dataScope: {
 *         enabled: true,
 *         defaultScope: 'tenant'
 *       }
 *     }
 *   })
 * );
 *
 * // 注册插件 - 会自动为所有启用的资源添加 filterQuery 钩子
 * mtpc.plugins.use(createDataScopePlugin({
 *   adminRoles: ['admin'],
 *   defaultScope: 'tenant'
 * }));
 *
 * await mtpc.init();
 * ```
 */
export function createDataScopePlugin(
  options: DataScopeOptions = {}
): PluginDefinition & { state: DataScopePluginState } {
  const store = options.store ?? new InMemoryDataScopeStore();
  const registry = createScopeRegistry(store, {
    cacheTTL: options.cacheTTL,
  });

  // 设置层级解析器
  if (options.hierarchyResolver) {
    setHierarchyResolver(options.hierarchyResolver);
  }

  const resolver = createScopeResolver(registry, {
    defaultScopeId: options.defaultScope ? `scope:${options.defaultScope}` : undefined,
    adminRoles: options.adminRoles ?? ['admin'],
    checkWildcardPermission: options.checkWildcardPermission ?? true,
  });

  const state: DataScopePluginState = {
    registry,
    resolver,
    unsubscribeCallbacks: [],
  };

  /**
   * 创建资源的 filterQuery 钩子函数
   */
  const createFilterQueryHook = (resourceName: string) => {
    return async (ctx: MTPCContext, baseFilters: FilterCondition[]): Promise<FilterCondition[]> => {
      try {
        const result: ScopeResolutionResult = await resolver.resolve({
          mtpcContext: ctx,
          resourceName,
          action: 'read',
          existingFilters: baseFilters,
        });
        return result.combinedFilters;
      } catch (error) {
        console.error(`[@mtpc/data-scope] 解析资源 ${resourceName} 的范围失败:`, error);
        // 出错时返回原始过滤器，不影响数据访问
        return baseFilters;
      }
    };
  };

  /**
   * 为单个资源添加 filterQuery 钩子
   */
  const addFilterToResource = (context: PluginContext, resourceName: string): void => {
    try {
      const resource = context.getResource(resourceName);
      if (!resource) {
        return;
      }

      // 检查资源的元数据配置
      const dataScopeConfig = resource.metadata?.dataScope;

      // 如果明确禁用了数据范围控制，跳过
      if (dataScopeConfig?.enabled === false) {
        return;
      }

      // 添加 filterQuery 钩子
      context.extendResourceHooks(resourceName, {
        filterQuery: [createFilterQueryHook(resourceName)],
      });
    } catch (error) {
      console.error(`[@mtpc/data-scope] 为资源 ${resourceName} 添加钩子失败:`, error);
    }
  };

  return {
    name: '@mtpc/data-scope',
    version: '0.1.0',
    description: 'Data scope / row-level security extension for MTPC',

    state,

    install(context: PluginContext): void {
      // 1. 为当前已注册的资源添加钩子
      const resources = context.listResources();
      for (const resource of resources) {
        addFilterToResource(context, resource.name);
      }

      // 2. 订阅后续注册的资源
      const unsubscribe = context.onResourceRegistered(resource => {
        addFilterToResource(context, resource.name);
      });
      state.unsubscribeCallbacks.push(unsubscribe);
    },

    onInit(context: PluginContext): void {
      const resources = context.listResources();
      const enabledCount = resources.filter(r => r.metadata?.dataScope?.enabled !== false).length;

      console.log(`[@mtpc/data-scope] 插件已初始化，已为 ${enabledCount} 个资源启用数据范围控制`);
    },

    onDestroy(): void {
      // 取消所有订阅
      for (const unsubscribe of state.unsubscribeCallbacks) {
        unsubscribe();
      }
      state.unsubscribeCallbacks = [];

      // 清除缓存
      registry.clearCache();

      console.log('[@mtpc/data-scope] 插件已销毁');
    },
  };
}
