// @mtpc/adapter-react - MTPC React 适配器的钩子函数

import { useMemo } from 'react';
import { usePermissionContext } from './context.js';
import type { MatchMode, UsePermissionOptions } from './types.js';
import { normalizePermissions } from './utils.js';

/**
 * usePermissions - 获取所有权限和角色的钩子
 * @returns 包含权限、角色和加载状态的对象
 */
export function usePermissions(): {
  permissions: string[];
  roles: string[];
  loading: boolean;
  error?: string;
  lastUpdated?: Date;
  refresh: () => Promise<void>;
} {
  // 获取权限上下文
  const ctx = usePermissionContext();
  
  // 返回上下文信息，包含权限、角色、加载状态等
  return {
    permissions: ctx.permissions,
    roles: ctx.roles,
    loading: ctx.loading,
    error: ctx.error,
    lastUpdated: ctx.lastUpdated,
    refresh: ctx.refresh,
  };
}

/**
 * usePermission - 检查单个或多个权限的钩子
 * @param permission 单个权限代码（可选）
 * @param permissions 权限代码数组（可选）
 * @param mode 匹配模式：'all'（所有）或 'any'（任意一个）（默认：'all'）
 * @param options 钩子配置选项
 * @returns 权限检查结果，包含是否允许、缺失的权限和已授予的权限
 */
export function usePermission(
  permission?: string,
  permissions?: string[],
  mode: MatchMode = 'all',
  options: UsePermissionOptions = {}
): {
  allowed: boolean;
  missing: string[];
  granted: string[];
} {
  // 获取权限上下文
  const ctx = usePermissionContext();
  
  // 规范化权限输入，将单个权限或权限数组转换为统一的数组格式
  const required = normalizePermissions(permission, permissions);

  // 使用 useMemo 缓存结果，仅当依赖项变化时重新计算
  const result = useMemo(() => {
    // 如果没有要求的权限，直接返回允许
    if (!required.length) {
      return {
        required,
        granted: [],
        missing: [],
        allowed: true,
      };
    }
    
    // 调用上下文的 evaluate 方法进行权限评估
    return ctx.evaluate(required, mode);
  }, [ctx, required, mode]);

  // 如果权限不允许且配置了 throwOnDenied，则抛出错误
  if (!result.allowed && options.throwOnDenied) {
    const list = result.missing.join(', ');
    throw new Error(`所需权限未授予: ${list || required.join(', ')}`);
  }

  return {
    allowed: result.allowed,
    missing: result.missing,
    granted: result.granted,
  };
}

/**
 * useCan - 检查单个权限的简写钩子
 * @param permission 权限代码
 * @returns 是否允许该权限
 */
export function useCan(permission: string): boolean {
  // 获取权限上下文
  const ctx = usePermissionContext();
  
  // 调用上下文的 can 方法检查权限
  return ctx.can(permission);
}

/**
 * useCanAny - 检查是否允许任意一个权限的简写钩子
 * @param permissions 权限代码数组
 * @returns 是否允许任意一个权限
 */
export function useCanAny(permissions: string[]): boolean {
  // 获取权限上下文
  const ctx = usePermissionContext();
  
  // 调用上下文的 canAny 方法检查权限
  return ctx.canAny(permissions);
}

/**
 * useCanAll - 检查是否允许所有权限的简写钩子
 * @param permissions 权限代码数组
 * @returns 是否允许所有权限
 */
export function useCanAll(permissions: string[]): boolean {
  // 获取权限上下文
  const ctx = usePermissionContext();
  
  // 调用上下文的 canAll 方法检查权限
  return ctx.canAll(permissions);
}

/**
 * useRoles - 获取当前角色的钩子
 * @returns 角色列表
 */
export function useRoles(): string[] {
  // 获取权限上下文
  const ctx = usePermissionContext();
  
  // 返回角色列表
  return ctx.roles;
}

/**
 * useHasRole - 检查用户是否具有特定角色的钩子
 * @param role 角色名称
 * @returns 是否具有该角色
 */
export function useHasRole(role: string): boolean {
  // 获取权限上下文
  const ctx = usePermissionContext();
  
  // 检查角色列表中是否包含指定角色
  return ctx.roles.includes(role);
}

/**
 * useAnyRole - 检查用户是否具有任意一个指定角色的钩子
 * @param roles 角色名称数组
 * @returns 是否具有任意一个指定角色
 */
export function useAnyRole(roles: string[]): boolean {
  // 获取权限上下文
  const ctx = usePermissionContext();
  
  // 检查角色列表中是否包含任意一个指定角色
  return roles.some(r => ctx.roles.includes(r));
}

/**
 * useAllRoles - 检查用户是否具有所有指定角色的钩子
 * @param roles 角色名称数组
 * @returns 是否具有所有指定角色
 */
export function useAllRoles(roles: string[]): boolean {
  // 获取权限上下文
  const ctx = usePermissionContext();
  
  // 检查角色列表中是否包含所有指定角色
  return roles.every(r => ctx.roles.includes(r));
}
