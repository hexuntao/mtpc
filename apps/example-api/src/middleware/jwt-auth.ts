import type { MiddlewareHandler } from 'hono';
import { verifyToken, type JwtPayload } from '../utils/jwt.js';

/**
 * JWT 认证配置
 */
export interface JwtAuthConfig {
  /**
   * 是否必需认证
   * - true: 必须提供有效令牌，否则返回 401
   * - false: 可选认证，没有令牌或无效令牌时继续处理
   */
  required?: boolean;

  /**
   * 令牌来源
   * - header: 从 Authorization header 获取 (Bearer token)
   * - query: 从查询参数 token 获取
   * - both: 两者都尝试
   */
  tokenFrom?: 'header' | 'query' | 'both';
}

/**
 * JWT 认证中间件
 *
 * 验证 JWT 令牌并将用户信息存入上下文：
 * - c.get('userId') - 用户 ID
 * - c.get('userEmail') - 用户邮箱
 * - c.get('userRoles') - 用户角色列表
 * - c.get('jwtPayload') - 完整的 JWT 载荷
 *
 * @example
 * ```typescript
 * // 必需认证
 * app.use('/api/protected/*', jwtAuth());
 *
 * // 可选认证
 * app.use('/api/public/*', jwtAuth({ required: false }));
 *
 * // 在路由中使用用户信息
 * app.get('/api/profile', jwtAuth(), (c) => {
 *   const userId = c.get('userId');
 *   return c.json({ userId });
 * });
 * ```
 */
export function jwtAuth(config: JwtAuthConfig = {}): MiddlewareHandler {
  const { required = true, tokenFrom = 'header' } = config;

  return async (c, next) => {
    let token: string | undefined;

    // 根据配置获取令牌
    if (tokenFrom === 'header' || tokenFrom === 'both') {
      const authHeader = c.req.header('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token && (tokenFrom === 'query' || tokenFrom === 'both')) {
      token = c.req.query('token');
    }

    // 没有找到令牌
    if (!token) {
      if (required) {
        return c.json(
          {
            success: false,
            error: {
              code: 'MISSING_TOKEN',
              message: '缺少认证令牌',
            },
          },
          401
        );
      }
      // 可选认证：没有令牌时继续处理
      return next();
    }

    // 验证令牌
    const payload = await verifyToken(token);

    if (!payload) {
      if (required) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_TOKEN',
              message: '无效的认证令牌',
            },
          },
          401
        );
      }
      // 可选认证：无效令牌时继续处理
      return next();
    }

    // 将用户信息存入上下文
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email);
    c.set('userRoles', payload.roles);
    c.set('jwtPayload', payload);

    await next();
  };
}

/**
 * 快捷方法：可选 JWT 认证
 *
 * @example
 * ```typescript
 * app.use('/api/public/*', optionalJwtAuth());
 * ```
 */
export function optionalJwtAuth(config?: Omit<JwtAuthConfig, 'required'>): MiddlewareHandler {
  return jwtAuth({ ...config, required: false });
}
