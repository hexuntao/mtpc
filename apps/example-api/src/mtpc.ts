import { createMTPC } from '@mtpc/core';
import { createRBAC, role } from '@mtpc/rbac';
import { resources } from './resources.js';

// 创建 MTPC 实例
export const mtpc = createMTPC();

// 注册资源
mtpc.registerResources(resources);

// 创建 RBAC 实例
export const rbac = createRBAC();

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

// 注册系统角色
rbac.roles.registerSystemRole(adminRole);
rbac.roles.registerSystemRole(managerRole);
rbac.roles.registerSystemRole(viewerRole);

// 初始化 MTPC
await mtpc.init();

console.log('✅ MTPC 初始化完成，摘要:', mtpc.getSummary());
