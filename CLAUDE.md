# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

**MTPC (Multi-Tenant Permission Core)** 是一个**业务无关、可嵌入、可组合**的多租户权限内核。

- 不是完整的权限系统，而是权限基础设施内核
- 通过 Resource Definition 作为单一事实源，派生权限码、CRUD、类型、菜单元数据
- 以内嵌库方式运行，非独立微服务

## 常用命令

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 开发模式（监听构建）
pnpm dev

# 运行测试
pnpm test

# 运行单个测试
cd packages/core && pnpm test
cd packages/core && pnpm test:watch  # 监听模式

# 类型检查
pnpm typecheck

# 代码格式化
pnpm format

# 代码检查
pnpm lint
pnpm lint:fix  # 自动修复

# 检查代码规范
pnpm check

# 清理构建产物
pnpm clean
```

## Monorepo 结构

```
packages/              # 核心包
  core/               # 权限核心（Resource、Policy、Tenant、Registry）
  rbac/               # RBAC 扩展（Role-Based Access Control）
  policy-cache/       # 策略缓存扩展（性能优化）
  explain/            # 权限决策解释扩展（可观测性）
  adapter-hono/       # Hono Web 框架适配器
  adapter-drizzle/    # Drizzle ORM 数据库适配器
  codegen/            # 代码生成 CLI
  shared/             # 共享工具和类型

apps/                 # 示例应用
  example-api/        # Hono + Drizzle API 示例
  example-web/        # React + Vite 前端示例
```

## 核心概念

- **Resource**: 权限控制对象的抽象，是 MTPC 的核心
- **Permission**: 最小授权单元，具有稳定的 Permission Code
- **Policy**: 权限组合与条件规则，支持声明式和函数式
- **Tenant**: 多租户隔离的第一等公民，所有权限判定在 Tenant Context 下执行
- **Registry**: 运行时事实表，管理 Resource/Permission/Policy 注册

## 派生模型

```
Resource Definition
        │
        ├─→ CRUD Capability (逻辑层)
        ├─→ Permission Codes (类型安全)
        ├─→ Menu Metadata (UI-无关)
        ├─→ Validation Schemas
        └─→ Shared TypeScript Types
```

## 设计原则

1. **业务无关** - 核心不包含 User/Role/Menu 等具体业务模型
2. **Schema-driven** - Resource Definition 是唯一权威来源
3. **编译期优先** - 能在编译期生成的内容绝不推迟到运行期
4. **库而非服务** - 以内嵌库方式运行
5. **可扩展优先** - 通过插件、钩子与策略扩展
6. **默认拒绝** - 权限校验失败即拒绝访问

## 扩展机制

- **Plugin System**: 插件用于扩展 MTPC 能力（审计日志、数据范围控制、软删除）
- **Hooks**: 资源生命周期关键节点插入行为（beforeCreate、afterCreate、filterQuery）

## 技术栈

- TypeScript 5.3+ / Node.js 18+
- pnpm 8.15.0 / Turbo 2.0
- Biome (格式化 + Lint) / Vitest
- Hono / Drizzle ORM / React + Vite

## 开发注意事项

- 每个 package 独立版本管理和构建
- 使用 `workspace:*` 引用本地包
- Core 包按子模块导出（types, resource, permission, policy, tenant, registry, hooks, plugin）
- RBAC/Cache/Explain 均为扩展模块，非 Core 的一部分

---

## 集成开发工作流

### 工作流目录结构

```
.claude/
├── state/           # 状态管理
│   ├── featurelist.json    # 功能清单（JSON 格式）
│   ├── task-master.md      # 任务总览
│   ├── current-focus.md    # 当前焦点任务
│   └── decisions.md        # 技术决策记录
├── plans/           # 开发计划
│   └── MTPC_EXTENSIONS_INTEGRATION_PLAN.md
├── logs/            # 工作日志
└── docs/            # 架构文档
```

### 工作流程

#### 1. 开始新任务前

1. **更新 `.claude/state/current-focus.md`**
   - 指定当前要专注的任务
   - 列出任务目标和实施步骤
   - 设置进度跟踪清单

2. **查看 `.claude/state/task-master.md`**
   - 了解整体任务进度
   - 确认任务依赖关系
   - 检查验收标准

#### 2. 执行任务时

1. **遵循开发原则**
   - 不修改 Core 包代码（TODO 标记例外）
   - 优先使用官方扩展包
   - 保持类型安全

2. **代码变更**
   - 每完成一个功能，更新 featurelist.json
   - 记录重要技术决策到 decisions.md
   - 添加必要的 TODO 注释

#### 3. 任务完成后

1. **更新状态文件**
   - 更新 current-focus.md 的完成状态
   - 更新 task-master.md 的进度
   - 更新 featurelist.json 的完成度

2. **记录日志**
   - 在 `.claude/logs/` 创建今日工作日志
   - 记录遇到的问题和解决方案

### 状态文件说明

#### featurelist.json
功能清单，记录所有包和应用的功能状态：
- 包版本和导出
- 功能完成度
- 集成状态
- TODO 列表
- 项目统计

#### task-master.md
任务总览，记录所有待办和进行中的任务：
- 分阶段任务列表
- 任务优先级
- 验收标准
- 文件统计

#### current-focus.md
当前焦点，记录正在专注的任务：
- 任务名称和目标
- 实施步骤
- 进度跟踪
- 备注信息

#### decisions.md
技术决策记录，记录重要的架构和设计决策：
- 决策背景
- 决策内容和理由
- 替代方案
- 影响分析

### 常用工作流操作

```bash
# 查看当前任务
cat .claude/state/current-focus.md

# 查看任务总览
cat .claude/state/task-master.md

# 查看功能清单
cat .claude/state/featurelist.json

# 查看技术决策
cat .claude/state/decisions.md

# 创建今日日志
echo "## $(date +%Y-%m-%d)" >> .claude/logs/session-$(date +%Y%m%d).md
```

### 开发阶段检查清单

#### 开始开发前
- [ ] 已阅读相关架构文档
- [ ] 已查看 task-master.md 了解任务上下文
- [ ] 已更新 current-focus.md 指定任务
- [ ] 已确认技术栈和工具

#### 开发过程中
- [ ] 代码符合 Biome 格式规范
- [ ] 通过 TypeScript 类型检查
- [ ] 不修改 Core 包代码（TODO 除外）
- [ ] 使用官方扩展包而非自定义实现

#### 完成开发后
- [ ] 运行 `pnpm typecheck` 无错误
- [ ] 运行 `pnpm lint` 无警告
- [ ] 更新 featurelist.json
- [ ] 更新 task-master.md
- [ ] 记录重要决策到 decisions.md

---

## 扩展包集成指南

### 当前集成状态

| 扩展包 | example-api | example-web |
|--------|-------------|-------------|
| @mtpc/rbac | ✅ 已完成 | N/A |
| @mtpc/audit | ❌ 待集成 | N/A |
| @mtpc/policy-cache | ❌ 待集成 | N/A |
| @mtpc/soft-delete | ⚠️ 部分 | N/A |
| @mtpc/versioning | ❌ 待集成 | N/A |
| @mtpc/data-scope | ❌ 待集成 | N/A |
| @mtpc/adapter-react | N/A | ❌ 待集成 |
| @mtpc/explain | ❌ 待集成 | ❌ 待集成 |
| @mtpc/devtools | ❌ 待集成 | ❌ 待集成 |

### 集成优先级

**高优先级** (核心功能):
1. @mtpc/audit (example-api) - 审计日志
2. @mtpc/policy-cache (example-api) - 性能优化
3. @mtpc/adapter-react (example-web) - React 适配器

**中优先级** (功能增强):
4. @mtpc/soft-delete (example-api) - 软删除
5. @mtpc/versioning (example-api) - 版本控制
6. @mtpc/data-scope (example-api) - 数据范围

**低优先级** (开发体验):
7. @mtpc/explain (两者) - 权限解释
8. @mtpc/devtools (两者) - 开发工具

### 详细的集成计划

请参考: `MTPC_EXTENSIONS_INTEGRATION_PLAN.md`

---

## 相关文档

| 文档 | 路径 |
|------|------|
| 集成计划 | `MTPC_EXTENSIONS_INTEGRATION_PLAN.md` |
| 功能清单 | `.claude/state/featurelist.json` |
| 任务总览 | `.claude/state/task-master.md` |
| 当前焦点 | `.claude/state/current-focus.md` |
| 技术决策 | `.claude/state/decisions.md` |
| 架构文档 | `.claude/docs/architecture.md` |
