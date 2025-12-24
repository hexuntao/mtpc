import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { generateToken, verifyToken, type JwtPayload } from '../utils/jwt.js';
import { rbac } from '../mtpc.js';

export const authRoutes = new Hono();

// 登录请求 Schema
const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
  tenantId: z.string().optional().default('default'),
});

// 刷新令牌请求 Schema
const refreshTokenSchema = z.object({
  token: z.string().min(1, '请提供令牌'),
});

/**
 * POST /auth/login
 * 用户登录接口
 *
 * 注意：当前实现为演示版本，实际生产环境应该：
 * 1. 查询数据库验证用户凭据
 * 2. 使用密码哈希比对（如 bcrypt）
 * 3. 检查账户状态（是否被锁定、禁用等）
 * 4. 记录登录日志
 */
authRoutes.post('/login', zValidator('json', loginSchema), async c => {
  const { email, password, tenantId } = c.req.valid('json');

  // TODO: 实际生产环境需要查询数据库验证用户密码
  // const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  // if (!user || !await bcrypt.compare(password, user.passwordHash)) {
  //   return c.json({
  //     success: false,
  //     error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误' }
  //   }, 401);
  // }

  // 演示模式：根据 email 生成用户 ID
  const userId = `user-${email.split('@')[0]}`;

  // 获取用户角色
  const roleBindings = await rbac.getSubjectRoles(tenantId, 'user', userId);
  const roles = roleBindings.map(b => b.roleId);

  // 获取用户权限
  const permissions = await rbac.getPermissions(tenantId, 'user', userId);

  // 生成 JWT 令牌
  const token = await generateToken(userId, email, roles);

  return c.json({
    success: true,
    data: {
      token,
      user: {
        id: userId,
        email,
        roles,
        permissions,
      },
    },
  });
});

/**
 * POST /auth/refresh
 * 刷新访问令牌
 */
authRoutes.post('/refresh', zValidator('json', refreshTokenSchema), async c => {
  const { token } = c.req.valid('json');

  // 验证旧令牌
  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: '无效的令牌' },
    }, 401);
  }

  // 获取最新的用户权限
  const tenantId = c.req.header('x-tenant-id') ?? 'default';
  const permissions = await rbac.getPermissions(tenantId, 'user', payload.sub);
  const roleBindings = await rbac.getSubjectRoles(tenantId, 'user', payload.sub);
  const roles = roleBindings.map(b => b.roleId);

  // 生成新令牌
  const newToken = await generateToken(payload.sub, payload.email, roles);

  return c.json({
    success: true,
    data: {
      token: newToken,
      user: {
        id: payload.sub,
        email: payload.email,
        roles,
        permissions,
      },
    },
  });
});

/**
 * POST /auth/verify
 * 验证令牌并获取用户信息
 */
authRoutes.post('/verify', async c => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: { code: 'MISSING_TOKEN', message: '缺少认证令牌' },
    }, 401);
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token);

  if (!payload) {
    return c.json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: '无效的令牌' },
    }, 401);
  }

  // 获取最新的用户权限
  const tenantId = c.req.header('x-tenant-id') ?? 'default';
  const permissions = await rbac.getPermissions(tenantId, 'user', payload.sub);
  const roleBindings = await rbac.getSubjectRoles(tenantId, 'user', payload.sub);
  const roles = roleBindings.map(b => b.roleId);

  return c.json({
    success: true,
    data: {
      user: {
        id: payload.sub,
        email: payload.email,
        roles,
        permissions,
      },
    },
  });
});

/**
 * GET /auth/me
 * 获取当前用户信息（需要认证）
 */
authRoutes.get('/me', async c => {
  // 从中间件获取用户信息（如果有 JWT 认证中间件）
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const userRoles = c.get('userRoles');

  if (!userId) {
    return c.json({
      success: false,
      error: { code: 'NOT_AUTHENTICATED', message: '未认证' },
    }, 401);
  }

  const tenantId = c.req.header('x-tenant-id') ?? 'default';
  const permissions = await rbac.getPermissions(tenantId, 'user', userId);

  return c.json({
    success: true,
    data: {
      user: {
        id: userId,
        email: userEmail,
        roles: userRoles || [],
        permissions,
      },
    },
  });
});
