# @mtpc/soft-delete 使用指南

## 目录

1. [概述](#1-概述)
2. [安装与配置](#2-安装与配置)
3. [核心概念](#3-核心概念)
4. [快速开始](#4-快速开始)
5. [API 接口说明](#5-api-接口说明)
6. [参数配置详解](#6-参数配置详解)
7. [使用示例代码](#7-使用示例代码)
8. [常见问题解决方案](#8-常见问题解决方案)
9. [最佳实践建议](#9-最佳实践建议)
10. [高级用法](#10-高级用法)

---

## 1. 概述

### 1.1 什么是 @mtpc/soft-delete

`@mtpc/soft-delete` 是 MTPC（Multi-Tenant Permission Core）的官方扩展包，提供资源的软删除功能。作为 MTPC 架构中的"First-class Extension"，它遵循以下设计原则：

- **业务无关**：不绑定具体业务逻辑，仅提供软删除能力
- **可插拔**：通过插件机制集成，不影响 Core API
- **模型无关**：不依赖具体的数据模型或存储实现
- **Tenant-aware**：完全支持多租户上下文

### 1.2 核心特性

1. **两种软删除模式**：
   - 时间戳模式：使用 `deletedAt` 字段标记删除时间
   - 布尔标志模式：使用 `isDeleted` 字段标记删除状态

2. **自动过滤机制**：
   - 通过 `filterQuery` 钩子自动排除已删除记录
   - 可配置是否启用自动过滤

3. **删除人追踪**：
   - 可选的 `deletedBy` 字段记录删除操作者

4. **灵活配置**：
   - 每个资源可独立配置软删除策略
   - 支持不同的字段名称

### 1.3 设计理念

根据源码实现，该包的设计理念是：

> 核心钩子本身无法直接更新数据库，只能约定"软删除语义"。具体的持久化（将 deletedAt/deletedBy 写入数据库）需要由 Adapter/Repository 实现。

这种设计遵循了 MTPC 的**分层架构**原则：
- **Core 层**：定义软删除的语义和接口
- **Adapter 层**：实现具体的数据库操作

### 1.4 适用场景

软删除适用于以下场景：

1. **数据安全**：防止误删除导致的数据丢失
2. **审计需求**：需要记录删除操作的历史
3. **数据恢复**：支持恢复已删除的数据
4. **合规要求**：某些行业要求数据保留一定时间
5. **业务需求**：需要查看或分析已删除的数据

---

## 2. 安装与配置

### 2.1 安装依赖

```bash
# 使用 pnpm 安装
pnpm add @mtpc/soft-delete

# 安装 MTPC Core（如果尚未安装）
pnpm add @mtpc/core

# 安装 Zod（用于 Schema 定义）
pnpm add zod
```

### 2.2 基本配置

```typescript
import { createMTPC } from '@mtpc/core';
import { createSoftDeletePlugin } from '@mtpc/soft-delete';

// 创建 MTPC 实例
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId: string, subjectId: string) => {
    // 实现自定义权限解析逻辑
    // 返回权限代码集合
    return new Set(['user:read', 'user:create']);
  }
});

// 创建软删除插件
const softDeletePlugin = createSoftDeletePlugin();

// 注册插件（使用 use 方法）
mtpc.use(softDeletePlugin);
```

### 2.3 TypeScript 配置

确保 `tsconfig.json` 包含以下配置：

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "moduleResolution": "node",
    "skipLibCheck": true
  }
}
```

---

## 3. 核心概念

### 3.1 软删除方式

#### 3.1.1 时间戳方式（推荐）

使用时间戳字段（如 `deletedAt`）标记资源是否被删除：

```typescript
// 数据库 Schema
{
  id: 'user-123',
  name: 'John Doe',
  deletedAt: null,  // 未删除
  deletedBy: null
}

// 删除后
{
  id: 'user-123',
  name: 'John Doe',
  deletedAt: '2024-01-15T10:30:00Z',  // 已删除
  deletedBy: 'admin-456'
}
```

**优点**：
- 可以记录删除时间
- 支持按时间范围查询
- 便于审计和分析

#### 3.1.2 布尔标志方式

使用布尔字段（如 `isDeleted`）标记资源是否被删除：

```typescript
// 数据库 Schema
{
  id: 'user-123',
  name: 'John Doe',
  isDeleted: false,  // 未删除
  deletedBy: null
}

// 删除后
{
  id: 'user-123',
  name: 'John Doe',
  isDeleted: true,  // 已删除
  deletedBy: 'admin-456'
}
```

**优点**：
- 查询性能更好
- 存储空间更小
- 逻辑更简单

### 3.2 钩子系统

#### 3.2.1 beforeDelete 钩子

在删除操作前执行，用于控制删除行为：

```typescript
const beforeDelete: SoftDeleteBeforeDeleteHook = async (ctx, id) => {
  // 返回 { proceed: true, data: id }
  // proceed: true 表示允许继续删除
  // data: id 传递给 Adapter/Repository
  return { proceed: true, data: id };
};
```

**行为**：
- 默认不阻断删除（`proceed: true`）
- 约定软删除的语义
- 具体的软删除逻辑由 Adapter/Repository 实现

#### 3.2.2 filterQuery 钩子

在查询资源前执行，用于自动过滤已删除记录：

```typescript
const filterQuery: SoftDeleteFilterQueryHook = (ctx, baseFilters) => {
  if (!autoFilter) {
    return baseFilters; // 不自动过滤
  }

  const filters: FilterCondition[] = [...baseFilters];

  if (flagField) {
    // 布尔标志模式：flagField = false
    filters.push({
      field: flagField,
      operator: 'eq',
      value: false,
    });
  } else {
    // 时间戳模式：deletedAtField IS NULL
    filters.push({
      field: deletedAtField,
      operator: 'isNull',
      value: null,
    });
  }

  return filters;
};
```

**行为**：
- 根据 `autoFilter` 配置决定是否启用自动过滤
- 将过滤条件追加到基础过滤条件之后
- 使用不可变模式，避免副作用

### 3.3 插件系统

#### 3.3.1 插件生命周期

```typescript
const plugin: PluginDefinition = {
  name: '@mtpc/soft-delete',
  version: '0.1.0',

  // install 阶段：注册钩子
  install(context: PluginContext) {
    // 配置资源软删除
    plugin.state.configureResource(config, context);
  },

  // onInit 阶段：初始化插件
  onInit() {
    // 无需初始化操作
  },

  // onDestroy 阶段：清理资源
  onDestroy() {
    // 清理配置，防止内存泄漏
  },

  // 插件状态
  state: {
    configs: new Map(),
    configureResource(config, context) {
      // 配置逻辑
    }
  }
};
```

#### 3.3.2 插件状态管理

```typescript
// 获取插件实例
const plugin = mtpc.getPlugin('@mtpc/soft-delete');

if (plugin) {
  // 访问插件状态
  const configs = plugin.state.configs;

  // 获取特定资源的配置
  const userConfig = configs.get('user');

  console.log('用户资源配置:', userConfig);
}
```

---

## 4. 快速开始

### 4.1 完整示例

```typescript
import { createMTPC } from '@mtpc/core';
import { createSoftDeletePlugin } from '@mtpc/soft-delete';
import { defineResource } from '@mtpc/core';
import { z } from 'zod';

// 1. 定义用户资源
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

// 2. 创建 MTPC 实例
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    // 实现权限解析逻辑
    return new Set(['user:read', 'user:create']);
  }
});

// 3. 创建软删除插件
const softDeletePlugin = createSoftDeletePlugin();

// 4. 配置插件
const originalInstall = softDeletePlugin.install;
softDeletePlugin.install = (context) => {
  // 为用户资源配置软删除
  softDeletePlugin.state.configureResource({
    resourceName: 'user',
    deletedAtField: 'deletedAt',
    deletedByField: 'deletedBy',
    autoFilter: true,
  }, context);

  // 调用原始的 install 方法
  if (originalInstall) {
    originalInstall.call(softDeletePlugin, context);
  }
};

// 5. 注册资源和插件
mtpc.registerResource(userResource);
mtpc.use(softDeletePlugin);

// 6. 初始化 MTPC
await mtpc.init();

console.log('MTPC 初始化完成');
```

### 4.2 数据库 Schema

```sql
-- 创建用户表
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  deleted_at TIMESTAMP NULL,
  deleted_by VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
CREATE INDEX idx_users_tenant_deleted ON users(tenant_id, deleted_at);
```

### 4.3 Adapter/Repository 实现

```typescript
import { eq, and, isNull, isNotNull } from 'drizzle-orm';

class UserRepository {
  constructor(private db: any, private schema: any) {}

  // 软删除用户
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

  // 恢复用户
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

  // 查询活跃用户（自动过滤软删除记录）
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

  // 查询已删除的用户
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
}

// 使用示例
const userRepository = new UserRepository(db, schema);

// 软删除用户
await userRepository.softDelete('tenant-1', 'user-123', 'admin-456');

// 恢复用户
await userRepository.restore('tenant-1', 'user-123');

// 查询活跃用户
const activeUsers = await userRepository.findActive('tenant-1');

// 查询已删除的用户
const deletedUsers = await userRepository.findDeleted('tenant-1');
```

---

## 5. API 接口说明

### 5.1 createSoftDeletePlugin()

创建软删除插件实例。

**返回值**：
```typescript
PluginDefinition & {
  state: SoftDeletePluginState & {
    configureResource: (config: SoftDeleteConfig, context: PluginContext) => void;
  };
}
```

**示例**：
```typescript
const plugin = createSoftDeletePlugin();
mtpc.use(plugin);
```

### 5.2 configureResource(config, context)

为特定资源配置软删除。

**参数**：
- `config: SoftDeleteConfig` - 软删除配置
- `context: PluginContext` - 插件上下文

**示例**：
```typescript
plugin.state.configureResource({
  resourceName: 'user',
  deletedAtField: 'deletedAt',
  deletedByField: 'deletedBy',
  autoFilter: true,
}, context);
```

### 5.3 createSoftDeleteHooks(config)

直接创建软删除钩子，用于自定义集成。

**参数**：
- `config: SoftDeleteConfig` - 软删除配置

**返回值**：
```typescript
Partial<ResourceHooks<T>>
```

**示例**：
```typescript
const hooks = createSoftDeleteHooks({
  resourceName: 'user',
  deletedAtField: 'deletedAt',
});

const userResource = defineResource({
  name: 'user',
  schema: z.object({ /* ... */ }),
  hooks: {
    ...hooks,
  },
});
```

---

## 6. 参数配置详解

### 6.1 SoftDeleteConfig

| 配置项 | 类型 | 必填 | 默认值 | 描述 |
|--------|------|------|--------|------|
| `resourceName` | `string` | ✅ | - | 资源名称 |
| `deletedAtField` | `string` | ❌ | `'deletedAt'` | 时间戳字段名 |
| `deletedByField` | `string` | ❌ | - | 删除人字段名 |
| `flagField` | `string` | ❌ | - | 布尔标志字段名（与 deletedAtField 二选一） |
| `autoFilter` | `boolean` | ❌ | `true` | 是否自动过滤软删除记录 |

### 6.2 配置示例

#### 6.2.1 时间戳模式

```typescript
softDeletePlugin.state.configureResource({
  resourceName: 'user',
  deletedAtField: 'deletedAt',
  deletedByField: 'deletedBy',
  autoFilter: true,
}, context);
```

#### 6.2.2 布尔标志模式

```typescript
softDeletePlugin.state.configureResource({
  resourceName: 'product',
  flagField: 'isDeleted',
  deletedByField: 'deletedBy',
  autoFilter: true,
}, context);
```

#### 6.2.3 禁用自动过滤

```typescript
softDeletePlugin.state.configureResource({
  resourceName: 'order',
  deletedAtField: 'deletedAt',
  autoFilter: false, // 不自动过滤，需要手动处理
}, context);
```

#### 6.2.4 自定义字段名

```typescript
softDeletePlugin.state.configureResource({
  resourceName: 'document',
  deletedAtField: 'archivedAt',  // 自定义字段名
  deletedByField: 'archivedBy',
  autoFilter: true,
}, context);
```

---

## 7. 使用示例代码

### 7.1 基本使用

```typescript
import { createMTPC } from '@mtpc/core';
import { createSoftDeletePlugin } from '@mtpc/soft-delete';
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
});

// 创建 MTPC 实例
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    return new Set(['user:read', 'user:create']);
  }
});

// 创建并配置软删除插件
const softDeletePlugin = createSoftDeletePlugin();
const originalInstall = softDeletePlugin.install;

softDeletePlugin.install = (context) => {
  softDeletePlugin.state.configureResource({
    resourceName: 'user',
    deletedAtField: 'deletedAt',
    deletedByField: 'deletedBy',
    autoFilter: true,
  }, context);

  if (originalInstall) {
    originalInstall.call(softDeletePlugin, context);
  }
};

// 注册资源和插件
mtpc.registerResource(userResource);
mtpc.use(softDeletePlugin);

// 初始化
await mtpc.init();
```

### 7.2 多资源配置

```typescript
// 创建软删除插件
const softDeletePlugin = createSoftDeletePlugin();

// 配置插件
softDeletePlugin.install = (context) => {
  // 为用户资源配置软删除（时间戳方式）
  softDeletePlugin.state.configureResource({
    resourceName: 'user',
    deletedAtField: 'deletedAt',
    deletedByField: 'deletedBy',
    autoFilter: true,
  }, context);

  // 为产品资源配置软删除（布尔标志方式）
  softDeletePlugin.state.configureResource({
    resourceName: 'product',
    flagField: 'isDeleted',
    deletedByField: 'deletedBy',
    autoFilter: true,
  }, context);

  // 为订单资源配置软删除，但不自动过滤
  softDeletePlugin.state.configureResource({
    resourceName: 'order',
    deletedAtField: 'deletedAt',
    autoFilter: false, // 不自动过滤，需要手动处理
  }, context);
};

// 注册插件
mtpc.use(softDeletePlugin);
```

### 7.3 恢复软删除记录

```typescript
import { eq, and, isNull } from 'drizzle-orm';

class UserRepository {
  async restore(tenantId: string, userId: string) {
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
  const restoredUser = await userRepository.restore('tenant-1', 'user-123');
  console.log('用户已恢复:', restoredUser);
} catch (error) {
  console.error('恢复失败:', error.message);
}
```

### 7.4 查询软删除记录

```typescript
import { eq, and, isNotNull, isNull, desc, gte, lte } from 'drizzle-orm';

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

### 7.5 批量软删除

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

### 7.6 级联软删除

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

### 7.7 软删除的数据迁移

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

---

## 8. 常见问题解决方案

### Q1: 为什么 beforeDelete 钩子默认不阻断删除？

**A**: 这是设计上的考虑。软删除插件提供的是"软删除语义"，而不是强制所有删除都改为软删除。具体的删除逻辑由 Adapter/Repository 实现，可以根据业务需求决定是软删除还是硬删除。

**解决方案**：在 Adapter/Repository 中实现软删除逻辑：

```typescript
async deleteUser(id: string, deletedBy: string) {
  // 始终执行软删除
  return db.user.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedBy
    }
  });
}
```

### Q2: 如何强制所有删除都改为软删除？

**A**: 在 Adapter/Repository 中实现软删除逻辑，忽略 `beforeDelete` 钩子的返回值。

**解决方案**：

```typescript
async deleteUser(id: string, deletedBy: string) {
  // 始终执行软删除
  return db.user.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedBy
    }
  });
}
```

### Q3: 如何禁用自动过滤？

**A**: 在配置时设置 `autoFilter: false`。

**解决方案**：

```typescript
softDeletePlugin.state.configureResource({
  resourceName: 'user',
  deletedAtField: 'deletedAt',
  autoFilter: false, // 禁用自动过滤
}, context);
```

### Q4: 如何查询已删除的记录？

**A**: 在 Adapter/Repository 中实现专门的查询方法。

**解决方案**：

```typescript
async findDeleted(tenantId: string) {
  return db.user.findMany({
    where: {
      tenantId,
      deletedAt: { not: null }
    }
  });
}
```

### Q5: 如何恢复已删除的记录？

**A**: 在 Adapter/Repository 中实现恢复方法。

**解决方案**：

```typescript
async restore(tenantId: string, userId: string) {
  return db.user.update({
    where: {
      id: userId,
      tenantId,
      deletedAt: { not: null } // 只恢复已删除的记录
    },
    data: {
      deletedAt: null,
      deletedBy: null
    }
  });
}
```

### Q6: 如何在多个资源上使用不同的软删除配置？

**A**: 为每个资源分别调用 `configureResource`。

**解决方案**：

```typescript
softDeletePlugin.state.configureResource({
  resourceName: 'user',
  deletedAtField: 'deletedAt',
}, context);

softDeletePlugin.state.configureResource({
  resourceName: 'product',
  flagField: 'isDeleted',
}, context);
```

### Q7: 如何处理软删除记录的权限？

**A**: 创建专门的 `restore` 权限，并配置相应的策略。

**解决方案**：

```typescript
const userResource = defineResource({
  name: 'user',
  features: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  permissions: [
    { action: 'restore', description: '恢复用户' },
  ],
});

// 注册策略
mtpc.registerPolicy({
  id: 'restore-policy',
  name: '恢复权限策略',
  rules: [{
    permissions: ['user:restore'],
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
```

### Q8: 如何实现软删除记录的自动清理？

**A**: 使用定时任务定期清理过期的软删除记录。

**解决方案**：

```typescript
import { lt } from 'drizzle-orm';

async function cleanupOldDeletedData(days: number) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await db.user.deleteMany({
    where: {
      deletedAt: {
        lt: cutoffDate
      }
    }
  });

  console.log(`清理了 ${result.count} 条过期的软删除记录`);
}

// 使用定时任务（例如 node-cron）
import cron from 'node-cron';

// 每天凌晨 2 点执行清理
cron.schedule('0 2 * * *', async () => {
  console.log('开始清理过期软删除记录...');
  await cleanupOldDeletedData(90); // 清理 90 天前的记录
  console.log('清理完成');
});
```

### Q9: 如何在软删除时记录审计日志？

**A**: 在 Adapter/Repository 中实现软删除逻辑时记录审计日志。

**解决方案**：

```typescript
async function softDeleteWithAudit(id: string, deletedBy: string) {
  const user = await db.user.findUnique({ where: { id } });

  await db.user.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedBy
    }
  });

  // 记录审计日志
  await audit.log({
    action: 'soft-delete',
    resource: 'user',
    resourceId: id,
    userId: deletedBy,
    changes: {
      deletedAt: user.deletedAt,
      newDeletedAt: new Date()
    },
    timestamp: new Date()
  });
}
```

### Q10: 如何实现软删除记录的导出？

**A**: 查询已删除记录并导出为文件。

**解决方案**：

```typescript
import { writeFileSync } from 'fs';
import { isNotNull } from 'drizzle-orm';

async function exportDeletedUsers(tenantId: string, outputPath: string) {
  const deletedUsers = await db.user.findMany({
    where: {
      tenantId,
      deletedAt: { not: null }
    },
    orderBy: {
      deletedAt: 'desc'
    }
  });

  // 导出为 JSON
  writeFileSync(outputPath, JSON.stringify(deletedUsers, null, 2));

  console.log(`已导出 ${deletedUsers.length} 条已删除记录到 ${outputPath}`);
}

// 使用示例
await exportDeletedUsers('tenant-1', './deleted-users.json');
```

---

## 9. 最佳实践建议

### 9.1 数据库设计

#### 9.1.1 使用时间戳模式

推荐使用时间戳模式而非布尔标志模式，因为：
- 可以记录删除时间，便于审计
- 可以按时间范围查询已删除记录
- 支持自动清理过期数据

#### 9.1.2 创建合适的索引

为软删除字段创建索引以提高查询性能：

```sql
-- 复合索引：租户 ID + 删除状态
CREATE INDEX idx_users_tenant_deleted
ON users(tenant_id, deleted_at);

-- 覆盖索引：包含常用查询字段
CREATE INDEX idx_users_covering
ON users(tenant_id, deleted_at, created_at)
INCLUDE (name, email);
```

#### 9.1.3 添加默认值

为软删除字段添加默认值：

```sql
ALTER TABLE users
ALTER COLUMN deleted_at SET DEFAULT NULL,
ALTER COLUMN is_deleted SET DEFAULT FALSE;
```

### 9.2 代码组织

#### 9.2.1 集中管理软删除配置

将软删除配置集中管理：

```typescript
// config/soft-delete.ts
import { createSoftDeletePlugin } from '@mtpc/soft-delete';

export const softDeletePlugin = createSoftDeletePlugin();

export function configureSoftDeletePlugin(context: PluginContext) {
  // 用户资源
  softDeletePlugin.state.configureResource({
    resourceName: 'user',
    deletedAtField: 'deletedAt',
    deletedByField: 'deletedBy',
    autoFilter: true,
  }, context);

  // 产品资源
  softDeletePlugin.state.configureResource({
    resourceName: 'product',
    flagField: 'isDeleted',
    autoFilter: true,
  }, context);
}
```

#### 9.2.2 创建统一的 Repository 基类

创建包含软删除功能的 Repository 基类：

```typescript
abstract class SoftDeleteRepository<T> {
  constructor(
    protected db: any,
    protected schema: any,
    protected config: {
      deletedAtField: string;
      deletedByField?: string;
    }
  ) {}

  async softDelete(id: string, deletedBy: string) {
    return this.db.update(this.schema.table)
      .set({
        [this.config.deletedAtField]: new Date(),
        ...(this.config.deletedByField && {
          [this.config.deletedByField]: deletedBy
        })
      })
      .where(eq(this.schema.table.id, id));
  }

  async restore(id: string) {
    return this.db.update(this.schema.table)
      .set({
        [this.config.deletedAtField]: null,
        ...(this.config.deletedByField && {
          [this.config.deletedByField]: null
        })
      })
      .where(eq(this.schema.table.id, id));
  }

  abstract findActive(...args: any[]): Promise<T[]>;
  abstract findDeleted(...args: any[]): Promise<T[]>;
}
```

### 9.3 性能优化

#### 9.3.1 使用索引

确保查询使用索引：

```typescript
// 好的查询：使用索引
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

// 不好的查询：未使用索引
async findActive(tenantId: string) {
  return this.db.select()
    .from(this.schema.user)
    .where(
      and(
        eq(this.schema.user.tenantId, tenantId),
        // 未使用 deletedAt 字段
      )
    );
}
```

#### 9.3.2 分页查询

对于大量数据，使用分页查询：

```typescript
async findDeletedPaginated(tenantId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;

  return this.db.select()
    .from(this.schema.user)
    .where(
      and(
        eq(this.schema.user.tenantId, tenantId),
        isNotNull(this.schema.user.deletedAt)
      )
    )
    .limit(pageSize)
    .offset(offset)
    .orderBy(desc(this.schema.user.deletedAt));
}
```

#### 9.3.3 使用事务

对于涉及多个表的软删除操作，使用事务：

```typescript
async function cascadeSoftDelete(userId: string, deletedBy: string) {
  await db.transaction(async (tx) => {
    // 软删除用户的订单
    await tx.update(this.schema.order)
      .set({ deletedAt: new Date(), deletedBy })
      .where(eq(this.schema.order.userId, userId));

    // 软删除用户
    await tx.update(this.schema.user)
      .set({ deletedAt: new Date(), deletedBy })
      .where(eq(this.schema.user.id, userId));
  });
}
```

### 9.4 安全实践

#### 9.4.1 权限控制

为软删除操作配置适当的权限：

```typescript
const userResource = defineResource({
  name: 'user',
  features: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  permissions: [
    { action: 'restore', description: '恢复用户' },
    { action: 'purge', description: '永久删除用户' },
  ],
});
```

#### 9.4.2 审计日志

记录所有软删除操作：

```typescript
async function softDeleteWithAudit(id: string, deletedBy: string) {
  const user = await db.user.findUnique({ where: { id } });

  await db.user.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy }
  });

  await audit.log({
    action: 'soft-delete',
    resource: 'user',
    resourceId: id,
    userId: deletedBy,
    changes: {
      deletedAt: user.deletedAt,
      newDeletedAt: new Date()
    },
    timestamp: new Date()
  });
}
```

#### 9.4.3 定期清理

定期清理过期的软删除记录：

```typescript
async function cleanupOldDeletedData(days: number) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await db.user.deleteMany({
    where: {
      deletedAt: {
        lt: cutoffDate
      }
    }
  });

  console.log(`清理了 ${result.count} 条过期的软删除记录`);
}
```

### 9.5 错误处理

#### 9.5.1 资源未找到错误

```typescript
async function restore(tenantId: string, userId: string) {
  const result = await this.db.update(this.schema.user)
    .set({ deletedAt: null, deletedBy: null })
    .where(
      and(
        eq(this.schema.user.id, userId),
        eq(this.schema.user.tenantId, tenantId)
      )
    );

  if (result.length === 0) {
    throw new Error('用户不存在');
  }

  return result[0];
}
```

#### 9.5.2 重复删除错误

```typescript
async function softDelete(id: string, deletedBy: string) {
  const user = await this.db.user.findUnique({ where: { id } });

  if (!user) {
    throw new Error('用户不存在');
  }

  if (user.deletedAt) {
    throw new Error('用户已被删除');
  }

  return this.db.update(this.schema.user)
    .set({ deletedAt: new Date(), deletedBy })
    .where(eq(this.schema.user.id, id));
}
```

---

## 10. 高级用法

### 10.1 自定义软删除策略

可以通过扩展 `createSoftDeleteHooks` 实现自定义策略：

```typescript
function createCustomSoftDeleteHooks<T = unknown>(
  config: SoftDeleteConfig & {
    customStrategy?: 'timestamp' | 'boolean' | 'version';
  }
): Partial<ResourceHooks<T>> {
  const { customStrategy = 'timestamp' } = config;

  return {
    beforeDelete: async (ctx, id) => {
      // 实现自定义的 beforeDelete 逻辑
      return { proceed: true, data: id };
    },
    filterQuery: (ctx, baseFilters) => {
      // 实现自定义的 filterQuery 逻辑
      return baseFilters;
    },
  };
}
```

### 10.2 扩展插件功能

可以通过继承或组合扩展插件功能：

```typescript
function createExtendedSoftDeletePlugin() {
  const basePlugin = createSoftDeletePlugin();

  return {
    ...basePlugin,
    state: {
      ...basePlugin.state,
      // 添加新的方法
      batchConfigure: (configs: SoftDeleteConfig[], context: PluginContext) => {
        for (const config of configs) {
          basePlugin.state.configureResource(config, context);
        }
      },
      // 获取资源配置
      getConfig: (resourceName: string) => {
        return basePlugin.state.configs.get(resourceName);
      },
      // 移除资源配置
      removeConfig: (resourceName: string) => {
        basePlugin.state.configs.delete(resourceName);
      },
    },
  };
}
```

### 10.3 与其他插件的集成

软删除插件可以与其他插件协同工作：

```typescript
// 与审计日志插件集成
import { createAuditPlugin } from '@mtpc/audit';

const auditPlugin = createAuditPlugin();
const softDeletePlugin = createSoftDeletePlugin();

// 修改 softDeletePlugin 的 beforeDelete 钩子
const originalHooks = createSoftDeleteHooks({
  resourceName: 'user',
  deletedAtField: 'deletedAt',
});

const extendedHooks = {
  ...originalHooks,
  beforeDelete: [
    async (ctx, id) => {
      // 记录审计日志
      await auditPlugin.log({
        action: 'soft-delete',
        resource: 'user',
        resourceId: id,
        userId: ctx.subject.id,
      });

      // 调用原始的 beforeDelete 钩子
      return originalHooks.beforeDelete?.[0]?.(ctx, id) ?? { proceed: true, data: id };
    },
  ],
};
```

### 10.4 动态配置资源

可以在运行时动态配置资源：

```typescript
// 根据配置文件动态配置资源
import config from './config/soft-delete.config.json';

function configureResourcesFromConfig(context: PluginContext) {
  for (const resourceConfig of config.resources) {
    softDeletePlugin.state.configureResource({
      resourceName: resourceConfig.name,
      deletedAtField: resourceConfig.deletedAtField,
      deletedByField: resourceConfig.deletedByField,
      flagField: resourceConfig.flagField,
      autoFilter: resourceConfig.autoFilter ?? true,
    }, context);
  }
}
```

### 10.5 监控和统计

实现软删除操作的监控和统计：

```typescript
class SoftDeleteMonitor {
  private metrics = {
    totalDeletes: 0,
    totalRestores: 0,
    deletesByResource: new Map<string, number>(),
    restoresByResource: new Map<string, number>(),
  };

  recordDelete(resourceName: string) {
    this.metrics.totalDeletes++;
    const count = this.metrics.deletesByResource.get(resourceName) || 0;
    this.metrics.deletesByResource.set(resourceName, count + 1);
  }

  recordRestore(resourceName: string) {
    this.metrics.totalRestores++;
    const count = this.metrics.restoresByResource.get(resourceName) || 0;
    this.metrics.restoresByResource.set(resourceName, count + 1);
  }

  getMetrics() {
    return {
      ...this.metrics,
      deletesByResource: Object.fromEntries(this.metrics.deletesByResource),
      restoresByResource: Object.fromEntries(this.metrics.restoresByResource),
    };
  }
}

const monitor = new SoftDeleteMonitor();

// 在软删除时记录
await userRepository.softDelete('tenant-1', 'user-123', 'admin-456');
monitor.recordDelete('user');

// 在恢复时记录
await userRepository.restore('tenant-1', 'user-123');
monitor.recordRestore('user');

// 获取统计信息
console.log('软删除统计:', monitor.getMetrics());
```

---

## 附录

### A. 完整类型定义

```typescript
// types.ts
import type { FilterCondition, MTPCContext } from '@mtpc/core';

export interface SoftDeleteConfig {
  resourceName: string;
  deletedAtField?: string;
  deletedByField?: string;
  flagField?: string;
  autoFilter?: boolean;
}

export type SoftDeleteBeforeDeleteHook = (
  context: MTPCContext,
  id: string
) => Promise<{ proceed: boolean; data?: string }> | { proceed: boolean; data?: string };

export type SoftDeleteFilterQueryHook = (
  context: MTPCContext,
  baseFilters: FilterCondition[]
) => Promise<FilterCondition[]> | FilterCondition[];

export interface SoftDeletePluginState {
  configs: Map<string, SoftDeleteConfig>;
}
```

### B. 版本历史

#### 0.1.0
- 初始版本发布
- 支持时间戳和布尔标志两种软删除模式
- 支持自动过滤已删除记录
- 支持删除人追踪
- 支持灵活的资源配置

---

**文档版本**: 1.0.0
**最后更新**: 2024-12-27
**维护者**: MTPC Team
