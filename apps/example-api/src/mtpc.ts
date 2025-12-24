import { createAuditPlugin } from '@mtpc/audit';
import { createMTPC } from '@mtpc/core';
import { createPolicyCachePlugin } from '@mtpc/policy-cache';
import { createRBAC, role } from '@mtpc/rbac';
import { createSoftDeletePlugin } from '@mtpc/soft-delete';
import { createVersioningPlugin, VersionConflictError } from '@mtpc/versioning';
import { createDataScopePlugin } from '@mtpc/data-scope';
import { resources } from './resources.js';
import { DatabaseAuditStore } from './store/audit-store.js';
import { DatabaseRBACStore } from './store/database-rbac-store.js';

// 创建数据库存储实例
const dbStore = new DatabaseRBACStore();
const auditStore = new DatabaseAuditStore();

// 创建 RBAC 实例，使用数据库存储
export const rbac = createRBAC({
  store: dbStore,
  cacheTTL: 5 * 60 * 1000, // 5 分钟缓存
});

// 定义系统角色
const adminRole = role('admin')
  .displayName('管理员')
  .description('完整系统访问权限')
  .system()
  .permission('*')
  .buildDefinition('admin');

const managerRole = role('manager')
  .displayName('经理')
  .description('可以管理产品和订单')
  .fullAccess('product')
  .fullAccess('order')
  .readOnly('customer')
  .buildDefinition('manager');

const viewerRole = role('viewer')
  .displayName('查看者')
  .description('只读访问权限')
  .readOnly('product')
  .readOnly('order')
  .readOnly('customer')
  .buildDefinition('viewer');

const salesRepRole = role('sales_rep')
  .displayName('销售代表')
  .description('可以管理订单和查看客户')
  .fullAccess('order')
  .readOnly('product')
  .readOnly('customer')
  .buildDefinition('sales_rep');

// 注册系统角色到数据库
await rbac.roles.registerSystemRole(adminRole);
await rbac.roles.registerSystemRole(managerRole);
await rbac.roles.registerSystemRole(viewerRole);
await rbac.roles.registerSystemRole(salesRepRole);

// 创建 MTPC 实例，使用 RBAC 权限解析器
export const mtpc = createMTPC({
  defaultPermissionResolver: rbac.createPermissionResolver(),
});

// 注册资源
mtpc.registerResources(resources);

// 注册审计日志插件
mtpc.use(
  createAuditPlugin({
    store: auditStore,
    // 异步写入，不阻塞主流程
    async: true,
    // 记录所有类型的审计事件
    include: {
      permissionChecks: true,
      resourceOperations: true,
      roleChanges: true,
      policyChanges: true,
    },
  })
);

// 注册权限缓存插件
mtpc.use(
  createPolicyCachePlugin({
    // LRU 缓存策略
    strategy: 'lru',
    // 最多缓存 1000 个主体的权限
    maxEntries: 1000,
    // 权限缓存 5 分钟
    defaultTTL: 5 * 60 * 1000,
    // 缓存键前缀
    keyPrefix: 'mtpc:policy',
    // 启用统计信息
    enableStats: true,
  })
);

// 注册软删除插件
const softDeletePlugin = createSoftDeletePlugin();
mtpc.use(softDeletePlugin);

// 注册版本控制插件
const versioningPlugin = createVersioningPlugin();
mtpc.use(versioningPlugin);

// 注册数据范围插件
const dataScopePlugin = createDataScopePlugin({
  // 管理员角色无数据限制
  adminRoles: ['admin'],
  // 默认范围类型（租户隔离）
  defaultScope: 'tenant',
});
mtpc.use(dataScopePlugin);

// 初始化 MTPC
await mtpc.init();

// 获取插件上下文，用于配置资源钩子
const pluginContext = mtpc['plugins'].getContext();

// 为所有资源配置软删除
softDeletePlugin.state.configureResource(
  {
    resourceName: 'product',
    deletedAtField: 'deletedAt',
    deletedByField: 'deletedBy',
    autoFilter: true,
  },
  pluginContext
);

softDeletePlugin.state.configureResource(
  {
    resourceName: 'order',
    deletedAtField: 'deletedAt',
    deletedByField: 'deletedBy',
    autoFilter: true,
  },
  pluginContext
);

softDeletePlugin.state.configureResource(
  {
    resourceName: 'customer',
    deletedAtField: 'deletedAt',
    deletedByField: 'deletedBy',
    autoFilter: true,
  },
  pluginContext
);

// 为所有资源配置版本控制
versioningPlugin.state.configureResource(
  {
    resourceName: 'product',
    versionField: 'version',
  },
  pluginContext
);

versioningPlugin.state.configureResource(
  {
    resourceName: 'order',
    versionField: 'version',
  },
  pluginContext
);

versioningPlugin.state.configureResource(
  {
    resourceName: 'customer',
    versionField: 'version',
  },
  pluginContext
);

// 导出版本冲突错误类供路由使用
export { VersionConflictError };

console.log('✅ MTPC 初始化完成，摘要:', mtpc.getSummary());
console.log('✅ RBAC 使用数据库存储');
console.log('✅ 审计日志插件已启用');
console.log('✅ 权限缓存插件已启用');
console.log('✅ 软删除插件已启用');
console.log('✅ 版本控制插件已启用');
console.log('✅ 数据范围插件已启用（管理员无限制，其他角色租户隔离）');
