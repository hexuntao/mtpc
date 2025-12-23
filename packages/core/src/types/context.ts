import type { TenantContext } from './tenant.js';

/**
 * 主体类型
 * 表示执行操作的主体（谁在执行）
 *
 * @example
 * ```typescript
 * // 普通用户
 * const user: SubjectContext = {
 *   id: 'user-123',
 *   type: 'user',
 *   roles: ['customer'],
 *   permissions: ['order:read']
 * };
 *
 * // 系统服务
 * const service: SubjectContext = {
 *   id: 'order-service',
 *   type: 'service',
 *   roles: ['system-service'],
 *   permissions: ['*:read', '*:create']
 * };
 *
 * // 匿名用户
 * const anonymous: SubjectContext = {
 *   id: 'anonymous',
 *   type: 'anonymous'
 * };
 * ```
 */
export type SubjectType = 'user' | 'service' | 'system' | 'anonymous';

/**
 * 主体上下文
 * 描述执行操作的主体（用户、服务、系统等）
 *
 * @example
 * ```typescript
 * // 完整的主体上下文
 * const subject: SubjectContext = {
 *   id: 'user-123',
 *   type: 'user',
 *   roles: ['admin', 'manager'],
 *   permissions: ['user:*', 'order:read', 'order:create'],
 *   metadata: {
 *     department: 'IT',
 *     lastLoginAt: new Date('2024-01-01')
 *   }
 * };
 * ```
 */
export interface SubjectContext {
  /** 主体唯一标识符 */
  readonly id: string;
  /** 主体类型 */
  readonly type: SubjectType;
  /** 角色列表（可选） */
  readonly roles?: string[];
  /** 直接权限列表（可选） */
  readonly permissions?: string[];
  /** 额外的元数据（可选） */
  readonly metadata?: Record<string, unknown>;
}

/**
 * 匿名主体
 * 用于未认证用户的默认主体
 *
 * @example
 * ```typescript
 * // 在未登录用户的权限检查中使用
 * const context = createContext({
 *   tenant: tenantContext,
 *   subject: ANONYMOUS_SUBJECT  // 使用匿名主体
 * });
 * ```
 */
export const ANONYMOUS_SUBJECT: SubjectContext = {
  id: 'anonymous',
  type: 'anonymous',
  roles: [],
  permissions: [],
} as const;

/**
 * 系统主体
 * 拥有所有权限的系统级主体
 *
 * @example
 * ```typescript
 * // 用于系统维护任务
 * const systemContext = createContext({
 *   tenant: tenantContext,
 *   subject: SYSTEM_SUBJECT  // 系统主体拥有所有权限
 * });
 * ```
 */
export const SYSTEM_SUBJECT: SubjectContext = {
  id: 'system',
  type: 'system',
  roles: ['system'],
  permissions: ['*'],
} as const;

/**
 * 请求上下文
 * 描述当前请求的详细信息
 *
 * @example
 * ```typescript
 * const requestContext: RequestContext = {
 *   requestId: 'req-abc-123',
 *   timestamp: new Date('2024-01-01T00:00:00Z'),
 *   ip: '192.168.1.100',
 *   userAgent: 'Mozilla/5.0...',
 *   path: '/api/users/123',
 *   method: 'GET',
 *   headers: {
 *     'x-tenant-id': 'tenant-1',
 *     'x-user-id': 'user-123'
 *   }
 * };
 * ```
 */
export interface RequestContext {
  /** 请求唯一标识符 */
  readonly requestId: string;
  /** 请求时间戳 */
  readonly timestamp: Date;
  /** 客户端 IP 地址（可选） */
  readonly ip?: string;
  /** 用户代理字符串（可选） */
  readonly userAgent?: string;
  /** 请求路径（可选） */
  readonly path?: string;
  /** 请求方法（可选） */
  readonly method?: string;
  /** 请求头（可选） */
  readonly headers?: Record<string, string>;
}

/**
 * 完整的 MTPC 上下文
 * 包含权限检查所需的所有信息
 *
 * @example
 * ```typescript
 * // HTTP 请求处理中的完整上下文
 * const mtpcContext: MTPCContext = {
 *   tenant: { id: 'tenant-1', status: 'active' },
 *   subject: {
 *     id: 'user-123',
 *     type: 'user',
 *     roles: ['admin'],
 *     permissions: ['user:*']
 *   },
 *   request: {
 *     requestId: 'req-xyz-789',
 *     timestamp: new Date(),
 *     ip: '192.168.1.100',
 *     path: '/api/users',
 *     method: 'GET'
 *   }
 * };
 *
 * // 用于权限检查
 * const result = await mtpc.checkPermission({
 *   ...mtpcContext,
 *   resource: 'user',
 *   action: 'read'
 * });
 * ```
 */
export interface MTPCContext {
  /** 租户上下文（多租户隔离） */
  readonly tenant: TenantContext;
  /** 主体上下文（执行操作的用户或服务） */
  readonly subject: SubjectContext;
  /** 请求上下文（请求的详细信息） */
  readonly request: RequestContext;
}

/**
 * 上下文构建器选项
 * 用于创建 MTPC 上下文的配置参数
 *
 * @example
 * ```typescript
 * const options: ContextBuilderOptions = {
 *   tenant: { id: 'tenant-1', status: 'active' },
 *   subject: { id: 'user-123', type: 'user', roles: ['admin'] },
 *   request: {
 *     requestId: 'req-123',
 *     timestamp: new Date(),
 *     ip: '192.168.1.1'
 *   }
 * };
 *
 * const context = createContext(options);
 * ```
 */
export interface ContextBuilderOptions {
  /** 租户上下文（必需） */
  tenant: TenantContext;
  /** 主体上下文（可选，默认为匿名用户） */
  subject?: SubjectContext;
  /** 请求上下文（可选，将使用默认值） */
  request?: Partial<RequestContext>;
}

/**
 * 创建完整的 MTPC 上下文
 * 合并租户、主体和请求信息
 *
 * @example
 * ```typescript
 * // 1. 最简形式（使用默认匿名主体和请求）
 * const ctx1 = createContext({
 *   tenant: { id: 'tenant-1' }
 * });
 *
 * // 2. 完整形式
 * const ctx2 = createContext({
 *   tenant: { id: 'tenant-1', status: 'active' },
 *   subject: { id: 'user-123', type: 'user', roles: ['admin'] },
 *   request: {
 *     requestId: 'req-123',
 *     timestamp: new Date(),
 *     ip: '192.168.1.100',
 *     path: '/api/users',
 *     method: 'GET'
 *   }
 * });
 *
 * // 3. 在中间件中使用
 * app.use('*', async (c, next) => {
 *   const tenant = await getTenantFromHeader(c.req.header('x-tenant-id'));
 *   const subject = await getSubjectFromToken(c.req.header('authorization'));
 *
 *   const mtpcContext = createContext({
 *     tenant,
 *     subject,
 *     request: {
 *       requestId: generateRequestId(),
 *       timestamp: new Date(),
 *       ip: c.req.ip,
 *       userAgent: c.req.header('user-agent'),
 *       path: c.req.path,
 *       method: c.req.method
 *     }
 *   });
 *
 *   c.set('mtpcContext', mtpcContext);
 *   await next();
 * });
 * ```
 *
 * @param options 上下文构建选项
 * @returns 完整的 MTPC 上下文
 */
export function createContext(options: ContextBuilderOptions): MTPCContext {
  return {
    tenant: options.tenant,
    subject: options.subject ?? ANONYMOUS_SUBJECT,
    request: {
      requestId: options.request?.requestId ?? generateRequestId(),
      timestamp: options.request?.timestamp ?? new Date(),
      ip: options.request?.ip,
      userAgent: options.request?.userAgent,
      path: options.request?.path,
      method: options.request?.method,
      headers: options.request?.headers,
    },
  };
}

/**
 * 生成简单的请求 ID
 * 用于唯一标识每个请求
 *
 * @example
 * ```typescript
 * const requestId = generateRequestId();
 * console.log(requestId); // 'req_1704067200000_abc123def'
 * ```
 *
 * @returns 请求 ID 字符串
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
