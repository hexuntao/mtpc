// @mtpc/explain - MTPC 权限决策解释扩展
// 提供权限决策的详细解释功能，帮助开发者理解和调试权限问题

export * from './collector.js'; // 解释收集器，用于收集和管理权限解释结果
export * from './explainer.js'; // 权限解释器，核心的权限决策解释逻辑
export * from './formatter.js'; // 解释格式化器，用于格式化权限解释结果
export * from './plugin.js'; // MTPC 框架集成插件
export * from './types.js'; // 类型定义，定义了所有相关的类型和接口

/**
 * 从 MTPC 实例创建权限解释器
 * 便捷函数，用于快速创建解释器实例
 *
 * @param mtpc MTPC 实例
 * @param options 解释器选项
 * @returns 权限解释器实例
 *
 * @example
 * ```typescript
 * import { createMTPC } from '@mtpc/core';
 * import { createExplainerFromMTPC } from '@mtpc/explain';
 *
 * const mtpc = createMTPC({
 *   defaultPermissionResolver: async (tenantId, subjectId) => {
 *     return new Set(['user:read', 'user:write']);
 *   }
 * });
 *
 * await mtpc.init();
 *
 * // 使用便捷函数创建解释器
 * const explainer = createExplainerFromMTPC(mtpc, {
 *   defaultLevel: 'detailed'
 * });
 *
 * const explanation = await explainer.explain(
 *   { id: 'tenant-1' },
 *   { id: 'user-1', type: 'user' },
 *   'user:read'
 * );
 * ```
 */
import type { MTPC } from '@mtpc/core';
import { PermissionExplainer } from './explainer.js';
import type { ExplainLevel } from './types.js';

export function createExplainerFromMTPC(
  mtpc: MTPC,
  options?: { defaultLevel?: ExplainLevel }
): PermissionExplainer {
  const resolver = mtpc.getPermissionResolver();
  if (!resolver) {
    throw new Error(
      'MTPC instance does not have a permissionResolver. ' +
        'Please set one using setPermissionResolver() or provide it in the constructor.'
    );
  }

  return new PermissionExplainer(mtpc.policyEngine, resolver, {
    defaultLevel: options?.defaultLevel,
  });
}
