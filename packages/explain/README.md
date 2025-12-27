# @mtpc/explain 使用指南

## 1. 包简介

`@mtpc/explain` 是 MTPC (Multi-Tenant Permission Core) 的权限决策解释扩展，用于解释权限决策结果，提供详细的决策原因和评估过程。

### 核心功能

- 解释单个权限决策结果
- 批量解释多个权限决策
- 解释主体的角色和权限来源
- 自定义解释级别和详细程度
- 支持包含策略评估详情
- 提供友好的解释结果格式化（文本、JSON、Markdown）
- 自动收集权限检查历史
- 提供统计和查询功能

### 适用场景

- 权限调试和问题排查
- 权限审计和合规性检查
- 管理员权限可视化界面
- 权限决策可解释性需求
- 开发阶段的权限测试
- 生产环境的可观测性需求

### 设计原则

- **非侵入性**: 不影响权限判定结果，作为 Side-channel 存在
- **可观测性**: 提供详细的权限决策解释
- **可扩展性**: 支持自定义格式化器和收集策略
- **易于集成**: 通过插件系统无缝集成到 MTPC

## 2. 安装指南

### 2.1 安装依赖

使用 pnpm 安装 `@mtpc/explain` 包：

```bash
pnpm add @mtpc/explain @mtpc/core
```

### 2.2 依赖要求

| 依赖包 | 版本要求 | 说明 |
|--------|----------|------|
| `@mtpc/core` | workspace:* | MTPC 核心包，提供基础权限能力 |
| `@mtpc/shared` | workspace:* | 共享工具函数库，提供权限代码解析等功能 |

## 3. 快速开始

### 3.1 基本使用示例

```typescript
import { createMTPC } from '@mtpc/core';
import { createExplainPlugin, createExplainerFromMTPC } from '@mtpc/explain';

// 创建 MTPC 实例
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    // 示例：返回固定权限集合
    return new Set(['user:read', 'user:create']);
  }
});

// 注册 Explain 插件
mtpc.use(createExplainPlugin({
  collectExplanations: true,
}));

// 初始化 MTPC
await mtpc.init();

// 创建权限解释器实例（使用便捷函数）
// 注意：MTPC 实例必须设置了 permissionResolver，否则会抛出错误
const explainer = createExplainerFromMTPC(mtpc);

// 解释权限决策
async function explainPermission() {
  const explanation = await explainer.explain(
    { id: 'tenant-1', status: 'active' }, // 租户上下文
    { id: 'user-1', type: 'user', roles: ['admin'] }, // 主体上下文
    'user:read' // 权限代码
  );

  console.log(explanation);
  /*
  输出示例：
  {
    permission: 'user:read',
    resource: 'user',
    action: 'read',
    decision: 'allow',
    reason: '权限被明确授予',
    evaluationPath: ['permission-check'],
    timestamp: 2024-01-01T00:00:00.000Z,
    duration: 10,
    context: {
      tenant: { id: 'tenant-1', status: 'active' },
      subject: { id: 'user-1', type: 'user' }
    }
  }
  */
}

explainPermission();
```

### 3.2 通过插件集成

```typescript
import { createMTPC } from '@mtpc/core';
import { createExplainPlugin } from '@mtpc/explain';

// 创建 MTPC 实例
const mtpc = createMTPC();

// 使用解释插件
mtpc.use(createExplainPlugin({
  collectExplanations: true,
  maxCollectedEntries: 5000
}));

// 初始化 MTPC
await mtpc.init();

// 获取插件实例
const explainPlugin = mtpc.getPlugin('@mtpc/explain');
if (explainPlugin) {
  console.log('Explain plugin state:', explainPlugin.state);

  // 访问收集器
  const { collector, formatter } = explainPlugin.state;

  // 获取最近的解释
  const recent = collector.getRecent(10);
  console.log('Recent explanations:', recent);

  // 获取统计信息
  const stats = collector.getStats();
  console.log('Statistics:', stats);
}
```

## 4. 核心 API 详解

### 4.1 createExplainPlugin 函数

创建 Explain 插件实例：

```typescript
createExplainPlugin(options?): PluginDefinition & { state: ExplainPluginState }
```

#### 插件配置选项 (ExplainPluginOptions)

| 参数 | 类型 | 说明 |
|------|------|------|
| `defaultLevel` | `ExplainLevel` | 默认解释级别：`'minimal'` | `'standard'` | `'detailed'` | `'debug'`，默认 `'standard'` |
| `collectExplanations` | `boolean` | 是否自动收集权限解释结果，默认 `false` |
| `maxCollectedEntries` | `number` | 最大收集条目数，默认 1000 |

**重要说明**：
- 当 `collectExplanations` 为 `true` 时，插件会注册全局钩子 `afterAny`
- 每次权限检查后，会自动收集权限检查结果到收集器
- 收集的是权限检查结果，而不是完整的解释结果
- 完整的解释结果需要用户通过 `PermissionExplainer` 显式生成

#### 插件状态 (ExplainPluginState)

| 属性 | 类型 | 说明 |
|--------|------|------|
| `collector` | `ExplanationCollector` | 解释收集器实例 |
| `formatter` | `TextFormatter` | 文本格式化器实例 |
| `defaultLevel` | `ExplainLevel` | 默认解释级别 |

### 4.2 createExplainerFromMTPC 函数

从 MTPC 实例创建权限解释器（便捷函数）：

```typescript
createExplainerFromMTPC(mtpc, options?): PermissionExplainer
```

#### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `mtpc` | `MTPC` | MTPC 实例 |
| `options` | `{ defaultLevel?: ExplainLevel }` | 可选配置，默认解释级别 |

**重要说明**：
- MTPC 实例必须设置了 `permissionResolver`，否则会抛出错误
- 可以通过以下方式设置权限解析器：
  1. 在 `createMTPC()` 时传入 `defaultPermissionResolver` 选项
  2. 使用 `mtpc.setPermissionResolver()` 方法设置
- 如果权限解析器不存在，会抛出以下错误：
  ```
  Error: MTPC instance does not have a permissionResolver. Please set one using setPermissionResolver() or provide it in the constructor.
  ```

**内部实现**：
- 依赖 `@mtpc/core` 的 `PolicyEngine` 和 `PermissionEvaluationContext`
- 依赖 `@mtpc/shared` 的 `parsePermissionCode()` 函数
- 默认解释级别为 `'standard'`

**示例**：
```typescript
// 方式1：在创建 MTPC 实例时设置
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    return new Set(['user:read', 'user:create']);
  }
});

// 方式2：使用 setPermissionResolver 方法设置
const mtpc = createMTPC();
mtpc.setPermissionResolver(async (tenantId, subjectId) => {
  return new Set(['user:read', 'user:create']);
});

// 创建解释器
const explainer = createExplainerFromMTPC(mtpc);
```

### 4.3 createExplainer 函数

创建权限解释器实例（便捷函数）：

```typescript
createExplainer(policyEngine, permissionResolver, options?): PermissionExplainer
```

#### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `policyEngine` | `PolicyEngine` | 策略引擎实例 |
| `permissionResolver` | `(tenantId: string, subjectId: string) => Promise<Set<string>>` | 权限解析器 |
| `options` | `{ defaultLevel?: ExplainLevel }` | 可选配置，默认解释级别 |

**注意**：通常使用 `createExplainerFromMTPC()` 而不是直接使用此函数。

**创建方式对比**：

| 方式 | 适用场景 | 推荐度 |
|------|----------|--------|
| `createExplainerFromMTPC()` | 已有 MTPC 实例，需要快速创建解释器 | ⭐⭐⭐⭐⭐ |
| `createExplainer()` | 需要独立控制策略引擎和权限解析器 | ⭐⭐ |
| `new PermissionExplainer()` | 需要完全自定义配置 | ⭐ |

### 4.4 PermissionExplainer 类

**说明**：通常通过 `createExplainerFromMTPC()` 函数创建，不建议直接实例化。

#### 构造函数

```typescript
new PermissionExplainer(policyEngine, permissionResolver, options?)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `policyEngine` | `PolicyEngine` | 策略引擎实例，用于评估策略 |
| `permissionResolver` | `(tenantId: string, subjectId: string) => Promise<Set<string>>` | 权限解析器，用于获取主体的权限 |
| `options` | `{ defaultLevel?: ExplainLevel }` | 可选配置，默认解释级别，默认 `'standard'` |

**内部实现**：
- 依赖 `@mtpc/core` 的 `PolicyEngine` 和 `PermissionEvaluationContext`
- 依赖 `@mtpc/shared` 的 `parsePermissionCode()` 函数
- 默认解释级别为 `'standard'`

#### explain 方法

解释单个权限决策：

```typescript
explain(tenant, subject, permission, options?): Promise<PermissionExplanation>
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `tenant` | `TenantContext` | 租户上下文 |
| `subject` | `SubjectContext` | 主体上下文 |
| `permission` | `string` | 权限代码，如 'user:read' |
| `options` | `ExplainOptions` | 解释选项 |

#### explainBulk 方法

批量解释多个权限决策：

```typescript
explainBulk(request): Promise<BulkExplainResult>
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `request` | `BulkExplainRequest` | 批量解释请求，包含租户、主体和权限列表 |

#### explainSubject 方法

解释主体的角色和权限来源：

```typescript
explainSubject(tenant, subject): Promise<{ roles: string[]; permissions: string[]; sources: Array<{ permission: string; source: string }> }>
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `tenant` | `TenantContext` | 租户上下文 |
| `subject` | `SubjectContext` | 主体上下文 |

**权限解释流程**：
1. **解析权限代码**: 使用 `parsePermissionCode()` 解析权限代码
2. **获取主体权限**: 调用 `permissionResolver(tenantId, subjectId)` 获取主体权限
3. **检查通配符权限**: 检查 `*` 和 `resource:*` 通配符权限
4. **评估策略**: 调用 `policyEngine.evaluate()` 评估策略
5. **构建解释结果**: 根据评估结果构建 `PermissionExplanation`

### 4.4 解释选项 (ExplainOptions)

```typescript
interface ExplainOptions {
  level?: ExplainLevel;           // 解释级别：'minimal' | 'standard' | 'detailed' | 'debug'
  includePolicies?: boolean;       // 是否包含策略评估结果
  includeContext?: boolean;        // 是否包含完整上下文信息
  includeConditions?: boolean;     // 是否包含条件评估结果（当前版本未实现）
  maxPolicies?: number;           // 最大返回的策略数量（当前版本未实现）
}
```

**选项说明**：
- `level`: 控制解释的详细程度
  - `minimal`: 最小化信息，仅包含基本决策和原因
  - `standard`: 标准信息，包含决策、原因、匹配的策略和规则
  - `detailed`: 详细信息，包含所有策略和规则的评估结果
  - `debug`: 调试信息，包含完整的评估过程和上下文
- `includePolicies`: 包含策略评估结果会增加性能开销
- `includeContext`: 包含完整上下文信息会增加响应大小
- `includeConditions`: 当前版本未实现，保留用于未来扩展
- `maxPolicies`: 当前版本未实现，保留用于未来扩展

### 4.5 解释结果 (PermissionExplanation)

```typescript
interface PermissionExplanation {
  permission: string; // 权限代码
  resource: string; // 资源名称
  action: string; // 操作名称
  decision: 'allow' | 'deny' | 'not_applicable'; // 决策结果
  reason: string; // 决策原因
  matchedPolicy?: string; // 匹配的策略ID
  matchedRule?: number; // 匹配的规则索引
  evaluationPath: string[]; // 评估路径
  timestamp: Date; // 评估时间
  duration: number; // 评估耗时（毫秒）
  context: ExplanationContext; // 评估上下文
  policies?: PolicyResult[]; // 策略评估结果（可选）
}
```

### 4.6 格式化器

#### TextFormatter

将权限解释结果格式化为易读的纯文本格式：

```typescript
const formatter = new TextFormatter({ indent: '  ', useColors: true });
const text = formatter.format(explanation);
console.log(text);
```

**构造函数选项**：
```typescript
interface TextFormatterOptions {
  indent?: string;    // 缩进字符串，默认 '  '（两个空格）
  useColors?: boolean; // 是否使用颜色输出，默认 false
}
```

**输出格式示例**：
```
=== Permission: user:read ===

Decision: ALLOW
Reason: 权限被明确授予

Context:
  Tenant: tenant-1
  Subject: user-1 (user)
  Roles: admin, editor

Evaluation Path:
  → permission-check
  → policy-evaluation

Policies Evaluated:
  ✓ Admin Policy [priority: 1000]
  ✓ User Policy [priority: 50]
  ✗ Guest Policy [priority: 10]

Duration: 10ms
Timestamp: 2024-01-01T00:00:00.000Z
```

**颜色说明**（当 `useColors: true` 时）：
- `ALLOW`: 绿色
- `DENY`: 红色
- `NOT_APPLICABLE`: 黄色

#### JSONFormatter

将权限解释结果格式化为 JSON 格式：

```typescript
import { JSONFormatter } from '@mtpc/explain';

const formatter = new JSONFormatter({ pretty: true });
const json = formatter.format(explanation);
console.log(json);
```

**构造函数选项**：
```typescript
interface JSONFormatterOptions {
  pretty?: boolean; // 是否美化输出，默认 true
}
```

**输出格式示例**：
```json
{
  "permission": "user:read",
  "resource": "user",
  "action": "read",
  "decision": "allow",
  "reason": "权限被明确授予",
  "evaluationPath": ["permission-check"],
  "timestamp": "2024-01-01T00:00:00.000Z",
  "duration": 10,
  "context": {
    "tenant": {
      "id": "tenant-1",
      "status": "active"
    },
    "subject": {
      "id": "user-1",
      "type": "user",
      "roles": ["admin", "editor"]
    }
  },
  "policies": [
    {
      "id": "admin-policy",
      "name": "Admin Policy",
      "matched": true,
      "effect": "allow",
      "priority": 1000,
      "enabled": true
    }
  ]
}
```

#### MarkdownFormatter

将权限解释结果格式化为 Markdown 格式：

```typescript
import { MarkdownFormatter } from '@mtpc/explain';

const formatter = new MarkdownFormatter();
const markdown = formatter.format(explanation);
console.log(markdown);
```

**输出格式示例**：
```markdown
# Permission Check: user:read

**Decision:** ✅ ALLOWED

## Details

| Property | Value |
| --- | --- |
| Permission | user:read |
| Resource | user |
| Action | read |
| Reason | 权限被明确授予 |

## Context

- **Tenant:** tenant-1
- **Subject:** user-1
- **Type:** user
- **Roles:** admin, editor

## Evaluation Path

```
permission-check
policy-evaluation
```

---

*Generated at 2024-01-01T00:00:00.000Z in 10ms*
```
 
### 4.7 格式化器便捷函数

#### createTextFormatter

创建文本格式化器实例（便捷函数）：

```typescript
createTextFormatter(options?): TextFormatter
```

##### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `options.indent` | `string` | 缩进字符串，默认 '  ' |
| `options.useColors` | `boolean` | 是否使用颜色输出，默认 false |

#### createJSONFormatter

创建 JSON 格式化器实例（便捷函数）：

```typescript
createJSONFormatter(options?): JSONFormatter
```

##### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `options.pretty` | `boolean` | 是否美化输出，默认 true |

#### createMarkdownFormatter

创建 Markdown 格式化器实例（便捷函数）：

```typescript
createMarkdownFormatter(): MarkdownFormatter
```

**示例**：
```typescript
import { createTextFormatter, createJSONFormatter, createMarkdownFormatter } from '@mtpc/explain';

const textFormatter = createTextFormatter({ useColors: true });
const jsonFormatter = createJSONFormatter({ pretty: true });
const mdFormatter = createMarkdownFormatter();
```

---

## 5. 高级功能演示

### 5.1 自定义解释级别

```typescript
// 最小化解释（仅包含核心信息）
const minimalExplanation = await explainer.explain(
  { id: 'tenant-1', status: 'active' },
  { id: 'user-1', type: 'user' },
  'user:read',
  { level: 'minimal' }
);

// 详细解释（包含完整信息和策略评估结果）
const detailedExplanation = await explainer.explain(
  { id: 'tenant-1', status: 'active' },
  { id: 'user-1', type: 'user' },
  'user:read',
  {
    level: 'detailed',
    includePolicies: true,
    includeContext: true
  }
);
```

### 5.2 批量解释权限

```typescript
const bulkResult = await explainer.explainBulk({
  tenant: { id: 'tenant-1', status: 'active' },
  subject: { id: 'user-1', type: 'user', roles: ['admin'] },
  permissions: ['user:read', 'user:create', 'user:delete', 'order:read'],
  options: {
    level: 'standard',
    includeContext: true
  }
});

console.log('批量解释结果：', bulkResult.summary);
console.log('允许的权限：', bulkResult.explanations.filter(e => e.decision === 'allow').map(e => e.permission));
console.log('拒绝的权限：', bulkResult.explanations.filter(e => e.decision === 'deny').map(e => e.permission));
```

### 5.3 解释主体权限来源

```typescript
const subjectExplanation = await explainer.explainSubject(
  { id: 'tenant-1', status: 'active' },
  { id: 'user-1', type: 'user', roles: ['admin', 'editor'] }
);

console.log('主体角色：', subjectExplanation.roles);
console.log('主体权限：', subjectExplanation.permissions);
console.log('权限来源：', subjectExplanation.sources);
```

**返回值说明**：
```typescript
{
  roles: string[],                                    // 主体角色列表
  permissions: string[],                                // 主体权限列表
  sources: Array<{ permission: string; source: string }>  // 权限来源列表
}
```

**重要说明**：
- `roles`: 从 `SubjectContext.roles` 获取，如果未提供则为空数组
- `permissions`: 通过调用 `permissionResolver(tenantId, subjectId)` 获取
- `sources`: 每个权限的来源信息，当前版本中 `source` 字段固定为 `'resolved'`
  - `'resolved'` 表示权限是通过权限解析器获取的
  - 当前版本无法追踪权限的实际来源（如角色、策略等）
  - 未来版本可能会增强此功能

**输出示例**：
```javascript
{
  roles: ['admin', 'editor'],
  permissions: ['user:read', 'user:create', 'user:update', 'user:delete'],
  sources: [
    { permission: 'user:read', source: 'resolved' },
    { permission: 'user:create', source: 'resolved' },
    { permission: 'user:update', source: 'resolved' },
    { permission: 'user:delete', source: 'resolved' }
  ]
}
```

### 5.4 集成策略引擎

```typescript
import { createMTPC } from '@mtpc/core';
import { createExplainPlugin, createExplainerFromMTPC } from '@mtpc/explain';

// 创建并配置 MTPC 实例
const mtpc = createMTPC();

// 注册资源
mtpc.registerResource({
  name: 'user',
  schema: { /* 资源 schema */ },
  features: { create: true, read: true, update: true, delete: true }
});

// 注册策略
mtpc.registerPolicy({
  id: 'admin-policy',
  name: '管理员策略',
  rules: [{
    permissions: ['user:*'],
    effect: 'allow',
    conditions: [{
      type: 'field',
      field: 'subject.roles',
      operator: 'includes',
      value: 'admin'
    }]
  }],
  priority: 'high',
  enabled: true
});

// 初始化 MTPC
await mtpc.init();

// 创建解释器，使用 MTPC 的策略引擎
const explainer = createExplainerFromMTPC(mtpc);

// 解释策略驱动的权限决策
const explanation = await explainer.explain(
  { id: 'tenant-1', status: 'active' },
  { id: 'user-1', type: 'user', roles: ['admin'] },
  'user:delete',
  { includePolicies: true }
);

console.log('策略驱动的权限解释：', explanation);
```

### 5.5 使用解释结果格式化器

```typescript
import { TextFormatter, JSONFormatter, MarkdownFormatter } from '@mtpc/explain';

// 创建解释器并获取解释结果
const explainer = createExplainerFromMTPC(mtpc);
const explanation = await explainer.explain(tenant, subject, permission);

// 格式化解释结果为易读的文本
const textFormatter = new TextFormatter({ useColors: true });
const formattedText = textFormatter.format(explanation);
console.log(formattedText);

/*
输出示例：
=== Permission: user:read ===
Decision: ALLOW
Reason: 权限被明确授予

Context:
  Tenant: tenant-1
  Subject: user-1 (user)

Duration: 10ms
Timestamp: 2024-01-01T00:00:00.000Z
*/

// 格式化为 JSON
const jsonFormatter = new JSONFormatter({ pretty: true });
const json = jsonFormatter.format(explanation);
console.log(json);

// 格式化批量解释结果
const bulkResult = await explainer.explainBulk({ /* ... */ });
const mdFormatter = new MarkdownFormatter();
const markdown = mdFormatter.formatBulk(bulkResult);
console.log(markdown);
```

### 5.6 使用收集器

```typescript
// 获取插件实例
const explainPlugin = mtpc.getPlugin('@mtpc/explain');
if (explainPlugin) {
  const { collector, formatter } = explainPlugin.state;

  // 获取最近的解释
  const recent = collector.getRecent(10);
  for (const entry of recent) {
    console.log(formatter.format(entry.explanation));
  }

  // 按租户查询
  const tenantExplanations = collector.getByTenant('tenant-1');
  console.log('租户解释：', tenantExplanations.length);

  // 按主体查询
  const subjectExplanations = collector.getBySubject('user-1');
  console.log('主体解释：', subjectExplanations.length);

  // 获取统计信息
  const stats = collector.getStats();
  console.log('统计信息：', stats);

  // 清理过期条目
  const cleaned = collector.cleanup();
  console.log('清理了', cleaned, '个过期条目');

  // 导出所有条目
  const allEntries = collector.export();
  console.log('所有条目：', allEntries.length);

  // 获取当前条目数量
  console.log('当前条目数量：', collector.size);
}
```

**创建收集器实例**：

```typescript
createCollector(options?): ExplanationCollector
```

#### 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `options` | `CollectorOptions` | 收集器选项 |

**示例**：
```typescript
const collector = createCollector({
  maxEntries: 1000,
  ttl: 3600000,
  onCollect: (entry) => {
    console.log('Collected:', entry.explanation.permission);
  }
});
```

---

**ExplanationCollector 方法详解**：

#### 构造函数选项
```typescript
interface CollectorOptions {
  maxEntries?: number;  // 最大条目数，默认 1000
  ttl?: number;         // 条目生存时间（毫秒），默认 3600000（1小时）
  onCollect?: (entry: ExplanationEntry) => void;  // 收集回调
}
```

#### 方法说明

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `collect()` | `explanation, metadata?` | `void` | 收集单个权限解释 |
| `collectBulk()` | `result, metadata?` | `void` | 收集批量权限解释结果 |
| `getRecent()` | `count?` | `ExplanationEntry[]` | 获取最近的解释条目 |
| `getByTenant()` | `tenantId` | `ExplanationEntry[]` | 按租户ID过滤 |
| `getBySubject()` | `subjectId` | `ExplanationEntry[]` | 按主体ID过滤 |
| `getByPermission()` | `permission` | `ExplanationEntry[]` | 按权限代码过滤 |
| `getByDecision()` | `decision` | `ExplanationEntry[]` | 按决策类型过滤 |
| `getDenied()` | - | `ExplanationEntry[]` | 获取所有被拒绝的条目 |
| `getStats()` | - | `Stats` | 获取统计信息 |
| `cleanup()` | - | `number` | 清理过期条目，返回清理数量 |
| `clear()` | - | `void` | 清空所有条目 |
| `export()` | - | `ExplanationEntry[]` | 导出所有条目副本 |
| `size` | - | `number` | 获取当前条目数量 |

#### 统计信息结构
```typescript
interface Stats {
  total: number;                           // 总条目数
  allowed: number;                         // 允许的条目数
  denied: number;                          // 拒绝的条目数
  notApplicable: number;                   // 不适用的条目数
  averageDuration: number;                 // 平均评估耗时（毫秒）
  byResource: Record<string, number>;      // 按资源统计
  bySubject: Record<string, number>;       // 按主体统计
}
```

#### ExplanationEntry 结构
```typescript
interface ExplanationEntry {
  explanation: PermissionExplanation;  // 权限解释
  collectedAt: Date;                 // 收集时间
  requestId?: string;                 // 请求ID
  metadata?: Record<string, unknown>; // 附加元数据
}
```

**使用 onCollect 回调**：
```typescript
const collector = new ExplanationCollector({
  maxEntries: 1000,
  ttl: 3600000,
  onCollect: (entry) => {
    // 将审计日志发送到外部系统
    auditLogger.log({
      permission: entry.explanation.permission,
      decision: entry.explanation.decision,
      tenantId: entry.explanation.context.tenant.id,
      subjectId: entry.explanation.context.subject.id,
      timestamp: entry.collectedAt
    });
  }
});
```

## 6. 最佳实践

### 6.1 开发阶段使用

```typescript
// 在开发环境中启用详细解释
const explainer = createExplainerFromMTPC(mtpc, {
  defaultLevel: process.env.NODE_ENV === 'development' ? 'detailed' : 'standard'
});
```

### 6.2 生产环境注意事项

1. 避免使用过于详细的解释级别，以提高性能
2. 仅在需要时包含策略评估结果
3. 考虑缓存解释结果，尤其是对于频繁请求的权限
4. 注意保护敏感信息，如完整的主体上下文

### 6.3 与日志系统集成

```typescript
// 记录权限决策和解释结果
async function checkPermissionWithLogging(tenant, subject, permission) {
  const explanation = await explainer.explain(tenant, subject, permission);

  // 记录到日志系统
  logger.info('权限检查结果', {
    permission: explanation.permission,
    decision: explanation.decision,
    reason: explanation.reason,
    tenantId: tenant.id,
    subjectId: subject.id,
    duration: explanation.duration
  });

  return explanation.decision === 'allow';
}
```

### 6.4 构建权限管理界面

```typescript
// 在权限管理界面中显示解释结果
function renderPermissionExplanation(explanation) {
  return (
    <div className="permission-explanation">
      <h3>权限解释: {explanation.permission}</h3>
      <div className={`decision-badge ${explanation.decision}`}>
        {explanation.decision === 'allow' ? '允许' : '拒绝'}
      </div>
      <p className="reason">原因: {explanation.reason}</p>
      <div className="details">
        <p>资源: {explanation.resource}</p>
        <p>操作: {explanation.action}</p>
        <p>评估耗时: {explanation.duration}ms</p>
      </div>
      {explanation.policies && explanation.policies.length > 0 && (
        <div className="policies">
          <h4>策略评估结果</h4>
          {/* 渲染策略评估结果 */}
        </div>
      )}
    </div>
  );
}
```

### 6.5 错误处理建议

```typescript
try {
  const explainer = createExplainerFromMTPC(mtpc);
  const explanation = await explainer.explain(tenant, subject, permission);
  // 处理解释结果
} catch (error) {
  if (error.message.includes('permissionResolver')) {
    console.error('权限解析器未设置，请使用 setPermissionResolver() 方法设置');
  } else {
    console.error('解释权限时出错:', error);
  }
}
```

### 6.6 安全建议

1. **保护敏感信息**: 避免在生产环境中输出完整的上下文信息
2. **限制解释级别**: 生产环境使用 `minimal` 或 `standard` 级别
3. **定期清理收集器**: 使用 `cleanup()` 方法定期清理过期条目
4. **监控收集器大小**: 监控收集器的条目数量，防止内存泄漏

### 6.7 监控建议

```typescript
// 定期获取统计信息
setInterval(() => {
  const stats = collector.getStats();
  console.log('权限检查统计:', stats);
  
  // 发送到监控系统
  metrics.gauge('mtpc.explanations.total', stats.total);
  metrics.gauge('mtpc.explanations.allowed', stats.allowed);
  metrics.gauge('mtpc.explanations.denied', stats.denied);
  metrics.gauge('mtpc.explanations.averageDuration', stats.averageDuration);
}, 60000);  // 每分钟
```

## 7. 常见问题解答

### 7.1 Q: 解释结果中的 `evaluationPath` 是什么？

A: `evaluationPath` 是权限评估的路径记录，显示了权限决策的评估步骤。例如，`['permission-check', 'policy-evaluation']` 表示先检查了直接权限，然后进行了策略评估。

### 7.2 Q: 如何获取更详细的策略评估信息？

A: 可以通过设置 `includePolicies: true` 和 `level: 'detailed'` 来获取完整的策略评估信息，包括每个策略的评估结果和匹配情况。

### 7.3 Q: 解释功能会影响性能吗？

A: 是的，详细的解释功能会增加权限评估的开销。建议在生产环境中使用 `standard` 或 `minimal` 级别，并仅在需要时包含策略评估结果。

### 7.4 Q: 如何自定义解释结果的格式？

A: 可以使用 `TextFormatter`、`JSONFormatter` 和 `MarkdownFormatter` 类来自定义解释结果的格式，或者直接处理 `PermissionExplanation` 对象来生成自定义格式。

### 7.5 Q: 解释功能支持哪些权限模型？

A: `@mtpc/explain` 是基于 MTPC Core 构建的，可以支持任何基于 MTPC Core 的权限模型，包括 RBAC、ABAC、ACL 等。

### 7.6 Q: 如何在多租户环境中使用解释功能？

A: 解释功能天然支持多租户，每个解释请求都需要提供租户上下文，解释结果会严格隔离在租户范围内。

### 7.7 Q: 插件和解释器有什么区别？

A:
- **插件** (`createExplainPlugin`)：用于自动收集权限检查结果，通过全局钩子实现，不影响权限判定
- **解释器** (`PermissionExplainer`)：用于显式解释权限决策，需要访问 `policyEngine` 和 `permissionResolver`

### 7.8 Q: 如何获取 MTPC 实例的 `permissionResolver`？

A: 使用 `mtpc.getPermissionResolver()` 方法。如果返回 `undefined`，说明 MTPC 实例没有设置权限解析器，需要使用 `mtpc.setPermissionResolver()` 方法设置。

**设置权限解析器的方式**：
```typescript
// 方式1：在创建 MTPC 实例时设置
const mtpc = createMTPC({
  defaultPermissionResolver: async (tenantId, subjectId) => {
    return new Set(['user:read', 'user:create']);
  }
});

// 方式2：使用 setPermissionResolver 方法设置
const mtpc = createMTPC();
mtpc.setPermissionResolver(async (tenantId, subjectId) => {
  return new Set(['user:read', 'user:create']);
});
```

**注意事项**：
- `createExplainerFromMTPC()` 函数会检查 `permissionResolver` 是否存在
- 如果不存在，会抛出错误：`MTPC instance does not have a permissionResolver. Please set one using setPermissionResolver() or provide it in the constructor.`
- 建议在创建 MTPC 实例时设置 `defaultPermissionResolver`

### 7.9 Q: `explainSubject` 方法的 `source` 字段是什么？

A: `source` 字段表示权限的来源。当前版本中 `source` 字段固定为 `'resolved'`，表示权限是通过权限解析器获取的。当前版本无法追踪权限的实际来源（如角色、策略等）。

**示例**:
```javascript
{
  sources: [
    { permission: 'user:read', source: 'resolved' },
    { permission: 'user:create', source: 'resolved' }
  ]
}
```

### 7.10 Q: 如何清理收集器中的过期条目？

A: 使用 `collector.cleanup()` 方法清理过期条目。该方法会删除超过 `ttl` 的条目，并返回清理的条目数量。

**示例**:
```typescript
const cleaned = collector.cleanup();
console.log('清理了', cleaned, '个过期条目');
```

## 8. 性能优化建议

1. **缓存解释结果**：对于频繁请求的相同权限解释，可以考虑缓存结果
2. **使用合适的解释级别**：根据实际需求选择解释级别，避免不必要的详细信息
   - 生产环境：使用 `minimal` 或 `standard`
   - 开发环境：使用 `detailed` 或 `debug`
3. **批量解释**：对于多个权限解释请求，使用批量解释 API 可以减少网络开销和处理时间
   - 注意：当前版本 `explainBulk()` 是串行执行的，未来版本可能会优化为并行执行
4. **异步处理**：解释功能支持异步调用，可以在后台处理，不影响主业务流程
5. **合理设置超时**：对于可能耗时的解释请求，设置合理的超时时间
6. **限制策略数量**：减少不必要的策略可以显著提升性能
7. **设置合理的收集器大小**：根据实际需求调整 `maxEntries` 和 `ttl`
8. **使用 onCollect 回调**：将审计日志发送到外部系统时，使用异步方式避免阻塞主流程

**性能指标参考**：

| 操作 | 预期耗时 | 备注 |
|------|----------|------|
| `explain()` (minimal) | < 1ms | 最小开销 |
| `explain()` (standard) | < 5ms | 中等开销 |
| `explain()` (detailed) | < 20ms | 包含策略评估 |
| `explainBulk()` (10个权限) | < 50ms | 串行执行 |
| `collector.getStats()` | < 1ms | 快速统计 |
| `collector.cleanup()` | < 10ms | 取决于条目数量 |
| `formatter.format()` | < 1ms | 文本格式化 |
| `formatter.formatBulk()` | < 5ms | 批量格式化 |

## 9. 附录

### A. 类型定义速查表

| 类型 | 说明 |
|------|------|
| `ExplainLevel` | 解释级别：`'minimal'` | `'standard'` | `'detailed'` | `'debug'` |
| `DecisionType` | 决策类型：`'allow'` | `'deny'` | `'not_applicable'` |
| `PermissionExplanation` | 权限解释结果 |
| `ExplanationContext` | 解释上下文 |
| `ExplainOptions` | 解释选项 |
| `BulkExplainRequest` | 批量解释请求 |
| `BulkExplainResult` | 批量解释结果 |
| `ExplanationEntry` | 解释条目 |
| `ExplanationFormatter` | 解释格式化器接口 |
| `ExplainPluginOptions` | 插件配置选项 |
| `ExplainPluginState` | 插件状态 |
| `CollectorOptions` | 收集器配置选项 |
| `TextFormatterOptions` | 文本格式化器配置选项 |
| `JSONFormatterOptions` | JSON 格式化器配置选项 |

### B. API 速查表

| API | 说明 |
|-----|------|
| `createExplainPlugin()` | 创建 Explain 插件 |
| `createExplainerFromMTPC()` | 从 MTPC 实例创建权限解释器 |
| `createExplainer()` | 直接创建权限解释器 |
| `createCollector()` | 创建解释收集器 |
| `createTextFormatter()` | 创建文本格式化器 |
| `createJSONFormatter()` | 创建 JSON 格式化器 |
| `createMarkdownFormatter()` | 创建 Markdown 格式化器 |
| `PermissionExplainer.explain()` | 解释单个权限决策 |
| `PermissionExplainer.explainBulk()` | 批量解释多个权限决策 |
| `PermissionExplainer.explainSubject()` | 解释主体的角色和权限来源 |
| `ExplanationCollector.collect()` | 收集单个权限解释 |
| `ExplanationCollector.collectBulk()` | 收集批量权限解释结果 |
| `ExplanationCollector.getRecent()` | 获取最近的解释条目 |
| `ExplanationCollector.getByTenant()` | 按租户ID过滤 |
| `ExplanationCollector.getBySubject()` | 按主体ID过滤 |
| `ExplanationCollector.getByPermission()` | 按权限代码过滤 |
| `ExplanationCollector.getByDecision()` | 按决策类型过滤 |
| `ExplanationCollector.getDenied()` | 获取所有被拒绝的条目 |
| `ExplanationCollector.getStats()` | 获取统计信息 |
| `ExplanationCollector.cleanup()` | 清理过期条目 |
| `ExplanationCollector.clear()` | 清空所有条目 |
| `ExplanationCollector.export()` | 导出所有条目 |
| `TextFormatter.format()` | 格式化为文本 |
| `TextFormatter.formatBulk()` | 格式化批量结果为文本 |
| `JSONFormatter.format()` | 格式化为 JSON |
| `JSONFormatter.formatBulk()` | 格式化批量结果为 JSON |
| `MarkdownFormatter.format()` | 格式化为 Markdown |
| `MarkdownFormatter.formatBulk()` | 格式化批量结果为 Markdown |

## 10. 版本更新日志

### v0.2.0 (当前版本)

- ✅ 修复了 PluginContext 接口不匹配的问题
- ✅ 移除了对不存在的 `policyEngine` 和 `permissionResolver` 的依赖
- ✅ 实现了通过全局钩子的自动收集功能
- ✅ 添加了 `createExplainerFromMTPC` 便捷函数
- ✅ 更新了插件架构，符合 MTPC 扩展原则

### v0.1.0 (2024-01-01)

- 初始版本发布
- 支持单个权限解释
- 支持批量权限解释
- 支持主体权限来源解释
- 支持自定义解释级别
- 提供解释结果格式化功能

## 10. 贡献指南

欢迎为 `@mtpc/explain` 包贡献代码或提出改进建议。请遵循以下准则：

1. 提交 Issues 描述问题或建议
2. 提交 Pull Requests 前确保所有测试通过
3. 遵循项目的代码风格和命名规范
4. 提供完整的测试用例
5. 更新相关文档

## 11. 许可证

`@mtpc/explain` 包采用 MIT 许可证，详见 LICENSE 文件。

## 12. 联系方式

- 项目仓库：https://github.com/your-org/mtpc
- 问题反馈：https://github.com/your-org/mtpc/issues
- 文档地址：https://docs.mtpc.io

---

通过本指南，您应该已经掌握了 `@mtpc/explain` 包的核心功能和使用方法。如果您有任何问题或建议，欢迎随时反馈。
