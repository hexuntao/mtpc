import type { MTPC, MTPCContext } from '@mtpc/core';
import { parsePermissionCode } from '@mtpc/shared';

/**
 * Detailed debug info for a permission check
 */
export interface PermissionDebugInfo {
  permission: string;
  resource: string;
  action: string;
  allowed: boolean;
  reason?: string;
  evaluationTime?: number;
}

/**
 * Debug permission check by running checkPermission and returning
 * a structured result that可用于 DevTools UI 展示。
 */
export async function debugPermissionCheck(
  mtpc: MTPC,
  ctx: MTPCContext,
  permission: string,
  resourceId?: string
): Promise<PermissionDebugInfo> {
  const parsed = parsePermissionCode(permission);
  if (!parsed) {
    return {
      permission,
      resource: '',
      action: '',
      allowed: false,
      reason: 'Invalid permission code',
    };
  }

  const result = await mtpc.checkPermission({
    tenant: ctx.tenant,
    subject: ctx.subject,
    resource: parsed.resource,
    action: parsed.action,
    resourceId,
  });

  return {
    permission,
    resource: parsed.resource,
    action: parsed.action,
    allowed: result.allowed,
    reason: result.reason,
    evaluationTime: result.evaluationTime,
  };
}
