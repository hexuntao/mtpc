import type { SubjectContext } from '@mtpc/core';
import { ANONYMOUS_SUBJECT } from '@mtpc/core';
import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import { setSubject } from '../context/mtpc-context.js';
import type {
  ApiKeyAuthOptions,
  AuthMiddlewareOptions,
  BearerAuthOptions,
  MTPCEnv,
} from '../types.js';

/**
 * 简单的认证中间件
 * 从请求头中提取用户 ID 和角色信息，创建主体上下文
 *
 * **支持两种模式**：
 * 1. 自定义解析器模式：提供 resolver 函数，完全控制解析逻辑
 * 2. 默认请求头模式：从 x-subject-id 和 x-subject-roles 请求头中提取
 *
 * @param options - 中间件配置选项
 * @returns Hono 中间件处理函数
 *
 * @example
 * ```typescript
 * // 默认模式：从请求头获取
 * app.use('/api/*', authMiddleware({
 *   headerName: 'x-subject-id',
 *   roleHeaderName: 'x-subject-roles',
 *   required: false
 * }));
 *
 * // 自定义解析器模式
 * app.use('/api/*', authMiddleware({
 *   resolver: async (c) => {
 *     const token = c.req.header('authorization');
 *     const user = await verifyToken(token);
 *     return user ? { id: user.id, type: 'user', roles: user.roles } : null;
 *   },
 *   required: true
 * }));
 * ```
 */
export function authMiddleware(options: AuthMiddlewareOptions = {}): MiddlewareHandler<MTPCEnv> {
  const {
    headerName = 'x-subject-id',
    roleHeaderName = 'x-subject-roles',
    required = false,
    resolver,
  } = options;

  return createMiddleware<MTPCEnv>(async (c, next) => {
    // 如果提供了自定义解析器，使用解析器模式
    if (resolver) {
      const subject = await resolver(c);

      // 解析成功：设置主体并继续
      if (subject) {
        setSubject(c, subject);
        return next();
      }

      // 解析失败且认证必填：返回 401
      if (required) {
        return c.json({ error: 'Authentication required' }, 401);
      }

      // 解析失败且认证可选：设置为匿名用户
      setSubject(c, ANONYMOUS_SUBJECT);
      return next();
    }

    // 默认模式：从请求头中提取
    const subjectId = c.req.header(headerName);

    if (!subjectId) {
      // 没有用户 ID

      if (required) {
        // 认证必填：返回 401
        return c.json({ error: 'Authentication required' }, 401);
      }

      // 认证可选：设置为匿名用户
      setSubject(c, ANONYMOUS_SUBJECT);
      return next();
    }

    // 解析角色列表
    // 角色格式：逗号分隔的字符串，如 "admin,editor,viewer"
    const rolesHeader = c.req.header(roleHeaderName);
    const roles = rolesHeader ? rolesHeader.split(',').map(r => r.trim()) : [];

    // 构建主体上下文
    const subject: SubjectContext = {
      id: subjectId,
      type: 'user',
      roles,
      permissions: [], // 权限列表会由权限解析器填充
    };

    setSubject(c, subject);
    await next();
  });
}

/**
 * Bearer Token 认证中间件
 * 验证 Authorization 请求头中的 Bearer Token
 *
 * **请求头格式**：`Authorization: Bearer <token>`
 *
 * @param options - Bearer 认证配置选项
 * @returns Hono 中间件处理函数
 *
 * @example
 * ```typescript
 * app.use('/api/*', bearerAuthMiddleware({
 *   verifyToken: async (token) => {
 *     // 验证 JWT Token
 *     const payload = await jwtVerify(token);
 *     return {
 *       id: payload.sub,
 *       type: 'user',
 *       roles: payload.roles,
 *       permissions: payload.permissions
 *     };
 *   },
 *   required: true
 * }));
 * ```
 */
export function bearerAuthMiddleware(options: BearerAuthOptions): MiddlewareHandler<MTPCEnv> {
  const { verifyToken, required = true } = options;

  return createMiddleware<MTPCEnv>(async (c, next) => {
    // 获取 Authorization 请求头
    const authHeader = c.req.header('authorization');

    // 检查请求头格式
    if (!authHeader?.startsWith('Bearer ')) {
      if (required) {
        return c.json({ error: 'Bearer token required' }, 401);
      }

      setSubject(c, ANONYMOUS_SUBJECT);
      return next();
    }

    // 提取 Token（去掉 "Bearer " 前缀）
    const token = authHeader.slice(7);

    try {
      // 验证 Token 并获取主体信息
      const subject = await verifyToken(token);
      setSubject(c, subject);
      await next();
    } catch (error) {
      // Token 验证失败

      if (required) {
        return c.json({ error: 'Invalid token' }, 401);
      }

      setSubject(c, ANONYMOUS_SUBJECT);
      await next();
    }
  });
}

/**
 * API Key 认证中间件
 * 从请求头中验证 API Key
 *
 * **适用场景**：服务间调用、机器对机器通信
 *
 * @param options - API Key 认证配置选项
 * @returns Hono 中间件处理函数
 *
 * @example
 * ```typescript
 * app.use('/api/*', apiKeyAuthMiddleware({
 *   headerName: 'x-api-key',
 *   verifyApiKey: async (apiKey) => {
 *     // 从数据库中查找 API Key
 *     const keyRecord = await db.apiKey.findUnique({ where: { key: apiKey } });
 *     if (!keyRecord || keyRecord.revoked) {
 *       throw new Error('Invalid API key');
 *     }
 *     return {
 *       id: keyRecord.userId,
 *       type: 'service',
 *       roles: keyRecord.roles,
 *       permissions: keyRecord.permissions
 *     };
 *   },
 *   required: true
 * }));
 * ```
 */
export function apiKeyAuthMiddleware(options: ApiKeyAuthOptions): MiddlewareHandler<MTPCEnv> {
  const { headerName = 'x-api-key', verifyApiKey, required = true } = options;

  return createMiddleware<MTPCEnv>(async (c, next) => {
    // 从请求头中获取 API Key
    const apiKey = c.req.header(headerName);

    if (!apiKey) {
      if (required) {
        return c.json({ error: 'API key required' }, 401);
      }

      setSubject(c, ANONYMOUS_SUBJECT);
      return next();
    }

    try {
      // 验证 API Key 并获取主体信息
      const subject = await verifyApiKey(apiKey);
      setSubject(c, subject);
      await next();
    } catch (error) {
      // API Key 验证失败

      if (required) {
        return c.json({ error: 'Invalid API key' }, 401);
      }

      setSubject(c, ANONYMOUS_SUBJECT);
      await next();
    }
  });
}
