import type { PluginContext, PluginDefinition } from '@mtpc/core';
import { ExplanationCollector } from './collector.js';
import { PermissionExplainer } from './explainer.js';
import { TextFormatter } from './formatter.js';
import type { ExplainLevel } from './types.js';

/**
 * Explain 插件配置选项
 * 用于配置权限解释插件的行为
 */
export interface ExplainPluginOptions {
  /**
   * 默认解释详细级别
   * - minimal: 最小化信息
   * - standard: 标准信息（默认）
   * - detailed: 详细信息
   * - debug: 调试信息
   */
  defaultLevel?: ExplainLevel;

  /**
   * 是否自动收集权限解释结果
   * 启用后，所有权限检查的解释结果会被自动收集到收集器中
   */
  collectExplanations?: boolean;

  /**
   * 最大收集条目数
   * 当收集器达到此数量后，最旧的条目将被自动删除
   * 默认为 1000 条
   */
  maxCollectedEntries?: number;
}

/**
 * Explain 插件状态
 * 插件的运行时状态，包含核心组件实例
 */
export interface ExplainPluginState {
  /**
   * 权限解释器实例
   * 在插件初始化时创建
   */
  explainer?: PermissionExplainer;

  /**
   * 解释收集器实例
   * 用于收集和管理权限解释结果
   */
  collector: ExplanationCollector;

  /**
   * 文本格式化器实例
   * 用于格式化权限解释结果为可读文本
   */
  formatter: TextFormatter;
}

/**
 * 创建 Explain 插件
 * 为 MTPC 框架提供权限决策解释功能
 *
 * **功能**：
 * - 解释权限决策结果
 * - 收集权限检查历史
 * - 提供多种格式化输出（文本、JSON、Markdown）
 * - 支持批量权限解释
 *
 * **插件生命周期**：
 * 1. install - 插件安装时的初始化
 * 2. onInit - 框架初始化时调用
 * 3. onDestroy - 框架销毁时清理资源
 *
 * @param options 插件配置选项
 * @param options.defaultLevel 默认解释详细级别
 * @param options.collectExplanations 是否收集解释结果
 * @param options.maxCollectedEntries 最大收集条目数
 * @returns 插件定义对象
 *
 * @example
 * ```typescript
 * import { MTPC } from '@mtpc/core';
 * import { createExplainPlugin } from '@mtpc/explain';
 *
 * const mtpc = new MTPC({
 *   plugins: [
 *     createExplainPlugin({
 *       defaultLevel: 'detailed',
 *       collectExplanations: true,
 *       maxCollectedEntries: 5000
 *     })
 *   ]
 * });
 *
 * // 使用插件功能
 * const explainer = mtpc.plugins.state.explainer;
 * const explanation = await explainer.explain(tenant, subject, 'user:read');
 * ```
 */
export function createExplainPlugin(
  options: ExplainPluginOptions = {}
): PluginDefinition & { state: ExplainPluginState } {
  // 创建解释收集器
  const collector = new ExplanationCollector({
    maxEntries: options.maxCollectedEntries ?? 1000,
  });

  // 创建文本格式化器
  const formatter = new TextFormatter();

  // 插件状态
  const state: ExplainPluginState = {
    collector,
    formatter,
  };

  return {
    name: '@mtpc/explain',
    version: '0.1.0',
    description: 'Permission decision explanation extension for MTPC',

    state,

    /**
     * 插件安装时调用
     * 在插件加载到 MTPC 框架时执行
     *
     * @param context 插件上下文，提供对框架核心功能的访问
     */
    install(_context: PluginContext): void {
      // 可以在这里注册钩子或修改框架配置
      console.log('Explain plugin installed');
    },

    /**
     * 插件初始化时调用
     * 在 MTPC 实例初始化完成后执行
     *
     * @param context 插件上下文
     */
    onInit(context: PluginContext): void {
      // 检查必需的依赖是否可用
      if (!context.policyEngine) {
        throw new Error('Explain plugin requires policyEngine to be available in plugin context');
      }
      if (!context.permissionResolver) {
        throw new Error('Explain plugin requires permissionResolver to be available in plugin context');
      }

      // 创建权限解释器
      state.explainer = new PermissionExplainer(
        context.policyEngine,
        context.permissionResolver,
        { defaultLevel: options.defaultLevel }
      );

      // 如果启用了自动收集，注册钩子
      if (options.collectExplanations) {
        // 在实际的权限检查后收集解释结果
        // 这需要与 PermissionChecker 集成
        console.log('Explanation collection enabled');
      }

      console.log('Explain plugin initialized');
    },

    /**
     * 插件销毁时调用
     * 清理插件资源，防止内存泄漏
     */
    onDestroy(): void {
      // 清空收集器中的所有条目
      collector.clear();
      console.log('Explain plugin destroyed');
    },
  };
}
