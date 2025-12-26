# @mtpc/explain 使用指南

## 1. 包简介

`@mtpc/explain` 是 MTPC (Multi-Tenant Permission Core) 的权限决策解释扩展，用于解释权限决策结果，提供详细的决策原因和评估过程。

### 核心功能

- 解释单个权限决策结果
- 批量解释多个权限决策
- 解释主体的角色和权限来源
- 自定义解释级别和详细程度
- 支持包含策略评估详情
- 提供友好的解释结果格式化

### 适用场景

- 权限调试和问题排查
- 权限审计和合规性检查
- 管理员权限可视化界面
- 权限决策可解释性需求
- 开发阶段的权限测试

## 2. 安装指南

### 2.1 安装依赖

使用 pnpm 安装 `@mtpc/explain` 包：

```bash
pnpm add @mtpc/explain @mtpc/core
```

### 2.2 依赖要求

| 依赖包 | 版本要求 | 说明 |
|--------|----------|------|
| `@mtpc/core` | ^1.0.0 | MTPC 核心包，提供基础权限能力 |
| `@mtpc/shared` | ^1.0.0 | 共享工具函数库 |

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
| `defaultLevel` | `ExplainLevel` | 默认解释级别：`'minimal'` | `'standard'` | `'detailed'` | `'debug'` |
| `collectExplanations` | `boolean` | 是否自动收集权限解释结果 |
| `maxCollectedEntries` | `number` | 最大收集条目数，默认 1000 |

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

**注意**：MTPC 实例必须设置了 `permissionResolver`，否则会抛出错误。

### 4.3 PermissionExplainer 类

#### 构造函数

```typescript
new PermissionExplainer(policyEngine, permissionResolver, options?)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `policyEngine` | `PolicyEngine` | 策略引擎实例，用于评估策略 |
| `permissionResolver` | `(tenantId: string, subjectId: string) => Promise<Set<string>>` | 权限解析器，用于获取主体的权限 |
| `options` | `{ defaultLevel?: ExplainLevel }` | 可选配置，默认解释级别 |

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

### 4.4 解释选项 (ExplainOptions)

```typescript
interface ExplainOptions {
  level?: ExplainLevel; // 解释级别：'minimal' | 'standard' | 'detailed' | 'debug'
  includePolicies?: boolean; // 是否包含策略评估结果
  includeContext?: boolean; // 是否包含完整上下文信息
  includeConditions?: boolean; // 是否包含条件评估结果
  maxPolicies?: number; // 最大返回的策略数量
}
```

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

#### JSONFormatter

将权限解释结果格式化为 JSON 格式：

```typescript
import { JSONFormatter } from '@mtpc/explain';

const formatter = new JSONFormatter({ pretty: true });
const json = formatter.format(explanation);
console.log(json);
```

#### MarkdownFormatter

将权限解释结果格式化为 Markdown 格式：

```typescript
import { MarkdownFormatter } from '@mtpc/explain';

const formatter = new MarkdownFormatter();
const markdown = formatter.format(explanation);
console.log(markdown);
```

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
}
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

## 8. 性能优化建议

1. **缓存解释结果**：对于频繁请求的相同权限解释，可以考虑缓存结果
2. **使用合适的解释级别**：根据实际需求选择解释级别，避免不必要的详细信息
3. **批量解释**：对于多个权限解释请求，使用批量解释 API 可以减少网络开销和处理时间
4. **异步处理**：解释功能支持异步调用，可以在后台处理，不影响主业务流程
5. **合理设置超时**：对于可能耗时的解释请求，设置合理的超时时间

## 9. 版本更新日志

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
