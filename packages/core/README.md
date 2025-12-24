# @mtpc/core

> MTPC (Multi-Tenant Permission Core) - 业务无关、可嵌入、可组合的多租户权限内核

## 概述

`@mtpc/core` 是一个**权限基础设施内核**，不是完整的权限系统。它提供了一套可组合的模块，用于构建自定义的权限控制系统。

### 核心特点

- **业务无关** - 不包含 User/Role/Menu 等具体业务模型
- **Schema-driven** - Resource Definition 是唯一权威来源
- **可嵌入** - 以库方式运行，非独立微服务
- **可组合** - 通过插件和钩子扩展功能
- **类型安全** - 完整的 TypeScript 类型定义
- **多租户原生** - Tenant 是第一等公民

### 设计原则

1. **组合优于继承** - 通过组合各个子系统扩展功能
2. **单一职责** - 每个子系统专注自己的职责
3. **开放封闭** - 对扩展开放（插件），对修改封闭（冻结机制）
4. **默认拒绝** - 权限校验失败即拒绝访问

## 快速开始

### 安装

```bash
npm install @mtpc/core
# 或
pnpm add @mtpc/core
```

### 基础用法

```typescript
import { createMTPC, defineResource } from '@mtpc/core';

// 1. 创建 MTPC 实例
const mtpc = createMTPC();

// 2. 定义资源
const userResource = defineResource({
  name: 'user',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    tenantId: z.string(),
  }),
  features: {
    creatable: true,
    readable: true,
    updatable: true,
    deletable: true,
    listable: true,
  },
});

mtpc.registerResource(userResource);

// 3. 初始化系统
await mtpc.init();

// 4. 检查权限
const context = {
  tenant: { id: 'tenant-123', type: 'organization' },
  subject: { id: 'user-456', type: 'user', roles: ['admin'] },
  resource: 'user',
  action: 'read',
  request: { timestamp: new Date(), ip: '127.0.0.1' },
};

const result = await mtpc.checkPermission(context);
console.log(result.allowed); // true/false
```

## 核心概念

### Resource（资源）

资源是权限控制对象的抽象，是 MTPC 的核心。每个资源定义包含：

- **Schema** - Zod 数据验证模式
- **Features** - CRUD 能力配置
- **Permissions** - 自动生成的权限代码
- **Hooks** - 生命周期钩子

```typescript
const orderResource = defineResource({
  name: 'order',
  schema: z.object({
    id: z.string(),
    userId: z.string(),
    total: z.number(),
    status: z.enum(['pending', 'completed']),
  }),
  metadata: {
    displayName: '订单',
    group: 'business',
  },
});
```

### Permission（权限）

权限是最小授权单元，具有稳定的 Permission Code：

- **格式**: `{resource}:{action}`
- **示例**: `user:read`, `order:create`, `product:delete`

```typescript
// 自动生成的权限代码
const permissions = mtpc.getPermissionCodes();
// {
//   'user:create': '创建用户',
//   'user:read': '查看用户',
//   'user:update': '更新用户',
//   'user:delete': '删除用户',
//   'user:list': '用户列表'
// }
```

### Policy（策略）

策略是权限组合与条件规则，支持声明式和函数式：

```typescript
import { createPolicy } from '@mtpc/core';

const adminPolicy = createPolicy('admin-full-access')
  .effect('allow')
  .priority(1000)
  .condition({
    type: 'subject',
    field: 'roles',
    operator: 'contains',
    value: 'admin',
  })
  .permissions(['*'])
  .build();

mtpc.registerPolicy(adminPolicy);
```

### Tenant（租户）

多租户隔离的第一等公民，所有权限判定在 Tenant Context 下执行：

```typescript
const context = {
  tenant: { id: 'tenant-123', type: 'organization' },
  subject: { id: 'user-456', type: 'user' },
  // ...
};
```

## 模块架构

```
@mtpc/core
│
├── Resource Module     # 资源定义与验证
├── Permission Module    # 权限检查与生成
├── Policy Module        # 策略引擎与编译
├── Registry Module      # 运行时注册表
├── Hooks Module         # 生命周期钩子
├── Plugin Module        # 插件系统
├── Tenant Module        # 租户管理
└── Types Module         # TypeScript 类型定义
```

### 各模块职责

| 模块 | 功能 | 主要导出 |
|------|------|----------|
| `resource` | 资源定义、验证、构建 | `defineResource()`, `ResourceBuilder` |
| `permission` | 权限检查、生成 | `PermissionChecker`, `generatePermissions()` |
| `policy` | 策略评估、编译 | `DefaultPolicyEngine`, `compilePolicy()` |
| `registry` | 资源/权限/策略注册 | `UnifiedRegistry`, `createUnifiedRegistry()` |
| `hooks` | 钩子执行、全局钩子 | `HookExecutor`, `GlobalHooksManager` |
| `plugin` | 插件管理、上下文 | `DefaultPluginManager`, `createPluginContext()` |
| `tenant` | 租户上下文、管理 | `TenantManager`, `TenantContext` |
| `types` | TypeScript 类型 | 所有核心类型定义 |

## API 参考

### MTPC 主类

```typescript
class MTPC {
  // 只读子系统
  readonly registry: UnifiedRegistry;
  readonly policyEngine: DefaultPolicyEngine;
  readonly permissionChecker: PermissionChecker;
  readonly globalHooks: GlobalHooksManager;
  readonly plugins: DefaultPluginManager;
  readonly tenants: TenantManager;

  // 资源管理
  registerResource(resource: ResourceDefinition): this;
  registerResources(resources: ResourceDefinition[]): this;
  getResource(name: string): ResourceDefinition | undefined;
  getResourceNames(): string[];

  // 策略管理
  registerPolicy(policy: PolicyDefinition): this;
  registerPolicies(policies: PolicyDefinition[]): this;

  // 插件系统
  use(plugin: PluginDefinition): this;

  // 初始化
  async init(): Promise<this>;
  isInitialized(): boolean;

  // 上下文
  createContext(tenant: TenantContext, subject?: SubjectContext): MTPCContext;

  // 权限检查
  async checkPermission(context: PermissionCheckContext): Promise<PermissionCheckResult>;
  async requirePermission(context: PermissionCheckContext): Promise<void>;

  // 策略评估
  async evaluatePolicy(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult>;

  // 元数据
  getPermissionCodes(): Record<string, string>;
  exportMetadata(): Metadata;
  getSummary(): Summary;
}
```

### 工厂函数

```typescript
// 创建 MTPC 实例
function createMTPC(options?: MTPCOptions): MTPC

// 获取默认实例（单例模式）
function getDefaultMTPC(): MTPC
```

## 高级功能

### 插件系统

```typescript
import { createPluginDefinition } from '@mtpc/core';

const auditPlugin = createPluginDefinition({
  name: 'audit-log',
  version: '1.0.0',
  install(context) {
    context.registerGlobalHooks({
      afterAny: [async (ctx, operation, resource, result) => {
        await auditLogger.log({ ctx, operation, resource, result });
      }],
    });
  },
});

mtpc.use(auditPlugin);
```

### 资源钩子

```typescript
const userResource = defineResource({
  name: 'user',
  schema: userSchema,
  hooks: {
    beforeCreate: [
      async (ctx, data) => {
        data.createdAt = new Date();
        return { proceed: true, data };
      },
    ],
    afterRead: [
      async (ctx, result) => {
        // 隐藏敏感字段
        delete result.password;
        return result;
      },
    ],
  },
});
```

### 自定义策略条件

```typescript
import { createConditionEvaluator } from '@mtpc/core';

// 注册自定义条件类型
mtpc.policyEngine.registerConditionType('ipWhitelist', async (condition, context) => {
  const allowedIPs = condition.value as string[];
  return allowedIPs.includes(context.request.ip);
});
```

## 派生模型

```
Resource Definition
        │
        ├─→ CRUD Capability (逻辑层)
        ├─→ Permission Codes (类型安全)
│   user:read, user:create, user:update, user:delete, user:list
│
├─→ Validation Schemas
│   createSchema, updateSchema, schema
│
├─→ Menu Metadata (UI-无关)
│   displayName, icon, group, sortOrder
│
└─→ Shared TypeScript Types
    UserEntity, CreateUserInput, UpdateUserInput
```

## 扩展包

MTPC Core 可与以下扩展包配合使用：

| 包名 | 功能 |
|------|------|
| `@mtpc/rbac` | 基于角色的访问控制 |
| `@mtpc/data-scope` | 行级安全/数据范围控制 |
| `@mtpc/policy-cache` | 策略缓存扩展 |
| `@mtpc/explain` | 权限决策解释扩展 |
| `@mtpc/adapter-drizzle` | Drizzle ORM 适配器 |
| `@mtpc/adapter-hono` | Hono Web 框架适配器 |
| `@mtpc/codegen` | 代码生成 CLI 工具 |

## 文档

- [使用指南](./USAGE_GUIDE.md) - 详细的使用文档和示例
- [优化建议](./OPTIMIZATION.md) - 性能优化和开发计划
- [架构文档](../../.claude/docs/architecture.md) - 系统架构设计文档

## 类型定义

完整的 TypeScript 类型定义，包括：

- **Context Types** - 租户、主体、请求、MTPC 上下文
- **Resource Types** - 资源定义、关系、元数据
- **Permission Types** - 权限定义、检查上下文/结果
- **Policy Types** - 策略定义、条件类型、评估上下文/结果
- **Plugin Types** - 插件定义、上下文、管理器
- **Hooks Types** - 资源钩子、全局钩子
- **Feature Types** - CRUD 特性配置
- **Common Types** - 通用类型（分页、排序、过滤）

## 许可证

MIT

---

**更多信息**: 请参考 [MTPC 项目文档](../../.claude/docs/architecture.md)
