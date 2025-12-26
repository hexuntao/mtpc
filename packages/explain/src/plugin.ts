import type { MTPCContext, PluginContext, PluginDefinition } from '@mtpc/core';
import { ExplanationCollector } from './collector.js';
import { TextFormatter } from './formatter.js';
import type { ExplainLevel, PermissionExplanation } from './types.js';

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
   * 解释收集器实例
   * 用于收集和管理权限解释结果
   */
  collector: ExplanationCollector;

  /**
   * 文本格式化器实例
   * 用于格式化权限解释结果为可读文本
   */
  formatter: TextFormatter;

  /**
   * 默认解释级别
   */
  defaultLevel: ExplainLevel;
}

/**
 * 创建 Explain 插件
 * 为 MTPC 框架提供权限决策解释功能
 *
 * **功能**：
 * - 收集权限检查历史
 * - 提供多种格式化输出（文本、JSON、Markdown）
 * - 支持批量权限解释
 *
 * **插件生命周期**：
 * 1. install - 插件安装时的初始化
 * 2. onDestroy - 框架销毁时清理资源
 *
 * **重要说明**：
 * - Explain 插件不直接访问 policyEngine 或 permissionResolver
 * - 用户需要通过 MTPC 实例访问这些组件来创建解释器
 * - 插件主要提供收集器和格式化器功能
 *
 * @param options 插件配置选项
 * @returns 插件定义对象
 *
 * @example
 * ```typescript
 * import { createMTPC } from '@mtpc/core';
 * import { createExplainPlugin, createExplainerFromMTPC } from '@mtpc/explain';
 *
 * const mtpc = createMTPC({
 *   defaultPermissionResolver: async (tenantId, subjectId) => {
 *     // 自定义权限解析器
 *     return new Set(['user:read', 'user:write']);
 *   }
 * });
 *
 * // 注册 Explain 插件
 * mtpc.use(createExplainPlugin({
 *   defaultLevel: 'detailed',
 *   collectExplanations: true,
 *   maxCollectedEntries: 5000
 * }));
 *
 * // 初始化 MTPC
 * await mtpc.init();
 *
 * // 使用解释器（通过 MTPC 实例访问核心组件）
 * const explainer = createExplainerFromMTPC(mtpc, {
 *   defaultLevel: 'detailed'
 * });
 *
 * const explanation = await explainer.explain(
 *   { id: 'tenant-1' },
 *   { id: 'user-1', type: 'user' },
 *   'user:read'
 * );
 *
 * console.log(explanation);
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
    defaultLevel: options.defaultLevel ?? 'standard',
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
    install(context: PluginContext): void {
      console.log('[Explain Plugin] Installing...');

      // 如果启用了自动收集，注册全局钩子
      if (options.collectExplanations) {
        // 创建 afterAny 钩子函数
        const afterAnyHook: (
          mtpcContext: MTPCContext,
          operation: string,
          resourceName: string,
          result: unknown
        ) => void = (mtpcContext, operation, resourceName, result) => {
          // 收集权限检查结果到收集器
          // 注意：这里收集的是权限检查结果，而不是解释结果
          // 解释结果需要用户通过 explainer 显式生成
          const explanation: PermissionExplanation = {
            permission: `${resourceName}:${operation}`,
            resource: resourceName,
            action: operation,
            decision: (result as { allowed?: boolean })?.allowed ? 'allow' : 'deny',
            reason: (result as { reason?: string })?.reason ?? 'Unknown',
            evaluationPath: ['permission-check'],
            timestamp: new Date(),
            duration: (result as { evaluationTime?: number })?.evaluationTime ?? 0,
            context: {
              tenant: {
                id: mtpcContext.tenant.id,
                status: mtpcContext.tenant.status,
              },
              subject: {
                id: mtpcContext.subject.id,
                type: mtpcContext.subject.type,
              },
            },
          };

          collector.collect(explanation, {
            requestId: mtpcContext.request.requestId,
          });
        };

        context.registerGlobalHooks({
          afterAny: [afterAnyHook],
        });

        console.log('[Explain Plugin] Auto-collection enabled via global hooks');
      }

      console.log('[Explain Plugin] Installed successfully');
    },

    /**
     * 插件销毁时调用
     * 清理插件资源，防止内存泄漏
     */
    onDestroy(): void {
      // 清空收集器中的所有条目
      collector.clear();
      console.log('[Explain Plugin] Destroyed');
    },
  };
}
