# @mtpc/helper 使用指南

## 目录

1. [概述](#1-概述)
2. [快速开始](#2-快速开始)
3. [核心功能模块详解](#3-核心功能模块详解)
   - [3.1 ABAC 模块](#31-abac-模块)
   - [3.2 ACL 模块](#32-acl-模块)
   - [3.3 ENV 模块](#33-env-模块)
   - [3.4 Policy Helper 模块](#34-policy-helper-模块)
   - [3.5 Resource Helper 模块](#35-resource-helper-模块)
   - [3.6 Time 模块](#36-time-模块)
4. [API 接口参考](#4-api-接口参考)
5. [使用示例](#5-使用示例)
6. [最佳实践](#6-最佳实践)
7. [常见问题](#7-常见问题)
8. [性能优化建议](#8-性能优化建议)

---

## 1. 概述

### 1.1 什么是 @mtpc/helper

`@mtpc/helper` 是 MTPC (Multi-Tenant Permission Core) 生态系统的轻量级工具包，为权限系统开发提供便捷的 API 和常用权限模式。该包作为核心包的补充，通过提供预构建的权限模式、策略创建助手和资源定义快捷方式，显著简化了权限系统的开发复杂度。

### 1.2 核心特性

- **轻量级**: 不包含复杂的企业级功能，专注于提供常用模式
- **基于核心**: 依赖 `@mtpc/core` 的功能，无法独立运行
- **预设模式**: 主要提供常见模式，特殊需求需要自定义扩展
- **类型安全**: 完整的 TypeScript 类型支持
- **易于使用**: 提供简洁的 API，降低学习曲线

### 1.3 适用场景

1. **快速原型开发**: 使用预构建的模式快速搭建权限系统
2. **标准 CRUD 权限**: 适合大多数业务系统的基本权限需求
3. **基于属性的权限**: 需要根据资源属性进行精细化权限控制
4. **环境安全控制**: 需要根据 IP、User-Agent 等环境因素控制访问
5. **时间限制访问**: 需要在特定时间窗口内限制操作权限
6. **传统 ACL 迁移**: 需要将现有 ACL 系统迁移到 MTPC

### 1.4 限制条件

1. **轻量级定位**: 不包含复杂的企业级功能，如审计、监控等
2. **基于核心**: 依赖 MTPC Core 的功能，无法独立运行
3. **预设模式**: 主要提供常见模式，特殊需求需要自定义扩展
4. **性能考虑**: 自定义条件函数在高频调用时可能影响性能

---

## 2. 快速开始

### 2.1 安装依赖

```bash
# 使用 pnpm 安装
pnpm add @mtpc/helper

# 使用 npm 安装
npm install @mtpc/helper

# 使用 yarn 安装
yarn add @mtpc/helper
```

### 2.2 环境要求

- Node.js >= 18.0.0
- TypeScript >= 5.0.0 (推荐使用)
- 已安装并配置 `@mtpc/core`

### 2.3 基础使用示例

```typescript
import { createMTPC } from '@mtpc/core';
import { abac, policy, resource, time, env } from '@mtpc/helper';
import { z } from 'zod';

// 创建 MTPC 实例
const mtpc = createMTPC();

// 定义用户资源
const userResource = resource.crud({
  name: 'user',
  schema: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(['admin', 'user', 'guest']),
    departmentId: z.string()
  }),
  enable: {
    create: true,
    read: true,
    update: true,
    delete: true,
    list: true
  },
  metadata: {
    displayName: '用户',
    group: 'core'
  }
});

// 注册资源
mtpc.registerResource(userResource);

// 创建 ABAC 策略：用户只能编辑自己的文章
const ownArticlePolicy = abac.policy('user-own-article', {
  permissions: ['article:update', 'article:delete'],
  conditions: [
    abac.ownResource('authorId')
  ],
  description: '用户只能编辑自己的文章'
});

mtpc.registerPolicy(ownArticlePolicy);

// 创建基于角色的策略
const managerPolicy = policy.allowForRoles(
  'manager-permissions',
  ['user:read', 'user:update', 'order:*'],
  ['manager'],
  {
    description: '经理角色权限'
  }
);

mtpc.registerPolicy(managerPolicy);

// 初始化 MTPC
await mtpc.init();
```

---

## 3. 核心功能模块详解

## 3.1 ABAC 模块

### 3.1.1 模块概述

ABAC (Attribute-Based Access Control) 模块提供基于属性的访问控制功能，支持丰富的条件检查。

### 3.1.2 核心功能

#### 属性比较条件

**`attrEquals(resourceField, contextPath)`**

比较资源字段与上下文路径的值是否相等。

**参数**:
- `resourceField: string` - 资源字段路径
- `contextPath: string` - 上下文路径

**返回值**:
- `PolicyCondition` - 策略条件对象

**示例**:
```typescript
import { abac } from '@mtpc/helper';

// 检查资源的 departmentId 是否等于主体的 departmentId
const condition = abac.attrEquals('departmentId', 'subject.metadata.departmentId');

// 在策略中使用
const policy = abac.policy('same-department', {
  permissions: ['document:read'],
  conditions: [condition],
  description: '同部门可访问'
});
```

#### 属性包含条件

**`attrIn(resourceField, contextPath)`**

检查资源字段的值是否在上下文路径的数组中。

**参数**:
- `resourceField: string` - 资源字段路径
- `contextPath: string` - 上下文路径

**返回值**:
- `PolicyCondition` - 策略条件对象

**示例**:
```typescript
// 检查资源的 status 是否在主体的 allowedStatuses 中
const condition = abac.attrIn('status', 'subject.metadata.allowedStatuses');

const policy = abac.policy('status-allowed', {
  permissions: ['order:update'],
  conditions: [condition],
  description: '只允许处理特定状态的订单'
});
```

#### 资源所有权条件

**`ownResource(ownerField)`**

检查资源的所有者字段是否等于当前主体 ID。

**参数**:
- `ownerField: string = 'createdBy'` - 资源所有者字段路径，默认为 'createdBy'

**返回值**:
- `PolicyCondition` - 策略条件对象

**示例**:
```typescript
// 使用默认字段 'createdBy'
const condition1 = abac.ownResource();

// 使用自定义字段 'authorId'
const condition2 = abac.ownResource('authorId');

const policy = abac.policy('user-own-content', {
  permissions: ['article:update', 'article:delete', 'comment:delete'],
  conditions: [condition2],
  description: '用户只能管理自己创建的内容'
});
```

#### 组织架构条件

**`sameDepartment(resourceField, contextPath)`**

检查资源的部门字段是否等于主体的部门。

**参数**:
- `resourceField: string = 'departmentId'` - 资源部门字段路径
- `contextPath: string = 'subject.metadata.departmentId'` - 上下文部门路径

**返回值**:
- `PolicyCondition` - 策略条件对象

**示例**:
```typescript
// 使用默认字段
const condition1 = abac.sameDepartment();

// 使用自定义字段
const condition2 = abac.sameDepartment('deptId', 'subject.attributes.deptId');

const policy = abac.policy('department-access', {
  permissions: ['document:read', 'document:update'],
  conditions: [condition1],
  description: '同部门可访问文档'
});
```

**`sameTeam(resourceField, contextPath)`**

检查资源的团队字段是否等于主体的团队。

**参数**:
- `resourceField: string = 'teamId'` - 资源团队字段路径
- `contextPath: string = 'subject.metadata.teamId'` - 上下文团队路径

**返回值**:
- `PolicyCondition` - 策略条件对象

**示例**:
```typescript
// 使用默认字段
const condition1 = abac.sameTeam();

// 使用自定义字段
const condition2 = abac.sameTeam('groupId', 'subject.attributes.groupId');

const policy = abac.policy('team-access', {
  permissions: ['project:view', 'project:edit'],
  conditions: [condition1],
  description: '同团队可访问项目'
});
```

#### ABAC 策略创建

**`policy(id, config)`**

创建 ABAC 策略定义。

**参数**:
- `id: string` - 策略 ID
- `config: ABACPolicyConfig` - ABAC 策略配置
  - `name?: string` - 策略名称
  - `description?: string` - 策略描述
  - `tenantId?: string` - 租户 ID
  - `permissions: string[]` - 策略权限
  - `conditions: PolicyCondition[]` - 策略条件
  - `priority?: PolicyPriority` - 策略优先级
  - `enabled?: boolean` - 是否启用
  - `metadata?: Record<string, unknown>` - 策略元数据

**返回值**:
- `PolicyDefinition` - 策略定义对象

**默认值**:
- `name: id`
- `priority: 'normal'`
- `enabled: true`

**示例**:
```typescript
const policy = abac.policy('user-own-article', {
  name: '用户拥有文章',
  description: '用户只能编辑和删除自己的文章',
  permissions: ['article:update', 'article:delete'],
  conditions: [
    abac.ownResource('authorId')
  ],
  priority: 'high',
  enabled: true,
  metadata: {
    category: 'ownership'
  }
});

mtpc.registerPolicy(policy);
```

### 3.1.3 组合条件使用

可以组合多个条件创建复杂的权限规则：

```typescript
const complexPolicy = abac.policy('complex-condition', {
  permissions: ['sensitive:access'],
  conditions: [
    abac.ownResource('createdBy'),
    abac.sameDepartment('departmentId', 'subject.metadata.departmentId')
  ],
  description: '同部门且是创建者可访问'
});
```

---

## 3.2 ACL 模块

### 3.2.1 模块概述

ACL (Access Control List) 模块提供访问控制列表转换器，将传统 ACL 配置转换为 MTPC 策略。

### 3.2.2 核心类型

#### PrincipalRef

主体引用，用于指定允许或拒绝的主体。

```typescript
export interface PrincipalRef {
  subjectId?: string;  // 主体 ID
  role?: string;        // 角色
}
```

#### ACLEntry

ACL 条目，定义资源操作的访问控制规则。

```typescript
export interface ACLEntry {
  resource: string;              // 资源路径
  action: string;                // 操作
  allow?: PrincipalRef[];        // 允许的主体引用
  deny?: PrincipalRef[];         // 拒绝的主体引用
}
```

#### ACLConfig

ACL 配置，包含多个 ACL 条目。

```typescript
export interface ACLConfig {
  id: string;                    // 策略 ID
  tenantId?: string;             // 租户 ID
  entries: ACLEntry[];          // ACL 条目
  description?: string;          // 策略描述
  priority?: PolicyPriority;      // 策略优先级
}
```

### 3.2.3 核心功能

#### ACL 转换

**`toPolicies(config)`**

将 ACL 配置转换为策略定义数组。

**参数**:
- `config: ACLConfig` - ACL 配置对象

**返回值**:
- `PolicyDefinition[]` - 策略定义数组

**转换规则**:
- 对每个 ACLEntry 生成一个 PolicyDefinition
- deny 规则的优先级设置为 'high'
- allow 规则的优先级设置为 'normal'
- 策略 ID 格式为 `{config.id}::{resource}::{action}`
- 跳过没有规则的条目

**示例**:
```typescript
import { acl } from '@mtpc/helper';

const aclConfig = {
  id: 'document-access',
  tenantId: 'tenant-1',
  entries: [
    {
      resource: 'document',
      action: 'read',
      allow: [
        { role: 'manager' },
        { role: 'editor' },
        { subjectId: 'user-123' }
      ],
      deny: [
        { subjectId: 'user-bad' }
      ]
    },
    {
      resource: 'document',
      action: 'write',
      allow: [
        { role: 'manager' },
        { subjectId: 'user-123' }
      ]
    }
  ],
  description: '文档访问控制列表',
  priority: 'high'
};

// 转换为 MTPC 策略
const policies = acl.toPolicies(aclConfig);

// 批量注册策略
policies.forEach(policy => mtpc.registerPolicy(policy));
```

### 3.2.4 拒绝优先策略

ACL 模块遵循"拒绝优先"原则：

1. deny 规则优先级设置为 'high'
2. allow 规则优先级设置为 'normal'
3. 策略评估时，高优先级规则先执行

这意味着如果用户同时匹配 deny 和 allow 规则，deny 规则会先执行，结果为拒绝。

**示例**:
```typescript
const aclConfig = {
  id: 'document-access',
  entries: [
    {
      resource: 'document',
      action: 'read',
      allow: [{ role: 'editor' }],
      deny: [{ subjectId: 'user-123' }]
    }
  ]
};

// user-123 虽然是 editor 角色，但会被 deny 规则拒绝
const policies = acl.toPolicies(aclConfig);
```

---

## 3.3 ENV 模块

### 3.3.1 模块概述

ENV 模块提供环境相关条件检查，支持 IP 地址和 User-Agent 验证。

### 3.3.2 核心功能

#### IP 白名单

**`ipIn(whitelist)`**

限制请求 IP 在白名单内。

**参数**:
- `whitelist: string[]` - IP 白名单数组

**返回值**:
- `PolicyCondition` - 策略条件对象

**IP 匹配规则**:
- 精确匹配: `192.168.1.100`
- 前缀匹配: `192.168.1.*`
- 通配符匹配: `192.168.*.*`

**示例**:
```typescript
import { env, policy } from '@mtpc/helper';

// 内部网络白名单
const internalPolicy = policy.allow('internal-network', ['admin:access'], {
  conditions: [
    env.ipIn(['192.168.1.*', '10.0.0.*'])
  ],
  description: '仅允许内部网络访问管理功能'
});

mtpc.registerPolicy(internalPolicy);
```

#### IP 黑名单

**`ipNotIn(blacklist)`**

限制请求 IP 不在黑名单内。

**参数**:
- `blacklist: string[]` - IP 黑名单数组

**返回值**:
- `PolicyCondition` - 策略条件对象

**示例**:
```typescript
// IP 黑名单
const blockedIPPolicy = policy.allow('blocked-ip', ['*'], {
  conditions: [
    env.ipNotIn(['192.168.1.100', '10.0.0.50'])
  ],
  description: '阻止特定 IP 访问'
});

mtpc.registerPolicy(blockedIPPolicy);
```

#### User-Agent 包含检查

**`userAgentContains(substring)`**

检查 User-Agent 是否包含指定子串。

**参数**:
- `substring: string` - User-Agent 子串

**返回值**:
- `PolicyCondition` - 策略条件对象

**示例**:
```typescript
// 仅允许移动设备
const mobilePolicy = policy.allow('mobile-only', ['mobile:feature'], {
  conditions: [
    env.userAgentContains('Mobile')
  ],
  description: '仅允许移动设备访问'
});

mtpc.registerPolicy(mobilePolicy);
```

#### User-Agent 正则匹配

**`userAgentMatches(pattern)`**

检查 User-Agent 是否匹配正则表达式。

**参数**:
- `pattern: RegExp` - 正则表达式模式

**返回值**:
- `PolicyCondition` - 策略条件对象

**示例**:
```typescript
// 仅允许 Chrome 浏览器
const chromePolicy = policy.allow('chrome-only', ['chrome:feature'], {
  conditions: [
    env.userAgentMatches(/Chrome\/\d+/)
  ],
  description: '仅允许 Chrome 浏览器访问'
});

mtpc.registerPolicy(chromePolicy);
```

### 3.3.3 组合环境条件

可以组合多个环境条件创建复杂的访问控制：

```typescript
const complexEnvPolicy = policy.allow('complex-env', ['sensitive:access'], {
  conditions: [
    env.ipIn(['192.168.1.*']),
    env.userAgentContains('Chrome'),
    env.userAgentMatches(/Chrome\/\d+\.\d+/)
  ],
  description: '内部网络且使用 Chrome 浏览器'
});
```

---

## 3.4 Policy Helper 模块

### 3.4.1 模块概述

Policy Helper 模块提供策略创建助手，提供快速创建常用策略的方法。

### 3.4.2 核心功能

#### 创建允许策略

**`allow(id, permissions, options)`**

创建允许策略。

**参数**:
- `id: string` - 策略 ID
- `permissions: string[]` - 允许的权限列表
- `options: object` - 可选配置
  - `tenantId?: string` - 租户 ID
  - `priority?: PolicyPriority` - 策略优先级
  - `description?: string` - 策略描述
  - `metadata?: Record<string, unknown>` - 策略元数据

**返回值**:
- `PolicyDefinition` - 策略定义对象

**默认值**:
- `priority: 'normal'`
- `enabled: true`
- `name: id`

**示例**:
```typescript
import { policy } from '@mtpc/helper';

// 创建允许策略
const allowPolicy = policy.allow('admin-all-access', ['*'], {
  tenantId: 'tenant-1',
  description: '管理员拥有所有权限',
  priority: 'critical'
});

mtpc.registerPolicy(allowPolicy);
```

#### 创建拒绝策略

**`deny(id, permissions, options)`**

创建拒绝策略。

**参数**:
- `id: string` - 策略 ID
- `permissions: string[]` - 拒绝的权限列表
- `options: object` - 可选配置
  - `tenantId?: string` - 租户 ID
  - `priority?: PolicyPriority` - 策略优先级
  - `description?: string` - 策略描述
  - `metadata?: Record<string, unknown>` - 策略元数据

**返回值**:
- `PolicyDefinition` - 策略定义对象

**默认值**:
- `priority: 'high'` (拒绝策略默认高优先级)
- `enabled: true`
- `name: id`

**示例**:
```typescript
// 创建拒绝策略
const denyPolicy = policy.deny('user-no-delete', ['user:delete'], {
  tenantId: 'tenant-1',
  description: '普通用户不能删除用户',
  priority: 'high'
});

mtpc.registerPolicy(denyPolicy);
```

#### 基于角色的允许策略

**`allowForRoles(id, permissions, roles, options)`**

创建基于角色的允许策略。

**参数**:
- `id: string` - 策略 ID
- `permissions: string[]` - 允许的权限列表
- `roles: string[]` - 允许的角色列表
- `options: object` - 可选配置
  - `tenantId?: string` - 租户 ID
  - `priority?: PolicyPriority` - 策略优先级
  - `description?: string` - 策略描述
  - `metadata?: Record<string, unknown>` - 策略元数据

**返回值**:
- `PolicyDefinition` - 策略定义对象

**默认值**:
- `priority: 'normal'`
- `enabled: true`
- `name: id`
- `description: 'Allowed roles: {roles.join(', ')}'`
- `metadata.roles: roles`

**示例**:
```typescript
// 基于角色的权限
const rolePolicy = policy.allowForRoles('manager-permissions', [
  'user:read', 'user:update', 'order:*'
], ['manager'], {
  description: '经理角色权限',
  metadata: { level: 'management' }
});

mtpc.registerPolicy(rolePolicy);
```

### 3.4.3 策略优先级

策略优先级顺序：`critical > high > medium > low`

**示例**:
```typescript
// 超级管理员策略（最高优先级）
const superAdminPolicy = policy.allow('super-admin', ['*'], {
  priority: 'critical'
});

// 管理员策略（高优先级）
const adminPolicy = policy.allow('admin', ['*'], {
  priority: 'high'
});

// 普通用户策略（正常优先级）
const userPolicy = policy.allow('user', ['user:read'], {
  priority: 'normal'
});
```

---

## 3.5 Resource Helper 模块

### 3.5.1 模块概述

Resource Helper 模块提供资源定义助手，简化标准 CRUD 资源的创建。

### 3.5.2 核心功能

#### CRUD 资源选项

**`CrudResourceOptions`**

```typescript
export interface CrudResourceOptions {
  name: string;                    // 资源名称
  schema: AnyZodSchema;            // 资源 Schema
  enable?: {                        // 启用配置
    create?: boolean;               // 是否启用创建
    read?: boolean;                 // 是否启用读取
    update?: boolean;               // 是否启用更新
    delete?: boolean;               // 是否启用删除
    list?: boolean;                 // 是否启用列表
  };
  withCrudPermissions?: boolean;     // 是否自动生成 CRUD 权限
  metadata?: {                      // 资源元数据
    displayName?: string;            // 显示名称
    pluralName?: string;             // 复数名称
    description?: string;            // 描述
    group?: string;                 // 分组
    icon?: string;                  // 图标
  };
}
```

#### CRUD 资源创建

**`crud(options)`**

快速创建标准 CRUD 资源定义。

**参数**:
- `options: CrudResourceOptions` - CRUD 资源配置

**返回值**:
- `ResourceDefinition` - 资源定义对象

**默认值**:
- 所有 `enable` 操作默认为 `true`
- `withCrudPermissions` 默认为 `true`

**示例**:
```typescript
import { resource } from '@mtpc/helper';
import { z } from 'zod';

// 用户资源
const userResource = resource.crud({
  name: 'user',
  schema: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(['admin', 'user', 'guest']),
    departmentId: z.string()
  }),
  enable: {
    create: true,
    read: true,
    update: true,
    delete: true,
    list: true
  },
  withCrudPermissions: true,
  metadata: {
    displayName: '用户',
    pluralName: '用户',
    description: '系统用户管理',
    group: 'core',
    icon: 'users'
  }
});

mtpc.registerResource(userResource);
```

### 3.5.3 自定义资源配置

#### 禁用特定操作

```typescript
// 只读资源
const configResource = resource.crud({
  name: 'config',
  schema: z.object({
    key: z.string(),
    value: z.string(),
    description: z.string().optional()
  }),
  enable: {
    create: false,
    read: true,
    update: false,
    delete: false,
    list: true
  },
  withCrudPermissions: false,  // 不生成标准 CRUD 权限
  metadata: {
    displayName: '配置',
    description: '系统配置项（只读）'
  }
});
```

#### 不生成 CRUD 权限

```typescript
// 自定义权限资源
const customResource = resource.crud({
  name: 'article',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    content: z.string()
  }),
  withCrudPermissions: false,  // 不生成标准 CRUD 权限
  metadata: {
    displayName: '文章'
  }
});

// 手动添加自定义权限
mtpc.registerResource({
  ...customResource,
  permissions: [
    { action: 'publish', description: '发布文章' },
    { action: 'archive', description: '归档文章' }
  ]
});
```

---

## 3.6 Time 模块

### 3.6.1 模块概述

Time 模块提供时间相关条件检查，支持工作时间、日期范围等限制。

### 3.6.2 核心功能

#### 小时区间限制

**`withinHours(startHour, endHour)`**

限制在每天某个小时区间内。

**参数**:
- `startHour: number` - 开始小时 (0-23)
- `endHour: number` - 结束小时 (0-23)

**返回值**:
- `PolicyCondition` - 策略条件对象

**区间定义**:
- 左闭右开区间 `[start, end)`
- 例如 `withinHours(9, 18)` 允许 9:00-17:59

**时间获取**:
- 优先使用 `ctx.request.timestamp`
- 如果没有，使用 `new Date()`

**示例**:
```typescript
import { time, policy } from '@mtpc/helper';

// 工作时间限制（9:00-18:00）
const workHoursPolicy = policy.allow('work-hours-only', ['sensitive:access'], {
  conditions: [
    time.withinHours(9, 18)
  ],
  description: '仅在工作时间内允许访问敏感功能'
});

mtpc.registerPolicy(workHoursPolicy);
```

#### 日期范围限制

**`betweenDates(from, to)`**

限制在某个日期范围内。

**参数**:
- `from: Date` - 开始日期
- `to: Date` - 结束日期

**返回值**:
- `PolicyCondition` - 策略条件对象

**区间定义**:
- 闭区间 `[from, to]`
- 包含起始和结束日期

**时间获取**:
- 优先使用 `ctx.request.timestamp`
- 如果没有，使用 `new Date()`

**示例**:
```typescript
// 临时权限（特定日期范围内）
const tempAccessPolicy = policy.allow('temp-access', ['temp:feature'], {
  conditions: [
    time.betweenDates(
      new Date('2024-01-01'),
      new Date('2024-12-31')
    )
  ],
  description: '2024年临时访问权限'
});

mtpc.registerPolicy(tempAccessPolicy);
```

#### 工作日限制

**`weekdaysOnly()`**

限制在工作日（周一到周五）。

**参数**:
- 无参数

**返回值**:
- `PolicyCondition` - 策略条件对象

**工作日定义**:
- 周一到周五 (day 1-5)
- 不包括周六周日 (day 0, 6)

**时间获取**:
- 优先使用 `ctx.request.timestamp`
- 如果没有，使用 `new Date()`

**示例**:
```typescript
// 工作日限制
const weekdaysPolicy = policy.allow('weekdays-only', ['business:operation'], {
  conditions: [
    time.weekdaysOnly()
  ],
  description: '仅在工作日允许业务操作'
});

mtpc.registerPolicy(weekdaysPolicy);
```

### 3.6.3 组合时间条件

可以组合多个时间条件创建复杂的时间限制：

```typescript
// 工作日工作时间
const workTimePolicy = policy.allow('work-time-only', ['business:operation'], {
  conditions: [
    time.withinHours(9, 18),
    time.weekdaysOnly()
  ],
  description: '仅在工作日工作时间允许业务操作'
});

mtpc.registerPolicy(workTimePolicy);
```

---

## 4. API 接口参考

### 4.1 ABAC 模块 API

| 函数 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `attrEquals(resourceField, contextPath)` | `resourceField: string`, `contextPath: string` | `PolicyCondition` | 属性等于条件 |
| `attrIn(resourceField, contextPath)` | `resourceField: string`, `contextPath: string` | `PolicyCondition` | 属性包含条件 |
| `ownResource(ownerField)` | `ownerField: string = 'createdBy'` | `PolicyCondition` | 资源所有权条件 |
| `sameDepartment(resourceField, contextPath)` | `resourceField: string = 'departmentId'`, `contextPath: string = 'subject.metadata.departmentId'` | `PolicyCondition` | 部门相等条件 |
| `sameTeam(resourceField, contextPath)` | `resourceField: string = 'teamId'`, `contextPath: string = 'subject.metadata.teamId'` | `PolicyCondition` | 团队相等条件 |
| `policy(id, config)` | `id: string`, `config: ABACPolicyConfig` | `PolicyDefinition` | ABAC 策略创建 |

### 4.2 ACL 模块 API

| 函数 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `toPolicies(config)` | `config: ACLConfig` | `PolicyDefinition[]` | ACL 转换 |

### 4.3 ENV 模块 API

| 函数 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `ipIn(whitelist)` | `whitelist: string[]` | `PolicyCondition` | IP 白名单 |
| `ipNotIn(blacklist)` | `blacklist: string[]` | `PolicyCondition` | IP 黑名单 |
| `userAgentContains(substring)` | `substring: string` | `PolicyCondition` | User-Agent 包含检查 |
| `userAgentMatches(pattern)` | `pattern: RegExp` | `PolicyCondition` | User-Agent 正则匹配 |

### 4.4 Policy Helper 模块 API

| 函数 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `allow(id, permissions, options)` | `id: string`, `permissions: string[]`, `options?: object` | `PolicyDefinition` | 创建允许策略 |
| `deny(id, permissions, options)` | `id: string`, `permissions: string[]`, `options?: object` | `PolicyDefinition` | 创建拒绝策略 |
| `allowForRoles(id, permissions, roles, options)` | `id: string`, `permissions: string[]`, `roles: string[]`, `options?: object` | `PolicyDefinition` | 基于角色的允许策略 |

### 4.5 Resource Helper 模块 API

| 函数 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `crud(options)` | `options: CrudResourceOptions` | `ResourceDefinition` | 创建 CRUD 资源 |

### 4.6 Time 模块 API

| 函数 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `withinHours(startHour, endHour)` | `startHour: number`, `endHour: number` | `PolicyCondition` | 小时区间限制 |
| `betweenDates(from, to)` | `from: Date`, `to: Date` | `PolicyCondition` | 日期范围限制 |
| `weekdaysOnly()` | 无 | `PolicyCondition` | 工作日限制 |

---

## 5. 使用示例

### 5.1 完整的 ABAC 示例

```typescript
import { createMTPC } from '@mtpc/core';
import { abac, resource } from '@mtpc/helper';
import { z } from 'zod';

// 创建 MTPC 实例
const mtpc = createMTPC();

// 定义文章资源
const articleResource = resource.crud({
  name: 'article',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    authorId: z.string(),
    status: z.enum(['draft', 'published', 'archived']),
    departmentId: z.string()
  }),
  metadata: {
    displayName: '文章',
    group: 'content'
  }
});

mtpc.registerResource(articleResource);

// 创建 ABAC 策略
const ownArticlePolicy = abac.policy('user-own-article', {
  permissions: ['article:update', 'article:delete'],
  conditions: [
    abac.ownResource('authorId')
  ],
  description: '用户只能编辑自己的文章'
});

const sameDeptPolicy = abac.policy('same-department-article', {
  permissions: ['article:read'],
  conditions: [
    abac.sameDepartment('departmentId', 'subject.metadata.departmentId')
  ],
  description: '同部门可阅读文章'
});

mtpc.registerPolicy(ownArticlePolicy);
mtpc.registerPolicy(sameDeptPolicy);

await mtpc.init();

// 权限检查
const context = mtpc.createContext(
  { id: 'tenant-1' },
  { 
    id: 'user-123', 
    type: 'user',
    metadata: { departmentId: 'dept-1' }
  }
);

// 检查用户是否可以更新自己的文章
const result1 = await mtpc.checkPermission({
  ...context,
  resource: 'article',
  action: 'update',
  resource: { id: 'article-1', authorId: 'user-123' }
});

console.log(result1.allowed); // true

// 检查用户是否可以更新别人的文章
const result2 = await mtpc.checkPermission({
  ...context,
  resource: 'article',
  action: 'update',
  resource: { id: 'article-2', authorId: 'user-456' }
});

console.log(result2.allowed); // false
```

### 5.2 完整的 ACL 示例

```typescript
import { acl } from '@mtpc/helper';

// 定义 ACL 配置
const aclConfig = {
  id: 'document-access',
  tenantId: 'tenant-1',
  entries: [
    {
      resource: 'document',
      action: 'read',
      allow: [
        { role: 'manager' },
        { role: 'editor' },
        { subjectId: 'user-123' }
      ],
      deny: [
        { subjectId: 'user-bad' }
      ]
    },
    {
      resource: 'document',
      action: 'write',
      allow: [
        { role: 'manager' },
        { subjectId: 'user-123' }
      ]
    }
  ],
  description: '文档访问控制列表'
};

// 转换为 MTPC 策略
const policies = acl.toPolicies(aclConfig);

// 批量注册策略
policies.forEach(policy => {
  console.log(`注册策略: ${policy.id}`);
  mtpc.registerPolicy(policy);
});

await mtpc.init();

// 权限检查
const context1 = mtpc.createContext(
  { id: 'tenant-1' },
  { id: 'user-123', type: 'user' }
);

const result1 = await mtpc.checkPermission({
  ...context1,
  resource: 'document',
  action: 'read'
});

console.log(result1.allowed); // true (user-123 在 allow 列表中)

const context2 = mtpc.createContext(
  { id: 'tenant-1' },
  { id: 'user-bad', type: 'user' }
);

const result2 = await mtpc.checkPermission({
  ...context2,
  resource: 'document',
  action: 'read'
});

console.log(result2.allowed); // false (user-bad 在 deny 列表中)
```

### 5.3 完整的 ENV 示例

```typescript
import { env, policy } from '@mtpc/helper';

// 内部网络白名单策略
const internalPolicy = policy.allow('internal-network', ['admin:access'], {
  conditions: [
    env.ipIn(['192.168.1.*', '10.0.0.*'])
  ],
  description: '仅允许内部网络访问管理功能'
});

// 移动设备策略
const mobilePolicy = policy.allow('mobile-only', ['mobile:feature'], {
  conditions: [
    env.userAgentContains('Mobile')
  ],
  description: '仅允许移动设备访问'
});

// Chrome 浏览器策略
const chromePolicy = policy.allow('chrome-only', ['chrome:feature'], {
  conditions: [
    env.userAgentMatches(/Chrome\/\d+/)
  ],
  description: '仅允许 Chrome 浏览器访问'
});

mtpc.registerPolicy(internalPolicy);
mtpc.registerPolicy(mobilePolicy);
mtpc.registerPolicy(chromePolicy);

await mtpc.init();

// 权限检查
const context = mtpc.createContext(
  { id: 'tenant-1' },
  { id: 'user-123', type: 'user' }
);

const result = await mtpc.checkPermission({
  ...context,
  resource: 'admin',
  action: 'access',
  request: {
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    timestamp: new Date()
  }
});

console.log(result.allowed); // true
```

### 5.4 完整的 Policy Helper 示例

```typescript
import { policy } from '@mtpc/helper';

// 管理员完全访问
const adminPolicy = policy.allow('admin-all-access', ['*'], {
  tenantId: 'tenant-1',
  description: '管理员拥有所有权限',
  priority: 'critical'
});

// 普通用户不能删除用户
const denyDeletePolicy = policy.deny('user-no-delete', ['user:delete'], {
  tenantId: 'tenant-1',
  description: '普通用户不能删除用户',
  priority: 'high'
});

// 经理角色权限
const managerPolicy = policy.allowForRoles('manager-permissions', [
  'user:read', 'user:update', 'order:*', 'report:read'
], ['manager'], {
  description: '经理角色权限',
  metadata: { level: 'management' }
});

// 编辑角色权限
const editorPolicy = policy.allowForRoles('editor-permissions', [
  'article:read', 'article:create', 'article:update'
], ['editor'], {
  description: '编辑角色权限',
  metadata: { level: 'content' }
});

mtpc.registerPolicy(adminPolicy);
mtpc.registerPolicy(denyDeletePolicy);
mtpc.registerPolicy(managerPolicy);
mtpc.registerPolicy(editorPolicy);

await mtpc.init();

// 权限检查
const managerContext = mtpc.createContext(
  { id: 'tenant-1' },
  { id: 'user-123', type: 'user', roles: ['manager'] }
);

const result1 = await mtpc.checkPermission({
  ...managerContext,
  resource: 'user',
  action: 'read'
});

console.log(result1.allowed); // true

const result2 = await mtpc.checkPermission({
  ...managerContext,
  resource: 'user',
  action: 'delete'
});

console.log(result2.allowed); // false (被 deny 策略拒绝)
```

### 5.5 完整的 Resource Helper 示例

```typescript
import { resource } from '@mtpc/helper';
import { z } from 'zod';

// 用户资源
const userResource = resource.crud({
  name: 'user',
  schema: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(['admin', 'user', 'guest']),
    departmentId: z.string()
  }),
  enable: {
    create: true,
    read: true,
    update: true,
    delete: true,
    list: true
  },
  withCrudPermissions: true,
  metadata: {
    displayName: '用户',
    pluralName: '用户',
    description: '系统用户管理',
    group: 'core',
    icon: 'users'
  }
});

// 配置资源（只读）
const configResource = resource.crud({
  name: 'config',
  schema: z.object({
    key: z.string(),
    value: z.string(),
    description: z.string().optional()
  }),
  enable: {
    create: false,
    read: true,
    update: false,
    delete: false,
    list: true
  },
  withCrudPermissions: false,
  metadata: {
    displayName: '配置',
    description: '系统配置项（只读）'
  }
});

// 订单资源
const orderResource = resource.crud({
  name: 'order',
  schema: z.object({
    id: z.string(),
    customerId: z.string(),
    amount: z.number(),
    status: z.enum(['pending', 'paid', 'shipped', 'delivered'])
  }),
  enable: {
    create: true,
    read: true,
    update: true,
    delete: false,  // 禁用删除
    list: true
  },
  withCrudPermissions: true,
  metadata: {
    displayName: '订单',
    pluralName: '订单',
    description: '订单管理',
    group: 'business',
    icon: 'shopping-cart'
  }
});

mtpc.registerResource(userResource);
mtpc.registerResource(configResource);
mtpc.registerResource(orderResource);

await mtpc.init();

// 获取资源信息
const userResourceDef = mtpc.getResource('user');
console.log(userResourceDef.name); // 'user'
console.log(userResourceDef.permissions); // ['create', 'read', 'update', 'delete', 'list']
```

### 5.6 完整的 Time 示例

```typescript
import { time, policy } from '@mtpc/helper';

// 工作时间限制（9:00-18:00）
const workHoursPolicy = policy.allow('work-hours-only', ['sensitive:access'], {
  conditions: [
    time.withinHours(9, 18)
  ],
  description: '仅在工作时间内允许访问敏感功能'
});

// 工作日限制
const weekdaysPolicy = policy.allow('weekdays-only', ['business:operation'], {
  conditions: [
    time.weekdaysOnly()
  ],
  description: '仅在工作日允许业务操作'
});

// 临时权限（特定日期范围内）
const tempAccessPolicy = policy.allow('temp-access', ['temp:feature'], {
  conditions: [
    time.betweenDates(
      new Date('2024-01-01'),
      new Date('2024-12-31')
    )
  ],
  description: '2024年临时访问权限'
});

// 工作日工作时间
const workTimePolicy = policy.allow('work-time-only', ['business:operation'], {
  conditions: [
    time.withinHours(9, 18),
    time.weekdaysOnly()
  ],
  description: '仅在工作日工作时间允许业务操作'
});

mtpc.registerPolicy(workHoursPolicy);
mtpc.registerPolicy(weekdaysPolicy);
mtpc.registerPolicy(tempAccessPolicy);
mtpc.registerPolicy(workTimePolicy);

await mtpc.init();

// 权限检查
const context = mtpc.createContext(
  { id: 'tenant-1' },
  { id: 'user-123', type: 'user' }
);

// 工作日工作时间检查
const workTimeResult = await mtpc.checkPermission({
  ...context,
  resource: 'business',
  action: 'operation',
  request: {
    timestamp: new Date('2024-01-15T10:30:00') // 周一 10:30
  }
});

console.log(workTimeResult.allowed); // true

// 周末检查
const weekendResult = await mtpc.checkPermission({
  ...context,
  resource: 'business',
  action: 'operation',
  request: {
    timestamp: new Date('2024-01-14T10:30:00') // 周日 10:30
  }
});

console.log(weekendResult.allowed); // false
```

### 5.7 组合条件示例

```typescript
import { abac, policy, time, env } from '@mtpc/helper';

// 复杂权限策略
const complexPolicy = policy.allow('complex-condition', ['sensitive:access'], {
  conditions: [
    // 工作时间内
    time.withinHours(9, 18),
    // 工作日
    time.weekdaysOnly(),
    // 内部网络
    env.ipIn(['192.168.1.*']),
    // 相同部门
    abac.sameDepartment('departmentId', 'subject.metadata.departmentId'),
    // 资源所有者
    abac.ownResource('createdBy')
  ],
  description: '工作日工作时间内，同部门且是创建者可访问'
});

mtpc.registerPolicy(complexPolicy);

await mtpc.init();

// 权限检查
const context = mtpc.createContext(
  { id: 'tenant-1' },
  { 
    id: 'user-123', 
    type: 'user',
    metadata: { departmentId: 'dept-1' }
  }
);

const result = await mtpc.checkPermission({
  ...context,
  resource: 'sensitive',
  action: 'access',
  resource: { 
    id: 'sensitive-1',
    createdBy: 'user-123',
    departmentId: 'dept-1'
  },
  request: {
    ip: '192.168.1.100',
    timestamp: new Date('2024-01-15T10:30:00') // 周一 10:30
  }
});

console.log(result.allowed); // true
```

---

## 6. 最佳实践

### 6.1 代码组织

#### 集中管理资源定义

将所有资源定义放在单独的文件中：

```typescript
// resources/index.ts
import { resource } from '@mtpc/helper';
import { z } from 'zod';

export const userResource = resource.crud({
  name: 'user',
  schema: z.object({
    id: z.string(),
    email: z.string().email()
  }),
  metadata: {
    displayName: '用户'
  }
});

export const articleResource = resource.crud({
  name: 'article',
  schema: z.object({
    id: z.string(),
    title: z.string()
  }),
  metadata: {
    displayName: '文章'
  }
});
```

#### 按功能模块组织策略

将策略按功能模块分组：

```typescript
// policies/index.ts
import { abac, policy } from '@mtpc/helper';

// 用户策略
export const userPolicies = [
  policy.allowForRoles('user-read', ['user:read'], ['user']),
  policy.allowForRoles('user-write', ['user:create', 'user:update'], ['admin'])
];

// 文章策略
export const articlePolicies = [
  abac.policy('user-own-article', {
    permissions: ['article:update', 'article:delete'],
    conditions: [abac.ownResource('authorId')]
  })
];
```

### 6.2 命名规范

#### 资源命名

- 使用小写字母和连字符
- 使用复数形式
- 示例：`users`, `articles`, `orders`

#### 策略命名

- 使用小写字母和连字符
- 描述策略的用途
- 示例：`user-own-article`, `same-department-access`

#### 权限命名

- 使用 `resource:action` 格式
- 使用动词表示操作
- 示例：`user:read`, `article:create`, `order:delete`

### 6.3 类型安全

#### 使用 TypeScript 类型

充分利用 TypeScript 类型系统：

```typescript
import { abac, policy, resource, time, env } from '@mtpc/helper';
import type { PolicyDefinition, ResourceDefinition } from '@mtpc/core';

// 定义资源
const userResource: ResourceDefinition = resource.crud({
  name: 'user',
  schema: z.object({
    id: z.string(),
    email: z.string().email()
  })
});

// 定义策略
const userPolicy: PolicyDefinition = policy.allow('user-read', ['user:read']);
```

#### 类型推断

让 TypeScript 推断类型：

```typescript
// TypeScript 会自动推断类型
const condition = abac.ownResource();
const policy = policy.allow('user-read', ['user:read']);
```

### 6.4 错误处理

#### 处理权限拒绝

```typescript
try {
  await mtpc.requirePermission({
    ...context,
    resource: 'user',
    action: 'delete'
  });
  // 执行删除操作
} catch (error) {
  if (error instanceof PermissionDeniedError) {
    console.error('权限拒绝:', error.message);
    // 返回错误响应
    return { error: '权限不足' };
  }
  throw error;
}
```

#### 处理资源未找到

```typescript
const resource = mtpc.getResource('user');
if (!resource) {
  console.error('资源未找到: user');
  throw new Error('资源未找到');
}
```

### 6.5 性能优化

#### 缓存常用条件

```typescript
// 缓存常用条件以提高性能
class ConditionCache {
  private cache = new Map<string, PolicyCondition>();

  getOrCreate(key: string, factory: () => PolicyCondition): PolicyCondition {
    if (!this.cache.has(key)) {
      this.cache.set(key, factory());
    }
    return this.cache.get(key)!;
  }
}

const cache = new ConditionCache();

// 缓存常用的部门条件
const departmentCondition = cache.getOrCreate(
  `same-department-${tenantId}`,
  () => abac.sameDepartment('departmentId', 'subject.metadata.departmentId')
);
```

#### 批量注册

```typescript
// 批量注册资源
mtpc.registerResources([
  userResource,
  articleResource,
  orderResource
]);

// 批量注册策略
mtpc.registerPolicies([
  ...userPolicies,
  ...articlePolicies
]);
```

### 6.6 安全实践

#### 遵循默认拒绝原则

```typescript
// 不指定允许的权限，默认拒绝所有访问
const strictPolicy = policy.allow('strict-access', [], {
  description: '严格访问控制'
});
```

#### 使用最小权限原则

```typescript
// 只授予必要的权限
const limitedPolicy = policy.allowForRoles('limited-access', [
  'user:read',  // 只读权限
  'article:read'
], ['user']);
```

#### 定期审查权限配置

定期审查和清理不必要的权限：

```typescript
// 获取所有策略
const allPolicies = mtpc.policyEngine.getAllPolicies();

// 检查未使用的策略
const unusedPolicies = allPolicies.filter(p => {
  // 检查策略是否被使用
  return !isPolicyUsed(p.id);
});

// 删除未使用的策略
unusedPolicies.forEach(p => {
  console.log(`删除未使用的策略: ${p.id}`);
  // mtpc.unregisterPolicy(p.id);
});
```

---

## 7. 常见问题

### Q1: Helper 包与核心包的区别是什么？

**A**: 
- **核心包 (`@mtpc/core`)**: 提供权限引擎的核心功能，包括策略引擎、权限检查器、资源注册表等
- **Helper 包 (`@mtpc/helper`)**: 提供便捷的 API 和常用权限模式，简化开发复杂度

Helper 包依赖于核心包，是对核心包功能的补充和增强。

### Q2: 如何扩展自定义条件？

**A**: 使用自定义条件函数：

```typescript
const customCondition: PolicyCondition = {
  type: 'custom',
  fn: async (ctx: PolicyEvaluationContext) => {
    // 实现自定义条件逻辑
    return true; // 或 false
  }
};

// 在策略中使用
const policy = abac.policy('custom-condition-policy', {
  permissions: ['resource:action'],
  conditions: [customCondition]
});
```

### Q3: 如何实现基于属性的访问控制（ABAC）？

**A**: 使用 ABAC 模块提供的条件函数：

```typescript
const policy = abac.policy('abac-policy', {
  permissions: ['document:read'],
  conditions: [
    abac.attrEquals('departmentId', 'subject.metadata.departmentId'),
    abac.ownResource('createdBy')
  ]
});
```

### Q4: 如何处理权限变更时的缓存失效？

**A**: 实现权限变更事件监听，当权限发生变化时，主动清除相关缓存：

```typescript
async function onPermissionsChanged(tenantId: string, subjectId: string) {
  // 清除权限检查器缓存
  mtpc.permissionChecker.clearSubjectCache(tenantId, subjectId);

  // 如果使用外部缓存，也需要清除
  await redisClient.del(`permissions:${tenantId}:${subjectId}`);
}
```

### Q5: 如何与现有权限系统集成？

**A**: 实现自定义 `defaultPermissionResolver`，从现有系统获取权限数据：

```typescript
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId: string, subjectId: string) => {
    // 从现有权限系统获取权限
    const permissions = await existingPermissionSystem.getPermissions(tenantId, subjectId);
    return new Set(permissions);
  }
});
```

### Q6: 如何实现租户级别的策略？

**A**: 在策略定义中指定 `tenantId`：

```typescript
const policy = policy.allow('tenant-1-admin', ['*'], {
  tenantId: 'tenant-1',
  description: '租户1管理员'
});
```

### Q7: 如何实现资源级别的权限？

**A**: 在资源定义中添加自定义权限：

```typescript
const articleResource = resource.crud({
  name: 'article',
  schema: z.object({
    id: z.string(),
    title: z.string()
  }),
  withCrudPermissions: false  // 不生成标准 CRUD 权限
});

// 手动添加自定义权限
mtpc.registerResource({
  ...articleResource,
  permissions: [
    { action: 'publish', description: '发布文章' },
    { action: 'archive', description: '归档文章' }
  ]
});
```

### Q8: 如何实现动态权限？

**A**: 使用策略条件系统，根据运行时条件动态授予权限：

```typescript
const policy = abac.policy('dynamic-policy', {
  permissions: ['resource:action'],
  conditions: [
    {
      type: 'custom',
      fn: async (ctx) => ctx.subject.attributes.level >= 5
    }
  ]
});
```

### Q9: 如何实现权限继承？

**A**: 通过策略条件和权限解析器实现：

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

**A**: 使用策略条件系统，检查委托关系：

```typescript
const policy = abac.policy('delegation-policy', {
  permissions: ['user:manage'],
  conditions: [
    {
      type: 'custom',
      fn: async (ctx) => {
        const delegatedBy = ctx.subject.attributes.delegatedBy;
        return delegatedBy === 'manager-id';
      }
    }
  ]
});
```

---

## 8. 性能优化建议

### 8.1 条件函数优化

#### 避免复杂操作

在条件函数中避免执行复杂操作：

```typescript
// 不推荐：在条件函数中执行数据库查询
const badCondition = {
  type: 'custom',
  fn: async (ctx) => {
    const user = await db.users.findById(ctx.subject.id);
    return user.role === 'admin';
  }
};

// 推荐：将数据预先加载到上下文中
const goodCondition = {
  type: 'custom',
  fn: async (ctx) => {
    return ctx.subject.role === 'admin';
  }
};
```

#### 使用缓存

对频繁使用的条件进行缓存：

```typescript
class ConditionCache {
  private cache = new Map<string, PolicyCondition>();

  getOrCreate(key: string, factory: () => PolicyCondition): PolicyCondition {
    if (!this.cache.has(key)) {
      this.cache.set(key, factory());
    }
    return this.cache.get(key)!;
  }
}
```

### 8.2 策略优化

#### 减少策略数量

合并相似的策略：

```typescript
// 不推荐：多个相似策略
const policy1 = policy.allow('user-read', ['user:read']);
const policy2 = policy.allow('article-read', ['article:read']);
const policy3 = policy.allow('order-read', ['order:read']);

// 推荐：合并为一个策略
const combinedPolicy = policy.allow('read-all', [
  'user:read', 'article:read', 'order:read'
]);
```

#### 使用通配符

使用通配符权限减少策略数量：

```typescript
// 不推荐：多个具体权限
const policy = policy.allow('admin-all', [
  'user:read', 'user:create', 'user:update', 'user:delete',
  'article:read', 'article:create', 'article:update', 'article:delete'
]);

// 推荐：使用通配符
const policy = policy.allow('admin-all', ['*']);
```

### 8.3 批量操作

#### 批量注册

使用批量注册减少初始化时间：

```typescript
// 批量注册资源
mtpc.registerResources([
  userResource,
  articleResource,
  orderResource
]);

// 批量注册策略
mtpc.registerPolicies([
  ...userPolicies,
  ...articlePolicies
]);
```

#### 批量权限检查

并行执行多个权限检查：

```typescript
const checkResults = await Promise.all([
  mtpc.checkPermission({ ...context, resource: 'user', action: 'read' }),
  mtpc.checkPermission({ ...context, resource: 'user', action: 'update' }),
  mtpc.checkPermission({ ...context, resource: 'user', action: 'delete' })
]);
```

### 8.4 监控和调试

#### 性能监控

监控权限检查性能：

```typescript
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

  return result;
};
```

#### 调试信息

添加调试信息帮助排查问题：

```typescript
const debugCondition = {
  type: 'custom',
  fn: async (ctx) => {
    console.log('条件检查:', {
      subjectId: ctx.subject.id,
      resourceId: ctx.resource?.id,
      timestamp: ctx.request.timestamp
    });
    return true;
  }
};
```

---

## 总结

`@mtpc/helper` 包提供了丰富的权限模式和便捷的 API，显著简化了权限系统的开发复杂度。通过本指南，您应该能够：

1. 理解 Helper 包的各个模块及其功能
2. 使用 ABAC、ACL、ENV、Policy、Resource、Time 模块创建权限策略
3. 遵循最佳实践编写高质量的权限代码
4. 解决常见的权限问题
5. 优化权限系统的性能

如需更多信息，请参考：
- [`@mtpc/core` 文档](../core/README.md)
- [MTPC 架构文档](../../mtpc-architecture.md)
- [技术分析文档](./TECHNICAL_ANALYSIS.md)
