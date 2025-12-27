# @mtpc/data-scope 使用指南

**版本**: 0.1.0

## 目录

1. [概述](#1-概述)
2. [核心概念](#2-核心概念)
3. [快速开始](#3-快速开始)
4. [范围定义](#4-范围定义)
5. [范围分配](#5-范围分配)
6. [范围解析](#6-范围解析)
7. [过滤器生成](#7-过滤器生成)
8. [插件集成](#8-插件集成)
9. [高级特性](#9-高级特性)
10. [常见问题](#10-常见问题)
11. [最佳实践](#11-最佳实践)

---

## 1. 概述

### 1.1 什么是 @mtpc/data-scope

`@mtpc/data-scope` 是 MTPC 框架的行级安全控制（Row-Level Security, RLS）扩展，用于实现数据访问范围的精细控制。它与 `@mtpc/rbac`（基于角色的访问控制）互补：

- **RBAC**: 控制用户**能做什么操作**（如：user:read、user:create）
- **Data-Scope**: 控制用户**能访问哪些数据**（如：只看本部门的数据）

### 1.2 核心功能

1. **数据范围定义**: 定义灵活的数据访问范围（如：全部、租户、部门、团队、个人）
2. **范围分配**: 将范围分配给资源、角色或主体
3. **范围解析**: 在运行时根据上下文解析适用的范围
4. **过滤器生成**: 将范围转换为数据库查询过滤条件
5. **层级支持**: 支持组织结构等层级关系的数据访问控制

### 1.3 设计目标

- **业务无关**: 不依赖具体的业务模型，通过配置实现数据范围控制
- **可组合性**: 多个范围可以组合使用，支持优先级控制
- **可扩展性**: 支持自定义范围类型和条件
- **高性能**: 内置缓存机制，减少重复计算

---

## 2. 核心概念

### 2.1 范围类型 (ScopeType)

```typescript
export type ScopeType =
  | 'all'           // 无限制（管理员）
  | 'tenant'        // 租户隔离
  | 'department'    // 同部门
  | 'team'          // 同团队
  | 'self'          // 仅个人数据
  | 'subordinates'  // 个人及下属
  | 'custom';       // 自定义条件
```

### 2.2 范围条件 (ScopeCondition)

```typescript
export interface ScopeCondition {
  field: string;              // 资源上要检查的字段名
  operator: ScopeConditionOperator;  // 比较操作符
  value: unknown | ScopeValueResolver;  // 静态值或解析函数
  contextField?: string;       // 可选：上下文中的字段路径
}
```

### 2.3 范围定义 (DataScopeDefinition)

```typescript
export interface DataScopeDefinition {
  id: string;                  // 唯一标识符
  name: string;                // 显示名称
  description?: string;         // 范围描述
  type: ScopeType;             // 范围类型
  conditions?: ScopeCondition[]; // 应用条件（仅 custom 类型需要）
  priority?: number;            // 优先级（数值越大越优先）
  combinable?: boolean;         // 是否可与其他范围组合
  metadata?: Record<string, unknown>; // 元数据
}
```

### 2.4 范围分配 (ScopeAssignment)

```typescript
export interface ScopeAssignment {
  id: string;                  // 分配记录的唯一 ID
  tenantId: string;           // 租户 ID
  scopeId: string;             // 范围定义 ID
  targetType: 'resource' | 'role' | 'subject'; // 目标类型
  targetId: string;           // 目标标识符
  permission?: string;         // 可选：此分配仅适用于特定权限
  priority?: number;           // 分配优先级
  enabled: boolean;            // 是否启用
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 3. 快速开始

### 3.1 安装依赖

```bash
pnpm add @mtpc/data-scope
```

### 3.2 方式一：声明式配置（推荐）

通过资源元数据声明式配置数据范围控制：

```typescript
import { createMTPC, defineResource } from '@mtpc/core';
import { createDataScopePlugin } from '@mtpc/data-scope';
import { z } from 'zod';

const mtpc = createMTPC();

// 注册资源，声明式配置数据范围
mtpc.registry.registerResource(
  defineResource({
    name: 'user',
    schema: z.object({
      id: z.string(),
      name: z.string(),
      departmentId: z.string(),
      tenantId: z.string(),
    }),
    metadata: {
      // 启用数据范围控制，按租户隔离
      dataScope: {
        enabled: true,
        defaultScope: 'tenant',
      },
    },
  })
);

mtpc.registry.registerResource(
  defineResource({
    name: 'order',
    schema: z.object({
      id: z.string(),
      userId: z.string(),
      departmentId: z.string(),
    }),
    metadata: {
      // 按部门隔离
      dataScope: {
        enabled: true,
        defaultScope: 'department',
        departmentField: 'departmentId',
      },
    },
  })
);

// 注册插件 - 会自动为所有启用的资源添加 filterQuery 钩子
mtpc.plugins.use(
  createDataScopePlugin({
    adminRoles: ['admin'],
    defaultScope: 'tenant',
  })
);

await mtpc.init();
```

### 3.3 方式二：手动集成

如果需要更精细的控制，可以使用 `DataScope` 类：

```typescript
import { createMTPC } from '@mtpc/core';
import { createDataScope } from '@mtpc/data-scope';

const mtpc = createMTPC();
const dataScope = createDataScope({
  defaultScope: 'tenant',
  adminRoles: ['admin'],
});

// 注册资源
mtpc.registry.registerResource(userResource);
mtpc.registry.registerResource(orderResource);

// 手动集成
dataScope.integrateWith(mtpc);
```

---

## 4. 范围定义

### 4.1 使用范围构建器

```typescript
import { scope } from '@mtpc/data-scope';

// 方式一：使用构建器
const customScope = scope('我的部门')
  .id('scope:my-department')
  .description('只能访问本部门的数据')
  .department()
  .priority(50)
  .build();
```

### 4.2 使用预设范围

```typescript
import { createScope } from '@mtpc/data-scope';

// 方式二：使用预设
const selfScope = createScope.self('个人数据', 'createdBy');
const tenantScope = createScope.all('全部数据');
const departmentScope = createScope.department('部门数据', 'departmentId', 'subject.metadata.departmentId');
const teamScope = createScope.team('团队数据', 'teamId', 'subject.metadata.teamId');
```

> **注意**: `createScope` 对象的方法（如 `createScope.self()`、`createScope.department()`）返回的是预定义的范围定义（`SCOPE_SELF`、`SCOPE_DEPARTMENT` 等），而不是动态创建新范围。这些方法主要用于快速引用预定义范围。

### 4.3 自定义范围

```typescript
import { scope } from '@mtpc/data-scope';

// 创建自定义条件范围
const customScope = scope('我的项目')
  .id('scope:my-projects')
  .description('只能访问我参与的项目')
  .type('custom')
  .where('projectId', 'in', async (ctx) => {
    // 动态解析：从数据库获取用户参与的项目
    const projects = await db.projectMember.findMany({
      where: { userId: ctx.subject.id },
    });
    return projects.map(p => p.projectId);
  })
  .priority(50)
  .build();
```

### 4.4 预定义范围

源码中预定义了以下范围：

| 范围 ID | 名称 | 类型 | 优先级 | 描述 |
|---------|------|------|--------|------|
| `scope:all` | All Access | `all` | 1000 | 无数据限制 - 可访问所有记录（独占） |
| `scope:tenant` | Tenant | `tenant` | 100 | 同一租户内的访问记录 |
| `scope:self` | Self | `self` | 10 | 仅访问自己的记录 |
| `scope:department` | Department | `department` | 50 | 同一部门的访问记录 |
| `scope:team` | Team | `team` | 30 | 同一团队中的访问记录 |

> **注意**: 虽然 `ScopeType` 类型中定义了 `'subordinates'` 类型，但源码中未提供对应的预定义范围 `SCOPE_SUBORDINATES`。如需使用此类型，需要通过 `scope()` 构建器自定义范围。

### 4.5 范围优先级

范围按优先级降序排列，高优先级范围先被评估：

- **1000**: `scope:all`（最高优先级，独占）
- **100**: `scope:tenant`
- **50**: `scope:department`
- **30**: `scope:team`
- **10**: `scope:self`
- **0**: 自定义范围默认优先级

### 4.6 范围组合

```typescript
// 定义多个可组合的范围
const tenantScope = scope('租户').tenant().build();
const departmentScope = scope('部门').department().build();
const teamScope = scope('团队').team().build();

// 分配给用户
await dataScope.assignToSubject('tenant-123', 'user-456', 'scope:tenant');
await dataScope.assignToSubject('tenant-123', 'user-456', 'scope:department');
await dataScope.assignToSubject('tenant-123', 'user-456', 'scope:team');

// 解析时，所有范围会被组合（AND 逻辑）
const result = await dataScope.resolve(ctx, 'User');
// 结果包含所有三个范围的过滤条件
```

### 4.7 独占范围

```typescript
// 定义独占范围（不可与其他范围组合）
const adminScope = scope('管理员')
  .all()
  .exclusive() // 设置为独占
  .priority(1000)
  .build();

// 当用户拥有独占范围时，只使用该范围
await dataScope.assignToRole('tenant-123', 'admin', adminScope.id);

// 解析时，即使有其他范围，也只返回 adminScope 的过滤器
const result = await dataScope.resolve(ctx, 'User');
// 结果: [] (空过滤器，无限制)
```

---

## 5. 范围分配

### 5.1 分配给资源

```typescript
// 将范围分配给特定资源
await dataScope.assignToResource(
  'tenant-123',        // 租户 ID
  'user',              // 资源名称
  'scope:department',   // 范围 ID
  { priority: 100 }    // 可选：优先级
);
```

### 5.2 分配给角色

```typescript
// 将范围分配给角色
await dataScope.assignToRole(
  'tenant-123',        // 租户 ID
  'manager',           // 角色名称
  'scope:department',  // 范围 ID
  { priority: 50 }     // 可选：优先级
);
```

### 5.3 分配给主体

```typescript
// 将范围分配给特定主体
await dataScope.assignToSubject(
  'tenant-123',        // 租户 ID
  'user-456',          // 主体 ID
  'scope:self',         // 范围 ID
  { priority: 10 }     // 可选：优先级
);
```

### 5.4 快速设置默认范围

```typescript
// 为不同角色设置默认范围
await dataScope.setupDefaultScopes('tenant-123', {
  admin: 'all',          // 管理员：无限制
  manager: 'department',  // 经理：本部门
  employee: 'self',       // 员工：仅个人
});

// 等价于：
await dataScope.assignToRole('tenant-123', 'admin', 'scope:all');
await dataScope.assignToRole('tenant-123', 'manager', 'scope:department');
await dataScope.assignToRole('tenant-123', 'employee', 'scope:self');
```

---

## 6. 范围解析

### 6.1 解析范围

```typescript
const result = await dataScope.resolve(ctx, 'User', 'read');

console.log('应用的范围:', result.appliedScopeIds);
console.log('解析的范围:', result.scopes.map(s => ({
  id: s.definition.id,
  name: s.definition.name,
  filters: s.filters,
})));
console.log('合并后的过滤器:', result.combinedFilters);
console.log('解析时间:', result.resolvedAt);
```

### 6.2 获取过滤器

```typescript
// 获取上下文和资源的过滤器
const filters = await dataScope.getFilters(ctx, 'User');

// 结果示例：
// [
//   { field: 'tenantId', operator: 'eq', value: 'tenant-123' },
//   { field: 'departmentId', operator: 'eq', value: 'dept-456' }
// ]
```

### 6.3 检查访问权限

```typescript
// 检查用户是否有无限制访问权限
const hasUnrestricted = await dataScope.hasUnrestrictedAccess(ctx);
if (hasUnrestricted) {
  // 跳过数据过滤
  return await db.user.findMany();
} else {
  // 应用数据范围过滤
  const filters = await dataScope.getFilters(ctx, 'User');
  return await db.user.findMany({ where: buildWhereClause(filters) });
}
```

### 6.4 获取有效范围类型

```typescript
// 获取主体的有效范围类型
const scopeType = await dataScope.getResolver().getEffectiveScopeType(ctx, 'User');
console.log(`用户的访问范围: ${scopeType}`); // 'department'
```

---

## 7. 过滤器生成

### 7.1 使用 FilterGenerator

```typescript
import { createFilterGenerator } from '@mtpc/data-scope';

const generator = createFilterGenerator(ctx);

// 为范围生成过滤器
const filters = await generator.forScope(scopeDefinition);

// 为多个范围生成过滤器
const allFilters = await generator.forScopes([scope1, scope2]);

// 生成租户过滤器
const tenantFilter = generator.tenantFilter();

// 生成所有者过滤器
const ownerFilter = generator.ownerFilter('createdBy');
```

### 7.2 使用条件预设

```typescript
import { filterPresets } from '@mtpc/data-scope';

// 按租户过滤
const tenantFilter = filterPresets.byTenant(ctx);

// 按所有者/创建者过滤
const ownerFilter = filterPresets.byOwner(ctx);

// 按部门过滤
const departmentFilter = filterPresets.byDepartment(ctx);

// 按团队过滤
const teamFilter = filterPresets.byTeam(ctx);
```

### 7.3 自定义条件

```typescript
import { staticCondition, contextCondition, metadataEquals } from '@mtpc/data-scope';

// 静态条件
const staticCond = staticCondition('status', 'eq', 'active');

// 基于上下文的条件
const contextCond = contextCondition(
  'departmentId',
  'eq',
  ctx => ctx.subject.metadata?.departmentId
);

// 元数据字段相等条件
const metadataCond = metadataEquals('departmentId', 'departmentId');
```

### 7.4 条件操作符

| 操作符 | 说明 | 示例 |
|--------|------|------|
| `eq` | 等于 | `{ field: 'status', operator: 'eq', value: 'active' }` |
| `neq` | 不等于 | `{ field: 'status', operator: 'neq', value: 'deleted' }` |
| `in` | 在数组中 | `{ field: 'id', operator: 'in', value: ['1', '2', '3'] }` |
| `notIn` | 不在数组中 | `{ field: 'status', operator: 'notIn', value: ['deleted', 'archived'] }` |
| `contains` | 数组包含 | `{ field: 'tags', operator: 'contains', value: 'important' }` |
| `hierarchy` | 层级关系 | `{ field: 'departmentId', operator: 'hierarchy', value: 'dept-1' }` |

---

## 8. 插件集成

### 8.1 创建插件

```typescript
import { createDataScopePlugin } from '@mtpc/data-scope';

const plugin = createDataScopePlugin({
  adminRoles: ['admin', 'superuser'],
  defaultScope: 'tenant',
  cacheTTL: 60000, // 60 秒
  checkWildcardPermission: true,
  hierarchyResolver: {
    async resolveRoot(rootId: string): Promise<string[]> {
      // 返回该部门及其所有子部门的 ID
      const descendants = await getDepartmentDescendants(rootId);
      return [rootId, ...descendants.map(d => d.id)];
    }
  }
});

// 注册插件
mtpc.plugins.use(plugin);

await mtpc.init();
```

### 8.2 插件生命周期

```typescript
const plugin = createDataScopePlugin({
  // ... 选项
});

// 插件生命周期：
// 1. install - 为当前已注册的资源添加钩子
// 2. onInit - 初始化时调用，输出日志
// 3. onDestroy - 销毁时调用，清理资源
```

### 8.3 资源元数据配置

```typescript
defineResource({
  name: 'user',
  schema: z.object({ id: z.string() }),
  metadata: {
    dataScope: {
      enabled: true,              // 是否启用（默认 true）
      defaultScope: 'tenant',     // 默认范围类型
      ownerField: 'createdBy',    // 所有者字段（默认 'createdBy'）
      departmentField: 'departmentId', // 部门字段（默认 'departmentId'）
      teamField: 'teamId',       // 团队字段（默认 'teamId'）
      adminBypass: false,        // 管理员是否可绕过（默认 false）
      customScopeId: 'scope:custom', // 自定义范围 ID
    }
  }
});
```

> **注意**: 在当前源码实现中，`adminBypass` 和 `customScopeId` 字段在 `plugin.ts` 中未被实际使用。这些字段保留用于未来扩展。

### 8.4 禁用资源的数据范围控制

```typescript
defineResource({
  name: 'publicResource',
  schema: z.object({ id: z.string() }),
  metadata: {
    dataScope: {
      enabled: false, // 禁用数据范围控制
    },
  },
});
```

---

## 9. 高级特性

### 9.1 层级解析器

用于处理组织结构等层级关系：

```typescript
import { createDataScope } from '@mtpc/data-scope';

// 定义层级解析器
const orgHierarchyResolver = {
  async resolveRoot(rootId: string): Promise<string[]> {
    // 模拟：从数据库获取所有子部门
    const children = await db.department.findMany({
      where: { path: { startsWith: `${rootId}.` } },
    });
    return [rootId, ...children.map(d => d.id)];
  },
};

const dataScope = createDataScope({
  hierarchyResolver: orgHierarchyResolver,
});

// 定义层级范围
await dataScope.defineScope({
  name: '部门及子部门',
  description: '可以访问本部门及所有子部门的数据',
  type: 'custom',
  conditions: [
    {
      field: 'departmentId',
      operator: 'hierarchy', // 使用层级操作符
      value: ctx => ctx.subject.metadata?.departmentId,
    },
  ],
});
```

### 9.2 动态范围值

```typescript
// 范围值可以是静态值或解析函数
const dynamicScope = await dataScope.defineScope({
  name: '我的项目',
  type: 'custom',
  conditions: [
    {
      field: 'projectId',
      operator: 'in',
      // 函数值：运行时动态解析
      value: async (ctx) => {
        // 从数据库获取用户参与的项目
        const projects = await db.projectMember.findMany({
          where: { userId: ctx.subject.id },
        });
        return projects.map(p => p.projectId);
      },
    },
  ],
});
```

### 9.3 上下文解析器

```typescript
import {
  contextResolvers,
  createAdminChecker,
  createMetadataResolver,
  createRoleChecker,
  createAnyRoleChecker,
  createAllRolesChecker
} from '@mtpc/data-scope';

// 使用内置解析器
const subjectId = contextResolvers.subjectId(ctx);
const tenantId = contextResolvers.tenantId(ctx);
const roles = contextResolvers.roles(ctx);
const permissions = contextResolvers.permissions(ctx);

// 创建管理员检查器
const isAdmin = createAdminChecker(['admin', 'superuser'], true);
if (isAdmin(ctx)) {
  // 是管理员
}

// 创建元数据解析器
const getDepartmentId = createMetadataResolver('departmentId');
const departmentId = getDepartmentId(ctx);

// 创建角色检查器
const isManager = createRoleChecker('manager');
const isAnyRole = createAnyRoleChecker(['admin', 'manager']);
const isAllRoles = createAllRolesChecker(['user', 'verified']);
```

### 9.4 管理员检测

管理员检测支持两种方式：

1. **角色检测**: 检查用户是否拥有指定的管理员角色（默认 `['admin']`）
2. **通配符权限**: 检查用户是否拥有 `*` 通配符权限

```typescript
const adminChecker = createAdminChecker(
  ['admin', 'superuser'],  // 管理员角色
  true                      // 检查通配符权限
);

if (adminChecker(ctx)) {
  // 用户是管理员或拥有通配符权限
}
```

### 9.5 缓存机制

```typescript
const dataScope = createDataScope({
  cacheTTL: 60000, // 60 秒缓存
});

// 清除缓存
dataScope.clearCache();
```

### 9.6 自定义存储

```typescript
import { DataScopeStore } from '@mtpc/data-scope';

class CustomDataScopeStore implements DataScopeStore {
  async createScope(scope: Omit<DataScopeDefinition, 'id'>): Promise<DataScopeDefinition> {
    // 实现创建逻辑
    return newScope;
  }

  async updateScope(id: string, updates: Partial<DataScopeDefinition>): Promise<DataScopeDefinition | null> {
    // 实现更新逻辑
    return updatedScope;
  }

  async deleteScope(id: string): Promise<boolean> {
    // 实现删除逻辑
    return true;
  }

  async getScope(id: string): Promise<DataScopeDefinition | null> {
    // 实现获取逻辑
    return scope;
  }

  async listScopes(): Promise<DataScopeDefinition[]> {
    // 实现列表逻辑
    return scopes;
  }

  async createAssignment(assignment: Omit<ScopeAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<ScopeAssignment> {
    // 实现创建分配逻辑
    return newAssignment;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    // 实现删除分配逻辑
    return true;
  }

  async getAssignmentsForTarget(tenantId: string, targetType: ScopeAssignment['targetType'], targetId: string): Promise<ScopeAssignment[]> {
    // 实现获取分配逻辑
    return assignments;
  }

  async getAssignmentsForResource(tenantId: string, resourceName: string): Promise<ScopeAssignment[]> {
    // 实现获取资源分配逻辑
    return assignments;
  }
}

const dataScope = createDataScope({
  store: new CustomDataScopeStore(),
});
```

---

## 10. 常见问题

### Q1: data-scope 与 rbac 有什么区别？

**A:**
- `@mtpc/rbac`: 控制用户**能做什么操作**（如：user:read、user:create）
- `@mtpc/data-scope`: 控制用户**能访问哪些数据**（如：只看本部门的数据）

两者结合使用：
```typescript
// RBAC: 检查是否有读取权限
const canRead = await mtpc.authorize(ctx, 'user', 'read');
if (!canRead) throw new Error('无权限');

// Data-Scope: 获取数据范围过滤
const filters = await dataScope.getFilters(ctx, 'User');
const users = await db.user.findMany({ where: buildWhereClause(filters) });
```

### Q2: 如何处理复杂的 OR 逻辑？

**A:** 当前版本通过多个范围分配实现类似效果，OR 逻辑需要在查询层处理：

```typescript
// 场景：用户可以访问自己的数据 OR 本团队的数据
await dataScope.assignToSubject('tenant-123', 'user-456', 'scope:self');
await dataScope.assignToSubject('tenant-123', 'user-456', 'scope:team');

const result = await dataScope.resolve(ctx, 'User');
// 需要在查询层使用 OR 逻辑组合结果中的过滤器
```

### Q3: 如何在生产环境部署？

**A:**
1. 实现自定义 `DataScopeStore`（如 Redis、数据库）
2. 配置合理的 `cacheTTL`
3. 监控范围解析性能
4. 记录范围应用日志用于审计

```typescript
import { Redis } from 'ioredis';

class RedisDataScopeStore implements DataScopeStore {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async createScope(scope: Omit<DataScopeDefinition, 'id'>): Promise<DataScopeDefinition> {
    const id = await this.redis.incr('scope:id');
    const newScope = { ...scope, id: `scope:${id}` };
    await this.redis.hset('scopes', newScope.id, JSON.stringify(newScope));
    return newScope;
  }

  // 实现其他方法...
}

const dataScope = createDataScope({
  store: new RedisDataScopeStore(redis),
  cacheTTL: 300000, // 5 分钟
});
```

### Q4: 如何调试范围解析？

**A:** 使用 `resolve` 方法获取详细信息：

```typescript
const result = await dataScope.resolve(ctx, 'User');

console.log('应用的范围:', result.appliedScopeIds);
console.log('解析的范围:', result.scopes.map(s => ({
  id: s.definition.id,
  name: s.definition.name,
  filters: s.filters,
})));
console.log('合并后的过滤器:', result.combinedFilters);
console.log('解析时间:', result.resolvedAt);
```

### Q5: 性能优化建议？

**A:**
1. **启用缓存**: 设置合理的 `cacheTTL`
2. **减少范围数量**: 只分配必要的范围
3. **使用预定义范围**: 避免重复创建相似范围
4. **优化层级解析**: 缓存层级关系
5. **监控性能**: 记录范围解析耗时

```typescript
const dataScope = createDataScope({
  cacheTTL: 300000, // 5 分钟缓存
  hierarchyResolver: new CachedHierarchyResolver(baseResolver),
});
```

### Q6: 声明式配置 vs 手动集成，如何选择？

**A:**
- **声明式配置（推荐）**: 使用资源元数据 `metadata.dataScope` 配置，插件自动处理
  - 适用于大多数场景
  - 代码更简洁，集成更方便

- **手动集成**: 使用 `DataScope` 类和 `integrateWith()` 方法
  - 适用于需要动态控制、运行时修改范围的场景
  - 提供更细粒度的控制

### Q7: 如何禁用某个资源的数据范围控制？

**A:** 在资源元数据中设置 `enabled: false`：

```typescript
defineResource({
  name: 'publicResource',
  schema: z.object({ id: z.string() }),
  metadata: {
    dataScope: {
      enabled: false, // 禁用数据范围控制
    },
  },
});
```

### Q8: 管理员如何绕过数据范围限制？

**A:** 管理员检测有两种方式：

1. **角色检测**: 拥有 `adminRoles` 中指定的角色
2. **通配符权限**: 拥有 `*` 权限

```typescript
const dataScope = createDataScope({
  adminRoles: ['admin', 'superuser'],
  checkWildcardPermission: true, // 启用通配符权限检查
});

// 管理员会自动获得无限制访问权限
```

---

## 11. 最佳实践

### 11.1 设计原则

1. **遵循最小权限原则**: 只授予必要的数据访问范围
2. **使用预定义范围**: 优先使用预定义范围，避免重复定义
3. **合理设置优先级**: 高优先级范围会覆盖低优先级范围
4. **利用独占范围**: 对于需要完全控制的场景，使用独占范围
5. **缓存优化**: 配置合理的缓存 TTL，平衡性能和数据一致性

### 11.2 代码组织

1. **集中管理范围定义**: 将所有范围定义放在单独的文件中
2. **按租户组织范围分配**: 不同租户使用不同的范围配置
3. **使用常量定义范围 ID**: 避免硬编码范围 ID
4. **为范围添加清晰的描述**: 便于理解和维护

```typescript
// scopes.ts
export const SCOPES = {
  ALL: 'scope:all',
  TENANT: 'scope:tenant',
  DEPARTMENT: 'scope:department',
  TEAM: 'scope:team',
  SELF: 'scope:self',
} as const;

// 使用
await dataScope.assignToRole(tenantId, 'admin', SCOPES.ALL);
```

### 11.3 性能优化

1. **启用缓存**: 设置合理的 `cacheTTL`（建议 1-5 分钟）
2. **减少范围数量**: 只分配必要的范围
3. **使用预定义范围**: 避免重复创建相似范围
4. **优化层级解析**: 缓存层级关系，避免重复查询
5. **监控性能**: 记录范围解析耗时，及时发现问题

### 11.4 安全实践

1. **始终验证租户上下文**: 确保租户有效性
2. **避免硬编码范围**: 使用配置或常量管理范围
3. **定期审查范围配置**: 清理不必要的范围
4. **记录范围应用日志**: 用于审计和调试
5. **限制管理员权限**: 严格控制拥有无限制访问权限的用户

### 11.5 错误处理

```typescript
try {
  const result = await dataScope.resolve(ctx, 'User');
  // 处理结果
} catch (error) {
  console.error('范围解析失败:', error);
  // 出错时返回空过滤器，不影响数据访问
  return [];
}
```

### 11.6 测试建议

1. **单元测试**: 测试范围定义和解析逻辑
2. **集成测试**: 测试与 MTPC 的集成
3. **性能测试**: 测试范围解析性能
4. **边界测试**: 测试各种边界情况

```typescript
describe('DataScope', () => {
  it('should resolve tenant scope', async () => {
    const result = await dataScope.resolve(ctx, 'User');
    expect(result.combinedFilters).toContainEqual({
      field: 'tenantId',
      operator: 'eq',
      value: ctx.tenant.id,
    });
  });

  it('should bypass for admin', async () => {
    const adminCtx = { ...ctx, subject: { ...ctx.subject, roles: ['admin'] } };
    const result = await dataScope.resolve(adminCtx, 'User');
    expect(result.combinedFilters).toEqual([]);
  });
});
```

---

## 附录

### A. 类型参考

#### DataScopeOptions

```typescript
interface DataScopeOptions {
  store?: DataScopeStore;                    // 自定义存储
  defaultScope?: ScopeType;                  // 默认范围类型
  ownerField?: string;                       // 所有者字段名
  departmentField?: string;                  // 部门字段名
  teamField?: string;                        // 团队字段名
  cacheEnabled?: boolean;                     // 是否启用缓存
  cacheTTL?: number;                         // 缓存 TTL（毫秒）
  adminRoles?: string[];                     // 管理员角色
  checkWildcardPermission?: boolean;         // 检查通配符权限
  hierarchyResolver?: HierarchyResolver;     // 层级解析器
}
```

#### ResourceDataScopeConfig

资源元数据中的数据范围配置：

```typescript
interface ResourceDataScopeConfig {
  enabled?: boolean;                         // 是否启用（默认 true）
  defaultScope?: ScopeType;                  // 默认范围类型
  ownerField?: string;                       // 所有者字段（默认 'createdBy'）
  departmentField?: string;                  // 部门字段（默认 'departmentId'）
  teamField?: string;                        // 团队字段（默认 'teamId'）
  adminBypass?: boolean;                     // 管理员是否可绕过（默认 false）
  customScopeId?: string;                    // 自定义范围 ID
}
```

#### ScopeResolutionResult

```typescript
interface ScopeResolutionResult {
  scopes: ResolvedScope[];           // 解析后的范围列表
  combinedFilters: FilterCondition[]; // 合并后的过滤条件
  appliedScopeIds: string[];         // 应用的范围 ID
  resolvedAt: Date;                  // 解析时间
}
```

### B. API 参考

#### DataScope 类

| 方法 | 说明 |
|------|------|
| `defineScope(definition)` | 定义新范围 |
| `getScope(id)` | 根据 ID 获取范围 |
| `assignToResource(tenantId, resourceName, scopeId, options?)` | 将范围分配给资源 |
| `assignToRole(tenantId, roleName, scopeId, options?)` | 将范围分配给角色 |
| `assignToSubject(tenantId, subjectId, scopeId, options?)` | 将范围分配给主体 |
| `resolve(ctx, resourceName, action?, existingFilters?)` | 解析上下文的范围 |
| `getFilters(ctx, resourceName, existingFilters?)` | 获取上下文和资源的过滤器 |
| `hasUnrestrictedAccess(ctx)` | 检查主体是否有无限制访问权限 |
| `setupDefaultScopes(tenantId, roleScopes)` | 快速设置：将预定义范围分配给角色 |
| `integrateWith(mtpc)` | 与 MTPC 集成 |
| `clearCache()` | 清除缓存 |
| `getRegistry()` | 获取注册表 |
| `getResolver()` | 获取解析器 |

#### 插件 API

| 方法 | 说明 |
|------|------|
| `createDataScopePlugin(options)` | 创建数据范围插件 |

---

**文档版本**: 1.0.0  
**最后更新**: 2024-12-27  
**基于源码版本**: @mtpc/data-scope@0.1.0
