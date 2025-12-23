import { DEFAULT_TENANT_HEADER, InvalidTenantError } from '@mtpc/shared';
import type { TenantContext, TenantResolver } from '../types/index.js';
import { createTenantContext } from './context.js';

/**
 * 创建基于请求头的租户解析器
 * 从 HTTP 请求头中提取租户 ID
 * 常见的租户识别方式，适用于 API 网关、代理服务器等场景
 *
 * 特性：
 * - 支持自定义请求头名称
 * - 大小写不敏感的请求头匹配
 * - 简单直接的解析逻辑
 * - 默认使用 'x-tenant-id' 请求头
 *
 * 使用场景：
 * - API 网关转发请求时携带租户信息
 * - 微服务架构中的租户上下文传递
 * - 移动应用通过自定义请求头传递租户 ID
 *
 * @param headerName 请求头名称，默认为 DEFAULT_TENANT_HEADER ('x-tenant-id')
 * @returns 租户解析器函数
 *
 * @example
 * ```typescript
 * // 使用默认请求头
 * const resolver = createHeaderResolver();
 * // 解析请求: GET /api/data with x-tenant-id: tenant-001
 * const tenant = await resolver({ headers: { 'x-tenant-id': 'tenant-001' } });
 * // 返回: { id: 'tenant-001', status: 'active' }
 *
 * // 使用自定义请求头
 * const resolver = createHeaderResolver('x-company-id');
 * const tenant = await resolver({ headers: { 'x-company-id': 'company-abc' } });
 *
 * // 大小写不敏感
 * const resolver = createHeaderResolver('X-Tenant-ID');
 * const tenant = await resolver({ headers: { 'x-tenant-id': 'tenant-001' } }); // 也能匹配
 *
 * // 在 Express 中间件中使用
 * app.use(async (req, res, next) => {
 *   const resolver = createHeaderResolver();
 *   const tenant = await resolver(req);
 *   if (tenant) {
 *     TenantContextHolder.set(tenant);
 *   }
 *   next();
 * });
 * ```
 */
export function createHeaderResolver(
  headerName: string = DEFAULT_TENANT_HEADER
): TenantResolver<{ headers: Record<string, string | undefined> }> {
  return request => {
    // 尝试从请求头获取租户 ID，支持大小写不敏感
    const tenantId = request.headers[headerName] ?? request.headers[headerName.toLowerCase()];

    // 如果未找到租户 ID，返回 null
    if (!tenantId) {
      return null;
    }

    // 创建租户上下文
    return createTenantContext(tenantId);
  };
}

/**
 * 创建基于子域名的租户解析器
 * 从 HTTP 请求的子域名中提取租户 ID
 * 典型的多租户 SaaS 应用模式，每个租户拥有独立子域名
 *
 * 特性：
 * - 基于域名结构的租户识别
 * - 自动过滤根域名和无效子域名
 * - 支持嵌套子域名的验证
 * - 适用于多租户 SaaS 应用
 *
 * 使用场景：
 * - B2B SaaS 平台（tenant1.example.com, tenant2.example.com）
 * - 企业内部系统多租户场景
 * - 需要独立域名的租户隔离
 *
 * 域名结构：
 * - 输入: tenant1.example.com
 * - 基础域名: example.com
 * - 子域名: tenant1
 * - 租户 ID: tenant1
 *
 * @param baseDomain 基础域名，例如 'example.com'
 * @returns 租户解析器函数
 *
 * @example
 * ```typescript
 * // 基本用法
 * const resolver = createSubdomainResolver('example.com');
 * const tenant = await resolver({ hostname: 'tenant1.example.com' });
 * // 返回: { id: 'tenant1', status: 'active' }
 *
 * // 根域名不匹配
 * const tenant = await resolver({ hostname: 'example.com' });
 * // 返回: null
 *
 * // 嵌套子域名被拒绝
 * const tenant = await resolver({ hostname: 'app.tenant1.example.com' });
 * // 返回: null（包含点号，被视为无效）
 *
 * // 在不同基础域名下
 * const resolver = createSubdomainResolver('myapp.io');
 * const tenant = await resolver({ hostname: 'acme.myapp.io' });
 * // 返回: { id: 'acme', status: 'active' }
 *
 * // 在中间件中使用
 * app.use(async (req, res, next) => {
 *   const resolver = createSubdomainResolver('example.com');
 *   const tenant = await resolver(req);
 *   if (tenant) {
 *     TenantContextHolder.set(tenant);
 *   }
 *   next();
 * });
 * ```
 */
export function createSubdomainResolver(baseDomain: string): TenantResolver<{ hostname: string }> {
  // 验证 baseDomain 参数
  if (!baseDomain || typeof baseDomain !== 'string' || baseDomain.trim() === '') {
    throw new InvalidTenantError('Base domain must be a non-empty string');
  }

  // 验证域名格式（至少包含一个点）
  if (!baseDomain.includes('.') || baseDomain.startsWith('.') || baseDomain.endsWith('.')) {
    throw new InvalidTenantError('Invalid base domain format');
  }

  return request => {
    const { hostname } = request;

    // 检查主机名是否以基础域名结尾
    if (!hostname.endsWith(baseDomain)) {
      return null;
    }

    // 提取子域名部分
    // 例如: 'tenant1.example.com' - 'example.com'.length + 1 = 'tenant1'
    const subdomain = hostname.slice(0, -(baseDomain.length + 1));

    // 验证子域名有效性：不能为空且不能包含点号（避免嵌套子域名）
    if (!subdomain || subdomain.includes('.')) {
      return null;
    }

    // 创建租户上下文
    return createTenantContext(subdomain);
  };
}

/**
 * 创建基于路径的租户解析器
 * 从 URL 路径中提取租户 ID
 * 适用于 RESTful API 的多租户实现，租户 ID 作为路径前缀
 *
 * 特性：
 * - 基于 URL 路径的租户识别
 * - 可配置路径前缀
 * - 自动提取路径中的租户标识符
 * - 简单的路径匹配逻辑
 *
 * 使用场景：
 * - RESTful API 多租户实现
 * - 简单的多租户应用
 * - 需要在 URL 中明确展示租户的场景
 *
 * 路径结构：
 * - 前缀: '/tenant/'
 * - 完整路径: '/tenant/tenant-001/users'
 * - 租户 ID: 'tenant-001'
 *
 * @param prefix 路径前缀，默认为 '/tenant/'
 * @returns 租户解析器函数
 *
 * @example
 * ```typescript
 * // 使用默认前缀
 * const resolver = createPathResolver();
 * const tenant = await resolver({ path: '/tenant/tenant-001/users' });
 * // 返回: { id: 'tenant-001', status: 'active' }
 *
 * // 自定义前缀
 * const resolver = createPathResolver('/org/');
 * const tenant = await resolver({ path: '/org/company-abc/dashboard' });
 * // 返回: { id: 'company-abc', status: 'active' }
 *
 * // 路径不匹配前缀
 * const tenant = await resolver({ path: '/api/users' });
 * // 返回: null
 *
 * // 空租户 ID
 * const tenant = await resolver({ path: '/tenant/' });
 * // 返回: null
 *
 * // 在 Express 路由中使用
 * app.get('/api/:tenant/users', async (req, res, next) => {
 *   const resolver = createPathResolver('/tenant/');
 *   const tenant = await resolver(req);
 *   if (tenant) {
 *     console.log(`访问租户: ${tenant.id}`);
 *   }
 *   next();
 * });
 * ```
 */
export function createPathResolver(prefix: string = '/tenant/'): TenantResolver<{ path: string }> {
  // 验证 prefix 参数
  if (!prefix || typeof prefix !== 'string' || prefix.trim() === '') {
    throw new InvalidTenantError('Path prefix must be a non-empty string');
  }

  // 验证前缀格式（必须以斜杠开头）
  if (!prefix.startsWith('/')) {
    throw new InvalidTenantError('Path prefix must start with /');
  }

  return request => {
    const { path } = request;

    // 检查路径是否以前缀开始
    if (!path.startsWith(prefix)) {
      return null;
    }

    // 提取前缀后的剩余路径
    const remaining = path.slice(prefix.length);
    // 获取第一个路径段作为租户 ID
    const tenantId = remaining.split('/')[0];

    // 如果租户 ID 为空，返回 null
    if (!tenantId) {
      return null;
    }

    // 创建租户上下文
    return createTenantContext(tenantId);
  };
}

/**
 * 创建基于查询参数的租户解析器
 * 从 URL 查询参数中提取租户 ID
 * 最简单的租户识别方式，适用于测试或简单场景
 *
 * 特性：
 * - 基于 URL 查询参数的租户识别
 * - 可配置参数名称
 * - 简单直接的解析逻辑
 * - 适用于 GET 请求和表单提交
 *
 * 使用场景：
 * - 开发测试环境
 * - 简单的多租户演示
 * - 临时租户访问
 * - 需要手动指定租户的场景
 *
 * 查询参数结构：
 * - URL: '/api/data?tenant=tenant-001'
 * - 参数名: 'tenant'
 * - 参数值: 'tenant-001'
 * - 租户 ID: 'tenant-001'
 *
 * @param paramName 查询参数名称，默认为 'tenant'
 * @returns 租户解析器函数
 *
 * @example
 * ```typescript
 * // 使用默认参数名
 * const resolver = createQueryResolver();
 * const tenant = await resolver({ query: { tenant: 'tenant-001' } });
 * // 返回: { id: 'tenant-001', status: 'active' }
 *
 * // 自定义参数名
 * const resolver = createQueryResolver('company');
 * const tenant = await resolver({ query: { company: 'acme-corp' } });
 * // 返回: { id: 'acme-corp', status: 'active' }
 *
 * // 参数不存在
 * const tenant = await resolver({ query: { other: 'value' } });
 * // 返回: null
 *
 * // 在前端链接中使用
 * const link = `/api/data?tenant=${encodeURIComponent('tenant-001')}`;
 *
 * // 在 HTML 表单中使用
 * <form action="/api/submit" method="get">
 *   <input type="hidden" name="tenant" value="tenant-001" />
 * </form>
 *
 * // 在测试中模拟
 * const mockRequest = {
 *   query: { tenant: 'test-tenant' }
 * };
 * const tenant = await resolver(mockRequest);
 * ```
 */
export function createQueryResolver(
  paramName: string = 'tenant'
): TenantResolver<{ query: Record<string, string | undefined> }> {
  // 验证 paramName 参数
  if (!paramName || typeof paramName !== 'string' || paramName.trim() === '') {
    throw new InvalidTenantError('Parameter name must be a non-empty string');
  }

  return request => {
    // 从查询参数中获取租户 ID
    const tenantId = request.query[paramName];

    // 如果参数不存在，返回 null
    if (!tenantId) {
      return null;
    }

    // 创建租户上下文
    return createTenantContext(tenantId);
  };
}

/**
 * 创建复合租户解析器
 * 依次尝试多个解析策略，直到找到有效的租户或所有策略都失败
 * 结合多种租户识别方式，提高解析成功率和灵活性
 *
 * 特性：
 * - 依次尝试多个解析器
 * - 短路求值：一旦找到有效租户就返回
 * - 支持异步解析器
 * - 可组合多种解析策略
 *
 * 优先级策略：
 * 1. 子域名解析（最高优先级）
 * 2. 请求头解析
 * 3. 查询参数解析（最低优先级）
 *
 * 使用场景：
 * - 需要支持多种租户识别方式的复杂应用
 * - 渐进式租户识别
 * - 兼容不同客户端的租户传递方式
 *
 * @param resolvers 要依次尝试的解析器列表
 * @returns 复合解析器函数
 *
 * @example
 * ```typescript
 * // 组合多种解析方式
 * const resolver = createCompositeResolver(
 *   createSubdomainResolver('example.com'),
 *   createHeaderResolver(),
 *   createQueryResolver()
 * );
 *
 * // 场景1: 通过子域名访问
 * const tenant = await resolver({ hostname: 'tenant1.example.com' });
 * // 返回: { id: 'tenant1', status: 'active' }
 *
 * // 场景2: 通过请求头传递
 * const tenant = await resolver({
 *   hostname: 'api.example.com',
 *   headers: { 'x-tenant-id': 'tenant2' }
 * });
 * // 返回: { id: 'tenant2', status: 'active' }
 *
 * // 场景3: 通过查询参数传递
 * const tenant = await resolver({
 *   hostname: 'api.example.com',
 *   headers: {},
 *   query: { tenant: 'tenant3' }
 * });
 * // 返回: { id: 'tenant3', status: 'active' }
 *
 * // 场景4: 都没有提供
 * const tenant = await resolver({
 *   hostname: 'api.example.com',
 *   headers: {},
 *   query: {}
 * });
 * // 返回: null
 *
 * // 在应用中配置
 * const tenantResolver = createCompositeResolver(
 *   createSubdomainResolver(process.env.BASE_DOMAIN!),
 *   createHeaderResolver(),
 *   createPathResolver('/tenant/'),
 *   createQueryResolver('tenant')
 * );
 * ```
 */
export function createCompositeResolver<T>(...resolvers: TenantResolver<T>[]): TenantResolver<T> {
  // 验证 resolvers 参数
  if (!resolvers || resolvers.length === 0) {
    throw new InvalidTenantError('At least one resolver must be provided');
  }

  return async request => {
    // 依次尝试每个解析器
    for (const resolver of resolvers) {
      const tenant = await resolver(request);
      // 如果找到有效租户，立即返回
      if (tenant) {
        return tenant;
      }
    }
    // 所有解析器都失败，返回 null
    return null;
  };
}

/**
 * 创建带后备的租户解析器
 * 当主解析器无法解析到租户时，使用指定的后备租户
 * 确保始终有租户上下文可用，适用于单租户模式或多租户模式的回退
 *
 * 特性：
 * - 保证始终有租户上下文返回
 * - 支持异步解析器
 * - 可配置后备租户
 * - 优雅降级机制
 *
 * 使用场景：
 * - 单租户应用的后备方案
 * - 新用户的默认租户
 * - 系统维护模式的特殊租户
 * - 确保应用始终有租户上下文的场景
 *
 * @param resolver 主解析器
 * @param fallback 后备租户上下文
 * @returns 带后备的解析器函数
 *
 * @example
 * ```typescript
 * // 创建后备租户
 * const fallbackTenant = createTenantContext('default');
 *
 * // 带后备的解析器
 * const resolver = createResolverWithFallback(
 *   createSubdomainResolver('example.com'),
 *   fallbackTenant
 * );
 *
 * // 场景1: 主解析器成功
 * const tenant = await resolver({ hostname: 'tenant1.example.com' });
 * // 返回: { id: 'tenant1', status: 'active' }
 *
 * // 场景2: 主解析器失败，使用后备
 * const tenant = await resolver({ hostname: 'example.com' });
 * // 返回: { id: 'default', status: 'active' }
 *
 * // 创建系统租户作为后备
 * const systemTenant = createSystemTenant();
 * const resolver = createResolverWithFallback(
 *   createHeaderResolver(),
 *   systemTenant
 * );
 *
 * // 在单租户应用中使用
 * const resolver = createResolverWithFallback(
 *   createCompositeResolver(
 *     createSubdomainResolver('myapp.com'),
 *     createHeaderResolver()
 *   ),
 *   DEFAULT_TENANT // 单租户模式的默认租户
 * );
 *
 * // 在中间件中使用
 * app.use(async (req, res, next) => {
 *   const resolver = createResolverWithFallback(
 *     createHeaderResolver(),
 *     DEFAULT_TENANT
 *   );
 *   const tenant = await resolver(req);
 *   // 确保 tenant 永不为 null
 *   TenantContextHolder.set(tenant);
 *   next();
 * });
 * ```
 */
export function createResolverWithFallback<T>(
  resolver: TenantResolver<T>,
  fallback: TenantContext
): TenantResolver<T> {
  // 验证 resolver 参数
  if (!resolver || typeof resolver !== 'function') {
    throw new InvalidTenantError('Resolver must be a function');
  }

  // 验证 fallback 参数
  if (!fallback || !fallback.id) {
    throw new InvalidTenantError('Fallback tenant must have a valid ID');
  }

  return async request => {
    // 尝试使用主解析器
    const tenant = await resolver(request);
    // 如果解析失败，使用后备租户
    return tenant ?? fallback;
  };
}

/**
 * 创建带验证的租户解析器
 * 在解析出租户后，使用自定义验证器验证租户的有效性
 * 可确保租户不仅存在，而且满足特定条件（如状态、权限等）
 *
 * 特性：
 * - 解析后进行二次验证
 * - 支持异步验证器
 * - 可自定义验证逻辑
 * - 提供额外的安全层
 *
 * 验证场景：
 * - 验证租户状态（必须为 active）
 * - 验证租户是否在白名单中
 * - 验证租户权限
 * - 验证租户是否在有效期
 * - 自定义业务规则验证
 *
 * @param resolver 基础解析器
 * @param validator 验证函数，接收租户上下文，返回布尔值
 * @returns 带验证的解析器函数
 *
 * @example
 * ```typescript
 * // 验证租户状态
 * const resolver = createValidatingResolver(
 *   createHeaderResolver(),
 *   (tenant) => tenant.status === 'active'
 * );
 *
 * // 异步验证（从数据库检查租户是否有效）
 * const resolver = createValidatingResolver(
 *   createHeaderResolver(),
 *   async (tenant) => {
 *     const dbTenant = await db.tenants.findUnique({ where: { id: tenant.id } });
 *     return dbTenant !== null && dbTenant.status === 'active';
 *   }
 * );
 *
 * // 多条件验证
 * const resolver = createValidatingResolver(
 *   createSubdomainResolver('example.com'),
 *   (tenant) => {
 *     return tenant.status === 'active' &&
 *            tenant.metadata?.plan === 'enterprise';
 *   }
 * );
 *
 * // 白名单验证
 * const allowedTenants = new Set(['tenant1', 'tenant2', 'tenant3']);
 * const resolver = createValidatingResolver(
 *   createHeaderResolver(),
 *   (tenant) => allowedTenants.has(tenant.id)
 * );
 *
 * // 验证租户权限
 * const resolver = createValidatingResolver(
 *   createHeaderResolver(),
 *   async (tenant) => {
 *     const permissions = await getTenantPermissions(tenant.id);
 *     return permissions.includes('api_access');
 *   }
 * );
 *
 * // 在中间件中使用
 * app.use(async (req, res, next) => {
 *   const resolver = createValidatingResolver(
 *     createCompositeResolver(
 *       createSubdomainResolver('example.com'),
 *       createHeaderResolver()
 *     ),
 *     async (tenant) => {
 *       // 验证租户是否在数据库中存在且状态正常
 *       const dbTenant = await tenantManager.getTenant(tenant.id);
 *       return dbTenant !== null && dbTenant.status === 'active';
 *     }
 *   );
 *
 *   try {
 *     const tenant = await resolver(req);
 *     if (tenant) {
 *       TenantContextHolder.set(tenant);
 *     }
 *     next();
 *   } catch (error) {
 *     res.status(403).json({ error: '租户验证失败' });
 *   }
 * });
 * ```
 */
export function createValidatingResolver<T>(
  resolver: TenantResolver<T>,
  validator: (tenant: TenantContext) => Promise<boolean> | boolean
): TenantResolver<T> {
  // 验证 resolver 参数
  if (!resolver || typeof resolver !== 'function') {
    throw new InvalidTenantError('Resolver must be a function');
  }

  // 验证 validator 参数
  if (!validator || typeof validator !== 'function') {
    throw new InvalidTenantError('Validator must be a function');
  }

  return async request => {
    // 首先解析租户
    const tenant = await resolver(request);

    // 如果没有解析到租户，返回 null
    if (!tenant) {
      return null;
    }

    // 验证租户有效性
    const isValid = await validator(tenant);
    // 只有通过验证的租户才被返回
    return isValid ? tenant : null;
  };
}
