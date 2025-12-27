# @mtpc/codegen

MTPC 权限代码生成器 - 从资源定义自动生成权限代码、类型定义、元数据和数据库 Schema。

## 目录

- [核心定位](#核心定位)
- [安装](#安装)
- [核心 API](#核心-api)
- [配置选项](#配置选项)
- [CLI 使用](#cli-使用)
- [使用示例](#使用示例)
- [生成的文件](#生成的文件)
- [源码问题与建议](#源码问题与建议)
- [最佳实践](#最佳实践)

---

## 核心定位

`@mtpc/codegen` 是 MTPC 架构中 **"编译期优先"** 设计原则的重要实现。它不是一个运行时依赖，而是开发时工具，用于从 [`ResourceDefinition`](packages/core/src/resource/define.ts) 派生各种代码产物：

| 生成类型 | 输出 | 说明 |
|---------|------|------|
| 权限代码 | `permissions.ts` | 权限常量、枚举或对象格式 |
| 权限类型 | `permission-types.ts` | TypeScript 类型定义 |
| 类型定义 | `types.ts` | 实体类型、输入类型、Zod Schema |
| 元数据 | `metadata.ts` / `metadata.json` | 资源元信息（供 UI 消费） |
| Drizzle Schema | `schema.ts` | Drizzle ORM 表定义 |
| SQL Schema | `schema.sql` | 纯 SQL CREATE TABLE 语句 |
| 索引文件 | `index.ts` | 统一导出入口 |

---

## 安装

```bash
# 使用 pnpm（推荐）
pnpm add @mtpc/codegen @mtpc/core -D

# 或使用 npm
npm install @mtpc/codegen @mtpc/core -D

# 或使用 yarn
yarn add @mtpc/codegen @mtpc/core -D
```

---

## 核心 API

### Codegen 类

```typescript
import { Codegen } from '@mtpc/codegen';
```

| 方法 | 描述 |
|------|------|
| [`constructor(options)`](#codegen-类) | 创建代码生成器实例 |
| [`generate()`](#generate) | 生成所有代码（内存中，返回 `GenerationResult`） |
| [`generateAndWrite(options)`](#generateandwrite) | 生成并写入磁盘 |
| [`addResource(resource)`](#addresource) | 添加单个资源 |
| [`addResources(resources)`](#addresources) | 批量添加资源 |

### 工厂函数

```typescript
import { createCodegen, generate } from '@mtpc/codegen';
```

| 函数 | 描述 |
|------|------|
| [`createCodegen(options)`](#createcodegen) | 创建 Codegen 实例 |
| [`generate(resources, outputDir, options)`](#generate-1) | 快速生成函数（异步） |

---

## 配置选项

### CodegenOptions

```typescript
interface CodegenOptions {
  /** 输出目录路径 */
  outputDir: string;
  /** 资源定义列表 */
  resources: ResourceDefinition[];
  /** 权限代码生成选项 */
  permissions?: PermissionOptions;
  /** TypeScript 类型生成选项 */
  typescript?: TypeScriptOptions;
  /** 元数据生成选项 */
  metadata?: MetadataOptions;
  /** 数据库 Schema 生成选项 */
  schema?: SchemaOptions;
}
```

### PermissionOptions

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用权限生成 |
| `outputFile` | `string` | `'permissions.ts'` | 输出文件名 |
| `format` | `'const' \| 'enum' \| 'object'` | `'const'` | 输出格式 |
| `prefix` | `string` | `''` | 常量名称前缀 |

### TypeScriptOptions

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用 TypeScript 生成 |
| `outputFile` | `string` | `'types.ts'` | 输出文件名 |
| `includeZodSchemas` | `boolean` | `true` | 是否包含 Zod Schema |
| `includeEntityTypes` | `boolean` | `true` | 是否包含实体类型 |
| `includeInputTypes` | `boolean` | `true` | 是否包含输入类型 |

### MetadataOptions

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用元数据生成 |
| `outputFile` | `string` | `'metadata.ts'` | 输出文件名 |
| `includePermissions` | `boolean` | `true` | 是否包含权限信息 |
| `includeFeatures` | `boolean` | `true` | 是否包含功能特性 |

### SchemaOptions

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用 Schema 生成 |
| `outputFile` | `string` | `'schema.ts'` | 输出文件名 |
| `dialect` | `'postgresql' \| 'mysql' \| 'sqlite'` | `'postgresql'` | 数据库方言（**注意：当前版本未实现**） |
| `tenantColumn` | `string` | `'tenant_id'` | 租户 ID 列名 |
| `timestamps` | `boolean` | `true` | 是否包含时间戳字段 |

> **⚠️ 已知问题**：`dialect` 选项已在类型定义中声明，但当前版本（v0.1.0）未实现。生成的 Drizzle Schema 和 SQL Schema 始终使用 PostgreSQL 语法。

---

## CLI 使用

### 命令

```bash
# 生成代码（默认命令）
mtpc-codegen generate

# 初始化配置文件
mtpc-codegen init
```

### 选项

| 选项 | 短格式 | 默认值 | 描述 |
|------|--------|--------|------|
| `--config <path>` | `-c` | `'mtpc.config.js'` | 配置文件路径 |
| `--output <path>` | `-o` | `'./generated'` | 输出目录 |
| `--clean` | - | `false` | 生成前清空输出目录 |
| `--dry-run` | - | `false` | 预览模式（不写入文件） |
| `--help` | `-h` | - | 显示帮助信息 |

### 使用示例

```bash
# 基本使用
mtpc-codegen generate

# 指定输出目录
mtpc-codegen generate -o ./src/generated

# 预览（不写入文件）
mtpc-codegen generate --dry-run

# 清空后重新生成
mtpc-codegen generate --clean

# 使用自定义配置文件
mtpc-codegen generate -c ./mtpc.config.ts

# 初始化配置模板
mtpc-codegen init
```

---

## 使用示例

### 基本用法

```typescript
import { createCodegen } from '@mtpc/codegen';
import { defineResource } from '@mtpc/core';
import { z } from 'zod';

// 定义资源
const userResource = defineResource({
  name: 'user',
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(2).max(100),
    email: z.string().email(),
    role: z.enum(['admin', 'user', 'guest']),
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: true,
    list: true,
  },
});

// 创建代码生成器
const codegen = createCodegen({
  outputDir: './src/generated',
  resources: [userResource],
  permissions: {
    format: 'const',
    prefix: 'APP_',
  },
  typescript: {
    includeZodSchemas: true,
  },
  schema: {
    enabled: true,
    dialect: 'postgresql', // 当前版本仅支持 PostgreSQL
    timestamps: true,
  },
});

// 生成并写入文件
const result = await codegen.generateAndWrite();

console.log(`Generated ${result.files.length} files`);
```

### 快速生成

```typescript
import { generate } from '@mtpc/codegen';
import { defineResource } from '@mtpc/core';
import { z } from 'zod';

const userResource = defineResource({
  name: 'user',
  schema: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  features: { create: true, read: true, update: true, delete: true },
});

// 一键生成（异步）
const result = await generate(
  [userResource],
  './src/generated',
  {
    permissions: { format: 'enum' },
    typescript: { includeZodSchemas: true },
    schema: { enabled: true },
  }
);

console.log(`Generated ${result.files.length} files`);
```

### 动态添加资源

```typescript
import { createCodegen } from '@mtpc/codegen';

const codegen = createCodegen({
  outputDir: './src/generated',
  resources: [],
});

// 链式添加资源
codegen
  .addResource(userResource)
  .addResource(postResource)
  .addResources([orderResource, productResource]);

await codegen.generateAndWrite({ clean: true });
```

### 配置文件

创建 `mtpc.config.ts`：

```typescript
import { z } from 'zod';
import { defineResource } from '@mtpc/core';

const userResource = defineResource({
  name: 'user',
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(2),
    email: z.string().email(),
  }),
  features: { create: true, read: true, update: true, delete: true },
});

export const resources = [userResource];
export default { resources };
```

运行：

```bash
mtpc-codegen generate -c mtpc.config.ts
```

---

## 生成的文件

### 权限代码 (permissions.ts)

**const 格式（默认）：**

```typescript
export const USER_CREATE = 'user:create' as const;
export const USER_READ = 'user:read' as const;
export const USER_UPDATE = 'user:update' as const;
export const USER_DELETE = 'user:delete' as const;

export const PERMISSIONS = {
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
} as const;

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS];
```

**enum 格式：**

```typescript
export enum Permission {
  UserCreate = 'user:create',
  UserRead = 'user:read',
  UserUpdate = 'user:update',
  UserDelete = 'user:delete',
}
```

**object 格式：**

```typescript
export const Permissions = {
  user: {
    create: 'user:create',
    read: 'user:read',
    update: 'user:update',
    delete: 'user:delete',
  },
} as const;
```

### 权限类型 (permission-types.ts)

```typescript
export type ResourceName = 'user' | 'post';

export type ResourceActions = {
  user: 'create' | 'read' | 'update' | 'delete';
  post: 'create' | 'read' | 'update' | 'delete';
};

export type PermissionCode<R extends ResourceName = ResourceName> =
  `${R}:${ResourceActions[R]}`;
```

### 类型定义 (types.ts)

```typescript
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']),
});

export type User = z.infer<typeof UserSchema>;

export type EntityTypes = {
  user: User;
  post: Post;
};
```

### 元数据 (metadata.ts)

```typescript
export interface ResourceMetadata {
  name: string;
  displayName: string;
  pluralName: string;
  description?: string;
  icon?: string;
  group?: string;
  hidden: boolean;
  features: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    list: boolean;
  };
  permissions: Array<{ code: string; action: string; description?: string }>;
  fields: Array<{ name: string; type: string; required: boolean }>;
}

export const resourceMetadata: Record<string, ResourceMetadata> = {
  user: {
    name: 'user',
    displayName: 'User',
    // ...
  },
};

export function getResourceMetadata(name: string): ResourceMetadata | undefined {
  return resourceMetadata[name];
}
```

### Drizzle Schema (schema.ts)

```typescript
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';

export const userTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('users_tenant_idx').on(table.tenantId),
}));

export const tables = {
  user: userTable,
};
```

### SQL Schema (schema.sql)

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS users_tenant_idx ON users(tenant_id);
```

---

## 源码问题与建议

### 已知问题

#### 1. `dialect` 选项未实现

**位置**：[`types.ts:75`](packages/codegen/src/types.ts#L75) 定义了 `SchemaOptions.dialect`

**问题**：`dialect` 选项已在类型定义中声明，但 `schema-generator.ts` 中未使用此选项。

**当前行为**：
- Drizzle Schema 始终生成 PostgreSQL 特有的导入（`drizzle-orm/pg-core`）
- SQL Schema 始终生成 PostgreSQL 语法（`gen_random_uuid()`, `UUID`, `TIMESTAMP WITH TIME ZONE`）

**影响**：设置 `dialect: 'mysql'` 或 `dialect: 'sqlite'` 不会改变生成的代码。

**建议**：
1. **实现多数据库支持**：根据 `dialect` 值生成对应数据库的代码
2. **或移除选项**：保持 API 简洁，移除未使用的 `dialect` 选项

#### 2. SQL Schema 始终使用 PostgreSQL 语法

**位置**：[`generateSQLSchema()`](packages/codegen/src/generators/schema-generator.ts#L293)

**问题**：即使未来实现 `dialect` 选项，当前的 `fieldToSQLType()` 函数只返回 PostgreSQL 类型。

**建议**：重构 `fieldToSQLType()` 以支持多数据库类型映射。

### 代码质量建议

1. **添加类型守卫**：`SchemaOptions.dialect` 应在运行时检查
2. **添加警告**：当使用不支持的 `dialect` 值时，输出警告日志
3. **完善测试**：添加集成测试验证生成的代码

---

## 最佳实践

### 1. 集成到构建流程

```json
{
  "scripts": {
    "codegen": "mtpc-codegen generate",
    "build": "pnpm codegen && tsc",
    "dev": "pnpm codegen --watch && vite"
  }
}
```

### 2. 集成到 CI/CD

```yaml
steps:
  - name: Install dependencies
    run: pnpm install

  - name: Generate code
    run: pnpm codegen

  - name: Build
    run: pnpm build
```

### 3. 版本控制

将生成的代码提交到版本控制系统，便于：

- 代码审查
- 追踪变更历史
- 团队协作

### 4. 代码组织

```
src/
├── generated/          # 代码生成输出目录
│   ├── index.ts
│   ├── permissions.ts
│   ├── types.ts
│   ├── metadata.ts
│   └── schema.ts
├── resources/          # 资源定义
│   ├── user.ts
│   └── post.ts
└── mtpc.config.ts      # 配置文件
```

### 5. 分离关注点

- 资源定义与业务逻辑分离
- 生成的代码视为只读
- 自定义逻辑通过扩展实现

---

## 与 @mtpc/core 的关系

```
┌─────────────────────────────────────────┐
│         @mtpc/codegen                   │
│  ┌─────────┬─────────┬─────────────┐    │
│  │Permission│ TypeScript│ Schema │    │
│  │Generator │ Generator │Generator │    │
│  └─────────┴─────────┴─────────────┘    │
└────────────────┬────────────────────────┘
                 │ 生成
                 ▼
┌─────────────────────────────────────────┐
│         @mtpc/core                      │
│  ┌─────────────────────────────────┐    │
│  │     ResourceDefinition          │    │
│  │  (单一事实源 Single Source of   │    │
│  │   Truth)                        │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

- `@mtpc/core` 提供 [`ResourceDefinition`](packages/core/src/resource/define.ts) 定义
- `@mtpc/codegen` 从定义派生各类代码产物
- 派生产物用于类型安全和开发体验优化

---

## 常见问题

### Q: 生成的代码可以修改吗？

**不建议**。生成的代码应视为只读，修改会在下次生成时丢失。如需自定义，请修改资源定义后重新生成。

### Q: 如何添加自定义字段？

在资源定义的 Schema 中添加 Zod 字段，生成器会自动处理：

```typescript
const resource = defineResource({
  name: 'user',
  schema: z.object({
    // ... 原有字段
    phone: z.string().optional(),  // 新增字段
  }),
});
```

### Q: 支持 MySQL/SQLite 吗？

**当前版本不支持**。生成的代码始终使用 PostgreSQL 语法。`dialect` 选项已声明但未实现。

### Q: 支持自定义模板吗？

当前版本不支持自定义模板。如有需求，请提交 Issue 讨论。

### Q: 生成的代码有性能影响吗？

不会。`@mtpc/codegen` 是编译时工具，生成的代码与手写代码性能一致。

---

## 版本历史

### v0.1.0

- 初始版本发布
- 权限代码生成（const、enum、object 格式）
- TypeScript 类型生成
- 元数据生成
- Drizzle ORM Schema 生成
- SQL Schema 生成（PostgreSQL 语法）
- CLI 工具支持
- 配置文件支持

**已知限制**：`dialect` 选项未实现

---

## 许可证

MIT License
