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

### 在 MTPS 中的完整集成示例

```typescript
import { createMTPC } from '@mtpc/core';
import { createSoftDeletePlugin } from '@mtpc/soft-delete';
import { createPostgresConnection } from '@mtpc/adapter-drizzle/pg';
import { defineResource } from '@mtpc/core';
import { z } from 'zod';

// 定义用户资源
const userResource = defineResource({
  name: 'user',
  schema: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    deletedAt: z.date().nullable().optional(),
    deletedBy: z.string().nullable().optional(),
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: true,
    list: true,
  },
  permissions: [
    { action: 'create', description: '创建用户' },
    { action: 'read', description: '查看用户' },
    { action: 'update', description: '更新用户' },
    { action: 'delete', description: '删除用户' },
    { action: 'restore', description: '恢复用户' },
  ],
});

// 创建 MTPC 实例
const mtpc = createMTPC();
mtpc.registerResource(userResource);

// 创建数据库连接
const connection = createPostgresConnection({
  url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mtps',
});

// 注册软删除插件
const softDeletePlugin = createSoftDeletePlugin();
mtpc.use(softDeletePlugin);

// 初始化 MTPC
await mtpc.init();

// 为用户资源配置软删除
softDeletePlugin.state.configureResource({
  resourceName: 'user',
  deletedAtField: 'deletedAt',
  deletedByField: 'deletedBy',
  autoFilter: true,
}, mtpc.context);

// 在 Repository 中实现软删除逻辑
class UserRepository {
  constructor(private db: typeof connection.db, private schema: any) {}

  async softDelete(tenantId: string, userId: string, deletedBy: string) {
    return this.db.update(this.schema.user)
      .set({
        deletedAt: new Date(),
        deletedBy,
      })
      .where(
        and(
          eq(this.schema.user.id, userId),
          eq(this.schema.user.tenantId, tenantId)
        )
      );
  }

  async restore(tenantId: string, userId: string) {
    return this.db.update(this.schema.user)
      .set({
        deletedAt: null,
        deletedBy: null,
      })
      .where(
        and(
          eq(this.schema.user.id, userId),
          eq(this.schema.user.tenantId, tenantId)
        )
      );
  }

  async findDeleted(tenantId: string) {
    return this.db.select()
      .from(this.schema.user)
      .where(
        and(
          eq(this.schema.user.tenantId, tenantId),
          isNotNull(this.schema.user.deletedAt)
        )
      );
  }

  async findActive(tenantId: string) {
    return this.db.select()
      .from(this.schema.user)
      .where(
        and(
          eq(this.schema.user.tenantId, tenantId),
          isNull(this.schema.user.deletedAt)
        )
      );
  }
}

// 使用示例
const userRepository = new UserRepository(connection.db, connection.schema);

// 软删除用户
await userRepository.softDelete('tenant-1', 'user-123', 'admin-456');

// 恢复用户
await userRepository.restore('tenant-1', 'user-123');

// 查询已删除的用户
const deletedUsers = await userRepository.findDeleted('tenant-1');

// 查询活跃用户（自动过滤软删除记录）
const activeUsers = await userRepository.findActive('tenant-1');
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

### 恢复软删除记录

```typescript
import { eq, and, isNull } from 'drizzle-orm';

// 在 Repository 中实现恢复功能
class UserRepository {
  async restore(tenantId: string, userId: string, restoredBy: string) {
    const result = await this.db.update(this.schema.user)
      .set({
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(this.schema.user.id, userId),
          eq(this.schema.user.tenantId, tenantId),
          isNotNull(this.schema.user.deletedAt) // 只恢复已删除的记录
        )
      )
      .returning();

    if (result.length === 0) {
      throw new Error('用户不存在或未被删除');
    }

    return result[0];
  }
}

// 使用示例
try {
  const restoredUser = await userRepository.restore('tenant-1', 'user-123', 'admin-456');
  console.log('用户已恢复:', restoredUser);
} catch (error) {
  console.error('恢复失败:', error.message);
}
```

### 查询软删除记录

```typescript
import { eq, and, isNotNull, isNull } from 'drizzle-orm';

class UserRepository {
  // 查询所有已删除的用户
  async findDeleted(tenantId: string) {
    return this.db.select()
      .from(this.schema.user)
      .where(
        and(
          eq(this.schema.user.tenantId, tenantId),
          isNotNull(this.schema.user.deletedAt)
        )
      )
      .orderBy(desc(this.schema.user.deletedAt));
  }

  // 查询特定时间范围内删除的用户
  async findDeletedByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ) {
    return this.db.select()
      .from(this.schema.user)
      .where(
        and(
          eq(this.schema.user.tenantId, tenantId),
          isNotNull(this.schema.user.deletedAt),
          gte(this.schema.user.deletedAt, startDate),
          lte(this.schema.user.deletedAt, endDate)
        )
      );
  }

  // 查询由特定用户删除的记录
  async findDeletedBy(tenantId: string, deletedBy: string) {
    return this.db.select()
      .from(this.schema.user)
      .where(
        and(
          eq(this.schema.user.tenantId, tenantId),
          isNotNull(this.schema.user.deletedAt),
          eq(this.schema.user.deletedBy, deletedBy)
        )
      );
  }

  // 统计已删除的用户数量
  async countDeleted(tenantId: string) {
    const result = await this.db.select({ count: count() })
      .from(this.schema.user)
      .where(
        and(
          eq(this.schema.user.tenantId, tenantId),
          isNotNull(this.schema.user.deletedAt)
        )
      );

    return result[0].count;
  }
}

// 使用示例
const deletedUsers = await userRepository.findDeleted('tenant-1');
const deletedInLastMonth = await userRepository.findDeletedByDateRange(
  'tenant-1',
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  new Date()
);
const deletedByAdmin = await userRepository.findDeletedBy('tenant-1', 'admin-456');
const deletedCount = await userRepository.countDeleted('tenant-1');
```

### 批量软删除

```typescript
import { inArray } from 'drizzle-orm';

class UserRepository {
  async batchSoftDelete(
    tenantId: string,
    userIds: string[],
    deletedBy: string
  ) {
    return this.db.update(this.schema.user)
      .set({
        deletedAt: new Date(),
        deletedBy,
      })
      .where(
        and(
          eq(this.schema.user.tenantId, tenantId),
          inArray(this.schema.user.id, userIds)
        )
      );
  }

  async batchRestore(
    tenantId: string,
    userIds: string[]
  ) {
    return this.db.update(this.schema.user)
      .set({
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(this.schema.user.tenantId, tenantId),
          inArray(this.schema.user.id, userIds)
        )
      );
  }
}

// 使用示例
await userRepository.batchSoftDelete(
  'tenant-1',
  ['user-1', 'user-2', 'user-3'],
  'admin-456'
);

await userRepository.batchRestore(
  'tenant-1',
  ['user-1', 'user-2']
);
```

### 级联软删除

```typescript
// 当删除用户时，级联删除其相关数据
class UserRepository {
  async cascadeSoftDelete(tenantId: string, userId: string, deletedBy: string) {
    await this.db.transaction(async (tx) => {
      // 软删除用户的订单
      await tx.update(this.schema.order)
        .set({
          deletedAt: new Date(),
          deletedBy,
        })
        .where(
          and(
            eq(this.schema.order.tenantId, tenantId),
            eq(this.schema.order.userId, userId)
          )
        );

      // 软删除用户的评论
      await tx.update(this.schema.comment)
        .set({
          deletedAt: new Date(),
          deletedBy,
        })
        .where(
          and(
            eq(this.schema.comment.tenantId, tenantId),
            eq(this.schema.comment.userId, userId)
          )
        );

      // 软删除用户
      await tx.update(this.schema.user)
        .set({
          deletedAt: new Date(),
          deletedBy,
        })
        .where(
          and(
            eq(this.schema.user.id, userId),
            eq(this.schema.user.tenantId, tenantId)
          )
        );
    });
  }
}

// 使用示例
await userRepository.cascadeSoftDelete('tenant-1', 'user-123', 'admin-456');
```

### 软删除的数据迁移

```typescript
// 数据迁移脚本：为现有数据添加软删除字段
import { migrate } from 'drizzle-orm/postgres-js/migrator';

async function addSoftDeleteFields() {
  // 添加软删除字段
  await connection.db.execute(sql`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255) NULL
  `);

  // 创建索引以提高查询性能
  await connection.db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_users_deleted_at 
    ON users(deleted_at)
  `);

  await connection.db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_users_tenant_deleted 
    ON users(tenant_id, deleted_at)
  `);

  console.log('软删除字段添加完成');
}

// 迁移现有数据：将已硬删除的数据标记为软删除
async function migrateHardDeletedData() {
  // 假设有一个备份表包含已删除的用户
  const deletedUsers = await connection.db.execute(sql`
    SELECT * FROM users_backup WHERE status = 'deleted'
  `);

  for (const user of deletedUsers) {
    await connection.db.update(connection.schema.user)
      .set({
        deletedAt: user.deletedAt || new Date(),
        deletedBy: user.deletedBy || 'system',
      })
      .where(eq(connection.schema.user.id, user.id));
  }

  console.log(`已迁移 ${deletedUsers.length} 条删除记录`);
}
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
