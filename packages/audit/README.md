# @mtpc/audit

MTPC（Multi-Tenant Permission Core）的审计日志扩展，用于记录和查询系统中的各种审计事件。

## 功能特性

- ✅ 支持多种审计事件类型（权限检查、资源操作、角色变更、策略变更等）
- ✅ 灵活的存储接口设计，支持自定义存储实现
- ✅ 内置内存存储，方便测试和演示
- ✅ 流畅的过滤器构建器，便于查询审计记录
- ✅ 支持异步和同步日志记录
- ✅ 支持数据掩码，保护敏感信息
- ✅ 完善的 TypeScript 类型定义
- ✅ 支持多租户环境

## 安装

```bash
pnpm add @mtpc/audit
```

## 核心概念

### 审计分类（AuditCategory）

- `permission` - 权限检查事件
- `resource` - 资源 CRUD 操作
- `role` - 角色/RBAC 变更
- `policy` - 策略变更
- `system` - 系统级事件
- `custom` - 自定义事件

### 审计决策（AuditDecision）

- `allow` - 允许访问
- `deny` - 拒绝访问
- `error` - 发生错误
- `info` - 信息性事件

## 快速开始

### 1. 创建审计实例

```typescript
import { createAudit } from '@mtpc/audit';

// 创建默认审计实例（使用内存存储）
const audit = createAudit();

// 或者使用自定义配置
const audit = createAudit({
  async: true, // 异步记录日志
  include: {
    permissionChecks: true,
    resourceOperations: true,
    roleChanges: true,
    policyChanges: true
  }
});
```

### 2. 记录审计事件

```typescript
// 记录权限检查事件
await audit.logPermissionCheck({
  ctx: mtpcContext, // MTPC 上下文
  permission: 'user:read',
  resource: 'user',
  resourceId: 'user123',
  decision: 'allow',
  success: true,
  metadata: { additional: 'info' }
});

// 记录资源操作事件
await audit.logResourceOperation({
  ctx: mtpcContext,
  operation: 'create',
  resource: 'user',
  resourceId: 'user123',
  success: true,
  before: null,
  after: { id: 'user123', name: 'John' }
});

// 记录角色变更事件
await audit.logRoleChange({
  ctx: mtpcContext,
  action: 'assign',
  subjectId: 'user123',
  role: 'admin',
  success: true
});

// 记录自定义事件
await audit.logCustom({
  ctx: mtpcContext,
  category: 'custom',
  action: 'custom-action',
  resource: 'custom-resource',
  metadata: { custom: 'data' }
});
```

### 3. 查询审计记录

```typescript
import { createAuditFilter } from '@mtpc/audit';

// 使用过滤器构建器创建查询条件
const filter = createAuditFilter()
  .tenant('tenant123')
  .category('permission')
  .decision('deny')
  .from(new Date('2023-01-01'))
  .build();

// 查询审计记录
const result = await audit.query({
  filter,
  limit: 10,
  offset: 0,
  orderBy: 'timestamp',
  orderDirection: 'desc'
});

// 统计审计记录数量
const count = await audit.count(filter);
```

### 4. 清除审计记录

```typescript
// 清除所有审计记录
await audit.clear();

// 清除符合条件的审计记录
await audit.clear({
  tenantId: 'tenant123',
  category: 'permission'
});
```

## 自定义存储实现

您可以通过实现 `AuditStore` 接口来创建自定义存储，例如使用数据库或文件系统存储审计记录。

```typescript
import type { AuditStore } from '@mtpc/audit';

class DatabaseAuditStore implements AuditStore {
  async log(entry) {
    // 实现数据库存储逻辑
  }

  async query(options) {
    // 实现数据库查询逻辑
  }

  async count(filter) {
    // 实现数据库计数逻辑
  }

  async clear(filter) {
    // 实现数据库清除逻辑
  }
}

// 使用自定义存储
const audit = createAudit({
  store: new DatabaseAuditStore()
});
```

## 数据掩码

您可以配置数据掩码函数，用于处理敏感信息：

```typescript
const audit = createAudit({
  mask: (entry) => {
    // 替换敏感信息
    if (entry.metadata?.password) {
      entry.metadata.password = '***';
    }
    return entry;
  }
});
```

## 插件集成

审计功能也可以作为 MTPC 插件使用：

```typescript
import { createMTPC } from '@mtpc/core';
import { createAuditPlugin } from '@mtpc/audit';

const mtpc = createMTPC({
  // MTPC 配置
});

// 注册审计插件
mtpc.registerPlugin(createAuditPlugin({
  // 审计插件配置
}));
```

## 核心 API

### Audit 类

- `logPermissionCheck(params)` - 记录权限检查事件
- `logResourceOperation(params)` - 记录资源操作事件
- `logRoleChange(params)` - 记录角色变更事件
- `logPolicyChange(params)` - 记录策略变更事件
- `logCustom(params)` - 记录自定义事件
- `query(options)` - 查询审计记录
- `count(filter)` - 统计审计记录数量
- `clear(filter)` - 清除审计记录
- `getStore()` - 获取底层存储实例

### 配置选项

```typescript
interface AuditOptions {
  store?: AuditStore; // 审计存储实现
  async?: boolean; // 是否异步记录（默认 true）
  mask?: (entry: AuditEntry) => AuditEntry; // 数据掩码函数
  include?: {
    permissionChecks?: boolean; // 是否记录权限检查
    resourceOperations?: boolean; // 是否记录资源操作
    roleChanges?: boolean; // 是否记录角色变更
    policyChanges?: boolean; // 是否记录策略变更
  };
}
```

## 审计条目结构

```typescript
interface AuditEntry {
  id: string; // 唯一标识符
  tenantId: string; // 租户 ID
  timestamp: Date; // 事件时间
  subjectId?: string; // 主体 ID
  subjectType?: string; // 主体类型
  category: AuditCategory; // 审计分类
  action: string; // 具体动作
  resource?: string; // 资源名称
  resourceId?: string; // 资源标识符
  permission?: string; // 权限编码
  decision: AuditDecision; // 决策结果
  success: boolean; // 是否成功
  reason?: string; // 原因说明
  before?: unknown; // 操作前状态
  after?: unknown; // 操作后状态
  ip?: string; // IP 地址
  userAgent?: string; // 用户代理
  requestId?: string; // 请求 ID
  path?: string; // 请求路径
  method?: string; // 请求方法
  metadata?: Record<string, unknown>; // 自定义元数据
}
```

## 示例

### 完整示例

```typescript
import { createAudit, createAuditFilter } from '@mtpc/audit';
import { createMTPC, type MTPCContext } from '@mtpc/core';

// 创建 MTPC 实例
const mtpc = createMTPC({
  tenants: [/* 租户配置 */],
  roles: [/* 角色配置 */],
  policies: [/* 策略配置 */]
});

// 创建审计实例
const audit = createAudit();

// 模拟 MTPC 上下文
const ctx: MTPCContext = {
  tenant: { id: 'tenant123' },
  subject: { id: 'user123', type: 'user' },
  request: {
    ip: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    requestId: 'req-123',
    path: '/api/users',
    method: 'GET'
  }
};

// 记录权限检查事件
await audit.logPermissionCheck({
  ctx,
  permission: 'user:read',
  resource: 'user',
  resourceId: 'user456',
  decision: 'allow',
  success: true
});

// 查询最近的 10 条权限拒绝记录
const result = await audit.query({
  filter: createAuditFilter()
    .tenant('tenant123')
    .category('permission')
    .decision('deny')
    .build(),
  limit: 10,
  orderBy: 'timestamp',
  orderDirection: 'desc'
});

console.log('查询结果:', result);
```

## 测试

```bash
# 运行测试
pnpm test

# 运行测试并监听文件变化
pnpm test:watch
```

## 构建

```bash
# 构建生产版本
pnpm build

# 构建并监听文件变化
pnpm dev
```

## 类型检查

```bash
pnpm typecheck
```

## 许可证

MIT
