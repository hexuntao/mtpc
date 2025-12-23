import { zValidator } from '@hono/zod-validator';
import { getMTPCContext, InMemoryCRUDHandler, requirePermission } from '@mtpc/adapter-hono';
import { Hono } from 'hono';
import { orderResource } from '../resources.js';

export const orderRoutes = new Hono();

// In-memory handler for demo
const handler = new InMemoryCRUDHandler(orderResource);

// List orders
orderRoutes.get('/', requirePermission('order', 'list'), async c => {
  const ctx = getMTPCContext(c);
  const query = c.req.query();

  const result = await handler.list(ctx, {
    page: query.page ? parseInt(query.page) : 1,
    pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
  });

  return c.json({ success: true, data: result });
});

// Get order by ID
orderRoutes.get('/:id', requirePermission('order', 'read'), async c => {
  const ctx = getMTPCContext(c);
  const id = c.req.param('id');

  const result = await handler.read(ctx, id);

  if (!result) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
      404
    );
  }

  return c.json({ success: true, data: result });
});

// Create order
orderRoutes.post(
  '/',
  requirePermission('order', 'create'),
  zValidator('json', orderResource.createSchema),
  async c => {
    const ctx = getMTPCContext(c);
    const data = c.req.valid('json');

    // Generate order number
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

// Update order
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
        { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        404
      );
    }

    return c.json({ success: true, data: result });
  }
);

// Confirm order (custom action)
orderRoutes.post('/:id/confirm', requirePermission('order:confirm'), async c => {
  const ctx = getMTPCContext(c);
  const id = c.req.param('id');

  const result = await handler.update(ctx, id, { status: 'confirmed' });

  if (!result) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
      404
    );
  }

  return c.json({ success: true, data: result });
});

// Cancel order (custom action)
orderRoutes.post('/:id/cancel', requirePermission('order:cancel'), async c => {
  const ctx = getMTPCContext(c);
  const id = c.req.param('id');

  const result = await handler.update(ctx, id, { status: 'cancelled' });

  if (!result) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
      404
    );
  }

  return c.json({ success: true, data: result });
});
