import { zValidator } from '@hono/zod-validator';
import { DrizzleCRUDHandler, getMTPCContext, requirePermission } from '@mtpc/adapter-hono';
import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { product } from '../db/schema.js';
import { productResource } from '../resources.js';

export const productRoutes = new Hono();

// 使用数据库存储的处理器
const handler = new DrizzleCRUDHandler(db, product, productResource);

// 列出产品
productRoutes.get('/', requirePermission('product', 'list'), async c => {
  const ctx = getMTPCContext(c);
  const query = c.req.query();

  const result = await handler.list(ctx, {
    page: query.page ? parseInt(query.page) : 1,
    pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
  });

  return c.json({ success: true, data: result });
});

// 根据 ID 获取产品
productRoutes.get('/:id', requirePermission('product', 'read'), async c => {
  const ctx = getMTPCContext(c);
  const id = c.req.param('id');

  const result = await handler.read(ctx, id);

  if (!result) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '产品未找到' } }, 404);
  }

  return c.json({ success: true, data: result });
});

// 创建产品
productRoutes.post(
  '/',
  requirePermission('product', 'create'),
  zValidator('json', productResource.createSchema),
  async c => {
    const ctx = getMTPCContext(c);
    const data = c.req.valid('json');

    const result = await handler.create(ctx, data);

    return c.json({ success: true, data: result }, 201);
  }
);

// 更新产品
productRoutes.put(
  '/:id',
  requirePermission('product', 'update'),
  zValidator('json', productResource.updateSchema),
  async c => {
    const ctx = getMTPCContext(c);
    const id = c.req.param('id');
    const data = c.req.valid('json');

    const result = await handler.update(ctx, id, data);

    if (!result) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: '产品未找到' } }, 404);
    }

    return c.json({ success: true, data: result });
  }
);

// 删除产品
productRoutes.delete('/:id', requirePermission('product', 'delete'), async c => {
  const ctx = getMTPCContext(c);
  const id = c.req.param('id');

  const result = await handler.delete(ctx, id);

  if (!result) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '产品未找到' } }, 404);
  }

  return c.json({ success: true, data: { deleted: true } });
});
