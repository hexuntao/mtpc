import type {
  MTPC,
  MTPCContext,
  PaginatedResult,
  QueryOptions,
  ResourceDefinition,
  SubjectContext,
  TenantContext,
} from '@mtpc/core';
import type { Context, Env, MiddlewareHandler } from 'hono';

/**
 * Hono 上下文中存储的 MTPC 相关变量
 * 这些变量会被注入到每个请求的上下文中
 */
export interface MTPCVariables {
  /** 租户上下文信息 */
  tenant: TenantContext;
  /** 主体（用户/服务）上下文信息 */
  subject: SubjectContext;
  /** 完整的 MTPC 上下文（包含请求信息） */
  mtpcContext: MTPCContext;
  /** MTPC 核心实例 */
  mtpc: MTPC;
}

/**
 * 扩展的 Hono 环境类型
 * 将 MTPC 变量添加到 Hono 的 Variables 中
 */
export interface MTPCEnv extends Env {
  Variables: MTPCVariables;
}

/**
 * 租户中间件配置选项
 */
export interface TenantMiddlewareOptions {
  /**
   * 租户 ID 请求头名称
   * @default 'x-tenant-id'
   */
  headerName?: string;

  /**
   * 是否必须提供租户信息
   * @default true
   */
  required?: boolean;

  /**
   * 默认租户 ID
   * 当请求头中没有租户信息时使用
   */
  defaultTenantId?: string;

  /**
   * 租户验证函数
   * 可用于验证租户是否存在、是否有效等
   */
  validate?: (tenant: TenantContext) => Promise<boolean> | boolean;
}

/**
 * 认证中间件配置选项
 */
export interface AuthMiddlewareOptions {
  /**
   * 主体 ID 请求头名称
   * @default 'x-subject-id'
   */
  headerName?: string;

  /**
   * 角色列表请求头名称
   * @default 'x-subject-roles'
   */
  roleHeaderName?: string;

  /**
   * 是否必须提供认证信息
   * @default false
   */
  required?: boolean;

  /**
   * 自定义主体解析函数
   * 提供此函数时，将从请求中解析主体信息
   * 返回 null 表示解析失败
   */
  resolver?: (c: Context<MTPCEnv>) => Promise<SubjectContext | null> | SubjectContext | null;
}

/**
 * Bearer Token 认证配置选项
 */
export interface BearerAuthOptions {
  /**
   * Token 验证函数
   * 验证 Bearer Token 并返回对应的主体信息
   */
  verifyToken: (token: string) => Promise<SubjectContext>;

  /**
   * 是否必须提供 Token
   * @default true
   */
  required?: boolean;
}

/**
 * API Key 认证配置选项
 */
export interface ApiKeyAuthOptions {
  /**
   * API Key 请求头名称
   * @default 'x-api-key'
   */
  headerName?: string;

  /**
   * API Key 验证函数
   * 验证 API Key 并返回对应的主体信息
   */
  verifyApiKey: (apiKey: string) => Promise<SubjectContext>;

  /**
   * 是否必须提供 API Key
   * @default true
   */
  required?: boolean;
}

/**
 * 错误处理器配置选项
 */
export interface ErrorHandlerOptions {
  /**
   * 是否在错误响应中包含堆栈跟踪
   * @default false
   */
  includeStack?: boolean;

  /**
   * 自定义错误处理回调
   * 在返回响应之前调用，可用于日志记录等
   */
  onError?: (err: Error, c: Context) => Promise<void> | void;

  /**
   * 是否为生产环境
   * 生产环境下会隐藏详细错误信息，只返回通用错误消息
   *
   * @default 根据 process.env.NODE_ENV 自动判断
   */
  isProduction?: boolean;

  /**
   * 日志记录函数
   * 用于记录未处理的错误，支持生产级别的日志系统
   *
   * **修复说明**：提供可配置的 logger 替代直接使用 console.error
   * 这样可以集成到生产日志系统（如 Winston、Pino 等）
   *
   * @param error - 错误对象
   * @param context - 错误上下文描述
   *
   * @example
   * ```typescript
   * // 使用 Winston
   * logger: (err, context) => winston.error(context, { error: err })
   *
   * // 使用 Pino
   * logger: (err, context) => pino.error({ err }, context)
   *
   * // 使用 Cloudflare Workers 的 log
   * logger: (err, context) => console.error(`[${context}]`, err)
   * ```
   *
   * @default 未提供时使用 console.error 作为后备方案
   */
  logger?: (error: Error, context: string) => void;
}

/**
 * CRUD 处理器接口
 * 定义资源的基本增删改查操作
 *
 * @template T - 资源实体类型
 */
export interface CRUDHandlers<T = unknown> {
  /** 分页查询资源列表 */
  list?: (ctx: MTPCContext, options: QueryOptions) => Promise<PaginatedResult<T>>;

  /** 创建新资源 */
  create?: (ctx: MTPCContext, data: unknown) => Promise<T>;

  /** 读取单个资源 */
  read?: (ctx: MTPCContext, id: string) => Promise<T | null>;

  /** 更新资源 */
  update?: (ctx: MTPCContext, id: string, data: unknown) => Promise<T | null>;

  /** 删除资源 */
  delete?: (ctx: MTPCContext, id: string) => Promise<boolean>;
}

/**
 * 资源路由配置选项
 */
export interface ResourceRouteOptions {
  /** 路由前缀 */
  prefix?: string;

  /** 中间件列表，会在路由处理之前执行 */
  middleware?: MiddlewareHandler<MTPCEnv>[];
}

/**
 * 标准化 API 响应类型
 * 所有 API 端点都应返回此格式的响应
 *
 * @template T - 响应数据类型
 */
export interface ApiResponse<T = unknown> {
  /** 请求是否成功 */
  success: boolean;

  /** 成功时的响应数据 */
  data?: T;

  /** 失败时的错误信息 */
  error?: {
    /** 错误代码，如 'NOT_FOUND', 'PERMISSION_DENIED' 等 */
    code: string;

    /** 人类可读的错误消息 */
    message: string;

    /** 额外的错误详情，可用于调试 */
    details?: unknown;
  };
}

/**
 * 列表查询参数类型
 * 用于分页、排序、过滤等查询功能
 */
export interface ListQueryParams {
  /** 当前页码（字符串类型，从 URL 参数获取） */
  page?: string;

  /** 每页数量（字符串类型，从 URL 参数获取） */
  pageSize?: string;

  /** 排序字段，格式如 'name' 或 '-name'（倒序） */
  sort?: string;

  /** 过滤条件，格式取决于具体实现 */
  filter?: string;
}

/**
 * 权限解析器上下文
 * 用于动态权限检查时的参数传递
 */
export interface PermissionResolverContext {
  /** 资源名称 */
  resource: string;

  /** 操作类型，如 'read', 'create', 'update', 'delete' */
  action: string;

  /** 资源 ID（可选），用于实例级权限检查 */
  resourceId?: string;
}

/**
 * 动态权限解析器函数类型
 * 根据请求上下文动态解析需要检查的权限
 *
 * 使用场景：路径参数包含资源信息时，动态提取权限参数
 */
export type DynamicPermissionResolver = (
  c: Context<MTPCEnv>
) => Promise<PermissionResolverContext> | PermissionResolverContext;

/**
 * MTPC 应用配置选项
 * 用于 createMTPCApp 函数
 */
export interface MTPCAppOptions {
  /** API 路由前缀 */
  prefix?: string;

  /**
   * CORS 配置
   * - true: 使用默认配置
   * - false: 禁用 CORS
   * - 对象: 自定义 CORS 配置
   */
  cors?: boolean | Record<string, unknown>;

  /** 是否启用请求日志 */
  logging?: boolean;

  /** 是否启用错误处理 */
  errorHandling?: boolean;

  /** 租户中间件配置 */
  tenantOptions?: TenantMiddlewareOptions;

  /** 认证中间件配置 */
  authOptions?: AuthMiddlewareOptions;

  /** CRUD 处理器工厂函数 */
  handlerFactory?: <T>(resource: ResourceDefinition) => CRUDHandlers<T>;
}
