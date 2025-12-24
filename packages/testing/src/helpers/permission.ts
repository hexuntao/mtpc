import type { SubjectContext, TenantContext } from '@mtpc/core';
import { parsePermissionCode } from '@mtpc/shared';
import type { MockMTPC } from '../types.js';

/**
 * 向模拟 MTPC 授予单个权限
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
 * 授予多个权限
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
 * 授予资源的完全访问权限
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
 * 授予资源的只读访问权限
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
 * 拒绝权限（通过不授予来明确拒绝）
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
 * 拒绝所有权限
 */
export function denyAllPermissions(mtpc: MockMTPC, subjectId?: string, tenantId?: string): void {
  mtpc.revokeAllPermissions(subjectId, tenantId);
}

/**
 * 为角色设置权限
 */
export function setupRole(
  mtpc: MockMTPC,
  // roleName: string,
  permissions: string[],
  subjectId?: string,
  tenantId?: string
): void {
  // For testing, we directly grant permissions
  // In real RBAC, this would go through role assignment
  mtpc.grantPermissions(permissions, subjectId, tenantId);
}

/**
 * 测试权限是否会被允许
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
 * 断言权限被允许
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
 * 断言权限被拒绝
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
