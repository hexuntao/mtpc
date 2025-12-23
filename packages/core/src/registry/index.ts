/**
 * 注册表模块导出
 * 该模块统一导出所有注册表相关的类和工厂函数
 *
 * 包含内容：
 * - PermissionRegistry: 权限注册表
 * - PolicyRegistry: 策略注册表
 * - ResourceRegistry: 资源注册表
 * - UnifiedRegistry: 统一注册表
 *
 * 注册表系统提供以下功能：
 * - 权限的注册、查询和管理
 * - 策略的注册、编译和按租户查询
 * - 资源的注册和分类管理
 * - 统一管理所有注册表
 *
 * @example
 * ```typescript
 * import {
 *   createPermissionRegistry,
 *   createPolicyRegistry,
 *   createResourceRegistry,
 *   createUnifiedRegistry
 * } from '@mtpc/core/registry';
 *
 * // 创建权限注册表
 * const permissionRegistry = createPermissionRegistry();
 * permissionRegistry.register('user', { action: 'read', description: '读取用户' });
 *
 * // 创建策略注册表
 * const policyRegistry = createPolicyRegistry();
 *
 * // 创建统一注册表
 * const unifiedRegistry = createUnifiedRegistry();
 * ```
 */

// 导出权限注册表相关
export * from './permission-registry.js';

// 导出策略注册表相关
export * from './policy-registry.js';

// 导出资源注册表相关
export * from './resource-registry.js';

// 导出统一注册表相关
export * from './unified-registry.js';
