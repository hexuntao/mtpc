/**
 * 钩子模块导出
 * 该模块统一导出所有钩子相关的类和函数
 *
 * 包含内容：
 * - HookExecutor: 资源钩子执行器
 * - createHookExecutor: 创建钩子执行器的工厂函数
 * - GlobalHooksManager: 全局钩子管理器
 * - createGlobalHooksManager: 创建全局钩子管理器的工厂函数
 *
 * @example
 * ```typescript
 * import {
 *   HookExecutor,
 *   GlobalHooksManager,
 *   createHookExecutor,
 *   createGlobalHooksManager
 * } from '@mtpc/core/hooks';
 * ```
 */

// 导出资源钩子执行器相关
export * from './executor.js';

// 导出全局钩子管理器相关
export * from './global.js';
