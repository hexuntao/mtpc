import type { z } from 'zod';

/**
 * 任意 Zod 模式类型
 * 用于表示任何有效的 Zod 验证模式
 *
 * @example
 * ```typescript
 * const schema: AnyZodSchema = z.string();
 * const numSchema: AnyZodSchema = z.number();
 * ```
 */
export type AnyZodSchema = z.ZodTypeAny;

/**
 * 从 Zod 模式推断 TypeScript 类型
 * 提取 Zod 验证模式对应的运行时类型
 *
 * @example
 * ```typescript
 * const userSchema = z.object({
 *   id: z.string(),
 *   name: z.string()
 * });
 * type User = InferSchema<typeof userSchema>;
 * // 推断为: { id: string; name: string }
 * ```
 */
export type InferSchema<T extends AnyZodSchema> = z.infer<T>;

/**
 * 基础实体接口
 * 包含所有实体的通用字段
 *
 * @example
 * ```typescript
 * interface Product extends BaseEntity {
 *   name: string;
 *   price: number;
 * }
 * ```
 */
export interface BaseEntity {
  /** 实体唯一标识符 */
  id: string;
  /** 创建时间 */
  createdAt: Date;
  /** 最后更新时间 */
  updatedAt: Date;
}

/**
 * 租户作用域实体
 * 继承自 BaseEntity，并添加租户隔离字段
 *
 * @example
 * ```typescript
 * interface Order extends TenantScopedEntity {
 *   orderNumber: string;
 *   total: number;
 * }
 * // 所有订单都属于特定租户
 * ```
 */
export interface TenantScopedEntity extends BaseEntity {
  /** 租户标识符，用于多租户隔离 */
  tenantId: string;
}

/**
 * 分页选项
 * 用于控制列表查询的分页行为
 *
 * @example
 * ```typescript
 * const options: PaginationOptions = {
 *   page: 1,        // 第1页
 *   pageSize: 20,   // 每页20条
 *   cursor: 'abc123' // 游标分页（可选）
 * };
 * ```
 */
export interface PaginationOptions {
  /** 页码（从1开始） */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 游标（用于游标分页） */
  cursor?: string;
}

/**
 * 分页结果
 * 返回分页查询的结果集
 *
 * @example
 * ```typescript
 * const result: PaginatedResult<User> = {
 *   data: [user1, user2, user3],
 *   total: 100,
 *   page: 1,
 *   pageSize: 20,
 *   totalPages: 5,
 *   hasNext: true,
 *   hasPrev: false
 * };
 * ```
 */
export interface PaginatedResult<T> {
  /** 当前页的数据列表 */
  data: T[];
  /** 总记录数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
}

/**
 * 游标分页结果
 * 基于游标的分页结果，适用于大量数据
 *
 * @example
 * ```typescript
 * const result: CursorPaginatedResult<User> = {
 *   data: [user1, user2, user3],
 *   nextCursor: 'xyz789',
 *   prevCursor: 'abc123',
 *   hasNext: true,
 *   hasPrev: true
 * };
 * ```
 */
export interface CursorPaginatedResult<T> {
  /** 当前页的数据列表 */
  data: T[];
  /** 下一页游标（无下一页时为null） */
  nextCursor: string | null;
  /** 上一页游标（无上一页时为null） */
  prevCursor: string | null;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrev: boolean;
}

/**
 * 排序方向
 * 指定排序是升序还是降序
 *
 * @example
 * ```typescript
 * const sortAsc: SortDirection = 'asc';
 * const sortDesc: SortDirection = 'desc';
 * ```
 */
export type SortDirection = 'asc' | 'desc';

/**
 * 排序选项
 * 指定按哪个字段排序以及排序方向
 *
 * @example
 * ```typescript
 * const sortOptions: SortOptions = {
 *   field: 'name',
 *   direction: 'asc'
 * };
 *
 * // 多字段排序
 * const multiSort: SortOptions[] = [
 *   { field: 'status', direction: 'asc' },
 *   { field: 'createdAt', direction: 'desc' }
 * ];
 * ```
 */
export interface SortOptions<T = string> {
  /** 排序字段名 */
  field: T;
  /** 排序方向 */
  direction: SortDirection;
}

/**
 * 过滤操作符
 * 用于构建查询过滤条件
 *
 * @example
 * ```typescript
 * // 名称等于 'John'
 * { field: 'name', operator: 'eq', value: 'John' }
 *
 * // 年龄大于18
 * { field: 'age', operator: 'gt', value: 18 }
 *
 * // 状态在 ['active', 'pending'] 中
 * { field: 'status', operator: 'in', value: ['active', 'pending'] }
 *
 * // 描述包含 'important'
 * { field: 'description', operator: 'contains', value: 'important' }
 * ```
 */
export type FilterOperator =
  | 'eq'          // 等于
  | 'neq'         // 不等于
  | 'gt'          // 大于
  | 'gte'         // 大于等于
  | 'lt'          // 小于
  | 'lte'         // 小于等于
  | 'in'          // 在列表中
  | 'notIn'       // 不在列表中
  | 'contains'    // 包含（字符串或数组）
  | 'startsWith'  // 以...开头
  | 'endsWith'    // 以...结尾
  | 'isNull'      // 为空
  | 'isNotNull';  // 不为空

/**
 * 过滤条件
 * 用于构建复杂的查询过滤条件
 *
 * @example
 * ```typescript
 * const conditions: FilterCondition[] = [
 *   { field: 'status', operator: 'eq', value: 'active' },
 *   { field: 'age', operator: 'gte', value: 18 },
 *   { field: 'tags', operator: 'contains', value: 'vip' }
 * ];
 * ```
 */
export interface FilterCondition<T = unknown> {
  /** 要过滤的字段名 */
  field: string;
  /** 过滤操作符 */
  operator: FilterOperator;
  /** 过滤值 */
  value: T;
}

/**
 * 查询选项
 * 包含分页、排序、过滤等所有查询参数
 *
 * @example
 * ```typescript
 * const query: QueryOptions = {
 *   pagination: { page: 1, pageSize: 20 },
 *   sort: [{ field: 'createdAt', direction: 'desc' }],
 *   filters: [
 *     { field: 'status', operator: 'eq', value: 'active' },
 *     { field: 'age', operator: 'gte', value: 18 }
 *   ]
 * };
 * ```
 */
export interface QueryOptions<T = string> {
  /** 分页参数 */
  pagination?: PaginationOptions;
  /** 排序参数 */
  sort?: SortOptions<T>[];
  /** 过滤条件 */
  filters?: FilterCondition[];
}

/**
 * 操作结果
 * 统一的操作返回格式
 *
 * @example
 * ```typescript
 * // 成功结果
 * const successResult: OperationResult<User> = {
 *   success: true,
 *   data: user
 * };
 *
 * // 失败结果
 * const errorResult: OperationResult = {
 *   success: false,
 *   error: {
 *     code: 'USER_NOT_FOUND',
 *     message: '用户不存在',
 *     details: { userId: '123' }
 *   }
 * };
 * ```
 */
export interface OperationResult<T = unknown> {
  /** 操作是否成功 */
  success: boolean;
  /** 成功时返回的数据 */
  data?: T;
  /** 失败时的错误信息 */
  error?: {
    /** 错误代码 */
    code: string;
    /** 错误消息 */
    message: string;
    /** 额外的错误详情 */
    details?: Record<string, unknown>;
  };
}
