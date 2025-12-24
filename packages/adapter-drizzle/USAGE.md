# @mtpc/adapter-drizzle 使用指南

## 1. 包简介

`@mtpc/adapter-drizzle` 是 MTPC (Multi-Tenant Permission Core) 的 Drizzle ORM 适配器，提供将 MTPC 多租户权限核心与 Drizzle ORM 无缝集成的解决方案，支持自动租户隔离、基础仓储模式、Schema 生成工具和数据库迁移系统。

### 核心功能

- **自动租户隔离**：确保数据按租户正确隔离，避免跨租户访问
- **Drizzle Schema 生成**：从资源定义自动生成 Drizzle Schema
- **基础仓储模式**：提供通用的 CRUD 操作和查询构建器
- **数据库迁移支持**：集成 Drizzle 的迁移系统
- **多数据库支持**：目前支持 PostgreSQL，可扩展支持其他数据库
- **查询构建器**：支持复杂查询构建和执行
- **CRUD 处理器**：提供通用的 CRUD 处理逻辑

### 适用场景

- 基于 Drizzle ORM 的多租户应用
- 需要自动生成数据库 Schema 的场景
- 采用仓储模式设计的数据访问层
- 需要数据库迁移管理的应用
- 复杂查询构建需求
- 多租户数据隔离需求

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

## 3. 快速开始

### 3.1 基本使用示例

```typescript
import { createMTPC } from '@mtpc/core';
import { defineResource } from '@mtpc/core';
import { z } from 'zod';
import { createDrizzleRepositoryFactory } from '@mtpc/adapter-drizzle';
import { createPostgresConnection } from '@mtpc/adapter-drizzle/pg';

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
  permissions: [
    { action: 'create', description: 'Create user' },
    { action: 'read', description: 'Read user' },
    { action: 'update', description: 'Update user' },
    { action: 'delete', description: 'Delete user' },
  ],
});

// 创建 MTPC 实例
const mtpc = createMTPC();
mtpc.registerResource(userResource);
await mtpc.init();

// 创建数据库连接
const connection = createPostgresConnection({
  url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mtpc',
});

// 创建仓储工厂
const repositoryFactory = createDrizzleRepositoryFactory({
  connection: connection.db,
  resources: [userResource],
  tenantColumn: 'tenant_id', // 默认为 'tenant_id'
});

// 获取用户仓储
const userRepository = repositoryFactory.getRepository('user');

// 使用仓储进行 CRUD 操作
async function example() {
  // 创建用户
  const createdUser = await userRepository.create('tenant-1', {
    id: '1234-5678-9012',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
  });
  console.log('Created user:', createdUser);

  // 获取用户
  const user = await userRepository.get('tenant-1', '1234-5678-9012');
  console.log('Got user:', user);

  // 更新用户
  const updatedUser = await userRepository.update('tenant-1', '1234-5678-9012', {
    name: 'Jane Doe',
  });
  console.log('Updated user:', updatedUser);

  // 删除用户
  await userRepository.delete('tenant-1', '1234-5678-9012');
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
import { createPostgresConnection } from '@mtpc/adapter-drizzle/pg';
import { createDrizzleHandlerFactory } from '@mtpc/adapter-drizzle/handler';

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
const connection = createPostgresConnection({
  url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mtpc',
});

// 创建 Drizzle 处理器工厂
const drizzleHandlerFactory = createDrizzleHandlerFactory({
  connection: connection.db,
  resources: [postResource],
});

// 创建 MTPC Hono 应用，使用 Drizzle 处理器
const app = createMTPCApp(mtpc, {
  prefix: '/api',
  logging: true,
  errorHandling: true,
  tenantOptions: { headerName: 'x-tenant-id' },
  authOptions: { required: false },
  handlerFactory: drizzleHandlerFactory,
});

// 启动服务器
app.fire(3000);
```

## 4. 核心 API 详解

### 4.1 数据库连接

#### 4.1.1 createPostgresConnection

创建 PostgreSQL 数据库连接。

```typescript
function createPostgresConnection(
  options: PostgresConnectionOptions
): PostgresConnection
```

#### PostgresConnectionOptions

| 属性 | 类型 | 默认值 | 说明 | 是否必填 |
|------|------|--------|------|----------|
| `url` | `string` | - | 数据库连接 URL | 是 |
| `schema` | `string` | `public` | 数据库 Schema 名称 | 否 |
| `pool` | `object` | - | 连接池配置 | 否 |
| `tenantColumn` | `string` | `tenant_id` | 租户 ID 列名 | 否 |
| `timestamps` | `boolean` | `true` | 是否自动添加时间戳字段 | 否 |

#### 返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| `db` | `PostgresJsDatabase` | Drizzle ORM 数据库实例 |
| `connection` | `Postgres` | PostgreSQL 连接实例 |
| `schema` | `object` | 生成的 Drizzle Schema |

### 4.2 Schema 生成

#### 4.2.1 generateDrizzleSchema

从资源定义生成 Drizzle Schema。

```typescript
function generateDrizzleSchema(
  resources: ResourceDefinition[],
  options?: SchemaGeneratorOptions
): Record<string, any>
```

#### SchemaGeneratorOptions

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `dialect` | `'postgresql' | 'mysql' | 'sqlite'` | `postgresql` | 数据库方言 |
| `tenantColumn` | `string` | `tenant_id` | 租户 ID 列名 |
| `timestamps` | `boolean` | `true` | 是否自动添加时间戳字段 |
| `idType` | `'uuid' | 'incremental'` | `uuid` | ID 类型 |

#### 返回值

生成的 Drizzle Schema 对象，键为资源名称，值为对应的 Drizzle 表定义。

### 4.3 仓储模式

#### 4.3.1 createDrizzleRepositoryFactory

创建 Drizzle 仓储工厂，用于创建特定资源的仓储实例。

```typescript
function createDrizzleRepositoryFactory(
  options: RepositoryFactoryOptions
): RepositoryFactory
```

#### RepositoryFactoryOptions

| 属性 | 类型 | 默认值 | 说明 | 是否必填 |
|------|------|--------|------|----------|
| `connection` | `PostgresJsDatabase` | - | Drizzle ORM 数据库实例 | 是 |
| `resources` | `ResourceDefinition[]` | - | 资源定义数组 | 是 |
| `tenantColumn` | `string` | `tenant_id` | 租户 ID 列名 | 否 |
| `timestamps` | `boolean` | `true` | 是否自动添加时间戳字段 | 否 |

#### RepositoryFactory

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `getRepository<T>(resourceName: string)` | `BaseRepository<T>` | 获取指定资源的仓储实例 |
| `getSchema()` | `Record<string, any>` | 获取生成的 Schema |

#### BaseRepository

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `list()` | `options?: ListOptions` | `Promise<T[]>` | 列出资源 |
| `get()` | `tenantId: string, id: string` | `Promise<T | null>` | 获取单个资源 |
| `create()` | `tenantId: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>` | `Promise<T>` | 创建资源 |
| `update()` | `tenantId: string, id: string, data: Partial<T>` | `Promise<T>` | 更新资源 |
| `delete()` | `tenantId: string, id: string` | `Promise<void>` | 删除资源 |
| `count()` | `tenantId: string, filter?: FilterOptions` | `Promise<number>` | 统计资源数量 |
| `find()` | `tenantId: string, filter: FilterOptions` | `Promise<T[]>` | 查找资源 |
| `query()` | - | `QueryBuilder<T>` | 获取查询构建器 |

### 4.4 查询构建器

#### 4.4.1 QueryBuilder

查询构建器用于构建复杂查询。

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `where()` | `field: string, operator: string, value: any` | `QueryBuilder<T>` | 添加 WHERE 条件 |
| `andWhere()` | `field: string, operator: string, value: any` | `QueryBuilder<T>` | 添加 AND WHERE 条件 |
| `orWhere()` | `field: string, operator: string, value: any` | `QueryBuilder<T>` | 添加 OR WHERE 条件 |
| `orderBy()` | `field: string, direction?: 'asc' | 'desc'` | `QueryBuilder<T>` | 添加 ORDER BY 子句 |
| `limit()` | `limit: number` | `QueryBuilder<T>` | 添加 LIMIT 子句 |
| `offset()` | `offset: number` | `QueryBuilder<T>` | 添加 OFFSET 子句 |
| `select()` | `fields?: string[]` | `QueryBuilder<T>` | 指定要查询的字段 |
| `execute()` | - | `Promise<T[]>` | 执行查询并返回结果 |
| `count()` | - | `Promise<number>` | 执行 COUNT 查询 |

### 4.5 CRUD 处理器

#### 4.5.1 createDrizzleHandlerFactory

创建 Drizzle CRUD 处理器工厂，用于生成 Hono 路由的 CRUD 处理器。

```typescript
function createDrizzleHandlerFactory(
  options: HandlerFactoryOptions
): <T>(resource: ResourceDefinition) => CRUDHandlers<T>
```

#### HandlerFactoryOptions

| 属性 | 类型 | 默认值 | 说明 | 是否必填 |
|------|------|--------|------|----------|
| `connection` | `PostgresJsDatabase` | - | Drizzle ORM 数据库实例 | 是 |
| `resources` | `ResourceDefinition[]` | - | 资源定义数组 | 是 |
| `tenantColumn` | `string` | `tenant_id` | 租户 ID 列名 | 否 |
| `timestamps` | `boolean` | `true` | 是否自动添加时间戳字段 | 否 |

#### 返回值

返回一个工厂函数，该函数接受资源定义并返回对应的 CRUD 处理器。

### 4.6 数据库迁移

#### 4.6.1 createDrizzleMigrations

创建数据库迁移管理器。

```typescript
function createDrizzleMigrations(
  options: MigrationsOptions
): MigrationManager
```

#### MigrationsOptions

| 属性 | 类型 | 默认值 | 说明 | 是否必填 |
|------|------|--------|------|----------|
| `db` | `PostgresJsDatabase` | - | Drizzle ORM 数据库实例 | 是 |
| `schema` | `Record<string, any>` | - | Drizzle Schema | 是 |
| `migrationsDir` | `string` | `./migrations` | 迁移文件目录 | 否 |

#### MigrationManager

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `generate()` | `name: string` | `Promise<void>` | 生成新的迁移文件 |
| `run()` | - | `Promise<void>` | 运行所有待执行的迁移 |
| `down()` | `steps?: number` | `Promise<void>` | 回滚迁移 |
| `status()` | - | `Promise<MigrationStatus[]>` | 获取迁移状态 |

## 5. 高级功能

### 5.1 自定义 Schema 生成

```typescript
import { generateDrizzleSchema } from '@mtpc/adapter-drizzle/schema';
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
const schema = generateDrizzleSchema([productResource], {
  dialect: 'postgresql',
  tenantColumn: 'company_id', // 自定义租户列名
  timestamps: true,
  idType: 'incremental', // 使用自增 ID
});

console.log('Generated Schema:', schema);
```

### 5.2 复杂查询构建

```typescript
import { createDrizzleRepositoryFactory } from '@mtpc/adapter-drizzle';

// 创建仓储工厂
const repositoryFactory = createDrizzleRepositoryFactory({
  connection: db,
  resources: [userResource],
});

// 获取用户仓储
const userRepository = repositoryFactory.getRepository('user');

// 构建复杂查询
async function complexQueryExample() {
  // 查找活跃用户，按名称排序，限制 10 条
  const activeUsers = await userRepository
    .query()
    .where('active', '=', true)
    .where('role', 'in', ['admin', 'editor'])
    .orderBy('name', 'asc')
    .limit(10)
    .execute();
  
  console.log('Active users:', activeUsers);
  
  // 统计管理员用户数量
  const adminCount = await userRepository
    .query()
    .where('role', '=', 'admin')
    .count();
  
  console.log('Admin count:', adminCount);
}

complexQueryExample().catch(console.error);
```

### 5.3 自定义仓储

```typescript
import { BaseRepository } from '@mtpc/adapter-drizzle/repository';

// 自定义仓储类，扩展基础仓储
class CustomUserRepository extends BaseRepository<any> {
  // 自定义方法
  async findByEmail(tenantId: string, email: string) {
    return this.query()
      .where('email', '=', email)
      .execute()
      .then(users => users[0] || null);
  }
  
  // 自定义批量更新方法
  async batchUpdateStatus(tenantId: string, ids: string[], status: string) {
    // 实现批量更新逻辑
    // ...
  }
}

// 使用自定义仓储
const customUserRepo = new CustomUserRepository(
  db,
  schema.user,
  'tenant_id',
  userResource
);

// 调用自定义方法
const user = await customUserRepo.findByEmail('tenant-1', 'test@example.com');
```

### 5.4 数据库迁移

```typescript
import { createPostgresConnection } from '@mtpc/adapter-drizzle/pg';
import { createDrizzleMigrations } from '@mtpc/adapter-drizzle/pg/migrations';
import { generateDrizzleSchema } from '@mtpc/adapter-drizzle/schema';
import { resources } from './resources';

// 创建数据库连接
const connection = createPostgresConnection({
  url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mtpc',
});

// 生成 Schema
const schema = generateDrizzleSchema(resources);

// 创建迁移管理器
const migrationManager = createDrizzleMigrations({
  db: connection.db,
  schema,
  migrationsDir: './src/migrations',
});

// 生成新迁移
await migrationManager.generate('initial-schema');

// 运行迁移
await migrationManager.run();

// 检查迁移状态
const status = await migrationManager.status();
console.log('Migration status:', status);
```

## 6. 最佳实践

### 6.1 资源定义设计

- 为每个资源定义清晰的 Schema
- 使用描述性的资源名称和字段名
- 明确资源的 CRUD 操作
- 合理设计数据类型
- 考虑多租户隔离需求

### 6.2 仓储模式使用

- 为每个资源创建专门的仓储类
- 扩展基础仓储实现自定义方法
- 避免在仓储外直接操作数据库
- 使用查询构建器构建复杂查询
- 保持仓储方法的单一职责

### 6.3 数据库连接管理

- 使用连接池管理数据库连接
- 合理配置连接池大小
- 及时关闭不需要的连接
- 为不同环境配置不同的连接参数
- 考虑使用事务处理复杂操作

### 6.4 迁移管理

- 为每个 Schema 变更生成单独的迁移文件
- 按时间顺序执行迁移
- 测试迁移的向上和向下迁移
- 考虑使用迁移版本控制
- 在生产环境中谨慎执行迁移

### 6.5 性能优化

1. **索引优化**：为经常查询的字段添加索引
2. **批量操作**：使用批量操作减少数据库请求
3. **查询优化**：优化复杂查询，避免全表扫描
4. **缓存策略**：对频繁访问的数据使用缓存
5. **分页查询**：使用分页减少返回数据量
6. **避免 N+1 查询**：使用 Drizzle 的关系查询优化

### 6.6 安全考虑

- 确保租户数据正确隔离
- 避免 SQL 注入
- 使用参数化查询
- 限制数据库用户权限
- 加密敏感数据
- 定期备份数据

## 7. 常见问题解答

### 7.1 Q: 如何自定义租户列名？

A: 在创建连接或仓储工厂时，可以通过 `tenantColumn` 选项自定义租户列名：

```typescript
const connection = createPostgresConnection({
  url: process.env.DATABASE_URL,
  tenantColumn: 'company_id', // 自定义租户列名
});

const repositoryFactory = createDrizzleRepositoryFactory({
  connection: connection.db,
  resources: [userResource],
  tenantColumn: 'company_id', // 自定义租户列名
});
```

### 7.2 Q: 如何生成迁移文件？

A: 使用迁移管理器的 `generate` 方法生成迁移文件：

```typescript
const migrationManager = createDrizzleMigrations({
  db: connection.db,
  schema,
  migrationsDir: './migrations',
});

// 生成新的迁移文件
await migrationManager.generate('add-new-field');
```

### 7.3 Q: 如何处理事务？

A: 使用 Drizzle ORM 的事务 API：

```typescript
await connection.db.transaction(async (tx) => {
  // 在事务中执行操作
  await tx.insert(schema.user).values({ ... });
  await tx.insert(schema.post).values({ ... });
  // 如果发生错误，事务会自动回滚
});
```

### 7.4 Q: 如何自定义查询构建器？

A: 可以扩展基础查询构建器或直接使用 Drizzle ORM 的查询 API：

```typescript
// 使用 Drizzle ORM 直接查询
const users = await connection.db
  .select()
  .from(schema.user)
  .where(eq(schema.user.tenantId, 'tenant-1'))
  .where(like(schema.user.name, '%John%'));
```

### 7.5 Q: 如何处理多对多关系？

A: 在资源定义中使用 `relations` 属性定义关系，然后使用 Drizzle ORM 的关系查询：

```typescript
// 定义多对多关系
const userRoleResource = defineResource({
  name: 'user_role',
  schema: z.object({
    userId: z.string().uuid(),
    roleId: z.string().uuid(),
  }),
  relations: {
    user: { type: 'many-to-one', target: 'user', fields: ['userId'] },
    role: { type: 'many-to-one', target: 'role', fields: ['roleId'] },
  },
});

// 查询用户及其角色
const usersWithRoles = await connection.db
  .select({
    user: schema.user,
    roles: schema.role,
  })
  .from(schema.user)
  .leftJoin(schema.userRole, eq(schema.user.id, schema.userRole.userId))
  .leftJoin(schema.role, eq(schema.userRole.roleId, schema.role.id))
  .where(eq(schema.user.tenantId, 'tenant-1'));
```

### 7.6 Q: 如何支持其他数据库？

A: 目前 `@mtpc/adapter-drizzle` 主要支持 PostgreSQL，但可以扩展支持其他数据库。需要：

1. 创建对应的连接管理模块
2. 实现对应的 Schema 生成逻辑
3. 实现对应的迁移管理

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

## 10. 版本更新日志

### v1.0.0 (2024-01-01)

- 初始版本发布
- 支持 PostgreSQL 数据库
- 自动租户隔离
- Schema 生成功能
- 基础仓储模式
- 数据库迁移支持
- CRUD 处理器
- 查询构建器

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

## 12. 许可证

`@mtpc/adapter-drizzle` 包采用 MIT 许可证，详见 LICENSE 文件。

## 13. 联系方式

- 项目仓库：https://github.com/your-org/mtpc
- 问题反馈：https://github.com/your-org/mtpc/issues
- 文档地址：https://docs.mtpc.io

---

通过本指南，您应该已经掌握了 `@mtpc/adapter-drizzle` 包的核心功能和使用方法。如果您有任何问题或建议，欢迎随时反馈。