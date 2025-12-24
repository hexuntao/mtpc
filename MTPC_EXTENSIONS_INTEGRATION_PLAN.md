# MTPC 扩展包完整集成开发计划

> 创建日期: 2025-12-24
> 状态: 待确认

---

## 一、项目概述

### 1.1 目标

将 MTPC 所有扩展包完整集成到 `example-api` 和 `example-web`，打造官方级别的完整示例应用，展示 MTPC 的全部能力。

### 1.2 涉及的扩展包

| 扩展包 | 用途 | 集成位置 |
|--------|------|----------|
| @mtpc/audit | 审计日志 | example-api |
| @mtpc/policy-cache | 权限缓存 | example-api |
| @mtpc/soft-delete | 软删除 | example-api |
| @mtpc/versioning | 乐观锁版本控制 | example-api |
| @mtpc/data-scope | 数据范围（行级安全） | example-api |
| @mtpc/adapter-react | React 适配器 | example-web |
| @mtpc/explain | 权限决策解释 | example-web |
| @mtpc/devtools | 开发调试工具 | 两者 |

---

## 二、example-api 集成方案

### 2.1 审计日志 (@mtpc/audit)

#### 集成位置
- `src/mtpc.ts` - 注册审计插件
- `src/db/audit-schema.ts` - 审计日志表结构
- `src/store/audit-store.ts` - 审计日志持久化

#### 实现内容

```typescript
// src/mtpc.ts
import { createAuditPlugin } from '@mtpc/audit';
import { DatabaseAuditStore } from './store/audit-store.js';

// 注册审计插件
mtpc.use(createAuditPlugin({
  store: new DatabaseAuditStore(db),
  // 记录所有权限检查
  logPermissionChecks: true,
  // 记录资源操作
  logResourceOperations: true,
  // 记录角色/策略变更
  logRolePolicyChanges: true,
  // 异步写入，不阻塞主流程
  async: true,
}));
```

#### 数据库表结构

```sql
-- mtpc_audit_logs 表
CREATE TABLE mtpc_audit_logs (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  category VARCHAR(50) NOT NULL,  -- permission_check | resource_operation | role_change | policy_change
  decision VARCHAR(20),            -- granted | denied
  subject_id VARCHAR(255),
  subject_type VARCHAR(50),
  resource_id VARCHAR(255),
  resource_type VARCHAR(100),
  action VARCHAR(100),
  permission VARCHAR(255),
  reason TEXT,
  metadata JSONB,
  INDEX idx_tenant_timestamp (tenant_id, timestamp),
  INDEX idx_subject (tenant_id, subject_type, subject_id)
);
```

#### API 端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/audit/logs` | GET | 查询审计日志（分页） |
| `/api/audit/logs/:id` | GET | 获取单条日志详情 |
| `/api/audit/export` | GET | 导出审计日志（CSV） |

---

### 2.2 权限缓存 (@mtpc/policy-cache)

#### 集成位置
- `src/mtpc.ts` - 注册缓存插件
- `src/cache/permissions-cache.ts` - 缓存配置

#### 实现内容

```typescript
// src/mtpc.ts
import { createPolicyCachePlugin } from '@mtpc/policy-cache';

// 注册权限缓存插件
mtpc.use(createPolicyCachePlugin({
  // LRU 缓存策略
  strategy: 'lru',
  // 最多缓存 1000 个用户的权限
  maxSize: 1000,
  // 权限缓存 5 分钟
  ttl: 5 * 60 * 1000,
  // 自动在写入操作后使缓存失效
  autoInvalidate: true,
}));
```

#### 缓存失效策略

| 操作 | 失效范围 |
|------|----------|
| 创建/更新/删除角色 | 该角色相关的所有用户 |
| 创建/删除角色绑定 | 绑定/解绑的用户 |
| 创建/更新策略 | 受影响权限的所有用户 |

#### 监控端点

```typescript
// 获取缓存统计
app.get('/api/cache/stats', (c) => {
  const stats = mtpc.plugins.getCacheStats();
  return c.json({ success: true, data: stats });
});
```

---

### 2.3 软删除 (@mtpc/soft-delete)

#### 集成位置
- `src/mtpc.ts` - 注册软删除插件
- `src/db/schema.ts` - 更新资源表结构

#### 实现内容

```typescript
// src/mtpc.ts
import { createSoftDeletePlugin } from '@mtpc/soft-delete';

// 为所有资源启用软删除
mtpc.use(createSoftDeletePlugin({
  resources: {
    product: {
      deletedAtField: 'deletedAt',
      deletedByField: 'deletedBy',
      autoFilter: true,  // 自动过滤已删除记录
    },
    order: {
      deletedAtField: 'deletedAt',
      deletedByField: 'deletedBy',
      autoFilter: true,
    },
    customer: {
      deletedAtField: 'deletedAt',
      deletedByField: 'deletedBy',
      autoFilter: true,
    },
  },
}));
```

#### 数据库表更新

```sql
-- 为资源表添加软删除字段
ALTER TABLE products ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE products ADD COLUMN deleted_by VARCHAR(255);
ALTER TABLE orders ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN deleted_by VARCHAR(255);
ALTER TABLE customers ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN deleted_by VARCHAR(255);
```

#### API 变更

| 端点 | 变更 |
|------|------|
| `DELETE /api/products/:id` | 软删除，返回 204 |
| `POST /api/products/:id/restore` | 恢复已删除项 |
| `GET /api/products?includeDeleted=true` | 包含已删除项 |

---

### 2.4 版本控制 (@mtpc/versioning)

#### 集成位置
- `src/mtpc.ts` - 注册版本控制插件
- `src/db/schema.ts` - 更新资源表结构

#### 实现内容

```typescript
// src/mtpc.ts
import { createVersioningPlugin } from '@mtpc/versioning';
import { VersionConflictError } from '@mtpc/versioning';

// 为所有资源启用乐观锁
mtpc.use(createVersioningPlugin({
  resources: {
    product: {
      versionField: 'version',
      onConflict: 'error',  // 冲突时返回错误
    },
    order: {
      versionField: 'version',
      onConflict: 'error',
    },
    customer: {
      versionField: 'version',
      onConflict: 'error',
    },
  },
}));
```

#### 数据库表更新

```sql
-- 为资源表添加版本字段
ALTER TABLE products ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE orders ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE customers ADD COLUMN version INTEGER DEFAULT 1;
```

#### 错误处理

```typescript
// src/routes/index.ts
import { VersionConflictError } from '@mtpc/versioning';

// 全局错误处理
app.onError(async (err, c) => {
  if (err instanceof VersionConflictError) {
    return c.json({
      success: false,
      error: 'VERSION_CONFLICT',
      message: '数据已被其他人修改，请刷新后重试',
      expected: err.expected,
      actual: err.actual,
    }, 409);
  }
  // ... 其他错误处理
});
```

#### API 变更

| 请求体变更 | 说明 |
|-----------|------|
| `PATCH /api/products/:id` | 需要携带 `version` 字段 |

```json
// 请求示例
{
  "name": "更新产品",
  "price": 199.99,
  "version": 5  // 当前版本号
}
```

---

### 2.5 数据范围 (@mtpc/data-scope)

#### 集成位置
- `src/mtpc.ts` - 注册数据范围插件
- `src/middleware/data-scope.ts` - 数据范围中间件

#### 实现内容

```typescript
// src/mtpc.ts
import { createDataScopePlugin } from '@mtpc/data-scope';

// 注册数据范围插件
mtpc.use(createDataScopePlugin({
  // 定义每个资源的数据范围
  resources: {
    product: {
      // 定义可用范围类型
      scopes: {
        all: '查看所有产品',
        tenant: '查看租户产品',
        own: '查看自己创建的产品',
      },
      // 默认范围
      default: 'tenant',
    },
    order: {
      scopes: {
        all: '查看所有订单',
        department: '查看部门订单',
        own: '查看自己的订单',
      },
      default: 'department',
    },
    customer: {
      scopes: {
        all: '查看所有客户',
        tenant: '查看租户客户',
        own: '查看自己的客户',
      },
      default: 'tenant',
    },
  },
  // 获取用户数据范围的函数
  resolveScope: async (tenantId, subjectType, subjectId, resourceType) => {
    // 从数据库或 RBAC 获取用户的数据范围
    const bindings = await rbac.getSubjectRoles(tenantId, subjectType, subjectId);
    // 根据角色返回对应范围
    if (bindings.some(b => b.roleId === 'admin')) return 'all';
    if (bindings.some(b => b.roleId === 'manager')) return 'department';
    return 'own';
  },
}));
```

#### 角色与范围映射

| 角色 | 产品 | 订单 | 客户 |
|------|------|------|------|
| admin | all | all | all |
| manager | tenant | department | tenant |
| viewer | tenant | own | tenant |
| sales_rep | tenant | own | tenant |

#### 中间件实现

```typescript
// src/middleware/data-scope.ts
import type { MiddlewareHandler } from 'hono';

export const dataScopeMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    if (userId) {
      // 设置当前用户的数据范围
      const scope = await mtpc.plugins.getDataScope(
        tenantId,
        'user',
        userId,
        c.req.param('resource') || 'product'
      );
      c.set('dataScope', scope);
    }

    await next();
  };
};
```

---

### 2.6 完整的 MTPC 初始化

```typescript
// src/mtpc.ts
import { createMTPC } from '@mtpc/core';
import { createRBAC, role } from '@mtpc/rbac';
import { createAuditPlugin } from '@mtpc/audit';
import { createPolicyCachePlugin } from '@mtpc/policy-cache';
import { createSoftDeletePlugin } from '@mtpc/soft-delete';
import { createVersioningPlugin } from '@mtpc/versioning';
import { createDataScopePlugin } from '@mtpc/data-scope';
import { DatabaseRBACStore } from './store/database-rbac-store.js';
import { DatabaseAuditStore } from './store/audit-store.js';
import { db } from './db/connection.js';

// 创建存储实例
const dbStore = new DatabaseRBACStore();
const auditStore = new DatabaseAuditStore(db);

// 创建 RBAC 实例
export const rbac = createRBAC({
  store: dbStore,
  cacheTTL: 5 * 60 * 1000,
});

// 创建 MTPC 实例
export const mtpc = createMTPC({
  defaultPermissionResolver: rbac.createPermissionResolver(),
});

// 注册所有插件
mtpc.use(createAuditPlugin({
  store: auditStore,
  logPermissionChecks: true,
  logResourceOperations: true,
  logRolePolicyChanges: true,
  async: true,
}));

mtpc.use(createPolicyCachePlugin({
  strategy: 'lru',
  maxSize: 1000,
  ttl: 5 * 60 * 1000,
  autoInvalidate: true,
}));

mtpc.use(createSoftDeletePlugin({
  resources: {
    product: { deletedAtField: 'deletedAt', deletedByField: 'deletedBy', autoFilter: true },
    order: { deletedAtField: 'deletedAt', deletedByField: 'deletedBy', autoFilter: true },
    customer: { deletedAtField: 'deletedAt', deletedByField: 'deletedBy', autoFilter: true },
  },
}));

mtpc.use(createVersioningPlugin({
  resources: {
    product: { versionField: 'version', onConflict: 'error' },
    order: { versionField: 'version', onConflict: 'error' },
    customer: { versionField: 'version', onConflict: 'error' },
  },
}));

mtpc.use(createDataScopePlugin({
  resources: {
    product: {
      scopes: { all: '所有产品', tenant: '租户产品', own: '自己创建' },
      default: 'tenant',
    },
    order: {
      scopes: { all: '所有订单', department: '部门订单', own: '自己订单' },
      default: 'department',
    },
    customer: {
      scopes: { all: '所有客户', tenant: '租户客户', own: '自己客户' },
      default: 'tenant',
    },
  },
  resolveScope: async (tenantId, subjectType, subjectId, resourceType) => {
    const bindings = await rbac.getSubjectRoles(tenantId, subjectType, subjectId);
    if (bindings.some(b => b.roleId === 'admin')) return 'all';
    if (bindings.some(b => b.roleId === 'manager')) return 'department';
    return 'own';
  },
}));

// 注册资源和角色
mtpc.registerResources(resources);
await registerSystemRoles();
await mtpc.init();

console.log('✅ MTPC 初始化完成');
console.log('✅ 已启用扩展: audit, policy-cache, soft-delete, versioning, data-scope');
```

---

## 三、example-web 集成方案

### 3.1 React 适配器 (@mtpc/adapter-react)

#### 集成位置
- `src/main.tsx` - 配置 PermissionProvider
- `src/hooks/usePermissions.ts` - 移除自定义 hook
- `src/components/` - 使用 Can/Cannot 组件

#### 实现内容

```typescript
// src/main.tsx
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { PermissionProvider } from '@mtpc/adapter-react';
import App from './App';
import { apiClient } from './lib/api-client';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PermissionProvider
      permissionClient={{
        // 获取用户权限
        getPermissions: async () => {
          const response = await apiClient.get('/api/permissions');
          return response.data.permissions;
        },
        // 刷新权限
        refreshPermissions: async () => {
          const response = await apiClient.get('/api/permissions');
          return response.data.permissions;
        },
        // 检查单个权限
        can: (permission: string) => {
          // 使用本地缓存的权限检查
          const state = (window as any).__mtpc_permissions__;
          return state?.permissions?.includes(permission) ?? false;
        },
        // 检查多个权限
        canAny: (permissions: string[]) => {
          const state = (window as any).__mtpc_permissions__;
          const userPerms = new Set(state?.permissions ?? []);
          return permissions.some(p => userPerms.has(p));
        },
      }}
      options={{
        // 权限缓存时间（毫秒）
        cacheTTL: 5 * 60 * 1000,
        // 自动刷新间隔
        refreshInterval: 2 * 60 * 1000,
        // 开发模式启用调试
        debug: import.meta.env.DEV,
      }}
    >
      <App />
    </PermissionProvider>
  </StrictMode>
);
```

#### 组件使用示例

```typescript
// src/components/ProductList.tsx
import { Can, Cannot } from '@mtpc/adapter-react';
import { Button } from './ui/Button';

export function ProductList({ products }: { products: Product[] }) {
  return (
    <div className="product-list">
      {/* 创建按钮 - 仅在有权限时显示 */}
      <Can permission="product.create">
        <Button onClick={() => setShowCreateModal(true)}>
          创建产品
        </Button>
      </Can>

      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>价格</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>{product.price}</td>
              <td>
                {/* 编辑按钮 */}
                <Can permission="product.update">
                  <Button
                    size="sm"
                    onClick={() => handleEdit(product)}
                  >
                    编辑
                  </Button>
                </Can>

                {/* 删除按钮 */}
                <Can permission="product.delete">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(product.id)}
                  >
                    删除
                  </Button>
                </Can>

                {/* 无权限提示 */}
                <Cannot permission="product.update" permission="product.delete">
                  <span className="text-gray-400">无操作权限</span>
                </Cannot>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

#### Hooks 使用示例

```typescript
// src/components/RoleMatrix.tsx
import { usePermissions, useCan, useCanAll, useRoles } from '@mtpc/adapter-react';

export function RoleMatrix() {
  const { permissions, loading, refresh } = usePermissions();
  const canCreateProduct = useCan('product.create');
  const canManageOrders = useCanAll(['order.create', 'order.update', 'order.delete']);
  const { roles } = useRoles();

  if (loading) return <div>加载中...</div>;

  return (
    <div className="role-matrix">
      <h3>当前用户信息</h3>
      <p>角色: {roles.join(', ')}</p>
      <p>权限数量: {permissions.size}</p>

      {canCreateProduct && (
        <button>创建产品</button>
      )}

      {canManageOrders && (
        <button>订单管理</button>
      )}

      <button onClick={refresh}>刷新权限</button>
    </div>
  );
}
```

---

### 3.2 权限解释 (@mtpc/explain)

#### 集成位置
- `src/components/PermissionDebugger.tsx` - 权限调试面板
- `src/pages/DebugPage.tsx` - 完整调试页面

#### 实现内容

```typescript
// src/components/PermissionDebugger.tsx
import { useState } from 'react';
import { useCan } from '@mtpc/adapter-react';
import { apiClient } from '../lib/api-client';

interface PermissionExplanation {
  permission: string;
  decision: 'granted' | 'denied';
  reason: string;
  matchedPolicy?: string;
  evaluationPath: string[];
}

export function PermissionDebugger() {
  const [permission, setPermission] = useState('product.create');
  const [explanation, setExplanation] = useState<PermissionExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const can = useCan(permission);

  const explainPermission = async () => {
    setLoading(true);
    try {
      const response = await apiClient.post('/api/explain', {
        permission,
        context: {
          userId: getCurrentUserId(),
          tenantId: 'default',
        },
      });
      setExplanation(response.data);
    } catch (error) {
      console.error('解释失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="permission-debugger">
      <h3>权限解释器</h3>

      <div className="input-group">
        <input
          type="text"
          value={permission}
          onChange={(e) => setPermission(e.target.value)}
          placeholder="输入权限码，如: product.create"
        />
        <button onClick={explainPermission} disabled={loading}>
          解释
        </button>
      </div>

      <div className="result">
        <div className={`decision ${can ? 'granted' : 'denied'}`}>
          {can ? '✅ 允许' : '❌ 拒绝'}
        </div>

        {explanation && (
          <div className="explanation">
            <p><strong>原因:</strong> {explanation.reason}</p>
            {explanation.matchedPolicy && (
              <p><strong>匹配策略:</strong> {explanation.matchedPolicy}</p>
            )}
            <div className="evaluation-path">
              <strong>评估路径:</strong>
              <ol>
                {explanation.evaluationPath.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

#### 后端 API 端点

```typescript
// src/routes/explain.ts
import { Hono } from 'hono';
import { explainPlugin } from '../lib/explain-plugin.js';

export const explainRoutes = new Hono();

explainRoutes.post('/', async (c) => {
  const { permission, context } = await c.req.json();

  // 使用 explain 插件解释权限决策
  const explanation = await explainPlugin.explain({
    permission,
    tenantId: context.tenantId,
    subjectType: 'user',
    subjectId: context.userId,
    resourceId: context.resourceId,
  });

  return c.json({ success: true, data: explanation });
});
```

---

### 3.3 开发工具 (@mtpc/devtools)

#### 集成位置
- `src/pages/DevToolsPage.tsx` - 开发工具页面
- `src/components/PermissionMatrix.tsx` - 权限矩阵可视化

#### 实现内容

```typescript
// src/pages/DevToolsPage.tsx
import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api-client';
import { buildPermissionMatrix, createSnapshot } from '@mtpc/devtools';

interface MTPCSnapshot {
  resources: Array<{ name: string; permissions: string[] }>;
  permissions: string[];
  policies: Array<{ id: string; name: string }>;
}

export function DevToolsPage() {
  const [snapshot, setSnapshot] = useState<MTPCSnapshot | null>(null);
  const [matrix, setMatrix] = useState<any>(null);

  useEffect(() => {
    loadDevToolsData();
  }, []);

  const loadDevToolsData = async () => {
    // 获取系统快照
    const snapshotRes = await apiClient.get('/api/devtools/snapshot');
    setSnapshot(snapshotRes.data);

    // 获取权限矩阵
    const matrixRes = await apiClient.get('/api/devtools/permission-matrix');
    setMatrix(matrixRes.data);
  };

  const exportSnapshot = () => {
    const data = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mtpc-snapshot-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="devtools-page">
      <h1>MTPC 开发工具</h1>

      <div className="section">
        <h2>系统快照</h2>
        <button onClick={exportSnapshot}>导出快照</button>
        {snapshot && (
          <div className="snapshot">
            <h3>资源 ({snapshot.resources.length})</h3>
            <ul>
              {snapshot.resources.map(r => (
                <li key={r.name}>
                  {r.name} - {r.permissions.length} 个权限
                </li>
              ))}
            </ul>
            <h3>总权限数: {snapshot.permissions.length}</h3>
          </div>
        )}
      </div>

      <div className="section">
        <h2>权限矩阵</h2>
        {matrix && (
          <table className="permission-matrix">
            <thead>
              <tr>
                <th>角色 \ 资源</th>
                {matrix.resources.map((r: string) => (
                  <th key={r}>{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.roles.map((role: any) => (
                <tr key={role.name}>
                  <td>{role.name}</td>
                  {matrix.resources.map((resource: string) => (
                    <td key={`${role.name}-${resource}`}>
                      {matrix.data[role.name][resource] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

#### 后端 API 端点

```typescript
// src/routes/devtools.ts
import { Hono } from 'hono';
import { createSnapshot, buildPermissionMatrix } from '@mtpc/devtools';
import { mtpc, rbac } from '../mtpc.js';

export const devtoolsRoutes = new Hono();

// 获取系统快照
devtoolsRoutes.get('/snapshot', (c) => {
  const snapshot = createSnapshot(mtpc);
  return c.json({ success: true, data: snapshot });
});

// 获取权限矩阵
devtoolsRoutes.get('/permission-matrix', async (c) => {
  const tenantId = c.req.header('x-tenant-id') ?? 'default';
  const matrix = await buildPermissionMatrix(rbac, tenantId);
  return c.json({ success: true, data: matrix });
});

// 调试权限检查
devtoolsRoutes.post('/debug-permission', async (c) => {
  const { permission, userId, resourceId, action } = await c.req.json();
  const tenantId = c.req.header('x-tenant-id') ?? 'default';

  const result = await debugPermissionCheck(mtpc, {
    permission,
    tenantId,
    subjectType: 'user',
    subjectId: userId,
    resourceId,
    action,
  });

  return c.json({ success: true, data: result });
});
```

---

## 四、完整文件结构

### 4.1 example-api 新增/修改文件

```
apps/example-api/src/
├── mtpc.ts                          # 更新：集成所有插件
├── app.ts                           # 更新：添加新路由
├── routes/
│   ├── index.ts                     # 更新
│   ├── auth.ts                      # ✅ 已有
│   ├── audit.ts                     # 新增：审计日志端点
│   ├── explain.ts                   # 新增：权限解释端点
│   └── devtools.ts                  # 新增：开发工具端点
├── middleware/
│   ├── jwt-auth.ts                  # ✅ 已有
│   └── data-scope.ts                # 新增：数据范围中间件
├── db/
│   ├── connection.ts                # ✅ 已有
│   ├── rbac-schema.ts               # ✅ 已有
│   ├── audit-schema.ts              # 新增：审计日志表
│   └── schema.ts                    # 更新：添加软删除和版本字段
├── store/
│   ├── database-rbac-store.ts       # ✅ 已有
│   └── audit-store.ts               # 新增：审计日志存储
└── resources/
    └── index.ts                     # 更新：资源定义
```

### 4.2 example-web 新增/修改文件

```
apps/example-web/src/
├── main.tsx                         # 更新：配置 PermissionProvider
├── App.tsx                          # 更新：添加新路由
├── components/
│   ├── ui/                          # ✅ 已有
│   ├── forms/                       # ✅ 已有
│   ├── details/                     # ✅ 已有
│   ├── PermissionDebugger.tsx       # 新增：权限解释器
│   ├── PermissionMatrix.tsx         # 新增：权限矩阵可视化
│   └── ResourceView.tsx             # 更新：使用 Can/Cannot 组件
├── pages/
│   ├── DashboardPage.tsx            # 更新
│   ├── ProductsPage.tsx             # 更新
│   ├── OrdersPage.tsx               # 更新
│   ├── CustomersPage.tsx            # 更新
│   ├── AuditLogsPage.tsx            # 新增：审计日志查看
│   ├── DevToolsPage.tsx             # 新增：开发工具
│   └── DebugPage.tsx                # 新增：权限调试
├── hooks/
│   └── usePermissions.ts            # 删除：替换为 adapter-react
└── lib/
    └── api-client.ts                # 更新：添加新 API
```

---

## 五、实施计划

### 阶段一：后端扩展集成（example-api）

| 步骤 | 任务 | 预计内容 |
|------|------|----------|
| 1.1 | 审计日志 | 创建审计表、存储、API 端点 |
| 1.2 | 权限缓存 | 集成缓存插件，添加统计端点 |
| 1.3 | 软删除 | 更新表结构，添加恢复端点 |
| 1.4 | 版本控制 | 添加版本字段，错误处理 |
| 1.5 | 数据范围 | 实现范围解析和中间件 |
| 1.6 | 后端联调 | 确保所有扩展正常工作 |

### 阶段二：前端扩展集成（example-web）

| 步骤 | 任务 | 预计内容 |
|------|------|----------|
| 2.1 | React 适配器 | 配置 Provider，替换自定义 hook |
| 2.2 | 权限组件 | 使用 Can/Cannot 重构现有组件 |
| 2.3 | 权限解释 | 实现解释器 UI 和 API |
| 2.4 | 开发工具 | 实现快照、矩阵可视化 |
| 2.5 | 审计日志 | 实现日志查看和导出页面 |
| 2.6 | 前端联调 | 确保所有功能正常 |

### 阶段三：文档和测试

| 步骤 | 任务 | 预计内容 |
|------|------|----------|
| 3.1 | API 文档 | 补充所有新端点文档 |
| 3.2 | 示例代码 | 添加扩展使用示例 |
| 3.3 | README 更新 | 更新运行说明 |
| 3.4 | 演示脚本 | 准备完整功能演示 |

---

## 六、验收标准

### 6.1 后端验收

- [ ] 所有扩展插件成功加载（启动日志确认）
- [ ] 审计日志正确记录所有操作
- [ ] 权限缓存统计端点返回有效数据
- [ ] 软删除后数据仍可恢复
- [ ] 版本冲突正确返回 409 错误
- [ ] 数据范围正确过滤查询结果

### 6.2 前端验收

- [ ] PermissionProvider 正常工作
- [ ] Can/Cannot 组件正确控制 UI 显示
- [ ] 权限解释器返回清晰的决策原因
- [ ] 开发工具页面可导出快照和矩阵
- [ ] 审计日志页面可分页查看和导出

### 6.3 集成验收

- [ ] 前后端联调无错误
- [ ] 完整用户流程可走通
- [ ] 代码无 TypeScript 类型错误
- [ ] 所有示例代码可正常运行

---

## 七、注意事项

### 7.1 不修改 Core 包

所有 Core 包相关的问题（如类型不匹配）通过以下方式处理：
1. 在应用层做类型适配
2. 添加 TODO 注释标记问题位置
3. 记录在开发文档的已知问题中

### 7.2 数据库迁移

软删除和版本控制需要数据库迁移，确保：
1. 迁移脚本幂等可重复执行
2. 包含回滚方案
3. 添加执行日志

### 7.3 性能考虑

- 审计日志异步写入
- 权限缓存合理设置 TTL
- 数据范围查询添加索引

---

## 八、等待确认

请确认以下内容后开始实施：

1. ✅ 扩展包选择和范围
2. ✅ 集成方案和技术路径
3. ✅ 实施阶段划分
4. ✅ 验收标准定义

**确认后请回复 "确认，请进行"，开始实施开发计划。**
