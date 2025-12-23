import { Hono } from 'hono';
import { customerRoutes } from './customers.js';
import { orderRoutes } from './orders.js';
import { productRoutes } from './products.js';
import { roleRoutes } from './roles.js';

export const apiRoutes = new Hono();

// 挂载资源路由
apiRoutes.route('/products', productRoutes);
apiRoutes.route('/orders', orderRoutes);
apiRoutes.route('/customers', customerRoutes);
apiRoutes.route('/roles', roleRoutes);

// 根 API 信息
apiRoutes.get('/', c => {
  return c.json({
    name: 'MTPC 示例 API',
    version: '0.1.0',
    endpoints: [
      '/api/products',
      '/api/orders',
      '/api/customers',
      '/api/roles',
      '/api/metadata',
      '/api/permissions',
    ],
  });
});
