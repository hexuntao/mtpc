# MTPC (Multi-Tenant Permission Core)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074d9.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-blue.svg)](https://pnpm.io/)

**业务无关、可嵌入、可组合的多租户权限内核**

## 📖 什么是 MTPC？

**MTPC (Multi-Tenant Permission Core)** 是一个业务无关、可嵌入、可组合的多租户权限内核。

### 定位声明

- ❌ MTPC ≠ 权限系统
- ✅ MTPC = 权限系统的"内核与引擎"

MTPC 不是一个可直接部署的系统，也不包含任何具体业务、UI 或运行态应用。它是一个权限基础设施内核，用于被真实业务系统（SaaS、内部后台、B 端系统等）作为依赖引入。

## 🚀 快速开始

### 安装

```bash
npm install @mtpc/core
# 或
pnpm add @mtpc/core
# 或
yarn add @mtpc/core
```

### 基础用法

```typescript
import { createMTPC, defineResource } from '@mtpc/core'
import { z } from 'zod'

// 创建 MTPC 实例
const mtpc = createMTPC()

// 定义资源
const userResource = defineResource({
  name: 'user',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email()
  }),
  features: {
    creatable: true,
    readable: true,
    updatable: true,
    deletable: true
  }
})

// 注册资源
mtpc.registerResource(userResource)

// 初始化
await mtpc.init()

// 检查权限
const result = await mtpc.checkPermission({
  tenant: { id: 'tenant-001' },
  subject: { id: 'user-123', type: 'user' },
  resource: 'user',
  action: 'create'
})

console.log(result.allowed) // true/false
```

## 🏗️ 核心架构

### 设计原则

1. **业务无关 (Business-agnostic)** - 核心不包含具体业务模型
2. **Schema-driven (单一事实源)** - Resource Definition 是唯一权威来源
3. **Compile-time First (编译期优先)** - 类型安全与一致性
4. **Library, not Service (库而非服务)** - 内嵌库方式运行
5. **Extensible by Design (可扩展优先)** - 插件化架构
6. **Fail-safe Authorization (默认拒绝)** - 权限校验失败即拒绝

### 核心概念

- **Resource (资源)** - 可受权限控制的对象集合
- **Permission (权限)** - 最小授权单元，格式：`resource:action`
- **Policy (策略)** - 权限组合与条件规则
- **Tenant (租户)** - 多租户隔离的第一等公民
- **Registry (注册表)** - 运行时事实表

## 📦 核心包

| 包名 | 描述 | 文档 |
|------|------|------|
| [`@mtpc/core`](packages/core) | 多租户权限核心，提供 Resource、Permission、Policy 等基础能力 | [查看](packages/core) |
| [`@mtpc/rbac`](packages/rbac) | 基于角色的访问控制扩展 | [查看](packages/rbac) |
| [`@mtpc/adapter-hono`](packages/adapter-hono) | Hono 框架适配器 | [查看](packages/adapter-hono) |
| [`@mtpc/adapter-drizzle`](packages/adapter-drizzle) | Drizzle ORM 适配器 | [查看](packages/adapter-drizzle) |
| [`@mtpc/adapter-react`](packages/adapter-react) | React 框架适配器 | [查看](packages/adapter-react) |
| [`@mtpc/adapter-vue`](packages/adapter-vue) | Vue 框架适配器 | [查看](packages/adapter-vue) |

## 🔌 官方扩展

| 扩展包 | 描述 | 文档 |
|--------|------|------|
| [`@mtpc/policy-cache`](packages/policy-cache) | 策略缓存扩展，优化权限检查性能 | [查看](packages/policy-cache) |
| [`@mtpc/explain`](packages/explain) | 权限决策解释扩展，用于调试和审计 | [查看](packages/explain) |
| [`@mtpc/audit`](packages/audit) | 审计日志扩展，记录权限操作 | [查看](packages/audit) |
| [`@mtpc/data-scope`](packages/data-scope) | 数据范围控制扩展，实现行级权限 | [查看](packages/data-scope) |
| [`@mtpc/soft-delete`](packages/soft-delete) | 软删除扩展，支持数据恢复 | [查看](packages/soft-delete) |
| [`@mtpc/versioning`](packages/versioning) | 版本控制扩展 | [查看](packages/versioning) |

## 🛠️ 技术栈

- **构建工具**: pnpm workspace + Turbo
- **代码格式化**: Biome
- **类型检查**: TypeScript
- **测试**: Vitest
- **文档**: Nextra (Next.js)
- **数据库**: Drizzle ORM (支持 PostgreSQL、MySQL、SQLite)
- **Web 框架**: Hono
- **前端框架**: React、Vue

## 📚 文档

- [快速开始](apps/site/app/docs/getting-started/page.mdx) - 5 分钟上手 MTPC
- [架构概览](apps/site/app/docs/architecture/page.mdx) - 深入了解设计理念
- [API 参考](apps/site/app/docs/api) - 完整的 API 文档
- [开发指南](apps/site/app/docs/guides) - 最佳实践和高级主题
- [示例教程](apps/site/app/docs/tutorials) - 完整的示例项目

## 🎯 适用场景

- **SaaS 多租户应用** - 原生支持多租户隔离
- **企业内部管理系统** - 灵活的权限模型
- **B 端权限控制系统** - 细粒度权限控制
- **需要权限控制的任何应用** - 可嵌入、可组合

## 🧪 示例项目

- **[example-api](apps/example-api)** - 完整的 API 示例
- **[example-web](apps/example-web)** - 前端集成示例

## 🤝 贡献

欢迎贡献！请查看 [贡献指南](CONTRIBUTING.md) 了解如何参与 MTPC 的开发。

### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/your-org/mtpc.git
cd mtpc

# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# 运行测试
pnpm test

# 构建项目
pnpm build

# 代码格式化
pnpm format

# 类型检查
pnpm typecheck
```

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

感谢所有贡献者和社区成员的支持！

## 🔗 相关链接

- [文档网站](https://mtpc.dev)
- [GitHub 仓库](https://github.com/your-org/mtpc)
- [NPM 包](https://www.npmjs.com/package/@mtpc/core)
- [Discord 社区](https://discord.gg/mtpc)