# Hono RPC 类型安全通信指南

## 当前实现说明

由于后端存在预构建错误（Core 包类型不兼容），前端采用**源码类型引用**方案：

| 文件 | 作用 |
|------|------|
| `src/api/app-types.d.ts` | 从后端源码导入 App 类型，无需后端构建 |
| `src/api/rpc-client.ts` | 使用 `hc` 函数创建类型安全的 RPC 客户端 |

## 架构流程

```
后端 (example-api)              前端 (example-web)
┌─────────────────────┐          ┌──────────────────────┐
│  src/app.ts         │          │  src/api/           │
│  ┌───────────────┐  │          │  ┌────────────────┐  │
│  │ export const │  │          │  │ import type   │  │
│  │   app = ...  │  │          │  │   AppType     │  │
│  └───────────────┘  │          │  └────────────────┘  │
│  export type       │          └──────────┬───────────┘
│  AppType = typeof │      ┌──────────────┴───────────┐
│      app;          │      │                         │
└─────────────────────┘      │   rpc-client.ts        │
                             │  ┌─────────────────────┐ │
        ↑ TS 类型推导         │  │ const rpc = hc<...> │ │
        (无需构建)            │  └─────────────────────┘ │
                             └───────────────────────────┘
```

## 核心优势

| 优势 | 说明 |
|------|------|
| **类型安全** | 前端调用 API 时，编译时检查类型 |
| **自动补全** | IDE 自动提示所有可用的 API 端点 |
| **无需构建** | 后端无需成功构建即可推导类型 |
| **自动同步** | 后端路由修改，前端类型自动更新 |

## 类型推导原理

TypeScript 可以直接从 `.ts` 源码文件导入类型，不需要 `.d.ts` 声明文件：

```typescript
// apps/example-web/src/api/app-types.d.ts
import type { App as BackendApp } from '../../../example-api/src/app.js';
export type AppType = BackendApp;

// TypeScript 编译器会：
// 1. 读取后端 app.ts 源码
// 2. 解析 Hono 路由定义
// 3. 推导出完整的 App 类型
// 4. 提供给 hc 函数使用
```

## 使用示例

### 1. 前端导入类型

```typescript
// apps/example-web/src/api/app-types.d.ts
import type { App as BackendApp } from '../../../example-api/src/app.js';
export type AppType = BackendApp;
```

### 2. 创建 RPC 客户端

```typescript
// apps/example-web/src/api/rpc-client.ts
import { hc } from 'hono/client';
import type { AppType } from './app-types.js';

export const rpc = hc<AppType>('http://localhost:3000', {
  headers: { 'Content-Type': 'application/json' },
});

export function createAuthClient(userId: string, tenantId = 'default') {
  return hc<AppType>('http://localhost:3000', {
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
      'x-user-id': userId,
    },
  });
}
```

### 3. 使用 RPC 客户端

```typescript
import { rpc } from './api/rpc-client';

// GET 请求（无参数）
const response1 = await rpc.api.products.$get();

// GET 请求（带查询参数）
const response2 = await rpc.api.products.$get({
  query: { page: '1', pageSize: '20' }
});

// POST 请求
const response3 = await rpc.api.products.$post({
  json: { name: 'New Product', price: 99.99 }
});

// 路径参数（Hono 特殊语法）
const response4 = await rpc.api.products[':id'].$get({
  param: { id: 'product-123' }
});

// PUT 请求
const response5 = await rpc.api.products[':id'].$put({
  param: { id: 'product-123' },
  json: { name: 'Updated Product' }
});

// DELETE 请求
const response6 = await rpc.api.products[':id'].$delete({
  param: { id: 'product-123' }
});
```

### 4. 带认证的请求

```typescript
// apps/example-web/src/main.tsx
import { createAuthClient } from './api/rpc-client';

const createPermissionFetcher = (userId: string) => {
  return async () => {
    const client = createAuthClient(userId, 'default');
    const response = await client.api.permissions.$get();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      permissions: data.data?.permissions || [],
      roles: data.data?.roles || [],
    };
  };
};
```

## 后端路由结构参考

```typescript
// apps/example-api/src/app.ts
export const app = new Hono();

// 路由结构：
app.get('/health', ...)
app.get('/api/metadata', ...)
app.get('/api/permissions', ...)
app.route('/api', apiRoutes);  // 包含 products, orders, customers, roles
```

## 错误处理

```typescript
const response = await rpc.api.products.$get();

if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}

const data = await response.json();

if (!data.success) {
  throw new Error(data.error?.message || '请求失败');
}
```

## 相关文件

- `apps/example-api/src/app.ts` - 后端路由定义
- `apps/example-web/src/api/app-types.d.ts` - 类型导入（从后端源码）
- `apps/example-web/src/api/rpc-client.ts` - RPC 客户端
- `apps/example-web/src/main.tsx` - RPC 使用示例
- `apps/example-web/src/api/verify-types.ts` - 类型验证测试
