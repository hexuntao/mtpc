import type { MTPCContext, SubjectContext, TenantContext } from '@mtpc/core';
import { createContext } from '@mtpc/core';
import type { MockContextOptions } from '../types.js';
import { createAnonymousSubject, createMockSubject } from './subject.js';
import { createDefaultTenant, createMockTenant } from './tenant.js';

let requestCounter = 0;

/**
 * Create a mock MTPC context
 */
export function createMockContext(options: MockContextOptions = {}): MTPCContext {
  // Resolve tenant
  let tenant: TenantContext;
  if (!options.tenant) {
    tenant = createDefaultTenant();
  } else if (
    'id' in options.tenant &&
    typeof options.tenant.id === 'string' &&
    !('status' in options.tenant)
  ) {
    tenant = createMockTenant(options.tenant as { id: string });
  } else {
    tenant = options.tenant as TenantContext;
  }

  // Resolve subject
  let subject: SubjectContext;
  if (!options.subject) {
    subject = createAnonymousSubject();
  } else if (!('type' in options.subject)) {
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
 * Create context for a specific tenant and subject
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
 * Create context with full permissions
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
 * Create context with no permissions
 */
export function createGuestContext(tenantId?: string): MTPCContext {
  return createMockContext({
    tenant: tenantId ? { id: tenantId } : undefined,
    subject: createAnonymousSubject(),
  });
}

/**
 * Clone context with modified subject
 */
export function withSubject(ctx: MTPCContext, subject: SubjectContext): MTPCContext {
  return createContext({
    tenant: ctx.tenant,
    subject,
    request: ctx.request,
  });
}

/**
 * Clone context with modified tenant
 */
export function withTenant(ctx: MTPCContext, tenant: TenantContext): MTPCContext {
  return createContext({
    tenant,
    subject: ctx.subject,
    request: ctx.request,
  });
}

/**
 * Clone context with additional permissions
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
 * Clone context with additional roles
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
