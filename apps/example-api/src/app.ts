import {
  authMiddleware,
  mtpcErrorHandler,
  mtpcMiddleware,
  notFoundHandler,
  tenantMiddleware,
} from '@mtpc/adapter-hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { mtpc, rbac } from './mtpc.js';
import { apiRoutes } from './routes/index.js';

// Create Hono app
export const app = new Hono();

// Global middleware
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
);
app.use('*', logger());

// MTPC middleware
app.use('*', mtpcMiddleware(mtpc));

// Tenant middleware for API routes
app.use(
  '/api/*',
  tenantMiddleware({
    headerName: 'x-tenant-id',
    required: true,
    defaultTenantId: 'default',
  })
);

// Auth middleware for API routes
app.use(
  '/api/*',
  authMiddleware({
    headerName: 'x-user-id',
    roleHeaderName: 'x-user-roles',
    required: false,
  })
);

// Health check
app.get('/health', c => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mtpc: mtpc.getSummary(),
  });
});

// Mount API routes
app.route('/api', apiRoutes);

// Metadata endpoint
app.get('/api/metadata', c => {
  const metadata = mtpc.exportMetadata();
  return c.json({ success: true, data: metadata });
});

// Permissions endpoint
app.get('/api/permissions', async c => {
  const tenantId = c.req.header('x-tenant-id') ?? 'default';
  const userId = c.req.header('x-user-id');

  if (!userId) {
    return c.json({ success: true, data: { permissions: [] } });
  }

  const permissions = await rbac.getPermissions(tenantId, 'user', userId);
  return c.json({
    success: true,
    data: {
      permissions: Array.from(permissions),
      roles: (await rbac.getSubjectRoles(tenantId, 'user', userId)).map(b => b.roleId),
    },
  });
});

// Error handling
app.onError(mtpcErrorHandler({ includeStack: process.env.NODE_ENV !== 'production' }));
app.notFound(notFoundHandler);
