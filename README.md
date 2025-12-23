# MTPC - Multi-Tenant Permission Core

MTPC 是一个**业务无关、可嵌入、可组合**的多租户权限内核库。

## 核心定位

MTPC 不是完整的权限系统，而是**权限基础设施内核**。它提供：

- 统一的多租户权限抽象模型
- 通过 Resource Definition 派生权限码、CRUD、类型、菜单元数据
- 编译期优先的类型安全保证
- 运行时稳定的权限判定与扩展点

> MTPC ≠ 权限系统
> MTPC = 权限系统的"内核与引擎"

## 核心特性

- **多租户优先** - Tenant 作为第一等公民，所有权限判定在租户上下文中执行
- **Schema-driven** - Resource Definition 是唯一权威来源
- **编译期优先** - 能在编译期生成的内容绝不推迟到运行期
- **可扩展** - 插件系统、钩子机制、策略引擎支持灵活扩展
- **默认拒绝** - 权限校验失败即拒绝，不存在隐式放行

## 快速开始

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行测试
pnpm test
```

## 基本使用

### 1. 定义 Resource

```typescript
import { defineResource } from '@mtpc/core';
import { z } from 'zod';

const userResource = defineResource({
  name: 'user',
  displayName: '用户',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
});
```

### 2. 创建 MTPC 实例并注册

```typescript
import { createMTPC } from '@mtpc/core';

const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    // 从数据库或外部服务加载权限
    return await loadPermissionsFromDB(tenantId, subjectId);
  },
});

mtpc.registerResource(userResource);
```

### 3. 注册策略

```typescript
mtpc.registerPolicy({
  id: 'admin-access',
  name: '管理员完全访问',
  rules: [{
    permissions: ['*'],
    effect: 'allow',
    conditions: [{
      type: 'field',
      field: 'subject.roles',
      operator: 'in',
      value: ['admin'],
    }],
  }],
  priority: 'high',
  enabled: true,
});
```

### 4. 初始化

```typescript
await mtpc.init();
```

### 5. 权限检查

```typescript
const context = mtpc.createContext(
  { id: 'tenant-1' },           // tenant
  { id: 'user-1', type: 'user', roles: ['admin'] }  // subject
);

const result = await mtpc.checkPermission({
  ...context,
  resource: 'user',
  action: 'delete',
});

if (!result.allowed) {
  throw new Error('权限不足');
}
```

## 核心概念

### Resource

Resource 是 MTPC 的核心抽象，表示一个"可受权限控制的对象集合"。

```typescript
interface ResourceDefinition {
  name: string;           // 资源唯一标识
  displayName?: string;   // 显示名称
  schema: SchemaDefinition;
  features: ResourceFeatures;
  permissions?: PermissionDefinition[];
  hooks?: ResourceHooks;
}
```

### Permission

Permission 是对 Resource 可执行操作的最小授权单元，具有稳定、可生成的 Permission Code。

- CRUD 派生：`user:create`, `user:read`, `user:update`, `user:delete`
- 自定义权限：通过 `permissions` 定义

### Policy

Policy 用于表达权限组合与条件规则，支持：

- 声明式规则（字段比较、时间条件、IP 限制）
- 函数式动态判定

### Tenant

Tenant 是多租户隔离的第一等公民。所有权限判定都在 Tenant Context 下执行。

### Registry

Registry 是 MTPC 的"运行时事实表"，负责集中管理：

- Resource Registry
- Permission Registry
- Policy Registry

## 派生模型

```
Resource Definition
        │
        ├─→ CRUD Capability (逻辑层)
        ├─→ Permission Codes (类型安全)
        ├─→ Menu Metadata (UI-无关)
        ├─→ Validation Schemas
        └─→ Shared TypeScript Types
```

## 扩展机制

### Plugin System

插件用于扩展 MTPC 的能力：

```typescript
const auditPlugin: PluginDefinition = {
  name: 'audit-log',
  version: '1.0.0',
  install(ctx) {
    ctx.registerGlobalHooks({
      afterAny: async (ctx, op, resource, result) => {
        await logAuditTrail(ctx, op, resource, result);
      },
    });
  },
};

mtpc.use(auditPlugin);
```

### Hooks

Hooks 用于在资源生命周期关键节点插入行为：

```typescript
const userResource = defineResource({
  name: 'user',
  schema: z.object({...}),
  features: { create: true, read: true },
  hooks: {
    beforeCreate: async (ctx, input) => {
      // 验证或转换输入
      return input;
    },
    filterQuery: async (ctx, query) => {
      // 行级权限过滤
      return { ...query, tenantId: ctx.tenant.id };
    },
  },
});
```

## 官方扩展

### @mtpc/rbac

Role-Based Access Control 扩展，用于将权限聚合为 Role。

### @mtpc/policy-cache

策略缓存扩展，优化 Policy Evaluation 的运行时性能。

### @mtpc/explain

权限决策解释扩展，提供权限判定过程的解释能力。

## Adapter 层

MTPC Core 不依赖任何具体技术栈，通过 Adapter 层对接：

- **@mtpc/adapter-hono** - Hono Web 框架集成
- **@mtpc/adapter-drizzle** - Drizzle ORM 数据库集成

## Monorepo 结构

```
packages/              # 核心包
  core/               # 权限核心
  rbac/               # RBAC 扩展
  policy-cache/       # 策略缓存扩展
  explain/            # 权限解释扩展
  adapter-hono/       # Hono 适配器
  adapter-drizzle/    # Drizzle 适配器
  codegen/            # 代码生成 CLI
  shared/             # 共享工具和类型

apps/                 # 示例应用
  example-api/        # Hono + Drizzle API 示例
  example-web/        # React + Vite 前端示例
```

## 设计原则

1. **Business-agnostic** - 核心不包含 User/Role/Menu 等具体业务模型
2. **Schema-driven** - Resource Definition 是唯一权威来源
3. **Compile-time First** - 编译期优先，确保类型安全与一致性
4. **Library, not Service** - 以内嵌库方式运行
5. **Extensible by Design** - 通过插件、钩子与策略扩展
6. **Fail-safe Authorization** - 默认拒绝

## 技术栈

- TypeScript 5.3+
- Node.js 18+
- pnpm 8.15.0 / Turbo 2.0
- Biome (格式化 + Lint) / Vitest
- Hono / Drizzle ORM / React + Vite

## 许可证

MIT
