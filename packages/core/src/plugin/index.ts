/**
 * 插件模块导出
 * 该模块统一导出插件系统相关的所有类和函数
 *
 * 包含内容：
 * - createPluginContext: 创建插件上下文
 * - DefaultPluginManager: 默认插件管理器实现
 * - createPluginManager: 创建插件管理器
 *
 * 插件系统提供以下功能：
 * - 插件注册和管理
 * - 插件依赖解析和安装
 * - 插件生命周期管理（注册、安装、初始化、销毁）
 * - 资源扩展和钩子扩展
 *
 * @example
 * ```typescript
 * import {
 *   createPluginContext,
 *   createPluginManager
 * } from '@mtpc/core/plugin';
 *
 * const context = createPluginContext(registry, globalHooks);
 * const manager = createPluginManager(context);
 * ```
 */

// 导出插件上下文相关
export * from './context.js';

// 导出插件管理器相关
export * from './manager.js';
