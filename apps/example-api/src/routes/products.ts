import { zValidator } from '@hono/zod-validator';
import { getMTPCContext, InMemoryCRUDHandler, requirePermission } from '@mtpc/adapter-hono';
import { Hono } from 'hono';
import { z } from 'zod';
import { productResource } from '../resources.js';

export const productRoutes = new Hono();

// In-memory handler for demo
const handler = new InMemoryCRUDHandler(productResource);

// List products
productRoutes.get('/', requirePermission('product', 'list'), async c => {
  const ctx = getMTPCContext(c);
  const query = c.req.query();

  const result = await handler.list(ctx, {
    page: query.page ? parseInt(query.page) : 1,
    pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
  });

  return c.json({ success: true, data: result });
});

// Get product by ID
productRoutes.get('/:id', requirePermission('product', 'read'), async c => {
  const ctx = getMTPCContext(c);
  const id = c.req.param('id');

  const result = await handler.read(ctx, id);

  if (!result) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } },
      404
    );
  }

  return c.json({ success: true, data: result });
});

// Create product
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

// Update product
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
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } },
        404
      );
    }

    return c.json({ success: true, data: result });
  }
);

// Delete product
productRoutes.delete('/:id', requirePermission('product', 'delete'), async c => {
  const ctx = getMTPCContext(c);
  const id = c.req.param('id');

  const result = await handler.delete(ctx, id);

  if (!result) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } },
      404
    );
  }

  return c.json({ success: true, data: { deleted: true } });
});
