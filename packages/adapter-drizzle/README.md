# @mtpc/adapter-drizzle 使用指南

## 1. 包简介

`@mtpc/adapter-drizzle` 是 MTPC (Multi-Tenant Permission Core) 框架的 Drizzle ORM 数据访问层适配器，提供将多租户权限核心与 Drizzle ORM 无缝集成的解决方案，支持自动租户隔离、Repository 模式、Schema 生成工具和数据库迁移系统。

### 核心功能

- **自动租户隔离**：确保数据按租户正确隔离，避免跨租户访问
- **Repository 模式**：提供统一的数据访问接口
- **Drizzle Schema 生成**：从资源定义自动生成 Drizzle 表结构
- **基础仓储模式**：提供通用的 CRUD 操作和查询构建器
- **数据库迁移支持**：集成自定义迁移系统
- **PostgreSQL 支持**：目前主要支持 PostgreSQL
- **查询构建器**：支持复杂查询构建和执行
- **CRUD 处理器**：提供通用的 CRUD 处理逻辑

### 适用场景

- 基于 Drizzle ORM 的多租户应用
- 需要自动生成数据库 Schema 的场景
- 采用仓储模式设计的数据访问层
- 需要数据库迁移管理的应用
- 复杂查询构建需求
- 多租户数据隔离需求

---

## 2. 安装指南

### 2.1 安装依赖

使用 pnpm 安装 `@mtpc/adapter-drizzle` 包：

```bash
pnpm add @mtpc/adapter-drizzle @mtpc/core drizzle-orm postgres
```

### 2.2 依赖要求

| 依赖包 | 版本要求 | 说明 |
|--------|----------|------|
| `@mtpc/core` | workspace:* | MTPC 核心包，提供基础权限能力 |
| `drizzle-orm` | ^0.30.0 | Drizzle ORM 库 |
| `postgres` | ^3.4.0 | PostgreSQL 驱动 |

---

## 3. 快速开始

### 3.1 基本使用示例

```typescript
import { createMTPC } from '@mtpc/core';
import { defineResource } from '@mtpc/core';
import { z } from 'zod';
import { createConnectionFromEnv } from '@mtpc/adapter-drizzle';
import { createRepositoryFactory } from '@mtpc/adapter-drizzle';
import { generateAllTables } from '@mtpc/adapter-drizzle';

// 定义资源
const userResource = defineResource({
  name: 'user',
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(['admin', 'user']),
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
});

// 创建 MTPC 实例
const mtpc = createMTPC();
mtpc.registerResource(userResource);
await mtpc.init();

// 创建数据库连接（从环境变量读取 DATABASE_URL）
const { db } = createConnectionFromEnv();

// 生成 Drizzle 表结构
const tables = generateAllTables([userResource], {
  timestamps: true,
  auditFields: true,
});

// 创建仓储工厂
const repositoryFactory = createRepositoryFactory(db, tables);

// 获取用户仓储
const userRepository = repositoryFactory.getRepository('user');

// 使用仓储进行 CRUD 操作
async function example() {
  // 创建租户上下文
  const tenant = { id: 'tenant-001' };
  const subject = { id: 'user-001', type: 'user' };
  const ctx = { tenant, subject, request: {} };

  // 创建用户
  const createdUser = await userRepository.create(ctx, {
    id: '1234-5678-9012',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
  });
  console.log('Created user:', createdUser);

  // 获取用户
  const user = await userRepository.findById(ctx, '1234-5678-9012');
  console.log('Got user:', user);

  // 更新用户
  const updatedUser = await userRepository.update(ctx, '1234-5678-9012', {
    name: 'Jane Doe',
  });
  console.log('Updated user:', updatedUser);

  // 删除用户
  await userRepository.delete(ctx, '1234-5678-9012');
  console.log('Deleted user');
}

example().catch(console.error);
```

### 3.2 与 Hono 集成示例

```typescript
import { createMTPC } from '@mtpc/core';
import { createMTPCApp } from '@mtpc/adapter-hono';
import { defineResource } from '@mtpc/core';
import { z } from 'zod';
import { createConnectionFromEnv, createDrizzleHandlerFactory } from '@mtpc/adapter-drizzle';

// 定义资源
const postResource = defineResource({
  name: 'post',
  schema: z.object({
    id: z.string().uuid(),
    title: z.string().min(1),
    content: z.string().min(1),
    authorId: z.string().uuid(),
    published: z.boolean().default(false),
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
const mtpc = createMTPC();
mtpc.registerResource(postResource);
await mtpc.init();

// 创建数据库连接
const { db } = createConnectionFromEnv();

// 生成表结构
import { generateAllTables } from '@mtpc/adapter-drizzle';
const tables = generateAllTables([postResource]);

// 创建 Drizzle 处理器工厂
const drizzleHandlerFactory = createDrizzleHandlerFactory(db, tables);

// 创建 MTPC Hono 应用，使用 Drizzle 处理器
const app = createMTPCApp(mtpc, {
  prefix: '/api',
  logging: true,
  errorHandling: true,
  tenantOptions: { headerName: 'x-tenant-id' },
  authOptions: { required: false },
  handlerFactory: drizzleHandlerFactory.getHandlerFactoryFn(),
});

// 启动服务器
app.fire(3000);
```

---

## 4. 核心 API 详解

### 4.1 数据库连接

#### `createConnection`

创建 PostgreSQL 数据库连接。

```typescript
import { createConnection } from '@mtpc/adapter-drizzle';

function createConnection(config: DatabaseConfig): {
  db: DrizzleDB;
  client: ReturnType<typeof postgres>;
}
```

**DatabaseConfig**

| 属性 | 类型 | 默认值 | 说明 | 是否必填 |
|------|------|--------|------|----------|
| `connectionString` | `string` | - | 数据库连接 URL | 是 |
| `maxConnections` | `number` | 10 | 最大连接数 | 否 |
| `idleTimeout` | `number` | 20 | 空闲超时（秒） | 否 |
| `ssl` | `boolean \| object` | false | SSL 配置 | 否 |

**返回值**

| 属性 | 类型 | 说明 |
|------|------|------|
| `db` | `DrizzleDB` | Drizzle ORM 数据库实例 |
| `client` | `Postgres` | PostgreSQL 连接实例 |

#### `createConnectionFromEnv`

从环境变量创建连接，自动读取 `DATABASE_URL`。

```typescript
import { createConnectionFromEnv } from '@mtpc/adapter-drizzle';

function createConnectionFromEnv(): {
  db: DrizzleDB;
  client: ReturnType<typeof postgres>;
}
```

**环境变量**

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | 数据库连接字符串（必填） |
| `NODE_ENV` | 用于判断是否启用 SSL（production 时启用） |

**示例**

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/mtpc
```

#### `ConnectionPool`

连接池管理器。

```typescript
import { createConnectionPool } from '@mtpc/adapter-drizzle';

function createConnectionPool(config: DatabaseConfig): ConnectionPool
```

**ConnectionPool 方法**

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `getDb()` | - | `DrizzleDB` | 获取数据库实例 |
| `close()` | - | `Promise<void>` | 关闭连接池 |
| `healthCheck()` | - | `Promise<boolean>` | 健康检查 |

### 4.2 Schema 生成

#### `generateTable`

从资源定义生成单张 Drizzle 表。

```typescript
import { generateTable } from '@mtpc/adapter-drizzle';

function generateTable(
  resource: ResourceDefinition,
  options?: SchemaGenerationOptions
): PgTable
```

**SchemaGenerationOptions**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `tenantColumn` | `string` | 'tenant_id' | 租户 ID 列名 |
| `timestamps` | `boolean` | true | 是否添加时间戳字段 |
| `softDelete` | `boolean` | false | 是否添加软删除字段 |
| `auditFields` | `boolean` | false | 是否添加审计字段 |

**返回值**

生成的 Drizzle `PgTable` 对象。

#### `generateAllTables`

从资源列表批量生成 Drizzle 表。

```typescript
import { generateAllTables } from '@mtpc/adapter-drizzle';

function generateAllTables(
  resources: ResourceDefinition[],
  options?: SchemaGenerationOptions
): Record<string, PgTable>
```

**返回值**

表名到 `PgTable` 定义的映射对象。

#### Zod 类型映射

| Zod 类型 | Drizzle 类型 |
|----------|--------------|
| `ZodString` (无 max) | `text` |
| `ZodString` (max ≤ 255) | `varchar` |
| `ZodString` (uuid) | `uuid` |
| `ZodNumber` (int) | `integer` |
| `ZodNumber` | `doublePrecision` |
| `ZodBigInt` | `bigint` |
| `ZodBoolean` | `boolean` |
| `ZodDate` | `timestamp` |
| `ZodArray` / `ZodObject` / `ZodRecord` | `jsonb` |
| `ZodEnum` / `ZodNativeEnum` | `text` |

### 4.3 Repository 模式

#### `createRepositoryFactory`

创建 Drizzle Repository 工厂。

```typescript
import { createRepositoryFactory } from '@mtpc/adapter-drizzle';

function createRepositoryFactory(
  db: DrizzleDB,
  tables: Record<string, PgTable>
): RepositoryFactory
```

**RepositoryFactory 方法**

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `getRepository<T>(resourceName: string)` | 资源名称 | `TenantRepository<T>` | 获取指定资源的仓储实例 |
| `registerTable(name: string, table: PgTable)` | 表名、表定义 | `void` | 注册表定义 |
| `getTableNames()` | - | `string[]` | 获取所有表名 |
| `clearCache()` | - | `void` | 清空缓存 |

**命名支持**

- 驼峰命名：`userProfile` → `user_profile` 表
- 蛇形命名：`user_profile` → `user_profile` 表

#### `TenantRepository`

租户仓储类，继承自 `BaseRepository`。

**RepositoryOptions**

```typescript
interface RepositoryOptions {
  /** 租户列名，默认 "tenantId" */
  tenantColumn?: string;
}
```

**BaseRepository 方法**

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `findById(ctx, id)` | 上下文、ID | `Promise<T \| null>` | 根据 ID 查找 |
| `findMany(ctx, options)` | 上下文、查询选项 | `Promise<PaginatedResult<T>>` | 分页查询 |
| `create(ctx, data)` | 上下文、数据 | `Promise<T>` | 创建记录 |
| `update(ctx, id, data)` | 上下文、ID、数据 | `Promise<T \| null>` | 更新记录 |
| `delete(ctx, id)` | 上下文、ID | `Promise<boolean>` | 删除记录（硬删除） |
| `softDelete(ctx, id)` | 上下文、ID | `Promise<boolean>` | 软删除 |
| `count(ctx, options)` | 上下文、查询选项 | `Promise<number>` | 统计数量 |
| `findOne(ctx, conditions)` | 上下文、条件 | `Promise<T \| null>` | 按条件查找 |
| `exists(ctx, id)` | 上下文、ID | `Promise<boolean>` | 检查存在 |

**TenantRepository 扩展方法**

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `findAllForTenant(ctx)` | 上下文 | `Promise<T[]>` | 查询租户所有数据 |
| `createMany(ctx, items)` | 上下文、数据数组 | `Promise<T[]>` | 批量创建 |
| `updateMany(ctx, ids, data)` | 上下文、ID数组、数据 | `Promise<number>` | 批量更新 |
| `deleteMany(ctx, ids)` | 上下文、ID数组 | `Promise<number>` | 批量删除 |
| `softDeleteMany(ctx, ids)` | 上下文、ID数组 | `Promise<number>` | 批量软删除 |
| `restore(ctx, id)` | 上下文、ID | `Promise<T \| null>` | 恢复软删除 |
| `findByIdIncludingDeleted(ctx, id)` | 上下文、ID | `Promise<T \| null>` | 包含已删除查询 |
| `findDeleted(ctx, options)` | 上下文、查询选项 | `Promise<PaginatedResult<T>>` | 查询已删除记录 |

**支持的过滤运算符**

`eq`、`neq`、`gt`、`gte`、`lt`、`lte`、`in`、`contains`、`startsWith`、`endsWith`、`isNull`、`isNotNull`

### 4.4 查询构建器

#### `createQueryBuilder`

创建查询构建器。

```typescript
import { createQueryBuilder } from '@mtpc/adapter-drizzle';

function createQueryBuilder<T extends Record<string, unknown>>(
  db: DrizzleDB,
  table: PgTable,
  ctx: MTPCContext
): QueryBuilder<T>
```

**QueryBuilder 方法**

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `where(field, operator, value)` | 字段、运算符、值 | `this` | 添加条件 |
| `whereEquals(field, value)` | 字段、值 | `this` | 等于条件 |
| `whereIn(field, values)` | 字段、值数组 | `this` | IN 条件 |
| `whereLike(field, pattern)` | 字段、模式 | `this` | LIKE 条件 |
| `whereNull(field)` | 字段 | `this` | IS NULL |
| `whereNotNull(field)` | 字段 | `this` | IS NOT NULL |
| `whereBetween(field, min, max)` | 字段、最小值、最大值 | `this` | BETWEEN |
| `orWhere(conditions)` | 条件数组 | `this` | OR 条件 |
| `orderBy(field, direction)` | 字段、方向 | `this` | 排序 |
| `limit(value)` | 数量 | `this` | 限制数量 |
| `offset(value)` | 偏移量 | `this` | 偏移量 |
| `select(...columns)` | 列名数组 | `this` | 选择列（待实现） |
| `withDeleted()` | - | `this` | 包含已删除 |
| `getMany()` | - | `Promise<T[]>` | 获取所有结果 |
| `getOne()` | - | `Promise<T \| null>` | 获取单个结果 |
| `count()` | - | `Promise<number>` | 统计数量 |
| `exists()` | - | `Promise<boolean>` | 检查存在 |

**示例**

```typescript
const users = await createQueryBuilder(db, userTable, ctx)
  .whereEquals('status', 'active')
  .whereLike('name', 'John%')
  .whereIn('role', ['admin', 'editor'])
  .orderBy('createdAt', 'desc')
  .limit(10)
  .getMany();
```

### 4.5 CRUD 处理器

#### `createDrizzleHandlerFactory`

创建 Drizzle CRUD 处理器工厂。

```typescript
import { createDrizzleHandlerFactory } from '@mtpc/adapter-drizzle/handler';

function createDrizzleHandlerFactory(
  db: DrizzleDB,
  tables: Record<string, PgTable>
): DrizzleHandlerFactory
```

**HandlerFactory 方法**

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `createHandler<T>(resource)` | 资源定义 | `DrizzleCRUDHandler<T>` | 创建处理器 |
| `getHandlerFactoryFn()` | - | `工厂函数` | 获取用于 Hono 的工厂函数 |
| `registerTable(name, table)` | 表名、表定义 | `void` | 注册表 |
| `clearCache()` | - | `void` | 清空缓存 |

#### `DrizzleCRUDHandler`

Drizzle CRUD 处理器。

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

### 4.6 数据库迁移

#### `createMigrationRunner`

创建迁移运行器。

```typescript
import { createMigrationRunner } from '@mtpc/adapter-drizzle/pg/migrations';

function createMigrationRunner(
  db: DrizzleDB,
  options?: { tableName?: string }
): MigrationRunner
```

**MigrationRunner 方法**

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `register(migration)` | 迁移定义 | `this` | 注册单个迁移 |
| `registerMany(migrations)` | 迁移数组 | `this` | 批量注册 |
| `init()` | - | `Promise<void>` | 初始化迁移表 |
| `migrate()` | - | `Promise<string[]>` | 执行所有迁移 |
| `rollback()` | - | `Promise<string \| null>` | 回滚最后一次迁移 |
| `reset()` | - | `Promise<void>` | 重置所有迁移 |
| `getPending()` | - | `Promise<Migration[]>` | 获取待执行迁移 |
| `getExecuted()` | - | `Promise<MigrationRecord[]>` | 获取已执行迁移 |

#### `createSystemTablesMigration`

创建 MTPC 系统表迁移。

```typescript
import { createSystemTablesMigration } from '@mtpc/adapter-drizzle/pg/migrations';

function createSystemTablesMigration(): Migration
```

**创建的表**

- `tenants` - 租户表
- `permission_assignments` - 权限分配表
- `audit_logs` - 审计日志表

**示例**

```typescript
const runner = createMigrationRunner(db);
runner.register(createSystemTablesMigration());
await runner.migrate();
```

---

## 5. 高级功能

### 5.1 自定义 Schema 生成

```typescript
import { generateTable } from '@mtpc/adapter-drizzle';
import { defineResource } from '@mtpc/core';
import { z } from 'zod';

const productResource = defineResource({
  name: 'product',
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    price: z.number().min(0),
    category: z.string().min(1),
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
});

// 生成自定义 Schema
const table = generateTable(productResource, {
  dialect: 'postgresql',
  tenantColumn: 'company_id',  // 自定义租户列名
  timestamps: true,
  softDelete: true,
  auditFields: true,
  idType: 'uuid',
});

console.log('Generated Table:', table);
```

### 5.2 复杂查询构建

```typescript
import { createQueryBuilder } from '@mtpc/adapter-drizzle';

// 构建复杂查询
async function complexQueryExample() {
  // 查找活跃用户，按名称排序，限制 10 条
  const activeUsers = await createQueryBuilder(db, userTable, ctx)
    .whereEquals('active', true)
    .whereIn('role', ['admin', 'editor'])
    .orderBy('name', 'asc')
    .limit(10)
    .getMany();
  
  console.log('Active users:', activeUsers);
  
  // 统计管理员用户数量
  const adminCount = await createQueryBuilder(db, userTable, ctx)
    .whereEquals('role', 'admin')
    .count();
  
  console.log('Admin count:', adminCount);
  
  // 检查用户是否存在
  const exists = await createQueryBuilder(db, userTable, ctx)
    .whereEquals('email', 'test@example.com')
    .exists();
  
  console.log('User exists:', exists);
}

complexQueryExample().catch(console.error);
```

### 5.3 自定义 Repository

```typescript
import { BaseRepository, type RepositoryOptions } from '@mtpc/adapter-drizzle/repository';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

// 自定义仓储类，扩展基础仓储
class CustomUserRepository extends BaseRepository<User> {
  constructor(db, table, tableName) {
    super(db, table, tableName, { tenantColumn: 'tenant_id' });
  }
  
  // 自定义方法
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne(ctx, [{ field: 'email', operator: 'eq', value: email }]);
  }
  
  // 自定义批量更新方法
  async batchUpdateStatus(ids: string[], status: string): Promise<number> {
    return this.updateMany(ctx, ids, { status } as Partial<User>);
  }
}

// 使用自定义仓储
const customUserRepo = new CustomUserRepository(db, userTable, 'users');
const user = await customUserRepo.findByEmail('test@example.com');
```

### 5.4 数据库迁移

```typescript
import { createConnectionFromEnv } from '@mtpc/adapter-drizzle';
import { createMigrationRunner, createSystemTablesMigration } from '@mtpc/adapter-drizzle/pg/migrations';
import { generateAllTables } from '@mtpc/adapter-drizzle/schema';
import { resources } from './resources';

// 创建数据库连接
const { db } = createConnectionFromEnv();

// 创建迁移运行器
const runner = createMigrationRunner(db, { tableName: 'mtpc_migrations' });

// 注册系统表迁移
runner.register(createSystemTablesMigration());

// 注册自定义迁移
runner.register({
  id: '20240101_add_user_profile',
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
const status = await runner.getPending();
console.log('Pending migrations:', status);
```

### 5.5 事务处理

```typescript
import { createConnection } from '@mtpc/adapter-drizzle';

const { db } = createConnection({
  connectionString: process.env.DATABASE_URL,
});

// 使用事务
await db.transaction(async (tx) => {
  // 在事务中执行操作
  await tx.insert(userTable).values({ ... });
  await tx.insert(orderTable).values({ ... });
  // 如果发生错误，事务会自动回滚
});
```

---

## 6. 最佳实践

### 6.1 项目结构推荐

```
src/
├── db/
│   ├── index.ts           # 数据库连接和初始化
│   ├── schema.ts          # 表结构定义
│   └── migrations/        # 迁移文件
├── repositories/
│   ├── user.repository.ts
│   ├── product.repository.ts
│   └── index.ts
└── resources/
    ├── user.resource.ts
    ├── product.resource.ts
    └── index.ts
```

### 6.2 资源定义设计

- 为每个资源定义清晰的 Schema
- 使用描述性的资源名称和字段名
- 明确资源的 CRUD 操作
- 合理设计数据类型
- 考虑多租户隔离需求

### 6.3 Repository 模式使用

- 为每个资源创建专门的仓储类
- 扩展基础仓储实现自定义方法
- 避免在仓储外直接操作数据库
- 使用查询构建器构建复杂查询
- 保持仓储方法的单一职责

### 6.4 数据库连接管理

- 使用连接池管理数据库连接
- 合理配置连接池大小
- 及时关闭不需要的连接
- 为不同环境配置不同的连接参数
- 考虑使用事务处理复杂操作

### 6.5 迁移管理

- 为每个 Schema 变更生成单独的迁移文件
- 按时间顺序执行迁移
- 测试迁移的向上和向下迁移
- 考虑使用迁移版本控制
- 在生产环境中谨慎执行迁移

### 6.6 性能优化

1. **索引优化**：为经常查询的字段添加索引
2. **批量操作**：使用批量操作减少数据库请求
3. **查询优化**：优化复杂查询，避免全表扫描
4. **分页查询**：使用分页减少返回数据量
5. **避免 N+1 查询**：使用 Drizzle 的关系查询优化

### 6.7 安全考虑

- 确保租户数据正确隔离
- 避免 SQL 注入
- 使用参数化查询
- 限制数据库用户权限
- 加密敏感数据
- 定期备份数据

---

## 7. 常见问题解答

### Q1: 如何自定义租户列名？

**方案一**：在 Schema 生成时

```typescript
const table = generateTable(resource, {
  tenantColumn: 'company_id',
});
```

**方案二**：在 Repository 中

```typescript
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
  await tx.update(userTable).set({ balance: newBalance });
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

### Q6: 查询构建器的 select 方法为什么不起作用？

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

## 8. 性能考量

### 8.1 数据库连接池

- 合理配置连接池大小，避免过多连接消耗资源
- 监控连接池使用率，及时调整配置
- 使用连接池复用连接，减少连接建立开销

### 8.2 查询性能

- 避免全表扫描，为经常查询的字段添加索引
- 使用 Drizzle ORM 的查询优化功能
- 避免 N+1 查询问题
- 使用分页减少返回数据量

### 8.3 Schema 设计

- 合理设计表结构，避免过度规范化
- 使用合适的数据类型
- 为外键添加索引
- 考虑数据增长，设计可扩展的 Schema

### 8.4 仓储操作

- 使用批量操作减少数据库请求
- 避免在循环中执行数据库操作
- 合理使用缓存
- 考虑使用读写分离

### 8.5 迁移性能

- 避免大型迁移，将大迁移拆分为多个小迁移
- 在非高峰时间执行迁移
- 测试迁移性能，避免影响生产环境

---

## 9. 注意事项

1. **租户隔离**：确保所有数据库操作都包含租户 ID 过滤，避免跨租户访问
2. **Schema 一致性**：确保生成的 Schema 与资源定义一致
3. **迁移安全**：在生产环境中谨慎执行迁移，建议先在测试环境验证
4. **事务处理**：对于跨表操作，使用事务确保数据一致性
5. **连接管理**：确保及时关闭数据库连接，避免连接泄漏
6. **错误处理**：合理处理数据库错误，避免泄露敏感信息
7. **测试覆盖**：确保所有数据库操作都经过充分测试
8. **版本兼容性**：注意 Drizzle ORM 版本兼容性，避免版本冲突
9. **性能监控**：监控数据库性能，及时发现和解决问题
10. **备份策略**：定期备份数据库，确保数据安全

---

## 10. 版本更新日志

### v0.1.0 (2024-12-27)

- 初始版本发布
- 支持 PostgreSQL 数据库
- 自动租户隔离
- Schema 生成功能
- 基础 Repository 模式
- 数据库迁移支持
- CRUD 处理器
- 查询构建器

---

## 11. 贡献指南

欢迎为 `@mtpc/adapter-drizzle` 包贡献代码或提出改进建议。请遵循以下准则：

1. 提交 Issues 描述问题或建议
2. 提交 Pull Requests 前确保所有测试通过
3. 遵循项目的代码风格和命名规范
4. 提供完整的测试用例
5. 更新相关文档
6. 确保代码符合 TypeScript 类型安全要求
7. 考虑向后兼容性
8. 提供清晰的变更说明

---

## 12. 许可证

`@mtpc/adapter-drizzle` 包采用 MIT 许可证，详见 LICENSE 文件。

---

**文档版本**: 1.0.0  
**最后更新**: 2024-12-27
