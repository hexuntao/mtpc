import type { PluginContext, PluginDefinition } from '@mtpc/core';
import { createVersioningHooks } from './hooks.js';
import type { VersioningConfig, VersioningPluginState } from './types.js';

/**
 * 创建版本控制插件 - 提供资源钩子，实际的版本校验由 Adapter 执行
 *
 * 版本控制插件用于实现乐观锁机制，防止并发更新冲突
 * 核心功能：
 * - 为资源配置版本控制
 * - 提供 beforeUpdate 和 afterUpdate 钩子
 * - 由上层 Adapter 利用版本字段完成实际的冲突检测
 */
export function createVersioningPlugin(): PluginDefinition & {
  state: VersioningPluginState & {
    configureResource: (config: VersioningConfig, context: PluginContext) => void;
  };
} {
  // 存储所有资源的版本控制配置
  const configs = new Map<string, VersioningConfig>();

  let ctxRef: PluginContext | null = null;

  // 插件状态，包含配置存储和配置方法
  const state: VersioningPluginState & {
    configureResource: (config: VersioningConfig, context: PluginContext) => void;
  } = {
    configs,

    /**
     * 为特定资源配置版本控制
     *
     * @param config 版本控制配置
     * @param context 插件上下文，用于扩展资源钩子
     */
    configureResource(config: VersioningConfig, context: PluginContext) {
      // 存储配置
      configs.set(config.resourceName, config);
      // 为资源创建并注册版本控制钩子
      context.extendResourceHooks(config.resourceName, createVersioningHooks(config));
    },
  };

  // 返回插件定义
  return {
    name: '@mtpc/versioning',
    version: '0.1.0',
    description: 'MTPC 的版本控制钩子扩展',

    state,

    /**
     * 插件安装方法
     * 目前不做全局自动接管，由使用方手动配置每个资源
     *
     * @param context 插件上下文
     */
    install(context: PluginContext): void {
      // 使用方手动为需要版本控制的资源调用 configureResource

      ctxRef = context;
      // 已有配置需要在 install 时应用一次
      for (const config of configs.values()) {
        context.extendResourceHooks(config.resourceName, createVersioningHooks(config));
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
    },
  };
}
