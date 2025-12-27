# @mtpc/helper 技术分析文档

## 目录

1. [概述](#1-概述)
2. [模块架构](#2-模块架构)
3. [源码实现分析](#3-源码实现分析)
4. [与 README.md 的差异分析](#4-与-readmemd-的差异分析)
5. [API 接口详解](#5-api-接口详解)
6. [类型系统分析](#6-类型系统分析)
7. [实现细节与最佳实践](#7-实现细节与最佳实践)

---

## 1. 概述

### 1.1 包定位

`@mtpc/helper` 是 MTPC 生态系统的轻量级工具包，提供便捷的 API 和常用权限模式。该包作为核心包的补充，通过提供预构建的权限模式、策略创建助手和资源定义快捷方式，显著简化了权限系统的开发复杂度。

### 1.2 设计原则

1. **轻量级**: 不包含复杂的企业级功能，专注于提供常用模式
2. **基于核心**: 依赖 `@mtpc/core` 的功能，无法独立运行
3. **预设模式**: 主要提供常见模式，特殊需求需要自定义扩展
4. **类型安全**: 完整的 TypeScript 类型支持
5. **易于使用**: 提供简洁的 API，降低学习曲线

### 1.3 依赖关系

```
@mtpc/core (核心引擎)
    ↓ 类型定义和接口
@mtpc/helper (工具包)
    ↑ 扩展和增强功能
@mtpc/shared (共享工具)
    ↓ 通用工具函数
```

**核心依赖**:
- `@mtpc/core`: 提供核心类型定义、策略引擎、权限检查器
- `@mtpc/shared`: 提供 `getByPath` 等工具函数
- `zod`: 提供运行时类型验证

---

## 2. 模块架构

### 2.1 模块结构

```
packages/helper/src/
├── index.ts              # 统一导出入口
├── abac.ts              # ABAC (基于属性的访问控制) 模块
├── acl.ts               # ACL (访问控制列表) 模块
├── env.ts               # ENV (环境条件) 模块
├── policy-helper.ts      # Policy (策略助手) 模块
├── resource-helper.ts   # Resource (资源助手) 模块
└── time.ts              # Time (时间条件) 模块
```

### 2.2 模块职责

| 模块 | 职责 | 主要功能 |
|------|------|----------|
| `abac` | 基于属性的访问控制 | 属性比较、资源所有权、组织架构条件 |
| `acl` | 访问控制列表转换 | ACL 配置定义、策略转换 |
| `env` | 环境相关条件检查 | IP 地址验证、User-Agent 检查 |
| `policy` | 策略创建助手 | 允许/拒绝策略、基于角色的权限 |
| `resource` | 资源定义助手 | CRUD 资源快速创建 |
| `time` | 时间相关条件检查 | 工作时间、日期范围、工作日限制 |

### 2.3 导出结构

```typescript
export * as abac from './abac.js';
export * as acl from './acl.js';
export * as env from './env.js';
export * as policy from './policy-helper.js';
export * as resource from './resource-helper.js';
export * as time from './time.js';
```

---

## 3. 源码实现分析

### 3.1 ABAC 模块 (`abac.ts`)

#### 3.1.1 核心类型

```typescript
export interface ABACPolicyConfig {
  name?: string;
  description?: string;
  tenantId?: string;
  permissions: string[];
  conditions: PolicyCondition[];
  priority?: PolicyPriority;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}
```

#### 3.1.2 内部实现

**`customCondition` 函数** (内部函数，未导出):

```typescript
function customCondition(
  fn: (ctx: PolicyEvaluationContext) => boolean | Promise<boolean>,
  description?: string
): PolicyCondition {
  return {
    type: 'custom',
    fn,
    metadata: { description },
  } as PolicyCondition;
}
```

**实现特点**:
- 所有公开的条件函数都基于 `customCondition` 实现
- 支持同步和异步条件函数
- 自动添加描述信息用于调试
- 使用类型断言 `as PolicyCondition` 确保类型兼容

#### 3.1.3 公开 API

**`attrEquals(resourceField, contextPath)`**:

```typescript
export function attrEquals(resourceField: string, contextPath: string): PolicyCondition {
  return customCondition(ctx => {
    const resource = (ctx.resource ?? {}) as Record<string, unknown>;
    const left = resource[resourceField];
    const right = getByPath(ctx as unknown as Record<string, unknown>, contextPath);
    return left === right;
  }, `resource.${resourceField} === ctx.${contextPath}`);
}
```

**实现细节**:
- 使用 `getByPath` 从上下文中获取嵌套值
- 使用空对象作为默认值避免 `undefined` 错误
- 生成描述信息用于调试

**`attrIn(resourceField, contextPath)`**:

```typescript
export function attrIn(resourceField: string, contextPath: string): PolicyCondition {
  return customCondition(ctx => {
    const resource = (ctx.resource ?? {}) as Record<string, unknown>;
    const left = resource[resourceField];
    const arr = getByPath(ctx as unknown as Record<string, unknown>, contextPath);
    return Array.isArray(arr) && arr.includes(left);
  }, `resource.${resourceField} in ctx.${contextPath}`);
}
```

**实现细节**:
- 检查目标值是否为数组
- 使用 `includes` 方法检查包含关系
- 安全的类型检查

**`ownResource(ownerField)`**:

```typescript
export function ownResource(ownerField: string = 'createdBy'): PolicyCondition {
  return customCondition(ctx => {
    const resource = (ctx.resource ?? {}) as Record<string, unknown>;
    const owner = resource[ownerField];
    return owner === ctx.subject.id;
  }, `resource.${ownerField} === ctx.subject.id`);
}
```

**实现细节**:
- 默认使用 `createdBy` 字段
- 直接比较资源所有者与当前主体 ID
- 简洁的所有权检查

**`sameDepartment(resourceField, contextPath)`**:

```typescript
export function sameDepartment(
  resourceField: string = 'departmentId',
  contextPath: string = 'subject.metadata.departmentId'
): PolicyCondition {
  return attrEquals(resourceField, contextPath);
}
```

**实现细节**:
- 使用默认参数而非可选参数
- 基于默认值调用 `attrEquals`
- 提供语义化的部门检查

**`sameTeam(resourceField, contextPath)`**:

```typescript
export function sameTeam(
  resourceField: string = 'teamId',
  contextPath: string = 'subject.metadata.teamId'
): PolicyCondition {
  return attrEquals(resourceField, contextPath);
}
```

**实现细节**:
- 与 `sameDepartment` 实现相同
- 提供语义化的团队检查

**`policy(id, config)`**:

```typescript
export function policy(id: string, config: ABACPolicyConfig): PolicyDefinition {
  const rule: PolicyRule = {
    permissions: config.permissions,
    effect: 'allow',
    conditions: config.conditions,
    priority: config.priority,
    description: config.description,
  };

  return {
    id,
    name: config.name ?? id,
    description: config.description,
    rules: [rule],
    priority: config.priority ?? 'normal',
    enabled: config.enabled ?? true,
    tenantId: config.tenantId,
    metadata: config.metadata,
  };
}
```

**实现细节**:
- 只创建单个规则
- 默认效果为 `allow`
- 默认优先级为 `normal`
- 默认启用策略

---

### 3.2 ACL 模块 (`acl.ts`)

#### 3.2.1 核心类型

```typescript
export interface PrincipalRef {
  subjectId?: string;
  role?: string;
}

export interface ACLEntry {
  resource: string;
  action: string;
  allow?: PrincipalRef[];
  deny?: PrincipalRef[];
}

export interface ACLConfig {
  id: string;
  tenantId?: string;
  entries: ACLEntry[];
  description?: string;
  priority?: PolicyPriority;
}
```

#### 3.2.2 内部实现

**`matchesPrincipal(ctx, principal)`** (内部函数):

```typescript
function matchesPrincipal(ctx: PolicyEvaluationContext, principal: PrincipalRef): boolean {
  if (principal.subjectId && ctx.subject.id === principal.subjectId) {
    return true;
  }
  if (principal.role && ctx.subject.roles?.includes(principal.role)) {
    return true;
  }
  return false;
}
```

**实现细节**:
- 优先检查主体 ID 匹配
- 其次检查角色匹配
- 使用可选链 `?.` 安全访问 `roles`

**`principalCondition(principals)`** (内部函数):

```typescript
function principalCondition(principals: PrincipalRef[]): PolicyCondition {
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => principals.some(p => matchesPrincipal(ctx, p)),
  } as PolicyCondition;
}
```

**实现细节**:
- 使用 `some` 方法检查任意主体匹配
- 创建异步条件函数
- 返回自定义条件类型

#### 3.2.3 公开 API

**`toPolicies(config)`**:

```typescript
export function toPolicies(config: ACLConfig): PolicyDefinition[] {
  const policies: PolicyDefinition[] = [];

  for (const entry of config.entries) {
    const rules: PolicyRule[] = [];
    const permission = `${entry.resource}:${entry.action}`;

    if (entry.deny && entry.deny.length > 0) {
      rules.push({
        permissions: [permission],
        effect: 'deny',
        conditions: [principalCondition(entry.deny)],
        priority: 'high',
        description: 'ACL deny rule',
      });
    }

    if (entry.allow && entry.allow.length > 0) {
      rules.push({
        permissions: [permission],
        effect: 'allow',
        conditions: [principalCondition(entry.allow)],
        priority: 'normal',
        description: 'ACL allow rule',
      });
    }

    if (rules.length === 0) continue;

    const policy: PolicyDefinition = {
      id: `${config.id}::${entry.resource}::${entry.action}`,
      name: `ACL for ${entry.resource}:${entry.action}`,
      description: config.description,
      rules,
      priority: config.priority ?? 'normal',
      enabled: true,
      tenantId: config.tenantId,
      metadata: {
        acl: true,
      },
    };

    policies.push(policy);
  }

  return policies;
}
```

**实现细节**:
- 为每个 ACL 条目生成独立的策略
- 拒绝规则优先级高于允许规则
- 策略 ID 格式为 `{config.id}::{resource}::{action}`
- 跳过没有规则的条目
- 添加 `acl: true` 元数据标识

---

### 3.3 ENV 模块 (`env.ts`)

#### 3.3.1 内部实现

**`matchIp(ip, pattern)`** (内部函数):

```typescript
function matchIp(ip: string, pattern: string): boolean {
  if (ip === pattern) return true;

  // 简单 CIDR: "192.168.0." 前缀匹配
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -1); // 保留最后一个点
    return ip.startsWith(prefix);
  }

  // 通用 * 替换为任意数字段
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '\\d+') + '$');
    return regex.test(ip);
  }

  return false;
}
```

**实现细节**:
- 支持精确匹配
- 支持前缀匹配 (如 `192.168.1.*`)
- 支持通配符匹配 (如 `192.168.*.*`)
- 使用正则表达式实现通配符匹配

#### 3.3.2 公开 API

**`ipIn(whitelist)`**:

```typescript
export function ipIn(whitelist: string[]): PolicyCondition {
  const list = [...whitelist];
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      const ip = ctx.request.ip;
      if (!ip) return false;
      return list.some(p => matchIp(ip, p));
    },
  } as PolicyCondition;
}
```

**实现细节**:
- 复制白名单数组避免外部修改
- 从 `ctx.request.ip` 获取 IP 地址
- 没有IP 时返回 false
- 检查 IP 是否在白名单中

**`ipNotIn(blacklist)`**:

```typescript
export function ipNotIn(blacklist: string[]): PolicyCondition {
  const list = [...blacklist];
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      const ip = ctx.request.ip;
      if (!ip) return true; // 没 IP 就不拦
      return !list.some(p => matchIp(ip, p));
    },
  } as PolicyCondition;
}
```

**实现细节**:
- 复制黑名单数组避免外部修改
- 从 `ctx.request.ip` 获取 IP 地址
- 没有IP 时返回 true (不拦截)
- 检查 IP 是否不在黑名单中

**`userAgentContains(substring)`**:

```typescript
export function userAgentContains(substring: string): PolicyCondition {
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      const ua = ctx.request.userAgent ?? '';
      return ua.includes(substring);
    },
  } as PolicyCondition;
}
```

**实现细节**:
- 从 `ctx.request.userAgent` 获取 User-Agent
- 使用空字符串作为默认值
- 检查是否包含指定子串

**`userAgentMatches(pattern)`**:

```typescript
export function userAgentMatches(pattern: RegExp): PolicyCondition {
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      const ua = ctx.request.userAgent ?? '';
      return pattern.test(ua);
    },
  } as PolicyCondition;
}
```

**实现细节**:
- 接受正则表达式作为参数
- 从 `ctx.request.userAgent` 获取 User-Agent
- 使用空字符串作为默认值
- 执行正则匹配

---

### 3.4 Policy Helper 模块 (`policy-helper.ts`)

#### 3.4.1 公开 API

**`allow(id, permissions, options)`**:

```typescript
export function allow(
  id: string,
  permissions: string[],
  options: {
    tenantId?: string;
    priority?: PolicyPriority;
    description?: string;
    metadata?: Record<string, unknown>;
  } = {}
): PolicyDefinition {
  const rule: PolicyRule = {
    permissions,
    effect: 'allow',
    description: options.description,
  };

  return {
    id,
    name: id,
    description: options.description,
    rules: [rule],
    priority: options.priority ?? 'normal',
    enabled: true,
    tenantId: options.tenantId,
    metadata: options.metadata,
  };
}
```

**实现细节**:
- 默认优先级为 `normal`
- 默认启用策略
- 名称与 ID 相同
- 只创建单个规则

**`deny(id, permissions, options)`**:

```typescript
export function deny(
  id: string,
  permissions: string[],
  options: {
    tenantId?: string;
    priority?: PolicyPriority;
    description?: string;
    metadata?: Record<string, unknown>;
  } = {}
): PolicyDefinition {
  const rule: PolicyRule = {
    permissions,
    effect: 'deny',
    description: options.description,
  };

  return {
    id,
    name: id,
    description: options.description,
    rules: [rule],
    priority: options.priority ?? 'high', // deny 默认高优先级
    enabled: true,
    tenantId: options.tenantId,
    metadata: options.metadata,
  };
}
```

**实现细节**:
- 默认优先级为 `high` (拒绝策略优先级更高)
- 默认启用策略
- 名称与 ID 相同
- 只创建单个规则

**`allowForRoles(id, permissions, roles, options)`**:

```typescript
export function allowForRoles(
  id: string,
  permissions: string[],
  roles: string[],
  options: {
    tenantId?: string;
    priority?: PolicyPriority;
    description?: string;
    metadata?: Record<string, unknown>;
  } = {}
): PolicyDefinition {
  const condition: PolicyCondition = {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => roles.some(r => ctx.subject.roles?.includes(r)),
  } as PolicyCondition;

  const rule: PolicyRule = {
    permissions,
    effect: 'allow',
    conditions: [condition],
    description: options.description ?? `Allowed roles: ${roles.join(', ')}`,
  };

  return {
    id,
    name: id,
    description: options.description,
    rules: [rule],
    priority: options.priority ?? 'normal',
    enabled: true,
    tenantId: options.tenantId,
    metadata: {
      ...options.metadata,
      roles,
    },
  };
}
```

**实现细节**:
- 创建自定义条件检查角色
- 使用 `some` 方法检查任意角色匹配
- 默认描述为角色列表
- 将角色添加到元数据中

---

### 3.5 Resource Helper 模块 (`resource-helper.ts`)

#### 3.5.1 核心类型

```typescript
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
```

#### 3.5.2 公开 API

**`crud(options)`**:

```typescript
export function crud(options: CrudResourceOptions): ResourceDefinition {
  const { name, schema, enable, withCrudPermissions = true, metadata } = options;

  const enabled = {
    create: enable?.create ?? true,
    read: enable?.read ?? true,
    update: enable?.update ?? true,
    delete: enable?.delete ?? true,
    list: enable?.list ?? true,
  };

  const permissions: PermissionDefinition[] = [];
  if (withCrudPermissions) {
    if (enabled.create) permissions.push({ action: 'create' });
    if (enabled.read) permissions.push({ action: 'read' });
    if (enabled.update) permissions.push({ action: 'update' });
    if (enabled.delete) permissions.push({ action: 'delete' });
    if (enabled.list) permissions.push({ action: 'list' });
  }

  const features: Partial<ResourceFeatures> = {
    create: enabled.create,
    read: enabled.read,
    update: enabled.update,
    delete: enabled.delete,
    list: enabled.list,
  };

  return defineResource({
    name,
    schema,
    permissions,
    features,
    metadata,
  });
}
```

**实现细节**:
- 默认启用所有 CRUD 操作
- 根据 `withCrudPermissions` 决定是否生成权限
- 只为启用的操作生成权限
- 使用 `defineResource` 创建资源定义

---

### 3.6 Time 模块 (`time.ts`)

#### 3.6.1 公开 API

**`withinHours(startHour, endHour)`**:

```typescript
export function withinHours(startHour: number, endHour: number): PolicyCondition {
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      const now = ctx.request.timestamp ?? new Date();
      const hour = now.getHours();
      // [start, end)
      return hour >= startHour && hour < endHour;
    },
  } as PolicyCondition;
}
```

**实现细节**:
- 使用 `ctx.request.timestamp` 或当前时间
- 获取当前小时数
- 实现左闭右开区间 `[start, end)`
- 例如 `withinHours(9, 18)` 允许 9:00-17:59

**`betweenDates(from, to)`**:

```typescript
export function betweenDates(from: Date, to: Date): PolicyCondition {
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      const now = ctx.request.timestamp ?? new Date();
      return now >= from && now <= to;
    },
  } as PolicyCondition;
}
```

**实现细节**:
- 使用 `ctx.request.timestamp` 或当前时间
- 实现闭区间 `[from, to]`
- 包含起始和结束日期

**`weekdaysOnly()`**:

```typescript
export function weekdaysOnly(): PolicyCondition {
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      const now = ctx.request.timestamp ?? new Date();
      const day = now.getDay(); // 0=Sunday, 1=Monday...
      return day >= 1 && day <= 5;
    },
  } as PolicyCondition;
}
```

**实现细节**:
- 使用 `ctx.request.timestamp` 或当前时间
- `getDay()` 返回 0-6 (0=Sunday, 1=Monday, ..., 6=Saturday)
- 只允许周一到周五 (1-5)

---

## 4. 与 README.md 的差异分析

### 4.1 ABAC 模块差异

| 项目 | README.md 描述 | 源码实际实现 | 差异说明 |
|------|----------------|--------------|----------|
| `ownResource` 参数 | `ownerField?: string` (可选参数) | `ownerField: string = 'createdBy'` (默认参数) | 参数定义方式不同，但功能一致 |
| `sameDepartment` 参数 | `resourceField?: string, contextPath?: string` (可选参数) | `resourceField: string = 'departmentId', contextPath: string = 'subject.metadata.departmentId'` (默认参数) | 参数定义方式不同，但功能一致 |
| `sameTeam` 参数 | `resourceField?: string, contextPath?: string` (可选参数) | `resourceField: string = 'teamId', contextPath: string = 'subject.metadata.teamId'` (默认参数) | 参数定义方式不同，但功能一致 |
| `customCondition` | 未提及 | 内部实现函数 | 这是内部实现细节，未导出 |

### 4.2 ACL 模块差异

| 项目 | README.md 描述 | 源码实际实现 | 差异说明 |
|------|----------------|--------------|----------|
| 策略 ID 格式 | 未明确说明 | `${config.id}::${entry.resource}::${entry.action}` | 源码有明确的 ID 生成规则 |
| `matchesPrincipal` | 未提及 | 内部实现函数 | 这是内部实现细节，未导出 |
| `principalCondition` | 未提及 | 内部实现函数 | 这是内部实现细节，未导出 |

### 4.3 ENV 模块差异

| 项目 | README.md 描述 | 源码实际实现 | 差异说明 |
|------|----------------|--------------|----------|
| `matchIp` | 未提及 | 内部实现函数 | 这是内部实现细节，未导出 |
| IP 匹配规则 | 未详细说明 | 支持精确匹配、前缀匹配、通配符匹配 | 源码有更详细的匹配规则 |

### 4.4 Policy Helper 模块差异

| 项目 | README.md 描述 | 源码实际实现 | 差异说明 |
|------|----------------|--------------|----------|
| `allow` 默认优先级 | 未明确说明 | `'normal'` | 源码有明确的默认值 |
| `deny` 默认优先级 | 未明确说明 | `'high'` | 源码有明确的默认值 |
| `allowForRoles` 默认描述 | 未明确说明 | ``Allowed roles: ${roles.join(', ')}``` | 源码有明确的默认描述 |

### 4.5 Resource Helper 模块差异

| 项目 | README.md 描述 | 源码实际实现 | 差异说明 |
|------|----------------|--------------|----------|
| `enable` 默认值 | 未明确说明 | 所有操作默认为 `true` | 源码有明确的默认值 |
| `withCrudPermissions` 默认值 | 未明确说明 | `true` | 源码有明确的默认值 |

### 4.6 Time 模块差异

| 项目 | README.md 描述 | 源码实际实现 | 差异说明 |
|------|----------------|--------------|----------|
| 时间获取方式 | 未明确说明 | `ctx.request.timestamp ?? new Date()` | 源码有明确的时间获取逻辑 |
| `withinHours` 区间 | 未明确说明 | `[start, end)` 左闭右开 | 源码有明确的区间定义 |
| `betweenDates` 区间 | 未明确说明 | `[from, to]` 闭区间 | 源码有明确的区间定义 |

---

## 5. API 接口详解

### 5.1 ABAC 模块 API

#### 5.1.1 `attrEquals(resourceField, contextPath)`

**参数**:
- `resourceField: string` - 资源字段路径
- `contextPath: string` - 上下文路径

**返回值**:
- `PolicyCondition` - 策略条件对象

**实现逻辑**:
```typescript
1. 从资源中获取 resourceField 的值
2. 从上下文中获取 contextPath 的值（使用 getByPath）
3. 比较两个值是否相等
```

**使用示例**:
```typescript
import { abac } from '@mtpc/helper';

// 检查资源的 departmentId 是否等于主体的 departmentId
const condition = abac.attrEquals('departmentId', 'subject.metadata.departmentId');
```

#### 5.1.2 `attrIn(resourceField, contextPath)`

**参数**:
- `resourceField: string` - 资源字段路径
- `contextPath: string` - 上下文路径

**返回值**:
- `PolicyCondition` - 策略条件对象

**实现逻辑**:
```typescript
1. 从资源中获取 resourceField 的值
2. 从上下文中获取 contextPath 的值（使用 getByPath）
3. 检查上下文值是否为数组
4. 检查资源值是否在数组中
```

**使用示例**:
```typescript
// 检查资源的 status 是否在主体的 allowedStatuses 中
const condition = abac.attrIn('status', 'subject.metadata.allowedStatuses');
```

#### 5.1.3 `ownResource(ownerField)`

**参数**:
- `ownerField: string = 'createdBy'` - 资源所有者字段路径，默认为 'createdBy'

**返回值**:
- `PolicyCondition` - 策略条件对象

**实现逻辑**:
```typescript
1. 从资源中获取 ownerField 的值
2. 比较资源所有者与当前主体 ID
3. 返回比较结果
```

**使用示例**:
```typescript
// 使用默认字段 'createdBy'
const condition1 = abac.ownResource();

// 使用自定义字段 'authorId'
const condition2 = abac.ownResource('authorId');
```

#### 5.1.4 `sameDepartment(resourceField, contextPath)`

**参数**:
- `resourceField: string = 'departmentId'` - 资源部门字段路径
- `contextPath: string = 'subject.metadata.departmentId'` - 上下文部门路径

**返回值**:
- `PolicyCondition` - 策略条件对象

**实现逻辑**:
```typescript
1. 调用 attrEquals(resourceField, contextPath)
2. 返回属性相等条件
```

**使用示例**:
```typescript
// 使用默认字段
const condition1 = abac.sameDepartment();

// 使用自定义字段
const condition2 = abac.sameDepartment('deptId', 'subject.attributes.deptId');
```

#### 5.1.5 `sameTeam(resourceField, contextPath)`

**参数**:
- `resourceField: string = 'teamId'` - 资源团队字段路径
- `contextPath: string = 'subject.metadata.teamId'` - 上下文团队路径

**返回值**:
- `PolicyCondition` - 策略条件对象

**实现逻辑**:
```typescript
1. 调用 attrEquals(resourceField, contextPath)
2. 返回属性相等条件
```

**使用示例**:
```typescript
// 使用默认字段
const condition1 = abac.sameTeam();

// 使用自定义字段
const condition2 = abac.sameTeam('groupId', 'subject.attributes.groupId');
```

#### 5.1.6 `policy(id, config)`

**参数**:
- `id: string` - 策略 ID
- `config: ABACPolicyConfig` - ABAC 策略配置

**返回值**:
- `PolicyDefinition` - 策略定义对象

**实现逻辑**:
```typescript
1. 创建单个规则，效果为 allow
2. 创建策略定义，包含规则
3. 设置默认值：name=id, priority=normal, enabled=true
```

**使用示例**:
```typescript
const policy = abac.policy('user-own-article', {
  permissions: ['article:update', 'article:delete'],
  conditions: [
    abac.ownResource('authorId')
  ],
  description: '用户只能编辑自己的文章',
  priority: 'high'
});
```

---

### 5.2 ACL 模块 API

#### 5.2.1 `toPolicies(config)`

**参数**:
- `config: ACLConfig` - ACL 配置对象

**返回值**:
- `PolicyDefinition[]` - 策略定义数组

**实现逻辑**:
```typescript
1. 遍历每个 ACL 条目
2. 为每个条目生成 permission 字符串
3. 如果有 deny 列表，创建 deny 规则（优先级 high）
4. 如果有 allow 列表，创建 allow 规则（优先级 normal）
5. 生成策略 ID: {config.id}::{resource}::{action}
6. 跳过没有规则的条目
7. 返回所有策略
```

**使用示例**:
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
        { subjectId: 'user-123' }
      ],
      deny: [
        { subjectId: 'user-bad' }
      ]
    }
  ],
  description: '文档访问控制列表'
};

const policies = acl.toPolicies(aclConfig);
// 返回: PolicyDefinition[]
```

---

### 5.3 ENV 模块 API

#### 5.3.1 `ipIn(whitelist)`

**参数**:
- `whitelist: string[]` - IP 白名单数组

**返回值**:
- `PolicyCondition` - 策略条件对象

**实现逻辑**:
```typescript
1. 复制白名单数组
2. 从 ctx.request.ip 获取 IP 地址
3. 如果没有 IP，返回 false
4. 检查 IP 是否匹配白名单中的任意模式
```

**IP 匹配规则**:
- 精确匹配: `192.168.1.100`
- 前缀匹配: `192.168.1.*`
- 通配符匹配: `192.168.*.*`

**使用示例**:
```typescript
import { env } from '@mtpc/helper';

const condition = env.ipIn(['192.168.1.*', '10.0.0.*']);
```

#### 5.3.2 `ipNotIn(blacklist)`

**参数**:
- `blacklist: string[]` - IP 黑名单数组

**返回值**:
- `PolicyCondition` - 策略条件对象

**实现逻辑**:
```typescript
1. 复制黑名单数组
2. 从 ctx.request.ip 获取 IP 地址
3. 如果没有 IP，返回 true（不拦截）
4. 检查 IP 是否不匹配黑名单中的任意模式
```

**使用示例**:
```typescript
const condition = env.ipNotIn(['192.168.1.100', '10.0.0.50']);
```

#### 5.3.3 `userAgentContains(substring)`

**参数**:
- `substring: string` - User-Agent 子串

**返回值**:
- `PolicyCondition` - 策略条件对象

**实现逻辑**:
```typescript
1. 从 ctx.request.userAgent 获取 User-Agent
2. 如果没有 User-Agent，使用空字符串
3. 检查 User-Agent 是否包含指定子串
```

**使用示例**:
```typescript
const condition = env.userAgentContains('Mobile');
```

#### 5.3.4 `userAgentMatches(pattern)`

**参数**:
- `pattern: RegExp` - 正则表达式模式

**返回值**:
- `PolicyCondition` - 策略条件对象

**实现逻辑**:
```typescript
1. 从 ctx.request.userAgent 获取 User-Agent
2. 如果没有 User-Agent，使用空字符串
3. 执行正则表达式匹配
```

**使用示例**:
```typescript
const condition = env.userAgentMatches(/Chrome\/\d+/);
```

---

### 5.4 Policy Helper 模块 API

#### 5.4.1 `allow(id, permissions, options)`

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

**使用示例**:
```typescript
import { policy } from '@mtpc/helper';

const allowPolicy = policy.allow('admin-all-access', ['*'], {
  tenantId: 'tenant-1',
  description: '管理员拥有所有权限',
  priority: 'critical'
});
```

#### 5.4.2 `deny(id, permissions, options)`

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

**使用示例**:
```typescript
const denyPolicy = policy.deny('user-no-delete', ['user:delete'], {
  tenantId: 'tenant-1',
  description: '普通用户不能删除用户',
  priority: 'high'
});
```

#### 5.4.3 `allowForRoles(id, permissions, roles, options)`

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

**使用示例**:
```typescript
const rolePolicy = policy.allowForRoles('manager-permissions', [
  'user:read', 'user:update', 'order:*'
], ['manager'], {
  description: '经理角色权限',
  metadata: { level: 'management' }
});
```

---

### 5.5 Resource Helper 模块 API

#### 5.5.1 `crud(options)`

**参数**:
- `options: CrudResourceOptions` - CRUD 资源配置
  - `name: string` - 资源名称
  - `schema: AnyZodSchema` - 资源 Schema
  - `enable?: object` - 启用配置
    - `create?: boolean` - 是否启用创建
    - `read?: boolean` - 是否启用读取
    - `update?: boolean` - 是否启用更新
    - `delete?: boolean` - 是否启用删除
    - `list?: boolean` - 是否启用列表
  - `withCrudPermissions?: boolean` - 是否自动生成 CRUD 权限
  - `metadata?: object` - 资源元数据
    - `displayName?: string` - 显示名称
    - `pluralName?: string` - 复数名称
    - `description?: string` - 描述
    - `group?: string` - 分组
    - `icon?: string` - 图标

**返回值**:
- `ResourceDefinition` - 资源定义对象

**默认值**:
- 所有 `enable` 操作默认为 `true`
- `withCrudPermissions` 默认为 `true`

**使用示例**:
```typescript
import { resource } from '@mtpc/helper';
import { z } from 'zod';

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
```

---

### 5.6 Time 模块 API

#### 5.6.1 `withinHours(startHour, endHour)`

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

**使用示例**:
```typescript
import { time } from '@mtpc/helper';

// 工作时间限制（9:00-18:00）
const condition = time.withinHours(9, 18);
```

#### 5.6.2 `betweenDates(from, to)`

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

**使用示例**:
```typescript
// 临时权限（特定日期范围内）
const condition = time.betweenDates(
  new Date('2024-01-01'),
  new Date('2024-12-31')
);
```

#### 5.6.3 `weekdaysOnly()`

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

**使用示例**:
```typescript
// 工作日限制
const condition = time.weekdaysOnly();
```

---

## 6. 类型系统分析

### 6.1 核心类型依赖

Helper 包依赖 `@mtpc/core` 的以下类型：

```typescript
// 策略相关类型
PolicyCondition
PolicyDefinition
PolicyEvaluationContext
PolicyPriority
PolicyRule

// 资源相关类型
ResourceDefinition
ResourceFeatures
PermissionDefinition
AnyZodSchema
```

### 6.2 Helper 包类型定义

#### 6.2.1 ABAC 类型

```typescript
export interface ABACPolicyConfig {
  name?: string;
  description?: string;
  tenantId?: string;
  permissions: string[];
  conditions: PolicyCondition[];
  priority?: PolicyPriority;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}
```

#### 6.2.2 ACL 类型

```typescript
export interface PrincipalRef {
  subjectId?: string;
  role?: string;
}

export interface ACLEntry {
  resource: string;
  action: string;
  allow?: PrincipalRef[];
  deny?: PrincipalRef[];
}

export interface ACLConfig {
  id: string;
  tenantId?: string;
  entries: ACLEntry[];
  description?: string;
  priority?: PolicyPriority;
}
```

#### 6.2.3 Resource Helper 类型

```typescript
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
```

### 6.3 类型安全保证

1. **完整的 TypeScript 支持**: 所有 API 都有完整的类型定义
2. **严格的类型检查**: 使用 `@mtpc/core` 的类型系统
3. **类型推断**: 支持类型推断，减少类型注解
4. **类型兼容**: 与 `@mtpc/core` 类型完全兼容

---

## 7. 实现细节与最佳实践

### 7.1 实现细节

#### 7.1.1 条件函数实现模式

所有条件函数都遵循相同的实现模式：

```typescript
export function conditionName(...params): PolicyCondition {
  return {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => {
      // 条件逻辑
      return booleanResult;
    },
  } as PolicyCondition;
}
```

**特点**:
- 使用 `custom` 类型
- 返回异步函数
- 使用类型断言确保兼容性

#### 7.1.2 默认值处理

Helper 包在多处使用默认值：

1. **ABAC 模块**:
   - `ownResource(ownerField = 'createdBy')`
   - `sameDepartment(resourceField = 'departmentId', contextPath = 'subject.metadata.departmentId')`
   - `sameTeam(resourceField = 'teamId', contextPath = 'subject.metadata.teamId')`

2. **Policy Helper 模块**:
   - `allow` 默认优先级 `normal`
   - `deny` 默认优先级 `high`
   - `allowForRoles` 默认优先级 `normal`

3. **Resource Helper 模块**:
   - 所有 CRUD 操作默认启用
   - `withCrudPermissions` 默认 `true`

#### 7.1.3 数组复制

在 `env` 模块中，所有数组参数都会被复制：

```typescript
export function ipIn(whitelist: string[]): PolicyCondition {
  const list = [...whitelist]; // 复制数组
  // ...
}
```

**原因**:
- 避免外部修改影响内部逻辑
- 确保条件函数的稳定性

#### 7.1.4 安全的默认值

在多处使用安全的默认值避免错误：

```typescript
const resource = (ctx.resource ?? {}) as Record<string, unknown>;
const ua = ctx.request.userAgent ?? '';
```

**原因**:
- 避免 `undefined` 错误
- 提供默认行为

### 7.2 最佳实践

#### 7.2.1 使用 ABAC 模块

**推荐做法**:
```typescript
// 使用默认参数
const condition1 = abac.ownResource();

// 使用语义化函数
const condition2 = abac.sameDepartment();

// 组合条件
const policy = abac.policy('complex', {
  permissions: ['resource:action'],
  conditions: [
    abac.ownResource(),
    abac.sameDepartment()
  ]
});
```

#### 7.2.2 使用 ACL 模块

**推荐做法**:
```typescript
// 定义清晰的 ACL 配置
const aclConfig = {
  id: 'document-access',
  entries: [
    {
      resource: 'document',
      action: 'read',
      allow: [{ role: 'manager' }],
      deny: [{ subjectId: 'user-bad' }]
    }
  ]
};

// 批量转换
const policies = acl.toPolicies(aclConfig);
policies.forEach(p => mtpc.registerPolicy(p));
```

#### 7.2.3 使用 ENV 模块

**推荐做法**:
```typescript
// 使用 IP 白名单保护敏感操作
const internalOnly = policy.allow('internal-only', ['admin:access'], {
  conditions: [env.ipIn(['192.168.1.*'])]
});

// 使用 User-Agent 检测
const mobileOnly = policy.allow('mobile-only', ['mobile:feature'], {
  conditions: [env.userAgentContains('Mobile')]
});
```

#### 7.2.4 使用 Policy Helper 模块

**推荐做法**:
```typescript
// 使用 allowForRoles 创建基于角色的策略
const managerPolicy = policy.allowForRoles(
  'manager-permissions',
  ['user:read', 'user:update', 'order:*'],
  ['manager']
);

// 使用 deny 创建拒绝策略
const denyDelete = policy.deny('user-no-delete', ['user:delete'], {
  description: '普通用户不能删除用户'
});
```

#### 7.2.5 使用 Resource Helper 模块

**推荐做法**:
```typescript
// 快速创建标准 CRUD 资源
const userResource = resource.crud({
  name: 'user',
  schema: z.object({
    id: z.string(),
    email: z.string().email()
  }),
  enable: {
    create: true,
    read: true,
    update: true,
    delete: false, // 禁用删除
    list: true
  },
  metadata: {
    displayName: '用户',
    group: 'core'
  }
});
```

#### 7.2.6 使用 Time 模块

**推荐做法**:
```typescript
// 组合时间条件
const workHoursPolicy = policy.allow('work-hours-only', ['sensitive:access'], {
  conditions: [
    time.withinHours(9, 18),
    time.weekdaysOnly()
  ]
});

// 使用日期范围
const tempAccessPolicy = policy.allow('temp-access', ['temp:feature'], {
  conditions: [
    time.betweenDates(
      new Date('2024-01-01'),
      new Date('2024-12-31')
    )
  ]
});
```

### 7.3 性能考虑

#### 7.3.1 条件函数性能

- 所有条件函数都是轻量级的
- 避免在条件函数中执行复杂操作
- 使用数组复制确保稳定性，但有少量性能开销

#### 7.3.2 缓存策略

- 条件函数本身不缓存
- 可以在外部实现缓存
- 对于频繁使用的条件，考虑缓存结果

#### 7.3.3 异步处理

- 所有条件函数都支持异步
- 使用 `async` 函数确保兼容性
- 避免在条件函数中执行阻塞操作

### 7.4 错误处理

#### 7.4.1 安全的默认值

- 使用 `??` 操作符提供默认值
- 避免空值错误
- 提供合理的默认行为

#### 7.4.2 类型安全

- 使用 TypeScript 类型检查
- 使用类型断言确保兼容性
- 避免运行时类型错误

#### 7.4.3 参数验证

- 参数验证由 TypeScript 类型系统保证
- 运行时不进行额外的参数验证
- 依赖调用者提供正确的参数

---

## 总结

`@mtpc/helper` 包是一个设计良好的轻量级工具包，提供了丰富的权限模式和便捷的 API。通过深入分析源码，我们发现：

1. **模块化设计**: 六个独立模块，职责清晰
2. **类型安全**: 完整的 TypeScript 类型支持
3. **易于使用**: 提供默认值和语义化 API
4. **灵活扩展**: 支持自定义条件和组合
5. **性能考虑**: 轻量级实现，避免复杂操作

与 README.md 的主要差异在于：
- 参数定义方式（默认参数 vs 可选参数）
- 未提及的内部实现函数
- 更详细的实现逻辑和默认值

这些差异不影响功能使用，但了解源码实现有助于更好地使用和扩展该包。
