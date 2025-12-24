import type { SubjectContext, TenantContext } from '@mtpc/core';
import { parsePermissionCode } from '@mtpc/shared';
import type { MockMTPC } from '../types.js';

/**
 * Grant a single permission to the mock MTPC
 */
export function grantPermission(
  mtpc: MockMTPC,
  permission: string,
  subjectId?: string,
  tenantId?: string
): void {
  mtpc.grantPermission(permission, subjectId, tenantId);
}

/**
 * Grant multiple permissions
 */
export function grantPermissions(
  mtpc: MockMTPC,
  permissions: string[],
  subjectId?: string,
  tenantId?: string
): void {
  mtpc.grantPermissions(permissions, subjectId, tenantId);
}

/**
 * Grant full access to a resource
 */
export function grantFullAccess(
  mtpc: MockMTPC,
  resource: string,
  subjectId?: string,
  tenantId?: string
): void {
  mtpc.grantPermission(`${resource}:*`, subjectId, tenantId);
}

/**
 * Grant read-only access to a resource
 */
export function grantReadAccess(
  mtpc: MockMTPC,
  resource: string,
  subjectId?: string,
  tenantId?: string
): void {
  mtpc.grantPermissions([`${resource}:read`, `${resource}:list`], subjectId, tenantId);
}

/**
 * Deny a permission (by not granting it - explicit for clarity)
 */
export function denyPermission(
  mtpc: MockMTPC,
  permission: string,
  subjectId?: string,
  tenantId?: string
): void {
  mtpc.revokePermission(permission, subjectId, tenantId);
}

/**
 * Deny all permissions
 */
export function denyAllPermissions(mtpc: MockMTPC, subjectId?: string, tenantId?: string): void {
  mtpc.revokeAllPermissions(subjectId, tenantId);
}

/**
 * Set up permissions for a role
 */
export function setupRole(
  mtpc: MockMTPC,
  roleName: string,
  permissions: string[],
  subjectId?: string,
  tenantId?: string
): void {
  // For testing, we directly grant permissions
  // In real RBAC, this would go through role assignment
  mtpc.grantPermissions(permissions, subjectId, tenantId);
}

/**
 * Test if a permission would be allowed
 */
export async function testPermission(
  mtpc: MockMTPC,
  permission: string,
  subject: SubjectContext,
  tenant: TenantContext
): Promise<boolean> {
  const parsed = parsePermissionCode(permission);
  if (!parsed) {
    throw new Error(`Invalid permission code: ${permission}`);
  }

  const result = await mtpc.checkPermission({
    tenant,
    subject,
    resource: parsed.resource,
    action: parsed.action,
  });

  return result.allowed;
}

/**
 * Assert permission is allowed
 */
export async function assertPermissionAllowed(
  mtpc: MockMTPC,
  permission: string,
  subject: SubjectContext,
  tenant: TenantContext
): Promise<void> {
  const allowed = await testPermission(mtpc, permission, subject, tenant);
  if (!allowed) {
    throw new Error(`Expected permission "${permission}" to be allowed, but it was denied`);
  }
}

/**
 * Assert permission is denied
 */
export async function assertPermissionDenied(
  mtpc: MockMTPC,
  permission: string,
  subject: SubjectContext,
  tenant: TenantContext
): Promise<void> {
  const allowed = await testPermission(mtpc, permission, subject, tenant);
  if (allowed) {
    throw new Error(`Expected permission "${permission}" to be denied, but it was allowed`);
  }
}
