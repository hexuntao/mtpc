# MTPC 示例应用完整开发计划

> 本文档详细描述 `apps/example-api` 和 `apps/example-web` 的完整开发方案，基于 MTPC 架构设计。

## 文档信息

- **创建日期**: 2025-12-24
- **版本**: 1.0.0
- **状态**: 待确认

---

# 第一部分：架构深度分析

## 1.1 MTPC Core 核心架构分析

### 核心模块结构

```
@mtpc/core
├── mtpc.ts                 # 主入口类，协调所有子系统
├── resource/               # 资源系统
│   ├── builder.ts          # 资源构建器
│   ├── define.ts           # 资源定义函数
│   ├── validator.ts        # 资源验证器
│   └── utils.ts            # 资源工具函数
├── permission/             # 权限系统
│   ├── checker.ts          # 权限检查器
│   ├── generate.ts         # 权限生成器
│   └── utils.ts            # 权限工具函数
├── policy/                 # 策略系统
│   ├── builder.ts          # 策略构建器
│   ├── compiler.ts         # 策略编译器
│   ├── engine.ts           # 策略引擎
│   └── conditions.ts       # 条件评估
├── tenant/                 # 租户系统
│   ├── manager.ts          # 租户管理器
│   ├── resolver.ts         # 租户解析器
│   └── context.ts          # 租户上下文
├── registry/               # 注册表系统
│   ├── unified-registry.ts # 统一注册表
│   ├── resource-registry.ts
│   ├── permission-registry.ts
│   └── policy-registry.ts
├── plugin/                 # 插件系统
│   ├── manager.ts          # 插件管理器
│   └── context.ts          # 插件上下文
├── hooks/                  # 钩子系统
│   ├── global.ts           # 全局钩子管理器
│   └── executor.ts         # 钩子执行器
└── types/                  # 类型定义
    ├── common.ts
    ├── context.ts
    ├── features.ts
    ├── hooks.ts
    ├── permission.ts
    ├── policy.ts
    ├── resource.ts
    └── tenant.ts
```

### MTPC 主类核心职责

```typescript
class MTPC {
  // 子系统引用
  readonly registry: UnifiedRegistry;      // 注册表系统
  readonly policyEngine: DefaultPolicyEngine;  // 策略引擎
  readonly permissionChecker: PermissionChecker;  // 权限检查器
  readonly globalHooks: GlobalHooksManager;  // 全局钩子管理器
  readonly plugins: DefaultPluginManager;  // 插件管理器
  readonly tenants: TenantManager;         // 租户管理器

  // 核心方法
  registerResource(resource): this;        // 注册资源
  registerPolicy(policy): this;            // 注册策略
  use(plugin): this;                       // 注册插件
  async init(): Promise<this>;             // 初始化
  createContext(tenant, subject): MTPCContext;  // 创建上下文
  async checkPermission(context): Promise<PermissionCheckResult>;  // 检查权限
  async requirePermission(context): Promise<void>;  // 要求权限
  exportMetadata(): Metadata;              // 导出元数据
}
```

---

## 1.2 扩展包架构分析

### @mtpc/rbac - RBAC 扩展

```
@mtpc/rbac
├── rbac.ts                 # RBAC 主类
├── role/                   # 角色管理
│   ├── builder.ts          # 角色构建器
│   └── manager.ts          # 角色管理器
├── binding/                # 角色绑定
│   └── manager.ts          # 绑定管理器
├── policy/                 # 策略评估
│   └── evaluator.ts        # RBAC 评估器
├── store/                  # 存储后端
│   └── memory-store.ts     # 内存存储实现
├── types.ts                # 类型定义
└── plugin.ts               # MTPC 插件集成
```

**核心功能**:
- 角色管理 (createRole, updateRole, deleteRole, getRole, listRoles)
- 角色绑定 (assignRole, revokeRole, getSubjectRoles, hasRole)
- 权限检查 (check, checkPermission, getPermissions, getEffectivePermissions)
- 缓存管理 (invalidateCache, clearCache)

**系统角色**:
- `super_admin`: 超级管理员，拥有所有权限 (*)
- `tenant_admin`: 租户管理员
- `viewer`: 访客角色，只读权限

### @mtpc/policy-cache - 策略缓存扩展

用于优化 Policy Evaluation 的运行时性能：
- Tenant 级 Policy Snapshot
- Policy Version/Revision 管理
- 权限变更后的精确失效机制

### @mtpc/explain - 权限决策解释扩展

提供对权限决策过程的解释能力：
- 为什么请求被允许/拒绝？
- 哪条 Policy/哪个 Role 生效？
- 在哪个条件被拒绝？

---

## 1.3 Adapter 层架构分析

### @mtpc/adapter-hono - Hono 框架适配器

```
@mtpc/adapter-hono
├── middleware/             # 中间件
│   ├── mtpc.ts             # MTPC 上下文注入
│   ├── tenant.ts           # 租户中间件
│   ├── auth.ts             # 认证中间件
│   ├── permission.ts       # 权限中间件
│   └── error-handler.ts    # 错误处理
├── routes/                 # 路由
│   ├── crud-routes.ts      # CRUD 路由生成
│   └── rpc-routes.ts       # RPC 路由
├── context/                # 上下文管理
│   └── mtpc-context.ts     # MTPC 上下文
├── factory.ts              # 应用工厂
├── rpc/                    # RPC 模块
└── types.ts                # 类型定义
```

**核心中间件**:

| 中间件 | 职责 | 使用场景 |
|--------|------|----------|
| `mtpcMiddleware` | 注入 MTPC 实例 | 全局使用 |
| `tenantMiddleware` | 从 header 解析租户 | 多租户隔离 |
| `authMiddleware` | 解析用户身份 | 认证 |
| `requirePermission` | 权限检查 | 授权 |
| `requireAnyPermission` | OR 逻辑权限检查 | 多权限任一 |
| `requireAllPermissions` | AND 逻辑权限检查 | 多权限全部 |
| `requireResourcePermission` | 资源实例级权限 | 行级权限 |

### @mtpc/adapter-drizzle - Drizzle ORM 适配器

```
@mtpc/adapter-drizzle
├── handler/                # 处理器
│   ├── crud-handler.ts     # CRUD 处理器
│   └── factory.ts          # 处理器工厂
├── schema/                 # Schema 生成
│   └── generator.ts        # 表生成器
├── repository/             # 仓储模式
│   └── base-repository.ts  # 基础仓储
├── query/                  # 查询构建
│   └── builder.ts          # 查询构建器
├── pg/                     # PostgreSQL
│   ├── connection.ts       # 连接管理
│   └── migrations.ts       # 迁移系统
└── types.ts                # 类型定义
```

**核心功能**:
- `generateAllTables(resources)`: 从 Resource 定义生成 Drizzle 表
- `DrizzleCRUDHandler`: CRUD 操作处理器
- 自动支持时间戳、审计字段、软删除

---

# 第二部分：example-api 完整开发方案

## 2.1 项目现状分析

### 当前结构

```
apps/example-api
├── src/
│   ├── index.ts            # 入口文件
│   ├── app.ts              # Hono 应用配置
│   ├── mtpc.ts             # MTPC 初始化
│   ├── resources.ts        # 资源定义
│   ├── config/
│   │   └── config.ts       # 配置文件
│   ├── db/
│   │   ├── schema.ts       # 数据库 Schema
│   │   ├── connection.ts   # 数据库连接
│   │   └── migrations.ts   # 迁移脚本
│   ├── routes/
│   │   ├── index.ts        # 路由聚合
│   │   ├── products.ts     # 产品路由
│   │   ├── orders.ts       # 订单路由
│   │   ├── customers.ts    # 客户路由
│   │   └── roles.ts        # 角色路由
│   ├── utils/
│   │   ├── response.ts     # 响应工具
│   │   └── jwt.ts          # JWT 工具
│   └── seed.ts             # 种子数据
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### 已实现功能

| 模块 | 状态 | 说明 |
|------|------|------|
| MTPC 初始化 | ✅ | 已完成，包含 Core + RBAC |
| 资源定义 | ✅ | Product、Order、Customer |
| 数据库 Schema | ✅ | 通过 Drizzle 生成 |
| CRUD 路由 | ✅ | 产品、订单、客户 |
| 角色管理 | ✅ | 创建、分配、撤销角色 |
| 权限检查 | ✅ | 使用 requirePermission 中间件 |
| 健康检查 | ✅ | /health 端点 |
| 元数据端点 | ✅ | /api/metadata |

### 待完善功能

| 模块 | 状态 | 说明 |
|------|------|------|
| 用户认证 | ❌ | 需要实现 JWT 认证 |
| 数据库持久化 | ⚠️ | 角色数据使用内存存储 |
| 完整测试 | ❌ | 需要补充单元测试和集成测试 |
| API 文档 | ❌ | 需要添加 Swagger/OpenAPI |
| 错误处理优化 | ⚠️ | 需要更详细的错误信息 |
| 日志系统 | ❌ | 需要添加结构化日志 |
| 数据验证 | ⚠️ | 需要加强输入验证 |

---

## 2.2 完整开发方案

### 阶段一：完善核心功能 (Week 1)

#### 1.1 用户认证系统

**实现 JWT 认证中间件**

```typescript
// src/middleware/auth.ts
import { MiddlewareHandler } from 'hono';
import { verify } from './utils/jwt';

export interface AuthConfig {
  secret: string;
  headerName?: string;
}

export function jwtAuth(config: AuthConfig): MiddlewareHandler {
  return async (c, next) => {
    const token = c.req.header(config.headerName || 'Authorization')?.replace('Bearer ', '');

    if (!token) {
      return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } }, 401);
    }

    try {
      const payload = await verify(token, config.secret);
      c.set('user', payload);
      await next();
    } catch (error) {
      return c.json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } }, 401);
    }
  };
}
```

**实现认证路由**

```typescript
// src/routes/auth.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sign } from '../utils/jwt';
import { rbac } from '../mtpc';

export const authRoutes = new Hono();

// 登录
authRoutes.post('/login', zValidator('json', z.object({
  email: z.string().email(),
  password: z.string().min(8),
})), async c => {
  const { email, password } = c.req.valid('json');
  const tenantId = c.req.header('x-tenant-id') ?? 'default';

  // TODO: 实际项目中应该查询数据库验证密码
  // 这里简化处理，直接根据 email 生成 token
  const userId = `user-${email.split('@')[0]}`;

  // 获取用户权限
  const permissions = await rbac.getPermissions(tenantId, 'user', userId);
  const roles = (await rbac.getSubjectRoles(tenantId, 'user', userId)).map(b => b.roleId);

  const token = await sign({
    userId,
    email,
    tenantId,
    roles,
  }, process.env.JWT_SECRET!);

  return c.json({
    success: true,
    data: {
      token,
      user: { userId, email, roles },
    },
  });
});

// 刷新令牌
authRoutes.post('/refresh', async c => {
  const tenantId = c.req.header('x-tenant-id') ?? 'default';
  const userId = c.req.header('x-user-id');

  if (!userId) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing user ID' } }, 401);
  }

  const permissions = await rbac.getPermissions(tenantId, 'user', userId);
  const roles = (await rbac.getSubjectRoles(tenantId, 'user', userId)).map(b => b.roleId);

  const token = await sign({
    userId,
    tenantId,
    roles,
  }, process.env.JWT_SECRET!);

  return c.json({ success: true, data: { token } });
});
```

#### 1.2 数据库持久化

**实现 RBAC 数据库存储**

```typescript
// src/db/rbac-schema.ts
import { pgTable, text, timestamp, uuid, boolean } from 'drizzle-orm/pg-core';

export const roles = pgTable('mtpc_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  displayName: text('display_name'),
  description: text('description'),
  permissions: text('permissions').array().notNull().default([]),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by'),
});

export const roleBindings = pgTable('mtpc_role_bindings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  roleId: text('role_id').notNull(),
  subjectType: text('subject_type').notNull(), // 'user', 'group', 'service'
  subjectId: text('subject_id').notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: text('created_by'),
});
```

**实现数据库 RBAC Store**

```typescript
// src/store/database-rbac-store.ts
import { RBACStore, RoleDefinition, RoleBinding } from '@mtpc/rbac';
import { db } from '../db/connection';
import { roles, roleBindings } from '../db/rbac-schema';
import { eq, and } from 'drizzle-orm';

export class DatabaseRBACStore implements RBACStore {
  async getRole(tenantId: string, roleId: string): Promise<RoleDefinition | null> {
    const result = await db.select().from(roles)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.name, roleId)))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      roleId: row.name,
      tenantId: row.tenantId,
      displayName: row.displayName ?? row.name,
      description: row.description ?? '',
      permissions: new Set(row.permissions),
      isSystem: row.isSystem,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listRoles(tenantId: string): Promise<RoleDefinition[]> {
    const result = await db.select().from(roles).where(eq(roles.tenantId, tenantId));
    return result.map(row => ({
      id: row.id,
      roleId: row.name,
      tenantId: row.tenantId,
      displayName: row.displayName ?? row.name,
      description: row.description ?? '',
      permissions: new Set(row.permissions),
      isSystem: row.isSystem,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async createRole(tenantId: string, role: RoleDefinition): Promise<void> {
    await db.insert(roles).values({
      id: role.id,
      tenantId: role.tenantId,
      name: role.roleId,
      displayName: role.displayName,
      description: role.description,
      permissions: Array.from(role.permissions),
      isSystem: role.isSystem ?? false,
      createdBy: role.createdBy,
    });
  }

  async updateRole(tenantId: string, roleId: string, updates: Partial<RoleDefinition>): Promise<void> {
    // 实现更新逻辑
  }

  async deleteRole(tenantId: string, roleId: string): Promise<void> {
    await db.delete(roles).where(and(eq(roles.tenantId, tenantId), eq(roles.name, roleId)));
  }

  async getBinding(tenantId: string, roleId: string, subjectType: string, subjectId: string): Promise<RoleBinding | null> {
    const result = await db.select().from(roleBindings)
      .where(
        and(
          eq(roleBindings.tenantId, tenantId),
          eq(roleBindings.roleId, roleId),
          eq(roleBindings.subjectType, subjectType),
          eq(roleBindings.subjectId, subjectId)
        )
      )
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      roleId: row.roleId,
      subjectType: row.subjectType as any,
      subjectId: row.subjectId,
      expiresAt: row.expiresAt ?? undefined,
      createdAt: row.createdAt,
    };
  }

  async listBindings(tenantId: string, subjectType: string, subjectId: string): Promise<RoleBinding[]> {
    const result = await db.select().from(roleBindings)
      .where(
        and(
          eq(roleBindings.tenantId, tenantId),
          eq(roleBindings.subjectType, subjectType),
          eq(roleBindings.subjectId, subjectId)
        )
      );
    return result.map(row => ({
      id: row.id,
      tenantId: row.tenantId,
      roleId: row.roleId,
      subjectType: row.subjectType as any,
      subjectId: row.subjectId,
      expiresAt: row.expiresAt ?? undefined,
      createdAt: row.createdAt,
    }));
  }

  async createBinding(tenantId: string, binding: RoleBinding): Promise<void> {
    await db.insert(roleBindings).values({
      id: binding.id,
      tenantId: binding.tenantId,
      roleId: binding.roleId,
      subjectType: binding.subjectType,
      subjectId: binding.subjectId,
      expiresAt: binding.expiresAt,
      createdBy: binding.createdBy,
    });
  }

  async deleteBinding(tenantId: string, roleId: string, subjectType: string, subjectId: string): Promise<void> {
    await db.delete(roleBindings)
      .where(
        and(
          eq(roleBindings.tenantId, tenantId),
          eq(roleBindings.roleId, roleId),
          eq(roleBindings.subjectType, subjectType),
          eq(roleBindings.subjectId, subjectId)
        )
      );
  }
}
```

### 阶段二：API 文档与测试 (Week 2)

#### 2.1 OpenAPI/Swagger 文档

```typescript
// src/docs/openapi.ts
import { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';

const openApi = new OpenAPIHono();

// 产品列表 API 文档
const listProductsRoute = createRoute({
  method: 'get',
  path: '/api/products',
  tags: ['products'],
  summary: '获取产品列表',
  description: '分页获取所有产品，需要 product:list 权限',
  request: {
    query: z.object({
      page: z.string().optional().default('1').describe('页码'),
      pageSize: z.string().optional().default('20').describe('每页数量'),
    }),
  },
  responses: {
    200: {
      description: '成功',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              data: z.array(z.object({
                id: z.string().uuid(),
                name: z.string(),
                price: z.number(),
                status: z.enum(['active', 'inactive', 'discontinued']),
              })),
              total: z.number(),
              page: z.number(),
              pageSize: z.number(),
            }),
          }),
        },
      },
    },
    401: {
      description: '未授权',
    },
    403: {
      description: '权限不足',
    },
  },
});

openApi.openapi(listProductsRoute, async c => {
  // 实现逻辑...
});

// 生成 OpenAPI 文档
openApi.doc('/doc', {
  openapi: '3.0.0',
  info: {
    title: 'MTPC Example API',
    version: '1.0.0',
    description: 'MTPC 多租户权限系统示例 API',
  },
  servers: [
    { url: 'http://localhost:3000', description: '本地开发服务器' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
  },
  security: [{ BearerAuth: [] }],
});
```

#### 2.2 完善测试

```typescript
// src/tests/integration/products.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../app';
import { db } from '../db/connection';
import { runMigrations } from '../db/migrations';

describe('Products API Integration Tests', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  afterAll(async () => {
    // 清理测试数据
  });

  describe('GET /api/products', () => {
    it('should return products list with valid permission', async () => {
      const res = await app.request('/api/products', {
        headers: {
          'x-tenant-id': 'test-tenant',
          'x-user-id': 'user-manager',
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.data).toBeInstanceOf(Array);
    });

    it('should return 403 without permission', async () => {
      const res = await app.request('/api/products', {
        headers: {
          'x-tenant-id': 'test-tenant',
          'x-user-id': 'user-viewer',
        },
      });

      expect(res.status).toBe(200); // viewer 有 read 权限
    });
  });

  describe('POST /api/products', () => {
    it('should create product with permission', async () => {
      const newProduct = {
        name: 'Test Product',
        price: 99.99,
        sku: 'TEST-001',
      };

      const res = await app.request('/api/products', {
        method: 'POST',
        headers: {
          'x-tenant-id': 'test-tenant',
          'x-user-id': 'user-manager',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProduct),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Test Product');
    });

    it('should return 403 without create permission', async () => {
      const res = await app.request('/api/products', {
        method: 'POST',
        headers: {
          'x-tenant-id': 'test-tenant',
          'x-user-id': 'user-viewer',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Test', price: 10, sku: 'X' }),
      });

      expect(res.status).toBe(403);
    });
  });
});
```

### 阶段三：高级功能 (Week 3)

#### 3.1 权限解释端点

```typescript
// src/routes/explain.ts
import { Hono } from 'hono';
import { getMTPCContext } from '@mtpc/adapter-hono';

export const explainRoutes = new Hono();

// 权限解释端点
explainRoutes.post('/explain', async c => {
  const mtpc = c.get('mtpc');
  const ctx = getMTPCContext(c);
  const body = await c.req.json();

  const result = await mtpc.checkPermission({
    ...ctx,
    resource: body.resource,
    action: body.action,
    resourceId: body.resourceId,
  });

  return c.json({
    success: true,
    data: {
      allowed: result.allowed,
      permission: result.permission,
      reason: result.reason,
      evaluationTime: result.evaluationTime,
      context: {
        tenantId: ctx.tenant.id,
        subjectId: ctx.subject.id,
        subjectType: ctx.subject.type,
      },
    },
  });
});
```

#### 3.2 批量操作

```typescript
// src/routes/products-bulk.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requirePermission } from '@mtpc/adapter-hono';

export const productBulkRoutes = new Hono();

// 批量创建
productBulkRoutes.post(
  '/bulk',
  requirePermission('product', 'create'),
  zValidator('json', z.object({
    products: z.array(z.object({
      name: z.string().min(1).max(200),
      price: z.number().positive(),
      sku: z.string().min(1).max(50),
    })).min(1).max(100),
  })),
  async c => {
    const ctx = getMTPCContext(c);
    const { products } = c.req.valid('json');

    const results = [];
    for (const product of products) {
      try {
        const result = await handler.create(ctx, product);
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ success: false, error: (error as Error).message });
      }
    }

    return c.json({
      success: true,
      data: {
        total: products.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      },
    });
  }
);

// 批量更新
productBulkRoutes.put(
  '/bulk',
  requirePermission('product', 'update'),
  zValidator('json', z.object({
    updates: z.array(z.object({
      id: z.string().uuid(),
      price: z.number().positive().optional(),
      status: z.enum(['active', 'inactive', 'discontinued']).optional(),
    })).min(1).max(100),
  })),
  async c => {
    // 实现批量更新逻辑
  }
);
```

#### 3.3 搜索与过滤

```typescript
// src/routes/products-search.ts
import { Hono } from 'hono';
import { requirePermission } from '@mtpc/adapter-hono';

export const productSearchRoutes = new Hono();

productSearchRoutes.get('/search', requirePermission('product', 'list'), async c => {
  const ctx = getMTPCContext(c);
  const query = c.req.query();

  const filters = {
    search: query.search,
    category: query.category,
    status: query.status,
    minPrice: query.minPrice ? Number(query.minPrice) : undefined,
    maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
    inStock: query.inStock === 'true',
  };

  // 使用 Drizzle 查询构建器
  const result = await handler.list(ctx, {
    page: Number(query.page) || 1,
    pageSize: Number(query.pageSize) || 20,
    filters,
  });

  return c.json({ success: true, data: result });
});
```

### 阶段四：部署与监控 (Week 4)

#### 4.1 Docker 配置

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/mtpc
      - JWT_SECRET=your-secret-key
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=mtpc
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

# 第三部分：example-web 完整开发方案

## 3.1 项目现状分析

### 当前结构

```
apps/example-web
├── src/
│   ├── main.tsx            # 入口
│   ├── App.tsx             # 主应用组件
│   ├── styles.css          # 样式
│   ├── components/
│   │   ├── ResourceView.tsx    # 资源视图
│   │   ├── PermissionsView.tsx # 权限视图
│   │   └── RolesView.tsx       # 角色视图
│   ├── hooks/
│   │   └── usePermissions.ts   # 权限 Hook
│   └── api/
│       └── client.ts           # API 客户端
├── package.json
├── vite.config.ts
└── index.html
```

### 已实现功能

| 模块 | 状态 | 说明 |
|------|------|------|
| 基础布局 | ✅ | 导航、侧边栏 |
| 权限 Hook | ✅ | usePermissions |
| API 客户端 | ✅ | 基础请求封装 |
| 资源视图 | ✅ | 列表展示 |
| 角色视图 | ✅ | 角色列表与分配 |
| 权限视图 | ✅ | 当前用户权限展示 |
| 用户切换 | ✅ | 演示用用户切换器 |

### 待完善功能

| 模块 | 状态 | 说明 |
|------|------|------|
| CRUD 表单 | ❌ | 创建、编辑表单 |
| 详情页面 | ❌ | 单条记录详情 |
| 删除确认 | ❌ | 删除操作确认 |
| 搜索过滤 | ❌ | 列表搜索与过滤 |
| 分页组件 | ❌ | 列表分页 |
| 错误处理 | ⚠️ | 需要统一错误处理 |
| 加载状态 | ⚠️ | 需要优化加载体验 |
| Toast 通知 | ❌ | 操作反馈 |
| 角色管理 | ⚠️ | 创建、编辑角色 |
| 权限矩阵 | ❌ | 可视化权限配置 |

---

## 3.2 完整开发方案

### 阶段一：完善核心组件 (Week 1)

#### 1.1 通用组件库

**按钮组件**

```typescript
// src/components/ui/Button.tsx
import type React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses = 'btn';
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
  };
  const sizeClasses = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="spinner" />}
      {children}
    </button>
  );
}
```

**表单组件**

```typescript
// src/components/ui/Form.tsx
import type React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <input className={`form-input ${error ? 'form-input-error' : ''} ${className}`.trim()} {...props} />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export function Select({ label, error, options, className = '', ...props }: SelectProps) {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <select className={`form-select ${error ? 'form-select-error' : ''} ${className}`.trim()} {...props}>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
```

**Toast 通知**

```typescript
// src/components/ui/Toast.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  show: (type: ToastType, message: string, duration?: number) => void;
  hide: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, type, message, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const hide = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, show, hide }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
            <button onClick={() => hide(toast.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
```

#### 1.2 资源管理页面

```typescript
// src/pages/ProductsPage.tsx
import { useState } from 'react';
import { ResourceView } from '../components/ResourceView';
import { ProductForm } from '../components/forms/ProductForm';
import { ProductDetail } from '../components/details/ProductDetail';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

export function ProductsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const { show: showToast } = useToast();

  const handleCreate = async (data: any) => {
    try {
      const result = await api.createProduct(data);
      if (result.success) {
        showToast('success', '产品创建成功');
        setShowCreateModal(false);
        // 刷新列表
      }
    } catch (error) {
      showToast('error', '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个产品吗？')) return;

    try {
      const result = await api.deleteProduct(id);
      if (result.success) {
        showToast('success', '产品已删除');
        // 刷新列表
      }
    } catch (error) {
      showToast('error', '删除失败');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>产品管理</h1>
        <Button onClick={() => setShowCreateModal(true)}>+ 新建产品</Button>
      </div>

      <ResourceView
        resource="product"
        onView={id => {
          setSelectedProductId(id);
          setShowDetailModal(true);
        }}
        onDelete={handleDelete}
      />

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="新建产品">
        <ProductForm onSubmit={handleCreate} onCancel={() => setShowCreateModal(false)} />
      </Modal>

      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="产品详情">
        {selectedProductId && <ProductDetail productId={selectedProductId} />}
      </Modal>
    </div>
  );
}
```

### 阶段二：表单与详情 (Week 2)

#### 2.1 产品表单

```typescript
// src/components/forms/ProductForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../ui/Form';
import { Button } from '../ui/Button';

const productSchema = z.object({
  name: z.string().min(1, '产品名称不能为空').max(200, '产品名称不能超过200字符'),
  description: z.string().optional(),
  price: z.number().positive('价格必须大于0'),
  sku: z.string().min(1, 'SKU不能为空').max(50, 'SKU不能超过50字符'),
  category: z.string().optional(),
  status: z.enum(['active', 'inactive', 'discontinued']),
  stock: z.number().int().min(0, '库存不能为负数'),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormProps {
  initialValues?: Partial<ProductFormValues>;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  onCancel: () => void;
}

export function ProductForm({ initialValues, onSubmit, onCancel }: ProductFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: initialValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="form">
      <Input label="产品名称" {...register('name')} error={errors.name?.message} />
      <Input label="描述" {...register('description')} error={errors.description?.message} />
      <Input label="价格" type="number" step="0.01" {...register('price', { valueAsNumber: true })} error={errors.price?.message} />
      <Input label="SKU" {...register('sku')} error={errors.sku?.message} />
      <Input label="分类" {...register('category')} error={errors.category?.message} />
      <div className="form-group">
        <label className="form-label">状态</label>
        <select className="form-select" {...register('status')}>
          <option value="active">上架</option>
          <option value="inactive">下架</option>
          <option value="discontinued">停产</option>
        </select>
      </div>
      <Input label="库存" type="number" {...register('stock', { valueAsNumber: true })} error={errors.stock?.message} />

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" loading={isSubmitting}>
          保存
        </Button>
      </div>
    </form>
  );
}
```

#### 2.2 产品详情

```typescript
// src/components/details/ProductDetail.tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Button } from '../ui/Button';

interface ProductDetailProps {
  productId: string;
}

export function ProductDetail({ productId }: ProductDetailProps) {
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => api.getProduct(productId),
  });

  const { canAccess } = usePermissions();

  if (isLoading) return <div className="loading">加载中...</div>;
  if (error || !product?.data) return <div className="error">加载失败</div>;

  const p = product.data;

  return (
    <div className="detail-view">
      <div className="detail-header">
        <h2>{p.name}</h2>
        <div className="detail-actions">
          {canAccess('product:update') && (
            <Button variant="secondary" size="sm">
              编辑
            </Button>
          )}
          {canAccess('product:delete') && (
            <Button variant="danger" size="sm">
              删除
            </Button>
          )}
        </div>
      </div>

      <div className="detail-content">
        <div className="detail-section">
          <h3>基本信息</h3>
          <dl className="detail-list">
            <dt>SKU</dt>
            <dd>{p.sku}</dd>
            <dt>价格</dt>
            <dd>¥{p.price.toFixed(2)}</dd>
            <dt>状态</dt>
            <dd>
              <span className={`status-badge status-${p.status}`}>{p.status}</span>
            </dd>
            <dt>库存</dt>
            <dd>{p.stock}</dd>
          </dl>
        </div>

        <div className="detail-section">
          <h3>描述</h3>
          <p>{p.description || '无描述'}</p>
        </div>

        <div className="detail-section">
          <h3>元数据</h3>
          <dl className="detail-list">
            <dt>创建时间</dt>
            <dd>{new Date(p.createdAt).toLocaleString()}</dd>
            <dt>更新时间</dt>
            <dd>{new Date(p.updatedAt).toLocaleString()}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
```

### 阶段三：角色与权限管理 (Week 3)

#### 3.1 角色管理页面

```typescript
// src/pages/RolesPage.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { RoleForm } from '../components/forms/RoleForm';
import { RolePermissionsMatrix } from '../components/RolePermissionsMatrix';

export function RolesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.listRoles(),
  });

  const assignMutation = useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      api.assignRole(roleId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      api.revokeRole(roleId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  if (isLoading) return <div className="loading">加载中...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>角色管理</h1>
        <Button onClick={() => setShowCreateModal(true)}>+ 新建角色</Button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>角色名称</th>
            <th>显示名称</th>
            <th>权限数量</th>
            <th>系统角色</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {roles?.data?.map((role: any) => (
            <tr key={role.id}>
              <td>{role.name}</td>
              <td>{role.displayName || role.name}</td>
              <td>{role.permissions?.length || 0}</td>
              <td>{role.isSystem ? '是' : '否'}</td>
              <td>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedRoleId(role.id)}
                >
                  查看权限
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="新建角色">
        <RoleForm
          onSubmit={async (values) => {
            await api.createRole(values);
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['roles'] });
          }}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {selectedRoleId && (
        <Modal
          isOpen={!!selectedRoleId}
          onClose={() => setSelectedRoleId(null)}
          title="角色权限矩阵"
        >
          <RolePermissionsMatrix roleId={selectedRoleId!} />
        </Modal>
      )}
    </div>
  );
}
```

#### 3.2 权限矩阵组件

```typescript
// src/components/RolePermissionsMatrix.tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

interface RolePermissionsMatrixProps {
  roleId: string;
}

export function RolePermissionsMatrix({ roleId }: RolePermissionsMatrixProps) {
  const { data: metadata } = useQuery({
    queryKey: ['metadata'],
    queryFn: () => api.getMetadata(),
  });

  const { data: role } = useQuery({
    queryKey: ['role', roleId],
    queryFn: () => api.getRole(roleId),
  });

  const rolePermissions = new Set(role?.data?.permissions || []);

  const actions = ['create', 'read', 'update', 'delete', 'list'];

  return (
    <div className="permissions-matrix">
      <table className="matrix-table">
        <thead>
          <tr>
            <th>资源</th>
            {actions.map(action => (
              <th key={action}>{action}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metadata?.data?.resources?.map((resource: any) => (
            <tr key={resource.name}>
              <td>{resource.displayName || resource.name}</td>
              {actions.map(action => {
                const permission = `${resource.name}:${action}`;
                const hasPermission = rolePermissions.has(permission);
                const isDefined = resource.permissions?.includes(action);

                return (
                  <td key={action}>
                    <input
                      type="checkbox"
                      checked={hasPermission}
                      disabled={!isDefined || role?.data?.isSystem}
                      onChange={(e) => {
                        // 处理权限变更
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 阶段四：高级功能 (Week 4)

#### 4.1 搜索与过滤

```typescript
// src/components/ResourceFilters.tsx
import { useForm } from 'react-hook-form';
import { Input } from './ui/Form';
import { Select } from './ui/Form';
import { Button } from './ui/Button';

interface FilterValues {
  search?: string;
  status?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

interface ResourceFiltersProps {
  onFilter: (values: FilterValues) => void;
}

export function ResourceFilters({ onFilter }: ResourceFiltersProps) {
  const { register, handleSubmit, reset } = useForm<FilterValues>();

  return (
    <form onSubmit={handleSubmit(onFilter)} className="filters">
      <div className="filter-row">
        <Input placeholder="搜索..." {...register('search')} />
        <Select
          {...register('status')}
          options={[
            { value: '', label: '全部状态' },
            { value: 'active', label: '上架' },
            { value: 'inactive', label: '下架' },
            { value: 'discontinued', label: '停产' },
          ]}
        />
        <Button type="submit">搜索</Button>
        <Button type="button" variant="secondary" onClick={() => reset()}>
          重置
        </Button>
      </div>
    </form>
  );
}
```

#### 4.2 分页组件

```typescript
// src/components/ui/Pagination.tsx
import type React from 'react';

interface PaginationProps {
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({
  currentPage,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  const pages: (number | string)[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="pagination">
      <div className="pagination-info">
        显示 {startItem} - {endItem} 条，共 {total} 条
      </div>

      <div className="pagination-controls">
        <button
          className="pagination-btn"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          上一页
        </button>

        {pages.map((page, idx) =>
          typeof page === 'string' ? (
            <span key={idx} className="pagination-ellipsis">
              {page}
            </span>
          ) : (
            <button
              key={idx}
              className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          )
        )}

        <button
          className="pagination-btn"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          下一页
        </button>
      </div>

      {onPageSizeChange && (
        <div className="pagination-size">
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
          >
            <option value={10}>10 条/页</option>
            <option value={20}>20 条/页</option>
            <option value={50}>50 条/页</option>
            <option value={100}>100 条/页</option>
          </select>
        </div>
      )}
    </div>
  );
}
```

---

# 第四部分：集成与部署方案

## 4.1 本地开发环境

### 启动命令

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 启动开发模式
pnpm dev

# 单独启动 example-api
cd apps/example-api
pnpm dev

# 单独启动 example-web
cd apps/example-web
pnpm dev
```

### 环境变量配置

```env
# apps/example-api/.env
DATABASE_URL=postgresql://postgres:password@localhost:5432/mtpc
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
PORT=3000
```

## 4.2 Docker 部署

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: mtpc
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build: ./apps/example-api
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/mtpc
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
    depends_on:
      - postgres

  web:
    build: ./apps/example-web
    ports:
      - "80:80"
    depends_on:
      - api

volumes:
  postgres_data:
```

## 4.3 CI/CD 配置

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8.15.0
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
      - run: pnpm typecheck
      - run: pnpm lint
```

---

# 第五部分：开发时间线

| 阶段 | 时间 | 内容 |
|------|------|------|
| **example-api 阶段一** | Week 1 | JWT 认证、数据库持久化 |
| **example-api 阶段二** | Week 2 | API 文档、完善测试 |
| **example-api 阶段三** | Week 3 | 权限解释、批量操作、搜索 |
| **example-api 阶段四** | Week 4 | Docker 配置、监控 |
| **example-web 阶段一** | Week 1 | 通用组件库、资源页面 |
| **example-web 阶段二** | Week 2 | 表单组件、详情页面 |
| **example-web 阶段三** | Week 3 | 角色管理、权限矩阵 |
| **example-web 阶段四** | Week 4 | 搜索过滤、分页 |

---

# 第六部分：验收标准

## example-api 验收标准

- [ ] JWT 认证正常工作
- [ ] 角色数据持久化到数据库
- [ ] 所有 CRUD 操作有完整测试
- [ ] 提供 OpenAPI 文档
- [ ] 实现权限解释端点
- [ ] 支持批量操作
- [ ] Docker 部署成功
- [ ] 健康检查端点返回正确信息

## example-web 验收标准

- [ ] 完整的 CRUD UI
- [ ] 表单验证正常
- [ ] 权限控制正确显示/隐藏功能
- [ ] Toast 通知正常工作
- [ ] 角色管理页面完整
- [ ] 权限矩阵可视化
- [ ] 搜索和过滤功能正常
- [ ] 分页组件正常工作

---

# 附录

## 技术栈总结

### example-api
- **框架**: Hono
- **ORM**: Drizzle ORM
- **数据库**: PostgreSQL
- **认证**: JWT
- **测试**: Vitest
- **文档**: OpenAPI/Swagger

### example-web
- **框架**: React + Vite
- **状态管理**: React Query
- **表单**: React Hook Form + Zod
- **样式**: CSS Modules
- **组件**: 自定义组件库

## 依赖包版本

```json
{
  "@mtpc/core": "workspace:*",
  "@mtpc/rbac": "workspace:*",
  "@mtpc/adapter-hono": "workspace:*",
  "@mtpc/adapter-drizzle": "workspace:*",
  "hono": "^4.0.0",
  "drizzle-orm": "^0.29.0",
  "postgres": "^3.4.0",
  "@hono/zod-validator": "^0.2.0",
  "zod": "^3.22.0",
  "vitest": "^1.0.0"
}
```

---

> **文档状态**: 待用户确认后开始实施

> **下一步**: 等待用户确认方案，然后按阶段逐步实现
