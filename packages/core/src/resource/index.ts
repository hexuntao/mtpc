/**
 * 资源模块导出
 * 该模块统一导出资源系统相关的所有类和函数
 *
 * 包含内容：
 * - ResourceBuilder: 资源构建器
 * - defineResource: 资源定义函数
 * - 资源工具函数
 * - 资源验证函数
 *
 * 资源系统提供以下功能：
 * - 资源定义和构建
 * - 资源验证和类型检查
 * - 资源特性管理
 * - 权限自动生成
 * - 关系定义
 * - 钩子系统
 *
 * @example
 * ```typescript
 * import { resource } from '@mtpc/core/resource';
 * import { z } from 'zod';
 *
 * // 构建资源
 * const userResource = resource('user', z.object({
 *   id: z.string(),
 *   name: z.string(),
 *   email: z.string()
 * }))
 *   .displayName('用户')
 *   .description('用户资源')
 *   .enable('create', 'read', 'update', 'delete', 'list')
 *   .build();
 * ```
 */

// 导出资源构建器相关
export * from './builder.js';

// 导出资源定义相关
export * from './define.js';

// 导出资源工具函数相关
export * from './utils.js';

// 导出资源验证器相关
export * from './validator.js';
