/**
 * 租户状态
 * 定义租户在其生命周期中可能处于的状态
 *
 * @example
 * ```typescript
 * type TenantStatus = 'active';
 * // 活跃状态：租户正常运行，所有功能可用
 *
 * type TenantStatus = 'inactive';
 * // 非活跃状态：租户被暂停，可能由于欠费或管理操作
 *
 * type TenantStatus = 'suspended';
 * // 封禁状态：租户被临时封禁，通常由于违规行为
 *
 * type TenantStatus = 'deleted';
 * // 已删除状态：租户已被删除，数据可能被归档或即将清除
 * ```
 */
export type TenantStatus =
  | 'active' // 活跃：正常运行状态
  | 'inactive' // 非活跃：暂停状态，可能由于欠费或手动暂停
  | 'suspended' // 封禁：临时封禁，通常由于违规行为
  | 'deleted'; // 已删除：租户已被删除

/**
 * 租户上下文 - 最小的运行时上下文
 * 用于在权限检查和操作执行时传递租户信息
 *
 * @example
 * ```typescript
 * // 基础租户上下文
 * const tenantContext: TenantContext = {
 *   id: 'tenant-123'
 * };
 *
 * // 带状态的租户上下文
 * const activeTenant: TenantContext = {
 *   id: 'tenant-456',
 *   status: 'active'
 * };
 *
 * // 带元数据的租户上下文
 * const tenantWithMetadata: TenantContext = {
 *   id: 'tenant-789',
 *   status: 'active',
 *   metadata: {
 *     plan: 'enterprise',
 *     region: 'us-east-1',
 *     features: ['analytics', 'api-access']
 *   }
 * };
 * ```
 */
export interface TenantContext {
  /** 租户唯一标识符（必需） */
  readonly id: string;
  /** 租户状态（可选） */
  readonly status?: TenantStatus;
  /** 租户元数据（可选，包含自定义信息） */
  readonly metadata?: Record<string, unknown>;
}

/**
 * 租户配置
 * 定义租户级别的功能开关、限制和设置
 *
 * @example
 * ```typescript
 * const enterpriseConfig: TenantConfig = {
 *   features: {
 *     analytics: true,
 *     apiAccess: true,
 *     ssoEnabled: true,
 *     customBranding: false
 *   },
 *   limits: {
 *     maxUsers: 10000,
 *     maxProjects: 100,
 *     apiRateLimit: 10000,
 *     storageQuota: 1073741824  // 1GB
 *   },
 *   settings: {
 *     timezone: 'Asia/Shanghai',
 *     dateFormat: 'YYYY-MM-DD',
 *     theme: 'dark',
 *     language: 'zh-CN'
 *   }
 * };
 * ```
 */
export interface TenantConfig {
  /** 功能开关（可选，控制租户可用的功能） */
  features?: Record<string, boolean>;
  /** 限制配置（可选，设置租户的资源限制） */
  limits?: Record<string, number>;
  /** 自定义设置（可选，租户级别的配置选项） */
  settings?: Record<string, unknown>;
}

/**
 * 租户信息 - 完整的租户信息
 * 包含租户的所有详细信息，通常用于管理和展示
 *
 * @example
 * ```typescript
 * const tenantInfo: TenantInfo = {
 *   id: 'tenant-123',
 *   status: 'active',
 *   name: 'Acme Corporation',
 *   slug: 'acme-corp',
 *   config: {
 *     features: { analytics: true, apiAccess: true },
 *     limits: { maxUsers: 5000, maxProjects: 50 }
 *   },
 *   createdAt: new Date('2024-01-01'),
 *   updatedAt: new Date('2024-01-15'),
 *   metadata: {
 *     owner: 'john.doe@example.com',
 *     plan: 'enterprise'
 *   }
 * };
 * ```
 */
export interface TenantInfo extends TenantContext {
  /** 租户名称（必需） */
  name: string;
  /** 租户别名（可选，用于 URL 友好的标识） */
  slug?: string;
  /** 租户配置（可选） */
  config?: TenantConfig;
  /** 创建时间（必需） */
  createdAt: Date;
  /** 最后更新时间（必需） */
  updatedAt: Date;
}

/**
 * 租户解析器 - 从请求中解析租户信息
 * 根据请求（HTTP 请求、函数调用等）解析出对应的租户上下文
 *
 * @example
 * ```typescript
 * // HTTP 请求解析器（Express/Hono）
 * const httpTenantResolver: TenantResolver<Request> = async (request) => {
 *   const tenantId = request.headers.get('x-tenant-id');
 *   if (!tenantId) return null;
 *
 *   return {
 *     id: tenantId,
 *     status: 'active'
 *   };
 * };
 *
 * // JWT Token 解析器
 * const jwtTenantResolver: TenantResolver<string> = async (token) => {
 *   const decoded = jwt.decode(token);
 *   if (!decoded?.tenantId) return null;
 *
 *   return {
 *     id: decoded.tenantId,
 *     status: decoded.tenantStatus
 *   };
 * };
 *
 * // 函数调用解析器
 * const functionTenantResolver: TenantResolver<{ tenantId: string }> = (input) => {
 *   if (!input.tenantId) return null;
 *   return { id: input.tenantId };
 * };
 * ```
 *
 * @param TRequest 请求类型，默认为 unknown
 * @param request 要解析的请求对象
 * @returns 租户上下文或 null（如果无法解析）
 */
export type TenantResolver<TRequest = unknown> = (
  request: TRequest
) => Promise<TenantContext | null> | TenantContext | null;

/**
 * 租户验证器 - 验证租户上下文的有效性
 * 检查租户是否有效、可用，是否可以继续处理请求
 *
 * @example
 * ```typescript
 * // 基础状态验证器
 * const statusValidator: TenantValidator = (tenant) => {
 *   return tenant.status === 'active';
 * };
 *
 * // 异步数据库验证器
 * const databaseValidator: TenantValidator = async (tenant) => {
 *   const dbTenant = await db.tenants.findById(tenant.id);
 *   return dbTenant !== null && dbTenant.status === 'active';
 * };
 *
 * // 复合验证器（检查状态和权限）
 * const compositeValidator: TenantValidator = async (tenant) => {
 *   // 检查状态
 *   if (tenant.status !== 'active') return false;
 *
 *   // 检查租户是否被封禁
 *   const isSuspended = await checkSuspension(tenant.id);
 *   if (isSuspended) return false;
 *
 *   // 检查租户配额
 *   const withinLimits = await checkQuotaLimits(tenant.id);
 *   return withinLimits;
 * };
 * ```
 *
 * @param tenant 要验证的租户上下文
 * @returns 验证结果：true 表示有效，false 表示无效
 */
export type TenantValidator = (tenant: TenantContext) => Promise<boolean> | boolean;

/**
 * 租户隔离级别
 * 定义多租户系统中数据隔离的程度和方式
 *
 * @example
 * ```typescript
 * // 无隔离：所有租户共享相同的数据表和资源
 * type IsolationLevel = 'none';
 * // 优点：成本低，易于维护
 * // 缺点：安全性较低，存在数据泄露风险
 *
 * // 逻辑隔离：通过 tenantId 字段区分不同租户的数据
 * type IsolationLevel = 'soft';
 * // 优点：成本适中，隔离效果良好
 * // 缺点：需要确保所有查询都包含 tenantId 过滤
 *
 * // 物理隔离：每个租户拥有独立的数据库或模式
 * type IsolationLevel = 'hard';
 * // 优点：安全性最高，完全隔离
 * // 缺点：成本高，管理复杂
 * ```
 */
export type TenantIsolationLevel =
  | 'none' // 无隔离：所有租户共享相同的数据结构
  | 'soft' // 逻辑隔离：通过 tenantId 字段进行数据隔离
  | 'hard'; // 物理隔离：每个租户拥有独立的数据库或模式

/**
 * 租户隔离配置
 * 配置租户数据隔离的具体参数
 *
 * @example
 * ```typescript
 * // 逻辑隔离配置
 * const softIsolation: TenantIsolationConfig = {
 *   level: 'soft',
 *   columnName: 'tenant_id'  // 所有表中的租户ID字段名
 * };
 *
 * // 物理隔离配置（基于模式）
 * const hardIsolationSchema: TenantIsolationConfig = {
 *   level: 'hard',
 *   schemaPrefix: 'tenant_'  // 租户模式前缀，如：tenant_123, tenant_456
 * };
 *
 * // 物理隔离配置（基于数据库）
 * const hardIsolationDb: TenantIsolationConfig = {
 *   level: 'hard',
 *   schemaPrefix: 'tenant_'  // 数据库名前缀
 * };
 *
 * // 无隔离配置
 * const noIsolation: TenantIsolationConfig = {
 *   level: 'none'
 * };
 * ```
 */
export interface TenantIsolationConfig {
  /** 隔离级别（必需） */
  level: TenantIsolationLevel;
  /** 租户ID字段名（可选，soft 隔离时使用） */
  columnName?: string;
  /** 模式或数据库前缀（可选，hard 隔离时使用） */
  schemaPrefix?: string;
}

/**
 * 多租户配置选项
 * 配置多租户系统的全局选项和参数
 *
 * @example
 * ```typescript
 * // 企业级多租户配置
 * const enterpriseOptions: MultiTenantOptions = {
 *   enabled: true,
 *   isolation: {
 *     level: 'hard',
 *     schemaPrefix: 'tenant_'
 *   },
 *   allowCrossTenant: false,
 *   resolver: async (request) => {
 *     const tenantId = request.headers.get('x-tenant-id');
 *     return tenantId ? { id: tenantId } : null;
 *   },
 *   validator: async (tenant) => tenant.status === 'active'
 * };
 *
 * // 单租户配置（作为多租户系统的特例）
 * const singleTenantOptions: MultiTenantOptions = {
 *   enabled: true,
 *   isolation: {
 *     level: 'soft',
 *     columnName: 'tenant_id'
 *   },
 *   defaultTenantId: 'default-tenant',
 *   allowCrossTenant: false
 * };
 *
 * // 开发环境配置（宽松模式）
 * const devOptions: MultiTenantOptions = {
 *   enabled: true,
 *   isolation: {
 *     level: 'soft',
 *     columnName: 'tenant_id'
 *   },
 *   allowCrossTenant: true,  // 允许跨租户访问（仅开发环境）
 *   defaultTenantId: 'dev-tenant'
 * };
 * ```
 */
export interface MultiTenantOptions {
  /** 是否启用多租户（必需） */
  enabled: boolean;
  /** 租户隔离配置（必需） */
  isolation: TenantIsolationConfig;
  /** 默认租户 ID（可选，用于单租户模式或未指定租户的情况） */
  defaultTenantId?: string;
  /** 是否允许跨租户访问（可选，默认为 false） */
  allowCrossTenant?: boolean;
  /** 租户解析器（可选，用于从请求中提取租户信息） */
  resolver?: TenantResolver;
  /** 租户验证器（可选，用于验证租户的有效性） */
  validator?: TenantValidator;
}
