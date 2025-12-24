# @mtpc/soft-delete

MTPC（Multi-Tenant Permission Core）的软删除扩展包，提供资源的软删除功能，支持时间戳字段和布尔标志两种软删除方式，帮助开发者实现资源的安全删除和恢复。

## 功能特性

- ✅ 支持时间戳软删除（deletedAt 字段）
- ✅ 支持布尔标志软删除（isDeleted 字段）
- ✅ 自动过滤软删除记录
- ✅ 支持记录删除人信息（deletedBy 字段）
- ✅ 灵活的配置选项，支持不同资源使用不同的软删除策略
- ✅ 完善的 TypeScript 类型定义
- ✅ 插件化设计，易于集成到 MTPC 系统

## 安装

```bash
pnpm add @mtpc/soft-delete
```

## 核心概念

### 软删除方式

#### 1. 时间戳方式（推荐）

使用时间戳字段（如 `deletedAt`）标记资源是否被删除：
- 未删除：`deletedAt` 为 `null` 或 `undefined`
- 已删除：`deletedAt` 为删除时间的时间戳

#### 2. 布尔标志方式

使用布尔字段（如 `isDeleted`）标记资源是否被删除：
- 未删除：`isDeleted` 为 `false`
- 已删除：`isDeleted` 为 `true`

## 快速开始

### 1. 注册插件

```typescript
import { createMTPC } from '@mtpc/core';
import { createSoftDeletePlugin } from '@mtpc/soft-delete';

// 创建 MTPC 实例
const mtpc = createMTPC({
  // MTPC 配置
});

// 注册软删除插件
const softDeletePlugin = createSoftDeletePlugin();
mtpc.registerPlugin(softDeletePlugin);
```

### 2. 为资源配置软删除

```typescript
// 为特定资源配置软删除（时间戳方式）
softDeletePlugin.state.configureResource({
  resourceName: 'user',
  deletedAtField: 'deletedAt', // 可选，默认 'deletedAt'
  deletedByField: 'deletedBy', // 可选，记录删除人
  autoFilter: true // 可选，自动过滤软删除记录，默认 true
}, mtpc.context);

// 为另一个资源配置软删除（布尔标志方式）
softDeletePlugin.state.configureResource({
  resourceName: 'product',
  flagField: 'isDeleted', // 使用布尔标志
  autoFilter: true
}, mtpc.context);
```

### 3. 使用软删除功能

一旦配置完成，软删除功能会自动生效：

```typescript
// 查询资源时，会自动排除软删除记录
const users = await mtpc.queryResources('user', { /* 查询条件 */ });

// 删除资源时，会触发软删除钩子
await mtpc.deleteResource('user', 'user123');
```

## 配置选项

### `SoftDeleteConfig`

| 配置项 | 类型 | 描述 | 默认值 |
|--------|------|------|--------|
| `resourceName` | `string` | 资源名称 | 必填 |
| `deletedAtField` | `string` | 时间戳字段名 | `'deletedAt'` |
| `deletedByField` | `string` | 删除人字段名 | 可选 |
| `flagField` | `string` | 布尔标志字段名 | 可选（与 deletedAtField 二选一） |
| `autoFilter` | `boolean` | 是否自动过滤软删除记录 | `true` |

## API 参考

### `createSoftDeletePlugin()`

创建软删除插件实例。

**返回值**：
```typescript
PluginDefinition & {
  state: SoftDeletePluginState & {
    configureResource: (config: SoftDeleteConfig, context: PluginContext) => void;
  };
}
```

### `configureResource(config, context)`

为特定资源配置软删除。

**参数**：
- `config`：软删除配置
- `context`：MTPC 上下文

### `createSoftDeleteHooks(config)`

直接创建软删除钩子，用于自定义集成。

**参数**：
- `config`：软删除配置

**返回值**：
```typescript
Partial<ResourceHooks<T>>
```

## 示例用法

### 基本使用

```typescript
import { createMTPC } from '@mtpc/core';
import { createSoftDeletePlugin } from '@mtpc/soft-delete';

// 创建 MTPC 实例
const mtpc = createMTPC({
  tenants: [{ id: 'tenant123', name: 'Test Tenant' }],
  roles: [{ id: 'admin', name: '管理员' }]
});

// 注册软删除插件
const softDeletePlugin = createSoftDeletePlugin();
mtpc.registerPlugin(softDeletePlugin);

// 注册资源
mtpc.registerResource({
  name: 'user',
  metadata: { displayName: '用户' },
  permissions: [
    { action: 'read', name: '读取用户' },
    { action: 'write', name: '写入用户' },
    { action: 'delete', name: '删除用户' }
  ]
});

// 为用户资源配置软删除
softDeletePlugin.state.configureResource({
  resourceName: 'user',
  deletedAtField: 'deletedAt',
  deletedByField: 'deletedBy'
}, mtpc.context);

// 现在，用户资源已启用软删除功能
// 查询用户时会自动排除已删除的用户
// 删除用户时会触发软删除逻辑
```

### 不同资源使用不同的软删除配置

```typescript
// 为用户资源配置软删除（时间戳方式）
softDeletePlugin.state.configureResource({
  resourceName: 'user',
  deletedAtField: 'deletedAt',
  deletedByField: 'deletedBy'
}, mtpc.context);

// 为产品资源配置软删除（布尔标志方式）
softDeletePlugin.state.configureResource({
  resourceName: 'product',
  flagField: 'isDeleted',
  autoFilter: true
}, mtpc.context);

// 为订单资源配置软删除，但不自动过滤
softDeletePlugin.state.configureResource({
  resourceName: 'order',
  deletedAtField: 'deletedAt',
  autoFilter: false // 不自动过滤，需要手动处理
}, mtpc.context);
```

### 直接使用软删除钩子

```typescript
import { createSoftDeleteHooks } from '@mtpc/soft-delete';

// 直接创建软删除钩子
const hooks = createSoftDeleteHooks({
  resourceName: 'user',
  deletedAtField: 'deletedAt'
});

// 手动注册钩子
mtpc.registerResourceHooks('user', hooks);
```

## 工作原理

1. **注册插件**：将软删除插件注册到 MTPC 实例
2. **配置资源**：为特定资源配置软删除参数
3. **钩子生效**：插件为资源注册 `beforeDelete` 和 `filterQuery` 钩子
4. **自动过滤**：查询资源时，`filterQuery` 钩子自动添加过滤条件，排除软删除记录
5. **软删除处理**：删除资源时，`beforeDelete` 钩子被调用，由上层 Adapter/Repository 实现具体的软删除逻辑

## 与其他包的配合

### 与 Audit 包配合

软删除操作可以与 Audit 包配合，记录软删除事件：

```typescript
// 在 Adapter/Repository 中实现软删除逻辑
async function deleteUser(id: string, ctx: MTPCContext) {
  // 执行软删除操作
  await db.user.update({ 
    where: { id },
    data: { 
      deletedAt: new Date(),
      deletedBy: ctx.subject.id
    }
  });
  
  // 记录审计事件
  await audit.logResourceOperation({
    ctx,
    operation: 'soft-delete',
    resource: 'user',
    resourceId: id,
    success: true
  });
}
```

### 与 DevTools 包配合

可以使用 DevTools 包调试软删除配置：

```typescript
import { createSnapshot } from '@mtpc/devtools';

// 创建 MTPC 状态快照
const snapshot = createSnapshot(mtpc);

// 查看资源配置
console.log(snapshot.resources);
```

## 测试

```bash
# 运行测试（如果有）
pnpm test
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
