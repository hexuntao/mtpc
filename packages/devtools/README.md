# @mtpc/devtools

MTPC（Multi-Tenant Permission Core）的开发和调试工具包，提供权限检查调试、权限矩阵构建和状态快照功能，帮助开发者理解和调试 MTPC 权限系统。

## 功能特性

- ✅ 权限检查调试 - 提供详细的权限检查结果和评估耗时
- ✅ 权限矩阵构建 - 将 MTPC 权限系统转换为可视化的矩阵格式
- ✅ 状态快照 - 捕获 MTPC 实例的当前状态，用于调试和分析
- ✅ 完善的 TypeScript 类型定义
- ✅ 易于集成到开发工具和调试界面

## 安装

```bash
pnpm add @mtpc/devtools
```

## 核心 API

### 调试功能

#### `debugPermissionCheck`

详细调试权限检查过程，返回结构化的权限检查结果。

```typescript
import { debugPermissionCheck } from '@mtpc/devtools';

const debugInfo = await debugPermissionCheck(
  mtpc, // MTPC 实例
  ctx, // MTPC 上下文
  'resource:action', // 权限编码
  'resource123' // 可选的资源标识符
);
```

返回结果：
```typescript
{
  permission: 'resource:action',
  resource: 'resource',
  action: 'action',
  allowed: true,
  reason: '允许访问',
  evaluationTime: 10 // 评估耗时（毫秒）
}
```

### 权限矩阵

#### `buildPermissionMatrix`

构建权限矩阵，用于可视化展示资源、操作和权限之间的关系。

```typescript
import { buildPermissionMatrix } from '@mtpc/devtools';

const matrix = buildPermissionMatrix(mtpc);
```

返回结果：
```typescript
[
  {
    resource: 'user',
    action: 'read',
    permission: 'user:read'
  },
  {
    resource: 'user',
    action: 'write',
    permission: 'user:write'
  }
  // 更多权限矩阵行...
]
```

### 状态快照

#### `createSnapshot`

创建 MTPC 实例的状态快照，包含资源、权限和策略的关键信息。

```typescript
import { createSnapshot } from '@mtpc/devtools';

const snapshot = createSnapshot(mtpc);
```

返回结果：
```typescript
{
  resources: [
    {
      name: 'user',
      displayName: '用户',
      group: 'system',
      actions: ['read', 'write'],
      permissions: ['user:read', 'user:write']
    }
    // 更多资源...
  ],
  permissions: ['user:read', 'user:write', 'role:assign', /* 更多权限... */],
  policies: [
    {
      id: 'policy1',
      name: '默认策略',
      priority: 'medium',
      enabled: true,
      tenantId: undefined,
      ruleCount: 5
    }
    // 更多策略...
  ]
}
```

## 类型定义

### `PermissionDebugInfo`

```typescript
interface PermissionDebugInfo {
  permission: string; // 完整的权限编码
  resource: string; // 资源名称
  action: string; // 操作类型
  allowed: boolean; // 是否允许访问
  reason?: string; // 决策原因
  evaluationTime?: number; // 评估耗时（毫秒）
}
```

### `PermissionMatrixRow`

```typescript
interface PermissionMatrixRow {
  resource: string; // 资源名称
  action: string; // 操作类型
  permission: string; // 完整的权限编码
}
```

### `MTPCSnapshot`

```typescript
interface MTPCSnapshot {
  resources: Array<{ // 资源列表
    name: string; // 资源名称
    displayName: string; // 资源显示名称
    group?: string; // 资源分组
    actions: string[]; // 支持的操作列表
    permissions: string[]; // 资源相关的权限编码列表
  }>;
  permissions: string[]; // 所有权限编码列表
  policies: Array<{ // 策略列表
    id: string; // 策略 ID
    name: string; // 策略名称
    priority: string; // 策略优先级
    enabled: boolean; // 是否启用
    tenantId?: string; // 租户 ID（可选）
    ruleCount: number; // 规则数量
  }>;
}
```

## 示例用法

### 1. 调试权限检查

```typescript
import { createMTPC } from '@mtpc/core';
import { debugPermissionCheck } from '@mtpc/devtools';

// 创建 MTPC 实例
const mtpc = createMTPC({
  // MTPC 配置
});

// 模拟 MTPC 上下文
const ctx = {
  tenant: { id: 'tenant123' },
  subject: { id: 'user123', type: 'user', roles: ['admin'] },
  request: { /* 请求信息 */ }
};

// 调试权限检查
const debugInfo = await debugPermissionCheck(mtpc, ctx, 'user:write', 'user456');

console.log('权限检查结果:', debugInfo);
// 输出：
// { permission: 'user:write', resource: 'user', action: 'write', allowed: true, reason: '允许访问', evaluationTime: 5 }
```

### 2. 构建权限矩阵

```typescript
import { createMTPC } from '@mtpc/core';
import { buildPermissionMatrix } from '@mtpc/devtools';

// 创建 MTPC 实例并注册资源和权限
const mtpc = createMTPC({
  // MTPC 配置
});

// 注册资源和权限
mtpc.registerResource({
  name: 'user',
  metadata: { displayName: '用户' },
  permissions: [
    { action: 'read', name: '读取用户' },
    { action: 'write', name: '写入用户' }
  ]
});

// 构建权限矩阵
const matrix = buildPermissionMatrix(mtpc);

console.log('权限矩阵:', matrix);
// 输出：
// [{ resource: 'user', action: 'read', permission: 'user:read' }, { resource: 'user', action: 'write', permission: 'user:write' }]
```

### 3. 创建状态快照

```typescript
import { createMTPC } from '@mtpc/core';
import { createSnapshot } from '@mtpc/devtools';

// 创建 MTPC 实例并配置
const mtpc = createMTPC({
  // MTPC 配置
});

// 注册资源、权限和策略
// ...

// 创建状态快照
const snapshot = createSnapshot(mtpc);

console.log('状态快照:', snapshot);
// 输出：
// { resources: [...], permissions: [...], policies: [...] }
```

## 开发工具集成

### 浏览器 DevTools

```typescript
// 在浏览器控制台中使用
window.mtpcDebug = {
  debugPermissionCheck: (permission, resourceId) => {
    return debugPermissionCheck(mtpc, currentContext, permission, resourceId);
  },
  buildPermissionMatrix: () => {
    return buildPermissionMatrix(mtpc);
  },
  createSnapshot: () => {
    return createSnapshot(mtpc);
  }
};
```

### VS Code 扩展

可以将 devtools 集成到 VS Code 扩展中，提供可视化的 MTPC 调试界面。

## 测试

```bash
# 运行测试（如果有）
pnpm test
```

## 构建

```bash
# 构建生产版本
pnpm build

# 构建并监听文件变化
pnpm dev
```

## 类型检查

```bash
pnpm typecheck
```

## 许可证

MIT
