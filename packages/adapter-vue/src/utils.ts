import type { MatchMode, PermissionEvalResult } from './types.js';

/**
 * Match permission against pattern (supports wildcards)
 */
export function matches(permission: string, pattern: string): boolean {
  if (pattern === '*') return true;
  const [r, a] = permission.split(':');
  const [pr, pa] = pattern.split(':');
  if (pr === '*' && pa === a) return true;
  if (pa === '*' && pr === r) return true;
  return permission === pattern;
}

/**
 * Evaluate permissions
 */
export function evalPermissions(
  granted: string[],
  required: string[],
  mode: MatchMode = 'all'
): PermissionEvalResult {
  const grantedSet = new Set(granted);
  const g: string[] = [];
  const m: string[] = [];

  for (const p of required) {
    const ok = grantedSet.has(p) || grantedSet.has('*') || granted.some(gp => matches(p, gp));
    if (ok) g.push(p);
    else m.push(p);
  }

  const allowed = mode === 'all' ? m.length === 0 : g.length > 0;

  return { required, granted: g, missing: m, allowed };
}

/**
 * Normalize to array
 */
export function toArray(permission?: string, permissions?: string[]): string[] {
  if (permissions && permissions.length) return permissions;
  if (permission) return [permission];
  return [];
}
