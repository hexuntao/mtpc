import type { Permission, PermissionDefinition } from '../types/index.js';
import { PERMISSION_SEPARATOR, PERMISSION_WILDCARD } from '@mtpc/shared';

/**
 * Check if permission code is valid
 */
export function isValidPermissionCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
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
 * Check if permission code matches pattern
 */
export function matchesPattern(code: string, pattern: string): boolean {
  // Wildcard matches everything
  if (pattern === PERMISSION_WILDCARD) {
    return true;
  }

  // Exact match
  if (code === pattern) {
    return true;
  }

  // Resource wildcard (e.g., "product:*")
  if (pattern.endsWith(`${PERMISSION_SEPARATOR}${PERMISSION_WILDCARD}`)) {
    const patternResource = pattern.slice(0, -2);
    const codeResource = code.split(PERMISSION_SEPARATOR)[0];
    return patternResource === codeResource;
  }

  // Action wildcard (e.g., "*:create")
  if (pattern.startsWith(`${PERMISSION_WILDCARD}${PERMISSION_SEPARATOR}`)) {
    const patternAction = pattern.slice(2);
    const codeAction = code.split(PERMISSION_SEPARATOR)[1];
    return patternAction === codeAction;
  }

  return false;
}

/**
 * Expand permission patterns to concrete permissions
 */
export function expandPatterns(
  patterns: string[],
  allPermissions: string[]
): Set<string> {
  const expanded = new Set<string>();

  for (const pattern of patterns) {
    if (pattern === PERMISSION_WILDCARD) {
      // Add all permissions
      for (const perm of allPermissions) {
        expanded.add(perm);
      }
    } else if (pattern.includes(PERMISSION_WILDCARD)) {
      // Expand wildcard pattern
      for (const perm of allPermissions) {
        if (matchesPattern(perm, pattern)) {
          expanded.add(perm);
        }
      }
    } else {
      // Concrete permission
      expanded.add(pattern);
    }
  }

  return expanded;
}

/**
 * Group permissions by resource
 */
export function groupByResource(
  permissions: Permission[]
): Map<string, Permission[]> {
  const grouped = new Map<string, Permission[]>();

  for (const permission of permissions) {
    const existing = grouped.get(permission.resource) ?? [];
    existing.push(permission);
    grouped.set(permission.resource, existing);
  }

  return grouped;
}

/**
 * Get unique resources from permissions
 */
export function getUniqueResources(permissions: Permission[]): string[] {
  const resources = new Set<string>();

  for (const permission of permissions) {
    resources.add(permission.resource);
  }

  return Array.from(resources);
}

/**
 * Filter permissions by resource
 */
export function filterByResource(
  permissions: Permission[],
  resource: string
): Permission[] {
  return permissions.filter(p => p.resource === resource);
}

/**
 * Filter permissions by action
 */
export function filterByAction(
  permissions: Permission[],
  action: string
): Permission[] {
  return permissions.filter(p => p.action === action);
}

/**
 * Merge permission sets
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
 * Subtract permission sets
 */
export function subtractPermissionSets(
  base: Set<string>,
  toRemove: Set<string>
): Set<string> {
  const result = new Set<string>();

  for (const permission of base) {
    if (!toRemove.has(permission)) {
      result.add(permission);
    }
  }

  return result;
}

/**
 * Intersect permission sets
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
