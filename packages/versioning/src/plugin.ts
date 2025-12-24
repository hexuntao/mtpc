import type { PluginContext, PluginDefinition } from '@mtpc/core';
import { createVersioningHooks } from './hooks.js';
import type { VersioningConfig, VersioningPluginState } from './types.js';

/**
 * Versioning plugin - 提供 Resource Hooks，实际的版本校验由 Adapter 执行。
 */
export function createVersioningPlugin(): PluginDefinition & {
  state: VersioningPluginState & {
    configureResource: (config: VersioningConfig, context: PluginContext) => void;
  };
} {
  const configs = new Map<string, VersioningConfig>();

  const state: VersioningPluginState & {
    configureResource: (config: VersioningConfig, context: PluginContext) => void;
  } = {
    configs,
    configureResource(config: VersioningConfig, context: PluginContext) {
      configs.set(config.resourceName, config);
      context.extendResourceHooks(config.resourceName, createVersioningHooks(config));
    },
  };

  return {
    name: '@mtpc/versioning',
    version: '0.1.0',
    description: 'Versioning hooks extension for MTPC',

    state,

    install(_context: PluginContext): void {
      // 使用方手动为需要版本控制的资源调用 configureResource
    },

    onInit(): void {
      // no-op
    },

    onDestroy(): void {
      configs.clear();
    },
  };
}
