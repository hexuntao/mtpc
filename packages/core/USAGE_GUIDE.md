# MTPC Core 使用指南

## 1. 概述

**MTPC (Multi-Tenant Permission Core)** 是一个业务无关、可嵌入、可组合的多租户权限内核。它不是一个可直接部署的系统，而是作为依赖被真实业务系统（SaaS、内部后台、B端系统等）引入。

## 2. 环境配置

### 2.1 安装依赖

```bash
# 使用 pnpm 安装
pnpm add @mtpc/core

# 安装可选依赖（用于 Schema 定义）
pnpm add zod
```

### 2.2 基本配置

创建 MTPC 实例并进行基础配置：

```typescript
import { createMTPC, defineResource } from '@mtpc/core';
import { z } from 'zod';

// 创建 MTPC 实例
const mtpc = createMTPC({
  // 配置多租户选项（可选）
  multiTenant: {
    // 租户隔离级别
    isolationLevel: 'tenant',
    // 租户ID解析器（可选）
    tenantResolver: (req) => req.headers['x-tenant-id'] as string
  },
  // 默认权限解析器（从外部系统获取权限）
  defaultPermissionResolver: async (tenantId, subjectId) => {
    // 从数据库或外部服务加载权限
    // 示例：从静态映射获取
    const permissionsMap = new Map([
      ['user-123', new Set(['user:read', 'user:update'])],
      ['user-456', new Set(['*'])] // 超级管理员权限
    ]);
    return permissionsMap.get(subjectId) || new Set();
  }
});
```

## 3. 基础 API 调用示例

### 3.1 资源定义

```typescript
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

### 3.2 策略定义与注册

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

// 注册时间限制策略
mtpc.registerPolicy({
  id: 'business-hours-only',
  name: '仅工作时间可访问',
  rules: [{
    permissions: ['*'],
    effect: 'allow',
    conditions: [{
      type: 'time',
      operator: 'between',
      value: { start: '09:00', end: '18:00' }
    }]
  }],
  priority: 'medium',
  enabled: true
});
```

### 3.3 初始化 MTPC

```typescript
// 初始化 MTPC 实例
await mtpc.init();

// 检查初始化状态
console.log('MTPC 初始化状态:', mtpc.isInitialized());

// 获取系统摘要
console.log('系统摘要:', mtpc.getSummary());
```

### 3.4 权限检查

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

## 4. 高级功能实现

### 4.1 批量权限检查

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

// 或者使用循环批量检查
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

### 4.2 自定义策略条件

```typescript
// 使用内置的条件类型
mtpc.registerPolicy({
  id: 'custom-field-policy',
  name: '基于自定义字段的策略',
  rules: [{
    permissions: ['user:special-action'],
    effect: 'allow',
    conditions: [{
      type: 'field',           // 条件类型：field
      field: 'subject.attributes.level',  // 自定义字段
      operator: 'eq',          // 操作符：eq, neq, in, notIn, contains
      value: 'premium'         // 比较值
    }]
  }],
  priority: 'normal',
  enabled: true
});

// 支持的操作符
// - eq: 等于
// - neq: 不等于
// - in: 在列表中
// - notIn: 不在列表中
// - contains: 包含（用于数组字段）

// 多条件组合
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
      }
    ]
  }],
  priority: 'high',
  enabled: true
});
```

### 4.3 插件系统使用

```typescript
// 定义审计日志插件
const auditPlugin = {
  name: 'audit-log',
  version: '1.0.0',
  install(ctx) {
    // 注册全局钩子
    ctx.registerGlobalHooks({
      afterAny: async (context, operation, resource, result) => {
        // 记录审计日志
        console.log(`[审计日志] ${context.subject.id} 执行 ${operation} 于 ${resource}，结果:`, result);
        // 实际项目中可以写入数据库或日志系统
      },
      beforeAny: async (context, operation, resource) => {
        // 操作前检查
        console.log(`[审计日志] ${context.subject.id} 即将执行 ${operation} 于 ${resource}`);
        return { proceed: true };
      },
      onError: async (context, operation, resource, error) => {
        // 错误日志
        console.error(`[审计日志] ${context.subject.id} 执行 ${operation} 于 ${resource} 时出错:`, error.message);
      }
    });
  }
};

// 注册插件
mtpc.use(auditPlugin);

// 注册资源级钩子
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
    beforeCreate: async (context, input) => {
      // 验证订单金额
      if (input.amount <= 0) {
        throw new Error('订单金额必须大于0');
      }
      return input;
    },
    afterUpdate: async (context, resource, updatedData) => {
      // 订单状态变更通知
      console.log(`订单 ${resource.id} 状态变更为 ${updatedData.status}`);
      return updatedData;
    }
  }
});

mtpc.registerResource(orderResource);
```

### 4.4 多租户上下文管理

```typescript
// 创建新租户
const tenant = await mtpc.tenants.createTenant({
  id: 'new-tenant-123',
  name: '新租户',
  status: 'active',
  metadata: {
    tier: 'enterprise',
    maxUsers: 1000
  }
});

// 设置租户上下文
const tenantContext = mtpc.createContext(
  { id: 'new-tenant-123' },
  { id: 'admin-user', type: 'user', role: 'admin' }
);

// 在租户上下文中检查权限
const result = await mtpc.checkPermission({
  ...tenantContext,
  resource: 'user',
  action: 'create'
});
```

## 5. 常见场景应用代码片段

### 5.1 HTTP 中间件集成

```typescript
// 示例：与 Hono 框架集成
import { Hono } from 'hono';

const app = new Hono();

// 权限检查中间件
const authMiddleware = async (c, next) => {
  // 从请求中获取租户ID和用户ID
  const tenantId = c.req.header('x-tenant-id');
  const userId = c.get('userId'); // 假设已从认证中间件获取

  if (!tenantId || !userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // 检查权限
  const permission = c.req.header('x-permission');
  if (permission) {
    const [resource, action] = permission.split(':');
    try {
      await mtpc.requirePermission({
        tenant: { id: tenantId },
        subject: { id: userId, type: 'user' },
        resource,
        action
      });
    } catch (error) {
      return c.json({ error: 'Forbidden' }, 403);
    }
  }

  await next();
};

// 应用中间件
app.use(authMiddleware);

// 受保护的路由
app.get('/api/users', async (c) => {
  // 权限已在中间件中检查
  return c.json({ users: [] });
});
```

### 5.2 业务逻辑中的权限检查

```typescript
// 示例：用户服务中的权限检查
class UserService {
  async deleteUser(tenantId: string, userId: string, currentUserId: string) {
    // 检查当前用户是否有删除权限
    await mtpc.requirePermission({
      tenant: { id: tenantId },
      subject: { id: currentUserId, type: 'user' },
      resource: 'user',
      action: 'delete'
    });

    // 执行删除操作
    // ...
  }

  async impersonateUser(tenantId: string, adminId: string, targetUserId: string) {
    // 检查是否有模拟权限
    await mtpc.requirePermission({
      tenant: { id: tenantId },
      subject: { id: adminId, type: 'user' },
      resource: 'user',
      action: 'impersonate'
    });

    // 执行模拟操作
    // ...
  }
}
```

### 5.3 动态权限分配

```typescript
// 示例：基于角色的权限分配
async function assignRoleToUser(tenantId: string, userId: string, role: string) {
  // 检查当前用户是否有角色分配权限
  await mtpc.requirePermission({
    tenant: { id: tenantId },
    subject: { id: userId, type: 'user' },
    resource: 'role',
    action: 'assign'
  });

  // 根据角色分配权限
  const rolePermissions = {
    'admin': ['*'],
    'manager': ['user:read', 'user:update', 'order:*'],
    'user': ['user:read', 'order:read']
  };

  const permissions = rolePermissions[role] || [];

  // 保存权限到数据库
  // await permissionRepository.save(tenantId, userId, permissions);
}
```

## 6. 错误处理最佳实践

### 6.1 捕获和处理权限错误

```typescript
import { PermissionDeniedError, InvalidTenantError, MissingTenantContextError } from '@mtpc/shared/errors';

try {
  await mtpc.requirePermission(permissionContext);
  // 权限检查通过，执行操作
} catch (error) {
  if (error instanceof PermissionDeniedError) {
    // 权限不足，记录日志并返回错误
    console.error(`权限拒绝: ${error.message}`, {
      permission: error.permission,
      tenantId: error.tenantId,
      subjectId: error.subjectId
    });
    return { error: '您没有权限执行此操作' };
  } else if (error instanceof MissingTenantContextError) {
    // 缺少租户上下文
    console.error('缺少租户上下文');
    return { error: '系统配置错误：缺少租户上下文' };
  } else if (error instanceof InvalidTenantError) {
    // 无效的租户ID
    console.error('无效的租户ID');
    return { error: '无效的租户信息' };
  } else {
    // 其他错误
    console.error('权限检查时发生未知错误:', error);
    return { error: '系统内部错误' };
  }
}
```

### 6.2 自定义错误处理策略

```typescript
// 示例：全局错误处理器
function setupGlobalErrorHandler() {
  process.on('uncaughtException', (error) => {
    if (error instanceof PermissionDeniedError) {
      // 权限相关错误，记录详细信息
      console.error('权限错误:', {
        message: error.message,
        permission: error.permission,
        stack: error.stack
      });
    } else {
      // 其他错误
      console.error('未捕获异常:', error);
    }
  });
}
```

## 7. 性能调优建议

### 7.1 权限缓存优化

```typescript
// 示例：自定义权限缓存策略
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    // 实现更高效的权限获取逻辑
    // 1. 优先从 Redis 等分布式缓存获取
    // 2. 缓存未命中时从数据库获取并更新缓存
    // 3. 设置合理的缓存过期时间
    
    const cacheKey = `permissions:${tenantId}:${subjectId}`;
    let permissions = await redisClient.get(cacheKey);
    
    if (permissions) {
      return new Set(JSON.parse(permissions));
    }
    
    // 从数据库获取
    permissions = await permissionRepository.getPermissions(tenantId, subjectId);
    
    // 缓存结果，设置过期时间为1小时
    await redisClient.set(cacheKey, JSON.stringify(Array.from(permissions)), 'EX', 3600);
    
    return permissions;
  }
});
```

### 7.2 批量权限检查优化

```typescript
// 示例：优化批量权限检查
async function checkMultiplePermissions(subject, permissions) {
  const context = mtpc.createContext(
    { id: subject.tenantId },
    { id: subject.id, type: 'user' }
  );

  // 准备权限检查上下文
  const permissionContexts = permissions.map(p => {
    const [resource, action] = p.split(':');
    return {
      ...context,
      resource,
      action
    };
  });

  // 使用 Promise.all 并行检查
  const results = await Promise.all(
    permissionContexts.map(ctx => mtpc.checkPermission(ctx))
  );

  // 返回 Map 结构便于查询
  const resultMap = new Map();
  for (let i = 0; i < permissions.length; i++) {
    resultMap.set(permissions[i], results[i]);
  }

  return resultMap;
}

// 如果需要控制并发数，可以使用 p-limit 或类似库
import pLimit from 'p-limit';

async function checkMultiplePermissionsWithLimit(subject, permissions, maxConcurrency = 10) {
  const context = mtpc.createContext(
    { id: subject.tenantId },
    { id: subject.id, type: 'user' }
  );

  const limit = pLimit(maxConcurrency);
  const tasks = permissions.map(p =>
    limit(async () => {
      const [resource, action] = p.split(':');
      return await mtpc.checkPermission({ ...context, resource, action });
    })
  );

  const results = await Promise.all(tasks);

  const resultMap = new Map();
  for (let i = 0; i < permissions.length; i++) {
    resultMap.set(permissions[i], results[i]);
  }

  return resultMap;
}
```

### 7.3 策略优化

```typescript
// 示例：优化策略定义
// 1. 按优先级合理组织策略
// 2. 避免过度复杂的条件
// 3. 使用通配符减少策略数量

// 高优先级策略：精确匹配
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

// 中优先级策略：按角色匹配
mtpc.registerPolicy({
  id: 'role-based-policy',
  name: '基于角色的策略',
  rules: [{
    permissions: ['user:read', 'order:*'],
    effect: 'allow',
    conditions: [{
      type: 'field',
      field: 'subject.attributes.role',
      operator: 'eq',
      value: 'manager'
    }]
  }],
  priority: 'medium',
  enabled: true
});
```

### 7.4 资源定义优化

```typescript
// 示例：优化资源定义
// 1. 只启用必要的特性
// 2. 合理定义自定义权限
// 3. 避免过度复杂的 schema

const optimizedResource = defineResource({
  name: 'product',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    stock: z.number()
  }),
  features: {
    create: true,
    read: true,
    update: true,
    // 禁用不需要的 delete 特性
    delete: false,
    // 只启用必要的自定义特性
    export: true
  },
  // 只定义必要的自定义权限
  permissions: [
    {
      action: 'publish',
      description: '发布产品'
    }
  ]
});
```

## 8. 性能监控与分析

### 8.1 监控权限检查性能

```typescript
// 示例：监控权限检查性能
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
    allowed: result.allowed,
    tenantId: context.tenant.id,
    subjectId: context.subject.id
  });

  // 如果性能超过阈值，记录详细信息
  if (duration > 100) { // 超过100ms
    console.warn('权限检查性能警告:', {
      ...context,
      duration: `${duration.toFixed(2)}ms`
    });
  }

  return result;
};
```

### 8.2 权限决策调试

```typescript
// 示例：调试权限决策问题
async function debugPermissionIssue(permissionContext) {
  // 检查权限
  const result = await mtpc.checkPermission(permissionContext);

  if (!result.allowed) {
    // 分析拒绝原因
    console.log('权限拒绝分析:');
    console.log('- 权限:', `${permissionContext.resource}:${permissionContext.action}`);
    console.log('- 主体:', permissionContext.subject.id);
    console.log('- 原因:', result.reason);
    console.log('- 评估时间:', result.evaluationTime, 'ms');

    // 检查可用权限
    if (permissionContext.subject.permissions) {
      console.log('- 主体权限:', Array.from(permissionContext.subject.permissions));
    }

    // 检查策略
    const summary = mtpc.getSummary();
    console.log('- 系统策略数:', summary.policies);

    // 评估策略（用于调试）
    const policyResult = await mtpc.evaluatePolicy({
      ...permissionContext,
      permissions: new Set([`${permissionContext.resource}:${permissionContext.action}`])
    });
    console.log('- 策略评估:', policyResult);
  }
}
```

## 9. 最佳实践总结

1. **设计原则**：
   - 遵循业务无关原则，保持权限逻辑与业务逻辑分离
   - 采用 Schema / Resource 定义作为单一事实源
   - 优先使用编译期与启动期派生，减少运行时计算
   - 遵循默认拒绝原则，确保安全

2. **代码组织**：
   - 集中管理资源定义
   - 按功能模块组织策略
   - 使用插件扩展功能，保持核心代码简洁
   - 为权限检查添加详细日志

3. **性能优化**：
   - 合理使用权限缓存
   - 批量处理权限检查
   - 优化策略评估逻辑
   - 监控性能指标

4. **安全实践**：
   - 始终验证租户上下文
   - 避免硬编码权限
   - 定期审查权限配置
   - 实现最小权限原则

5. **可维护性**：
   - 为资源和权限添加清晰的描述
   - 使用一致的命名规范
   - 编写单元测试和集成测试
   - 保持文档更新

## 10. 附录

### 10.1 核心 API 参考

| API | 描述 |
| --- | --- |
| `createMTPC(options)` | 创建 MTPC 实例 |
| `defineResource(definition)` | 定义资源 |
| `mtpc.registerResource(resource)` | 注册资源 |
| `mtpc.registerResources(resources)` | 批量注册资源 |
| `mtpc.registerPolicy(policy)` | 注册策略 |
| `mtpc.registerPolicies(policies)` | 批量注册策略 |
| `mtpc.use(plugin)` | 使用插件 |
| `mtpc.init()` | 初始化 MTPC 实例 |
| `mtpc.isInitialized()` | 检查是否已初始化 |
| `mtpc.createContext(tenant, subject)` | 创建上下文 |
| `mtpc.checkPermission(context)` | 检查权限 |
| `mtpc.requirePermission(context)` | 检查权限并在无权限时抛出异常 |
| `mtpc.evaluatePolicy(context)` | 评估策略 |
| `mtpc.getPermissionCodes()` | 获取所有权限代码 |
| `mtpc.getResourceNames()` | 获取所有资源名称 |
| `mtpc.getResource(name)` | 根据名称获取资源定义 |
| `mtpc.exportMetadata()` | 导出元数据供 UI 使用 |
| `mtpc.getSummary()` | 获取系统摘要信息 |

### 10.2 错误类型

| 错误类型 | 描述 |
| --- | --- |
| `PermissionDeniedError` | 权限拒绝错误 |
| `InvalidTenantError` | 无效的租户ID |
| `MissingTenantContextError` | 缺少租户上下文 |
| `ResourceNotFoundError` | 资源未找到 |
| `PolicyNotFoundError` | 策略未找到 |

### 10.3 性能指标

| 指标 | 目标值 | 优化建议 |
| --- | --- | --- |
| 权限检查延迟 | < 50ms | 优化权限解析器，使用缓存 |
| 批量权限检查吞吐量 | > 1000 QPS | 使用并行执行，调整并发数 |
| 策略评估延迟 | < 10ms | 优化策略条件，减少复杂规则 |
| 缓存命中率 | > 90% | 优化缓存策略，调整过期时间 |

## 11. 示例项目

完整的示例项目可以在 `examples/` 目录下找到，包括：

- `basic-example`: 基础使用示例
- `hono-integration`: 与 Hono 框架集成示例
- `rbac-example`: 基于角色的访问控制示例
- `performance-test`: 性能测试示例

运行示例：

```bash
# 进入示例目录
cd examples/basic-example

# 安装依赖
pnpm install

# 运行示例
pnpm start
```

## 12. 常见问题

### Q: 如何扩展自定义条件类型？
A: 使用 `mtpc.policyEngine.addConditionHandler(type, handler)` 方法添加自定义条件处理器。

### Q: 如何实现基于属性的访问控制（ABAC）？
A: 利用策略条件系统，通过 `field` 类型条件检查主体、资源或环境属性。

### Q: 如何处理权限变更时的缓存失效？
A: 实现权限变更事件监听，当权限发生变化时，主动清除相关缓存。

### Q: 如何与现有权限系统集成？
A: 实现自定义 `defaultPermissionResolver`，从现有系统获取权限数据。

### Q: 如何进行权限审计？
A: 使用钩子系统，在权限检查前后记录审计日志。

## 13. 版本更新

### 1.0.0
- 初始版本发布
- 核心功能实现：资源定义、策略引擎、权限检查器
- 支持多租户上下文
- 插件系统和钩子系统
- 基本性能优化

### 1.1.0
- 新增批量权限检查功能
- 优化策略评估算法
- 增强错误处理机制
- 添加性能监控支持

### 1.2.0
- 新增自定义条件类型支持
- 增强租户管理功能
- 优化权限缓存机制
- 添加更多示例和文档

## 14. 贡献指南

欢迎提交 Issue 和 Pull Request！请遵循以下准则：

1. 提交前确保所有测试通过
2. 遵循现有代码风格
3. 为新功能添加文档和示例
4. 编写单元测试
5. 提交清晰的 Commit 消息

## 15. 许可证

MIT License

## 16. 联系信息

- 项目地址：https://github.com/mtpc/core
- 文档地址：https://mtpc.io/docs
- 问题反馈：https://github.com/mtpc/core/issues

---

以上就是 MTPC Core 的详细使用指南。通过遵循这些最佳实践和示例，您可以在自己的项目中高效地使用 MTPC 进行权限管理。