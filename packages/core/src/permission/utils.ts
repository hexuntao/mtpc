import { PERMISSION_SEPARATOR, PERMISSION_WILDCARD } from '@mtpc/shared';
import type { Permission } from '../types/index.js';

/**
 * 验证权限代码格式是否有效
 * 检查权限代码是否符合 'resource:action' 的格式规范
 *
 * @param code 要验证的权限代码，必须是字符串
 * @returns 是否有效
 *
 * @example
 * ```typescript
 * isValidPermissionCode('user:create'); // true
 * isValidPermissionCode('user:*'); // true
 * isValidPermissionCode('user:create:extra'); // false (格式错误)
 * isValidPermissionCode('123:create'); // false (资源名不能以数字开头)
 * isValidPermissionCode(''); // false (不能为空)
 * ```
 */
export function isValidPermissionCode(code: unknown): boolean {
  // 输入验证
  if (typeof code !== 'string') {
    return false;
  }

  const parts = code.split(PERMISSION_SEPARATOR);

  if (parts.length !== 2) {
    return false;
  }

  const [resource, action] = parts;

  return (
    resource.length > 0 &&
    action.length > 0 &&
    /^[a-zA-Z][a-zA-Z0-9_]*$/.test(resource) &&
    /^[a-zA-Z][a-zA-Z0-9_]*$/.test(action)
  );
}

/**
 * 检查权限代码是否匹配模式
 * 支持精确匹配、通配符 '*' 匹配和资源通配符匹配
 *
 * @param code 权限代码（如：'user:create'）
 * @param pattern 权限模式（如：'user:*'、'*:create'、'*'）
 * @returns 是否匹配
 *
 * @example
 * ```typescript
 * matchesPattern('user:create', 'user:create'); // true (精确匹配)
 * matchesPattern('user:create', 'user:*'); // true (资源通配符)
 * matchesPattern('user:create', '*:create'); // true (操作通配符)
 * matchesPattern('user:create', '*'); // true (全局通配符)
 * matchesPattern('user:create', 'order:*'); // false (不匹配)
 * ```
 */
export function matchesPattern(code: string, pattern: string): boolean {
  // 全局通配符 '*' 匹配所有
  if (pattern === PERMISSION_WILDCARD) {
    return true;
  }

  // 精确匹配
  if (code === pattern) {
    return true;
  }

  // 资源通配符 (例如: "product:*")
  if (pattern.endsWith(`${PERMISSION_SEPARATOR}${PERMISSION_WILDCARD}`)) {
    const patternResource = pattern.slice(0, -(PERMISSION_WILDCARD.length + PERMISSION_SEPARATOR.length));
    const codeResource = code.split(PERMISSION_SEPARATOR)[0];
    return patternResource === codeResource;
  }

  // 操作通配符 (例如: "*:create")
  if (pattern.startsWith(`${PERMISSION_WILDCARD}${PERMISSION_SEPARATOR}`)) {
    const patternAction = pattern.slice(PERMISSION_WILDCARD.length + PERMISSION_SEPARATOR.length);
    const codeAction = code.split(PERMISSION_SEPARATOR)[1];
    return patternAction === codeAction;
  }

  return false;
}

/**
 * 展开权限模式为具体权限
 * 将包含通配符的权限模式展开为具体的权限代码集合
 *
 * @param patterns 权限模式数组
 * @param allPermissions 所有可能的权限代码
 * @returns 展开后的权限代码集合
 *
 * @example
 * ```typescript
 * const allPerms = ['user:create', 'user:read', 'order:create', 'order:read'];
 * const expanded = expandPatterns(['user:*', '*:read'], allPerms);
 * // 返回: Set(['user:create', 'user:read', 'order:read'])
 * ```
 */
export function expandPatterns(patterns: string[], allPermissions: string[]): Set<string> {
  const expanded = new Set<string>();

  for (const pattern of patterns) {
    if (pattern === PERMISSION_WILDCARD) {
      // 添加所有权限
      for (const perm of allPermissions) {
        expanded.add(perm);
      }
    } else if (pattern.includes(PERMISSION_WILDCARD)) {
      // 展开通配符模式
      for (const perm of allPermissions) {
        if (matchesPattern(perm, pattern)) {
          expanded.add(perm);
        }
      }
    } else {
      // 具体权限
      expanded.add(pattern);
    }
  }

  return expanded;
}

/**
 * 按资源分组权限
 * 将权限数组按资源名称分组，返回映射表
 *
 * @param permissions 权限数组
 * @returns 按资源分组的权限映射表
 *
 * @example
 * ```typescript
 * const permissions = [
 *   { code: 'user:create', resource: 'user', action: 'create' },
 *   { code: 'user:read', resource: 'user', action: 'read' },
 *   { code: 'order:create', resource: 'order', action: 'create' }
 * ];
 *
 * const grouped = groupByResource(permissions);
 * // 返回: Map({
 * //   'user' => [{ code: 'user:create', ... }, { code: 'user:read', ... }],
 * //   'order' => [{ code: 'order:create', ... }]
 * // })
 * ```
 */
export function groupByResource(permissions: Permission[]): Map<string, Permission[]> {
  const grouped = new Map<string, Permission[]>();

  for (const permission of permissions) {
    const existing = grouped.get(permission.resource) ?? [];
    existing.push(permission);
    grouped.set(permission.resource, existing);
  }

  return grouped;
}

/**
 * 获取权限中的唯一资源列表
 * 从权限数组中提取所有不重复的资源名称
 *
 * @param permissions 权限数组
 * @returns 唯一资源名称数组
 *
 * @example
 * ```typescript
 * const permissions = [
 *   { resource: 'user' }, { resource: 'user' },
 *   { resource: 'order' }, { resource: 'product' }
 * ];
 *
 * const resources = getUniqueResources(permissions);
 * // 返回: ['user', 'order', 'product']
 * ```
 */
export function getUniqueResources(permissions: Permission[]): string[] {
  const resources = new Set<string>();

  for (const permission of permissions) {
    resources.add(permission.resource);
  }

  return Array.from(resources);
}

/**
 * 按资源筛选权限
 * 从权限数组中筛选出指定资源的权限
 *
 * @param permissions 权限数组
 * @param resource 资源名称
 * @returns 筛选后的权限数组
 *
 * @example
 * ```typescript
 * const permissions = [
 *   { resource: 'user', action: 'create' },
 *   { resource: 'order', action: 'create' },
 *   { resource: 'user', action: 'read' }
 * ];
 *
 * const userPerms = filterByResource(permissions, 'user');
 * // 返回: [{ resource: 'user', action: 'create' }, { resource: 'user', action: 'read' }]
 * ```
 */
export function filterByResource(permissions: Permission[], resource: string): Permission[] {
  return permissions.filter(p => p.resource === resource);
}

/**
 * 按操作筛选权限
 * 从权限数组中筛选出指定操作的权限
 *
 * @param permissions 权限数组
 * @param action 操作名称
 * @returns 筛选后的权限数组
 *
 * @example
 * ```typescript
 * const permissions = [
 *   { resource: 'user', action: 'create' },
 *   { resource: 'order', action: 'create' },
 *   { resource: 'user', action: 'read' }
 * ];
 *
 * const createPerms = filterByAction(permissions, 'create');
 * // 返回: [{ resource: 'user', action: 'create' }, { resource: 'order', action: 'create' }]
 * ```
 */
export function filterByAction(permissions: Permission[], action: string): Permission[] {
  return permissions.filter(p => p.action === action);
}

/**
 * 合并权限集合
 * 将多个权限集合合并为一个集合（去重）
 *
 * @param sets 权限集合数组
 * @returns 合并后的权限集合
 *
 * @example
 * ```typescript
 * const set1 = new Set(['user:create', 'user:read']);
 * const set2 = new Set(['user:read', 'user:update']);
 * const set3 = new Set(['order:create']);
 *
 * const merged = mergePermissionSets(set1, set2, set3);
 * // 返回: Set(['user:create', 'user:read', 'user:update', 'order:create'])
 * ```
 */
export function mergePermissionSets(...sets: Set<string>[]): Set<string> {
  const merged = new Set<string>();

  for (const set of sets) {
    for (const permission of set) {
      merged.add(permission);
    }
  }

  return merged;
}

/**
 * 减去权限集合
 * 从基础集合中减去另一个集合，返回差集
 *
 * @param base 基础权限集合
 * @param toRemove 要减去的权限集合
 * @returns 差集权限集合
 *
 * @example
 * ```typescript
 * const base = new Set(['user:create', 'user:read', 'user:update']);
 * const toRemove = new Set(['user:read', 'user:delete']);
 *
 * const result = subtractPermissionSets(base, toRemove);
 * // 返回: Set(['user:create', 'user:update'])
 * ```
 */
export function subtractPermissionSets(base: Set<string>, toRemove: Set<string>): Set<string> {
  const result = new Set<string>();

  for (const permission of base) {
    if (!toRemove.has(permission)) {
      result.add(permission);
    }
  }

  return result;
}

/**
 * 交集权限集合
 * 计算多个权限集合的交集，返回同时存在于所有集合中的权限
 *
 * @param sets 权限集合数组
 * @returns 交集权限集合
 *
 * @example
 * ```typescript
 * const set1 = new Set(['user:create', 'user:read', 'user:update']);
 * const set2 = new Set(['user:read', 'user:update', 'user:delete']);
 * const set3 = new Set(['user:read', 'order:create']);
 *
 * const intersection = intersectPermissionSets(set1, set2, set3);
 * // 返回: Set(['user:read'])
 * ```
 */
export function intersectPermissionSets(...sets: Set<string>[]): Set<string> {
  if (sets.length === 0) {
    return new Set();
  }

  const [first, ...rest] = sets;
  const result = new Set<string>();

  for (const permission of first) {
    if (rest.every(set => set.has(permission))) {
      result.add(permission);
    }
  }

  return result;
}
