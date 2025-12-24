import { useMemo } from 'react';
import { usePermissionContext } from './context.js';
import type { MatchMode, UsePermissionOptions } from './types.js';
import { normalizePermissions } from './utils.js';

/**
 * usePermissions - get all permissions and roles
 */
export function usePermissions(): {
  permissions: string[];
  roles: string[];
  loading: boolean;
  error?: string;
  lastUpdated?: Date;
  refresh: () => Promise<void>;
} {
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
 * usePermission - check single or multiple permissions
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
  const ctx = usePermissionContext();
  const required = normalizePermissions(permission, permissions);

  const result = useMemo(() => {
    if (!required.length) {
      return {
        required,
        granted: [],
        missing: [],
        allowed: true,
      };
    }
    return ctx.evaluate(required, mode);
  }, [ctx, required, mode]);

  if (!result.allowed && options.throwOnDenied) {
    const list = result.missing.join(', ');
    throw new Error(`Required permission(s) not granted: ${list || required.join(', ')}`);
  }

  return {
    allowed: result.allowed,
    missing: result.missing,
    granted: result.granted,
  };
}

/**
 * useCan - shorthand for single permission
 */
export function useCan(permission: string): boolean {
  const ctx = usePermissionContext();
  return ctx.can(permission);
}

/**
 * useCanAny - shorthand for any match
 */
export function useCanAny(permissions: string[]): boolean {
  const ctx = usePermissionContext();
  return ctx.canAny(permissions);
}

/**
 * useCanAll - shorthand for all match
 */
export function useCanAll(permissions: string[]): boolean {
  const ctx = usePermissionContext();
  return ctx.canAll(permissions);
}

/**
 * useRoles - get current roles
 */
export function useRoles(): string[] {
  const ctx = usePermissionContext();
  return ctx.roles;
}

/**
 * useHasRole - check if user has role
 */
export function useHasRole(role: string): boolean {
  const ctx = usePermissionContext();
  return ctx.roles.includes(role);
}

/**
 * useAnyRole - check if user has any of roles
 */
export function useAnyRole(roles: string[]): boolean {
  const ctx = usePermissionContext();
  return roles.some(r => ctx.roles.includes(r));
}

/**
 * useAllRoles - check if user has all roles
 */
export function useAllRoles(roles: string[]): boolean {
  const ctx = usePermissionContext();
  return roles.every(r => ctx.roles.includes(r));
}
