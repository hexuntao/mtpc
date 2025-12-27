# @mtpc/explain 技术分析文档

## 1. 包概述

`@mtpc/explain` 是 MTPC (Multi-Tenant Permission Core) 的权限决策解释扩展，用于解释权限决策结果，提供详细的决策原因和评估过程。

### 1.1 设计目标

- **可观测性**: 提供权限决策的详细解释，帮助开发者理解和调试权限问题
- **可审计性**: 记录权限检查历史，支持审计和合规性检查
- **非侵入性**: 不影响权限判定结果，作为 Side-channel 存在
- **可扩展性**: 支持自定义格式化器和收集策略

### 1.2 核心特性

- 解释单个权限决策结果
- 批量解释多个权限决策
- 解释主体的角色和权限来源
- 自定义解释级别和详细程度
- 支持包含策略评估详情
- 提供友好的解释结果格式化
- 自动收集权限检查历史

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    @mtpc/explain                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Explainer   │  │  Collector   │  │ Formatter   │ │
│  │              │  │              │  │             │ │
│  │ - explain()  │  │ - collect()  │  │ - format()  │ │
│  │ - explainBulk│  │ - getRecent()│  │ - Text      │ │
│  │ - explainSubj│  │ - getStats() │  │ - JSON      │ │
│  └──────┬───────┘  └──────┬───────┘  │ - Markdown  │ │
│         │                  │          └────────────┘ │
└─────────┼──────────────────┼────────────────────────┘
          │                  │
          │                  │
┌─────────┴──────────────────┴────────────────────────┐
│                    @mtpc/core                       │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ PolicyEngine │  │ Permission  │                 │
│  │              │  │ Resolver    │                 │
│  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| `types.ts` | 定义所有类型和接口 |
| `explainer.ts` | 核心权限决策解释逻辑 |
| `collector.ts` | 收集和管理权限解释结果 |
| `formatter.ts` | 格式化权限解释结果 |
| `plugin.ts` | MTPC 框架集成插件 |
| `index.ts` | 导出所有公共 API |

### 2.3 数据流

```
权限检查请求
    │
    ▼
┌─────────────────┐
│ PermissionExplainer │
│                  │
│ 1. 解析权限代码   │
│ 2. 获取主体权限   │
│ 3. 检查通配符     │
│ 4. 评估策略       │
│ 5. 构建解释结果   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ PermissionExplanation │
│                  │
│ - decision       │
│ - reason         │
│ - evaluationPath │
│ - context        │
│ - policies?      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Formatter     │
│                  │
│ - TextFormatter  │
│ - JSONFormatter  │
│ - MarkdownFormatter │
└────────┬────────┘
         │
         ▼
    格式化输出
```

---

## 3. 核心组件分析

### 3.1 PermissionExplainer（权限解释器）

#### 3.1.1 构造函数

```typescript
constructor(
  policyEngine: PolicyEngine,
  permissionResolver: (tenantId: string, subjectId: string) => Promise<Set<string>>,
  options: { defaultLevel?: ExplainLevel } = {}
)
```

**参数说明**:
- `policyEngine`: 策略引擎实例，用于评估策略
- `permissionResolver`: 权限解析器函数，用于获取主体的权限
- `options.defaultLevel`: 默认解释级别，默认为 `'standard'`

**依赖关系**:
- 依赖 `@mtpc/core` 的 `PolicyEngine` 和 `PermissionEvaluationContext`
- 依赖 `@mtpc/shared` 的 `parsePermissionCode` 函数

#### 3.1.2 explain() 方法

**方法签名**:
```typescript
async explain(
  tenant: TenantContext,
  subject: SubjectContext,
  permission: string,
  options: ExplainOptions = {}
): Promise<PermissionExplanation>
```

**执行流程**:

1. **解析权限代码**
   - 使用 `parsePermissionCode()` 解析权限代码
   - 如果解析失败，返回 `not_applicable` 决策

2. **获取主体权限**
   - 调用 `permissionResolver(tenantId, subjectId)` 获取主体权限集合

3. **检查通配符权限**
   - 检查是否有 `*` 通配符权限
   - 检查是否有 `resource:*` 资源通配符权限
   - 检查是否有精确匹配的权限

4. **构建策略评估上下文**
   ```typescript
   const evalContext: PolicyEvaluationContext = {
     tenant,
     subject,
     request: {
       requestId: 'explain',
       timestamp: new Date(),
     },
     permission: {
       code: permission,
       resource,
       action,
       scope: 'tenant',
       conditions: [],
       metadata: {},
     },
   };
   ```

5. **评估策略**
   - 调用 `policyEngine.evaluate(evalContext)` 评估策略

6. **构建解释结果**
   - 根据策略评估结果构建 `PermissionExplanation`

7. **添加策略详情**（可选）
   - 如果 `options.includePolicies && level !== 'minimal'`
   - 调用 `getPolicyResults()` 获取策略评估结果

**决策逻辑**:

```typescript
if (subjectPermissions.has('*')) {
  return createAllowExplanation('通配符权限 (*) 授予访问权限');
}

if (subjectPermissions.has(`${resource}:*`)) {
  return createAllowExplanation(`资源通配符 (${resource}:*) 授予访问权限`);
}

if (subjectPermissions.has(permission)) {
  return createAllowExplanation('权限被明确授予');
}

// 评估策略
const policyResult = await this.policyEngine.evaluate(evalContext);
```

#### 3.1.3 explainBulk() 方法

**方法签名**:
```typescript
async explainBulk(request: BulkExplainRequest): Promise<BulkExplainResult>
```

**执行流程**:
1. 遍历 `request.permissions` 数组
2. 对每个权限调用 `explain()` 方法
3. 统计允许、拒绝和不适用的数量
4. 返回批量解释结果

**特点**:
- 串行执行，不并行
- 每个权限使用相同的 `tenant` 和 `subject`
- 每个权限使用相同的 `options`

#### 3.1.4 explainSubject() 方法

**方法签名**:
```typescript
async explainSubject(
  tenant: TenantContext,
  subject: SubjectContext
): Promise<{
  roles: string[];
  permissions: string[];
  sources: Array<{ permission: string; source: string }>;
}>
```

**执行流程**:
1. 调用 `permissionResolver(tenantId, subjectId)` 获取主体权限
2. 从 `subject.roles` 获取角色列表
3. 构建权限来源列表（每个权限的 `source` 固定为 `'resolved'`）

**限制**:
- `source` 字段固定为 `'resolved'`，表示权限是通过权限解析器获取的
- 无法追踪权限的实际来源（如角色、策略等）

#### 3.1.5 私有方法

**createAllowExplanation()**:
```typescript
private createAllowExplanation(
  permission: string,
  resource: string,
  action: string,
  reason: string,
  tenant: TenantContext,
  subject: SubjectContext,
  startTime: number,
  extras?: Partial<PermissionExplanation>
): PermissionExplanation
```
- 创建允许访问的解释结果
- `evaluationPath` 固定为 `['permission-check']`

**createNotApplicableExplanation()**:
```typescript
private createNotApplicableExplanation(
  permission: string,
  reason: string,
  tenant: TenantContext,
  subject: SubjectContext,
  startTime: number
): PermissionExplanation
```
- 创建不适用的解释结果
- `resource` 和 `action` 为空字符串
- `evaluationPath` 为空数组

**buildReason()**:
```typescript
private buildReason(
  result: { effect: 'allow' | 'deny'; matchedPolicy?: string; matchedRule?: number },
  permission: string
): string
```
- 构建决策原因字符串
- 根据策略评估结果生成友好的原因描述

**buildContext()**:
```typescript
private buildContext(
  tenant: TenantContext,
  subject: SubjectContext,
  options: ExplainOptions
): ExplanationContext
```
- 构建解释上下文
- 根据 `options.includeContext` 决定是否包含完整信息

**getPolicyResults()**:
```typescript
private async getPolicyResults(
  tenantId: string,
  context: PolicyEvaluationContext
): Promise<PolicyResult[]>
```
- 获取策略评估结果
- 遍历租户的所有策略
- 评估每个策略的每个规则
- 按优先级排序返回结果

**getPriorityValue()**:
```typescript
private getPriorityValue(priority: string): number
```
- 将优先级字符串转换为数值
- 映射关系：
  - `low`: 10
  - `normal`: 50
  - `high`: 100
  - `critical`: 1000
  - 默认: 50

### 3.2 ExplanationCollector（解释收集器）

#### 3.2.1 构造函数

```typescript
constructor(options: CollectorOptions = {})
```

**选项说明**:
- `maxEntries`: 最大条目数，默认 1000
- `ttl`: 条目生存时间（毫秒），默认 3600000（1小时）
- `onCollect`: 收集条目时的回调函数

**验证逻辑**:
- `maxEntries` 必须是正数
- `ttl` 必须是正数

#### 3.2.2 collect() 方法

```typescript
collect(
  explanation: PermissionExplanation,
  metadata?: { requestId?: string; [key: string]: unknown }
): void
```

**执行流程**:
1. 创建 `ExplanationEntry` 对象
2. 添加到 `entries` 数组
3. 如果条目数超过 `maxEntries`，删除最旧的条目
4. 调用 `onCollect` 回调（如果设置了）

#### 3.2.3 collectBulk() 方法

```typescript
collectBulk(
  result: BulkExplainResult,
  metadata?: { requestId?: string; [key: string]: unknown }
): void
```

**执行流程**:
- 遍历 `result.explanations` 数组
- 对每个解释调用 `collect()` 方法

#### 3.2.4 查询方法

**getRecent()**:
```typescript
getRecent(count: number = 10): ExplanationEntry[]
```
- 获取最近的解释条目
- 按时间倒序排列

**getByTenant()**:
```typescript
getByTenant(tenantId: string): ExplanationEntry[]
```
- 按租户ID过滤解释条目

**getBySubject()**:
```typescript
getBySubject(subjectId: string): ExplanationEntry[]
```
- 按主体ID过滤解释条目

**getByPermission()**:
```typescript
getByPermission(permission: string): ExplanationEntry[]
```
- 按权限代码过滤解释条目

**getByDecision()**:
```typescript
getByDecision(decision: 'allow' | 'deny' | 'not_applicable'): ExplanationEntry[]
```
- 按决策类型过滤解释条目

**getDenied()**:
```typescript
getDenied(): ExplanationEntry[]
```
- 获取所有被拒绝的解释条目
- 等价于 `getByDecision('deny')`

#### 3.2.5 getStats() 方法

```typescript
getStats(): {
  total: number;
  allowed: number;
  denied: number;
  notApplicable: number;
  averageDuration: number;
  byResource: Record<string, number>;
  bySubject: Record<string, number>;
}
```

**统计内容**:
- 总条目数
- 允许、拒绝、不适用的数量
- 平均评估耗时
- 按资源统计
- 按主体统计

#### 3.2.6 cleanup() 方法

```typescript
cleanup(): number
```

**执行流程**:
1. 计算截止时间：`Date.now() - ttl`
2. 过滤掉超过生存时间的条目
3. 返回清理的条目数量

#### 3.2.7 其他方法

**clear()**:
```typescript
clear(): void
```
- 清空所有条目

**export()**:
```typescript
export(): ExplanationEntry[]
```
- 导出所有条目副本

**size**:
```typescript
get size(): number
```
- 获取当前条目数量

### 3.3 Formatter（格式化器）

#### 3.3.1 TextFormatter

**构造函数**:
```typescript
constructor(options: { indent?: string; useColors?: boolean } = {})
```

**选项说明**:
- `indent`: 缩进字符串，默认 `'  '`（两个空格）
- `useColors`: 是否使用颜色输出，默认 `false`

**format() 方法**:
- 格式化单个权限解释
- 输出格式：
  - 标题：`=== Permission: {permission} ===`
  - 决策：`Decision: {ALLOW/DENY/NOT_APPLICABLE}`
  - 原因：`Reason: {reason}`
  - 上下文：租户、主体、角色
  - 评估路径：`→ {step}`
  - 策略详情：`✓ {policyName} [priority: {priority}]`
  - 页脚：耗时和时间戳

**formatBulk() 方法**:
- 格式化批量权限解释结果
- 输出格式：
  - 摘要统计：总数、允许、拒绝、不适用、耗时
  - 单个结果：紧凑格式 `{icon} {permission}: {reason}`

**私有方法**:
- `formatHeader()`: 格式化标题
- `formatDecision()`: 格式化决策结果（带颜色）
- `formatPolicy()`: 格式化策略结果
- `formatCompact()`: 格式化为紧凑格式（单行）

#### 3.3.2 JSONFormatter

**构造函数**:
```typescript
constructor(options: { pretty?: boolean } = {})
```

**选项说明**:
- `pretty`: 是否美化输出，默认 `true`

**format() 方法**:
- 格式化单个权限解释
- 将 `PermissionExplanation` 转换为 JSON 字符串

**formatBulk() 方法**:
- 格式化批量权限解释结果
- 将 `BulkExplainResult` 转换为 JSON 字符串

**私有方法**:
- `toSerializable()`: 将权限解释转换为可序列化的对象

#### 3.3.3 MarkdownFormatter

**构造函数**:
```typescript
constructor()
```

**format() 方法**:
- 格式化单个权限解释
- 输出格式：
  - 一级标题：`# Permission Check: {permission}`
  - 决策徽章：`**Decision:** {✅ ALLOWED / ❌ DENIED}`
  - 详细信息表格：Permission、Resource、Action、Reason
  - 上下文信息：Tenant、Subject、Type、Roles
  - 评估路径：代码块
  - 页脚：生成时间和耗时

**formatBulk() 方法**:
- 格式化批量权限解释结果
- 输出格式：
  - 一级标题：`# Permission Check Results`
  - 摘要表格：Total、Allowed、Denied、Duration
  - 结果表格：Permission、Decision、Reason

### 3.4 Plugin（插件）

#### 3.4.1 createExplainPlugin() 函数

```typescript
export function createExplainPlugin(
  options: ExplainPluginOptions = {}
): PluginDefinition & { state: ExplainPluginState }
```

**选项说明**:
- `defaultLevel`: 默认解释级别，默认 `'standard'`
- `collectExplanations`: 是否自动收集权限解释结果，默认 `false`
- `maxCollectedEntries`: 最大收集条目数，默认 1000

**插件状态**:
```typescript
interface ExplainPluginState {
  collector: ExplanationCollector;
  formatter: TextFormatter;
  defaultLevel: ExplainLevel;
}
```

#### 3.4.2 插件生命周期

**install() 方法**:
```typescript
install(context: PluginContext): void
```

**执行流程**:
1. 如果启用了自动收集（`options.collectExplanations`）
2. 注册全局钩子 `afterAny`
3. 在钩子中收集权限检查结果到收集器
4. 记录安装日志

**afterAny 钩子逻辑**:
```typescript
const afterAnyHook = (mtpcContext, operation, resourceName, result) => {
  const explanation: PermissionExplanation = {
    permission: `${resourceName}:${operation}`,
    resource: resourceName,
    action: operation,
    decision: result.allowed ? 'allow' : 'deny',
    reason: result.reason ?? 'Unknown',
    evaluationPath: ['permission-check'],
    timestamp: new Date(),
    duration: result.evaluationTime ?? 0,
    context: {
      tenant: { id: mtpcContext.tenant.id, status: mtpcContext.tenant.status },
      subject: { id: mtpcContext.subject.id, type: mtpcContext.subject.type },
    },
  };

  collector.collect(explanation, { requestId: mtpcContext.request.requestId });
};
```

**onDestroy() 方法**:
```typescript
onDestroy(): void
```

**执行流程**:
1. 清空收集器中的所有条目
2. 记录销毁日志

#### 3.4.3 插件特点

1. **非侵入性**: 不修改权限判定结果
2. **Side-channel**: 作为旁路存在，不影响主流程
3. **自动收集**: 通过全局钩子自动收集权限检查结果
4. **资源清理**: 在销毁时清空收集器，防止内存泄漏

### 3.5 createExplainerFromMTPC() 函数

```typescript
export function createExplainerFromMTPC(
  mtpc: MTPC,
  options?: { defaultLevel?: ExplainLevel }
): PermissionExplainer
```

**执行流程**:
1. 调用 `mtpc.getPermissionResolver()` 获取权限解析器
2. 如果权限解析器不存在，抛出错误
3. 创建 `PermissionExplainer` 实例
4. 使用 `mtpc.policyEngine` 和获取的权限解析器

**错误处理**:
```typescript
if (!resolver) {
  throw new Error(
    'MTPC instance does not have a permissionResolver. ' +
      'Please set one using setPermissionResolver() or provide it in the constructor.'
  );
}
```

---

## 4. 类型系统分析

### 4.1 ExplainLevel

```typescript
export type ExplainLevel = 'minimal' | 'standard' | 'detailed' | 'debug';
```

**级别说明**:
- `minimal`: 最小化信息，仅包含基本决策和原因
- `standard`: 标准信息，包含决策、原因、匹配的策略和规则
- `detailed`: 详细信息，包含所有策略和规则的评估结果
- `debug`: 调试信息，包含完整的评估过程和上下文

**使用场景**:
- 生产环境：`minimal` 或 `standard`
- 开发环境：`detailed` 或 `debug`

### 4.2 DecisionType

```typescript
export type DecisionType = 'allow' | 'deny' | 'not_applicable';
```

**决策类型说明**:
- `allow`: 允许访问
- `deny`: 拒绝访问
- `not_applicable`: 不适用，权限代码格式错误或其他特殊情况

### 4.3 PermissionExplanation

```typescript
export interface PermissionExplanation {
  permission: string;           // 被评估的权限
  resource: string;             // 资源名称
  action: string;               // 操作名称
  decision: DecisionType;       // 决策结果
  reason: string;               // 决策原因
  matchedPolicy?: string;      // 匹配的策略ID
  matchedRule?: number;         // 匹配的规则索引
  evaluationPath: string[];     // 评估路径
  timestamp: Date;              // 评估时间戳
  duration: number;             // 评估耗时（毫秒）
  context: ExplanationContext;  // 评估上下文
  policies?: PolicyResult[];    // 策略评估结果（可选）
}
```

**字段说明**:
- `evaluationPath`: 记录权限评估的路径，如 `['permission-check', 'policy-evaluation']`
- `matchedPolicy`: 匹配的策略ID，如 `'admin-policy'`
- `matchedRule`: 匹配的规则索引，从 0 开始
- `policies`: 策略评估结果列表，仅在 `includePolicies: true` 时返回

### 4.4 ExplanationContext

```typescript
export interface ExplanationContext {
  tenant: {
    id: string;
    status?: string;
  };
  subject: {
    id: string;
    type: string;
    roles?: string[];
  };
  resource?: Record<string, unknown>;
  environment?: {
    timestamp: Date;
    ip?: string;
  };
}
```

**字段说明**:
- `tenant.status`: 租户状态，如 `'active'`、`'suspended'`
- `subject.roles`: 主体角色列表，仅在 `includeContext: true` 时返回
- `environment`: 环境信息，仅在 `includeContext: true` 时返回

### 4.5 ExplainOptions

```typescript
export interface ExplainOptions {
  level?: ExplainLevel;           // 解释详细级别
  includePolicies?: boolean;       // 是否包含策略评估结果
  includeConditions?: boolean;     // 是否包含条件评估结果
  includeContext?: boolean;        // 是否包含完整上下文信息
  maxPolicies?: number;           // 最大返回的策略数量
}
```

**字段说明**:
- `includePolicies`: 包含策略评估结果会增加性能开销
- `includeConditions`: 当前版本未实现
- `maxPolicies`: 当前版本未实现

---

## 5. 与 MTPC Core 的集成

### 5.1 依赖关系

```
@mtpc/explain
    │
    ├─→ @mtpc/core
    │     ├─ PolicyEngine
    │     ├─ PermissionEvaluationContext
    │     ├─ SubjectContext
    │     ├─ TenantContext
    │     ├─ PluginDefinition
    │     └─ PluginContext
    │
    └─→ @mtpc/shared
          └─ parsePermissionCode()
```

### 5.2 插件集成

**安装插件**:
```typescript
import { createMTPC } from '@mtpc/core';
import { createExplainPlugin } from '@mtpc/explain';

const mtpc = createMTPC();
mtpc.use(createExplainPlugin({
  collectExplanations: true,
  maxCollectedEntries: 5000
}));
await mtpc.init();
```

**获取插件状态**:
```typescript
const explainPlugin = mtpc.getPlugin('@mtpc/explain');
if (explainPlugin) {
  const { collector, formatter } = explainPlugin.state;
  // 使用收集器和格式化器
}
```

### 5.3 解释器集成

**创建解释器**:
```typescript
import { createMTPC } from '@mtpc/core';
import { createExplainerFromMTPC } from '@mtpc/explain';

const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    return new Set(['user:read', 'user:create']);
  }
});
await mtpc.init();

const explainer = createExplainerFromMTPC(mtpc, {
  defaultLevel: 'detailed'
});
```

**使用解释器**:
```typescript
const explanation = await explainer.explain(
  { id: 'tenant-1', status: 'active' },
  { id: 'user-1', type: 'user' },
  'user:read'
);
```

---

## 6. 性能分析

### 6.1 性能影响因素

1. **解释级别**: 级别越高，性能开销越大
   - `minimal`: 最小开销
   - `standard`: 中等开销
   - `detailed`: 较大开销（包含策略评估）
   - `debug`: 最大开销

2. **策略数量**: 策略越多，评估时间越长

3. **收集器大小**: 收集器条目越多，查询时间越长

4. **格式化方式**: 文本格式化比 JSON 格式化更快

### 6.2 性能优化建议

1. **选择合适的解释级别**: 生产环境使用 `minimal` 或 `standard`
2. **限制策略数量**: 减少不必要的策略
3. **设置合理的收集器大小**: 根据实际需求调整 `maxEntries`
4. **使用缓存**: 缓存频繁请求的解释结果
5. **批量处理**: 使用 `explainBulk()` 减少网络开销

### 6.3 性能指标

| 操作 | 预期耗时 | 备注 |
|------|----------|------|
| `explain()` (minimal) | < 1ms | 最小开销 |
| `explain()` (standard) | < 5ms | 中等开销 |
| `explain()` (detailed) | < 20ms | 包含策略评估 |
| `explainBulk()` (10个权限) | < 50ms | 串行执行 |
| `collector.getStats()` | < 1ms | 快速统计 |

---

## 7. 源码与文档差异

### 7.1 已发现的差异

1. **`createExplainer` 函数**: README.md 提到了 `createExplainer` 函数，但源码中只有 `createExplainerFromMTPC`

2. **`ExplanationCollector` 的 `ttl` 选项**: README.md 没有提到 `ttl` 选项，但源码中支持设置条目生存时间

3. **`ExplanationCollector` 的 `export()` 方法**: README.md 没有提到 `export()` 方法，但源码中支持导出所有条目

4. **`ExplanationCollector` 的 `onCollect` 回调**: README.md 没有提到 `onCollect` 回调，但源码中支持在收集条目时调用回调函数

5. **插件自动收集机制**: README.md 没有详细说明插件通过全局钩子自动收集权限检查结果的机制

6. **`createExplainerFromMTPC` 的错误处理**: README.md 没有强调需要设置 `permissionResolver`，否则会抛出错误

7. **`explainSubject` 方法的 `source` 字段**: README.md 没有说明 `source` 字段固定为 `'resolved'`

### 7.2 需要更新的文档内容

1. 添加 `createExplainerFromMTPC` 的详细说明
2. 添加 `ExplanationCollector` 的 `ttl` 选项说明
3. 添加 `ExplanationCollector` 的 `export()` 方法说明
4. 添加 `ExplanationCollector` 的 `onCollect` 回调说明
5. 详细说明插件自动收集机制
6. 强调 `createExplainerFromMTPC` 需要设置 `permissionResolver`
7. 说明 `explainSubject` 方法的 `source` 字段限制

---

## 8. 最佳实践

### 8.1 开发环境

```typescript
const explainer = createExplainerFromMTPC(mtpc, {
  defaultLevel: 'detailed'  // 使用详细级别
});

const explanation = await explainer.explain(tenant, subject, permission, {
  includePolicies: true,   // 包含策略评估结果
  includeContext: true     // 包含完整上下文信息
});
```

### 8.2 生产环境

```typescript
const explainer = createExplainerFromMTPC(mtpc, {
  defaultLevel: 'minimal'  // 使用最小级别
});

const explanation = await explainer.explain(tenant, subject, permission, {
  includePolicies: false,  // 不包含策略评估结果
  includeContext: false     // 不包含完整上下文信息
});
```

### 8.3 审计日志

```typescript
const collector = new ExplanationCollector({
  maxEntries: 10000,
  ttl: 86400000,  // 24小时
  onCollect: (entry) => {
    // 将审计日志发送到外部系统
    auditLogger.log(entry);
  }
});

mtpc.use(createExplainPlugin({
  collectExplanations: true,
  maxCollectedEntries: 10000
}));
```

### 8.4 调试工具

```typescript
const explainer = createExplainerFromMTPC(mtpc, {
  defaultLevel: 'debug'
});

const formatter = new TextFormatter({
  useColors: true
});

const explanation = await explainer.explain(tenant, subject, permission);
console.log(formatter.format(explanation));
```

---

## 9. 总结

### 9.1 核心优势

1. **非侵入性**: 不影响权限判定结果
2. **可观测性**: 提供详细的权限决策解释
3. **可扩展性**: 支持自定义格式化器和收集策略
4. **易于集成**: 通过插件系统无缝集成到 MTPC

### 9.2 适用场景

1. **权限调试**: 帮助开发者理解和调试权限问题
2. **审计日志**: 记录权限检查历史
3. **合规性检查**: 提供权限决策的可追溯性
4. **管理界面**: 为管理员提供权限可视化

### 9.3 未来改进方向

1. **性能优化**: 实现并行批量解释
2. **功能增强**: 实现 `includeConditions` 和 `maxPolicies` 选项
3. **来源追踪**: 实现 `explainSubject` 的真实来源追踪
4. **缓存机制**: 添加解释结果缓存
