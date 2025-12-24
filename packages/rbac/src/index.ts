/**
 * @mtpc/rbac - MTPC 基于角色的访问控制扩展
 *
 * 提供完整的 RBAC（Role-Based Access Control）功能，包括：
 *
 * ## 核心功能
 *
 * ### 角色管理
 * - 创建、更新、删除和查询角色
 * - 角色继承支持
 * - 系统角色和自定义角色
 * - 角色验证和审计
 *
 * ### 角色绑定
 * - 将角色分配给用户、组或服务
 * - 支持临时权限（过期时间）
 * - 批量绑定操作
 *
 * ### 权限检查
 * - 基于角色的权限验证
 * - 有效权限计算（包含继承权限）
 * - 权限缓存提高性能
 *
 * ## 快速开始
 *
 * ```typescript
 * import { createRBAC } from '@mtpc/rbac';
 *
 * // 创建 RBAC 实例
 * const rbac = createRBAC();
 *
 * // 创建角色
 * await rbac.createRole('tenant-001', {
 *   name: 'editor',
 *   displayName: 'Content Editor',
 *   permissions: ['content:read', 'content:write']
 * });
 *
 * // 分配角色
 * await rbac.assignRole('tenant-001', 'editor', 'user', 'user-123');
 *
 * // 检查权限
 * const result = await rbac.check(tenantCtx, userCtx, 'content:write');
 * if (result.allowed) {
 *   // 允许操作
 * }
 * ```
 *
 * ## 作为 MTPC 插件使用
 *
 * ```typescript
 * import { createMTPC } from '@mtpc/core';
 * import { createRBACPlugin } from '@mtpc/rbac';
 *
 * const mtpc = createMTPC({
 *   plugins: [
 *     createRBACPlugin({ cacheTTL: 60000 })
 *   ]
 * });
 * ```
 *
 * @packageDocumentation
 */

// 导出绑定相关
export * from './binding/index.js';
// 导出插件
export * from './plugin.js';
// 导出策略相关
export * from './policy/index.js';
// 导出 RBAC 类和工厂函数
export * from './rbac.js';
// 导出角色相关
export * from './role/index.js';
// 导出存储相关
export * from './store/index.js';
// 导出核心类型
export * from './types.js';
