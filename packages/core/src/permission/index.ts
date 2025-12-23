/**
 * 权限模块导出
 * 该模块统一导出权限系统相关的所有类和函数
 *
 * 包含内容：
 * - PermissionChecker: 权限检查器
 * - createSimpleChecker: 创建简单权限检查器
 * - createAllowAllChecker: 创建允许所有权限的检查器
 * - createDenyAllChecker: 创建拒绝所有权限的检查器
 * - generatePermissions: 基于资源特性生成权限
 * - compilePermission: 编译权限定义
 * - compileResourcePermissions: 编译资源权限
 * - generatePermissionCodes: 生成权限代码常量
 * - generateAllPermissionCodes: 生成所有权限代码常量
 *
 * @example
 * ```typescript
 * import {
 *   PermissionChecker,
 *   createSimpleChecker,
 *   generatePermissions,
 *   compilePermission
 * } from '@mtpc/core/permission';
 * ```
 */

// 导出权限检查器相关
export * from './checker.js';

// 导出权限生成器相关
export * from './generate.js';

// 导出权限工具函数相关
export * from './utils.js';
