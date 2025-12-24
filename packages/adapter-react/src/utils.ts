// @mtpc/adapter-react - MTPC React 适配器的工具函数

import type { MatchMode, PermissionEvalResult } from './types.js';

/**
 * 检查权限代码是否匹配带有通配符的模式
 *
 * 支持的模式：
 * - "*"                 : 任意权限
 * - "resource:*"        : 特定资源上的任意操作
 * - "*:action"          : 任意资源上的特定操作
 * - "resource:action"   : 精确匹配
 *
 * @param permission 权限代码，如 'user:read'
 * @param pattern 权限模式，如 'user:*' 或 '*'
 * @returns 是否匹配
 */
export function matchesPermission(permission: string, pattern: string): boolean {
  if (!permission || !pattern) {
    return false;
  }

  // 全局通配符：匹配任何权限
  if (pattern === '*') {
    return true;
  }

  // 解析权限和模式的资源和操作
  const [res, act] = permission.split(':');
  const [pres, pact] = pattern.split(':');

  // 资源通配符：特定资源上的任意操作，如 'user:*'
  if (pact === '*' && pres === res) {
    return true;
  }

  // 操作通配符：任意资源上的特定操作，如 '*:read'
  if (pres === '*' && pact === act) {
    return true;
  }

  // 精确匹配：资源和操作都完全匹配
  return permission === pattern;
}

/**
 * 评估权限与所需权限集的匹配情况
 *
 * @param granted 已授予的权限列表
 * @param required 所需的权限列表
 * @param mode 匹配模式：'all'（所有权限都必须匹配）或 'any'（任意一个权限匹配即可）
 * @returns 权限评估结果，包含允许状态、已授予权限和缺失权限
 */
export function evaluatePermissions(
  granted: string[],
  required: string[],
  mode: MatchMode = 'all'
): PermissionEvalResult {
  // 将已授予的权限转换为 Set，提高查找效率
  const grantedSet = new Set(granted);

  // 用于存储已授予的权限和缺失的权限
  const actuallyGranted: string[] = [];
  const missing: string[] = [];

  // 遍历所有所需权限，检查是否已授予
  for (const req of required) {
    // 检查权限是否已直接授予，或者是否匹配某个通配符模式
    const isGranted =
      grantedSet.has(req) || grantedSet.has('*') || granted.some(p => matchesPermission(req, p));

    if (isGranted) {
      actuallyGranted.push(req);
    } else {
      missing.push(req);
    }
  }

  // 根据匹配模式确定是否允许访问
  // - 'all'：所有权限都必须匹配（missing 数组为空）
  // - 'any'：任意一个权限匹配即可（actuallyGranted 数组不为空）
  const allowed = mode === 'all' ? missing.length === 0 : actuallyGranted.length > 0;

  // 返回详细的评估结果
  return {
    required,
    granted: actuallyGranted,
    missing,
    allowed,
  };
}

/**
 * 规范化权限输入，将单个权限或权限数组转换为统一的数组格式
 *
 * @param permission 单个权限代码（可选）
 * @param permissions 权限代码数组（可选）
 * @returns 规范化后的权限数组
 */
export function normalizePermissions(permission?: string, permissions?: string[]): string[] {
  // 如果提供了 permissions 数组且不为空，则使用该数组
  if (permissions && permissions.length > 0) {
    return permissions;
  }

  // 如果提供了单个 permission，则将其转换为数组
  if (permission) {
    return [permission];
  }

  // 否则返回空数组
  return [];
}
