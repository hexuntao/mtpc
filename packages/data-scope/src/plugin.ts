import type { FilterCondition, PluginContext, PluginDefinition } from '@mtpc/core';
import { createScopeResolver, type ScopeResolver } from './resolver/scope-resolver.js';
import {
  createScopeRegistry,
  InMemoryDataScopeStore,
  type ScopeRegistry,
} from './scope/registry.js';
import type { DataScopeOptions } from './types.js';

/**
 * Data scope plugin state
 */
export interface DataScopePluginState {
  registry: ScopeRegistry;
  resolver: ScopeResolver;
}

/**
 * Create data scope plugin
 */
export function createDataScopePlugin(
  options: DataScopeOptions = {}
): PluginDefinition & { state: DataScopePluginState } {
  const store = options.store ?? new InMemoryDataScopeStore();
  const registry = createScopeRegistry(store, {
    cacheTTL: options.cacheTTL,
  });
  const resolver = createScopeResolver(registry, {
    defaultScopeId: options.defaultScope ? `scope:${options.defaultScope}` : undefined,
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

    install(context: PluginContext): void {
      // Register filterQuery hook on all resources
      const resources = context.getResource
        ? // Would need to iterate resources, but we don't have access here
          // This is handled in the main DataScope class instead
          []
        : [];
    },

    onInit(context: PluginContext): void {
      console.log('Data scope plugin initialized');
    },

    onDestroy(): void {
      registry.clearCache();
    },
  };
}
