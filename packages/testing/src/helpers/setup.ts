import type { MTPCContext, SubjectContext } from '@mtpc/core';
import { createMockContext } from '../mocks/context.js';
import { createMockMTPC } from '../mocks/mtpc.js';
import { createMockSubject } from '../mocks/subject.js';
import { createMockTenant } from '../mocks/tenant.js';
import type { MockMTPC, TestContext } from '../types.js';

/**
 * 测试设置选项
 */
export interface SetupTestOptions {
  tenantId?: string;
  subjectId?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * 设置完整的测试上下文
 */
export function setupTest(options: SetupTestOptions = {}): TestContext {
  const mtpc = createMockMTPC();
  const tenant = createMockTenant(options.tenantId ?? 'test-tenant');
  const subject = createMockSubject({
    id: options.subjectId ?? 'test-user',
    roles: options.roles,
    permissions: options.permissions,
  });
  const ctx = createMockContext({ tenant, subject });

  // Grant permissions if provided
  if (options.permissions) {
    mtpc.grantPermissions(options.permissions, subject.id, tenant.id);
  }

  return { mtpc, tenant, subject, ctx };
}

/**
 * 设置管理员用户的测试
 */
export function setupAdminTest(tenantId?: string): TestContext {
  return setupTest({
    tenantId,
    subjectId: 'admin',
    roles: ['admin'],
    permissions: ['*'],
  });
}

/**
 * 设置查看者用户的测试
 */
export function setupViewerTest(resources: string[], tenantId?: string): TestContext {
  const permissions = resources.flatMap(r => [`${r}:read`, `${r}:list`]);
  return setupTest({
    tenantId,
    subjectId: 'viewer',
    roles: ['viewer'],
    permissions,
  });
}

/**
 * 设置访客/匿名用户的测试
 */
export function setupGuestTest(tenantId?: string): TestContext {
  const mtpc = createMockMTPC();
  const tenant = createMockTenant(tenantId ?? 'test-tenant');
  const subject: SubjectContext = {
    id: 'anonymous',
    type: 'anonymous',
    roles: [],
    permissions: [],
  };
  const ctx = createMockContext({ tenant, subject });

  return { mtpc, tenant, subject, ctx };
}

/**
 * 创建多场景测试工具
 */
export function createTestHarness(): {
  mtpc: MockMTPC;
  createContext: (subjectId: string, tenantId?: string) => MTPCContext;
  grantTo: (subjectId: string, permissions: string[], tenantId?: string) => void;
  reset: () => void;
} {
  const mtpc = createMockMTPC();
  const defaultTenant = createMockTenant('harness-tenant');

  return {
    mtpc,
    createContext(subjectId: string, tenantId?: string): MTPCContext {
      return createMockContext({
        tenant: { id: tenantId ?? defaultTenant.id },
        subject: { id: subjectId },
      });
    },
    grantTo(subjectId: string, permissions: string[], tenantId?: string): void {
      mtpc.grantPermissions(permissions, subjectId, tenantId ?? defaultTenant.id);
    },
    reset(): void {
      mtpc.reset();
    },
  };
}
