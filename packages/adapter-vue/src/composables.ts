import { computed } from 'vue';
import { usePermissionContext } from './context.js';
import type { MatchMode } from './types.js';
import { toArray } from './utils.js';

/**
 * usePermissions - 获取当前权限和角色
 */
export function usePermissions() {
  const ctx = usePermissionContext();
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
 * usePermission - 检查单个或多个权限
 */
export function usePermission(
  permission?: string,
  permissions?: string[],
  mode: MatchMode = 'all'
) {
  const ctx = usePermissionContext();
  const required = toArray(permission, permissions);
  const result = computed(() => ctx.evaluate(required, mode));
  const allowed = computed(() => result.value.allowed);

  return {
    allowed,
    result,
  };
}

/**
 * useCan - 单个权限
 */
export function useCan(permission: string) {
  const ctx = usePermissionContext();
  return computed(() => ctx.can(permission));
}

/**
 * useCanAny - 任意权限
 */
export function useCanAny(permissions: string[]) {
  const ctx = usePermissionContext();
  return computed(() => ctx.canAny(permissions));
}

/**
 * useCanAll - 所有权限
 */
export function useCanAll(permissions: string[]) {
  const ctx = usePermissionContext();
  return computed(() => ctx.canAll(permissions));
}

/**
 * useRoles - 当前角色
 */
export function useRoles() {
  const ctx = usePermissionContext();
  return ctx.roles;
}

/**
 * useHasRole - 是否拥有某个角色
 */
export function useHasRole(role: string) {
  const ctx = usePermissionContext();
  return computed(() => ctx.roles.value.includes(role));
}
