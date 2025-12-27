# @mtpc/soft-delete 技术分析文档

## 目录

1. [概述](#1-概述)
2. [架构设计](#2-架构设计)
3. [核心组件分析](#3-核心组件分析)
4. [类型系统](#4-类型系统)
5. [钩子系统](#5-钩子系统)
6. [插件系统](#6-插件系统)
7. [与 Core 包的集成](#7-与-core-包的集成)
8. [源码与文档差异分析](#8-源码与文档差异分析)
9. [最佳实践](#9-最佳实践)
10. [扩展性分析](#10-扩展性分析)

---

## 1. 概述

### 1.1 包定位

`@mtpc/soft-delete` 是 MTPC 官方扩展包之一，提供资源的软删除功能。作为 MTPC 架构中的"First-class Extension"，它遵循以下设计原则：

- **业务无关**：不绑定具体业务逻辑，仅提供软删除能力
- **可插拔**：通过插件机制集成，不影响 Core API
- **模型无关**：不依赖具体的数据模型或存储实现
- **Tenant-aware**：完全支持多租户上下文

### 1.2 核心能力

根据源码实现，`@mtpc/soft-delete` 提供以下核心能力：

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

根据源码注释，该包的设计理念是：

> 核心钩子本身无法直接更新数据库，只能约定"软删除语义"。具体的持久化（将 deletedAt/deletedBy 写入数据库）需要由 Adapter/Repository 实现。

这种设计遵循了 MTPC 的**分层架构**原则：
- **Core 层**：定义软删除的语义和接口
- **Adapter 层**：实现具体的数据库操作

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                  Consumer Application                  │
│              (业务系统 / Adapter / Repository)          │
└────────────────────┬────────────────────────────────────┘
                     │ 使用
┌────────────────────▼────────────────────────────────────┐
│              @mtpc/soft-delete Plugin                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Plugin Definition                            │  │
│  │  - name: '@mtpc/soft-delete'                │  │
│  │  - state: { configs, configureResource }      │  │
│  │  - install(ctx): 扩展资源钩子                │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Hooks Factory                                │  │
│  │  - createSoftDeleteHooks(config)               │  │
│  │  - beforeDelete: 控制删除行为                 │  │
│  │  - filterQuery: 自动过滤已删除记录             │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │ 依赖
┌────────────────────▼────────────────────────────────────┐
│                  @mtpc/core                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Plugin System                                │  │
│  │  - PluginContext: 插件与 Core 交互接口        │  │
│  │  - extendResourceHooks: 扩展资源钩子           │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Resource Hooks                               │  │
│  │  - beforeDelete: 删除前钩子                   │  │
│  │  - filterQuery: 查询过滤钩子                  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 设计模式

#### 2.2.1 工厂模式

`createSoftDeletePlugin()` 和 `createSoftDeleteHooks()` 使用工厂模式创建实例：

```typescript
// 插件工厂
export function createSoftDeletePlugin(): PluginDefinition & {
  state: SoftDeletePluginState & {
    configureResource: (config: SoftDeleteConfig, context: PluginContext) => void;
  };
}

// 钩子工厂
export function createSoftDeleteHooks<T = unknown>(
  config: SoftDeleteConfig
): Partial<ResourceHooks<T>>
```

#### 2.2.2 策略模式

支持两种软删除策略（时间戳 vs 布尔标志），通过配置选择：

```typescript
if (flagField) {
  // 布尔标志策略
  filters.push({
    field: flagField,
    operator: 'eq',
    value: false,
  });
} else {
  // 时间戳策略
  filters.push({
    field: deletedAtField,
    operator: 'isNull',
    value: null,
  });
}
```

#### 2.2.3 插件模式

通过 MTPC 的插件系统实现功能扩展：

```typescript
const plugin: PluginDefinition = {
  name: '@mtpc/soft-delete',
  version: '0.1.0',
  install(context: PluginContext) {
    // 安装逻辑
  },
  state: {
    configs: new Map(),
    configureResource(config, context) {
      // 配置逻辑
    }
  }
};
```

---

## 3. 核心组件分析

### 3.1 类型定义 (types.ts)

#### 3.1.1 SoftDeleteConfig

软删除配置接口，定义了资源的软删除行为：

```typescript
export interface SoftDeleteConfig {
  /** 资源名称（必填） */
  resourceName: string;

  /** 时间戳字段名（可选，默认 'deletedAt'） */
  deletedAtField?: string;

  /** 删除人字段名（可选） */
  deletedByField?: string;

  /** 布尔标志字段名（可选，与 deletedAtField 二选一） */
  flagField?: string;

  /** 是否自动过滤软删除记录（可选，默认 true） */
  autoFilter?: boolean;
}
```

**设计要点**：
- `deletedAtField` 和 `flagField` 互斥，分别对应两种软删除模式
- `autoFilter` 默认为 `true`，符合"默认安全"原则
- 所有字段都是可选的，提供了合理的默认值

#### 3.1.2 SoftDeletePluginState

插件内部状态，存储资源配置和提供配置方法：

```typescript
export interface SoftDeletePluginState {
  /** 存储所有资源的软删除配置 */
  configs: Map<string, SoftDeleteConfig>;
}
```

**设计要点**：
- 使用 `Map` 而非 `Object`，提供更好的类型安全和性能
- 键为资源名称，值为对应的软删除配置
- 支持运行时动态添加配置

#### 3.1.3 钩子类型定义

定义了软删除相关的钩子函数类型：

```typescript
/** beforeDelete 钩子类型 */
export type SoftDeleteBeforeDeleteHook = (
  context: MTPCContext,
  id: string
) => Promise<{ proceed: boolean; data?: string }> | { proceed: boolean; data?: string };

/** filterQuery 钩子类型 */
export type SoftDeleteFilterQueryHook = (
  context: MTPCContext,
  baseFilters: FilterCondition[]
) => Promise<FilterCondition[]> | FilterCondition[];
```

**设计要点**：
- 支持同步和异步返回
- `beforeDelete` 返回 `{ proceed: boolean, data?: string }`，可以控制是否继续删除
- `filterQuery` 接收基础过滤条件，返回处理后的过滤条件

### 3.2 钩子实现 (hooks.ts)

#### 3.2.1 createSoftDeleteHooks

创建软删除钩子的核心函数：

```typescript
export function createSoftDeleteHooks<T = unknown>(
  config: SoftDeleteConfig
): Partial<ResourceHooks<T>>
```

**参数**：
- `config`: 软删除配置

**返回值**：
- `Partial<ResourceHooks<T>>`: 包含 `beforeDelete` 和 `filterQuery` 钩子的部分资源钩子

#### 3.2.2 beforeDelete 钩子

```typescript
const beforeDelete: SoftDeleteBeforeDeleteHook = async (_ctx, id) => {
  // 默认行为：不阻断删除，只是为上层提供可以接入的信息
  return { proceed: true, data: id };
};
```

**行为分析**：
1. **默认不阻断**：`proceed: true` 表示允许继续删除操作
2. **数据传递**：`data: id` 将资源 ID 传递给上层，便于 Adapter/Repository 实现
3. **语义约定**：约定软删除的语义，但不强制实现

**设计意图**：
- 提供扩展点，允许上层逻辑决定是否执行硬删除或软删除
- 保持灵活性，不强制所有删除都改为软删除
- 符合"约定优于配置"的设计原则

#### 3.2.3 filterQuery 钩子

```typescript
const filterQuery: SoftDeleteFilterQueryHook = (_ctx, baseFilters) => {
  // 如果配置了不自动过滤，则直接返回基础过滤条件
  if (!autoFilter) {
    return baseFilters;
  }

  // 创建过滤条件的副本，避免修改原始数组
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
    } as FilterCondition);
  }

  return filters;
};
```

**行为分析**：
1. **条件判断**：检查 `autoFilter` 配置决定是否启用自动过滤
2. **数组拷贝**：使用 `[...baseFilters]` 创建副本，避免修改原始数组
3. **策略选择**：根据 `flagField` 是否存在选择不同的过滤策略
4. **条件追加**：将过滤条件追加到基础过滤条件之后

**设计意图**：
- 提供透明的自动过滤能力，减少手动编写过滤条件的负担
- 保持可配置性，允许禁用自动过滤
- 使用不可变模式，避免副作用

### 3.3 插件实现 (plugin.ts)

#### 3.3.1 createSoftDeletePlugin

创建软删除插件的核心函数：

```typescript
export function createSoftDeletePlugin(): PluginDefinition & {
  state: SoftDeletePluginState & {
    configureResource: (config: SoftDeleteConfig, context: PluginContext) => void;
  };
}
```

**返回值**：
- 插件定义，包含元数据、生命周期方法和状态

#### 3.3.2 插件状态

```typescript
const state: SoftDeletePluginState & {
  configureResource: (config: SoftDeleteConfig, context: PluginContext) => void;
} = {
  configs,

  configureResource(config: SoftDeleteConfig, context: PluginContext) {
    // 存储配置
    configs.set(config.resourceName, config);
    // 为资源创建并注册软删除钩子
    context.extendResourceHooks(config.resourceName, createSoftDeleteHooks(config));
  },
};
```

**行为分析**：
1. **配置存储**：将配置存储到 `configs` Map 中
2. **钩子注册**：调用 `context.extendResourceHooks` 注册软删除钩子
3. **延迟绑定**：允许在运行时动态配置资源

**设计意图**：
- 支持动态配置，不要求在插件安装时配置所有资源
- 提供清晰的配置接口，便于使用
- 集中管理配置，便于调试和监控

#### 3.3.3 插件生命周期

```typescript
return {
  name: '@mtpc/soft-delete',
  version: '0.1.0',
  description: 'MTPC 的软删除钩子扩展',
  state,

  install(context: PluginContext): void {
    // 暂不做全局自动接管，由使用方手动配置每个资源更安全可控
    for (const config of configs.values()) {
      context.extendResourceHooks(config.resourceName, createSoftDeleteHooks(config));
    }
  },

  onInit(): void {
    // 无需初始化操作
  },

  onDestroy(): void {
    // 清理所有配置，防止内存泄漏
    configs.clear();
  },
};
```

**生命周期分析**：

1. **install 阶段**：
   - 遍历已有配置，为每个资源配置钩子
   - 不做全局自动接管，保持灵活性
   - 支持在 install 之前配置资源

2. **onInit 阶段**：
   - 无操作，软删除插件不需要初始化逻辑

3. **onDestroy 阶段**：
   - 清理配置 Map，防止内存泄漏
   - 符合资源管理最佳实践

**设计意图**：
- 遵循 MTPC 插件生命周期规范
- 提供清晰的资源管理
- 避免内存泄漏

---

## 4. 类型系统

### 4.1 类型层次结构

```
SoftDeleteConfig (配置接口)
    ├── resourceName: string
    ├── deletedAtField?: string
    ├── deletedByField?: string
    ├── flagField?: string
    └── autoFilter?: boolean

SoftDeletePluginState (插件状态)
    └── configs: Map<string, SoftDeleteConfig>

SoftDeleteBeforeDeleteHook (钩子类型)
    └── (context, id) => { proceed: boolean; data?: string }

SoftDeleteFilterQueryHook (钩子类型)
    └── (context, baseFilters) => FilterCondition[]
```

### 4.2 类型安全

#### 4.2.1 泛型支持

```typescript
export function createSoftDeleteHooks<T = unknown>(
  config: SoftDeleteConfig
): Partial<ResourceHooks<T>>
```

- 使用泛型 `T` 保持资源数据类型的传递
- 默认为 `unknown`，提供灵活性

#### 4.2.2 联合类型

```typescript
export type SoftDeleteBeforeDeleteHook = (
  context: MTPCContext,
  id: string
) => Promise<{ proceed: boolean; data?: string }> | { proceed: boolean; data?: string };
```

- 支持同步和异步返回
- 使用联合类型提供灵活性

### 4.3 类型推导

```typescript
// 配置推导
const config: SoftDeleteConfig = {
  resourceName: 'user',
  deletedAtField: 'deletedAt',
  autoFilter: true
};

// 钩子推导
const hooks: Partial<ResourceHooks<User>> = createSoftDeleteHooks<User>(config);
```

---

## 5. 钩子系统

### 5.1 钩子执行流程

```
┌─────────────────────────────────────────────────────────┐
│                   查询操作                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              filterQuery 钩子                        │
│  1. 检查 autoFilter 配置                           │
│  2. 如果启用，添加过滤条件                          │
│  3. 返回更新后的过滤条件                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│            Adapter / Repository                      │
│  1. 使用过滤条件查询数据库                          │
│  2. 返回未删除的记录                                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   删除操作                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              beforeDelete 钩子                       │
│  1. 返回 { proceed: true, data: id }               │
│  2. 约定软删除语义                                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│            Adapter / Repository                      │
│  1. 根据 beforeDelete 返回的数据决定操作            │
│  2. 执行软删除：设置 deletedAt/deletedBy            │
│  3. 或执行硬删除：从数据库移除记录                  │
└─────────────────────────────────────────────────────────┘
```

### 5.2 钩子执行顺序

根据 MTPC Core 的钩子系统，钩子按添加顺序执行：

```typescript
// extendResourceHooks 会将新钩子追加到现有钩子之后
const mergedHooks = {
  beforeDelete: [...(existingHooks.beforeDelete ?? []), ...(hooks.beforeDelete ?? [])],
  filterQuery: [...(existingHooks.filterQuery ?? []), ...(hooks.filterQuery ?? [])],
};
```

**执行顺序**：
1. 资源原有的 `beforeDelete` 钩子
2. 软删除插件的 `beforeDelete` 钩子
3. 其他扩展的 `beforeDelete` 钩子

**设计意图**：
- 软删除钩子作为"守卫"，在原有钩子之后执行
- 保持可预测的执行顺序
- 允许其他钩子修改行为

### 5.3 钩子返回值处理

#### 5.3.1 beforeDelete 返回值

```typescript
{ proceed: boolean; data?: string }
```

- `proceed: true`：继续删除操作
- `proceed: false`：阻断删除操作
- `data`：传递给 Adapter/Repository 的额外数据

#### 5.3.2 filterQuery 返回值

```typescript
FilterCondition[]
```

- 返回更新后的过滤条件数组
- Adapter/Repository 使用这些条件查询数据库

---

## 6. 插件系统

### 6.1 插件注册流程

```
┌─────────────────────────────────────────────────────────┐
│              1. 创建插件实例                         │
│         const plugin = createSoftDeletePlugin()         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              2. 注册插件到 MTPC                      │
│              mtpc.use(plugin)                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              3. 配置资源软删除                        │
│    plugin.state.configureResource(config, context)     │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              4. 初始化 MTPC                           │
│              await mtpc.init()                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              5. 插件安装                            │
│              plugin.install(context)                  │
└─────────────────────────────────────────────────────────┘
```

### 6.2 插件状态管理

#### 6.2.1 状态存储

```typescript
const configs = new Map<string, SoftDeleteConfig>();
```

**设计要点**：
- 使用 `Map` 存储配置，提供 O(1) 查找性能
- 键为资源名称，值为软删除配置
- 支持动态添加和删除配置

#### 6.2.2 状态访问

```typescript
// 获取插件实例
const plugin = mtpc.getPlugin('@mtpc/soft-delete');

// 访问插件状态
if (plugin) {
  const configs = plugin.state.configs;
  const userConfig = configs.get('user');
}
```

### 6.3 插件依赖关系

软删除插件不依赖其他插件，可以独立使用：

```typescript
export function createSoftDeletePlugin(): PluginDefinition {
  return {
    name: '@mtpc/soft-delete',
    version: '0.1.0',
    // 无 dependencies 字段
  };
}
```

---

## 7. 与 Core 包的集成

### 7.1 依赖关系

```
@mtpc/soft-delete
    ├── @mtpc/core
    │   ├── types: PluginContext, PluginDefinition, ResourceHooks
    │   ├── hooks: FilterCondition, MTPCContext
    │   └── plugin: PluginContext
    └── @mtpc/shared (通过 core 间接依赖)
```

### 7.2 PluginContext 接口

软删除插件通过 `PluginContext` 与 Core 交互：

```typescript
export interface PluginContext {
  /** 注册资源定义 */
  registerResource(resource: ResourceDefinition): void;

  /** 注册策略定义 */
  registerPolicy(policy: PolicyDefinition): void;

  /** 注册全局钩子 */
  registerGlobalHooks(hooks: Partial<GlobalHooks>): void;

  /** 扩展指定资源的钩子 */
  extendResourceHooks<T>(resourceName: string, hooks: Partial<ResourceHooks<T>>): void;

  /** 获取资源定义 */
  getResource(name: string): ResourceDefinition | undefined;

  /** 获取策略定义 */
  getPolicy(id: string): PolicyDefinition | undefined;

  /** 获取当前已注册的所有资源 */
  listResources(): ResourceDefinition[];

  /** 订阅资源注册事件 */
  onResourceRegistered(callback: (resource: ResourceDefinition) => void): () => void;
}
```

### 7.3 资源钩子接口

软删除插件实现了以下资源钩子：

```typescript
export interface ResourceHooks<T> {
  beforeCreate?: HookFn<BeforeCreateContext<T>, BeforeCreateResult<T>>;
  afterCreate?: HookFn<AfterCreateContext<T>, AfterCreateResult<T>>;
  beforeRead?: HookFn<BeforeReadContext, BeforeReadResult>;
  afterRead?: HookFn<AfterReadContext<T>, AfterReadResult<T>>;
  beforeUpdate?: HookFn<BeforeUpdateContext<T>, BeforeUpdateResult<T>>;
  afterUpdate?: HookFn<AfterUpdateContext<T>, AfterUpdateResult<T>>;
  beforeDelete?: HookFn<BeforeDeleteContext, BeforeDeleteResult>;
  afterDelete?: HookFn<AfterDeleteContext, AfterDeleteResult<T>>;
  beforeList?: HookFn<BeforeListContext, BeforeListResult>;
  afterList?: HookFn<AfterListContext<T>, AfterListResult<T>>;
  filterQuery?: HookFn<FilterQueryContext, FilterQueryResult>;
}
```

软删除插件实现了：
- `beforeDelete`：控制删除行为
- `filterQuery`：自动过滤已删除记录

---

## 8. 源码与文档差异分析

### 8.1 API 调用方式差异

#### 差异 1：插件注册方法

**README.md 中的错误代码**：
```typescript
mtpc.registerPlugin(softDeletePlugin); // ❌ 错误
```

**源码实际实现**：
```typescript
mtpc.use(softDeletePlugin); // ✅ 正确
```

**原因分析**：
- MTPC Core 使用 `use()` 方法注册插件（见 mtpc.ts:283-286）
- `registerPlugin` 方法在 Core 中不存在

#### 差异 2：configureResource 调用

**README.md 中的错误代码**：
```typescript
softDeletePlugin.state.configureResource({
  resourceName: 'user',
  deletedAtField: 'deletedAt',
  deletedByField: 'deletedBy',
  autoFilter: true
}, mtpc.context); // ❌ mtpc.context 不存在
```

**源码实际实现**：
```typescript
// 正确方式 1：在插件的 install 阶段配置
const plugin = createSoftDeletePlugin();
mtpc.use(plugin);

// 在 install 阶段配置
plugin.install = (context) => {
  plugin.state.configureResource({
    resourceName: 'user',
    deletedAtField: 'deletedAt',
    deletedByField: 'deletedBy',
    autoFilter: true
  }, context);
};

// 正确方式 2：通过 getPlugin 获取插件实例
await mtpc.init();
const plugin = mtpc.getPlugin('@mtpc/soft-delete');
if (plugin) {
  // 需要获取 PluginContext，这通常需要在 install 阶段保存
  // 或者通过其他方式获取
}
```

**原因分析**：
- `mtpc.context` 属性在 Core 中不存在
- `PluginContext` 只在插件的 `install` 方法中可用
- 需要在 `install` 阶段保存 `PluginContext` 引用

### 8.2 功能描述差异

#### 差异 1：beforeDelete 钩子行为

**README.md 描述**：
> 删除资源时，会触发软删除钩子

**源码实际行为**：
```typescript
const beforeDelete: SoftDeleteBeforeDeleteHook = async (_ctx, id) => {
  return { proceed: true, data: id };
};
```

**实际含义**：
- `beforeDelete` 钩子默认不阻断删除（`proceed: true`）
- 只是约定软删除的语义，不强制执行软删除
- 具体的软删除逻辑需要由 Adapter/Repository 实现

#### 差异 2：filterQuery 钩子行为

**README.md 描述**：
> 查询资源时，会自动排除软删除记录

**源码实际行为**：
```typescript
const filterQuery: SoftDeleteFilterQueryHook = (_ctx, baseFilters) => {
  if (!autoFilter) {
    return baseFilters; // 不自动过滤
  }
  // 添加过滤条件
  return filters;
};
```

**实际含义**：
- 只有在 `autoFilter: true` 时才自动过滤
- 可以通过配置禁用自动过滤
- 返回的是过滤条件，不是过滤后的数据

### 8.3 配置选项差异

#### 差异 1：默认值

**README.md 描述**：
- `deletedAtField` 默认值：`'deletedAt'`
- `autoFilter` 默认值：`true`

**源码实际实现**：
```typescript
const deletedAtField = config.deletedAtField ?? 'deletedAt';
const autoFilter = config.autoFilter ?? true;
```

**验证结果**：✅ 一致

### 8.4 示例代码差异

#### 差异 1：插件使用示例

**README.md 中的错误代码**：
```typescript
const mtpc = createMTPC({
  tenants: [{ id: 'tenant123', name: 'Test Tenant' }],
  roles: [{ id: 'admin', name: '管理员' }]
}); // ❌ tenants 和 roles 不是 MTPCOptions 的属性
```

**源码实际实现**：
```typescript
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    return new Set(['user:read', 'user:create']);
  }
});
```

**原因分析**：
- `MTPCOptions` 只包含 `multiTenant` 和 `defaultPermissionResolver` 字段
- `tenants` 和 `roles` 不是 Core 的配置项

---

## 9. 最佳实践

### 9.1 资源配置

#### 推荐：在插件 install 阶段配置

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

// 创建软删除插件
const softDeletePlugin = createSoftDeletePlugin();

// 修改插件的 install 方法
const originalInstall = softDeletePlugin.install;
softDeletePlugin.install = (context) => {
  // 配置用户资源的软删除
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

// 创建 MTPC 实例
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    // 实现权限解析逻辑
    return new Set(['user:read', 'user:create']);
  }
});

// 注册资源和插件
mtpc.registerResource(userResource);
mtpc.use(softDeletePlugin);

// 初始化
await mtpc.init();
```

### 9.2 数据库 Schema 设计

#### 时间戳模式（推荐）

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  deleted_at TIMESTAMP NULL,  -- 软删除时间戳
  deleted_by VARCHAR(255) NULL,  -- 删除人
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
CREATE INDEX idx_users_tenant_deleted ON users(tenant_id, deleted_at);
```

#### 布尔标志模式

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,  -- 软删除标志
  deleted_by VARCHAR(255) NULL,  -- 删除人
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_users_is_deleted ON users(is_deleted);
CREATE INDEX idx_users_tenant_deleted ON users(tenant_id, is_deleted);
```

### 9.3 Adapter/Repository 实现

#### 软删除实现示例

```typescript
import { eq, and, isNull } from 'drizzle-orm';

class UserRepository {
  constructor(private db: any, private schema: any) {}

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
```

### 9.4 错误处理

#### 资源未找到错误

```typescript
try {
  softDeletePlugin.state.configureResource({
    resourceName: 'non-existent',
    deletedAtField: 'deletedAt',
  }, context);
} catch (error) {
  if (error.message.includes('Resource not found')) {
    console.error('资源不存在');
  }
}
```

### 9.5 性能优化

#### 索引优化

```sql
-- 复合索引：租户 ID + 删除状态
CREATE INDEX idx_users_tenant_deleted 
ON users(tenant_id, deleted_at);

-- 覆盖索引：包含常用查询字段
CREATE INDEX idx_users_covering 
ON users(tenant_id, deleted_at, created_at) 
INCLUDE (name, email);
```

#### 查询优化

```typescript
// 使用索引友好的查询
async findActiveUsers(tenantId: string, limit: number, offset: number) {
  return this.db.select()
    .from(this.schema.user)
    .where(
      and(
        eq(this.schema.user.tenantId, tenantId),
        isNull(this.schema.user.deletedAt)
      )
    )
    .limit(limit)
    .offset(offset);
}
```

---

## 10. 扩展性分析

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

### B. API 参考

#### createSoftDeletePlugin()

创建软删除插件实例。

**返回值**：
```typescript
PluginDefinition & {
  state: SoftDeletePluginState & {
    configureResource: (config: SoftDeleteConfig, context: PluginContext) => void;
  };
}
```

#### createSoftDeleteHooks()

创建软删除钩子。

**参数**：
- `config: SoftDeleteConfig` - 软删除配置

**返回值**：
```typescript
Partial<ResourceHooks<T>>
```

### C. 版本历史

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
