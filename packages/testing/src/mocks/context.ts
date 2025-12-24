import type { MTPCContext, SubjectContext, TenantContext } from '@mtpc/core';
import { createContext } from '@mtpc/core';
import type { MockContextOptions, MockSubjectOptions, MockTenantOptions } from '../types.js';
import { createAnonymousSubject, createMockSubject } from './subject.js';
import { createDefaultTenant, createMockTenant } from './tenant.js';

let requestCounter = 0;

/**
 * 判断是否为 MockTenantOptions
 * TenantContext 必然有 id 字段，但 MockTenantOptions 也可能有 id 字段
 * 通过检查是否存在 status 或 metadata 字段来区分
 */
function isMockTenantOptions(obj: unknown): obj is MockTenantOptions {
  if (typeof obj !== 'object' || obj === null) return false;
  // 如果有 status 或 metadata 字段，说明是 MockTenantOptions
  return 'status' in obj || 'metadata' in obj;
}

/**
 * 判断是否为 MockSubjectOptions
 * SubjectContext 必然有 type 字段，而 MockSubjectOptions 中 type 是可选的
 * 通过检查是否缺少 type 字段来判断
 */
function isMockSubjectOptions(obj: unknown): obj is MockSubjectOptions {
  if (typeof obj !== 'object' || obj === null) return false;
  return !('type' in obj);
}

/**
 * 创建模拟 MTPC 上下文
 */
export function createMockContext(options: MockContextOptions = {}): MTPCContext {
  // 解析租户
  let tenant: TenantContext;
  if (!options.tenant) {
    tenant = createDefaultTenant();
  } else if (isMockTenantOptions(options.tenant)) {
    tenant = createMockTenant(options.tenant);
  } else {
    tenant = options.tenant as TenantContext;
  }

  // 解析主体
  let subject: SubjectContext;
  if (!options.subject) {
    subject = createAnonymousSubject();
  } else if (isMockSubjectOptions(options.subject)) {
    subject = createMockSubject(options.subject);
  } else {
    subject = options.subject as SubjectContext;
  }

  return createContext({
    tenant,
    subject,
    request: {
      requestId: options.requestId ?? `test-req-${++requestCounter}`,
      timestamp: options.timestamp ?? new Date(),
      ip: options.ip ?? '127.0.0.1',
      path: options.path ?? '/test',
      method: options.method ?? 'GET',
    },
  });
}

/**
 * 为特定租户和主体创建上下文
 */
export function createTestContext(
  tenantId: string,
  subjectId: string,
  roles?: string[]
): MTPCContext {
  return createMockContext({
    tenant: { id: tenantId },
    subject: { id: subjectId, roles },
  });
}

/**
 * 创建具有完全权限的上下文
 */
export function createAdminContext(tenantId?: string): MTPCContext {
  return createMockContext({
    tenant: tenantId ? { id: tenantId } : undefined,
    subject: {
      id: 'admin',
      type: 'user',
      roles: ['admin'],
      permissions: ['*'],
    },
  });
}

/**
 * 创建无权限上下文
 */
export function createGuestContext(tenantId?: string): MTPCContext {
  return createMockContext({
    tenant: tenantId ? { id: tenantId } : undefined,
    subject: createAnonymousSubject(),
  });
}

/**
 * 克隆上下文并修改主体
 */
export function withSubject(ctx: MTPCContext, subject: SubjectContext): MTPCContext {
  return createContext({
    tenant: ctx.tenant,
    subject,
    request: ctx.request,
  });
}

/**
 * 克隆上下文并修改租户
 */
export function withTenant(ctx: MTPCContext, tenant: TenantContext): MTPCContext {
  return createContext({
    tenant,
    subject: ctx.subject,
    request: ctx.request,
  });
}

/**
 * 克隆上下文并添加权限
 */
export function withPermissions(ctx: MTPCContext, permissions: string[]): MTPCContext {
  return createContext({
    tenant: ctx.tenant,
    subject: {
      ...ctx.subject,
      permissions: [...(ctx.subject.permissions ?? []), ...permissions],
    },
    request: ctx.request,
  });
}

/**
 * 克隆上下文并添加角色
 */
export function withRoles(ctx: MTPCContext, roles: string[]): MTPCContext {
  return createContext({
    tenant: ctx.tenant,
    subject: {
      ...ctx.subject,
      roles: [...(ctx.subject.roles ?? []), ...roles],
    },
    request: ctx.request,
  });
}
