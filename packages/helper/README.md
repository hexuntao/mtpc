# MTPC Helper - 轻量级权限工具包

## 概述

`@mtpc/helper` 是一个轻量级的权限工具包，为 MTPC (Multi-Tenant Permission Core) 提供便捷的 API 和常用权限模式。该包作为核心包的补充，通过提供预构建的权限模式、策略创建助手和资源定义快捷方式，显著简化了权限系统的开发复杂度。

## 核心功能模块

### 1. ABAC (Attribute-Based Access Control) 模块
基于属性的访问控制，提供丰富的条件检查功能。

**主要功能**：
- 属性比较条件 (`attrEquals`, `attrIn`)
- 资源所有权检查 (`ownResource`)
- 组织架构条件 (`sameDepartment`, `sameTeam`)
- 自定义条件创建器

**核心 API**：

```typescript
// 属性相等条件
export function attrEquals(resourceField: string, contextPath: string): PolicyCondition

// 属性包含条件
export function attrIn(resourceField: string, contextPath: string): PolicyCondition

// 资源所有权条件
export function ownResource(ownerField?: string): PolicyCondition

// 组织架构条件
export function sameDepartment(resourceField?: string, contextPath?: string): PolicyCondition
export function sameTeam(resourceField?: string, contextPath?: string): PolicyCondition

// ABAC 策略创建
export function policy(id: string, config: ABACPolicyConfig): PolicyDefinition
```

### 2. ACL (Access Control List) 模块
访问控制列表转换器，将传统 ACL 配置转换为 MTPC 策略。

**主要功能**：
- ACL 配置定义
- 主体引用匹配 (用户 ID、角色)
- 拒绝优先策略转换

**核心 API**：

```typescript
// 主体引用定义
export interface PrincipalRef {
  subjectId?: string;
  role?: string;
}

// ACL 条目定义
export interface ACLEntry {
  resource: string;
  action: string;
  allow?: PrincipalRef[];
  deny?: PrincipalRef[];
}

// ACL 配置
export interface ACLConfig {
  id: string;
  tenantId?: string;
  entries: ACLEntry[];
  description?: string;
  priority?: PolicyPriority;
}

// ACL 转换
export function toPolicies(config: ACLConfig): PolicyDefinition[]
```

### 3. ENV (Environment) 模块
环境相关条件检查，支持 IP 地址和 User-Agent 验证。

**主要功能**：
- IP 地址白名单/黑名单
- User-Agent 内容检查
- 支持通配符和正则表达式

**核心 API**：

```typescript
// IP 白名单
export function ipIn(whitelist: string[]): PolicyCondition

// IP 黑名单
export function ipNotIn(blacklist: string[]): PolicyCondition

// User-Agent 包含检查
export function userAgentContains(substring: string): PolicyCondition

// User-Agent 正则匹配
export function userAgentMatches(pattern: RegExp): PolicyCondition
```

### 4. POLICY (Policy Helper) 模块
策略创建助手，提供快速创建常用策略的方法。

**主要功能**：
- 允许/拒绝策略创建
- 基于角色的权限控制
- 优先级自动设置

**核心 API**：

```typescript
// 创建允许策略
export function allow(
  id: string,
  permissions: string[],
  options?: PolicyOptions
): PolicyDefinition

// 创建拒绝策略
export function deny(
  id: string,
  permissions: string[],
  options?: PolicyOptions
): PolicyDefinition

// 基于角色的允许策略
export function allowForRoles(
  id: string,
  permissions: string[],
  roles: string[],
  options?: PolicyOptions
): PolicyDefinition
```

### 5. RESOURCE (Resource Helper) 模块
资源定义助手，简化标准 CRUD 资源的创建。

**主要功能**：
- 自动生成 CRUD 权限
- 灵活的功能启用控制
- 元数据配置支持

**核心 API**：

```typescript
// CRUD 资源选项
export interface CrudResourceOptions {
  name: string;
  schema: AnyZodSchema;
  enable?: {
    create?: boolean;
    read?: boolean;
    update?: boolean;
    delete?: boolean;
    list?: boolean;
  };
  withCrudPermissions?: boolean;
  metadata?: {
    displayName?: string;
    pluralName?: string;
    description?: string;
    group?: string;
    icon?: string;
  };
}

// 创建 CRUD 资源
export function crud(options: CrudResourceOptions): ResourceDefinition
```

### 6. TIME (Time) 模块
时间相关条件检查，支持工作时间、日期范围等限制。

**主要功能**：
- 工作时间限制
- 日期范围限制
- 工作日限制

**核心 API**：

```typescript
// 小时区间限制
export function withinHours(startHour: number, endHour: number): PolicyCondition

// 日期范围限制
export function betweenDates(from: Date, to: Date): PolicyCondition

// 工作日限制
export function weekdaysOnly(): PolicyCondition
```

## 与核心包的依赖关系

### 依赖关系图
```
@mtpc/core (核心引擎)
    ↓ 类型定义和接口
@mtpc/helper (工具包)
    ↑ 扩展和增强功能
@mtpc/shared (共享工具)
    ↓ 通用工具函数
```

### 核心依赖
- **@mtpc/core**: 提供核心类型定义、策略引擎、权限检查器
- **@mtpc/shared**: 提供 `getByPath` 等工具函数
- **zod**: 提供运行时类型验证

### 类型依赖
Helper 包依赖核心包的以下类型：
- `PolicyCondition`, `PolicyDefinition`, `PolicyEvaluationContext`
- `PolicyRule`, `PolicyPriority`, `ResourceDefinition`
- `ResourceFeatures`, `PermissionDefinition`
- `AnyZodSchema`

## 使用场景及限制条件

### 适用场景
1. **快速原型开发**: 使用预构建的模式快速搭建权限系统
2. **标准 CRUD 权限**: 适合大多数业务系统的基本权限需求
3. **基于属性的权限**: 需要根据资源属性进行精细化权限控制
4. **环境安全控制**: 需要根据 IP、User-Agent 等环境因素控制访问
5. **时间限制访问**: 需要在特定时间窗口内限制操作权限
6. **传统 ACL 迁移**: 需要将现有 ACL 系统迁移到 MTPC

### 限制条件
1. **轻量级定位**: 不包含复杂的企业级功能，如审计、监控等
2. **基于核心**: 依赖 MTPC Core 的功能，无法独立运行
3. **预设模式**: 主要提供常见模式，特殊需求需要自定义扩展
4. **性能考虑**: 自定义条件函数在高频调用时可能影响性能

## 安装指南

### 基本安装
```bash
# 使用 pnpm
pnpm add @mtpc/helper

# 使用 npm
npm install @mtpc/helper

# 使用 yarn
yarn add @mtpc/helper
```

### 依赖安装
Helper 包会自动安装以下依赖：
- `@mtpc/core`: 核心权限引擎
- `@mtpc/shared`: 共享工具包
- `zod`: 运行时类型验证

### 环境要求
- Node.js >= 18.0.0
- TypeScript >= 5.0.0 (推荐使用)
- 已安装并配置 `@mtpc/core`

## 基础使用示例

### 1. ABAC 使用示例

#### 基础属性比较
```typescript
import { createMTPC } from '@mtpc/core';
import { abac } from '@mtpc/helper';

// 创建 MTPC 实例
const mtpc = createMTPC();

// 创建 ABAC 策略：用户只能编辑自己的文章
const policy = abac.policy('user-own-article', {
  permissions: ['article:update', 'article:delete'],
  conditions: [
    abac.ownResource('authorId')  // 作者 ID 等于当前用户 ID
  ],
  description: '用户只能编辑自己的文章'
});

await mtpc.registerPolicy(policy);

// 权限检查
const context = mtpc.createContext(
  { id: 'tenant-1' },
  { 
    id: 'user-123', 
    type: 'user',
    metadata: { departmentId: 'dept-1' }
  }
);

// 检查用户是否可以更新文章
const result = await mtpc.checkPermission({
  ...context,
  resource: 'article',
  action: 'update',
  resource: { id: 'article-1', authorId: 'user-123', title: 'My Article' }
});

console.log(result.allowed); // true
```

#### 组织架构权限
```typescript
// 部门内权限控制
const deptPolicy = abac.policy('same-department', {
  permissions: ['document:read', 'document:update'],
  conditions: [
    abac.sameDepartment('departmentId', 'subject.metadata.departmentId')
  ]
});

// 团队内权限控制
const teamPolicy = abac.policy('same-team', {
  permissions: ['project:view', 'project:edit'],
  conditions: [
    abac.sameTeam('teamId', 'subject.metadata.teamId')
  ]
});
```

### 2. ACL 使用示例

#### 传统 ACL 配置
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
        { subjectId: 'user-123' }  // 特殊用户
      ],
      deny: [
        { subjectId: 'user-bad' }  // 拒绝特定用户
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
policies.forEach(policy => mtpc.registerPolicy(policy));
```

### 3. ENV 使用示例

#### IP 访问控制
```typescript
import { env } from '@mtpc/helper';

// 内部网络白名单
const internalPolicy = policy('internal-network', ['admin:access'], {
  conditions: [
    env.ipIn(['192.168.1.*', '10.0.0.*'])
  ],
  description: '仅允许内部网络访问管理功能'
});

// IP 黑名单
const blockedIPPolicy = policy('blocked-ip', ['*'], {
  conditions: [
    env.ipNotIn(['192.168.1.100', '10.0.0.50'])
  ],
  description: '阻止特定 IP 访问'
});

// User-Agent 控制
const mobilePolicy = policy('mobile-only', ['mobile:feature'], {
  conditions: [
    env.userAgentContains('Mobile')  // 仅允许移动设备
  ]
});
```

### 4. POLICY 使用示例

#### 基础策略创建
```typescript
import { policy } from '@mtpc/helper';

// 创建允许策略
const allowPolicy = policy.allow('admin-all-access', ['*'], {
  tenantId: 'tenant-1',
  description: '管理员拥有所有权限',
  priority: 'critical'
});

// 创建拒绝策略
const denyPolicy = policy.deny('user-no-delete', ['user:delete'], {
  tenantId: 'tenant-1',
  description: '普通用户不能删除用户',
  priority: 'high'
});

// 基于角色的权限
const rolePolicy = policy.allowForRoles('manager-permissions', [
  'user:read', 'user:update', 'order:*'
], ['manager'], {
  description: '经理角色权限',
  metadata: { level: 'management' }
});
```

### 5. RESOURCE 使用示例

#### CRUD 资源创建
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
    delete: true,  // 禁用删除功能
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

// 注册资源
mtpc.registerResource(userResource);

// 自定义资源（仅读权限）
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

### 6. TIME 使用示例

#### 工作时间控制
```typescript
import { time } from '@mtpc/helper';

// 工作时间限制（9:00-18:00）
const workHoursPolicy = policy('work-hours-only', ['sensitive:access'], {
  conditions: [
    time.withinHours(9, 18)  // [9:00, 18:00)
  ],
  description: '仅在工作时间内允许访问敏感功能'
});

// 工作日限制
const weekdaysPolicy = policy('weekdays-only', ['business:operation'], {
  conditions: [
    time.weekdaysOnly()  // 周一到周五
  ],
  description: '仅在工作日允许业务操作'
});

// 临时权限（特定日期范围内）
const tempAccessPolicy = policy('temp-access', ['temp:feature'], {
  conditions: [
    time.betweenDates(
      new Date('2024-01-01'),
      new Date('2024-12-31')
    )
  ],
  description: '2024年临时访问权限'
});
```

## 高级功能演示

### 1. 组合条件使用
```typescript
// 组合多种条件的复杂权限
const complexPolicy = abac.policy('complex-condition', {
  permissions: ['sensitive:access'],
  conditions: [
    // 工作时间内
    time.withinHours(9, 18),
    // 工作日
    time.weekdaysOnly(),
    // 内部网络
    env.ipIn(['192.168.1.*']),
    // 相同部门
    abac.sameDepartment('departmentId', 'subject.metadata.departmentId'),
    // 特定角色
    {
      type: 'custom',
      fn: async (ctx) => ctx.subject.roles?.includes('senior-staff')
    }
  ],
  priority: 'high'
});
```

### 2. 动态策略配置
```typescript
// 根据配置动态生成策略
function createRoleBasedPolicies(roles: Array<{name: string, permissions: string[]}>) {
  return roles.map(role => 
    policy.allowForRoles(`role-${role.name}`, role.permissions, [role.name], {
      description: `Role-based permissions for ${role.name}`,
      metadata: { roleName: role.name }
    })
  );
}

// 使用示例
const policies = createRoleBasedPolicies([
  { name: 'admin', permissions: ['*'] },
  { name: 'manager', permissions: ['user:*', 'order:*', 'report:read'] },
  { name: 'user', permissions: ['user:read', 'user:update'] }
]);

policies.forEach(p => mtpc.registerPolicy(p));
```

### 3. 资源级权限扩展
```typescript
// 扩展标准 CRUD 资源
const articleResource = resource.crud({
  name: 'article',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    authorId: z.string(),
    status: z.enum(['draft', 'published', 'archived']),
    tags: z.array(z.string()),
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
    displayName: '文章',
    group: 'content'
  }
});

// 添加自定义权限
const publishPermission = { action: 'publish', description: '发布文章' };
const archivePermission = { action: 'archive', description: '归档文章' };

mtpc.registerResource({
  ...articleResource,
  permissions: [
    ...articleResource.permissions!,
    publishPermission,
    archivePermission
  ]
});
```

### 4. 条件缓存优化
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

  clear() {
    this.cache.clear();
  }
}

const cache = new ConditionCache();

// 缓存常用的部门条件
const departmentCondition = cache.getOrCreate(
  `same-department-${tenantId}`,
  () => abac.sameDepartment('departmentId', 'subject.metadata.departmentId')
);
```

## 常见问题解答

### Q1: Helper 包与核心包的区别是什么？
**A**: 
- **核心包 (`@mtpc/core`)**: 提供权限引擎的核心功能，包括策略引擎、权限检查、
