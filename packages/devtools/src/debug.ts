import type { MTPC, MTPCContext } from '@mtpc/core';
import { parsePermissionCode } from '@mtpc/shared';

/**
 * 权限检查的详细调试信息
 */
export interface PermissionDebugInfo {
  /** 完整的权限编码 */
  permission: string;
  /** 资源名称 */
  resource: string;
  /** 操作类型 */
  action: string;
  /** 是否允许访问 */
  allowed: boolean;
  /** 决策原因 */
  reason?: string;
  /** 评估耗时（毫秒） */
  evaluationTime?: number;
}

/**
 * 调试权限检查 - 运行权限检查并返回结构化结果，可用于 DevTools UI 展示
 *
 * @param mtpc MTPC 实例
 * @param ctx MTPC 上下文对象
 * @param permission 权限编码
 * @param resourceId 可选的资源标识符
 * @returns 结构化的权限检查调试信息
 */
export async function debugPermissionCheck(
  mtpc: MTPC,
  ctx: MTPCContext,
  permission: string,
  resourceId?: string
): Promise<PermissionDebugInfo> {
  // 解析权限编码，提取资源和操作
  const parsed = parsePermissionCode(permission);

  // 如果权限编码无效，返回错误信息
  if (!parsed) {
    return {
      permission,
      resource: '',
      action: '',
      allowed: false,
      reason: '无效的权限编码',
    };
  }

  // 执行权限检查
  const result = await mtpc.checkPermission({
    tenant: ctx.tenant,
    subject: ctx.subject,
    resource: parsed.resource,
    action: parsed.action,
    resourceId,
  });

  // 返回结构化的调试信息
  return {
    permission,
    resource: parsed.resource,
    action: parsed.action,
    allowed: result.allowed,
    reason: result.reason,
    evaluationTime: result.evaluationTime,
  };
}
