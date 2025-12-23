import type { MTPCContext, SubjectContext, TenantContext } from '@mtpc/core';
import { ANONYMOUS_SUBJECT, createContext } from '@mtpc/core';
import type { Context } from 'hono';
import type { MTPCEnv } from '../types.js';

/**
 * 从 Hono 上下文中获取租户信息
 *
 * @param c - Hono 上下文对象
 * @returns 租户上下文
 * @throws 如果租户未设置，可能返回 undefined
 */
export function getTenant(c: Context<MTPCEnv>): TenantContext {
  return c.get('tenant');
}

/**
 * 从 Hono 上下文中获取主体（用户/服务）信息
 * 如果未设置主体，则返回匿名主体
 *
 * @param c - Hono 上下文对象
 * @returns 主体上下文，默认为匿名主体
 */
export function getSubject(c: Context<MTPCEnv>): SubjectContext {
  return c.get('subject') ?? ANONYMOUS_SUBJECT;
}

/**
 * 从 Hono 上下文中获取完整的 MTPC 上下文
 * 包含租户、主体、请求等信息
 *
 * @param c - Hono 上下文对象
 * @returns MTPC 上下文
 * @throws 如果 mtpcContext 未创建，可能返回 undefined
 */
export function getMTPCContext(c: Context<MTPCEnv>): MTPCContext {
  return c.get('mtpcContext');
}

/**
 * 在 Hono 上下文中设置租户信息
 * 设置后会自动更新 MTPC 上下文
 *
 * @param c - Hono 上下文对象
 * @param tenant - 要设置的租户上下文
 */
export function setTenant(c: Context<MTPCEnv>, tenant: TenantContext): void {
  c.set('tenant', tenant);
  updateMTPCContext(c);
}

/**
 * 在 Hono 上下文中设置主体信息
 * 设置后会自动更新 MTPC 上下文
 *
 * @param c - Hono 上下文对象
 * @param subject - 要设置的主体上下文
 */
export function setSubject(c: Context<MTPCEnv>, subject: SubjectContext): void {
  c.set('subject', subject);
  updateMTPCContext(c);
}

/**
 * 更新 MTPC 上下文
 * 在租户或主体变更时调用，重新创建 MTPC 上下文
 *
 * **修复说明**：即使没有租户（公开 API 场景），也应该创建 MTPC 上下文
 * 这样可以确保后续的权限检查等功能正常工作
 *
 * @param c - Hono 上下文对象
 */
function updateMTPCContext(c: Context<MTPCEnv>): void {
  const tenant = c.get('tenant');
  const subject = c.get('subject') ?? ANONYMOUS_SUBJECT;

  // 始终创建 MTPC 上下文，即使租户为空（支持公开 API 场景）
  // 如果租户为空，将使用默认的空租户上下文
  const mtpcContext = createContext({
    tenant: tenant ?? { id: '__public__', metadata: {} },
    subject,
    request: {
      requestId: c.req.header('x-request-id') ?? generateRequestId(),
      timestamp: new Date(),
      ip: getClientIp(c),
      userAgent: c.req.header('user-agent'),
      path: c.req.path,
      method: c.req.method,
    },
  });

  c.set('mtpcContext', mtpcContext);
}

/**
 * 从请求中获取客户端 IP 地址
 * 优先从 x-forwarded-for 获取（代理场景），其次从 x-real-ip 获取
 *
 * @param c - Hono 上下文对象
 * @returns 客户端 IP 地址，可能为 undefined
 */
function getClientIp(c: Context<MTPCEnv>): string | undefined {
  // x-forwarded-for 格式: client, proxy1, proxy2
  // 取第一个 IP 作为真实客户端 IP
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    return first?.trim();
  }
  return c.req.header('x-real-ip') ?? undefined;
}

/**
 * 生成唯一的请求 ID
 * 格式: req_<timestamp>_<random>
 *
 * @returns 请求 ID 字符串
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 从 Hono 上下文创建完整的 MTPC 上下文
 * 用于需要手动创建 MTPC 上下文的场景
 *
 * @param c - Hono 上下文对象
 * @param tenant - 租户上下文
 * @param subject - 主体上下文，默认为匿名主体
 * @returns MTPC 上下文
 */
export function createMTPCContextFromHono(
  c: Context<MTPCEnv>,
  tenant: TenantContext,
  subject?: SubjectContext
): MTPCContext {
  return createContext({
    tenant,
    subject: subject ?? ANONYMOUS_SUBJECT,
    request: {
      requestId: c.req.header('x-request-id') ?? generateRequestId(),
      timestamp: new Date(),
      ip: getClientIp(c),
      userAgent: c.req.header('user-agent'),
      path: c.req.path,
      method: c.req.method,
    },
  });
}
