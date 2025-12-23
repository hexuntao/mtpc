/**
 * MTPC Adapter Hono - 架构级测试
 *
 * 测试目标：
 * 1. Adapter 是翻译层，不绕过 Core 判定
 * 2. Tenant 解析失败时正确拒绝（不隐式使用 fallback）
 * 3. 中间件顺序正确
 *
 * ⚠️ 重要：这些测试验证 Adapter 层的架构承诺
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Context } from 'hono';

// Mock Hono 上下文
function createMockContext(overrides: Partial<{
  tenant: any;
  subject: any;
  mtpcContext: any;
  headers: Record<string, string>;
  path: string;
  method: string;
  param: (name: string) => string | undefined;
}> = {}): Context {
  const ctx = {
    get: (key: string) => {
      if (key === 'tenant') return overrides.tenant;
      if (key === 'subject') return overrides.subject;
      if (key === 'mtpcContext') return overrides.mtpcContext;
      return undefined;
    },
    set: vi.fn(),
    req: {
      header: (name?: string) => {
        if (!name) return overrides.headers;
        return overrides.headers?.[name] ?? overrides.headers?.[name.toLowerCase()];
      },
      path: overrides.path ?? '/api/test',
      method: overrides.method ?? 'GET',
      param: overrides.param ?? (() => undefined),
      json: async () => ({}),
    },
  } as unknown as Context;

  return ctx;
}

// ========== TC-HONO-001: Tenant 解析失败时拒绝 ==========

describe('TC-HONO-001: Tenant 解析失败时拒绝 [架构级测试 - Fail-safe]', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw MissingTenantContextError when tenant header is missing and required=true', async () => {
    const { tenantMiddleware } = await import('../middleware/tenant.js');

    const middleware = tenantMiddleware({ required: true });
    const ctx = createMockContext({
      headers: {}, // 无租户 header
    });
    const next = vi.fn();

    await expect(middleware(ctx, next)).rejects.toThrow('MissingTenantContextError');
    expect(next).not.toHaveBeenCalled();
  });

  it('should skip when tenant header is missing and required=false', async () => {
    const { tenantMiddleware } = await import('../middleware/tenant.js');

    const middleware = tenantMiddleware({ required: false });
    const ctx = createMockContext({
      headers: {},
    });
    const next = vi.fn();

    await middleware(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it('should use defaultTenantId when provided and no header', async () => {
    const { tenantMiddleware } = await import('../middleware/tenant.js');

    const middleware = tenantMiddleware({
      defaultTenantId: 'default-tenant',
    });
    const ctx = createMockContext({
      headers: {},
    });
    const next = vi.fn();

    await middleware(ctx, next);

    // 验证租户被设置为 default-tenant
    expect(ctx.set).toHaveBeenCalledWith('tenant', expect.objectContaining({
      id: 'default-tenant',
    }));
    expect(next).toHaveBeenCalled();
  });

  it('should reject invalid tenant ID format', async () => {
    const { tenantMiddleware } = await import('../middleware/tenant.js');

    const middleware = tenantMiddleware({ required: true });
    const ctx = createMockContext({
      headers: { 'x-tenant-id': '' }, // 空租户 ID
    });
    const next = vi.fn();

    await expect(middleware(ctx, next)).rejects.toThrow();
    expect(next).not.toHaveBeenCalled();
  });
});

// ========== TC-HONO-002: Core 权威性验证 ==========

describe('TC-HONO-002: Core 权威性验证 [架构级测试 - Core Authority]', () => {
  it('requirePermission should call mtpc.checkPermission', async () => {
    const { requirePermission } = await import('../middleware/permission.js');

    // Mock MTPC
    const mockMTPC = {
      checkPermission: vi.fn().mockResolvedValue({
        allowed: true,
        permission: 'user:read',
        reason: 'Direct permission on subject',
      }),
    };

    const ctx = createMockContext({
      tenant: { id: 'tenant-1' },
      subject: { id: 'user-1', type: 'user' },
      headers: {},
    });
    (ctx as any).get = function(key: string) {
      if (key === 'mtpc') return mockMTPC;
      if (key === 'tenant') return { id: 'tenant-1' };
      if (key === 'subject') return { id: 'user-1', type: 'user' };
      return undefined;
    };

    const next = vi.fn();
    const middleware = requirePermission('user', 'read');

    await middleware(ctx, next);

    // 验证调用了 Core 的 checkPermission
    expect(mockMTPC.checkPermission).toHaveBeenCalledWith({
      tenant: { id: 'tenant-1' },
      subject: { id: 'user-1', type: 'user' },
      resource: 'user',
      action: 'read',
    });
    expect(next).toHaveBeenCalled();
  });

  it('requirePermission should throw PermissionDeniedError when denied', async () => {
    const { requirePermission } = await import('../middleware/permission.js');

    const mockMTPC = {
      checkPermission: vi.fn().mockResolvedValue({
        allowed: false,
        permission: 'user:delete',
        reason: 'Permission not granted',
      }),
    };

    const ctx = createMockContext({
      tenant: { id: 'tenant-1' },
      subject: { id: 'user-1', type: 'user' },
    });
    (ctx as any).get = function(key: string) {
      if (key === 'mtpc') return mockMTPC;
      if (key === 'tenant') return { id: 'tenant-1' };
      if (key === 'subject') return { id: 'user-1', type: 'user' };
      return undefined;
    };

    const next = vi.fn();
    const middleware = requirePermission('user', 'delete');

    await expect(middleware(ctx, next)).rejects.toThrow('PermissionDeniedError');
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject when mtpc is not initialized', async () => {
    const { requirePermission } = await import('../middleware/permission.js');

    const ctx = createMockContext({
      tenant: { id: 'tenant-1' },
      subject: { id: 'user-1', type: 'user' },
    });
    (ctx as any).get = function(key: string) {
      if (key === 'mtpc') return undefined; // MTPC 未初始化
      return undefined;
    };

    const next = vi.fn();
    const middleware = requirePermission('user', 'read');

    await expect(middleware(ctx, next)).rejects.toThrow('MTPC not initialized');
  });
});

// ========== TC-HONO-003: 权限码解析安全性 ==========

describe('TC-HONO-003: 权限码解析安全性 [语义级测试]', () => {
  it('requireAllPermissions should throw on invalid permission code', async () => {
    const { requireAllPermissions } = await import('../middleware/permission.js');

    const mockMTPC = {
      checkPermission: vi.fn().mockResolvedValue({ allowed: true }),
    };

    const ctx = createMockContext({
      tenant: { id: 'tenant-1' },
      subject: { id: 'user-1', type: 'user' },
    });
    (ctx as any).get = function(key: string) {
      if (key === 'mtpc') return mockMTPC;
      return undefined;
    };

    const next = vi.fn();
    const middleware = requireAllPermissions('invalid-format');

    await expect(middleware(ctx, next)).rejects.toThrow('Invalid permission code');
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAnyPermission should skip invalid codes and check valid ones', async () => {
    const { requireAnyPermission } = await import('../middleware/permission.js');

    const checkResults: any[] = [];
    const mockMTPC = {
      checkPermission: vi.fn().mockImplementation(({ resource, action }) => {
        const result = { allowed: action === 'read', permission: `${resource}:${action}` };
        checkResults.push(result);
        return Promise.resolve(result);
      }),
    };

    const ctx = createMockContext({
      tenant: { id: 'tenant-1' },
      subject: { id: 'user-1', type: 'user' },
    });
    (ctx as any).get = function(key: string) {
      if (key === 'mtpc') return mockMTPC;
      return undefined;
    };

    const next = vi.fn();
    // 无效的权限码 + 有效的权限码
    const middleware = requireAnyPermission('invalid-format', 'user:read', 'also-invalid');

    await middleware(ctx, next);

    // 应该跳过无效的，只检查有效的
    expect(mockMTPC.checkPermission).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalled();
  });
});

// ========== TC-HONO-004: Tenant 隔离验证 ==========

describe('TC-HONO-004: Tenant 上下文隔离 [架构级测试 - Tenant Isolation]', () => {
  it('should not leak tenant between requests', async () => {
    const { tenantMiddleware } = await import('../middleware/tenant.js');

    const middleware = tenantMiddleware({ headerName: 'x-tenant-id' });

    // 请求 1：租户 A
    const ctx1 = createMockContext({
      headers: { 'x-tenant-id': 'tenant-A' },
    });
    const next1 = vi.fn();
    await middleware(ctx1, next1);

    const tenant1 = (ctx1 as any).get('tenant');
    expect(tenant1.id).toBe('tenant-A');

    // 请求 2：租户 B（使用新上下文，模拟新请求）
    const ctx2 = createMockContext({
      headers: { 'x-tenant-id': 'tenant-B' },
    });
    const next2 = vi.fn();
    await middleware(ctx2, next2);

    const tenant2 = (ctx2 as any).get('tenant');
    expect(tenant2.id).toBe('tenant-B');

    // 验证租户 A 和租户 B 是隔离的
    expect(tenant1.id).not.toBe(tenant2.id);
  });

  it('should isolate tenant from path parameter', async () => {
    const { tenantFromPathMiddleware } = await import('../middleware/tenant.js');

    const middleware = tenantFromPathMiddleware({
      paramName: 'tenantId',
      required: true,
    });

    const ctx = createMockContext({
      path: '/api/tenant-123/users',
    });
    (ctx as any).req.param = (name: string) => {
      if (name === 'tenantId') return 'tenant-123';
      return undefined;
    };
    const next = vi.fn();

    await middleware(ctx, next);

    const tenant = (ctx as any).get('tenant');
    expect(tenant.id).toBe('tenant-123');
  });
});

// ========== TC-HONO-005: getTenant/getSubject 安全性 ==========

describe('TC-HONO-005: getTenant/getSubject 安全性 [架构级测试 - Fail-safe]', () => {
  it('getTenant should return tenant from context', async () => {
    const { getTenant, setTenant } = await import('../context/mtpc-context.js');

    const ctx = createMockContext({
      tenant: { id: 'tenant-1' },
    });
    setTenant(ctx, { id: 'tenant-1' });

    const tenant = getTenant(ctx);
    expect(tenant.id).toBe('tenant-1');
  });

  it('getSubject should return ANONYMOUS_SUBJECT when not set', async () => {
    const { getSubject } = await import('../context/mtpc-context.js');

    const ctx = createMockContext({
      subject: undefined,
    });

    const subject = getSubject(ctx);
    expect(subject.type).toBe('anonymous');
    expect(subject.id).toBe('anonymous');
  });

  it('should not create MTPCContext when mtpc is not available', async () => {
    const { requirePermission } = await import('../middleware/permission.js');

    const ctx = createMockContext({
      tenant: { id: 'tenant-1' },
      subject: { id: 'user-1', type: 'user' },
    });
    (ctx as any).get = function(key: string) {
      if (key === 'mtpc') return undefined;
      if (key === 'tenant') return { id: 'tenant-1' };
      if (key === 'subject') return { id: 'user-1', type: 'user' };
      return undefined;
    };

    const next = vi.fn();
    const middleware = requirePermission('user', 'read');

    // 应该抛出错误，而不是静默失败
    await expect(middleware(ctx, next)).rejects.toThrow('MTPC not initialized');
  });
});

// ========== 组合测试：高风险场景 ==========

describe('组合测试：高风险场景演练', () => {
  it('TC-COMBO-004: Adapter 无法绕过 Core 判定', async () => {
    // 模拟一个恶意用户尝试绕过权限检查的场景
    const { requirePermission } = await import('../middleware/permission.js');

    const mockMTPC = {
      checkPermission: vi.fn().mockResolvedValue({
        allowed: false,
        permission: 'admin:delete',
        reason: 'Permission not granted',
      }),
    };

    const ctx = createMockContext({
      tenant: { id: 'tenant-1' },
      subject: { id: 'hacker', type: 'user' },
    });
    (ctx as any).get = function(key: string) {
      if (key === 'mtpc') return mockMTPC;
      return undefined;
    };

    const next = vi.fn();
    const middleware = requirePermission('admin', 'delete');

    // 即使直接调用中间件，也会被 Core 拒绝
    await expect(middleware(ctx, next)).rejects.toThrow('PermissionDeniedError');
    expect(next).not.toHaveBeenCalled();

    // 验证 Core 的 checkPermission 被正确调用
    expect(mockMTPC.checkPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'admin',
        action: 'delete',
      })
    );
  });

  it('TC-COMBO-005: 多中间件顺序不影响权限结果', async () => {
    const { tenantMiddleware, requirePermission } = await import('../middleware/index.js');

    // 场景：先设置租户，再检查权限
    const mockMTPC = {
      checkPermission: vi.fn().mockResolvedValue({ allowed: true }),
    };

    const ctx = createMockContext({
      headers: { 'x-tenant-id': 'tenant-1' },
    });
    (ctx as any).get = function(key: string) {
      if (key === 'mtpc') return mockMTPC;
      if (key === 'tenant') return { id: 'tenant-1' };
      if (key === 'subject') return { id: 'user-1', type: 'user' };
      return undefined;
    };

    // 执行 tenant 中间件
    const tenantMw = tenantMiddleware();
    await tenantMw(ctx, vi.fn());

    // 执行权限中间件
    const permMw = requirePermission('user', 'read');
    await permMw(ctx, vi.fn());

    // 验证权限检查使用正确的租户
    expect(mockMTPC.checkPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: { id: 'tenant-1' },
      })
    );
  });
});
