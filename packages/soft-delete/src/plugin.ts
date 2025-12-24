import type { PluginContext, PluginDefinition } from '@mtpc/core';
import { createSoftDeleteHooks } from './hooks.js';
import type { SoftDeleteConfig, SoftDeletePluginState } from './types.js';

/**
 * Create soft delete plugin.
 *
 * 说明：
 * - 插件本身不扫描所有资源，也不强制某个字段名。
 * - 消费方应在注册资源后，显式调用 state.configureResource(...) 为特定资源开启软删除。
 */
export function createSoftDeletePlugin(): PluginDefinition & {
  state: SoftDeletePluginState & {
    configureResource: (config: SoftDeleteConfig, context: PluginContext) => void;
  };
} {
  const configs = new Map<string, SoftDeleteConfig>();

  const state: SoftDeletePluginState & {
    configureResource: (config: SoftDeleteConfig, context: PluginContext) => void;
  } = {
    configs,
    configureResource(config: SoftDeleteConfig, context: PluginContext) {
      configs.set(config.resourceName, config);
      context.extendResourceHooks(config.resourceName, createSoftDeleteHooks(config));
    },
  };

  return {
    name: '@mtpc/soft-delete',
    version: '0.1.0',
    description: 'Soft delete hooks extension for MTPC',

    state,

    install(_context: PluginContext): void {
      // 暂不做全局自动接管，由使用方手动配置每个资源更安全可控。
    },

    onInit(): void {
      // no-op
    },

    onDestroy(): void {
      configs.clear();
    },
  };
}
