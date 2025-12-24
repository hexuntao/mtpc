import type { MatchMode, PermissionEvalResult } from './types.js';

/**
 * Check if a permission code matches a pattern with wildcards.
 *
 * Supported patterns:
 * - "*"                 : any permission
 * - "resource:*"        : any action on specific resource
 * - "*:action"          : specific action on any resource
 * - "resource:action"   : exact match
 */
export function matchesPermission(permission: string, pattern: string): boolean {
  if (!permission || !pattern) {
    return false;
  }

  // Global wildcard
  if (pattern === '*') {
    return true;
  }

  const [res, act] = permission.split(':');
  const [pres, pact] = pattern.split(':');

  // Resource wildcard: "resource:*"
  if (pact === '*' && pres === res) {
    return true;
  }

  // Action wildcard: "*:action"
  if (pres === '*' && pact === act) {
    return true;
  }

  // Exact match
  return permission === pattern;
}

/**
 * Evaluate permissions against required set
 */
export function evaluatePermissions(
  granted: string[],
  required: string[],
  mode: MatchMode = 'all'
): PermissionEvalResult {
  const grantedSet = new Set(granted);

  const actuallyGranted: string[] = [];
  const missing: string[] = [];

  for (const req of required) {
    const isGranted =
      grantedSet.has(req) || grantedSet.has('*') || granted.some(p => matchesPermission(req, p));

    if (isGranted) {
      actuallyGranted.push(req);
    } else {
      missing.push(req);
    }
  }

  const allowed = mode === 'all' ? missing.length === 0 : actuallyGranted.length > 0;

  return {
    required,
    granted: actuallyGranted,
    missing,
    allowed,
  };
}

/**
 * Normalize permissions input to array
 */
export function normalizePermissions(permission?: string, permissions?: string[]): string[] {
  if (permissions && permissions.length > 0) {
    return permissions;
  }
  if (permission) {
    return [permission];
  }
  return [];
}
