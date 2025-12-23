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

// 创建 Hono 应用
export const app = new Hono();

// 全局中间件
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
);
app.use('*', logger());

// MTPC 中间件
app.use('*', mtpcMiddleware(mtpc));

// API 路由的租户中间件
app.use(
  '/api/*',
  tenantMiddleware({
    headerName: 'x-tenant-id',
    required: true,
    defaultTenantId: 'default',
  })
);

// API 路由的认证中间件
app.use(
  '/api/*',
  authMiddleware({
    headerName: 'x-user-id',
    roleHeaderName: 'x-user-roles',
    required: false,
  })
);

// 健康检查
app.get('/health', c => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mtpc: mtpc.getSummary(),
  });
});

// 挂载 API 路由
app.route('/api', apiRoutes);

// 元数据端点
app.get('/api/metadata', c => {
  const metadata = mtpc.exportMetadata();
  return c.json({ success: true, data: metadata });
});

// 权限端点
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

// 错误处理
app.onError(mtpcErrorHandler({ includeStack: process.env.NODE_ENV !== 'production' }));
app.notFound(notFoundHandler);
