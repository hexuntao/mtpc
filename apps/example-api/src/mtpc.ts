import { createMTPC } from '@mtpc/core';
import { createRBAC, role } from '@mtpc/rbac';
import { createAuditPlugin } from '@mtpc/audit';
import { createPolicyCachePlugin } from '@mtpc/policy-cache';
import { resources } from './resources.js';
import { DatabaseRBACStore } from './store/database-rbac-store.js';
import { DatabaseAuditStore } from './store/audit-store.js';

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

// 初始化 MTPC
await mtpc.init();

console.log('✅ MTPC 初始化完成，摘要:', mtpc.getSummary());
console.log('✅ RBAC 使用数据库存储');
console.log('✅ 审计日志插件已启用');
console.log('✅ 权限缓存插件已启用');
