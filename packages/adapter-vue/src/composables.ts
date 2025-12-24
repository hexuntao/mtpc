// @mtpc/adapter-vue - MTPC Vue 适配器的组合式 API

import { computed } from 'vue';
import { usePermissionContext } from './context.js';
import type { MatchMode } from './types.js';
import { toArray } from './utils.js';

/**
 * usePermissions - 获取当前权限和角色的组合式 API
 * @returns 包含权限、角色和相关方法的对象
 */
export function usePermissions() {
  const ctx = usePermissionContext();
  return {
    permissions: ctx.permissions, // 权限列表
    roles: ctx.roles, // 角色列表
    loading: ctx.loading, // 权限加载状态
    error: ctx.error, // 权限加载错误信息
    lastUpdated: ctx.lastUpdated, // 权限最后更新时间
    refresh: ctx.refresh, // 刷新权限的方法
  };
}

/**
 * usePermission - 检查单个或多个权限的组合式 API
 * @param permission 单个权限代码（可选）
 * @param permissions 权限代码数组（可选）
 * @param mode 匹配模式：'any'（任意一个）或 'all'（所有）（默认：'all'）
 * @returns 包含权限检查结果的对象
 */
export function usePermission(
  permission?: string,
  permissions?: string[],
  mode: MatchMode = 'all'
) {
  const ctx = usePermissionContext();
  // 规范化权限输入，将单个权限或权限数组转换为统一的数组格式
  const required = toArray(permission, permissions);
  
  // 使用 computed 计算属性，只有当依赖变化时才重新计算
  const result = computed(() => ctx.evaluate(required, mode));
  const allowed = computed(() => result.value.allowed);

  return {
    allowed, // 是否允许访问（computed 属性）
    result, // 完整的权限评估结果（computed 属性）
  };
}

/**
 * useCan - 检查单个权限的简写组合式 API
 * @param permission 权限代码，如 'user:read'
 * @returns 是否允许该权限（computed 属性）
 */
export function useCan(permission: string) {
  const ctx = usePermissionContext();
  return computed(() => ctx.can(permission));
}

/**
 * useCanAny - 检查是否允许任意一个权限的简写组合式 API
 * @param permissions 权限代码数组，如 ['user:read', 'user:write']
 * @returns 是否允许任意一个权限（computed 属性）
 */
export function useCanAny(permissions: string[]) {
  const ctx = usePermissionContext();
  return computed(() => ctx.canAny(permissions));
}

/**
 * useCanAll - 检查是否允许所有权限的简写组合式 API
 * @param permissions 权限代码数组，如 ['user:read', 'user:write']
 * @returns 是否允许所有权限（computed 属性）
 */
export function useCanAll(permissions: string[]) {
  const ctx = usePermissionContext();
  return computed(() => ctx.canAll(permissions));
}

/**
 * useRoles - 获取当前角色的简写组合式 API
 * @returns 角色列表（Ref 对象）
 */
export function useRoles() {
  const ctx = usePermissionContext();
  return ctx.roles;
}

/**
 * useHasRole - 检查用户是否具有特定角色的简写组合式 API
 * @param role 角色名称，如 'admin'
 * @returns 是否具有该角色（computed 属性）
 */
export function useHasRole(role: string) {
  const ctx = usePermissionContext();
  return computed(() => ctx.roles.value.includes(role));
}
