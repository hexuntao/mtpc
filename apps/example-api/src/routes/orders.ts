import { zValidator } from '@hono/zod-validator';
import { DrizzleCRUDHandler, getMTPCContext, requirePermission } from '@mtpc/adapter-hono';
import { Hono } from 'hono';
import { orderResource } from '../resources.js';
import { db } from '../db/connection.js';
import { order } from '../db/schema.js';

export const orderRoutes = new Hono();

// 使用数据库存储的处理器
const handler = new DrizzleCRUDHandler(db, order, orderResource);

// 列出订单
orderRoutes.get('/', requirePermission('order', 'list'), async c => {
  const ctx = getMTPCContext(c);
  const query = c.req.query();

  const result = await handler.list(ctx, {
    page: query.page ? parseInt(query.page) : 1,
    pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
  });

  return c.json({ success: true, data: result });
});

// 根据 ID 获取订单
orderRoutes.get('/:id', requirePermission('order', 'read'), async c => {
  const ctx = getMTPCContext(c);
  const id = c.req.param('id');

  const result = await handler.read(ctx, id);

  if (!result) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: '订单未找到' } },
      404
    );
  }

  return c.json({ success: true, data: result });
});

// 创建订单
orderRoutes.post(
  '/',
  requirePermission('order', 'create'),
  zValidator('json', orderResource.createSchema),
  async c => {
    const ctx = getMTPCContext(c);
    const data = c.req.valid('json');

    // 生成订单号
    const orderData = {
      ...data,
      orderNumber: `ORD-${Date.now()}`,
      status: 'pending',
      totalAmount: data.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    };

    const result = await handler.create(ctx, orderData);

    return c.json({ success: true, data: result }, 201);
  }
);

// 更新订单
orderRoutes.put(
  '/:id',
  requirePermission('order', 'update'),
  zValidator('json', orderResource.updateSchema),
  async c => {
    const ctx = getMTPCContext(c);
    const id = c.req.param('id');
    const data = c.req.valid('json');

    const result = await handler.update(ctx, id, data);

    if (!result) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: '订单未找到' } },
        404
      );
    }

    return c.json({ success: true, data: result });
  }
);

// 确认订单（自定义操作）
orderRoutes.post('/:id/confirm', requirePermission('order:confirm'), async c => {
  const ctx = getMTPCContext(c);
  const id = c.req.param('id');

  const result = await handler.update(ctx, id, { status: 'confirmed' });

  if (!result) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: '订单未找到' } },
      404
    );
  }

  return c.json({ success: true, data: result });
});

// 取消订单（自定义操作）
orderRoutes.post('/:id/cancel', requirePermission('order:cancel'), async c => {
  const ctx = getMTPCContext(c);
  const id = c.req.param('id');

  const result = await handler.update(ctx, id, { status: 'cancelled' });

  if (!result) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: '订单未找到' } },
      404
    );
  }

  return c.json({ success: true, data: result });
});
