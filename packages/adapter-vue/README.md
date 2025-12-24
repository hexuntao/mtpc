# @mtpc/adapter-vue

## 包功能介绍

`@mtpc/adapter-vue` 是 MTPC（Multi-Tenant Permission Core）的 Vue 3 适配器，提供了一套完整的 Vue 3 组件和组合式 API，用于在 Vue 3 应用中集成 MTPC 权限系统。

### 核心功能

- **权限上下文管理**：通过 `createPermissionContext` 和 `providePermissionContext` 函数在 Vue 应用中提供全局权限状态
- **条件渲染组件**：`Can` 和 `Cannot` 组件，根据权限动态渲染内容
- **组合式 API**：`usePermissions`、`usePermission` 等钩子，用于在组件中检查权限
- **权限获取器**：支持从远程 API 获取权限数据
- **通配符支持**：支持 `*`、`resource:*` 和 `*:action` 等通配符模式

## 与 MTPC Core 包的关联

`@mtpc/adapter-vue` 是 MTPC Core 包的 Vue 3 适配器，它基于 MTPC Core 的核心概念和架构设计，提供了 Vue 3 应用特有的集成方式。主要关联点：

1. **继承了 MTPC Core 的权限模型**：使用相同的权限代码格式（如 `resource:action`）
2. **遵循 MTPC Core 的设计原则**：业务无关、可扩展、默认拒绝等
3. **集成了 MTPC Core 的核心功能**：权限检查、策略评估等
4. **提供了 Vue 3 特有的集成方式**：组件、组合式 API 等

## 环境配置

### 安装依赖

```bash
pnpm add @mtpc/adapter-vue @mtpc/core
```

### 基本配置

```typescript
import { createMTPC } from '@mtpc/core';
import { createPermissionContext, providePermissionContext } from '@mtpc/adapter-vue';

// 创建 MTPC 实例
const mtpc = createMTPC({
  // MTPC Core 配置
});

// 在应用入口使用权限上下文
const app = createApp(App);

// 创建并提供权限上下文
const permissionContext = createPermissionContext({
  initialPermissions: [], // 初始权限
  initialRoles: [], // 初始角色
  tenantId: 'tenant-123', // 租户 ID
  subjectId: 'user-123', // 主体 ID
  // 可选：权限获取器，用于从远程加载权限
  fetcher: async () => {
    // 从 API 获取权限
    const response = await fetch('/api/permissions');
    const data = await response.json();
    return {
      permissions: data.permissions,
      roles: data.roles
    };
  }
});

// 提供权限上下文给所有组件
app.provide('permissionContext', permissionContext);

app.mount('#app');
```

## 核心 API 说明

### 1. 权限上下文管理

#### createPermissionContext

创建权限上下文值，用于管理和提供权限状态。

**参数**：
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| props | `PermissionProviderProps` | - | 权限提供者配置参数 |

**返回值**：`PermissionContextValue` - 权限上下文值

#### providePermissionContext

提供权限上下文给所有子组件。

**参数**：
| 参数 | 类型 | 描述 |
|------|------|------|
| ctx | `PermissionContextValue` | 权限上下文值 |

#### usePermissionContext

在组件中获取权限上下文。

**返回值**：`PermissionContextValue` - 权限上下文值

### 2. 组件

#### Can 组件

根据权限条件渲染子内容。

**属性**：
| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| permission | string | undefined | 单个权限代码 |
| permissions | string[] | undefined | 权限代码数组 |
| mode | 'any' | 'all' | 'all' | 匹配模式，'any' 表示任意一个权限匹配即可，'all' 表示所有权限都必须匹配 |
| not | boolean | false | 是否取反，true 表示权限不允许时渲染 |

#### Cannot 组件

`Can` 组件的相反版本，仅当权限不允许时渲染子内容。

**属性**：
同 `Can` 组件，但没有 `not` 属性。

### 3. 组合式 API

#### usePermissions

获取当前权限和角色的组合式 API。

**返回值**：
| 属性 | 类型 | 描述 |
|------|------|------|
| permissions | Ref<string[]> | 权限列表 |
| roles | Ref<string[]> | 角色列表 |
| loading | Ref<boolean> | 权限加载状态 |
| error | Ref<string | undefined> | 权限加载错误信息 |
| lastUpdated | Ref<Date | undefined> | 权限最后更新时间 |
| refresh | () => Promise<void> | 刷新权限的方法 |

#### usePermission

检查单个或多个权限的组合式 API。

**参数**：
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| permission | string | undefined | 单个权限代码 |
| permissions | string[] | undefined | 权限代码数组 |
| mode | 'any' | 'all' | 'all' | 匹配模式 |

**返回值**：
| 属性 | 类型 | 描述 |
|------|------|------|
| allowed | ComputedRef<boolean> | 是否允许访问 |
| result | ComputedRef<PermissionEvalResult> | 完整的权限评估结果 |

#### useCan

检查单个权限的简写组合式 API。

**参数**：
| 参数 | 类型 | 描述 |
|------|------|------|
| permission | string | 权限代码 |

**返回值**：`ComputedRef<boolean>` - 是否允许该权限

#### useCanAny

检查是否允许任意一个权限的简写组合式 API。

**参数**：
| 参数 | 类型 | 描述 |
|------|------|------|
| permissions | string[] | 权限代码数组 |

**返回值**：`ComputedRef<boolean>` - 是否允许任意一个权限

#### useCanAll

检查是否允许所有权限的简写组合式 API。

**参数**：
| 参数 | 类型 | 描述 |
|------|------|------|
| permissions | string[] | 权限代码数组 |

**返回值**：`ComputedRef<boolean>` - 是否允许所有权限

#### useRoles

获取当前角色的简写组合式 API。

**返回值**：`Ref<string[]>` - 角色列表

#### useHasRole

检查用户是否具有特定角色的简写组合式 API。

**参数**：
| 参数 | 类型 | 描述 |
|------|------|------|
| role | string | 角色名称 |

**返回值**：`ComputedRef<boolean>` - 是否具有该角色

### 4. 工具函数

#### createApiPermissionFetcher

从通用 API 配置构建简单的权限获取器。

**参数**：
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| options | `ApiFetcherOptions` | - | API 获取器配置 |

**返回值**：`() => Promise<{ permissions: string[]; roles?: string[] }>` - 权限获取器函数

## 使用示例代码

### 1. 基本使用

```vue
<template>
  <div>
    <h1>应用标题</h1>
    <UserProfile />
  </div>
</template>

<script setup lang="ts">
import { createPermissionContext, providePermissionContext } from '@mtpc/adapter-vue';
import UserProfile from './UserProfile.vue';

// 创建并提供权限上下文
const permissionContext = createPermissionContext({
  initialPermissions: ['user:read', 'user:update'],
  initialRoles: ['user'],
  tenantId: 'tenant-123',
  subjectId: 'user-123'
});

// 提供权限上下文
providePermissionContext(permissionContext);
</script>
```

### 2. 使用 Can 组件

```vue
<template>
  <div>
    <h2>用户资料</h2>
    
    <!-- 只有具有 user:read 权限的用户才能看到用户信息 -->
    <Can permission="user:read">
      <div>
        <p>用户名: John Doe</p>
        <p>邮箱: john@example.com</p>
      </div>
    </Can>
    
    <!-- 只有具有 user:update 权限的用户才能看到编辑按钮 -->
    <Can permission="user:update">
      <button @click="editProfile">编辑资料</button>
    </Can>
    
    <!-- 只有不具有 user:delete 权限的用户才能看到请求删除权限的按钮 -->
    <Cannot permission="user:delete">
      <button @click="requestDeletePermission">请求删除权限</button>
    </Cannot>
    
    <!-- 使用多个权限和匹配模式 -->
    <Can :permissions="['user:admin', 'user:manager']" mode="any">
      <div>
        <h3>管理员面板</h3>
        <p>只有管理员或经理才能看到此内容</p>
      </div>
    </Can>
  </div>
</template>

<script setup lang="ts">
import { Can, Cannot } from '@mtpc/adapter-vue';

function editProfile() {
  console.log('编辑资料');
}

function requestDeletePermission() {
  console.log('请求删除权限');
}
</script>
```

### 3. 使用组合式 API

```vue
<template>
  <div>
    <h2>使用组合式 API</h2>
    
    <!-- 使用 usePermission -->
    <div>
      <h3>用户管理</h3>
      <p v-if="!userPermission.allowed">您没有用户管理权限</p>
      <button v-else @click="manageUsers">管理用户</button>
    </div>
    
    <!-- 使用 useCan -->
    <div>
      <h3>编辑权限</h3>
      <button v-if="canEdit" @click="editResource">编辑资源</button>
      <p v-else>您没有编辑权限</p>
    </div>
    
    <!-- 使用 useCanAny -->
    <div>
      <h3>高级功能</h3>
      <button v-if="canAny" @click="advancedFeature">高级功能</button>
      <p v-else>您没有访问高级功能的权限</p>
    </div>
    
    <!-- 使用 useCanAll -->
    <div>
      <h3>管理员功能</h3>
      <button v-if="canAll" @click="adminFunction">管理员功能</button>
      <p v-else>您没有管理员权限</p>
    </div>
    
    <!-- 使用 useRoles 和 useHasRole -->
    <div>
      <h3>角色信息</h3>
      <p>当前角色: {{ roles.join(', ') }}</p>
      <p v-if="isAdmin">您是管理员</p>
      <p v-else>您不是管理员</p>
    </div>
    
    <!-- 刷新权限 -->
    <button @click="refreshPermissions" :disabled="loading">
      {{ loading ? '刷新中...' : '刷新权限' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { 
  usePermission, 
  useCan, 
  useCanAny, 
  useCanAll, 
  useRoles, 
  useHasRole, 
  usePermissions 
} from '@mtpc/adapter-vue';

// 使用 usePermission 检查多个权限
const userPermission = usePermission(undefined, ['user:manage'], 'all');

// 使用 useCan 检查单个权限
const canEdit = useCan('resource:edit');

// 使用 useCanAny 检查任意权限
const canAny = useCanAny(['feature:advanced', 'feature:premium']);

// 使用 useCanAll 检查所有权限
const canAll = useCanAll(['admin:read', 'admin:write']);

// 使用 useRoles 获取角色列表
const roles = useRoles();

// 使用 useHasRole 检查特定角色
const isAdmin = useHasRole('admin');

// 使用 usePermissions 获取权限状态
const { refresh, loading } = usePermissions();

function manageUsers() {
  console.log('管理用户');
}

function editResource() {
  console.log('编辑资源');
}

function advancedFeature() {
  console.log('使用高级功能');
}

function adminFunction() {
  console.log('执行管理员功能');
}

function refreshPermissions() {
  refresh();
}
</script>
```

### 4. 使用权限获取器

```vue
<template>
  <div>
    <h1>使用权限获取器</h1>
    
    <div v-if="loading">加载权限中...</div>
    <div v-else-if="error">加载权限失败: {{ error }}</div>
    <div v-else>
      <h2>用户资料</h2>
      <Can permission="user:read">
        <div>
          <p>用户名: John Doe</p>
          <p>邮箱: john@example.com</p>
        </div>
      </Can>
    </div>
    
    <button @click="refresh" :disabled="loading">
      {{ loading ? '刷新中...' : '刷新权限' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { createPermissionContext, providePermissionContext, createApiPermissionFetcher } from '@mtpc/adapter-vue';
import { Can } from '@mtpc/adapter-vue';
import { usePermissions } from '@mtpc/adapter-vue';

// 创建 API 权限获取器
const fetcher = createApiPermissionFetcher({
  baseUrl: '/api',
  path: '/permissions',
  headers: {
    'Authorization': 'Bearer token123'
  }
});

// 创建并提供权限上下文
const permissionContext = createPermissionContext({
  fetcher,
  autoFetch: true, // 自动加载权限
  tenantId: 'tenant-123',
  subjectId: 'user-123'
});

// 提供权限上下文
providePermissionContext(permissionContext);

// 使用 usePermissions 获取权限状态
const { refresh, loading, error } = usePermissions();
</script>
```

### 5. 使用自定义提取器

```vue
<template>
  <div>
    <h1>使用自定义提取器</h1>
    <!-- 应用内容 -->
  </div>
</template>

<script setup lang="ts">
import { createPermissionContext, providePermissionContext } from '@mtpc/adapter-vue';

// 创建并提供权限上下文
const permissionContext = createPermissionContext({
  fetcher: async () => {
    const response = await fetch('/api/permissions');
    const data = await response.json();
    
    // 自定义提取器逻辑
    return {
      permissions: data.user.permissions,
      roles: data.user.roles
    };
  },
  tenantId: 'tenant-123',
  subjectId: 'user-123'
});

// 提供权限上下文
providePermissionContext(permissionContext);
</script>
```

### 6. 使用通配符

```vue
<template>
  <div>
    <h1>使用通配符</h1>
    
    <!-- 匹配所有资源的 read 操作 -->
    <Can permission="*:read">
      <button>查看所有资源</button>
    </Can>
    
    <!-- 匹配 user 资源的所有操作 -->
    <Can permission="user:*">
      <div>
        <button>创建用户</button>
        <button>查看用户</button>
        <button>编辑用户</button>
        <button>删除用户</button>
      </div>
    </Can>
    
    <!-- 匹配所有资源的所有操作 -->
    <Can permission="*">
      <button>管理员操作</button>
    </Can>
    
    <!-- 使用组合式 API 检查通配符权限 -->
    <div>
      <h3>管理员检查</h3>
      <button v-if="isAdmin" @click="adminAction">管理员操作</button>
      <p v-else>您不是管理员</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Can } from '@mtpc/adapter-vue';
import { useCan } from '@mtpc/adapter-vue';

// 使用组合式 API 检查通配符权限
const isAdmin = useCan('*');

function adminAction() {
  console.log('执行管理员操作');
}
</script>
```

## 常见问题解答

### 1. 如何处理权限加载状态？

可以使用 `usePermissions` 组合式 API 获取 `loading` 状态，然后根据状态显示加载指示器：

```vue
<template>
  <div>
    <div v-if="loading">加载权限中...</div>
    <div v-else-if="error">加载权限失败: {{ error }}</div>
    <div v-else>
      <!-- 渲染受保护内容 -->
      <ProtectedContent />
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePermissions } from '@mtpc/adapter-vue';
import ProtectedContent from './ProtectedContent.vue';

const { loading, error } = usePermissions();
</script>
```

### 2. 如何在组件中访问完整的权限评估结果？

可以使用 `usePermission` 组合式 API 获取完整的权限评估结果：

```vue
<template>
  <div>
    <h2>权限详情</h2>
    <p>是否允许: {{ allowed }}</p>
    <p>已授予的权限: {{ granted.join(', ') }}</p>
    <p>缺失的权限: {{ missing.join(', ') }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePermission } from '@mtpc/adapter-vue';

const { result } = usePermission(undefined, ['user:read', 'user:write']);

const allowed = computed(() => result.value.allowed);
const granted = computed(() => result.value.granted);
const missing = computed(() => result.value.missing);
</script>
```

### 3. 如何与 Vue Router 集成？

可以使用 `usePermission` 组合式 API 结合 Vue Router 的导航守卫：

```ts
import { createRouter, createWebHistory } from 'vue-router';
import { usePermission } from '@mtpc/adapter-vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/admin',
      component: AdminPanel,
      meta: { requiredPermission: 'admin:*' }
    },
    // 其他路由
  ]
});

// 导航守卫
router.beforeEach((to, from, next) => {
  const requiredPermission = to.meta.requiredPermission as string;
  
  if (requiredPermission) {
    const { allowed } = usePermission(requiredPermission);
    
    if (allowed.value) {
      next();
    } else {
      next('/403'); // 无权限页面
    }
  } else {
    next();
  }
});
```

### 4. 如何使用自定义的权限上下文键？

可以使用 Vue 的 `inject` 和 `provide` 函数配合自定义键：

```ts
import { inject, provide } from 'vue';
import { createPermissionContext } from '@mtpc/adapter-vue';

// 自定义键
const CustomPermissionKey = Symbol('CustomPermissionContext');

// 创建权限上下文
const permissionContext = createPermissionContext({
  // 配置
});

// 使用自定义键提供上下文
provide(CustomPermissionKey, permissionContext);

// 使用自定义键注入上下文
const customContext = inject(CustomPermissionKey);
```

## 性能优化

1. **使用 computed 缓存权限检查结果**：对于复杂的权限检查，可以使用 `computed` 缓存结果，避免不必要的重新计算
2. **避免在模板中创建权限数组**：尽量使用常量或 `ref` 缓存权限数组，避免在每次渲染时创建新数组
3. **合理使用 `autoFetch` 选项**：对于权限不经常变化的应用，可以考虑关闭自动刷新，手动控制刷新时机
4. **使用 `Can` 组件包裹大块内容**：对于需要权限控制的大块内容，使用 `Can` 组件可以减少不必要的渲染
5. **使用 `v-if` 代替 `v-show`**：对于基于权限条件渲染的内容，使用 `v-if` 可以完全避免不必要的渲染

## 最佳实践

1. **将权限上下文放在应用的顶层**：确保所有需要权限的组件都能访问到权限上下文
2. **使用有意义的权限代码**：权限代码应清晰反映资源和操作，如 `user:read`、`order:create` 等
3. **合理使用通配符**：通配符可以简化权限管理，但应谨慎使用，避免过度授权
4. **定期刷新权限**：对于权限经常变化的应用，应定期刷新权限，确保权限状态的准确性
5. **处理权限加载状态和错误**：在权限加载过程中显示加载指示器，在加载失败时显示友好的错误信息
6. **使用组合式 API 而非组件**：对于复杂的权限逻辑，使用组合式 API 可以提供更灵活的控制
7. **将权限检查与业务逻辑分离**：将权限检查逻辑封装在自定义的组合式 API 中，提高代码的可维护性

## 版本兼容性

| @mtpc/adapter-vue 版本 | @mtpc/core 版本 | Vue 版本 |
|------------------------|----------------|----------|
| ^1.0.0                 | ^1.0.0         | ^3.0.0    |

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