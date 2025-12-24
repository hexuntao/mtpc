import type { PluginContext, PluginDefinition } from '@mtpc/core';
import { setHierarchyResolver } from './filter/generator.js';
import { createScopeResolver, type ScopeResolver } from './resolver/scope-resolver.js';
import {
  createScopeRegistry,
  InMemoryDataScopeStore,
  type ScopeRegistry,
} from './scope/registry.js';
import type { DataScopeOptions } from './types.js';

/**
 * 数据范围插件状态
 */
export interface DataScopePluginState {
  registry: ScopeRegistry;
  resolver: ScopeResolver;
}

/**
 * 创建数据范围插件
 *
 * **注意**：由于 PluginContext 的限制，插件无法在 install 阶段为所有资源注册 filterQuery 钩子。
 * 推荐使用以下方式集成：
 *
 * ```typescript
 * import { createMTPC } from '@mtpc/core';
 * import { createDataScope } from '@mtpc/data-scope';
 *
 * const mtpc = createMTPC();
 * const dataScope = createDataScope();
 *
 * // 注册资源后，调用 integrateWith 方法
 * mtpc.registry.registerResource(userResource);
 * mtpc.registry.registerResource(orderResource);
 *
 * // 集成 data-scope 到 MTPC
 * dataScope.integrateWith(mtpc);
 * ```
 *
 * 如果需要通过插件系统使用，请确保在所有资源注册完成后再初始化插件。
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
  };

  return {
    name: '@mtpc/data-scope',
    version: '0.1.0',
    description: 'Data scope / row-level security extension for MTPC',

    state,

    install(_context: PluginContext): void {
      // 注意：由于 PluginContext 没有提供 listResources() 方法，
      // 无法在此处为所有资源注册 filterQuery 钩子。
      // 请使用 DataScope.integrateWith(mtpc) 方法进行集成。
    },

    onInit(_context: PluginContext): void {
      console.log('Data scope plugin initialized');
    },

    onDestroy(): void {
      registry.clearCache();
    },
  };
}
