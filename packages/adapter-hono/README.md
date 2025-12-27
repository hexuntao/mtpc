# @mtpc/adapter-hono 使用指南

## 目录

1. [概述](#1-概述)
2. [安装指南](#2-安装指南)
3. [快速开始](#3-快速开始)
4. [核心概念](#4-核心概念)
5. [中间件详解](#5-中间件详解)
6. [工厂函数与路由](#6-工厂函数与路由)
7. [CRUD 处理器](#7-crud-处理器)
8. [RPC 客户端](#8-rpc-客户端)
9. [错误处理](#9-错误处理)
10. [常见问题](#10-常见问题)
11. [最佳实践](#11-最佳实践)
12. [迁移指南](#12-迁移指南)
13. [API 参考](#13-api-参考)

---

## 1. 概述

### 1.1 什么是 @mtpc/adapter-hono

`@mtpc/adapter-hono` 是 MTPC (Multi-Tenant Permission Core) 的 Hono 框架适配器，提供将 MTPC 多租户权限核心集成到 Hono 应用中的完整解决方案。

### 1.2 核心功能

- **MTPC 核心集成**：将 MTPC 实例无缝集成到 Hono 应用中
- **中间件支持**：提供租户解析、认证、权限检查等中间件
- **自动路由生成**：基于资源定义自动生成 CRUD 和 RPC 路由
- **错误处理**：统一的错误处理机制
- **类型安全**：完整的 TypeScript 类型支持

### 1.3 适用场景

- 基于 Hono 框架的多租户应用
- 需要权限管理的 API 服务
- 快速构建 RESTful API 或 RPC 服务
- 需要自动生成 CRUD 路由的场景

---

## 2. 安装指南

### 2.1 安装依赖

```bash
# 使用 pnpm 安装
pnpm add @mtpc/adapter-hono @mtpc/core hono

# 安装 Zod（用于 Schema 定义）
pnpm add zod

# 安装 Zod 验证器中间件
pnpm add @hono/zod-validator
```

### 2.2 依赖要求

| 依赖包 | 版本要求 | 说明 |
|--------|----------|------|
| `@mtpc/core` | workspace:* | MTPC 核心包 |
| `hono` | ^4.0.0 | Hono Web 框架 |
| `zod` | ^3.23.0 | Schema 验证 |
| `@hono/zod-validator` | ^0.2.0 | Zod 验证器中间件 |

---

## 3. 快速开始

### 3.1 基本使用示例

```typescript
import { createMTPC } from '@mtpc/core';
import { createMTPCApp } from '@mtpc/adapter-hono';
import { defineResource } from '@mtpc/core';
import { z } from 'zod';

// 1. 定义资源
const userResource = defineResource({
  name: 'user',
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(['admin', 'user']),
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: true,
    list: true,
  },
});

// 2. 创建 MTPC 实例
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    // 从数据库或缓存获取权限
    return new Set(['user:read', 'user:create', 'user:update', 'user:delete']);
  },
});

// 3. 注册资源
mtpc.registerResource(userResource);

// 4. 初始化 MTPC
await mtpc.init();

// 5. 创建 Hono 应用
const app = createMTPCApp(mtpc, {
  prefix: '/api',
  logging: true,
  errorHandling: true,
  tenantOptions: { required: true },
  authOptions: { required: true },
});

// 6. 启动服务器
app.fire(3000);
```

### 3.2 最小化应用

如果只需要中间件而不需要自动路由：

```typescript
import { createMTPC } from '@mtpc/core';
import { createMinimalMTPCApp, requirePermission } from '@mtpc/adapter-hono';

const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    return new Set(['user:read']);
  },
});
await mtpc.init();

const app = createMinimalMTPCApp(mtpc, {
  tenantOptions: { required: true },
  authOptions: { required: true },
});

// 自定义路由
app.get('/users', requirePermission('user', 'read'), async (c) => {
  return c.json({ message: 'Users list' });
});

app.fire(3000);
```

### 3.3 挂载到现有应用

```typescript
import { createMTPC } from '@mtpc/core';
import { mountMTPC } from '@mtpc/adapter-hono';
import { Hono } from 'hono';

const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    return new Set(['user:read']);
  },
});
await mtpc.init();

const app = new Hono();
app.get('/', (c) => c.text('Hello World'));

// 挂载 MTPC 路由到 /api 路径
mountMTPC(app, mtpc, {
  prefix: '/api',
  tenantOptions: { required: true },
  authOptions: { required: true },
});

app.fire(3000);
```

---

## 4. 核心概念

### 4.1 上下文变量

MTPC 在 Hono 上下文中注入以下变量：

```typescript
interface MTPCVariables {
  tenant: TenantContext;        // 租户上下文
  subject: SubjectContext;      // 主体上下文
  mtpcContext: MTPCContext;     // 完整 MTPC 上下文
  mtpc: MTPC;                   // MTPC 核心实例
}
```

### 4.2 获取上下文

```typescript
import { getTenant, getSubject, getMTPCContext } from '@mtpc/adapter-hono';

app.get('/example', async (c) => {
  // 获取租户
  const tenant = getTenant(c);
  
  // 获取主体
  const subject = getSubject(c);
  
  // 获取完整上下文
  const ctx = getMTPCContext(c);
  
  return c.json({ tenant: tenant.id, subject: subject.id });
});
```

### 4.3 设置上下文

```typescript
import { setTenant, setSubject } from '@mtpc/adapter-hono';

app.post('/switch-tenant', async (c) => {
  const newTenantId = c.req.header('x-new-tenant-id');
  
  const tenant = createTenantContext(newTenantId);
  setTenant(c, tenant);
  
  return c.json({ success: true });
});
```

---

## 5. 中间件详解

### 5.1 mtpcMiddleware

将 MTPC 实例注入到 Hono 上下文中。

```typescript
import { mtpcMiddleware } from '@mtpc/adapter-hono';

app.use('*', mtpcMiddleware(mtpc));
```

**注意**：必须最先注册，是所有其他 MTPC 中间件的前提依赖。

### 5.2 tenantMiddleware

租户解析中间件，从请求头中提取租户信息。

```typescript
import { tenantMiddleware } from '@mtpc/adapter-hono';

// 默认配置（请求头: x-tenant-id，必填）
app.use('/api/*', tenantMiddleware());

// 自定义配置
app.use('/api/*', tenantMiddleware({
  headerName: 'x-tenant-id',     // 请求头名称
  required: true,                 // 是否必填
  validate: async (tenant) => {
    // 验证租户是否有效
    return await checkTenantExists(tenant.id);
  }
}));

// 公开 API（不要求租户）
app.use('/public/*', tenantMiddleware({
  required: false
}));
```

#### 5.2.1 其他租户解析方式

```typescript
import { tenantFromPathMiddleware, tenantFromSubdomainMiddleware } from '@mtpc/adapter-hono';

// 从路径参数解析（路由: /:tenantId/api/...）
app.use('/:tenantId/*', tenantFromPathMiddleware({
  paramName: 'tenantId',
  required: true
}));

// 从子域名解析（tenant1.example.com -> tenant1）
app.use('*', tenantFromSubdomainMiddleware({
  baseDomain: 'example.com',
  required: true
}));
```

### 5.3 authMiddleware

认证中间件，从请求中提取用户信息。

```typescript
import { authMiddleware } from '@mtpc/adapter-hono';

// 默认配置（请求头: x-subject-id, x-subject-roles，可选）
app.use('/api/*', authMiddleware());

// 必填认证
app.use('/api/*', authMiddleware({
  required: true
}));

// 自定义解析器
app.use('/api/*', authMiddleware({
  resolver: async (c) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return null;
    
    const user = await verifyToken(token);
    return {
      id: user.id,
      type: 'user',
      roles: user.roles,
      permissions: user.permissions
    };
  },
  required: true
}));
```

### 5.4 Bearer Token 认证

```typescript
import { bearerAuthMiddleware } from '@mtpc/adapter-hono';

app.use('/api/*', bearerAuthMiddleware({
  verifyToken: async (token) => {
    const payload = await jwtVerify(token);
    return {
      id: payload.sub,
      type: 'user',
      roles: payload.roles,
      permissions: payload.permissions
    };
  },
  required: true
}));
```

### 5.5 API Key 认证

```typescript
import { apiKeyAuthMiddleware } from '@mtpc/adapter-hono';

app.use('/api/*', apiKeyAuthMiddleware({
  headerName: 'x-api-key',
  verifyApiKey: async (apiKey) => {
    const keyRecord = await db.apiKey.findUnique({
      where: { key: apiKey }
    });
    if (!keyRecord || keyRecord.revoked) {
      throw new Error('Invalid API key');
    }
    return {
      id: keyRecord.userId,
      type: 'service',
      roles: keyRecord.roles,
      permissions: keyRecord.permissions
    };
  },
  required: true
}));
```

### 5.6 权限检查中间件

#### 5.6.1 requirePermission

检查单个权限。

```typescript
import { requirePermission } from '@mtpc/adapter-hono';

// 完整权限码
app.get('/users', requirePermission('user:read'), handler);

// 资源名 + 操作
app.post('/users', requirePermission('user', 'create'), handler);
```

#### 5.6.2 requireAnyPermission

OR 逻辑，只要有一个权限即可。

```typescript
app.get('/users', requireAnyPermission('user:read', 'user:admin'), handler);
```

#### 5.6.3 requireAllPermissions

AND 逻辑，所有权限都必须有。

```typescript
app.delete('/users/:id', requireAllPermissions('user:read', 'user:delete'), handler);
```

#### 5.6.4 requireResourcePermission

资源实例级权限检查。

```typescript
app.get('/users/:id', requireResourcePermission('user', 'read'), handler);
app.put('/users/:id', requireResourcePermission('user', 'update'), handler);
app.delete('/users/:id', requireResourcePermission('user', 'delete'), handler);
```

#### 5.6.5 dynamicPermissionCheck

动态权限检查。

```typescript
app.post('/documents/:id/action', dynamicPermissionCheck(async (c) => {
  const body = await c.req.json();
  return {
    resource: 'document',
    action: body.action,
    resourceId: c.req.param('id')
  };
}), handler);
```

---

## 6. 工厂函数与路由

### 6.1 createMTPCApp

创建完整的 MTPC Hono 应用。

```typescript
import { createMTPCApp } from '@mtpc/adapter-hono';

const app = createMTPCApp(mtpc, {
  prefix: '/api',                    // API 路由前缀，默认: '/api'
  cors: true,                        // CORS 配置，默认: {}
  logging: true,                     // 是否启用日志，默认: true
  errorHandling: true,               // 是否启用错误处理，默认: true
  tenantOptions: {},                 // 租户中间件配置
  authOptions: {},                   // 认证中间件配置
  handlerFactory: createInMemoryHandlerFactory()  // CRUD 处理器工厂
});
```

**自动生成的端点**：

| HTTP 方法 | 路由 | 描述 |
|-----------|------|------|
| GET | /api/metadata | 获取资源元数据 |
| GET | /health | 健康检查 |
| GET | /api/{resource} | 列表资源 |
| POST | /api/{resource} | 创建资源 |
| GET | /api/{resource}/:id | 读取资源 |
| PUT | /api/{resource}/:id | 更新资源（完整） |
| PATCH | /api/{resource}/:id | 更新资源（部分） |
| DELETE | /api/{resource}/:id | 删除资源 |

### 6.2 createMinimalMTPCApp

创建最小化的 MTPC Hono 应用（仅中间件）。

```typescript
import { createMinimalMTPCApp } from '@mtpc/adapter-hono';

const app = createMinimalMTPCApp(mtpc, {
  tenantOptions: { required: true },
  authOptions: { required: true }
});

// 自定义路由
app.get('/custom', async (c) => {
  return c.json({ message: 'Custom route' });
});
```

### 6.3 mountMTPC

挂载 MTPC 路由到现有 Hono 应用。

```typescript
import { mountMTPC } from '@mtpc/adapter-hono';

const app = new Hono();
app.get('/', (c) => c.text('Root'));

mountMTPC(app, mtpc, {
  prefix: '/api',
  tenantOptions: { required: true },
  authOptions: { required: true }
});
```

### 6.4 RouteBuilder

使用流式 API 构建自定义路由。

```typescript
import { createRouteBuilder } from '@mtpc/adapter-hono';

const userRoutes = createRouteBuilder(userResource)
  .use(rateLimitMiddleware())
  .get('/', listUsers, 'user:list')
  .post('/', createUser, 'user:create')
  .get('/:id', getUser, 'user:read')
  .put('/:id', updateUser, 'user:update')
  .delete('/:id', deleteUser, 'user:delete')
  .build();

app.route('/users', userRoutes);
```

---

## 7. CRUD 处理器

### 7.1 BaseCRUDHandler

自定义 CRUD 处理器的抽象基类。

```typescript
import { BaseCRUDHandler } from '@mtpc/adapter-hono';
import type { MTPCContext, PaginatedResult, QueryOptions } from '@mtpc/core';

interface User {
  id: string;
  name: string;
  email: string;
  tenantId: string;
}

class UserCRUDHandler extends BaseCRUDHandler<User> {
  async list(ctx: MTPCContext, options: QueryOptions): Promise<PaginatedResult<User>> {
    const page = options.pagination?.page ?? 1;
    const pageSize = options.pagination?.pageSize ?? 20;
    
    const [data, total] = await db.user.findManyAndCount({
      where: { tenantId: ctx.tenant.id },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page < Math.ceil(total / pageSize),
      hasPrev: page > 1
    };
  }
  
  async create(ctx: MTPCContext, data: unknown): Promise<User> {
    return db.user.create({
      data: {
        ...data as object,
        tenantId: ctx.tenant.id,
        createdBy: ctx.subject.id
      }
    });
  }
  
  async read(ctx: MTPCContext, id: string): Promise<User | null> {
    return db.user.findFirst({
      where: { id, tenantId: ctx.tenant.id }
    });
  }
  
  async update(ctx: MTPCContext, id: string, data: unknown): Promise<User | null> {
    return db.user.updateMany({
      where: { id, tenantId: ctx.tenant.id },
      data: data as object
    }).then(() => this.read(ctx, id));
  }
  
  async delete(ctx: MTPCContext, id: string): Promise<boolean> {
    const result = await db.user.deleteMany({
      where: { id, tenantId: ctx.tenant.id }
    });
    return result.count > 0;
  }
}
```

### 7.2 使用自定义处理器

```typescript
import { createMTPCApp } from '@mtpc/adapter-hono';

const app = createMTPCApp(mtpc, {
  handlerFactory: (resource) => {
    switch (resource.name) {
      case 'user':
        return new UserCRUDHandler(resource);
      case 'product':
        return new ProductCRUDHandler(resource);
      default:
        return new DefaultCRUDHandler(resource);
    }
  }
});
```

---

## 8. RPC 客户端

### 8.1 createRPCClient

创建类型化的 RPC 客户端。

```typescript
import { createRPCClient } from '@mtpc/adapter-hono';

// 定义后端路由类型
type ApiRoutes = {
  users: {
    get: (q: { page?: string }) => Promise<{ success: boolean; data: { data: unknown[]; total: number } }>;
    post: (data: unknown) => Promise<{ success: boolean; data: unknown }>;
    ':id': {
      get: () => Promise<{ success: boolean; data: unknown }>;
      delete: () => Promise<{ success: boolean }>;
    };
  };
};

const client = createRPCClient<ApiRoutes>('https://api.example.com', {
  headers: {
    'Authorization': 'Bearer token'
  }
});

// 调用 API
const users = await client.users.get({ page: '1' });
const user = await client.users[':id'].get();
```

### 8.2 createResourceClient

创建单个资源的客户端。

```typescript
import { createResourceClient } from '@mtpc/adapter-hono';

const userClient = createResourceClient('https://api.example.com', 'users', {
  tenantId: 'tenant123',
  token: 'jwt-token'
});

// 列表查询
const listResult = await userClient.list({ page: '1', pageSize: '20' });

// 创建资源
const createResult = await userClient.create({
  name: 'John',
  email: 'john@example.com'
});

// 读取资源
const readResult = await userClient.read('user-id');

// 更新资源
const updateResult = await userClient.update('user-id', {
  name: 'John Doe'
});

// 删除资源
const deleteResult = await userClient.delete('user-id');
```

### 8.3 createMTPCClient

创建完整的 MTPC 客户端。

```typescript
import { createMTPCClient } from '@mtpc/adapter-hono';

const client = createMTPCClient('https://api.example.com', {
  resources: ['users', 'orders', 'products'],
  tenantId: 'tenant123',
  token: 'jwt-token'
});

// 访问所有资源
const users = await client.users.list();
const orders = await client.orders.list();
const products = await client.products.list();

// 切换租户（不可变操作，返回新客户端）
const tenant2Client = client.setTenant('tenant456');

// 切换 Token（不可变操作，返回新客户端）
const newTokenClient = client.setToken('new-token');
```

---

## 9. 错误处理

### 9.1 内置错误处理

```typescript
import { mtpcErrorHandler, notFoundHandler } from '@mtpc/adapter-hono';

app.onError(mtpcErrorHandler());
app.notFound(notFoundHandler);
```

### 9.2 自定义错误处理

```typescript
app.onError(mtpcErrorHandler({
  isProduction: process.env.NODE_ENV === 'production',
  includeStack: false,
  logger: (err, context) => {
    // 使用 Winston 日志
    winston.error(context, { error: err });
  },
  onError: async (err, c) => {
    // 发送告警
    await alertService.send({
      level: 'error',
      message: err.message,
      context
    });
  }
}));
```

### 9.3 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Permission denied: user:delete",
    "details": {
      "reason": "User does not have required permission"
    }
  }
}
```

### 9.4 HTTP 状态码映射

| 错误类型 | HTTP 状态码 |
|----------|-------------|
| PermissionDeniedError | 403 |
| ResourceNotFoundError | 404 |
| MissingTenantContextError | 400 |
| ValidationError | 400 |
| 其他错误 | 500 |

---

## 10. 常见问题

### Q1: 如何获取当前上下文的 MTPC 实例？

```typescript
const mtpcInstance = c.get('mtpc');
```

### Q2: 如何获取当前用户信息？

```typescript
const subject = getSubject(c);
// 或
const subject = c.get('subject');
```

### Q3: 如何获取当前租户信息？

```typescript
const tenant = getTenant(c);
// 或
const tenant = c.get('tenant');
```

### Q4: 如何自定义路由路径？

使用 `createMinimalMTPCApp` 创建最小化应用，然后手动添加路由：

```typescript
const app = createMinimalMTPCApp(mtpc);

// 自定义路由
app.get('/custom-path', requirePermission('resource', 'action'), handler);
```

### Q5: 如何集成数据库？

自定义 CRUD 处理器，集成数据库操作：

```typescript
class DatabaseCRUDHandler extends BaseCRUDHandler<Entity> {
  async list(ctx: MTPCContext, options: QueryOptions) {
    return db.entity.findMany({
      where: { tenantId: ctx.tenant.id },
      skip: (options.pagination.page - 1) * options.pagination.pageSize,
      take: options.pagination.pageSize
    });
  }
  // ...
}
```

### Q6: 如何添加自定义中间件？

```typescript
const app = createMTPCApp(mtpc);

// 添加自定义中间件
app.use('*', async (c, next) => {
  // 自定义逻辑
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`${c.req.method} ${c.req.path} - ${duration}ms`);
});
```

### Q7: 为什么需要 defaultPermissionResolver？

MTPC 需要知道用户有哪些权限才能进行权限检查。`defaultPermissionResolver` 用于根据租户 ID 和主体 ID 获取权限集合：

```typescript
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    // 从数据库、缓存或外部服务获取权限
    const permissions = await db.permission.findMany({
      where: { tenantId, subjectId }
    });
    return new Set(permissions.map(p => p.code));
  }
});
```

### Q8: 如何处理认证失败？

```typescript
app.use('/api/*', authMiddleware({
  required: true,
  resolver: async (c) => {
    const token = c.req.header('Authorization');
    if (!token) return null;
    
    try {
      return await verifyToken(token);
    } catch {
      return null;  // 返回 401
    }
  }
}));
```

认证失败时返回 401 状态码和错误消息。

---

## 11. 最佳实践

### 11.1 中间件注册顺序

```typescript
const app = new Hono();

// 1. CORS（如果需要）
app.use('*', cors());

// 2. MTPC 核心（必须最先）
app.use('*', mtpcMiddleware(mtpc));

// 3. 租户解析
app.use('/api/*', tenantMiddleware({ required: true }));

// 4. 认证
app.use('/api/*', authMiddleware({ required: true }));

// 5. 错误处理
app.onError(mtpcErrorHandler());
app.notFound(notFoundHandler);
```

### 11.2 环境配置

```typescript
const isProduction = process.env.NODE_ENV === 'production';

const app = createMTPCApp(mtpc, {
  logging: !isProduction,
  errorHandling: true,
  cors: isProduction ? {
    origin: process.env.CORS_ORIGIN,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
  } : true
});
```

### 11.3 资源定义最佳实践

- 为每个资源定义清晰的 Schema
- 明确资源的 CRUD 权限
- 使用描述性的资源名称和动作名称
- 为资源添加适当的元数据

### 11.4 性能优化

1. **禁用不必要的中间件**：在生产环境中禁用不必要的中间件
2. **启用压缩**：使用 Hono 的压缩中间件
3. **合理配置 CORS**：在生产环境中限制允许的 Origin
4. **优化数据库查询**：使用自定义 CRUD 处理器时，优化数据库查询
5. **使用缓存**：对频繁访问的数据使用缓存

### 11.5 安全实践

1. **始终验证租户上下文**：确保租户有效性
2. **避免硬编码权限**：使用策略系统管理权限
3. **定期审查权限配置**：清理不必要的权限
4. **实现权限审计**：记录所有权限检查

---

## 12. 迁移指南

### 12.1 defaultTenantId 迁移

`defaultTenantId` 选项已废弃，请迁移到 `required: false`：

```typescript
// ❌ 旧方式（已废弃）
app.use('/api/*', tenantMiddleware({
  defaultTenantId: 'default'
}));

// ✅ 新方式
app.use('/api/*', tenantMiddleware({
  required: false
}));
```

### 12.2 AuthMiddlewareOptions.required 默认值

注意 `authMiddleware` 的 `required` 选项默认值已从 `true` 变更为 `false`：

```typescript
// 如果需要必填认证，请显式设置
app.use('/api/*', authMiddleware({
  required: true  // 显式设置为 true
}));
```

### 12.3 错误处理迁移

如果使用了自定义日志记录：

```typescript
// ❌ 旧方式
app.onError(mtpcErrorHandler({
  onError: (err, c) => {
    console.error(err);  // 直接使用 console
  }
}));

// ✅ 新方式
app.onError(mtpcErrorHandler({
  logger: (err, context) => {
    // 使用可配置的 logger
    winston.error(context, { error: err });
  }
}));
```

---

## 13. API 参考

### 13.1 主入口导出

```typescript
// 上下文管理
export { getTenant, getSubject, getMTPCContext, setTenant, setSubject };

// 工厂函数
export { createMTPCApp, createMinimalMTPCApp, mountMTPC };

// 中间件
export { mtpcMiddleware, setupMTPC };
export { tenantMiddleware, tenantFromPathMiddleware, tenantFromSubdomainMiddleware };
export { authMiddleware, bearerAuthMiddleware, apiKeyAuthMiddleware };
export { requirePermission, requireAnyPermission, requireAllPermissions, requireResourcePermission, dynamicPermissionCheck };
export { mtpcErrorHandler, notFoundHandler };

// 路由
export { BaseCRUDHandler, InMemoryCRUDHandler, createInMemoryHandlerFactory };
export { createResourceRoutes, createAllResourceRoutes };
export { RouteBuilder, createRouteBuilder };

// RPC
export { createRPCRoutes, createTypedRPCApp };
export { createRPCClient, createResourceClient, createMTPCClient };
```

### 13.2 配置选项速查

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| prefix | string | '/api' | API 路由前缀 |
| cors | boolean \| object | {} | CORS 配置 |
| logging | boolean | true | 是否启用日志 |
| errorHandling | boolean | true | 是否启用错误处理 |
| tenantOptions.headerName | string | 'x-tenant-id' | 租户请求头名称 |
| tenantOptions.required | boolean | true | 租户是否必填 |
| authOptions.required | boolean | false | 认证是否必填 |
| authOptions.headerName | string | 'x-subject-id' | 主体请求头名称 |
| handlerFactory | function | InMemoryHandlerFactory | CRUD 处理器工厂 |

---

## 版本更新日志

### v0.1.0 (2024-12-27)

- 初始版本发布
- 支持创建完整的 MTPC Hono 应用
- 支持创建最小化的 MTPC Hono 应用
- 支持挂载 MTPC 路由到现有 Hono 应用
- 提供租户解析、认证、权限检查中间件
- 支持自动生成 CRUD 路由和 RPC 路由
- 提供统一的错误处理机制
- 支持自定义 CRUD 处理器
- 支持自定义认证和租户解析
- 新增多种租户解析方式（路径参数、子域名）
- 新增 Bearer Token 和 API Key 认证
- 新增 RPC 客户端支持

---

**文档版本**: 1.0.0  
**最后更新**: 2024-12-27  
**维护者**: MTPC Team
