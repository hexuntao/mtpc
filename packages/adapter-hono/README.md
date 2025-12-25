# @mtpc/adapter-hono 使用指南

## 1. 包简介

`@mtpc/adapter-hono` 是 MTPC (Multi-Tenant Permission Core) 的 Hono 框架适配器，提供将 MTPC 多租户权限核心集成到 Hono 应用中的完整解决方案。

### 核心功能

- **MTPC 核心集成**：将 MTPC 实例无缝集成到 Hono 应用中
- **中间件支持**：提供租户解析、认证、权限检查等中间件
- **自动路由生成**：基于资源定义自动生成 CRUD 和 RPC 路由
- **错误处理**：统一的错误处理机制
- **日志支持**：集成 Hono 日志中间件
- **CORS 支持**：内置 CORS 配置
- **健康检查**：提供健康检查端点

### 适用场景

- 基于 Hono 框架的多租户应用
- 需要权限管理的 API 服务
- 快速构建 RESTful API 或 RPC 服务
- 需要自动生成 CRUD 路由的场景
- 需要统一的认证和权限检查机制

## 2. 安装指南

### 2.1 安装依赖

使用 pnpm 安装 `@mtpc/adapter-hono` 包：

```bash
pnpm add @mtpc/adapter-hono @mtpc/core hono
```

### 2.2 依赖要求

| 依赖包 | 版本要求 | 说明 |
|--------|----------|------|
| `@mtpc/core` | workspace:* | MTPC 核心包，提供基础权限能力 |
| `hono` | ^4.0.0 | Hono Web 框架 |

## 3. 快速开始

### 3.1 基本使用示例

```typescript
import { createMTPC } from '@mtpc/core';
import { createMTPCApp, createRBACPlugin } from '@mtpc/adapter-hono';
import { defineResource } from '@mtpc/core';
import { z } from 'zod';

// 定义资源
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
  },
  permissions: [
    { action: 'create', description: 'Create user' },
    { action: 'read', description: 'Read user' },
    { action: 'update', description: 'Update user' },
    { action: 'delete', description: 'Delete user' },
  ],
});

// 创建 RBAC 插件
const rbacPlugin = createRBACPlugin();

// 创建 MTPC 实例（必须提供 defaultPermissionResolver）
const mtpc = createMTPC({
  defaultPermissionResolver: rbacPlugin.state.evaluator.getPermissions.bind(rbacPlugin.state.evaluator)
});

// 注册资源
mtpc.registerResource(userResource);

// 注册插件（可选，用于访问插件状态）
mtpc.use(rbacPlugin);

// 初始化 MTPC
await mtpc.init();

// 创建完整的 MTPC Hono 应用
const app = createMTPCApp(mtpc, {
  prefix: '/api',
  logging: true,
  errorHandling: true,
  tenantOptions: { headerName: 'x-tenant-id' },
  authOptions: { required: false },
});

// 启动服务器
app.fire(3000);
```

### 3.2 自定义路由示例

```typescript
import { createMTPC } from '@mtpc/core';
import { createMinimalMTPCApp, createRBACPlugin } from '@mtpc/adapter-hono';
import { z } from 'zod';

// 创建 RBAC 插件
const rbacPlugin = createRBACPlugin();

// 创建 MTPC 实例（必须提供 defaultPermissionResolver）
const mtpc = createMTPC({
  defaultPermissionResolver: rbacPlugin.state.evaluator.getPermissions.bind(rbacPlugin.state.evaluator)
});

mtpc.use(rbacPlugin);
await mtpc.init();

// 创建最小化的 MTPC Hono 应用
const app = createMinimalMTPCApp(mtpc, {
  tenantOptions: { headerName: 'x-tenant-id' },
  authOptions: { required: true },
});

// 添加自定义路由
app.get('/custom-route', async (c) => {
  // 从上下文获取 MTPC 实例
  const mtpcInstance = c.get('mtpc');

  // 使用 MTPC 实例进行权限检查
  const checkResult = await mtpcInstance.checkPermission({
    tenant: c.get('tenant'),
    subject: c.get('subject'),
    resource: 'user',
    action: 'read',
  });

  if (!checkResult.allowed) {
    return c.json({ success: false, message: 'Permission denied' }, 403);
  }

  return c.json({ success: true, data: { message: 'Custom route accessed' } });
});

// 启动服务器
app.fire(3000);
```

### 3.3 挂载到现有 Hono 应用

```typescript
import { createMTPC } from '@mtpc/core';
import { mountMTPC, createRBACPlugin } from '@mtpc/adapter-hono';
import { Hono } from 'hono';

// 创建 RBAC 插件
const rbacPlugin = createRBACPlugin();

// 创建 MTPC 实例（必须提供 defaultPermissionResolver）
const mtpc = createMTPC({
  defaultPermissionResolver: rbacPlugin.state.evaluator.getPermissions.bind(rbacPlugin.state.evaluator)
});

mtpc.use(rbacPlugin);
await mtpc.init();

// 创建现有 Hono 应用
const app = new Hono();

// 添加自定义路由
app.get('/', (c) => c.text('Hello from root'));

// 挂载 MTPC 路由到 /api 路径
mountMTPC(app, mtpc, {
  prefix: '/api',
  tenantOptions: { headerName: 'x-tenant-id' },
  authOptions: { required: false },
});

// 启动服务器
app.fire(3000);
```

## 4. 核心 API 详解

### 4.1 createMTPCApp

创建完整的 MTPC Hono 应用，包含所有中间件、路由、错误处理等功能。

```typescript
function createMTPCApp<T = unknown>(
  mtpc: MTPC,
  options?: MTPCAppOptions
): Hono<MTPCEnv>
```

#### 参数说明

| 参数 | 类型 | 默认值 | 说明 | 是否必填 |
|------|------|--------|------|----------|
| `mtpc` | `MTPC` | - | MTPC 核心实例 | 是 |
| `options` | `MTPCAppOptions` | `{}` | 应用配置选项 | 否 |

#### MTPCAppOptions

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `prefix` | `string` | `/api` | API 路由前缀 |
| `cors` | `boolean | object` | `{}` | CORS 配置，为 `false` 时禁用 CORS |
| `logging` | `boolean` | `true` | 是否启用日志中间件 |
| `errorHandling` | `boolean` | `true` | 是否启用错误处理 |
| `tenantOptions` | `TenantMiddlewareOptions` | `{}` | 租户中间件配置 |
| `authOptions` | `AuthMiddlewareOptions` | `{}` | 认证中间件配置 |
| `handlerFactory` | `<T>(resource: ResourceDefinition) => CRUDHandlers<T>` | 内存处理器工厂 | CRUD 处理器工厂函数 |

#### 返回值

配置好的 Hono 应用实例，带有 MTPCEnv 类型。

### 4.2 createMinimalMTPCApp

创建最小化的 MTPC Hono 应用，仅包含中间件，不包含自动路由。

```typescript
function createMinimalMTPCApp(
  mtpc: MTPC,
  options?: Pick<MTPCAppOptions, 'tenantOptions' | 'authOptions'>
): Hono<MTPCEnv>
```

#### 参数说明

| 参数 | 类型 | 默认值 | 说明 | 是否必填 |
|------|------|--------|------|----------|
| `mtpc` | `MTPC` | - | MTPC 核心实例 | 是 |
| `options` | `Pick<MTPCAppOptions, 'tenantOptions' | 'authOptions'>` | `{}` | 应用配置选项，仅包含租户和认证配置 | 否 |

#### 返回值

配置好的 Hono 应用实例，带有 MTPCEnv 类型。

### 4.3 mountMTPC

挂载 MTPC 路由到现有 Hono 应用。

```typescript
function mountMTPC<T = unknown>(
  app: Hono<MTPCEnv>,
  mtpc: MTPC,
  options?: MountMTPCOptions
): Hono<MTPCEnv>
```

#### 参数说明

| 参数 | 类型 | 默认值 | 说明 | 是否必填 |
|------|------|--------|------|----------|
| `app` | `Hono<MTPCEnv>` | - | 现有的 Hono 应用实例 | 是 |
| `mtpc` | `MTPC` | - | MTPC 核心实例 | 是 |
| `options` | `MountMTPCOptions` | `{}` | 挂载配置选项 | 否 |

#### MountMTPCOptions

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `prefix` | `string` | `/api` | API 路由前缀 |
| `handlerFactory` | `<T>(resource: ResourceDefinition) => CRUDHandlers<T>` | 内存处理器工厂 | CRUD 处理器工厂函数 |
| `tenantOptions` | `TenantMiddlewareOptions` | `{}` | 租户中间件配置 |
| `authOptions` | `AuthMiddlewareOptions` | `{}` | 认证中间件配置 |

#### 返回值

更新后的 Hono 应用实例。

## 4. 中间件详解

### 4.1 mtpcMiddleware

MTPC 核心中间件，将 MTPC 实例注入到 Hono 上下文中。

```typescript
function mtpcMiddleware(mtpc: MTPC): MiddlewareHandler<MTPCEnv>
```

**注意**：必须最先注册，是所有其他 MTPC 中间件的前提依赖。

### 4.2 tenantMiddleware

租户解析中间件，从请求中提取租户信息。

```typescript
function tenantMiddleware(options?: TenantMiddlewareOptions): MiddlewareHandler<MTPCEnv>
```

#### TenantMiddlewareOptions

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `headerName` | `string` | `x-tenant-id` | 租户 ID 所在的请求头名称 |
| `queryParam` | `string` | - | 租户 ID 所在的查询参数名称 |
| `cookieName` | `string` | - | 租户 ID 所在的 cookie 名称 |
| `required` | `boolean` | `true` | 是否必须提供租户 ID |

### 4.3 authMiddleware

认证中间件，从请求中提取用户信息。

```typescript
function authMiddleware(options?: AuthMiddlewareOptions): MiddlewareHandler<MTPCEnv>
```

#### AuthMiddlewareOptions

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `required` | `boolean` | `true` | 是否必须认证 |
| `headerName` | `string` | `Authorization` | 认证头名称 |
| `authHeaderPrefix` | `string` | `Bearer` | 认证头前缀 |
| `jwtSecret` | `string` | - | JWT 密钥，用于验证 JWT 令牌 |
| `customAuth` | `(c: Context) => Promise<SubjectContext | null>` | - | 自定义认证函数 |

### 4.4 permissionMiddleware

权限检查中间件，用于检查请求是否有足够的权限。

```typescript
function permissionMiddleware(
  resource: string,
  action: string,
  options?: PermissionMiddlewareOptions
): MiddlewareHandler<MTPCEnv>
```

#### PermissionMiddlewareOptions

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `denyHandler` | `(c: Context) => Response | Promise<Response>` | - | 权限拒绝时的处理函数 |

## 5. 路由生成

### 5.1 自动生成的路由

使用 `createMTPCApp` 或 `mountMTPC` 会自动生成以下路由：

| HTTP 方法 | 路由 | 描述 |
|-----------|------|------|
| GET | `/api/metadata` | 获取资源元数据 |
| GET | `/api/health` | 健康检查 |
| GET | `/api/{resource}` | 列出资源 |
| GET | `/api/{resource}/{id}` | 获取单个资源 |
| POST | `/api/{resource}` | 创建资源 |
| PUT | `/api/{resource}/{id}` | 更新资源 |
| DELETE | `/api/{resource}/{id}` | 删除资源 |

### 5.2 RPC 路由

自动生成的 RPC 路由：

| HTTP 方法 | 路由 | 描述 |
|-----------|------|------|
| POST | `/api/rpc/{resource}/{action}` | 调用资源的 RPC 方法 |

## 6. 错误处理

### 6.1 内置错误处理

`@mtpc/adapter-hono` 提供了统一的错误处理机制：

```typescript
import { mtpcErrorHandler, notFoundHandler } from '@mtpc/adapter-hono';

// 使用内置错误处理
app.onError(mtpcErrorHandler());
app.notFound(notFoundHandler);
```

### 6.2 自定义错误处理

可以自定义错误处理函数：

```typescript
import { mtpcErrorHandler } from '@mtpc/adapter-hono';

// 自定义错误处理
const customErrorHandler = mtpcErrorHandler({
  onError: (err, c) => {
    // 自定义错误日志
    console.error('Custom error log:', err);
    // 返回自定义错误响应
    return c.json({ 
      success: false, 
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
  }
});

app.onError(customErrorHandler);
```

## 7. 高级功能

### 7.1 自定义 CRUD 处理器

可以自定义 CRUD 处理器，替换默认的内存处理器：

```typescript
import { createMTPCApp } from '@mtpc/adapter-hono';
import type { CRUDHandlers, ResourceDefinition } from '@mtpc/adapter-hono';

// 自定义 CRUD 处理器工厂
function createCustomHandlerFactory() {
  return <T>(resource: ResourceDefinition): CRUDHandlers<T> => {
    return {
      async list() {
        // 自定义列表逻辑
        return { success: true, data: [] };
      },
      async get() {
        // 自定义获取逻辑
        return { success: true, data: {} as T };
      },
      async create() {
        // 自定义创建逻辑
        return { success: true, data: {} as T };
      },
      async update() {
        // 自定义更新逻辑
        return { success: true, data: {} as T };
      },
      async delete() {
        // 自定义删除逻辑
        return { success: true };
      }
    };
  };
}

// 使用自定义处理器工厂
const app = createMTPCApp(mtpc, {
  handlerFactory: createCustomHandlerFactory()
});
```

### 7.2 自定义认证

可以使用自定义认证函数：

```typescript
import { createMTPCApp } from '@mtpc/adapter-hono';

const app = createMTPCApp(mtpc, {
  authOptions: {
    customAuth: async (c) => {
      // 自定义认证逻辑
      const token = c.req.header('Authorization')?.replace('Bearer ', '');
      if (!token) {
        return null;
      }
      
      // 验证令牌并返回用户信息
      const user = await validateToken(token);
      return user;
    }
  }
});
```

### 7.3 自定义租户解析

可以自定义租户解析逻辑：

```typescript
import { tenantMiddleware } from '@mtpc/adapter-hono';

// 自定义租户解析中间件
const customTenantMiddleware = tenantMiddleware({
  headerName: 'x-custom-tenant-id',
  required: true
});

app.use('*', customTenantMiddleware);
```

## 8. 最佳实践

### 8.1 中间件注册顺序

中间件注册顺序很重要，建议按照以下顺序注册：

1. `mtpcMiddleware` - 必须最先注册
2. `tenantMiddleware` - 租户解析
3. `authMiddleware` - 认证
4. `permissionMiddleware` - 权限检查
5. 路由处理器

### 8.2 环境配置

根据不同环境配置不同的选项：

```typescript
const app = createMTPCApp(mtpc, {
  logging: process.env.NODE_ENV !== 'production',
  errorHandling: true,
  cors: process.env.NODE_ENV === 'development' ? true : {
    origin: process.env.CORS_ORIGIN || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
  }
});
```

### 8.3 资源定义最佳实践

- 为每个资源定义清晰的 Schema
- 明确资源的 CRUD 权限
- 使用描述性的资源名称和动作名称
- 为资源添加适当的元数据

### 8.4 性能优化

1. **禁用不必要的中间件**：在生产环境中禁用不必要的中间件
2. **启用压缩**：使用 Hono 的压缩中间件
3. **合理配置 CORS**：在生产环境中限制允许的 Origin
4. **优化数据库查询**：使用自定义 CRUD 处理器时，优化数据库查询
5. **使用缓存**：对频繁访问的数据使用缓存

## 9. 常见问题解答

### 9.1 Q: 如何获取当前上下文的 MTPC 实例？

A: 可以通过 Hono 上下文的 `get` 方法获取：

```typescript
const mtpcInstance = c.get('mtpc');
```

### 9.2 Q: 如何获取当前用户信息？

A: 可以通过 Hono 上下文的 `get` 方法获取：

```typescript
const subject = c.get('subject');
```

### 9.3 Q: 如何获取当前租户信息？

A: 可以通过 Hono 上下文的 `get` 方法获取：

```typescript
const tenant = c.get('tenant');
```

### 9.4 Q: 如何自定义路由路径？

A: 可以使用 `createMinimalMTPCApp` 创建最小化应用，然后手动添加路由：

```typescript
const app = createMinimalMTPCApp(mtpc);

// 自定义路由
app.get('/custom-path', async (c) => {
  // 路由处理逻辑
});
```

### 9.5 Q: 如何集成数据库？

A: 可以自定义 CRUD 处理器，集成数据库操作：

```typescript
function createDatabaseHandlerFactory() {
  return <T>(resource: ResourceDefinition): CRUDHandlers<T> => {
    return {
      async list() {
        // 数据库查询
        const data = await db.query(resource.name).findMany();
        return { success: true, data };
      },
      // 其他 CRUD 方法...
    };
  };
}

const app = createMTPCApp(mtpc, {
  handlerFactory: createDatabaseHandlerFactory()
});
```

### 9.6 Q: 如何添加自定义中间件？

A: 可以在创建应用后添加自定义中间件：

```typescript
const app = createMTPCApp(mtpc);

// 添加自定义中间件
app.use('*', async (c, next) => {
  // 自定义中间件逻辑
  await next();
});
```

## 10. 性能考量

### 10.1 中间件开销

- 每个中间件都会增加请求处理时间，建议只使用必要的中间件
- 考虑将中间件应用到特定路由，而不是所有路由

### 10.2 权限检查性能

- 权限检查会增加请求处理时间，建议使用缓存优化
- 考虑使用 `@mtpc/policy-cache` 包优化权限检查性能

### 10.3 路由生成性能

- 自动生成的路由会增加应用启动时间，特别是在资源较多时
- 考虑在生产环境中手动定义路由，避免自动生成的开销

### 10.4 日志性能

- 日志记录会影响性能，建议在生产环境中调整日志级别
- 考虑使用异步日志记录

## 11. 注意事项

1. **中间件顺序**：必须按照正确的顺序注册中间件
2. **MTPC 初始化**：必须在使用 MTPC 实例前调用 `init()` 方法
3. **资源注册**：必须在调用 `init()` 前注册所有资源
4. **租户隔离**：确保租户数据正确隔离，避免跨租户访问
5. **认证安全**：确保认证机制安全，避免未授权访问
6. **权限检查**：确保所有敏感操作都经过权限检查
7. **错误处理**：确保所有错误都被正确处理，避免泄露敏感信息
8. **CORS 配置**：在生产环境中合理配置 CORS，避免安全问题
9. **日志安全**：确保日志中不包含敏感信息
10. **测试覆盖**：确保所有功能都经过充分测试

## 12. 版本更新日志

### v1.0.0 (2024-01-01)

- 初始版本发布
- 支持创建完整的 MTPC Hono 应用
- 支持创建最小化的 MTPC Hono 应用
- 支持挂载 MTPC 路由到现有 Hono 应用
- 提供租户解析、认证、权限检查中间件
- 支持自动生成 CRUD 路由和 RPC 路由
- 提供统一的错误处理机制
- 支持自定义 CRUD 处理器
- 支持自定义认证和租户解析

## 13. 贡献指南

欢迎为 `@mtpc/adapter-hono` 包贡献代码或提出改进建议。请遵循以下准则：

1. 提交 Issues 描述问题或建议
2. 提交 Pull Requests 前确保所有测试通过
3. 遵循项目的代码风格和命名规范
4. 提供完整的测试用例
5. 更新相关文档
6. 确保代码符合 TypeScript 类型安全要求

## 14. 许可证

`@mtpc/adapter-hono` 包采用 MIT 许可证，详见 LICENSE 文件。

## 15. 联系方式

- 项目仓库：https://github.com/your-org/mtpc
- 问题反馈：https://github.com/your-org/mtpc/issues
- 文档地址：https://docs.mtpc.io

---

通过本指南，您应该已经掌握了 `@mtpc/adapter-hono` 包的核心功能和使用方法。如果您有任何问题或建议，欢迎随时反馈。