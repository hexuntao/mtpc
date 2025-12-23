import type { FilterCondition, QueryOptions } from './common.js';
import type { MTPCContext } from './context.js';

/**
 * 钩子执行结果
 * 所有钩子函数的统一返回格式
 *
 * @example
 * ```typescript
 * // 允许继续执行
 * const allowResult: HookResult = {
 *   proceed: true
 * };
 *
 * // 阻止执行并返回自定义数据
 * const customResult: HookResult<string> = {
 *   proceed: true,
 *   data: 'modified-data'
 * };
 *
 * // 阻止执行（中断流程）
 * const blockResult: HookResult = {
 *   proceed: false,
 *   error: new Error('操作被拒绝')
 * };
 * ```
 */
export interface HookResult<T = unknown> {
  /** 是否继续执行后续操作 */
  proceed: boolean;
  /** 可选的返回数据（修改后的数据等） */
  data?: T;
  /** 可选的错误信息（用于阻止操作） */
  error?: Error;
}

/**
 * 创建前钩子
 * 在创建资源实例之前执行，可用于数据验证、修改等
 *
 * @example
 * ```typescript
 * // 数据验证
 * const validateUser: BeforeCreateHook<User> = async (ctx, data) => {
 *   if (!data.email) {
 *     return { proceed: false, error: new Error('邮箱不能为空') };
 *   }
 *   return { proceed: true };
 * };
 *
 * // 数据修改（添加默认值）
 * const setDefaults: BeforeCreateHook<User> = async (ctx, data) => {
 *   return {
 *     proceed: true,
 *     data: {
 *       ...data,
 *       createdAt: new Date(),
 *       status: 'active'
 *     }
 *   };
 * };
 * ```
 *
 * @param context MTPC 上下文（租户、主体、请求信息）
 * @param data 要创建的数据
 * @returns 钩子结果（是否继续 + 可选的数据修改）
 */
export type BeforeCreateHook<T = unknown> = (
  context: MTPCContext,
  data: T
) => Promise<HookResult<T>> | HookResult<T>;

/**
 * 创建后钩子
 * 在资源实例创建成功后执行，可用于发送通知、记录日志等
 *
 * @example
 * ```typescript
 * // 发送欢迎邮件
 * const sendWelcomeEmail: AfterCreateHook<User> = async (ctx, data, created) => {
 *   await emailService.sendWelcomeEmail(created.email);
 * };
 *
 * // 记录审计日志
 * const auditLog: AfterCreateHook<User> = async (ctx, data, created) => {
 *   await auditLogger.log({
 *     action: 'create',
 *     resource: 'user',
 *     resourceId: created.id,
 *     userId: ctx.subject.id,
 *     timestamp: new Date()
 *   });
 * };
 * ```
 *
 * @param context MTPC 上下文
 * @param data 原始创建数据
 * @param created 创建后的完整实例
 * @returns Promise<void> 或 void（异步或同步）
 */
export type AfterCreateHook<T = unknown> = (
  context: MTPCContext,
  data: T,
  created: T
) => Promise<void> | void;

/**
 * 读取前钩子
 * 在读取资源实例之前执行，可用于权限检查、数据过滤等
 *
 * @example
 * ```typescript
 * // 权限检查
 * const checkReadPermission: BeforeReadHook = async (ctx, id) => {
 *   if (ctx.subject.type === 'anonymous') {
 *     return { proceed: false, error: new Error('匿名用户无法查看') };
 *   }
 *   return { proceed: true };
 * };
 *
 * // 数据脱敏
 * const maskSensitiveData: BeforeReadHook = async (ctx, id) => {
 *   return {
 *     proceed: true,
 *     data: id // 返回要读取的 ID
 *   };
 * };
 * ```
 *
 * @param context MTPC 上下文
 * @param id 资源实例 ID
 * @returns 钩子结果
 */
export type BeforeReadHook = (
  context: MTPCContext,
  id: string
) => Promise<HookResult<string>> | HookResult<string>;

/**
 * 读取后钩子
 * 在资源实例读取后执行，可用于数据脱敏、格式转换等
 *
 * @example
 * ```typescript
 * // 数据脱敏
 * const maskUserData: AfterReadHook<User> = async (ctx, id, data) => {
 *   if (!data) return null;
 *
 *   return {
 *     ...data,
 *     email: maskEmail(data.email),
 *     phone: maskPhone(data.phone)
 *   };
 * };
 *
 * // 添加计算字段
 * const addComputedFields: AfterReadHook<Product> = async (ctx, id, data) => {
 *   if (!data) return null;
 *
 *   return {
 *     ...data,
 *     discountedPrice: calculateDiscount(data.price, data.discount)
 *   };
 * };
 * ```
 *
 * @param context MTPC 上下文
 * @param id 资源实例 ID
 * @param data 读取到的数据（可能为 null）
 * @returns 处理后的数据
 */
export type AfterReadHook<T = unknown> = (
  context: MTPCContext,
  id: string,
  data: T | null
) => Promise<T | null> | T | null;

/**
 * 更新前钩子
 * 在更新资源实例之前执行，可用于数据验证、并发控制等
 *
 * @example
 * ```typescript
 * // 数据验证
 * const validateUpdate: BeforeUpdateHook<User> = async (ctx, id, data) => {
 *   if (data.email && !isValidEmail(data.email)) {
 *     return { proceed: false, error: new Error('邮箱格式无效') };
 *   }
 *   return { proceed: true };
 * };
 *
 * // 乐观锁（版本控制）
 * const optimisticLock: BeforeUpdateHook<User> = async (ctx, id, data) => {
 *   const existing = await getUserById(id);
 *   if (existing.version !== data.version) {
 *     return { proceed: false, error: new Error('数据已过期，请刷新后重试') };
 *   }
 *   return { proceed: true };
 * };
 * ```
 *
 * @param context MTPC 上下文
 * @param id 资源实例 ID
 * @param data 要更新的数据（部分字段）
 * @returns 钩子结果
 */
export type BeforeUpdateHook<T = unknown> = (
  context: MTPCContext,
  id: string,
  data: Partial<T>
) => Promise<HookResult<Partial<T>>> | HookResult<Partial<T>>;

/**
 * 更新后钩子
 * 在资源实例更新后执行，可用于发送通知、触发事件等
 *
 * @example
 * ```typescript
 * // 发送更新通知
 * const notifyUpdate: AfterUpdateHook<User> = async (ctx, id, data, updated) => {
 *   await notificationService.sendUserUpdatedNotification(updated.id);
 * };
 *
 * // 清理缓存
 * const clearCache: AfterUpdateHook<Product> = async (ctx, id, data, updated) => {
 *   await cache.delete(`product:${id}`);
 *   await cache.delete(`products:list`);
 * };
 * ```
 *
 * @param context MTPC 上下文
 * @param id 资源实例 ID
 * @param data 原始更新数据
 * @param updated 更新后的完整实例
 * @returns Promise<void> 或 void
 */
export type AfterUpdateHook<T = unknown> = (
  context: MTPCContext,
  id: string,
  data: Partial<T>,
  updated: T
) => Promise<void> | void;

/**
 * 删除前钩子
 * 在删除资源实例之前执行，可用于权限检查、软删除等
 *
 * @example
 * ```typescript
 * // 权限检查
 * const checkDeletePermission: BeforeDeleteHook = async (ctx, id) => {
 *   const user = await getUserById(id);
 *   if (user.role === 'admin') {
 *     return { proceed: false, error: new Error('不能删除管理员账户') };
 *   }
 *   return { proceed: true };
 * };
 *
 * // 软删除
 * const softDelete: BeforeDeleteHook = async (ctx, id) => {
 *   // 将删除操作转换为更新操作
 *   await updateUser(id, { deletedAt: new Date() });
 *   return { proceed: false, data: id }; // 阻止物理删除
 * };
 * ```
 *
 * @param context MTPC 上下文
 * @param id 资源实例 ID
 * @returns 钩子结果
 */
export type BeforeDeleteHook = (
  context: MTPCContext,
  id: string
) => Promise<HookResult<string>> | HookResult<string>;

/**
 * 删除后钩子
 * 在资源实例删除后执行，可用于清理相关数据、记录日志等
 *
 * @example
 * ```typescript
 * // 清理相关数据
 * const cleanupRelatedData: AfterDeleteHook<Order> = async (ctx, id, deleted) => {
 *   await deleteOrderItems(id);
 *   await deleteOrderHistory(id);
 * };
 *
 * // 记录删除日志
 * const auditLog: AfterDeleteHook<User> = async (ctx, id, deleted) => {
 *   await auditLogger.log({
 *     action: 'delete',
 *     resource: 'user',
 *     resourceId: id,
 *     userId: ctx.subject.id,
 *     timestamp: new Date(),
 *     metadata: { deletedData: deleted }
 *   });
 * };
 * ```
 *
 * @param context MTPC 上下文
 * @param id 资源实例 ID
 * @param deleted 被删除的实例数据
 * @returns Promise<void> 或 void
 */
export type AfterDeleteHook<T = unknown> = (
  context: MTPCContext,
  id: string,
  deleted: T
) => Promise<void> | void;

/**
 * 列表查询前钩子
 * 在列表查询之前执行，可用于添加默认过滤、权限过滤等
 *
 * @example
 * ```typescript
 * // 添加租户过滤
 * const addTenantFilter: BeforeListHook = async (ctx, options) => {
 *   return {
 *     proceed: true,
 *     data: {
 *       ...options,
 *       filters: [
 *         ...(options.filters || []),
 *         { field: 'tenantId', operator: 'eq', value: ctx.tenant.id }
 *       ]
 *     }
 *   };
 * };
 *
 * // 添加权限过滤
 * const addPermissionFilter: BeforeListHook = async (ctx, options) => {
 *   // 基于用户角色过滤可见数据
 *   if (ctx.subject.roles.includes('manager')) {
 *     return {
 *       proceed: true,
 *       data: options
 *     };
 *   }
 *   // 普通用户只能看到自己的数据
 *   return {
 *     proceed: true,
 *     data: {
 *       ...options,
 *       filters: [
 *         ...(options.filters || []),
 *         { field: 'ownerId', operator: 'eq', value: ctx.subject.id }
 *       ]
 *     }
 *   };
 * };
 * ```
 *
 * @param context MTPC 上下文
 * @param options 查询选项（分页、排序、过滤）
 * @returns 钩子结果（可修改查询选项）
 */
export type BeforeListHook = (
  context: MTPCContext,
  options: QueryOptions
) => Promise<HookResult<QueryOptions>> | HookResult<QueryOptions>;

/**
 * 列表查询后钩子
 * 在列表查询后执行，可用于数据脱敏、排序、统计等
 *
 * @example
 * ```typescript
 * // 数据脱敏
 * const maskUserData: AfterListHook<User> = async (ctx, options, results) => {
 *   return results.map(user => ({
 *     ...user,
 *     email: maskEmail(user.email)
 *   }));
 * };
 *
 * // 添加分页统计
 * const addPaginationStats: AfterListHook<Order> = async (ctx, options, results) => {
 *   // 这里可以在结果中添加额外信息
 *   // 例如：统计信息、汇总数据等
 *   return results;
 * };
 * ```
 *
 * @param context MTPC 上下文
 * @param options 原始查询选项
 * @param results 查询结果列表
 * @returns 处理后的结果列表
 */
export type AfterListHook<T = unknown> = (
  context: MTPCContext,
  options: QueryOptions,
  results: T[]
) => Promise<T[]> | T[];

/**
 * 查询过滤钩子
 * 用于行级安全控制（RLS），在查询时动态添加过滤条件
 *
 * @example
 * ```typescript
 * // 基于租户的数据隔离
 * const tenantIsolation: FilterQueryHook = async (ctx, baseFilters) => {
 *   // 确保用户只能访问自己租户的数据
 *   return [
 *     ...baseFilters,
 *     { field: 'tenantId', operator: 'eq', value: ctx.tenant.id }
 *   ];
 * };
 *
 * // 基于角色的数据过滤
 * const roleBasedFilter: FilterQueryHook = async (ctx, baseFilters) => {
 *   // 如果用户是经理，返回所有数据
 *   if (ctx.subject.roles.includes('manager')) {
 *     return baseFilters;
 *   }
 *
 *   // 如果是普通用户，只能看到自己的数据
 *   return [
 *     ...baseFilters,
 *     { field: 'ownerId', operator: 'eq', value: ctx.subject.id }
 *   ];
 * };
 *
 * // 动态数据权限
 * const dynamicPermission: FilterQueryHook = async (ctx, baseFilters) => {
 *   // 根据上下文动态决定过滤条件
 *   if (ctx.request.path.includes('/admin')) {
 *     // 管理员路径，无额外过滤
 *     return baseFilters;
 *   }
 *
 *   // 普通用户路径，添加数据范围限制
 *   return [
 *     ...baseFilters,
 *     { field: 'visibleTo', operator: 'in', value: ctx.subject.roles }
 *   ];
 * };
 * ```
 *
 * @param context MTPC 上下文
 * @param baseFilters 基础过滤条件
 * @returns 增强后的过滤条件列表
 */
export type FilterQueryHook = (
  context: MTPCContext,
  baseFilters: FilterCondition[]
) => Promise<FilterCondition[]> | FilterCondition[];

/**
 * 资源钩子集合
 * 定义资源支持的所有钩子函数
 *
 * @example
 * ```typescript
 * const userHooks: ResourceHooks<User> = {
 *   beforeCreate: [validateUser, setDefaults],
 *   afterCreate: [sendWelcomeEmail, auditLog],
 *   beforeRead: [checkReadPermission],
 *   afterRead: [maskUserData, addComputedFields],
 *   beforeUpdate: [validateUpdate, optimisticLock],
 *   afterUpdate: [notifyUpdate, clearCache],
 *   beforeDelete: [checkDeletePermission],
 *   afterDelete: [cleanupRelatedData, auditLog],
 *   beforeList: [addTenantFilter, addPermissionFilter],
 *   afterList: [maskUserData],
 *   filterQuery: [tenantIsolation, roleBasedFilter]
 * };
 * ```
 */
export interface ResourceHooks<T = unknown> {
  /** 创建前钩子列表 */
  beforeCreate?: BeforeCreateHook<T>[];
  /** 创建后钩子列表 */
  afterCreate?: AfterCreateHook<T>[];
  /** 读取前钩子列表 */
  beforeRead?: BeforeReadHook[];
  /** 读取后钩子列表 */
  afterRead?: AfterReadHook<T>[];
  /** 更新前钩子列表 */
  beforeUpdate?: BeforeUpdateHook<T>[];
  /** 更新后钩子列表 */
  afterUpdate?: AfterUpdateHook<T>[];
  /** 删除前钩子列表 */
  beforeDelete?: BeforeDeleteHook[];
  /** 删除后钩子列表 */
  afterDelete?: AfterDeleteHook<T>[];
  /** 列表查询前钩子列表 */
  beforeList?: BeforeListHook[];
  /** 列表查询后钩子列表 */
  afterList?: AfterListHook<T>[];
  /** 查询过滤钩子列表（行级安全） */
  filterQuery?: FilterQueryHook[];
}

/**
 * 全局钩子集合
 * 应用于所有资源的钩子函数
 *
 * @example
 * ```typescript
 * const globalHooks: GlobalHooks = {
 *   // 所有操作前执行
 *   beforeAny: [
 *     async (ctx, operation, resource) => {
 *       // 记录操作开始
 *       await auditLogger.operationStarted(ctx, operation, resource);
 *       return { proceed: true };
 *     }
 *   ],
 *
 *   // 所有操作后执行
 *   afterAny: [
 *     async (ctx, operation, resource, result) => {
 *       // 记录操作完成
 *       await auditLogger.operationCompleted(ctx, operation, resource, result);
 *     }
 *   ],
 *
 *   // 错误处理
 *   onError: [
 *     async (ctx, operation, resource, error) => {
 *       // 发送错误告警
 *       await alertService.sendErrorAlert(ctx, operation, resource, error);
 *     }
 *   ]
 * };
 * ```
 */
export interface GlobalHooks {
  /** 所有操作前执行的钩子（审计、性能监控等） */
  beforeAny?: ((
    context: MTPCContext,
    operation: string,
    resourceName: string
  ) => Promise<HookResult> | HookResult)[];
  /** 所有操作后执行的钩子（日志记录、通知等） */
  afterAny?: ((
    context: MTPCContext,
    operation: string,
    resourceName: string,
    result: unknown
  ) => Promise<void> | void)[];
  /** 错误处理钩子（告警、监控等） */
  onError?: ((
    context: MTPCContext,
    operation: string,
    resourceName: string,
    error: Error
  ) => Promise<void> | void)[];
}

/**
 * 创建空资源钩子集合
 * 初始化时返回空的钩子数组
 *
 * @example
 * ```typescript
 * // 创建一个新的资源定义
 * const resource = defineResource({
 *   name: 'product',
 *   schema: productSchema,
 *   hooks: createEmptyHooks<Product>()
 * });
 *
 * // 后续可以动态添加钩子
 * resource.hooks.beforeCreate.push(validateProduct);
 * ```
 *
 * @returns 空钩子集合
 */
export function createEmptyHooks<T = unknown>(): ResourceHooks<T> {
  return {
    beforeCreate: [],
    afterCreate: [],
    beforeRead: [],
    afterRead: [],
    beforeUpdate: [],
    afterUpdate: [],
    beforeDelete: [],
    afterDelete: [],
    beforeList: [],
    afterList: [],
    filterQuery: [],
  };
}
