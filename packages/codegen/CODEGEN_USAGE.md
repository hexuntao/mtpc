# @mtpc/codegen 技术分析与使用指南

## 1. 包简介

`@mtpc/codegen` 是 MTPC (Multi-Tenant Permission Core) 的代码生成工具，负责从资源定义生成各类代码文件，是 MTPC 核心架构中 "编译期优先" 设计原则的重要实现。

### 核心定位

`@mtpc/codegen` 不是运行时依赖，而是开发时工具，用于在编译期从 Resource Definition 派生各种代码产物，包括权限代码、TypeScript 类型、元数据和数据库 Schema。

### 核心功能

- **权限代码生成**：生成权限常量、枚举和类型定义
- **TypeScript 类型生成**：从资源 Schema 生成类型安全的 TypeScript 定义
- **元数据生成**：生成资源元数据，用于权限管理和 UI 渲染
- **数据库 Schema 生成**：支持生成 Drizzle ORM Schema 和 SQL 脚本
- **灵活的配置选项**：支持多种输出格式和自定义配置
- **CLI 支持**：提供命令行工具，便于集成到构建流程

### 适用场景

- 从资源定义生成权限代码和类型
- 自动化生成数据库 Schema，减少手动编写工作量
- 确保权限代码与资源定义的一致性
- 提高开发效率，减少手动编码错误
- 支持多种输出格式，适应不同项目需求
- 便于集成到 CI/CD 流程

## 2. 技术架构与模块设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        @mtpc/codegen                           │
├────────────────┬───────────────────┬─────────────────┬─────────┤
│  Generators    │    Templates      │    Writers      │  CLI    │
├────────────────┼───────────────────┼─────────────────┼─────────┤
│ - Permission   │ - Base Templates  │ - File Writer   │ - CLI   │
│ - TypeScript   │ - Helper Functions│ - Console Writer│  Entry  │
│ - Metadata     │                   │                 │         │
│ - Schema       │                   │                 │         │
└────────────────┴───────────────────┴─────────────────┴─────────┘
          │                              │
          ▼                              ▼
┌─────────────────┐            ┌─────────────────┐
│  @mtpc/core     │            │  File System    │
└─────────────────┘            └─────────────────┘
```

### 2.2 模块职责

| 模块 | 主要职责 | 关键组件 |
|------|----------|----------|
| **Generators** | 各类代码生成逻辑 | `PermissionGenerator`、`TypeScriptGenerator`、`MetadataGenerator`、`SchemaGenerator` |
| **Templates** | 模板渲染和辅助函数 | 基础模板、辅助函数 |
| **Writers** | 文件写入和输出 | `FileWriter`、`ConsoleWriter` |
| **CLI** | 命令行工具 | `cli.ts` |

### 2.3 核心依赖关系

| 依赖包 | 版本 | 用途 |
|--------|------|------|
| `@mtpc/core` | workspace:* | 提供资源定义等核心类型和功能 |
| `@mtpc/shared` | workspace:* | 共享工具函数 |
| `zod` | ^3.23.0 | Schema 验证和类型生成 |
| `typescript` | ^5.3.0 | TypeScript 类型支持 |

## 3. 核心 API 设计

### 3.1 主要类与函数

| API | 类型 | 描述 |
|-----|------|------|
| `Codegen` | 类 | 主要的代码生成器，负责协调各类生成器 |
| `createCodegen()` | 函数 | 工厂函数，创建 Codegen 实例 |
| `generate()` | 函数 | 快速生成函数，一站式代码生成入口 |
| `generatePermissionCodes()` | 函数 | 生成权限代码 |
| `generatePermissionTypes()` | 函数 | 生成权限类型 |
| `generateTypeScriptTypes()` | 函数 | 生成 TypeScript 类型 |
| `generateMetadata()` | 函数 | 生成元数据 JSON |
| `generateMetadataTS()` | 函数 | 生成元数据 TypeScript |
| `generateDrizzleSchema()` | 函数 | 生成 Drizzle ORM Schema |
| `generateSQLSchema()` | 函数 | 生成 SQL Schema |

### 3.2 核心配置选项

#### `CodegenOptions`

```typescript
interface CodegenOptions {
  outputDir: string;          // 输出目录
  resources: ResourceDefinition[]; // 资源定义列表
  permissions?: PermissionOptions; // 权限生成选项
  typescript?: TypeScriptOptions;   // TypeScript 生成选项
  metadata?: MetadataOptions;       // 元数据生成选项
  schema?: SchemaOptions;           // Schema 生成选项
}
```

#### 权限生成选项 (`PermissionOptions`)

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用权限生成 |
| `outputFile` | `string` | `permissions.ts` | 输出文件名 |
| `format` | `'const' | 'enum' | 'object'` | `'const'` | 输出格式 |
| `prefix` | `string` | `''` | 常量名称前缀 |

#### TypeScript 生成选项 (`TypeScriptOptions`)

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用 TypeScript 生成 |
| `outputFile` | `string` | `types.ts` | 输出文件名 |
| `includeZodSchemas` | `boolean` | `false` | 是否包含 Zod Schema |
| `includeEntityTypes` | `boolean` | `true` | 是否包含实体类型 |
| `includeInputTypes` | `boolean` | `true` | 是否包含输入类型 |

#### 元数据生成选项 (`MetadataOptions`)

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用元数据生成 |
| `outputFile` | `string` | `metadata.ts` | 输出文件名 |
| `includePermissions` | `boolean` | `true` | 是否包含权限信息 |
| `includeFeatures` | `boolean` | `true` | 是否包含功能特性 |

#### Schema 生成选项 (`SchemaOptions`)

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用 Schema 生成 |
| `outputFile` | `string` | `schema.ts` | 输出文件名 |
| `dialect` | `'postgresql' | 'mysql' | 'sqlite'` | `'postgresql'` | 数据库方言 |
| `tenantColumn` | `string` | `'tenant_id'` | 租户 ID 列名 |
| `timestamps` | `boolean` | `true` | 是否包含时间戳字段 |

## 4. 核心功能实现分析

### 4.1 权限代码生成

权限代码生成是 `@mtpc/codegen` 的核心功能之一，支持三种输出格式：

#### 4.1.1 常量格式 (`const`)

生成独立的常量声明和一个聚合对象：

```typescript
export const USER_CREATE = 'user:create';
export const USER_READ = 'user:read';

export const PERMISSIONS = {
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
} as const;

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS];
```

#### 4.1.2 枚举格式 (`enum`)

生成 TypeScript 枚举：

```typescript
export enum Permission {
  UserCreate = 'user:create',
  UserRead = 'user:read',
}
```

#### 4.1.3 对象格式 (`object`)

生成按资源分组的权限对象：

```typescript
export const Permissions = {
  user: {
    create: 'user:create',
    read: 'user:read',
  },
  post: {
    create: 'post:create',
    read: 'post:read',
  },
} as const;
```

### 4.2 权限类型生成

生成类型安全的权限相关类型：

```typescript
export type ResourceName = 'user' | 'post';

export type ResourceActions = {
  user: 'create' | 'read' | 'update' | 'delete';
  post: 'create' | 'read' | 'update' | 'delete';
};

export type PermissionCode<R extends ResourceName = ResourceName> = `${R}:${ResourceActions[R]}`;
```

### 4.3 TypeScript 类型生成

从资源 Schema 生成类型安全的 TypeScript 定义，支持：

- 实体类型（用于数据库模型）
- 输入类型（用于创建和更新操作）
- Zod Schema（用于数据验证）

### 4.4 元数据生成

生成资源元数据，用于：

- 权限管理界面
- 菜单元数据生成
- API 文档生成
- 权限矩阵展示

支持生成 JSON 和 TypeScript 两种格式。

### 4.5 数据库 Schema 生成

支持生成两种类型的数据库 Schema：

1. **Drizzle ORM Schema**：用于 TypeScript 项目，支持类型安全的数据库操作
2. **SQL Schema**：支持多种数据库方言，可直接用于数据库迁移

## 5. 使用指南

### 5.1 安装

使用 pnpm 安装 `@mtpc/codegen` 包：

```bash
pnpm add @mtpc/codegen @mtpc/core -D
```

### 5.2 基本使用示例

#### 5.2.1 使用 `Codegen` 类

```typescript
import { createCodegen } from '@mtpc/codegen';
import { defineResource } from '@mtpc/core';
import { z } from 'zod';

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

const postResource = defineResource({
  name: 'post',
  schema: z.object({
    id: z.string().uuid(),
    title: z.string().min(1),
    content: z.string().min(1),
    authorId: z.string().uuid(),
  }),
  features: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  permissions: [
    { action: 'create', description: 'Create post' },
    { action: 'read', description: 'Read post' },
    { action: 'update', description: 'Update post' },
    { action: 'delete', description: 'Delete post' },
  ],
});

// 创建代码生成器实例
const codegen = createCodegen({
  outputDir: './src/generated',
  resources: [userResource, postResource],
  permissions: {
    format: 'const',
    prefix: 'APP_',
  },
  typescript: {
    includeZodSchemas: true,
  },
  schema: {
    enabled: true,
    dialect: 'postgresql',
    timestamps: true,
  },
});

// 生成代码并写入磁盘
const result = await codegen.generateAndWrite();

console.log(`Generated ${result.files.length} files`);
if (result.errors.length > 0) {
  console.error('Errors during generation:', result.errors);
} else {
  console.log('Code generation completed successfully!');
}
```

#### 5.2.2 使用快速生成函数

```typescript
import { generate } from '@mtpc/codegen';
import { defineResource } from '@mtpc/core';
import { z } from 'zod';

// 定义资源...（与上例相同）

// 快速生成代码
const result = await generate(
  [userResource, postResource],
  './src/generated',
  {
    permissions: { format: 'enum' },
    typescript: { includeZodSchemas: true },
    schema: { enabled: true, dialect: 'mysql' },
  }
);

console.log(`Generated ${result.files.length} files`);
```

### 5.3 命令行使用

`@mtpc/codegen` 提供了 CLI 工具，可以通过 `mtpc-codegen` 命令使用：

```bash
# 基本使用
npx mtpc-codegen --config ./mtpc.codegen.config.ts

# 指定资源文件和输出目录
npx mtpc-codegen --resources ./src/resources.ts --output ./src/generated

# 显示帮助信息
npx mtpc-codegen --help
```

#### 5.3.1 配置文件

可以创建一个配置文件（如 `mtpc.codegen.config.ts`）来配置代码生成：

```typescript
import { defineConfig } from '@mtpc/codegen';
import { userResource, postResource } from './src/resources';

export default defineConfig({
  outputDir: './src/generated',
  resources: [userResource, postResource],
  permissions: {
    format: 'const',
    prefix: 'APP_',
  },
  typescript: {
    includeZodSchemas: true,
  },
  schema: {
    enabled: true,
    dialect: 'postgresql',
  },
});
```

### 5.4 集成到构建流程

可以将 `@mtpc/codegen` 集成到构建流程中，例如在 `package.json` 中添加脚本：

```json
{
  "scripts": {
    "codegen": "mtpc-codegen --config ./mtpc.codegen.config.ts",
    "build": "pnpm codegen && tsc",
    "dev": "pnpm codegen --watch && vite"
  }
}
```

## 6. 高级功能与最佳实践

### 6.1 自定义输出格式

可以根据项目需求选择不同的输出格式：

```typescript
const codegen = createCodegen({
  outputDir: './src/generated',
  resources: [userResource],
  permissions: {
    format: 'enum', // 或 'const'、'object'
  },
});
```

### 6.2 配置输出文件

可以自定义输出文件名：

```typescript
const codegen = createCodegen({
  outputDir: './src/generated',
  resources: [userResource],
  permissions: {
    outputFile: 'my-permissions.ts',
  },
  typescript: {
    outputFile: 'my-types.ts',
  },
});
```

### 6.3 试运行模式

可以使用试运行模式来预览生成的代码，而不实际写入文件：

```typescript
const result = await codegen.generateAndWrite({ dryRun: true });

console.log('Generated files (dry run):');
for (const file of result.files) {
  console.log(`- ${file.path}`);
  console.log(`  ${file.content.substring(0, 100)}...`);
}
```

### 6.4 清空输出目录

可以在生成前清空输出目录：

```typescript
const result = await codegen.generateAndWrite({ clean: true });
```

### 6.5 最佳实践

1. **版本控制**：将生成的代码提交到版本控制系统，便于查看变更历史
2. **分离关注点**：将资源定义与生成的代码分离，便于维护
3. **集成到构建流程**：确保代码生成作为构建流程的一部分，保证生成的代码与资源定义的一致性
4. **使用配置文件**：使用配置文件来集中管理代码生成配置，便于团队协作
5. **合理命名**：为生成的文件和常量选择有意义的名称，提高代码可读性
6. **定期更新**：当资源定义发生变更时，及时重新生成代码

## 7. 常见问题解答

### 7.1 Q: 如何处理生成的代码与手动修改的代码冲突？

A: 建议将生成的代码视为只读文件，不要手动修改。如果需要自定义生成的代码，可以：
1. 修改资源定义，重新生成代码
2. 使用继承或组合的方式扩展生成的类型
3. 在生成的代码周围添加包装器

### 7.2 Q: 支持哪些数据库方言？

A: 目前支持三种数据库方言：
- `postgresql`（默认）
- `mysql`
- `sqlite`

### 7.3 Q: 如何自定义生成的 TypeScript 类型？

A: 可以通过修改资源定义的 Schema 来影响生成的 TypeScript 类型。如果需要更复杂的自定义，可以：
1. 修改生成器代码（不推荐）
2. 使用类型扩展或映射类型来扩展生成的类型
3. 提交 PR 来添加新的配置选项

### 7.4 Q: 如何处理大型项目中的多个资源？

A: 可以：
1. 将资源定义分散到多个文件中，然后集中导入
2. 使用配置文件来管理所有资源
3. 考虑使用模块化的方式组织生成的代码

### 7.5 Q: 如何集成到 CI/CD 流程？

A: 可以将代码生成命令添加到 CI/CD 脚本中，例如：

```yaml
steps:
  - name: Install dependencies
    run: pnpm install
  
  - name: Generate code
    run: pnpm codegen
  
  - name: Build
    run: pnpm build
  
  - name: Test
    run: pnpm test
```

## 8. 性能优化与扩展

### 8.1 性能优化

1. **增量生成**：考虑添加增量生成功能，只生成变更的资源
2. **并行生成**：使用并行处理来提高生成速度
3. **缓存机制**：添加缓存机制，避免重复生成相同的代码
4. **按需生成**：支持按需生成特定类型的代码

### 8.2 扩展能力

1. **自定义生成器**：支持添加自定义生成器
2. **模板扩展**：支持自定义模板
3. **输出格式扩展**：支持添加新的输出格式
4. **插件系统**：考虑添加插件系统，便于扩展功能

## 9. 版本更新日志

### v0.1.0 (2024-01-01)

- 初始版本发布
- 支持权限代码生成（const、enum、object 格式）
- 支持 TypeScript 类型生成
- 支持元数据生成（JSON 和 TypeScript）
- 支持数据库 Schema 生成（Drizzle ORM 和 SQL）
- 提供 CLI 工具
- 支持配置文件

## 10. 贡献指南

欢迎为 `@mtpc/codegen` 包贡献代码或提出改进建议。请遵循以下准则：

1. 提交 Issues 描述问题或建议
2. 提交 Pull Requests 前确保所有测试通过
3. 遵循项目的代码风格和命名规范
4. 提供完整的测试用例
5. 更新相关文档
6. 确保代码符合 TypeScript 类型安全要求

## 11. 许可证

`@mtpc/codegen` 包采用 MIT 许可证，详见 LICENSE 文件。

## 12. 联系方式

- 项目仓库：https://github.com/your-org/mtpc
- 问题反馈：https://github.com/your-org/mtpc/issues
- 文档地址：https://docs.mtpc.io

---

通过本指南，您应该已经掌握了 `@mtpc/codegen` 包的核心功能、技术架构和使用方法。如果您有任何问题或建议，欢迎随时反馈。