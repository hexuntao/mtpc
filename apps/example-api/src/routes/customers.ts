import { zValidator } from '@hono/zod-validator';
import { DrizzleCRUDHandler, getMTPCContext, requirePermission } from '@mtpc/adapter-hono';
import { Hono } from 'hono';
import { eq, and, isNull } from 'drizzle-orm';
import { customerResource } from '../resources.js';
import { db } from '../db/connection.js';
import { customer } from '../db/schema.js';

export const customerRoutes = new Hono();

// 使用数据库存储的处理器
const handler = new DrizzleCRUDHandler(db, customer, customerResource);

// 列出客户
customerRoutes.get('/', requirePermission('customer', 'list'), async c => {
  const ctx = getMTPCContext(c);
  const query = c.req.query();

  const result = await handler.list(ctx, {
    page: query.page ? parseInt(query.page) : 1,
    pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
  });

  return c.json({ success: true, data: result });
});

// 根据 ID 获取客户
customerRoutes.get('/:id', requirePermission('customer', 'read'), async c => {
  const ctx = getMTPCContext(c);
  const id = c.req.param('id');

  const result = await handler.read(ctx, id);

  if (!result) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: '客户未找到' } },
      404
    );
  }

  return c.json({ success: true, data: result });
});

// 创建客户
customerRoutes.post(
  '/',
  requirePermission('customer', 'create'),
  zValidator('json', customerResource.createSchema),
  async c => {
    const ctx = getMTPCContext(c);
    const data = c.req.valid('json');

    const result = await handler.create(ctx, { ...data, status: 'active' });

    return c.json({ success: true, data: result }, 201);
  }
);

// 更新客户
customerRoutes.put(
  '/:id',
  requirePermission('customer', 'update'),
  zValidator('json', customerResource.updateSchema),
  async c => {
    const ctx = getMTPCContext(c);
    const id = c.req.param('id');
    const data = c.req.valid('json');

    const result = await handler.update(ctx, id, data);

    if (!result) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: '客户未找到' } },
        404
      );
    }

    return c.json({ success: true, data: result });
  }
);

// 删除客户（软删除）
customerRoutes.delete('/:id', requirePermission('customer', 'delete'), async c => {
  const ctx = getMTPCContext(c);
  const id = c.req.param('id');
  const userId = ctx.subject.id;

  // 使用软删除
  const result = await db
    .update(customer)
    .set({
      deletedAt: new Date(),
      deletedBy: userId,
      updatedAt: new Date(),
    })
    .where(and(eq(customer.id, id), isNull(customer.deletedAt)))
    .returning();

  if (result.length === 0) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '客户未找到或已被删除' } }, 404);
  }

  return c.json({ success: true, data: { deleted: true, id: result[0].id } });
});

// 恢复已删除的客户
customerRoutes.post('/:id/restore', requirePermission('customer', 'delete'), async c => {
  const id = c.req.param('id');

  const result = await db
    .update(customer)
    .set({
      deletedAt: null,
      deletedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(customer.id, id))
    .returning();

  if (result.length === 0) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '客户未找到' } }, 404);
  }

  return c.json({ success: true, data: result[0] });
});
