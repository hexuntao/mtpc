# MTPC Core 使用指南

## 目录

1. [概述](#1-概述)
2. [快速开始](#2-快速开始)
3. [核心概念](#3-核心概念)
4. [资源定义与管理](#4-资源定义与管理)
5. [权限系统](#5-权限系统)
6. [策略引擎](#6-策略引擎)
7. [注册表系统](#7-注册表系统)
8. [插件系统](#8-插件系统)
9. [钩子系统](#9-钩子系统)
10. [多租户支持](#10-多租户支持)
11. [API 参考](#11-api-参考)
12. [常见问题](#12-常见问题)
13. [最佳实践](#13-最佳实践)

---

## 1. 概述

### 1.1 什么是 MTPC Core

**MTPC (Multi-Tenant Permission Core)** 是一个业务无关、可嵌入、可组合的多租户权限内核。它不是一个可直接部署的系统，而是作为依赖被真实业务系统（SaaS、内部后台、B端系统等）引入。

### 1.2 核心特性

- **业务无关**: 不绑定任何特定业务逻辑，可适用于任何需要权限控制的场景
- **可嵌入**: 作为 npm 包引入，不依赖外部服务
- **可组合**: 通过插件系统和钩子系统实现灵活扩展
- **编译期优先**: 在编译期和启动期完成大部分配置，减少运行时开销
- **默认拒绝**: 遵循安全最佳实践，默认拒绝所有访问
- **多租户支持**: 内置多租户隔离能力

### 1.3 架构设计原则

- **Schema 驱动**: 使用 Zod Schema 定义资源结构作为单一事实源
- **声明式配置**: 通过声明式 API 定义资源和策略
- **可扩展性**: 通过插件系统扩展功能
- **类型安全**: 完整的 TypeScript 类型支持

---

## 2. 快速开始

### 2.1 安装依赖

```bash
# 使用 pnpm 安装
pnpm add @mtpc/core

# 安装可选依赖（用于 Schema 定义）
pnpm add zod
```

### 2.2 创建 MTPC 实例

```typescript
import { createMTPC } from '@mtpc/core';

// 创建 MTPC 实例
const mtpc = createMTPC({
  // 配置选项（可选）
  defaultPermissionResolver: async (tenantId: string, subjectId: string) => {
    // 实现自定义权限解析逻辑
    // 返回权限代码集合
    return new Set(['user:read', 'user:create']);
  }
});
```

### 2.3 定义和注册资源

```typescript
import { defineResource } from '@mtpc/core';
import { z } from 'zod';

// 定义用户资源
const userResource = defineResource({
  name: 'user',
  schema: z.object({
    id: z.string(),
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(['admin', 'user', 'guest'])
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: true,
    // 自定义特性
    export: true
  },
  // 自定义权限（除了 CRUD 自动生成的权限外）
  permissions: [
    {
      action: 'impersonate',
      description: '模拟用户',
      metadata: { requiresAdmin: true }
    }
  ],
  metadata: {
    displayName: '用户',
    group: '核心模块',
    icon: 'user'
  }
});

// 注册资源到 MTPC 实例
mtpc.registerResource(userResource);
```

### 2.4 定义和注册策略

```typescript
// 注册策略
mtpc.registerPolicy({
  id: 'admin-only-delete',
  name: '仅管理员可删除用户',
  rules: [{
    permissions: ['user:delete'],
    effect: 'allow',
    conditions: [{
      type: 'field',
      field: 'subject.attributes.role',
      operator: 'eq',
      value: 'admin'
    }]
  }],
  priority: 'high',
  enabled: true
});
```

### 2.5 初始化 MTPC

```typescript
// 初始化 MTPC 实例
await mtpc.init();

// 检查初始化状态
console.log('MTPC 初始化状态:', mtpc.isInitialized());

// 获取系统摘要
console.log('系统摘要:', mtpc.getSummary());
```

### 2.6 权限检查

```typescript
// 创建上下文
const context = mtpc.createContext(
  { id: 'tenant-123' }, // 租户上下文
  {
    id: 'user-123',
    type: 'user',
    attributes: { role: 'user' }
  } // 主体上下文
);

// 检查单个权限
const result = await mtpc.checkPermission({
  ...context,
  resource: 'user',
  action: 'read'
});

console.log('权限检查结果:', result);
// 输出: { allowed: true, permission: 'user:read', reason: 'Permission granted', evaluationTime: 2 }

// 检查权限并在无权限时抛出异常
try {
  await mtpc.requirePermission({
    ...context,
    resource: 'user',
    action: 'delete'
  });
  console.log('有权限执行删除操作');
} catch (error) {
  console.log('无权限执行删除操作:', error.message);
}
```

---

## 3. 核心概念

### 3.1 Resource（资源）

资源是系统中需要进行权限控制的实体，例如用户、订单、文章等。资源通过 `defineResource` 函数定义，包含：

- **Schema**: 使用 Zod 定义的数据结构
- **Features**: 支持的操作特性（CRUD + 自定义）
- **Permissions**: 资源关联的权限列表
- **Hooks**: 资源级别的钩子函数
- **Metadata**: 资源的元数据信息

### 3.2 Permission（权限）

权限是对资源执行特定操作的许可。权限代码格式为 `resource:action`，例如：

- `user:read` - 读取用户
- `user:create` - 创建用户
- `user:update` - 更新用户
- `user:delete` - 删除用户
- `user:impersonate` - 模拟用户（自定义权限）

### 3.3 Policy（策略）

策略定义了权限的授予规则，包含：

- **Rules**: 规则列表，每个规则包含权限、效果和条件
- **Priority**: 策略优先级（critical > high > medium > low）
- **Enabled**: 是否启用策略
- **TenantId**: 租户 ID（可选，用于租户隔离）

### 3.4 Context（上下文）

上下文包含权限检查所需的信息：

- **TenantContext**: 租户上下文，包含租户 ID、状态和元数据
- **SubjectContext**: 主体上下文，包含主体 ID、类型、属性和权限集合

### 3.5 Plugin（插件）

插件是扩展 MTPC 功能的机制，通过实现 `PluginDefinition` 接口来定义插件：

- **Register**: 注册阶段，用于注册资源、策略等
- **Install**: 安装阶段，用于设置全局钩子等
- **Init**: 初始化阶段，用于执行初始化逻辑
- **Destroy**: 销毁阶段，用于清理资源

### 3.6 Hook（钩子）

钩子是在特定事件发生时执行的回调函数，分为：

- **Resource Hooks**: 资源级别的钩子（beforeCreate, afterCreate, beforeRead, afterRead 等）
- **Global Hooks**: 全局级别的钩子（beforeAny, afterAny, onError）

---

## 4. 资源定义与管理

### 4.1 基本资源定义

```typescript
import { defineResource } from '@mtpc/core';
import { z } from 'zod';

const userResource = defineResource({
  name: 'user',
  schema: z.object({
    id: z.string(),
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(['admin', 'user', 'guest'])
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: true
  },
  metadata: {
    displayName: '用户',
    group: '核心模块',
    icon: 'user'
  }
});
```

### 4.2 使用 ResourceBuilder

```typescript
import { ResourceBuilder } from '@mtpc/core';
import { z } from 'zod';

const userResource = new ResourceBuilder('user')
  .setSchema(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email()
  }))
  .setFeatures({
    create: true,
    read: true,
    update: true,
    delete: true
  })
  .setMetadata({
    displayName: '用户',
    group: '核心模块'
  })
  .addPermission({
    action: 'impersonate',
    description: '模拟用户'
  })
  .addHook('beforeCreate', async (context, data) => {
    // 验证逻辑
    return data;
  })
  .build();
```

### 4.3 资源特性配置

```typescript
const productResource = defineResource({
  name: 'product',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    stock: z.number()
  }),
  features: {
    // 基础 CRUD 特性
    create: true,
    read: true,
    update: true,
    delete: false, // 禁用删除

    // 高级特性
    list: true,      // 列表查询
    search: true,    // 搜索
    export: true,    // 导出
    import: false,   // 禁用导入
    archive: true,   // 归档
    restore: true    // 恢复
  }
});
```

### 4.4 资源钩子

```typescript
const orderResource = defineResource({
  name: 'order',
  schema: z.object({
    id: z.string(),
    amount: z.number(),
    status: z.enum(['pending', 'paid', 'shipped', 'delivered'])
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: true
  },
  hooks: {
    // 创建前钩子
    beforeCreate: async (context, input) => {
      // 验证订单金额
      if (input.amount <= 0) {
        throw new Error('订单金额必须大于0');
      }
      // 可以修改输入数据
      return { ...input, createdAt: new Date() };
    },

    // 创建后钩子
    afterCreate: async (context, input, created) => {
      // 发送通知
      console.log(`订单 ${created.id} 创建成功`);
      // 可以执行异步操作
      await sendOrderConfirmationEmail(created);
    },

    // 更新前钩子
    beforeUpdate: async (context, id, data) => {
      // 验证状态转换
      const order = await getOrderById(id);
      if (order.status === 'delivered' && data.status) {
        throw new Error('已送达的订单不能修改状态');
      }
      return data;
    },

    // 更新后钩子
    afterUpdate: async (context, id, data, updated) => {
      // 记录变更日志
      await logOrderChange(id, data, updated);
    },

    // 删除前钩子
    beforeDelete: async (context, id) => {
      // 检查是否可以删除
      const order = await getOrderById(id);
      if (order.status === 'paid') {
        throw new Error('已支付的订单不能删除');
      }
      return id;
    },

    // 删除后钩子
    afterDelete: async (context, id, deleted) => {
      // 清理关联数据
      await cleanupOrderItems(id);
    },

    // 列表查询前钩子
    beforeList: async (context, options) => {
      // 添加默认过滤条件
      return {
        ...options,
        filters: [
          ...(options.filters || []),
          { field: 'deleted', operator: 'eq', value: false }
        ]
      };
    },

    // 列表查询后钩子
    afterList: async (context, options, results) => {
      // 添加计算字段
      return results.map(order => ({
        ...order,
        totalAmount: order.amount + order.tax
      }));
    },

    // 过滤查询钩子
    filterQuery: async (context, filters) => {
      // 添加租户隔离过滤
      return [
        ...filters,
        { field: 'tenantId', operator: 'eq', value: context.tenant.id }
      ];
    }
  }
});
```

### 4.5 资源关系

```typescript
const orderResource = defineResource({
  name: 'order',
  schema: z.object({
    id: z.string(),
    userId: z.string(),
    productId: z.string(),
    amount: z.number()
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: true
  },
  relations: {
    // 一对一关系
    user: {
      type: 'one',
      resource: 'user',
      foreignKey: 'userId'
    },
    // 一对多关系
    items: {
      type: 'many',
      resource: 'orderItem',
      foreignKey: 'orderId'
    }
  }
});
```

### 4.6 批量注册资源

```typescript
// 批量注册资源
mtpc.registerResources([
  userResource,
  productResource,
  orderResource
]);

// 或者使用数组展开
mtpc.registerResources(...[
  userResource,
  productResource,
  orderResource
]);
```

---

## 5. 权限系统

### 5.1 权限生成

MTPC 会根据资源的 features 自动生成权限：

```typescript
const userResource = defineResource({
  name: 'user',
  features: {
    create: true,
    read: true,
    update: true,
    delete: true,
    export: true
  }
});

// 自动生成的权限：
// - user:create
// - user:read
// - user:update
// - user:delete
// - user:export
// - user:list (如果 list 特性启用)
// - user:search (如果 search 特性启用)
```

### 5.2 自定义权限

```typescript
const userResource = defineResource({
  name: 'user',
  features: {
    create: true,
    read: true,
    update: true,
    delete: true
  },
  permissions: [
    {
      action: 'impersonate',
      description: '模拟用户',
      metadata: { requiresAdmin: true }
    },
    {
      action: 'resetPassword',
      description: '重置用户密码',
      metadata: { requiresAdmin: true }
    },
    {
      action: 'changeRole',
      description: '更改用户角色',
      metadata: { requiresManager: true }
    }
  ]
});
```

### 5.3 权限检查

```typescript
// 创建上下文
const context = mtpc.createContext(
  { id: 'tenant-123' },
  { id: 'user-123', type: 'user' }
);

// 检查单个权限
const result = await mtpc.checkPermission({
  ...context,
  resource: 'user',
  action: 'read'
});

console.log(result);
// {
//   allowed: true,
//   permission: 'user:read',
//   reason: 'Permission granted',
//   evaluationTime: 2
// }

// 检查权限并在无权限时抛出异常
try {
  await mtpc.requirePermission({
    ...context,
    resource: 'user',
    action: 'delete'
  });
  console.log('有权限执行删除操作');
} catch (error) {
  console.log('无权限执行删除操作:', error.message);
}
```

### 5.4 批量权限检查

```typescript
// 并行检查多个权限
const checkResults = await Promise.all([
  mtpc.checkPermission({ ...context, resource: 'user', action: 'read' }),
  mtpc.checkPermission({ ...context, resource: 'user', action: 'update' }),
  mtpc.checkPermission({ ...context, resource: 'user', action: 'delete' }),
  mtpc.checkPermission({ ...context, resource: 'user', action: 'export' })
]);

console.log('批量检查结果:', checkResults);
console.log('是否所有权限都允许:', checkResults.every(r => r.allowed));
console.log('是否有任意权限允许:', checkResults.some(r => r.allowed));

// 使用循环批量检查
const permissions = [
  { resource: 'user', action: 'read' },
  { resource: 'user', action: 'update' },
  { resource: 'user', action: 'delete' }
];

const results = new Map();
for (const perm of permissions) {
  const result = await mtpc.checkPermission({ ...context, ...perm });
  results.set(`${perm.resource}:${perm.action}`, result);
}
```

### 5.5 通配符权限

```typescript
// 通配符权限表示所有权限
const adminPermissions = new Set(['*']);

// 通配符资源权限表示资源的所有操作
const userAdminPermissions = new Set(['user:*']);

// 通配符操作权限表示所有资源的指定操作
const readAllPermissions = new Set(['*:read']);
```

### 5.6 权限缓存

PermissionChecker 内置了权限缓存机制，可以显著提高性能：

```typescript
import { PermissionChecker } from '@mtpc/core';

const checker = new PermissionChecker({
  cacheSize: 1000,        // 缓存大小
  cacheTtl: 60000,        // 缓存生存时间（毫秒）
  permissionResolver: async (tenantId, subjectId) => {
    // 从数据库或缓存获取权限
    return await getPermissions(tenantId, subjectId);
  }
});

// 清除缓存
checker.clearCache();

// 清除特定主体的缓存
checker.clearSubjectCache(tenantId, subjectId);
```

---

## 6. 策略引擎

### 6.1 策略定义

```typescript
mtpc.registerPolicy({
  id: 'admin-full-access',
  name: '管理员完全访问',
  description: '管理员拥有所有资源的完全访问权限',
  rules: [{
    permissions: ['*'],
    effect: 'allow',
    conditions: [{
      type: 'field',
      field: 'subject.attributes.role',
      operator: 'eq',
      value: 'admin'
    }]
  }],
  priority: 'critical',
  enabled: true
});
```

### 6.2 使用 PolicyBuilder

```typescript
import { PolicyBuilder } from '@mtpc/core';

const policy = new PolicyBuilder('admin-full-access')
  .setName('管理员完全访问')
  .setDescription('管理员拥有所有资源的完全访问权限')
  .setPriority('critical')
  .setEnabled(true)
  .addRule({
    permissions: ['*'],
    effect: 'allow'
  })
  .withCondition({
    type: 'field',
    field: 'subject.attributes.role',
    operator: 'eq',
    value: 'admin'
  })
  .build();

mtpc.registerPolicy(policy);
```

### 6.3 策略条件类型

#### 6.3.1 字段条件

```typescript
mtpc.registerPolicy({
  id: 'field-condition-policy',
  name: '基于字段的策略',
  rules: [{
    permissions: ['order:approve'],
    effect: 'allow',
    conditions: [{
      type: 'field',
      field: 'subject.attributes.role',
      operator: 'eq',
      value: 'manager'
    }]
  }]
});

// 支持的操作符：
// - eq: 等于
// - neq: 不等于
// - in: 在列表中
// - notIn: 不在列表中
// - contains: 包含（用于数组字段）
// - gt: 大于
// - gte: 大于等于
// - lt: 小于
// - lte: 小于等于
```

#### 6.3.2 时间条件

```typescript
mtpc.registerPolicy({
  id: 'business-hours-policy',
  name: '工作时间访问策略',
  rules: [{
    permissions: ['*'],
    effect: 'allow',
    conditions: [{
      type: 'time',
      operator: 'between',
      value: { start: '09:00', end: '18:00' }
    }]
  }]
});

// 支持的操作符：
// - between: 在时间范围内
// - notBetween: 不在时间范围内
// - before: 在指定时间之前
// - after: 在指定时间之后
```

#### 6.3.3 IP 条件

```typescript
mtpc.registerPolicy({
  id: 'ip-whitelist-policy',
  name: 'IP 白名单策略',
  rules: [{
    permissions: ['admin:*'],
    effect: 'allow',
    conditions: [{
      type: 'ip',
      operator: 'in',
      value: ['192.168.1.0/24', '10.0.0.0/8']
    }]
  }]
});

// 支持的操作符：
// - in: 在 IP 列表中
// - notIn: 不在 IP 列表中
```

#### 6.3.4 自定义条件

```typescript
// 添加自定义条件处理器
mtpc.policyEngine.addConditionHandler('custom', async (condition, context) => {
  // 实现自定义条件逻辑
  const { field, operator, value } = condition;

  // 获取字段值
  const fieldValue = getFieldValue(context, field);

  // 执行自定义比较
  return customCompare(fieldValue, operator, value);
});

// 使用自定义条件
mtpc.registerPolicy({
  id: 'custom-condition-policy',
  name: '自定义条件策略',
  rules: [{
    permissions: ['resource:action'],
    effect: 'allow',
    conditions: [{
      type: 'custom',
      field: 'subject.attributes.customField',
      operator: 'customOperator',
      value: 'customValue'
    }]
  }]
});
```

### 6.4 多条件组合

```typescript
mtpc.registerPolicy({
  id: 'multi-condition-policy',
  name: '多条件策略',
  rules: [{
    permissions: ['order:approve'],
    effect: 'allow',
    conditions: [
      {
        type: 'field',
        field: 'subject.attributes.role',
        operator: 'eq',
        value: 'manager'
      },
      {
        type: 'field',
        field: 'subject.attributes.department',
        operator: 'in',
        value: ['finance', 'sales']
      },
      {
        type: 'time',
        operator: 'between',
        value: { start: '09:00', end: '18:00' }
      }
    ]
  }]
});
```

### 6.5 策略优先级

```typescript
// 策略优先级：critical > high > medium > low
mtpc.registerPolicy({
  id: 'super-admin-policy',
  name: '超级管理员策略',
  rules: [{
    permissions: ['*'],
    effect: 'allow',
    conditions: [{
      type: 'field',
      field: 'subject.id',
      operator: 'eq',
      value: 'super-admin'
    }]
  }],
  priority: 'critical', // 最高优先级
  enabled: true
});

mtpc.registerPolicy({
  id: 'admin-policy',
  name: '管理员策略',
  rules: [{
    permissions: ['*'],
    effect: 'allow',
    conditions: [{
      type: 'field',
      field: 'subject.attributes.role',
      operator: 'eq',
      value: 'admin'
    }]
  }],
  priority: 'high',
  enabled: true
});

mtpc.registerPolicy({
  id: 'user-policy',
  name: '用户策略',
  rules: [{
    permissions: ['user:read', 'article:read'],
    effect: 'allow'
  }],
  priority: 'medium',
  enabled: true
});
```

### 6.6 批量注册策略

```typescript
// 批量注册策略
mtpc.registerPolicies([
  {
    id: 'admin-full-access',
    name: '管理员完全访问',
    rules: [{
      permissions: ['*'],
      effect: 'allow',
      conditions: [{
        type: 'field',
        field: 'subject.attributes.role',
        operator: 'eq',
        value: 'admin'
      }]
    }],
    priority: 'critical',
    enabled: true
  },
  {
    id: 'user-read-only',
    name: '用户只读',
    rules: [{
      permissions: ['user:read', 'article:read'],
      effect: 'allow'
    }],
    priority: 'medium',
    enabled: true
  }
]);
```

---

## 7. 注册表系统

### 7.1 UnifiedRegistry（统一注册表）

UnifiedRegistry 是一站式管理所有注册表的接口，包含 ResourceRegistry、PermissionRegistry 和 PolicyRegistry。

```typescript
import { UnifiedRegistry } from '@mtpc/core';

const registry = new UnifiedRegistry();

// 注册资源
registry.registerResource({
  name: 'user',
  displayName: '用户',
  description: '用户资源管理',
  group: 'core',
  visible: true,
  permissions: [
    {
      code: 'user:read',
      displayName: '查看用户',
      description: '允许查看用户信息',
      defaultGrant: true
    },
    {
      code: 'user:create',
      displayName: '创建用户',
      description: '允许创建新用户',
      defaultGrant: false
    }
  ]
});

// 注册策略
registry.registerPolicy({
  id: 'admin-full-access',
  name: '管理员完全访问',
  description: '管理员拥有所有资源的完全访问权限',
  rules: [{
    permissions: ['*'],
    effect: 'allow',
    conditions: [{
      type: 'field',
      field: 'subject.attributes.role',
      operator: 'eq',
      value: 'admin'
    }]
  }],
  priority: 'critical',
  enabled: true
});

// 访问子注册表
const userResource = registry.resources.get('user');
const userReadPermission = registry.permissions.get('user:read');
const adminPolicy = registry.policies.get('admin-full-access');

// 导出元数据
const metadata = registry.exportMetadata();
console.log('Resources:', metadata.resources);
console.log('Permissions:', metadata.permissions);
console.log('Policies:', metadata.policies);

// 冻结所有注册表
registry.freeze();
```

### 7.2 ResourceRegistry（资源注册表）

```typescript
import { ResourceRegistry } from '@mtpc/core';

const resourceRegistry = new ResourceRegistry();

// 注册资源
resourceRegistry.register({
  name: 'user',
  displayName: '用户',
  description: '用户资源管理',
  group: 'core',
  visible: true,
  permissions: [
    {
      code: 'user:read',
      displayName: '查看用户',
      description: '允许查看用户信息',
      defaultGrant: true
    },
    {
      code: 'user:create',
      displayName: '创建用户',
      description: '允许创建新用户',
      defaultGrant: false
    }
  ]
});

// 查询资源
const userResource = resourceRegistry.get('user');
console.log(userResource.displayName);

const allResources = resourceRegistry.getAll();
console.log(allResources.length);

const coreResources = resourceRegistry.getByGroup('core');
console.log(coreResources);

const hasUser = resourceRegistry.has('user');
console.log(hasUser);

const names = resourceRegistry.getNames();
console.log(names);

// 冻结注册表
resourceRegistry.freeze();
```

### 7.3 PermissionRegistry（权限注册表）

```typescript
import { PermissionRegistry } from '@mtpc/core';

const permissionRegistry = new PermissionRegistry();

// 注册单个权限
permissionRegistry.register('user', {
  code: 'user:read',
  displayName: '查看用户',
  description: '允许查看用户信息',
  defaultGrant: true
});

// 批量注册权限
permissionRegistry.registerMany('user', [
  {
    code: 'user:read',
    displayName: '查看用户',
    description: '允许查看用户信息',
    defaultGrant: true
  },
  {
    code: 'user:create',
    displayName: '创建用户',
    description: '允许创建新用户',
    defaultGrant: false
  },
  {
    code: 'user:update',
    displayName: '更新用户',
    description: '允许更新用户信息',
    defaultGrant: false
  },
  {
    code: 'user:delete',
    displayName: '删除用户',
    description: '允许删除用户',
    defaultGrant: false
  }
]);

// 查询权限
const userReadPermission = permissionRegistry.get('user:read');
console.log(userReadPermission.displayName);

const allPermissions = permissionRegistry.getAll();
console.log(allPermissions.length);

const userPermissions = permissionRegistry.getByResource('user');
console.log(userPermissions);

const hasPermission = permissionRegistry.has('user:read');
console.log(hasPermission);

const codes = permissionRegistry.getCodes();
console.log(codes);
```

### 7.4 PolicyRegistry（策略注册表）

```typescript
import { PolicyRegistry } from '@mtpc/core';

const policyRegistry = new PolicyRegistry();

// 注册策略
policyRegistry.register({
  id: 'admin-full-access',
  name: '管理员完全访问',
  description: '管理员拥有所有资源的完全访问权限',
  rules: [{
    permissions: ['*'],
    effect: 'allow',
    conditions: [{
      type: 'field',
      field: 'subject.attributes.role',
      operator: 'eq',
      value: 'admin'
    }]
  }],
  priority: 'critical',
  enabled: true
});

// 查询策略
const adminPolicy = policyRegistry.get('admin-full-access');
console.log(adminPolicy.name);

const allPolicies = policyRegistry.getAll();
console.log(allPolicies.length);

const enabledPolicies = policyRegistry.getEnabledPolicies();
console.log(enabledPolicies);

const hasPolicy = policyRegistry.has('admin-full-access');
console.log(hasPolicy);
```

### 7.5 全局注册表

```typescript
import { getGlobalRegistry } from '@mtpc/core';

// 获取全局注册表实例
const globalRegistry = getGlobalRegistry();

// 使用全局注册表
globalRegistry.registerResource({
  name: 'product',
  displayName: '产品',
  description: '产品资源管理',
  group: 'business',
  visible: true,
  permissions: [
    {
      code: 'product:read',
      displayName: '查看产品',
      description: '允许查看产品信息',
      defaultGrant: true
    }
  ]
});

const productResource = globalRegistry.resources.get('product');
console.log(productResource.displayName);
```

---

## 8. 插件系统

### 8.1 插件定义

```typescript
import { PluginDefinition } from '@mtpc/core';

const auditPlugin: PluginDefinition = {
  name: 'audit-log',
  version: '1.0.0',

  // 注册阶段：注册资源、策略等
  register(ctx) {
    console.log('注册审计插件');
  },

  // 安装阶段：设置全局钩子等
  install(ctx) {
    ctx.registerGlobalHooks({
      afterAny: async (context, operation, resource, result) => {
        console.log(`[审计日志] ${context.subject.id} 执行 ${operation} 于 ${resource}，结果:`, result);
      },
      beforeAny: async (context, operation, resource) => {
        console.log(`[审计日志] ${context.subject.id} 即将执行 ${operation} 于 ${resource}`);
        return { proceed: true };
      },
      onError: async (context, operation, resource, error) => {
        console.error(`[审计日志] ${context.subject.id} 执行 ${operation} 于 ${resource} 时出错:`, error.message);
      }
    });
  },

  // 初始化阶段：执行初始化逻辑
  async init(ctx) {
    console.log('初始化审计插件');
  },

  // 销毁阶段：清理资源
  async destroy(ctx) {
    console.log('销毁审计插件');
  }
};
```

### 8.2 插件依赖

```typescript
const pluginA: PluginDefinition = {
  name: 'plugin-a',
  version: '1.0.0',
  register(ctx) {
    console.log('注册插件 A');
  }
};

const pluginB: PluginDefinition = {
  name: 'plugin-b',
  version: '1.0.0',
  dependencies: ['plugin-a'], // 依赖插件 A
  register(ctx) {
    console.log('注册插件 B（依赖插件 A）');
  }
};

// 注册插件（会自动处理依赖关系）
mtpc.use(pluginA);
mtpc.use(pluginB);
```

### 8.3 使用插件

```typescript
// 注册插件
mtpc.use(auditPlugin);

// 初始化 MTPC
await mtpc.init();

// 获取已安装的插件实例
const audit = mtpc.getPlugin('audit-log');
if (audit) {
  console.log('审计插件已安装:', audit.installed);
  console.log('插件状态:', audit.state);
}
```

### 8.4 插件状态管理

```typescript
// 获取所有已注册的插件
const allPlugins = mtpc.getPlugins();
console.log('所有插件:', allPlugins);

// 检查插件是否已安装
const isInstalled = mtpc.hasPlugin('audit-log');
console.log('审计插件已安装:', isInstalled);

// 获取插件实例
const plugin = mtpc.getPlugin('audit-log');
if (plugin) {
  console.log('插件名称:', plugin.definition.name);
  console.log('插件版本:', plugin.definition.version);
  console.log('是否已安装:', plugin.installed);
  console.log('插件状态:', plugin.state);
}
```

---

## 9. 钩子系统

### 9.1 全局钩子

```typescript
import { GlobalHooksManager, createGlobalHooksManager } from '@mtpc/core';

// 创建全局钩子管理器
const globalHooks = createGlobalHooksManager();

// 添加操作前钩子
globalHooks.addBeforeAny(async (context, operation, resourceName) => {
  console.log(`操作 ${operation} 即将在资源 ${resourceName} 上执行`);

  // 检查全局限制
  const isAllowed = await checkGlobalLimits(context);
  if (!isAllowed) {
    return { proceed: false, error: '超出全局限制' };
  }

  return { proceed: true };
});

// 添加操作后钩子
globalHooks.addAfterAny(async (context, operation, resourceName, result) => {
  console.log(`操作 ${operation} 在资源 ${resourceName} 上执行完成`);
  await auditLogger.log({
    userId: context.subject.id,
    operation,
    resource: resourceName,
    result,
    timestamp: new Date()
  });
});

// 添加错误钩子
globalHooks.addOnError(async (context, operation, resourceName, error) => {
  console.error(`操作 ${operation} 在资源 ${resourceName} 上执行失败:`, error.message);
  await alertService.send({
    level: 'error',
    message: `操作失败: ${operation}`,
    userId: context.subject.id,
    error: error.message
  });
});

// 执行钩子
await globalHooks.executeBeforeAny(context, 'create', 'user');
await globalHooks.executeAfterAny(context, 'create', 'user', result);
await globalHooks.executeOnError(context, 'create', 'user', error);

// 清除所有钩子
globalHooks.clear();

// 获取钩子集合
const hooks = globalHooks.getHooks();
```

### 9.2 资源钩子

```typescript
import { HookExecutor, createHookExecutor } from '@mtpc/core';

// 创建钩子执行器
const executor = createHookExecutor({
  beforeCreate: [validateEmail, setDefaultRole],
  afterCreate: [sendWelcomeEmail, logActivity],
  beforeUpdate: [validateUpdate],
  afterUpdate: [logUpdate]
});

// 执行创建前钩子
const result = await executor.executeBeforeCreate(context, userData);
if (result.proceed) {
  // 继续执行创建操作
  const created = await createUser(result.data);
  // 执行创建后钩子
  await executor.executeAfterCreate(context, userData, created);
}

// 执行更新前钩子
const updateResult = await executor.executeBeforeUpdate(context, userId, updateData);
if (updateResult.proceed) {
  const updated = await updateUser(userId, updateResult.data);
  await executor.executeAfterUpdate(context, userId, updateData, updated);
}
```

### 9.3 钩子执行顺序

```typescript
// 钩子按添加顺序执行
const executor = createHookExecutor({
  beforeCreate: [
    async (context, data) => {
      console.log('第一个钩子');
      return data;
    },
    async (context, data) => {
      console.log('第二个钩子');
      return data;
    },
    async (context, data) => {
      console.log('第三个钩子');
      return data;
    }
  ]
});

// 执行顺序：第一个 -> 第二个 -> 第三个
await executor.executeBeforeCreate(context, userData);
```

### 9.4 钩子返回值处理

```typescript
// before 钩子可以返回 { proceed: false } 阻止操作
const executor = createHookExecutor({
  beforeCreate: [
    async (context, data) => {
      if (data.email === 'blocked@example.com') {
        return { proceed: false, error: '该邮箱已被阻止' };
      }
      return { proceed: true, data };
    }
  ]
});

const result = await executor.executeBeforeCreate(context, userData);
if (!result.proceed) {
  console.log('操作被阻止:', result.error);
}
```

### 9.5 钩子数据修改

```typescript
// 钩子可以修改数据
const executor = createHookExecutor({
  beforeCreate: [
    async (context, data) => {
      // 添加默认值
      return {
        ...data,
        createdAt: new Date(),
        createdBy: context.subject.id
      };
    },
    async (context, data) => {
      // 验证并修改数据
      if (!data.name) {
        data.name = 'Anonymous';
      }
      return data;
    }
  ]
});
```

---

## 10. 多租户支持

### 10.1 租户上下文

```typescript
import {
  createTenantContext,
  validateTenantContext,
  isTenantActive,
  createSystemTenant,
  DEFAULT_TENANT,
  TenantContextHolder
} from '@mtpc/core';

// 创建租户上下文
const tenant = createTenantContext('tenant-001');
console.log(tenant);
// { id: 'tenant-001', status: 'active' }

// 创建带配置的租户
const tenantWithConfig = createTenantContext('tenant-002', {
  status: 'suspended',
  metadata: { plan: 'enterprise', region: 'us-east' }
});

// 验证租户上下文
try {
  validateTenantContext(tenant);
  console.log('租户验证通过');
} catch (error) {
  console.error('租户验证失败:', error.message);
}

// 检查租户是否活跃
if (isTenantActive(tenant)) {
  console.log('租户处于活跃状态');
}

// 创建系统租户
const systemTenant = createSystemTenant();
console.log(systemTenant);
// { id: 'system', status: 'active', metadata: { isSystem: true } }

// 使用默认租户
const defaultTenant = DEFAULT_TENANT;
console.log(defaultTenant);
// { id: 'default', status: 'active' }
```

### 10.2 租户上下文持有者

```typescript
// 设置租户上下文
TenantContextHolder.set(tenant);

// 获取租户上下文
const currentTenant = TenantContextHolder.get();
console.log(currentTenant?.id);

// 安全获取租户上下文（不存在时抛出异常）
const tenant = TenantContextHolder.getOrThrow();

// 清除租户上下文
TenantContextHolder.clear();

// 在租户上下文中执行函数（同步）
const result = TenantContextHolder.run(tenant, () => {
  console.log('在租户上下文中执行');
  return 'result';
});

// 在租户上下文中执行函数（异步）
const asyncResult = await TenantContextHolder.runAsync(tenant, async () => {
  console.log('在租户上下文中执行异步操作');
  return await fetchData();
});
```

### 10.3 租户管理器

```typescript
import {
  TenantManager,
  InMemoryTenantStore,
  createTenantManager
} from '@mtpc/core';

// 创建租户管理器
const manager = createTenantManager({ cacheTtl: 60000 });

// 或使用自定义存储
const customStore = new InMemoryTenantStore();
const manager = new TenantManager(customStore, { cacheTtl: 60000 });

// 创建租户
const tenant = await manager.createTenant({
  id: 'tenant-001',
  name: 'ACME Corp',
  status: 'active',
  metadata: {
    plan: 'enterprise',
    maxUsers: 1000
  }
});

// 获取租户
const retrieved = await manager.getTenant('tenant-001');
console.log(retrieved);

// 获取租户（不存在时抛出异常）
const tenantOrThrow = await manager.getTenantOrThrow('tenant-001');

// 创建租户上下文
const context = await manager.createContext('tenant-001');

// 验证并获取租户上下文
const validContext = await manager.validateAndGetContext('tenant-001');

// 获取所有租户
const allTenants = await manager.listTenants();

// 更新租户
const updated = await manager.updateTenant('tenant-001', {
  status: 'suspended'
});

// 删除租户
await manager.deleteTenant('tenant-001');

// 失效缓存
manager.invalidateCache('tenant-001');

// 清空所有缓存
manager.clearCache();
```

### 10.4 租户解析器

#### 10.4.1 请求头解析器

```typescript
import { createHeaderResolver } from '@mtpc/core';

// 使用默认请求头 'x-tenant-id'
const resolver = createHeaderResolver();
const tenant = await resolver({ headers: { 'x-tenant-id': 'tenant-001' } });

// 使用自定义请求头
const customResolver = createHeaderResolver('x-company-id');
const tenant = await customResolver({ headers: { 'x-company-id': 'company-abc' } });
```

#### 10.4.2 子域名解析器

```typescript
import { createSubdomainResolver } from '@mtpc/core';

const resolver = createSubdomainResolver('example.com');

// tenant1.example.com -> tenant1
const tenant = await resolver({ hostname: 'tenant1.example.com' });
console.log(tenant?.id); // 'tenant1'

// example.com -> null
const tenant2 = await resolver({ hostname: 'example.com' });
console.log(tenant2); // null
```

#### 10.4.3 路径解析器

```typescript
import { createPathResolver } from '@mtpc/core';

// 使用默认前缀 '/tenant/'
const resolver = createPathResolver();
const tenant = await resolver({ path: '/tenant/tenant-001/users' });
console.log(tenant?.id); // 'tenant-001'

// 使用自定义前缀
const customResolver = createPathResolver('/org/');
const tenant = await customResolver({ path: '/org/company-abc/dashboard' });
console.log(tenant?.id); // 'company-abc'
```

#### 10.4.4 查询参数解析器

```typescript
import { createQueryResolver } from '@mtpc/core';

// 使用默认参数名 'tenant'
const resolver = createQueryResolver();
const tenant = await resolver({ query: { tenant: 'tenant-001' } });
console.log(tenant?.id); // 'tenant-001'

// 使用自定义参数名
const customResolver = createQueryResolver('company');
const tenant = await customResolver({ query: { company: 'acme-corp' } });
```

#### 10.4.5 复合解析器

```typescript
import { createCompositeResolver } from '@mtpc/core';

// 组合多种解析方式
const resolver = createCompositeResolver(
  createSubdomainResolver('example.com'),
  createHeaderResolver(),
  createPathResolver('/tenant/'),
  createQueryResolver('tenant')
);

// 按顺序尝试解析，找到第一个有效的租户
const tenant = await resolver({
  hostname: 'api.example.com',
  headers: { 'x-tenant-id': 'tenant-001' },
  path: '/api/data',
  query: {}
});
console.log(tenant?.id); // 'tenant-001'
```

#### 10.4.6 带后备的解析器

```typescript
import { createResolverWithFallback, DEFAULT_TENANT } from '@mtpc/core';

const fallbackTenant = createTenantContext('default');

const resolver = createResolverWithFallback(
  createHeaderResolver(),
  fallbackTenant
);

// 主解析器失败时使用后备租户
const tenant = await resolver({ headers: {} });
console.log(tenant?.id); // 'default'
```

#### 10.4.7 带验证的解析器

```typescript
import { createValidatingResolver } from '@mtpc/core';

const resolver = createValidatingResolver(
  createHeaderResolver(),
  async (tenant) => {
    // 验证租户状态
    const dbTenant = await db.tenants.findUnique({ where: { id: tenant.id } });
    return dbTenant !== null && dbTenant.status === 'active';
  }
);

// 只有通过验证的租户才会被返回
const tenant = await resolver({ headers: { 'x-tenant-id': 'tenant-001' } });
```

### 10.5 HTTP 中间件集成

```typescript
// Express 中间件示例
import express from 'express';
import { createHeaderResolver, TenantContextHolder } from '@mtpc/core';

const app = express();

const tenantResolver = createHeaderResolver();

app.use(async (req, res, next) => {
  try {
    const tenant = await tenantResolver(req);
    if (tenant) {
      TenantContextHolder.set(tenant);
    }
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid tenant' });
  }
});

// 清理中间件
app.use((req, res, next) => {
  res.on('finish', () => {
    TenantContextHolder.clear();
  });
  next();
});
```

---

## 11. API 参考

### 11.1 MTPC 类

#### 11.1.1 构造函数

```typescript
createMTPC(options?: MTPCOptions): MTPC
```

**参数**:
- `options.defaultPermissionResolver`: 默认权限解析器函数
- `options.multiTenant`: 多租户配置选项

**返回值**: MTPC 实例

#### 11.1.2 资源管理

```typescript
// 注册单个资源
registerResource(resource: ResourceDefinition): void

// 批量注册资源
registerResources(...resources: ResourceDefinition[]): void

// 获取资源定义
getResource(name: string): ResourceDefinition | undefined
```

#### 11.1.3 策略管理

```typescript
// 注册单个策略
registerPolicy(policy: PolicyDefinition): void

// 批量注册策略
registerPolicies(...policies: PolicyDefinition[]): void

// 评估策略
evaluatePolicies(context: MTPCContext): Promise<EvaluationResult[]>
```

#### 11.1.4 插件管理

```typescript
// 使用插件
use(plugin: PluginDefinition): void

// 获取插件实例
getPlugin(name: string): PluginInstance | undefined

// 获取所有插件
getPlugins(): Map<string, PluginInstance>

// 检查插件是否存在
hasPlugin(name: string): boolean
```

#### 11.1.5 权限检查

```typescript
// 创建上下文
createContext(tenant: TenantContext, subject: SubjectContext): MTPCContext

// 检查权限
checkPermission(context: MTPCContext): Promise<PermissionCheckResult>

// 检查权限（无权限时抛出异常）
requirePermission(context: MTPCContext): Promise<void>
```

#### 11.1.6 初始化与状态

```typescript
// 初始化 MTPC
init(): Promise<void>

// 检查是否已初始化
isInitialized(): boolean

// 获取系统摘要
getSummary(): MTPCSummary

// 导出元数据
exportMetadata(): RegistryMetadata
```

#### 11.1.7 权限解析器

```typescript
// 设置权限解析器
setPermissionResolver(resolver: PermissionResolver): void

// 获取权限解析器
getPermissionResolver(): PermissionResolver
```

#### 11.1.8 租户管理

```typescript
// 获取租户管理器
get tenants(): TenantManager
```

### 11.2 Resource 相关

#### 11.2.1 defineResource

```typescript
defineResource<T>(definition: ResourceDefinition<T>): ResourceDefinition<T>
```

#### 11.2.2 ResourceBuilder

```typescript
class ResourceBuilder<T> {
  constructor(name: string)

  setSchema(schema: z.ZodType<T>): this
  setFeatures(features: ResourceFeatures): this
  setMetadata(metadata: ResourceMetadata): this
  addPermission(permission: CustomPermission): this
  addHook<K extends keyof ResourceHooks<T>>(name: K, hook: ResourceHooks<T>[K]): this
  setRelations(relations: ResourceRelations): this
  build(): ResourceDefinition<T>
}
```

### 11.3 Policy 相关

#### 11.3.1 PolicyBuilder

```typescript
class PolicyBuilder {
  constructor(id: string)

  setName(name: string): this
  setDescription(description: string): this
  setPriority(priority: PolicyPriority): this
  setEnabled(enabled: boolean): this
  addRule(rule: PolicyRule): this
  withCondition(condition: PolicyCondition): this
  build(): PolicyDefinition
}
```

### 11.4 Registry 相关

#### 11.4.1 UnifiedRegistry

```typescript
class UnifiedRegistry {
  resources: ResourceRegistry
  permissions: PermissionRegistry
  policies: PolicyRegistry

  registerResource(resource: ResourceDefinition): void
  registerPolicy(policy: PolicyDefinition): void
  exportMetadata(): RegistryMetadata
  freeze(): void
  isFrozen(): boolean
}
```

#### 11.4.2 ResourceRegistry

```typescript
class ResourceRegistry {
  register(resource: ResourceDefinition): void
  get(name: string): ResourceDefinition | undefined
  getAll(): ResourceDefinition[]
  getByGroup(group: string): ResourceDefinition[]
  has(name: string): boolean
  getNames(): string[]
  freeze(): void
  isFrozen(): boolean
}
```

#### 11.4.3 PermissionRegistry

```typescript
class PermissionRegistry {
  register(resourceName: string, permission: PermissionDefinition): void
  registerMany(resourceName: string, permissions: PermissionDefinition[]): void
  get(code: string): PermissionDefinition | undefined
  getAll(): PermissionDefinition[]
  getByResource(resourceName: string): PermissionDefinition[]
  has(code: string): boolean
  getCodes(): string[]
}
```

#### 11.4.4 PolicyRegistry

```typescript
class PolicyRegistry {
  register(policy: PolicyDefinition): void
  get(id: string): PolicyDefinition | undefined
  getAll(): PolicyDefinition[]
  getEnabledPolicies(): PolicyDefinition[]
  has(id: string): boolean
}
```

### 11.5 Tenant 相关

#### 11.5.1 租户上下文函数

```typescript
// 创建租户上下文
createTenantContext(id: string, options?: { status?: TenantStatus; metadata?: Record<string, unknown> }): TenantContext

// 验证租户上下文
validateTenantContext(tenant: TenantContext | null | undefined): asserts tenant is TenantContext

// 检查租户是否活跃
isTenantActive(tenant: TenantContext): boolean

// 创建系统租户
createSystemTenant(): TenantContext

// 默认租户
DEFAULT_TENANT: TenantContext
```

#### 11.5.2 TenantContextHolder

```typescript
class TenantContextHolder {
  static set(tenant: TenantContext): void
  static get(): TenantContext | null
  static getOrThrow(): TenantContext
  static clear(): void
  static run<T>(tenant: TenantContext, fn: () => T): T
  static runAsync<T>(tenant: TenantContext, fn: () => Promise<T>): Promise<T>
}
```

#### 11.5.3 TenantManager

```typescript
class TenantManager {
  constructor(store: TenantStore, options?: { cacheTtl?: number })

  getTenant(id: string): Promise<TenantInfo | null>
  getTenantOrThrow(id: string): Promise<TenantInfo>
  createContext(id: string): Promise<TenantContext>
  validateAndGetContext(id: string): Promise<TenantContext>
  listTenants(): Promise<TenantInfo[]>
  createTenant(info: Omit<TenantInfo, 'createdAt' | 'updatedAt'>): Promise<TenantInfo>
  updateTenant(id: string, info: Partial<TenantInfo>): Promise<TenantInfo>
  deleteTenant(id: string): Promise<void>
  invalidateCache(id: string): void
  clearCache(): void
}
```

#### 11.5.4 租户解析器

```typescript
// 请求头解析器
createHeaderResolver(headerName?: string): TenantResolver<{ headers: Record<string, string | undefined> }>

// 子域名解析器
createSubdomainResolver(baseDomain: string): TenantResolver<{ hostname: string }>

// 路径解析器
createPathResolver(prefix?: string): TenantResolver<{ path: string }>

// 查询参数解析器
createQueryResolver(paramName?: string): TenantResolver<{ query: Record<string, string | undefined> }>

// 复合解析器
createCompositeResolver<T>(...resolvers: TenantResolver<T>[]): TenantResolver<T>

// 带后备的解析器
createResolverWithFallback<T>(resolver: TenantResolver<T>, fallback: TenantContext): TenantResolver<T>

// 带验证的解析器
createValidatingResolver<T>(resolver: TenantResolver<T>, validator: (tenant: TenantContext) => Promise<boolean> | boolean): TenantResolver<T>
```

### 11.6 Hooks 相关

#### 11.6.1 GlobalHooksManager

```typescript
class GlobalHooksManager {
  addBeforeAny(hook: BeforeAnyHook): void
  addAfterAny(hook: AfterAnyHook): void
  addOnError(hook: OnErrorHook): void
  executeBeforeAny(context: MTPCContext, operation: string, resourceName: string): Promise<HookResult>
  executeAfterAny(context: MTPCContext, operation: string, resourceName: string, result: unknown): Promise<void>
  executeOnError(context: MTPCContext, operation: string, resourceName: string, error: Error): Promise<void>
  clear(): void
  getHooks(): GlobalHooks
}

// 工厂函数
createGlobalHooksManager(): GlobalHooksManager
```

#### 11.6.2 HookExecutor

```typescript
class HookExecutor<T> {
  constructor(hooks: ResourceHooks<T>)

  executeBeforeCreate(context: MTPCContext, data: T): Promise<HookResult<T>>
  executeAfterCreate(context: MTPCContext, data: T, created: T): Promise<void>
  executeBeforeRead(context: MTPCContext, id: string): Promise<HookResult<string>>
  executeAfterRead(context: MTPCContext, id: string, data: T | null): Promise<T | null>
  executeBeforeUpdate(context: MTPCContext, id: string, data: Partial<T>): Promise<HookResult<Partial<T>>>
  executeAfterUpdate(context: MTPCContext, id: string, data: Partial<T>, updated: T): Promise<void>
  executeBeforeDelete(context: MTPCContext, id: string): Promise<HookResult<string>>
  executeAfterDelete(context: MTPCContext, id: string, deleted: T): Promise<void>
  executeBeforeList(context: MTPCContext, options: QueryOptions): Promise<HookResult<QueryOptions>>
  executeAfterList(context: MTPCContext, options: QueryOptions, results: T[]): Promise<T[]>
  executeFilterQuery(context: MTPCContext, baseFilters: FilterCondition[]): Promise<HookResult<FilterCondition[]>>
}

// 工厂函数
createHookExecutor<T>(hooks: ResourceHooks<T>): HookExecutor<T>
```

---

## 12. 常见问题

### Q1: 如何扩展自定义条件类型？

A: 使用 `policyEngine.addConditionHandler` 方法添加自定义条件处理器：

```typescript
mtpc.policyEngine.addConditionHandler('custom', async (condition, context) => {
  const { field, operator, value } = condition;
  const fieldValue = getFieldValue(context, field);
  return customCompare(fieldValue, operator, value);
});
```

### Q2: 如何实现基于属性的访问控制（ABAC）？

A: 利用策略条件系统，通过 `field` 类型条件检查主体、资源或环境属性：

```typescript
mtpc.registerPolicy({
  id: 'abac-policy',
  name: 'ABAC 策略',
  rules: [{
    permissions: ['document:read'],
    effect: 'allow',
    conditions: [{
      type: 'field',
      field: 'subject.attributes.department',
      operator: 'eq',
      value: 'finance'
    }]
  }]
});
```

### Q3: 如何处理权限变更时的缓存失效？

A: 实现权限变更事件监听，当权限发生变化时，主动清除相关缓存：

```typescript
async function onPermissionsChanged(tenantId: string, subjectId: string) {
  // 清除权限检查器缓存
  mtpc.permissionChecker.clearSubjectCache(tenantId, subjectId);

  // 如果使用外部缓存，也需要清除
  await redisClient.del(`permissions:${tenantId}:${subjectId}`);
}
```

### Q4: 如何与现有权限系统集成？

A: 实现自定义 `defaultPermissionResolver`，从现有系统获取权限数据：

```typescript
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId: string, subjectId: string) => {
    // 从现有权限系统获取权限
    const permissions = await existingPermissionSystem.getPermissions(tenantId, subjectId);
    return new Set(permissions);
  }
});
```

### Q5: 如何进行权限审计？

A: 使用钩子系统，在权限检查前后记录审计日志：

```typescript
mtpc.globalHooks.addAfterAny(async (context, operation, resource, result) => {
  await auditLogger.log({
    userId: context.subject.id,
    tenantId: context.tenant.id,
    operation,
    resource,
    result,
    timestamp: new Date()
  });
});
```

### Q6: 如何实现租户级别的策略？

A: 在策略定义中指定 `tenantId`：

```typescript
mtpc.registerPolicy({
  id: 'tenant-1-admin',
  name: '租户1管理员',
  tenantId: 'tenant-1', // 租户级别的策略
  rules: [{
    permissions: ['*'],
    effect: 'allow'
  }],
  priority: 'high',
  enabled: true
});
```

### Q7: 如何实现资源级别的权限？

A: 在资源定义中添加自定义权限：

```typescript
const documentResource = defineResource({
  name: 'document',
  features: {
    create: true,
    read: true,
    update: true,
    delete: true
  },
  permissions: [
    {
      action: 'share',
      description: '分享文档'
    },
    {
      action: 'download',
      description: '下载文档'
    }
  ]
});
```

### Q8: 如何实现动态权限？

A: 使用策略条件系统，根据运行时条件动态授予权限：

```typescript
mtpc.registerPolicy({
  id: 'dynamic-policy',
  name: '动态权限策略',
  rules: [{
    permissions: ['resource:action'],
    effect: 'allow',
    conditions: [{
      type: 'field',
      field: 'subject.attributes.level',
      operator: 'gte',
      value: 5
    }]
  }]
});
```

### Q9: 如何实现权限继承？

A: 通过策略条件和权限解析器实现：

```typescript
// 在权限解析器中实现权限继承
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    // 获取用户权限
    const userPermissions = await getUserPermissions(tenantId, subjectId);

    // 获取用户角色
    const roles = await getUserRoles(tenantId, subjectId);

    // 获取角色权限
    const rolePermissions = await getRolePermissions(tenantId, roles);

    // 合并权限
    return new Set([...userPermissions, ...rolePermissions]);
  }
});
```

### Q10: 如何实现权限委托？

A: 使用策略条件系统，检查委托关系：

```typescript
mtpc.registerPolicy({
  id: 'delegation-policy',
  name: '权限委托策略',
  rules: [{
    permissions: ['user:manage'],
    effect: 'allow',
    conditions: [{
      type: 'field',
      field: 'subject.attributes.delegatedBy',
      operator: 'eq',
      value: 'manager-id'
    }]
  }]
});
```

---

## 13. 最佳实践

### 13.1 设计原则

1. **遵循业务无关原则**：保持权限逻辑与业务逻辑分离
2. **采用 Schema 驱动**：使用 Schema 定义作为单一事实源
3. **优先使用编译期配置**：减少运行时计算
4. **遵循默认拒绝原则**：确保安全
5. **实现最小权限原则**：只授予必要的权限

### 13.2 代码组织

1. **集中管理资源定义**：将所有资源定义放在单独的文件中
2. **按功能模块组织策略**：将策略按功能模块分组
3. **使用插件扩展功能**：保持核心代码简洁
4. **为权限检查添加详细日志**：便于调试和审计

### 13.3 性能优化

1. **合理使用权限缓存**：配置合适的缓存大小和 TTL
2. **批量处理权限检查**：使用 `Promise.all` 并行执行
3. **优化策略评估逻辑**：减少复杂条件和策略数量
4. **监控性能指标**：定期检查权限检查性能

### 13.4 安全实践

1. **始终验证租户上下文**：确保租户有效性
2. **避免硬编码权限**：使用策略系统管理权限
3. **定期审查权限配置**：清理不必要的权限
4. **实现权限审计**：记录所有权限检查

### 13.5 可维护性

1. **为资源和权限添加清晰的描述**：便于理解和管理
2. **使用一致的命名规范**：提高代码可读性
3. **编写单元测试和集成测试**：确保功能正确性
4. **保持文档更新**：及时更新使用文档

### 13.6 错误处理

```typescript
import {
  PermissionDeniedError,
  InvalidTenantError,
  MissingTenantContextError,
  ResourceNotFoundError,
  PolicyNotFoundError
} from '@mtpc/shared/errors';

try {
  await mtpc.requirePermission(context);
} catch (error) {
  if (error instanceof PermissionDeniedError) {
    // 权限不足
    console.error('权限拒绝:', error.message);
  } else if (error instanceof MissingTenantContextError) {
    // 缺少租户上下文
    console.error('缺少租户上下文');
  } else if (error instanceof InvalidTenantError) {
    // 无效的租户ID
    console.error('无效的租户ID');
  } else if (error instanceof ResourceNotFoundError) {
    // 资源未找到
    console.error('资源未找到');
  } else if (error instanceof PolicyNotFoundError) {
    // 策略未找到
    console.error('策略未找到');
  } else {
    // 其他错误
    console.error('未知错误:', error);
  }
}
```

### 13.7 性能监控

```typescript
// 监控权限检查性能
const originalCheckPermission = mtpc.checkPermission.bind(mtpc);

mtpc.checkPermission = async (context) => {
  const startTime = performance.now();
  const result = await originalCheckPermission(context);
  const endTime = performance.now();
  const duration = endTime - startTime;

  // 记录性能指标
  console.log('权限检查性能:', {
    permission: `${context.resource}:${context.action}`,
    duration: `${duration.toFixed(2)}ms`,
    allowed: result.allowed
  });

  // 如果性能超过阈值，记录详细信息
  if (duration > 100) {
    console.warn('权限检查性能警告:', {
      ...context,
      duration: `${duration.toFixed(2)}ms`
    });
  }

  return result;
};
```

---

## 附录

### A. 类型定义

#### A.1 MTPCOptions

```typescript
interface MTPCOptions {
  defaultPermissionResolver?: PermissionResolver;
  multiTenant?: MultiTenantOptions;
}
```

#### A.2 PermissionResolver

```typescript
type PermissionResolver = (tenantId: string, subjectId: string) => Promise<Set<string>>;
```

#### A.3 MTPCContext

```typescript
interface MTPCContext {
  tenant: TenantContext;
  subject: SubjectContext;
  resource: string;
  action: string;
}
```

#### A.4 TenantContext

```typescript
interface TenantContext {
  id: string;
  status?: TenantStatus;
  metadata?: Record<string, unknown>;
}
```

#### A.5 SubjectContext

```typescript
interface SubjectContext {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  permissions?: Set<string>;
}
```

#### A.6 PermissionCheckResult

```typescript
interface PermissionCheckResult {
  allowed: boolean;
  permission: string;
  reason: string;
  evaluationTime: number;
}
```

### B. 性能指标

| 指标 | 目标值 | 优化建议 |
| --- | --- | --- |
| 权限检查延迟 | < 50ms | 优化权限解析器，使用缓存 |
| 批量权限检查吞吐量 | > 1000 QPS | 使用并行执行，调整并发数 |
| 策略评估延迟 | < 10ms | 优化策略条件，减少复杂规则 |
| 缓存命中率 | > 90% | 优化缓存策略，调整过期时间 |

### C. 版本历史

#### 1.0.0
- 初始版本发布
- 核心功能实现：资源定义、策略引擎、权限检查器
- 支持多租户上下文
- 插件系统和钩子系统
- 基本性能优化

#### 1.1.0
- 新增批量权限检查功能
- 优化策略评估算法
- 增强错误处理机制
- 添加性能监控支持

#### 1.2.0
- 新增自定义条件类型支持
- 增强租户管理功能
- 优化权限缓存机制
- 添加更多示例和文档

---

**文档版本**: 1.0.0
**最后更新**: 2024-12-27
**维护者**: MTPC Team
