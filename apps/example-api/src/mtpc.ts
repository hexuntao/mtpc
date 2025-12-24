import { createMTPC } from '@mtpc/core';
import { createRBAC, role } from '@mtpc/rbac';
import { resources } from './resources.js';
import { DatabaseRBACStore } from './store/database-rbac-store.js';

// 创建数据库存储实例
const dbStore = new DatabaseRBACStore();

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

// 初始化 MTPC
await mtpc.init();

console.log('✅ MTPC 初始化完成，摘要:', mtpc.getSummary());
console.log('✅ RBAC 使用数据库存储');
