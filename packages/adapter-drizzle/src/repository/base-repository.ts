import type {
  FilterCondition,
  MTPCContext,
  PaginatedResult,
  QueryOptions,
  SortOptions,
} from '@mtpc/core';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, like, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleDB, Repository } from '../types.js';

/**
 * 允许自定义 tenantColumn，默认仍为 tenantId
 */
export interface RepositoryOptions {
  /** default: "tenantId" */
  tenantColumn?: string;
}

/**
 * 基础仓储类
 * 实现通用的数据访问层 CRUD 操作
 *
 * **功能**：
 * - 基本的 CRUD 操作
 * - 分页查询
 * - 条件过滤
 * - 排序
 * - 软删除支持
 * - 自动租户隔离
 */
export class BaseRepository<T extends Record<string, unknown>> implements Repository<T> {
  /** 数据库实例 */
  protected db: DrizzleDB;
  /** Drizzle 表定义 */
  protected table: PgTable;
  /** 表名 */
  protected tableName: string;
  /** 表列 */
  protected tenantColumn: string;

  constructor(db: DrizzleDB, table: PgTable, tableName: string, options: RepositoryOptions = {}) {
    this.db = db;
    this.table = table;
    this.tableName = tableName;
    this.tenantColumn = options.tenantColumn ?? 'tenantId';
  }

  /**
   * 根据 ID 查找记录
   *
   * @param ctx - MTPC 上下文
   * @param id - 记录 ID
   * @returns 记录或 null
   */
  async findById(ctx: MTPCContext, id: string): Promise<T | null> {
    const tableAny = this.table as any;
    const tenantCol = tableAny[this.tenantColumn];

    const result = await this.db
      .select()
      .from(this.table)
      .where(and(eq(tableAny.id, id), eq(tenantCol, ctx.tenant.id)))
      .limit(1);

    return (result[0] as T) ?? null;
  }

  /**
   * 查询多条记录（带分页）
   *
   * @param ctx - MTPC 上下文
   * @param options - 查询选项（分页、排序、过滤）
   * @returns 分页结果
   */
  async findMany(ctx: MTPCContext, options: QueryOptions = {}): Promise<PaginatedResult<T>> {
    const { pagination = {}, sort = [], filters = [] } = options;
    const { page = 1, pageSize = 20 } = pagination;

    const offset = (page - 1) * pageSize;

    // 构建条件
    const conditions = this.buildWhereConditions(ctx, filters);

    // 构建排序
    const orderBy = this.buildOrderBy(sort);

    // 执行计数查询
    const countResult = await this.db.select({ count: count() }).from(this.table).where(conditions);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    // 执行数据查询
    let query = this.db.select().from(this.table).where(conditions).limit(pageSize).offset(offset);

    if (orderBy.length > 0) {
      query = query.orderBy(...orderBy) as any;
    }

    const data = await query;

    return {
      data: data as T[],
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * 创建记录
   *
   * @param ctx - MTPC 上下文
   * @param data - 记录数据
   * @returns 创建的记录
   */
  async create(ctx: MTPCContext, data: Partial<T>): Promise<T> {
    const now = new Date();

    const insertData = {
      ...data,
      tenantId: ctx.tenant.id,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.subject.id,
    };

    const result = await this.db
      .insert(this.table)
      .values(insertData as any)
      .returning();

    return result[0] as T;
  }

  /**
   * 更新记录
   *
   * @param ctx - MTPC 上下文
   * @param id - 记录 ID
   * @param data - 更新数据
   * @returns 更新后的记录或 null
   */
  async update(ctx: MTPCContext, id: string, data: Partial<T>): Promise<T | null> {
    const tableAny = this.table as any;
    const tenantCol = tableAny[this.tenantColumn];

    const updateData = {
      ...data,
      updatedAt: new Date(),
      updatedBy: ctx.subject.id,
    };

    const result = await this.db
      .update(this.table)
      .set(updateData as any)
      .where(and(eq(tableAny.id, id), eq(tenantCol, ctx.tenant.id)))
      .returning();

    return (result[0] as T) ?? null;
  }

  /**
   * 删除记录（硬删除）
   *
   * @param ctx - MTPC 上下文
   * @param id - 记录 ID
   * @returns 是否删除成功
   */
  async delete(ctx: MTPCContext, id: string): Promise<boolean> {
    const tableAny = this.table as any;
    const tenantCol = tableAny[this.tenantColumn];

    const result = await this.db
      .delete(this.table)
      .where(and(eq(tableAny.id, id), eq(tenantCol, ctx.tenant.id)))
      .returning();

    return result.length > 0;
  }

  /**
   * 软删除记录
   *
   * @param ctx - MTPC 上下文
   * @param id - 记录 ID
   * @returns 是否删除成功
   */
  async softDelete(ctx: MTPCContext, id: string): Promise<boolean> {
    const tableAny = this.table as any;
    const tenantCol = tableAny[this.tenantColumn];

    const result = await this.db
      .update(this.table)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.subject.id,
      } as any)
      .where(and(eq(tableAny.id, id), eq(tenantCol, ctx.tenant.id)))
      .returning();

    return result.length > 0;
  }

  /**
   * 统计记录数量
   *
   * @param ctx - MTPC 上下文
   * @param options - 查询选项（过滤条件）
   * @returns 记录数量
   */
  async count(ctx: MTPCContext, options: QueryOptions = {}): Promise<number> {
    const { filters = [] } = options;
    const conditions = this.buildWhereConditions(ctx, filters);

    const result = await this.db.select({ count: count() }).from(this.table).where(conditions);

    return Number(result[0]?.count ?? 0);
  }

  /**
   * 根据条件查找单条记录
   *
   * @param ctx - MTPC 上下文
   * @param conditions - 过滤条件
   * @returns 记录或 null
   */
  async findOne(ctx: MTPCContext, conditions: FilterCondition[]): Promise<T | null> {
    const whereConditions = this.buildWhereConditions(ctx, conditions);

    const result = await this.db.select().from(this.table).where(whereConditions).limit(1);

    return (result[0] as T) ?? null;
  }

  /**
   * 检查记录是否存在
   *
   * @param ctx - MTPC 上下文
   * @param id - 记录 ID
   * @returns 是否存在
   */
  async exists(ctx: MTPCContext, id: string): Promise<boolean> {
    const tableAny = this.table as any;
    const tenantCol = tableAny[this.tenantColumn];

    const result = await this.db
      .select({ count: count() })
      .from(this.table)
      .where(and(eq(tableAny.id, id), eq(tenantCol, ctx.tenant.id)));

    return Number(result[0]?.count ?? 0) > 0;
  }

  /**
   * 构建查询条件
   * 将过滤条件转换为 Drizzle 条件表达式
   *
   * @param ctx - MTPC 上下文
   * @param filters - 过滤条件
   * @returns Drizzle 条件
   *
   **支持的运算符**：
   * - `eq` - 等于
   * - `neq` - 不等于
   * - `gt` - 大于
   * - `gte` - 大于等于
   * - `lt` - 小于
   * - `lte` - 小于等于
   * - `in` - 在数组中
   * - `contains` - 包含
   * - `startsWith` - 以...开头
   * - `endsWith` - 以...结尾
   * - `isNull` - 为空
   * - `isNotNull` - 不为空
   */
  protected buildWhereConditions(ctx: MTPCContext, filters: FilterCondition[]) {
    const tableAny = this.table as any;
    const tenantCol = tableAny[this.tenantColumn];

    const conditions: any[] = [eq(tenantCol, ctx.tenant.id)];

    /**
     * Repository 只负责“执行 FilterCondition / tenant 过滤”，不掺入软删除业务逻辑；
     * 软删除一律靠 @mtpc/soft-delete 插件完成。
     */
    // if (tableAny.deletedAt) {
    //   conditions.push(isNull(tableAny.deletedAt));
    // }

    for (const filter of filters) {
      const column = tableAny[filter.field];
      if (!column) continue;

      switch (filter.operator) {
        case 'eq':
          conditions.push(eq(column, filter.value));
          break;
        case 'neq':
          conditions.push(sql`${column} != ${filter.value}`);
          break;
        case 'gt':
          conditions.push(sql`${column} > ${filter.value}`);
          break;
        case 'gte':
          conditions.push(sql`${column} >= ${filter.value}`);
          break;
        case 'lt':
          conditions.push(sql`${column} < ${filter.value}`);
          break;
        case 'lte':
          conditions.push(sql`${column} <= ${filter.value}`);
          break;
        case 'in':
          if (Array.isArray(filter.value)) {
            conditions.push(inArray(column, filter.value));
          }
          break;
        case 'contains':
          conditions.push(like(column, `%${filter.value}%`));
          break;
        case 'startsWith':
          conditions.push(like(column, `${filter.value}%`));
          break;
        case 'endsWith':
          conditions.push(like(column, `%${filter.value}`));
          break;
        case 'isNull':
          conditions.push(isNull(column));
          break;
        case 'isNotNull':
          conditions.push(isNotNull(column));
          break;
      }
    }

    return and(...conditions);
  }

  /**
   * 构建排序条件
   * 将排序选项转换为 Drizzle 排序表达式
   *
   * @param sort - 排序选项
   * @returns Drizzle 排序表达式
   */
  protected buildOrderBy(sort: SortOptions[]): any[] {
    const tableAny = this.table as any;
    const orderBy: any[] = [];

    for (const s of sort) {
      const column = tableAny[s.field];
      if (!column) continue;

      orderBy.push(s.direction === 'desc' ? desc(column) : asc(column));
    }

    // 默认按创建时间降序
    if (orderBy.length === 0 && tableAny.createdAt) {
      orderBy.push(desc(tableAny.createdAt));
    }

    return orderBy;
  }
}
