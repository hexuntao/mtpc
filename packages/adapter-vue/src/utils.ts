// @mtpc/adapter-vue - MTPC Vue 适配器的工具函数

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
export function matches(permission: string, pattern: string): boolean {
  if (pattern === '*') return true;

  // 解析权限和模式的资源和操作
  const [r, a] = permission.split(':');
  const [pr, pa] = pattern.split(':');

  // 操作通配符：任意资源上的特定操作，如 '*:read'
  if (pr === '*' && pa === a) return true;

  // 资源通配符：特定资源上的任意操作，如 'user:*'
  if (pa === '*' && pr === r) return true;

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
export function evalPermissions(
  granted: string[],
  required: string[],
  mode: MatchMode = 'all'
): PermissionEvalResult {
  // 将已授予的权限转换为 Set，提高查找效率
  const grantedSet = new Set(granted);

  // 用于存储已授予的权限和缺失的权限
  const g: string[] = [];
  const m: string[] = [];

  // 遍历所有所需权限，检查是否已授予
  for (const p of required) {
    // 检查权限是否已直接授予，或者是否匹配某个通配符模式
    const ok = grantedSet.has(p) || grantedSet.has('*') || granted.some(gp => matches(p, gp));
    if (ok) g.push(p);
    else m.push(p);
  }

  // 根据匹配模式确定是否允许访问
  // - 'all'：所有权限都必须匹配（missing 数组为空）
  // - 'any'：任意一个权限匹配即可（granted 数组不为空）
  const allowed = mode === 'all' ? m.length === 0 : g.length > 0;

  // 返回详细的评估结果
  return { required, granted: g, missing: m, allowed };
}

/**
 * 规范化权限输入，将单个权限或权限数组转换为统一的数组格式
 *
 * @param permission 单个权限代码（可选）
 * @param permissions 权限代码数组（可选）
 * @returns 规范化后的权限数组
 */
export function toArray(permission?: string, permissions?: string[]): string[] {
  // 如果提供了 permissions 数组且不为空，则使用该数组
  if (permissions?.length) return permissions;

  // 如果提供了单个 permission，则将其转换为数组
  if (permission) return [permission];

  // 否则返回空数组
  return [];
}
