import type { PluginContext, PluginDefinition } from '@mtpc/core';
import { createSoftDeleteHooks } from './hooks.js';
import type { SoftDeleteConfig, SoftDeletePluginState } from './types.js';

/**
 * 创建软删除插件
 *
 * 说明：
 * - 插件本身不扫描所有资源，也不强制使用某个固定字段名。
 * - 消费方应在注册资源后，显式调用 state.configureResource(...) 为特定资源开启软删除。
 * - 这种设计方式更安全可控，允许不同资源使用不同的软删除配置。
 *
 * @returns 软删除插件定义，包含插件状态和配置方法
 */
export function createSoftDeletePlugin(): PluginDefinition & {
  state: SoftDeletePluginState & {
    configureResource: (config: SoftDeleteConfig, context: PluginContext) => void;
  };
} {
  // 存储所有资源的软删除配置
  const configs = new Map<string, SoftDeleteConfig>();

  let ctxRef: PluginContext | null = null;

  // 插件状态，包含配置存储和配置方法
  const state: SoftDeletePluginState & {
    configureResource: (config: SoftDeleteConfig, context: PluginContext) => void;
  } = {
    configs,

    /**
     * 为特定资源配置软删除
     *
     * @param config 软删除配置
     * @param context 插件上下文，用于扩展资源钩子
     */
    configureResource(config: SoftDeleteConfig, context: PluginContext) {
      // 存储配置
      configs.set(config.resourceName, config);
      // 为资源创建并注册软删除钩子
      context.extendResourceHooks(config.resourceName, createSoftDeleteHooks(config));
    },
  };

  // 返回插件定义
  return {
    name: '@mtpc/soft-delete',
    version: '0.1.0',
    description: 'MTPC 的软删除钩子扩展',

    state,

    /**
     * 插件安装方法
     * 目前不做全局自动接管，由使用方手动配置每个资源更安全可控
     *
     * @param context 插件上下文
     */
    install(context: PluginContext): void {
      // 暂不做全局自动接管，由使用方手动配置每个资源更安全可控
      ctxRef = context;
      // 已有配置需要在 install 时应用一次
      for (const config of configs.values()) {
        context.extendResourceHooks(config.resourceName, createSoftDeleteHooks(config));
      }
    },

    /**
     * 插件初始化方法
     */
    onInit(): void {
      // 无需初始化操作
    },

    /**
     * 插件销毁方法
     * 清理所有配置，防止内存泄漏
     */
    onDestroy(): void {
      configs.clear();
      ctxRef = null;
    },
  };
}
