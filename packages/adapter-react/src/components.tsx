import React from 'react';
import { usePermissionContext } from './context.js';
import type { CannotProps, CanProps, PermissionGuardProps } from './types.js';
import { normalizePermissions } from './utils.js';

/**
 * <Can> component - render children only if permission(s) are granted
 */
export function Can(props: CanProps): JSX.Element | null {
  const { permission, permissions, mode = 'all', not = false, fallback, children } = props;
  const ctx = usePermissionContext();
  const required = normalizePermissions(permission, permissions);
  const result = ctx.evaluate(required, mode);
  const allowed = not ? !result.allowed : result.allowed;

  if (!allowed) {
    if (fallback) {
      return <>{typeof fallback === 'function' ? fallback : fallback}</>;
    }
    return null;
  }

  if (typeof children === 'function') {
    return <>{children(true)}</>;
  }

  return <>{children}</>;
}

/**
 * <Cannot> component - opposite of <Can>
 */
export function Cannot(props: CannotProps): JSX.Element | null {
  return <Can {...props} not />;
}

/**
 * <PermissionGuard> - wrapper that controls access to sections
 */
export function PermissionGuard(props: PermissionGuardProps): JSX.Element | null {
  const { fallback = null, ...rest } = props;
  const element = <Can {...rest} />;

  // If not allowed, render fallback (if any)
  return element ?? (fallback as JSX.Element | null);
}
