# @mtpc/adapter-react

## 包功能介绍

`@mtpc/adapter-react` 是 MTPC（Multi-Tenant Permission Core）的 React 适配器，提供了一套完整的 React 组件和钩子，用于在 React 应用中集成 MTPC 权限系统。

### 核心功能

- **权限上下文管理**：通过 `PermissionProvider` 组件在 React 应用中提供全局权限状态
- **条件渲染组件**：`Can`、`Cannot` 和 `PermissionGuard` 组件，根据权限动态渲染内容
- **权限检查钩子**：`usePermission`、`usePermissions` 等钩子，用于在组件中检查权限
- **权限获取器**：支持从远程 API 获取权限数据
- **通配符支持**：支持 `*`、`resource:*` 和 `*:action` 等通配符模式

## 与 MTPC Core 包的关联

`@mtpc/adapter-react` 是 MTPC Core 包的 React 适配器，它基于 MTPC Core 的核心概念和架构设计，提供了 React 应用特有的集成方式。主要关联点：

1. **继承了 MTPC Core 的权限模型**：使用相同的权限代码格式（如 `resource:action`）
2. **遵循 MTPC Core 的设计原则**：业务无关、可扩展、默认拒绝等
3. **集成了 MTPC Core 的核心功能**：权限检查、策略评估等
4. **提供了 React 特有的集成方式**：组件、钩子等

## 环境配置

### 安装依赖

```bash
pnpm add @mtpc/adapter-react @mtpc/core
```

### 基本配置

```typescript
import { createMTPC } from '@mtpc/core';
import { PermissionProvider } from '@mtpc/adapter-react';

// 创建 MTPC 实例
const mtpc = createMTPC({
  // MTPC Core 配置
});

// 在应用入口使用 PermissionProvider
function App() {
  return (
    <PermissionProvider
      initialPermissions={[]} // 初始权限
      initialRoles={[]} // 初始角色
      tenantId="tenant-123" // 租户 ID
      subjectId="user-123" // 主体 ID
      // 可选：权限获取器，用于从远程加载权限
      fetcher={async () => {
        // 从 API 获取权限
        const response = await fetch('/api/permissions');
        const data = await response.json();
        return {
          permissions: data.permissions,
          roles: data.roles
        };
      }}
    >
      {/* 应用内容 */}
    </PermissionProvider>
  );
}
```

## 核心 API 说明

### 1. PermissionProvider 组件

提供权限上下文的 React 组件，是使用其他 API 的基础。

#### 属性

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| children | ReactNode | - | 子组件 |
| initialPermissions | string[] | [] | 初始权限列表 |
| initialRoles | string[] | [] | 初始角色列表 |
| tenantId | string | undefined | 租户 ID |
| subjectId | string | undefined | 主体 ID |
| fetcher | () => Promise<{ permissions: string[]; roles?: string[] }> | undefined | 权限获取器，用于从远程加载权限 |
| autoFetch | boolean | true | 是否自动加载权限 |

### 2. Can 组件

根据权限条件渲染子组件。

#### 属性

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| permission | string | undefined | 单个权限代码 |
| permissions | string[] | undefined | 权限代码数组 |
| mode | 'any' \| 'all' | 'all' | 匹配模式，'any' 表示任意一个权限匹配即可，'all' 表示所有权限都必须匹配 |
| not | boolean | false | 是否取反，true 表示权限不允许时渲染 |
| fallback | ReactNode \| (() => any) | undefined | 权限不允许时的回退内容 |
| children | ReactNode \| ((allowed: boolean) => ReactNode) | - | 权限允许时渲染的内容 |

### 3. Cannot 组件

`Can` 组件的相反版本，仅当权限不允许时渲染子组件。

#### 属性

同 `Can` 组件，但没有 `not` 属性。

### 4. PermissionGuard 组件

控制部分区域访问权限的包装组件，与 `Can` 组件类似，但提供了更清晰的命名和默认回退值。

#### 属性

同 `Can` 组件。

### 5. usePermission 钩子

检查单个或多个权限的钩子。

#### 参数

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| permission | string | undefined | 单个权限代码 |
| permissions | string[] | undefined | 权限代码数组 |
| mode | 'any' \| 'all' | 'all' | 匹配模式 |
| options | { throwOnDenied?: boolean } | {} | 配置选项，`throwOnDenied` 表示权限被拒绝时是否抛出错误 |

#### 返回值

| 属性 | 类型 | 描述 |
|------|------|------|
| allowed | boolean | 是否允许访问 |
| missing | string[] | 缺失的权限列表 |
| granted | string[] | 已授予的权限列表 |

### 6. usePermissions 钩子

获取所有权限和角色的钩子。

#### 返回值

| 属性 | 类型 | 描述 |
|------|------|------|
| permissions | string[] | 权限列表 |
| roles | string[] | 角色列表 |
| loading | boolean | 权限加载状态 |
| error | string \| undefined | 权限加载错误信息 |
| lastUpdated | Date \| undefined | 权限最后更新时间 |
| refresh | () => Promise<void> | 刷新权限的方法 |

### 7. useCan 钩子

检查单个权限的简写钩子。

#### 参数

| 参数 | 类型 | 描述 |
|------|------|------|
| permission | string | 权限代码 |

#### 返回值

| 类型 | 描述 |
|------|------|
| boolean | 是否允许该权限 |

### 8. useCanAny 钩子

检查是否允许任意一个权限的简写钩子。

#### 参数

| 参数 | 类型 | 描述 |
|------|------|------|
| permissions | string[] | 权限代码数组 |

#### 返回值

| 类型 | 描述 |
|------|------|
| boolean | 是否允许任意一个权限 |

### 9. useCanAll 钩子

检查是否允许所有权限的简写钩子。

#### 参数

| 参数 | 类型 | 描述 |
|------|------|------|
| permissions | string[] | 权限代码数组 |

#### 返回值

| 类型 | 描述 |
|------|------|
| boolean | 是否允许所有权限 |

### 10. useRoles 钩子

获取当前角色的钩子。

#### 返回值

| 类型 | 描述 |
|------|------|
| string[] | 角色列表 |

### 11. useHasRole 钩子

检查用户是否具有特定角色的钩子。

#### 参数

| 参数 | 类型 | 描述 |
|------|------|------|
| role | string | 角色名称 |

#### 返回值

| 类型 | 描述 |
|------|------|
| boolean | 是否具有该角色 |

### 12. useAnyRole 钩子

检查用户是否具有任意一个指定角色的钩子。

#### 参数

| 参数 | 类型 | 描述 |
|------|------|------|
| roles | string[] | 角色名称数组 |

#### 返回值

| 类型 | 描述 |
|------|------|
| boolean | 是否具有任意一个指定角色 |

### 13. useAllRoles 钩子

检查用户是否具有所有指定角色的钩子。

#### 参数

| 参数 | 类型 | 描述 |
|------|------|------|
| roles | string[] | 角色名称数组 |

#### 返回值

| 类型 | 描述 |
|------|------|
| boolean | 是否具有所有指定角色 |

### 14. createApiPermissionFetcher 函数

从通用 API 配置构建简单的权限获取器。

#### 参数

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| options | ApiFetcherOptions | - | API 获取器配置 |

#### ApiFetcherOptions 类型

| 属性 | 类型 | 描述 |
|------|------|------|
| baseUrl | string | API 的基础 URL，例如 "/api" |
| path | string | '/permissions' | 权限端点路径，例如 "/permissions" |
| headers | Record<string, string> | {} | 请求中包含的可选头信息 |
| extractor | (response: unknown) => { permissions: string[]; roles?: string[] } | undefined | 提取器函数，用于将响应解析为指定格式 |

#### 返回值

| 类型 | 描述 |
|------|------|
| () => Promise<{ permissions: string[]; roles?: string[] }> | 权限获取器函数 |

## 使用示例代码

### 1. 基本使用

```typescript
import { PermissionProvider, Can, usePermission } from '@mtpc/adapter-react';

// 应用入口
function App() {
  return (
    <PermissionProvider
      initialPermissions={['user:read', 'user:update']}
      initialRoles={['user']}
      tenantId="tenant-123"
      subjectId="user-123"
    >
      <div>
        <h1>应用标题</h1>
        <UserProfile />
      </div>
    </PermissionProvider>
  );
}

// 使用 Can 组件
function UserProfile() {
  return (
    <div>
      <h2>用户资料</h2>
      
      {/* 只有具有 user:read 权限的用户才能看到用户信息 */}
      <Can permission="user:read">
        <div>
          <p>用户名: John Doe</p>
          <p>邮箱: john@example.com</p>
        </div>
      </Can>
      
      {/* 只有具有 user:update 权限的用户才能看到编辑按钮 */}
      <Can permission="user:update">
        <button>编辑资料</button>
      </Can>
      
      {/* 只有不具有 user:delete 权限的用户才能看到请求删除权限的按钮 */}
      <Cannot permission="user:delete">
        <button>请求删除权限</button>
      </Cannot>
      
      {/* 使用 PermissionGuard 组件 */}
      <PermissionGuard
        permission="user:admin"
        fallback={<p>您不是管理员</p>}
      >
        <div>
          <h3>管理员面板</h3>
          <p>只有管理员才能看到此内容</p>
        </div>
      </PermissionGuard>
    </div>
  );
}

// 使用钩子
function EditButton() {
  const { allowed, missing } = usePermission('user:update');
  
  if (!allowed) {
    return <p>您缺少权限: {missing.join(', ')}</p>;
  }
  
  return <button>编辑资料</button>;
}
```

### 2. 使用多个权限

```typescript
import { Can, usePermission } from '@mtpc/adapter-react';

// 使用 Can 组件检查多个权限
function AdminActions() {
  return (
    <Can permissions={['user:create', 'user:delete']} mode="any">
      <div>
        <h3>管理操作</h3>
        <button>创建用户</button>
        <button>删除用户</button>
      </div>
    </Can>
  );
}

// 使用钩子检查多个权限
function AdminPanel() {
  const { allowed } = usePermission(undefined, ['user:admin', 'user:manager'], 'any');
  
  if (!allowed) {
    return <p>您没有访问权限</p>;
  }
  
  return <div>管理员面板内容</div>;
}
```

### 3. 使用权限获取器

```typescript
import { PermissionProvider } from '@mtpc/adapter-react';
import { createApiPermissionFetcher } from '@mtpc/adapter-react';

// 创建 API 权限获取器
const fetcher = createApiPermissionFetcher({
  baseUrl: '/api',
  path: '/permissions',
  headers: {
    'Authorization': 'Bearer token123'
  }
});

function App() {
  return (
    <PermissionProvider
      fetcher={fetcher}
      autoFetch={true} // 自动加载权限
    >
      <div>
        {/* 应用内容 */}
      </div>
    </PermissionProvider>
  );
}
```

### 4. 使用自定义提取器

```typescript
import { PermissionProvider } from '@mtpc/adapter-react';

function App() {
  return (
    <PermissionProvider
      fetcher={async () => {
        const response = await fetch('/api/permissions');
        const data = await response.json();
        
        // 自定义提取器逻辑
        return {
          permissions: data.user.permissions,
          roles: data.user.roles
        };
      }}
    >
      <div>
        {/* 应用内容 */}
      </div>
    </PermissionProvider>
  );
}
```

### 5. 刷新权限

```typescript
import { usePermissions } from '@mtpc/adapter-react';

function RefreshButton() {
  const { refresh, loading } = usePermissions();
  
  return (
    <button onClick={refresh} disabled={loading}>
      {loading ? '刷新中...' : '刷新权限'}
    </button>
  );
}
```

### 6. 使用通配符

```typescript
import { Can, usePermission } from '@mtpc/adapter-react';

// 使用 Can 组件
function ResourceActions() {
  return (
    <div>
      {/* 匹配所有资源的 read 操作 */}
      <Can permission="*:read">
        <button>查看所有资源</button>
      </Can>
      
      {/* 匹配 user 资源的所有操作 */}
      <Can permission="user:*">
        <div>
          <button>创建用户</button>
          <button>查看用户</button>
          <button>编辑用户</button>
          <button>删除用户</button>
        </div>
      </Can>
      
      {/* 匹配所有资源的所有操作 */}
      <Can permission="*">
        <button>管理员操作</button>
      </Can>
    </div>
  );
}

// 使用钩子
function AdminCheck() {
  const { allowed } = usePermission('*');
  
  return <div>{allowed ? '您是管理员' : '您不是管理员'}</div>;
}
```

### 7. 使用 throwOnDenied 选项

```typescript
import { usePermission } from '@mtpc/adapter-react';

// 权限被拒绝时抛出错误
function ProtectedComponent() {
  const { allowed } = usePermission('admin:dashboard', undefined, 'all', { throwOnDenied: true });
  
  return <div>管理员仪表板</div>;
}

// 在父组件中捕获错误
function ParentComponent() {
  try {
    return <ProtectedComponent />;
  } catch (error) {
    return <div>您没有权限访问此内容</div>;
  }
}
```

### 8. 使用角色检查

```typescript
import { useHasRole, useAnyRole, useAllRoles, useRoles } from '@mtpc/adapter-react';

// 检查单个角色
function AdminOnly() {
  const isAdmin = useHasRole('admin');
  
  return <div>{isAdmin ? '管理员内容' : '普通用户内容'}</div>;
}

// 检查任意一个角色
function ModeratorAccess() {
  const hasModeratorRole = useAnyRole(['moderator', 'admin']);
  
  return <div>{hasModeratorRole ? '可以访问' : '无权访问'}</div>;
}

// 检查所有角色
function SuperUser() {
  const isSuperUser = useAllRoles(['admin', 'superuser']);
  
  return <div>{isSuperUser ? '超级用户' : '普通用户'}</div>;
}

// 获取所有角色
function UserRoles() {
  const roles = useRoles();
  
  return <div>用户角色: {roles.join(', ')}</div>;
}
```

### 9. 动态权限评估

```typescript
import { usePermissionContext } from '@mtpc/adapter-react';

function DynamicCheck() {
  const { evaluate, can, canAny, canAll } = usePermissionContext();
  
  // 详细评估结果
  const result = evaluate(['user:read', 'user:write'], 'all');
  console.log('评估结果:', result);
  // { allowed: true, granted: ['user:read', 'user:write'], missing: [] }
  
  // 简单检查
  const canRead = can('user:read'); // true
  const canWrite = can('user:write'); // true
  
  // 批量检查
  const canAnyResult = canAny(['user:delete', 'user:archive']); // false
  const canAllResult = canAll(['user:read', 'user:write']); // true
  
  return <div>动态权限检查示例</div>;
}
```

## 常见问题解答

### 1. 如何处理权限加载状态？

可以使用 `usePermissions` 钩子获取 `loading` 状态，然后根据状态显示加载指示器：

```typescript
import { usePermissions } from '@mtpc/adapter-react';

function ProtectedContent() {
  const { permissions, loading, error } = usePermissions();
  
  if (loading) {
    return <div>加载权限中...</div>;
  }
  
  if (error) {
    return <div>加载权限失败: {error}</div>;
  }
  
  // 渲染受保护内容
  return <div>受保护内容</div>;
}
```

### 2. 如何在权限被拒绝时抛出错误？

可以使用 `usePermission` 钩子的 `throwOnDenied` 选项：

```typescript
import { usePermission } from '@mtpc/adapter-react';

function AdminOnly() {
  const { allowed } = usePermission('admin:*', undefined, 'all', { throwOnDenied: true });
  
  return <div>管理员内容</div>;
}

// 在父组件中捕获错误
function ParentComponent() {
  try {
    return <AdminOnly />;
  } catch (error) {
    return <div>您没有权限访问此内容</div>;
  }
}
```

### 3. 如何处理权限变化？

权限上下文会自动管理权限变化，当权限更新时，所有使用权限组件或钩子的组件都会自动重新渲染。

### 4. 如何与 React Router 集成？

可以使用 `Can` 组件或 `usePermission` 钩子结合 React Router 的路由守卫：

```typescript
import { Navigate, useLocation } from 'react-router-dom';
import { usePermission } from '@mtpc/adapter-react';

function ProtectedRoute({ children, requiredPermission }) {
  const { allowed } = usePermission(requiredPermission);
  const location = useLocation();
  
  if (!allowed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return children;
}

// 使用示例
<Route path="/admin" element={<ProtectedRoute requiredPermission="admin:*">AdminPanel</ProtectedRoute>} />
```

### 5. 如何实现条件渲染？

可以使用函数作为 `children` 来实现更复杂的条件渲染：

```typescript
import { Can } from '@mtpc/adapter-react';

function UserCard() {
  return (
    <Can permission="user:read">
      {(allowed) => (
        <div className={allowed ? 'full-access' : 'limited-access'}>
          {allowed ? '完整用户信息' : '受限用户信息'}
        </div>
      )}
    </Can>
  );
}
```

### 6. 如何处理权限获取错误？

```typescript
import { usePermissions } from '@mtpc/adapter-react';

function PermissionAwareComponent() {
  const { loading, error, refresh } = usePermissions();
  
  if (loading) {
    return <div>正在加载权限...</div>;
  }
  
  if (error) {
    return (
      <div>
        <p>加载权限失败: {error}</p>
        <button onClick={refresh}>重试</button>
      </div>
    );
  }
  
  return <div>权限加载成功</div>;
}
```

## 通配符匹配规则

adapter-react 支持以下通配符模式：

| 模式 | 描述 | 示例 |
|------|------|------|
| `*` | 匹配所有权限 | `can('*')` 返回 true 如果用户有任何权限 |
| `resource:*` | 匹配特定资源的所有操作 | `can('user:*')` 匹配 `user:read`、`user:write` 等 |
| `*:action` | 匹配所有资源的特定操作 | `can('*:read')` 匹配任何资源的 `read` 操作 |
| `resource:action` | 精确匹配 | `can('user:read')` 只匹配 `user:read` |

### 匹配示例

```typescript
const { can } = usePermissionContext();

// 假设用户权限为 ['user:read', 'user:write', 'order:*']

can('user:read');     // true - 精确匹配
can('user:write');    // true - 精确匹配
can('user:delete');   // false - 未授予
can('order:read');    // true - 匹配 order:*
can('order:delete');  // true - 匹配 order:*
can('product:read');  // false - 未授予
can('*');             // false - 全局通配符需要显式授予
```

## 性能优化

1. **使用 `useMemo` 缓存权限检查结果**：对于复杂的权限检查，可以使用 `useMemo` 缓存结果，避免不必要的重新计算
2. **避免在渲染过程中创建权限数组**：尽量使用常量或 `useMemo` 缓存权限数组，避免在每次渲染时创建新数组
3. **合理使用 `autoFetch` 选项**：对于权限不经常变化的应用，可以考虑关闭自动刷新，手动控制刷新时机
4. **使用 `PermissionGuard` 组件包裹大块内容**：对于需要权限控制的大块内容，使用 `PermissionGuard` 组件可以减少不必要的渲染
5. **使用简化的钩子**：对于简单的权限检查，使用 `useCan` 替代 `usePermission` 可以减少不必要的计算

## 最佳实践

1. **将 `PermissionProvider` 放在应用的顶层**：确保所有需要权限的组件都能访问到权限上下文
2. **使用有意义的权限代码**：权限代码应清晰反映资源和操作，如 `user:read`、`order:create` 等
3. **合理使用通配符**：通配符可以简化权限管理，但应谨慎使用，避免过度授权
4. **定期刷新权限**：对于权限经常变化的应用，应定期刷新权限，确保权限状态的准确性
5. **处理权限加载状态和错误**：在权限加载过程中显示加载指示器，在加载失败时显示友好的错误信息
6. **使用角色进行权限分组**：将相关权限组合成角色，便于管理和分配
7. **避免在深层组件中重复获取上下文**：通过组件组合传递必要的权限信息，而不是在每个组件中都调用 `usePermissionContext`

## 版本兼容性

| @mtpc/adapter-react 版本 | @mtpc/core 版本 | React 版本 |
|--------------------------|----------------|------------|
| ^1.0.0                   | ^1.0.0         | ^18.0.0    |

## 贡献指南

欢迎提交 Issue 和 Pull Request！请遵循以下准则：

1. 提交前确保所有测试通过
2. 遵循现有代码风格
3. 为新功能添加文档和示例
4. 编写单元测试
5. 提交清晰的 Commit 消息

## 许可证

MIT License

## 联系信息

- 项目地址：https://github.com/mtpc/core
- 文档地址：https://mtpc.io/docs
- 问题反馈：https://github.com/mtpc/core/issues
