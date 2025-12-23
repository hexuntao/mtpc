import type { MTPCContext } from '@mtpc/core';
import {
  and,
  asc,
  between,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  like,
  or,
  sql,
} from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleDB } from '../types.js';

/**
 * 查询构建器
 * 提供流畅的 API 用于构建复杂的数据库查询
 *
 * **功能**：
 * - 链式查询构建
 * - 条件过滤（where、whereIn、whereLike 等）
 * - 排序
 * - 分页
 * - 列选择
 * - 软删除控制
 *
 * **示例**：
 * ```ts
 * const users = await createQueryBuilder(db, usersTable, ctx)
 *   .whereEquals('status', 'active')
 *   .whereLike('name', 'John%')
 *   .orderBy('createdAt', 'desc')
 *   .limit(10)
 *   .getMany();
 * ```
 */
export class QueryBuilder<T extends Record<string, unknown>> {
  /** 数据库实例 */
  private db: DrizzleDB;
  /** Drizzle 表定义 */
  private table: PgTable;
  /** 查询条件列表 */
  private conditions: any[] = [];
  /** 排序条件列表 */
  private sortOptions: any[] = [];
  /** 限制数量 */
  private limitValue?: number;
  /** 偏移量 */
  private offsetValue?: number;
  /** 是否包含已软删除的记录 */
  private includeSoftDeleted = false;

  constructor(db: DrizzleDB, table: PgTable, _ctx: MTPCContext) {
    this.db = db;
    this.table = table;

    // 始终按租户过滤
    const tableAny = table as any;
    this.conditions.push(eq(tableAny.tenantId, _ctx.tenant.id));
  }

  /**
   * 添加 where 条件
   *
   * @param field - 字段名
   * @param operator - 运算符
   * @param value - 值
   * @returns this，支持链式调用
   */
  where(field: string, operator: string, value: unknown): this {
    const tableAny = this.table as any;
    const column = tableAny[field];

    if (!column) {
      throw new Error(`Column not found: ${field}`);
    }

    const condition = this.buildCondition(column, operator, value);
    this.conditions.push(condition);

    return this;
  }

  /**
   * 添加等于条件
   *
   * @param field - 字段名
   * @param value - 值
   * @returns this，支持链式调用
   */
  whereEquals(field: string, value: unknown): this {
    return this.where(field, 'eq', value);
  }

  /**
   * 添加 IN 条件
   *
   * @param field - 字段名
   * @param values - 值数组
   * @returns this，支持链式调用
   */
  whereIn(field: string, values: unknown[]): this {
    return this.where(field, 'in', values);
  }

  /**
   * 添加 LIKE 条件
   *
   * @param field - 字段名
   * @param pattern - 匹配模式
   * @returns this，支持链式调用
   */
  whereLike(field: string, pattern: string): this {
    return this.where(field, 'like', pattern);
  }

  /**
   * 添加 IS NULL 条件
   *
   * @param field - 字段名
   * @returns this，支持链式调用
   */
  whereNull(field: string): this {
    return this.where(field, 'isNull', null);
  }

  /**
   * 添加 IS NOT NULL 条件
   *
   * @param field - 字段名
   * @returns this，支持链式调用
   */
  whereNotNull(field: string): this {
    return this.where(field, 'isNotNull', null);
  }

  /**
   * 添加 BETWEEN 条件
   *
   * @param field - 字段名
   * @param min - 最小值
   * @param max - 最大值
   * @returns this，支持链式调用
   */
  whereBetween(field: string, min: unknown, max: unknown): this {
    const tableAny = this.table as any;
    const column = tableAny[field];

    if (!column) {
      throw new Error(`Column not found: ${field}`);
    }

    this.conditions.push(between(column, min as any, max as any));
    return this;
  }

  /**
   * 添加 OR 条件
   *
   * @param conditions - 条件数组
   * @returns this，支持链式调用
   */
  orWhere(conditions: Array<{ field: string; operator: string; value: unknown }>): this {
    const tableAny = this.table as any;
    const orConditions = conditions
      .map(c => {
        const column = tableAny[c.field];
        if (!column) return null;
        return this.buildCondition(column, c.operator, c.value);
      })
      .filter(Boolean);

    if (orConditions.length > 0) {
      this.conditions.push(or(...orConditions));
    }

    return this;
  }

  /**
   * 添加排序
   *
   * @param field - 字段名
   * @param direction - 排序方向
   * @returns this，支持链式调用
   */
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    const tableAny = this.table as any;
    const column = tableAny[field];

    if (!column) {
      throw new Error(`Column not found: ${field}`);
    }

    this.sortOptions.push(direction === 'desc' ? desc(column) : asc(column));
    return this;
  }

  /**
   * 设置限制数量
   *
   * @param value - 限制数量
   * @returns this，支持链式调用
   */
  limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  /**
   * 设置偏移量
   *
   * @param value - 偏移量
   * @returns this，支持链式调用
   */
  offset(value: number): this {
    this.offsetValue = value;
    return this;
  }

  /**
   * 选择特定列
   *
   * @param _columns - 列名数组
   * @returns this，支持链式调用
   */
  select(..._columns: string[]): this {
    // TODO: 实现列选择功能
    return this;
  }

  /**
   * 包含已软删除的记录
   *
   * @returns this，支持链式调用
   */
  withDeleted(): this {
    this.includeSoftDeleted = true;
    return this;
  }

  /**
   * 执行查询并返回所有结果
   *
   * @returns 查询结果数组
   */
  async getMany(): Promise<T[]> {
    this.applyDefaultFilters();

    let query = this.db
      .select()
      .from(this.table)
      .where(and(...this.conditions));

    if (this.sortOptions.length > 0) {
      query = query.orderBy(...this.sortOptions) as any;
    }

    if (this.limitValue !== undefined) {
      query = query.limit(this.limitValue) as any;
    }

    if (this.offsetValue !== undefined) {
      query = query.offset(this.offsetValue) as any;
    }

    return (await query) as T[];
  }

  /**
   * 执行查询并返回第一条结果
   *
   * @returns 第一条记录或 null
   */
  async getOne(): Promise<T | null> {
    const results = await this.limit(1).getMany();
    return results[0] ?? null;
  }

  /**
   * 获取记录数量
   *
   * @returns 记录数量
   */
  async count(): Promise<number> {
    this.applyDefaultFilters();

    const result = await this.db
      .select({ count: sql`count(*)` })
      .from(this.table)
      .where(and(...this.conditions));

    return Number(result[0]?.count ?? 0);
  }

  /**
   * 检查是否存在记录
   *
   * @returns 是否存在
   */
  async exists(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  }

  /**
   * 根据运算符构建条件
   *
   * @param column - 列
   * @param operator - 运算符
   * @param value - 值
   * @returns Drizzle 条件表达式
   */
  private buildCondition(column: any, operator: string, value: unknown): any {
    switch (operator) {
      case 'eq':
        return eq(column, value);
      case 'neq':
        return sql`${column} != ${value}`;
      case 'gt':
        return sql`${column} > ${value}`;
      case 'gte':
        return sql`${column} >= ${value}`;
      case 'lt':
        return sql`${column} < ${value}`;
      case 'lte':
        return sql`${column} <= ${value}`;
      case 'in':
        return inArray(column, value as any[]);
      case 'like':
        return like(column, value as string);
      case 'isNull':
        return isNull(column);
      case 'isNotNull':
        return isNotNull(column);
      default:
        return eq(column, value);
    }
  }

  /**
   * 应用默认过滤器
   * 自动排除已软删除的记录
   */
  private applyDefaultFilters(): void {
    const tableAny = this.table as any;

    // 默认排除已软删除的记录
    if (!this.includeSoftDeleted && tableAny.deletedAt) {
      this.conditions.push(isNull(tableAny.deletedAt));
    }
  }
}

/**
 * 创建查询构建器
 *
 * @param db - 数据库实例
 * @param table - Drizzle 表定义
 * @param ctx - MTPC 上下文
 * @returns 查询构建器实例
 */
export function createQueryBuilder<T extends Record<string, unknown>>(
  db: DrizzleDB,
  table: PgTable,
  ctx: MTPCContext
): QueryBuilder<T> {
  return new QueryBuilder<T>(db, table, ctx);
}
