import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { rbac } from '../mtpc.js';

export const roleRoutes = new Hono();

// 列出角色
roleRoutes.get('/', async c => {
  const tenantId = c.req.header('x-tenant-id') ?? 'default';
  const roles = await rbac.listRoles(tenantId);

  return c.json({ success: true, data: roles });
});

// 根据 ID 获取角色
roleRoutes.get('/:id', async c => {
  const tenantId = c.req.header('x-tenant-id') ?? 'default';
  const id = c.req.param('id');

  const role = await rbac.getRole(tenantId, id);

  if (!role) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: '角色未找到' } }, 404);
  }

  return c.json({ success: true, data: role });
});

// 创建角色
roleRoutes.post(
  '/',
  zValidator(
    'json',
    z.object({
      name: z.string().min(2).max(50),
      displayName: z.string().optional(),
      description: z.string().optional(),
      permissions: z.array(z.string()).default([]),
    })
  ),
  async c => {
    const tenantId = c.req.header('x-tenant-id') ?? 'default';
    const userId = c.req.header('x-user-id');
    const data = c.req.valid('json');

    try {
      const role = await rbac.createRole(tenantId, data, userId);
      return c.json({ success: true, data: role }, 201);
    } catch (error) {
      return c.json(
        {
          success: false,
          error: { code: 'CREATE_FAILED', message: (error as Error).message },
        },
        400
      );
    }
  }
);

// 分配角色给用户
roleRoutes.post(
  '/:roleId/assign',
  zValidator(
    'json',
    z.object({
      userId: z.string().min(1),
      expiresAt: z.string().datetime().optional(),
    })
  ),
  async c => {
    const tenantId = c.req.header('x-tenant-id') ?? 'default';
    const roleId = c.req.param('roleId');
    const createdBy = c.req.header('x-user-id');
    const { userId, expiresAt } = c.req.valid('json');

    try {
      const binding = await rbac.assignRole(tenantId, roleId, 'user', userId, {
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        createdBy,
      });
      return c.json({ success: true, data: binding });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: { code: 'ASSIGN_FAILED', message: (error as Error).message },
        },
        400
      );
    }
  }
);

// 从用户撤销角色
roleRoutes.post(
  '/:roleId/revoke',
  zValidator(
    'json',
    z.object({
      userId: z.string().min(1),
    })
  ),
  async c => {
    const tenantId = c.req.header('x-tenant-id') ?? 'default';
    const roleId = c.req.param('roleId');
    const { userId } = c.req.valid('json');

    const result = await rbac.revokeRole(tenantId, roleId, 'user', userId);

    return c.json({ success: true, data: { revoked: result } });
  }
);

// 获取用户的角色
roleRoutes.get('/user/:userId', async c => {
  const tenantId = c.req.header('x-tenant-id') ?? 'default';
  const userId = c.req.param('userId');

  const bindings = await rbac.getSubjectRoles(tenantId, 'user', userId);
  const permissions = await rbac.getPermissions(tenantId, 'user', userId);

  return c.json({
    success: true,
    data: {
      bindings,
      permissions,
    },
  });
});
