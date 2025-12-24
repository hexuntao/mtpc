/**
 * 验证 @mtpc/adapter-hono RPC 类型推导
 */
import { rpc, createAuthClient } from './rpc-client';

// 测试类型推导
async function test() {
  // 产品列表 - 使用 list 方法（需要传入空对象作为参数）
  const products = await rpc['/api/products'].list({});
  const productsData = products.data;

  // 带查询参数
  const paginatedProducts = await rpc['/api/products'].list({
    page: '1',
    pageSize: '10'
  });

  // 创建产品 - 使用 create 方法
  const newProduct = await rpc['/api/products'].create({
    name: 'Test',
    price: 99,
    sku: 'TEST-001'
  });

  // 权限 - 使用 get 方法
  const permissions = await rpc['/api/permissions'].get({});

  // 元数据 - 使用 get 方法
  const metadata = await rpc['/api/metadata'].get({});
}

export default test;
