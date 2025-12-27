# @mtpc/adapter-drizzle 使用指南

## 目录

1. [概述](#1-概述)
2. [安装与配置](#2-安装与配置)
3. [核心 API 详解](#3-核心-api-详解)
4. [快速开始](#4-快速开始)
5. [高级功能](#5-高级功能)
6. [最佳实践](#6-最佳实践)
7. [常见问题](#7-常见问题)
8. [架构图示](#8-架构图示)

---

## 1. 概述

### 1.1 包简介

`@mtpc/adapter-drizzle` 是 MTPC (Multi-Tenant Permission Core) 框架的 Drizzle ORM 数据访问层适配器，提供将多租户权限核心与 Drizzle ORM 无缝集成的解决方案。

### 1.2 核心功能

- **自动租户隔离**：确保数据按租户正确隔离，避免跨租户访问
- **Repository 模式**：提供统一的数据访问接口
- **Schema 生成**：从资源定义自动生成 Drizzle 表结构
- **CRUD 操作**：完整的 CRUD 操作支持
- **钩子集成**：与 MTPC Core 钩子系统深度集成
- **迁移管理**：数据库 schema 版本控制
- **查询构建器**：支持链式调用构建复杂查询

### 1.3 适用场景

- 基于 Drizzle ORM 的多租户应用
- 需要自动生成数据库 Schema 的场景
- 采用 Repository 模式设计的数据访问层
- 需要数据库迁移管理的应用
- 复杂查询构建需求
- 多租户数据隔离需求

---

## 2. 安装与配置

### 2.1 安装依赖

```bash
pnpm add @mtpc/adapter-drizzle @mtpc/core drizzle-orm postgres
```

### 2.2 依赖要求

| 依赖包 | 版本要求 | 说明 |
|--------|----------|------|
| `@mtpc/core` | workspace:* | MTPC 核心包 |
| `drizzle-orm` | ^0.30.0 | Drizzle ORM 库 |
| `postgres` | ^3.4.0 | PostgreSQL 驱动 |

### 2.3 数据库配置

```typescript
import { createConnection } from '@mtpc/adapter-drizzle';

// 方式一：使用配置对象
const { db, client } = createConnection({
  connectionString: 'postgres://user:password@localhost:5432/mydb',
  maxConnections: 10,
  idleTimeout: 20,
  ssl: false,
});

// 方式二：从环境变量读取
const { db, client } = createConnectionFromEnv();
```

**DatabaseConfig 选项**：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `connectionString` | `string` | - | 数据库连接字符串（必填） |
| `maxConnections` | `number` | 10 | 最大连接数 |
| `idleTimeout` | `number` | 20 | 空闲超时（秒） |
| `ssl` | `boolean \| object` | false | SSL 配置 |

---

## 3. 核心 API 详解

### 3.1 数据库连接

#### `createConnection(config: DatabaseConfig)`

创建 PostgreSQL 数据库连接。

```typescript
import { createConnection } from '@mtpc/adapter-drizzle';

const { db, client } = createConnection({
  connectionString: process.env.DATABASE_URL,
  maxConnections: 10,
  idleTimeout: 20,
  ssl: process.env.NODE_ENV === 'production',
});
```

#### `createConnectionFromEnv()`

从环境变量创建连接，自动读取 `DATABASE_URL`。

```typescript
import { createConnectionFromEnv } from '@mtpc/adapter-drizzle';

// 需要设置环境变量：DATABASE_URL=postgres://...
const { db, client } = createConnectionFromEnv();
```

#### `ConnectionPool`

连接池管理器。

```typescript
import { createConnectionPool, closeConnection } from '@mtpc/adapter-drizzle';

const pool = createConnectionPool({
  connectionString: process.env.DATABASE_URL,
});

// 获取数据库实例
const db = pool.getDb();

// 健康检查
const isHealthy = await pool.healthCheck();

// 关闭连接池
await pool.close();
```

### 3.2 Schema 生成

#### `generateTable(resource, options)`

从资源定义生成单张表。

```typescript
import { generateTable } from '@mtpc/adapter-drizzle';
import { defineResource } from '@mtpc/core';
import { z } from 'zod';

const userResource = defineResource({
  name: 'user',
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(2),
    email: z.string().email(),
  }),
  features: { create: true, read: true, update: true, delete: true },
});

// 生成表结构
const userTable = generateTable(userResource, {
  tenantColumn: 'tenant_id',
  timestamps: true,
  softDelete: false,
  auditFields: true,
});
```

**SchemaGenerationOptions**：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `tenantColumn` | `string` | 'tenant_id' | 租户列名 |
| `timestamps` | `boolean` | true | 添加时间戳 |
| `softDelete` | `boolean` | false | 添加软删除字段 |
| `auditFields` | `boolean` | false | 添加审计字段 |

#### `generateAllTables(resources, options)`

批量生成所有表的 Schema。

```typescript
import { generateAllTables } from '@mtpc/adapter-drizzle';

const tables = generateAllTables([userResource, productResource, orderResource], {
  timestamps: true,
  auditFields: true,
});

console.log(tables);
// { user: PgTable, product: PgTable, order: PgTable }
```

### 3.3 Repository 工厂

#### `createRepositoryFactory(db, tables)`

创建 Repository 工厂实例。

```typescript
import { createRepositoryFactory } from '@mtpc/adapter-drizzle';
import { generateAllTables } from '@mtpc/adapter-drizzle';

// 生成表结构
const tables = generateAllTables([userResource, productResource]);

// 创建工厂
const factory = createRepositoryFactory(db, tables);

// 获取用户 Repository
const userRepo = factory.getRepository('user');

// 获取产品 Repository（支持驼峰或蛇形命名）
const productRepo = factory.getRepository('product');
const orderRepo = factory.getRepository('order'); // 或 'order'
```

**RepositoryFactory 方法**：

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `getRepository<T>(resourceName)` | 资源名称 | `TenantRepository<T>` | 获取指定资源的仓储实例 |
| `registerTable(name, table)` | 表名、表定义 | `void` | 注册表定义 |
| `getTableNames()` | - | `string[]` | 获取所有表名 |
| `clearCache()` | - | `void` | 清空缓存 |

### 3.4 CRUD Repository

#### BaseRepository 方法

```typescript
interface Repository<T> {
  findById(ctx: MTPCContext, id: string): Promise<T | null>;
  findMany(ctx: MTPCContext, options?: QueryOptions): Promise<PaginatedResult<T>>;
  create(ctx: MTPCContext, data: Partial<T>): Promise<T>;
  update(ctx: MTPCContext, id: string, data: Partial<T>): Promise<T | null>;
  delete(ctx: MTPCContext, id: string): Promise<boolean>;
  count(ctx: MTPCContext, options?: QueryOptions): Promise<number>;
}
```

#### TenantRepository 扩展方法

```typescript
class TenantRepository<T> extends BaseRepository<T> {
  findAllForTenant(ctx: MTPCContext): Promise<T[]>;
  createMany(ctx: MTPCContext, items: Partial<T>[]): Promise<T[]>;
  updateMany(ctx: MTPCContext, ids: string[], data: Partial<T>): Promise<number>;
  deleteMany(ctx: MTPCContext, ids: string[]): Promise<number>;
  softDelete(ctx: MTPCContext, id: string): Promise<boolean>;
  softDeleteMany(ctx: MTPCContext, ids: string[]): Promise<number>;
  restore(ctx: MTPCContext, id: string): Promise<T | null>;
  findByIdIncludingDeleted(ctx: MTPCContext, id: string): Promise<T | null>;
  findDeleted(ctx: MTPCContext, options?: QueryOptions): Promise<PaginatedResult<T>>;
}
```

**RepositoryOptions**：

```typescript
interface RepositoryOptions {
  /** 租户列名，默认 "tenantId" */
  tenantColumn?: string;
}
```

### 3.5 查询构建器

#### `createQueryBuilder(db, table, ctx)`

创建查询构建器实例。

```typescript
import { createQueryBuilder } from '@mtpc/adapter-drizzle';

const users = await createQueryBuilder(db, userTable, ctx)
  .whereEquals('status', 'active')
  .whereLike('name', 'John%')
  .whereIn('role', ['admin', 'editor'])
  .orderBy('createdAt', 'desc')
  .limit(10)
  .offset(0)
  .getMany();

const count = await createQueryBuilder(db, userTable, ctx)
  .whereEquals('status', 'active')
  .count();

const exists = await createQueryBuilder(db, userTable, ctx)
  .whereEquals('email', 'test@example.com')
  .exists();
```

**QueryBuilder 方法**：

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `where(field, operator, value)` | 字段名、运算符、值 | `this` | 添加条件 |
| `whereEquals(field, value)` | 字段名、值 | `this` | 等于条件 |
| `whereIn(field, values)` | 字段名、值数组 | `this` | IN 条件 |
| `whereLike(field, pattern)` | 字段名、模式 | `this` | LIKE 条件 |
| `whereNull(field)` | 字段名 | `this` | IS NULL |
| `whereNotNull(field)` | 字段名 | `this` | IS NOT NULL |
| `whereBetween(field, min, max)` | 字段名、最小值、最大值 | `this` | BETWEEN |
| `orWhere(conditions)` | 条件数组 | `this` | OR 条件 |
| `orderBy(field, direction)` | 字段名、方向 | `this` | 排序 |
| `limit(value)` | 数量 | `this` | 限制数量 |
| `offset(value)` | 偏移量 | `this` | 偏移量 |
| `select(...columns)` | 列名数组 | `this` | 选择列（未完成） |
| `withDeleted()` | - | `this` | 包含已删除 |
| `getMany()` | - | `Promise<T[]>` | 获取所有 |
| `getOne()` | - | `Promise<T \| null>` | 获取单个 |
| `count()` | - | `Promise<number>` | 统计数量 |
| `exists()` | - | `Promise<boolean>` | 检查存在 |

**支持的运算符**：`eq`、`neq`、`gt`、`gte`、`lt`、`lte`、`in`、`like`、`isNull`、`isNotNull`

### 3.6 CRUD 处理器

#### `createDrizzleHandlerFactory(db, tables)`

创建 CRUD 处理器工厂。

```typescript
import { createDrizzleHandlerFactory } from '@mtpc/adapter-drizzle';

const handlerFactory = createDrizzleHandlerFactory(db, tables);

// 获取用于 Hono 的工厂函数
const createHandler = handlerFactory.getHandlerFactoryFn();
```

#### `DrizzleCRUDHandler` 方法

```typescript
class DrizzleCRUDHandler<T> implements CRUDHandler<T> {
  list(ctx: MTPCContext, options?: QueryOptions): Promise<PaginatedResult<T>>;
  create(ctx: MTPCContext, data: Partial<T>): Promise<T>;
  read(ctx: MTPCContext, id: string): Promise<T | null>;
  update(ctx: MTPCContext, id: string, data: Partial<T>): Promise<T | null>;
  delete(ctx: MTPCContext, id: string): Promise<boolean>;
  getRepository(): TenantRepository<T>;
}
```

### 3.7 迁移管理

#### `createMigrationRunner(db, options)`

创建迁移运行器。

```typescript
import { createMigrationRunner, createSystemTablesMigration } from '@mtpc/adapter-drizzle';

const runner = createMigrationRunner(db, { tableName: 'mtpc_migrations' });

// 注册系统表迁移
runner.register(createSystemTablesMigration());

// 执行所有待执行迁移
await runner.migrate();

// 回滚最后一次迁移
await runner.rollback();

// 回滚所有迁移
await runner.reset();
```

**MigrationRunner 方法**：

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `register(migration)` | 迁移定义 | `this` | 注册单个迁移 |
| `registerMany(migrations)` | 迁移数组 | `this` | 批量注册 |
| `init()` | - | `Promise<void>` | 初始化迁移表 |
| `migrate()` | - | `Promise<string[]>` | 执行迁移 |
| `rollback()` | - | `Promise<string \| null>` | 回滚迁移 |
| `reset()` | - | `Promise<void>` | 重置所有 |

---

## 4. 快速开始

### 4.1 完整示例

```typescript
import { createMTPC } from '@mtpc/core';
import { defineResource } from '@mtpc/core';
import { z } from 'zod';
import { createConnectionFromEnv } from '@mtpc/adapter-drizzle';
import { createRepositoryFactory } from '@mtpc/adapter-drizzle';
import { generateAllTables } from '@mtpc/adapter-drizzle';

// 1. 定义资源
const userResource = defineResource({
  name: 'user',
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(['admin', 'user', 'guest']),
  }),
  features: { create: true, read: true, update: true, delete: true },
});

// 2. 创建 MTPC 实例
const mtpc = createMTPC();
mtpc.registerResource(userResource);
await mtpc.init();

// 3. 创建数据库连接
const { db } = createConnectionFromEnv();

// 4. 生成并注册表
const tables = generateAllTables([userResource], {
  timestamps: true,
  auditFields: true,
});

// 5. 创建 Repository 工厂
const factory = createRepositoryFactory(db, tables);

// 6. 获取 Repository
const userRepo = factory.getRepository('user');

// 7. 使用 Repository（需要租户上下文）
import { createTenantContext } from '@mtpc/core';

const tenant = createTenantContext('tenant-001');
const subject = { id: 'user-001', type: 'user' as const };
const ctx = { tenant, subject, request: {} };

// 创建用户
const user = await userRepo.create(ctx, {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: '张三',
  email: 'zhangsan@example.com',
  role: 'admin',
});

// 查询用户
const foundUser = await userRepo.findById(ctx, '123e4567-e89b-12d3-a456-426614174000');

// 列表查询
const { data: users, total } = await userRepo.findMany(ctx, {
  pagination: { page: 1, pageSize: 10 },
  sort: [{ field: 'createdAt', direction: 'desc' }],
});

// 更新用户
const updated = await userRepo.update(ctx, '123e4567-e89b-12d3-a456-426614174000', {
  name: '李四',
});

// 删除用户
await userRepo.delete(ctx, '123e4567-e89b-12d3-a456-426614174000');
```

### 4.2 与 Hono 集成

```typescript
import { createMTPCApp } from '@mtpc/adapter-hono';
import { createDrizzleHandlerFactory } from '@mtpc/adapter-drizzle';

const handlerFactory = createDrizzleHandlerFactory(db, tables);

const app = createMTPCApp(mtpc, {
  prefix: '/api',
  handlerFactory: handlerFactory.getHandlerFactoryFn(),
});

app.fire();
```

---

## 5. 高级功能

### 5.1 批量操作

```typescript
// 批量创建
const users = await userRepo.createMany(ctx, [
  { name: '用户1', email: 'user1@example.com' },
  { name: '用户2', email: 'user2@example.com' },
  { name: '用户3', email: 'user3@example.com' },
]);

// 批量更新
const updatedCount = await userRepo.updateMany(ctx, ['id1', 'id2', 'id3'], {
  status: 'inactive',
});

// 批量删除
const deletedCount = await userRepo.deleteMany(ctx, ['id1', 'id2']);
```

### 5.2 软删除

```typescript
// 软删除
await userRepo.softDelete(ctx, 'user-id');

// 恢复
await userRepo.restore(ctx, 'user-id');

// 查询已删除记录
const deleted = await userRepo.findDeleted(ctx, {
  pagination: { page: 1, pageSize: 10 },
});

// 包含已删除的查询
const user = await userRepo.findByIdIncludingDeleted(ctx, 'user-id');
```

### 5.3 自定义 Repository

```typescript
import { BaseRepository, type RepositoryOptions } from '@mtpc/adapter-drizzle/repository';

class CustomUserRepository extends BaseRepository<User> {
  constructor(db, table, tableName) {
    super(db, table, tableName, { tenantColumn: 'tenant_id' });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne(ctx, [{ field: 'email', operator: 'eq', value: email }]);
  }

  async findByRole(role: string): Promise<User[]> {
    return this.findMany(ctx, {
      filters: [{ field: 'role', operator: 'eq', value: role }],
    });
  }
}

// 使用自定义 Repository
const customRepo = new CustomUserRepository(db, userTable, 'users');
const user = await customRepo.findByEmail('test@example.com');
```

### 5.4 复杂查询构建

```typescript
import { createQueryBuilder } from '@mtpc/adapter-drizzle';

const results = await createQueryBuilder(db, userTable, ctx)
  .whereEquals('status', 'active')
  .whereIn('role', ['admin', 'manager'])
  .whereLike('name', '%张%')
  .whereBetween('createdAt', new Date('2024-01-01'), new Date('2024-12-31'))
  .orderBy('createdAt', 'desc')
  .limit(20)
  .getMany();
```

### 5.5 自定义 Schema 生成

```typescript
import { generateTable } from '@mtpc/adapter-drizzle';

const customTable = generateTable(productResource, {
  tenantColumn: 'company_id',      // 自定义租户列名
  timestamps: true,                // 包含时间戳
  softDelete: true,                // 包含软删除
  auditFields: true,               // 包含审计字段
});
```

### 5.6 迁移管理

```typescript
import { createMigrationRunner, createSystemTablesMigration } from '@mtpc/adapter-drizzle';

// 创建迁移运行器
const runner = createMigrationRunner(db, { tableName: 'my_migrations' });

// 注册系统表迁移
runner.register(createSystemTablesMigration());

// 自定义迁移
runner.register({
  id: '20240101_add_user_fields',
  name: 'Add user profile fields',
  async up(db) {
    await db.execute(sql.raw(`
      ALTER TABLE users ADD COLUMN phone VARCHAR(20);
      ALTER TABLE users ADD COLUMN avatar TEXT;
    `));
  },
  async down(db) {
    await db.execute(sql.raw(`
      ALTER TABLE users DROP COLUMN phone;
      ALTER TABLE users DROP COLUMN avatar;
    `));
  },
});

// 执行迁移
await runner.migrate();

// 检查迁移状态
const pending = await runner.getPending();
const executed = await runner.getExecuted();
```

---

## 6. 最佳实践

### 6.1 项目结构

```
src/
├── db/
│   ├── index.ts          # 数据库连接和初始化
│   ├── schema.ts         # 表结构定义
│   └── migrations/       # 迁移文件
├── repositories/
│   ├── user.repository.ts
│   ├── product.repository.ts
│   └── index.ts
└── resources/
    ├── user.resource.ts
    ├── product.resource.ts
    └── index.ts
```

### 6.2 Repository 封装

```typescript
// repositories/user.repository.ts
import { createRepositoryFactory } from '@mtpc/adapter-drizzle';
import { userTable } from '../db/schema';

export class UserRepository {
  constructor(private factory: ReturnType<typeof createRepositoryFactory>) {}

  get repo() {
    return this.factory.getRepository('user');
  }

  async findByEmail(email: string) {
    // 自定义查询逻辑
  }

  async findActiveUsers() {
    // 自定义查询逻辑
  }
}
```

### 6.3 错误处理

```typescript
try {
  const user = await userRepo.findById(ctx, userId);
  if (!user) {
    throw new Error('用户不存在');
  }
  // ...
} catch (error) {
  console.error('用户操作失败:', error);
  throw error;
}
```

### 6.4 事务支持

```typescript
await db.transaction(async (tx) => {
  // 在事务中执行操作
  await tx.insert(userTable).values({ ... });
  await tx.insert(orderTable).values({ ... });
  // 如果发生错误，事务会自动回滚
});
```

### 6.5 性能优化

```typescript
// 1. 使用批量操作
await userRepo.createMany(ctx, users); // 比循环 create 更高效

// 2. 合理使用索引
// Schema 生成器会自动为 tenant_id 和 created_at 添加索引

// 3. 分页查询
const { data, total } = await userRepo.findMany(ctx, {
  pagination: { page: 1, pageSize: 20 }, // 限制每页数量
});

// 4. 只查询需要的字段（select 方法待完善）
// const users = await query.select('id', 'name', 'email').getMany();
```

---

## 7. 常见问题

### Q1: 如何自定义租户列名？

```typescript
// 在 Schema 生成时
const table = generateTable(resource, {
  tenantColumn: 'company_id',
});

// 在 Repository 中
const repo = new BaseRepository(db, table, tableName, {
  tenantColumn: 'company_id',
});
```

### Q2: 软删除如何工作？

软删除通过设置 `deleted_at` 和 `deleted_by` 字段实现：

```typescript
// 启用软删除
const table = generateTable(resource, { softDelete: true });

// 软删除记录
await userRepo.softDelete(ctx, userId);

// 默认查询会排除已删除记录
const activeUsers = await userRepo.findMany(ctx);

// 需要查询已删除记录时
const deletedUsers = await userRepo.findDeleted(ctx);
```

### Q3: 如何处理事务？

```typescript
// 单个 Repository 操作已在内部处理
await userRepo.create(ctx, userData);

// 跨表操作使用事务
await db.transaction(async (tx) => {
  await tx.insert(orderTable).values(orderData);
  await tx.update(userTable).set({ balance: newBalance }).where(eq(userTable.id, userId));
});
```

### Q4: 如何添加自定义迁移？

```typescript
runner.register({
  id: 'unique_migration_id',
  name: 'Migration description',
  async up(db) {
    // 升级逻辑
  },
  async down(db) {
    // 回滚逻辑
  },
});
```

### Q5: 如何与现有数据库集成？

如果已有数据库表，可以手动创建 Drizzle 表定义：

```typescript
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const myExistingTable = pgTable('my_existing_table', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 直接使用现有表
const factory = createRepositoryFactory(db, { myExistingTable });
```

### Q6: 查询构建器为什么不返回指定字段？

`select` 方法当前标记为 TODO，尚未实现。如需只查询特定字段，可以使用 Drizzle 原生查询：

```typescript
import { eq, select } from 'drizzle-orm';

const users = await db
  .select({ id: userTable.id, name: userTable.name })
  .from(userTable)
  .where(eq(userTable.tenantId, ctx.tenant.id))
  .limit(10);
```

---

## 8. 架构图示

### 8.1 数据流图

```mermaid
flowchart TD
    subgraph Application Layer
        API[API Handler]
        Repo[Repository]
        Query[Query Builder]
    end

    subgraph Adapter Layer
        HandlerFactory[CRUD Handler Factory]
        RepositoryFactory[Repository Factory]
        SchemaGen[Schema Generator]
    end

    subgraph Drizzle ORM
        QueryBuilder[Drizzle Query Builder]
        Tables[Drizzle Tables]
    end

    subgraph Database
        PG[(PostgreSQL)]
    end

    API -->|CRUD Operations| HandlerFactory
    HandlerFactory -->|Creates| Repo
    RepositoryFactory -->|Manages| Repo
    Query -->|Builds Queries| QueryBuilder
    QueryBuilder -->|Executes| Tables
    Tables -->|SQL| PG
    Repo -->|Uses| Tables
    SchemaGen -->|Generates| Tables
```

### 8.2 租户隔离流程

```mermaid
sequenceDiagram
    participant Client
    participant Handler
    participant Repository
    participant DB

    Client->>Handler: CRUD Request + Tenant Context
    Handler->>Repository: Execute Operation + Tenant ID
    Repository->>Repository: Build Query + tenant_id filter
    Repository->>DB: SQL with WHERE tenant_id = ?
    DB-->>Repository: Query Result
    Repository-->>Handler: Filtered Result
    Handler-->>Client: Response
```

### 8.3 Repository 继承结构

```mermaid
classDiagram
    class Repository~T~ {
        <<interface>>
        +findById(ctx, id) Promise~T | null~
        +findMany(ctx, options) Promise~PaginatedResult~T~~
        +create(ctx, data) Promise~T~
        +update(ctx, id, data) Promise~T | null~
        +delete(ctx, id) Promise~boolean~
        +count(ctx, options) Promise~number~
    }

    class BaseRepository~T~ {
        #db: DrizzleDB
        #table: PgTable
        #tenantColumn: string
        +buildWhereConditions(ctx, filters)
        +buildOrderBy(sort)
    }

    class TenantRepository~T~ {
        +findAllForTenant(ctx) Promise~T[]~
        +createMany(ctx, items) Promise~T[]~
        +updateMany(ctx, ids, data) Promise~number~
        +deleteMany(ctx, ids) Promise~number~
        +softDelete(ctx, id) Promise~boolean~
        +restore(ctx, id) Promise~T | null~
    }

    Repository <|.. BaseRepository
    BaseRepository <|-- TenantRepository
```

---

## 附录

### A. 类型参考

```typescript
// 核心类型
type MTPCContext = {
  tenant: { id: string; status?: string; metadata?: Record<string, unknown> };
  subject: { id: string; type: string; attributes?: Record<string, unknown> };
  request: { id?: string; timestamp?: Date; ip?: string; path?: string; method?: string };
};

type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

type QueryOptions = {
  pagination?: { page?: number; pageSize?: number };
  sort?: SortOptions[];
  filters?: FilterCondition[];
};

type FilterCondition = {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'startsWith' | 'endsWith' | 'isNull' | 'isNotNull';
  value: unknown;
};

type SortOptions = {
  field: string;
  direction: 'asc' | 'desc';
};
```

### B. 错误处理

```typescript
// 常见错误类型
class TableNotFoundError extends Error {
  constructor(resourceName: string) {
    super(`Table not found for resource: ${resourceName}`);
    this.name = 'TableNotFoundError';
  }
}

class ColumnNotFoundError extends Error {
  constructor(columnName: string) {
    super(`Column not found: ${columnName}`);
    this.name = 'ColumnNotFoundError';
  }
}
```

---

**文档版本**: 1.0.0  
**最后更新**: 2024-12-27
