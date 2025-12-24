import type { MTPC } from '@mtpc/core';
import { createPermissionCode } from '@mtpc/shared';

/**
 * Permission matrix entry for devtools
 */
export interface PermissionMatrixRow {
  resource: string;
  action: string;
  permission: string;
}

/**
 * Build a flat permission matrix from MTPC registry
 */
export function buildPermissionMatrix(mtpc: MTPC): PermissionMatrixRow[] {
  const rows: PermissionMatrixRow[] = [];

  for (const resource of mtpc.registry.resources.list()) {
    for (const perm of resource.permissions) {
      rows.push({
        resource: resource.name,
        action: perm.action,
        permission: createPermissionCode(resource.name, perm.action),
      });
    }
  }

  return rows;
}
