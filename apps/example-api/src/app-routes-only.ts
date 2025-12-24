/**
 * 纯路由定义文件 - 用于前端 RPC 类型推导
 *
 * 此文件只定义路由结构，不依赖 MTPC 包，避免类型错误
 * 前端直接从此文件导入类型
 */

import { Hono } from 'hono';

// 创建一个干净的 Hono app 用于类型导出
const appForTypes = new Hono();

// === 健康检查 ===
appForTypes.get('/health', c => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// === 元数据端点 ===
appForTypes.get('/api/metadata', c => {
  return c.json({
    success: true,
    data: { resources: [], permissions: [] },
  });
});

// === 权限端点 ===
appForTypes.get('/api/permissions', c => {
  return c.json({
    success: true,
    data: { permissions: [], roles: [] },
  });
});

// === API 路由 ===
const apiRoutes = new Hono();

// 产品路由
const productRoutes = new Hono();

productRoutes.get('/', c => c.json({ success: true, data: [] }));
productRoutes.post('/', c => c.json({ success: true }));
productRoutes.get('/:id', c => c.json({ success: true }));
productRoutes.put('/:id', c => c.json({ success: true }));
productRoutes.delete('/:id', c => c.json({ success: true }));

apiRoutes.route('/products', productRoutes);

// 订单路由
const orderRoutes = new Hono();
orderRoutes.get('/', c => c.json({ success: true, data: [] }));
orderRoutes.post('/', c => c.json({ success: true }));
apiRoutes.route('/orders', orderRoutes);

// 客户路由
const customerRoutes = new Hono();
customerRoutes.get('/', c => c.json({ success: true, data: [] }));
customerRoutes.post('/', c => c.json({ success: true }));
apiRoutes.route('/customers', customerRoutes);

// 角色路由
const roleRoutes = new Hono();
roleRoutes.get('/', c => c.json({ success: true, data: [] }));
roleRoutes.post('/', c => c.json({ success: true }));
apiRoutes.route('/roles', roleRoutes);

// 挂载 API 路由
appForTypes.route('/api', apiRoutes);

// 导出实例和类型供前端使用
export const appForTypesExport = appForTypes;
export type AppRoutesType = typeof appForTypes;
