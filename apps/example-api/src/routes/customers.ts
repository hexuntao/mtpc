import { zValidator } from '@hono/zod-validator';
import { getMTPCContext, InMemoryCRUDHandler, requirePermission } from '@mtpc/adapter-hono';
import { Hono } from 'hono';
import { customerResource } from '../resources.js';

export const customerRoutes = new Hono();

// In-memory handler for demo
const handler = new InMemoryCRUDHandler(customerResource);

// List customers
customerRoutes.get('/', requirePermission('customer', 'list'), async c => {
  const ctx = getMTPCContext(c);
  const query = c.req.query();

  const result = await handler.list(ctx, {
    page: query.page ? parseInt(query.page) : 1,
    pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
  });

  return c.json({ success: true, data: result });
});

// Get customer by ID
customerRoutes.get('/:id', requirePermission('customer', 'read'), async c => {
  const ctx = getMTPCContext(c);
  const id = c.req.param('id');

  const result = await handler.read(ctx, id);

  if (!result) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
      404
    );
  }

  return c.json({ success: true, data: result });
});

// Create customer
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

// Update customer
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
        { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
        404
      );
    }

    return c.json({ success: true, data: result });
  }
);

// Delete customer
customerRoutes.delete('/:id', requirePermission('customer', 'delete'), async c => {
  const ctx = getMTPCContext(c);
  const id = c.req.param('id');

  const result = await handler.delete(ctx, id);

  if (!result) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } },
      404
    );
  }

  return c.json({ success: true, data: { deleted: true } });
});
