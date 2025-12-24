# @mtpc/versioning

MTPC（Multi-Tenant Permission Core）的版本控制扩展包，提供资源的乐观锁机制，防止并发更新冲突，支持自定义版本字段，帮助开发者实现安全的资源更新。

## 功能特性

- ✅ 支持乐观锁机制，防止并发更新冲突
- ✅ 支持自定义版本字段名
- ✅ 提供版本冲突错误类型
- ✅ 灵活的配置选项，支持不同资源使用不同的版本控制策略
- ✅ 完善的 TypeScript 类型定义
- ✅ 插件化设计，易于集成到 MTPC 系统

## 安装

```bash
pnpm add @mtpc/versioning
```

## 核心概念

### 乐观锁机制

乐观锁是一种并发控制机制，它假设多个事务在大多数情况下不会互相影响，因此不会立即加锁，而是在提交更新时检查是否有其他事务已经修改了数据。

在 versioning 包中，乐观锁通过版本号实现：
1. 当读取资源时，记录其当前版本号
2. 当更新资源时，带上期望的版本号
3. 系统检查期望版本号与实际版本号是否匹配
4. 如果匹配，则更新资源并递增版本号
5. 如果不匹配，则抛出版本冲突错误

### 版本冲突错误

当并发更新同一资源导致版本号不匹配时，会抛出 `VersionConflictError` 错误，包含以下信息：
- `message`: 错误消息
- `expected`: 期望的版本号
- `actual`: 实际的版本号

## 快速开始

### 1. 注册插件

```typescript
import { createMTPC } from '@mtpc/core';
import { createVersioningPlugin } from '@mtpc/versioning';

// 创建 MTPC 实例
const mtpc = createMTPC({
  // MTPC 配置
});

// 注册版本控制插件
const versioningPlugin = createVersioningPlugin();
mtpc.registerPlugin(versioningPlugin);
```

### 2. 为资源配置版本控制

```typescript
// 为特定资源配置版本控制
versioningPlugin.state.configureResource({
  resourceName: 'user',
  versionField: 'version' // 可选，默认 'version'
}, mtpc.context);

// 为另一个资源配置版本控制，使用自定义版本字段
versioningPlugin.state.configureResource({
  resourceName: 'product',
  versionField: 'revision'
}, mtpc.context);
```

### 3. 使用版本控制功能

一旦配置完成，版本控制功能会自动生效：

```typescript
// 读取资源（获取当前版本）
const user = await mtpc.getResource('user', 'user123');

// 更新资源时，带上当前版本号
await mtpc.updateResource('user', 'user123', {
  name: 'New Name',
  version: user.version // 带上期望的版本号
});

// 如果有并发更新，会抛出 VersionConflictError
```

## 配置选项

### `VersioningConfig`

| 配置项 | 类型 | 描述 | 默认值 |
|--------|------|------|--------|
| `resourceName` | `string` | 资源名称 | 必填 |
| `versionField` | `string` | 版本字段名 | `'version'` |

## API 参考

### `createVersioningPlugin()`

创建版本控制插件实例。

**返回值**：
```typescript
PluginDefinition & {
  state: VersioningPluginState & {
    configureResource: (config: VersioningConfig, context: PluginContext) => void;
  };
}
```

### `configureResource(config, context)`

为特定资源配置版本控制。

**参数**：
- `config`：版本控制配置
- `context`：MTPC 上下文

### `createVersioningHooks(config)`

直接创建版本控制钩子，用于自定义集成。

**参数**：
- `config`：版本控制配置

**返回值**：
```typescript
Partial<ResourceHooks<T>>
```

### `VersionConflictError`

版本冲突错误类，用于表示乐观锁冲突。

**构造函数**：
```typescript
new VersionConflictError(message: string, expected?: number, actual?: number)
```

## 示例用法

### 基本使用

```typescript
import { createMTPC } from '@mtpc/core';
import { createVersioningPlugin, VersionConflictError } from '@mtpc/versioning';

// 创建 MTPC 实例
const mtpc = createMTPC({
  tenants: [{ id: 'tenant123', name: 'Test Tenant' }],
  roles: [{ id: 'admin', name: '管理员' }]
});

// 注册版本控制插件
const versioningPlugin = createVersioningPlugin();
mtpc.registerPlugin(versioningPlugin);

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

// 为用户资源配置版本控制
versioningPlugin.state.configureResource({
  resourceName: 'user',
  versionField: 'version'
}, mtpc.context);

// 现在，用户资源已启用版本控制功能
// 更新用户时需要带上版本号
// 并发更新可能会抛出 VersionConflictError
```

### 处理版本冲突

```typescript
import { VersionConflictError } from '@mtpc/versioning';

async function updateUser(id: string, updates: Partial<User>) {
  let retries = 3;
  
  while (retries > 0) {
    try {
      // 1. 读取资源，获取当前版本
      const user = await mtpc.getResource('user', id);
      
      // 2. 合并更新，带上当前版本号
      const updateData = {
        ...updates,
        version: user.version
      };
      
      // 3. 尝试更新资源
      const updatedUser = await mtpc.updateResource('user', id, updateData);
      
      return updatedUser;
    } catch (error) {
      // 4. 处理版本冲突
      if (error instanceof VersionConflictError && retries > 1) {
        retries--;
        // 可以选择等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      // 其他错误或重试次数用尽，抛出错误
      throw error;
    }
  }
}
```

### 不同资源使用不同的版本控制配置

```typescript
// 为用户资源配置版本控制
versioningPlugin.state.configureResource({
  resourceName: 'user',
  versionField: 'version'
}, mtpc.context);

// 为产品资源配置版本控制，使用自定义版本字段
versioningPlugin.state.configureResource({
  resourceName: 'product',
  versionField: 'revision'
}, mtpc.context);

// 为订单资源配置版本控制，使用另一个自定义版本字段
versioningPlugin.state.configureResource({
  resourceName: 'order',
  versionField: 'updateCount'
}, mtpc.context);
```

### 直接使用版本控制钩子

```typescript
import { createVersioningHooks } from '@mtpc/versioning';

// 直接创建版本控制钩子
const hooks = createVersioningHooks({
  resourceName: 'user',
  versionField: 'version'
});

// 手动注册钩子
mtpc.registerResourceHooks('user', hooks);
```

## 工作原理

1. **注册插件**：将版本控制插件注册到 MTPC 实例
2. **配置资源**：为特定资源配置版本控制参数
3. **钩子生效**：插件为资源注册 `beforeUpdate` 和 `afterUpdate` 钩子
4. **版本透传**：更新资源时，`beforeUpdate` 钩子保留版本字段，传递给上层 Adapter
5. **冲突检测**：由上层 Adapter（如 ORM/数据库）利用版本字段进行实际的冲突检测
6. **错误处理**：如果版本冲突，抛出 `VersionConflictError` 错误

## 与其他包的配合

### 与 Audit 包配合

版本更新操作可以与 Audit 包配合，记录版本变更事件：

```typescript
// 在 Adapter/Repository 中实现版本控制
async function updateResource(resource: string, id: string, data: any) {
  try {
    // 执行版本化更新
    const updated = await db[resource].update({
      where: { 
        id, 
        version: data.version // 利用版本字段做乐观锁
      },
      data: { 
        ...data, 
        version: sql`${data.version} + 1` // 版本号递增
      }
    });
    
    // 记录审计事件
    await audit.logResourceOperation({
      ctx,
      operation: 'update',
      resource,
      resourceId: id,
      success: true,
      before: oldData,
      after: updated
    });
    
    return updated;
  } catch (error) {
    // 记录失败的审计事件
    await audit.logResourceOperation({
      ctx,
      operation: 'update',
      resource,
      resourceId: id,
      success: false,
      reason: error.message
    });
    
    throw error;
  }
}
```

### 与 DevTools 包配合

可以使用 DevTools 包调试版本控制配置：

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
