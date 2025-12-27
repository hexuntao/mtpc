# @mtpc/audit

MTPC（Multi-Tenant Permission Core）的审计日志扩展，用于记录和查询系统中的各种审计事件。

## 核心概念

### 审计分类（AuditCategory）

| 分类 | 描述 | 示例 |
|------|------|------|
| `permission` | 权限检查事件 | 用户尝试访问某个资源时的权限校验 |
| `resource` | 资源 CRUD 操作 | 创建、读取、更新、删除资源 |
| `role` | 角色/RBAC 变更 | 分配角色、撤销角色、创建角色 |
| `policy` | 策略变更 | 创建策略、更新策略、删除策略 |
| `system` | 系统级事件 | 系统配置变更、初始化事件 |
| `custom` | 自定义事件 | 业务相关的自定义审计事件 |

### 审计决策（AuditDecision）

| 决策 | 描述 | 使用场景 |
|------|------|---------|
| `allow` | 允许访问 | 权限检查通过、操作成功完成 |
| `deny` | 拒绝访问 | 权限不足、访问被拒绝 |
| `error` | 发生错误 | 操作执行过程中出现错误 |
| `info` | 信息性事件 | 常规操作记录、信息性日志 |

## 快速开始

### 1. 安装依赖

```bash
pnpm add @mtpc/audit
```

### 2. 创建审计实例

```typescript
import { createAudit } from '@mtpc/audit';

// 方式一：使用默认配置（内存存储，同步记录）
const audit = createAudit();

// 方式二：使用自定义配置
const audit = createAudit({
  async: true, // 异步记录日志（默认 false，同步）
  store: new MyCustomStore(), // 自定义存储实现
  mask: (entry) => {
    // 数据掩码：处理敏感信息
    if (entry.metadata?.password) {
      entry.metadata.password = '***';
    }
    return entry;
  },
  include: {
    permissionChecks: true, // 记录权限检查（默认 true）
    resourceOperations: true, // 记录资源操作（默认 true）
    roleChanges: true, // 记录角色变更（默认 true）
    policyChanges: true // 记录策略变更（默认 true）
  }
});
```

### 3. 记录审计事件

#### 记录权限检查事件

```typescript
import type { MTPCContext } from '@mtpc/core';

const ctx: MTPCContext = {
  tenant: { id: 'tenant-001' },
  subject: { id: 'user-123', type: 'user' },
  request: {
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0',
    requestId: 'req-abc-123',
    path: '/api/users',
    method: 'GET'
  }
};

// 记录权限检查事件
await audit.logPermissionCheck({
  ctx,
  permission: 'user:read',
  resource: 'user',
  resourceId: 'user-456',
  decision: 'allow',
  success: true,
  reason: 'Permission granted',
  metadata: {
    // 自定义元数据
    extra: 'information'
  }
});
```

#### 记录资源操作事件

```typescript
// 记录资源创建事件
await audit.logResourceOperation({
  ctx,
  operation: 'create',
  resource: 'user',
  resourceId: 'user-789',
  success: true,
  before: null,
  after: {
    id: 'user-789',
    name: '张三',
    email: 'zhangsan@example.com'
  }
});

// 记录资源更新事件
await audit.logResourceOperation({
  ctx,
  operation: 'update',
  resource: 'order',
  resourceId: 'order-123',
  success: true,
  before: { status: 'pending' },
  after: { status: 'paid' }
});

// 记录资源删除事件
await audit.logResourceOperation({
  ctx,
  operation: 'delete',
  resource: 'product',
  resourceId: 'product-456',
  success: true,
  before: { name: '旧产品' },
  after: null
});
```

#### 记录角色变更事件

```typescript
// 记录角色分配事件
await audit.logRoleChange({
  ctx,
  action: 'assign',
  subjectId: 'user-123',
  role: 'admin',
  success: true,
  metadata: {
    assignedBy: 'super-admin'
  }
});

// 记录角色撤销事件
await audit.logRoleChange({
  ctx,
  action: 'revoke',
  subjectId: 'user-456',
  role: 'editor',
  success: true
});

// 记录角色创建事件
await audit.logRoleChange({
  ctx,
  action: 'createRole',
  role: 'new-role',
  success: true
});
```

#### 记录策略变更事件

```typescript
// 记录策略创建事件
await audit.logPolicyChange({
  ctx,
  action: 'createPolicy',
  policyId: 'policy-001',
  success: true,
  metadata: {
    policyName: '管理员完全访问'
  }
});

// 记录策略更新事件
await audit.logPolicyChange({
  ctx,
  action: 'updatePolicy',
  policyId: 'policy-002',
  success: true,
  reason: '更新条件表达式'
});

// 记录策略删除事件
await audit.logPolicyChange({
  ctx,
  action: 'deletePolicy',
  policyId: 'policy-003',
  success: true
});
```

#### 记录自定义事件

```typescript
// 记录登录事件
await audit.logCustom({
  ctx,
  category: 'system',
  action: 'login',
  resource: 'session',
  resourceId: 'session-abc',
  decision: 'allow',
  success: true,
  metadata: {
    loginMethod: 'password',
    mfaUsed: true
  }
});

// 记录导出事件
await audit.logCustom({
  ctx,
  category: 'custom',
  action: 'export',
  resource: 'report',
  decision: 'info',
  success: true,
  metadata: {
    exportFormat: 'csv',
    recordCount: 1000
  }
});
```

### 4. 查询审计记录

#### 使用过滤器构建器

```typescript
import { createAuditFilter } from '@mtpc/audit';

// 方式一：使用过滤器构建器
const filter = createAuditFilter()
  .tenant('tenant-001')
  .category('permission')
  .decision('deny')
  .subject('user-123')
  .resource('order')
  .from(new Date('2024-01-01'))
  .to(new Date('2024-12-31'))
  .build();

// 方式二：直接构建过滤器对象
const filter = {
  tenantId: 'tenant-001',
  category: 'resource',
  action: 'delete',
  from: new Date('2024-01-01')
};

// 查询审计记录
const result = await audit.query({
  filter,
  limit: 20,
  offset: 0,
  orderBy: 'timestamp',
  orderDirection: 'desc'
});

console.log('总条数:', result.total);
console.log('当前页:', result.entries.length);
result.entries.forEach(entry => {
  console.log(
    `[${entry.timestamp.toISOString()}]`,
    `${entry.category}:${entry.action}`,
    entry.resource,
    entry.decision
  );
});
```

#### 统计审计记录数量

```typescript
// 统计所有审计记录
const totalCount = await audit.count();
console.log('总审计记录数:', totalCount);

// 统计特定条件的记录
const deniedCount = await audit.count({
  decision: 'deny',
  category: 'permission'
});
console.log('权限拒绝次数:', deniedCount);

// 按租户统计
const tenantCount = await audit.count({
  tenantId: 'tenant-001'
});
console.log('租户 tenant-001 的审计记录数:', tenantCount);
```

#### 清除审计记录

```typescript
// 清除所有审计记录（谨慎使用）
await audit.clear();

// 清除特定条件的记录
await audit.clear({
  tenantId: 'tenant-001',
  category: 'permission',
  from: new Date('2024-01-01') // 清除 2024-01-01 之前的记录
});

// 清除特定资源的所有记录
await audit.clear({
  resource: 'temporary_data'
});
```

## 作为 MTPC 插件使用

### 注册审计插件

```typescript
import { createMTPC } from '@mtpc/core';
import { createAuditPlugin } from '@mtpc/audit';

// 创建 MTPC 实例
const mtpc = createMTPC({
  // MTPC 配置...
});

// 创建并注册审计插件
const auditPlugin = createAuditPlugin({
  async: true,
  store: new MyDatabaseAuditStore(),
  include: {
    permissionChecks: false, // 禁用权限检查自动记录
    resourceOperations: true,
    roleChanges: true,
    policyChanges: true
  }
});

// 使用 use() 方法注册插件（不是 registerPlugin）
mtpc.use(auditPlugin);

// 访问审计实例
const audit = auditPlugin.state.store;
```

### 插件自动记录的内容

审计插件通过 MTPC 的全局钩子（Global Hooks）自动记录以下事件：

| 钩子 | 记录内容 |
|------|---------|
| `beforeAny` | 资源操作开始时记录 `resource` 类型事件 |
| `onError` | 资源操作出错时记录失败事件 |

**重要说明**：审计插件**不会**自动记录权限检查（`checkPermission`）事件。如需记录权限检查，需要在业务代码中手动调用 `audit.logPermissionCheck()`。

### 手动记录权限检查

```typescript
import { createMTPC, createAudit, createAuditPlugin } from '@mtpc';

const mtpc = createMTPC();
const audit = createAudit();

// 注册插件（同时使用独立审计实例）
mtpc.use(createAuditPlugin());

// 在权限检查时手动记录
async function checkWithAudit(
  tenant: { id: string },
  subject: { id: string; type: string },
  permission: string
) {
  const context = mtpc.createContext(tenant, subject);
  
  const result = await mtpc.checkPermission({
    ...context,
    resource: permission.split(':')[0],
    action: permission.split(':')[1]
  });
  
  // 记录权限检查结果
  await audit.logPermissionCheck({
    ctx: context,
    permission,
    decision: result.allowed ? 'allow' : 'deny',
    success: true,
    reason: result.reason
  });
  
  return result;
}
```

## 自定义存储实现

### 实现 AuditStore 接口

```typescript
import type { AuditStore, AuditEntry, AuditQueryOptions, AuditQueryResult, AuditQueryFilter } from '@mtpc/audit';

class DatabaseAuditStore implements AuditStore {
  
  async log(entry: AuditEntry): Promise<void> {
    // 将审计记录保存到数据库
    await db.auditLogs.create({
      data: {
        id: entry.id,
        tenantId: entry.tenantId,
        timestamp: entry.timestamp,
        subjectId: entry.subjectId,
        subjectType: entry.subjectType,
        category: entry.category,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        permission: entry.permission,
        decision: entry.decision,
        success: entry.success,
        reason: entry.reason,
        before: JSON.stringify(entry.before),
        after: JSON.stringify(entry.after),
        ip: entry.ip,
        userAgent: entry.userAgent,
        requestId: entry.requestId,
        path: entry.path,
        method: entry.method,
        metadata: JSON.stringify(entry.metadata)
      }
    });
  }
  
  async query(options: AuditQueryOptions = {}): Promise<AuditQueryResult> {
    const { filter = {}, limit = 50, offset = 0, orderBy = 'timestamp', orderDirection = 'desc' } = options;
    
    // 构建数据库查询
    const where = this.buildWhereClause(filter);
    const orderByClause = this.buildOrderByClause(orderBy, orderDirection);
    
    const [entries, total] = await Promise.all([
      db.auditLogs.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: orderByClause
      }),
      db.auditLogs.count({ where })
    ]);
    
    return {
      entries: entries.map(this.mapToAuditEntry),
      total,
      limit,
      offset
    };
  }
  
  async count(filter: AuditQueryFilter = {}): Promise<number> {
    const where = this.buildWhereClause(filter);
    return db.auditLogs.count({ where });
  }
  
  async clear(filter: AuditQueryFilter = {}): Promise<void> {
    const where = this.buildWhereClause(filter);
    await db.auditLogs.deleteMany({ where });
  }
  
  // 辅助方法...
  private buildWhereClause(filter: AuditQueryFilter) { /* ... */ }
  private buildOrderByClause(orderBy: string, direction: string) { /* ... */ }
  private mapToAuditEntry(dbEntry: any): AuditEntry { /* ... */ }
}
```

### 使用自定义存储

```typescript
// 创建自定义存储实例
const dbStore = new DatabaseAuditStore({
  // 数据库连接配置
  connection: { /* ... */ }
});

// 使用自定义存储创建审计实例
const audit = createAudit({
  store: dbStore,
  async: true // 异步记录，减少对主流程的影响
});
```

## 数据掩码

配置数据掩码函数来处理敏感信息：

```typescript
const audit = createAudit({
  mask: (entry) => {
    // 掩码密码字段
    if (entry.metadata?.password) {
      entry.metadata.password = '***';
    }
    
    // 掩码邮箱
    if (entry.metadata?.email) {
      entry.metadata.email = entry.metadata.email.replace(
        /(\w{2})\w+(@\w+\.\w+)/,
        '$1***$2'
      );
    }
    
    // 掩码信用卡号
    if (entry.metadata?.creditCard) {
      entry.metadata.creditCard = '****-****-****-' + 
        entry.metadata.creditCard.slice(-4);
    }
    
    // 掩码 before/after 中的敏感数据
    if (entry.before && typeof entry.before === 'object') {
      entry.before = this.maskObject(entry.before);
    }
    if (entry.after && typeof entry.after === 'object') {
      entry.after = this.maskObject(entry.after);
    }
    
    return entry;
  }
});
```

## 完整示例

### 综合使用示例

```typescript
import { createMTPC, createAudit, createAuditPlugin } from '@mtpc/core';
import { createAuditFilter } from '@mtpc/audit';
import { DatabaseAuditStore } from './stores/database';

// 1. 创建自定义存储
const auditStore = new DatabaseAuditStore();

// 2. 创建审计实例
const audit = createAudit({
  store: auditStore,
  async: true
});

// 3. 创建 MTPC 实例
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    // 从数据库获取权限
    return getPermissionsFromDB(tenantId, subjectId);
  }
});

// 4. 注册审计插件
mtpc.use(createAuditPlugin({
  store: auditStore,
  async: true
}));

// 5. 定义资源
const userResource = defineResource({
  name: 'user',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email()
  }),
  features: { create: true, read: true, update: true, delete: true }
});

mtpc.registerResource(userResource);

// 6. 初始化
await mtpc.init();

// 7. 业务操作示例
async function createUser(data: { name: string; email: string }) {
  const context = mtpc.createContext(
    { id: 'tenant-001' },
    { id: 'admin-001', type: 'user' }
  );
  
  // 记录操作前
  const before = null;
  
  // 执行创建操作
  const created = await createUserInDB(data);
  
  // 记录操作后
  const after = { ...created };
  
  // 记录审计日志
  await audit.logResourceOperation({
    ctx: context,
    operation: 'create',
    resource: 'user',
    resourceId: created.id,
    success: true,
    before,
    after
  });
  
  return created;
}

// 8. 查询审计日志
async function getAuditLogs(tenantId: string) {
  const filter = createAuditFilter()
    .tenant(tenantId)
    .from(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 最近7天
    .build();
  
  const result = await audit.query({
    filter,
    limit: 100,
    orderBy: 'timestamp',
    orderDirection: 'desc'
  });
  
  return result;
}
```

## API 参考

### Audit 类

| 方法 | 描述 |
|------|------|
| `logPermissionCheck(params)` | 记录权限检查事件 |
| `logResourceOperation(params)` | 记录资源操作事件 |
| `logRoleChange(params)` | 记录角色变更事件 |
| `logPolicyChange(params)` | 记录策略变更事件 |
| `logCustom(params)` | 记录自定义事件 |
| `query(options)` | 查询审计记录 |
| `count(filter)` | 统计审计记录数量 |
| `clear(filter)` | 清除审计记录 |
| `getStore()` | 获取底层存储实例 |

### createAudit 函数

```typescript
function createAudit(options?: AuditOptions): Audit
```

### AuditOptions 接口

```typescript
interface AuditOptions {
  store?: AuditStore;           // 审计存储实现
  async?: boolean;              // 是否异步记录（默认 false）
  mask?: (entry: AuditEntry) => AuditEntry; // 数据掩码函数
  include?: {
    permissionChecks?: boolean; // 是否记录权限检查（默认 true）
    resourceOperations?: boolean; // 是否记录资源操作（默认 true）
    roleChanges?: boolean;      // 是否记录角色变更（默认 true）
    policyChanges?: boolean;    // 是否记录策略变更（默认 true）
  };
}
```

### AuditEntry 接口

```typescript
interface AuditEntry {
  id: string;                   // 唯一标识符
  tenantId: string;             // 租户 ID
  timestamp: Date;              // 事件时间
  subjectId?: string;           // 主体 ID
  subjectType?: string;         // 主体类型
  category: AuditCategory;      // 审计分类
  action: string;               // 具体动作
  resource?: string;            // 资源名称
  resourceId?: string;          // 资源标识符
  permission?: string;          // 权限编码
  decision: AuditDecision;      // 决策结果
  success: boolean;             // 是否成功
  reason?: string;              // 原因说明
  before?: unknown;             // 操作前状态
  after?: unknown;              // 操作后状态
  ip?: string;                  // IP 地址
  userAgent?: string;           // 用户代理
  requestId?: string;           // 请求 ID
  path?: string;                // 请求路径
  method?: string;              // 请求方法
  metadata?: Record<string, unknown>; // 自定义元数据
}
```

### createAuditPlugin 函数

```typescript
function createAuditPlugin(
  options?: AuditOptions
): PluginDefinition & { state: AuditPluginState }
```

### createAuditFilter 函数

```typescript
function createAuditFilter(): AuditFilterBuilder
```

### AuditFilterBuilder 方法

| 方法 | 描述 |
|------|------|
| `tenant(tenantId)` | 设置租户 ID 过滤 |
| `subject(subjectId)` | 设置主体 ID 过滤 |
| `resource(resource)` | 设置资源名称过滤 |
| `resourceId(resourceId)` | 设置资源标识符过滤 |
| `category(category)` | 设置审计分类过滤 |
| `decision(decision)` | 设置决策结果过滤 |
| `action(action)` | 设置动作类型过滤 |
| `permission(permission)` | 设置权限编码过滤 |
| `from(date)` | 设置起始时间 |
| `to(date)` | 设置结束时间 |
| `build()` | 构建过滤器对象 |

## 最佳实践

### 1. 异步记录审计日志

生产环境建议使用异步记录，减少对主流程的影响：

```typescript
const audit = createAudit({
  async: true,
  store: new DatabaseAuditStore()
});
```

### 2. 合理配置 include 选项

根据业务需求选择性记录：

```typescript
const audit = createAudit({
  include: {
    permissionChecks: false, // 权限检查量可能很大，按需启用
    resourceOperations: true, // 资源操作是核心审计内容
    roleChanges: true,        // 角色变更需要审计
    policyChanges: true       // 策略变更需要审计
  }
});
```

### 3. 使用数据掩码保护敏感信息

```typescript
const audit = createAudit({
  mask: (entry) => {
    const sensitiveFields = ['password', 'token', 'secret', 'creditCard'];
    
    const maskObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const masked = { ...obj };
      for (const field of sensitiveFields) {
        if (masked[field]) {
          masked[field] = '***';
        }
      }
      return masked;
    };
    
    if (entry.metadata) {
      entry.metadata = maskObject(entry.metadata);
    }
    entry.before = maskObject(entry.before);
    entry.after = maskObject(entry.after);
    
    return entry;
  }
});
```

### 4. 定期清理审计日志

```typescript
// 使用定时任务清理旧日志
async function cleanupOldLogs() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  await audit.clear({
    to: thirtyDaysAgo,
    category: 'permission' // 只清理权限检查日志
  });
}
```

### 5. 监控审计系统性能

```typescript
// 包装审计方法以监控性能
const wrappedAudit = new Proxy(audit, {
  get(target, prop) {
    const original = target[prop];
    if (typeof original === 'function') {
      return (...args: any[]) => {
        const start = Date.now();
        const result = original.apply(target, args);
        
        if (result instanceof Promise) {
          return result.finally(() => {
            const duration = Date.now() - start;
            if (duration > 100) {
              console.warn(`Audit operation ${String(prop)} took ${duration}ms`);
            }
          });
        }
        
        return result;
      };
    }
    return original;
  }
});
```

## 常见问题

### Q1: 插件如何与独立的审计实例配合使用？

```typescript
// 正确做法：使用同一个存储实例
const store = new DatabaseAuditStore();

// 插件使用该存储
mtpc.use(createAuditPlugin({
  store
}));

// 独立审计实例也使用同一个存储
const audit = createAudit({
  store
});
```

### Q2: 如何记录权限检查的详细信息？

权限检查不会自动记录，需要手动调用：

```typescript
const originalCheck = mtpc.checkPermission.bind(mtpc);

mtpc.checkPermission = async (context) => {
  const result = await originalCheck(context);
  
  await audit.logPermissionCheck({
    ctx: context,
    permission: `${context.resource}:${context.action}`,
    decision: result.allowed ? 'allow' : 'deny',
    success: true,
    reason: result.reason
  });
  
  return result;
};
```

### Q3: 如何实现审计日志的实时推送？

```typescript
class RealTimeAuditStore implements AuditStore {
  private subscribers: Set<(entry: AuditEntry) => void> = new Set();
  
  async log(entry: AuditEntry): Promise<void> {
    // 推送给订阅者
    this.subscribers.forEach(cb => cb(entry));
  }
  
  subscribe(callback: (entry: AuditEntry) => void) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  
  // ... 其他方法
}
```

### Q4: 如何处理审计日志的并发写入？

内存存储不适用于高并发场景。生产环境应使用数据库存储：

```typescript
// 使用事务确保数据一致性
class TransactionalAuditStore implements AuditStore {
  async log(entry: AuditEntry): Promise<void> {
    await db.$transaction(async (tx) => {
      await tx.auditLog.create({ data: entry });
    });
  }
  
  // ...
}
```

## 性能考虑

### 异步 vs 同步

| 模式 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| 异步 (`async: true`) | 不阻塞主流程 | 可能丢失数据 | 生产环境、高频操作 |
| 同步 (`async: false`) | 数据可靠 | 阻塞主流程 | 关键操作、测试环境 |

### 存储选择

| 存储 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| 内存存储 | 速度快 | 数据易丢失 | 测试、演示 |
| 数据库存储 | 数据持久化 | 速度较慢 | 一般生产环境 |
| 消息队列 + 数据库 | 高吞吐、可靠 | 架构复杂 | 高并发场景 |

## 构建与测试

```bash
# 构建生产版本
pnpm build

# 构建并监听文件变化
pnpm dev

# 类型检查
pnpm typecheck

# 运行测试
pnpm test

# 运行测试并监听文件变化
pnpm test:watch
```

## 许可证

MIT
