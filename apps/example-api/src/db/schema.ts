import { generateAllTables } from '@mtpc/adapter-drizzle';
import { resources } from '../resources.js';

// 为所有资源生成数据库表
export const tables = generateAllTables(resources, {
  timestamps: true,
  auditFields: true,
  softDelete: true,
});

// 导出单个表以便在路由中使用
export const { product, order, customer } = tables;
